'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Sparkles, ArrowRight, Check, X, Lightbulb } from 'lucide-react';
import { GameShell, GameStartScreen, GameResultScreen, GameButton } from './GameShell';

type Phase = 'start' | 'playing' | 'done';

interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explanation: string;
}

export function QuizGame({ color }: { color: string }) {
  const t = useTranslations('games');

  const questions = useMemo(() => {
    const raw = t.raw('quiz.questions');
    return (Array.isArray(raw) ? raw : []) as QuizQuestion[];
  }, [t]);

  const total = questions.length;

  const [phase, setPhase] = useState<Phase>('start');
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const current = questions[index];

  const start = useCallback(() => {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setPhase('playing');
  }, []);

  const choose = useCallback(
    (i: number) => {
      if (picked !== null || !current) return;
      setPicked(i);
      if (i === current.answer) setScore((s) => s + 1);
    },
    [picked, current]
  );

  const next = useCallback(() => {
    if (index + 1 >= total) {
      setPhase('done');
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  }, [index, total]);

  const stars = total === 0 ? 1 : score >= total * 0.85 ? 3 : score >= total * 0.6 ? 2 : 1;
  const isCorrect = picked !== null && current && picked === current.answer;

  return (
    <GameShell
      title={t('quiz.name')}
      color={color}
      icon={<Sparkles size={20} />}
      stats={
        phase === 'playing'
          ? [
              { label: t('score'), value: score, pop: true },
              { label: '#', value: `${index + 1}/${total}` },
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
            emoji="🤖"
            name={t('quiz.name')}
            description={t('quiz.description')}
            howTo={t('quiz.howTo')}
            onStart={start}
          />
        )}

        {phase === 'playing' && current && (
          <motion.div
            key="play"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto w-full max-w-lg"
          >
            {/* Progress */}
            <div className="h-2 rounded-full bg-border/60 overflow-hidden mb-6">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${((index + 1) / total) * 100}%` }}
                transition={{ duration: 0.4 }}
                style={{ backgroundColor: color }}
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
              >
                <h3 className="text-lg sm:text-xl font-extrabold text-text-body text-center mb-6 leading-snug px-1">
                  {current.q}
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  {current.options.map((opt, i) => {
                    const isPicked = picked === i;
                    const revealCorrect = picked !== null && i === current.answer;
                    const revealWrong = isPicked && i !== current.answer;

                    return (
                      <motion.button
                        key={i}
                        type="button"
                        onClick={() => choose(i)}
                        disabled={picked !== null}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: revealCorrect ? [1, 1.04, 1] : 1,
                          x: revealWrong ? [0, -8, 8, -6, 6, -3, 3, 0] : 0,
                        }}
                        transition={{ delay: picked === null ? i * 0.05 : 0, duration: 0.4 }}
                        whileTap={picked === null ? { scale: 0.98 } : undefined}
                        className="min-h-[56px] w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-start border-2 transition-colors"
                        style={{
                          backgroundColor: revealCorrect
                            ? 'rgba(34,197,94,0.14)'
                            : revealWrong
                              ? 'rgba(239,68,68,0.12)'
                              : `${color}0D`,
                          borderColor: revealCorrect
                            ? 'rgba(34,197,94,0.7)'
                            : revealWrong
                              ? 'rgba(239,68,68,0.55)'
                              : `${color}2E`,
                        }}
                      >
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-extrabold"
                          style={{
                            backgroundColor: revealCorrect
                              ? 'rgba(34,197,94,0.9)'
                              : revealWrong
                                ? 'rgba(239,68,68,0.85)'
                                : `${color}1A`,
                            color: revealCorrect || revealWrong ? '#fff' : color,
                          }}
                        >
                          {revealCorrect ? (
                            <Check size={16} strokeWidth={3} />
                          ) : revealWrong ? (
                            <X size={16} strokeWidth={3} />
                          ) : (
                            String.fromCharCode(65 + i)
                          )}
                        </span>
                        <span className="text-sm sm:text-base font-semibold text-text-body leading-snug">
                          {opt}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Explanation */}
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
                    <p className="text-sm text-text-muted leading-relaxed">{current.explanation}</p>
                  </div>

                  <div className="flex justify-center mt-5">
                    <GameButton color={color} onClick={next} className="w-full sm:w-auto">
                      {t('next')}
                      <ArrowRight size={18} className="rtl:rotate-180" />
                    </GameButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {phase === 'done' && (
          <GameResultScreen
            key="done"
            color={color}
            stars={stars}
            scoreLabel={t('score')}
            scoreValue={`${score}/${total}`}
            onRestart={start}
          />
        )}
      </AnimatePresence>
    </GameShell>
  );
}
