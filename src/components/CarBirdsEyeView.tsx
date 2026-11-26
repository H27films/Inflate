import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { CarId, CarProfile, CarRenewals, CORNER_LABELS, TyreCorner } from '../types';
import { formatRenewalDate, getCornerPurchaseInfo } from '../data/initialGarage';

interface CarBirdsEyeViewProps {
  car: CarProfile;
  selectedCorner: TyreCorner | null;
  onSelectCorner: (corner: TyreCorner | null) => void;
  onUpdateRenewal: (field: keyof CarRenewals, date: string) => void;
}

interface WheelSpot {
  corner: TyreCorner;
  leftPct: number;
  topPct: number;
}

const WHEEL_SPOTS: Record<CarId, WheelSpot[]> = {
  slk250: [
    { corner: 'FL', leftPct: 15, topPct: 24 },
    { corner: 'FR', leftPct: 85, topPct: 24 },
    { corner: 'RL', leftPct: 15, topPct: 75 },
    { corner: 'RR', leftPct: 85, topPct: 75 },
  ],
  fortuner: [
    { corner: 'FL', leftPct: 14.5, topPct: 21 },
    { corner: 'FR', leftPct: 85.5, topPct: 21 },
    { corner: 'RL', leftPct: 14.5, topPct: 77 },
    { corner: 'RR', leftPct: 85.5, topPct: 77 },
  ],
};

const SOURCE_IMAGES: Record<CarId, string> = {
  slk250: '/assets/aistudio/81d0f7f1d29f41f7ef25816ce8d819db_2dbba125.jpg',
  fortuner: '/assets/aistudio/fortuner_cutout.png',
};

function formatPrice(amount: number): string {
  return `RM${amount.toLocaleString('en-MY', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function removeEdgeBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: 'dark-car' | 'outlined-white-car'
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const total = width * height;
  const visited = new Uint8Array(total);
  const bgMask = new Uint8Array(total);

  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];

  const isBackgroundPixel = (idx4: number): boolean => {
    const r = data[idx4];
    const g = data[idx4 + 1];
    const b = data[idx4 + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);

    if (mode === 'dark-car') {
      // Remove pure white background and soft neutral studio shadow halo around dark car
      const lum = (r + g + b) / 3;
      return maxC - minC < 16 && lum > 175;
    }

    // Outlined white SUV: match uniform exterior canvas color closely so flood-fill stops at outer outline
    const dr = Math.abs(r - bgR);
    const dg = Math.abs(g - bgG);
    const db = Math.abs(b - bgB);
    return dr <= 14 && dg <= 14 && db <= 14 && maxC - minC <= 12;
  };

  // BFS flood-fill starting from all 4 edges
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const trySeed = (p: number) => {
    if (visited[p]) return;
    visited[p] = 1;
    if (isBackgroundPixel(p * 4)) {
      bgMask[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < width; x++) {
    trySeed(x);
    trySeed((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    trySeed(y * width);
    trySeed(y * width + (width - 1));
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p - x) / width;

    if (x > 0) trySeed(p - 1);
    if (x < width - 1) trySeed(p + 1);
    if (y > 0) trySeed(p - width);
    if (y < height - 1) trySeed(p + width);
  }

  // Clear background pixels to alpha = 0 and soften 1px silhouette edge
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (bgMask[p]) {
        data[p * 4 + 3] = 0;
      } else {
        // Count transparent 4-neighbors to feather jagged outline slightly
        let bgNeighbors = 0;
        if (x > 0 && bgMask[p - 1]) bgNeighbors++;
        if (x < width - 1 && bgMask[p + 1]) bgNeighbors++;
        if (y > 0 && bgMask[p - width]) bgNeighbors++;
        if (y < height - 1 && bgMask[p + width]) bgNeighbors++;

        if (bgNeighbors > 0) {
          const idx4 = p * 4;
          const lum = (data[idx4] + data[idx4 + 1] + data[idx4 + 2]) / 3;
          if (lum > 205) {
            data[idx4 + 3] = bgNeighbors >= 2 ? 90 : 170;
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function processCarAsset(carId: CarId): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(SOURCE_IMAGES[carId]);
        return;
      }

      if (carId === 'slk250') {
        const sx = Math.round(w * 0.14);
        const sy = Math.round(h * 0.15);
        const sw = Math.round(w * 0.72);
        const sh = Math.round(h * 0.72);

        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        removeEdgeBackground(ctx, sw, sh, 'dark-car');
      } else {
        const sx = Math.round(w * 0.53);
        const sy = Math.round(h * 0.07);
        const sw = Math.round(w * 0.43);
        const sh = Math.round(h * 0.86);

        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        removeEdgeBackground(ctx, sw, sh, 'outlined-white-car');
      }

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load car image'));
    img.src = SOURCE_IMAGES[carId];
  });
}

export function CarBirdsEyeView({
  car,
  selectedCorner,
  onSelectCorner,
  onUpdateRenewal,
}: CarBirdsEyeViewProps) {
  const [cutoutUrls, setCutoutUrls] = useState<Partial<Record<CarId, string>>>({});
  const [roofSelected, setRoofSelected] = useState(false);
  const [editingField, setEditingField] = useState<keyof CarRenewals | null>(null);
  const [draftDate, setDraftDate] = useState('2027-01-10');

  useEffect(() => {
    setRoofSelected(false);
    setEditingField(null);
  }, [car.id]);

  useEffect(() => {
    let active = true;
    if (!cutoutUrls.slk250) {
      processCarAsset('slk250')
        .then((url) => {
          if (active) {
            setCutoutUrls((prev) => ({ ...prev, slk250: url }));
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, []);

  const spots = WHEEL_SPOTS[car.id];
  const activeSrc = cutoutUrls[car.id] ?? SOURCE_IMAGES[car.id];
  const activeSpot = spots.find((s) => s.corner === selectedCorner) ?? null;

  const insuranceDate = car.renewals?.insurance ?? '2027-01-10';
  const cartaxDate = car.renewals?.cartax ?? '2027-01-10';

  const openEditRenewal = (field: keyof CarRenewals, currentDate: string) => {
    setEditingField(field);
    setDraftDate(currentDate);
  };

  const handleSaveRenewal = (e: FormEvent) => {
    e.preventDefault();
    if (!editingField || !draftDate) return;
    onUpdateRenewal(editingField, draftDate);
    setEditingField(null);
  };

  const selectedInfo = selectedCorner
    ? getCornerPurchaseInfo(car.purchaseLogs, selectedCorner)
    : null;
  const selectedSize = selectedCorner
    ? selectedInfo?.tyreSize ??
      (selectedCorner === 'FL' || selectedCorner === 'FR'
        ? car.defaultSizes.front
        : car.defaultSizes.rear)
    : null;
  const selectedUnitPrice =
    selectedInfo && selectedInfo.corners.length > 0
      ? Math.round((selectedInfo.totalCost / selectedInfo.corners.length) * 100) / 100
      : null;

  return (
    <div className="w-full h-full flex items-center justify-center relative select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={car.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="relative h-full max-w-full aspect-[4/7] flex items-center justify-center"
        >
          <img
            src={activeSrc}
            alt={`${car.displayTitle} top-down bird's eye view`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain pointer-events-none drop-shadow-[0_10px_18px_rgba(17,19,21,0.12)]"
          />

          {/* Interactive Wheel Hotspots */}
          {spots.map((spot) => {
            const isSelected = selectedCorner === spot.corner;
            return (
              <button
                key={spot.corner}
                type="button"
                onClick={() => onSelectCorner(isSelected ? null : spot.corner)}
                aria-label={`Select ${CORNER_LABELS[spot.corner]} tyre (${spot.corner})`}
                aria-pressed={isSelected}
                style={{
                  left: `${spot.leftPct}%`,
                  top: `${spot.topPct}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-16 flex items-center justify-center cursor-pointer focus:outline-none group"
              >
                <span
                  className={`w-7 h-12 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? 'bg-[#FF5A1F]/28 ring-2 ring-[#FF5A1F] shadow-[0_0_18px_rgba(255,90,31,0.5)] scale-105'
                      : 'bg-transparent group-hover:ring-1 group-hover:ring-black/25 group-hover:bg-black/5'
                  }`}
                />
              </button>
            );
          })}

          {/* Interactive Center Roof Hotspot for Insurance & Cartax */}
          <button
            type="button"
            onClick={() => setRoofSelected((prev) => !prev)}
            aria-label="Toggle insurance and cartax renewal dates"
            aria-pressed={roofSelected}
            style={{ left: '50%', top: '52%' }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-14 h-20 flex items-center justify-center cursor-pointer focus:outline-none group"
          >
            <span
              className={`w-8 h-12 rounded-2xl transition-all duration-150 ${
                roofSelected
                  ? 'bg-[#FF5A1F]/22 ring-2 ring-[#FF5A1F] shadow-[0_0_18px_rgba(255,90,31,0.45)] scale-105'
                  : 'bg-transparent group-hover:ring-1 group-hover:ring-black/20 group-hover:bg-black/5'
              }`}
            />
          </button>

          {/* Left & Right Renewal Pop-Ups when Roof is Selected */}
          <AnimatePresence>
            {roofSelected && (
              <>
                <motion.div
                  key={`${car.id}-insurance`}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 4 }}
                  transition={{ duration: 0.16 }}
                  style={{
                    top: '50%',
                    right: 'calc(85% + 18px)',
                  }}
                  className="absolute -translate-y-1/2 text-right space-y-0.5 w-max max-w-[115px] sm:max-w-[165px]"
                >
                  <p className="font-display text-[11px] sm:text-xs font-bold text-[#111315] leading-tight">
                    Insurance
                  </p>
                  <button
                    type="button"
                    onClick={() => openEditRenewal('insurance', insuranceDate)}
                    aria-label={`Edit insurance renewal date (${formatRenewalDate(insuranceDate)})`}
                    className="font-sans text-[11px] sm:text-xs font-normal text-[#5E646A] hover:text-[#FF5A1F] active:scale-[0.98] transition-colors whitespace-nowrap leading-tight cursor-pointer underline decoration-black/20 underline-offset-2"
                  >
                    {formatRenewalDate(insuranceDate)}
                  </button>
                </motion.div>

                <motion.div
                  key={`${car.id}-cartax`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.16 }}
                  style={{
                    top: '50%',
                    left: 'calc(85% + 18px)',
                  }}
                  className="absolute -translate-y-1/2 text-left space-y-0.5 w-max max-w-[115px] sm:max-w-[165px]"
                >
                  <p className="font-display text-[11px] sm:text-xs font-bold text-[#111315] leading-tight">
                    Cartax
                  </p>
                  <button
                    type="button"
                    onClick={() => openEditRenewal('cartax', cartaxDate)}
                    aria-label={`Edit cartax renewal date (${formatRenewalDate(cartaxDate)})`}
                    className="font-sans text-[11px] sm:text-xs font-normal text-[#5E646A] hover:text-[#FF5A1F] active:scale-[0.98] transition-colors whitespace-nowrap leading-tight cursor-pointer underline decoration-black/20 underline-offset-2"
                  >
                    {formatRenewalDate(cartaxDate)}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Borderless Text Pop-Up Next to Selected Wheel: Model, Sizing, Last $ Price */}
          <AnimatePresence>
            {activeSpot && (
              <motion.div
                key={`${car.id}-${activeSpot.corner}`}
                initial={{
                  opacity: 0,
                  x: activeSpot.corner === 'FL' || activeSpot.corner === 'RL' ? 6 : -6,
                }}
                animate={{ opacity: 1, x: 0 }}
                exit={{
                  opacity: 0,
                  x: activeSpot.corner === 'FL' || activeSpot.corner === 'RL' ? 4 : -4,
                }}
                transition={{ duration: 0.16 }}
                style={{
                  top: `${activeSpot.topPct}%`,
                  ...(activeSpot.corner === 'FL' || activeSpot.corner === 'RL'
                    ? { right: `calc(${100 - activeSpot.leftPct}% + 22px)` }
                    : { left: `calc(${activeSpot.leftPct}% + 22px)` }),
                }}
                className={`absolute -translate-y-1/2 pointer-events-none w-max max-w-[100px] sm:max-w-[165px] space-y-0.5 ${
                  activeSpot.corner === 'FL' || activeSpot.corner === 'RL'
                    ? 'text-right'
                    : 'text-left'
                }`}
              >
                {selectedInfo ? (
                  <>
                    <p className="font-display text-[11px] sm:text-xs font-bold text-[#111315] leading-tight">
                      {selectedInfo.brandModel}
                    </p>
                    <p className="font-mono text-[10px] sm:text-[11px] font-medium text-[#5E646A] leading-tight">
                      {selectedSize}
                    </p>
                    {selectedUnitPrice !== null && (
                      <p className="font-mono text-[11px] sm:text-xs font-bold text-[#FF5A1F] tabular-nums leading-tight">
                        {formatPrice(selectedUnitPrice)}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-mono text-[10px] sm:text-[11px] font-medium text-[#5E646A] leading-tight">
                      {selectedSize}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-[#8C9298] leading-tight">
                      No purchase
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Renewal Date Edit Modal */}
      <AnimatePresence>
        {editingField && (
          <motion.div
            key="renewal-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingField(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[2px]"
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveRenewal}
              className="w-full max-w-xs bg-white rounded-3xl border border-black/8 shadow-[0_20px_50px_rgba(17,19,21,0.2)] p-5 space-y-4 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-semibold text-[#111315]">
                    {editingField === 'insurance' ? 'Insurance' : 'Cartax'} Renewal
                  </h3>
                  <p className="text-xs text-[#5E646A] mt-0.5">{car.displayTitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingField(null)}
                  aria-label="Close renewal editor"
                  className="w-8 h-8 rounded-full bg-[#F3F4F2] flex items-center justify-center text-[#5E646A] hover:text-[#111315] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <label className="block">
                <span className="text-[11px] font-medium text-[#5E646A]">Renewal date</span>
                <input
                  type="date"
                  required
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="mt-1.5 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/10 text-sm font-mono text-[#111315]"
                />
              </label>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingField(null)}
                  className="flex-1 h-10 rounded-xl bg-[#F3F4F2] text-xs font-semibold text-[#111315] hover:bg-black/[0.06] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-[#111315] text-xs font-semibold text-white hover:bg-black/85 transition-colors cursor-pointer"
                >
                  Save
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
