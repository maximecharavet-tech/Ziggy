'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { flashGuard } from './flash-guard';
import { now } from './env';

export interface JuicySurfaceProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Hover lift in px (desktop only). */
  lift?: number;
  /** A soft light sweep on hover (desktop only). */
  sheen?: boolean;
  /** Squish when pressed (touch and mouse). */
  squish?: boolean;
}

const HOVER_SPRING = { type: 'spring', stiffness: 380, damping: 20, mass: 0.8 } as const;
const PRESS_SPRING = { type: 'spring', stiffness: 700, damping: 18, mass: 0.6 } as const;

/**
 * The springy surface under Card and GlowCard: lifts on hover with a light
 * sheen (mouse only: motion's hover ignores touch), squishes under a finger,
 * springs back with a little bounce. Nothing moves under reduced motion.
 */
export function JuicySurface({ children, className = '', style, lift = 6, sheen = true, squish = true }: JuicySurfaceProps) {
  const reduced = useReducedMotion();
  const [sweep, setSweep] = useState(0);
  return (
    <motion.div
      className={`relative ${className}`}
      style={style}
      whileHover={reduced ? undefined : { y: -lift, scale: 1.012, transition: HOVER_SPRING }}
      whileTap={reduced || !squish ? undefined : { scale: 0.975, y: -1, transition: PRESS_SPRING }}
      transition={HOVER_SPRING}
      onHoverStart={() => {
        // Sweeping the mouse across a grid must not light cards up faster than 3 a second.
        if (!reduced && sheen && flashGuard.tryFlash(now())) setSweep((n) => n + 1);
      }}
    >
      {children}
      {sweep > 0 ? (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
          <motion.span
            key={sweep}
            className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)' }}
            initial={{ x: '0%', opacity: 0 }}
            animate={{ x: '400%', opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          />
        </span>
      ) : null}
    </motion.div>
  );
}
