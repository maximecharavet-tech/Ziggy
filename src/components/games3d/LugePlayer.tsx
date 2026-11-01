'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import type { LugeGame, LugeState } from '@/games3d/luge/LugeGame';
import { QUESTIONS_PER_RUN, mainSkill, planRun } from '@/games3d/luge/questions';
import type { Band } from '@/games3d/noel/missions';
import { getMemory, useHydrated, useWorldMemory } from '@/lib/world/store';
import { maxDifficulty, readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { RoundOutcome } from '@/lib/world/engine';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { MagicMoments, MomentChips } from '@/components/world/MagicMoments';

const T = {
  title: { fr: 'La Luge des nombres', en: 'The Number Sled' },
  teaser: { fr: 'Dévale la piste enneigée avec Ziggy et passe sous l’arche de la bonne réponse !', en: 'Race down the snowy slope with Ziggy and ride under the arch with the right answer!' },
  how: { fr: 'Touche la gauche, le milieu ou la droite de l’écran (ou les flèches) pour choisir ton couloir.', en: 'Tap the left, middle or right of the screen (or the arrows) to pick your lane.' },
  play: { fr: 'C’est parti !', en: 'Let’s go!' },
  back: { fr: 'Arcade', en: 'Arcade' },
  pause: { fr: 'Pause', en: 'Pause' },
  music: { fr: 'Musique', en: 'Music' },
  left: { fr: 'À gauche', en: 'Left' },
  middle: { fr: 'Au milieu', en: 'Middle' },
  right: { fr: 'À droite', en: 'Right' },
  done: { fr: 'Belle descente !', en: 'Great ride!' },
  again: { fr: 'Encore une descente', en: 'Ride again' },
  stars: { fr: 'étoiles ramassées', en: 'stars collected' },
  noWebgl: { fr: 'Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.', en: 'This 3D game needs WebGL, which this device does not support.' },
  loading: { fr: 'Ziggy cire sa luge…', en: 'Ziggy is waxing the sled…' },
} satisfies Record<string, L>;

const LANE_NAMES = [T.left, T.middle, T.right];

export function LugePlayer() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<LugeGame | null>(null);
  const [phase, setPhase] = useState<'intro' | 'loading' | 'play' | 'result'>('intro');
  const [state, setState] = useState<LugeState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [music, setMusic] = useState(true);
  const [paused, setPaused] = useState(false);
  const [outcome, setOutcome] = useState<(RoundOutcome & { starsCollected: number }) | null>(null);
  const [supported, setSupported] = useState(true);
  const [run, setRun] = useState(0);

  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      setSupported(Boolean(c.getContext('webgl2') || c.getContext('webgl')));
    } catch {
      setSupported(false);
    }
  }, []);

  const band: Band = (memory.age ?? 'middle') as Band;

  const say = useCallback(
    (text: string, kind: 'question' | 'hint' | 'praise', options?: number[]) => {
      if (kind !== 'question') setToast(text);
      if (!readAloudOn(getMemory()) && kind !== 'question') return;
      const lines = [text];
      // Pre-readers hear the answers lane by lane.
      if (kind === 'question' && options && getMemory().age === 'little') options.forEach((o, i) => lines.push(`${tr(LANE_NAMES[i], locale)} : ${o}`));
      void speakSequence(`luge-${kind}`, lines, locale);
    },
    [locale]
  );

  const start = async () => {
    unlockAudio();
    setPhase('loading');
    setPaused(false);
    const { LugeGame } = await import('@/games3d/luge/LugeGame');
    const m = getMemory();
    const seed = Math.floor(Math.random() * 1e6);
    const guessSkill = band === 'little' ? 'counting' : band === 'big' ? 'multiplication' : 'addition';
    const level = Math.min(m.skills[guessSkill]?.difficulty ?? 1, maxDifficulty(m));
    const skill = mainSkill(planRun(seed, band, level));
    const started = performance.now();
    game.current?.dispose();
    game.current = new LugeGame(canvas.current!, seed, band, level, locale, {
      onState: setState,
      onSay: (text, kind, question) => say(text, kind, question?.options),
      onFinish: (s) => {
        const o = finishExtraGame('luge_3d', skill, s, performance.now() - started);
        setOutcome({ ...o, starsCollected: s.stars });
        setPhase('result');
      },
    });
    game.current.setMusic(music);
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __luge?: LugeGame }).__luge = game.current;
    setPhase('play');
    setRun((n) => n + 1);
  };

  useEffect(
    () => () => {
      game.current?.dispose();
      stopSpeaking();
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const q = state?.question;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#0b1238] text-white">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" aria-label={tr(T.title, locale)} />

      {phase === 'play' && state ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3 sm:p-4">
            <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-3xl bg-[#0b1238]/70 p-3 shadow-xl ring-1 ring-white/15 backdrop-blur-md">
              <Link href="/monde/arcade" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-lg" aria-label={tr(T.back, locale)}>
                ✕
              </Link>
              <div className="min-w-0 flex-1 text-center">
                {q && !state.finished ? (
                  <>
                    {q.visual ? <p className="text-2xl leading-tight tracking-wide sm:text-3xl" aria-hidden="true">{q.visual}</p> : null}
                    <p className="font-display text-2xl font-bold sm:text-3xl">{locale === 'fr' ? q.text.fr : q.text.en}</p>
                  </>
                ) : (
                  <p className="font-display text-2xl font-bold">🏁 {tr(T.done, locale)}</p>
                )}
              </div>
              {q ? <SayButton texts={[locale === 'fr' ? q.text.fr : q.text.en]} locale={locale} /> : null}
              <button
                type="button"
                aria-pressed={paused}
                aria-label={tr(T.pause, locale)}
                onClick={() => {
                  game.current?.setPaused(!paused);
                  setPaused(!paused);
                }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-lg"
              >
                {paused ? '▶' : '❚❚'}
              </button>
              <button
                type="button"
                onClick={() => {
                  game.current?.setMusic(!music);
                  setMusic(!music);
                }}
                aria-pressed={music}
                aria-label={tr(T.music, locale)}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg ${music ? 'bg-amber-200/90 text-[#2a1650]' : 'bg-white/10'}`}
              >
                🎵
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm font-bold">
              <span className="rounded-full bg-[#0b1238]/70 px-3 py-1 ring-1 ring-white/10">⭐ {state.stars}</span>
              <span className="flex gap-1" aria-label={`${state.index} / ${QUESTIONS_PER_RUN}`}>
                {Array.from({ length: QUESTIONS_PER_RUN }, (_, i) => (
                  <span key={i} className={`h-2 rounded-full ${i < state.index ? 'w-4 bg-amber-200' : i === state.index ? 'w-6 bg-white' : 'w-4 bg-white/25'}`} />
                ))}
              </span>
            </div>
          </div>

          {/* Lanes: the three answers, the current lane lit */}
          {q && !state.finished ? (
            <div className="absolute inset-x-0 bottom-4 flex items-end justify-center gap-2 px-3 sm:gap-4">
              {q.options.map((o, i) => (
                <motion.button
                  key={`${state.index}-${i}`}
                  type="button"
                  onClick={() => game.current?.goLane(i)}
                  whileTap={{ scale: 0.92 }}
                  aria-label={`${tr(LANE_NAMES[i], locale)} : ${o}`}
                  aria-pressed={state.lane === i}
                  className={`min-h-[72px] min-w-[88px] rounded-3xl px-5 py-3 font-display text-3xl font-bold shadow-xl transition sm:min-w-[120px] ${state.lane === i ? 'scale-105 bg-amber-200 text-[#2a1650] ring-4 ring-white' : 'bg-[#0b1238]/70 ring-1 ring-white/20 backdrop-blur'}`}
                >
                  {i === 0 ? '◀ ' : ''}
                  {o}
                  {i === 2 ? ' ▶' : ''}
                </motion.button>
              ))}
            </div>
          ) : null}

          <AnimatePresence>
            {toast ? (
              <motion.p
                key={toast}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                role="status"
                className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 rounded-2xl bg-white/95 px-5 py-2 font-display text-2xl font-bold text-[#1b2150] shadow-xl"
              >
                {toast}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}

      {phase === 'intro' || phase === 'loading' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#0b1238] via-[#1e2a6b] to-[#9fb0e0] p-6 text-center">
          <motion.div className="text-8xl" animate={{ x: [-30, 30, -30], rotate: [-8, 8, -8] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} aria-hidden="true">
            🛷
          </motion.div>
          <h1 className="font-display text-4xl font-bold drop-shadow sm:text-6xl">{tr(T.title, locale)}</h1>
          <p className="max-w-lg text-lg text-white/85">{tr(T.teaser, locale)}</p>
          <p className="max-w-md text-sm text-white/70">{tr(T.how, locale)}</p>
          {supported ? (
            <button
              type="button"
              disabled={!hydrated || phase === 'loading'}
              onClick={() => void start()}
              className="rounded-full bg-gradient-to-r from-sky-300 to-amber-200 px-10 py-4 text-xl font-bold text-[#1b2150] shadow-[0_0_40px_rgba(160,200,255,.5)] transition hover:scale-105 disabled:opacity-60"
            >
              {phase === 'loading' ? tr(T.loading, locale) : `▶ ${tr(T.play, locale)}`}
            </button>
          ) : (
            <p className="rounded-2xl bg-white/10 px-4 py-3">{tr(T.noWebgl, locale)}</p>
          )}
          <Link href="/monde/arcade" className="text-sm text-white/70 underline">
            ← {tr(T.back, locale)}
          </Link>
        </div>
      ) : null}

      {phase === 'result' && outcome ? (
        <div className="absolute inset-0 flex items-end justify-center p-4 sm:items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-[2rem] bg-[#0b1238]/85 p-6 text-center ring-1 ring-white/15 backdrop-blur-md">
            <h2 className="font-display text-3xl font-bold">🛷 {tr(T.done, locale)}</h2>
            <p className="mt-2 text-4xl" aria-label={`${outcome.stars} ⭐`}>
              {'⭐'.repeat(outcome.stars)}
              <span className="opacity-25">{'⭐'.repeat(3 - outcome.stars)}</span>
            </p>
            <p className="mt-2 text-white/80">
              ✨ {outcome.starsCollected} {tr(T.stars, locale)} · <span className="font-bold text-amber-200">+{outcome.xpGained} XP</span>
            </p>
            <div className="mt-3">
              <MomentChips moments={outcome.magic} locale={locale} />
            </div>
            <div className="mt-5 flex justify-center gap-3">
              <button type="button" onClick={() => void start()} className="rounded-full bg-amber-200 px-6 py-3 font-bold text-[#2a1650]">
                ↻ {tr(T.again, locale)}
              </button>
              <Link href="/monde/arcade" className="rounded-full bg-white/10 px-6 py-3 font-bold">
                {tr(T.back, locale)}
              </Link>
            </div>
            <MagicMoments key={run} moments={outcome.magic} locale={locale} />
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
