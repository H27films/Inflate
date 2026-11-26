import { Home, MapPinPlus } from 'lucide-react';
import { motion } from 'motion/react';

export type ActiveTab = 'garage' | 'purchases';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenLog: () => void;
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

export function BottomNav({ activeTab, onSelectTab, onOpenLog }: BottomNavProps) {
  return (
    <footer
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-b from-[#ECEDEA]/95 to-[#DFE1DD]/95 backdrop-blur-md pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] flex justify-center"
    >
      <nav className="relative inline-grid grid-cols-3 gap-10 sm:gap-12 px-1.5 pt-1">
        {/* Outer capsule surrounding only the circular icons */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[48px] rounded-full bg-[#F5F6F4] border border-black/8 shadow-[0_2px_8px_rgba(17,19,21,0.06)] pointer-events-none"
        />

        <button
          type="button"
          onClick={() => onSelectTab('garage')}
          aria-label="Home"
          aria-current={activeTab === 'garage' ? 'page' : undefined}
          className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer"
        >
          <span className="relative w-10 h-10 rounded-full group-hover:bg-black/[0.04] flex items-center justify-center transition-colors">
            {activeTab === 'garage' && (
              <motion.span
                layoutId="bottom-nav-active-circle"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-full bg-[#111315] shadow-[0_2px_8px_rgba(17,19,21,0.18)]"
              />
            )}
            <Home
              className={`relative z-10 w-[18px] h-[18px] transition-colors ${
                activeTab === 'garage' ? 'text-white' : 'text-[#6B7075]'
              }`}
              strokeWidth={activeTab === 'garage' ? 2.1 : 1.7}
            />
          </span>
          <span
            className={`h-3 text-[10.5px] leading-[12px] tracking-tight transition-colors ${
              activeTab === 'garage'
                ? 'font-semibold text-[#111315]'
                : 'font-medium text-[#6B7075]'
            }`}
          >
            Home
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('purchases')}
          aria-label="Past"
          aria-current={activeTab === 'purchases' ? 'page' : undefined}
          className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer"
        >
          <span className="relative w-10 h-10 rounded-full group-hover:bg-black/[0.04] flex items-center justify-center transition-colors">
            {activeTab === 'purchases' && (
              <motion.span
                layoutId="bottom-nav-active-circle"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-full bg-[#111315] shadow-[0_2px_8px_rgba(17,19,21,0.18)]"
              />
            )}
            <WheelIcon
              className={`relative z-10 w-[25px] h-[25px] transition-colors ${
                activeTab === 'purchases' ? 'text-white' : 'text-[#6B7075]'
              }`}
            />
          </span>
          <span
            className={`h-3 text-[10.5px] leading-[12px] tracking-tight transition-colors ${
              activeTab === 'purchases'
                ? 'font-semibold text-[#111315]'
                : 'font-medium text-[#6B7075]'
            }`}
          >
            Past
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenLog}
          aria-label="Log"
          className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer"
        >
          <span className="w-10 h-10 rounded-full bg-[#D7D9D6] group-hover:bg-[#CFD1CE] text-[#FF5A1F] group-active:scale-[0.94] transition-all flex items-center justify-center">
            <MapPinPlus className="w-[18px] h-[18px]" strokeWidth={1.9} />
          </span>
          <span className="h-3 text-[10.5px] leading-[12px] tracking-tight font-semibold text-[#FF5A1F]">
            Log
          </span>
        </button>
      </nav>
    </footer>
  );
}
