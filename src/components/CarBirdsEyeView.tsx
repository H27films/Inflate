import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, X } from 'lucide-react';
import { CarId, CarProfile, CarRenewals, CORNER_LABELS, TyreCorner } from '../types';
import {
  formatRenewalDate,
  getCornerPurchaseInfo,
  getDaysSince,
  getTodayIso,
  parseLocalDate,
} from '../data/initialGarage';

interface CarBirdsEyeViewProps {
  car: CarProfile;
  selectedCorner: TyreCorner | null;
  onSelectCorner: (corner: TyreCorner | null) => void;
  onUpdateRenewal: (field: keyof CarRenewals, date: string) => void;
  onDeleteCarWashLog?: (id: string) => void;
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

function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function processDirtyCarAsset(carId: CarId, cleanSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const dirtCanvas = document.createElement('canvas');
      const dirtCtx = dirtCanvas.getContext('2d');

      if (!ctx || !dirtCtx) {
        resolve(cleanSrc);
        return;
      }

      canvas.width = w;
      canvas.height = h;
      dirtCanvas.width = w;
      dirtCanvas.height = h;

      ctx.drawImage(img, 0, 0, w, h);
      const cleanData = ctx.getImageData(0, 0, w, h);
      const rand = createSeededRandom(carId === 'slk250' ? 4219 : 7391);
      const isDarkCar = carId === 'slk250';

      // 1. Light overall road-dust film
      dirtCtx.fillStyle = isDarkCar
        ? 'rgba(176, 164, 146, 0.045)'
        : 'rgba(90, 76, 58, 0.035)';
      dirtCtx.fillRect(0, 0, w, h);

      // 2. Soft organic dust patches across hood, roof, sides, and rear
      const drawSoftBlotch = (
        cx: number,
        cy: number,
        rx: number,
        ry: number,
        angle: number,
        color: string,
        peakAlpha: number
      ) => {
        dirtCtx.save();
        dirtCtx.translate(cx, cy);
        dirtCtx.rotate(angle);
        dirtCtx.scale(1, ry / Math.max(1, rx));
        const grad = dirtCtx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);
        grad.addColorStop(0, `rgba(${color}, ${peakAlpha})`);
        grad.addColorStop(0.55, `rgba(${color}, ${peakAlpha * 0.4})`);
        grad.addColorStop(1, `rgba(${color}, 0)`);
        dirtCtx.fillStyle = grad;
        dirtCtx.beginPath();
        dirtCtx.arc(0, 0, rx, 0, Math.PI * 2);
        dirtCtx.fill();
        dirtCtx.restore();
      };

      const blotchColors = isDarkCar
        ? ['196, 184, 166', '162, 150, 132']
        : ['82, 68, 50', '104, 88, 68'];

      for (let i = 0; i < 12; i++) {
        const cx = (0.16 + rand() * 0.68) * w;
        const cy = (0.09 + rand() * 0.82) * h;
        const rx = (0.08 + rand() * 0.14) * w;
        const ry = (0.09 + rand() * 0.15) * h;
        const angle = (rand() - 0.5) * 0.8;
        const color = blotchColors[i % blotchColors.length];
        const peakAlpha = isDarkCar ? 0.055 + rand() * 0.045 : 0.05 + rand() * 0.045;
        drawSoftBlotch(cx, cy, rx, ry, angle, color, peakAlpha);
      }

      // 3. Subtle wheel-arch road-spray & lower-edge dust
      const wheelSplashZones =
        carId === 'slk250'
          ? [
              { x: 0.16, y: 0.30 },
              { x: 0.84, y: 0.30 },
              { x: 0.16, y: 0.81 },
              { x: 0.84, y: 0.81 },
            ]
          : [
              { x: 0.15, y: 0.27 },
              { x: 0.85, y: 0.27 },
              { x: 0.15, y: 0.83 },
              { x: 0.85, y: 0.83 },
            ];

      for (const zone of wheelSplashZones) {
        const splashColor = isDarkCar ? '186, 172, 150' : '74, 60, 44';
        drawSoftBlotch(
          zone.x * w,
          zone.y * h,
          0.13 * w,
          0.10 * h,
          (rand() - 0.5) * 0.4,
          splashColor,
          isDarkCar ? 0.10 : 0.11
        );
      }

      // Light rear bumper dust accumulation
      drawSoftBlotch(
        0.5 * w,
        0.92 * h,
        0.32 * w,
        0.08 * h,
        0,
        isDarkCar ? '186, 174, 154' : '76, 62, 46',
        0.09
      );

      // 4. Very faint front-to-back airflow dust streaks
      for (let i = 0; i < 8; i++) {
        const sx = (0.20 + rand() * 0.60) * w;
        const sy = (0.10 + rand() * 0.70) * h;
        const len = (0.06 + rand() * 0.12) * h;
        const sw = 1.2 + rand() * 2.2;
        const grad = dirtCtx.createLinearGradient(sx, sy, sx, sy + len);
        const c = isDarkCar ? '205, 192, 174' : '76, 62, 46';
        const alpha = 0.03 + rand() * 0.035;
        grad.addColorStop(0, `rgba(${c}, 0)`);
        grad.addColorStop(0.35, `rgba(${c}, ${alpha})`);
        grad.addColorStop(1, `rgba(${c}, 0)`);
        dirtCtx.strokeStyle = grad;
        dirtCtx.lineWidth = sw;
        dirtCtx.lineCap = 'round';
        dirtCtx.beginPath();
        dirtCtx.moveTo(sx, sy);
        dirtCtx.lineTo(sx + (rand() - 0.5) * 4, sy + len);
        dirtCtx.stroke();
      }

      // 5. Scattered little dust & grime speck marks (slightly denser near wheel arches & edges)
      for (let i = 0; i < 340; i++) {
        const edgeBiasedX =
          rand() < 0.42
            ? rand() < 0.5
              ? 0.09 + rand() * 0.22
              : 0.69 + rand() * 0.22
            : 0.14 + rand() * 0.72;
        const cx = edgeBiasedX * w;
        const cy = (0.06 + rand() * 0.88) * h;
        const r = 0.9 + rand() * 1.5;
        const alpha = 0.16 + rand() * 0.22;
        dirtCtx.fillStyle = isDarkCar
          ? rand() > 0.35
            ? `rgba(212, 200, 182, ${alpha})`
            : `rgba(168, 154, 134, ${alpha})`
          : rand() > 0.35
            ? `rgba(68, 54, 39, ${alpha})`
            : `rgba(102, 86, 66, ${alpha})`;
        dirtCtx.beginPath();
        dirtCtx.arc(cx, cy, r, 0, Math.PI * 2);
        dirtCtx.fill();
      }

      // 6. Subtle dried raindrop & spot marks on hood, roof, and rear
      for (let i = 0; i < 18; i++) {
        const rx = (0.20 + rand() * 0.60) * w;
        const ry = (0.12 + rand() * 0.72) * h;
        const rad = 2.0 + rand() * 3.4;
        dirtCtx.strokeStyle = isDarkCar
          ? `rgba(206, 194, 176, ${0.11 + rand() * 0.08})`
          : `rgba(74, 60, 44, ${0.11 + rand() * 0.08})`;
        dirtCtx.lineWidth = 0.95;
        dirtCtx.beginPath();
        dirtCtx.arc(rx, ry, rad, 0, Math.PI * 2);
        dirtCtx.stroke();
      }

      // 7. Pixel-composite dirt strictly inside opaque car bodywork (avoiding drop shadows)
      const dirtData = dirtCtx.getImageData(0, 0, w, h).data;
      const px = cleanData.data;
      const total = px.length;
      const muteR = isDarkCar ? 132 : 108;
      const muteG = isDarkCar ? 122 : 95;
      const muteB = isDarkCar ? 108 : 78;

      for (let i = 0; i < total; i += 4) {
        const baseA = px[i + 3];
        if (baseA < 200) continue;

        const edgeMask = baseA >= 245 ? 1 : (baseA - 200) / 45;
        // Very lightly dull fresh-wax sheen across bodywork
        const dullFactor = 0.03 * edgeMask;
        let r = px[i] * (1 - dullFactor) + muteR * dullFactor;
        let g = px[i + 1] * (1 - dullFactor) + muteG * dullFactor;
        let b = px[i + 2] * (1 - dullFactor) + muteB * dullFactor;

        const dirtAlpha = (dirtData[i + 3] / 255) * edgeMask;
        if (dirtAlpha > 0) {
          r = r * (1 - dirtAlpha) + dirtData[i] * dirtAlpha;
          g = g * (1 - dirtAlpha) + dirtData[i + 1] * dirtAlpha;
          b = b * (1 - dirtAlpha) + dirtData[i + 2] * dirtAlpha;
        }

        px[i] = Math.round(r);
        px[i + 1] = Math.round(g);
        px[i + 2] = Math.round(b);
      }

      ctx.putImageData(cleanData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load car image'));
    img.src = cleanSrc;
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
  onDeleteCarWashLog,
}: CarBirdsEyeViewProps) {
  const [cutoutUrls, setCutoutUrls] = useState<Partial<Record<CarId, string>>>({});
  const [dirtyCutoutUrls, setDirtyCutoutUrls] = useState<Partial<Record<CarId, string>>>({});
  const [roofSelected, setRoofSelected] = useState(false);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [keepClipped, setKeepClipped] = useState(false);
  const [editingField, setEditingField] = useState<keyof CarRenewals | null>(null);
  const [draftDate, setDraftDate] = useState('2027-01-10');

  const zoomedCorner: TyreCorner | null =
    isZoomedIn && selectedCorner ? selectedCorner : null;

  useEffect(() => {
    setRoofSelected(false);
    setIsZoomedIn(false);
    setKeepClipped(false);
    setEditingField(null);
  }, [car.id]);

  useEffect(() => {
    if (zoomedCorner) {
      setKeepClipped(true);
    }
  }, [zoomedCorner]);

  useEffect(() => {
    if (!selectedCorner) {
      setIsZoomedIn(false);
    }
  }, [selectedCorner]);

  useEffect(() => {
    if (selectedCorner) {
      setRoofSelected(false);
    }
  }, [selectedCorner]);

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
  const latestLoggedWashDate = car.carWashLogs?.[0]?.date ?? null;
  const carWashDate =
    car.renewals?.carWash && latestLoggedWashDate
      ? car.renewals.carWash >= latestLoggedWashDate
        ? car.renewals.carWash
        : latestLoggedWashDate
      : car.renewals?.carWash ?? latestLoggedWashDate;
  const insuranceCountdown = getRenewalCountdown(insuranceDate);
  const cartaxCountdown = getRenewalCountdown(cartaxDate);
  const carWashDays = carWashDate ? getDaysSince(carWashDate) : null;
  const isCarWashOverdue = carWashDays !== null ? carWashDays > 21 : false;
  const isCarDirty = carWashDays !== null ? carWashDays > 42 : false;

  useEffect(() => {
    if (!isCarDirty) return;
    if (dirtyCutoutUrls[car.id]) return;
    if (car.id === 'slk250' && !cutoutUrls.slk250) return;

    let active = true;
    const baseSrc = car.id === 'slk250' ? cutoutUrls.slk250! : SOURCE_IMAGES[car.id];
    processDirtyCarAsset(car.id, baseSrc)
      .then((dirtyUrl) => {
        if (active) {
          setDirtyCutoutUrls((prev) => ({ ...prev, [car.id]: dirtyUrl }));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [car.id, isCarDirty, cutoutUrls.slk250, dirtyCutoutUrls]);

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
  const isPressureLogOverdue = latestLog ? getDaysSince(latestLog.date) >= 13 : true;

  const isEntryCornerRed = (
    entry: CarProfile['pressureLogs'][number],
    corner: TyreCorner
  ): boolean => {
    if (entry.lowTyre?.corner === corner) return true;
    const reading = entry.beforePressures?.[corner] ?? entry.pressures[corner];
    const standard = car.recommendedKpa[corner];
    return standard - reading >= 40;
  };

  const hasRepeatedRedAlert = (corner: TyreCorner): boolean =>
    car.pressureLogs.length >= 2 &&
    isEntryCornerRed(car.pressureLogs[0], corner) &&
    isEntryCornerRed(car.pressureLogs[1], corner);

  const getCornerRingState = (corner: TyreCorner): 'red' | 'orange' | 'green' => {
    if (!latestLog) return 'orange';
    if (isEntryCornerRed(latestLog, corner)) return 'red';

    const reading =
      latestLog.beforePressures?.[corner] ?? latestLog.pressures[corner];
    const standard = car.recommendedKpa[corner];
    const drop = standard - reading;

    if (drop <= 15) return 'green';
    return 'orange';
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
          onClick={() => setIsZoomedIn(false)}
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
            {dirtyCutoutUrls[car.id] && (
              <img
                src={dirtyCutoutUrls[car.id]}
                alt=""
                aria-hidden="true"
                className={`absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-300 ${
                  isCarDirty && !isZoomed ? 'opacity-100' : 'opacity-0'
                }`}
              />
            )}

            {/* Interactive Wheel Hotspots */}
            {spots.map((spot) => {
              const isSelected = selectedCorner === spot.corner;
              const ringState = getCornerRingState(spot.corner);
              const ambientHotspotTone: 'red' | 'blue' | null = isSelected
                ? null
                : hasRepeatedRedAlert(spot.corner)
                  ? 'red'
                  : isPressureLogOverdue
                    ? 'blue'
                    : null;
              const isLeftSide = spot.corner === 'FL' || spot.corner === 'RL';
              const pulseConfig =
                ringState === 'green'
                  ? {
                      borderColor: ['#166534', '#228B4E', '#166534'],
                      backgroundColor: [
                        'rgba(22, 101, 52, 0.22)',
                        'rgba(34, 139, 78, 0.30)',
                        'rgba(22, 101, 52, 0.22)',
                      ],
                      boxShadow: [
                        '0 0 11px rgba(22, 101, 52, 0.32)',
                        '0 0 16px rgba(22, 101, 52, 0.46)',
                        '0 0 11px rgba(22, 101, 52, 0.32)',
                      ],
                      scale: [1.03, 1.055, 1.03],
                      duration: 2.3,
                    }
                  : ringState === 'orange'
                    ? {
                        borderColor: ['#F97316', '#FB923C', '#F97316'],
                        backgroundColor: [
                          'rgba(249, 115, 22, 0.22)',
                          'rgba(251, 146, 60, 0.30)',
                          'rgba(249, 115, 22, 0.22)',
                        ],
                        boxShadow: [
                          '0 0 11px rgba(249, 115, 22, 0.34)',
                          '0 0 16px rgba(251, 146, 60, 0.48)',
                          '0 0 11px rgba(249, 115, 22, 0.34)',
                        ],
                        scale: [1.03, 1.055, 1.03],
                        duration: 2.2,
                      }
                    : {
                        borderColor: ['#B91C1C', '#EF4444', '#B91C1C'],
                        backgroundColor: [
                          'rgba(185, 28, 28, 0.24)',
                          'rgba(239, 68, 68, 0.38)',
                          'rgba(185, 28, 28, 0.24)',
                        ],
                        boxShadow: [
                          '0 0 14px rgba(185, 28, 28, 0.45)',
                          '0 0 26px rgba(239, 68, 68, 0.74)',
                          '0 0 14px rgba(185, 28, 28, 0.45)',
                        ],
                        scale: [1.04, 1.12, 1.04],
                        duration: 1.45,
                      };
              const outerGlowBg =
                ambientHotspotTone === 'red'
                  ? `radial-gradient(ellipse 92% 64% at ${isLeftSide ? '88%' : '12%'} 50%, rgba(220, 38, 38, 0.36) 0%, rgba(239, 68, 68, 0.18) 42%, rgba(239, 68, 68, 0.05) 70%, rgba(239, 68, 68, 0) 90%)`
                  : `radial-gradient(ellipse 92% 64% at ${isLeftSide ? '88%' : '12%'} 50%, rgba(78, 106, 148, 0.42) 0%, rgba(92, 118, 157, 0.22) 42%, rgba(92, 118, 157, 0.06) 70%, rgba(92, 118, 157, 0) 90%)`;
              const innerGlowBg =
                ambientHotspotTone === 'red'
                  ? `radial-gradient(ellipse 88% 66% at ${isLeftSide ? '88%' : '12%'} 50%, rgba(239, 68, 68, 0.56) 0%, rgba(220, 38, 38, 0.24) 55%, rgba(220, 38, 38, 0) 92%)`
                  : `radial-gradient(ellipse 88% 66% at ${isLeftSide ? '88%' : '12%'} 50%, rgba(78, 106, 148, 0.62) 0%, rgba(92, 118, 157, 0.28) 55%, rgba(92, 118, 157, 0) 92%)`;
              return (
                <button
                  key={spot.corner}
                  type="button"
                  onClick={() => {
                    if (isZoomed) {
                      setIsZoomedIn(false);
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
                  {ambientHotspotTone && (
                    <span
                      aria-hidden="true"
                      style={{
                        maskImage: isLeftSide
                          ? 'linear-gradient(to left, transparent 0%, rgba(0,0,0,0.45) 14%, black 34%, black 100%)'
                          : 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 14%, black 34%, black 100%)',
                        WebkitMaskImage: isLeftSide
                          ? 'linear-gradient(to left, transparent 0%, rgba(0,0,0,0.45) 14%, black 34%, black 100%)'
                          : 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 14%, black 34%, black 100%)',
                      }}
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 w-14 h-20 flex items-center ${
                        isLeftSide ? 'right-[22px] justify-end' : 'left-[22px] justify-start'
                      }`}
                    >
                      <motion.span
                        key={`${spot.corner}-outer-${ambientHotspotTone}`}
                        animate={
                          ambientHotspotTone === 'blue'
                            ? {
                                opacity: [0.88, 1, 0.88],
                                scale: [0.985, 1.015, 0.985],
                              }
                            : {
                                opacity: [0.72, 1, 0.72],
                                scale: [0.95, 1.07, 0.95],
                              }
                        }
                        transition={{
                          duration: ambientHotspotTone === 'blue' ? 3.4 : 2.1,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        style={{
                          background: outerGlowBg,
                          transformOrigin: isLeftSide ? 'right center' : 'left center',
                        }}
                        className={`w-14 h-20 blur-[2.5px] ${
                          isLeftSide ? 'rounded-l-full rounded-r-md' : 'rounded-r-full rounded-l-md'
                        }`}
                      />
                      <motion.span
                        key={`${spot.corner}-inner-${ambientHotspotTone}`}
                        animate={
                          ambientHotspotTone === 'blue'
                            ? {
                                opacity: [0.9, 1, 0.9],
                                scale: [0.985, 1.015, 0.985],
                              }
                            : {
                                opacity: [0.78, 1, 0.78],
                                scale: [0.95, 1.06, 0.95],
                              }
                        }
                        transition={{
                          duration: ambientHotspotTone === 'blue' ? 3.4 : 2.1,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        style={{
                          background: innerGlowBg,
                          transformOrigin: isLeftSide ? 'right center' : 'left center',
                        }}
                        className={`absolute w-7 h-12 blur-[1.5px] ${
                          isLeftSide
                            ? 'right-[2px] rounded-l-full rounded-r-sm'
                            : 'left-[2px] rounded-r-full rounded-l-sm'
                        }`}
                      />
                    </span>
                  )}
                  {isSelected ? (
                    <motion.span
                      key={`${spot.corner}-${ringState}`}
                      animate={{
                        borderColor: pulseConfig.borderColor,
                        backgroundColor: pulseConfig.backgroundColor,
                        boxShadow: pulseConfig.boxShadow,
                        scale: pulseConfig.scale,
                      }}
                      transition={{
                        duration: pulseConfig.duration,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="relative z-10 w-7 h-12 rounded-xl border-2"
                    />
                  ) : (
                    <span className="relative z-10 w-7 h-12 rounded-xl transition-all duration-150 bg-transparent group-hover:ring-1 group-hover:ring-black/25 group-hover:bg-black/5" />
                  )}
                </button>
              );
            })}

            {/* Interactive Center Roof Hotspot for Insurance, Car Tax & SLK Coolant */}
            {!isZoomed && (
              <button
                type="button"
                onClick={() => {
                  if (selectedCorner) {
                    onSelectCorner(null);
                    setRoofSelected(true);
                    return;
                  }
                  setRoofSelected((prev) => !prev);
                }}
                aria-label={
                  car.id === 'slk250'
                    ? 'Toggle insurance, car tax, coolant, and car wash dates'
                    : 'Toggle insurance, car tax, and car wash dates'
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

          {/* Front Plate, Insurance, Car Tax, Coolant (left) & Car Wash (right) Pop-Ups */}
          <AnimatePresence>
            {roofSelected && !isZoomed && !selectedCorner && (
              <>
                <motion.div
                  key={`${car.id}-plate`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 2 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    top: car.id === 'slk250' ? '5%' : '6%',
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
                    initial={{ opacity: 0, x: 4, y: -4 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, x: 3, y: -2 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      top: '87%',
                      right: 'calc(74% + 10px)',
                    }}
                    className="absolute -translate-y-1/2 z-10 text-right w-max max-w-[125px] sm:max-w-[175px]"
                  >
                    <button
                      type="button"
                      onClick={() => openEditRenewal('coolant', coolantDate)}
                      aria-label={`Edit coolant last entry date (${formatRenewalDate(coolantDate)})`}
                      className="group text-right space-y-0.5 cursor-pointer focus:outline-none"
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

                <motion.div
                  key={`${car.id}-carwash`}
                  initial={{ opacity: 0, x: -4, y: -4 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: -3, y: -2 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    top: '87%',
                    left: 'calc(74% + 10px)',
                  }}
                  className="absolute -translate-y-1/2 z-10 text-left w-max max-w-[125px] sm:max-w-[175px]"
                >
                  <button
                    type="button"
                    onClick={() => openEditRenewal('carWash', carWashDate ?? getTodayIso())}
                    aria-label={
                      carWashDate
                        ? `Edit car wash date (${formatRenewalDate(carWashDate)})`
                        : 'Enter car wash date'
                    }
                    className="group text-left space-y-0.5 cursor-pointer focus:outline-none"
                  >
                    <p
                      className={`font-display text-[13px] sm:text-sm font-medium leading-tight ${
                        isCarWashOverdue ? 'text-[#B91C1C]' : 'text-[#2A2E33]'
                      }`}
                    >
                      Car Wash
                    </p>
                    <p
                      className={`font-sans text-[11px] sm:text-xs group-active:scale-[0.98] transition-colors whitespace-nowrap leading-tight ${
                        isCarWashOverdue
                          ? 'font-semibold text-[#B91C1C] group-hover:text-[#991B1B]'
                          : 'font-normal text-[#5E646A] group-hover:text-[#4E6A94]'
                      }`}
                    >
                      {carWashDate ? formatRenewalDate(carWashDate) : 'Enter date'}
                    </p>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Borderless Text Pop-Up Next to Selected Wheel: Click to zoom in */}
          <AnimatePresence>
            {activeSpot && !isZoomed && !roofSelected && (
              <motion.div
                key={`${car.id}-${activeSpot.corner}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setRoofSelected(false);
                  setIsZoomedIn(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setRoofSelected(false);
                    setIsZoomedIn(true);
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
                className={`absolute -translate-y-1/2 z-10 w-max max-w-[116px] sm:max-w-[185px] space-y-0.5 cursor-pointer focus:outline-none ${
                  activeSpot.corner === 'FL' || activeSpot.corner === 'RL'
                    ? 'text-right'
                    : 'text-left'
                }`}
              >
                {selectedInfo ? (
                  <>
                    <p className="font-display text-[13px] sm:text-[14px] font-medium text-[#111315] leading-tight">
                      <WaveEnlargeText text={selectedInfo.brandModel} />
                    </p>
                    {selectedSize && (
                      <p className="font-mono text-[11px] sm:text-[12px] font-normal text-[#5E646A] leading-tight">
                        <WaveEnlargeText text={selectedSize} />
                      </p>
                    )}
                    {selectedUnitPrice !== null && (
                      <p className="font-mono text-[12px] sm:text-[13px] font-medium text-[#FF5A1F] tabular-nums leading-tight">
                        <WaveEnlargeText text={formatPrice(selectedUnitPrice)} />
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {selectedSize && (
                      <p className="font-mono text-[11px] sm:text-[12px] font-normal text-[#5E646A] leading-tight">
                        <WaveEnlargeText text={selectedSize} />
                      </p>
                    )}
                    <p className="text-[11px] sm:text-[12px] font-normal text-[#8C9298] leading-tight">
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
      <AnimatePresence mode="wait">
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
              transition: { duration: 0.14, ease: 'easeOut' },
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
                  onClick={() => setIsZoomedIn(false)}
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
                        : editingField === 'carWash'
                          ? 'Car Wash'
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
                  {editingField === 'carWash'
                    ? 'Last wash date'
                    : editingField === 'coolant'
                      ? 'Last entry date'
                      : 'Renewal date'}
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

              {editingField === 'carWash' && (car.carWashLogs?.length ?? 0) > 0 && (
                <div className="pt-3 border-t border-black/8 space-y-2">
                  <p className="text-[11px] font-medium text-[#5E646A]">
                    Recent washes
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
                    {car.carWashLogs!.slice(0, 6).map((wash) => (
                      <div
                        key={wash.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-[#F3F4F2] text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[#111315] truncate">
                            {wash.location}
                          </p>
                          <p className="text-[11px] font-mono text-[#5E646A] tabular-nums">
                            {formatRenewalDate(wash.date)} · {formatPrice(wash.price)}
                          </p>
                        </div>
                        {onDeleteCarWashLog && (
                          <button
                            type="button"
                            onClick={() => onDeleteCarWashLog(wash.id)}
                            aria-label={`Delete car wash on ${wash.date}`}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[#9AA0A6] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
