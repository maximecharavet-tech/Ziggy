'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { sparkleAt } from './effects';

type Ripple = { id: number; x: number; y: number; size: number };

export interface TapRippleOptions {
  /** Ripple colour (default: the text colour, softly). */
  color?: string;
  /** Peak opacity of the ripple. */
  opacity?: number;
  /** A few tiny sparkles fly from the finger (default on). */
  sparkles?: boolean;
  disabled?: boolean;
}

export const RIPPLE_MS = 520;
const MAX_RIPPLES = 3;

/**
 * A soft ripple from where the finger landed, plus a pinch of sparkles.
 * Returns the handler to call on press and the layer to render inside the
 * pressed element (which must be `position: relative`). The layer clips to the
 * element's rounded corners, never catches a tap and is hidden from screen
 * readers. Under reduced motion it is a quick, still highlight.
 */
export function useTapRipple({ color = 'currentColor', opacity = 0.24, sparkles = true, disabled = false }: TapRippleOptions = {}) {
  const reduced = useReducedMotion();
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const seq = useRef(0);

  const ripple = useCallback(
    (target: HTMLElement | null, clientX?: number, clientY?: number) => {
      if (disabled || !target) return;
      const r = target.getBoundingClientRect();
      // Keyboard presses have no finger: the ripple starts from the middle.
      const fromPoint = typeof clientX === 'number' && typeof clientY === 'number' && (clientX !== 0 || clientY !== 0);
      const x = fromPoint ? clientX - r.left : r.width / 2;
      const y = fromPoint ? clientY! - r.top : r.height / 2;
      const size = 2 * Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y));
      seq.current += 1;
      const id = seq.current;
      setRipples((list) => [...list.slice(-(MAX_RIPPLES - 1)), { id, x, y, size }]);
      if (sparkles && !reduced) {
        sparkleAt({ x: r.left + x, y: r.top + y }, { count: 4, kinds: ['sparkle', 'star'], speed: 170, size: 8, life: 0.42, ui: true });
      }
    },
    [disabled, reduced, sparkles],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      ripple(e.currentTarget, e.clientX, e.clientY);
    },
    [ripple],
  );

  const remove = (id: number) => setRipples((list) => list.filter((r) => r.id !== id));

  const layer: ReactNode = ripples.length ? (
    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
      {ripples.map((r) =>
        reduced ? (
          <motion.span
            key={r.id}
            className="absolute inset-0"
            style={{ backgroundColor: color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, opacity * 0.6, 0] }}
            transition={{ duration: 0.3 }}
            onAnimationComplete={() => remove(r.id)}
          />
        ) : (
          <motion.span
            key={r.id}
            className="absolute rounded-full"
            style={{ left: r.x - r.size / 2, top: r.y - r.size / 2, width: r.size, height: r.size, backgroundColor: color }}
            initial={{ scale: 0, opacity }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: RIPPLE_MS / 1000, ease: [0.23, 1, 0.32, 1], opacity: { duration: RIPPLE_MS / 1000, ease: [0.5, 0, 0.75, 0] } }}
            onAnimationComplete={() => remove(r.id)}
          />
        ),
      )}
    </span>
  ) : null;

  return { onPointerDown, ripple, layer };
}

/** Wraps anything in a tappable area that ripples (for cards and tiles without a Button). */
export function TapRipple({ children, className = '', ...opts }: TapRippleOptions & { children: ReactNode; className?: string }) {
  const { onPointerDown, layer } = useTapRipple(opts);
  return (
    <span className={`relative block ${className}`} onPointerDown={onPointerDown}>
      {children}
      {layer}
    </span>
  );
}
