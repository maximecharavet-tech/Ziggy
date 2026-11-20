'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { fxSound, type FxSound } from './sfx';
import { ShapeSvg, type SvgShape } from './svg-shapes';
import { useTrigger } from './use-trigger';

export interface SparkleBurstProps {
  /** Plays a burst each time this becomes a new truthy value (a counter, a timestamp, `true`). */
  trigger: unknown;
  /** Burst centre inside the nearest positioned parent (px or CSS length). Default: the middle. */
  x?: number | string;
  y?: number | string;
  /** Pieces (capped at 16). */
  count?: number;
  shapes?: readonly SvgShape[];
  colors?: readonly string[];
  /** How far the pieces fly, px. */
  radius?: number;
  /** Piece size, px. */
  size?: number;
  /** Optional sound with the burst (none by default: a burst is usually part of a bigger moment). */
  sound?: FxSound | false;
  className?: string;
  onDone?: () => void;
}

type Piece = { id: number; shape: SvgShape; color: string; dx: number; dy: number; rot: number; size: number; delay: number };

const DEFAULT_SHAPES: readonly SvgShape[] = ['star', 'sparkle', 'heart', 'sparkle'];
const DEFAULT_COLORS = ['#FBBF24', '#FFE58A', '#F472B6', '#7FC85C', '#5FB6EA'];
export const SPARKLE_BURST_MS = 700;

/**
 * Stars and hearts bursting from a point, in the DOM (so it lives inside a
 * card, a dialog or a scroll area). Click-through and hidden from screen
 * readers; under reduced motion a single sparkle simply fades in and out.
 * Positions are drawn in an effect, never during render (no hydration
 * mismatch).
 */
export function SparkleBurst({
  trigger,
  x = '50%',
  y = '50%',
  count = 10,
  shapes = DEFAULT_SHAPES,
  colors = DEFAULT_COLORS,
  radius = 56,
  size = 16,
  sound = false,
  className = '',
  onDone,
}: SparkleBurstProps) {
  const reduced = useReducedMotion();
  const [burst, setBurst] = useState<{ key: number; pieces: Piece[] } | null>(null);
  const seq = useRef(0);
  const timer = useRef(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useTrigger(trigger, () => {
    const n = Math.max(1, Math.min(16, Math.round(count)));
    const offset = Math.random() * Math.PI * 2;
    const pieces: Piece[] = Array.from({ length: n }, (_, i) => {
      const a = offset + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      const r = radius * (0.7 + Math.random() * 0.45);
      return {
        id: i,
        shape: shapes[i % shapes.length],
        color: colors[Math.floor(Math.random() * colors.length)],
        dx: Math.cos(a) * r,
        dy: Math.sin(a) * r,
        rot: (Math.random() - 0.5) * 160,
        size: size * (0.7 + Math.random() * 0.6),
        delay: Math.random() * 0.06,
      };
    });
    seq.current += 1;
    setBurst({ key: seq.current, pieces });
    fxSound(sound);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setBurst(null);
      done.current?.();
    }, SPARKLE_BURST_MS + 80);
  });

  if (!burst) return null;
  return (
    <span className={`pointer-events-none absolute z-10 ${className}`} style={{ left: x, top: y, width: 0, height: 0 }} aria-hidden="true">
      {reduced ? (
        <motion.span
          key={burst.key}
          className="absolute"
          style={{ left: -size, top: -size }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: SPARKLE_BURST_MS / 1000, ease: 'easeInOut' }}
        >
          <ShapeSvg shape="sparkle" color={colors[0] ?? '#FBBF24'} size={size * 2} />
        </motion.span>
      ) : (
        burst.pieces.map((p) => (
          <motion.span
            key={`${burst.key}-${p.id}`}
            className="absolute"
            style={{ left: -p.size / 2, top: -p.size / 2 }}
            initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
            animate={{ x: p.dx, y: p.dy, scale: [0, 1.25, 0.9, 0], rotate: p.rot, opacity: [1, 1, 1, 0] }}
            transition={{ duration: SPARKLE_BURST_MS / 1000, delay: p.delay, ease: [0.22, 1, 0.36, 1], times: [0, 0.25, 0.65, 1] }}
          >
            <ShapeSvg shape={p.shape} color={p.color} size={p.size} />
          </motion.span>
        ))
      )}
    </span>
  );
}
