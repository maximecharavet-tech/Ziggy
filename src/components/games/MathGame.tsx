'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Calculator, Flame, Timer } from 'lucide-react';
import { GameShell, GameStartScreen, GameResultScreen } from './GameShell';

const ROUND_SECONDS = 60;

type Phase = 'start' | 'playing' | 'done';

interface Problem {
  a: number;
  b: number;
  op: '+' | '−' | '×';
  answer: number;
  options: number[];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Difficulty 0-3, grows with the streak. */
function difficultyFromStreak(streak: number) {
  return Math.min(3, Math.floor(streak / 3));
}

function makeProblem(level: number): Problem {
  const ops: Problem['op'][] = level === 0 ? ['+', '−'] : ['+', '−', '×'];
  const op = ops[randInt(0, ops.length - 1)];

  let a: number;
  let b: number;
  let answer: number;

  if (op === '×') {
    const maxA = [5, 6, 9, 12][level];
    const maxB = [5, 8, 10, 12][level];
    a = randInt(2, maxA);
    b = randInt(2, maxB);
    answer = a * b;
  } else if (op === '+') {
    const max = [10, 20, 50, 100][level];
    a = randInt(1, max);
    b = randInt(1, max);
    answer = a + b;
  } else {
    const max = [10, 20, 50, 100][level];
    a = randInt(2, max);
    b = randInt(1, a); // never negative
    answer = a - b;
  }

  // Distractors close to the real answer, never negative, always distinct.
  const options = new Set<number>([answer]);
  const spread = Math.max(2, Math.round(answer * 0.2));
  let guard = 0;
  while (options.size < 4 && guard < 60) {
    guard++;
    const delta = randInt(1, spread) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = answer + delta;
    if (candidate >= 0) options.add(candidate);
  }
  // Fallback padding if the loop could not find enough distinct values.
  let pad = 1;
  while (options.size < 4) {
    options.add(answer + pad);
    pad++;
  }

  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return { a, b, op, answer, options: shuffled };
}

export function MathGame({ color }: { color: string }) {
  const t = useTranslations('games');

  const [phase, setPhase] = useState<Phase>('start');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [picked, setPicked] = useState<number | null>(null);
  const lockRef = useRef(false);

  /* Countdown */
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setPhase('done');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const start = useCallback(() => {
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setTimeLeft(ROUND_SECONDS);
    setPicked(null);
    setRound(0);
    lockRef.current = false;
    setProblem(makeProblem(0));
    setPhase('playing');
  }, []);

  const answer = useCallback(
    (value: number) => {
      if (lockRef.current || !problem) return;
      lockRef.current = true;
      setPicked(value);

      const correct = value === problem.answer;
      let nextStreak = 0;

      if (correct) {
        nextStreak = streak + 1;
        setScore((s) => s + 1);
        setStreak(nextStreak);
        setBestStreak((b) => Math.max(b, nextStreak));
      } else {
        setStreak(0);
      }

      window.setTimeout(
        () => {
          setPicked(null);
          setRound((r) => r + 1);
          setProblem(makeProblem(difficultyFromStreak(nextStreak)));
          lockRef.current = false;
        },
        correct ? 450 : 750
      );
    },
    [problem, streak]
  );

  const stars = score >= 15 ? 3 : score >= 8 ? 2 : 1;
  const lowTime = timeLeft <= 10;

  return (
    <GameShell
      title={t('math.name')}
      color={color}
      icon={<Calculator size={20} />}
      stats={
        phase === 'playing'
          ? [
              { label: t('score'), value: score, pop: true },
              { label: t('streak'), value: streak, pop: true },
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
            emoji="➗"
            name={t('math.name')}
            description={t('math.description')}
            howTo={t('math.howTo')}
            onStart={start}
          />
        )}

        {phase === 'playing' && problem && (
          <motion.div
            key="play"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto w-full max-w-md"
          >
            {/* Timer bar */}
            <div className="flex items-center gap-2 mb-5">
              <Timer size={16} className={lowTime ? 'text-red-500' : 'text-text-dim'} />
              <div className="flex-1 h-2.5 rounded-full bg-border/60 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${(timeLeft / ROUND_SECONDS) * 100}%` }}
                  transition={{ duration: 0.9, ease: 'linear' }}
                  style={{ backgroundColor: lowTime ? '#EF4444' : color }}
                />
              </div>
              <span
                className={`text-sm font-extrabold tabular-nums w-8 text-right ${
                  lowTime ? 'text-red-500' : 'text-text-muted'
                }`}
              >
                {timeLeft}
              </span>
            </div>

            {/* Streak flame */}
            <AnimatePresence>
              {streak >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center justify-center gap-1.5 mb-3"
                >
                  <Flame size={16} className="text-amber-500" />
                  <span className="text-xs font-extrabold text-amber-500">
                    {t('streak')} ×{streak}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Problem */}
            <AnimatePresence mode="wait">
              <motion.div
                key={round}
                initial={{ opacity: 0, y: 16, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.94 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl py-8 sm:py-10 mb-5 text-center"
                style={{ backgroundColor: `${color}0F` }}
              >
                <span
                  className="text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tight"
                  style={{ color }}
                  dir="ltr"
                >
                  {problem.a} {problem.op} {problem.b} = ?
                </span>
              </motion.div>
            </AnimatePresence>

            {/* Options */}
            <div className="grid grid-cols-2 gap-3">
              {problem.options.map((opt) => {
                const isPicked = picked === opt;
                const isCorrect = opt === problem.answer;
                const revealCorrect = picked !== null && isCorrect;
                const revealWrong = isPicked && !isCorrect;

                return (
                  <motion.button
                    key={opt}
                    type="button"
                    onClick={() => answer(opt)}
                    disabled={picked !== null}
                    animate={{
                      scale: revealCorrect ? [1, 1.1, 1] : 1,
                      x: revealWrong ? [0, -10, 10, -8, 8, -4, 4, 0] : 0,
                    }}
                    transition={{ duration: 0.45 }}
                    whileTap={{ scale: 0.96 }}
                    className="min-h-[64px] rounded-2xl text-2xl font-extrabold tabular-nums border-2 transition-colors"
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
                      color: revealCorrect ? '#16A34A' : revealWrong ? '#DC2626' : color,
                    }}
                    dir="ltr"
                  >
                    {opt}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {phase === 'done' && (
          <GameResultScreen
            key="done"
            gameId="math"
            color={color}
            stars={stars}
            scoreLabel={t('score')}
            scoreValue={score}
            extras={[{ label: t('streak'), value: bestStreak }]}
            onRestart={start}
          />
        )}
      </AnimatePresence>
    </GameShell>
  );
}
