'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Link } from '@/i18n/navigation';
import type { PlanetesGame, PlanetesState } from '@/games3d/planetes/PlanetesGame';
import {
  BODY,
  DELIVERIES,
  GIFT,
  PRETEND,
  arriveText,
  candidateWords,
  countWord,
  endText,
  nbsp,
  factText,
  openText,
  parcelWord,
  peekText,
  planGame,
  questionText,
  speechText,
  wrongText,
  type Band,
  type BodyId,
  type Delivery,
} from '@/games3d/planetes/logic';
import { PlanetIcon } from '@/games3d/planetes/PlanetIcon';
import { getMemory, useHydrated, useWorldMemory } from '@/lib/world/store';
import { maxDifficulty, readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { MagicMoment } from '@/lib/world/engine';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { MascotCutout, ZiggyAvatar } from '@/components/ziggy/Mascot';
import { MagicMoments, MomentChips } from '@/components/world/MagicMoments';

const T = {
  title: { fr: 'Le Facteur des Planètes', en: 'The Planet Postman' },
  teaser: {
    fr: 'Ziggy est facteur de l’espace ! Écoute chaque énigme et trouve la bonne planète pour livrer les colis.',
    en: 'Ziggy is the postman of space! Listen to each riddle and find the right planet to deliver the parcels.',
  },
  how: {
    fr: 'Touche la bonne planète en bas de l’écran (ou dans l’espace). Pas de souci si tu te trompes : la fusée fait un petit détour !',
    en: 'Tap the right planet at the bottom of the screen (or in space). No worries if you get it wrong: the rocket takes a little detour!',
  },
  play: { fr: 'Décoller !', en: 'Take off!' },
  loading: { fr: 'Ziggy charge les colis…', en: 'Ziggy is loading the parcels…' },
  back: { fr: 'Retour', en: 'Back' },
  music: { fr: 'Musique', en: 'Music' },
  next: { fr: 'Livraison suivante', en: 'Next delivery' },
  last: { fr: 'Rentrer à la poste', en: 'Back to the post office' },
  where: { fr: 'Où va ce colis ?', en: 'Where does this parcel go?' },
  flying: { fr: 'En route vers', en: 'On the way to' },
  loadingUp: { fr: 'Ziggy charge les colis dans la fusée…', en: 'Ziggy loads the parcels into the rocket…' },
  delivering: { fr: 'Ziggy livre le colis…', en: 'Ziggy delivers the parcel…' },
  takeoff: { fr: 'Décollage !', en: 'Lift-off!' },
  delivery: { fr: 'Livraison', en: 'Delivery' },
  done: { fr: 'Tournée terminée !', en: 'Round finished!' },
  map: { fr: 'Ta carte des livraisons', en: 'Your delivery map' },
  again: { fr: 'Nouvelle tournée', en: 'New round' },
  noWebgl: {
    fr: 'Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.',
    en: 'This 3D game needs WebGL, which this device does not support.',
  },
  inside: { fr: 'Dans le colis', en: 'In the parcel' },
} satisfies Record<string, L>;

/** The end map: the Sun, then every world in order. */
const MAP: (BodyId | 'sun')[] = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const STAMP_COLORS = ['#e2453c', '#7a4fd0', '#2e9e6a', '#e07a10', '#3f6fd9'];

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

type Bubble = { text: string; kind: 'oops' | 'peek' | 'arrive'; id: number };

export function PlanetesPlayer() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const reduce = useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<PlanetesGame | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'intro' | 'loading' | 'play' | 'result'>('intro');
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<PlanetesState | null>(null);
  const [plan, setPlan] = useState<Delivery[]>([]);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [opened, setOpened] = useState<{ index: number; lines: string[]; fact: string } | null>(null);
  const [count, setCount] = useState<{ n: number; id: number } | null>(null);
  const [xp, setXp] = useState<{ n: number; id: number } | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const [magic, setMagic] = useState<MagicMoment[]>([]);
  const [music, setMusic] = useState(true);
  const [run, setRun] = useState(0);
  const planRef = useRef<Delivery[]>([]);
  const seedRef = useRef(0);

  useEffect(() => setSupported(webglOk()), []);

  const band: Band = (memory.age ?? 'middle') as Band;

  const say = useCallback(
    (lines: string[], id = 'planetes', force = false) => {
      if (!force && !readAloudOn(getMemory())) return;
      void speakSequence(id, lines.filter(Boolean).map((l) => speechText(l, locale)), locale);
    },
    [locale]
  );

  const start = async () => {
    unlockAudio();
    setPhase('loading');
    setBubble(null);
    setOpened(null);
    setState(null);
    setTotalXp(0);
    setMagic([]);
    game.current?.dispose();
    game.current = null;
    const m = getMemory();
    const age = (m.age ?? 'middle') as Band;
    const lv = (s: 'astronomy' | 'science' | 'counting') => Math.min(m.skills[s]?.difficulty ?? 1, maxDifficulty(m));
    const seed = Math.floor(Math.random() * 1e6);
    seedRef.current = seed;
    const p = planGame(seed, age, { astronomy: lv('astronomy'), science: lv('science'), counting: lv('counting') });
    planRef.current = p;
    setPlan(p);
    try {
      const { PlanetesGame } = await import('@/games3d/planetes/PlanetesGame');
      game.current = new PlanetesGame(
        canvas.current!,
        p,
        { locale },
        {
          onState: setState,
          onAsk: (i) => {
            setBubble(null);
            setOpened(null);
            const d = planRef.current[i];
            if (!d) return;
            say([questionText(d, locale), ...(age === 'big' ? [] : candidateWords(d, locale))], 'planetes-q');
          },
          onWrong: (body, mistakes, i) => {
            const d = planRef.current[i];
            if (!d) return;
            const text = wrongText(d, body, mistakes, locale);
            setBubble({ text, kind: 'oops', id: Date.now() });
            say([text], 'planetes-oops');
          },
          onPeek: (body) => {
            const text = peekText(body, locale);
            setBubble({ text, kind: 'peek', id: Date.now() });
            say([text], 'planetes-peek');
          },
          onArrive: (i) => {
            const d = planRef.current[i];
            if (!d) return;
            const text = arriveText(d, locale);
            setBubble({ text, kind: 'arrive', id: Date.now() });
            say([text], 'planetes-arrive');
          },
          onCount: (n) => {
            setCount({ n, id: Date.now() });
            if (age !== 'big') say([countWord(n, locale)], 'planetes-count');
          },
          onOpened: (i, stats) => {
            const d = planRef.current[i];
            if (!d) return;
            const outcome = finishExtraGame('planetes', d.skill, { correct: 1, mistakes: stats.mistakes, total: 1 }, stats.durationMs);
            setXp({ n: outcome.xpGained, id: Date.now() });
            setTotalXp((x) => x + outcome.xpGained);
            setMagic((mm) => [...mm, ...outcome.magic]);
            const lines = openText(d, locale);
            const fact = factText(d, age, locale, seedRef.current + i);
            setBubble(null);
            setOpened({ index: i, lines, fact });
            say([...lines, fact], 'planetes-open');
          },
          onFinish: () => {
            setPhase('result');
            setRun((r) => r + 1);
            const visited = planRef.current.length;
            const lines = [`${tr(T.done, locale)} ${endText(visited, locale)}`];
            if (age === 'little') lines.push(Array.from({ length: visited }, (_, k) => countWord(k + 1, locale)).join(', ') + ' !');
            say(lines, 'planetes-end');
          },
        }
      );
    } catch {
      // No WebGL context (or the device refused it): show the friendly message instead.
      setSupported(false);
      setPhase('intro');
      return;
    }
    game.current.setMusic(music);
    // Lets the end-to-end test drive the scene; never in production.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __planetes?: PlanetesGame }).__planetes = game.current;
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

  // Tell the scene how much of the screen the HUD covers, so it frames the action in the rest.
  useEffect(() => {
    if (phase !== 'play' && phase !== 'result') return;
    const measure = () => {
      const h = window.innerHeight;
      const top = topRef.current?.getBoundingClientRect();
      const bottom = bottomRef.current?.getBoundingClientRect();
      game.current?.setInsets(top ? Math.max(0, top.bottom) : 0, bottom && bottom.height > 4 ? Math.max(0, h - bottom.top) : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (topRef.current) ro.observe(topRef.current);
    if (bottomRef.current) ro.observe(bottomRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [phase]);

  useEffect(() => {
    if (!bubble || bubble.kind === 'oops') return;
    const t = setTimeout(() => setBubble((b) => (b?.id === bubble.id ? null : b)), bubble.kind === 'peek' ? 3500 : 6000);
    return () => clearTimeout(t);
  }, [bubble]);
  useEffect(() => {
    if (!count) return;
    const t = setTimeout(() => setCount(null), 1100);
    return () => clearTimeout(t);
  }, [count]);
  useEffect(() => {
    if (!xp) return;
    const t = setTimeout(() => setXp(null), 3200);
    return () => clearTimeout(t);
  }, [xp]);

  const choose = (b: BodyId) => {
    unlockAudio();
    stopSpeaking();
    setBubble(null);
    game.current?.choose(b);
  };
  const next = () => {
    unlockAudio();
    stopSpeaking();
    setOpened(null);
    game.current?.next();
  };

  const d = state ? plan[state.index] : null;
  const asking = state?.phase === 'ask';
  const showQuestion = Boolean(d && state && ['intro', 'ask', 'fly', 'detour'].includes(state.phase));
  const question = d ? questionText(d, locale) : '';
  const firstOpen = d?.candidates.find((c) => !state?.tried.includes(c));

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#060a24] text-white">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" aria-label={tr(T.title, locale)} />

      {phase === 'play' || phase === 'result' ? (
        <>
          {/* Top: the bar and the riddle */}
          <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-2 sm:p-3">
            <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-2 rounded-[1.6rem] bg-[#0b1238]/75 p-1.5 shadow-xl ring-1 ring-white/15 backdrop-blur-md sm:gap-3 sm:p-2">
              <Link href="/monde" aria-label={tr(T.back, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-bold transition hover:bg-white/20">
                ←
              </Link>
              <ZiggyAvatar size={40} className="hidden shrink-0 sm:block" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-bold sm:text-base">🚀 {tr(T.title, locale)}</p>
                <div className="mt-0.5 flex items-center gap-1" aria-label={`${tr(T.delivery, locale)} ${Math.min(DELIVERIES, (state?.index ?? 0) + 1)} / ${DELIVERIES}`}>
                  {Array.from({ length: DELIVERIES }, (_, i) => {
                    const done = (state?.visited.length ?? 0) > i;
                    const now = !done && (state?.index ?? 0) === i && phase === 'play';
                    return (
                      <span
                        key={i}
                        className={`grid h-6 w-6 place-items-center rounded-full text-[13px] ${done ? 'bg-amber-200 text-[#2a1650]' : now ? 'bg-white/90 text-[#2a1650]' : 'bg-white/15'}`}
                        aria-hidden="true"
                      >
                        {done ? '✓' : now ? '📦' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  game.current?.setMusic(!music);
                  setMusic(!music);
                }}
                aria-pressed={music}
                aria-label={tr(T.music, locale)}
                title={tr(T.music, locale)}
                data-tv-secondary=""
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition ${music ? 'bg-amber-200/90 text-[#2a1650]' : 'bg-white/10'}`}
              >
                🎵
              </button>
            </div>

            {showQuestion && d ? (
              <motion.div
                key={`q-${state?.index}`}
                initial={reduce ? false : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto flex w-full max-w-3xl items-start gap-2 rounded-[1.6rem] bg-white/95 p-2.5 text-[#1d1b4a] shadow-xl sm:gap-3 sm:p-3"
              >
                <span className="grid h-12 min-w-12 shrink-0 place-items-center rounded-2xl bg-[#fff1dc] px-1 text-2xl sm:h-14 sm:min-w-14 sm:text-3xl" aria-label={parcelWord(d.parcels, locale)}>
                  {'📦'.repeat(d.parcels)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#7a4fd0]">{tr(T.where, locale)}</p>
                  <p className="text-base font-bold leading-snug sm:text-lg" aria-live="polite">
                    {nbsp(question, locale)}
                  </p>
                  {d.visual ? (
                    <p className="mt-0.5 text-lg tracking-wide sm:text-xl" aria-hidden="true">
                      {d.visual}
                    </p>
                  ) : null}
                </div>
                <SayButton texts={[speechText(question, locale), ...(band === 'big' ? [] : candidateWords(d, locale))]} locale={locale} />
              </motion.div>
            ) : null}
          </div>

          {/* Big counting pop */}
          <AnimatePresence>
            {count ? (
              <motion.div
                key={count.id}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduce ? 1 : 1.4 }}
                transition={{ duration: reduce ? 0 : 0.25 }}
                className="pointer-events-none absolute left-1/2 top-[34%] grid h-24 w-24 -translate-x-1/2 place-items-center rounded-full bg-white/95 font-display text-6xl font-bold text-[#e2453c] shadow-2xl"
                aria-hidden="true"
              >
                {count.n}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* XP gain */}
          <AnimatePresence>
            {xp ? (
              <motion.div
                key={xp.id}
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="pointer-events-none absolute right-3 top-20 rounded-full bg-gradient-to-r from-amber-300 to-pink-300 px-4 py-2 text-base font-bold text-[#4a2350] shadow-lg sm:right-6 sm:top-24 sm:text-lg"
                role="status"
              >
                +{xp.n} XP ⭐
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Bottom: speech bubble, choices, delivery card */}
          <div ref={bottomRef} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
            <AnimatePresence>
              {bubble && phase === 'play' ? (
                <motion.div
                  key={bubble.id}
                  initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  role="status"
                  className={`pointer-events-auto flex w-full max-w-2xl items-start gap-2 rounded-3xl px-3 py-2.5 text-left text-sm font-bold shadow-xl sm:text-base ${bubble.kind === 'oops' ? 'bg-[#fff4d6] text-[#5a3410] ring-2 ring-amber-300' : 'bg-white text-[#1d1b4a] ring-2 ring-sky-200'}`}
                >
                  <span className="mt-0.5 shrink-0 text-2xl" aria-hidden="true">
                    {bubble.kind === 'oops' ? '🔄' : bubble.kind === 'peek' ? '🔭' : '🛬'}
                  </span>
                  <span className="min-w-0 flex-1">{nbsp(bubble.text, locale)}</span>
                  <SayButton texts={[bubble.text]} locale={locale} size="sm" />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {asking && d && phase === 'play' ? (
              <div data-tv-stage="" className="pointer-events-auto w-full max-w-3xl">
                <div data-tv-row="" className={`grid gap-2 sm:gap-3 ${d.candidates.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  {d.candidates.map((b) => {
                    const tried = state?.tried.includes(b) ?? false;
                    const glowing = Boolean(state?.reveal && b === d.answer);
                    return (
                      <motion.button
                        key={`${state?.index}-${b}`}
                        type="button"
                        disabled={tried}
                        whileTap={reduce ? undefined : { scale: 0.92 }}
                        onClick={() => choose(b)}
                        data-tv-autofocus={b === firstOpen ? '' : undefined}
                        aria-label={tr(BODY[b].label, locale)}
                        className={`relative flex min-h-[96px] flex-col items-center justify-center gap-0.5 rounded-3xl px-1 py-1.5 shadow-xl transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300 sm:min-h-[120px] ${tried ? 'bg-[#0b1238]/50 opacity-45 ring-1 ring-white/10' : glowing ? 'bg-gradient-to-b from-amber-200 to-amber-400 text-[#2a1650] ring-4 ring-white' : 'bg-[#0b1238]/80 ring-1 ring-white/25 backdrop-blur hover:bg-[#1b2563]/85'}`}
                      >
                        <PlanetIcon body={b} size={band === 'little' ? 70 : 62} className={glowing && !reduce ? 'animate-pulse' : ''} />
                        <span className="max-w-full truncate px-1 text-sm font-bold sm:text-base">{tr(BODY[b].label, locale)}</span>
                        {tried ? (
                          <span className="absolute right-1.5 top-1.5 text-base" aria-hidden="true">
                            📭
                          </span>
                        ) : null}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {state && phase === 'play' && !['ask', 'opened', 'end'].includes(state.phase) ? (
              // While the rocket moves, the remote's focus rests here (OK does nothing), never on the back button.
              <p
                tabIndex={-1}
                data-tv-focusable=""
                data-tv-autofocus=""
                className="pointer-events-auto rounded-full bg-[#0b1238]/80 px-4 py-2 text-sm font-bold shadow ring-1 ring-white/15 outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
                role="status"
              >
                {state.phase === 'intro'
                  ? `📦 ${tr(T.loadingUp, locale)}`
                  : (state.phase === 'fly' || state.phase === 'detour') && state.target
                    ? `🚀 ${tr(T.flying, locale)} ${tr(BODY[state.target].the, locale)}…`
                    : state.phase === 'depart'
                      ? `🚀 ${tr(T.takeoff, locale)}`
                      : `📦 ${tr(T.delivering, locale)}`}
              </p>
            ) : null}

            {opened && phase === 'play' && state?.phase === 'opened' ? (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto w-full max-w-2xl rounded-[1.75rem] bg-white/95 p-3 text-[#1d1b4a] shadow-2xl sm:p-4"
                data-tv-stage=""
              >
                <div className="flex items-start gap-2">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f1ebff] text-3xl" aria-hidden="true">
                    {GIFT[plan[opened.index].gift].emoji}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1 text-sm font-bold leading-snug sm:text-base">
                    {opened.lines.map((l, i) => (
                      <p key={i}>{nbsp(l, locale)}</p>
                    ))}
                    <p className="rounded-2xl bg-[#eef6ff] px-3 py-2 font-semibold text-[#1d3a7a]">💡 {nbsp(opened.fact, locale)}</p>
                  </div>
                  <SayButton texts={[...opened.lines, opened.fact]} locale={locale} />
                </div>
                <motion.button
                  type="button"
                  onClick={next}
                  data-tv-autofocus=""
                  whileTap={reduce ? undefined : { scale: 0.95 }}
                  className="mt-3 flex min-h-[64px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ffb86b] to-[#ff7ab8] text-lg font-bold text-white shadow-[0_8px_30px_rgba(255,122,184,.45)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300"
                >
                  🚀 {opened.index + 1 >= plan.length ? tr(T.last, locale) : tr(T.next, locale)} ▶
                </motion.button>
              </motion.div>
            ) : null}

            {phase === 'result' ? (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto w-full max-w-xl rounded-[2rem] bg-[#0b1238]/90 p-4 text-center shadow-2xl ring-1 ring-white/15 backdrop-blur-md sm:p-5"
                data-tv-stage=""
              >
                <h2 className="font-display text-2xl font-bold sm:text-3xl">🏤 {nbsp(tr(T.done, locale), locale)}</h2>
                <p className="mt-1 text-sm font-semibold text-white/80">{nbsp(endText(state?.visited.length ?? plan.length, locale), locale)}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-amber-200">{tr(T.map, locale)}</p>
                <ul className="mt-2 grid grid-cols-5 gap-1.5 sm:gap-2">
                  {MAP.map((b) => {
                    const at = b === 'sun' ? -1 : (state?.visited ?? []).indexOf(b);
                    const label = b === 'sun' ? (locale === 'fr' ? 'Soleil' : 'Sun') : tr(BODY[b].label, locale);
                    return (
                      <li key={b} className={`relative flex flex-col items-center rounded-2xl py-1 ${at >= 0 ? 'bg-white/12' : 'bg-white/5'}`}>
                        <PlanetIcon body={b} size={44} className={b !== 'sun' && at < 0 ? 'opacity-50' : ''} />
                        <span className="max-w-full truncate px-0.5 text-[11px] font-bold sm:text-xs">{label}</span>
                        {at >= 0 ? (
                          <motion.span
                            initial={reduce ? false : { scale: 2, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: reduce ? 0 : 0.3 + at * 0.35 }}
                            className="absolute -right-0.5 -top-0.5 grid h-7 w-7 -rotate-12 place-items-center rounded-full border-[3px] bg-white/95 text-sm font-black"
                            style={{ borderColor: STAMP_COLORS[at % STAMP_COLORS.length], color: STAMP_COLORS[at % STAMP_COLORS.length] }}
                            aria-label={`✓ ${label}`}
                          >
                            ✓
                          </motion.span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-white/85">
                  📦 × {state?.visited.length ?? 0} · <span className="font-bold text-amber-200">+{totalXp} XP</span>
                </p>
                <div className="mt-2">
                  <MomentChips moments={magic} locale={locale} />
                </div>
                <p className="mx-auto mt-2 max-w-md text-xs text-white/60">👽 {nbsp(tr(PRETEND, locale), locale)}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => void start()}
                    data-tv-autofocus=""
                    className="min-h-[56px] rounded-full bg-amber-200 px-6 py-3 text-lg font-bold text-[#2a1650] shadow focus-visible:outline focus-visible:outline-4 focus-visible:outline-white"
                  >
                    ↻ {tr(T.again, locale)}
                  </button>
                  <Link href="/monde" className="grid min-h-[56px] place-items-center rounded-full bg-white/10 px-6 py-3 font-bold">
                    {tr(T.back, locale)}
                  </Link>
                </div>
                <MagicMoments key={run} moments={magic} locale={locale} />
              </motion.div>
            ) : null}
          </div>
        </>
      ) : null}

      {/* Intro */}
      {phase === 'intro' || phase === 'loading' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#2a1f6b_0%,#0b1238_55%,#060a24_100%)] p-6 text-center">
          <SpaceFloaters reduce={Boolean(reduce)} />
          <motion.div
            className="relative h-40 w-40"
            animate={reduce ? undefined : { y: [0, -12, 0], rotate: [0, -4, 4, 0] }}
            transition={{ duration: 3.2, repeat: Infinity }}
            aria-hidden="true"
          >
            <div className="grid h-full w-full place-items-end justify-center overflow-hidden rounded-full bg-gradient-to-b from-[#bfe9ff] to-[#7fb8f0] shadow-[0_0_60px_rgba(127,208,255,.45)] ring-8 ring-[#ffd166]">
              <MascotCutout pose="wave" width={128} glow={false} className="translate-y-3" />
            </div>
            <span className="absolute -bottom-2 -right-3 text-5xl">🚀</span>
            <span className="absolute -left-3 top-2 text-4xl">📦</span>
          </motion.div>
          <h1 className="relative font-display text-4xl font-bold drop-shadow sm:text-6xl">{tr(T.title, locale)}</h1>
          <p className="relative max-w-lg text-lg font-semibold text-white/85">{nbsp(tr(T.teaser, locale), locale)}</p>
          <div className="relative flex items-center gap-1.5" aria-hidden="true">
            {(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as BodyId[]).map((b) => (
              <PlanetIcon key={b} body={b} size={b === 'jupiter' || b === 'saturn' ? 46 : 34} />
            ))}
          </div>
          <p className="relative max-w-md text-sm text-white/70">{nbsp(tr(T.how, locale), locale)}</p>
          {supported ? (
            <button
              type="button"
              disabled={!hydrated || phase === 'loading'}
              onClick={() => void start()}
              data-tv-autofocus=""
              className="relative min-h-[64px] rounded-full bg-gradient-to-r from-[#ffb86b] to-[#ff7ab8] px-10 py-4 text-xl font-bold text-white shadow-[0_10px_40px_rgba(255,122,184,.5)] transition hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-200 disabled:opacity-60"
            >
              {phase === 'loading' ? tr(T.loading, locale) : `🚀 ${tr(T.play, locale)}`}
            </button>
          ) : (
            <p className="relative rounded-2xl bg-white/10 px-4 py-3 font-semibold">{tr(T.noWebgl, locale)}</p>
          )}
          <Link href="/monde" className="relative text-sm font-semibold text-white/75 underline">
            ← {tr(T.back, locale)}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function SpaceFloaters({ reduce }: { reduce: boolean }) {
  const items = ['⭐', '✨', '🪐', '☄️', '🌙', '✉️', '⭐', '🌟'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => (
        <span key={`s${i}`} className="absolute h-1 w-1 rounded-full bg-white/70" style={{ left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 7) % 100}%`, opacity: 0.3 + ((i * 7) % 10) / 14 }} />
      ))}
      {items.concat(items).map((e, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl opacity-60"
          style={{ left: `${(i * 23 + 7) % 95}%`, top: `${(i * 37 + 11) % 90}%` }}
          animate={reduce ? undefined : { y: [0, -14, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: (i % 5) * 0.4 }}
        >
          {e}
        </motion.span>
      ))}
    </div>
  );
}
