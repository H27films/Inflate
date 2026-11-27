import { motion, useReducedMotion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallButton } from './PWAInstallButton';

const BRAND_LETTERS = ['I', 'N', 'F', 'L', 'A', 'T', 'E'];

interface SignInScreenProps {
  signingIn: boolean;
  syncing: boolean;
  authError: string | null;
  onSignIn: () => void;
}

export function SignInScreen({
  signingIn,
  syncing,
  authError,
  onSignIn,
}: SignInScreenProps) {
  const prefersReducedMotion = useReducedMotion();
  const [logoError, setLogoError] = useState(false);
  const busy = signingIn || syncing;

  return (
    <div
      className="min-h-dvh bg-[#F3F4F2] text-[#111315] flex flex-col items-center justify-center px-6 relative select-none overflow-hidden"
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 44%, rgba(255,255,255,0.84) 0%, rgba(243,244,242,0.92) 52%, rgba(226,229,223,0.9) 100%)',
      }}
    >
      <OfflineIndicator />
      <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] right-4 z-30">
        <PWAInstallButton />
      </div>

      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: prefersReducedMotion ? 0.15 : 0.45,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="w-full max-w-xs flex flex-col items-center text-center"
      >
        {/* Precision Gauge Ring + User Star Emblem (matches SplashScreen) */}
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center">
          <svg
            viewBox="0 0 144 144"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full -rotate-90"
          >
            <circle
              cx="72"
              cy="72"
              r="62"
              fill="none"
              stroke="rgba(17,19,21,0.07)"
              strokeWidth="1.25"
            />
            <circle
              cx="72"
              cy="72"
              r="62"
              fill="none"
              stroke="#111315"
              strokeOpacity="0.85"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <motion.circle
              cx="72"
              cy="72"
              r="54"
              fill="none"
              stroke="#FF5A1F"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeDasharray="20 320"
              initial={{ opacity: 0.72, rotate: 0 }}
              animate={
                prefersReducedMotion
                  ? { opacity: 0.72 }
                  : { opacity: 0.78, rotate: 360 }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0.2 }
                  : {
                      rotate: {
                        duration: 9,
                        repeat: Infinity,
                        ease: 'linear',
                      },
                    }
              }
              style={{ transformOrigin: '72px 72px' }}
            />
          </svg>

          <div className="relative w-[76px] h-[76px] sm:w-[84px] sm:h-[84px] flex items-center justify-center">
            {logoError ? (
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full text-[#111315]"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M47 8h6v24c0 9 7 15 15 15h24v6H68c-8 0-15 7-15 15v24h-6V68c0-8-7-15-15-15H8v-6h24c8 0 15-7 15-15V8z"
                />
              </svg>
            ) : (
              <img
                src="/inflate-mark.png"
                alt="Inflate emblem"
                referrerPolicy="no-referrer"
                draggable={false}
                onError={() => setLogoError(true)}
                className="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(17,19,21,0.08)]"
              />
            )}
          </div>
        </div>

        {/* Brand Wordmark matching SplashScreen letterpress */}
        <h1
          aria-label="INFLATE"
          className="mt-5 flex items-center justify-center py-1"
        >
          {BRAND_LETTERS.map((char, index) => (
            <span
              key={`${char}-${index}`}
              className={`font-brand text-[26px] sm:text-[30px] text-[#111315] leading-none inline-block ${
                index < BRAND_LETTERS.length - 1 ? 'mr-[0.38em]' : ''
              }`}
            >
              {char}
            </span>
          ))}
        </h1>

        {authError && (
          <p className="mt-5 w-full text-xs text-[#D9480F] bg-[#FFF4EE]/90 border border-[#FF5A1F]/20 rounded-2xl px-3.5 py-2.5 text-center">
            {authError}
          </p>
        )}

        <button
          type="button"
          onClick={onSignIn}
          disabled={busy}
          className="mt-8 w-full max-w-[230px] h-12 px-6 rounded-full bg-[#111315] text-white font-display text-sm font-medium tracking-wide shadow-[0_10px_28px_rgba(17,19,21,0.16)] hover:bg-[#1D2126] active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111315] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F3F4F2] whitespace-nowrap"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path
                fill="#ffffff"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
          )}
          <span>{busy ? 'Signing in...' : 'Sign in'}</span>
        </button>
      </motion.div>
    </div>
  );
}
