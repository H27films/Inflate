import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

const BRAND_LETTERS = ['I', 'N', 'F', 'L', 'A', 'T', 'E'];

interface SplashScreenProps {
  stillLoading?: boolean;
  interactive?: boolean;
  onDismiss?: () => void;
}

export function SplashScreen({
  stillLoading = false,
  interactive = false,
  onDismiss,
}: SplashScreenProps) {
  const prefersReducedMotion = useReducedMotion();
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (!interactive || !onDismiss) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interactive, onDismiss]);

  return (
    <motion.div
      role={interactive ? 'button' : 'status'}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? 'Inflate intro screen. Tap anywhere to return' : 'Loading Inflate'}
      onClick={interactive ? onDismiss : undefined}
      initial={{ opacity: interactive ? 0 : 1 }}
      animate={{
        opacity: 1,
        transition: { duration: prefersReducedMotion ? 0.18 : 0.38, ease: [0.22, 1, 0.36, 1] },
      }}
      exit={{
        opacity: 0,
        scale: prefersReducedMotion ? 1 : 1.025,
        transition: {
          duration: prefersReducedMotion ? 0.18 : 0.5,
          ease: [0.22, 1, 0.36, 1],
        },
      }}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 bg-[#F3F4F2] text-[#111315] select-none overflow-hidden focus:outline-none ${
        interactive ? 'cursor-pointer' : ''
      }`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 44%, rgba(255,255,255,0.84) 0%, rgba(243,244,242,0.92) 52%, rgba(226,229,223,0.9) 100%)',
      }}
    >
      <div className="relative flex flex-col items-center">
        {/* Precision Gauge Ring + User Star Emblem */}
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center">
          {/* Outer subtle dial ring */}
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
            <motion.circle
              cx="72"
              cy="72"
              r="62"
              fill="none"
              stroke="#111315"
              strokeWidth="1.5"
              strokeLinecap="round"
              initial={{ pathLength: prefersReducedMotion ? 1 : 0, opacity: 0.25 }}
              animate={{ pathLength: 1, opacity: 0.85 }}
              transition={{
                pathLength: {
                  duration: prefersReducedMotion ? 0.2 : 1.45,
                  ease: [0.22, 1, 0.36, 1],
                },
                opacity: { duration: 0.5 },
              }}
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
              initial={{ opacity: 0, rotate: 0 }}
              animate={
                prefersReducedMotion
                  ? { opacity: 0.7 }
                  : interactive
                    ? { opacity: 0.78, rotate: 360 }
                    : { opacity: [0, 0.9, 0.6], rotate: [0, 220, 360] }
              }
              transition={
                interactive && !prefersReducedMotion
                  ? {
                      opacity: { duration: 0.6 },
                      rotate: { duration: 7.5, repeat: Infinity, ease: 'linear' },
                    }
                  : {
                      duration: 2.0,
                      ease: [0.22, 1, 0.36, 1],
                    }
              }
              style={{ transformOrigin: '72px 72px' }}
            />
          </svg>

          {/* User-provided Inflate 4-point star emblem */}
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.65, rotate: -45 }
            }
            animate={
              interactive && !prefersReducedMotion
                ? { opacity: 1, scale: [1, 1.035, 1], rotate: 0 }
                : { opacity: 1, scale: 1, rotate: 0 }
            }
            transition={
              interactive && !prefersReducedMotion
                ? {
                    opacity: { duration: 0.7 },
                    rotate: { duration: 1.0, ease: [0.16, 1, 0.3, 1] },
                    scale: {
                      delay: 1.0,
                      duration: 4.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    },
                  }
                : {
                    duration: prefersReducedMotion ? 0.2 : 1.0,
                    ease: [0.16, 1, 0.3, 1],
                  }
            }
            className="relative w-[76px] h-[76px] sm:w-[84px] sm:h-[84px] flex items-center justify-center"
          >
            {logoError ? (
              <svg viewBox="0 0 100 100" className="w-full h-full text-[#111315]" aria-hidden="true">
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
          </motion.div>
        </div>

        {/* Staggered Letterpress Brand Wordmark */}
        <div
          aria-label="INFLATE"
          className="mt-5 flex items-center justify-center overflow-hidden py-1"
        >
          {BRAND_LETTERS.map((char, index) => (
            <motion.span
              key={`${char}-${index}`}
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { y: '115%', opacity: 0 }
              }
              animate={{ y: '0%', opacity: 1 }}
              transition={{
                duration: prefersReducedMotion ? 0.15 : 0.65,
                delay: prefersReducedMotion ? 0 : 0.34 + index * 0.065,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`font-brand text-[26px] sm:text-[30px] text-[#111315] leading-none inline-block ${
                index < BRAND_LETTERS.length - 1 ? 'mr-[0.38em]' : ''
              }`}
            >
              {char}
            </motion.span>
          ))}
        </div>

        {/* Expanding precision hairline rule (shown only on manual INFLATE intro screen) */}
        {interactive && (
          <motion.div
            aria-hidden="true"
            initial={{ scaleX: prefersReducedMotion ? 1 : 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{
              duration: prefersReducedMotion ? 0.15 : 0.75,
              delay: prefersReducedMotion ? 0 : 0.85,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-3.5 h-px w-36 bg-black/12 origin-center"
          />
        )}

        {/* Boot progress sweep bar (non-interactive boot splash only) */}
        {!interactive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : 1.05, duration: 0.35 }}
            className="mt-6 w-28 h-[2px] rounded-full bg-black/8 overflow-hidden"
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={
                stillLoading
                  ? { x: ['-100%', '100%'] }
                  : { x: '0%' }
              }
              transition={
                stillLoading
                  ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: prefersReducedMotion ? 0.2 : 1.6, delay: 1.1, ease: [0.22, 1, 0.36, 1] }
              }
              className="w-full h-full rounded-full bg-[#111315]"
            />
          </motion.div>
        )}
      </div>

      {/* Tap-to-return cue anchored at the bottom in black (interactive mode only) */}
      {interactive && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: [0.65, 1, 0.65] }
          }
          transition={
            prefersReducedMotion
              ? { delay: 0.2, duration: 0.2 }
              : {
                  delay: 1.2,
                  duration: 2.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
          }
          className="absolute inset-x-0 bottom-[calc(2.25rem+env(safe-area-inset-bottom))] text-center text-xs font-medium tracking-wide text-[#111315]"
        >
          Tap anywhere to return
        </motion.p>
      )}
    </motion.div>
  );
}
