import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, Check, Loader2, LocateFixed, MapPin, X } from 'lucide-react';
import {
  CarProfile,
  CORNER_LABELS,
  PressureLogEntry,
  TYRE_CORNERS,
  TyreCorner,
} from '../types';
import { detectCurrentLocationName, getTodayIso } from '../data/initialGarage';

interface QuickLogModalProps {
  open: boolean;
  car: CarProfile;
  onClose: () => void;
  onLogCreated: (entry: Omit<PressureLogEntry, 'id'>) => void;
}

export function QuickLogModal({ open, car, onClose, onLogCreated }: QuickLogModalProps) {
  const latest = car.pressureLogs[0];
  const [date, setDate] = useState(getTodayIso());
  const [locationText, setLocationText] = useState('');
  const [detectingLoc, setDetectingLoc] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [lowCorner, setLowCorner] = useState<TyreCorner | null>(null);
  const [beforeKpa, setBeforeKpa] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;

    setDate(getTodayIso());
    setLocationText(latest?.station ?? '');
    setLowCorner(null);
    setBeforeKpa('');
    setNote('');
    setLocError(null);
    setDetectingLoc(false);
  }, [open, car.id]);

  const handleRequestLocation = async () => {
    if (detectingLoc) return;
    setLocError(null);
    setDetectingLoc(true);
    try {
      const place = await detectCurrentLocationName();
      setLocationText(place);
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Unable to detect location.');
    } finally {
      setDetectingLoc(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const numericBefore = Number(beforeKpa);
    const hasLowTyre = lowCorner !== null && Number.isFinite(numericBefore) && numericBefore > 0;

    onLogCreated({
      date,
      pressures: { ...car.recommendedKpa },
      source: 'manual',
      station: locationText.trim() || 'Current location',
      lowTyre: hasLowTyre
        ? { corner: lowCorner, beforeKpa: Math.round(numericBefore) }
        : lowCorner !== null
          ? { corner: lowCorner }
          : undefined,
      note: note.trim() || undefined,
    });
    onClose();
  };

  const targetSummary =
    car.recommendedKpa.FL === car.recommendedKpa.RL
      ? `Logs all tyres at ${car.recommendedKpa.FL} kPa`
      : `Logs ${car.recommendedKpa.FL} kPa front · ${car.recommendedKpa.RL} kPa back`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.form
            initial={{ y: 36, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 36, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#111315]">
                  Log air top-up
                </h2>
                <p className="text-xs text-[#5E646A]">
                  {car.displayTitle} · {targetSummary}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close log dialog"
                className="w-10 h-10 rounded-full bg-[#F3F4F2] flex items-center justify-center text-[#111315] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-[#5E646A] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Date
                </span>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-xs font-mono text-[#111315]"
                />
              </label>

              <div>
                <label htmlFor="quick-log-location" className="text-xs font-medium text-[#5E646A] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Location
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="quick-log-location"
                    type="text"
                    required
                    placeholder="e.g. Shell Kajang"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-[#F3F4F2] border border-black/8 text-xs text-[#111315]"
                  />
                  <button
                    type="button"
                    onClick={handleRequestLocation}
                    disabled={detectingLoc}
                    aria-label="Use current location"
                    title="Use current location"
                    className="w-11 h-11 rounded-xl bg-[#111315] text-white hover:bg-black/85 disabled:opacity-60 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    {detectingLoc ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LocateFixed className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {locError && (
                  <p className="mt-1 text-[11px] text-[#D9480F] leading-snug">
                    {locError}
                  </p>
                )}
              </div>
            </div>

            {/* Optional Low Tyre Note Area */}
            <div className="p-3.5 rounded-2xl bg-[#F3F4F2] border border-black/6 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#111315]">
                  Was a tyre very low? (optional)
                </span>
                {lowCorner && (
                  <button
                    type="button"
                    onClick={() => {
                      setLowCorner(null);
                      setBeforeKpa('');
                    }}
                    className="text-[11px] font-medium text-[#5E646A] underline underline-offset-2 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {TYRE_CORNERS.map((corner) => {
                  const selected = lowCorner === corner;
                  return (
                    <button
                      key={corner}
                      type="button"
                      onClick={() => setLowCorner(selected ? null : corner)}
                      className={`h-10 rounded-xl font-mono text-xs font-semibold border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                          : 'bg-white text-[#5E646A] border-black/8 hover:text-[#111315]'
                      }`}
                    >
                      {corner}
                    </button>
                  );
                })}
              </div>

              {lowCorner && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <label className="block">
                    <span className="text-[11px] font-medium text-[#5E646A]">
                      {CORNER_LABELS[lowCorner]} was (kPa)
                    </span>
                    <input
                      type="number"
                      min={50}
                      max={400}
                      placeholder="e.g. 210"
                      value={beforeKpa}
                      onChange={(e) => setBeforeKpa(e.target.value)}
                      className="mt-1 w-full h-10 px-2.5 rounded-xl bg-white border border-black/10 text-sm font-mono font-semibold tabular-nums text-[#111315]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-[#5E646A]">
                      Note (optional)
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Slow leak"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="mt-1 w-full h-10 px-2.5 rounded-xl bg-white border border-black/10 text-xs text-[#111315]"
                    />
                  </label>
                </div>
              )}

              {!lowCorner && (
                <input
                  type="text"
                  placeholder="Optional note (e.g. Cold morning check)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-white border border-black/8 text-xs text-[#111315]"
                />
              )}
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-2xl bg-[#111315] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-black/85 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Log top-up</span>
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
