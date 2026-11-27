import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        aria-label="Install Inflate app"
        title="Install Inflate app"
        className="w-8 h-8 rounded-full bg-white border border-black/8 shadow-[0_2px_8px_rgba(17,19,21,0.04)] hover:bg-black/[0.02] active:scale-[0.96] transition-all flex items-center justify-center cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-[#111315]" />
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Add Inflate to Home Screen"
          title="Add to Home Screen"
          className="w-8 h-8 rounded-full bg-white border border-black/8 shadow-[0_2px_8px_rgba(17,19,21,0.04)] hover:bg-black/[0.02] active:scale-[0.96] transition-all flex items-center justify-center cursor-pointer"
        >
          <Share className="w-3.5 h-3.5 text-[#111315]" />
        </button>

        {showIOSGuide &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              onClick={() => setShowIOSGuide(false)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Add Inflate to Home Screen"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xs rounded-3xl bg-white border border-black/8 p-5 shadow-2xl space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-semibold text-[#111315]">
                      Add to Home Screen
                    </h3>
                    <p className="text-xs text-[#5E646A] mt-0.5">
                      Install Inflate on iPhone or iPad
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide(false)}
                    aria-label="Close instructions"
                    className="w-8 h-8 rounded-full bg-[#F3F4F2] flex items-center justify-center text-[#5E646A] hover:text-[#111315] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <ol className="text-xs text-[#2A2E33] space-y-2 leading-relaxed">
                  <li>
                    1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
                  </li>
                  <li>
                    2. Scroll down and tap <strong>Add to Home Screen</strong>.
                  </li>
                </ol>

                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full h-10 rounded-xl bg-[#111315] text-white text-xs font-semibold hover:bg-black/85 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }

  return null;
}
