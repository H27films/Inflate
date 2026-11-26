import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { CarId, CarProfile, CarRenewals, CORNER_LABELS, TyreCorner } from '../types';
import { formatRenewalDate, getCornerPurchaseInfo, parseLocalDate } from '../data/initialGarage';

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

const PLATE_NUMBERS: Record<CarId, string> = {
  slk250: 'WCD 428D',
  fortuner: 'WSE 4751',
};

function formatPrice(amount: number): string {
  return `RM${amount.toLocaleString('en-MY', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompactWeekdayMonthDay(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const month = dt.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday}, ${month} - ${dt.getDate()}`;
}

function formatTyreAgeMonthsUpper(dateStr: string): string {
  const today = new Date();
  const bought = parseLocalDate(dateStr);
  let months =
    (today.getFullYear() - bought.getFullYear()) * 12 +
    (today.getMonth() - bought.getMonth());
  if (today.getDate() < bought.getDate()) {
    months -= 1;
  }
  if (months <= 0) {
    return '0 MONTHS';
  }
  return months === 1 ? '1 MONTH' : `${months} MONTHS`;
}

function getRenewalCountdown(dateStr: string): { label: string; isUrgent: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalDate(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 0) {
    return {
      label: diffDays === 0 ? 'Due today' : `${Math.abs(diffDays)}d overdue`,
      isUrgent: true,
    };
  }

  if (diffDays < 30) {
    return {
      label: diffDays === 1 ? '1 Day' : `${diffDays} Days`,
      isUrgent: diffDays < 14,
    };
  }

  const weeks = Math.round(diffDays / 7);
  return {
    label: weeks === 1 ? '1 week' : `${weeks} weeks`,
    isUrgent: false,
  };
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

function WaveEnlargeText({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [activeCharIdx, setActiveCharIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!pressed) return;
    const timer = window.setTimeout(() => {
      setPressed(false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [pressed]);

  const isActive = hovered || pressed;

  // Split into words while keeping global character index so words never break mid-word
  const tokens = text.split(/(\s+)/);
  const totalChars = text.length;
  let runningIdx = 0;

  return (
    <span
      onPointerEnter={(e) => {
        if (e.pointerType !== 'touch') setHovered(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
        setPressed(false);
        setActiveCharIdx(null);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={(e) => {
        if (e.pointerType !== 'touch') setPressed(false);
      }}
      onPointerCancel={() => setPressed(false)}
      className={`inline-block cursor-pointer select-none ${className}`}
    >
      {tokens.map((token, tokenIdx) => {
        if (/^\s+$/.test(token)) {
          runningIdx += token.length;
          return <span key={`ws-${tokenIdx}`}>{token}</span>;
        }

        const chars = Array.from(token);
        const startIdx = runningIdx;
        runningIdx += chars.length;

        return (
          <span key={`word-${tokenIdx}`} className="inline-block whitespace-nowrap">
            {chars.map((char, offset) => {
              const charIdx = startIdx + offset;
              const dist =
                activeCharIdx !== null ? Math.abs(charIdx - activeCharIdx) : null;
              const targetScale = !isActive
                ? 1
                : dist === 0
                  ? 1.34
                  : dist === 1
                    ? 1.24
                    : 1.15;
              const targetY = !isActive ? 0 : dist === 0 ? -2 : -1;

              return (
                <motion.span
                  key={`c-${charIdx}`}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== 'touch') setActiveCharIdx(charIdx);
                  }}
                  animate={{
                    scale: targetScale,
                    y: targetY,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 460,
                    damping: 22,
                    delay: isActive
                      ? charIdx * 0.02
                      : Math.max(0, totalChars - 1 - charIdx) * 0.01,
                  }}
                  className="inline-block origin-bottom will-change-transform"
                >
                  {char}
                </motion.span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}

export function CarBirdsEyeView({
  car,
  selectedCorner,
  onSelectCorner,
  onUpdateRenewal,
}: CarBirdsEyeViewProps) {
  const [cutoutUrls, setCutoutUrls] = useState<Partial<Record<CarId, string>>>({});
  const [roofSelected, setRoofSelected] = useState(false);
  const [zoomedCorner, setZoomedCorner] = useState<TyreCorner | null>(null);
  const [keepClipped, setKeepClipped] = useState(false);
  const [editingField, setEditingField] = useState<keyof CarRenewals | null>(null);
  const [draftDate, setDraftDate] = useState('2027-01-10');

  useEffect(() => {
    setRoofSelected(false);
    setZoomedCorner(null);
    setKeepClipped(false);
    setEditingField(null);
  }, [car.id]);

  useEffect(() => {
    if (zoomedCorner) {
      setKeepClipped(true);
    }
  }, [zoomedCorner]);

  useEffect(() => {
    if (!selectedCorner || selectedCorner !== zoomedCorner) {
      setZoomedCorner(null);
    }
  }, [selectedCorner, zoomedCorner]);

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
  const coolantDate = car.renewals?.coolant ?? '2026-11-16';
  const insuranceCountdown = getRenewalCountdown(insuranceDate);
  const cartaxCountdown = getRenewalCountdown(cartaxDate);

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
  const selectedAgeUpper = selectedInfo
    ? formatTyreAgeMonthsUpper(selectedInfo.date)
    : null;
  const latestLog = car.pressureLogs[0] ?? null;
  const latestLowCorner = latestLog?.lowTyre?.corner ?? null;

  const getCornerRingState = (corner: TyreCorner): 'pulse-red' | 'red' | 'orange' | 'green' => {
    const isFlagged = latestLowCorner === corner;
    if (isFlagged) return 'pulse-red';
    if (!latestLog) return 'orange';

    const reading =
      latestLog.beforePressures?.[corner] ?? latestLog.pressures[corner];
    const standard = car.recommendedKpa[corner];
    const drop = standard - reading;

    if (drop <= 10) return 'green';
    if (drop <= 40) return 'orange';
    return 'red';
  };

  const zoomedSpot = zoomedCorner
    ? spots.find((s) => s.corner === zoomedCorner) ?? null
    : null;
  const isZoomed = zoomedSpot !== null;
  const isZoomedLeftWheel =
    zoomedSpot?.corner === 'FL' || zoomedSpot?.corner === 'RL';
  const isZoomedTopWheel =
    zoomedSpot?.corner === 'FL' || zoomedSpot?.corner === 'FR';

  const zoomTransform = zoomedSpot
    ? {
        scale: 1.85,
        x: isZoomedLeftWheel ? '118%' : '-118%',
        y: isZoomedTopWheel ? '36%' : '-36%',
      }
    : {
        scale: 1,
        x: '0%',
        y: '0%',
      };

  const recentReadings = zoomedCorner
    ? car.pressureLogs.slice(0, 3).map((entry) => {
        const isLow = entry.lowTyre?.corner === zoomedCorner;
        const kpa =
          isLow && entry.lowTyre?.beforeKpa !== undefined
            ? entry.lowTyre.beforeKpa
            : entry.beforePressures?.[zoomedCorner] ?? entry.pressures[zoomedCorner];
        return {
          id: entry.id,
          dateLabel: formatCompactWeekdayMonthDay(entry.date),
          kpa,
          isLow,
        };
      })
    : [];

  return (
    <div
      className={`w-full h-full flex items-center justify-center relative select-none ${
        isZoomed || keepClipped ? 'overflow-hidden rounded-2xl' : ''
      }`}
    >
      {isZoomed && (
        <button
          type="button"
          onClick={() => setZoomedCorner(null)}
          aria-label="Zoom out to full car"
          className="absolute inset-0 z-0 cursor-pointer focus:outline-none"
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={car.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{
            opacity: 1,
            scale: zoomTransform.scale,
            x: zoomTransform.x,
            y: zoomTransform.y,
          }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          onAnimationComplete={() => {
            if (!isZoomed) setKeepClipped(false);
          }}
          className="relative h-full max-w-full aspect-[4/7] flex items-center justify-center origin-center will-change-transform"
        >
          <motion.div
            animate={{
              scale: roofSelected && !isZoomed ? 0.76 : 1,
              y: roofSelected && !isZoomed ? (car.id === 'slk250' ? '-4.5%' : '2%') : '0%',
            }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="relative w-full h-full flex items-center justify-center origin-center will-change-transform"
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
              const ringState = getCornerRingState(spot.corner);
              const selectedClasses =
                ringState === 'green'
                  ? 'bg-[#166534]/24 ring-2 ring-[#166534] shadow-[0_0_16px_rgba(22,101,52,0.42)] scale-105'
                  : ringState === 'red'
                    ? 'bg-[#DC2626]/26 ring-2 ring-[#DC2626] shadow-[0_0_18px_rgba(220,38,38,0.48)] scale-105'
                    : 'bg-[#FF5A1F]/28 ring-2 ring-[#FF5A1F] shadow-[0_0_18px_rgba(255,90,31,0.5)] scale-105';
              return (
                <button
                  key={spot.corner}
                  type="button"
                  onClick={() => {
                    if (isZoomed) {
                      setZoomedCorner(null);
                      return;
                    }
                    setRoofSelected(false);
                    onSelectCorner(isSelected ? null : spot.corner);
                  }}
                  aria-label={
                    isZoomed
                      ? 'Zoom out from wheel'
                      : `Select ${CORNER_LABELS[spot.corner]} tyre (${spot.corner})`
                  }
                  aria-pressed={isSelected}
                  style={{
                    left: `${spot.leftPct}%`,
                    top: `${spot.topPct}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-16 flex items-center justify-center cursor-pointer focus:outline-none group"
                >
                  {isSelected && ringState === 'pulse-red' ? (
                    <motion.span
                      animate={{
                        borderColor: ['#B91C1C', '#EF4444', '#B91C1C'],
                        backgroundColor: [
                          'rgba(185, 28, 28, 0.24)',
                          'rgba(239, 68, 68, 0.36)',
                          'rgba(185, 28, 28, 0.24)',
                        ],
                        boxShadow: [
                          '0 0 14px rgba(185, 28, 28, 0.45)',
                          '0 0 24px rgba(239, 68, 68, 0.72)',
                          '0 0 14px rgba(185, 28, 28, 0.45)',
                        ],
                        scale: [1.04, 1.1, 1.04],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="w-7 h-12 rounded-xl border-2"
                    />
                  ) : (
                    <span
                      className={`w-7 h-12 rounded-xl transition-all duration-150 ${
                        isSelected
                          ? selectedClasses
                          : 'bg-transparent group-hover:ring-1 group-hover:ring-black/25 group-hover:bg-black/5'
                      }`}
                    />
                  )}
                </button>
              );
            })}

            {/* Interactive Center Roof Hotspot for Insurance, Car Tax & SLK Coolant */}
            {!isZoomed && (
              <button
                type="button"
                onClick={() => {
                  setRoofSelected((prev) => {
                    const next = !prev;
                    if (next) onSelectCorner(null);
                    return next;
                  });
                }}
                aria-label={
                  car.id === 'slk250'
                    ? 'Toggle insurance, car tax, and coolant dates'
                    : 'Toggle insurance and car tax renewal dates'
                }
                aria-pressed={roofSelected}
                style={{ left: '50%', top: '52%' }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-14 h-20 flex items-center justify-center cursor-pointer focus:outline-none group"
              >
                <span
                  className={`w-8 h-12 rounded-2xl transition-all duration-150 ${
                    roofSelected
                      ? 'bg-[#5C769D]/28 ring-2 ring-[#5C769D] shadow-[0_0_18px_rgba(92,118,157,0.5)] scale-105'
                      : 'bg-transparent group-hover:ring-1 group-hover:ring-black/20 group-hover:bg-black/5'
                  }`}
                />
              </button>
            )}
          </motion.div>

          {/* Front Plate, Left Insurance, Right Car Tax & SLK Rear Coolant Pop-Ups */}
          <AnimatePresence>
            {roofSelected && !isZoomed && (
              <>
                <motion.div
                  key={`${car.id}-plate`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 2 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    top: car.id === 'slk250' ? '5.5%' : '7.5%',
                    left: '50%',
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-10 text-center w-max pointer-events-none"
                >
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/75 backdrop-blur-md border border-white/90 ring-1 ring-black/[0.06] shadow-[0_2px_10px_rgba(17,19,21,0.06)] font-sans text-[11px] font-medium tracking-wide uppercase text-[#111315] whitespace-nowrap leading-none">
                    {PLATE_NUMBERS[car.id]}
                  </span>
                </motion.div>

                <motion.div
                  key={`${car.id}-insurance`}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 4 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    top: car.id === 'slk250' ? '45.5%' : '52%',
                    right: 'calc(82% + 14px)',
                  }}
                  className="absolute -translate-y-1/2 text-right w-max max-w-[125px] sm:max-w-[175px]"
                >
                  <button
                    type="button"
                    onClick={() => openEditRenewal('insurance', insuranceDate)}
                    aria-label={`Edit insurance renewal date (${formatRenewalDate(insuranceDate)})`}
                    className="group text-right space-y-0.5 cursor-pointer focus:outline-none"
                  >
                    <p className="font-display text-[13px] sm:text-sm font-medium text-[#2A2E33] leading-tight">
                      Insurance
                    </p>
                    <p
                      className={`font-display text-lg sm:text-xl font-light tabular-nums whitespace-nowrap leading-none pt-0.5 ${
                        insuranceCountdown.isUrgent
                          ? 'text-[#991B1B]'
                          : 'text-[#111315]'
                      }`}
                    >
                      {insuranceCountdown.label}
                    </p>
                    <p className="font-sans text-[11px] sm:text-xs font-normal text-[#5E646A] group-hover:text-[#4E6A94] group-active:scale-[0.98] transition-colors whitespace-nowrap leading-tight pt-0.5">
                      {formatRenewalDate(insuranceDate)}
                    </p>
                  </button>
                </motion.div>

                <motion.div
                  key={`${car.id}-cartax`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    top: car.id === 'slk250' ? '45.5%' : '52%',
                    left: 'calc(82% + 14px)',
                  }}
                  className="absolute -translate-y-1/2 text-left w-max max-w-[125px] sm:max-w-[175px]"
                >
                  <button
                    type="button"
                    onClick={() => openEditRenewal('cartax', cartaxDate)}
                    aria-label={`Edit car tax renewal date (${formatRenewalDate(cartaxDate)})`}
                    className="group text-left space-y-0.5 cursor-pointer focus:outline-none"
                  >
                    <p className="font-display text-[13px] sm:text-sm font-medium text-[#2A2E33] leading-tight">
                      Car Tax
                    </p>
                    <p
                      className={`font-display text-lg sm:text-xl font-light tabular-nums whitespace-nowrap leading-none pt-0.5 ${
                        cartaxCountdown.isUrgent
                          ? 'text-[#991B1B]'
                          : 'text-[#111315]'
                      }`}
                    >
                      {cartaxCountdown.label}
                    </p>
                    <p className="font-sans text-[11px] sm:text-xs font-normal text-[#5E646A] group-hover:text-[#4E6A94] group-active:scale-[0.98] transition-colors whitespace-nowrap leading-tight pt-0.5">
                      {formatRenewalDate(cartaxDate)}
                    </p>
                  </button>
                </motion.div>

                {car.id === 'slk250' && (
                  <motion.div
                    key={`${car.id}-coolant`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      top: '92.5%',
                      left: '50%',
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-10 text-center w-max max-w-[160px]"
                  >
                    <button
                      type="button"
                      onClick={() => openEditRenewal('coolant', coolantDate)}
                      aria-label={`Edit coolant last entry date (${formatRenewalDate(coolantDate)})`}
                      className="group text-center space-y-0.5 cursor-pointer focus:outline-none"
                    >
                      <p className="font-display text-[13px] sm:text-sm font-medium text-[#2A2E33] leading-tight">
                        Coolant
                      </p>
                      <p className="font-sans text-[11px] sm:text-xs font-normal text-[#5E646A] group-hover:text-[#4E6A94] group-active:scale-[0.98] transition-colors whitespace-nowrap leading-tight">
                        {formatRenewalDate(coolantDate)}
                      </p>
                    </button>
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>

          {/* Borderless Text Pop-Up Next to Selected Wheel: Click to zoom in */}
          <AnimatePresence>
            {activeSpot && !isZoomed && (
              <motion.div
                key={`${car.id}-${activeSpot.corner}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setRoofSelected(false);
                  setZoomedCorner(activeSpot.corner);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setRoofSelected(false);
                    setZoomedCorner(activeSpot.corner);
                  }
                }}
                aria-label={`Zoom in to ${CORNER_LABELS[activeSpot.corner]} wheel and recent readings`}
                title="Tap to zoom in"
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
                className={`absolute -translate-y-1/2 z-10 w-max max-w-[100px] sm:max-w-[165px] space-y-0.5 cursor-pointer focus:outline-none ${
                  activeSpot.corner === 'FL' || activeSpot.corner === 'RL'
                    ? 'text-right'
                    : 'text-left'
                }`}
              >
                {selectedInfo ? (
                  <>
                    <p className="font-display text-[11px] sm:text-xs font-bold text-[#111315] leading-tight">
                      <WaveEnlargeText text={selectedInfo.brandModel} />
                    </p>
                    {selectedSize && (
                      <p className="font-mono text-[10px] sm:text-[11px] font-medium text-[#5E646A] leading-tight">
                        <WaveEnlargeText text={selectedSize} />
                      </p>
                    )}
                    {selectedUnitPrice !== null && (
                      <p className="font-mono text-[11px] sm:text-xs font-bold text-[#FF5A1F] tabular-nums leading-tight">
                        <WaveEnlargeText text={formatPrice(selectedUnitPrice)} />
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {selectedSize && (
                      <p className="font-mono text-[10px] sm:text-[11px] font-medium text-[#5E646A] leading-tight">
                        <WaveEnlargeText text={selectedSize} />
                      </p>
                    )}
                    <p className="text-[10px] sm:text-[11px] text-[#8C9298] leading-tight">
                      <WaveEnlargeText text="No purchase" />
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Zoomed Wheel Detail & Last 3 Readings Overlay */}
      <AnimatePresence>
        {zoomedSpot && (
          <motion.div
            key={`zoom-detail-${car.id}-${zoomedSpot.corner}`}
            initial={{
              opacity: 0,
              x: isZoomedLeftWheel ? -16 : 16,
              scale: 0.94,
            }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: isZoomedLeftWheel ? -12 : 12,
              scale: 0.94,
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={`absolute top-1/2 -translate-y-1/2 z-20 w-[56%] max-w-[235px] space-y-2 pointer-events-auto ${
              isZoomedLeftWheel ? 'left-1 sm:left-3 text-left' : 'right-1 sm:right-3 text-right'
            }`}
          >
            <div className="space-y-0.5">
              <div
                className={`flex items-center gap-2 ${
                  isZoomedLeftWheel ? 'justify-between' : 'flex-row-reverse justify-between'
                }`}
              >
                {selectedAgeUpper ? (
                  <p className="font-display text-lg sm:text-xl font-light tracking-wide text-[#5E646A] leading-none uppercase tabular-nums">
                    {selectedAgeUpper}
                  </p>
                ) : (
                  <p className="font-display text-lg sm:text-xl font-light tracking-wide text-[#5E646A] leading-none uppercase">
                    {zoomedSpot.corner}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setZoomedCorner(null)}
                  aria-label="Zoom out"
                  className="w-7 h-7 rounded-full bg-white/90 border border-black/10 shadow-sm flex items-center justify-center text-[#5E646A] hover:text-[#111315] shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {selectedInfo ? (
                <>
                  <p className="font-display text-base sm:text-lg font-bold text-[#111315] leading-tight pt-0.5">
                    {selectedInfo.brandModel}
                  </p>
                  {selectedSize && (
                    <p className="font-mono text-[11px] sm:text-xs font-medium text-[#5E646A] whitespace-nowrap leading-tight">
                      {selectedSize}
                    </p>
                  )}
                  {selectedUnitPrice !== null && (
                    <p className="font-mono text-xs sm:text-sm font-bold text-[#FF5A1F] tabular-nums leading-tight">
                      {formatPrice(selectedUnitPrice)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-display text-base sm:text-lg font-bold text-[#111315] leading-tight pt-0.5">
                    {CORNER_LABELS[zoomedSpot.corner]}
                  </p>
                  {selectedSize && (
                    <p className="font-mono text-[11px] sm:text-xs font-medium text-[#5E646A] whitespace-nowrap leading-tight">
                      {selectedSize}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Last 3 Pressure Readings for this tyre */}
            <div className="pt-2 border-t border-black/10 space-y-1">
              {recentReadings.length === 0 ? (
                <p className="text-[11px] text-[#6B7075]">No readings yet</p>
              ) : (
                recentReadings.map((reading) => (
                  <div
                    key={reading.id}
                    className={`flex items-baseline justify-between gap-2 text-[11.5px] sm:text-xs tabular-nums ${
                      isZoomedLeftWheel ? '' : 'flex-row-reverse'
                    }`}
                  >
                    <span
                      className={`whitespace-nowrap ${
                        reading.isLow
                          ? 'font-medium text-[#B91C1C]'
                          : 'font-medium text-[#5E646A]'
                      }`}
                    >
                      {reading.dateLabel}
                    </span>
                    <span
                      className={`font-mono whitespace-nowrap ${
                        reading.isLow
                          ? 'font-bold text-[#B91C1C]'
                          : 'font-semibold text-[#111315]'
                      }`}
                    >
                      {reading.kpa} kPa
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
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
                    {editingField === 'insurance'
                      ? 'Insurance Renewal'
                      : editingField === 'cartax'
                        ? 'Car Tax Renewal'
                        : 'Coolant'}
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
                <span className="text-[11px] font-medium text-[#5E646A]">
                  {editingField === 'coolant' ? 'Last entry date' : 'Renewal date'}
                </span>
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
