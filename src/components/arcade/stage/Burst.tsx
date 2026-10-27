'use client';

import { motion, useReducedMotion } from 'framer-motion';

const SPARK = 'M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z';

/** Small deterministic random, so a burst looks the same on every render. */
function rand(seed: number) {
  let a = seed * 9301 + 49297;
  return () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
}

/**
 * A burst of sparkles and dots from the centre of its parent (which must be
 * positioned). Change `fire` (a counter) to fire again; 0 shows nothing.
 * Capped particle count, transform/opacity only, none for reduced motion.
 */
export function Burst({ fire, color = '#FBBF24', count = 14, spread = 110, className = '' }: { fire: number; color?: string; count?: number; spread?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (!fire || reduce) return null;
  const r = rand(fire);
  const n = Math.min(count, 24);
  const colors = ['#FBBF24', '#FFFFFF', color, '#4ADE80', '#F472B6', '#60A5FA'];
  return (
    <span key={fire} className={`pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0 ${className}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + r() * 0.5;
        const d = spread * (0.55 + r() * 0.6);
        const star = i % 3 !== 2;
        const size = star ? 12 + r() * 12 : 6 + r() * 6;
        const c = colors[i % colors.length];
        const rot = star ? (r() > 0.5 ? 160 : -160) : 0;
        return (
          <motion.span
            key={i}
            className="absolute"
            style={{ left: -size / 2, top: -size / 2, width: size, height: size }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: [0, Math.cos(a) * d * 0.85, Math.cos(a) * d],
              y: [0, Math.sin(a) * d - 10, Math.sin(a) * d + 26],
              scale: [0, 1.15, 0.4],
              opacity: [1, 1, 0],
              rotate: [0, rot * 0.6, rot],
            }}
            transition={{ duration: 0.85 + r() * 0.3, ease: 'easeOut', times: [0, 0.55, 1] }}
          >
            {star ? (
              <svg viewBox="0 0 24 24" width={size} height={size}>
                <path d={SPARK} fill={c} stroke={c === '#FFFFFF' ? '#FCD34D' : 'none'} strokeWidth={1} />
              </svg>
            ) : (
              <span className="block h-full w-full rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
            )}
          </motion.span>
        );
      })}
    </span>
  );
}

/** The four-point sparkle shape, as an inline SVG. */
export function SparkleIcon({ size = 16, color = '#FBBF24', className = '' }: { size?: number; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path d={SPARK} fill={color} />
    </svg>
  );
}
