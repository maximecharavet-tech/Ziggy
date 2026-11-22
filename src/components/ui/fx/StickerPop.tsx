'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { fxSound, type FxSound } from './sfx';

export interface StickerPopProps {
  children: ReactNode;
  /** Pops in when true (default), shrinks away when false. */
  show?: boolean;
  /** Seconds before the pop. */
  delay?: number;
  /** The sticker's resting tilt, degrees. */
  rotate?: number;
  /** Sound at the pop (default 'plop'; false for none). */
  sound?: FxSound | false;
  /** White die-cut outline and a soft shadow, like a real sticker (default on). */
  outline?: boolean;
  className?: string;
  onPopped?: () => void;
}

export const STICKER_POP_MS = 620;

const OUTLINE =
  'drop-shadow(1.5px 0 0 #fff) drop-shadow(-1.5px 0 0 #fff) drop-shadow(0 1.5px 0 #fff) drop-shadow(0 -1.5px 0 #fff) drop-shadow(0 4px 5px rgba(20,40,10,0.22))';

/**
 * A sticker slapped on: squash & stretch, a wobble, then it rests at a little
 * tilt. Transform and opacity only; under reduced motion it simply fades in.
 */
export function StickerPop({ children, show = true, delay = 0, rotate = -4, sound = 'plop', outline = true, className = '', onPopped }: StickerPopProps) {
  const reduced = useReducedMotion();
  const popped = useRef(onPopped);
  useEffect(() => {
    popped.current = onPopped;
  }, [onPopped]);

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => {
      fxSound(sound);
      popped.current?.();
    }, delay * 1000 + 90);
    return () => window.clearTimeout(t);
    // The sound is chosen at the moment of the pop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, delay]);

  const r = rotate;
  const shown = reduced
    ? { opacity: 1, scaleX: 1, scaleY: 1, rotate: r }
    : { opacity: 1, scaleX: [0.3, 1.25, 0.9, 1.05, 1], scaleY: [0.3, 0.8, 1.15, 0.97, 1], rotate: [r - 18, r + 8, r - 4, r + 1.5, r] };

  return (
    <motion.span
      className={`inline-block will-change-transform ${className}`}
      initial={{ opacity: 0, scaleX: 0.3, scaleY: 0.3, rotate: r - 18 }}
      animate={show ? shown : { opacity: 0, scaleX: 0.6, scaleY: 0.6, rotate: r }}
      transition={
        reduced
          ? { duration: 0.25, delay }
          : show
            ? { duration: STICKER_POP_MS / 1000, delay, times: [0, 0.32, 0.58, 0.8, 1], ease: 'easeOut', opacity: { duration: 0.12, delay } }
            : { duration: 0.2 }
      }
    >
      <span className="inline-block" style={outline ? { filter: OUTLINE } : undefined}>
        {children}
      </span>
    </motion.span>
  );
}
