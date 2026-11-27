import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-[calc(4.15rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-1.5 rounded-full bg-[#111315] px-3 py-1.5 text-[11px] font-medium text-white shadow-lg border border-white/10"
    >
      <WifiOff className="w-3 h-3 text-[#FF5A1F]" />
      <span>Offline — Cached data active</span>
    </div>
  );
}
