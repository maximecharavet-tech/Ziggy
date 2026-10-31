'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Link } from '@/i18n/navigation';
import type { DinoGame, DinoState, SayKind } from '@/games3d/dino/DinoGame';
import { DINO_SKILLS, GAME_ID, choiceKey, choiceLabel, dinoLabel, planGame, roundsFor, type Band, type Choice, type DinoId, type PieceId, type Question } from '@/games3d/dino/logic';
import { getMemory, useHydrated, useWorldMemory } from '@/lib/world/store';
import { maxDifficulty, readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { RoundOutcome } from '@/lib/world/engine';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { MagicMoments, MomentChips } from '@/components/world/MagicMoments';
import { MascotCutout, ZiggyAvatar } from '@/components/ziggy/Mascot';

const T = {
  title: { fr: 'Ziggy Paléontologue', en: 'Ziggy the Dino Digger' },
  teaser: {
    fr: 'Des os de dinosaures sont cachés dans le sable ! Creuse avec Ziggy, reconstruis les squelettes… et regarde-les se réveiller !',
    en: 'Dinosaur bones are hidden in the sand! Dig with Ziggy, rebuild the skeletons… and watch them wake up!',
  },
  how: {
    fr: 'Frotte le sable avec ton doigt (ou la souris), puis choisis le bon os pour chaque endroit qui brille.',
    en: 'Rub the sand with your finger (or the mouse), then pick the right bone for each shining spot.',
  },
  play: { fr: 'Creuser !', en: 'Let’s dig!' },
  loading: { fr: 'Ziggy prépare ses pinceaux…', en: 'Ziggy is getting the brushes ready…' },
  back: { fr: 'Retour', en: 'Back' },
  music: { fr: 'Musique', en: 'Music' },
  brush: { fr: 'Gratter', en: 'Brush' },
  bones: { fr: 'Os trouvés', en: 'Bones found' },
  turnLeft: { fr: 'Tourner à gauche', en: 'Turn left' },
  turnRight: { fr: 'Tourner à droite', en: 'Turn right' },
  place: { fr: 'Poser', en: 'Put it in' },
  turn: { fr: 'Tourner', en: 'Turn' },
  skip: { fr: 'Continuer', en: 'Continue' },
  nextDino: { fr: 'Dinosaure suivant', en: 'Next dinosaur' },
  toMuseum: { fr: 'Au musée !', en: 'To the museum!' },
  museumDone: { fr: 'Ton musée des dinosaures !', en: 'Your dinosaur museum!' },
  rebuilt: { fr: 'dinosaures reconstruits', en: 'dinosaurs rebuilt' },
  again: { fr: 'Rejouer', en: 'Play again' },
  noWebgl: { fr: 'Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.', en: 'This 3D game needs WebGL, which this device does not support.' },
  whichBone: { fr: 'Choisis l’os', en: 'Pick the bone' },
  palm: { fr: 'Palmier', en: 'Palm tree' },
} satisfies Record<string, L>;

const PALM_NAMES: Record<number, L[]> = {
  2: [
    { fr: 'À gauche', en: 'Left' },
    { fr: 'À droite', en: 'Right' },
  ],
  3: [
    { fr: 'À gauche', en: 'Left' },
    { fr: 'Au milieu', en: 'Middle' },
    { fr: 'À droite', en: 'Right' },
  ],
};
const PALM_ARROWS: Record<number, string[]> = { 2: ['←', '→'], 3: ['←', '↑', '→'] };

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

type Thumbs = DinoGame['thumbs'];

export function DinoPlayer() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const reduce = Boolean(useReducedMotion());
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<DinoGame | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'intro' | 'loading' | 'play'>('intro');
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<DinoState | null>(null);
  const [instruction, setInstruction] = useState('');
  const [bubble, setBubble] = useState<{ text: string; kind: SayKind; id: number } | null>(null);
  const [pop, setPop] = useState<{ text: string; id: number } | null>(null);
  const [xp, setXp] = useState<{ n: number; id: number } | null>(null);
  const [outcomes, setOutcomes] = useState<RoundOutcome[]>([]);
  const [music, setMusic] = useState(true);
  const [thumbs, setThumbs] = useState<Thumbs | null>(null);
  const [flash, setFlash] = useState(0);
  const [finished, setFinished] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => setSupported(webglOk()), []);

  const band: Band = (memory.age ?? 'middle') as Band;

  const speak = useCallback(
    (lines: string[], id: string) => {
      if (!readAloudOn(getMemory())) return;
      void speakSequence(id, lines.filter(Boolean), locale);
    },
    [locale]
  );

  const onSay = useCallback(
    (text: string, kind: SayKind, extra?: string[]) => {
      if (kind === 'count') {
        setPop({ text, id: Date.now() });
        speak([text], 'dino-count');
        return;
      }
      if (kind === 'instruction' || kind === 'question') setInstruction(text);
      setBubble({ text, kind, id: Date.now() });
      speak([text, ...(extra ?? [])], `dino-${kind}`);
    },
    [speak]
  );

  const start = async () => {
    unlockAudio();
    setPhase('loading');
    setFinished(false);
    setOutcomes([]);
    setState(null);
    setXp(null);
    stopSpeaking();
    const m = getMemory();
    const levels = DINO_SKILLS.map((s) => m.skills[s]?.difficulty ?? 1);
    const level = Math.min(Math.round(levels.reduce((a, b) => a + b, 0) / levels.length), maxDifficulty(m));
    const seed = Math.floor(Math.random() * 1e6);
    const plan = planGame(seed, (m.age ?? 'middle') as Band, level);
    game.current?.dispose();
    game.current = null;
    try {
      const { DinoGame } = await import('@/games3d/dino/DinoGame');
      const g = new DinoGame(canvas.current!, plan, seed, locale, {
        onState: setState,
        onSay,
        onRoundDone: (r) => {
          const o = finishExtraGame(GAME_ID, r.skill, { correct: r.correct, mistakes: r.mistakes, total: r.total }, r.durationMs);
          setOutcomes((list) => [...list, o]);
          setXp({ n: o.xpGained, id: Date.now() });
        },
        onFinish: () => setFinished(true),
      });
      game.current = g;
      g.setMusic(music);
      setThumbs(g.thumbs);
      // Lets the end-to-end test drive the game; never in production.
      if (process.env.NODE_ENV !== 'production') (window as unknown as { __dino?: DinoGame }).__dino = g;
    } catch {
      setSupported(false);
      setPhase('intro');
      return;
    }
    setPhase('play');
    setRun((n) => n + 1);
  };

  useEffect(
    () => () => {
      game.current?.dispose();
      game.current = null;
      stopSpeaking();
    },
    []
  );

  // The camera frames the action between the HUD bars.
  useEffect(() => {
    if (phase !== 'play') return;
    const measure = () => {
      const top = topRef.current?.getBoundingClientRect();
      const bottom = bottomRef.current?.getBoundingClientRect();
      const h = window.innerHeight;
      game.current?.setInsets(top ? top.bottom + 8 : 80, bottom ? Math.max(0, h - bottom.top) + 8 : 200);
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
  }, [phase, state?.phase]);

  useEffect(() => {
    if (!bubble || bubble.kind === 'instruction' || bubble.kind === 'question') return;
    const t = setTimeout(() => setBubble((b) => (b && b.id === bubble.id ? null : b)), 4200);
    return () => clearTimeout(t);
  }, [bubble]);
  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(null), 1100);
    return () => clearTimeout(t);
  }, [pop]);
  useEffect(() => {
    if (!xp) return;
    const t = setTimeout(() => setXp(null), 3600);
    return () => clearTimeout(t);
  }, [xp]);
  useEffect(() => {
    if (!state?.flash) return;
    setFlash(state.flash);
    const t = setTimeout(() => setFlash(0), 450);
    return () => clearTimeout(t);
  }, [state?.flash]);

  const s = state;
  const g = () => game.current;
  const shown = bubble && bubble.kind !== 'instruction' && bubble.kind !== 'question' ? bubble.text : instruction;
  const totalXp = outcomes.reduce((a, o) => a + o.xpGained, 0);
  const magic = outcomes.flatMap((o) => o.magic);
  const dinoThumb = (d: DinoId) => thumbs?.dino.get(d);
  const rounds = s?.rounds ?? roundsFor(band);

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-gradient-to-b from-[#7cc6ff] to-[#ffe2b0] text-[#3a2a1a]">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" aria-label={tr(T.title, locale)} />

      {phase === 'play' && s ? (
        <>
          {/* Top bar: back, the dinosaurs of the game, music */}
          <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 p-2 sm:p-4">
            <div className="pointer-events-auto mx-auto flex w-full max-w-4xl items-center gap-2 rounded-[1.75rem] bg-white/90 p-2 shadow-[0_8px_30px_rgba(90,60,20,.18)] ring-1 ring-white sm:gap-3">
              <Link
                href="/monde"
                aria-label={tr(T.back, locale)}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#fff1dc] text-xl font-bold text-[#8a5a2b] transition hover:bg-[#ffe6c2]"
              >
                ←
              </Link>
              <p className="hidden min-w-0 flex-1 truncate font-display text-lg font-bold sm:block">🦴 {tr(T.title, locale)}</p>
              <ol className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:flex-none" aria-label={`${s.done.length} / ${rounds}`}>
                {Array.from({ length: rounds }, (_, i) => {
                  const doneId = s.done[i];
                  const current = i === s.round && !doneId;
                  return (
                    <li
                      key={i}
                      className={`grid h-11 w-11 place-items-center overflow-hidden rounded-full text-lg ${doneId ? 'bg-[#e9f8e4] ring-2 ring-[#7fd06b]' : current ? 'bg-[#fff1dc] ring-2 ring-[#ffb347]' : 'bg-[#f3ece2]'}`}
                    >
                      {doneId && dinoThumb(doneId) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={dinoThumb(doneId)} alt={dinoLabel(doneId, locale)} className="h-full w-full scale-125 object-contain" />
                      ) : (
                        <span aria-hidden="true">{current ? '🦴' : '❔'}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <button
                type="button"
                onClick={() => {
                  g()?.setMusic(!music);
                  setMusic(!music);
                }}
                aria-pressed={music}
                aria-label={tr(T.music, locale)}
                title={tr(T.music, locale)}
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl transition ${music ? 'bg-gradient-to-br from-[#ffd166] to-[#ff9f43]' : 'bg-[#f3ece2]'}`}
              >
                <span aria-hidden="true">🎵</span>
              </button>
            </div>
          </div>

          {/* +XP */}
          <AnimatePresence>
            {xp ? (
              <motion.div
                key={xp.id}
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                role="status"
                className="pointer-events-none absolute right-3 top-20 rounded-full bg-gradient-to-r from-amber-300 to-pink-300 px-4 py-2 text-base font-bold text-[#4a2350] shadow-lg sm:right-6 sm:top-24 sm:text-lg"
              >
                +{xp.n} XP ⭐
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* A bone found: Ziggy counts out loud */}
          <AnimatePresence>
            {pop ? (
              <motion.div
                key={pop.id}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduce ? 1 : 1.4 }}
                transition={{ duration: reduce ? 0 : 0.25 }}
                className="pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2 rounded-full bg-white/95 px-6 py-2 font-display text-4xl font-bold text-[#e07a1f] shadow-xl sm:text-5xl"
                aria-hidden="true"
              >
                🦴 {s.found}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Bottom: Ziggy's bubble and the actions */}
          <div ref={bottomRef} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4">
            {shown && !(s.phase === 'museum' && finished) ? (
              <motion.div
                key={shown}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                role="status"
                className={`pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-3xl px-3 py-2 text-sm font-bold shadow-xl ring-2 sm:text-base ${bubble?.kind === 'hint' && shown === bubble.text ? 'bg-[#fff6e0] ring-[#ffd089]' : 'bg-white ring-[#ffe2b8]'}`}
              >
                <ZiggyAvatar size={36} ring={false} className="shrink-0" />
                <p className="min-w-0 flex-1 leading-snug">{shown}</p>
                <SayButton texts={[shown, ...questionWords(s.question, s.phase, locale, band)]} locale={locale} size="sm" />
              </motion.div>
            ) : null}

            <div data-tv-stage className="pointer-events-auto flex w-full max-w-2xl flex-col items-center gap-2">
              {s.phase === 'dig' ? <DigPanel state={s} band={band} locale={locale} onBrush={() => g()?.brushOnce()} /> : null}

              {(s.phase === 'digQuestion' || s.phase === 'quiz') && s.question ? (
                <QuestionPanel key={`${s.round}-${s.phase}`} q={s.question} band={band} locale={locale} thumbs={thumbs} busy={s.busy} onAnswer={(i) => g()?.answer(i)} />
              ) : null}

              {s.phase === 'build' && s.choices.length ? (
                <div className="w-full rounded-[1.75rem] bg-white/90 p-2 shadow-[0_8px_30px_rgba(90,60,20,.2)] ring-1 ring-white sm:p-3" aria-label={tr(T.whichBone, locale)}>
                  <div data-tv-row className={`grid gap-2 ${s.choices.length >= 4 ? 'grid-cols-4' : s.choices.length === 3 ? 'grid-cols-3' : s.choices.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {s.choices.map((p, i) => (
                      <BoneButton key={`${s.step}-${p}`} piece={p} dino={s.dino} thumbs={thumbs} locale={locale} busy={s.busy} autoFocus={i === 0} onClick={() => g()?.chooseBone(p)} />
                    ))}
                  </div>
                </div>
              ) : null}

              {s.phase === 'turn' ? (
                <div data-tv-row className="grid w-full grid-cols-3 gap-2 rounded-[1.75rem] bg-white/90 p-2 shadow-[0_8px_30px_rgba(90,60,20,.2)] ring-1 ring-white sm:p-3">
                  <BigButton label={tr(T.turnLeft, locale)} sub={tr(T.turn, locale)} emoji="↺" onClick={() => g()?.turn(-1)} busy={s.busy} />
                  <BigButton label={tr(T.place, locale)} emoji="✓" onClick={() => g()?.place()} busy={s.busy} primary autoFocus />
                  <BigButton label={tr(T.turnRight, locale)} sub={tr(T.turn, locale)} emoji="↻" onClick={() => g()?.turn(1)} busy={s.busy} />
                </div>
              ) : null}

              {s.phase === 'hide' && s.palms ? (
                <div data-tv-row className={`grid w-full gap-2 rounded-[1.75rem] bg-white/90 p-2 shadow-[0_8px_30px_rgba(90,60,20,.2)] ring-1 ring-white sm:p-3 ${s.palms === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {Array.from({ length: s.palms }, (_, i) => (
                    <BigButton
                      key={i}
                      label={`${tr(T.palm, locale)} — ${tr(PALM_NAMES[s.palms][i], locale)}`}
                      emoji="🌴"
                      sub={PALM_ARROWS[s.palms][i]}
                      onClick={() => g()?.pickPalm(i)}
                      busy={s.busy}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
              ) : null}

              {s.canSkip ? (
                <button
                  type="button"
                  data-tv-autofocus
                  onClick={() => g()?.next()}
                  className="min-h-[56px] rounded-full bg-white/90 px-6 py-3 text-base font-bold text-[#8a5a2b] shadow-lg ring-1 ring-white transition hover:bg-white"
                >
                  {tr(T.skip, locale)} ⏭
                </button>
              ) : null}

              {s.phase === 'roundDone' ? (
                <motion.button
                  type="button"
                  data-tv-autofocus
                  initial={reduce ? false : { scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={() => g()?.next()}
                  className={`min-h-[72px] w-full max-w-md rounded-full bg-gradient-to-r from-[#ffb347] to-[#ff7a59] px-8 py-4 text-xl font-bold text-white shadow-[0_10px_30px_rgba(255,122,89,.45)] transition ${s.busy ? 'opacity-70' : ''}`}
                >
                  {s.round + 1 >= s.rounds ? `🏛️ ${tr(T.toMuseum, locale)}` : `▶ ${tr(T.nextDino, locale)}`}
                </motion.button>
              ) : null}

              {s.phase === 'museum' && finished ? (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-md rounded-[2rem] bg-white/95 p-4 text-center shadow-2xl ring-1 ring-white sm:p-6"
                >
                  <h2 className="font-display text-xl font-bold sm:text-2xl">🏛️ {tr(T.museumDone, locale)}</h2>
                  <div className="mt-2 flex justify-center gap-2">
                    {s.done.map((d) => (
                      <span key={d} className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-[#fff6e6] ring-1 ring-[#ffe2b8]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {dinoThumb(d) ? <img src={dinoThumb(d)} alt={dinoLabel(d, locale)} className="h-full w-full object-contain" /> : <span aria-hidden="true">🦕</span>}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-base font-semibold text-[#6b5235]">
                    {s.done.length} {tr(T.rebuilt, locale)} · <span className="font-bold text-[#e07a1f]">+{totalXp} XP ⭐</span>
                  </p>
                  <div className="mt-2">
                    <MomentChips moments={magic} locale={locale} />
                  </div>
                  <div data-tv-row className="mt-4 flex justify-center gap-3">
                    <button type="button" data-tv-autofocus onClick={() => void start()} className="min-h-[56px] rounded-full bg-gradient-to-r from-[#ffb347] to-[#ff7a59] px-6 py-3 text-lg font-bold text-white shadow-lg">
                      ↻ {tr(T.again, locale)}
                    </button>
                    <Link href="/monde" className="grid min-h-[56px] place-items-center rounded-full bg-[#f3ece2] px-6 py-3 text-lg font-bold text-[#6b5235]">
                      {tr(T.back, locale)}
                    </Link>
                  </div>
                  <MagicMoments key={run} moments={magic} locale={locale} />
                </motion.div>
              ) : null}
            </div>
          </div>

          {/* The museum photo */}
          {flash && !reduce ? (
            <motion.div key={flash} initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.45 }} className="pointer-events-none absolute inset-0 bg-white" aria-hidden="true" />
          ) : null}
        </>
      ) : null}

      {/* Intro */}
      {phase !== 'play' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-gradient-to-b from-[#7cc6ff] via-[#bfe3ff] to-[#ffe2b0] p-6 text-center">
          <Floaters reduce={reduce} />
          <motion.div
            className="relative h-40 w-40 shrink-0"
            animate={reduce ? undefined : { y: [0, -10, 0], rotate: [0, -3, 3, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            aria-hidden="true"
          >
            <div className="grid h-full w-full place-items-end justify-center overflow-hidden rounded-full bg-white/70 shadow-[0_20px_60px_rgba(255,170,80,.45)] ring-8 ring-white/70">
              <MascotCutout pose="wave" width={128} glow={false} className="translate-y-3" />
            </div>
            <span className="absolute -bottom-1 -right-2 text-5xl">🦕</span>
            <span className="absolute -left-3 bottom-2 text-4xl">🦴</span>
          </motion.div>
          <h1 className="relative font-display text-4xl font-bold text-[#5a3216] drop-shadow-sm sm:text-6xl">{tr(T.title, locale)}</h1>
          <p className="relative max-w-lg text-lg font-semibold text-[#6b4a2a]">{tr(T.teaser, locale)}</p>
          <p className="relative max-w-md text-sm font-semibold text-[#7a5a3a]">{tr(T.how, locale)}</p>
          {supported ? (
            <button
              type="button"
              data-tv-autofocus
              disabled={!hydrated || phase === 'loading'}
              onClick={() => void start()}
              className="relative mt-1 min-h-[64px] rounded-full bg-gradient-to-r from-[#ffb347] to-[#ff7a59] px-10 py-4 text-xl font-bold text-white shadow-[0_10px_40px_rgba(255,122,89,.5)] transition hover:scale-105 disabled:opacity-60"
            >
              {phase === 'loading' ? tr(T.loading, locale) : `🖌️ ${tr(T.play, locale)}`}
            </button>
          ) : (
            <p className="relative rounded-2xl bg-white/90 px-4 py-3 font-semibold">{tr(T.noWebgl, locale)}</p>
          )}
          <Link href="/monde" className="relative text-sm font-semibold text-[#6b4a2a] underline">
            ← {tr(T.back, locale)}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** Words read with the 🔊 button: the question, then its answers (for children who can't read yet). */
function questionWords(q: Question | null, phase: string, locale: string, band: Band): string[] {
  if (!q || (phase !== 'quiz' && phase !== 'digQuestion')) return [];
  if (band !== 'little' && !q.choices.some((c) => c.kind === 'text')) return [];
  return q.choices.map((c) => choiceLabel(c, locale));
}

function DigPanel({ state, band, locale, onBrush }: { state: DinoState; band: Band; locale: string; onBrush: () => void }) {
  return (
    <div className="flex w-full items-center justify-center gap-3 rounded-[1.75rem] bg-white/90 p-2 shadow-[0_8px_30px_rgba(90,60,20,.2)] ring-1 ring-white sm:p-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1" aria-label={`${tr(T.bones, locale)} : ${state.found}`}>
        {band === 'little' ? (
          // Little ones count the bones they see: no total written.
          state.found === 0 ? (
            <span className="text-2xl" aria-hidden="true">
              🦴❔
            </span>
          ) : (
            Array.from({ length: state.found }, (_, i) => (
              <span key={i} className="grid h-10 w-10 place-items-center rounded-full bg-[#fff1dc] text-xl" aria-hidden="true">
                🦴
              </span>
            ))
          )
        ) : (
          Array.from({ length: state.buried }, (_, i) => (
            <span
              key={i}
              className={`grid h-10 w-10 place-items-center rounded-full text-xl ${i < state.found ? 'bg-[#fff1dc]' : 'border-2 border-dashed border-[#e8cfa6]'}`}
              aria-hidden="true"
            >
              {i < state.found ? '🦴' : ''}
            </span>
          ))
        )}
      </div>
      <button
        type="button"
        data-tv-autofocus
        onClick={onBrush}
        className="flex min-h-[72px] min-w-[150px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ffb347] to-[#ff7a59] px-6 py-3 text-xl font-bold text-white shadow-[0_8px_24px_rgba(255,122,89,.45)] transition active:scale-95"
      >
        <span aria-hidden="true">🖌️</span>
        {tr(T.brush, locale)}
      </button>
    </div>
  );
}

function BigButton({ label, emoji, sub, onClick, busy, primary, autoFocus }: { label: string; emoji: string; sub?: string; onClick: () => void; busy?: boolean; primary?: boolean; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-tv-autofocus={autoFocus ? '' : undefined}
      className={`flex min-h-[76px] flex-col items-center justify-center rounded-2xl px-2 py-2 font-bold shadow-sm transition active:scale-95 ${primary ? 'bg-gradient-to-r from-[#7ad37a] to-[#3fbf6a] text-white' : 'bg-[#fff6e6] text-[#6b4a2a] ring-1 ring-[#ffe2b8] hover:bg-[#ffefd6]'} ${busy ? 'opacity-70' : ''}`}
    >
      <span className="text-4xl leading-none" aria-hidden="true">
        {emoji}
      </span>
      <span className="mt-1 text-xs sm:text-sm">{sub ?? label}</span>
    </button>
  );
}

function BoneButton({ piece, dino, thumbs, locale, busy, autoFocus, onClick }: { piece: PieceId; dino: DinoId; thumbs: Thumbs | null; locale: string; busy: boolean; autoFocus: boolean; onClick: () => void }) {
  const src = thumbs?.piece.get(`${dino}-${piece}`);
  const label = choiceLabel({ kind: 'piece', dino, piece, toScale: false }, locale);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-tv-autofocus={autoFocus ? '' : undefined}
      className={`grid min-h-[88px] place-items-center rounded-2xl bg-gradient-to-b from-[#fffaf0] to-[#f6e7cc] p-1 shadow-sm ring-1 ring-[#ecd6ad] transition hover:ring-2 hover:ring-[#ffb347] active:scale-95 ${busy ? 'opacity-70' : ''}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-20 w-20 object-contain sm:h-24 sm:w-24" draggable={false} />
      ) : (
        <span className="text-4xl" aria-hidden="true">
          🦴
        </span>
      )}
    </button>
  );
}

function ChoiceFace({ c, band, thumbs }: { c: Choice; band: Band; thumbs: Thumbs | null }) {
  if (c.kind === 'number')
    return (
      <span className="flex flex-col items-center">
        <span className="font-display text-4xl font-bold leading-none sm:text-5xl">{c.n}</span>
        {band === 'little' && c.n <= 10 ? (
          <span className="mt-1 flex max-w-[6rem] flex-wrap justify-center gap-0.5" aria-hidden="true">
            {Array.from({ length: c.n }, (_, i) => (
              <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#e07a1f]" />
            ))}
          </span>
        ) : null}
      </span>
    );
  if (c.kind === 'dino' || c.kind === 'piece') {
    const src = c.kind === 'dino' ? thumbs?.dino.get(c.dino) : (c.toScale ? thumbs?.scaled : thumbs?.piece)?.get(`${c.dino}-${c.piece}`);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-20 w-20 object-contain sm:h-24 sm:w-24" draggable={false} />
    ) : (
      <span className="text-4xl" aria-hidden="true">
        {c.kind === 'dino' ? '🦕' : '🦴'}
      </span>
    );
  }
  if (c.kind === 'emoji')
    return (
      <span className="text-5xl leading-none" aria-hidden="true">
        {c.emoji}
      </span>
    );
  return null;
}

function QuestionPanel({ q, band, locale, thumbs, busy, onAnswer }: { q: Question; band: Band; locale: string; thumbs: Thumbs | null; busy: boolean; onAnswer: (i: number) => void }) {
  const cols = q.choices.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : q.choices.length === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div className="w-full rounded-[1.75rem] bg-white/92 p-2 shadow-[0_8px_30px_rgba(90,60,20,.22)] ring-1 ring-white sm:p-3">
      <div data-tv-row className={`grid gap-2 ${cols}`}>
        {q.choices.map((c, i) => {
          const label = choiceLabel(c, locale);
          const showLabel = c.kind === 'text' || c.kind === 'emoji' || c.kind === 'dino';
          return (
            <button
              key={choiceKey(c)}
              type="button"
              onClick={() => onAnswer(i)}
              aria-label={label}
              data-tv-autofocus={i === 0 ? '' : undefined}
              className={`flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-b from-[#fffaf0] to-[#f6e7cc] px-2 py-2 text-[#5a3a1a] shadow-sm ring-1 ring-[#ecd6ad] transition hover:ring-2 hover:ring-[#ffb347] active:scale-95 ${busy ? 'opacity-70' : ''}`}
            >
              <ChoiceFace c={c} band={band} thumbs={thumbs} />
              {showLabel ? <span className={`font-bold leading-tight ${c.kind === 'text' ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'}`}>{label}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Floaters({ reduce }: { reduce: boolean }) {
  const items = ['🦴', '🦕', '🌴', '☀️', '🦖', '🪨', '🌵', '🥚'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {items.concat(items).map((e, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl opacity-60"
          style={{ left: `${i % 2 ? 78 + ((i * 7) % 18) : 3 + ((i * 11) % 17)}%`, top: `${(i * 37 + 11) % 90}%` }}
          animate={reduce ? undefined : { y: [0, -14, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: (i % 5) * 0.4 }}
        >
          {e}
        </motion.span>
      ))}
    </div>
  );
}
