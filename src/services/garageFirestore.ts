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
import { db, handleFirestoreError, OperationType } from '../firebase';
import { INITIAL_CONTACTS, INITIAL_GARAGE } from '../data/initialGarage';
import {
  CarId,
  CarProfile,
  CarRenewals,
  CornerPressures,
  PressureLogEntry,
  PurchaseLogEntry,
  TYRE_CORNERS,
  TyreContact,
  TyreCorner,
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
      return renewals;
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
}

export interface GarageSubscriptionsCallbacks {
  onCars: (cars: Partial<Record<CarId, Omit<CarProfile, 'pressureLogs' | 'purchaseLogs'>>>) => void;
  onPressureLogs: (logsByCar: Record<CarId, PressureLogEntry[]>) => void;
  onPurchaseLogs: (purchasesByCar: Record<CarId, PurchaseLogEntry[]>) => void;
  onContacts: (contacts: TyreContact[]) => void;
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
          renewals: (d.renewals as CarRenewals) ?? INITIAL_GARAGE[carKey].renewals,
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

  return () => {
    unsubCars();
    unsubPressure();
    unsubPurchases();
    unsubContacts();
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
  try {
    await updateDoc(doc(db, 'cars', carDocId), {
      renewals,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
