'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { SPRING, STAGGER, pointerFine } from '@/lib/motion';

/**
 * Pulled gently toward the cursor. The spring keeps it interruptible: the
 * pointer can change direction mid-way without the motion restarting.
 */
export function Magnetic({
  children,
  strength = 0.28,
  className = '',
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 22, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 260, damping: 22, mass: 0.4 });

  const onMove = (e: React.PointerEvent) => {
    if (reduce || !pointerFine()) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x: sx, y: sy, display: 'inline-flex' }}
      className={className}
    >
      {children}
    </motion.span>
  );
}

/** A small tilt on hover: past a few degrees a card stops being an object. */
export function Tilt({ children, max = 5, className = '' }: { children: ReactNode; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 220, damping: 20 });
  const sry = useSpring(ry, { stiffness: 220, damping: 20 });

  const onMove = (e: React.PointerEvent) => {
    if (reduce || !pointerFine()) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    ry.set(((e.clientX - r.left) / r.width - 0.5) * max * 2);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * A glow that follows the cursor inside a card. Coordinates go into two CSS
 * variables rather than React state, so nothing re-renders.
 */
export function Spotlight({
  children,
  className = '',
  color,
  style,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    if (!pointerFine()) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={`spotlight ${className}`}
      style={{ ...(color ? ({ '--spot': color } as CSSProperties) : {}), ...style }}
    >
      {children}
    </div>
  );
}

/** A number that springs to its target; interruptible when the data changes. */
export function SpringNumber({
  value,
  format = (v: number) => Math.round(v).toLocaleString(),
  className = '',
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, SPRING);
  const text = useTransform(spring, (v) => format(v));
  useEffect(() => {
    mv.set(value);
  }, [mv, value]);
  if (reduce) return <span className={className}>{format(value)}</span>;
  return <motion.span className={className}>{text}</motion.span>;
}

/**
 * A headline that rises word by word. Pure CSS, so it plays on the first frame
 * without waiting for hydration — the largest element is painted at once.
 */
export function SplitWords({ text, className = '', delay = 0 }: { text: string; className?: string; delay?: number }) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`}>
          <span className="word-mask">
            <span className="word-rise" style={{ '--word-delay': `${delay + i * STAGGER}s` } as CSSProperties}>
              {w}
            </span>
          </span>
          {/* The space stays outside the mask, or overflow:hidden eats it. */}
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  );
}
