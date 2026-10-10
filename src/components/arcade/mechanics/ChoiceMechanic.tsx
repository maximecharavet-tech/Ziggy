'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { ChoiceQuestion } from './ChoiceQuestion';
import { RoundProgress, Stage, useFinishIfEmpty, useGameRun } from './shared';

export function ChoiceMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const items = content.kind === 'choice' ? content.items : [];
  const total = items.length;
  const run = useGameRun(total, onFinish, onAnswer);
  const [index, setIndex] = useState(0);
  useFinishIfEmpty(total, run.finish);

  if (content.kind !== 'choice') return null;
  const item = items[Math.min(index, total - 1)];

  const next = () => {
    if (index + 1 >= total) run.finish();
    else setIndex((i) => i + 1);
  };

  if (!item) return null;

  return (
    <Stage color={color}>
      <RoundProgress index={index} total={total} color={color} locale={locale} />
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22 }}
        >
          <ChoiceQuestion
            item={item}
            color={color}
            locale={locale}
            round={index}
            isLast={index + 1 >= total}
            onAnswer={run.answer}
            onNext={next}
          />
        </motion.div>
      </AnimatePresence>
    </Stage>
  );
}
