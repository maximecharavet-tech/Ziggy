'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { buildPairDeck, type PairCard } from '../logic';
import { Feedback, Hint, POP, Stage, alpha, useFinishIfEmpty, useGameRun, useTimers } from './shared';
import { cheer, ui } from '../ui-text';

function isShort(text: string) {
  return Array.from(text).length <= 3;
}

export function PairsMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const pairs = content.kind === 'pairs' ? content.pairs : [];
  const total = pairs.length;
  const run = useGameRun(total, onFinish, onAnswer);
  const later = useTimers();
  useFinishIfEmpty(total, run.finish);

  const [deck, setDeck] = useState<PairCard[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [tone, setTone] = useState<'right' | 'almost' | null>(null);
  const [miss, setMiss] = useState<number[]>([]);

  // Shuffle on the client only, so server and client markup agree.
  useEffect(() => {
    setDeck(buildPairDeck(pairs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const found = matched.size;

  useEffect(() => {
    if (total > 0 && found === total) {
      playSound('win');
      later(() => run.finish(), 1100);
    }
  }, [found, total, later, run]);

  if (content.kind !== 'pairs') return null;

  const flip = (card: PairCard) => {
    if (open.length >= 2 || open.includes(card.id) || matched.has(card.pairId)) return;
    playSound('tap');
    const next = [...open, card.id];
    setOpen(next);
    if (next.length < 2) return;
    const [a, b] = next.map((id) => deck.find((c) => c.id === id)!);
    if (a.pairId === b.pairId) {
      run.answer(true);
      setTone('right');
      later(() => {
        setMatched((m) => new Set(m).add(a.pairId));
        setOpen([]);
      }, 380);
    } else {
      run.slip();
      setTone('almost');
      setMiss(next);
      later(() => {
        setOpen([]);
        setMiss([]);
      }, 1000);
    }
  };

  const n = deck.length;
  const cols = n <= 6 ? 'grid-cols-3' : n <= 16 ? 'grid-cols-4' : 'grid-cols-4 sm:grid-cols-5';

  return (
    <Stage color={color}>
      <div className="flex items-center justify-center gap-2 mb-2" dir="ltr">
        <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color }}>
          {ui('pairsFound', locale)}
        </span>
        <span className="text-lg font-extrabold tabular-nums" style={{ color }} aria-live="polite">
          {found} / {total}
        </span>
      </div>
      <Hint>{ui('pairsHint', locale)}</Hint>

      <div className={`grid ${cols} gap-2.5 sm:gap-3 max-w-xl mx-auto`} dir="ltr">
        {deck.map((card, i) => {
          const isMatched = matched.has(card.pairId);
          const faceUp = isMatched || open.includes(card.id);
          const wobble = miss.includes(card.id);
          return (
            <motion.button
              key={card.id}
              type="button"
              onClick={() => flip(card)}
              disabled={isMatched}
              aria-label={faceUp ? card.text : `${ui('hiddenCard', locale)} ${i + 1}`}
              aria-pressed={faceUp}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={wobble ? { opacity: 1, scale: 1, x: [0, -5, 5, -3, 3, 0] } : { opacity: isMatched ? 0.75 : 1, scale: isMatched ? 0.94 : 1 }}
              whileTap={faceUp ? undefined : { scale: 0.93 }}
              transition={POP}
              className="relative aspect-square min-h-[64px] rounded-3xl [perspective:600px] disabled:cursor-default"
            >
              <motion.span
                className="absolute inset-0 rounded-3xl [transform-style:preserve-3d]"
                initial={false}
                animate={{ rotateY: faceUp ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              >
                {/* Back */}
                <span
                  className="absolute inset-0 rounded-3xl flex items-center justify-center text-3xl [backface-visibility:hidden]"
                  style={{
                    background: `linear-gradient(140deg, ${color}, ${alpha(color, 'AA')})`,
                    boxShadow: `0 6px 18px ${alpha(color, '33')}`,
                  }}
                  aria-hidden="true"
                >
                  <span className="opacity-80">✦</span>
                </span>
                {/* Face */}
                <span
                  className="absolute inset-0 rounded-3xl flex items-center justify-center p-1.5 text-center bg-bg-card border-2 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                  style={{ borderColor: isMatched ? '#22C55E' : alpha(color, '40') }}
                  aria-hidden="true"
                >
                  <span
                    className={`font-extrabold text-text-body leading-tight break-words ${
                      isShort(card.text) ? 'text-4xl sm:text-5xl' : 'text-sm sm:text-base'
                    }`}
                  >
                    {card.text}
                  </span>
                </span>
              </motion.span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4">
        <Feedback
          tone={tone}
          title={tone === 'right' ? cheer(found, locale) : tone === 'almost' ? ui('almost', locale) : undefined}
          color={color}
        />
      </div>
    </Stage>
  );
}
