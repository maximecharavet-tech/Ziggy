'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { isLowPower } from './fx/env';

const EMOJIS = ['✨', '🌟', '🧠', '🎨', '📐', '🚀', '💡', '🎯', '🤖', '⭐'];

interface FloatingItem {
  id: number;
  emoji: string;
  x: number;
  delay: number;
  duration: number;
  size: number;
  sway: number;
  tilt: number;
}

/**
 * Emojis drifting up behind a section, swaying a little as they rise. Purely
 * decorative: click-through, hidden from screen readers, fewer on phones and
 * weak devices, stopped while off screen, and absent under reduced motion.
 * Items are drawn after mount, so the server and the first render agree.
 */
export function FloatingEmoji({ count = 6, className = '' }: { count?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [items, setItems] = useState<FloatingItem[]>([]);
  const [height, setHeight] = useState(0);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    setHeight(el.offsetHeight || 400);
    const small = window.innerWidth < 768;
    const n = Math.max(1, Math.round(count * (small ? 0.5 : 1) * (isLowPower() ? 0.6 : 1)));
    setItems(
      Array.from({ length: n }, (_, i) => ({
        id: i,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        x: 4 + Math.random() * 92,
        delay: Math.random() * 6,
        duration: 10 + Math.random() * 10,
        size: 16 + Math.random() * 16,
        sway: 10 + Math.random() * 18,
        tilt: 6 + Math.random() * 10,
      })),
    );
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
  }, [count, reduced]);

  const live = !reduced && onScreen && height > 0;

  return (
    <div ref={ref} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {live
        ? items.map((item) => (
            <motion.span
              key={item.id}
              className="absolute top-0"
              style={{ fontSize: item.size, left: `${item.x}%` }}
              initial={{ y: height + 40, x: 0, rotate: 0, opacity: 0 }}
              animate={{
                y: [height + 40, -60],
                x: [0, item.sway, -item.sway * 0.6, 0],
                rotate: [-item.tilt, item.tilt, -item.tilt * 0.5],
                opacity: [0, 0.6, 0.6, 0],
              }}
              transition={{
                duration: item.duration,
                delay: item.delay,
                repeat: Infinity,
                repeatDelay: 1 + (item.id % 3),
                ease: 'linear',
                x: { duration: item.duration, delay: item.delay, repeat: Infinity, repeatDelay: 1 + (item.id % 3), ease: 'easeInOut' },
                rotate: { duration: item.duration, delay: item.delay, repeat: Infinity, repeatDelay: 1 + (item.id % 3), ease: 'easeInOut' },
              }}
            >
              {item.emoji}
            </motion.span>
          ))
        : null}
    </div>
  );
}
