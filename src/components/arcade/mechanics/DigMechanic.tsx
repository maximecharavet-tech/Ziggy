'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { Confetti } from '@/components/ui/Confetti';
import { digTilesFor, shuffle } from '../logic';
import { ChoiceQuestion } from './ChoiceQuestion';
import { ArcadeButton, Hint, POP, RoundProgress, Stage, alpha, useFinishIfEmpty, useGameRun } from './shared';
import { ui } from '../ui-text';

const GRID = 4;
const TILES = GRID * GRID;
const SAND = ['#E9C77B', '#E2BC6C', '#DDB463', '#EDCD86'];

export function DigMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const items = content.kind === 'dig' ? content.items : [];
  const total = items.length;
  const run = useGameRun(total, onFinish, onAnswer);
  useFinishIfEmpty(total, run.finish);

  const [index, setIndex] = useState(0);
  const [order] = useState(() => shuffle(Array.from({ length: TILES }, (_, i) => i)));
  const [uncovered, setUncovered] = useState(0);
  const [found, setFound] = useState(false);

  if (content.kind !== 'dig') return null;
  const { find } = content;
  const item = items[index];
  const cleared = new Set(order.slice(0, found ? TILES : uncovered));

  const answer = (right: boolean) => {
    run.answer(right);
    setUncovered((u) => Math.min(TILES, u + digTilesFor(right, TILES, total)));
  };

  const next = () => {
    if (index + 1 >= total) {
      setFound(true);
      playSound('reward');
    } else setIndex((i) => i + 1);
  };

  return (
    <Stage color={color}>
      <Confetti trigger={found} />
      <RoundProgress index={found ? total : index} total={total} color={color} locale={locale} />

      <div className={`grid gap-5 ${found ? '' : 'md:grid-cols-[minmax(0,260px)_1fr]'} items-start`}>
        {/* Dig site */}
        <div className="flex flex-col items-center gap-2">
          <motion.div
            layout
            transition={POP}
            className={`relative aspect-square ${found ? 'w-64 sm:w-72' : 'w-48 sm:w-56 md:w-full'} max-w-[288px] rounded-3xl overflow-hidden border-4`}
            style={{
              borderColor: alpha(color, '40'),
              background: `radial-gradient(circle at 50% 55%, #FFF7E6, #F3DDB0)`,
            }}
            role="img"
            aria-label={found ? `${find.emoji} ${find.name}` : `${ui('sand', locale)} ${TILES - cleared.size}/${TILES}`}
          >
            <motion.span
              className="absolute inset-0 flex items-center justify-center text-[7rem] sm:text-[8rem] leading-none select-none"
              animate={found ? { scale: [1, 1.15, 1], rotate: [0, -6, 6, 0] } : { scale: 1 }}
              transition={{ duration: 0.9 }}
              aria-hidden="true"
            >
              {find.emoji}
            </motion.span>
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }} dir="ltr" aria-hidden="true">
              {Array.from({ length: TILES }, (_, i) => (
                <AnimatePresence key={i}>
                  {!cleared.has(i) && (
                    <motion.span
                      initial={false}
                      exit={{ opacity: 0, scale: 0.4, y: -14, rotate: 20 }}
                      transition={{ duration: 0.35, delay: (i % 5) * 0.03 }}
                      className="block border border-black/5"
                      style={{
                        backgroundColor: SAND[(i * 7) % SAND.length],
                        backgroundImage: 'radial-gradient(circle at 30% 30%, #ffffff40 0 2px, transparent 3px), radial-gradient(circle at 70% 65%, #00000014 0 2px, transparent 3px)',
                      }}
                    />
                  )}
                </AnimatePresence>
              ))}
            </div>
          </motion.div>
          {!found && <Hint>⛏️ {ui('digHint', locale)}</Hint>}
        </div>

        {/* Question / celebration */}
        <AnimatePresence mode="wait">
          {found ? (
            <motion.div
              key="found"
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={POP}
              className="flex flex-col items-center text-center gap-2"
              role="status"
              aria-live="polite"
            >
              <div className="text-3xl font-extrabold" style={{ color }}>
                🎉 {ui('found', locale)}
              </div>
              <div className="text-lg text-text-body">
                {ui('youFound', locale)} <strong>{find.name}</strong> {find.emoji}
              </div>
              <div className="mt-3">
                <ArcadeButton color={color} onClick={() => run.finish()} autoFocus>
                  {ui('continue', locale)} →
                </ArcadeButton>
              </div>
            </motion.div>
          ) : (
            item && (
              <motion.div key={index} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
                <ChoiceQuestion
                  item={item}
                  color={color}
                  locale={locale}
                  round={index}
                  isLast={index + 1 >= total}
                  onAnswer={answer}
                  onNext={next}
                />
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </Stage>
  );
}
