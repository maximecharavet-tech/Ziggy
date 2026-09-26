'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ArrowRight, RotateCcw, Sparkles, Gamepad2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Confetti } from '@/components/ui/Confetti';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { useProfile } from '@/components/account/ProfileProvider';
import { playSound } from '@/lib/sound';
import { recordGameResult } from '@/lib/progress';

interface Question {
  promptKey: string;
  visual: string;
  options: { label: string; translate?: boolean }[];
  answer: number;
  explainKey: string;
  color: string;
}

/** Three quick wins: a pattern, a sum, and one idea about AI. */
const QUESTIONS: Question[] = [
  {
    promptKey: 'q1',
    visual: '🔴 🔵 🔴 🔵 🔴 ❓',
    options: [{ label: '🔵' }, { label: '🔴' }, { label: '🟢' }],
    answer: 0,
    explainKey: 'explain1',
    color: '#5FB6EA',
  },
  {
    promptKey: 'q2',
    visual: '🍎🍎🍎 + 🍎🍎',
    options: [{ label: '4' }, { label: '5' }, { label: '6' }],
    answer: 1,
    explainKey: 'explain2',
    color: '#7FC85C',
  },
  {
    promptKey: 'q3',
    visual: '🤖 💭',
    options: [
      { label: 'q3_b', translate: true },
      { label: 'q3_c', translate: true },
      { label: 'q3_a', translate: true },
    ],
    answer: 2,
    explainKey: 'explain3',
    color: '#F2647B',
  },
];

type Phase = 'intro' | 'play' | 'result';

export function ExpressTrial({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('trial');
  const { user } = useProfile();

  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);

  const q = QUESTIONS[index];
  const answered = picked !== null;
  const isRight = answered && picked === q.answer;
  // Finishing always earns at least one star: this is a first taste, not a test.
  const stars = Math.max(1, correct);

  const start = () => {
    playSound('pop');
    setPhase('play');
    setIndex(0);
    setPicked(null);
    setCorrect(0);
  };

  const pick = (i: number) => {
    if (answered) return;
    setPicked(i);
    if (i === q.answer) {
      setCorrect((c) => c + 1);
      playSound('correct');
    } else {
      playSound('wrong');
    }
  };

  const next = () => {
    if (index < QUESTIONS.length - 1) {
      playSound('tap');
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    const total = correct;
    recordGameResult('trial', total, Math.max(1, total));
    setPhase('result');
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border border-border/60 bg-bg-card shadow-[0_30px_70px_-35px_rgba(26,26,46,0.35)] ${
        compact ? 'p-6 sm:p-8' : 'p-6 sm:p-10'
      }`}
    >
      <div className="absolute -top-24 -end-24 w-72 h-72 stage-disc opacity-40 pointer-events-none" aria-hidden="true" />

      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="relative grid sm:grid-cols-[auto_1fr] items-center gap-6 text-center sm:text-start"
          >
            <div className="mx-auto w-36 sm:w-44 animate-float">
              <MascotCutout pose="wave" width={176} />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green/10 text-green px-3 py-1 text-xs font-bold">
                <Sparkles size={13} />
                {t('badge')}
              </span>
              <h3 className="mt-3 text-2xl sm:text-3xl font-bold text-text-body text-balance">{t('title')}</h3>
              <p className="mt-2 text-text-muted leading-relaxed">{t('subtitle')}</p>
              <button
                onClick={start}
                className="mt-6 inline-flex items-center justify-center gap-2 min-h-[56px] px-8 rounded-full gradient-green-cta text-white text-lg font-extrabold shadow-[0_12px_30px_-8px_rgba(34,197,94,0.6)] transition-transform hover:scale-[1.03] active:scale-95"
              >
                {t('start')}
                <ArrowRight size={20} className="rtl:rotate-180" />
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'play' && (
          <motion.div
            key={`q${index}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="relative"
          >
            {/* Progress: one star per question */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-bold text-text-dim">{t('step', { n: index + 1 })}</span>
              <div className="flex gap-1.5" aria-hidden="true">
                {QUESTIONS.map((_, i) => (
                  <Star
                    key={i}
                    size={22}
                    className={`transition-all duration-300 ${
                      i < index || (i === index && isRight)
                        ? 'text-yellow fill-yellow scale-110'
                        : 'text-border'
                    }`}
                  />
                ))}
              </div>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold text-text-body text-center text-balance">{t(q.promptKey)}</h3>
            <div
              className="mt-5 mb-7 mx-auto rounded-2xl py-5 px-4 text-center text-4xl sm:text-5xl tracking-wide"
              style={{ backgroundColor: `color-mix(in srgb, ${q.color} 10%, transparent)` }}
              aria-hidden="true"
            >
              {q.visual}
            </div>

            <div className={`grid gap-3 ${q.options[0].translate ? 'grid-cols-1' : 'grid-cols-3'}`}>
              {q.options.map((opt, i) => {
                const chosen = picked === i;
                const good = answered && i === q.answer;
                const bad = chosen && !good;
                return (
                  <motion.button
                    key={i}
                    onClick={() => pick(i)}
                    disabled={answered}
                    animate={bad ? { x: [0, -8, 8, -5, 5, 0] } : good && chosen ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ duration: 0.4 }}
                    className={`min-h-[64px] rounded-2xl border-2 px-4 font-bold transition-colors ${
                      opt.translate ? 'text-lg text-start' : 'text-3xl'
                    } ${
                      good
                        ? 'border-green bg-green/15 text-text-body'
                        : bad
                          ? 'border-coral bg-coral/10 text-text-body'
                          : answered
                            ? 'border-border/60 opacity-50'
                            : 'border-border/70 bg-bg hover:border-green/50 hover:bg-green/5 active:scale-[0.97]'
                    }`}
                  >
                    {opt.translate ? t(opt.label) : opt.label}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {answered && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between rounded-2xl bg-bg p-4 border border-border/50"
                >
                  <p className="text-sm leading-relaxed">
                    <strong className={isRight ? 'text-green' : 'text-coral'}>{isRight ? t('correct') : t('wrong')}</strong>{' '}
                    <span className="text-text-muted">{t(q.explainKey)}</span>
                  </p>
                  <button
                    onClick={next}
                    autoFocus
                    className="shrink-0 inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full gradient-green-cta text-white font-bold active:scale-95"
                  >
                    {index < QUESTIONS.length - 1 ? t('next') : t('finish')}
                    <ArrowRight size={18} className="rtl:rotate-180" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {phase === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            className="relative text-center"
          >
            <Confetti trigger />
            <div className="mx-auto w-32 animate-float">
              <MascotCutout pose="heart" width={128} />
            </div>
            <div className="mt-4 flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0, rotate: -40 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2 + i * 0.18, type: 'spring', stiffness: 400, damping: 14 }}
                >
                  <Star size={44} className={i < stars ? 'text-yellow fill-yellow drop-shadow-md' : 'text-border'} />
                </motion.span>
              ))}
            </div>
            <h3 className="mt-5 text-2xl sm:text-3xl font-bold text-text-body">{t('result_title', { stars })}</h3>
            <p className="mt-2 text-text-muted max-w-md mx-auto leading-relaxed">
              {user ? t('result_text_member') : t('result_text')}
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              {user ? (
                <Button href="/account" size="lg" className="gap-2">
                  <Trophy size={18} />
                  {t('trophies')}
                </Button>
              ) : (
                <Button href="/signup" size="lg" className="gap-2">
                  <Star size={18} className="fill-current" />
                  {t('keep')}
                </Button>
              )}
              <Button href="/games" variant="secondary" size="lg" className="gap-2">
                <Gamepad2 size={18} />
                {t('more')}
              </Button>
            </div>
            <button
              onClick={start}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-green"
            >
              <RotateCcw size={14} />
              {t('again')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
