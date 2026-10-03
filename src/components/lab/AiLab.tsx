'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Eraser, Brain, Check, X, RotateCcw, Sparkles, FlaskConical, ArrowLeft, Lightbulb } from 'lucide-react';
import { DrawPad, type DrawPadHandle } from './DrawPad';
import { PixelView } from './PixelView';
import { ZiggyAvatar, MascotCutout } from '@/components/ziggy/Mascot';
import { SpeakButton } from '@/components/ziggy/VoiceControls';
import { toVector, predict, countByLabel, isTrainable, unbalanced, starsFor, type Example, type Prediction } from '@/lib/lab/knn';
import { recordGameResult } from '@/lib/progress';
import { playSound } from '@/lib/sound';
import { speak, voiceStore } from '@/lib/voice';
import { EASE_OUT } from '@/lib/motion';

type Label = { id: string; emoji: string; color: string };
type Preset = { id: string; labels: Label[] };

const PRESETS: Preset[] = [
  { id: 'sun_moon', labels: [{ id: 'sun', emoji: '☀️', color: '#F59E0B' }, { id: 'moon', emoji: '🌙', color: '#6366F1' }] },
  { id: 'shapes', labels: [{ id: 'circle', emoji: '⭕', color: '#F2647B' }, { id: 'triangle', emoji: '🔺', color: '#22C55E' }] },
  { id: 'faces', labels: [{ id: 'happy', emoji: '😊', color: '#F59E0B' }, { id: 'sad', emoji: '😢', color: '#3B82F6' }] },
  {
    id: 'digits',
    labels: [
      { id: 'one', emoji: '1️⃣', color: '#8B5CF6' },
      { id: 'two', emoji: '2️⃣', color: '#EC4899' },
      { id: 'three', emoji: '3️⃣', color: '#14B8A6' },
    ],
  },
];

const MIN_EXAMPLES = 3;
const TEST_ROUNDS = 5;
type Step = 'choose' | 'teach' | 'train' | 'test' | 'done';

let uid = 0;
const nextId = () => `ex${++uid}`;

/**
 * The AI Lab: a child teaches Ziggy to recognise drawings — and sees how.
 *
 *  1. Teach: draw examples and file each one in the right box (the data).
 *  2. Train: Ziggy "memorises" the examples.
 *  3. Test: draw something new; Ziggy guesses, shows what he sees (16 × 16),
 *     which examples it looks like, and how sure he is. When he is wrong, the
 *     child corrects him and he learns from it on the spot.
 *
 * The model is real (k nearest neighbours, src/lib/lab/knn.ts) and runs on the
 * device: no drawing ever leaves the browser.
 */
export function AiLab() {
  const t = useTranslations('lab');
  const locale = useLocale();
  const pad = useRef<DrawPadHandle>(null);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [step, setStep] = useState<Step>('choose');
  const [examples, setExamples] = useState<Example[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [current, setCurrent] = useState<Float32Array | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [flash, setFlash] = useState<string | null>(null);
  const [learned, setLearned] = useState(false);
  const recorded = useRef(false);

  const labels = useMemo(() => preset?.labels.map((l) => l.id) ?? [], [preset]);
  const byId = useMemo(() => Object.fromEntries((preset?.labels ?? []).map((l) => [l.id, l])), [preset]);
  const counts = countByLabel(examples, labels);
  const ready = preset ? isTrainable(examples, labels, MIN_EXAMPLES) : false;
  const skewed = preset ? unbalanced(examples, labels) : null;
  const name = (id: string) => `${byId[id]?.emoji ?? ''} ${t(`labels.${id}`)}`;

  const choose = (p: Preset) => {
    playSound('tap');
    setPreset(p);
    setExamples([]);
    setScore({ correct: 0, total: 0 });
    setPrediction(null);
    setCurrent(null);
    recorded.current = false;
    setStep('teach');
  };

  const read = useCallback(() => {
    const r = pad.current?.read();
    return r ? toVector(r.ink, r.size, r.size) : null;
  }, []);

  /** Teach: file the drawing under a label. */
  const file = (label: string) => {
    const v = read();
    if (!v) return;
    playSound('pop');
    setExamples((ex) => [...ex, { id: nextId(), label, vector: v }]);
    setFlash(label);
    setTimeout(() => setFlash(null), 450);
    pad.current?.clear();
  };

  const train = () => {
    playSound('star');
    setStep('train');
    setTimeout(() => {
      setStep('test');
      playSound('correct');
    }, 2200);
  };

  /** Test: guess as soon as a stroke ends. */
  const guess = useCallback(() => {
    if (step !== 'test') return;
    const v = read();
    if (!v) return;
    setCurrent(v);
    setLearned(false);
    setPrediction(predict(examples, v, labels));
  }, [examples, labels, read, step]);

  // Ziggy says his guess out loud (when auto-read is on).
  const sure = prediction?.best ? prediction.scores[prediction.best] : 0;
  const guessLine =
    prediction?.best && sure >= 0.55 ? t('guess', { label: t(`labels.${prediction.best}`) }) : prediction ? t('unsure') : '';
  useEffect(() => {
    if (!guessLine || !voiceStore.get().autoRead) return;
    const timer = setTimeout(() => void speak('lab-guess', guessLine, locale), 350);
    return () => clearTimeout(timer);
  }, [guessLine, locale]);

  const feedback = (wasRight: boolean, actual?: string) => {
    if (!current || !prediction) return;
    const next = { correct: score.correct + (wasRight ? 1 : 0), total: score.total + 1 };
    setScore(next);
    playSound(wasRight ? 'correct' : 'wrong');
    if (!wasRight && actual) {
      // Learning from a mistake: the drawing becomes a new example.
      setExamples((ex) => [...ex, { id: nextId(), label: actual, vector: current }]);
      setLearned(true);
    }
    setTimeout(
      () => {
        pad.current?.clear();
        setPrediction(null);
        setCurrent(null);
        setLearned(false);
        if (next.total >= TEST_ROUNDS) finish(next);
      },
      wasRight ? 500 : 1300
    );
  };

  const finish = (s: { correct: number; total: number }) => {
    if (!recorded.current) {
      recorded.current = true;
      recordGameResult('lab', s.correct * 20, starsFor(s.correct, s.total));
    }
    playSound('win');
    setStep('done');
  };

  const keepTesting = () => {
    setScore({ correct: 0, total: 0 });
    recorded.current = false;
    setStep('test');
  };

  /* ── Choose a challenge ── */
  if (step === 'choose' || !preset) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {PRESETS.map((p, i) => (
          <motion.button
            key={p.id}
            type="button"
            onClick={() => choose(p)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3, ease: EASE_OUT }}
            className="press lift group relative overflow-hidden rounded-3xl border border-border/50 glass-strong p-6 text-start"
          >
            <div className="flex items-center gap-3 text-5xl">
              {p.labels.map((l, j) => (
                <span key={l.id} className="inline-flex items-center gap-3">
                  {j > 0 && <span className="text-lg font-bold text-text-dim">vs</span>}
                  <span className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">{l.emoji}</span>
                </span>
              ))}
            </div>
            <p className="mt-4 font-display text-xl font-bold text-text-body">{t(`presets.${p.id}`)}</p>
            <p className="mt-1 text-sm text-text-muted">{t('preset_hint', { count: p.labels.length })}</p>
          </motion.button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-start">
      {/* ── The slate ── */}
      <div className="relative">
        <div className="rounded-[2rem] p-[5px] bg-gradient-to-br from-white via-[#FFE7C2] to-blush/70 dark:from-white/15 dark:via-peach/15 dark:to-blush/15 shadow-[0_30px_60px_-30px_rgba(107,74,43,0.5)]">
          <DrawPad ref={pad} color="#1F2937" onStroke={guess} label={t('pad_label')} />
        </div>
        <AnimatePresence>
          {step === 'train' && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[2rem] bg-[#120c06]/70 backdrop-blur-sm text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="relative">
                {[0, 0.5, 1].map((d) => (
                  <motion.span
                    key={d}
                    className="absolute inset-0 rounded-full border-2 border-[#F3D27A]"
                    initial={{ scale: 1, opacity: 0.7 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ duration: 1.5, delay: d, repeat: Infinity }}
                  />
                ))}
                <ZiggyAvatar size={88} />
              </div>
              <p className="font-display text-xl font-bold text-center px-6">{t('training', { count: examples.length })}</p>
              <div className="flex flex-wrap justify-center gap-1.5 max-w-[80%]">
                {examples.map((e, i) => (
                  <motion.span
                    key={e.id}
                    initial={{ opacity: 0, scale: 0.4, y: 20 }}
                    animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.3], y: [20, 0, 0, -40] }}
                    transition={{ duration: 1.6, delay: i * 0.06 }}
                    className="w-8 h-8 rounded-md bg-white/90 p-0.5"
                  >
                    <PixelView vector={e.vector} color={byId[e.label]?.color ?? '#000'} className="w-full h-full" />
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              pad.current?.clear();
              setPrediction(null);
              setCurrent(null);
            }}
            className="press inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-bg-card px-4 py-2 text-sm font-bold text-text-muted"
          >
            <Eraser size={15} /> {t('clear')}
          </button>
          <button
            type="button"
            onClick={() => setStep('choose')}
            className="press inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-text-dim hover:text-text-body"
          >
            <ArrowLeft size={15} className="rtl:rotate-180" /> {t('back')}
          </button>
        </div>
      </div>

      {/* ── The panel ── */}
      <div className="min-w-0">
        <Stepper step={step} />

        {(step === 'teach' || step === 'train') && (
          <div className="mt-5">
            <p className="text-text-muted">{t('teach_hint')}</p>
            <div className={`mt-4 grid gap-3 ${preset.labels.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {preset.labels.map((l) => {
                const n = counts[l.id] ?? 0;
                return (
                  <motion.div
                    key={l.id}
                    animate={flash === l.id ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.35 }}
                    className="rounded-3xl border p-3"
                    style={{ borderColor: `${l.color}55`, backgroundColor: `color-mix(in srgb, ${l.color} 7%, var(--color-bg-card))` }}
                  >
                    <button
                      type="button"
                      onClick={() => file(l.id)}
                      disabled={step !== 'teach'}
                      className="press w-full rounded-2xl px-3 py-3 text-base font-bold text-white disabled:opacity-60"
                      style={{ background: `linear-gradient(135deg, ${l.color}, color-mix(in srgb, ${l.color} 70%, #000))` }}
                    >
                      {t('add_to', { label: name(l.id) })}
                    </button>
                    <div className="mt-3 flex flex-wrap gap-1.5 min-h-10">
                      <AnimatePresence>
                        {examples
                          .filter((e) => e.label === l.id)
                          .map((e) => (
                            <motion.span
                              key={e.id}
                              layout
                              initial={{ opacity: 0, scale: 0.3, y: -30 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{ type: 'spring', duration: 0.45, bounce: 0.35 }}
                              className="w-10 h-10 rounded-lg bg-white dark:bg-white/90 p-0.5 shadow-sm"
                            >
                              <PixelView vector={e.vector} color={l.color} className="w-full h-full" />
                            </motion.span>
                          ))}
                      </AnimatePresence>
                    </div>
                    <p className="mt-2 text-xs font-semibold" style={{ color: l.color }}>
                      {n >= MIN_EXAMPLES ? t('enough', { count: n }) : t('need_more', { count: MIN_EXAMPLES - n })}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {skewed && <Tip>{t('bias', { label: name(skewed) })}</Tip>}

            <button
              type="button"
              onClick={train}
              disabled={!ready || step !== 'teach'}
              className="press mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full gradient-green-cta px-6 py-4 text-lg font-bold text-white shadow-[0_14px_30px_-12px_rgba(34,197,94,0.8)] disabled:opacity-40 disabled:shadow-none"
            >
              <Brain size={20} /> {t('train_button')}
            </button>
          </div>
        )}

        {step === 'test' && (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-text-muted">{t('test_hint')}</p>
              <span className="shrink-0 rounded-full bg-green/10 px-3 py-1 text-xs font-bold text-green tabular-nums">
                {score.total}/{TEST_ROUNDS}
              </span>
            </div>

            <AnimatePresence mode="wait">
              {prediction ? (
                <motion.div
                  key="guess"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: EASE_OUT }}
                  className="mt-4 rounded-3xl border border-border/50 glass-strong p-5"
                >
                  <div className="flex items-center gap-3">
                    <ZiggyAvatar size={46} />
                    <p className="font-display text-2xl font-bold text-text-body flex-1">{guessLine}</p>
                    <SpeakButton id="lab-guess-btn" text={guessLine} locale={locale} />
                  </div>

                  {/* How sure */}
                  <div className="mt-4 space-y-2">
                    {preset.labels.map((l) => {
                      const p = prediction.scores[l.id] ?? 0;
                      return (
                        <div key={l.id} className="flex items-center gap-3">
                          <span className="w-8 text-xl text-center">{l.emoji}</span>
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-border/40">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: l.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round(p * 100)}%` }}
                              transition={{ duration: 0.5, ease: EASE_OUT }}
                            />
                          </div>
                          <span className="w-11 text-end text-sm font-bold tabular-nums text-text-muted">{Math.round(p * 100)}%</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* What Ziggy sees, and what it looks like */}
                  <div className="mt-5 grid grid-cols-[auto_1fr] gap-4 items-start">
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-text-dim">{t('sees')}</p>
                      {current && <PixelView vector={current} color="#1F2937" grid className="w-24 h-24 rounded-xl bg-white dark:bg-white/90 ring-1 ring-border" />}
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-text-dim">{t('alike')}</p>
                      <div className="flex gap-2">
                        {prediction.neighbours.map((n, i) => (
                          <motion.div
                            key={n.example.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.06, duration: 0.25 }}
                            className="text-center"
                          >
                            <PixelView
                              vector={n.example.vector}
                              color={byId[n.example.label]?.color ?? '#000'}
                              className="w-14 h-14 rounded-lg bg-white dark:bg-white/90 ring-2"
                            />
                            <p className="mt-1 text-[11px] font-bold tabular-nums text-text-muted">{Math.round(n.similarity * 100)}%</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Was he right? */}
                  {learned ? (
                    <p className="mt-5 rounded-2xl bg-green/10 px-4 py-3 text-sm font-bold text-green">{t('learned')}</p>
                  ) : (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {prediction.best && (
                        <button
                          type="button"
                          onClick={() => feedback(true)}
                          className="press inline-flex items-center gap-1.5 rounded-full gradient-green-cta px-4 py-2.5 text-sm font-bold text-white"
                        >
                          <Check size={16} /> {t('right')}
                        </button>
                      )}
                      {preset.labels
                        .filter((l) => l.id !== prediction.best)
                        .map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => feedback(false, l.id)}
                            className="press inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-bg-card px-4 py-2.5 text-sm font-bold text-text-body"
                          >
                            <X size={15} className="text-coral" /> {t('wrong_was', { label: name(l.id) })}
                          </button>
                        ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="wait"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 flex items-center gap-4 rounded-3xl border border-dashed border-border p-6"
                >
                  <div className="w-16 animate-float">
                    <MascotCutout pose="stand" width={64} glow={false} />
                  </div>
                  <p className="text-text-muted">{t('waiting')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {step === 'done' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
            className="mt-5 rounded-3xl border border-border/50 glass-strong p-6"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="text-apricot" />
              <h3 className="font-display text-2xl font-bold text-text-body">{t('done_title')}</h3>
            </div>
            <p className="mt-2 text-lg font-bold text-green">{t('score', { correct: score.correct, total: score.total })}</p>
            <ul className="mt-4 space-y-3">
              {(['data', 'more', 'mistakes'] as const).map((k, i) => (
                <motion.li
                  key={k}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.1 }}
                  className="flex gap-3 text-text-body"
                >
                  <Lightbulb size={18} className="mt-0.5 shrink-0 text-apricot" />
                  <span>{t(`lessons.${k}`)}</span>
                </motion.li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={keepTesting}
                className="press inline-flex items-center gap-2 rounded-full gradient-green-cta px-5 py-3 font-bold text-white"
              >
                <RotateCcw size={16} /> {t('again')}
              </button>
              <button
                type="button"
                onClick={() => setStep('choose')}
                className="press inline-flex items-center gap-2 rounded-full border border-border/60 bg-bg-card px-5 py-3 font-bold text-text-body"
              >
                <FlaskConical size={16} /> {t('new_challenge')}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 flex gap-2 rounded-2xl bg-apricot/15 px-4 py-3 text-sm font-semibold text-[#8a5a2b] dark:text-[#F3D3A8]"
    >
      <Lightbulb size={17} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </motion.p>
  );
}

const STEPS = ['teach', 'train', 'test'] as const;

function Stepper({ step }: { step: Step }) {
  const t = useTranslations('lab');
  const active = step === 'done' ? 3 : step === 'test' ? 2 : step === 'train' ? 1 : 0;
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300 ${
              i < active ? 'bg-green text-white' : i === active ? 'bg-green/15 text-green ring-2 ring-green' : 'bg-border/50 text-text-dim'
            }`}
          >
            {i < active ? <Check size={15} /> : i + 1}
          </span>
          <span className={`text-sm font-bold ${i === active ? 'text-text-body' : 'text-text-dim'}`}>{t(`steps.${s}`)}</span>
          {i < STEPS.length - 1 && <span className="h-0.5 flex-1 rounded-full bg-border/60" />}
        </li>
      ))}
    </ol>
  );
}
