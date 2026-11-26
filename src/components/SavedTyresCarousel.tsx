import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  CarProfile,
  SavedTyreOption,
  TyreAxle,
  WheelImageKey,
} from '../types';
import sport5SpokeImg from '../assets/images/tyre_sport_5spoke_1795708408432.jpg';
import meshSplitImg from '../assets/images/tyre_mesh_split_1795708408864.jpg';
import turbineDarkImg from '../assets/images/tyre_turbine_dark_1795708408245.jpg';
import allTerrainImg from '../assets/images/tyre_all_terrain_1795708408608.jpg';

const WHEEL_STYLE_OPTIONS: {
  key: WheelImageKey;
  label: string;
  src: string;
}[] = [
  { key: 'sport-5spoke', label: '5-Spoke', src: sport5SpokeImg },
  { key: 'mesh-split', label: 'Y-Mesh', src: meshSplitImg },
  { key: 'turbine-dark', label: 'Multi-Spoke', src: turbineDarkImg },
  { key: 'all-terrain', label: 'All-Terrain', src: allTerrainImg },
];

const WHEEL_IMAGE_MAP: Record<WheelImageKey, string> = {
  'sport-5spoke': sport5SpokeImg,
  'mesh-split': meshSplitImg,
  'turbine-dark': turbineDarkImg,
  'all-terrain': allTerrainImg,
};

function formatPriceRM(amount: number): string {
  return `RM${amount.toLocaleString('en-MY', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

interface SavedTyresCarouselProps {
  car: CarProfile;
  tyres: SavedTyreOption[];
  rulesPending?: boolean;
  onAddTyre: (entry: Omit<SavedTyreOption, 'id'>) => Promise<void> | void;
  onUpdateTyre: (id: string, entry: Omit<SavedTyreOption, 'id'>) => Promise<void> | void;
  onDeleteTyre: (id: string) => Promise<void> | void;
}

export function SavedTyresCarousel({
  car,
  tyres,
  rulesPending = false,
  onAddTyre,
  onUpdateTyre,
  onDeleteTyre,
}: SavedTyresCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRafRef = useRef<number | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTyre, setEditingTyre] = useState<SavedTyreOption | null>(null);
  const [saving, setSaving] = useState(false);
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
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setActiveIndex(0);
    if (scrollerRef.current) {
      scrollerRef.current.scrollTo({ left: 0, behavior: 'auto' });
    }
  }, [car.id]);

  useEffect(() => {
    if (activeIndex >= tyres.length && tyres.length > 0) {
      setActiveIndex(tyres.length - 1);
    }
  }, [tyres.length, activeIndex]);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const container = scrollerRef.current;
    const target = itemRefs.current[index];
    if (!container || !target) return;
    const containerCenter = container.clientWidth / 2;
    const targetCenter = target.offsetLeft + target.offsetWidth / 2;
    const nextLeft = Math.max(0, targetCenter - containerCenter);
    container.scrollTo({ left: nextLeft, behavior });
    setActiveIndex(index);
  }, []);

  const handleScroll = () => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      const container = scrollerRef.current;
      if (!container || tyres.length === 0) return;
      const centerX = container.scrollLeft + container.clientWidth / 2;
      let closestIdx = 0;
      let closestDist = Number.POSITIVE_INFINITY;
      tyres.forEach((_, idx) => {
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
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
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
    setNotes('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: SavedTyreOption) => {
    setEditingTyre(item);
    setBrandModel(item.brandModel);
    setPrice(String(item.price));
    setAxle(item.axle);
    setTyreSize(item.tyreSize);
    setWheelImageKey(item.wheelImageKey);
    setNotes(item.notes ?? '');
    setFormError(null);
    setModalOpen(true);
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
      notes: notes.trim() || undefined,
    };

    try {
      if (editingTyre) {
        await onUpdateTyre(editingTyre.id, payload);
      } else {
        await onAddTyre(payload);
        setTimeout(() => {
          scrollToIndex(tyres.length, 'smooth');
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

  const activeTyre = tyres[activeIndex] ?? tyres[0] ?? null;

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
        {tyres.length === 0 ? (
          <div className="px-6 py-6 flex flex-col items-center text-center">
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
          </div>
        ) : (
          <div className="w-full relative">
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
                className="w-full overflow-x-auto snap-x snap-mandatory flex items-center px-[calc(50%-72px)] sm:px-[calc(50%-82px)] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {tyres.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  const imgSrc = WHEEL_IMAGE_MAP[item.wheelImageKey] ?? sport5SpokeImg;
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
                        className={`w-[136px] h-[136px] sm:w-[152px] sm:h-[152px] rounded-full p-2 flex items-center justify-center transition-all duration-200 ${
                          isActive
                            ? 'border-[3px] border-[#111315] bg-white/85 shadow-[0_12px_28px_-8px_rgba(17,19,21,0.16)] scale-100 opacity-100'
                            : 'border-[3px] border-transparent bg-transparent scale-[0.76] opacity-55 hover:opacity-80'
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
                            className="w-full h-full rounded-full object-contain mix-blend-multiply select-none pointer-events-none"
                            draggable={false}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {activeIndex < tyres.length - 1 && (
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
              {tyres.map((item, idx) => {
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
                <p className="font-display text-2xl sm:text-[26px] font-bold tracking-tight tabular-nums text-[#111315] leading-none">
                  {formatPriceRM(activeTyre.price)}
                </p>
                <h3 className="mt-1 font-display text-[15px] sm:text-base font-medium text-[#111315] leading-snug text-balance">
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

                <div className="mt-1.5 flex items-center justify-center gap-4 text-xs text-[#5E646A]">
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="min-h-[36px] px-2 inline-flex items-center gap-1 font-medium text-[#111315] hover:text-[#FF5A1F] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save tyre</span>
                  </button>
                  <span aria-hidden="true" className="text-[#C5C8C4]">
                    |
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditModal(activeTyre)}
                    className="min-h-[36px] px-2 inline-flex items-center gap-1 font-medium text-[#5E646A] hover:text-[#111315] transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>

                {rulesPending && (
                  <p className="mt-1 text-[11px] text-[#991B1B]">
                    Publish the savedTyres Firestore rule to sync edits.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </motion.section>

      {/* Add / Edit Saved Tyre Option Modal */}
      {modalOpen && (
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
                <label className="block text-xs font-medium text-[#5E646A] mb-1.5">
                  Wheel style
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {WHEEL_STYLE_OPTIONS.map((opt) => {
                    const selected = wheelImageKey === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setWheelImageKey(opt.key)}
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
                          className="w-11 h-11 rounded-full object-contain mix-blend-multiply"
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
                  <input
                    type="text"
                    required
                    value={tyreSize}
                    onChange={(e) => setTyreSize(e.target.value)}
                    placeholder="225/40 R18 92Y"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F3F4F2] border border-black/8 font-mono text-xs text-[#111315] focus:outline-none focus:ring-2 focus:ring-[#111315]"
                  />
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
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
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
        </div>
      )}
    </>
  );
}
