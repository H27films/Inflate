import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, X, Store, Ruler, Globe, Phone, ClipboardPaste, Check } from 'lucide-react';
import {
  CarProfile,
  CORNER_LABELS,
  PurchaseLogEntry,
  TYRE_CORNERS,
  TyreContact,
  TyreCorner,
} from '../types';
import {
  formatDisplayDate,
  formatTyreAge,
  getCornerPurchaseInfo,
  getTodayIso,
} from '../data/initialGarage';

interface PurchasesViewProps {
  car: CarProfile;
  contacts: TyreContact[];
  addModalOpen: boolean;
  onCloseAddModal: () => void;
  onAddPurchase: (entry: Omit<PurchaseLogEntry, 'id'>) => void;
  onDeletePurchase: (id: string) => void;
  onAddContact: (entry: Omit<TyreContact, 'id'>) => void;
  onUpdateContact: (id: string, entry: Omit<TyreContact, 'id'>) => void;
  onDeleteContact: (id: string) => void;
}

function formatRM(amount: number): string {
  return `RM${amount.toLocaleString('en-MY', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
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
  onCloseAddModal,
  onAddPurchase,
  onDeletePurchase,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
}: PurchasesViewProps) {
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<'details' | 'paste'>('details');
  const [pasteText, setPasteText] = useState('');
  const [parsedSuccess, setParsedSuccess] = useState(false);
  const [highlightedPurchaseId, setHighlightedPurchaseId] = useState<string | null>(null);
  const purchaseRowRefs = useRef<Record<string, HTMLLIElement | null>>({});

  // Purchase form state
  const [date, setDate] = useState(getTodayIso());
  const [vendor, setVendor] = useState('');
  const [brandModel, setBrandModel] = useState('');
  const [tyreSize, setTyreSize] = useState(car.defaultSizes.front);
  const [corners, setCorners] = useState<TyreCorner[]>(['FL', 'FR', 'RL', 'RR']);
  const [totalCost, setTotalCost] = useState('');
  const [notes, setNotes] = useState('');

  // Contact form state
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [contactNotes, setContactNotes] = useState('');

  useEffect(() => {
    if (addModalOpen) {
      setDate(getTodayIso());
      setVendor('');
      setBrandModel('');
      setTyreSize(car.defaultSizes.front);
      setCorners(['FL', 'FR', 'RL', 'RR']);
      setTotalCost('');
      setNotes('');
      setPasteText('');
      setParsedSuccess(false);
      setEntryMode('details');
    }
  }, [addModalOpen, car.id, car.defaultSizes.front]);

  useEffect(() => {
    if (!highlightedPurchaseId) return;
    const timer = window.setTimeout(() => {
      setHighlightedPurchaseId(null);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [highlightedPurchaseId]);

  const scrollToPurchase = (purchaseId: string) => {
    const el = purchaseRowRefs.current[purchaseId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedPurchaseId(purchaseId);
    }
  };

  const sortedPurchases = [...car.purchaseLogs].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const toggleCorner = (corner: TyreCorner) => {
    setCorners((prev) =>
      prev.includes(corner)
        ? prev.length > 1
          ? prev.filter((c) => c !== corner)
          : prev
        : [...prev, corner]
    );
  };

  const applyParsedText = (raw: string) => {
    if (!raw.trim()) return;
    const parsed = parsePurchaseText(raw, car);
    if (parsed.date) setDate(parsed.date);
    if (parsed.vendor) setVendor(parsed.vendor);
    if (parsed.brandModel) setBrandModel(parsed.brandModel);
    if (parsed.tyreSize) setTyreSize(parsed.tyreSize);
    if (parsed.corners && parsed.corners.length > 0) setCorners(parsed.corners);
    if (parsed.totalCost) setTotalCost(parsed.totalCost);
    if (parsed.notes) setNotes(parsed.notes);
    setParsedSuccess(true);
    setEntryMode('details');
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-4 pb-24 lg:pb-12"
    >
      {/* Top Tyre Sizing Summary + Installed Tyres */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Front & Back Tyre Sizing Card */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-black/7 p-5 space-y-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-[#111315] leading-tight">
              {car.displayTitle}
            </h1>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5E646A] shrink-0">
              <Ruler className="w-3.5 h-3.5" />
              <span>Tyre Sizing</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#F3F4F2] border border-black/5">
              <span className="text-[11px] font-medium text-[#5E646A] block">
                Front (FL / FR)
              </span>
              <span className="mt-1 font-mono text-sm font-semibold text-[#111315] block">
                {car.defaultSizes.front}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#F3F4F2] border border-black/5">
              <span className="text-[11px] font-medium text-[#5E646A] block">
                Back (RL / RR)
              </span>
              <span className="mt-1 font-mono text-sm font-semibold text-[#111315] block">
                {car.defaultSizes.rear}
              </span>
            </div>
          </div>
        </div>

        {/* Per-Corner Installed Tyres with Last Purchase Price */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-black/7 p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="font-display text-sm font-semibold text-[#111315]">
              Installed tyres by corner
            </h2>
            <span className="text-xs text-[#5E646A]">Age &amp; last price</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                    className="p-3.5 rounded-2xl bg-[#F3F4F2] border border-black/5 text-left hover:bg-[#EAECE9] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {cardInner}
                  </button>
                );
              }

              return (
                <div
                  key={corner}
                  className="p-3.5 rounded-2xl bg-[#F3F4F2] border border-black/5"
                >
                  {cardInner}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Purchase History Logs */}
      <section className="bg-white rounded-3xl border border-black/7 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold text-[#111315]">
            Purchase log
          </h2>
          <span className="text-xs text-[#5E646A] tabular-nums">
            Newest first
          </span>
        </div>

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
                  <div className="flex items-stretch justify-between gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-semibold text-base text-[#111315]">
                          {item.brandModel}
                        </span>
                        <span aria-hidden="true" className="text-[#9AA0A6]">·</span>
                        <span className="font-mono text-xs font-medium text-[#5E646A]">
                          {item.tyreSize}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#5E646A] flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[#111315] font-medium">
                          <Store className="w-3.5 h-3.5 text-[#5E646A]" />
                          {item.vendor}
                        </span>
                        <span aria-hidden="true" className="text-[#9AA0A6]">·</span>
                        <span>Bought {formatDisplayDate(item.date)}</span>
                        <span aria-hidden="true" className="text-[#9AA0A6]">·</span>
                        <span className="font-medium text-[#111315] tabular-nums">
                          {formatTyreAge(item.date)} old
                        </span>
                      </div>

                      <div className="flex items-center gap-3 pt-0.5">
                        <div
                          className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#F3F4F2] border border-black/5 shrink-0"
                          aria-label={`Fitted corners: ${item.corners.join(', ')}`}
                        >
                          {TYRE_CORNERS.map((c) => {
                            const active = item.corners.includes(c);
                            return (
                              <span
                                key={c}
                                className={`w-5 h-3.5 rounded-[3px] flex items-center justify-center font-mono text-[9px] font-semibold ${
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
                        <span className="text-xs text-[#5E646A]">
                          {item.corners.map((c) => CORNER_LABELS[c]).join(', ')}
                        </span>
                      </div>

                      {item.notes && (
                        <p className="text-xs text-[#6B7075]">{item.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-right">
                          <div className="font-display text-lg font-bold tabular-nums text-[#111315]">
                            {formatRM(item.totalCost)}
                          </div>
                          <div className="font-mono text-[11px] tabular-nums text-[#5E646A]">
                            {formatRM(perTyre)}/tyre
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeletePurchase(item.id)}
                          aria-label={`Delete purchase from ${item.vendor}`}
                          className="min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center text-[#9AA0A6] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

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
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Contacts Box: Tyre Companies, Websites, Phone Numbers & WhatsApp */}
      <section className="bg-[#16191D] text-white rounded-3xl border border-black/15 p-5 shadow-[0_8px_24px_rgba(17,19,21,0.10)]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Contacts
            </h2>
            <p className="text-xs text-white/65">
              Tyre shops, maps &amp; quick WhatsApp
            </p>
          </div>
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
          <div className="py-8 text-center text-xs text-white/60">
            No tyre shop contacts saved yet. Tap Add contact to save a shop.
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {contacts.map((contact) => (
              <li key={contact.id} className="py-3.5 first:pt-1 last:pb-1">
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
            ))}
          </ul>
        )}
      </section>

      {/* Add Purchase Slide-Up Modal */}
      <AnimatePresence>
        {addModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={onCloseAddModal}
          >
            <motion.form
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSubmit}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold text-[#111315]">
                    Log tyre purchase
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

                  <label className="block">
                    <span className="text-xs font-medium text-[#5E646A]">
                      Bought from (Workshop)
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Car Speed Auto Service"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm text-[#111315]"
                    />
                  </label>

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
                      <input
                        type="text"
                        required
                        placeholder="225/40 R18 92Y"
                        value={tyreSize}
                        onChange={(e) => setTyreSize(e.target.value)}
                        className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm font-mono text-[#111315]"
                      />
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

                  <button
                    type="submit"
                    className="w-full h-12 rounded-2xl bg-[#111315] text-white text-sm font-semibold hover:bg-black/85 transition-colors cursor-pointer"
                  >
                    Save purchase log
                  </button>
                </>
              )}
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Contact Slide-Up Modal */}
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
      </AnimatePresence>
    </motion.div>
  );
}
