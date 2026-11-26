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
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-black/8 pb-safe"
    >
      <div className="max-w-lg mx-auto grid grid-cols-3 h-14 px-3 gap-2">
        <button
          type="button"
          onClick={() => onSelectTab('garage')}
          aria-label="Home"
          aria-current={activeTab === 'garage' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors cursor-pointer ${
            activeTab === 'garage'
              ? 'my-1.5 rounded-2xl bg-gradient-to-b from-black/[0.08] to-black/[0.03] text-[#111315] font-semibold'
              : 'text-[#6B7075] font-medium hover:text-[#111315]'
          }`}
        >
          <Home className="w-5 h-5" strokeWidth={activeTab === 'garage' ? 2.2 : 1.8} />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('purchases')}
          aria-label="Purchases"
          aria-current={activeTab === 'purchases' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors cursor-pointer ${
            activeTab === 'purchases'
              ? 'my-1.5 rounded-2xl bg-gradient-to-b from-black/[0.08] to-black/[0.03] text-[#111315] font-semibold'
              : 'text-[#6B7075] font-medium hover:text-[#111315]'
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
