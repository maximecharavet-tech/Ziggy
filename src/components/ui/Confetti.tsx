'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#7FC85C', '#5FB6EA', '#F2647B', '#FBBF24', '#A78BFA', '#4FC9C0'];

interface Piece {
  id: number;
  x: number;
  rotate: number;
  delay: number;
  color: string;
  drift: number;
}

/**
 * A burst of paper for a win. Purely decorative, so it sits behind
 * aria-hidden and respects reduced-motion by simply not rendering.
 */
export function Confetti({ trigger, count = 40 }: { trigger: boolean; count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!trigger) {
      setPieces([]);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setPieces(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        rotate: Math.random() * 720 - 360,
        delay: Math.random() * 0.35,
        color: COLORS[i % COLORS.length],
        drift: Math.random() * 80 - 40,
      }))
    );

    const timer = setTimeout(() => setPieces([]), 2600);
    return () => clearTimeout(timer);
  }, [trigger, count]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {pieces.map((p) => (
          <motion.span
            key={p.id}
            initial={{ top: '-8%', left: `${p.x}%`, opacity: 1, rotate: 0 }}
            animate={{ top: '108%', left: `calc(${p.x}% + ${p.drift}px)`, opacity: [1, 1, 0], rotate: p.rotate }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.9 + Math.random() * 0.7, delay: p.delay, ease: 'easeIn' }}
            className="absolute w-2 h-3 rounded-[2px]"
            style={{ backgroundColor: p.color }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
