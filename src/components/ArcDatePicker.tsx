import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw, X } from 'lucide-react';
import { formatDisplayDate, getTodayIso, parseLocalDate } from '../data/initialGarage';

interface ArcDatePickerProps {
  value: string;
  onChange: (nextIsoDate: string) => void;
  label?: string;
  buttonClassName?: string;
  ariaLabel?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const VISIBLE_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];

function toIsoDate(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeIsoDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = parseLocalDate(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return toIsoDate(parsed);
    }
  }
  return getTodayIso();
}

function addDaysToIso(iso: string, deltaDays: number): string {
  const dt = parseLocalDate(normalizeIsoDate(iso));
  dt.setDate(dt.getDate() + deltaDays);
  return toIsoDate(dt);
}

function addMonthsToIso(iso: string, deltaMonths: number): string {
  const dt = parseLocalDate(normalizeIsoDate(iso));
  const originalDay = dt.getDate();
  const targetYear = dt.getFullYear();
  const targetMonth = dt.getMonth() + deltaMonths;
  // Clamp to last day of target month cleanly
  const firstOfTarget = new Date(targetYear, targetMonth, 1);
  const daysInTargetMonth = new Date(
    firstOfTarget.getFullYear(),
    firstOfTarget.getMonth() + 1,
    0
  ).getDate();
  return toIsoDate(
    new Date(
      firstOfTarget.getFullYear(),
      firstOfTarget.getMonth(),
      Math.min(originalDay, daysInTargetMonth)
    )
  );
}

function setYearOfIso(iso: string, nextYear: number): string {
  const dt = parseLocalDate(normalizeIsoDate(iso));
  const clampedYear = Math.max(1990, Math.min(2099, nextYear));
  const daysInTargetMonth = new Date(clampedYear, dt.getMonth() + 1, 0).getDate();
  return toIsoDate(new Date(clampedYear, dt.getMonth(), Math.min(dt.getDate(), daysInTargetMonth)));
}

function setMonthOfIso(iso: string, nextMonthIndex: number): string {
  const dt = parseLocalDate(normalizeIsoDate(iso));
  const daysInTargetMonth = new Date(dt.getFullYear(), nextMonthIndex + 1, 0).getDate();
  return toIsoDate(
    new Date(dt.getFullYear(), nextMonthIndex, Math.min(dt.getDate(), daysInTargetMonth))
  );
}

// Smooth convex arc: center (0) sits highest (0px drop), outer edges drop smoothly
function getArcDropPx(offsetUnits: number): number {
  return Math.pow(offsetUnits, 2) * 2.55;
}

function getArcOpacity(offsetUnits: number): number {
  const abs = Math.abs(offsetUnits);
  if (abs >= 3.2) return 0.14;
  if (abs <= 0.1) return 1;
  if (abs <= 1) return 1 - abs * 0.16;
  if (abs <= 2) return 0.84 - (abs - 1) * 0.28;
  return Math.max(0.22, 0.56 - (abs - 2) * 0.28);
}

export const ArcDatePicker: React.FC<ArcDatePickerProps> = ({
  value,
  onChange,
  label,
  buttonClassName,
  ariaLabel,
}) => {
  const headingId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [draftIso, setDraftIso] = useState(() => normalizeIsoDate(value));
  const [showMonthMenu, setShowMonthMenu] = useState(false);
  const [monthAnimKey, setMonthAnimKey] = useState(0);
  const [monthDirection, setMonthDirection] = useState<1 | -1>(1);

  // Horizontal arc drag state (in pixels relative to current column snap)
  const [dragPx, setDragPx] = useState(0);
  const [isDraggingArc, setIsDraggingArc] = useState(false);

  const monthZoneRef = useRef<HTMLDivElement | null>(null);
  const arcTrackRef = useRef<HTMLDivElement | null>(null);
  const arcPointerRef = useRef<{
    pointerId: number | null;
    startX: number;
    lastX: number;
    moved: boolean;
    accumPx: number;
  }>({ pointerId: null, startX: 0, lastX: 0, moved: false, accumPx: 0 });

  const monthPointerRef = useRef<{
    pointerId: number | null;
    startY: number;
    accumY: number;
    moved: boolean;
  }>({ pointerId: null, startY: 0, accumY: 0, moved: false });

  const wheelLockRef = useRef<{ monthAccum: number; dayAccum: number }>({
    monthAccum: 0,
    dayAccum: 0,
  });

  const openPicker = useCallback(() => {
    setDraftIso(normalizeIsoDate(value));
    setShowMonthMenu(false);
    setDragPx(0);
    setIsOpen(true);
  }, [value]);

  const closePicker = useCallback(() => {
    setIsOpen(false);
    setShowMonthMenu(false);
    setDragPx(0);
    setIsDraggingArc(false);
  }, []);

  const commitDate = useCallback(
    (nextIso?: string) => {
      onChange(normalizeIsoDate(nextIso ?? draftIso));
      closePicker();
    },
    [closePicker, draftIso, onChange]
  );

  const stepMonth = useCallback((delta: number) => {
    if (delta === 0) return;
    setMonthDirection(delta > 0 ? 1 : -1);
    setMonthAnimKey((k) => k + 1);
    setDraftIso((prev) => addMonthsToIso(prev, delta));
  }, []);

  const stepDays = useCallback((delta: number) => {
    if (delta === 0) return;
    setDraftIso((prev) => addDaysToIso(prev, delta));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePicker();
      } else if (e.key === 'Enter' && !showMonthMenu) {
        e.preventDefault();
        commitDate();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepDays(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepDays(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        stepMonth(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        stepMonth(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePicker, commitDate, isOpen, showMonthMenu, stepDays, stepMonth]);

  useEffect(() => {
    if (!isOpen) return;
    const monthEl = monthZoneRef.current;
    const arcEl = arcTrackRef.current;

    const onMonthWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      wheelLockRef.current.monthAccum += e.deltaY;
      const threshold = 30;
      if (Math.abs(wheelLockRef.current.monthAccum) >= threshold) {
        const steps = Math.trunc(wheelLockRef.current.monthAccum / threshold);
        wheelLockRef.current.monthAccum -= steps * threshold;
        stepMonth(steps);
      }
    };

    const onArcWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const dominantDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      wheelLockRef.current.dayAccum += dominantDelta;
      const threshold = 24;
      if (Math.abs(wheelLockRef.current.dayAccum) >= threshold) {
        const steps = Math.trunc(wheelLockRef.current.dayAccum / threshold);
        wheelLockRef.current.dayAccum -= steps * threshold;
        stepDays(steps);
      }
    };

    monthEl?.addEventListener('wheel', onMonthWheelNative, { passive: false });
    arcEl?.addEventListener('wheel', onArcWheelNative, { passive: false });
    return () => {
      monthEl?.removeEventListener('wheel', onMonthWheelNative);
      arcEl?.removeEventListener('wheel', onArcWheelNative);
    };
  }, [isOpen, showMonthMenu, stepDays, stepMonth]);

  const draftDateObj = useMemo(() => parseLocalDate(draftIso), [draftIso]);
  const activeYear = draftDateObj.getFullYear();
  const activeMonthIndex = draftDateObj.getMonth();
  const activeMonthName = MONTH_NAMES[activeMonthIndex];
  const prevMonthName = MONTH_NAMES[(activeMonthIndex + 11) % 12];
  const nextMonthName = MONTH_NAMES[(activeMonthIndex + 1) % 12];
  const activeDayNumber = draftDateObj.getDate();

  const colWidthPx = useMemo(() => {
    if (!arcTrackRef.current) return 46;
    return Math.max(38, arcTrackRef.current.clientWidth / 7);
  }, [isOpen, isDraggingArc]);

  const fractionalShift = dragPx / colWidthPx;

  const dayColumns = useMemo(() => {
    return VISIBLE_OFFSETS.map((offset) => {
      const dt = new Date(
        draftDateObj.getFullYear(),
        draftDateObj.getMonth(),
        draftDateObj.getDate() + offset
      );
      return {
        offset,
        iso: toIsoDate(dt),
        dayNum: dt.getDate(),
        weekday: WEEKDAY_SHORT[dt.getDay()],
      };
    });
  }, [draftDateObj]);

  // Month vertical drag/scroll handlers
  const handleMonthPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    monthPointerRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      accumY: 0,
      moved: false,
    };
  };

  const handleMonthPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = monthPointerRef.current;
    if (state.pointerId !== e.pointerId) return;
    const dy = e.clientY - state.startY;
    if (Math.abs(dy) > 5) state.moved = true;
    const stepThreshold = 26;
    const deltaSinceLast = dy - state.accumY;
    if (Math.abs(deltaSinceLast) >= stepThreshold) {
      // Dragging up (negative deltaY) advances forward to next month; dragging down moves to prev month
      const steps = Math.trunc(-deltaSinceLast / stepThreshold);
      if (steps !== 0) {
        state.accumY += -steps * stepThreshold;
        stepMonth(steps);
      }
    }
  };

  const handleMonthPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = monthPointerRef.current;
    if (state.pointerId !== e.pointerId) return;
    monthPointerRef.current.pointerId = null;
    if (!state.moved) {
      setShowMonthMenu((prev) => !prev);
    }
  };

  // Horizontal arc drag/scroll handlers
  const handleArcPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    arcPointerRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      moved: false,
      accumPx: 0,
    };
    setIsDraggingArc(true);
  };

  const handleArcPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = arcPointerRef.current;
    if (state.pointerId !== e.pointerId) return;
    const stepW = arcTrackRef.current ? Math.max(38, arcTrackRef.current.clientWidth / 7) : 46;
    const totalDx = e.clientX - state.startX;
    if (Math.abs(totalDx) > 5) state.moved = true;

    const deltaFromLast = e.clientX - state.lastX;
    state.lastX = e.clientX;
    state.accumPx += deltaFromLast;

    // Swiping left (negative accumPx) moves forward (+1 day); swiping right moves backward (-1 day)
    while (state.accumPx <= -stepW) {
      state.accumPx += stepW;
      stepDays(1);
    }
    while (state.accumPx >= stepW) {
      state.accumPx -= stepW;
      stepDays(-1);
    }
    setDragPx(state.accumPx);
  };

  const handleArcPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = arcPointerRef.current;
    if (state.pointerId !== e.pointerId) return;
    const stepW = arcTrackRef.current ? Math.max(38, arcTrackRef.current.clientWidth / 7) : 46;
    if (state.moved) {
      if (state.accumPx <= -stepW * 0.42) {
        stepDays(1);
      } else if (state.accumPx >= stepW * 0.42) {
        stepDays(-1);
      }
    }
    arcPointerRef.current.pointerId = null;
    setDragPx(0);
    setIsDraggingArc(false);
  };

  const formattedTrigger = useMemo(() => {
    const norm = normalizeIsoDate(value);
    return formatDisplayDate(norm);
  }, [value]);

  const todayIso = getTodayIso();
  const isTodaySelected = draftIso === todayIso;

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-label={ariaLabel || (label ? `${label}: ${formattedTrigger}` : `Select date: ${formattedTrigger}`)}
        className={
          buttonClassName ||
          'mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-xs font-mono text-[#111315] flex items-center justify-between gap-2 hover:border-black/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315] transition-colors cursor-pointer'
        }
      >
        <span className="truncate font-medium tabular-nums">{formattedTrigger}</span>
        <Calendar className="w-3.5 h-3.5 text-[#5E646A] shrink-0" />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            onClick={(e) => {
              e.stopPropagation();
              closePicker();
            }}
            className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6 bg-[#111315]/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[360px] rounded-[28px] overflow-hidden bg-gradient-to-br from-[#2C313B] via-[#1C2027] to-[#111315] text-white border border-white/15 shadow-[0_28px_64px_-12px_rgba(17,19,21,0.65),inset_0_1px_0_rgba(255,255,255,0.22)] select-none"
            >
              {/* Subtle ambient slate glow mimicking frosted glass depth */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-40 rounded-full bg-[#4E6A94]/25 blur-3xl"
              />

              {/* Top Utility Strip: Label + Year Stepper + Close */}
              <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-1">
                <div className="flex items-center gap-2">
                  <span id={headingId} className="text-[11px] font-medium text-white/55">
                    {label || 'Select date'}
                  </span>
                  <span aria-hidden="true" className="text-white/25 text-[11px]">
                    ·
                  </span>
                  <div className="inline-flex items-center gap-0.5 rounded-full bg-white/[0.08] border border-white/10 px-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => setDraftIso((prev) => setYearOfIso(prev, activeYear - 1))}
                      aria-label="Previous year"
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <span className="px-1 text-[11px] font-mono font-semibold tabular-nums text-white/90">
                      {activeYear}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDraftIso((prev) => setYearOfIso(prev, activeYear + 1))}
                      aria-label="Next year"
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closePicker}
                  aria-label="Close date picker"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/18 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Hero Month (Vertical Scroller) & Day Readout */}
              <div className="relative z-10 flex items-center justify-between gap-3 px-6 pt-2 pb-4">
                <div
                  ref={monthZoneRef}
                  onPointerDown={handleMonthPointerDown}
                  onPointerMove={handleMonthPointerMove}
                  onPointerUp={handleMonthPointerUp}
                  onPointerCancel={() => {
                    monthPointerRef.current.pointerId = null;
                  }}
                  role="spinbutton"
                  aria-label="Month, scroll up or down to change"
                  aria-valuenow={activeMonthIndex + 1}
                  aria-valuemin={1}
                  aria-valuemax={12}
                  aria-valuetext={activeMonthName}
                  tabIndex={0}
                  className="group relative flex-1 min-w-0 py-1 touch-none cursor-ns-resize focus:outline-none"
                >
                  {/* Subtle previous month above (clickable) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      stepMonth(-1);
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-white/35 hover:text-white/80 transition-colors mb-0.5 cursor-pointer"
                  >
                    <ChevronUp className="w-3 h-3" />
                    <span>{prevMonthName}</span>
                  </button>

                  {/* Active Hero Month Display with Vertical Slide */}
                  <div className="relative h-[46px] sm:h-[50px] overflow-hidden flex items-center">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={`${monthAnimKey}-${activeMonthName}`}
                        initial={{ y: monthDirection * 18, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -monthDirection * 18, opacity: 0 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        className="font-display text-[38px] sm:text-[42px] leading-[1.05] font-semibold tracking-tight text-white truncate block"
                      >
                        {activeMonthName}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  {/* Subtle next month below (clickable) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      stepMonth(1);
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-white/32 hover:text-white/75 transition-colors mt-0.5 cursor-pointer"
                  >
                    <ChevronDown className="w-3 h-3" />
                    <span>{nextMonthName}</span>
                  </button>
                </div>

                {/* Large Synchronized Day Number */}
                <div className="shrink-0 text-right">
                  <span className="font-display text-[46px] sm:text-[50px] leading-none font-semibold tabular-nums tracking-tight text-white">
                    {activeDayNumber}
                  </span>
                </div>
              </div>

              {/* Optional Quick 12-Month Grid / Vertical Picker Drawer when user taps Month text */}
              {showMonthMenu ? (
                <div className="relative z-10 px-5 pb-4">
                  <div className="rounded-2xl bg-white/[0.07] border border-white/12 p-2 max-h-[154px] overflow-y-auto no-scrollbar grid grid-cols-3 gap-1.5">
                    {MONTH_NAMES.map((mName, idx) => {
                      const isCurrent = idx === activeMonthIndex;
                      return (
                        <button
                          key={mName}
                          type="button"
                          onClick={() => {
                            setDraftIso((prev) => setMonthOfIso(prev, idx));
                            setShowMonthMenu(false);
                          }}
                          className={`h-9 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-[#FF5A1F] text-white font-semibold shadow-sm'
                              : 'text-white/75 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {mName.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Curved Arc Horizontal Day Scroller */
                <div
                  ref={arcTrackRef}
                  onPointerDown={handleArcPointerDown}
                  onPointerMove={handleArcPointerMove}
                  onPointerUp={handleArcPointerUp}
                  onPointerCancel={() => {
                    arcPointerRef.current.pointerId = null;
                    setDragPx(0);
                    setIsDraggingArc(false);
                  }}
                  role="slider"
                  aria-label="Day scroller, drag left or right to choose day"
                  aria-valuenow={activeDayNumber}
                  aria-valuemin={1}
                  aria-valuemax={31}
                  tabIndex={0}
                  className="relative z-10 h-[136px] w-full touch-none cursor-grab active:cursor-grabbing overflow-hidden"
                >
                  {/* Curved Translucent Band Track (SVG matches arc drop curve seamlessly) */}
                  <svg
                    viewBox="0 0 360 120"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 w-full h-full"
                  >
                    <defs>
                      <linearGradient id="arc-band-fill" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                        <stop offset="22%" stopColor="rgba(255,255,255,0.08)" />
                        <stop offset="50%" stopColor="rgba(255,255,255,0.12)" />
                        <stop offset="78%" stopColor="rgba(255,255,255,0.08)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                      </linearGradient>
                      <linearGradient id="arc-band-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                        <stop offset="25%" stopColor="rgba(255,255,255,0.2)" />
                        <stop offset="50%" stopColor="rgba(255,255,255,0.32)" />
                        <stop offset="75%" stopColor="rgba(255,255,255,0.2)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                      </linearGradient>
                    </defs>
                    {/* Subtle arched ribbon centered behind the day numbers */}
                    <path
                      d="M 0 64 Q 180 28 360 64 L 360 112 Q 180 76 0 112 Z"
                      fill="url(#arc-band-fill)"
                    />
                    <path
                      d="M 0 64 Q 180 28 360 64"
                      fill="none"
                      stroke="url(#arc-band-stroke)"
                      strokeWidth="1"
                    />
                    <path
                      d="M 0 112 Q 180 76 360 112"
                      fill="none"
                      stroke="url(#arc-band-stroke)"
                      strokeWidth="1"
                    />
                  </svg>

                  {/* 7 Day Columns Positioned Along Convex Arc */}
                  <div className="relative h-full w-full">
                    {dayColumns.map((col) => {
                      const effectiveOffset = col.offset + fractionalShift;
                      const dropPx = getArcDropPx(effectiveOffset);
                      const opacity = getArcOpacity(effectiveOffset);
                      const leftPct = 50 + effectiveOffset * (100 / 7);
                      const isCenter = col.offset === 0 && Math.abs(fractionalShift) < 0.35;

                      return (
                        <button
                          key={col.iso}
                          type="button"
                          onClick={() => {
                            if (arcPointerRef.current.moved) return;
                            setDraftIso(col.iso);
                          }}
                          style={{
                            left: `${leftPct}%`,
                            transform: `translate(-50%, ${dropPx}px)`,
                            opacity,
                          }}
                          className={`absolute top-2.5 flex flex-col items-center justify-start w-12 py-1 focus:outline-none cursor-pointer ${
                            isDraggingArc ? '' : 'transition-[transform,opacity] duration-150 ease-out'
                          }`}
                        >
                          <span
                            className={`text-[11px] leading-none mb-3.5 tracking-wide ${
                              isCenter ? 'text-white font-semibold' : 'text-white/75 font-medium'
                            }`}
                          >
                            {col.weekday}
                          </span>

                          <span
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-display text-[15px] tabular-nums transition-colors ${
                              isCenter
                                ? 'bg-[#FF5A1F] text-white font-bold shadow-[0_6px_18px_rgba(255,90,31,0.45)]'
                                : 'text-white font-medium hover:bg-white/10'
                            }`}
                          >
                            {col.dayNum}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bottom Action Bar */}
              <div className="relative z-10 flex items-center justify-between gap-3 px-5 py-3.5 border-t border-white/10 bg-black/20">
                <button
                  type="button"
                  onClick={() => setDraftIso(todayIso)}
                  disabled={isTodaySelected}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-white/75 hover:text-white hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Today</span>
                </button>

                <button
                  type="button"
                  onClick={() => commitDate()}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-[#111315] text-xs font-semibold shadow-sm hover:bg-[#F3F4F2] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Set date</span>
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </>
  );
};
