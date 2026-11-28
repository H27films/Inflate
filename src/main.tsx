import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

let pendingSwReload = false;
let wentBackground = false;

registerSW({
  immediate: true,
  onNeedReload() {
    // Never force-reload right after startup (causes a double splash screen);
    // apply the reload cleanly if the user backgrounds and returns, or on next launch.
    pendingSwReload = true;
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        wentBackground = true;
        return;
      }
      if (document.visibilityState === 'visible') {
        if (pendingSwReload && wentBackground) {
          pendingSwReload = false;
          try {
            window.sessionStorage.setItem('inflate_skip_boot_splash', '1');
            window.localStorage.setItem('inflate_skip_boot_splash', '1');
          } catch {
            // Ignore storage restrictions
          }
          window.location.reload();
          return;
        }
        void registration.update();
      }
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
