/**
 * ADAPTIVE QUEST ENGINE — the engine decides, the AI only narrates.
 *
 * From the World Memory (recent performance, mastery per skill, current
 * world, completed quests, favourite games) it deterministically picks the
 * next adventure: world, quest, game, difficulty, companion, reward and story
 * progression. Completing a quest updates the memory and reports the Magic
 * Moments to celebrate. Pure functions only: same memory in → same plan out.
 */
import type { CompanionProfile, QuestDefinition, WorldDefinition, CompanionId } from '@/data/types';
import type { ArcadeGameId, Difficulty } from '@/lib/arcade/types';
import type { LearningSkill } from '@/lib/learning/skills';
import { updateSkill, roundStars, accuracy, type RoundStats, type DifficultyChange } from '@/lib/learning/adaptive';
import { totalStars, type WorldMemory } from './memory';
import { DAILY_BONUS_XP, XP_REPLAY_MULT, earnedBadges, isWorldUnlocked, levelFor } from './gamification';

export type PlanReason = 'continue' | 'new_world' | 'practice' | 'confidence' | 'replay';

export interface AdventurePlan {
  worldId: string;
  questId: string;
  gameId: ArcadeGameId;
  skill: LearningSkill;
  difficulty: Difficulty;
  companion: CompanionId;
  reward: { xp: number; stars: number };
  chapter: 1 | 2 | 3;
  isDaily: boolean;
  reason: PlanReason;
}

/** Chapter n opens when every quest of chapter n-1 is done. */
export function unlockedChapter(w: WorldDefinition, m: WorldMemory): 1 | 2 | 3 {
  let ch: 1 | 2 | 3 = 1;
  for (const n of [1, 2] as const) {
    if (w.quests.filter((q) => q.chapter === n).every((q) => m.completedQuests[q.id])) ch = (n + 1) as 2 | 3;
    else break;
  }
  return ch;
}

export function isQuestOpen(w: WorldDefinition, q: QuestDefinition, m: WorldMemory): boolean {
  return isWorldUnlocked(w, m) && q.chapter <= unlockedChapter(w, m);
}

const isComplete = (w: WorldDefinition, m: WorldMemory) => w.quests.every((q) => m.completedQuests[q.id]);

/** Mean accuracy of the last rounds (1 when nothing has been played yet). */
export function recentPerformance(m: WorldMemory, n = 3): number {
  const last = m.recent.slice(-n);
  if (!last.length) return 1;
  return last.reduce((s, r) => s + r.accuracy, 0) / last.length;
}

function preferredGames(m: WorldMemory): ArcadeGameId[] {
  return Object.entries(m.gamesPlayed)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g as ArcadeGameId);
}

export function nextAdventure(m: WorldMemory, worlds: WorldDefinition[], today: string, onlyWorld?: string): AdventurePlan | null {
  const unlocked = worlds.filter((w) => isWorldUnlocked(w, m));
  if (!unlocked.length) return null;

  let world: WorldDefinition | undefined;
  let reason: PlanReason = 'continue';
  if (onlyWorld) {
    world = unlocked.find((w) => w.id === onlyWorld);
    if (!world) return null;
    if (isComplete(world, m)) reason = 'replay';
  } else {
    const current = unlocked.find((w) => w.id === m.currentWorld);
    if (current && !isComplete(current, m)) world = current;
    else {
      world = unlocked.find((w) => !isComplete(w, m));
      if (world) reason = 'new_world';
    }
    if (!world) {
      // Everything open is done: replay where there are stars left to earn.
      reason = 'replay';
      world = [...unlocked].sort((a, b) => worldStarsLeft(b, m) - worldStarsLeft(a, m))[0];
    }
  }

  const open = world.quests.filter((q) => isQuestOpen(world!, q, m));
  let candidates = open.filter((q) => !m.completedQuests[q.id]);
  if (!candidates.length) {
    reason = 'replay';
    candidates = open.filter((q) => (m.completedQuests[q.id]?.stars ?? 0) < 3);
    if (!candidates.length) candidates = open;
  }

  // Struggling lately → a quest on a skill the child is confident with.
  // Otherwise → practise the least mastered skill. Ties → favourite games, then story order.
  const confidence = recentPerformance(m) < 0.55;
  const mastery = (q: QuestDefinition) => m.skills[q.skill]?.masteryEstimate ?? 0.3;
  const prefs = preferredGames(m);
  const prefRank = (q: QuestDefinition) => {
    const i = prefs.indexOf(q.gameId);
    return i === -1 ? prefs.length : i;
  };
  const order = (q: QuestDefinition) => world!.quests.indexOf(q);
  const quest = [...candidates].sort((a, b) => {
    if (candidates.length > 1 && reason !== 'replay') {
      const d = confidence ? mastery(b) - mastery(a) : mastery(a) - mastery(b);
      if (Math.abs(d) > 0.05) return d;
    }
    return prefRank(a) - prefRank(b) || order(a) - order(b);
  })[0];

  if (reason === 'continue' && confidence && candidates.length > 1) reason = 'confidence';
  else if (reason === 'continue' && candidates.length > 1 && mastery(quest) < 0.5) reason = 'practice';

  const base = m.skills[quest.skill]?.difficulty ?? 1;
  const difficulty = (confidence ? Math.max(1, base - 1) : base) as Difficulty;

  return {
    worldId: world.id,
    questId: quest.id,
    gameId: quest.gameId,
    skill: quest.skill,
    difficulty,
    companion: m.companion,
    reward: quest.reward,
    chapter: quest.chapter,
    isDaily: m.dailyDone !== today,
    reason,
  };
}

function worldStarsLeft(w: WorldDefinition, m: WorldMemory): number {
  return w.quests.reduce((s, q) => s + 3 - (m.completedQuests[q.id]?.stars ?? 0), 0);
}

/* ── Results → memory + Magic Moments ── */

export type MagicKind =
  | 'FIRST_QUEST'
  | 'FIRST_PERFECT'
  | 'NEW_ITEM'
  | 'CHAPTER_COMPLETE'
  | 'WORLD_COMPLETE'
  | 'NEW_WORLD'
  | 'NEW_COMPANION'
  | 'LEVEL_UP'
  | 'NEW_BADGE'
  | 'GREAT_STREAK'
  | 'DAILY_DONE';

export interface MagicMoment {
  kind: MagicKind;
  /** World, companion, badge, chapter or level concerned. */
  ref?: string;
}

export interface RoundInput {
  gameId: ArcadeGameId;
  skill: LearningSkill;
  stats: RoundStats;
  durationMs: number;
  worldId?: string;
  questId?: string;
}

export interface RoundOutcome {
  memory: WorldMemory;
  stars: 1 | 2 | 3;
  xpGained: number;
  difficultyChange: DifficultyChange;
  magic: MagicMoment[];
}

const once = (m: WorldMemory, key: string) => !m.magicSeen.includes(key);

export function unlockedCompanions(m: WorldMemory, companions: CompanionProfile[]): CompanionId[] {
  const stars = totalStars(m);
  return companions.filter((c) => c.unlockStars <= stars).map((c) => c.id);
}

/** Apply a finished game (free play or quest) to the memory. Never removes anything. */
export function applyRound(
  before: WorldMemory,
  input: RoundInput,
  worlds: WorldDefinition[],
  companions: CompanionProfile[],
  today: string,
  now = new Date()
): RoundOutcome {
  const at = now.toISOString();
  const stats = input.stats;
  const stars = roundStars(stats);
  const skillUpdate = updateSkill(before.skills[input.skill], stats, now);
  const m: WorldMemory = {
    ...before,
    skills: { ...before.skills, [input.skill]: skillUpdate.state },
    recent: [...before.recent, { gameId: input.gameId, skill: input.skill, accuracy: Math.round(accuracy(stats) * 100) / 100, at }].slice(-20),
    gamesPlayed: { ...before.gamesPlayed, [input.gameId]: (before.gamesPlayed[input.gameId] ?? 0) + 1 },
    completedQuests: { ...before.completedQuests },
    collection: [...before.collection],
    playMs: before.playMs + Math.max(0, Math.min(input.durationMs, 60 * 60 * 1000)),
    updatedAt: at,
  };
  // Effort XP: every round counts, right answers count a bit more.
  let xp = 5 + Math.min(stats.correct, 15) * 2;
  const magic: MagicMoment[] = [];

  const world = input.worldId ? worlds.find((w) => w.id === input.worldId) : undefined;
  const quest = world && input.questId ? world.quests.find((q) => q.id === input.questId) : undefined;
  // A quest only counts if it is really open — the server re-checks the same rule.
  if (world && quest && isQuestOpen(world, quest, before) && quest.gameId === input.gameId) {
    const prev = before.completedQuests[quest.id];
    m.completedQuests[quest.id] = { stars: Math.max(prev?.stars ?? 0, stars), plays: (prev?.plays ?? 0) + 1, at };
    m.currentWorld = world.id;
    xp += Math.round(quest.reward.xp * (prev ? XP_REPLAY_MULT : 1));
    if (!prev && !m.collection.includes(quest.outcome.id)) {
      m.collection.push(quest.outcome.id);
      magic.push({ kind: 'NEW_ITEM', ref: quest.id });
    }
    if (!prev && Object.keys(before.completedQuests).length === 0 && once(m, 'first_quest')) magic.push({ kind: 'FIRST_QUEST' });
    if (stars === 3 && once(m, 'first_perfect')) magic.push({ kind: 'FIRST_PERFECT' });
    const chapterDone = world.quests.filter((q) => q.chapter === quest.chapter).every((q) => m.completedQuests[q.id]);
    if (chapterDone && once(m, `chapter:${world.id}:${quest.chapter}`)) magic.push({ kind: 'CHAPTER_COMPLETE', ref: `${world.id}:${quest.chapter}` });
    if (isComplete(world, m) && once(m, `world_complete:${world.id}`)) magic.push({ kind: 'WORLD_COMPLETE', ref: world.id });
    if (before.dailyDone !== today) {
      m.dailyDone = today;
      xp += DAILY_BONUS_XP;
      magic.push({ kind: 'DAILY_DONE' });
    }
  }

  m.xp = before.xp + xp;

  for (const w of worlds) if (!isWorldUnlocked(w, before) && isWorldUnlocked(w, m) && once(m, `new_world:${w.id}`)) magic.push({ kind: 'NEW_WORLD', ref: w.id });
  const had = new Set(unlockedCompanions(before, companions));
  for (const c of unlockedCompanions(m, companions)) if (!had.has(c) && once(m, `new_companion:${c}`)) magic.push({ kind: 'NEW_COMPANION', ref: c });

  const lvBefore = levelFor(before.xp).level;
  const lvAfter = levelFor(m.xp).level;
  if (lvAfter > lvBefore && once(m, `level:${lvAfter}`)) magic.push({ kind: 'LEVEL_UP', ref: String(lvAfter) });

  const badges = earnedBadges(m, worlds).filter((b) => !before.badges.includes(b));
  m.badges = [...before.badges, ...badges];
  for (const b of badges) magic.push({ kind: 'NEW_BADGE', ref: b });

  if (skillUpdate.great && skillUpdate.state.streak === 3) magic.push({ kind: 'GREAT_STREAK', ref: input.skill });

  const oneTime = magic.filter((x) => x.kind !== 'NEW_ITEM' && x.kind !== 'DAILY_DONE' && x.kind !== 'GREAT_STREAK' && x.kind !== 'NEW_BADGE');
  m.magicSeen = [...before.magicSeen, ...oneTime.map(magicKey)].slice(-400);

  return { memory: m, stars, xpGained: xp, difficultyChange: skillUpdate.change, magic };
}

export function magicKey(x: MagicMoment): string {
  switch (x.kind) {
    case 'FIRST_QUEST':
      return 'first_quest';
    case 'FIRST_PERFECT':
      return 'first_perfect';
    case 'CHAPTER_COMPLETE':
      return `chapter:${x.ref}`;
    case 'WORLD_COMPLETE':
      return `world_complete:${x.ref}`;
    case 'NEW_WORLD':
      return `new_world:${x.ref}`;
    case 'NEW_COMPANION':
      return `new_companion:${x.ref}`;
    case 'LEVEL_UP':
      return `level:${x.ref}`;
    default:
      return `${x.kind.toLowerCase()}:${x.ref ?? ''}`;
  }
}
