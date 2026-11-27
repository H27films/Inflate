import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trash2, X, Store, Ruler, Globe, Phone, ClipboardPaste, Check, ChevronDown, Disc, Upload } from 'lucide-react';
import {
  CarProfile,
  CORNER_LABELS,
  PurchaseLogEntry,
  SavedTyreOption,
  TYRE_CORNERS,
  TyreAxle,
  TyreContact,
  TyreCorner,
  TyrePositionAxle,
  WheelImageKey,
} from '../types';
import {
  formatDisplayDate,
  formatTyreAge,
  formatTyreAgeMonthsOrWeeks,
  getCarTyreSizingOptions,
  getCornerPurchaseInfo,
  getTodayIso,
  matchCarTyreSizeOption,
  parseLocalDate,
} from '../data/initialGarage';
import {
  buildCanonicalTyreImageFileName,
  uploadCustomTyrePngToFirebaseStorage,
} from '../services/garageFirestore';
import {
  FocusedSideOption,
  SavedTyresCarousel,
  TyreSide,
  WHEEL_STYLE_OPTIONS,
} from './SavedTyresCarousel';

interface PurchasesViewProps {
  car: CarProfile;
  contacts: TyreContact[];
  addModalOpen: boolean;
  onOpenAddModal?: () => void;
  onCloseAddModal: () => void;
  onAddPurchase: (entry: Omit<PurchaseLogEntry, 'id'>) => void;
  onDeletePurchase: (id: string) => void;
  onAddContact: (entry: Omit<TyreContact, 'id'>) => void;
  onUpdateContact: (id: string, entry: Omit<TyreContact, 'id'>) => void;
  onDeleteContact: (id: string) => void;
  savedTyresRulesPending?: boolean;
  onAddSavedTyre: (entry: Omit<SavedTyreOption, 'id'>) => Promise<void> | void;
  onUpdateSavedTyre: (id: string, entry: Omit<SavedTyreOption, 'id'>) => Promise<void> | void;
  onDeleteSavedTyre: (id: string) => Promise<void> | void;
  onExpandedChange?: (hasExpanded: boolean) => void;
}

function formatRM(amount: number): string {
  return `RM${amount.toLocaleString('en-MY', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPurchaseDateDash(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  const month = dt.toLocaleDateString('en-US', { month: 'short' });
  return `${month} ${dt.getDate()} - ${dt.getFullYear()}`;
}

function formatWhatsAppHref(phone: string): string {
  let digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) {
    digits = `60${digits.slice(1)}`;
  }
  return `https://wa.me/${digits}`;
}

function formatWebsiteHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '#';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatWebsiteLabel(url: string): string {
  if (/goo\.gl\/maps|maps\.google/i.test(url)) return 'Google Maps';
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.77 14.07c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.14.11-1.84-.11-.43-.14-.98-.32-1.69-.63-2.97-1.28-4.91-4.29-5.06-4.49-.15-.2-1.21-1.61-1.21-3.07 0-1.46.76-2.18 1.03-2.48.27-.3.59-.38.79-.38.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.59.83 2.02.9 2.17.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.36 1.46.3.15.47.12.64-.08.17-.2.74-.86.94-1.15.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.34.08.12.08.7-.16 1.38z" />
    </svg>
  );
}

function ClockwiseCardGlow() {
  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.76, 1, 0.76] }}
      exit={{ opacity: 0 }}
      transition={{
        opacity: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
      }}
      className="pointer-events-none absolute inset-0"
    >
      {/* Long clockwise-sweeping outer halo: bright leading front tapering smoothly backward */}
      <div className="absolute -inset-[3.5px] rounded-[19px] overflow-hidden blur-[7px]">
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'linear' }}
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(255,90,31,0.06) 55deg, rgba(255,90,31,0.16) 125deg, rgba(255,90,31,0.3) 195deg, rgba(255,90,31,0.48) 260deg, rgba(255,112,52,0.7) 312deg, rgba(255,172,118,0.88) 342deg, rgba(255,120,64,0.42) 354deg, transparent 360deg)',
            }}
            className="w-[180%] aspect-square shrink-0"
          />
        </div>
      </div>

      {/* Crisp long tapered perimeter edge highlight */}
      <div className="absolute -inset-[1.5px] rounded-[17px] overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'linear' }}
            style={{
              background:
                'conic-gradient(from 0deg, rgba(255,90,31,0.08) 0deg, rgba(255,90,31,0.12) 55deg, rgba(255,90,31,0.22) 125deg, rgba(255,90,31,0.36) 195deg, rgba(255,90,31,0.56) 260deg, rgba(255,118,58,0.78) 312deg, rgba(255,196,154,0.96) 342deg, rgba(255,130,72,0.46) 354deg, rgba(255,90,31,0.08) 360deg)',
            }}
            className="w-[180%] aspect-square shrink-0"
          />
        </div>
      </div>
    </motion.div>
  );
}

function findMatchingContact(
  vendor: string,
  contacts: TyreContact[]
): TyreContact | undefined {
  const vendorBase = vendor.split(',')[0].trim().toLowerCase();
  if (!vendorBase) return undefined;
  return contacts.find((c) => {
    const companyLower = c.company.trim().toLowerCase();
    return (
      companyLower === vendorBase ||
      vendorBase.includes(companyLower) ||
      companyLower.includes(vendorBase)
    );
  });
}

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

const KNOWN_TYRE_BRANDS = [
  'Michelin',
  'Continental',
  'Bridgestone',
  'Pirelli',
  'Goodyear',
  'Yokohama',
  'Toyo',
  'Hankook',
  'Dunlop',
  'Falken',
  'Prinx',
  'Powertrac',
  'Fortune',
  'Kumho',
  'Maxxis',
  'BFGoodrich',
  'Nitto',
  'Nexen',
  'Giti',
  'Viking',
  'Firestone',
  'Cooper',
];

function parsePurchaseText(
  raw: string,
  car: CarProfile
): {
  date?: string;
  vendor?: string;
  brandModel?: string;
  tyreSize?: string;
  corners?: TyreCorner[];
  totalCost?: string;
  notes?: string;
} {
  const text = raw.replace(/\r/g, '');
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const result: {
    date?: string;
    vendor?: string;
    brandModel?: string;
    tyreSize?: string;
    corners?: TyreCorner[];
    totalCost?: string;
    notes?: string;
  } = {};

  // 1. Date (ISO, DD/MM/YYYY, DD MMM YYYY)
  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const dmyWordMatch = text.match(
    /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(20\d{2})\b/i
  );
  const dmySlashMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);

  if (isoMatch) {
    result.date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else if (dmyWordMatch) {
    const day = dmyWordMatch[1].padStart(2, '0');
    const month = MONTH_MAP[dmyWordMatch[2].toLowerCase()];
    if (month) result.date = `${dmyWordMatch[3]}-${month}-${day}`;
  } else if (dmySlashMatch) {
    const day = dmySlashMatch[1].padStart(2, '0');
    const month = dmySlashMatch[2].padStart(2, '0');
    result.date = `${dmySlashMatch[3]}-${month}-${day}`;
  }

  // 2. Tyre size (e.g. 225/40R18 92Y, 265/65 R17)
  const sizeLabelLine = lines.find((l) => /^(?:tyre\s*size|size)\b/i.test(l));
  const sizeSource = sizeLabelLine ?? text;
  const sizeMatch = sizeSource.match(
    /\b(\d{3})\s*\/\s*(\d{2})\s*(Z?R)\s*(\d{2})(?:\s+(\d{2,3}[A-Z]{1,2}))?\b/i
  );
  if (sizeMatch) {
    const base = `${sizeMatch[1]}/${sizeMatch[2]} ${sizeMatch[3].toUpperCase()}${sizeMatch[4]}`;
    result.tyreSize = sizeMatch[5] ? `${base} ${sizeMatch[5].toUpperCase()}` : base;
  }

  // 3. Total Cost (RM)
  const totalMatch =
    text.match(/(?:total\s*payable|grand\s*total|total)[\t:\s]*RM\s*([\d,]+(?:\.\d{1,2})?)/i) ??
    text.match(/RM\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (totalMatch) {
    const cleaned = totalMatch[1].replace(/,/g, '');
    if (Number(cleaned) > 0) result.totalCost = cleaned;
  }

  // 4. Corners / Position
  const positionLine = lines.find((l) => /^(?:position|tyres?|corners?)\b/i.test(l));
  const cornerSearch = positionLine ?? text;
  const explicitCorners: TyreCorner[] = [];
  if (/\b(?:FL|front\s*left)\b/i.test(cornerSearch)) explicitCorners.push('FL');
  if (/\b(?:FR|front\s*right)\b/i.test(cornerSearch)) explicitCorners.push('FR');
  if (/\b(?:RL|rear\s*left|back\s*left)\b/i.test(cornerSearch)) explicitCorners.push('RL');
  if (/\b(?:RR|rear\s*right|back\s*right)\b/i.test(cornerSearch)) explicitCorners.push('RR');

  if (explicitCorners.length > 0) {
    result.corners = explicitCorners;
  } else if (/\b(?:all\s*4|4\s*tyres|four\s*tyres|full\s*set)\b/i.test(cornerSearch)) {
    result.corners = ['FL', 'FR', 'RL', 'RR'];
  } else if (/\bfront\b/i.test(cornerSearch) && !/\b(?:back|rear)\b/i.test(cornerSearch)) {
    result.corners = ['FL', 'FR'];
  } else if (/\b(?:back|rear)\b/i.test(cornerSearch) && !/\bfront\b/i.test(cornerSearch)) {
    result.corners = ['RL', 'RR'];
  } else if (result.tyreSize && car.defaultSizes.front !== car.defaultSizes.rear) {
    const compact = result.tyreSize.replace(/\s+/g, '').toLowerCase();
    if (compact.includes(car.defaultSizes.front.slice(0, 8).replace(/\s+/g, '').toLowerCase())) {
      result.corners = ['FL', 'FR'];
    } else if (compact.includes(car.defaultSizes.rear.slice(0, 8).replace(/\s+/g, '').toLowerCase())) {
      result.corners = ['RL', 'RR'];
    }
  }

  // 5. Workshop / Vendor
  const workshopLine = lines.find((l) =>
    /^(?:workshop|vendor|shop|bought\s*from|merchant|garage)\b/i.test(l)
  );
  if (workshopLine) {
    const val = workshopLine
      .replace(/^(?:workshop|vendor|shop|bought\s*from|merchant|garage)[\t:\s]+/i, '')
      .trim();
    if (val) {
      result.vendor = val.split(/\s*,\s*(?:no\.?\s*\d|\d+[a-z]?[,\s]|lot\s)/i)[0].trim();
    }
  } else {
    const atMatch = text.match(/\b(?:at|from)\s+([A-Z][A-Za-z0-9\s&.-]{2,36}?)(?=\s+(?:on|for|RM|\d{1,2}[\/\-])|$)/);
    if (atMatch) {
      result.vendor = atMatch[1].trim();
    }
  }

  // 6. Tyre make and model
  const modelLine = lines.find((l) =>
    /^(?:tyre\s*make\s*(?:and|&)?\s*model|tyre\s*brand|brand\s*(?:and|&)?\s*model|make\s*(?:and|&)?\s*model|tyre\s*model)\b/i.test(
      l
    )
  );
  if (modelLine) {
    result.brandModel = modelLine
      .replace(
        /^(?:tyre\s*make\s*(?:and|&)?\s*model|tyre\s*brand|brand\s*(?:and|&)?\s*model|make\s*(?:and|&)?\s*model|tyre\s*model)[\t:\s]+/i,
        ''
      )
      .trim();
  } else {
    const brandPattern = new RegExp(
      `\\b((?:${KNOWN_TYRE_BRANDS.join('|')})(?:\\s+[A-Za-z0-9/+-]+){0,3})`,
      'i'
    );
    const brandMatch = text.match(brandPattern);
    if (brandMatch) {
      result.brandModel = brandMatch[1]
        .replace(/\b\d{3}\/\d{2}.*$/i, '')
        .replace(/\b(?:front|rear|back|RM)\b.*$/i, '')
        .trim();
    }
  }

  // 7. Notes (Included / Receipt / Booked through)
  const noteParts: string[] = [];
  const bookedLine = lines.find((l) => /^booked\s*through\b/i.test(l));
  if (bookedLine) {
    const bookedVal = bookedLine.replace(/^booked\s*through[\t:\s]+/i, '').trim();
    if (bookedVal && !/^not\s*stated$/i.test(bookedVal)) noteParts.push(bookedVal);
  }
  const receiptLine = lines.find((l) => /^receipt\s*(?:no\.?|#)\b/i.test(l));
  if (receiptLine) {
    const recVal = receiptLine.replace(/^receipt\s*(?:no\.?|#)[\t:\s]+/i, '').trim();
    if (recVal) noteParts.push(`Receipt ${recVal}`);
  }
  const includedLine = lines.find((l) => /^included\b/i.test(l));
  if (includedLine) {
    const incVal = includedLine.replace(/^included[\t:\s]+/i, '').trim();
    if (incVal) noteParts.push(incVal);
  }
  if (noteParts.length > 0) {
    result.notes = noteParts.join(' · ');
  }

  return result;
}

export function PurchasesView({
  car,
  contacts,
  addModalOpen,
  onOpenAddModal,
  onCloseAddModal,
  onAddPurchase,
  onDeletePurchase,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  savedTyresRulesPending = false,
  onAddSavedTyre,
  onUpdateSavedTyre,
  onDeleteSavedTyre,
  onExpandedChange,
}: PurchasesViewProps) {
  const [showContactModal, setShowContactModal] = useState(false);
  const [purchaseLogExpanded, setPurchaseLogExpanded] = useState(false);
  const [installationsExpanded, setInstallationsExpanded] = useState(false);
  const [contactsExpanded, setContactsExpanded] = useState(false);
  const [focusedAxle, setFocusedAxle] = useState<TyrePositionAxle | null>(null);
  const [focusedSide, setFocusedSide] = useState<TyreSide>('Left');

  const allCollapsed =
    !purchaseLogExpanded && !installationsExpanded && !contactsExpanded;

  useEffect(() => {
    onExpandedChange?.(!allCollapsed);
  }, [allCollapsed, onExpandedChange]);

  useEffect(() => {
    setFocusedAxle(null);
    setFocusedSide('Left');
  }, [car.id]);

  useEffect(() => {
    if (!focusedAxle) return;
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target;
      if (target instanceof Element) {
        if (
          target.closest('[data-focus-interactive="true"]') ||
          target.closest('[role="dialog"]')
        ) {
          return;
        }
      }
      setFocusedAxle(null);
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [focusedAxle]);

  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<'details' | 'paste'>('details');
  const [pasteText, setPasteText] = useState('');
  const [parsedSuccess, setParsedSuccess] = useState(false);
  const [highlightedPurchaseId, setHighlightedPurchaseId] = useState<string | null>(null);
  const [highlightedContactId, setHighlightedContactId] = useState<string | null>(null);
  const purchaseRowRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const contactRowRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const pendingContactScrollRef = useRef<string | null>(null);
  const contactsSectionRef = useRef<HTMLElement | null>(null);
  const installationsSectionRef = useRef<HTMLElement | null>(null);
  const pendingPresetAxleRef = useRef<TyrePositionAxle | TyreCorner | null>(null);

  // Add (+) modal state: 'choose' -> 'purchase' | 'tyre'
  const [addMode, setAddMode] = useState<'choose' | 'purchase' | 'tyre'>('choose');

  // Purchase form state
  const [date, setDate] = useState(getTodayIso());
  const [vendor, setVendor] = useState('');
  const [brandModel, setBrandModel] = useState('');
  const [tyreSize, setTyreSize] = useState(car.defaultSizes.front);
  const [corners, setCorners] = useState<TyreCorner[]>(['FL', 'FR', 'RL', 'RR']);
  const [totalCost, setTotalCost] = useState('');
  const [notes, setNotes] = useState('');

  // Add-to-carousel tyre form state
  const [carouselBrandModel, setCarouselBrandModel] = useState('');
  const [carouselPrice, setCarouselPrice] = useState('');
  const [carouselAxle, setCarouselAxle] = useState<TyreAxle>('Front & Back');
  const [carouselTyreSize, setCarouselTyreSize] = useState(car.defaultSizes.front);
  const [carouselWheelKey, setCarouselWheelKey] = useState<WheelImageKey>(
    car.bodyStyle === 'suv' ? 'all-terrain' : 'sport-5spoke'
  );
  const [carouselImageFileName, setCarouselImageFileName] = useState<string | undefined>(undefined);
  const [carouselImageUrl, setCarouselImageUrl] = useState<string | undefined>(undefined);
  const [carouselNotes, setCarouselNotes] = useState('');
  const [savingCarouselTyre, setSavingCarouselTyre] = useState(false);
  const [uploadingCarouselPng, setUploadingCarouselPng] = useState(false);
  const [carouselFormError, setCarouselFormError] = useState<string | null>(null);
  const carouselFileInputRef = useRef<HTMLInputElement | null>(null);

  // Contact form state
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [contactNotes, setContactNotes] = useState('');

  const sizingOptions = getCarTyreSizingOptions(car);
  const garageOptions = Array.from(
    new Map(
      [
        ...contacts.map((c) => c.company.trim()),
        ...car.purchaseLogs.map((p) => p.vendor.trim()),
      ]
        .filter(Boolean)
        .map((name) => [name.toLowerCase(), name] as const)
    ).values()
  ).sort((a, b) => a.localeCompare(b));
  const [useCustomGarage, setUseCustomGarage] = useState(false);

  useEffect(() => {
    if (addModalOpen) {
      const presetTarget = pendingPresetAxleRef.current;
      pendingPresetAxleRef.current = null;
      const presetIsRear =
        presetTarget === 'Back' || presetTarget === 'RL' || presetTarget === 'RR';
      const presetAxle: TyrePositionAxle | null = presetTarget
        ? presetIsRear
          ? 'Back'
          : 'Front'
        : null;
      setAddMode(presetTarget ? 'purchase' : 'choose');
      setDate(getTodayIso());
      setVendor(garageOptions[0] ?? '');
      setUseCustomGarage(garageOptions.length === 0);
      setBrandModel('');
      setTyreSize(
        presetIsRear ? car.defaultSizes.rear : car.defaultSizes.front
      );
      setCorners(
        presetTarget === 'FL' || presetTarget === 'FR' || presetTarget === 'RL' || presetTarget === 'RR'
          ? [presetTarget]
          : presetTarget === 'Front'
            ? ['FL', 'FR']
            : presetTarget === 'Back'
              ? ['RL', 'RR']
              : ['FL', 'FR', 'RL', 'RR']
      );
      setTotalCost('');
      setNotes('');
      setPasteText('');
      setParsedSuccess(false);
      setEntryMode('details');

      setCarouselBrandModel('');
      setCarouselPrice('');
      setCarouselAxle(presetAxle ?? 'Front & Back');
      setCarouselTyreSize(
        presetAxle === 'Back' ? car.defaultSizes.rear : car.defaultSizes.front
      );
      setCarouselWheelKey(car.bodyStyle === 'suv' ? 'all-terrain' : 'sport-5spoke');
      setCarouselImageFileName(undefined);
      setCarouselImageUrl(undefined);
      setCarouselNotes('');
      setCarouselFormError(null);
    }
  }, [addModalOpen, car.id, car.bodyStyle, car.defaultSizes.front, car.defaultSizes.rear]);

  useEffect(() => {
    if (!highlightedPurchaseId) return;
    const timer = window.setTimeout(() => {
      setHighlightedPurchaseId(null);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [highlightedPurchaseId]);

  useEffect(() => {
    if (!highlightedContactId) return;
    const timer = window.setTimeout(() => {
      setHighlightedContactId(null);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [highlightedContactId]);

  const scrollToBottomOfPage = () => {
    window.scrollTo({
      top: Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      ),
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    if (!contactsExpanded) return;
    if (pendingContactScrollRef.current) {
      const targetId = pendingContactScrollRef.current;
      const t = window.setTimeout(() => {
        const el = contactRowRefs.current[targetId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedContactId(targetId);
        }
      }, 280);
      const clearRefTimer = window.setTimeout(() => {
        if (pendingContactScrollRef.current === targetId) {
          pendingContactScrollRef.current = null;
        }
      }, 450);
      return () => {
        window.clearTimeout(t);
        window.clearTimeout(clearRefTimer);
      };
    }
    const t1 = window.setTimeout(scrollToBottomOfPage, 100);
    const t2 = window.setTimeout(scrollToBottomOfPage, 320);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [contactsExpanded]);

  useEffect(() => {
    if (!installationsExpanded) return;
    const t = window.setTimeout(() => {
      installationsSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 220);
    return () => window.clearTimeout(t);
  }, [installationsExpanded]);

  const scrollToPurchase = (purchaseId: string) => {
    const wasCollapsed = !purchaseLogExpanded;
    if (wasCollapsed) {
      setPurchaseLogExpanded(true);
    }
    window.setTimeout(
      () => {
        const el = purchaseRowRefs.current[purchaseId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedPurchaseId(purchaseId);
        }
      },
      wasCollapsed ? 260 : 0
    );
  };

  const handleNavigateToContact = (
    vendorName: string,
    matched?: TyreContact | null
  ) => {
    const targetContact = matched ?? findMatchingContact(vendorName, contacts);
    setFocusedAxle(null);
    setPurchaseLogExpanded(false);
    setInstallationsExpanded(false);

    if (targetContact) {
      if (contactsExpanded) {
        window.setTimeout(() => {
          contactRowRefs.current[targetContact.id]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
          setHighlightedContactId(targetContact.id);
        }, 60);
      } else {
        pendingContactScrollRef.current = targetContact.id;
        setContactsExpanded(true);
      }
    } else {
      setContactsExpanded(true);
    }
  };

  const sortedPurchases = [...car.purchaseLogs].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const frontLeftPurchase = getCornerPurchaseInfo(car.purchaseLogs, 'FL');
  const frontRightPurchase = getCornerPurchaseInfo(car.purchaseLogs, 'FR');
  const rearLeftPurchase = getCornerPurchaseInfo(car.purchaseLogs, 'RL');
  const rearRightPurchase = getCornerPurchaseInfo(car.purchaseLogs, 'RR');

  const areCornerPurchasesDifferent = (
    left: PurchaseLogEntry | null,
    right: PurchaseLogEntry | null
  ): boolean => {
    if (!left && !right) return false;
    if (!left || !right) return true;
    if (left.id === right.id) return false;
    return (
      left.date !== right.date ||
      left.brandModel.trim().toLowerCase() !== right.brandModel.trim().toLowerCase() ||
      left.tyreSize.trim().toLowerCase() !== right.tyreSize.trim().toLowerCase() ||
      left.vendor.trim().toLowerCase() !== right.vendor.trim().toLowerCase()
    );
  };

  const frontIsSplit = areCornerPurchasesDifferent(frontLeftPurchase, frontRightPurchase);
  const rearIsSplit = areCornerPurchasesDifferent(rearLeftPurchase, rearRightPurchase);

  const pickLatest = (
    first: PurchaseLogEntry | null,
    second: PurchaseLogEntry | null
  ): PurchaseLogEntry | null =>
    first && second ? (first.date >= second.date ? first : second) : first ?? second ?? null;

  const frontPurchase = pickLatest(frontLeftPurchase, frontRightPurchase);
  const rearPurchase = pickLatest(rearLeftPurchase, rearRightPurchase);

  const formatCompactSplitAge = (
    left: PurchaseLogEntry | null,
    right: PurchaseLogEntry | null
  ) =>
    `${left ? formatTyreAge(left.date) : '—'} / ${right ? formatTyreAge(right.date) : '—'}`;

  const frontAge = frontIsSplit
    ? formatCompactSplitAge(frontLeftPurchase, frontRightPurchase)
    : frontPurchase
      ? focusedAxle === 'Front'
        ? formatTyreAgeMonthsOrWeeks(frontPurchase.date)
        : formatTyreAge(frontPurchase.date)
      : '—';
  const rearAge = rearIsSplit
    ? formatCompactSplitAge(rearLeftPurchase, rearRightPurchase)
    : rearPurchase
      ? focusedAxle === 'Back'
        ? formatTyreAgeMonthsOrWeeks(rearPurchase.date)
        : formatTyreAge(rearPurchase.date)
      : '—';

  const focusedSides: FocusedSideOption[] | null =
    focusedAxle === 'Front' && frontIsSplit
      ? [
          {
            side: 'Left',
            corner: 'FL',
            purchase: frontLeftPurchase,
            contact: frontLeftPurchase
              ? findMatchingContact(frontLeftPurchase.vendor, contacts)
              : undefined,
          },
          {
            side: 'Right',
            corner: 'FR',
            purchase: frontRightPurchase,
            contact: frontRightPurchase
              ? findMatchingContact(frontRightPurchase.vendor, contacts)
              : undefined,
          },
        ]
      : focusedAxle === 'Back' && rearIsSplit
        ? [
            {
              side: 'Left',
              corner: 'RL',
              purchase: rearLeftPurchase,
              contact: rearLeftPurchase
                ? findMatchingContact(rearLeftPurchase.vendor, contacts)
                : undefined,
            },
            {
              side: 'Right',
              corner: 'RR',
              purchase: rearRightPurchase,
              contact: rearRightPurchase
                ? findMatchingContact(rearRightPurchase.vendor, contacts)
                : undefined,
            },
          ]
        : null;

  const focusedPurchase =
    focusedAxle === 'Front'
      ? frontPurchase
      : focusedAxle === 'Back'
        ? rearPurchase
        : null;
  const focusedContact = focusedPurchase
    ? findMatchingContact(focusedPurchase.vendor, contacts)
    : undefined;

  const handleToggleAxleFocus = (axle: TyrePositionAxle) => {
    if (focusedAxle === axle) {
      setFocusedAxle(null);
      return;
    }
    setPurchaseLogExpanded(false);
    setInstallationsExpanded(false);
    setContactsExpanded(false);
    setFocusedSide('Left');
    setFocusedAxle(axle);
  };

  const handleAddPurchaseForAxle = (target: TyrePositionAxle | TyreCorner) => {
    pendingPresetAxleRef.current = target;
    setFocusedAxle(null);
    onOpenAddModal?.();
  };

  const toggleCorner = (corner: TyreCorner) => {
    setCorners((prev) => {
      const wasSelected = prev.includes(corner);
      if (wasSelected && prev.length <= 1) return prev;
      const next = wasSelected
        ? prev.filter((c) => c !== corner)
        : [...prev, corner];
      const hasFront = next.includes('FL') || next.includes('FR');
      const hasRear = next.includes('RL') || next.includes('RR');
      if (hasFront && !hasRear) {
        setTyreSize(car.defaultSizes.front);
      } else if (hasRear && !hasFront) {
        setTyreSize(car.defaultSizes.rear);
      } else if (!wasSelected) {
        setTyreSize(
          corner === 'RL' || corner === 'RR'
            ? car.defaultSizes.rear
            : car.defaultSizes.front
        );
      }
      return next;
    });
  };

  const applyParsedText = (raw: string) => {
    if (!raw.trim()) return;
    const parsed = parsePurchaseText(raw, car);
    if (parsed.date) setDate(parsed.date);
    if (parsed.vendor) {
      const matchedGarage = garageOptions.find(
        (g) => g.toLowerCase() === parsed.vendor!.trim().toLowerCase()
      );
      if (matchedGarage) {
        setVendor(matchedGarage);
        setUseCustomGarage(false);
      } else {
        setVendor(parsed.vendor);
        setUseCustomGarage(true);
      }
    }
    if (parsed.brandModel) setBrandModel(parsed.brandModel);
    if (parsed.corners && parsed.corners.length > 0) {
      setCorners(parsed.corners);
      const hasFront = parsed.corners.includes('FL') || parsed.corners.includes('FR');
      const hasRear = parsed.corners.includes('RL') || parsed.corners.includes('RR');
      if (hasRear && !hasFront) {
        setTyreSize(car.defaultSizes.rear);
      } else if (hasFront && !hasRear) {
        setTyreSize(car.defaultSizes.front);
      }
    }
    const matchedSize = matchCarTyreSizeOption(parsed.tyreSize, car);
    if (matchedSize) {
      setTyreSize(matchedSize);
    }
    if (parsed.totalCost) setTotalCost(parsed.totalCost);
    if (parsed.notes) setNotes(parsed.notes);
    setParsedSuccess(true);
    setEntryMode('details');
  };

  const handleCarouselAxleChange = (nextAxle: TyreAxle) => {
    setCarouselAxle(nextAxle);
    setCarouselTyreSize(
      nextAxle === 'Back' ? car.defaultSizes.rear : car.defaultSizes.front
    );
  };

  const handleCarouselPngUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingCarouselPng(true);
    setCarouselFormError(null);
    try {
      const targetName = buildCanonicalTyreImageFileName(
        car.id,
        carouselAxle,
        carouselBrandModel || file.name.replace(/\.[^.]+$/, '')
      );
      const uploadedUrl = await uploadCustomTyrePngToFirebaseStorage(targetName, file);
      if (!uploadedUrl) {
        setCarouselFormError('Firebase Storage upload is not permitted yet for this bucket.');
        return;
      }
      setCarouselImageFileName(targetName);
      setCarouselImageUrl(uploadedUrl);
    } finally {
      setUploadingCarouselPng(false);
    }
  };

  const handleCarouselTyreSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (savingCarouselTyre) return;
    setCarouselFormError(null);
    setSavingCarouselTyre(true);
    const payload: Omit<SavedTyreOption, 'id'> = {
      brandModel: carouselBrandModel.trim(),
      price: Math.max(0, Number(carouselPrice) || 0),
      axle: carouselAxle,
      tyreSize:
        carouselTyreSize.trim() ||
        (carouselAxle === 'Back' ? car.defaultSizes.rear : car.defaultSizes.front),
      wheelImageKey: carouselWheelKey,
      ...(carouselImageFileName ? { imageFileName: carouselImageFileName } : {}),
      ...(carouselImageUrl ? { imageUrl: carouselImageUrl } : {}),
      notes: carouselNotes.trim() || undefined,
    };

    try {
      await onAddSavedTyre(payload);
      setPurchaseLogExpanded(false);
      setInstallationsExpanded(false);
      setContactsExpanded(false);
      setFocusedAxle(null);
      onCloseAddModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save tyre option.';
      setCarouselFormError(
        msg.toLowerCase().includes('permission')
          ? 'Publish the savedTyres Firestore rule first to save changes.'
          : msg
      );
    } finally {
      setSavingCarouselTyre(false);
    }
  };

  const handlePasteClip = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted.trim()) {
      e.preventDefault();
      setPasteText(pasted);
      applyParsedText(pasted);
    }
  };

  const openContactModal = () => {
    setEditingContactId(null);
    setCompany('');
    setWebsite('');
    setPhone('');
    setContactNotes('');
    setShowContactModal(true);
  };

  const openContactForVendor = (vendorName: string, existing?: TyreContact) => {
    if (existing) {
      setEditingContactId(existing.id);
      setCompany(existing.company);
      setWebsite(existing.website ?? '');
      setPhone(existing.phone ?? '');
      setContactNotes(existing.notes ?? '');
    } else {
      setEditingContactId(null);
      setCompany(vendorName.split(',')[0].trim());
      setWebsite('');
      setPhone('');
      setContactNotes('');
    }
    setShowContactModal(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const numericCost = Number(totalCost) || 0;
    onAddPurchase({
      date,
      vendor: vendor.trim(),
      brandModel: brandModel.trim(),
      tyreSize: tyreSize.trim(),
      corners,
      totalCost: numericCost,
      notes: notes.trim() || undefined,
    });
    onCloseAddModal();
  };

  const handleContactSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      company: company.trim(),
      website: website.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: contactNotes.trim() || undefined,
    };
    if (editingContactId) {
      onUpdateContact(editingContactId, payload);
    } else {
      onAddContact(payload);
    }
    setShowContactModal(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="flex-1 w-full max-w-5xl lg:max-w-[540px] mx-auto flex flex-col justify-between pt-3 pb-0"
      >
        <div className="px-4 sm:px-6 lg:px-4 space-y-3">
          {/* Top Tyre Sizing Section on normal app background (no outer box) */}
          <section className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-3 px-0.5">
              <h1 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-[#111315] leading-tight">
                {car.displayTitle}
              </h1>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5E646A] shrink-0">
                <Ruler className="w-3.5 h-3.5" />
                <span>Tyre Sizing</span>
              </span>
            </div>

            <div className="flex items-stretch overflow-visible py-1">
              <motion.div
                initial={false}
                animate={{
                  width:
                    focusedAxle === 'Front'
                      ? '100%'
                      : focusedAxle === 'Back'
                        ? '0%'
                        : 'calc(50% - 5px)',
                  marginRight: focusedAxle === null ? 10 : 0,
                  opacity: focusedAxle === 'Back' ? 0 : 1,
                  scale: focusedAxle === 'Back' ? 0.96 : 1,
                }}
                transition={{
                  duration: 0.34,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`relative shrink-0 overflow-visible ${
                  focusedAxle === 'Back' ? 'pointer-events-none' : ''
                }`}
              >
                {focusedAxle === 'Front' && <ClockwiseCardGlow />}
                <button
                  type="button"
                  data-focus-interactive="true"
                  onClick={() => handleToggleAxleFocus('Front')}
                  aria-pressed={focusedAxle === 'Front'}
                  className={`relative z-10 w-full overflow-hidden text-left rounded-2xl bg-[#16191D] text-white cursor-pointer transition-all hover:bg-[#1E2228] focus:outline-none ${
                    focusedAxle === 'Front'
                      ? 'shadow-[0_6px_18px_rgba(17,19,21,0.2)]'
                      : 'shadow-[0_2px_8px_rgba(17,19,21,0.08)]'
                  } ${
                    focusedAxle === 'Back' ? 'p-0' : 'p-3.5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <span
                        className={`font-semibold whitespace-nowrap block transition-all ${
                          focusedAxle === 'Front'
                            ? 'text-sm sm:text-[15px] text-white'
                            : 'text-[13px] sm:text-sm text-white/80'
                        }`}
                      >
                        Front (FL / FR)
                      </span>
                      <span className="mt-1 font-mono text-[12.5px] sm:text-sm font-semibold text-white whitespace-nowrap block">
                        {focusedAxle === 'Front' && frontIsSplit
                          ? (focusedSide === 'Left'
                              ? frontLeftPurchase?.tyreSize
                              : frontRightPurchase?.tyreSize) ?? car.defaultSizes.front
                          : car.defaultSizes.front}
                      </span>
                    </div>
                    {focusedAxle === 'Front' && frontIsSplit ? (
                      <div className="flex flex-col items-end text-right gap-0.5 shrink-0">
                        <span
                          className={`font-display text-xs sm:text-[13px] tabular-nums whitespace-nowrap transition-opacity duration-200 ${
                            focusedSide === 'Left'
                              ? 'font-bold text-white opacity-100'
                              : 'font-medium text-white opacity-30'
                          }`}
                        >
                          Left -{' '}
                          {frontLeftPurchase
                            ? formatTyreAgeMonthsOrWeeks(frontLeftPurchase.date)
                            : 'None'}
                        </span>
                        <span
                          className={`font-display text-xs sm:text-[13px] tabular-nums whitespace-nowrap transition-opacity duration-200 ${
                            focusedSide === 'Right'
                              ? 'font-bold text-white opacity-100'
                              : 'font-medium text-white opacity-30'
                          }`}
                        >
                          Right -{' '}
                          {frontRightPurchase
                            ? formatTyreAgeMonthsOrWeeks(frontRightPurchase.date)
                            : 'None'}
                        </span>
                      </div>
                    ) : (
                      <span
                        className={`font-display font-bold tabular-nums text-white whitespace-nowrap shrink-0 ${
                          frontIsSplit ? 'text-xs sm:text-[13px]' : 'text-sm'
                        }`}
                      >
                        {frontAge}
                      </span>
                    )}
                  </div>
                </button>
              </motion.div>

              <motion.div
                initial={false}
                animate={{
                  width:
                    focusedAxle === 'Back'
                      ? '100%'
                      : focusedAxle === 'Front'
                        ? '0%'
                        : 'calc(50% - 5px)',
                  opacity: focusedAxle === 'Front' ? 0 : 1,
                  scale: focusedAxle === 'Front' ? 0.96 : 1,
                }}
                transition={{
                  duration: 0.34,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`relative shrink-0 overflow-visible ${
                  focusedAxle === 'Front' ? 'pointer-events-none' : ''
                }`}
              >
                {focusedAxle === 'Back' && <ClockwiseCardGlow />}
                <button
                  type="button"
                  data-focus-interactive="true"
                  onClick={() => handleToggleAxleFocus('Back')}
                  aria-pressed={focusedAxle === 'Back'}
                  className={`relative z-10 w-full overflow-hidden text-left rounded-2xl bg-[#16191D] text-white cursor-pointer transition-all hover:bg-[#1E2228] focus:outline-none ${
                    focusedAxle === 'Back'
                      ? 'shadow-[0_6px_18px_rgba(17,19,21,0.2)]'
                      : 'shadow-[0_2px_8px_rgba(17,19,21,0.08)]'
                  } ${
                    focusedAxle === 'Front' ? 'p-0' : 'p-3.5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <span
                        className={`font-semibold whitespace-nowrap block transition-all ${
                          focusedAxle === 'Back'
                            ? 'text-sm sm:text-[15px] text-white'
                            : 'text-[13px] sm:text-sm text-white/80'
                        }`}
                      >
                        Back (RL / RR)
                      </span>
                      <span className="mt-1 font-mono text-[12.5px] sm:text-sm font-semibold text-white whitespace-nowrap block">
                        {focusedAxle === 'Back' && rearIsSplit
                          ? (focusedSide === 'Left'
                              ? rearLeftPurchase?.tyreSize
                              : rearRightPurchase?.tyreSize) ?? car.defaultSizes.rear
                          : car.defaultSizes.rear}
                      </span>
                    </div>
                    {focusedAxle === 'Back' && rearIsSplit ? (
                      <div className="flex flex-col items-end text-right gap-0.5 shrink-0">
                        <span
                          className={`font-display text-xs sm:text-[13px] tabular-nums whitespace-nowrap transition-opacity duration-200 ${
                            focusedSide === 'Left'
                              ? 'font-bold text-white opacity-100'
                              : 'font-medium text-white opacity-30'
                          }`}
                        >
                          Left -{' '}
                          {rearLeftPurchase
                            ? formatTyreAgeMonthsOrWeeks(rearLeftPurchase.date)
                            : 'None'}
                        </span>
                        <span
                          className={`font-display text-xs sm:text-[13px] tabular-nums whitespace-nowrap transition-opacity duration-200 ${
                            focusedSide === 'Right'
                              ? 'font-bold text-white opacity-100'
                              : 'font-medium text-white opacity-30'
                          }`}
                        >
                          Right -{' '}
                          {rearRightPurchase
                            ? formatTyreAgeMonthsOrWeeks(rearRightPurchase.date)
                            : 'None'}
                        </span>
                      </div>
                    ) : (
                      <span
                        className={`font-display font-bold tabular-nums text-white whitespace-nowrap shrink-0 ${
                          rearIsSplit ? 'text-xs sm:text-[13px]' : 'text-sm'
                        }`}
                      >
                        {rearAge}
                      </span>
                    )}
                  </div>
                </button>
              </motion.div>
            </div>
          </section>

        </div>

        {/* Middle Horizontal Wheel & Tyre Showcase when all 3 drawers are collapsed */}
        <AnimatePresence initial={false}>
          {allCollapsed && (
            <SavedTyresCarousel
              car={car}
              tyres={car.savedTyres ?? []}
              focusedAxle={focusedAxle}
              focusedPurchase={focusedPurchase}
              focusedContact={focusedContact}
              focusedSides={focusedSides}
              focusedSide={focusedSide}
              onFocusedSideChange={setFocusedSide}
              onNavigateToContact={handleNavigateToContact}
              onAddPurchaseForAxle={handleAddPurchaseForAxle}
              rulesPending={savedTyresRulesPending}
              onAddTyre={onAddSavedTyre}
              onUpdateTyre={onUpdateSavedTyre}
              onDeleteTyre={onDeleteSavedTyre}
            />
          )}
        </AnimatePresence>

        {/* Bottom Stacked Drawers: Hidden smoothly while an axle is focused; Purchase log + Installation + Contacts */}
        <AnimatePresence initial={false}>
          {focusedAxle === null && (
            <motion.div
              key="bottom-stacked-drawers"
              initial={{ opacity: 0, y: 24, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 20, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 px-1.5 sm:px-3 overflow-hidden"
            >
          {/* Purchase History Logs (Expanded by default, collapses down to stack above Installation by Tyre) */}
          <section
            className={`relative z-0 overflow-hidden transition-all duration-300 rounded-t-3xl rounded-b-none ring-1 ring-black/[0.05] ${
              purchaseLogExpanded
                ? 'bg-gradient-to-b from-white to-[#FAFAF9] shadow-[0_-4px_20px_rgba(17,19,21,0.06)]'
                : 'bg-gradient-to-b from-white via-[#FBFBFA] to-[#F1F3EF] shadow-[0_-4px_18px_rgba(17,19,21,0.05)]'
            }`}
          >
            <button
              type="button"
              onClick={() => setPurchaseLogExpanded((prev) => !prev)}
              aria-expanded={purchaseLogExpanded}
              className={`w-full px-5 flex items-center justify-between gap-3 text-left transition-all duration-300 cursor-pointer ${
                purchaseLogExpanded
                  ? 'pt-4 pb-3 hover:bg-black/[0.015]'
                  : 'pt-3.5 pb-8 hover:bg-black/[0.02]'
              }`}
            >
              <h2 className="font-display text-[15px] font-[450] text-[#111315]">
                Purchase log
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs text-[#5E646A] tabular-nums">
                {purchaseLogExpanded && <span>Newest first</span>}
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-300 ${
                    purchaseLogExpanded ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </button>

            <AnimatePresence initial={false}>
              {purchaseLogExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.42, 0, 0.58, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-9 pt-1">
                    {sortedPurchases.length === 0 ? (
                      <div className="py-10 text-center text-sm text-[#6B7075]">
                        No tyre purchases recorded for {car.displayTitle}. Tap + above to log your set.
                      </div>
                    ) : (
                      <ul className="divide-y divide-black/6">
                {sortedPurchases.map((item) => {
                  const perTyre =
                    item.corners.length > 0
                      ? Math.round((item.totalCost / item.corners.length) * 100) / 100
                      : item.totalCost;
                  const matchedContact = findMatchingContact(item.vendor, contacts);
                  const isHighlighted = highlightedPurchaseId === item.id;

                  return (
                    <li
                      key={item.id}
                      ref={(el) => {
                        purchaseRowRefs.current[item.id] = el;
                      }}
                      className={`py-4 first:pt-2 last:pb-2 transition-all duration-300 ${
                        isHighlighted
                          ? 'bg-[#F3F4F2] ring-2 ring-[#FF5A1F]/70 rounded-2xl px-3 -mx-3'
                          : ''
                      }`}
                    >
                      <div className="space-y-1">
                        {/* Row 1: Larger, thinner date */}
                        <p className="font-display text-lg font-light tracking-tight text-[#5E646A] tabular-nums leading-tight">
                          {formatPurchaseDateDash(item.date)}
                        </p>

                        {/* Row 2: Top-aligned details/badge/price with bottom-aligned action buttons */}
                        <div className="flex items-stretch gap-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="font-display font-semibold text-base text-[#111315] leading-[1.15]">
                              {item.brandModel}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#5E646A] flex-wrap leading-snug">
                              <span className="font-mono font-medium text-[#5E646A]">
                                {item.tyreSize}
                              </span>
                              <span aria-hidden="true" className="text-[#9AA0A6]">·</span>
                              <span className="inline-flex items-center gap-1 text-[#111315] font-medium">
                                <Store className="w-3.5 h-3.5 text-[#5E646A] shrink-0" />
                                {item.vendor}
                              </span>
                            </div>

                            {item.notes && (
                              <p className="mt-1.5 text-xs text-[#6B7075] leading-relaxed">
                                {item.notes}
                              </p>
                            )}
                          </div>

                          <div
                            className="self-start grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#F3F4F2] border border-black/5 shrink-0"
                            aria-label={`Fitted corners: ${item.corners.join(', ')}`}
                          >
                            {TYRE_CORNERS.map((c) => {
                              const active = item.corners.includes(c);
                              return (
                                <span
                                  key={c}
                                  className={`w-[18px] h-[13px] rounded-[3px] flex items-center justify-center font-mono text-[8.5px] font-semibold ${
                                    active
                                      ? 'bg-[#111315] text-white'
                                      : 'bg-black/8 text-[#8C9298]'
                                  }`}
                                >
                                  {c}
                                </span>
                              );
                            })}
                          </div>

                          <div className="min-w-[86px] flex flex-col items-end justify-between gap-2 shrink-0 text-right">
                            <div>
                              <div className="font-display text-lg font-bold tabular-nums text-[#111315] leading-[1.05]">
                                {formatRM(item.totalCost)}
                              </div>
                              <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[#5E646A] leading-tight">
                                {formatRM(perTyre)}/tyre
                              </div>
                              <div className="mt-0.5 text-[11px] font-medium tabular-nums text-[#111315] leading-tight">
                                <span aria-hidden="true" className="text-[#9AA0A6] mr-1">·</span>
                                {formatTyreAge(item.date)} old
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onDeletePurchase(item.id)}
                                aria-label={`Delete purchase from ${item.vendor}`}
                                className="w-9 h-9 rounded-full flex items-center justify-center text-[#9AA0A6] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              {matchedContact?.phone ? (
                                <a
                                  href={formatWhatsAppHref(matchedContact.phone)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`WhatsApp ${matchedContact.company}`}
                                  title={`WhatsApp ${matchedContact.company} (${matchedContact.phone})`}
                                  className="w-9 h-9 rounded-full bg-[#111315] text-white hover:bg-black/80 transition-colors flex items-center justify-center shadow-[0_2px_8px_rgba(17,19,21,0.14)]"
                                >
                                  <WhatsAppIcon className="w-4 h-4" />
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openContactForVendor(item.vendor, matchedContact)}
                                  aria-label={`Add WhatsApp number for ${item.vendor}`}
                                  title={`Add WhatsApp number for ${item.vendor}`}
                                  className="w-9 h-9 rounded-full bg-[#111315] text-white hover:bg-black/80 transition-colors flex items-center justify-center shadow-[0_2px_8px_rgba(17,19,21,0.14)] cursor-pointer"
                                >
                                  <WhatsAppIcon className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
                      </ul>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Per-Corner Installed Tyres: Soft Gradient Stone Tab & Drawer */}
          <section
            ref={installationsSectionRef}
            className={`relative z-10 -mt-5 scroll-mb-24 overflow-hidden transition-all duration-300 rounded-t-3xl rounded-b-none bg-gradient-to-b from-[#ECEEE9] via-[#E2E4DF] to-[#D6D9D4] text-[#111315] ring-1 ring-inset ring-white/60 ${
              installationsExpanded
                ? 'shadow-[0_-6px_22px_-4px_rgba(17,19,21,0.09)]'
                : 'shadow-[0_-6px_18px_-4px_rgba(17,19,21,0.08)]'
            }`}
          >
            <button
              type="button"
              onClick={() => setInstallationsExpanded((prev) => !prev)}
              aria-expanded={installationsExpanded}
              className={`w-full px-5 flex items-center justify-between gap-3 text-left transition-all duration-300 cursor-pointer ${
                installationsExpanded
                  ? 'pt-4 pb-3 hover:bg-black/[0.02]'
                  : 'pt-3.5 pb-8 hover:bg-black/[0.03]'
              }`}
            >
              <h2 className="font-display text-[15px] font-[450] text-[#111315]">
                Installation by Tyre
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs text-[#5E646A]">
                {installationsExpanded && <span>Age &amp; last price</span>}
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-300 ${
                    installationsExpanded ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </button>

            <AnimatePresence initial={false}>
              {installationsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.42, 0, 0.58, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-4 sm:px-5 pb-9 grid grid-cols-2 gap-2.5">
                    {TYRE_CORNERS.map((corner) => {
                      const info = getCornerPurchaseInfo(car.purchaseLogs, corner);
                      const age = info ? formatTyreAge(info.date) : '—';
                      const perTyre =
                        info && info.corners.length > 0
                          ? Math.round((info.totalCost / info.corners.length) * 100) / 100
                          : null;

                      const cardInner = (
                        <>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-mono text-xs font-semibold text-[#111315]">
                              {corner}
                            </span>
                            <span className="font-display text-lg font-bold tabular-nums text-[#111315]">
                              {age}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-1 mt-0.5">
                            <p className="text-[10.5px] sm:text-[11px] text-[#5E646A] whitespace-nowrap">
                              {CORNER_LABELS[corner]}
                            </p>
                            {perTyre !== null && (
                              <span className="font-mono text-[10.5px] sm:text-[11px] font-semibold text-[#111315] tabular-nums whitespace-nowrap shrink-0">
                                {formatRM(perTyre)}
                              </span>
                            )}
                          </div>
                          {info ? (
                            <div className="mt-2 pt-2 border-t border-black/6 text-[11px] text-[#5E646A] space-y-1">
                              <p className="text-xs font-semibold text-[#111315] leading-snug">
                                {info.brandModel}
                              </p>
                              <p className="font-mono text-[#5E646A] truncate">
                                {info.tyreSize}
                              </p>
                              <p className="tabular-nums text-[#5E646A]">
                                {formatDisplayDate(info.date)}
                              </p>
                              <p className="font-mono text-xs font-bold text-[#111315] tabular-nums">
                                {formatRM(info.totalCost)} total
                              </p>
                            </div>
                          ) : (
                            <p className="mt-2 pt-2 border-t border-black/6 text-[11px] text-[#6B7075]">
                              No purchase recorded
                            </p>
                          )}
                        </>
                      );

                      if (info) {
                        return (
                          <button
                            key={corner}
                            type="button"
                            onClick={() => scrollToPurchase(info.id)}
                            aria-label={`Jump to ${CORNER_LABELS[corner]} purchase in purchase log`}
                            className="p-3.5 rounded-2xl bg-gradient-to-b from-[#FAFBF9] to-[#F3F4F2] border border-white/85 ring-1 ring-black/[0.04] shadow-[0_2px_8px_rgba(17,19,21,0.04)] text-left hover:from-white hover:to-[#F8F9F7] active:scale-[0.98] transition-all cursor-pointer"
                          >
                            {cardInner}
                          </button>
                        );
                      }

                      return (
                        <div
                          key={corner}
                          className="p-3.5 rounded-2xl bg-gradient-to-b from-[#FAFBF9] to-[#F3F4F2] border border-white/85 ring-1 ring-black/[0.04] shadow-[0_2px_8px_rgba(17,19,21,0.04)]"
                        >
                          {cardInner}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Collapsible Contacts Card: Rounded All Corners, Dark Graphite Gradient Over Installation */}
          <section
            ref={contactsSectionRef}
            className="relative z-20 -mt-5 bg-gradient-to-br from-[#272B33] via-[#1B1E24] to-[#121418] text-white rounded-3xl ring-1 ring-inset ring-white/12 shadow-[0_-6px_20px_-6px_rgba(17,19,21,0.16),0_14px_28px_-10px_rgba(17,19,21,0.26)] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setContactsExpanded((prev) => !prev)}
              aria-expanded={contactsExpanded}
              className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <h2 className="font-display text-[15px] font-[450] text-white">
                Contacts
              </h2>
              <ChevronDown
                className={`w-4 h-4 text-white/65 transition-transform duration-300 ${
                  contactsExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence initial={false}>
              {contactsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.42, 0, 0.58, 1] }}
                  onAnimationComplete={() => {
                    if (!highlightedContactId && !pendingContactScrollRef.current) {
                      scrollToBottomOfPage();
                    }
                  }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-1 border-t border-white/10">
                    <div className="flex items-center justify-between gap-3 mb-3 pt-2.5">
                      <p className="text-xs text-white/65">
                        Tyre shops, maps &amp; quick WhatsApp
                      </p>
                      <button
                        type="button"
                        onClick={openContactModal}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-white text-[#111315] text-xs font-semibold flex items-center gap-1.5 hover:bg-white/90 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add contact</span>
                      </button>
                    </div>

                    {contacts.length === 0 ? (
                      <div className="py-6 text-center text-xs text-white/60">
                        No tyre shop contacts saved yet. Tap Add contact to save a shop.
                      </div>
                    ) : (
                      <ul className="divide-y divide-white/10">
                        {contacts.map((contact) => {
                          const isHighlighted = highlightedContactId === contact.id;
                          return (
                            <li
                              key={contact.id}
                              ref={(el) => {
                                contactRowRefs.current[contact.id] = el;
                              }}
                              className={`py-3 first:pt-1 last:pb-1 transition-all duration-300 ${
                                isHighlighted
                                  ? 'bg-white/14 ring-2 ring-[#FF5A1F] shadow-[0_0_20px_rgba(255,90,31,0.28)] rounded-2xl px-3 -mx-3'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <p className="font-display font-semibold text-sm text-white truncate">
                                    {contact.company}
                                  </p>

                                <div className="flex items-center gap-3 text-xs text-white/70 flex-wrap">
                                  {contact.phone && (
                                    <a
                                      href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}
                                      className="inline-flex items-center gap-1 font-mono text-white hover:underline"
                                    >
                                      <Phone className="w-3 h-3 text-white/65" />
                                      {contact.phone}
                                    </a>
                                  )}

                                  {contact.website && (
                                    <>
                                      {contact.phone && (
                                        <span aria-hidden="true" className="text-white/35">·</span>
                                      )}
                                      <a
                                        href={formatWebsiteHref(contact.website)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-white/80 hover:text-white underline underline-offset-2 truncate max-w-[200px]"
                                      >
                                        <Globe className="w-3 h-3 shrink-0" />
                                        <span className="truncate">
                                          {formatWebsiteLabel(contact.website)}
                                        </span>
                                      </a>
                                    </>
                                  )}
                                </div>

                                {contact.notes && (
                                  <p className="text-xs text-white/55 truncate">
                                    {contact.notes}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {contact.phone ? (
                                  <a
                                    href={formatWhatsAppHref(contact.phone)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Message ${contact.company} on WhatsApp`}
                                    title={`WhatsApp ${contact.company}`}
                                    className="w-10 h-10 rounded-full bg-white text-[#111315] hover:bg-white/90 transition-colors flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.22)]"
                                  >
                                    <WhatsAppIcon className="w-4 h-4" />
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openContactForVendor(contact.company, contact)}
                                    aria-label={`Add WhatsApp number for ${contact.company}`}
                                    title={`Add WhatsApp number for ${contact.company}`}
                                    className="w-10 h-10 rounded-full bg-white text-[#111315] hover:bg-white/90 transition-colors flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.22)] cursor-pointer"
                                  >
                                    <WhatsAppIcon className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onDeleteContact(contact.id)}
                                  aria-label={`Delete contact ${contact.company}`}
                                  className="w-9 h-9 rounded-full flex items-center justify-center text-white/45 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Add Modal: Drops down from top below header, portaled above BottomNav */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {addModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[calc(4.15rem+env(safe-area-inset-top))] px-0 sm:px-4"
                onClick={onCloseAddModal}
              >
                {addMode === 'choose' ? (
                  <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Add tyre or purchase"
                    initial={{ y: -24, opacity: 0, scale: 0.98 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: -20, opacity: 0, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    onClick={(e) => e.stopPropagation()}
                    className="mx-3.5 sm:mx-0 w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl"
                  >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-[#111315]">
                      Add to garage
                    </h3>
                    <p className="text-xs text-[#5E646A]">
                      {car.displayTitle} ({car.trim})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onCloseAddModal}
                    aria-label="Close modal"
                    className="w-10 h-10 rounded-full bg-[#F3F4F2] flex items-center justify-center text-[#111315] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAddMode('purchase')}
                    className="w-full p-4 rounded-2xl bg-[#16191D] text-white hover:bg-[#1E2228] active:scale-[0.99] transition-all flex items-center gap-3.5 text-left cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <Store className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-semibold text-white">
                        Log tyre purchase
                      </p>
                      <p className="mt-0.5 text-xs text-white/65">
                        Record fitted tyres, workshop, date &amp; cost
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddMode('tyre')}
                    className="w-full p-4 rounded-2xl bg-[#F3F4F2] text-[#111315] border border-black/8 hover:bg-[#EAECE8] active:scale-[0.99] transition-all flex items-center gap-3.5 text-left cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-black/8 flex items-center justify-center shrink-0">
                      <Disc className="w-4.5 h-4.5 text-[#111315]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-semibold text-[#111315]">
                        Add tyres
                      </p>
                      <p className="mt-0.5 text-xs text-[#5E646A]">
                        Save a tyre option &amp; price to the carousel
                      </p>
                    </div>
                  </button>
                </div>
              </motion.div>
            ) : addMode === 'tyre' ? (
              <motion.form
                role="dialog"
                aria-modal="true"
                aria-label="Add tyre to carousel"
                initial={{ y: -24, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -20, opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleCarouselTyreSubmit}
                className="w-full max-w-md h-[calc(100dvh-4.15rem-env(safe-area-inset-top))] bg-white rounded-t-3xl rounded-b-none px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3 shadow-2xl overflow-y-auto flex flex-col justify-between"
              >
                <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setAddMode('choose')}
                      aria-label="Back to options"
                      className="w-9 h-9 rounded-full bg-[#F3F4F2] flex items-center justify-center text-[#111315] hover:bg-[#E7E9E5] cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-[#111315]">
                        Add tyres
                      </h3>
                      <p className="text-xs text-[#5E646A]">
                        {car.displayTitle} ({car.trim})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onCloseAddModal}
                    aria-label="Close modal"
                    className="w-10 h-10 rounded-full bg-[#F3F4F2] flex items-center justify-center text-[#111315] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Wheel Image Style Picker */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="block text-xs font-medium text-[#5E646A]">
                      Wheel style
                    </label>
                    <button
                      type="button"
                      disabled={uploadingCarouselPng}
                      onClick={() => carouselFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#111315] hover:text-[#FF5A1F] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3 h-3" />
                      <span>
                        {uploadingCarouselPng
                          ? 'Uploading...'
                          : carouselImageFileName
                            ? 'Replace PNG'
                            : 'Upload PNG'}
                      </span>
                    </button>
                    <input
                      ref={carouselFileInputRef}
                      type="file"
                      accept="image/png"
                      onChange={handleCarouselPngUpload}
                      className="hidden"
                    />
                  </div>
                  {carouselImageFileName && (
                    <p className="mb-2 text-[11px] font-mono text-[#5E646A] truncate">
                      Linked cutout: {carouselImageFileName}
                    </p>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {WHEEL_STYLE_OPTIONS.map((opt) => {
                      const selected = !carouselImageFileName && carouselWheelKey === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setCarouselWheelKey(opt.key);
                            setCarouselImageFileName(undefined);
                            setCarouselImageUrl(undefined);
                          }}
                          className={`p-1.5 rounded-2xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            selected
                              ? 'border-[#111315] bg-[#F3F4F2] ring-1 ring-[#111315]'
                              : 'border-black/10 bg-white hover:bg-[#F7F8F6]'
                          }`}
                        >
                          <img
                            src={opt.src}
                            alt={opt.label}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 object-contain"
                          />
                          <span className="text-[10px] font-medium text-[#111315] whitespace-nowrap">
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Front / Back / Front & Back Axle Selector */}
                <div>
                  <label className="block text-xs font-medium text-[#5E646A] mb-1.5">
                    Axle
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F3F4F2]">
                    {(['Front', 'Back', 'Front & Back'] as TyreAxle[]).map((option) => {
                      const active = carouselAxle === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleCarouselAxleChange(option)}
                          className={`min-h-[40px] px-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            active
                              ? 'bg-[#111315] text-white shadow-xs'
                              : 'text-[#5E646A] hover:text-[#111315]'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#5E646A] mb-1">
                      Tyre size
                    </label>
                    <select
                      required
                      value={carouselTyreSize}
                      onChange={(e) => setCarouselTyreSize(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F3F4F2] border border-black/8 font-mono text-xs text-[#111315] focus:outline-none focus:ring-2 focus:ring-[#111315]"
                    >
                      {sizingOptions.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5E646A] mb-1">
                      Price per tyre (RM)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={carouselPrice}
                      onChange={(e) => setCarouselPrice(e.target.value)}
                      placeholder="259"
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F3F4F2] border border-black/8 font-mono text-sm text-[#111315] focus:outline-none focus:ring-2 focus:ring-[#111315]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5E646A] mb-1">
                    Tyre name
                  </label>
                  <input
                    type="text"
                    required
                    value={carouselBrandModel}
                    onChange={(e) => setCarouselBrandModel(e.target.value)}
                    placeholder="e.g. Michelin Pilot Sport 5"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm text-[#111315] focus:outline-none focus:ring-2 focus:ring-[#111315]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5E646A] mb-1">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={carouselNotes}
                    onChange={(e) => setCarouselNotes(e.target.value)}
                    placeholder="e.g. Car Speed quote · Includes balancing"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm text-[#111315] focus:outline-none focus:ring-2 focus:ring-[#111315]"
                  />
                </div>

                {carouselFormError && (
                  <p className="text-xs text-[#991B1B] bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {carouselFormError}
                  </p>
                )}

                </div>

                <button
                  type="submit"
                  disabled={savingCarouselTyre}
                  className="w-full h-12 shrink-0 rounded-2xl bg-[#111315] text-white text-sm font-semibold hover:bg-black/85 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingCarouselTyre ? 'Saving...' : 'Add to carousel'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                role="dialog"
                aria-modal="true"
                aria-label="Log tyre purchase"
                initial={{ y: -24, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -20, opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="w-full max-w-md h-[calc(100dvh-4.15rem-env(safe-area-inset-top))] bg-white rounded-t-3xl rounded-b-none px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3 shadow-2xl overflow-y-auto flex flex-col justify-between"
              >
                <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setAddMode('choose')}
                      aria-label="Back to options"
                      className="w-9 h-9 rounded-full bg-[#F3F4F2] flex items-center justify-center text-[#111315] hover:bg-[#E7E9E5] cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-[#111315]">
                        Log tyre purchase
                      </h3>
                      <p className="text-xs text-[#5E646A]">
                        {car.displayTitle} ({car.trim})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onCloseAddModal}
                    aria-label="Close modal"
                    className="w-10 h-10 rounded-full bg-[#F3F4F2] flex items-center justify-center text-[#111315] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Entry Mode Segmented Control: Enter details vs Paste text */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#F3F4F2] border border-black/6">
                  <button
                    type="button"
                    onClick={() => setEntryMode('details')}
                    className={`h-9 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      entryMode === 'details'
                        ? 'bg-white text-[#111315] shadow-sm'
                        : 'text-[#5E646A] hover:text-[#111315]'
                    }`}
                  >
                    Enter details
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode('paste')}
                    className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      entryMode === 'paste'
                        ? 'bg-white text-[#111315] shadow-sm'
                        : 'text-[#5E646A] hover:text-[#111315]'
                    }`}
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Paste text</span>
                  </button>
                </div>

                {entryMode === 'paste' ? (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-xs font-medium text-[#5E646A]">
                        Paste receipt, booking, or WhatsApp quote
                      </span>
                      <textarea
                        rows={7}
                        autoFocus
                        value={pasteText}
                        onPaste={handlePasteClip}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder={`Paste details here...\ne.g.\nDate: 21 Aug 2026\nPosition: Front (2 tyres)\nWorkshop: Car Speed Auto Service\nTyre make and model: Prinx Aquila REV\nTyre size: 225/40R18 92Y\nTotal: RM567.50`}
                        className="mt-1.5 w-full p-3 rounded-2xl bg-[#F3F4F2] border border-black/8 text-xs text-[#111315] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#111315]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => applyParsedText(pasteText)}
                      disabled={!pasteText.trim()}
                      className="w-full h-12 rounded-2xl bg-[#111315] text-white text-sm font-semibold hover:bg-black/85 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      Fill details from text
                    </button>
                  </div>
                ) : (
                  <>
                    {parsedSuccess && (
                      <div className="px-3 py-2 rounded-xl bg-[#F3F4F2] border border-black/7 flex items-center gap-2 text-xs font-medium text-[#111315]">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>Details filled from pasted text — review and save</span>
                      </div>
                    )}

                    <div>
                      <span className="text-xs font-medium text-[#5E646A] block mb-2">
                        Which tyres were replaced?
                      </span>
                      <div className="grid grid-cols-4 gap-2">
                        {TYRE_CORNERS.map((corner) => {
                          const selected = corners.includes(corner);
                          return (
                            <button
                              key={corner}
                              type="button"
                              onClick={() => toggleCorner(corner)}
                              className={`h-11 rounded-xl font-mono text-xs font-semibold border transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-[#111315] text-white border-[#111315]'
                                  : 'bg-[#F3F4F2] text-[#5E646A] border-black/8 hover:text-[#111315]'
                              }`}
                            >
                              {corner}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs font-medium text-[#5E646A]">Purchase date</span>
                        <input
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-xs font-mono text-[#111315]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-[#5E646A]">Total cost (RM)</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          required
                          placeholder="567.50"
                          value={totalCost}
                          onChange={(e) => setTotalCost(e.target.value)}
                          className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm font-mono font-semibold tabular-nums text-[#111315]"
                        />
                      </label>
                    </div>

                    <div>
                      <label className="block">
                        <span className="text-xs font-medium text-[#5E646A]">
                          Garage / Workshop
                        </span>
                        {garageOptions.length > 0 && (
                          <select
                            value={useCustomGarage ? '__new__' : vendor}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__new__') {
                                setUseCustomGarage(true);
                                setVendor('');
                              } else {
                                setUseCustomGarage(false);
                                setVendor(val);
                              }
                            }}
                            className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm text-[#111315] focus:outline-none focus:ring-2 focus:ring-[#111315]"
                          >
                            {garageOptions.map((garageName) => (
                              <option key={garageName} value={garageName}>
                                {garageName}
                              </option>
                            ))}
                            <option value="__new__">+ Enter new garage...</option>
                          </select>
                        )}
                      </label>
                      {(useCustomGarage || garageOptions.length === 0) && (
                        <input
                          type="text"
                          required
                          autoFocus={useCustomGarage && garageOptions.length > 0}
                          placeholder="Enter new garage name..."
                          value={vendor}
                          onChange={(e) => setVendor(e.target.value)}
                          className="mt-2 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm text-[#111315] focus:outline-none focus:ring-2 focus:ring-[#111315]"
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs font-medium text-[#5E646A]">Tyre brand & model</span>
                        <input
                          type="text"
                          required
                          placeholder="Prinx Aquila REV"
                          value={brandModel}
                          onChange={(e) => setBrandModel(e.target.value)}
                          className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm text-[#111315]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-[#5E646A]">Tyre sizing</span>
                        <select
                          required
                          value={tyreSize}
                          onChange={(e) => setTyreSize(e.target.value)}
                          className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm font-mono text-[#111315]"
                        >
                          {sizingOptions.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-xs font-medium text-[#5E646A]">Notes (optional)</span>
                      <input
                        type="text"
                        placeholder="Includes alignment & balancing"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm text-[#111315]"
                      />
                    </label>
                  </>
                )}
                </div>

                {entryMode === 'details' && (
                  <button
                    type="submit"
                    className="w-full h-12 shrink-0 rounded-2xl bg-[#111315] text-white text-sm font-semibold hover:bg-black/85 transition-colors cursor-pointer"
                  >
                    Save purchase log
                  </button>
                )}
              </motion.form>
            )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Add Contact Slide-Up Modal (portaled above BottomNav) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showContactModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
                onClick={() => setShowContactModal(false)}
              >
            <motion.form
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleContactSubmit}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold text-[#111315]">
                    {editingContactId ? 'Update tyre contact' : 'Add tyre contact'}
                  </h3>
                  <p className="text-xs text-[#5E646A]">
                    Save company, website &amp; WhatsApp number
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  aria-label="Close contact modal"
                  className="w-10 h-10 rounded-full bg-[#F3F4F2] flex items-center justify-center text-[#111315] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-[#5E646A]">Company name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Car Speed Auto Service"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm text-[#111315]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-[#5E646A]">
                  Phone / WhatsApp number (optional)
                </span>
                <input
                  type="tel"
                  placeholder="e.g. +60 12-345 6789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm font-mono text-[#111315]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-[#5E646A]">
                  Website or Maps link (optional)
                </span>
                <input
                  type="text"
                  placeholder="e.g. https://goo.gl/maps/..."
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm text-[#111315]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-[#5E646A]">
                  Notes (optional)
                </span>
                <input
                  type="text"
                  placeholder="e.g. Alignment & balancing"
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm text-[#111315]"
                />
              </label>

              <button
                type="submit"
                className="w-full h-12 rounded-2xl bg-[#111315] text-white text-sm font-semibold hover:bg-black/85 transition-colors cursor-pointer"
              >
                Save contact
              </button>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
