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
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-black/8 pb-safe"
    >
      <div className="max-w-3xl mx-auto grid grid-cols-3 h-14 px-2">
        <button
          type="button"
          onClick={() => onSelectTab('garage')}
          aria-label="Home"
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
            activeTab === 'garage'
              ? 'text-[#111315] font-semibold'
              : 'text-[#6B7075] hover:text-[#111315]'
          }`}
        >
          <Home className="w-5 h-5" strokeWidth={activeTab === 'garage' ? 2.2 : 1.8} />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('purchases')}
          aria-label="Purchases"
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
            activeTab === 'purchases'
              ? 'text-[#111315] font-semibold'
              : 'text-[#6B7075] hover:text-[#111315]'
          }`}
        >
          <DollarSign className="w-5 h-5" strokeWidth={activeTab === 'purchases' ? 2.2 : 1.8} />
          <span>Purchases</span>
        </button>

        <button
          type="button"
          onClick={onOpenLog}
          aria-label="Log pressure top-up"
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-[#FF5A1F] hover:text-[#E54D14] active:scale-[0.97] transition-all cursor-pointer"
        >
          <MapPinPlus className="w-5 h-5" strokeWidth={2.1} />
          <span>Log</span>
        </button>
      </div>
    </nav>
  );
}
