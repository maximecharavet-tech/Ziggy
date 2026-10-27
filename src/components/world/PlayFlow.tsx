'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { WORLDS } from '@/data/worlds';
import { COMPANIONS } from '@/data/companions';
import { getGame } from '@/lib/arcade/registry';
import { generateContent } from '@/lib/arcade/generate';
import type { ArcadeGameId, Difficulty, GameContent } from '@/lib/arcade/types';
import type { LearningSkill } from '@/lib/learning/skills';
import { SKILL_NAMES } from '@/lib/learning/skills';
import type { QuestContent } from '@/lib/hyper-engine/schemas';
import { companionLine, companionStep, INITIAL_COMPANION, reactionFor, type CompanionEvent, type CompanionState } from '@/lib/world/companion';
import { nextAdventure, type RoundOutcome } from '@/lib/world/engine';
import { dayKey } from '@/lib/world/gamification';
import { api, getMemory, setMemory, syncWorld, useHydrated, useWorldMemory } from '@/lib/world/store';
import { finishRound } from '@/lib/world/play';
import { tr } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { MechanicPlayer } from '@/components/arcade/MechanicPlayer';
import { ReadAloudProvider, SayButton } from '@/components/arcade/read-aloud';
import { aiAgeGroup, maxDifficulty, readAloudOn } from '@/lib/world/memory';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { Confetti } from '@/components/ui/Confetti';
import { GameScene } from '@/components/arcade/stage/GameScene';
import { GAME_MOTIFS, NIGHT_GAMES, scenePalette } from '@/components/arcade/stage/themes';
import { ToyButton } from '@/components/arcade/stage/Toy';
import { ZiggyHost, type ZiggyReaction } from '@/components/arcade/stage/ZiggyHost';
import { StageThemeProvider } from '@/components/arcade/stage/StageTheme';
import { CountUp, GameToken, SpeechBubble, StarTray, Sunburst, Title3D } from '@/components/arcade/stage/Showpieces';
import { darken, lighten, rgba, strong } from '@/components/arcade/stage/color';
import { CompanionBuddy } from './CompanionBuddy';
import { MagicMoments, MomentChips } from './MagicMoments';
import { wt } from './text';

type Stage = 'intro' | 'loading' | 'playing' | 'saving' | 'result';

interface Session {
  key: number;
  content: GameContent;
  source: 'ai' | 'local';
  story: string | null;
  difficulty: Difficulty;
  startedAt: number;
}

const NIGHT_WORLDS = new Set(['space', 'stars']);
const HELLO: ZiggyReaction = { kind: 'wave', id: 0 };

/** Small white "toy" pill for the top bar (back, read-aloud…). */
const PILL =
  'inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-text-body shadow-[0_4px_0_rgba(40,30,80,0.12),0_12px_22px_-14px_rgba(40,30,80,0.45)] transition-transform active:translate-y-[3px] dark:bg-bg-card/90';

/**
 * Plays one adventure: a quest of a world (story intro → game → rewards and
 * story progression), or a free arcade game. Wrong answers are never a loss:
 * the companion encourages, the round goes on, every finish earns stars.
 */
export function PlayFlow({ worldId, questId, gameId: freeGameId }: { worldId?: string; questId?: string; gameId?: ArcadeGameId }) {
  const locale = useLocale();
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const world = worldId ? WORLDS.find((w) => w.id === worldId) : undefined;
  const quest = world && questId ? world.quests.find((q) => q.id === questId) : undefined;
  const gameId: ArcadeGameId = quest?.gameId ?? freeGameId ?? 'math_runner';
  const game = getGame(gameId);
  const skill: LearningSkill = quest?.skill ?? game.skills[0];
  const companion = COMPANIONS.find((c) => c.id === memory.companion) ?? COMPANIONS[0];
  const color = world?.colors.accent ?? game.color;
  const reads = hydrated && readAloudOn(memory);
  const little = hydrated && memory.age === 'little';

  const palette = useMemo(
    () =>
      world
        ? scenePalette(world.colors.accent, { from: world.colors.from, to: world.colors.to, night: NIGHT_WORLDS.has(world.id) })
        : scenePalette(game.color, { night: NIGHT_GAMES.has(gameId) }),
    [world, game.color, gameId],
  );
  const motifs = world ? world.background : GAME_MOTIFS[gameId];

  const [stage, setStage] = useState<Stage>('intro');
  const [narration, setNarration] = useState<QuestContent | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [buddy, setBuddy] = useState<CompanionState>(INITIAL_COMPANION);
  const [line, setLine] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [ziggy, setZiggy] = useState<ZiggyReaction | null>(null);
  const seq = useRef(0);
  const cueSeq = useRef(0);
  const nudge = useCallback((kind: ZiggyReaction['kind']) => {
    cueSeq.current += 1;
    setZiggy({ kind, id: cueSeq.current });
  }, []);

  // Quest narration (AI-enriched for signed-in families, hand-written otherwise).
  useEffect(() => {
    if (!world || !quest) return;
    let alive = true;
    void api<{ quest: QuestContent }>('quest/generate', { body: { worldId: world.id, questId: quest.id, companion: getMemory().companion, ageGroup: aiAgeGroup(getMemory()), locale } }).then((res) => {
      if (alive && res.ok) setNarration(res.data.quest);
    });
    return () => {
      alive = false;
    };
  }, [world, quest, locale]);

  const react = useCallback(
    (e: CompanionEvent) => {
      setBuddy((s) => companionStep(s, e));
      const r = reactionFor(e);
      seq.current += 1;
      setLine(r ? companionLine(companion, r, seq.current, locale) : null);
    },
    [companion, locale]
  );

  const start = useCallback(async () => {
    unlockAudio();
    stopSpeaking();
    setStage('loading');
    setOutcome(null);
    const m = getMemory();
    const difficulty = Math.min(m.skills[skill]?.difficulty ?? 1, maxDifficulty(m)) as Difficulty;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const res = await api<{ content: GameContent; source: 'ai' | 'local'; story: string | null }>('game/content', { body: { gameId, difficulty, skill, seed, ageGroup: aiAgeGroup(m), locale } });
    const s: Session = res.ok
      ? { key: seed, content: res.data.content, source: res.data.source, story: res.data.story, difficulty, startedAt: Date.now() }
      : { key: seed, content: generateContent(gameId, difficulty, locale, seed), source: 'local', story: null, difficulty, startedAt: Date.now() };
    setSession(s);
    setBuddy(companionStep(INITIAL_COMPANION, 'start'));
    setLine(null);
    setZiggy(null);
    setStage('playing');
  }, [gameId, skill, locale]);

  const onAnswer = useCallback(
    (right: boolean) => {
      react(right ? 'correct' : 'wrong');
      nudge(right ? 'right' : 'oops');
    },
    [react, nudge]
  );

  const onFinish = useCallback(
    async (stats: { correct: number; mistakes: number; total: number }) => {
      if (!session) return;
      setStage('saving');
      const out = await finishRound({ gameId, skill, worldId: quest ? world?.id : undefined, questId: quest?.id, stats, durationMs: Date.now() - session.startedAt });
      setOutcome(out);
      react(out.magic.some((m) => m.kind === 'LEVEL_UP') ? 'levelUp' : 'questComplete');
      playSound(out.stars === 3 ? 'win' : 'reward');
      nudge('cheer');
      setStage('result');
    },
    [session, gameId, skill, quest, world, react, nudge]
  );

  // Calm the companion down a moment after each reaction.
  useEffect(() => {
    if (buddy.mood === 'IDLE' || stage !== 'playing') return;
    const t = setTimeout(() => setBuddy((s) => companionStep(s, 'rest')), 2200);
    return () => clearTimeout(t);
  }, [buddy, stage]);

  const next = hydrated && stage === 'result' ? nextAdventure(memory, WORLDS, dayKey()) : null;
  const title = quest ? (narration?.title ?? tr(quest.title, locale)) : tr(game.name, locale);
  const intro = quest ? (narration?.intro ?? tr(quest.intro, locale)) : tr(game.description, locale);
  const introLines = [title, intro, narration?.companionLine];
  const resultLines = outcome
    ? [
        quest ? wt('result', locale) : wt('resultPractice', locale),
        `${outcome.stars} ${wt('stars', locale)}`,
        quest ? tr(quest.outcome.label, locale) : null,
      ]
    : [];

  // Ziggy tells the quest before it starts, and tells the result at the end.
  useEffect(() => {
    if (!reads || stage !== 'intro') return;
    void speakSequence('quest-intro', [tr(quest?.title ?? game.name, locale), tr(quest?.intro ?? game.description, locale)], locale);
    // Only once per quest, not again when the AI narration arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reads, quest?.id, gameId]);
  useEffect(() => {
    if (reads && stage === 'result' && outcome) void speakSequence('quest-result', resultLines.filter((x): x is string => Boolean(x)), locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, outcome]);
  useEffect(() => () => stopSpeaking(), []);

  const toggleRead = () => {
    const m = getMemory();
    setMemory({ ...m, readAloud: !readAloudOn(m), updatedAt: new Date().toISOString() });
    if (readAloudOn(m)) stopSpeaking();
    void syncWorld();
  };

  const ink = palette.night ? '#FFFFFF' : darken(strong(color), 0.35);
  const companionLineNow = narration?.companionLine ?? (stage === 'loading' ? wt('loading', locale) : null);

  return (
    <div className="relative min-h-screen overflow-clip px-4 pb-24 pt-24 sm:px-6" style={{ backgroundColor: palette.groundDeep }}>
      <GameScene palette={palette} motifs={motifs} horizon="60vh" startOnly={stage === 'playing' || stage === 'saving'} />
      <div className="relative mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={world ? `/monde/${world.id}` : '/monde/arcade'} className={PILL}>
            <span aria-hidden="true" className="rtl:rotate-180">
              ←
            </span>{' '}
            {world ? tr(world.name, locale) : wt('arcade', locale)}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {session && stage === 'playing' ? (
              <span className="hidden rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-text-muted shadow-sm sm:inline-block dark:bg-bg-card/80">
                {wt('difficulty', locale)} {session.difficulty}/5 · {session.source === 'ai' ? '✨ ' + wt('aiMade', locale) : wt('localMade', locale)}
              </span>
            ) : null}
            <button type="button" onClick={toggleRead} aria-pressed={reads} className={`${PILL} ${reads ? '!bg-sky !text-white' : ''}`}>
              <span aria-hidden="true">{reads ? '🔊' : '🔈'}</span>
              {locale === 'fr' ? 'Ziggy lit pour moi' : 'Ziggy reads for me'}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {stage === 'intro' || stage === 'loading' ? (
            <motion.section
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ duration: 0.35 }}
              className="mt-4 grid items-center gap-x-10 gap-y-3 [grid-template-areas:'title'_'hero'_'body'] lg:mt-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:[grid-template-areas:'hero_title'_'hero_body']"
            >
              {/* Title */}
              <div className="text-center [grid-area:title] lg:self-end lg:text-start">
                <motion.p
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  className="inline-flex items-center gap-2 rounded-full border-2 bg-white/85 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider shadow-[0_3px_0_rgba(40,30,80,0.08)] sm:text-sm dark:bg-bg-card/85"
                  style={{ color: darken(strong(color), 0.1), borderColor: lighten(color, 0.5) }}
                >
                  {quest ? `${wt('chapter', locale)} ${quest.chapter}` : wt('freePlay', locale)}
                  <span aria-hidden="true">·</span>
                  <span aria-hidden="true">{game.emoji}</span> {tr(game.name, locale)}
                </motion.p>
                <div className="mt-3 flex items-center justify-center gap-3 lg:justify-start">
                  <Title3D text={title} color={color} className="text-4xl sm:text-6xl lg:text-7xl" delay={0.1} />
                  <SayButton texts={introLines} locale={locale} size="lg" />
                </div>
              </div>

              {/* Hero: Ziggy waving on his spot, the game's token floating by */}
              <div className="relative mx-auto h-[250px] w-full max-w-[320px] [grid-area:hero] sm:h-[360px] sm:max-w-[380px] lg:h-[500px] lg:max-w-none">
                <ZiggyHost
                  className="absolute bottom-0 left-1/2 h-full w-[74%] -translate-x-1/2"
                  idle={stage === 'loading' ? 'calm' : 'wave'}
                  reaction={HELLO}
                  pose="wave"
                  color={color}
                  label={locale === 'fr' ? 'Ziggy te dit bonjour' : 'Ziggy says hello'}
                />
                <div className="absolute -top-1 start-0 origin-top-left scale-[0.68] sm:start-2 sm:top-2 sm:scale-90 lg:start-0 lg:top-6 lg:scale-100">
                  <GameToken emoji={quest ? quest.outcome.emoji : game.emoji} color={color} size={108} />
                </div>
                <div className="absolute bottom-2 start-0 sm:bottom-6 lg:start-4">
                  <CompanionBuddy profile={companion} mood={stage === 'loading' ? 'THINKING' : 'HAPPY'} locale={locale} size={56} />
                </div>
              </div>

              {/* Story, chips and the big play button */}
              <div className="flex flex-col items-center gap-4 [grid-area:body] lg:items-start lg:self-start">
                <motion.div className="order-2 w-full max-w-xl lg:order-1" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, type: 'spring', stiffness: 220, damping: 20 }}>
                  <SpeechBubble color={color} tail="auto">
                    <IntroText intro={intro} steps={narration?.steps} line={companionLineNow} companion={companion.emoji} />
                  </SpeechBubble>
                </motion.div>
                <div className="order-3 flex flex-wrap justify-center gap-2 lg:order-2 lg:justify-start">
                  <Chip color={color}>
                    🎯 {wt('skill', locale)} : {tr(SKILL_NAMES[skill], locale)}
                  </Chip>
                  {quest ? <Chip color={color}>⚡ +{quest.reward.xp} XP</Chip> : null}
                  {quest ? (
                    <Chip color={color}>
                      {quest.outcome.emoji} {tr(quest.outcome.label, locale)}
                    </Chip>
                  ) : null}
                </div>
                <motion.div className="order-1 lg:order-3 lg:mt-2" initial={{ opacity: 0, scale: 0.7, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.45, type: 'spring', stiffness: 260, damping: 14 }}>
                  <ToyButton color={color} size="xl" shine halo={stage !== 'loading'} onClick={() => void start()} disabled={stage === 'loading' || !hydrated} faceClassName="!px-8 sm:!px-10">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-white/95 text-xl shadow-[inset_0_-3px_0_rgba(0,0,0,0.08)]" style={{ color: strong(color) }} aria-hidden="true">
                      {stage === 'loading' ? <LoadingDots color={strong(color)} /> : <span className="ms-1">▶</span>}
                    </span>
                    {wt('letsGo', locale)}
                  </ToyButton>
                </motion.div>
              </div>
            </motion.section>
          ) : null}

          {(stage === 'playing' || stage === 'saving') && session ? (
            <motion.section
              key="play"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px] lg:items-start lg:gap-6"
              aria-busy={stage === 'saving'}
            >
              {session.story ? (
                <p className="relative mx-auto max-w-2xl rounded-2xl border-2 border-[#E9D8A6] bg-[#FFF8E6] px-5 py-3 text-center text-sm font-semibold text-[#5B4636] shadow-[0_4px_0_#E9D8A6] lg:col-span-2">
                  📜 {session.story}
                </p>
              ) : null}
              {/* Ziggy coaching: a row above the board on phones, standing beside it on wide screens */}
              <aside className="flex items-end gap-3 lg:sticky lg:top-24 lg:order-2 lg:flex-col-reverse lg:items-center lg:gap-1 lg:pt-6">
                <ZiggyHost className="h-[92px] w-[70px] shrink-0 lg:h-[270px] lg:w-[200px]" reaction={ziggy} pose="stand" color={color} />
                <div className="min-w-0 flex-1 pb-1 lg:flex-none lg:pb-0">
                  <CompanionBuddy profile={companion} mood={buddy.mood} locale={locale} line={line} size={48} side="left" />
                </div>
              </aside>
              {/* The board is laid down in 3D (only the board: Ziggy's box must never be measured mid-transform). */}
              <motion.div
                className="min-w-0 lg:order-1"
                initial={{ opacity: 0, y: 60, rotateX: 28, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 150, damping: 20 }}
                style={{ transformPerspective: 1400, transformOrigin: '50% 100%' }}
              >
                <ReadAloudProvider on={reads} little={little} locale={locale}>
                  <StageThemeProvider palette={palette}>
                    <MechanicPlayer key={session.key} content={session.content} color={color} locale={locale} onFinish={(s) => void onFinish(s)} onAnswer={onAnswer} />
                  </StageThemeProvider>
                </ReadAloudProvider>
              </motion.div>
            </motion.section>
          ) : null}

          {stage === 'result' && outcome ? (
            <motion.section
              key="result"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 22 }}
              className="relative mt-4 grid items-center gap-x-8 gap-y-2 lg:mt-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
              aria-live="polite"
            >
              <Confetti trigger count={28} />
              {/* Ziggy celebrating in a burst of light */}
              <div className="relative mx-auto h-[230px] w-full max-w-[300px] sm:h-[320px] lg:h-[480px] lg:max-w-none">
                <Sunburst color={color} className="left-1/2 top-[42%] w-[170%] -translate-x-1/2 -translate-y-1/2 lg:w-[150%]" />
                <ZiggyHost className="absolute bottom-0 left-1/2 h-full w-[72%] -translate-x-1/2" idle="dance" reaction={ziggy} pose="heart" color={color} label={locale === 'fr' ? 'Ziggy est fier de toi' : 'Ziggy is proud of you'} />
              </div>
              <div className="relative flex flex-col items-center text-center">
                <div className="flex items-center justify-center gap-3">
                  <Title3D text={quest ? wt('result', locale) : wt('resultPractice', locale)} color={color} className="text-3xl sm:text-5xl" />
                  <SayButton texts={resultLines} locale={locale} />
                </div>
                <div className="mt-6" aria-label={`${outcome.stars} ${wt('stars', locale)}`} role="img">
                  <StarTray stars={outcome.stars} color={color} size={78} delay={0.45} />
                </div>
                <motion.p
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.6, type: 'spring', stiffness: 300, damping: 14 }}
                  className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2 font-display text-2xl font-bold text-white shadow-[0_5px_0_#15803D,0_16px_26px_-12px_rgba(21,128,61,0.6)]"
                  style={{ background: 'linear-gradient(180deg, #4ADE80, #16A34A)', textShadow: '0 2px 0 rgba(21,128,61,0.6)' }}
                >
                  ⚡ +<CountUp value={outcome.xpGained} delay={1.7} /> XP
                </motion.p>
                {quest ? (
                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2 }}
                    className="mt-4 inline-flex items-center gap-3 rounded-2xl border-[3px] bg-bg-card px-4 py-2 text-lg font-bold text-text-body shadow-[0_4px_0_rgba(40,30,80,0.08)]"
                    style={{ borderColor: lighten(color, 0.5) }}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl text-2xl" style={{ background: lighten(color, 0.8) }} aria-hidden="true">
                      {quest.outcome.emoji}
                    </span>
                    {tr(quest.outcome.label, locale)}
                  </motion.p>
                ) : null}
                {outcome.difficultyChange !== 'same' ? (
                  <p className="mt-3 rounded-full bg-white/80 px-4 py-1.5 text-sm font-bold dark:bg-bg-card/80" style={{ color: ink }}>
                    {outcome.difficultyChange === 'up' ? '🚀 ' : '🌱 '}
                    {wt(outcome.difficultyChange === 'up' ? 'levelUp' : 'levelDown', locale)}
                  </p>
                ) : null}
                <div className="mt-4">
                  <MomentChips moments={outcome.magic} locale={locale} />
                </div>
                <div className="mt-4">
                  <CompanionBuddy profile={companion} mood={buddy.mood} locale={locale} line={line} size={52} side="left" />
                </div>
                <motion.div className="mt-6 flex flex-wrap items-end justify-center gap-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
                  <ToyButton color={color} variant="white" onClick={() => void start()}>
                    ↻ {wt('again', locale)}
                  </ToyButton>
                  {world ? (
                    <Link
                      href={`/monde/${world.id}`}
                      className="inline-flex min-h-[56px] items-center rounded-[1.25rem] bg-white/90 px-6 font-extrabold text-text-body shadow-[0_6px_0_#D5D9E3,0_16px_24px_-14px_rgba(40,30,80,0.45)] transition-transform active:translate-y-[5px] active:shadow-[0_1px_0_#D5D9E3] dark:bg-bg-card"
                    >
                      {wt('toWorld', locale)}
                    </Link>
                  ) : null}
                  {next ? (
                    <Link
                      href={{ pathname: '/monde/jouer', query: { world: next.worldId, quest: next.questId } }}
                      onClick={() => setStage('intro')}
                      className="relative inline-flex min-h-[56px] items-center gap-2 overflow-hidden rounded-[1.25rem] px-6 font-extrabold text-white transition-transform active:translate-y-[5px]"
                      style={{
                        background: `linear-gradient(180deg, ${lighten(strong(color), 0.22)}, ${strong(color)} 55%, ${darken(strong(color), 0.08)})`,
                        boxShadow: `0 6px 0 ${darken(strong(color), 0.34)}, 0 18px 26px -14px ${rgba(darken(color, 0.5), 0.6)}, inset 0 2px 0 rgba(255,255,255,0.45)`,
                        textShadow: `0 2px 0 ${rgba(darken(strong(color), 0.4), 0.45)}`,
                      }}
                    >
                      ▶ {wt('next', locale)}
                    </Link>
                  ) : null}
                </motion.div>
              </div>
              <MagicMoments moments={outcome.magic} locale={locale} />
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function IntroText({ intro, steps, line, companion }: { intro: string; steps?: string[]; line: string | null; companion: string }) {
  return (
    <>
      <p className="text-lg font-semibold leading-snug text-text-body sm:text-xl" dir="auto">
        {intro}
      </p>
      {steps?.length ? (
        <ul className="mt-3 space-y-1.5 text-start text-sm font-semibold text-text-body">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-yellow/30 text-[11px]" aria-hidden="true">
                ✨
              </span>
              <span dir="auto">{s}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {line ? (
        <p className="mt-3 flex items-center gap-2 border-t-2 border-dashed border-border pt-2 text-sm font-bold text-text-muted" role="status">
          <span aria-hidden="true">{companion}</span>
          <span dir="auto">{line}</span>
        </p>
      ) : null}
    </>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 bg-white/85 px-3 py-1 text-sm font-bold shadow-[0_3px_0_rgba(40,30,80,0.07)] dark:bg-bg-card/85" style={{ borderColor: lighten(color, 0.6), color: darken(strong(color), 0.25) }}>
      {children}
    </span>
  );
}

function LoadingDots({ color }: { color: string }) {
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} />
      ))}
    </span>
  );
}
