'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { SearchCheck, Lightbulb } from 'lucide-react';
import { GameShell, GameStartScreen, GameResultScreen } from './GameShell';

type Phase = 'start' | 'playing' | 'done';

const TOTAL_ROUNDS = 10;
const FEEDBACK_MS = 4000;

interface CategorySet {
  /** Index into the `oddone.reasons` translation array. */
  id: number;
  /** Three emojis that share a category. */
  family: string[];
  /** The intruder. */
  odd: string;
}

/** 16 sets — one per entry of `oddone.reasons`, so 10 rounds never repeat. */
const SETS: CategorySet[] = [
  { id: 0, family: ['🐶', '🐱', '🐘'], odd: '🚗' },
  { id: 1, family: ['🍎', '🍌', '🍇'], odd: '🔨' },
  { id: 2, family: ['🚌', '✈️', '🚲'], odd: '🐸' },
  { id: 3, family: ['🐟', '🐬', '🐙'], odd: '🐴' },
  { id: 4, family: ['👕', '👖', '🧢'], odd: '🍕' },
  { id: 5, family: ['⚽', '🏀', '🎾'], odd: '🎸' },
  { id: 6, family: ['🎻', '🥁', '🎹'], odd: '🥕' },
  { id: 7, family: ['☀️', '🌧️', '❄️'], odd: '🪑' },
  { id: 8, family: ['🐝', '🐜', '🦋'], odd: '🦅' },
  { id: 9, family: ['☕', '🥛', '🧃'], odd: '👟' },
  { id: 10, family: ['✏️', '📚', '✂️'], odd: '🎂' },
  { id: 11, family: ['🌙', '⭐', '🪐'], odd: '🥦' },
  { id: 12, family: ['🌻', '🌷', '🌳'], odd: '📱' },
  { id: 13, family: ['👁️', '👂', '✋'], odd: '🚙' },
  { id: 14, family: ['🍴', '🥄', '🍳'], odd: '🐕' },
  { id: 15, family: ['🐦', '🦆', '🦉'], odd: '🐠' },
];

interface Round {
  setId: number;
  tiles: string[];
  oddIndex: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRounds(): Round[] {
  return shuffle(SETS)
    .slice(0, TOTAL_ROUNDS)
    .map((set) => {
      const tiles = shuffle([...set.family, set.odd]);
      return { setId: set.id, tiles, oddIndex: tiles.indexOf(set.odd) };
    });
}

export function OddOneGame({ color }: { color: string }) {
  const t = useTranslations('games');

  const reasons = useMemo(() => {
    const raw = t.raw('oddone.reasons');
    return (Array.isArray(raw) ? raw : []) as string[];
  }, [t]);

  const [phase, setPhase] = useState<Phase>('start');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const round = rounds[index];

  const start = useCallback(() => {
    clearTimer();
    setRounds(buildRounds());
    setIndex(0);
    setPicked(null);
    setScore(0);
    setPhase('playing');
  }, [clearTimer]);

  const choose = useCallback(
    (i: number) => {
      if (picked !== null || !round) return;
      setPicked(i);
      const correct = i === round.oddIndex;
      if (correct) setScore((s) => s + 1);

      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setPicked(null);
        if (index + 1 >= rounds.length) {
          setPhase('done');
          return;
        }
        setIndex((n) => n + 1);
      }, FEEDBACK_MS);
    },
    [picked, round, index, rounds.length, clearTimer]
  );

  const stars = score >= 9 ? 3 : score >= 6 ? 2 : 1;
  const isCorrect = picked !== null && round ? picked === round.oddIndex : false;

  return (
    <GameShell
      title={t('oddone.name')}
      color={color}
      icon={<SearchCheck size={20} />}
      stats={
        phase === 'playing'
          ? [
              { label: t('score'), value: score, pop: true },
              { label: '#', value: `${index + 1}/${TOTAL_ROUNDS}` },
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
            emoji="🔍"
            name={t('oddone.name')}
            description={t('oddone.description')}
            howTo={t('oddone.howTo')}
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
                animate={{ width: `${((index + 1) / TOTAL_ROUNDS) * 100}%` }}
                transition={{ duration: 0.4 }}
                style={{ backgroundColor: color }}
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-2 gap-3 sm:gap-4"
              >
                {round.tiles.map((emoji, i) => {
                  const isPicked = picked === i;
                  const revealCorrect = picked !== null && i === round.oddIndex;
                  const revealWrong = isPicked && i !== round.oddIndex;

                  return (
                    <motion.button
                      key={`${emoji}-${i}`}
                      type="button"
                      onClick={() => choose(i)}
                      disabled={picked !== null}
                      aria-label={emoji}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{
                        opacity: 1,
                        scale: revealCorrect ? [1, 1.12, 1] : 1,
                        x: revealWrong ? [0, -10, 10, -8, 8, -4, 4, 0] : 0,
                      }}
                      transition={{ delay: picked === null ? i * 0.05 : 0, duration: 0.4 }}
                      whileTap={picked === null ? { scale: 0.95 } : undefined}
                      className="aspect-square min-h-[96px] rounded-3xl border-2 flex items-center justify-center transition-colors"
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
                      <span className="text-4xl sm:text-5xl" aria-hidden="true">
                        {emoji}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            {/* Feedback + reason */}
            <AnimatePresence>
              {picked !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 14, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div
                    className="mt-5 rounded-2xl p-4 border"
                    style={{
                      backgroundColor: isCorrect ? 'rgba(34,197,94,0.08)' : `${color}0D`,
                      borderColor: isCorrect ? 'rgba(34,197,94,0.35)' : `${color}33`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb size={16} style={{ color: isCorrect ? '#16A34A' : color }} />
                      <span
                        className="text-sm font-extrabold"
                        style={{ color: isCorrect ? '#16A34A' : color }}
                      >
                        {isCorrect ? t('correct') : t('wrong')}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted leading-relaxed">
                      {reasons[round.setId] ?? ''}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {phase === 'done' && (
          <GameResultScreen
            key="done"
            gameId="oddone"
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
