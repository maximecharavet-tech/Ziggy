'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Link } from '@/i18n/navigation';
import type { DetectiveGame } from '@/games3d/detective/DetectiveGame';
import {
  CASES_PER_GAME,
  MYSTERY_INFO,
  SPECIES_INFO,
  accusePrompt,
  checkAccuse,
  checkClear,
  clearPrompt,
  clearedLine,
  clueText,
  describe,
  fullName,
  isLastClue,
  leftLine,
  planGame,
  remainingAt,
  shortName,
  toClear,
  whyMatch,
  whyNot,
  type Band,
  type Case,
  type Species,
  type Suspect,
} from '@/games3d/detective/logic';
import { clueDataUrl, type PortraitMap } from '@/games3d/detective/pictos';
import { getMemory, useHydrated, useWorldMemory } from '@/lib/world/store';
import { maxDifficulty, readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { MagicMoment, RoundOutcome } from '@/lib/world/engine';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { MascotCutout, ZiggyAvatar } from '@/components/ziggy/Mascot';
import { MagicMoments, MomentChips } from '@/components/world/MagicMoments';

const T = {
  title: { fr: 'Ziggy Détective', en: 'Detective Ziggy' },
  teaser: {
    fr: 'Un petit mystère au village ! Trouve les indices avec Ziggy et découvre qui a fait le coup.',
    en: 'A little mystery in the village! Find the clues with Ziggy and discover who did it.',
  },
  how: {
    fr: 'Ziggy trouve un indice, puis tu touches les amis qui ne vont pas avec l’indice. Au dernier indice, montre le coupable !',
    en: 'Ziggy finds a clue, then you tap the friends who don’t match it. At the last clue, point at the culprit!',
  },
  play: { fr: 'Mener l’enquête', en: 'Start the case' },
  loading: { fr: 'Ziggy cherche sa loupe…', en: 'Ziggy is looking for his magnifier…' },
  back: { fr: 'Retour', en: 'Back' },
  music: { fr: 'Musique', en: 'Music' },
  noWebgl: { fr: 'Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.', en: 'This 3D game needs WebGL, which this device does not support.' },
  case: { fr: 'Enquête', en: 'Case' },
  find: { fr: 'Chercher un indice', en: 'Look for a clue' },
  next: { fr: 'Indice suivant', en: 'Next clue' },
  searching: { fr: 'Ziggy cherche un indice…', en: 'Ziggy is looking for a clue…' },
  found: { fr: 'Un indice !', en: 'A clue!' },
  toSuspects: { fr: 'Voir les suspects', en: 'See the suspects' },
  clue: { fr: 'Indice', en: 'Clue' },
  nextCase: { fr: 'Enquête suivante', en: 'Next case' },
  notebook: { fr: 'Mon carnet de détective', en: 'My detective notebook' },
  notebookTitle: { fr: 'Carnet du détective', en: 'Detective’s notebook' },
  solved: { fr: 'Résolue !', en: 'Solved!' },
  culprit: { fr: 'Le coupable', en: 'The culprit' },
  again: { fr: 'Nouvelles enquêtes', en: 'New cases' },
  bravo: { fr: 'Bravo, détective ! Tu as résolu les trois enquêtes !', en: 'Well done, detective! You solved all three cases!' },
  reread: { fr: 'Relisons l’indice :', en: 'Let’s read the clue again:' },
  fountain: { fr: 'La fontaine', en: 'The fountain' },
  cleared: { fr: 'pas coupable', en: 'not guilty' },
  intro: { fr: 'Ziggy sort sa loupe. On mène l’enquête ensemble ?', en: 'Ziggy takes out his magnifier. Shall we solve it together?' },
  look: { fr: 'Regarde bien l’indice…', en: 'Look closely at the clue…' },
} satisfies Record<string, L>;

type Stage = 'story' | 'ready' | 'searching' | 'clue' | 'clear' | 'accuse' | 'reveal' | 'party';

interface Solved {
  c: Case;
  outcome: RoundOutcome;
  /** The culprit's picture, as dressed in that case. */
  face?: string;
}

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Total right taps a case needs: every friend to clear, then the culprit. */
function caseTotal(c: Case) {
  let n = 1;
  for (let s = 0; s < c.clues.length - 1; s++) n += toClear(c, s).length;
  return n;
}

export function DetectivePlayer() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const reduce = Boolean(useReducedMotion());
  const canvas = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const game = useRef<DetectiveGame | null>(null);
  const [phase, setPhase] = useState<'intro' | 'loading' | 'play' | 'notebook'>('intro');
  const [supported, setSupported] = useState(true);
  const [cases, setCases] = useState<Case[]>([]);
  const [caseIdx, setCaseIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState<Stage>('story');
  const [cleared, setCleared] = useState<Species[]>([]);
  const [portraits, setPortraits] = useState<PortraitMap>({});
  const [toast, setToast] = useState<{ text: string; id: number; who: Species | 'ziggy' } | null>(null);
  const [music, setMusic] = useState(true);
  const [solved, setSolved] = useState<Solved[]>([]);
  const [xp, setXp] = useState<{ n: number; id: number } | null>(null);
  const [misses, setMisses] = useState(0);
  const [magic, setMagic] = useState<MagicMoment[]>([]);
  const [run, setRun] = useState(0);

  // Live values for the game callbacks.
  const live = useRef({ cases, caseIdx, step, stage, cleared, misses, portraits });
  live.current = { cases, caseIdx, step, stage, cleared, misses, portraits };
  const stats = useRef({ correct: 0, mistakes: 0, started: 0 });
  // Taps are checked against these at once (a quick double tap must not count twice).
  const clearedNow = useRef<Species[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    setSupported(webglOk());
  }, []);

  const band: Band = (memory.age ?? 'middle') as Band;
  const current = cases[caseIdx] ?? null;
  const clue = current?.clues[step] ?? null;
  const shown = current ? current.clues.slice(0, stage === 'story' || stage === 'ready' || stage === 'searching' ? step : step + 1) : [];

  const say = useCallback(
    (lines: string[], id = 'detective') => {
      if (!readAloudOn(getMemory())) return;
      void speakSequence(id, lines.filter(Boolean), locale);
    },
    [locale]
  );
  const showToast = useCallback((text: string, who: Species | 'ziggy' = 'ziggy') => setToast({ text, id: Date.now() + Math.random(), who }), []);

  /* ── The HUD tells the scene what it covers ── */
  useEffect(() => {
    if (phase !== 'play') return;
    const measure = () => {
      const top = topRef.current?.getBoundingClientRect();
      const bottom = bottomRef.current?.getBoundingClientRect();
      const h = window.innerHeight;
      game.current?.setInsets(top ? top.bottom : 0, bottom && bottom.height > 4 ? h - bottom.top : 0);
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
  }, [phase, stage, step, caseIdx]);

  /* ── Story ── */

  const beginCase = useCallback(
    (list: Case[], idx: number) => {
      const c = list[idx];
      if (!c || !game.current) return;
      setCaseIdx(idx);
      setStep(0);
      setStage('story');
      setCleared([]);
      clearedNow.current = [];
      busy.current = false;
      setMisses(0);
      setPortraits({});
      stats.current = { correct: 0, mistakes: 0, started: performance.now() };
      game.current.startCase(c);
      const info = MYSTERY_INFO[c.mystery];
      showToast(tr(info.intro, locale));
      say([tr(info.intro, locale), tr(info.question, locale), tr(T.intro, locale)], 'detective-intro');
    },
    [locale, say, showToast]
  );

  const onTap = useCallback(
    (id: Species) => {
      const { cases: list, caseIdx: ci, step: st, stage: sg, misses: ms } = live.current;
      const c = list[ci];
      const g = game.current;
      if (!c || !g) return;
      const s = c.suspects.find((x) => x.id === id);
      if (!s || busy.current) return;
      unlockAudio();
      if (sg === 'clear') {
        const res = checkClear(c, st, id);
        if (res === 'already' || clearedNow.current.includes(id)) return;
        if (res === 'cleared') {
          stats.current.correct++;
          g.clear(id);
          const nextCleared = [...clearedNow.current, id];
          clearedNow.current = nextCleared;
          setCleared(nextCleared);
          const line = clearedLine(stats.current.correct + ci, locale);
          showToast(line, id);
          const left = toClear(c, st).filter((x) => !nextCleared.includes(x));
          if (!left.length) {
            busy.current = true;
            const remaining = remainingAt(c, st + 1).length;
            const text = leftLine(remaining, locale);
            window.setTimeout(() => {
              busy.current = false;
              if (live.current.caseIdx !== ci || live.current.step !== st) return;
              showToast(text);
              say([text], 'detective-left');
              setStep(st + 1);
              setMisses(0);
              setStage('ready');
            }, 1300);
            say([line], 'detective-clear');
          } else say([line], 'detective-clear');
        } else {
          stats.current.mistakes++;
          setMisses(ms + 1);
          g.objection(id, c.clues[st]);
          const text = whyMatch(s, c.clues[st], locale);
          showToast(text, id);
          say([text, clearPrompt(c.clues[st], locale)], 'detective-hint');
        }
        return;
      }
      if (sg === 'accuse') {
        if (clearedNow.current.includes(id)) return;
        if (checkAccuse(c, id)) {
          busy.current = true;
          stats.current.correct++;
          setStage('reveal');
          g.highlight(null);
          g.confess(id);
          const text = tr(MYSTERY_INFO[c.mystery].confession, locale);
          showToast(text, id);
          say([text], 'detective-confess');
        } else {
          stats.current.mistakes++;
          setMisses(ms + 1);
          g.alibi(id);
          const alibi = tr(SPECIES_INFO[id].alibi, locale);
          showToast(alibi, id);
          const last = c.clues[c.clues.length - 1];
          const lines = [alibi, whyNot(s, last, locale), `${tr(T.reread, locale)} ${clueText(last, locale)}`];
          say(lines, 'detective-alibi');
          window.setTimeout(() => {
            if (live.current.stage === 'accuse' && live.current.caseIdx === ci) showToast(`${whyNot(s, last, locale)} ${tr(T.reread, locale)} ${clueText(last, locale)}`);
          }, 2600);
        }
      }
    },
    [locale, say, showToast]
  );

  const start = async () => {
    unlockAudio();
    setPhase('loading');
    const m = getMemory();
    const seed = Math.floor(Math.random() * 1e6);
    const plan0 = planGame(seed, band, 1);
    const levels = plan0.map((c) => Math.min(m.skills[c.skill]?.difficulty ?? 1, maxDifficulty(m)));
    const list = planGame(seed, band, levels);
    game.current?.dispose();
    game.current = null;
    try {
      const { DetectiveGame } = await import('@/games3d/detective/DetectiveGame');
      game.current = new DetectiveGame(
        canvas.current!,
        { locale },
        {
          onReady: () => {
            if (live.current.stage === 'story') setStage('ready');
          },
          onClueFound: (st) => {
            const c = live.current.cases[live.current.caseIdx];
            if (!c) return;
            setStage('clue');
            const text = clueText(c.clues[st], locale);
            const next = isLastClue(c, st) ? accusePrompt(c, locale) : clearPrompt(c.clues[st], locale);
            say([tr(T.found, locale), text, next], 'detective-clue');
          },
          onParty: () => {
            const { cases: lst, caseIdx: ci } = live.current;
            const c = lst[ci];
            if (!c) return;
            const outcome = finishExtraGame('detective', c.skill, { correct: stats.current.correct, mistakes: stats.current.mistakes, total: caseTotal(c) }, performance.now() - stats.current.started);
            const face = live.current.portraits[c.culprit];
            setSolved((prev) => [...prev.filter((x) => x.c.index !== c.index), { c, outcome, face }]);
            setMagic((prev) => [...prev, ...outcome.magic]);
            setXp({ n: outcome.xpGained, id: Date.now() });
            setStage('party');
            const text = tr(MYSTERY_INFO[c.mystery].party, locale);
            window.setTimeout(() => {
              showToast(text);
              say([text], 'detective-party');
            }, 400);
          },
          onSuspectTap: (id) => onTap(id),
          onPortraits: (p) => setPortraits(p),
        }
      );
    } catch {
      setSupported(false);
      setPhase('intro');
      return;
    }
    game.current.setMusic(music);
    // Lets the end-to-end test drive the scene; never in production.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __detective?: unknown }).__detective = { game: game.current, live, toClear, remainingAt, fullName };
    setCases(list);
    setSolved([]);
    setMagic([]);
    setPhase('play');
    setRun((n) => n + 1);
    beginCase(list, 0);
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
    const t = setTimeout(() => setToast(null), Math.min(9000, 2600 + toast.text.length * 55));
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!xp) return;
    const t = setTimeout(() => setXp(null), 3600);
    return () => clearTimeout(t);
  }, [xp]);

  // After a clue is shown, the friends wait: back to the line-up on its own after a moment.
  useEffect(() => {
    if (stage !== 'clue') return;
    const t = setTimeout(() => toSuspects(), reduce ? 2600 : 3400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, step]);

  /* ── Actions ── */

  const findClue = () => {
    unlockAudio();
    stopSpeaking();
    setToast(null);
    setStage('searching');
    game.current?.showClue(step);
    game.current?.sfx('tap');
  };

  const toSuspects = () => {
    const c = live.current.cases[live.current.caseIdx];
    if (!c || live.current.stage !== 'clue') return;
    game.current?.lineup();
    const last = isLastClue(c, live.current.step);
    setStage(last ? 'accuse' : 'clear');
    setMisses(0);
  };

  const nextCase = () => {
    stopSpeaking();
    setToast(null);
    if (caseIdx + 1 < cases.length) beginCase(cases, caseIdx + 1);
    else {
      setPhase('notebook');
      say([tr(T.bravo, locale)], 'detective-bravo');
    }
  };

  const toggleMusic = () => {
    game.current?.setMusic(!music);
    setMusic(!music);
  };

  /* ── Render ── */

  const info = current ? MYSTERY_INFO[current.mystery] : null;
  const prompt = current && clue ? (stage === 'accuse' ? accusePrompt(current, locale) : clearPrompt(clue, locale)) : '';
  const helpIds = current && stage === 'clear' && misses >= 2 ? toClear(current, step).filter((x) => !cleared.includes(x)) : [];
  const hintCulprit = current && stage === 'accuse' && misses >= 2 ? current.culprit : null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-gradient-to-b from-[#8fd0ff] to-[#ffe9c4] text-[#33264a]">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" aria-label={tr(T.title, locale)} />

      {phase === 'play' && current && info ? (
        <>
          {/* Top: case and clues */}
          <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-2 sm:p-3">
            <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-2 rounded-[1.6rem] bg-white/90 p-1.5 shadow-[0_8px_30px_rgba(60,40,90,.18)] ring-1 ring-white sm:gap-3 sm:p-2">
              <Link href="/monde" aria-label={tr(T.back, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-lg font-bold text-[#5b3f8f] transition hover:bg-[#e8dcff]">
                ←
              </Link>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff1d6] text-2xl" aria-hidden="true">
                {info.emoji}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate font-display text-base font-bold sm:text-lg">{tr(info.title, locale)}</p>
                <p className="flex items-center gap-1 text-xs font-semibold text-[#6b5a86]">
                  <span>
                    🔍 {tr(T.case, locale)} {caseIdx + 1}/{CASES_PER_GAME}
                  </span>
                  <span className="ms-1 flex gap-0.5" aria-label={`${tr(T.clue, locale)} ${Math.min(shown.length, current.clues.length)}/${current.clues.length}`}>
                    {current.clues.map((_, i) => (
                      <span key={i} className={`h-2 w-2 rounded-full ${i < shown.length ? 'bg-[#ff9a3c]' : 'bg-[#e4dcf2]'}`} />
                    ))}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={toggleMusic}
                aria-pressed={music}
                aria-label={tr(T.music, locale)}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition ${music ? 'bg-gradient-to-br from-[#ffd166] to-[#ff9a3c]' : 'bg-[#f3ecff]'}`}
              >
                <span aria-hidden="true">🎵</span>
              </button>
            </div>

            {shown.length ? <ClueStrip c={current} shown={shown.length} big={stage === 'clue' || stage === 'clear' || stage === 'accuse'} locale={locale} reduce={reduce} /> : null}
          </div>

          {/* XP */}
          <AnimatePresence>
            {xp ? (
              <motion.div
                key={xp.id}
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="pointer-events-none absolute right-3 top-24 z-10 rounded-full bg-gradient-to-r from-amber-300 to-pink-300 px-4 py-2 text-base font-bold text-[#4a2350] shadow-lg sm:right-6 sm:top-28 sm:text-lg"
                role="status"
              >
                +{xp.n} XP ⭐
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Bottom */}
          <div ref={bottomRef} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
            <AnimatePresence>
              {toast ? (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.25 }}
                  role="status"
                  className="pointer-events-none relative flex max-w-lg items-center gap-2 rounded-3xl bg-white px-3 py-2 text-left text-sm font-bold shadow-xl ring-2 ring-[#ffd6a8] sm:text-base"
                >
                  {toast.who === 'ziggy' ? <ZiggyAvatar size={34} ring={false} className="shrink-0" /> : <Face id={toast.who} portraits={portraits} size={38} />}
                  <span>{toast.text}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {stage === 'story' || stage === 'searching' ? (
              <div className="flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-bold shadow">
                <span aria-hidden="true">{stage === 'searching' ? '🔍' : info.emoji}</span>
                <span>{stage === 'searching' ? tr(T.searching, locale) : tr(info.question, locale)}</span>
              </div>
            ) : null}

            {stage === 'ready' ? (
              <div className="pointer-events-auto flex flex-col items-center gap-2">
                {step === 0 ? (
                  <div className="flex items-center gap-2 rounded-full bg-white/90 py-1 pe-1 ps-4 text-sm font-bold shadow ring-1 ring-white">
                    <span>
                      {info.emoji} {tr(info.question, locale)}
                    </span>
                    <SayButton texts={[tr(info.intro, locale), tr(info.question, locale)]} locale={locale} size="sm" />
                  </div>
                ) : null}
                <BigButton onClick={findClue} reduce={reduce} autoFocus>
                  🔍 {tr(step === 0 ? T.find : T.next, locale)}
                </BigButton>
              </div>
            ) : null}

            {stage === 'clue' ? (
              <div className="pointer-events-auto">
                <BigButton onClick={toSuspects} reduce={reduce} autoFocus>
                  👀 {tr(T.toSuspects, locale)}
                </BigButton>
              </div>
            ) : null}

            {stage === 'clear' || stage === 'accuse' ? (
              <div className="pointer-events-auto w-full max-w-xl rounded-[1.6rem] bg-white/92 p-2 shadow-[0_8px_30px_rgba(60,40,90,.22)] ring-1 ring-white sm:p-3">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="text-xl" aria-hidden="true">
                    {stage === 'accuse' ? '👉' : '🧹'}
                  </span>
                  <p className="flex-1 text-sm font-bold leading-snug sm:text-base">{prompt}</p>
                  <SayButton texts={[clue ? clueText(clue, locale) : '', prompt]} locale={locale} size="sm" />
                </div>
                <SuspectGrid
                  c={current}
                  cleared={cleared}
                  portraits={portraits}
                  locale={locale}
                  reduce={reduce}
                  help={helpIds}
                  hint={hintCulprit}
                  onTap={onTap}
                  onFocus={(id) => game.current?.highlight(id)}
                />
              </div>
            ) : null}

            {stage === 'party' ? (
              <div className="pointer-events-auto flex flex-col items-center gap-2">
                <BigButton onClick={nextCase} reduce={reduce} autoFocus>
                  {caseIdx + 1 < cases.length ? `🔍 ${tr(T.nextCase, locale)} ➜` : `📒 ${tr(T.notebook, locale)}`}
                </BigButton>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {phase === 'notebook' ? <Notebook solved={solved} locale={locale} reduce={reduce} magic={magic} run={run} onAgain={() => void start()} /> : null}

      {/* Intro */}
      {phase === 'intro' || phase === 'loading' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-gradient-to-b from-[#8fd0ff] via-[#d9efff] to-[#ffe9c4] p-6 text-center">
          <motion.div className="relative h-40 w-40 shrink-0" animate={reduce ? undefined : { y: [0, -10, 0], rotate: [0, -3, 3, 0] }} transition={{ duration: 3, repeat: Infinity }} aria-hidden="true">
            <div className="grid h-full w-full place-items-end justify-center overflow-hidden rounded-full bg-white/70 shadow-[0_20px_60px_rgba(255,170,90,.45)] ring-8 ring-white/70">
              <MascotCutout pose="wave" width={128} glow={false} className="translate-y-3" />
            </div>
            <span className="absolute -bottom-1 -right-2 text-5xl">🔍</span>
          </motion.div>
          <h1 className="font-display text-4xl font-bold text-[#3b2a5a] drop-shadow-sm sm:text-6xl">{tr(T.title, locale)}</h1>
          <p className="max-w-lg text-lg font-semibold text-[#5b4a78]">{tr(T.teaser, locale)}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-3xl" aria-hidden="true">
            {(['cat', 'rabbit', 'fox', 'pig', 'owl', 'duck'] as Species[]).map((s, i) => (
              <motion.span
                key={s}
                className="grid h-14 w-14 place-items-center rounded-2xl bg-white/90 shadow"
                animate={reduce ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15 }}
              >
                {SPECIES_INFO[s].emoji}
              </motion.span>
            ))}
          </div>
          <div className="flex max-w-md items-start gap-2 rounded-2xl bg-white/80 px-3 py-2 text-left text-sm font-semibold text-[#5b4a78]">
            <span className="flex-1">{tr(T.how, locale)}</span>
            <SayButton texts={[tr(T.teaser, locale), tr(T.how, locale)]} locale={locale} size="sm" />
          </div>
          {supported ? (
            <button
              type="button"
              disabled={!hydrated || phase === 'loading'}
              onClick={() => void start()}
              data-tv-autofocus=""
              className="mt-1 min-h-[64px] rounded-full bg-gradient-to-r from-[#ffb86b] to-[#ff7ab8] px-10 py-4 text-xl font-bold text-white shadow-[0_10px_40px_rgba(255,122,184,.5)] transition hover:scale-105 disabled:opacity-60"
            >
              {phase === 'loading' ? tr(T.loading, locale) : `🔍 ${tr(T.play, locale)}`}
            </button>
          ) : (
            <p className="rounded-2xl bg-white/90 px-4 py-3 font-semibold">{tr(T.noWebgl, locale)}</p>
          )}
          <Link href="/monde" className="text-sm font-semibold text-[#5b4a78] underline">
            ← {tr(T.back, locale)}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

function BigButton({ onClick, children, reduce, autoFocus }: { onClick: () => void; children: ReactNode; reduce: boolean; autoFocus?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
      transition={{ duration: 1.6, repeat: Infinity }}
      data-tv-autofocus={autoFocus ? '' : undefined}
      className="min-h-[64px] rounded-full bg-gradient-to-r from-[#ffb86b] to-[#ff7ab8] px-8 py-3 font-display text-xl font-bold text-white shadow-[0_10px_30px_rgba(255,122,184,.45)] ring-4 ring-white/70 sm:text-2xl"
    >
      {children}
    </motion.button>
  );
}

function Face({ id, portraits, size, dim = false }: { id: Species; portraits: PortraitMap; size: number; dim?: boolean }) {
  const src = portraits[id];
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#fff1d6] ring-2 ring-white ${dim ? 'opacity-60' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span style={{ fontSize: size * 0.6 }}>{SPECIES_INFO[id].emoji}</span>
      )}
    </span>
  );
}

function ClueStrip({ c, shown, big, locale, reduce }: { c: Case; shown: number; big: boolean; locale: string; reduce: boolean }) {
  const last = c.clues[shown - 1];
  const text = clueText(last, locale);
  return (
    <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-2">
      {c.clues.slice(0, shown - 1).map((cl, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={clueDataUrl(cl)} alt={clueText(cl, locale)} className="h-11 w-auto shrink-0 rounded-xl bg-white/90 p-0.5 opacity-80 shadow" draggable={false} />
      ))}
      <motion.div
        key={shown}
        initial={reduce ? false : { opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-[1.4rem] bg-[#fffaf0]/95 p-1.5 pe-2 shadow-[0_8px_24px_rgba(60,40,90,.18)] ring-2 ring-[#ffd6a8]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={clueDataUrl(last)} alt="" className={`${big ? 'h-16 sm:h-20' : 'h-12'} w-auto shrink-0 rounded-xl`} draggable={false} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#c27a2c]">
            🔍 {tr(T.clue, locale)} {shown}
          </p>
          <p className="text-sm font-bold leading-snug sm:text-base">{text}</p>
        </div>
        <SayButton texts={[text]} locale={locale} size="sm" />
      </motion.div>
    </div>
  );
}

/** The friends laid out like on the square: back row, the fountain, front row. */
function SuspectGrid({
  c,
  cleared,
  portraits,
  locale,
  reduce,
  help,
  hint,
  onTap,
  onFocus,
}: {
  c: Case;
  cleared: Species[];
  portraits: PortraitMap;
  locale: string;
  reduce: boolean;
  help: Species[];
  hint: Species | null;
  onTap: (id: Species) => void;
  onFocus: (id: Species | null) => void;
}) {
  const at = (row: 'back' | 'front', col: 'left' | 'center' | 'right') => c.suspects.find((s) => s.row === row && s.col === col) ?? null;
  const rows = (['back', 'front'] as const).filter((r) => c.suspects.some((s) => s.row === r));
  const cols = ['left', 'center', 'right'] as const;
  return (
    <div className="flex flex-col gap-1.5" data-tv-stage="">
      {rows.map((row, ri) => (
        <div key={row}>
          {ri === 1 ? (
            <div className="grid grid-cols-3 gap-2 py-0.5" aria-hidden="true">
              <span />
              <span className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#3f7fe0]">⛲ {tr(T.fountain, locale)}</span>
              <span />
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2" data-tv-row="" data-tv-wrap="false">
            {cols.map((col) => {
              const s = at(row, col);
              return s ? (
                <SuspectButton
                  key={col}
                  s={s}
                  done={cleared.includes(s.id)}
                  portraits={portraits}
                  locale={locale}
                  reduce={reduce}
                  help={help.includes(s.id) || hint === s.id}
                  onTap={onTap}
                  onFocus={onFocus}
                />
              ) : (
                <span key={col} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SuspectButton({
  s,
  done,
  portraits,
  locale,
  reduce,
  help,
  onTap,
  onFocus,
}: {
  s: Suspect;
  done: boolean;
  portraits: PortraitMap;
  locale: string;
  reduce: boolean;
  help: boolean;
  onTap: (id: Species) => void;
  onFocus: (id: Species | null) => void;
}) {
  const faceSize = s.size === 'big' ? 62 : 46;
  return (
    <motion.button
      type="button"
      disabled={done}
      onClick={() => onTap(s.id)}
      onFocus={() => onFocus(s.id)}
      onBlur={() => onFocus(null)}
      onMouseEnter={() => onFocus(s.id)}
      onMouseLeave={() => onFocus(null)}
      whileTap={{ scale: 0.92 }}
      animate={help && !reduce ? { y: [0, -4, 0] } : undefined}
      transition={{ duration: 0.9, repeat: help ? Infinity : 0 }}
      aria-label={done ? `${describe(s, locale)} — ${tr(T.cleared, locale)}` : describe(s, locale)}
      className={`relative flex min-h-[72px] flex-col items-center justify-end gap-0.5 rounded-2xl px-1 pb-1 pt-1.5 transition ${
        done ? 'bg-[#eef7e8] opacity-70' : help ? 'bg-[#fff3d6] ring-4 ring-[#ffb347]' : 'bg-[#fff7ec] ring-1 ring-[#ffe0bf] hover:bg-[#ffefd9]'
      }`}
    >
      <span className="grid h-[62px] place-items-end">
        <Face id={s.id} portraits={portraits} size={faceSize} dim={done} />
      </span>
      <span className="max-w-full truncate text-[11px] font-bold leading-tight sm:text-xs">{shortName(s.id, locale)}</span>
      {done ? (
        <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-[#7ed957] text-xs text-white shadow" aria-hidden="true">
          ✓
        </span>
      ) : null}
    </motion.button>
  );
}

function Notebook({
  solved,
  locale,
  reduce,
  magic,
  run,
  onAgain,
}: {
  solved: Solved[];
  locale: string;
  reduce: boolean;
  magic: MagicMoment[];
  run: number;
  onAgain: () => void;
}) {
  const xp = solved.reduce((n, s) => n + s.outcome.xpGained, 0);
  return (
    <div className="absolute inset-0 flex items-start justify-center overflow-y-auto bg-[#3b2a5a]/40 p-3 sm:items-center sm:p-6" data-tv-scope="">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24, rotate: -1.5 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        className="relative my-auto w-full max-w-xl rounded-[1.8rem] bg-[#fffaf0] p-4 pl-9 shadow-2xl ring-1 ring-[#f0d9b5] sm:p-6 sm:pl-12"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 31px, rgba(127,184,230,.25) 31px 32px)' }}
      >
        {/* Spiral binding */}
        <div className="absolute inset-y-6 left-2 flex flex-col justify-between sm:left-3" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="h-3.5 w-5 rounded-full border-[3px] border-[#9aa3ad] bg-[#e8e1d4]" />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <ZiggyAvatar size={52} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold text-[#3b2a5a] sm:text-3xl">📒 {tr(T.notebookTitle, locale)}</h2>
            <p className="text-sm font-semibold text-[#6b5a86]">{tr(T.bravo, locale)}</p>
          </div>
          <SayButton texts={[tr(T.bravo, locale)]} locale={locale} size="sm" />
        </div>
        <ol className="mt-4 flex flex-col gap-3">
          {solved.map(({ c, outcome, face }, i) => {
            const info = MYSTERY_INFO[c.mystery];
            return (
              <motion.li
                key={c.index}
                initial={reduce ? false : { opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : 0.2 + i * 0.18 }}
                className="relative rounded-2xl bg-white/90 p-3 shadow-sm ring-1 ring-[#f0e2c8]"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fff1d6] text-2xl" aria-hidden="true">
                    {info.emoji}
                  </span>
                  <p className="min-w-0 flex-1 font-display text-lg font-bold leading-tight">{tr(info.title, locale)}</p>
                  <span className="rotate-[-8deg] rounded-lg border-2 border-[#3fbf6a] px-2 py-0.5 text-xs font-black uppercase text-[#2f9a52]">{tr(T.solved, locale)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Face id={c.culprit} portraits={face ? { [c.culprit]: face } : {}} size={40} />
                  <p className="text-sm font-bold">
                    {tr(T.culprit, locale)} : {SPECIES_INFO[c.culprit].emoji} {locale === 'fr' ? SPECIES_INFO[c.culprit].name.fr : SPECIES_INFO[c.culprit].name.en}
                  </p>
                  <span className="ms-auto text-lg" aria-label={`${outcome.stars} ⭐`}>
                    {'⭐'.repeat(outcome.stars)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.clues.map((cl, k) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={k} src={clueDataUrl(cl)} alt={clueText(cl, locale)} className="h-10 w-auto rounded-lg" draggable={false} />
                  ))}
                </div>
              </motion.li>
            );
          })}
        </ol>
        <p className="mt-4 text-center font-bold text-[#6b5a86]">
          ⭐ <span className="text-[#c27a2c]">+{xp} XP</span>
        </p>
        <div className="mt-2">
          <MomentChips moments={magic} locale={locale} />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onAgain} data-tv-autofocus="" className="min-h-[64px] rounded-full bg-gradient-to-r from-[#ffb86b] to-[#ff7ab8] px-7 py-3 text-lg font-bold text-white shadow-lg">
            ↻ {tr(T.again, locale)}
          </button>
          <Link href="/monde" className="grid min-h-[64px] place-items-center rounded-full bg-[#f3ecff] px-7 py-3 text-lg font-bold text-[#5b3f8f]">
            ← {tr(T.back, locale)}
          </Link>
        </div>
        <MagicMoments key={run} moments={magic} locale={locale} />
      </motion.div>
    </div>
  );
}
