'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ziggyPose, type ZiggyPose } from '@/data/santa/ziggy-lutin';

export type ZiggyCallState = 'hidden' | ZiggyPose;

/**
 * Ziggy the elf pops in beside Santa during the call (2D art), reacts when
 * Santa laughs, cheers while the child talks, and waves at the end. Renders
 * nothing until the art is in public/santa/art/ziggy-lutin (the 3D elf of the
 * office scene plays the part then).
 */
export function ZiggyLutin({ state, reduced }: { state: ZiggyCallState; reduced: boolean }) {
  const shown = state !== 'hidden';
  const src = ziggyPose(shown ? state : 'idle');
  if (!src) return null;
  const move =
    reduced || !shown
      ? {}
      : state === 'laughing'
        ? { y: [0, -14, 0, -8, 0], rotate: [0, -3, 3, -2, 0], transition: { duration: 0.9, repeat: Infinity, repeatDelay: 0.4 } }
        : state === 'waving'
          ? { rotate: [0, -4, 4, -4, 0], transition: { duration: 1.2, repeat: Infinity } }
          : state === 'talking'
            ? { scale: [1, 1.03, 1], transition: { duration: 0.7, repeat: Infinity } }
            : { y: [0, -5, 0], transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' as const } };
  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key="ziggy"
          className="pointer-events-none absolute bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+10.5rem)] left-1 z-[5] w-[28vw] max-w-[200px] sm:left-6"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 120, scale: 0.6, rotate: -10 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 140, scale: 0.7 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          aria-hidden="true"
        >
          <motion.div animate={move} style={{ transformOrigin: '50% 90%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-encoded transparent WebP */}
            <img src={src} alt="" className="h-auto w-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]" draggable={false} decoding="async" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
