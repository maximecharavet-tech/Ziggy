'use client';

import { createContext, useContext, useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'framer-motion';

type Pointer = { x: MotionValue<number>; y: MotionValue<number> };
const Ctx = createContext<Pointer | null>(null);

const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

/** True when the device has a fine pointer that can hover (no parallax on touch: layers float on their own). */
function finePointer() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/**
 * The pointer position over a box, from -1 to 1 on each axis, smoothed by a
 * spring. With `global`, the whole window drives it (hero scenes); otherwise
 * only the pointer over the box (cards). Nothing moves on touch screens or
 * with reduced motion.
 */
export function usePointerDepth<T extends HTMLElement = HTMLDivElement>({ global = false }: { global?: boolean } = {}) {
  const ref = useRef<T>(null);
  const reduce = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 140, damping: 20, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 140, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (!global || reduce || !finePointer()) return;
    const move = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      rawX.set(clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      rawY.set(clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [global, reduce, rawX, rawY]);

  const handlers =
    global || reduce
      ? {}
      : {
          onPointerMove: (e: React.PointerEvent<T>) => {
            if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
            const r = e.currentTarget.getBoundingClientRect();
            rawX.set(clamp(((e.clientX - r.left) / r.width) * 2 - 1));
            rawY.set(clamp(((e.clientY - r.top) / r.height) * 2 - 1));
          },
          onPointerLeave: () => {
            rawX.set(0);
            rawY.set(0);
          },
        };

  return { ref, x, y, handlers };
}

/** Gives the pointer depth to the layers inside. */
export function DepthProvider({ x, y, children }: Pointer & { children: ReactNode }) {
  return <Ctx.Provider value={{ x, y }}>{children}</Ctx.Provider>;
}

/**
 * A layer of a diorama: it slides with the pointer by `depth` pixels (near
 * layers more, far layers less; negative goes the other way). Put loops
 * (float, sway…) on an element inside, not on the layer itself.
 */
export function Layer({ depth, className = '', style, children, interactive = false }: { depth: number; className?: string; style?: CSSProperties; children?: ReactNode; interactive?: boolean }) {
  const ctx = useContext(Ctx);
  const zero = useMotionValue(0);
  const tx = useTransform(ctx?.x ?? zero, (v) => v * depth);
  const ty = useTransform(ctx?.y ?? zero, (v) => v * depth * 0.7);
  return (
    <motion.div aria-hidden={interactive ? undefined : true} className={`absolute ${interactive ? '' : 'pointer-events-none'} ${className}`} style={{ ...style, x: tx, y: ty }}>
      {children}
    </motion.div>
  );
}

/** A 3D tilt from the pointer depth (degrees). */
export function useTilt({ x, y }: Pointer, max = 8) {
  const rotateY = useTransform(x, [-1, 1], [-max, max]);
  const rotateX = useTransform(y, [-1, 1], [max, -max]);
  return { rotateX, rotateY };
}

/** Pause the CSS loops of a section while it is off screen (put `data-still` when false). */
export function useAwake(ref: RefObject<Element | null>) {
  return useInView(ref, { margin: '160px 0px' });
}
