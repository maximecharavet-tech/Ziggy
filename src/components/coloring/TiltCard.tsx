'use client';

import type { ReactNode } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

/** A card that tilts in 3D towards the pointer / finger, with a soft moving shine. */
export function TiltCard({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 220, damping: 20 });
  const sy = useSpring(py, { stiffness: 220, damping: 20 });
  const rotateY = useTransform(sx, [0, 1], [-11, 11]);
  const rotateX = useTransform(sy, [0, 1], [9, -9]);
  const shineX = useTransform(sx, [0, 1], ['0%', '100%']);
  const shineY = useTransform(sy, [0, 1], ['0%', '100%']);
  const shine = useMotionTemplate`radial-gradient(circle at ${shineX} ${shineY}, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%)`;

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const leave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      className={`group relative [perspective:900px] ${className}`}
      initial={{ opacity: 0, y: reduce ? 0 : 24, scale: reduce ? 1 : 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay, ease: [0.23, 1, 0.32, 1] }}
      onPointerMove={track}
      onPointerLeave={leave}
      onPointerUp={leave}
    >
      <motion.div
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
        whileHover={reduce ? undefined : { scale: 1.03 }}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        className="relative h-full rounded-[1.75rem]"
      >
        {children}
        {!reduce && <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ backgroundImage: shine }} />}
      </motion.div>
    </motion.div>
  );
}
