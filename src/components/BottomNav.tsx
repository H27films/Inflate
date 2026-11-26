import { DollarSign, Home, MapPinPlus } from 'lucide-react';

export type ActiveTab = 'garage' | 'purchases';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenLog: () => void;
}

export function BottomNav({ activeTab, onSelectTab, onOpenLog }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/65 backdrop-blur-xl border-t border-white/70 shadow-[0_-6px_24px_rgba(17,19,21,0.06)] pb-safe"
    >
      <div className="max-w-lg mx-auto grid grid-cols-3 gap-2 px-3 pt-1.5 pb-1">
        <button
          type="button"
          onClick={() => onSelectTab('garage')}
          aria-label="Home"
          aria-current={activeTab === 'garage' ? 'page' : undefined}
          className={`h-11 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] transition-all cursor-pointer ${
            activeTab === 'garage'
              ? 'bg-[#111315]/88 backdrop-blur-md text-white font-semibold border border-white/15 shadow-[0_4px_14px_rgba(17,19,21,0.18),inset_0_1px_0_rgba(255,255,255,0.18)]'
              : 'text-[#5E646A] font-medium hover:text-[#111315] hover:bg-white/60'
          }`}
        >
          <Home className="w-[18px] h-[18px]" strokeWidth={activeTab === 'garage' ? 2.2 : 1.8} />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('purchases')}
          aria-label="Purchases"
          aria-current={activeTab === 'purchases' ? 'page' : undefined}
          className={`h-11 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] transition-all cursor-pointer ${
            activeTab === 'purchases'
              ? 'bg-[#111315]/88 backdrop-blur-md text-white font-semibold border border-white/15 shadow-[0_4px_14px_rgba(17,19,21,0.18),inset_0_1px_0_rgba(255,255,255,0.18)]'
              : 'text-[#5E646A] font-medium hover:text-[#111315] hover:bg-white/60'
          }`}
        >
          <DollarSign className="w-[18px] h-[18px]" strokeWidth={activeTab === 'purchases' ? 2.2 : 1.8} />
          <span>Purchases</span>
        </button>

        <button
          type="button"
          onClick={onOpenLog}
          aria-label="Log pressure top-up"
          className="h-11 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-[#FF5A1F] bg-[#FF5A1F]/[0.08] backdrop-blur-sm border border-[#FF5A1F]/15 hover:bg-[#FF5A1F]/[0.14] hover:text-[#E54D14] active:scale-[0.97] transition-all cursor-pointer"
        >
          <MapPinPlus className="w-[18px] h-[18px]" strokeWidth={2.1} />
          <span>Log</span>
        </button>
      </div>
    </nav>
  );
}
