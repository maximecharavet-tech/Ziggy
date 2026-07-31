'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Puzzle, HelpCircle } from 'lucide-react';
import { GameShell, GameStartScreen, GameResultScreen } from './GameShell';

const TOTAL_ROUNDS = 10;
const SHAPES = ['🔴', '🔵', '🟡', '🟢', '🟣', '🟠', '🔺', '⭐'];

type Phase = 'start' | 'playing' | 'done';

interface Item {
  symbol: string;
  count: number;
}

interface Round {
  sequence: Item[];
  answer: Item;
  options: Item[];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickDistinct(n: number): string[] {
  const pool = [...SHAPES];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  }
  return out;
}

function sameItem(a: Item, b: Item) {
  return a.symbol === b.symbol && a.count === b.count;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeRound(index: number): Round {
  // Cycle → alternating → growing, rotating so every kind shows up.
  const kind = (['cycle', 'alternating', 'growing'] as const)[index % 3];

  let full: Item[];

  if (kind === 'cycle') {
    const cycleLength = index < 4 ? 2 : 3;
    const shapes = pickDistinct(cycleLength);
    full = Array.from({ length: 6 }, (_, i) => ({ symbol: shapes[i % cycleLength], count: 1 }));
  } else if (kind === 'alternating') {
    // A A B B A A ...
    const [x, y] = pickDistinct(2);
    const pattern = [x, x, y, y];
    full = Array.from({ length: 6 }, (_, i) => ({ symbol: pattern[i % 4], count: 1 }));
  } else {
    // 1, 2, 3, 4, 5, 6 of the same symbol
    const [s] = pickDistinct(1);
    full = Array.from({ length: 6 }, (_, i) => ({ symbol: s, count: i + 1 }));
  }

  const answer = full[full.length - 1];
  const sequence = full.slice(0, full.length - 1);

  // Build 3 plausible-but-wrong options.
  const options: Item[] = [answer];
  let guard = 0;
  while (options.length < 4 && guard < 80) {
    guard++;
    let candidate: Item;
    if (kind === 'growing') {
      const delta = randInt(1, 3) * (Math.random() < 0.5 ? -1 : 1);
      const count = Math.min(8, Math.max(1, answer.count + delta));
      candidate = { symbol: answer.symbol, count };
    } else {
      const used = shuffle(sequence.map((s) => s.symbol));
      const alt = used.find((s) => s !== answer.symbol) ?? pickDistinct(1)[0];
      candidate = { symbol: Math.random() < 0.6 ? alt : pickDistinct(1)[0], count: 1 };
    }
    if (!options.some((o) => sameItem(o, candidate))) options.push(candidate);
  }
  // Safety padding.
  while (options.length < 4) {
    const filler = { symbol: pickDistinct(1)[0], count: answer.count };
    if (!options.some((o) => sameItem(o, filler))) options.push(filler);
  }

  return { sequence, answer, options: shuffle(options) };
}

function ItemTile({ item, size = 'md' }: { item: Item; size?: 'sm' | 'md' }) {
  const textClass =
    item.count >= 5
      ? size === 'sm'
        ? 'text-[9px]'
        : 'text-[11px]'
      : item.count >= 3
        ? size === 'sm'
          ? 'text-sm'
          : 'text-base'
        : size === 'sm'
          ? 'text-xl'
          : 'text-3xl';

  return (
    <span
      className={`flex flex-wrap items-center justify-center gap-[2px] leading-none ${textClass}`}
      aria-hidden="true"
    >
      {Array.from({ length: item.count }, (_, i) => (
        <span key={i}>{item.symbol}</span>
      ))}
    </span>
  );
}

export function LogicGame({ color }: { color: string }) {
  const t = useTranslations('games');

  const [phase, setPhase] = useState<Phase>('start');
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<Item | null>(null);
  const lockRef = useRef(false);

  const start = useCallback(() => {
    setRoundIndex(0);
    setRound(makeRound(0));
    setScore(0);
    setPicked(null);
    lockRef.current = false;
    setPhase('playing');
  }, []);

  const choose = useCallback(
    (item: Item) => {
      if (lockRef.current || !round) return;
      lockRef.current = true;
      setPicked(item);

      const correct = sameItem(item, round.answer);
      if (correct) setScore((s) => s + 1);

      const nextIndex = roundIndex + 1;

      window.setTimeout(
        () => {
          setPicked(null);
          if (nextIndex >= TOTAL_ROUNDS) {
            setPhase('done');
            return;
          }
          setRoundIndex(nextIndex);
          setRound(makeRound(nextIndex));
          lockRef.current = false;
        },
        correct ? 650 : 950
      );
    },
    [round, roundIndex]
  );

  const stars = score >= 9 ? 3 : score >= 6 ? 2 : 1;
  const revealed = picked !== null;

  return (
    <GameShell
      title={t('logic.name')}
      color={color}
      icon={<Puzzle size={20} />}
      stats={
        phase === 'playing'
          ? [
              { label: t('score'), value: score, pop: true },
              { label: '#', value: `${roundIndex + 1}/${TOTAL_ROUNDS}` },
            ]
          : []
      }
      onRestart={phase === 'playing' ? start : undefined}
    >
      <AnimatePresence mode="wait">
        {phase === 'start' && (
          <GameStartScreen
            key="start"
            color={color}
            emoji="🧩"
            name={t('logic.name')}
            description={t('logic.description')}
            howTo={t('logic.howTo')}
            onStart={start}
          />
        )}

        {phase === 'playing' && round && (
          <motion.div
            key="play"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto w-full max-w-md"
          >
            {/* Progress */}
            <div className="h-2 rounded-full bg-border/60 overflow-hidden mb-6">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${((roundIndex + 1) / TOTAL_ROUNDS) * 100}%` }}
                transition={{ duration: 0.4 }}
                style={{ backgroundColor: color }}
              />
            </div>

            {/* Sequence */}
            <AnimatePresence mode="wait">
              <motion.div
                key={roundIndex}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-7"
              >
                {round.sequence.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}
                    className="aspect-square min-h-[56px] rounded-xl flex items-center justify-center p-1 border"
                    style={{ backgroundColor: `${color}0D`, borderColor: `${color}26` }}
                  >
                    <ItemTile item={item} size="sm" />
                  </motion.div>
                ))}

                {/* Missing slot */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{
                    opacity: 1,
                    scale: revealed ? [1, 1.12, 1] : [1, 1.05, 1],
                  }}
                  transition={
                    revealed
                      ? { duration: 0.4 }
                      : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                  }
                  className="aspect-square min-h-[56px] rounded-xl flex items-center justify-center p-1 border-2 border-dashed"
                  style={{
                    borderColor: revealed ? 'rgba(34,197,94,0.7)' : `${color}66`,
                    backgroundColor: revealed ? 'rgba(34,197,94,0.14)' : `${color}0D`,
                  }}
                >
                  {revealed ? (
                    <ItemTile item={round.answer} size="sm" />
                  ) : (
                    <HelpCircle size={22} style={{ color }} />
                  )}
                </motion.div>
              </motion.div>
            </AnimatePresence>

            {/* Options */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {round.options.map((opt, i) => {
                const isPicked = picked !== null && sameItem(picked, opt);
                const isCorrect = sameItem(opt, round.answer);
                const revealCorrect = revealed && isCorrect;
                const revealWrong = isPicked && !isCorrect;

                return (
                  <motion.button
                    key={`${opt.symbol}-${opt.count}-${i}`}
                    type="button"
                    onClick={() => choose(opt)}
                    disabled={revealed}
                    whileTap={{ scale: 0.95 }}
                    animate={{
                      scale: revealCorrect ? [1, 1.12, 1] : 1,
                      x: revealWrong ? [0, -10, 10, -8, 8, -4, 4, 0] : 0,
                    }}
                    transition={{ duration: 0.45 }}
                    className="min-h-[72px] rounded-2xl flex items-center justify-center p-2 border-2 transition-colors"
                    style={{
                      backgroundColor: revealCorrect
                        ? 'rgba(34,197,94,0.16)'
                        : revealWrong
                          ? 'rgba(239,68,68,0.14)'
                          : `${color}0D`,
                      borderColor: revealCorrect
                        ? 'rgba(34,197,94,0.7)'
                        : revealWrong
                          ? 'rgba(239,68,68,0.6)'
                          : `${color}2E`,
                    }}
                  >
                    <ItemTile item={opt} />
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {picked && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-sm font-extrabold mt-5"
                  style={{
                    color: sameItem(picked, round.answer) ? '#16A34A' : '#F59E0B',
                  }}
                >
                  {sameItem(picked, round.answer) ? `✅ ${t('correct')}` : `💪 ${t('wrong')}`}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {phase === 'done' && (
          <GameResultScreen
            key="done"
            gameId="logic"
            color={color}
            stars={stars}
            scoreLabel={t('score')}
            scoreValue={`${score}/${TOTAL_ROUNDS}`}
            onRestart={start}
          />
        )}
      </AnimatePresence>
    </GameShell>
  );
}
