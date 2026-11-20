'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { EASE_OUT } from '@/lib/motion';
import { flashGuard } from './fx/flash-guard';
import { installActivity, lastTap, now, recentGesture, reducedMotionNow } from './fx/env';
import { fxSound } from './fx/sfx';

const noop = () => () => {};
/** False on the server and while the server page hydrates; true when React builds the page after a client-side navigation. */
const useClientRender = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/** The whole transition stays under 350 ms. */
export const PAGE_TRANSITION_MS = 340;
const BLOBS = [
  { color: '#7FC85C', size: 150, delay: 0 },
  { color: '#5FB6EA', size: 110, delay: 0.04 },
  { color: '#FBBF24', size: 80, delay: 0.08 },
];

/**
 * A playful, fast page entrance. On the first load nothing waits: the server
 * HTML is shown as is (no hidden content until hydration). After a navigation
 * the page rises in, and three soft Ziggy-coloured blobs pop from where the
 * child tapped, with the 'pageIn' sound when the navigation came from a tap or
 * a key. Everything is click-through and over in 340 ms; the blobs never cover
 * the screen (no flash) and are skipped under reduced motion, where the page
 * only fades in.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const clientRender = useClientRender();
  // Decided once, on the first render: a hydrated page never plays the entrance.
  const [fromNavigation] = useState(clientRender);
  const [splash, setSplash] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    installActivity();
    if (!fromNavigation) return;
    if (recentGesture()) fxSound('pageIn');
    if (reducedMotionNow() || !flashGuard.tryFlash(now())) return;
    setSplash(lastTap() ?? { x: window.innerWidth / 2, y: Math.min(120, window.innerHeight / 4) });
    const t = window.setTimeout(() => setSplash(null), PAGE_TRANSITION_MS + 60);
    return () => window.clearTimeout(t);
  }, [fromNavigation]);

  return (
    <>
      {splash ? (
        <div className="pointer-events-none fixed inset-0 z-[119] overflow-hidden" aria-hidden="true">
          {BLOBS.map((b) => (
            <motion.span
              key={b.color}
              className="absolute rounded-full"
              style={{
                left: splash.x - b.size / 2,
                top: splash.y - b.size / 2,
                width: b.size,
                height: b.size,
                background: `radial-gradient(circle, ${b.color} 0%, ${b.color}cc 45%, transparent 70%)`,
              }}
              initial={{ scale: 0.2, opacity: 0.55 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: (PAGE_TRANSITION_MS - b.delay * 1000) / 1000, delay: b.delay, ease: EASE_OUT }}
            />
          ))}
        </div>
      ) : null}
      <motion.div
        initial={fromNavigation ? { opacity: 0, y: 14, scale: 0.992 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: EASE_OUT, opacity: { duration: 0.2 } }}
      >
        {children}
      </motion.div>
    </>
  );
}
