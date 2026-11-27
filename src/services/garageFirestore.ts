import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type FieldValue,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import { INITIAL_CONTACTS, INITIAL_GARAGE } from '../data/initialGarage';
import {
  CarId,
  CarProfile,
  CarRenewals,
  CornerPressures,
  PressureLogEntry,
  PurchaseLogEntry,
  SavedTyreOption,
  TYRE_CORNERS,
  TyreAxle,
  TyreContact,
  TyreCorner,
  WheelImageKey,
} from '../types';

const LEGACY_GARAGE_STORAGE_KEY = 'inflate_garage_v5';
const LEGACY_CONTACTS_STORAGE_KEY = 'inflate_contacts_v2';

function makeDocId(uid: string, suffix: string): string {
  const safeSuffix = suffix.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${uid}_${safeSuffix}`.slice(0, 128);
}

function sanitizeOptionalString(value: string | undefined, maxLen: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function sanitizeBeforePressures(
  raw: Partial<CornerPressures> | undefined
): Partial<CornerPressures> | undefined {
  if (!raw) return undefined;
  const clean: Partial<CornerPressures> = {};
  for (const corner of TYRE_CORNERS) {
    const val = raw[corner];
    if (typeof val === 'number' && Number.isFinite(val) && val >= 1 && val <= 1000) {
      clean[corner] = Math.round(val);
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

function sanitizeLowTyre(
  raw: PressureLogEntry['lowTyre']
): PressureLogEntry['lowTyre'] | undefined {
  if (!raw || !TYRE_CORNERS.includes(raw.corner)) return undefined;
  if (
    typeof raw.beforeKpa === 'number' &&
    Number.isFinite(raw.beforeKpa) &&
    raw.beforeKpa >= 1 &&
    raw.beforeKpa <= 1000
  ) {
    return { corner: raw.corner, beforeKpa: Math.round(raw.beforeKpa) };
  }
  return { corner: raw.corner };
}

function readLegacyRenewals(carId: CarId): CarRenewals | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_GARAGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<CarId, Partial<CarProfile>>>;
    const renewals = parsed[carId]?.renewals;
    if (
      renewals &&
      /^\d{4}-\d{2}-\d{2}$/.test(renewals.insurance) &&
      /^\d{4}-\d{2}-\d{2}$/.test(renewals.cartax)
    ) {
      return {
        insurance: renewals.insurance,
        cartax: renewals.cartax,
        ...(carId === 'slk250'
          ? {
              coolant:
                typeof renewals.coolant === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(renewals.coolant)
                  ? renewals.coolant
                  : INITIAL_GARAGE.slk250.renewals?.coolant ?? '2026-11-16',
            }
          : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function readLegacyContacts(): TyreContact[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_CONTACTS_STORAGE_KEY);
    if (!raw) return INITIAL_CONTACTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_CONTACTS;
    return parsed as TyreContact[];
  } catch {
    return INITIAL_CONTACTS;
  }
}

export async function ensureUserGarageSeeded(uid: string): Promise<void> {
  const carsQuery = query(collection(db, 'cars'), where('ownerId', '==', uid));
  let existingCarsSnap;
  try {
    existingCarsSnap = await getDocs(carsQuery);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'cars');
  }

  if (!existingCarsSnap.empty) {
    for (const docSnap of existingCarsSnap.docs) {
      const data = docSnap.data();
      if (data.carKey === 'slk250' && data.displayTitle === 'Mercedes Benz') {
        try {
          await updateDoc(docSnap.ref, {
            displayTitle: INITIAL_GARAGE.slk250.displayTitle,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `cars/${docSnap.id}`);
        }
      }
    }
    await seedSavedTyresIfEmpty(uid);
    return;
  }

  // Step 1: Create parent car docs first so security rules verify parent car ownership
  const carBatch = writeBatch(db);
  const carIds: CarId[] = ['slk250', 'fortuner'];

  for (const carId of carIds) {
    const template = INITIAL_GARAGE[carId];
    const renewals = readLegacyRenewals(carId) ?? template.renewals ?? {
      insurance: '2027-01-10',
      cartax: '2027-01-10',
    };
    const carDocRef = doc(db, 'cars', makeDocId(uid, carId));
    carBatch.set(carDocRef, {
      ownerId: uid,
      carKey: carId,
      displayTitle: template.displayTitle,
      make: template.make,
      model: template.model,
      trim: template.trim,
      year: template.year,
      bodyStyle: template.bodyStyle,
      paintHex: template.paintHex,
      accentLabel: template.accentLabel,
      recommendedKpa: { ...template.recommendedKpa },
      defaultSizes: { ...template.defaultSizes },
      renewals,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await carBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'cars');
  }

  // Step 2: Seed pressureLogs, purchaseLogs, and contacts into separate collections
  const recordsBatch = writeBatch(db);

  for (const carId of carIds) {
    const template = INITIAL_GARAGE[carId];
    const carDocId = makeDocId(uid, carId);

    for (const log of template.pressureLogs) {
      const logRef = doc(db, 'pressureLogs', makeDocId(uid, log.id));
      const cleanBefore = sanitizeBeforePressures(log.beforePressures);
      const cleanStation = sanitizeOptionalString(log.station, 160);
      const cleanNote = sanitizeOptionalString(log.note, 500);
      const cleanLow = sanitizeLowTyre(log.lowTyre);

      const docData: Record<string, unknown> = {
        ownerId: uid,
        carId,
        carDocId,
        date: log.date,
        pressures: { ...log.pressures },
        source: log.source,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (cleanBefore) docData.beforePressures = cleanBefore;
      if (cleanStation) docData.station = cleanStation;
      if (cleanNote) docData.note = cleanNote;
      if (cleanLow) docData.lowTyre = cleanLow;

      recordsBatch.set(logRef, docData);
    }

    for (const purchase of template.purchaseLogs) {
      const purchaseRef = doc(db, 'purchaseLogs', makeDocId(uid, purchase.id));
      const cleanNotes = sanitizeOptionalString(purchase.notes, 500);
      const docData: Record<string, unknown> = {
        ownerId: uid,
        carId,
        carDocId,
        date: purchase.date,
        vendor: purchase.vendor.slice(0, 160),
        brandModel: purchase.brandModel.slice(0, 160),
        tyreSize: purchase.tyreSize.slice(0, 80),
        corners: purchase.corners,
        totalCost: purchase.totalCost,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (cleanNotes) docData.notes = cleanNotes;

      recordsBatch.set(purchaseRef, docData);
    }
  }

  const seedContacts = readLegacyContacts();
  seedContacts.forEach((contact, index) => {
    const rawId = contact.id && /^[a-zA-Z0-9_-]+$/.test(contact.id)
      ? contact.id
      : `contact-${index + 1}`;
    const contactRef = doc(db, 'contacts', makeDocId(uid, rawId));
    const cleanWebsite = sanitizeOptionalString(contact.website, 300);
    const cleanPhone = sanitizeOptionalString(contact.phone, 40);
    const cleanNotes = sanitizeOptionalString(contact.notes, 500);

    const docData: Record<string, unknown> = {
      ownerId: uid,
      company: (contact.company || 'Tyre Shop').trim().slice(0, 160),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (cleanWebsite) docData.website = cleanWebsite;
    if (cleanPhone) docData.phone = cleanPhone;
    if (cleanNotes) docData.notes = cleanNotes;

    recordsBatch.set(contactRef, docData);
  });

  try {
    await recordsBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'pressureLogs/purchaseLogs/contacts');
  }

  await seedSavedTyresIfEmpty(uid);
}

const VALID_WHEEL_KEYS: WheelImageKey[] = [
  'sport-5spoke',
  'mesh-split',
  'turbine-dark',
  'all-terrain',
];

function sanitizeWheelKey(val: unknown): WheelImageKey {
  return VALID_WHEEL_KEYS.includes(val as WheelImageKey)
    ? (val as WheelImageKey)
    : 'sport-5spoke';
}

function sanitizeAxle(val: unknown): TyreAxle {
  return val === 'Back' ? 'Back' : 'Front';
}

function resolveCanonicalTyreImageFileName(
  carId: CarId,
  axle: TyreAxle,
  brandModel: string
): string | undefined {
  const normalized = brandModel.trim().toLowerCase();
  if (carId === 'slk250' && axle === 'Front' && normalized.includes('prinx')) {
    return 'slk350-front-prinx.png';
  }
  if (carId === 'slk250' && axle === 'Back' && normalized.includes('powertrac')) {
    return 'slk350-back-powertrac.png';
  }
  if (carId === 'fortuner' && axle === 'Front' && normalized.includes('fortune')) {
    return 'fortuner-front-fortune.png';
  }
  if (carId === 'fortuner' && normalized.includes('opa34')) {
    return 'fortuner-front-toyoopa34.png';
  }
  return undefined;
}

export function buildCanonicalTyreImageFileName(
  carId: CarId,
  axle: TyreAxle,
  brandModel: string
): string {
  const carKey = carId === 'slk250' ? 'slk350' : 'fortuner';
  const axleKey = axle.toLowerCase() === 'back' ? 'back' : 'front';
  const brandSlug = (brandModel.trim().split(/\s+/)[0] || 'tyre')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `${carKey}-${axleKey}-${brandSlug || 'tyre'}.png`.slice(0, 120);
}

async function uploadLocalAssetToFirebaseStorage(fileName: string): Promise<string | null> {
  try {
    const fileRef = storageRef(storage, `savedTyres/${fileName}`);
    try {
      return await getDownloadURL(fileRef);
    } catch {
      // Not uploaded yet — fetch bundled PNG from /assets/tyres and upload
    }
    const res = await fetch(`/assets/tyres/${fileName}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    await uploadBytes(fileRef, blob, { contentType: 'image/png' });
    return await getDownloadURL(fileRef);
  } catch {
    return null;
  }
}

export async function uploadCustomTyrePngToFirebaseStorage(
  fileName: string,
  file: Blob
): Promise<string | null> {
  try {
    const cleanName = fileName.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    const fileRef = storageRef(storage, `savedTyres/${cleanName}`);
    await uploadBytes(fileRef, file, { contentType: 'image/png' });
    return await getDownloadURL(fileRef);
  } catch {
    return null;
  }
}

async function seedSavedTyresIfEmpty(uid: string): Promise<void> {
  try {
    const existingTyresSnap = await getDocs(
      query(collection(db, 'savedTyres'), where('ownerId', '==', uid))
    );
    if (existingTyresSnap.empty) {
      const batch = writeBatch(db);
      const carIds: CarId[] = ['slk250', 'fortuner'];
      for (const carId of carIds) {
        const carDocId = makeDocId(uid, carId);
        const starterTyres = INITIAL_GARAGE[carId].savedTyres ?? [];
        for (const tyre of starterTyres) {
          const ref = doc(db, 'savedTyres', makeDocId(uid, tyre.id));
          const cleanNotes = sanitizeOptionalString(tyre.notes, 300);
          const cleanFileName = sanitizeOptionalString(tyre.imageFileName, 120);
          const cleanImageUrl = sanitizeOptionalString(tyre.imageUrl, 500);
          const docData: Record<string, unknown> = {
            ownerId: uid,
            carId,
            carDocId,
            brandModel: tyre.brandModel.slice(0, 120),
            price: Math.max(0, Math.min(100000, Number(tyre.price) || 0)),
            axle: sanitizeAxle(tyre.axle),
            tyreSize: tyre.tyreSize.slice(0, 80),
            wheelImageKey: sanitizeWheelKey(tyre.wheelImageKey),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (cleanFileName) docData.imageFileName = cleanFileName;
          if (cleanImageUrl) docData.imageUrl = cleanImageUrl;
          if (cleanNotes) docData.notes = cleanNotes;
          batch.set(ref, docData);
        }
      }
      await batch.commit();
    } else {
      // Link any existing matching tyre records and seed newly added starter tyres once
      const linkBatch = writeBatch(db);
      let hasUpdates = false;
      let hasToyoOpa34 = false;
      existingTyresSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const carId = d.carId as CarId;
        if (carId !== 'slk250' && carId !== 'fortuner') return;
        const axle = sanitizeAxle(d.axle);
        const brandModel = String(d.brandModel ?? '');
        if (carId === 'fortuner' && brandModel.toLowerCase().includes('opa34')) {
          hasToyoOpa34 = true;
        }
        const canonicalFile = resolveCanonicalTyreImageFileName(carId, axle, brandModel);
        if (!canonicalFile) return;
        const currentFile = typeof d.imageFileName === 'string' ? d.imageFileName : undefined;
        const currentUrl = typeof d.imageUrl === 'string' ? d.imageUrl : undefined;
        if (currentFile !== canonicalFile || !currentUrl) {
          hasUpdates = true;
          linkBatch.update(docSnap.ref, {
            imageFileName: canonicalFile,
            imageUrl: currentUrl || `/assets/tyres/${canonicalFile}`,
            updatedAt: serverTimestamp(),
          });
        }
      });

      const toyoSeedFlag = `inflate_seeded_fort_tyre_4_${uid}`;
      const alreadySeededToyo =
        typeof window !== 'undefined' && window.localStorage.getItem(toyoSeedFlag) === '1';
      const toyoStarter = INITIAL_GARAGE.fortuner.savedTyres?.find((t) => t.id === 'fort-tyre-4');
      if (!hasToyoOpa34 && !alreadySeededToyo && toyoStarter) {
        hasUpdates = true;
        const toyoRef = doc(db, 'savedTyres', makeDocId(uid, toyoStarter.id));
        const toyoData: Record<string, unknown> = {
          ownerId: uid,
          carId: 'fortuner',
          carDocId: makeDocId(uid, 'fortuner'),
          brandModel: toyoStarter.brandModel.slice(0, 120),
          price: Math.max(0, Math.min(100000, Number(toyoStarter.price) || 0)),
          axle: sanitizeAxle(toyoStarter.axle),
          tyreSize: toyoStarter.tyreSize.slice(0, 80),
          wheelImageKey: sanitizeWheelKey(toyoStarter.wheelImageKey),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (toyoStarter.imageFileName) toyoData.imageFileName = toyoStarter.imageFileName;
        if (toyoStarter.imageUrl) toyoData.imageUrl = toyoStarter.imageUrl;
        linkBatch.set(toyoRef, toyoData);
      }

      if (hasUpdates) {
        await linkBatch.commit();
        if (!hasToyoOpa34 && !alreadySeededToyo && toyoStarter && typeof window !== 'undefined') {
          window.localStorage.setItem(toyoSeedFlag, '1');
        }
      }
    }

    // Best-effort sync of canonical cutout PNGs to Firebase Storage and link download URLs
    void syncCanonicalTyresToStorage(uid);
  } catch (error) {
    // Non-fatal if live Firestore rules have not been updated for /savedTyres yet
    console.warn('Saved tyres seed skipped until Firestore rules allow /savedTyres:', error);
  }
}

async function syncCanonicalTyresToStorage(uid: string): Promise<void> {
  try {
    const snap = await getDocs(
      query(collection(db, 'savedTyres'), where('ownerId', '==', uid))
    );
    if (snap.empty) return;

    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      const carId = d.carId as CarId;
      if (carId !== 'slk250' && carId !== 'fortuner') continue;
      const fileName =
        (typeof d.imageFileName === 'string' && d.imageFileName) ||
        resolveCanonicalTyreImageFileName(carId, sanitizeAxle(d.axle), String(d.brandModel ?? ''));
      if (!fileName) continue;
      const currentUrl = typeof d.imageUrl === 'string' ? d.imageUrl : '';
      if (currentUrl.startsWith('https://firebasestorage.googleapis.com/')) continue;

      const storageUrl = await uploadLocalAssetToFirebaseStorage(fileName);
      if (storageUrl && storageUrl.length <= 500) {
        await updateDoc(docSnap.ref, {
          imageFileName: fileName,
          imageUrl: storageUrl,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch {
    // Storage rules or offline state: local /assets/tyres PNG URLs remain active
  }
}

export interface GarageSubscriptionsCallbacks {
  onCars: (cars: Partial<Record<CarId, Omit<CarProfile, 'pressureLogs' | 'purchaseLogs'>>>) => void;
  onPressureLogs: (logsByCar: Record<CarId, PressureLogEntry[]>) => void;
  onPurchaseLogs: (purchasesByCar: Record<CarId, PurchaseLogEntry[]>) => void;
  onContacts: (contacts: TyreContact[]) => void;
  onSavedTyres?: (tyresByCar: Record<CarId, SavedTyreOption[]>, syncedFromDb: boolean) => void;
  onSavedTyresRulesPending?: (pending: boolean) => void;
  onError: (err: Error) => void;
}

export function subscribeToUserGarage(
  uid: string,
  callbacks: GarageSubscriptionsCallbacks
): () => void {
  const unsubCars = onSnapshot(
    query(collection(db, 'cars'), where('ownerId', '==', uid)),
    (snap) => {
      const next: Partial<Record<CarId, Omit<CarProfile, 'pressureLogs' | 'purchaseLogs'>>> = {};
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const carKey = d.carKey as CarId;
        if (carKey !== 'slk250' && carKey !== 'fortuner') return;
        const rawRenewals = d.renewals as Partial<CarRenewals> | undefined;
        const fallbackRenewals = INITIAL_GARAGE[carKey].renewals;
        const renewals: CarRenewals = {
          insurance:
            typeof rawRenewals?.insurance === 'string'
              ? rawRenewals.insurance
              : fallbackRenewals?.insurance ?? '2027-01-10',
          cartax:
            typeof rawRenewals?.cartax === 'string'
              ? rawRenewals.cartax
              : fallbackRenewals?.cartax ?? '2027-01-10',
          ...(typeof rawRenewals?.coolant === 'string'
            ? { coolant: rawRenewals.coolant }
            : carKey === 'slk250'
              ? { coolant: fallbackRenewals?.coolant ?? '2026-11-16' }
              : {}),
        };
        next[carKey] = {
          id: carKey,
          displayTitle: String(d.displayTitle ?? INITIAL_GARAGE[carKey].displayTitle),
          make: String(d.make ?? INITIAL_GARAGE[carKey].make),
          model: String(d.model ?? INITIAL_GARAGE[carKey].model),
          trim: String(d.trim ?? INITIAL_GARAGE[carKey].trim),
          year: Number(d.year ?? INITIAL_GARAGE[carKey].year),
          bodyStyle: d.bodyStyle === 'suv' ? 'suv' : 'roadster',
          paintHex: String(d.paintHex ?? INITIAL_GARAGE[carKey].paintHex),
          accentLabel: String(d.accentLabel ?? INITIAL_GARAGE[carKey].accentLabel),
          recommendedKpa: (d.recommendedKpa as CornerPressures) ?? INITIAL_GARAGE[carKey].recommendedKpa,
          defaultSizes: (d.defaultSizes as { front: string; rear: string }) ?? INITIAL_GARAGE[carKey].defaultSizes,
          renewals,
        };
      });
      callbacks.onCars(next);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'cars');
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  const unsubPressure = onSnapshot(
    query(collection(db, 'pressureLogs'), where('ownerId', '==', uid)),
    (snap) => {
      const grouped: Record<CarId, PressureLogEntry[]> = { slk250: [], fortuner: [] };
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const carId = d.carId as CarId;
        if (carId !== 'slk250' && carId !== 'fortuner') return;
        const entry: PressureLogEntry = {
          id: docSnap.id,
          date: String(d.date),
          pressures: d.pressures as CornerPressures,
          source: d.source === 'camera' ? 'camera' : 'manual',
          ...(d.beforePressures ? { beforePressures: d.beforePressures as Partial<CornerPressures> } : {}),
          ...(d.station ? { station: String(d.station) } : {}),
          ...(d.note ? { note: String(d.note) } : {}),
          ...(d.lowTyre ? { lowTyre: d.lowTyre as { corner: TyreCorner; beforeKpa?: number } } : {}),
        };
        grouped[carId].push(entry);
      });
      grouped.slk250.sort((a, b) => b.date.localeCompare(a.date));
      grouped.fortuner.sort((a, b) => b.date.localeCompare(a.date));
      callbacks.onPressureLogs(grouped);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'pressureLogs');
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  const unsubPurchases = onSnapshot(
    query(collection(db, 'purchaseLogs'), where('ownerId', '==', uid)),
    (snap) => {
      const grouped: Record<CarId, PurchaseLogEntry[]> = { slk250: [], fortuner: [] };
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const carId = d.carId as CarId;
        if (carId !== 'slk250' && carId !== 'fortuner') return;
        const entry: PurchaseLogEntry = {
          id: docSnap.id,
          date: String(d.date),
          vendor: String(d.vendor),
          brandModel: String(d.brandModel),
          tyreSize: String(d.tyreSize),
          corners: Array.isArray(d.corners) ? (d.corners as TyreCorner[]) : ['FL', 'FR'],
          totalCost: Number(d.totalCost ?? 0),
          ...(d.notes ? { notes: String(d.notes) } : {}),
        };
        grouped[carId].push(entry);
      });
      grouped.slk250.sort((a, b) => b.date.localeCompare(a.date));
      grouped.fortuner.sort((a, b) => b.date.localeCompare(a.date));
      callbacks.onPurchaseLogs(grouped);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'purchaseLogs');
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  const unsubContacts = onSnapshot(
    query(collection(db, 'contacts'), where('ownerId', '==', uid)),
    (snap) => {
      const list: TyreContact[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          company: String(d.company),
          ...(d.website ? { website: String(d.website) } : {}),
          ...(d.phone ? { phone: String(d.phone) } : {}),
          ...(d.notes ? { notes: String(d.notes) } : {}),
        });
      });
      list.sort((a, b) => a.company.localeCompare(b.company));
      callbacks.onContacts(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'contacts');
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  const unsubSavedTyres = onSnapshot(
    query(collection(db, 'savedTyres'), where('ownerId', '==', uid)),
    (snap) => {
      const grouped: Record<CarId, SavedTyreOption[]> = { slk250: [], fortuner: [] };
      const sortMeta = new Map<string, number>();
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const carId = d.carId as CarId;
        if (carId !== 'slk250' && carId !== 'fortuner') return;
        const createdMillis =
          typeof d.createdAt?.toMillis === 'function' ? d.createdAt.toMillis() : 0;
        sortMeta.set(docSnap.id, createdMillis);
        grouped[carId].push({
          id: docSnap.id,
          brandModel: String(d.brandModel ?? 'Tyre'),
          price: Number(d.price ?? 0),
          axle: sanitizeAxle(d.axle),
          tyreSize: String(d.tyreSize ?? INITIAL_GARAGE[carId].defaultSizes.front),
          wheelImageKey: sanitizeWheelKey(d.wheelImageKey),
          ...(typeof d.imageFileName === 'string' && d.imageFileName
            ? { imageFileName: d.imageFileName }
            : {}),
          ...(typeof d.imageUrl === 'string' && d.imageUrl ? { imageUrl: d.imageUrl } : {}),
          ...(d.notes ? { notes: String(d.notes) } : {}),
        });
      });
      const sortItems = (list: SavedTyreOption[]) =>
        list.sort((a, b) => {
          const axleDiff = (a.axle === 'Front' ? 0 : 1) - (b.axle === 'Front' ? 0 : 1);
          if (axleDiff !== 0) return axleDiff;
          return (sortMeta.get(a.id) ?? 0) - (sortMeta.get(b.id) ?? 0) || a.id.localeCompare(b.id);
        });
      sortItems(grouped.slk250);
      sortItems(grouped.fortuner);
      callbacks.onSavedTyresRulesPending?.(false);
      callbacks.onSavedTyres?.(grouped, !snap.empty);
    },
    (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission')) {
        callbacks.onSavedTyresRulesPending?.(true);
        return;
      }
      try {
        handleFirestoreError(error, OperationType.LIST, 'savedTyres');
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  return () => {
    unsubCars();
    unsubPressure();
    unsubPurchases();
    unsubContacts();
    unsubSavedTyres();
  };
}

export async function addPressureLogRecord(
  uid: string,
  carId: CarId,
  entry: Omit<PressureLogEntry, 'id'>
): Promise<void> {
  const id = makeDocId(uid, `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const path = `pressureLogs/${id}`;
  const cleanBefore = sanitizeBeforePressures(entry.beforePressures);
  const cleanStation = sanitizeOptionalString(entry.station, 160);
  const cleanNote = sanitizeOptionalString(entry.note, 500);
  const cleanLow = sanitizeLowTyre(entry.lowTyre);

  const payload: Record<string, unknown> = {
    ownerId: uid,
    carId,
    carDocId: makeDocId(uid, carId),
    date: entry.date,
    pressures: { ...entry.pressures },
    source: entry.source,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (cleanBefore) payload.beforePressures = cleanBefore;
  if (cleanStation) payload.station = cleanStation;
  if (cleanNote) payload.note = cleanNote;
  if (cleanLow) payload.lowTyre = cleanLow;

  try {
    await setDoc(doc(db, 'pressureLogs', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePressureLogRecord(
  id: string,
  entry: Omit<PressureLogEntry, 'id'>
): Promise<void> {
  const path = `pressureLogs/${id}`;
  const cleanBefore = sanitizeBeforePressures(entry.beforePressures);
  const cleanStation = sanitizeOptionalString(entry.station, 160);
  const cleanNote = sanitizeOptionalString(entry.note, 500);
  const cleanLow = sanitizeLowTyre(entry.lowTyre);

  const updates: Record<string, unknown | FieldValue> = {
    date: entry.date,
    pressures: { ...entry.pressures },
    source: entry.source,
    beforePressures: cleanBefore ?? deleteField(),
    station: cleanStation ?? deleteField(),
    note: cleanNote ?? deleteField(),
    lowTyre: cleanLow ?? deleteField(),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'pressureLogs', id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePressureLogRecord(id: string): Promise<void> {
  const path = `pressureLogs/${id}`;
  try {
    await deleteDoc(doc(db, 'pressureLogs', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addPurchaseLogRecord(
  uid: string,
  carId: CarId,
  entry: Omit<PurchaseLogEntry, 'id'>
): Promise<void> {
  const id = makeDocId(uid, `buy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const path = `purchaseLogs/${id}`;
  const cleanNotes = sanitizeOptionalString(entry.notes, 500);

  const payload: Record<string, unknown> = {
    ownerId: uid,
    carId,
    carDocId: makeDocId(uid, carId),
    date: entry.date,
    vendor: (entry.vendor.trim() || 'Workshop').slice(0, 160),
    brandModel: (entry.brandModel.trim() || 'Tyre Set').slice(0, 160),
    tyreSize: (entry.tyreSize.trim() || 'Standard').slice(0, 80),
    corners: entry.corners.length > 0 ? entry.corners.slice(0, 4) : ['FL', 'FR'],
    totalCost: Math.max(0, Math.min(1000000, Number(entry.totalCost) || 0)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (cleanNotes) payload.notes = cleanNotes;

  try {
    await setDoc(doc(db, 'purchaseLogs', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deletePurchaseLogRecord(id: string): Promise<void> {
  const path = `purchaseLogs/${id}`;
  try {
    await deleteDoc(doc(db, 'purchaseLogs', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addContactRecord(
  uid: string,
  entry: Omit<TyreContact, 'id'>
): Promise<void> {
  const id = makeDocId(uid, `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const path = `contacts/${id}`;
  const cleanWebsite = sanitizeOptionalString(entry.website, 300);
  const cleanPhone = sanitizeOptionalString(entry.phone, 40);
  const cleanNotes = sanitizeOptionalString(entry.notes, 500);

  const payload: Record<string, unknown> = {
    ownerId: uid,
    company: (entry.company.trim() || 'Tyre Shop').slice(0, 160),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (cleanWebsite) payload.website = cleanWebsite;
  if (cleanPhone) payload.phone = cleanPhone;
  if (cleanNotes) payload.notes = cleanNotes;

  try {
    await setDoc(doc(db, 'contacts', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateContactRecord(
  id: string,
  entry: Omit<TyreContact, 'id'>
): Promise<void> {
  const path = `contacts/${id}`;
  const cleanWebsite = sanitizeOptionalString(entry.website, 300);
  const cleanPhone = sanitizeOptionalString(entry.phone, 40);
  const cleanNotes = sanitizeOptionalString(entry.notes, 500);

  const updates: Record<string, unknown | FieldValue> = {
    company: (entry.company.trim() || 'Tyre Shop').slice(0, 160),
    website: cleanWebsite ?? deleteField(),
    phone: cleanPhone ?? deleteField(),
    notes: cleanNotes ?? deleteField(),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'contacts', id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteContactRecord(id: string): Promise<void> {
  const path = `contacts/${id}`;
  try {
    await deleteDoc(doc(db, 'contacts', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateCarRenewalsRecord(
  uid: string,
  carId: CarId,
  renewals: CarRenewals
): Promise<void> {
  const carDocId = makeDocId(uid, carId);
  const path = `cars/${carDocId}`;
  const cleanRenewals: CarRenewals = {
    insurance: renewals.insurance,
    cartax: renewals.cartax,
    ...(carId === 'slk250' && renewals.coolant ? { coolant: renewals.coolant } : {}),
  };
  try {
    await updateDoc(doc(db, 'cars', carDocId), {
      renewals: cleanRenewals,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addSavedTyreRecord(
  uid: string,
  carId: CarId,
  entry: Omit<SavedTyreOption, 'id'>
): Promise<void> {
  const id = makeDocId(uid, `tyre-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const path = `savedTyres/${id}`;
  const cleanNotes = sanitizeOptionalString(entry.notes, 300);
  const axle = sanitizeAxle(entry.axle);
  const canonicalFile =
    sanitizeOptionalString(entry.imageFileName, 120) ??
    resolveCanonicalTyreImageFileName(carId, axle, entry.brandModel);
  const cleanImageUrl =
    sanitizeOptionalString(entry.imageUrl, 500) ??
    (canonicalFile ? `/assets/tyres/${canonicalFile}` : undefined);

  const payload: Record<string, unknown> = {
    ownerId: uid,
    carId,
    carDocId: makeDocId(uid, carId),
    brandModel: (entry.brandModel.trim() || 'Tyre Option').slice(0, 120),
    price: Math.max(0, Math.min(100000, Number(entry.price) || 0)),
    axle,
    tyreSize: (entry.tyreSize.trim() || INITIAL_GARAGE[carId].defaultSizes.front).slice(0, 80),
    wheelImageKey: sanitizeWheelKey(entry.wheelImageKey),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (canonicalFile) payload.imageFileName = canonicalFile;
  if (cleanImageUrl) payload.imageUrl = cleanImageUrl;
  if (cleanNotes) payload.notes = cleanNotes;

  try {
    await setDoc(doc(db, 'savedTyres', id), payload);
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (msg.includes('permission') && ('imageFileName' in payload || 'imageUrl' in payload)) {
      const legacyPayload = { ...payload };
      delete legacyPayload.imageFileName;
      delete legacyPayload.imageUrl;
      try {
        await setDoc(doc(db, 'savedTyres', id), legacyPayload);
        return;
      } catch (retryError) {
        handleFirestoreError(retryError, OperationType.CREATE, path);
      }
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSavedTyreRecord(
  id: string,
  carId: CarId,
  entry: Omit<SavedTyreOption, 'id'>
): Promise<void> {
  const path = `savedTyres/${id}`;
  const cleanNotes = sanitizeOptionalString(entry.notes, 300);
  const axle = sanitizeAxle(entry.axle);
  const canonicalFile =
    sanitizeOptionalString(entry.imageFileName, 120) ??
    resolveCanonicalTyreImageFileName(carId, axle, entry.brandModel);
  const cleanImageUrl =
    sanitizeOptionalString(entry.imageUrl, 500) ??
    (canonicalFile ? `/assets/tyres/${canonicalFile}` : undefined);

  const updates: Record<string, unknown | FieldValue> = {
    brandModel: (entry.brandModel.trim() || 'Tyre Option').slice(0, 120),
    price: Math.max(0, Math.min(100000, Number(entry.price) || 0)),
    axle,
    tyreSize: (entry.tyreSize.trim() || INITIAL_GARAGE[carId].defaultSizes.front).slice(0, 80),
    wheelImageKey: sanitizeWheelKey(entry.wheelImageKey),
    imageFileName: canonicalFile ?? deleteField(),
    imageUrl: cleanImageUrl ?? deleteField(),
    notes: cleanNotes ?? deleteField(),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'savedTyres', id), updates);
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (msg.includes('permission')) {
      const legacyUpdates = { ...updates };
      delete legacyUpdates.imageFileName;
      delete legacyUpdates.imageUrl;
      try {
        await updateDoc(doc(db, 'savedTyres', id), legacyUpdates);
        return;
      } catch (retryError) {
        handleFirestoreError(retryError, OperationType.UPDATE, path);
      }
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSavedTyreRecord(id: string): Promise<void> {
  const path = `savedTyres/${id}`;
  try {
    await deleteDoc(doc(db, 'savedTyres', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
