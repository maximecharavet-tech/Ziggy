'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import type { GrandHuitGame } from '@/games3d/grand-huit/GrandHuitGame';
import {
  EMPTY_GO,
  FULL_PATH,
  GAME_ID,
  LEAD_SKILL,
  RIDES_PER_GAME,
  canAdd,
  checkPath,
  instruction,
  missText,
  nextHint,
  opKey,
  opLabel,
  opSpoken,
  planRide,
  praiseFor,
  rideKey,
  sameOp,
  spokenLines,
  stopsOf,
  type Band,
  type Op,
  type Ride,
} from '@/games3d/grand-huit/logic';
import { getMemory, useHydrated, useWorldMemory } from '@/lib/world/store';
import { maxDifficulty, readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { MagicMoment } from '@/lib/world/engine';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { MagicMoments, MomentChips } from '@/components/world/MagicMoments';
import { MascotCutout, ZiggyAvatar } from '@/components/ziggy/Mascot';

const T = {
  title: { fr: 'Le Grand Huit des Nombres', en: 'The Number Coaster' },
  teaser: {
    fr: 'Construis le trajet du wagonnet avec des rails « +2 », « −1 » ou « ×2 » et arrête Ziggy pile à la bonne gare… Splash !',
    en: 'Build the cart’s ride with “+2”, “−1” or “×2” rails and stop Ziggy right at the station… Splash!',
  },
  how: {
    fr: 'Choisis des rails, puis appuie sur « C’est parti ! ». Cinq trajets, puis un tour de grande roue !',
    en: 'Pick rails, then press “Let’s go!”. Five rides, then a Ferris wheel lap!',
  },
  play: { fr: 'Monter dans le wagon', en: 'Hop in the cart' },
  loading: { fr: 'On graisse les rails…', en: 'Oiling the rails…' },
  back: { fr: 'Retour', en: 'Back' },
  music: { fr: 'Musique', en: 'Music' },
  undo: { fr: 'Annuler', en: 'Undo' },
  go: { fr: 'C’est parti !', en: 'Let’s go!' },
  riding: { fr: 'Wouhou !', en: 'Wheee!' },
  boing: { fr: 'Boing ! On recommence…', en: 'Boing! Back we go…' },
  splash: { fr: 'Plouf ! Bravo !', en: 'Splash! Well done!' },
  ride: { fr: 'Trajet', en: 'Ride' },
  rails: { fr: 'Rails', en: 'Rails' },
  lap: { fr: 'Tour d’honneur sur la grande roue !', en: 'A victory lap on the Ferris wheel!' },
  done: { fr: 'Quelle fête foraine !', en: 'What a fair!' },
  doneSub: { fr: 'Cinq trajets pile à la gare !', en: 'Five rides right on the station!' },
  again: { fr: 'Rejouer', en: 'Play again' },
  world: { fr: 'Ziggy World', en: 'Ziggy World' },
  noWebgl: {
    fr: 'Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.',
    en: 'This 3D game needs WebGL, which this device does not support.',
  },
  bigger: { fr: 'le plus grand', en: 'the bigger' },
  smaller: { fr: 'le plus petit', en: 'the smaller' },
  hello: {
    fr: 'Bienvenue à la fête foraine ! Construis le trajet de mon wagon, et je fonce !',
    en: 'Welcome to the fair! Build my cart’s ride, and off I go!',
  },
} satisfies Record<string, L>;

const TAP_LINES: L[] = [
  { fr: 'Hihi ! Ça chatouille !', en: 'Hee hee! That tickles!' },
  { fr: 'Accroche-toi bien, on va faire un looping !', en: 'Hold on tight, we’re going to loop!' },
  { fr: 'Mes antennes adorent le vent !', en: 'My antennas love the wind!' },
  { fr: 'Bip bip ! Encore un tour ?', en: 'Beep beep! One more ride?' },
];

const OP_STYLE: Record<Op['kind'], string> = {
  add: 'from-[#2fd4aa] to-[#14a886]',
  sub: 'from-[#ffa25c] to-[#f2761f]',
  mul: 'from-[#b07bff] to-[#8048f0]',
};
const OP_CHIP: Record<Op['kind'], string> = {
  add: 'bg-[#dcfaf0] text-[#0c6b55] ring-[#7fe0c3]',
  sub: 'bg-[#fff0e2] text-[#9a4a0c] ring-[#ffc18f]',
  mul: 'bg-[#f1e8ff] text-[#5a2bb0] ring-[#cdb2ff]',
};

/** French typography: no lonely "!" or "?" at the start of a line. */
const nb = (s: string) => s.replace(/ ([!?:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Dots for children who don't read numbers yet (rows of five). */
function Dots({ n, className = '' }: { n: number; className?: string }) {
  const k = Math.max(0, Math.min(10, n));
  if (!k) return null;
  return (
    <span className={`flex max-w-[3.6rem] flex-wrap justify-center gap-[3px] ${className}`} aria-hidden="true">
      {Array.from({ length: k }, (_, i) => (
        <span key={i} className="h-2 w-2 rounded-full bg-current opacity-80" />
      ))}
    </span>
  );
}

type Status = 'build' | 'riding' | 'missed' | 'splash';

export function GrandHuitPlayer() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const reduce = useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const game = useRef<GrandHuitGame | null>(null);

  const [phase, setPhase] = useState<'intro' | 'loading' | 'play' | 'lap' | 'result'>('intro');
  const [supported, setSupported] = useState(true);
  const [ride, setRideState] = useState<Ride | null>(null);
  const [index, setIndex] = useState(0);
  const [path, setPathState] = useState<Op[]>([]);
  const [status, setStatus] = useState<Status>('build');
  const [misses, setMisses] = useState(0);
  const [current, setCurrent] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number; kind: 'hint' | 'praise' | 'info' } | null>(null);
  const [xp, setXp] = useState<{ n: number; id: number } | null>(null);
  const [music, setMusic] = useState(true);
  const [totals, setTotals] = useState<{ xp: number; stars: number; magic: MagicMoment[] }>({ xp: 0, stars: 0, magic: [] });
  const [run, setRun] = useState(0);

  // The scene's callbacks are created once: they read the live state from refs.
  const live = useRef({ ride: null as Ride | null, path: [] as Op[], misses: 0, index: 0, started: 0, played: [] as string[], seed: 0, band: 'middle' as Band });

  useEffect(() => setSupported(webglOk()), []);

  const band: Band = (memory.age ?? 'middle') as Band;

  const say = useCallback(
    (lines: string[], id = 'gh') => {
      if (!readAloudOn(getMemory())) return;
      void speakSequence(id, lines.filter(Boolean), locale);
    },
    [locale]
  );
  const showToast = useCallback((text: string, kind: 'hint' | 'praise' | 'info' = 'info') => setToast({ text, id: Date.now() + Math.random(), kind }), []);

  const updatePath = useCallback((p: Op[]) => {
    live.current.path = p;
    setPathState(p);
    game.current?.setPath(p);
  }, []);

  /** Plan and show ride number `i` (the level follows the child's progress, ride after ride). */
  const beginRide = useCallback(
    (i: number) => {
      const L = live.current;
      const m = getMemory();
      const skill = LEAD_SKILL[L.band];
      const level = Math.min(m.skills[skill]?.difficulty ?? 1, maxDifficulty(m));
      const r = planRide(L.seed, L.band, level, i, L.played);
      L.played = [...L.played, rideKey(r)];
      L.ride = r;
      L.path = [];
      L.misses = 0;
      L.index = i;
      L.started = performance.now();
      setRideState(r);
      setIndex(i);
      setPathState([]);
      setMisses(0);
      setCurrent(null);
      setStatus('build');
      game.current?.setRide(r);
      say(spokenLines(r, locale), 'gh-ride');
    },
    [locale, say]
  );

  const start = async () => {
    unlockAudio();
    setPhase('loading');
    game.current?.dispose();
    game.current = null;
    const L = live.current;
    L.band = (getMemory().age ?? 'middle') as Band;
    L.seed = Math.floor(Math.random() * 1e6);
    L.played = [];
    let created: GrandHuitGame;
    try {
      const { GrandHuitGame } = await import('@/games3d/grand-huit/GrandHuitGame');
      created = new GrandHuitGame(
        canvas.current!,
        { band: L.band, locale },
        {
          onStation: (v) => {
            setCurrent(v);
            if (live.current.band === 'little') say([String(v)], 'gh-count');
          },
          onStop: (ok, reached) => {
            const Lv = live.current;
            const r = Lv.ride;
            if (!r) return;
            if (ok) {
              setStatus('splash');
              const o = finishExtraGame(GAME_ID, r.skill, { correct: 1, mistakes: Lv.misses, total: 1 }, performance.now() - Lv.started);
              setXp({ n: o.xpGained, id: Date.now() });
              setTotals((t) => ({ xp: t.xp + o.xpGained, stars: t.stars + o.stars, magic: [...t.magic, ...o.magic] }));
              const praise = praiseFor(Lv.index + Lv.seed, locale);
              showToast(praise, 'praise');
              say([praise], 'gh-praise');
            } else {
              Lv.misses += 1;
              setMisses(Lv.misses);
              setStatus('missed');
              const text = missText(r, Lv.path, Lv.misses, locale);
              showToast(text, 'hint');
              say([text], 'gh-hint');
              void reached;
              // One-tap rides start fresh.
              if (r.autoLaunch) updatePath([]);
            }
          },
          onReady: (ok) => {
            const Lv = live.current;
            if (!ok) {
              setStatus('build');
              setCurrent(null);
              return;
            }
            if (Lv.index + 1 >= RIDES_PER_GAME) {
              setPhase('lap');
              game.current?.honorLap();
              const text = tr(T.lap, locale);
              showToast(text, 'praise');
              say([text], 'gh-lap');
            } else beginRide(Lv.index + 1);
          },
          onLapDone: () => setPhase('result'),
          onZiggyTap: () => {
            const line = tr(TAP_LINES[Math.floor(Math.random() * TAP_LINES.length)], locale);
            showToast(line);
            say([line], 'gh-tap');
          },
        }
      );
    } catch {
      setSupported(false);
      setPhase('intro');
      return;
    }
    game.current = created;
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __grandHuit?: GrandHuitGame }).__grandHuit = created;
    created.setMusic(music);
    setTotals({ xp: 0, stars: 0, magic: [] });
    setPhase('play');
    setRun((n) => n + 1);
    beginRide(0);
    showToast(tr(T.hello, locale));
  };

  const replay = () => {
    unlockAudio();
    const L = live.current;
    L.seed = Math.floor(Math.random() * 1e6);
    L.played = [];
    setTotals({ xp: 0, stars: 0, magic: [] });
    setPhase('play');
    setRun((n) => n + 1);
    beginRide(0);
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
    const t = setTimeout(() => setToast(null), toast.kind === 'hint' ? 6500 : 4200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!xp) return;
    const t = setTimeout(() => setXp(null), 3200);
    return () => clearTimeout(t);
  }, [xp]);

  // Tell the scene how much room the HUD takes, so the action stays visible between the bars.
  useLayoutEffect(() => {
    if (phase === 'intro' || phase === 'loading') return;
    const measure = () => {
      const top = topRef.current?.getBoundingClientRect().bottom ?? 0;
      // The bottom bar: Ziggy's bubble and the rails panel (its first visible child).
      const box = bottomRef.current;
      const first = box ? ([...box.children] as HTMLElement[]).find((c) => c.getBoundingClientRect().height > 0) : null;
      const b = first?.getBoundingClientRect();
      const bottom = b ? window.innerHeight - b.top + 6 : 0;
      game.current?.setInsets(top, bottom);
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
  }, [phase, status, ride]);

  /* ── Actions ── */

  const addPiece = (op: Op) => {
    const r = live.current.ride;
    if (!r || status !== 'build') return;
    unlockAudio();
    const p = live.current.path;
    if (!canAdd(r, p, op)) {
      if (p.length >= r.slots) showToast(tr(FULL_PATH, locale), 'info');
      return;
    }
    const next = [...p, op];
    updatePath(next);
    if (r.autoLaunch) return launch(next);
    if (live.current.band !== 'big') say([opSpoken(op, locale)], 'gh-piece');
  };

  const undo = () => {
    if (status !== 'build' || !live.current.path.length) return;
    updatePath(live.current.path.slice(0, -1));
  };

  const launch = (p = live.current.path) => {
    if (!p.length) {
      showToast(tr(EMPTY_GO, locale), 'info');
      say([tr(EMPTY_GO, locale)], 'gh-info');
      return;
    }
    unlockAudio();
    setToast(null);
    setStatus('riding');
    setCurrent(live.current.ride?.start ?? null);
    game.current?.launch();
  };

  /* ── Render ── */

  const little = band === 'little';
  const text = ride ? nb(instruction(ride, locale)) : '';
  const verdict = ride ? checkPath(ride, path) : null;
  const hint = ride && misses >= 2 && status === 'build' ? nextHint(ride, path) : null;
  const stops = ride ? stopsOf(ride.start, [...ride.preset, ...path]) : [];
  const firstEnabled = ride?.palette.find((op) => canAdd(ride, path, op));

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-gradient-to-b from-[#5a63c9] via-[#f59bb8] to-[#ffc98a] text-[#2a1b4a]">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" aria-label={tr(T.title, locale)} />

      {phase === 'play' || phase === 'lap' ? (
        <>
          {/* Top: back, progress, the instruction */}
          <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1.5 p-2 sm:p-3">
            <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-2 rounded-[1.6rem] bg-white/92 p-2 shadow-[0_8px_30px_rgba(60,30,90,.22)] ring-1 ring-white sm:gap-3">
              <Link
                href="/monde"
                aria-label={tr(T.back, locale)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-lg font-bold text-[#5b3f8f] transition hover:bg-[#e8dcff]"
              >
                ←
              </Link>
              <div className="min-w-0 flex-1">
                {phase === 'lap' ? (
                  <p className="font-display text-base font-bold leading-snug sm:text-xl">🎡 {nb(tr(T.lap, locale))}</p>
                ) : (
                  <>
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8a5bb8]">
                      <span aria-hidden="true">🎢</span>
                      <span>
                        {tr(T.ride, locale)} {Math.min(index + 1, RIDES_PER_GAME)}/{RIDES_PER_GAME}
                      </span>
                      <span className="flex gap-1" aria-hidden="true">
                        {Array.from({ length: RIDES_PER_GAME }, (_, i) => (
                          <span key={i} className={`h-2 rounded-full ${i < index ? 'w-3 bg-[#ff7ab8]' : i === index ? 'w-5 bg-[#ffb63d]' : 'w-3 bg-[#eadff7]'}`} />
                        ))}
                      </span>
                    </p>
                    <p className="text-sm font-bold leading-snug sm:text-lg">{text}</p>
                  </>
                )}
              </div>
              {ride && phase === 'play' ? <SayButton texts={spokenLines(ride, locale)} locale={locale} /> : null}
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
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition ${music ? 'bg-gradient-to-br from-[#ffd36b] to-[#ff9fc6]' : 'bg-[#f3ecff]'}`}
              >
                <span aria-hidden="true">🎵</span>
              </button>
            </div>
            {/* The goal: from the start station to the target one */}
            {ride && phase === 'play' ? (
              <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 font-display text-lg font-bold shadow ring-1 ring-white sm:text-xl">
                <span aria-hidden="true">🚃</span>
                <span className="text-[#14a35a]">{ride.start}</span>
                <span aria-hidden="true" className="text-[#b48ad8]">
                  ➜
                </span>
                <span aria-hidden="true">🏁</span>
                {ride.hidden ? (
                  <span className="text-[#ff5ca8]">?</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[#f2761f]">
                    {ride.target}
                    {little ? <Dots n={ride.target} className="text-[#f2761f]" /> : null}
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {/* XP */}
          <AnimatePresence>
            {xp ? (
              <motion.div
                key={xp.id}
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: reduce ? 0 : 0.3 }}
                role="status"
                className="pointer-events-none absolute right-3 top-28 rounded-full bg-gradient-to-r from-amber-300 to-pink-300 px-4 py-2 text-base font-bold text-[#4a2350] shadow-lg sm:right-6 sm:top-32 sm:text-lg"
              >
                +{xp.n} XP ⭐
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Bottom: Ziggy's bubble, the path, the rails, Undo and Go */}
          <div ref={bottomRef} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4">
            <AnimatePresence initial={false}>
              {toast ? (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.25 }}
                  role="status"
                  className={`relative flex max-w-md items-center gap-2 rounded-3xl bg-white px-3 py-2 text-left text-sm font-bold shadow-xl ring-2 sm:text-base ${toast.kind === 'hint' ? 'ring-[#ffd0a8]' : toast.kind === 'praise' ? 'ring-[#ffd6e8]' : 'ring-[#d9ccff]'}`}
                >
                  <ZiggyAvatar size={30} ring={false} className="shrink-0" />
                  <span className="min-w-0 flex-1">{nb(toast.text)}</span>
                  <span className="pointer-events-auto">
                    <SayButton texts={[toast.text]} locale={locale} size="sm" />
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="pointer-events-auto w-full max-w-2xl">
              {phase === 'play' && ride && status === 'build' ? (
                <motion.div
                  key={`${index}-${run}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0 : 0.3 }}
                  className="rounded-[1.6rem] bg-white/92 p-2.5 shadow-[0_8px_30px_rgba(60,30,90,.22)] ring-1 ring-white sm:p-3"
                >
                  {/* The path so far, as an equation */}
                  {!ride.autoLaunch ? (
                    <div className="mb-2 flex flex-wrap items-center justify-center gap-1 font-display text-base font-bold sm:text-lg" aria-label={stops.join(' → ')}>
                      <span className="rounded-xl bg-[#dff8e6] px-2.5 py-1 text-[#14532d] ring-1 ring-[#a7e8bd]">🚃 {ride.start}</span>
                      {[...ride.preset, ...path].map((op, i) => (
                        <span key={i} className={`rounded-xl px-2 py-1 ring-1 ${OP_CHIP[op.kind]} ${i < ride.preset.length ? 'opacity-75' : ''}`}>
                          {opLabel(op)}
                        </span>
                      ))}
                      {Array.from({ length: Math.max(0, Math.min(ride.slots, 4) - path.length) }, (_, i) => (
                        <span key={`s${i}`} className="grid h-8 w-10 place-items-center rounded-xl border-2 border-dashed border-[#d7c6ee] text-sm text-[#b9a3d8]" aria-hidden="true">
                          ?
                        </span>
                      ))}
                      {path.length || ride.preset.length ? (
                        <span className="rounded-xl bg-[#fff6d6] px-2.5 py-1 text-[#7a4a00] ring-1 ring-[#ffe08a]">= {verdict?.reached}</span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* The rails to choose from */}
                  <div className="flex flex-wrap items-stretch justify-center gap-2" data-tv-row="" role="group" aria-label={tr(T.rails, locale)}>
                    {ride.palette.map((op) => {
                      const ok = canAdd(ride, path, op);
                      const hinted = hint?.kind === 'piece' && sameOp(hint.op, op);
                      const compare = ride.kind === 'compare';
                      return (
                        <motion.button
                          key={opKey(op)}
                          type="button"
                          onClick={() => addPiece(op)}
                          disabled={!ok}
                          whileTap={reduce ? undefined : { scale: 0.9 }}
                          animate={hinted && !reduce ? { y: [0, -6, 0] } : { y: 0 }}
                          transition={hinted ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
                          data-tv-autofocus={firstEnabled && sameOp(firstEnabled, op) ? '' : undefined}
                          aria-label={compare ? String(op.n) : `${opLabel(op)} (${opSpoken(op, locale)})`}
                          className={`flex min-h-[72px] min-w-[84px] flex-col items-center justify-center rounded-2xl bg-gradient-to-b px-3 py-2 font-display font-bold text-white shadow-[0_6px_0_rgba(0,0,0,.15)] transition disabled:opacity-35 sm:min-w-[96px] ${compare ? 'min-w-[120px] text-4xl' : 'text-3xl'} ${OP_STYLE[op.kind]} ${hinted ? 'ring-4 ring-[#ffe066] ring-offset-2' : ''}`}
                        >
                          <span>{compare ? op.n : opLabel(op)}</span>
                          {little && op.kind === 'add' ? <Dots n={op.n} className="mt-1 text-white" /> : null}
                        </motion.button>
                      );
                    })}
                  </div>

                  {!ride.autoLaunch ? (
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={undo}
                        disabled={!path.length}
                        className={`flex min-h-[64px] items-center gap-2 rounded-2xl bg-[#f3ecff] px-4 font-bold text-[#5b3f8f] transition hover:bg-[#e8dcff] disabled:opacity-40 sm:px-5 ${hint?.kind === 'undo' ? 'ring-4 ring-[#ffe066]' : ''}`}
                      >
                        <span aria-hidden="true" className="text-2xl">
                          ↩
                        </span>
                        <span>{tr(T.undo, locale)}</span>
                      </button>
                      <motion.button
                        type="button"
                        onClick={() => launch()}
                        disabled={!path.length}
                        whileTap={reduce ? undefined : { scale: 0.94 }}
                        animate={path.length && !reduce ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                        transition={path.length ? { duration: 1.3, repeat: Infinity } : { duration: 0.2 }}
                        className="flex min-h-[64px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff7ab8] via-[#ff9f5a] to-[#ffcc33] px-5 font-display text-xl font-bold text-white shadow-[0_8px_24px_rgba(255,122,184,.45)] disabled:opacity-45 sm:text-2xl"
                      >
                        <span aria-hidden="true">🎢</span> {tr(T.go, locale)}
                      </motion.button>
                    </div>
                  ) : null}
                </motion.div>
              ) : null}

              {phase === 'play' && status !== 'build' ? (
                <div className="mx-auto flex w-fit items-center gap-3 rounded-full bg-white/92 px-4 py-2 font-display text-lg font-bold shadow-lg ring-1 ring-white">
                  <span aria-hidden="true">{status === 'splash' ? '💦' : status === 'missed' ? '🌀' : '🎢'}</span>
                  <span>{status === 'splash' ? tr(T.splash, locale) : status === 'missed' ? tr(T.boing, locale) : tr(T.riding, locale)}</span>
                  {current !== null && status === 'riding' ? (
                    <span className="grid min-w-10 place-items-center rounded-full bg-[#5b6fd8] px-2 py-0.5 text-white" aria-live="polite">
                      {current}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {/* Intro */}
      {phase === 'intro' || phase === 'loading' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-gradient-to-b from-[#5a63c9] via-[#f59bb8] to-[#ffc98a] p-6 text-center text-white">
          <Floaters reduce={reduce} />
          <motion.div className="relative h-36 w-36 sm:h-40 sm:w-40" animate={reduce ? undefined : { y: [0, -12, 0], rotate: [0, -4, 4, 0] }} transition={{ duration: 3, repeat: Infinity }} aria-hidden="true">
            <div className="grid h-full w-full place-items-end justify-center overflow-hidden rounded-full bg-white/75 shadow-[0_20px_60px_rgba(255,150,200,.5)] ring-8 ring-white/60">
              <MascotCutout pose="wave" width={120} glow={false} className="translate-y-3" />
            </div>
            <span className="absolute -bottom-1 -right-2 text-5xl">🎢</span>
          </motion.div>
          <h1 className="relative font-display text-4xl font-bold drop-shadow-[0_3px_0_rgba(90,40,120,.35)] sm:text-6xl">{tr(T.title, locale)}</h1>
          <p className="relative max-w-lg text-lg font-semibold text-white/95 drop-shadow-sm">{nb(tr(T.teaser, locale))}</p>
          <div className="relative flex flex-wrap items-center justify-center gap-2" aria-hidden="true">
            {(['+2', '−1', '×2'] as const).map((l, i) => (
              <span key={l} className={`rounded-2xl bg-gradient-to-b px-4 py-2 font-display text-2xl font-bold text-white shadow ${[OP_STYLE.add, OP_STYLE.sub, OP_STYLE.mul][i]}`}>
                {l}
              </span>
            ))}
          </div>
          <p className="relative max-w-md text-sm font-semibold text-white/90">{nb(tr(T.how, locale))}</p>
          {supported ? (
            <button
              type="button"
              data-tv-autofocus=""
              disabled={!hydrated || phase === 'loading'}
              onClick={() => void start()}
              className="relative mt-1 min-h-[64px] rounded-full bg-gradient-to-r from-[#ffcc33] via-[#ff9f5a] to-[#ff7ab8] px-10 py-4 text-xl font-bold text-white shadow-[0_10px_40px_rgba(255,122,184,.55)] transition hover:scale-105 disabled:opacity-60"
            >
              {phase === 'loading' ? tr(T.loading, locale) : `🎢 ${tr(T.play, locale)}`}
            </button>
          ) : (
            <p className="relative rounded-2xl bg-white/90 px-4 py-3 font-semibold text-[#2a1b4a]">{tr(T.noWebgl, locale)}</p>
          )}
          <Link href="/monde" className="relative text-sm font-semibold text-white/90 underline">
            ← {tr(T.back, locale)}
          </Link>
        </div>
      ) : null}

      {/* The end: after the Ferris wheel */}
      {phase === 'result' ? (
        <div className="absolute inset-0 flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.4 }}
            className="w-full max-w-md rounded-[2rem] bg-white/94 p-6 text-center shadow-2xl ring-1 ring-white"
          >
            <h2 className="font-display text-3xl font-bold">🎡 {nb(tr(T.done, locale))}</h2>
            <p className="mt-1 font-semibold text-[#6b5a86]">{nb(tr(T.doneSub, locale))}</p>
            <p className="mt-3 text-4xl" aria-label={`${RIDES_PER_GAME} 🎟️`}>
              {'🎟️'.repeat(RIDES_PER_GAME)}
            </p>
            <p className="mt-2 text-lg font-bold text-[#c2410c]">+{totals.xp} XP ⭐</p>
            <div className="mt-3">
              <MomentChips moments={totals.magic} locale={locale} />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                data-tv-autofocus=""
                onClick={replay}
                className="min-h-[56px] rounded-full bg-gradient-to-r from-[#ffcc33] to-[#ff7ab8] px-6 py-3 font-bold text-white shadow-lg"
              >
                ↻ {tr(T.again, locale)}
              </button>
              <Link href="/monde" className="grid min-h-[56px] place-items-center rounded-full bg-[#f3ecff] px-6 py-3 font-bold text-[#5b3f8f]">
                {tr(T.world, locale)}
              </Link>
            </div>
            <MagicMoments key={run} moments={totals.magic} locale={locale} />
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}

function Floaters({ reduce }: { reduce: boolean }) {
  const items = ['🎈', '🎡', '🎠', '🦆', '🍭', '✨', '🎪', '🍿'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {items.concat(items).map((e, i) => (
        <motion.span
          key={i}
          className="absolute text-3xl opacity-45"
          style={{ left: `${i % 2 ? 84 + ((i * 7) % 12) : 2 + ((i * 11) % 12)}%`, top: `${(i * 37 + 11) % 90}%` }}
          animate={reduce ? undefined : { y: [0, -16, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: (i % 5) * 0.4 }}
        >
          {e}
        </motion.span>
      ))}
    </div>
  );
}
