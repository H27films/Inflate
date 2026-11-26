import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronUp, ChevronDown, Plus, MapPin, Trash2, X, AlertTriangle, Maximize2, Minimize2, LocateFixed, Loader2 } from 'lucide-react';
import {
  CarProfile,
  CORNER_LABELS,
  CornerPressures,
  PressureLogEntry,
  TYRE_CORNERS,
  TyreCorner,
} from '../types';
import {
  detectCurrentLocationName,
  formatCompactMonthDay,
  formatDaysAgoLabel,
  formatDaysBetween,
  formatDisplayDate,
  formatRelativeDays,
  getTodayIso,
} from '../data/initialGarage';

interface PressureLogSheetProps {
  car: CarProfile;
  expanded: boolean;
  onToggleExpanded: (next: boolean) => void;
  onAddLog: (entry: Omit<PressureLogEntry, 'id'>) => void;
  onEditLog: (id: string, entry: Omit<PressureLogEntry, 'id'>) => void;
  onDeleteLog: (id: string) => void;
}

const PREVIEW_LIMIT = 5;

export function PressureLogSheet({
  car,
  expanded,
  onToggleExpanded,
  onAddLog,
  onEditLog,
  onDeleteLog,
}: PressureLogSheetProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const latestLog = car.pressureLogs[0] ?? null;

  const [date, setDate] = useState(getTodayIso());
  const [station, setStation] = useState('');
  const [detectingLoc, setDetectingLoc] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [beforeInputs, setBeforeInputs] = useState<Record<TyreCorner, string>>({
    FL: '',
    FR: '',
    RL: '',
    RR: '',
  });
  const [lowCorner, setLowCorner] = useState<TyreCorner | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!expanded) {
      setShowAllEntries(false);
      setShowAddForm(false);
      setEditingId(null);
    }
  }, [expanded]);

  useEffect(() => {
    setShowAllEntries(false);
    setShowAddForm(false);
    setEditingId(null);
  }, [car.id]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setDate(getTodayIso());
    setStation('');
    setLocError(null);
    setDetectingLoc(false);
    setBeforeInputs({ FL: '', FR: '', RL: '', RR: '' });
    setLowCorner(null);
    setNote('');
    setShowAddForm(true);
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEdit = (entry: PressureLogEntry) => {
    setEditingId(entry.id);
    setDate(entry.date);
    setStation(entry.station ?? '');
    setLocError(null);
    setDetectingLoc(false);
    const lowFallbackCorner = entry.lowTyre?.corner;
    const lowFallbackVal = entry.lowTyre?.beforeKpa;
    setBeforeInputs({
      FL:
        entry.beforePressures?.FL !== undefined
          ? String(entry.beforePressures.FL)
          : lowFallbackCorner === 'FL' && lowFallbackVal !== undefined
            ? String(lowFallbackVal)
            : '',
      FR:
        entry.beforePressures?.FR !== undefined
          ? String(entry.beforePressures.FR)
          : lowFallbackCorner === 'FR' && lowFallbackVal !== undefined
            ? String(lowFallbackVal)
            : '',
      RL:
        entry.beforePressures?.RL !== undefined
          ? String(entry.beforePressures.RL)
          : lowFallbackCorner === 'RL' && lowFallbackVal !== undefined
            ? String(lowFallbackVal)
            : '',
      RR:
        entry.beforePressures?.RR !== undefined
          ? String(entry.beforePressures.RR)
          : lowFallbackCorner === 'RR' && lowFallbackVal !== undefined
            ? String(lowFallbackVal)
            : '',
    });
    setLowCorner(entry.lowTyre?.corner ?? null);
    setNote(entry.note ?? '');
    setShowAddForm(true);
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRequestLocation = async () => {
    if (detectingLoc) return;
    setLocError(null);
    setDetectingLoc(true);
    try {
      const place = await detectCurrentLocationName();
      setStation(place);
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Unable to detect location.');
    } finally {
      setDetectingLoc(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const beforePressures: Partial<CornerPressures> = {};
    TYRE_CORNERS.forEach((corner) => {
      const parsed = Number(beforeInputs[corner]);
      if (Number.isFinite(parsed) && parsed > 0) {
        beforePressures[corner] = Math.round(parsed);
      }
    });

    const resolvedLowBefore = lowCorner ? beforePressures[lowCorner] : undefined;

    const payload: Omit<PressureLogEntry, 'id'> = {
      date,
      pressures: { ...car.recommendedKpa },
      beforePressures:
        Object.keys(beforePressures).length > 0 ? beforePressures : undefined,
      source: 'manual',
      station: station.trim() || undefined,
      lowTyre:
        lowCorner !== null
          ? resolvedLowBefore !== undefined
            ? { corner: lowCorner, beforeKpa: resolvedLowBefore }
            : { corner: lowCorner }
          : undefined,
      note: note.trim() || undefined,
    };

    if (editingId) {
      onEditLog(editingId, payload);
    } else {
      onAddLog(payload);
    }
    setEditingId(null);
    setShowAddForm(false);
  };

  const hasMoreThanLimit = car.pressureLogs.length > PREVIEW_LIMIT;
  const visibleLogs =
    showAllEntries || !hasMoreThanLimit
      ? car.pressureLogs
      : car.pressureLogs.slice(0, PREVIEW_LIMIT);
  const remainingCount = Math.max(0, car.pressureLogs.length - PREVIEW_LIMIT);

  const expandedSheetClassName = showAllEntries
    ? 'fixed inset-x-0 top-2 bottom-0 z-45 bg-white rounded-t-3xl border-t border-black/8 shadow-[0_-16px_48px_rgba(17,19,21,0.18)] flex flex-col pb-28 lg:inset-x-0 lg:top-12 lg:bottom-4 lg:max-w-2xl lg:mx-auto lg:rounded-3xl lg:border lg:shadow-2xl lg:pb-0'
    : 'fixed inset-x-0 bottom-0 z-35 bg-white rounded-t-3xl border-t border-black/8 shadow-[0_-16px_48px_rgba(17,19,21,0.14)] max-h-[72dvh] flex flex-col pb-28 lg:inset-x-0 lg:bottom-28 lg:max-w-xl lg:mx-auto lg:rounded-3xl lg:border lg:shadow-2xl lg:max-h-[560px] lg:pb-0';

  return (
    <>
      {/* Compact Modern Rounded Gradient Summary Card */}
      <section
        aria-label="Tyre pressure log summary"
        className="relative w-full bg-gradient-to-br from-[#272B33] via-[#1B1E24] to-[#121418] text-white rounded-3xl ring-1 ring-inset ring-white/12 shadow-[0_12px_28px_-6px_rgba(17,19,21,0.32),0_2px_8px_rgba(17,19,21,0.14)] overflow-hidden shrink-0"
      >
        <button
          type="button"
          onClick={() => onToggleExpanded(true)}
          className="w-full text-left px-4 py-2.5 cursor-pointer hover:bg-white/[0.04] active:scale-[0.995] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 shrink-0"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 className="font-display text-[15px] font-medium tracking-tight text-white leading-none shrink-0">
                Pressure Log
              </h2>
              {latestLog && (
                <span className="font-sans text-xs font-light text-white/60 tabular-nums truncate">
                  {formatDaysAgoLabel(latestLog.date)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-xs font-medium text-white/75 tabular-nums">
                {latestLog ? formatCompactMonthDay(latestLog.date) : 'No entries'}
              </span>
              <span className="w-7 h-7 rounded-full bg-white/[0.12] ring-1 ring-inset ring-white/15 flex items-center justify-center text-white/90 shrink-0">
                <ChevronUp className="w-4 h-4" />
              </span>
            </div>
          </div>
        </button>
      </section>

      {/* Smooth Backdrop + Symmetrical Slide-Up / Slide-Down Expanded Sheet */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="log-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => onToggleExpanded(false)}
            className={
              showAllEntries
                ? 'fixed inset-0 z-30 bg-black/35'
                : 'fixed inset-0 z-30 bg-black/25'
            }
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expanded && (
          <motion.section
            key="log-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            aria-label="Tyre pressure log history"
            className={expandedSheetClassName}
          >
            {/* Clean Expanded Header */}
            <div className="w-full px-4 py-3 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onToggleExpanded(false)}
                className="flex-1 min-w-0 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315] rounded-lg"
              >
                <h2 className="font-display text-base font-semibold text-[#111315]">
                  Pressure Log
                </h2>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                {latestLog && (
                  <span className="text-xs font-medium text-[#5E646A] tabular-nums mr-0.5">
                    {formatRelativeDays(latestLog.date)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  aria-label="Add pressure entry"
                  title="Add pressure entry"
                  className="w-8 h-8 rounded-full bg-[#111315] text-white hover:bg-black/85 active:scale-[0.96] transition-all flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleExpanded(false)}
                  aria-label="Collapse pressure log"
                  title="Collapse pressure log"
                  className="w-8 h-8 rounded-full bg-[#F3F4F2] flex items-center justify-center text-[#111315] hover:bg-black/[0.06] active:scale-[0.96] transition-all shrink-0 cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded History List */}
            <div
              ref={scrollBodyRef}
              className="border-t border-black/6 flex-1 overflow-y-auto px-4 py-3 space-y-3"
            >

              {showAddForm && (
                <form
                  onSubmit={handleSubmit}
                  className="p-3.5 rounded-2xl bg-[#F3F4F2] border border-black/7 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#111315]">
                      {editingId
                        ? 'Edit pressure entry'
                        : `New pressure entry (${car.recommendedKpa.FL}/${car.recommendedKpa.RL} kPa)`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingId(null);
                      }}
                      aria-label="Close form"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#5E646A] hover:bg-black/5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="block">
                      <span className="text-[11px] font-medium text-[#5E646A]">Date</span>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="mt-1 w-full h-10 px-2.5 rounded-xl bg-white border border-black/10 text-xs font-mono text-[#111315]"
                      />
                    </label>
                    <div>
                      <label htmlFor="sheet-log-location" className="text-[11px] font-medium text-[#5E646A]">
                        Location
                      </label>
                      <div className="mt-1 flex items-center gap-1.5">
                        <input
                          id="sheet-log-location"
                          type="text"
                          placeholder="e.g. Shell Air"
                          value={station}
                          onChange={(e) => setStation(e.target.value)}
                          className="flex-1 min-w-0 h-10 px-2.5 rounded-xl bg-white border border-black/10 text-xs text-[#111315]"
                        />
                        <button
                          type="button"
                          onClick={handleRequestLocation}
                          disabled={detectingLoc}
                          aria-label="Use current location"
                          title="Use current location"
                          className="w-10 h-10 rounded-xl bg-[#111315] text-white hover:bg-black/85 disabled:opacity-60 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          {detectingLoc ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <LocateFixed className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      {locError && (
                        <p className="mt-1 text-[10px] text-[#D9480F] leading-snug">
                          {locError}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-[#5E646A] block">
                      Previous readings before top-up (kPa, optional)
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {TYRE_CORNERS.map((corner) => (
                        <label key={corner} className="block">
                          <span className="text-[10px] font-mono text-[#5E646A]">{corner} prev</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={3}
                            placeholder="—"
                            value={beforeInputs[corner]}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
                              setBeforeInputs((prev) => ({
                                ...prev,
                                [corner]: digits,
                              }));
                            }}
                            className="mt-0.5 w-full h-9 px-2 rounded-lg bg-white border border-black/10 text-xs font-mono font-semibold tabular-nums text-[#111315] text-center"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-[#5E646A] block">
                      Flag low tyre before top-up (optional)
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {TYRE_CORNERS.map((corner) => {
                        const selected = lowCorner === corner;
                        return (
                          <button
                            key={corner}
                            type="button"
                            onClick={() => setLowCorner(selected ? null : corner)}
                            className={`h-9 rounded-lg font-mono text-xs font-semibold border transition-colors cursor-pointer ${
                              selected
                                ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                                : 'bg-white text-[#5E646A] border-black/10'
                            }`}
                          >
                            {corner}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-medium text-[#5E646A]">Note (optional)</span>
                    <input
                      type="text"
                      placeholder="Cold check"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="mt-1 w-full h-10 px-2.5 rounded-xl bg-white border border-black/10 text-xs text-[#111315]"
                    />
                  </label>

                  <button
                    type="submit"
                    className="w-full h-10 rounded-xl bg-[#111315] text-white text-xs font-semibold hover:bg-black/85 transition-colors cursor-pointer"
                  >
                    {editingId ? 'Update entry' : 'Save entry'}
                  </button>
                </form>
              )}

              {car.pressureLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#6B7075]">
                  No pressure logs yet. Tap Log below to record your top-up.
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-black/6">
                    {visibleLogs.map((entry, idx) => {
                      const trimmedNote = entry.note?.trim();
                      const isRedundantLowNote =
                        trimmedNote?.toLowerCase() === 'back left low';
                      const effectiveNote =
                        entry.lowTyre && isRedundantLowNote ? undefined : trimmedNote;

                      let lowWarningText: string | null = null;
                      if (entry.lowTyre) {
                        const baseText =
                          entry.lowTyre.beforeKpa !== undefined
                            ? `${CORNER_LABELS[entry.lowTyre.corner]} was ${entry.lowTyre.beforeKpa} kPa`
                            : `${CORNER_LABELS[entry.lowTyre.corner]} was low`;
                        lowWarningText = effectiveNote
                          ? `${baseText} - ${effectiveNote}`
                          : baseText;
                      }

                      const olderEntry = car.pressureLogs[idx + 1];
                      const intervalLabel =
                        idx === 0
                          ? formatRelativeDays(entry.date)
                          : olderEntry
                            ? formatDaysBetween(entry.date, olderEntry.date)
                            : formatRelativeDays(entry.date);

                      const isEditingRow = editingId === entry.id && showAddForm;

                      const prevByCorner: Partial<Record<TyreCorner, number>> = {
                        ...(entry.beforePressures ?? {}),
                      };
                      if (
                        entry.lowTyre?.corner &&
                        entry.lowTyre.beforeKpa !== undefined &&
                        prevByCorner[entry.lowTyre.corner] === undefined
                      ) {
                        prevByCorner[entry.lowTyre.corner] = entry.lowTyre.beforeKpa;
                      }
                      const hasPrevValues = TYRE_CORNERS.some(
                        (c) => prevByCorner[c] !== undefined
                      );

                      return (
                        <li key={entry.id} className="py-1 first:pt-0 last:pb-0">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpenEdit(entry)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOpenEdit(entry);
                              }
                            }}
                            aria-label={`Edit entry from ${formatDisplayDate(entry.date)}`}
                            className={`flex items-start justify-between gap-3 px-2.5 py-2.5 -mx-2.5 rounded-2xl transition-colors cursor-pointer ${
                              isEditingRow
                                ? 'bg-[#F3F4F2] ring-1 ring-black/10'
                                : 'hover:bg-black/[0.025]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-display font-semibold text-sm text-[#111315]">
                                  {formatDisplayDate(entry.date)}
                                </span>
                                <span aria-hidden="true" className="text-[#9AA0A6]">·</span>
                                <span className="text-xs text-[#5E646A] tabular-nums">
                                  {intervalLabel}
                                </span>
                                {entry.station && (
                                  <>
                                    <span aria-hidden="true" className="text-[#9AA0A6]">·</span>
                                    <span className="inline-flex items-center gap-1 text-xs text-[#111315] font-medium">
                                      <MapPin className="w-3 h-3 text-[#5E646A]" />
                                      {entry.station}
                                    </span>
                                  </>
                                )}
                              </div>

                              {hasPrevValues && (
                                <div className="mt-1 flex items-center gap-3 font-mono text-xs tabular-nums text-[#111315]">
                                  {TYRE_CORNERS.map((c) => {
                                    const isLowCorner = entry.lowTyre?.corner === c;
                                    return (
                                      <span
                                        key={c}
                                        className={
                                          isLowCorner
                                            ? 'text-[#B91C1C] font-bold'
                                            : undefined
                                        }
                                      >
                                        {c} {prevByCorner[c] ?? '—'}
                                      </span>
                                    );
                                  })}
                                  <span className="text-[#6B7075]">kPa</span>
                                </div>
                              )}

                              {lowWarningText && (
                                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#D9480F]">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{lowWarningText}</span>
                                </p>
                              )}

                              {!entry.lowTyre && trimmedNote && (
                                <p className="mt-1 text-xs text-[#5E646A] break-words">
                                  {trimmedNote}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteLog(entry.id);
                              }}
                              aria-label={`Delete entry from ${entry.date}`}
                              className="min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center text-[#9AA0A6] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {hasMoreThanLimit && (
                    <button
                      type="button"
                      onClick={() => setShowAllEntries((prev) => !prev)}
                      className="w-full min-h-[44px] rounded-2xl bg-[#F3F4F2] border border-black/8 hover:bg-black/[0.05] text-xs font-semibold text-[#111315] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {showAllEntries ? (
                        <>
                          <Minimize2 className="w-3.5 h-3.5" />
                          <span>Show less</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>
                            See more ({remainingCount}{' '}
                            {remainingCount === 1 ? 'more entry' : 'more entries'})
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
