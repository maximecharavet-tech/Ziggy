'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJIS = ['✨', '🌟', '🧠', '🎨', '📐', '🚀', '💡', '🎯', '🤖', '⭐'];

interface FloatingItem {
  id: number;
  emoji: string;
  x: number;
  delay: number;
  duration: number;
  size: number;
}

export function FloatingEmoji({ count = 6, className = '' }: { count?: number; className?: string }) {
  const [items, setItems] = useState<FloatingItem[]>([]);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const n = isMobile ? Math.floor(count * 0.5) : count;

    const generateItems = () =>
      Array.from({ length: n }, (_, i) => ({
        id: Date.now() + i,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        x: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 8 + Math.random() * 12,
        size: 16 + Math.random() * 16,
      }));

    setItems(generateItems());

    const interval = setInterval(() => setItems(generateItems()), 20000);
    return () => clearInterval(interval);
  }, [count]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <AnimatePresence>
        {items.map((item) => (
          <motion.span
            key={item.id}
            initial={{ opacity: 0, y: '110%', x: `${item.x}%` }}
            animate={{ opacity: [0, 0.6, 0.6, 0], y: '-10%' }}
            transition={{ duration: item.duration, delay: item.delay, ease: 'linear' }}
            className="absolute"
            style={{ fontSize: item.size, left: `${item.x}%` }}
          >
            {item.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
