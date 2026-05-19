'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface StarBurstProps {
  trigger: boolean;
  x?: number;
  y?: number;
}

export function StarBurst({ trigger, x = 0, y = 0 }: StarBurstProps) {
  const stars = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    return { id: i, endX: Math.cos(angle) * 60, endY: Math.sin(angle) * 60 };
  });

  return (
    <AnimatePresence>
      {trigger && (
        <div className="pointer-events-none absolute" style={{ left: x, top: y }}>
          {stars.map((star) => (
            <motion.span
              key={star.id}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x: star.endX, y: star.endY, scale: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute text-lg"
            >
              ⭐
            </motion.span>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
