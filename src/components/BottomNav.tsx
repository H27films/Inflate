import { Home, MapPinPlus } from 'lucide-react';
import { motion } from 'motion/react';

export type ActiveTab = 'garage' | 'purchases';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenLog: () => void;
  lightSurface?: boolean;
  showBackdrop?: boolean;
}

function WheelIcon({
  className = 'w-[27px] h-[27px]',
}: {
  className?: string;
}) {
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
      {/* Left tyre tread body silhouette */}
      <path
        d="M15.8 2.6 L9.3 2.6 C5.1 2.6 2.6 6.8 2.6 12 C2.6 17.2 5.1 21.4 9.3 21.4 L15.8 21.4"
        strokeWidth={1.35}
      />

      {/* Curved center tread rib */}
      <path
        d="M11.1 2.6 C7.6 4.1 5.7 7.7 5.7 12 C5.7 16.3 7.6 19.9 11.1 21.4"
        strokeWidth={1.0}
      />

      {/* Left tread shoulder grooves */}
      <path d="M4.6 6.4 L6.7 7.2" strokeWidth={0.95} />
      <path d="M3.2 9.5 L5.8 10.1" strokeWidth={0.95} />
      <path d="M2.9 12.6 L5.7 12.6" strokeWidth={0.95} />
      <path d="M3.5 15.7 L6.1 15.1" strokeWidth={0.95} />
      <path d="M5.1 18.6 L7.5 17.9" strokeWidth={0.95} />

      {/* Inner tread grooves */}
      <path d="M7.5 5.4 Q9.1 5.2 10.7 6.0" strokeWidth={0.95} />
      <path d="M6.2 8.7 Q7.9 8.4 9.7 9.0" strokeWidth={0.95} />
      <path d="M5.9 12.0 Q7.6 11.7 9.4 12.1" strokeWidth={0.95} />
      <path d="M6.3 15.3 Q8.0 15.1 9.8 15.6" strokeWidth={0.95} />
      <path d="M7.6 18.5 Q9.2 18.3 10.9 18.7" strokeWidth={0.95} />

      {/* Angled elliptical sidewall & rim */}
      <ellipse cx="15.8" cy="12" rx="5.6" ry="9.4" strokeWidth={1.35} />
      <ellipse cx="15.8" cy="12" rx="3.7" ry="6.3" strokeWidth={1.1} />
      <ellipse cx="15.4" cy="12" rx="1.05" ry="1.55" strokeWidth={1.0} />

      {/* 5-spoke alloy rim lines */}
      <line x1="15.4" y1="10.45" x2="15.8" y2="5.7" strokeWidth={1.05} />
      <line x1="16.4" y1="11.52" x2="19.32" y2="10.05" strokeWidth={1.05} />
      <line x1="16.02" y1="13.25" x2="17.97" y2="17.1" strokeWidth={1.05} />
      <line x1="14.78" y1="13.25" x2="13.63" y2="17.1" strokeWidth={1.05} />
      <line x1="14.4" y1="11.52" x2="12.28" y2="10.05" strokeWidth={1.05} />
    </svg>
  );
}

export function BottomNav({
  activeTab,
  onSelectTab,
  onOpenLog,
  lightSurface = false,
  showBackdrop,
}: BottomNavProps) {
  const isGarage = activeTab === 'garage';
  const isPurchases = activeTab === 'purchases';
  const renderBackdrop = showBackdrop ?? (lightSurface || isPurchases);

  return (
    <div
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 pointer-events-none pb-[calc(0.65rem+env(safe-area-inset-bottom))] flex justify-center"
    >
      {/* Frosted blur layer: preserved on expanded sheets/drawers; seamless when all collapsed */}
      {renderBackdrop && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 backdrop-blur-xl transition-all duration-200 ${
            lightSurface
              ? 'lg:max-w-[540px] lg:mx-auto bg-gradient-to-b from-white/70 via-white/92 to-[#EAECE8]/95'
              : 'bg-gradient-to-t from-[#F3F4F2]/96 via-[#F3F4F2]/80 to-transparent [mask-image:linear-gradient(to_top,black_65%,transparent_100%)]'
          }`}
        />
      )}

      <nav className="relative z-10 pointer-events-auto inline-flex items-center gap-1.5 p-1.5 rounded-full bg-[#E5E7E3]/92 backdrop-blur-md border border-black/8 shadow-[0_8px_24px_rgba(17,19,21,0.10)]">
        <motion.button
          layout
          type="button"
          onClick={() => onSelectTab('garage')}
          aria-label="Home"
          aria-current={isGarage ? 'page' : undefined}
          transition={{ type: 'spring', stiffness: 440, damping: 34 }}
          className={`h-11 rounded-full flex items-center cursor-pointer transition-colors ${
            isGarage
              ? 'bg-[#111315] text-white p-1 pr-4 gap-2.5 shadow-[0_2px_8px_rgba(17,19,21,0.16)]'
              : 'w-11 justify-center bg-white text-[#111315] hover:bg-white/90 shadow-[0_1px_3px_rgba(17,19,21,0.06)]'
          }`}
        >
          <span
            className={`rounded-full flex items-center justify-center shrink-0 transition-colors ${
              isGarage ? 'w-9 h-9 bg-white text-[#111315]' : 'w-full h-full'
            }`}
          >
            <Home
              className="w-[18px] h-[18px]"
              strokeWidth={isGarage ? 2 : 1.75}
            />
          </span>
          {isGarage && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.16 }}
              className="text-[13px] font-medium tracking-tight text-white whitespace-nowrap"
            >
              Home
            </motion.span>
          )}
        </motion.button>

        <motion.button
          layout
          type="button"
          onClick={() => onSelectTab('purchases')}
          aria-label="Past"
          aria-current={isPurchases ? 'page' : undefined}
          transition={{ type: 'spring', stiffness: 440, damping: 34 }}
          className={`h-11 rounded-full flex items-center cursor-pointer transition-colors ${
            isPurchases
              ? 'bg-[#111315] text-white p-1 pr-4 gap-2.5 shadow-[0_2px_8px_rgba(17,19,21,0.16)]'
              : 'w-11 justify-center bg-white text-[#111315] hover:bg-white/90 shadow-[0_1px_3px_rgba(17,19,21,0.06)]'
          }`}
        >
          <span
            className={`rounded-full flex items-center justify-center shrink-0 transition-colors ${
              isPurchases ? 'w-9 h-9 bg-white text-[#111315]' : 'w-full h-full'
            }`}
          >
            <WheelIcon className="w-[23px] h-[23px]" />
          </span>
          {isPurchases && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.16 }}
              className="text-[13px] font-medium tracking-tight text-white whitespace-nowrap"
            >
              Past
            </motion.span>
          )}
        </motion.button>

        <button
          type="button"
          onClick={onOpenLog}
          aria-label="Log"
          className="w-11 h-11 rounded-full bg-white text-[#FF5A1F] hover:bg-white/90 active:scale-[0.94] shadow-[0_1px_3px_rgba(17,19,21,0.06)] transition-all flex items-center justify-center shrink-0 cursor-pointer"
        >
          <MapPinPlus className="w-[18px] h-[18px]" strokeWidth={1.9} />
        </button>
      </nav>
    </div>
  );
}
