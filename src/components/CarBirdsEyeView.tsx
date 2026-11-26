import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CarId, CarProfile, CORNER_LABELS, TyreCorner } from '../types';
import { getCornerPurchaseInfo } from '../data/initialGarage';

interface CarBirdsEyeViewProps {
  car: CarProfile;
  selectedCorner: TyreCorner | null;
  onSelectCorner: (corner: TyreCorner | null) => void;
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
    { corner: 'FL', leftPct: 14.5, topPct: 26 },
    { corner: 'FR', leftPct: 85.5, topPct: 26 },
    { corner: 'RL', leftPct: 14.5, topPct: 78 },
    { corner: 'RR', leftPct: 85.5, topPct: 78 },
  ],
};

const SOURCE_IMAGES: Record<CarId, string> = {
  slk250: '/assets/aistudio/81d0f7f1d29f41f7ef25816ce8d819db_2dbba125.jpg',
  fortuner: '/assets/aistudio/692e428c303d103a82a2c30067945734_9eac0568.jpg',
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
}: CarBirdsEyeViewProps) {
  const [cutoutUrls, setCutoutUrls] = useState<Partial<Record<CarId, string>>>({});

  useEffect(() => {
    let active = true;
    (['slk250', 'fortuner'] as CarId[]).forEach((id) => {
      if (cutoutUrls[id]) return;
      processCarAsset(id)
        .then((url) => {
          if (active) {
            setCutoutUrls((prev) => ({ ...prev, [id]: url }));
          }
        })
        .catch(() => {});
    });
    return () => {
      active = false;
    };
  }, []);

  const spots = WHEEL_SPOTS[car.id];
  const activeSrc = cutoutUrls[car.id] ?? SOURCE_IMAGES[car.id];
  const activeSpot = spots.find((s) => s.corner === selectedCorner) ?? null;

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
    </div>
  );
}
