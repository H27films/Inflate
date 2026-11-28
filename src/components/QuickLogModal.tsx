import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Loader2,
  LocateFixed,
  X,
} from 'lucide-react';
import {
  CarProfile,
  CarWashLogEntry,
  CORNER_LABELS,
  CornerPressures,
  PressureLogEntry,
  TYRE_CORNERS,
  TyreCorner,
} from '../types';
import { detectCurrentLocationName, getTodayIso } from '../data/initialGarage';
import { ArcDatePicker } from './ArcDatePicker';

interface QuickLogModalProps {
  open: boolean;
  car: CarProfile;
  onClose: () => void;
  onLogCreated: (entry: Omit<PressureLogEntry, 'id'>) => void;
  onWashLogCreated: (entry: Omit<CarWashLogEntry, 'id'>) => void;
}

type LogModalStep = 'choose' | 'air' | 'wash';

export function WheelTyreIcon({ className = 'w-[22px] h-[22px]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M15.8 2.6 L9.3 2.6 C5.1 2.6 2.6 6.8 2.6 12 C2.6 17.2 5.1 21.4 9.3 21.4 L15.8 21.4"
        strokeWidth={1.5}
      />
      <path
        d="M11.1 2.6 C7.6 4.1 5.7 7.7 5.7 12 C5.7 16.3 7.6 19.9 11.1 21.4"
        strokeWidth={1.1}
      />
      <path d="M4.6 6.4 L6.7 7.2" strokeWidth={1.0} />
      <path d="M3.2 9.5 L5.8 10.1" strokeWidth={1.0} />
      <path d="M2.9 12.6 L5.7 12.6" strokeWidth={1.0} />
      <path d="M3.5 15.7 L6.1 15.1" strokeWidth={1.0} />
      <path d="M5.1 18.6 L7.5 17.9" strokeWidth={1.0} />
      <ellipse cx="15.8" cy="12" rx="5.6" ry="9.4" strokeWidth={1.5} />
      <ellipse cx="15.8" cy="12" rx="3.7" ry="6.3" strokeWidth={1.15} />
      <ellipse cx="15.4" cy="12" rx="1.05" ry="1.55" strokeWidth={1.05} />
      <line x1="15.4" y1="10.45" x2="15.8" y2="5.7" strokeWidth={1.1} />
      <line x1="16.4" y1="11.52" x2="19.32" y2="10.05" strokeWidth={1.1} />
      <line x1="16.02" y1="13.25" x2="17.97" y2="17.1" strokeWidth={1.1} />
      <line x1="14.78" y1="13.25" x2="13.63" y2="17.1" strokeWidth={1.1} />
      <line x1="14.4" y1="11.52" x2="12.28" y2="10.05" strokeWidth={1.1} />
    </svg>
  );
}

function CarWashIcon({ className = 'w-[22px] h-[22px]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Water droplet top-left */}
      <path
        fill="currentColor"
        d="M5.1 2.2C5.1 2.2 3.1 4.7 3.1 6.05C3.1 7.15 4 8.05 5.1 8.05C6.2 8.05 7.1 7.15 7.1 6.05C7.1 4.7 5.1 2.2 5.1 2.2Z"
      />
      {/* Three minimalist 4-point sparkles top-right */}
      <path
        fill="currentColor"
        d="M16.6 2.1L17.15 3.65L18.7 4.2L17.15 4.75L16.6 6.3L16.05 4.75L14.5 4.2L16.05 3.65L16.6 2.1Z"
      />
      <path
        fill="currentColor"
        d="M19.7 4.5L20.12 5.68L21.3 6.1L20.12 6.52L19.7 7.7L19.28 6.52L18.1 6.1L19.28 5.68L19.7 4.5Z"
      />
      <path
        fill="currentColor"
        d="M21.05 7.7L21.33 8.47L22.1 8.75L21.33 9.03L21.05 9.8L20.77 9.03L20 8.75L20.77 8.47L21.05 7.7Z"
      />
      {/* Front-facing car silhouette with transparent windshield, headlights & grille */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.65 9.4H16.35C16.95 9.4 17.45 9.75 17.75 10.3L18.95 12.65L20.35 12.45C20.75 12.4 21.1 12.7 21.1 13.1V13.45C21.1 13.8 20.82 14.05 20.48 14.05H19.7L19.8 17.8C19.8 18.25 19.45 18.6 19 18.6H18.5V19.65C18.5 20.05 18.18 20.35 17.78 20.35H16.35C15.95 20.35 15.65 20.05 15.65 19.65V18.6H8.35V19.65C8.35 20.05 8.05 20.35 7.65 20.35H6.22C5.82 20.35 5.5 20.05 5.5 19.65V18.6H5C4.55 18.6 4.2 18.25 4.2 17.8L4.3 14.05H3.52C3.18 14.05 2.9 13.8 2.9 13.45V13.1C2.9 12.7 3.25 12.4 3.65 12.45L5.05 12.65L6.25 10.3C6.55 9.75 7.05 9.4 7.65 9.4ZM7.9 10.35L6.55 13.05H17.45L16.1 10.35H7.9ZM5.75 14.9C5.5 14.85 5.3 15.05 5.3 15.32C5.3 15.72 5.65 16.05 6.1 16.1L8.15 16.3C8.45 16.33 8.7 16.1 8.7 15.8C8.7 15.65 8.58 15.5 8.42 15.46L5.75 14.9ZM18.25 14.9L15.58 15.46C15.42 15.5 15.3 15.65 15.3 15.8C15.3 16.1 15.55 16.33 15.85 16.3L17.9 16.1C18.35 16.05 18.7 15.72 18.7 15.32C18.7 15.05 18.5 14.85 18.25 14.9ZM9.5 17.05C9.2 17.05 8.98 17.32 9.08 17.6H14.92C15.02 17.32 14.8 17.05 14.5 17.05H9.5Z"
      />
      {/* Ground line */}
      <line
        x1="2.2"
        y1="21.4"
        x2="21.8"
        y2="21.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QuickLogModal({
  open,
  car,
  onClose,
  onLogCreated,
  onWashLogCreated,
}: QuickLogModalProps) {
  const latestPressure = car.pressureLogs[0];
  const latestWash = car.carWashLogs?.[0];

  const [step, setStep] = useState<LogModalStep>('choose');
  const [date, setDate] = useState(getTodayIso());
  const [locationText, setLocationText] = useState('');
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

  const [washDate, setWashDate] = useState(getTodayIso());
  const [washPrice, setWashPrice] = useState('');
  const [washLocation, setWashLocation] = useState('');

  useEffect(() => {
    if (!open) return;

    setStep('choose');
    setDate(getTodayIso());
    setLocationText(latestPressure?.station ?? '');
    setBeforeInputs({ FL: '', FR: '', RL: '', RR: '' });
    setLowCorner(null);
    setNote('');

    setWashDate(getTodayIso());
    setWashPrice('');
    setWashLocation(latestWash?.location ?? '');

    setLocError(null);
    setDetectingLoc(false);
  }, [open, car.id, latestPressure?.station, latestWash?.location]);

  const handleRequestLocation = async (target: 'air' | 'wash') => {
    if (detectingLoc) return;
    setLocError(null);
    setDetectingLoc(true);
    try {
      const place = await detectCurrentLocationName();
      if (target === 'wash') {
        setWashLocation(place);
      } else {
        setLocationText(place);
      }
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Unable to detect location.');
    } finally {
      setDetectingLoc(false);
    }
  };

  const handleSubmitAir = (e: FormEvent) => {
    e.preventDefault();
    const beforePressures: Partial<CornerPressures> = {};
    TYRE_CORNERS.forEach((corner) => {
      const parsed = Number(beforeInputs[corner]);
      if (Number.isFinite(parsed) && parsed > 0) {
        beforePressures[corner] = Math.round(parsed);
      }
    });

    const flaggedBefore = lowCorner ? beforePressures[lowCorner] : undefined;

    onLogCreated({
      date,
      pressures: { ...car.recommendedKpa },
      beforePressures:
        Object.keys(beforePressures).length > 0 ? beforePressures : undefined,
      source: 'manual',
      station: locationText.trim() || 'Current location',
      lowTyre:
        lowCorner !== null
          ? flaggedBefore !== undefined
            ? { corner: lowCorner, beforeKpa: flaggedBefore }
            : { corner: lowCorner }
          : undefined,
      note: note.trim() || undefined,
    });
    onClose();
  };

  const handleSubmitWash = (e: FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number(washPrice);
    const cleanPrice = Number.isFinite(parsedPrice)
      ? Math.round(Math.max(0, Math.min(100000, parsedPrice)) * 100) / 100
      : 0;

    onWashLogCreated({
      date: washDate,
      price: cleanPrice,
      location: washLocation.trim() || 'Car Wash',
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && step === 'choose' && (
        <>
          <motion.div
            key="log-choose-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-35 bg-[#E9EBE7]/45 backdrop-blur-md"
          />

          <motion.div
            key="log-choose-pill"
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="fixed inset-x-0 bottom-[calc(4.9rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 pointer-events-none"
          >
            <div
              role="dialog"
              aria-label="Choose log type"
              className="pointer-events-auto inline-flex items-center p-1.5 rounded-full bg-white/62 backdrop-blur-2xl border border-white/90 ring-1 ring-black/[0.08] shadow-[0_14px_38px_rgba(17,19,21,0.16),inset_0_1.5px_1px_rgba(255,255,255,0.95),inset_0_-1px_2px_rgba(17,19,21,0.06)]"
            >
              <button
                type="button"
                onClick={() => {
                  setLocError(null);
                  setStep('air');
                }}
                className="h-11 px-5 rounded-full inline-flex items-center justify-center gap-2.5 text-[#111315] hover:bg-white/75 active:scale-[0.97] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_2px_8px_rgba(17,19,21,0.08)] transition-all cursor-pointer"
              >
                <WheelTyreIcon className="w-[21px] h-[21px] text-[#111315] shrink-0" />
                <span className="font-display text-[14px] font-medium tracking-tight text-[#111315]">
                  Air
                </span>
              </button>

              <span
                aria-hidden="true"
                className="w-px h-5 bg-black/10 mx-0.5 shrink-0"
              />

              <button
                type="button"
                onClick={() => {
                  setLocError(null);
                  setStep('wash');
                }}
                className="h-11 px-5 rounded-full inline-flex items-center justify-center gap-2.5 text-[#111315] hover:bg-white/75 active:scale-[0.97] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_2px_8px_rgba(17,19,21,0.08)] transition-all cursor-pointer"
              >
                <CarWashIcon className="w-[22px] h-[22px] text-[#111315] shrink-0" />
                <span className="font-display text-[14px] font-medium tracking-tight text-[#111315]">
                  Wash
                </span>
              </button>
            </div>
          </motion.div>
        </>
      )}

      {open && step !== 'choose' && (
        <motion.div
          key="log-form-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 bg-[#E9EBE7]/45 backdrop-blur-md flex items-end sm:items-center justify-center px-3.5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[372px] rounded-[28px] p-4 bg-gradient-to-b from-white/80 via-[#F2F3F0]/72 to-[#E7E9E6]/68 backdrop-blur-2xl shadow-[0_20px_50px_rgba(17,19,21,0.16),inset_0_1.5px_1.5px_rgba(255,255,255,0.95),inset_0_-1px_2px_rgba(17,19,21,0.05)] max-h-[86dvh] overflow-y-auto no-scrollbar"
          >
            {step === 'air' && (
              <form onSubmit={handleSubmitAir} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLocError(null);
                      setStep('choose');
                    }}
                    aria-label="Back to log options"
                    className="w-9 h-9 rounded-full bg-gradient-to-b from-[#D7DAD6]/52 to-white/68 backdrop-blur-md shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.9),0_2px_6px_rgba(17,19,21,0.05)] flex items-center justify-center text-[#111315] hover:from-white/80 hover:to-white/90 transition-all shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <WheelTyreIcon className="w-[18px] h-[18px] text-[#111315]" />
                    <h2 className="font-display text-[16px] font-semibold tracking-tight text-[#111315]">
                      Log Air
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close log dialog"
                    className="w-9 h-9 rounded-full bg-gradient-to-b from-[#D7DAD6]/52 to-white/68 backdrop-blur-md shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.9),0_2px_6px_rgba(17,19,21,0.05)] flex items-center justify-center text-[#111315] hover:from-white/80 hover:to-white/90 transition-all shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[11px] font-medium text-[#5E646A] px-0.5 block">
                      Date
                    </span>
                    <ArcDatePicker
                      label="Air date"
                      value={date}
                      onChange={setDate}
                      buttonClassName="mt-1 w-full h-10 px-3 rounded-xl bg-gradient-to-b from-[#D4D7D3]/50 via-[#E2E4E1]/48 to-[#F5F6F4]/62 backdrop-blur-md shadow-[inset_0_1.5px_3px_rgba(17,19,21,0.06),inset_0_-1px_1.5px_rgba(255,255,255,0.9)] text-xs font-mono text-[#111315] flex items-center justify-between gap-1.5 hover:from-[#CFD3CE]/58 hover:to-white/72 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25 transition-all cursor-pointer"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="quick-log-location"
                      className="text-[11px] font-medium text-[#5E646A] px-0.5 block"
                    >
                      Location
                    </label>
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        id="quick-log-location"
                        type="text"
                        required
                        placeholder="Shell Kajang"
                        value={locationText}
                        onChange={(e) => setLocationText(e.target.value)}
                        className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-gradient-to-b from-[#D4D7D3]/50 via-[#E2E4E1]/48 to-[#F5F6F4]/62 backdrop-blur-md shadow-[inset_0_1.5px_3px_rgba(17,19,21,0.06),inset_0_-1px_1.5px_rgba(255,255,255,0.9)] text-xs text-[#111315] placeholder:text-[#7E848A] hover:from-[#CFD3CE]/58 hover:to-white/72 focus:from-[#E5E7E4]/75 focus:to-white/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleRequestLocation('air')}
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
                  </div>
                </div>

                {locError && (
                  <p className="text-[11px] text-[#D9480F] leading-snug px-0.5">
                    {locError}
                  </p>
                )}

                <div className="pt-2.5 border-t border-black/[0.05] space-y-2.5">
                  <div>
                    <span className="text-[11px] font-medium text-[#5E646A] px-0.5 block mb-1">
                      Before (kPa)
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {TYRE_CORNERS.map((corner) => (
                        <label key={corner} className="block">
                          <span className="text-[10px] font-mono text-[#767C82] block text-center mb-0.5">
                            {corner}
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={3}
                            placeholder="—"
                            aria-label={`${CORNER_LABELS[corner]} previous reading kPa`}
                            value={beforeInputs[corner]}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
                              setBeforeInputs((prev) => ({
                                ...prev,
                                [corner]: digits,
                              }));
                            }}
                            className="w-full h-10 px-2 rounded-xl bg-gradient-to-b from-[#D4D7D3]/50 via-[#E2E4E1]/48 to-[#F5F6F4]/62 backdrop-blur-md shadow-[inset_0_1.5px_3px_rgba(17,19,21,0.06),inset_0_-1px_1.5px_rgba(255,255,255,0.9)] text-sm font-mono font-semibold tabular-nums text-[#111315] text-center placeholder:text-[#7E848A] hover:from-[#CFD3CE]/58 hover:to-white/72 focus:from-[#E5E7E4]/75 focus:to-white/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25 transition-all"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 px-0.5 mb-1">
                      <span className="text-[11px] font-medium text-[#5E646A]">
                        Low tyre
                      </span>
                      {lowCorner && (
                        <button
                          type="button"
                          onClick={() => setLowCorner(null)}
                          className="text-[11px] font-medium text-[#5E646A] hover:text-[#111315] cursor-pointer"
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
                            className={`h-9 rounded-xl font-mono text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25 ${
                              selected
                                ? 'bg-[#FF5A1F] text-white shadow-[0_4px_12px_rgba(255,90,31,0.3)]'
                                : 'bg-gradient-to-b from-[#D4D7D3]/50 via-[#E2E4E1]/48 to-[#F5F6F4]/62 backdrop-blur-md shadow-[inset_0_1.5px_3px_rgba(17,19,21,0.06),inset_0_-1px_1.5px_rgba(255,255,255,0.9)] text-[#5E646A] hover:from-[#CFD3CE]/58 hover:to-white/72 hover:text-[#111315]'
                            }`}
                          >
                            {corner}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-gradient-to-b from-[#D4D7D3]/50 via-[#E2E4E1]/48 to-[#F5F6F4]/62 backdrop-blur-md shadow-[inset_0_1.5px_3px_rgba(17,19,21,0.06),inset_0_-1px_1.5px_rgba(255,255,255,0.9)] text-xs text-[#111315] placeholder:text-[#7E848A] hover:from-[#CFD3CE]/58 hover:to-white/72 focus:from-[#E5E7E4]/75 focus:to-white/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-11 rounded-full bg-[#111315] text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(17,19,21,0.18)] hover:bg-black/85 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Log Air</span>
                </button>
              </form>
            )}

            {step === 'wash' && (
              <form onSubmit={handleSubmitWash} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLocError(null);
                      setStep('choose');
                    }}
                    aria-label="Back to log options"
                    className="w-9 h-9 rounded-full bg-gradient-to-b from-[#D7DAD6]/52 to-white/68 backdrop-blur-md shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.9),0_2px_6px_rgba(17,19,21,0.05)] flex items-center justify-center text-[#111315] hover:from-white/80 hover:to-white/90 transition-all shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <CarWashIcon className="w-[19px] h-[19px] text-[#111315]" />
                    <h2 className="font-display text-[16px] font-semibold tracking-tight text-[#111315]">
                      Log Wash
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close log dialog"
                    className="w-9 h-9 rounded-full bg-gradient-to-b from-[#D7DAD6]/52 to-white/68 backdrop-blur-md shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.9),0_2px_6px_rgba(17,19,21,0.05)] flex items-center justify-center text-[#111315] hover:from-white/80 hover:to-white/90 transition-all shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[11px] font-medium text-[#5E646A] px-0.5 block">
                      Date
                    </span>
                    <ArcDatePicker
                      label="Car wash date"
                      value={washDate}
                      onChange={setWashDate}
                      buttonClassName="mt-1 w-full h-10 px-3 rounded-xl bg-gradient-to-b from-[#D4D7D3]/50 via-[#E2E4E1]/48 to-[#F5F6F4]/62 backdrop-blur-md shadow-[inset_0_1.5px_3px_rgba(17,19,21,0.06),inset_0_-1px_1.5px_rgba(255,255,255,0.9)] text-xs font-mono text-[#111315] flex items-center justify-between gap-1.5 hover:from-[#CFD3CE]/58 hover:to-white/72 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25 transition-all cursor-pointer"
                    />
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-medium text-[#5E646A] px-0.5 block">
                      Price
                    </span>
                    <div className="mt-1 relative flex items-center">
                      <span className="absolute left-3 z-10 text-xs font-mono font-semibold text-[#5E646A] pointer-events-none">
                        RM
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100000"
                        step="0.01"
                        required
                        placeholder="25.00"
                        value={washPrice}
                        onChange={(e) => setWashPrice(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-gradient-to-b from-[#D4D7D3]/50 via-[#E2E4E1]/48 to-[#F5F6F4]/62 backdrop-blur-md shadow-[inset_0_1.5px_3px_rgba(17,19,21,0.06),inset_0_-1px_1.5px_rgba(255,255,255,0.9)] text-xs font-mono font-semibold tabular-nums text-[#111315] placeholder:text-[#7E848A] hover:from-[#CFD3CE]/58 hover:to-white/72 focus:from-[#E5E7E4]/75 focus:to-white/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25 transition-all"
                      />
                    </div>
                  </label>
                </div>

                <div>
                  <label
                    htmlFor="wash-log-location"
                    className="text-[11px] font-medium text-[#5E646A] px-0.5 block"
                  >
                    Location
                  </label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      id="wash-log-location"
                      type="text"
                      required
                      maxLength={160}
                      placeholder="Auto Spa Kajang"
                      value={washLocation}
                      onChange={(e) => setWashLocation(e.target.value)}
                      className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-gradient-to-b from-[#D4D7D3]/50 via-[#E2E4E1]/48 to-[#F5F6F4]/62 backdrop-blur-md shadow-[inset_0_1.5px_3px_rgba(17,19,21,0.06),inset_0_-1px_1.5px_rgba(255,255,255,0.9)] text-xs text-[#111315] placeholder:text-[#7E848A] hover:from-[#CFD3CE]/58 hover:to-white/72 focus:from-[#E5E7E4]/75 focus:to-white/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111315]/25 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleRequestLocation('wash')}
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
                    <p className="mt-1 text-[11px] text-[#D9480F] leading-snug px-0.5">
                      {locError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full h-11 rounded-full bg-[#111315] text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(17,19,21,0.18)] hover:bg-black/85 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Log Wash</span>
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
