'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

  const [stage, setStage] = useState<Stage>('intro');
  const [narration, setNarration] = useState<QuestContent | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [buddy, setBuddy] = useState<CompanionState>(INITIAL_COMPANION);
  const [line, setLine] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const seq = useRef(0);

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
    setStage('playing');
  }, [gameId, skill, locale]);

  const onAnswer = useCallback((right: boolean) => react(right ? 'correct' : 'wrong'), [react]);

  const onFinish = useCallback(
    async (stats: { correct: number; mistakes: number; total: number }) => {
      if (!session) return;
      setStage('saving');
      const out = await finishRound({ gameId, skill, worldId: quest ? world?.id : undefined, questId: quest?.id, stats, durationMs: Date.now() - session.startedAt });
      setOutcome(out);
      react(out.magic.some((m) => m.kind === 'LEVEL_UP') ? 'levelUp' : 'questComplete');
      playSound(out.stars === 3 ? 'win' : 'reward');
      setStage('result');
    },
    [session, gameId, skill, quest, world, react]
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

  return (
    <div
      className="relative min-h-screen overflow-clip px-4 pb-24 pt-24 sm:px-6"
      style={{ background: world ? `linear-gradient(180deg, ${world.colors.from}, transparent 70%)` : `linear-gradient(180deg, ${game.color}22, transparent 70%)` }}
    >
      <div className="relative mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={world ? `/monde/${world.id}` : '/monde/arcade'} className="rounded-full bg-bg-card/80 px-4 py-2 text-sm font-bold text-text-body shadow-sm hover:bg-bg-card">
            ← {world ? tr(world.name, locale) : wt('arcade', locale)}
          </Link>
          <button
            type="button"
            onClick={toggleRead}
            aria-pressed={reads}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-sm transition ${reads ? 'bg-sky text-white' : 'bg-bg-card/80 text-text-body'}`}
          >
            <span aria-hidden="true">{reads ? '🔊' : '🔈'}</span>
            {locale === 'fr' ? 'Ziggy lit pour moi' : 'Ziggy reads for me'}
          </button>
          {session && stage === 'playing' ? (
            <span className="rounded-full bg-bg-card/80 px-3 py-1.5 text-xs font-bold text-text-muted">
              {wt('difficulty', locale)} {session.difficulty}/5 · {session.source === 'ai' ? '✨ ' + wt('aiMade', locale) : wt('localMade', locale)}
            </span>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {stage === 'intro' || stage === 'loading' ? (
            <motion.section key="intro" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-8 rounded-[2rem] bg-bg-card p-6 text-center shadow-xl sm:p-10">
              <div className="text-7xl" aria-hidden="true">
                {quest ? quest.outcome.emoji : game.emoji}
              </div>
              <p className="mt-3 text-sm font-bold uppercase tracking-wider" style={{ color }}>
                {quest ? `${wt('chapter', locale)} ${quest.chapter} · ` : `${wt('freePlay', locale)} · `}
                {game.emoji} {tr(game.name, locale)}
              </p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <h1 className="font-display text-3xl font-bold text-text-body sm:text-5xl">{title}</h1>
                <SayButton texts={introLines} locale={locale} size="lg" />
              </div>
              <p className="mx-auto mt-3 max-w-xl text-lg text-text-muted">{intro}</p>
              {narration?.steps?.length ? (
                <ul className="mx-auto mt-4 max-w-md space-y-1 text-start text-sm text-text-body">
                  {narration.steps.map((s, i) => (
                    <li key={i}>✨ {s}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 text-sm font-semibold text-text-muted">
                {wt('skill', locale)} : {tr(SKILL_NAMES[skill], locale)}
                {quest ? ` · +${quest.reward.xp} XP` : ''}
              </p>
              <div className="mt-6 flex justify-center">
                <CompanionBuddy profile={companion} mood={stage === 'loading' ? 'THINKING' : 'HAPPY'} locale={locale} line={narration?.companionLine ?? (stage === 'loading' ? wt('loading', locale) : null)} size={72} />
              </div>
              <button
                type="button"
                onClick={() => void start()}
                disabled={stage === 'loading' || !hydrated}
                className="mt-6 rounded-full px-8 py-4 text-xl font-bold text-white shadow-lg transition hover:scale-105 disabled:opacity-60 focus-visible:outline focus-visible:outline-4"
                style={{ backgroundColor: color, outlineColor: `${color}66` }}
              >
                {stage === 'loading' ? '…' : `▶ ${wt('letsGo', locale)}`}
              </button>
            </motion.section>
          ) : null}

          {(stage === 'playing' || stage === 'saving') && session ? (
            <motion.section key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6" aria-busy={stage === 'saving'}>
              {session.story ? <p className="mb-4 rounded-2xl bg-bg-card/80 px-4 py-3 text-center text-sm font-semibold text-text-body">📜 {session.story}</p> : null}
              <ReadAloudProvider on={reads} little={little} locale={locale}>
                <MechanicPlayer key={session.key} content={session.content} color={color} locale={locale} onFinish={(s) => void onFinish(s)} onAnswer={onAnswer} />
              </ReadAloudProvider>
              <div className="mt-4 flex justify-end">
                <CompanionBuddy profile={companion} mood={buddy.mood} locale={locale} line={line} size={60} />
              </div>
            </motion.section>
          ) : null}

          {stage === 'result' && outcome ? (
            <motion.section key="result" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 rounded-[2rem] bg-bg-card p-6 text-center shadow-xl sm:p-10" aria-live="polite">
              <div className="flex items-center justify-center gap-3">
                <h1 className="font-display text-3xl font-bold text-text-body sm:text-4xl">{quest ? wt('result', locale) : wt('resultPractice', locale)}</h1>
                <SayButton texts={resultLines} locale={locale} />
              </div>
              <div className="mt-4 flex justify-center gap-2 text-5xl" aria-label={`${outcome.stars} ${wt('stars', locale)}`}>
                {[1, 2, 3].map((n) => (
                  <motion.span key={n} initial={{ scale: 0, rotate: -40 }} animate={{ scale: n <= outcome.stars ? 1 : 0.7, rotate: 0 }} transition={{ delay: 0.2 * n, type: 'spring' }} className={n <= outcome.stars ? '' : 'opacity-25 grayscale'} aria-hidden="true">
                    ⭐
                  </motion.span>
                ))}
              </div>
              <p className="mt-3 text-xl font-bold text-green">{wt('gotXp', locale, { n: outcome.xpGained })}</p>
              {quest ? (
                <p className="mt-2 text-lg font-semibold text-text-body">
                  {quest.outcome.emoji} {tr(quest.outcome.label, locale)}
                </p>
              ) : null}
              {outcome.difficultyChange !== 'same' ? <p className="mt-2 text-sm text-text-muted">{wt(outcome.difficultyChange === 'up' ? 'levelUp' : 'levelDown', locale)}</p> : null}
              <div className="mt-5">
                <MomentChips moments={outcome.magic} locale={locale} />
              </div>
              <div className="mt-6 flex justify-center">
                <CompanionBuddy profile={companion} mood={buddy.mood} locale={locale} line={line} size={72} />
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => void start()} className="rounded-full border-2 px-6 py-3 font-bold text-text-body" style={{ borderColor: color }}>
                  ↻ {wt('again', locale)}
                </button>
                {world ? (
                  <Link href={`/monde/${world.id}`} className="rounded-full border-2 border-border px-6 py-3 font-bold text-text-body">
                    {wt('toWorld', locale)}
                  </Link>
                ) : null}
                {next ? (
                  <Link
                    href={{ pathname: '/monde/jouer', query: { world: next.worldId, quest: next.questId } }}
                    onClick={() => setStage('intro')}
                    className="rounded-full px-6 py-3 font-bold text-white shadow"
                    style={{ backgroundColor: color }}
                  >
                    ▶ {wt('next', locale)}
                  </Link>
                ) : null}
              </div>
              <MagicMoments moments={outcome.magic} locale={locale} />
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
