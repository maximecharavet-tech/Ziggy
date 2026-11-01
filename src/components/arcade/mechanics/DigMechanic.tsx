'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { Confetti } from '@/components/ui/Confetti';
import { digTilesFor, shuffle } from '../logic';
import { ChoiceQuestion } from './ChoiceQuestion';
import { ArcadeButton, Hint, POP, RoundProgress, Stage, useFinishIfEmpty, useGameRun } from './shared';
import { Burst } from '../stage/Burst';
import { Sunburst, Title3D } from '../stage/Showpieces';
import { ui } from '../ui-text';
import { useAutoSay } from '../read-aloud';

const GRID = 4;
const TILES = GRID * GRID;
const SAND = ['#EBC97E', '#E3BD6E', '#DDB463', '#EFD08B'];

export function DigMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const items = content.kind === 'dig' ? content.items : [];
  const total = items.length;
  const run = useGameRun(total, onFinish, onAnswer);
  useFinishIfEmpty(total, run.finish);

  const [index, setIndex] = useState(0);
  const [order] = useState(() => shuffle(Array.from({ length: TILES }, (_, i) => i)));
  const [uncovered, setUncovered] = useState(0);
  const [found, setFound] = useState(false);
  const digFind = content.kind === 'dig' ? content.find : null;
  useAutoSay(found ? 'dig-found' : 'dig', found && digFind ? [ui('found', locale), `${ui('youFound', locale)} ${digFind.name}`] : []);

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
      <Confetti trigger={found} count={28} />
      <RoundProgress index={found ? total : index} total={total} color={color} locale={locale} />

      <div className={`grid gap-5 ${found ? '' : 'md:grid-cols-[minmax(0,260px)_1fr]'} items-start`}>
        {/* Dig site */}
        <div className="flex flex-col items-center gap-2">
          <motion.div
            layout
            transition={POP}
            className={`relative aspect-square ${found ? 'w-64 sm:w-72' : 'w-52 sm:w-60 md:w-full'} max-w-[300px] rounded-[2rem] p-2.5`}
            style={{
              background: 'linear-gradient(160deg, #C98B52, #9A6334 60%, #7A4B25)',
              boxShadow: '0 8px 0 #5E3A1C, 0 26px 40px -18px rgba(70,40,15,0.6), inset 0 3px 0 rgba(255,255,255,0.35)',
            }}
            role="img"
            aria-label={found ? `${find.emoji} ${find.name}` : `${ui('sand', locale)} ${TILES - cleared.size}/${TILES}`}
          >
            <div className="relative h-full w-full overflow-hidden rounded-[1.5rem]" style={{ background: 'radial-gradient(circle at 50% 55%, #FFF4D6, #E9CB8C 70%, #D9B26A)', boxShadow: 'inset 0 6px 14px rgba(90,55,20,0.35)' }}>
              {found ? <Sunburst color="#FBBF24" className="left-1/2 top-1/2 w-[160%] -translate-x-1/2 -translate-y-1/2" /> : null}
              <motion.span
                className="absolute inset-0 flex items-center justify-center text-[7rem] leading-none drop-shadow-[0_8px_8px_rgba(90,55,20,0.35)] select-none sm:text-[8rem]"
                animate={found ? { scale: [1, 1.25, 1.05], rotate: [0, -8, 6, 0], y: [0, -16, 0] } : { scale: 1 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                aria-hidden="true"
              >
                {find.emoji}
              </motion.span>
              <div className="absolute inset-0 grid gap-[3px] p-[3px]" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }} dir="ltr" aria-hidden="true">
                {Array.from({ length: TILES }, (_, i) => (
                  <AnimatePresence key={i}>
                    {!cleared.has(i) && (
                      <motion.span
                        initial={false}
                        exit={{ opacity: 0, scale: 0.3, y: -60, x: (i % 2 ? 1 : -1) * 30, rotate: i % 2 ? 60 : -60 }}
                        transition={{ duration: 0.5, delay: (i % 5) * 0.04, ease: 'easeOut' }}
                        className="block rounded-[10px]"
                        style={{
                          backgroundColor: SAND[(i * 7) % SAND.length],
                          backgroundImage:
                            'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55) 0 2px, transparent 3px), radial-gradient(circle at 70% 65%, rgba(120,80,30,0.18) 0 2px, transparent 3px), radial-gradient(circle at 45% 80%, rgba(120,80,30,0.12) 0 1.5px, transparent 2.5px), linear-gradient(160deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 45%, rgba(110,70,25,0.18))',
                          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -3px 0 rgba(120,80,30,0.25), 0 2px 3px rgba(90,55,20,0.2)',
                        }}
                      />
                    )}
                  </AnimatePresence>
                ))}
              </div>
              <Burst fire={uncovered} color="#E2BC6C" count={10} spread={90} />
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
              <Title3D as="h2" text={`🎉 ${ui('found', locale)}`} color={color} className="text-4xl" />
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
