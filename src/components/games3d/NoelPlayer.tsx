'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import type { NoelGame, NoelState } from '@/games3d/noel/NoelGame';
import { COLOR_HEX, COLOR_NAME, MISSIONS, missionText, progressOf, type Band, type Ornament } from '@/games3d/noel/missions';
import { getMemory, useHydrated, useWorldMemory } from '@/lib/world/store';
import { maxDifficulty, readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { RoundOutcome } from '@/lib/world/engine';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { MagicMoments, MomentChips } from '@/components/world/MagicMoments';

const T = {
  title: { fr: 'Le Noël de Ziggy', en: 'Ziggy’s Christmas' },
  teaser: { fr: 'Livre les cadeaux du village enneigé et illumine le grand sapin !', en: 'Deliver the presents in the snowy village and light up the big tree!' },
  play: { fr: 'Jouer', en: 'Play' },
  how: { fr: 'Touche le sol pour faire marcher Ziggy (ou les flèches du clavier). Touche un cadeau pour aller le chercher.', en: 'Tap the ground to walk (or use the arrow keys). Tap a present to go and get it.' },
  mission: { fr: 'Mission', en: 'Mission' },
  tree: { fr: 'Quelle boule vient ensuite ?', en: 'Which bauble comes next?' },
  carry: { fr: 'Dans les bras', en: 'Carrying' },
  music: { fr: 'Musique', en: 'Music' },
  back: { fr: 'Arcade', en: 'Arcade' },
  done: { fr: 'Joyeux Noël !', en: 'Merry Christmas!' },
  again: { fr: 'Rejouer', en: 'Play again' },
  noWebgl: { fr: 'Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.', en: 'This 3D game needs WebGL, which this device does not support.' },
  loading: { fr: 'Ziggy prépare le village…', en: 'Ziggy is getting the village ready…' },
} satisfies Record<string, L>;

const ORN_NAME: Record<Ornament, L> = {
  red: COLOR_NAME.red,
  yellow: COLOR_NAME.yellow,
  blue: COLOR_NAME.blue,
  green: COLOR_NAME.green,
  purple: COLOR_NAME.purple,
};

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function NoelPlayer() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<NoelGame | null>(null);
  const [phase, setPhase] = useState<'intro' | 'loading' | 'play' | 'result'>('intro');
  const [state, setState] = useState<NoelState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [music, setMusic] = useState(true);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [supported, setSupported] = useState(true);
  const [run, setRun] = useState(0);

  useEffect(() => setSupported(webglOk()), []);

  const band: Band = (memory.age ?? 'middle') as Band;

  const say = useCallback(
    (text: string, kind: 'mission' | 'hint' | 'praise') => {
      // The mission is already on screen; the bubble is for Ziggy's hints and praise.
      if (kind !== 'mission') setToast(text);
      if (readAloudOn(getMemory()) || kind === 'mission') void speakSequence(`noel-${kind}`, [text], locale);
    },
    [locale]
  );

  const start = async () => {
    unlockAudio();
    setPhase('loading');
    const { NoelGame } = await import('@/games3d/noel/NoelGame');
    const m = getMemory();
    const skill = band === 'little' ? 'counting' : 'addition';
    const level = Math.min(m.skills[skill]?.difficulty ?? 1, maxDifficulty(m));
    const started = performance.now();
    game.current?.dispose();
    game.current = new NoelGame(canvas.current!, Math.floor(Math.random() * 1e6), band, level, locale, {
      onState: setState,
      onSay: say,
      onFinish: (s) => {
        setOutcome(finishExtraGame('noel_3d', skill, s, performance.now() - started));
        setPhase('result');
      },
    });
    game.current.setMusic(music);
    // Lets the end-to-end test drive the game; never in production.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __noel?: NoelGame }).__noel = game.current;
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
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const plan = state?.plan;
  const prog = plan && state ? progressOf(plan.mission, state.carried) : null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#0b1238] text-white">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" aria-label={tr(T.title, locale)} />

      {/* HUD */}
      {phase === 'play' && state ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3 sm:p-4">
            <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-3xl bg-[#0b1238]/70 p-3 shadow-xl ring-1 ring-white/15 backdrop-blur-md">
              <Link href="/monde/arcade" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-lg" aria-label={tr(T.back, locale)}>
                ✕
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-200/90">
                  🎄 {state.phase === 'explore' ? `${tr(T.mission, locale)} ${state.missionIndex + 1} / ${MISSIONS}` : state.phase === 'tree' ? tr(T.tree, locale) : tr(T.done, locale)}
                </p>
                <p className="text-sm font-semibold leading-snug sm:text-base">
                  {state.phase === 'explore' && plan ? missionText(plan, locale) : state.phase === 'tree' ? tr(T.tree, locale) : '✨🎄✨'}
                </p>
              </div>
              {plan ? <SayButton texts={[state.phase === 'explore' ? missionText(plan, locale) : tr(T.tree, locale)]} locale={locale} /> : null}
              <button
                type="button"
                onClick={() => {
                  setMusic((m) => !m);
                  game.current?.setMusic(!music);
                }}
                aria-pressed={music}
                aria-label={tr(T.music, locale)}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg ${music ? 'bg-amber-200/90 text-[#2a1650]' : 'bg-white/10'}`}
              >
                🎵
              </button>
            </div>
            {/* Mission progress */}
            {state.phase === 'explore' && prog && plan ? (
              <div className="flex items-center gap-2 rounded-full bg-[#0b1238]/70 px-4 py-2 text-sm font-bold ring-1 ring-white/10 backdrop-blur">
                <span aria-hidden="true">🎁</span>
                <span>{tr(T.carry, locale)} :</span>
                {plan.mission.kind === 'sum' ? (
                  <span>
                    {state.carried.map((g) => g.value).join(' + ') || '0'} = {prog.have} / {prog.need}
                  </span>
                ) : (
                  <span className="flex gap-1" aria-label={`${prog.have} / ${prog.need}`}>
                    {Array.from({ length: prog.need }, (_, i) => (
                      <span key={i} className="h-4 w-4 rounded" style={{ backgroundColor: i < prog.have ? (state.carried[i] ? COLOR_HEX[state.carried[i].color] : '#fff') : 'rgba(255,255,255,.2)' }} />
                    ))}
                  </span>
                )}
                {state.ready ? <span className="ms-1 rounded-full bg-green-400/90 px-2 py-0.5 text-xs text-[#0b2a12]">✓</span> : null}
              </div>
            ) : null}
            <div className="flex gap-1.5" aria-hidden="true">
              {Array.from({ length: MISSIONS + 1 }, (_, i) => (
                <span key={i} className={`h-2 rounded-full transition-all ${i < state.missionIndex + (state.phase !== 'explore' ? 1 : 0) ? 'w-5 bg-amber-200' : i === state.missionIndex ? 'w-8 bg-white' : 'w-5 bg-white/25'}`} />
              ))}
            </div>
          </div>

          {/* Tree decoration choices */}
          {state.phase === 'tree' && state.pattern ? (
            <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-3 px-3">
              <div className="flex items-center gap-2 rounded-full bg-[#0b1238]/75 px-4 py-2 ring-1 ring-white/15 backdrop-blur" aria-label={tr(T.tree, locale)}>
                {state.pattern.shown.map((o, i) => (
                  <span key={i} className="h-7 w-7 rounded-full shadow-inner ring-2 ring-white/40" style={{ backgroundColor: COLOR_HEX[o] }} title={tr(ORN_NAME[o], locale)} />
                ))}
                <motion.span className="grid h-8 w-8 place-items-center rounded-full border-2 border-dashed border-white/70 font-bold" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                  ?
                </motion.span>
              </div>
              <div className="flex gap-3">
                {state.pattern.choices.map((o) => (
                  <motion.button
                    key={`${state.round}-${o}`}
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => game.current?.chooseOrnament(o)}
                    aria-label={tr(ORN_NAME[o], locale)}
                    className="grid h-20 w-20 place-items-center rounded-full shadow-[0_0_30px_rgba(255,255,255,.25)] ring-4 ring-white/70"
                    style={{ background: `radial-gradient(circle at 30% 30%, #fff, ${COLOR_HEX[o]} 45%)` }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* Ziggy's words */}
          <AnimatePresence>
            {toast ? (
              <motion.p
                key={toast}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="status"
                className={`pointer-events-none absolute left-1/2 max-w-md -translate-x-1/2 rounded-2xl bg-white/95 px-4 py-2 text-center text-sm font-bold text-[#1b2150] shadow-xl ${state.phase === 'tree' ? 'bottom-48' : 'bottom-6'}`}
              >
                🤖 {toast}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}

      {/* Intro */}
      {phase === 'intro' || phase === 'loading' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#0b1238] via-[#1e2a6b] to-[#3b4a8f] p-6 text-center">
          <Flakes />
          <motion.div className="text-8xl" animate={{ y: [0, -10, 0], rotate: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity }} aria-hidden="true">
            🎄
          </motion.div>
          <h1 className="font-display text-4xl font-bold drop-shadow sm:text-6xl">{tr(T.title, locale)}</h1>
          <p className="max-w-lg text-lg text-white/80">{tr(T.teaser, locale)}</p>
          <p className="max-w-md text-sm text-white/60">{tr(T.how, locale)}</p>
          {supported ? (
            <button
              type="button"
              disabled={!hydrated || phase === 'loading'}
              onClick={() => void start()}
              className="rounded-full bg-gradient-to-r from-red-400 to-amber-300 px-10 py-4 text-xl font-bold text-[#2a1020] shadow-[0_0_40px_rgba(255,180,90,.45)] transition hover:scale-105 disabled:opacity-60"
            >
              {phase === 'loading' ? tr(T.loading, locale) : `▶ ${tr(T.play, locale)}`}
            </button>
          ) : (
            <p className="rounded-2xl bg-white/10 px-4 py-3">{tr(T.noWebgl, locale)}</p>
          )}
          <Link href="/monde/arcade" className="text-sm text-white/60 underline">
            ← {tr(T.back, locale)}
          </Link>
        </div>
      ) : null}

      {/* Result */}
      {phase === 'result' && outcome ? (
        <div className="absolute inset-0 flex items-end justify-center p-4 sm:items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-[2rem] bg-[#0b1238]/85 p-6 text-center ring-1 ring-white/15 backdrop-blur-md">
            <h2 className="font-display text-3xl font-bold">🎄 {tr(T.done, locale)}</h2>
            <p className="mt-2 text-4xl" aria-label={`${outcome.stars} ⭐`}>
              {'⭐'.repeat(outcome.stars)}
              <span className="opacity-25">{'⭐'.repeat(3 - outcome.stars)}</span>
            </p>
            <p className="mt-2 font-bold text-amber-200">+{outcome.xpGained} XP</p>
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

function Flakes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute text-white/70"
          style={{ left: `${(i * 37) % 100}%`, top: -20, fontSize: 8 + (i % 4) * 4 }}
          animate={{ y: ['0vh', '110vh'], x: [0, i % 2 ? 20 : -20] }}
          transition={{ duration: 8 + (i % 6), repeat: Infinity, delay: (i % 10) * 0.7, ease: 'linear' }}
        >
          ❄
        </motion.span>
      ))}
    </div>
  );
}
