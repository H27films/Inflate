import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
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

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

export const ArcDatePicker: React.FC<ArcDatePickerProps> = ({
  value,
  onChange,
  label,
  buttonClassName,
  ariaLabel,
}) => {
  const headingId = useId();
  const prefersReducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [showMonthGrid, setShowMonthGrid] = useState(false);

  const normalizedValue = useMemo(() => normalizeIsoDate(value), [value]);
  const [viewYear, setViewYear] = useState(() => parseLocalDate(normalizedValue).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parseLocalDate(normalizedValue).getMonth());

  const openPicker = useCallback(() => {
    const dt = parseLocalDate(normalizedValue);
    setViewYear(dt.getFullYear());
    setViewMonth(dt.getMonth());
    setShowMonthGrid(false);
    setIsOpen(true);
  }, [normalizedValue]);

  const closePicker = useCallback(() => {
    setIsOpen(false);
    setShowMonthGrid(false);
  }, []);

  const stepMonth = useCallback((delta: number) => {
    setViewMonth((prevMonth) => {
      const nextTotal = prevMonth + delta;
      if (nextTotal < 0) {
        setViewYear((y) => Math.max(1990, y - 1));
        return 11;
      }
      if (nextTotal > 11) {
        setViewYear((y) => Math.min(2099, y + 1));
        return 0;
      }
      return nextTotal;
    });
  }, []);

  const handleSelectDay = useCallback(
    (dayNum: number) => {
      const nextIso = toIsoDate(new Date(viewYear, viewMonth, dayNum));
      onChange(nextIso);
      closePicker();
    },
    [closePicker, onChange, viewMonth, viewYear]
  );

  const handleSelectToday = useCallback(() => {
    const today = getTodayIso();
    onChange(today);
    closePicker();
  }, [closePicker, onChange]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePicker();
      } else if (e.key === 'ArrowLeft' && !showMonthGrid) {
        e.preventDefault();
        stepMonth(-1);
      } else if (e.key === 'ArrowRight' && !showMonthGrid) {
        e.preventDefault();
        stepMonth(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePicker, isOpen, showMonthGrid, stepMonth]);

  const formattedTrigger = useMemo(
    () => formatDisplayDate(normalizedValue),
    [normalizedValue]
  );

  const todayIso = getTodayIso();

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number; iso: string } | null> = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push({
        day: d,
        iso: toIsoDate(new Date(viewYear, viewMonth, d)),
      });
    }
    return cells;
  }, [viewMonth, viewYear]);

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-label={
          ariaLabel ||
          (label ? `${label}: ${formattedTrigger}` : `Select date: ${formattedTrigger}`)
        }
        className={
          buttonClassName ||
          'mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-xs font-mono text-[#111315] flex items-center justify-between gap-2 hover:border-black/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315] transition-colors cursor-pointer'
        }
      >
        <span className="truncate font-medium tabular-nums">{formattedTrigger}</span>
        <Calendar className="w-3.5 h-3.5 text-[#5E646A] shrink-0" />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                key="compact-date-picker-backdrop"
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={(e) => {
                  e.stopPropagation();
                  closePicker();
                }}
                className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6 bg-[#111315]/28 backdrop-blur-[3px]"
              >
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
                  transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-[312px] rounded-2xl bg-[#F2F1EE] text-[#111315] p-3.5 border border-black/8 shadow-[0_18px_42px_rgba(17,19,21,0.18)] select-none"
                >
                {/* Header: Month Year toggle + Today + Month steppers */}
                <div className="flex items-center justify-between gap-2 pb-2.5">
                  <button
                    id={headingId}
                    type="button"
                    onClick={() => setShowMonthGrid((prev) => !prev)}
                    aria-expanded={showMonthGrid}
                    className="inline-flex items-center gap-1 px-1 py-0.5 rounded-lg font-display text-[15px] font-medium tracking-tight text-[#111315] hover:bg-black/[0.04] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>
                      {MONTH_NAMES[viewMonth]} {viewYear}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#5E646A] transition-transform duration-150 ${
                        showMonthGrid ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectToday}
                      className="h-7 px-2 rounded-lg text-[11px] font-medium text-[#5E646A] hover:text-[#111315] hover:bg-white/80 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Today
                    </button>
                    {!showMonthGrid && (
                      <>
                        <button
                          type="button"
                          onClick={() => stepMonth(-1)}
                          aria-label="Previous month"
                          className="w-7 h-7 rounded-lg bg-white/85 hover:bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.04)] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => stepMonth(1)}
                          aria-label="Next month"
                          className="w-7 h-7 rounded-lg bg-white/85 hover:bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.04)] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {showMonthGrid ? (
                  /* Compact Year + 12-Month Grid */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-white rounded-[10px] px-2 py-1.5 shadow-[0_1px_2px_rgba(17,19,21,0.03)]">
                      <button
                        type="button"
                        onClick={() => setViewYear((y) => Math.max(1990, y - 1))}
                        aria-label="Previous year"
                        className="w-7 h-7 rounded-lg hover:bg-[#F2F1EE] flex items-center justify-center text-[#111315] cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-display text-sm font-semibold tabular-nums text-[#111315]">
                        {viewYear}
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewYear((y) => Math.min(2099, y + 1))}
                        aria-label="Next year"
                        className="w-7 h-7 rounded-lg hover:bg-[#F2F1EE] flex items-center justify-center text-[#111315] cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {MONTH_NAMES.map((mName, idx) => {
                        const isSelectedMonth = idx === viewMonth;
                        return (
                          <button
                            key={mName}
                            type="button"
                            onClick={() => {
                              setViewMonth(idx);
                              setShowMonthGrid(false);
                            }}
                            className={`h-9 rounded-[9px] text-xs font-medium transition-colors cursor-pointer ${
                              isSelectedMonth
                                ? 'bg-[#191A1C] text-white shadow-[0_3px_8px_rgba(17,19,21,0.16)]'
                                : 'bg-white text-[#111315] hover:bg-white/80 shadow-[0_1px_2px_rgba(17,19,21,0.03)]'
                            }`}
                          >
                            {mName.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Crisp White Vertical Tile Calendar Grid */
                  <div>
                    <div className="grid grid-cols-7 gap-1.5 mb-1">
                      {WEEKDAY_INITIALS.map((dayChar, idx) => (
                        <span
                          key={`${dayChar}-${idx}`}
                          className="text-center text-[10px] font-medium text-[#7C8085] leading-none py-0.5"
                        >
                          {dayChar}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1.5">
                      {calendarCells.map((cell, idx) => {
                        if (!cell) {
                          return <div key={`empty-${idx}`} className="h-[42px]" aria-hidden="true" />;
                        }

                        const isSelected = cell.iso === normalizedValue;
                        const isToday = cell.iso === todayIso;

                        return (
                          <button
                            key={cell.iso}
                            type="button"
                            onClick={() => handleSelectDay(cell.day)}
                            aria-label={formatDisplayDate(cell.iso)}
                            aria-pressed={isSelected}
                            className={`h-[42px] rounded-[9px] flex flex-col items-center justify-between pt-2 pb-1.5 text-[12.5px] font-medium tabular-nums transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315] ${
                              isSelected
                                ? 'bg-[#191A1C] text-white shadow-[0_4px_10px_rgba(17,19,21,0.2)]'
                                : 'bg-white text-[#111315] hover:bg-white/75 active:scale-[0.96] shadow-[0_1px_2px_rgba(17,19,21,0.03)]'
                            }`}
                          >
                            <span className="leading-none">{cell.day}</span>
                            {isSelected ? (
                              <span
                                aria-hidden="true"
                                className="w-1 h-1 rounded-full bg-white"
                              />
                            ) : isToday ? (
                              <span
                                aria-hidden="true"
                                className="w-1 h-1 rounded-full bg-[#FF5A1F]"
                              />
                            ) : (
                              <span aria-hidden="true" className="w-1 h-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
