import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Store, Trash2, Upload, X } from 'lucide-react';
import {
  CarId,
  CarProfile,
  PurchaseLogEntry,
  SavedTyreOption,
  TyreAxle,
  TyreContact,
  TyreCorner,
  WheelImageKey,
} from '../types';
import { formatDisplayDate, getCarTyreSizingOptions } from '../data/initialGarage';
import {
  buildCanonicalTyreImageFileName,
  uploadCustomTyrePngToFirebaseStorage,
} from '../services/garageFirestore';

const PRESET_SPORT_5SPOKE = '/assets/tyres/preset-sport-5spoke.png';
const PRESET_MESH_SPLIT = '/assets/tyres/preset-mesh-split.png';
const PRESET_TURBINE_DARK = '/assets/tyres/preset-turbine-dark.png';
const PRESET_ALL_TERRAIN = '/assets/tyres/preset-all-terrain.png';

export const WHEEL_STYLE_OPTIONS: {
  key: WheelImageKey;
  label: string;
  src: string;
}[] = [
  { key: 'sport-5spoke', label: '5-Spoke', src: PRESET_SPORT_5SPOKE },
  { key: 'mesh-split', label: 'Y-Mesh', src: PRESET_MESH_SPLIT },
  { key: 'turbine-dark', label: 'Multi-Spoke', src: PRESET_TURBINE_DARK },
  { key: 'all-terrain', label: 'All-Terrain', src: PRESET_ALL_TERRAIN },
];

const WHEEL_IMAGE_MAP: Record<WheelImageKey, string> = {
  'sport-5spoke': PRESET_SPORT_5SPOKE,
  'mesh-split': PRESET_MESH_SPLIT,
  'turbine-dark': PRESET_TURBINE_DARK,
  'all-terrain': PRESET_ALL_TERRAIN,
};

const WHEEL_FACEON_IMAGE_MAP: Record<WheelImageKey, string> = {
  'sport-5spoke': '/assets/tyres/preset-sport-5spoke-faceon.png',
  'mesh-split': '/assets/tyres/preset-mesh-split-faceon.png',
  'turbine-dark': '/assets/tyres/preset-turbine-dark-faceon.png',
  'all-terrain': '/assets/tyres/preset-all-terrain-faceon.png',
};

function resolveLocalCutoutFileName(
  carId: CarId,
  axle: TyreAxle,
  brandModel: string
): string | null {
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
  return null;
}

function resolveTyreImage(carId: CarId, item: SavedTyreOption): string {
  if (item.imageUrl) {
    return item.imageUrl;
  }
  if (item.imageFileName) {
    return `/assets/tyres/${item.imageFileName}`;
  }
  const canonical = resolveLocalCutoutFileName(carId, item.axle, item.brandModel);
  if (canonical) {
    return `/assets/tyres/${canonical}`;
  }
  return WHEEL_IMAGE_MAP[item.wheelImageKey] ?? PRESET_SPORT_5SPOKE;
}

function resolveFaceOnTyreImage(carId: CarId, item: SavedTyreOption): string {
  const fileName =
    item.imageFileName ??
    resolveLocalCutoutFileName(carId, item.axle, item.brandModel);

  if (fileName) {
    if (fileName.includes('slk350-front-prinx')) {
      return '/assets/tyres/slk350-front-prinx-faceon.png';
    }
    if (fileName.includes('slk350-back-powertrac')) {
      return '/assets/tyres/slk350-back-powertrac-faceon.png';
    }
    if (fileName.includes('fortuner-front-fortune')) {
      return '/assets/tyres/fortuner-front-fortune-faceon.png';
    }
  }

  if (item.imageUrl) {
    if (item.imageUrl.includes('slk350-front-prinx')) {
      return '/assets/tyres/slk350-front-prinx-faceon.png';
    }
    if (item.imageUrl.includes('slk350-back-powertrac')) {
      return '/assets/tyres/slk350-back-powertrac-faceon.png';
    }
    if (item.imageUrl.includes('fortuner-front-fortune')) {
      return '/assets/tyres/fortuner-front-fortune-faceon.png';
    }
    return item.imageUrl;
  }

  return (
    WHEEL_FACEON_IMAGE_MAP[item.wheelImageKey] ??
    '/assets/tyres/preset-sport-5spoke-faceon.png'
  );
}

function formatPriceRM(amount: number): string {
  return `RM${amount.toLocaleString('en-MY', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export type TyreSide = 'Left' | 'Right';

export interface FocusedSideOption {
  side: TyreSide;
  corner: TyreCorner;
  purchase: PurchaseLogEntry | null;
  contact?: TyreContact | null;
}

interface SavedTyresCarouselProps {
  car: CarProfile;
  tyres: SavedTyreOption[];
  focusedAxle?: TyreAxle | null;
  focusedPurchase?: PurchaseLogEntry | null;
  focusedContact?: TyreContact | null;
  focusedSides?: FocusedSideOption[] | null;
  focusedSide?: TyreSide;
  onFocusedSideChange?: (side: TyreSide) => void;
  onNavigateToContact?: (vendor: string, contact?: TyreContact | null) => void;
  onAddPurchaseForAxle?: (target: TyreAxle | TyreCorner) => void;
  rulesPending?: boolean;
  onAddTyre: (entry: Omit<SavedTyreOption, 'id'>) => Promise<void> | void;
  onUpdateTyre: (id: string, entry: Omit<SavedTyreOption, 'id'>) => Promise<void> | void;
  onDeleteTyre: (id: string) => Promise<void> | void;
}

export function SavedTyresCarousel({
  car,
  tyres,
  focusedAxle = null,
  focusedPurchase = null,
  focusedContact = null,
  focusedSides = null,
  focusedSide = 'Left',
  onFocusedSideChange,
  onNavigateToContact,
  onAddPurchaseForAxle,
  rulesPending = false,
  onAddTyre,
  onUpdateTyre,
  onDeleteTyre,
}: SavedTyresCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRafRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticTimerRef = useRef<number | null>(null);
  const prevFocusedAxleRef = useRef<TyreAxle | null>(focusedAxle);
  const activeIndexRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Focused split Left/Right scroller refs
  const focusScrollerRef = useRef<HTMLDivElement | null>(null);
  const focusItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const focusScrollRafRef = useRef<number | null>(null);
  const focusIsProgrammaticRef = useRef(false);
  const focusProgrammaticTimerRef = useRef<number | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTyre, setEditingTyre] = useState<SavedTyreOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPng, setUploadingPng] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Form state
  const [brandModel, setBrandModel] = useState('');
  const [price, setPrice] = useState('');
  const [axle, setAxle] = useState<TyreAxle>('Front');
  const [tyreSize, setTyreSize] = useState(car.defaultSizes.front);
  const [wheelImageKey, setWheelImageKey] = useState<WheelImageKey>(
    car.bodyStyle === 'suv' ? 'all-terrain' : 'sport-5spoke'
  );
  const [imageFileName, setImageFileName] = useState<string | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const sortedTyres = useMemo(() => {
    return tyres
      .map((item, idx) => ({ item, idx }))
      .sort((a, b) => {
        const rankA = a.item.axle === 'Front' ? 0 : 1;
        const rankB = b.item.axle === 'Front' ? 0 : 1;
        if (rankA !== rankB) return rankA - rankB;
        return a.idx - b.idx;
      })
      .map(({ item }) => item);
  }, [tyres]);

  useEffect(() => {
    setActiveIndex(0);
    if (scrollerRef.current) {
      scrollerRef.current.scrollTo({ left: 0, behavior: 'auto' });
    }
  }, [car.id]);

  useEffect(() => {
    if (activeIndex >= sortedTyres.length && sortedTyres.length > 0) {
      setActiveIndex(sortedTyres.length - 1);
    }
  }, [sortedTyres.length, activeIndex]);

  const resolveFocusedTyreForPurchase = useCallback(
    (purchase: PurchaseLogEntry | null): SavedTyreOption | null => {
      if (!focusedAxle || !purchase) return null;
      const targetBrand = purchase.brandModel.trim().toLowerCase();
      const targetTokens = targetBrand.split(/\s+/).filter(Boolean);
      const isBrandMatch = (candidate: SavedTyreOption) => {
        const b = candidate.brandModel.trim().toLowerCase();
        return (
          b === targetBrand ||
          b.includes(targetBrand) ||
          targetBrand.includes(b) ||
          (targetTokens[0] ? b.includes(targetTokens[0]) : false)
        );
      };
      const exactAxleMatch = sortedTyres.find(
        (t) => t.axle === focusedAxle && isBrandMatch(t)
      );
      if (exactAxleMatch) return exactAxleMatch;
      const anyAxleMatch = sortedTyres.find(isBrandMatch);
      if (anyAxleMatch) return anyAxleMatch;

      const perTyre =
        purchase.corners.length > 0
          ? Math.round((purchase.totalCost / purchase.corners.length) * 100) / 100
          : purchase.totalCost;
      return {
        id: `focused-${purchase.id}`,
        brandModel: purchase.brandModel,
        price: perTyre,
        axle: focusedAxle,
        tyreSize: purchase.tyreSize,
        wheelImageKey: car.bodyStyle === 'suv' ? 'all-terrain' : 'sport-5spoke',
      };
    },
    [focusedAxle, sortedTyres, car.bodyStyle]
  );

  const focusedTyre = useMemo<SavedTyreOption | null>(
    () => resolveFocusedTyreForPurchase(focusedPurchase),
    [resolveFocusedTyreForPurchase, focusedPurchase]
  );

  const focusedSplitItems = useMemo(() => {
    if (!focusedAxle || !focusedSides || focusedSides.length !== 2) return null;
    return focusedSides.map((s) => ({
      ...s,
      tyre: resolveFocusedTyreForPurchase(s.purchase),
    }));
  }, [focusedAxle, focusedSides, resolveFocusedTyreForPurchase]);

  const focusedSplitActiveIdx = focusedSide === 'Right' ? 1 : 0;

  const releaseFocusProgrammaticLock = useCallback(() => {
    focusIsProgrammaticRef.current = false;
    if (focusProgrammaticTimerRef.current !== null) {
      window.clearTimeout(focusProgrammaticTimerRef.current);
      focusProgrammaticTimerRef.current = null;
    }
    if (focusScrollerRef.current) {
      focusScrollerRef.current.style.scrollSnapType = '';
    }
  }, []);

  const scrollFocusToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const clampedIdx = index === 1 ? 1 : 0;
      const nextSide: TyreSide = clampedIdx === 1 ? 'Right' : 'Left';
      onFocusedSideChange?.(nextSide);

      const container = focusScrollerRef.current;
      const target = focusItemRefs.current[clampedIdx];
      if (!container || !target) return;

      const containerCenter = container.clientWidth / 2;
      const targetCenter = target.offsetLeft + target.offsetWidth / 2;
      const nextLeft = Math.max(0, targetCenter - containerCenter);

      if (focusProgrammaticTimerRef.current !== null) {
        window.clearTimeout(focusProgrammaticTimerRef.current);
      }

      if (behavior === 'smooth') {
        focusIsProgrammaticRef.current = true;
        container.style.scrollSnapType = 'none';
        container.scrollTo({ left: nextLeft, behavior: 'smooth' });
        focusProgrammaticTimerRef.current = window.setTimeout(() => {
          focusIsProgrammaticRef.current = false;
          if (focusScrollerRef.current) {
            focusScrollerRef.current.style.scrollSnapType = '';
          }
          focusProgrammaticTimerRef.current = null;
        }, 420);
      } else {
        focusIsProgrammaticRef.current = false;
        container.style.scrollSnapType = '';
        container.scrollTo({ left: nextLeft, behavior: 'auto' });
      }
    },
    [onFocusedSideChange]
  );

  const handleFocusScroll = () => {
    if (focusIsProgrammaticRef.current) return;
    if (focusScrollRafRef.current !== null) {
      cancelAnimationFrame(focusScrollRafRef.current);
    }
    focusScrollRafRef.current = requestAnimationFrame(() => {
      if (focusIsProgrammaticRef.current) return;
      const container = focusScrollerRef.current;
      if (!container) return;
      const centerX = container.scrollLeft + container.clientWidth / 2;
      let closestIdx = 0;
      let closestDist = Number.POSITIVE_INFINITY;
      [0, 1].forEach((idx) => {
        const el = focusItemRefs.current[idx];
        if (!el) return;
        const elCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(elCenter - centerX);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = idx;
        }
      });
      onFocusedSideChange?.(closestIdx === 1 ? 'Right' : 'Left');
    });
  };

  useEffect(() => {
    if (!focusedAxle || !focusedSplitItems) return;
    const t = window.setTimeout(() => {
      scrollFocusToIndex(focusedSide === 'Right' ? 1 : 0, 'auto');
    }, 24);
    return () => window.clearTimeout(t);
  }, [focusedAxle, Boolean(focusedSplitItems)]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const releaseProgrammaticLock = useCallback(() => {
    isProgrammaticScrollRef.current = false;
    if (programmaticTimerRef.current !== null) {
      window.clearTimeout(programmaticTimerRef.current);
      programmaticTimerRef.current = null;
    }
    if (scrollerRef.current) {
      scrollerRef.current.style.scrollSnapType = '';
    }
  }, []);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const container = scrollerRef.current;
      const target = itemRefs.current[index];
      setActiveIndex(index);
      if (!container || !target) return;

      const containerCenter = container.clientWidth / 2;
      const targetCenter = target.offsetLeft + target.offsetWidth / 2;
      const nextLeft = Math.max(0, targetCenter - containerCenter);

      if (programmaticTimerRef.current !== null) {
        window.clearTimeout(programmaticTimerRef.current);
      }

      if (behavior === 'smooth') {
        isProgrammaticScrollRef.current = true;
        container.style.scrollSnapType = 'none';
        container.scrollTo({ left: nextLeft, behavior: 'smooth' });
        programmaticTimerRef.current = window.setTimeout(() => {
          isProgrammaticScrollRef.current = false;
          if (scrollerRef.current) {
            scrollerRef.current.style.scrollSnapType = '';
          }
          programmaticTimerRef.current = null;
        }, 420);
      } else {
        isProgrammaticScrollRef.current = false;
        container.style.scrollSnapType = '';
        container.scrollTo({ left: nextLeft, behavior: 'auto' });
      }
    },
    []
  );

  const handleScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      if (isProgrammaticScrollRef.current) return;
      const container = scrollerRef.current;
      if (!container || sortedTyres.length === 0) return;
      const centerX = container.scrollLeft + container.clientWidth / 2;
      let closestIdx = 0;
      let closestDist = Number.POSITIVE_INFINITY;
      sortedTyres.forEach((_, idx) => {
        const el = itemRefs.current[idx];
        if (!el) return;
        const elCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(elCenter - centerX);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = idx;
        }
      });
      setActiveIndex(closestIdx);
    });
  };

  useEffect(() => {
    const wasFocused = prevFocusedAxleRef.current !== null;
    prevFocusedAxleRef.current = focusedAxle;
    if (wasFocused && !focusedAxle && activeIndexRef.current > 0) {
      const idx = activeIndexRef.current;
      const t = window.setTimeout(() => {
        scrollToIndex(idx, 'auto');
      }, 20);
      return () => window.clearTimeout(t);
    }
  }, [focusedAxle, scrollToIndex]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      if (programmaticTimerRef.current !== null) {
        window.clearTimeout(programmaticTimerRef.current);
      }
      if (focusScrollRafRef.current !== null) {
        cancelAnimationFrame(focusScrollRafRef.current);
      }
      if (focusProgrammaticTimerRef.current !== null) {
        window.clearTimeout(focusProgrammaticTimerRef.current);
      }
    };
  }, []);

  const openAddModal = () => {
    setEditingTyre(null);
    setBrandModel('');
    setPrice('');
    setAxle('Front');
    setTyreSize(car.defaultSizes.front);
    setWheelImageKey(car.bodyStyle === 'suv' ? 'all-terrain' : 'sport-5spoke');
    setImageFileName(undefined);
    setImageUrl(undefined);
    setNotes('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: SavedTyreOption) => {
    setEditingTyre(item);
    setBrandModel(item.brandModel);
    setPrice(item.price > 0 ? String(item.price) : '');
    setAxle(item.axle);
    setTyreSize(item.tyreSize);
    setWheelImageKey(item.wheelImageKey);
    setImageFileName(item.imageFileName);
    setImageUrl(item.imageUrl);
    setNotes(item.notes ?? '');
    setFormError(null);
    setModalOpen(true);
  };

  const handlePngUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPng(true);
    setFormError(null);
    try {
      const targetName = buildCanonicalTyreImageFileName(
        car.id,
        axle,
        brandModel || file.name.replace(/\.[^.]+$/, '')
      );
      const uploadedUrl = await uploadCustomTyrePngToFirebaseStorage(targetName, file);
      if (!uploadedUrl) {
        setFormError('Firebase Storage upload is not permitted yet for this bucket.');
        return;
      }
      setImageFileName(targetName);
      setImageUrl(uploadedUrl);
    } finally {
      setUploadingPng(false);
    }
  };

  const handleAxleChange = (nextAxle: TyreAxle) => {
    const prevDefault =
      axle === 'Front' ? car.defaultSizes.front : car.defaultSizes.rear;
    const nextDefault =
      nextAxle === 'Front' ? car.defaultSizes.front : car.defaultSizes.rear;
    setAxle(nextAxle);
    if (!tyreSize.trim() || tyreSize.trim() === prevDefault) {
      setTyreSize(nextDefault);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    setSaving(true);
    const payload: Omit<SavedTyreOption, 'id'> = {
      brandModel: brandModel.trim(),
      price: Math.max(0, Number(price) || 0),
      axle,
      tyreSize: tyreSize.trim() || (axle === 'Front' ? car.defaultSizes.front : car.defaultSizes.rear),
      wheelImageKey,
      ...(imageFileName ? { imageFileName } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      notes: notes.trim() || undefined,
    };

    try {
      if (editingTyre) {
        await onUpdateTyre(editingTyre.id, payload);
      } else {
        const targetIndex =
          payload.axle === 'Front'
            ? sortedTyres.filter((item) => item.axle === 'Front').length
            : sortedTyres.length;
        await onAddTyre(payload);
        setTimeout(() => {
          scrollToIndex(targetIndex, 'smooth');
        }, 80);
      }
      setModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save tyre option.';
      setFormError(
        msg.toLowerCase().includes('permission')
          ? 'Publish the savedTyres Firestore rule first to save changes.'
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTyre || saving) return;
    setFormError(null);
    setSaving(true);
    try {
      await onDeleteTyre(editingTyre.id);
      setModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to delete tyre option.';
      setFormError(
        msg.toLowerCase().includes('permission')
          ? 'Publish the savedTyres Firestore rule first to delete options.'
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  const activeTyre = focusedAxle
    ? focusedTyre
    : sortedTyres[activeIndex] ?? sortedTyres[0] ?? null;

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.2 }}
        aria-label="Saved tyre options"
        className="w-full my-auto py-2 flex flex-col items-center justify-center"
      >
        <AnimatePresence mode="wait" initial={false}>
          {focusedAxle && focusedSplitItems ? (
            <motion.div
              key={`focus-split-${focusedAxle}`}
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="w-full relative flex flex-col items-center"
            >
              {/* Horizontal Left / Right scroll showcase when sides differ */}
              <div data-focus-interactive="true" className="relative w-full flex items-center">
                {focusedSplitActiveIdx > 0 && (
                  <button
                    type="button"
                    data-focus-interactive="true"
                    onClick={() => scrollFocusToIndex(0)}
                    aria-label={`View ${focusedAxle} Left tyre`}
                    className="hidden sm:flex absolute left-4 z-10 w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-black/8 shadow-[0_2px_10px_rgba(17,19,21,0.06)] items-center justify-center text-[#111315] transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}

                <div
                  ref={focusScrollerRef}
                  data-focus-interactive="true"
                  onScroll={handleFocusScroll}
                  onTouchStart={releaseFocusProgrammaticLock}
                  onWheel={releaseFocusProgrammaticLock}
                  className="w-full overflow-x-auto snap-x snap-mandatory flex items-center px-[calc(50%-86px)] sm:px-[calc(50%-96px)] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {focusedSplitItems.map((sideItem, idx) => {
                    const isActive = idx === focusedSplitActiveIdx;
                    const sideTyre = sideItem.tyre;
                    const imgBroken = sideTyre
                      ? failedImages[`faceon-${sideItem.side}-${sideTyre.id}`]
                      : false;

                    return (
                      <div
                        key={sideItem.corner}
                        ref={(el) => {
                          focusItemRefs.current[idx] = el;
                        }}
                        data-focus-interactive="true"
                        className="snap-center shrink-0 w-[172px] sm:w-[192px] flex items-center justify-center"
                      >
                        {sideTyre ? (
                          <button
                            type="button"
                            data-focus-interactive="true"
                            onClick={() => scrollFocusToIndex(idx)}
                            aria-label={`Select ${focusedAxle} ${sideItem.side} tyre`}
                            className="w-[164px] h-[164px] sm:w-[184px] sm:h-[184px] flex items-center justify-center focus:outline-none cursor-pointer"
                          >
                            <div
                              className={`w-full h-full flex items-center justify-center transition-all duration-200 ${
                                isActive
                                  ? 'scale-100 opacity-100'
                                  : 'scale-[0.72] opacity-40 hover:opacity-70'
                              }`}
                            >
                              {imgBroken ? (
                                <div className="w-full h-full rounded-full bg-[#E5E7E3] flex items-center justify-center text-xs font-medium text-[#5E646A]">
                                  Tyre
                                </div>
                              ) : (
                                <img
                                  src={resolveFaceOnTyreImage(car.id, sideTyre)}
                                  alt={`${sideTyre.brandModel} (${focusedAxle} ${sideItem.side})`}
                                  referrerPolicy="no-referrer"
                                  draggable={false}
                                  onError={() =>
                                    setFailedImages((prev) => ({
                                      ...prev,
                                      [`faceon-${sideItem.side}-${sideTyre.id}`]: true,
                                    }))
                                  }
                                  className="w-full h-full object-contain select-none pointer-events-none"
                                />
                              )}
                            </div>
                          </button>
                        ) : (
                          <div
                            onClick={() => {
                              if (!isActive) scrollFocusToIndex(idx);
                            }}
                            className={`w-[164px] h-[164px] sm:w-[184px] sm:h-[184px] flex flex-col items-center justify-center transition-all duration-200 ${
                              isActive
                                ? 'scale-100 opacity-100'
                                : 'scale-[0.72] opacity-40 hover:opacity-70 cursor-pointer'
                            }`}
                          >
                            <button
                              type="button"
                              data-focus-interactive="true"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isActive) {
                                  scrollFocusToIndex(idx);
                                } else {
                                  onAddPurchaseForAxle?.(sideItem.corner);
                                }
                              }}
                              aria-label={`Add tyre for ${focusedAxle} ${sideItem.side}`}
                              className="w-16 h-16 rounded-full bg-[#111315] text-white hover:bg-black/85 active:scale-[0.96] shadow-[0_6px_18px_rgba(17,19,21,0.16)] flex items-center justify-center transition-all cursor-pointer"
                            >
                              <Plus className="w-6 h-6" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {focusedSplitActiveIdx < 1 && (
                  <button
                    type="button"
                    data-focus-interactive="true"
                    onClick={() => scrollFocusToIndex(1)}
                    aria-label={`View ${focusedAxle} Right tyre`}
                    className="hidden sm:flex absolute right-4 z-10 w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-black/8 shadow-[0_2px_10px_rgba(17,19,21,0.06)] items-center justify-center text-[#111315] transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Left / Right selector dots */}
              <div
                data-focus-interactive="true"
                className="mt-1 flex items-center justify-center gap-2.5"
              >
                <button
                  type="button"
                  data-focus-interactive="true"
                  onClick={() => scrollFocusToIndex(0)}
                  className={`text-[11px] transition-colors cursor-pointer ${
                    focusedSplitActiveIdx === 0
                      ? 'font-semibold text-[#111315]'
                      : 'font-medium text-[#5E646A]/65 hover:text-[#111315]'
                  }`}
                >
                  Left
                </button>
                <div className="flex items-center gap-1">
                  {focusedSplitItems.map((sideItem, idx) => {
                    const isActive = idx === focusedSplitActiveIdx;
                    return (
                      <button
                        key={sideItem.side}
                        type="button"
                        data-focus-interactive="true"
                        onClick={() => scrollFocusToIndex(idx)}
                        aria-label={`Select ${focusedAxle} ${sideItem.side}`}
                        className="p-1 flex items-center justify-center cursor-pointer"
                      >
                        <span
                          className={`block rounded-full transition-all duration-200 ${
                            isActive
                              ? 'w-2 h-2 bg-[#111315]'
                              : 'w-1.5 h-1.5 bg-[#111315]/22 hover:bg-[#111315]/45'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  data-focus-interactive="true"
                  onClick={() => scrollFocusToIndex(1)}
                  className={`text-[11px] transition-colors cursor-pointer ${
                    focusedSplitActiveIdx === 1
                      ? 'font-semibold text-[#111315]'
                      : 'font-medium text-[#5E646A]/65 hover:text-[#111315]'
                  }`}
                >
                  Right
                </button>
              </div>

              {/* Selected Side Info */}
              {(() => {
                const activeSideItem = focusedSplitItems[focusedSplitActiveIdx];
                if (!activeSideItem) return null;
                const activeSideTyre = activeSideItem.tyre;
                const activeSidePurchase = activeSideItem.purchase;
                const sidePositionLabel = `${focusedAxle} ${activeSideItem.side}`;

                if (!activeSideTyre || !activeSidePurchase) {
                  return (
                    <div className="mt-2 px-6 text-center">
                      <p className="font-display text-base font-semibold text-[#111315]">
                        No tyre selected
                      </p>
                      <p className="mt-0.5 text-xs text-[#5E646A]">
                        Tap + to add {sidePositionLabel.toLowerCase()} tyre
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="mt-2 px-6 text-center">
                    {activeSideTyre.price > 0 && (
                      <p className="font-display text-2xl sm:text-[26px] font-bold tracking-tight tabular-nums text-[#111315] leading-none">
                        {formatPriceRM(activeSideTyre.price)}
                      </p>
                    )}
                    <h3
                      className={`${activeSideTyre.price > 0 ? 'mt-1' : ''} font-display text-[15px] sm:text-base font-medium text-[#111315] leading-snug text-balance`}
                    >
                      {activeSideTyre.brandModel}
                    </h3>
                    <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-[#5E646A] tabular-nums">
                      <span className="font-semibold text-[#111315]">
                        {sidePositionLabel}
                      </span>
                      <span aria-hidden="true" className="text-[#9AA0A6]">
                        ·
                      </span>
                      <span className="font-mono">{activeSideTyre.tyreSize}</span>
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-black/8 flex flex-col items-center gap-1.5 max-w-xs mx-auto">
                      <button
                        type="button"
                        data-focus-interactive="true"
                        onClick={() =>
                          onNavigateToContact?.(
                            activeSidePurchase.vendor,
                            activeSideItem.contact
                          )
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[#111315] hover:bg-black/[0.05] hover:text-[#FF5A1F] active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Store className="w-3.5 h-3.5 shrink-0 text-[#5E646A]" />
                        <span>{activeSidePurchase.vendor}</span>
                      </button>
                      <p className="inline-flex items-center justify-center gap-1.5 text-[11px] text-[#5E646A] tabular-nums">
                        <Calendar className="w-3 h-3 shrink-0 text-[#8C9298]" />
                        <span>Purchased {formatDisplayDate(activeSidePurchase.date)}</span>
                      </p>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          ) : focusedAxle && !focusedTyre ? (
            <motion.div
              key={`focus-empty-${focusedAxle}`}
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="px-6 py-8 flex flex-col items-center text-center"
            >
              <button
                type="button"
                data-focus-interactive="true"
                onClick={() => onAddPurchaseForAxle?.(focusedAxle)}
                aria-label={`Add tyre for ${focusedAxle} axle`}
                className="w-16 h-16 rounded-full bg-[#111315] text-white hover:bg-black/85 active:scale-[0.96] shadow-[0_6px_18px_rgba(17,19,21,0.16)] flex items-center justify-center transition-all cursor-pointer"
              >
                <Plus className="w-6 h-6" />
              </button>
              <p className="mt-3.5 font-display text-base font-semibold text-[#111315]">
                No tyre selected
              </p>
              <p className="mt-0.5 text-xs text-[#5E646A]">
                Tap + to add tyres for the {focusedAxle.toLowerCase()} set
              </p>
            </motion.div>
          ) : focusedAxle && focusedTyre ? (
            <motion.div
              key={`focus-tyre-${focusedAxle}-${focusedTyre.id}`}
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full flex flex-col items-center justify-center"
            >
              {/* Static face-on view of the selected wheel & tyre */}
              <div className="w-full py-2 flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.82, rotate: -16 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  className="w-[164px] h-[164px] sm:w-[184px] sm:h-[184px] flex items-center justify-center"
                >
                  {failedImages[`faceon-${focusedTyre.id}`] ? (
                    <div className="w-full h-full rounded-full bg-[#E5E7E3] flex items-center justify-center text-xs font-medium text-[#5E646A]">
                      Tyre
                    </div>
                  ) : (
                    <img
                      src={resolveFaceOnTyreImage(car.id, focusedTyre)}
                      alt={`${focusedTyre.brandModel} face-on wheel and tyre`}
                      referrerPolicy="no-referrer"
                      draggable={false}
                      onError={() =>
                        setFailedImages((prev) => ({
                          ...prev,
                          [`faceon-${focusedTyre.id}`]: true,
                        }))
                      }
                      className="w-full h-full object-contain select-none pointer-events-none"
                    />
                  )}
                </motion.div>
              </div>

              {/* Focused Tyre Info + Clickable Garage Location (jumps to Contacts) & Purchase Date */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="mt-2 px-6 text-center"
              >
                {focusedTyre.price > 0 && (
                  <p className="font-display text-2xl sm:text-[26px] font-bold tracking-tight tabular-nums text-[#111315] leading-none">
                    {formatPriceRM(focusedTyre.price)}
                  </p>
                )}
                <h3
                  className={`${focusedTyre.price > 0 ? 'mt-1' : ''} font-display text-[15px] sm:text-base font-medium text-[#111315] leading-snug text-balance`}
                >
                  {focusedTyre.brandModel}
                </h3>
                <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-[#5E646A] tabular-nums">
                  <span className="font-semibold text-[#111315]">
                    {focusedTyre.axle}
                  </span>
                  <span aria-hidden="true" className="text-[#9AA0A6]">
                    ·
                  </span>
                  <span className="font-mono">{focusedTyre.tyreSize}</span>
                </p>

                {focusedPurchase && (
                  <div className="mt-3 pt-2.5 border-t border-black/8 flex flex-col items-center gap-1.5 max-w-xs mx-auto">
                    <button
                      type="button"
                      data-focus-interactive="true"
                      onClick={() =>
                        onNavigateToContact?.(focusedPurchase.vendor, focusedContact)
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[#111315] hover:bg-black/[0.05] hover:text-[#FF5A1F] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Store className="w-3.5 h-3.5 shrink-0 text-[#5E646A]" />
                      <span>{focusedPurchase.vendor}</span>
                    </button>
                    <p className="inline-flex items-center justify-center gap-1.5 text-[11px] text-[#5E646A] tabular-nums">
                      <Calendar className="w-3 h-3 shrink-0 text-[#8C9298]" />
                      <span>Purchased {formatDisplayDate(focusedPurchase.date)}</span>
                    </p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          ) : sortedTyres.length === 0 ? (
            <motion.div
              key="carousel-empty"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.2 }}
              className="px-6 py-6 flex flex-col items-center text-center"
            >
              <button
                type="button"
                onClick={openAddModal}
                className="w-[136px] h-[136px] rounded-full border-2 border-dashed border-[#111315]/25 bg-white/55 hover:bg-white/85 flex flex-col items-center justify-center gap-1.5 text-[#111315] transition-colors cursor-pointer"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs font-medium">Add tyre</span>
              </button>
              <p className="mt-3 text-xs text-[#5E646A]">
                Save tyre models &amp; prices for {car.displayTitle}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="carousel-normal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full relative"
            >
              {/* Horizontal side-scrolling wheel showcase */}
              <div className="relative w-full flex items-center">
                {activeIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => scrollToIndex(activeIndex - 1)}
                    aria-label="Previous tyre"
                    className="hidden sm:flex absolute left-4 z-10 w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-black/8 shadow-[0_2px_10px_rgba(17,19,21,0.06)] items-center justify-center text-[#111315] transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}

                <div
                  ref={scrollerRef}
                  onScroll={handleScroll}
                  onTouchStart={releaseProgrammaticLock}
                  onWheel={releaseProgrammaticLock}
                  className="w-full overflow-x-auto snap-x snap-mandatory flex items-center px-[calc(50%-72px)] sm:px-[calc(50%-82px)] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {sortedTyres.map((item, idx) => {
                    const isActive = idx === activeIndex;
                    const imgSrc = resolveTyreImage(car.id, item);
                    const imgBroken = failedImages[item.id];

                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        type="button"
                        onClick={() => {
                          if (isActive) {
                            openEditModal(item);
                          } else {
                            scrollToIndex(idx);
                          }
                        }}
                        aria-label={
                          isActive
                            ? `Edit ${item.brandModel}`
                            : `Select ${item.brandModel}`
                        }
                        className="snap-center shrink-0 w-[144px] sm:w-[164px] flex items-center justify-center focus:outline-none cursor-pointer"
                      >
                        <div
                          className={`w-[136px] h-[136px] sm:w-[152px] sm:h-[152px] flex items-center justify-center transition-all duration-200 ${
                            isActive
                              ? 'scale-100 opacity-100'
                              : 'scale-[0.74] opacity-45 hover:opacity-75'
                          }`}
                        >
                          {imgBroken ? (
                            <div className="w-full h-full rounded-full bg-[#E5E7E3] flex items-center justify-center text-xs font-medium text-[#5E646A]">
                              Tyre
                            </div>
                          ) : (
                            <img
                              src={imgSrc}
                              alt={`${item.brandModel} wheel and tyre`}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                              }
                              className="w-full h-full object-contain select-none pointer-events-none"
                              draggable={false}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {activeIndex < sortedTyres.length - 1 && (
                  <button
                    type="button"
                    onClick={() => scrollToIndex(activeIndex + 1)}
                    aria-label="Next tyre"
                    className="hidden sm:flex absolute right-4 z-10 w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-black/8 shadow-[0_2px_10px_rgba(17,19,21,0.06)] items-center justify-center text-[#111315] transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Pagination dots */}
              <div className="mt-1 flex items-center justify-center gap-1.5">
                {sortedTyres.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToIndex(idx)}
                      aria-label={`View ${item.brandModel}`}
                      className="p-1 flex items-center justify-center cursor-pointer"
                    >
                      <span
                        className={`block rounded-full transition-all duration-200 ${
                          isActive
                            ? 'w-2 h-2 bg-[#111315]'
                            : 'w-1.5 h-1.5 bg-[#111315]/22 hover:bg-[#111315]/45'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Active Tyre Price, Name, Axle & Size */}
              {activeTyre && (
                <div className="mt-1.5 px-6 text-center">
                  {activeTyre.price > 0 && (
                    <p className="font-display text-2xl sm:text-[26px] font-bold tracking-tight tabular-nums text-[#111315] leading-none">
                      {formatPriceRM(activeTyre.price)}
                    </p>
                  )}
                  <h3
                    className={`${activeTyre.price > 0 ? 'mt-1' : ''} font-display text-[15px] sm:text-base font-medium text-[#111315] leading-snug text-balance`}
                  >
                    {activeTyre.brandModel}
                  </h3>
                  <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-[#5E646A] tabular-nums">
                    <span className="font-semibold text-[#111315]">
                      {activeTyre.axle}
                    </span>
                    <span aria-hidden="true" className="text-[#9AA0A6]">
                      ·
                    </span>
                    <span className="font-mono">{activeTyre.tyreSize}</span>
                  </p>
                  {activeTyre.notes && (
                    <p className="mt-0.5 text-[11px] text-[#6B7075] truncate max-w-xs mx-auto">
                      {activeTyre.notes}
                    </p>
                  )}

                  {rulesPending && (
                    <p className="mt-1 text-[11px] text-[#991B1B]">
                      Publish the savedTyres Firestore rule to sync edits.
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Add / Edit Saved Tyre Option Modal (portaled above BottomNav) */}
      {modalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
          className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingTyre ? 'Edit saved tyre' : 'Save tyre option'}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl border border-black/8 shadow-[0_20px_50px_rgba(17,19,21,0.18)] p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-medium text-[#111315]">
                  {editingTyre ? 'Edit saved tyre' : 'Save tyre option'}
                </h2>
                <p className="text-xs text-[#5E646A]">{car.displayTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="w-10 h-10 rounded-full hover:bg-black/5 flex items-center justify-center text-[#5E646A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Wheel Image Style Picker */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-medium text-[#5E646A]">
                    Wheel style
                  </label>
                  <button
                    type="button"
                    disabled={uploadingPng}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#111315] hover:text-[#FF5A1F] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{uploadingPng ? 'Uploading...' : imageFileName ? 'Replace PNG' : 'Upload PNG'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png"
                    onChange={handlePngUpload}
                    className="hidden"
                  />
                </div>
                {imageFileName && (
                  <p className="mb-2 text-[11px] font-mono text-[#5E646A] truncate">
                    Linked cutout: {imageFileName}
                  </p>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {WHEEL_STYLE_OPTIONS.map((opt) => {
                    const selected = !imageFileName && wheelImageKey === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setWheelImageKey(opt.key);
                          setImageFileName(undefined);
                          setImageUrl(undefined);
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

              {/* Front / Back Axle Selector */}
              <div>
                <label className="block text-xs font-medium text-[#5E646A] mb-1.5">
                  Axle
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F3F4F2]">
                  {(['Front', 'Back'] as TyreAxle[]).map((option) => {
                    const active = axle === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleAxleChange(option)}
                        className={`min-h-[40px] rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                    value={tyreSize}
                    onChange={(e) => setTyreSize(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F3F4F2] border border-black/8 font-mono text-xs text-[#111315] focus:outline-none focus:ring-2 focus:ring-[#111315]"
                  >
                    {Array.from(
                      new Set([...getCarTyreSizingOptions(car), ...(tyreSize ? [tyreSize] : [])])
                    ).map((size) => (
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
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Optional"
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
                  value={brandModel}
                  onChange={(e) => setBrandModel(e.target.value)}
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Car Speed quote · Includes balancing"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F3F4F2] border border-black/8 text-sm text-[#111315] focus:outline-none focus:ring-2 focus:ring-[#111315]"
                />
              </div>

              {formError && (
                <p className="text-xs text-[#991B1B] bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {formError}
                </p>
              )}

              <div className="pt-2 flex items-center gap-2.5">
                {editingTyre && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleDelete}
                    aria-label="Delete saved tyre"
                    className="min-h-[44px] px-3.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 min-h-[44px] rounded-full border border-black/10 text-xs font-medium text-[#5E646A] hover:bg-black/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 min-h-[44px] rounded-full bg-[#111315] text-white text-xs font-semibold hover:bg-black/85 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingTyre ? 'Update tyre' : 'Save tyre'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
