'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import type { KartEvent, KartGame, KartState } from '@/games3d/kart/KartGame';
import {
  SKILL_BY_BAND,
  cheerLine,
  finishLine,
  hintLine,
  laneName,
  oopsLine,
  optionLines,
  planRun,
  questionLines,
  wordDoneLine,
  wordSlots,
  type Band,
  type KartRun,
  type Locale,
} from '@/games3d/kart/logic';
import { LANE_TINT } from '@/games3d/kart/track';
import { getMemory, useHydrated, useWorldMemory } from '@/lib/world/store';
import { maxDifficulty, readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { RoundOutcome } from '@/lib/world/engine';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { MagicMoments, MomentChips } from '@/components/world/MagicMoments';
import { MascotCutout } from '@/components/ziggy/Mascot';

const T = {
  title: { fr: 'Ziggy Kart des lettres', en: 'Ziggy’s Letter Kart' },
  teaser: {
    fr: 'Pilote le kart de Ziggy sur la route arc-en-ciel et passe sous les bonnes lettres pour écrire les mots !',
    en: 'Drive Ziggy’s kart on the rainbow road and go under the right letters to write the words!',
  },
  how: {
    fr: 'Le kart roule tout seul : choisis ta voie avec ◀ ▶, en glissant le doigt ou en touchant une lettre.',
    en: 'The kart drives itself: pick your lane with ◀ ▶, by swiping, or by tapping a letter.',
  },
  play: { fr: 'En voiture !', en: 'Let’s drive!' },
  loading: { fr: 'Ziggy fait chauffer le moteur…', en: 'Ziggy is warming up the engine…' },
  back: { fr: 'Retour', en: 'Back' },
  pause: { fr: 'Pause', en: 'Pause' },
  resume: { fr: 'On repart !', en: 'Let’s go again!' },
  paused: { fr: 'Le kart t’attend…', en: 'The kart is waiting for you…' },
  music: { fr: 'Musique', en: 'Music' },
  steer: { fr: 'Choisis ta voie', en: 'Pick your lane' },
  left: { fr: 'Aller à gauche', en: 'Go left' },
  right: { fr: 'Aller à droite', en: 'Go right' },
  end: { fr: 'Quelle course !', en: 'What a race!' },
  again: { fr: 'Encore une course', en: 'Race again' },
  words: { fr: 'Tes mots', en: 'Your words' },
  grow: { fr: 'Tes étoiles font grandir Ziggy dans son jardin', en: 'Your stars help Ziggy grow in his garden' },
  noWebgl: { fr: 'Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.', en: 'This 3D game needs WebGL, which this device does not support.' },
  word: { fr: 'Mot', en: 'Word' },
} satisfies Record<string, L>;

const MODE: Record<Band, L> = {
  little: { fr: 'Trouve la première lettre', en: 'Find the first letter' },
  middle: { fr: 'Épelle les mots', en: 'Spell the words' },
  big: { fr: 'Complète les sons', en: 'Fill in the sounds' },
};

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** The site's rounded font, ready to paint letters on the 3D signs. */
async function canvasFont(): Promise<string> {
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-fredoka').trim();
  const font = fam ? `${fam}, ui-rounded, system-ui, sans-serif` : 'ui-rounded, system-ui, sans-serif';
  try {
    await Promise.race([document.fonts.load(`bold 64px ${font}`), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* the system font will do */
  }
  return font;
}

export function KartPlayer() {
  const raw = useLocale();
  const locale: Locale = raw === 'fr' ? 'fr' : 'en';
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const reduce = useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<KartGame | null>(null);
  const runRef = useRef<KartRun | null>(null);
  const [phase, setPhase] = useState<'intro' | 'loading' | 'play' | 'result'>('intro');
  const [run, setRun] = useState<KartRun | null>(null);
  const [state, setState] = useState<KartState | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number; tone: 'yay' | 'oops' | 'info' } | null>(null);
  const [music, setMusic] = useState(true);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [supported, setSupported] = useState(true);
  const [games, setGames] = useState(0);

  useEffect(() => setSupported(webglOk()), []);

  const band: Band = (memory.age ?? 'middle') as Band;

  const speak = useCallback(
    (lines: string[], always = false) => {
      if (!always && !readAloudOn(getMemory())) return;
      void speakSequence('kart', lines.filter(Boolean), locale);
    },
    [locale]
  );
  const showToast = useCallback((text: string, tone: 'yay' | 'oops' | 'info' = 'info') => setToast({ text, id: Date.now(), tone }), []);

  const onEvent = useCallback(
    (e: KartEvent) => {
      const r = runRef.current;
      if (!r) return;
      const w = r.words[e.kind === 'finish' ? 0 : e.index];
      switch (e.kind) {
        case 'word': {
          // The word is always said: the little ones hear it, then the three gates.
          const lines = questionLines(w, r.mode, locale);
          speak(r.mode === 'first' ? [...lines, ...optionLines(e.options, locale)] : lines, true);
          break;
        }
        case 'right':
          if (e.wordDone) {
            const line = wordDoneLine(w, r.mode, locale);
            showToast(line, 'yay');
            speak([line]);
          } else {
            showToast(`${cheerLine(e.n, locale)} ${e.step.answer}`, 'yay');
            speak([locale === 'fr' ? `${e.step.answer} !` : `${e.step.answer}!`]);
          }
          break;
        case 'wrong':
          showToast(oopsLine(e.n, locale), 'oops');
          break;
        case 'retry': {
          const hint = hintLine(w, e.step, r.mode, e.hint, locale);
          const lines = [hint, ...(r.mode === 'first' ? optionLines(e.step.options, locale) : [])];
          speak(lines, r.band === 'little');
          break;
        }
        case 'finish': {
          const line = finishLine(r.words.length, r.mode, locale);
          showToast(line, 'yay');
          speak([line]);
          break;
        }
      }
    },
    [locale, speak, showToast]
  );

  const start = async () => {
    unlockAudio();
    setPhase('loading');
    setOutcome(null);
    stopSpeaking();
    const m = getMemory();
    const skill = SKILL_BY_BAND[band];
    const level = Math.min(m.skills[skill]?.difficulty ?? 1, maxDifficulty(m));
    const seed = Math.floor(Math.random() * 1e6);
    const plan = planRun(seed, band, level, locale);
    runRef.current = plan;
    setRun(plan);
    setState(null);
    game.current?.dispose();
    game.current = null;
    try {
      const [{ KartGame }, font] = await Promise.all([import('@/games3d/kart/KartGame'), canvasFont()]);
      const reduceMotion = Boolean(reduce) || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      game.current = new KartGame(
        canvas.current!,
        plan,
        {
          onState: setState,
          onEvent,
          onFinish: (stats) => {
            const o = finishExtraGame('kart', plan.skill, stats, stats.durationMs);
            setOutcome(o);
            setGames((n) => n + 1);
            setPhase('result');
          },
        },
        { font, reduceMotion },
        seed
      );
    } catch {
      // No WebGL context after all: the friendly message.
      setSupported(false);
      setPhase('intro');
      return;
    }
    game.current.setMusic(music);
    // Lets the end-to-end test drive the race; never in production.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __kart?: KartGame }).__kart = game.current;
    setPhase('play');
  };

  useEffect(
    () => () => {
      game.current?.dispose();
      game.current = null;
      stopSpeaking();
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const togglePause = () => {
    const p = !state?.paused;
    game.current?.setPaused(p);
    if (p) stopSpeaking();
  };

  const word = run && state ? run.words[Math.min(state.wordIndex, run.words.length - 1)] : null;
  const slots = word && state ? wordSlots(word, state.stepIndex) : [];
  const nextSlot = word && state ? word.steps[state.stepIndex]?.slot ?? -1 : -1;
  const sayLines = word && run ? [...questionLines(word, run.mode, locale), ...(run.mode === 'first' && state?.options ? optionLines(state.options, locale) : [])] : [];
  const racing = phase === 'play' && state?.phase === 'race';

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#bfe6ff] text-[#2b2150]">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" aria-label={tr(T.title, locale)} />

      {(phase === 'play' || phase === 'result') && state && run ? (
        <>
          {/* Top: progress, the word being written, read aloud, pause, music */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-4">
            <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-2 rounded-[1.6rem] bg-white/85 p-1.5 shadow-[0_8px_30px_rgba(80,40,120,.18)] ring-1 ring-white backdrop-blur-md sm:gap-3 sm:p-2">
              <Link href="/monde" aria-label={tr(T.back, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-lg font-bold text-[#5b3f8f]">
                ✕
              </Link>
              <ol className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-1.5" aria-label={`${tr(T.word, locale)} ${Math.min(state.wordIndex + 1, run.words.length)} / ${run.words.length}`}>
                {run.words.map((w, i) => {
                  const done = i < state.done;
                  const now = i === state.wordIndex && !done;
                  return (
                    <li
                      key={w.id}
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm transition sm:h-10 sm:w-10 sm:text-xl ${done ? 'bg-gradient-to-br from-[#ffe066] to-[#ff9fc4] shadow' : now ? 'bg-white ring-2 ring-[#b79cff]' : 'bg-[#efe9fb]'}`}
                      aria-hidden="true"
                    >
                      {done ? w.emoji : now ? '🏎️' : ''}
                    </li>
                  );
                })}
              </ol>
              <button
                type="button"
                onClick={togglePause}
                aria-pressed={state.paused}
                aria-label={tr(T.pause, locale)}
                disabled={!racing}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-lg font-bold text-[#5b3f8f] disabled:opacity-40"
              >
                {state.paused ? '▶' : '❚❚'}
              </button>
              <button
                type="button"
                onClick={() => {
                  game.current?.setMusic(!music);
                  setMusic(!music);
                }}
                aria-pressed={music}
                aria-label={tr(T.music, locale)}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg ${music ? 'bg-gradient-to-br from-[#ffe066] to-[#ffb3d1]' : 'bg-[#f3ecff] opacity-70'}`}
              >
                🎵
              </button>
            </div>

            {/* The word, built in big letters above the road */}
            {word && phase === 'play' && state.phase === 'race' ? (
              <motion.div
                key={word.id}
                initial={reduce ? false : { opacity: 0, y: -12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="pointer-events-auto flex max-w-full items-center gap-2 rounded-[1.6rem] bg-white/80 p-1.5 pe-3 shadow-[0_10px_30px_rgba(80,40,120,.2)] ring-2 ring-white backdrop-blur-md sm:gap-3 sm:p-2 sm:pe-4"
>
                <span className="sr-only">{word.word}</span>
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#fff6d6] to-[#ffe1f0] text-4xl shadow-inner sm:h-16 sm:w-16 sm:text-5xl" aria-hidden="true">
                  {word.emoji}
                </span>
                <span className="flex min-w-0 items-center gap-1 sm:gap-1.5" aria-hidden="true" dir="ltr">
                  {slots.map((u, i) => {
                    const unit = word.units[i];
                    const len = Array.from(unit).length;
                    const next = i === nextSlot;
                    const won = u !== null && !word.given[i];
                    return (
                      <motion.span
                        key={`${word.id}-${i}-${u ?? '_'}`}
                        initial={won && !reduce ? { scale: 0.3, y: -24 } : false}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                        style={{ flex: `${len} 1 0`, maxWidth: `${1.2 + len * 1.75}rem`, minWidth: `${0.9 + len * 0.95}rem` }}
                        className={`grid h-11 place-items-center rounded-xl border-[3px] px-0.5 font-display text-2xl font-bold leading-none sm:h-14 sm:text-4xl ${
                          u !== null
                            ? won
                              ? 'border-[#ffd23f] bg-gradient-to-b from-[#fff8d6] to-[#ffe9a8] text-[#2b2150]'
                              : 'border-transparent bg-white text-[#2b2150]'
                            : next
                              ? 'border-dashed border-[#b79cff] bg-[#f6f1ff] text-[#cbbcf5]'
                              : 'border-dashed border-[#e4dcf2] bg-white/60 text-[#ddd3ef]'
                        } ${next && !reduce ? 'animate-pulse' : ''}`}
                      >
                        {u ?? (word.ghost ? unit : '?')}
                      </motion.span>
                    );
                  })}
                </span>
                <SayButton texts={sayLines} locale={locale} size="sm" className="ms-1" />
              </motion.div>
            ) : null}
          </div>

          {/* Little messages: cheers, a gentle "oops" */}
          <AnimatePresence>
            {toast && phase === 'play' ? (
              <motion.p
                key={toast.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                role="status"
                className={`pointer-events-none absolute inset-x-4 bottom-[7.6rem] mx-auto w-fit max-w-md rounded-2xl px-4 py-2 text-center font-display text-lg font-bold shadow-xl sm:bottom-36 sm:text-2xl ${
                  toast.tone === 'oops' ? 'bg-[#fff0f7] text-[#b03a78] ring-2 ring-[#ffb3d1]' : 'bg-white text-[#2b2150] ring-2 ring-[#ffe066]'
                }`}
              >
                {toast.text}
              </motion.p>
            ) : null}
          </AnimatePresence>

          {/* Steering: ◀, the three lanes (their letters), ▶. The TV remote's ← → drive here. */}
          {racing ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4" data-tv-own-keys="x">
              <div
                tabIndex={-1}
                data-tv-autofocus=""
                data-tv-own-keys="x"
                role="group"
                aria-label={tr(T.steer, locale)}
                dir="ltr"
                className="pointer-events-auto flex items-center gap-1.5 rounded-[1.8rem] bg-white/75 p-1.5 shadow-[0_10px_30px_rgba(80,40,120,.22)] ring-1 ring-white outline-none backdrop-blur-md focus-visible:ring-4 focus-visible:ring-[#b79cff] sm:gap-3 sm:p-2.5"
              >
                <SteerButton label={tr(T.left, locale)} onClick={() => game.current?.steer(-1)}>
                  ◀
                </SteerButton>
                {[0, 1, 2].map((i) => {
                  const o = state.options?.[i];
                  const on = state.lane === i;
                  // After a corkscrew: the right lane sparkles, then the others fade (like the gates).
                  const answer = word?.steps[state.stepIndex]?.answer;
                  const lit = state.hint > 0 && o !== undefined && o === answer;
                  const faded = state.hint === 2 && o !== undefined && o !== answer;
                  return (
                    <motion.button
                      key={`${state.wordIndex}-${state.stepIndex}-${i}-${o ?? ''}`}
                      type="button"
                      onClick={() => game.current?.goLane(i)}
                      whileTap={reduce ? undefined : { scale: 0.92 }}
                      aria-pressed={on}
                      aria-label={`${laneName(i, locale)}${o ? ` : ${o}` : ''}`}
                      className={`relative grid h-16 min-w-16 place-items-center rounded-2xl px-2 font-display text-3xl font-bold transition-transform sm:h-20 sm:min-w-24 sm:text-4xl ${on ? 'scale-105 text-[#2b2150] shadow-lg ring-4 ring-white' : 'text-[#2b2150]/80'} ${faded ? 'opacity-40' : on ? '' : 'opacity-90'} ${lit ? 'shadow-[0_0_24px_rgba(255,214,80,.95)]' : ''}`}
                      style={{ background: on ? LANE_TINT[i] : `color-mix(in srgb, ${LANE_TINT[i]} 45%, white)` }}
                    >
                      {o ?? '·'}
                      {lit ? (
                        <span className="absolute -right-2 -top-2 text-lg" aria-hidden="true">
                          ✨
                        </span>
                      ) : null}
                      {on ? (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-1.5 text-xs shadow" aria-hidden="true">
                          🏎️
                        </span>
                      ) : null}
                    </motion.button>
                  );
                })}
                <SteerButton label={tr(T.right, locale)} onClick={() => game.current?.steer(1)}>
                  ▶
                </SteerButton>
              </div>
            </div>
          ) : null}

          {/* Pause */}
          {state.paused && racing ? (
            <div className="absolute inset-0 grid place-items-center bg-[#2b2150]/35 p-6 backdrop-blur-sm" data-tv-scope="">
              <div className="flex flex-col items-center gap-4 rounded-[2rem] bg-white/95 p-6 text-center shadow-2xl">
                <MascotCutout pose="wave" width={110} glow={false} />
                <p className="font-display text-2xl font-bold">{tr(T.paused, locale)}</p>
                <button type="button" data-tv-autofocus="" onClick={togglePause} className="min-h-16 rounded-full bg-gradient-to-r from-[#7ed6ff] to-[#b79cff] px-8 py-3 font-display text-2xl font-bold text-white shadow-lg">
                  ▶ {tr(T.resume, locale)}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* The podium: stars, XP and the words of the race */}
      {phase === 'result' && outcome && run ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6" data-tv-scope="">
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg rounded-[2rem] bg-white/92 p-4 text-center shadow-[0_20px_60px_rgba(80,40,120,.3)] ring-2 ring-white backdrop-blur-md sm:p-6"
          >
            <h2 className="font-display text-3xl font-bold">🏁 {tr(T.end, locale)}</h2>
            <p className="mt-1 text-4xl" aria-label={`${outcome.stars} ⭐`}>
              {'⭐'.repeat(outcome.stars)}
              <span className="opacity-25">{'⭐'.repeat(3 - outcome.stars)}</span>
            </p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-200 to-pink-200 px-4 py-1 text-base font-bold text-[#4a2350]" role="status">
              +{outcome.xpGained} XP ⭐
            </p>
            <p className="mt-3 text-sm font-bold text-[#6b5a86]">{tr(T.words, locale)}</p>
            <ul className="mt-1 flex flex-wrap justify-center gap-2">
              {run.words.map((w) => (
                <li key={w.id} className="flex items-center gap-1 rounded-2xl bg-[#f6f1ff] px-2.5 py-1 font-display text-lg font-bold">
                  <span aria-hidden="true">{w.emoji}</span>
                  {w.word}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-semibold text-[#6b5a86]">🌱 {tr(T.grow, locale)}</p>
            <div className="mt-2">
              <MomentChips moments={outcome.magic} locale={locale} />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button type="button" data-tv-autofocus="" onClick={() => void start()} className="min-h-14 rounded-full bg-gradient-to-r from-[#ffb86b] to-[#ff7ab8] px-6 py-3 font-display text-lg font-bold text-white shadow-lg">
                ↻ {tr(T.again, locale)}
              </button>
              <Link href="/monde" className="grid min-h-14 place-items-center rounded-full bg-[#f3ecff] px-6 py-3 font-display text-lg font-bold text-[#5b3f8f]">
                {tr(T.back, locale)}
              </Link>
            </div>
            <MagicMoments key={games} moments={outcome.magic} locale={locale} />
          </motion.div>
        </div>
      ) : null}

      {/* Intro */}
      {phase === 'intro' || phase === 'loading' ? (
        <div className="absolute inset-0 overflow-y-auto bg-gradient-to-b from-[#7cc8ff] via-[#c9e9ff] to-[#ffd9ee]">
          <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <RainbowRoad reduce={Boolean(reduce)} />
            <motion.div className="relative" animate={reduce ? undefined : { y: [0, -10, 0], rotate: [-2, 2, -2] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} aria-hidden="true">
              <div className="grid h-36 w-36 place-items-end justify-center overflow-hidden rounded-full bg-white/75 shadow-[0_20px_60px_rgba(255,120,180,.4)] ring-8 ring-white/70 sm:h-40 sm:w-40">
                <MascotCutout pose="wave" width={120} glow={false} className="translate-y-3" />
              </div>
              <span className="absolute -bottom-2 -right-4 text-5xl">🏎️</span>
            </motion.div>
            <h1 className="font-display text-4xl font-bold text-[#3b2a5a] drop-shadow-sm sm:text-6xl">{tr(T.title, locale)}</h1>
            <p className="max-w-lg text-lg font-semibold text-[#4b3a6a]">{tr(T.teaser, locale)}</p>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/85 px-4 py-1.5 text-sm font-bold text-[#5b3f8f] shadow">🔤 {tr(MODE[band], locale)}</span>
              <SayButton texts={[tr(T.teaser, locale), tr(T.how, locale)]} locale={locale} size="sm" />
            </div>
            <p className="max-w-md text-sm font-semibold text-[#5b4a78]">{tr(T.how, locale)}</p>
            {supported ? (
              <button
                type="button"
                disabled={!hydrated || phase === 'loading'}
                onClick={() => void start()}
                data-tv-autofocus=""
                className="mt-1 min-h-16 rounded-full bg-gradient-to-r from-[#ff8a8a] via-[#ffd23f] to-[#7cc4ff] px-10 py-4 font-display text-2xl font-bold text-[#2b2150] shadow-[0_10px_40px_rgba(255,140,180,.5)] transition hover:scale-105 disabled:opacity-60"
              >
                {phase === 'loading' ? tr(T.loading, locale) : `🏁 ${tr(T.play, locale)}`}
              </button>
            ) : (
              <p className="rounded-2xl bg-white/90 px-4 py-3 font-semibold">{tr(T.noWebgl, locale)}</p>
            )}
            <Link href="/monde" className="text-sm font-semibold text-[#5b4a78] underline">
              ← {tr(T.back, locale)}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SteerButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      aria-label={label}
      className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#2b2150] text-2xl text-white shadow-md sm:h-20 sm:w-20 sm:text-3xl"
    >
      {children}
    </motion.button>
  );
}

/** A rainbow road drawn behind the title. */
function RainbowRoad({ reduce }: { reduce: boolean }) {
  const cols = ['#ff8a8a', '#ffb36b', '#ffe170', '#93e6a0', '#7cc4ff', '#b79cff'];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 overflow-hidden opacity-70" aria-hidden="true">
      <div className="absolute inset-x-[-10%] bottom-[-40%] flex h-[150%] [perspective:400px]">
        <div className="flex h-full w-full [transform:rotateX(62deg)]">
          {cols.map((c) => (
            <div key={c} className="h-full flex-1" style={{ background: c }} />
          ))}
        </div>
      </div>
      {!reduce
        ? ['☁️', '🍭', '☁️', '🎈'].map((e, i) => (
            <motion.span
              key={i}
              className="absolute text-3xl"
              style={{ left: `${10 + i * 24}%`, top: `${10 + (i % 2) * 20}%` }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3 + i, repeat: Infinity }}
            >
              {e}
            </motion.span>
          ))
        : null}
    </div>
  );
}
