/**
 * WORLD MEMORY — everything Ziggy World remembers about one child's adventure.
 *
 * One plain JSON document: kept in localStorage for guests and synced to the
 * parent account (table ziggy_world_state) when signed in. It holds progress
 * and choices only — no name, no photo, no free text.
 */
import { z } from 'zod';
import { COMPANION_IDS, type CompanionId } from '@/data/types';
import { LEARNING_SKILLS, type LearningSkill } from '@/lib/learning/skills';
import type { SkillState } from '@/lib/learning/adaptive';

export const MEMORY_VERSION = 1;

export interface QuestRecord {
  stars: number;
  plays: number;
  at: string;
}

export interface RecentRound {
  gameId: string;
  skill: LearningSkill;
  accuracy: number;
  at: string;
}

export interface WorldMemory {
  version: number;
  xp: number;
  /** World the child was last exploring — "Continuer mon aventure". */
  currentWorld: string;
  companion: CompanionId;
  completedQuests: Record<string, QuestRecord>;
  skills: Partial<Record<LearningSkill, SkillState>>;
  recent: RecentRound[];
  /** Places, friends and treasures found in the worlds (quest outcomes). */
  collection: string[];
  badges: string[];
  /** One-time Magic Moments already celebrated. */
  magicSeen: string[];
  /** Day (YYYY-MM-DD) the daily adventure bonus was last earned. */
  dailyDone: string | null;
  gamesPlayed: Record<string, number>;
  playMs: number;
  updatedAt: string;
}

export function emptyMemory(firstWorld = 'princess'): WorldMemory {
  return {
    version: MEMORY_VERSION,
    xp: 0,
    currentWorld: firstWorld,
    companion: 'dragon',
    completedQuests: {},
    skills: {},
    recent: [],
    collection: [],
    badges: [],
    magicSeen: [],
    dailyDone: null,
    gamesPlayed: {},
    playMs: 0,
    updatedAt: new Date(0).toISOString(),
  };
}

const id = z.string().regex(/^[a-z0-9_]{1,40}$/);
const iso = z.string().max(40);
const SkillStateSchema = z.object({
  skillScore: z.number().min(0).max(100),
  masteryEstimate: z.number().min(0).max(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  streak: z.number().int().min(0).max(1000),
  attempts: z.number().int().min(0).max(1e6),
  lastPlayedAt: iso.nullable(),
});

/** Strict schema: the server only stores memory that matches it. */
export const WorldMemorySchema = z.object({
  version: z.number().int().min(1).max(MEMORY_VERSION),
  xp: z.number().int().min(0).max(1e7),
  currentWorld: id,
  companion: z.enum(COMPANION_IDS),
  completedQuests: z.record(id, z.object({ stars: z.number().int().min(0).max(3), plays: z.number().int().min(0).max(1e5), at: iso })).refine((r) => Object.keys(r).length <= 400),
  skills: z.record(z.enum(LEARNING_SKILLS), SkillStateSchema),
  recent: z.array(z.object({ gameId: id, skill: z.enum(LEARNING_SKILLS), accuracy: z.number().min(0).max(1), at: iso })).max(30),
  collection: z.array(id).max(400),
  badges: z.array(id).max(100),
  magicSeen: z.array(z.string().regex(/^[a-z0-9_:]{1,60}$/)).max(400),
  dailyDone: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  gamesPlayed: z.record(id, z.number().int().min(0).max(1e6)).refine((r) => Object.keys(r).length <= 100),
  playMs: z.number().min(0).max(1e11),
  updatedAt: iso,
});

/** Read anything (old version, corrupted storage) into a valid memory. */
export function normalizeMemory(raw: unknown): WorldMemory {
  const parsed = WorldMemorySchema.safeParse(raw);
  if (parsed.success) return parsed.data as WorldMemory;
  return emptyMemory();
}

const later = (a: string, b: string) => (a > b ? a : b);

/**
 * Merge two memories (this device + the account) without ever losing progress:
 * best stars per quest, max XP, union of collections, newest choices.
 */
export function mergeMemory(a: WorldMemory, b: WorldMemory): WorldMemory {
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  const completedQuests: Record<string, QuestRecord> = { ...a.completedQuests };
  for (const [k, v] of Object.entries(b.completedQuests)) {
    const p = completedQuests[k];
    completedQuests[k] = p ? { stars: Math.max(p.stars, v.stars), plays: Math.max(p.plays, v.plays), at: later(p.at, v.at) } : v;
  }
  const skills = { ...a.skills };
  for (const [k, v] of Object.entries(b.skills) as [LearningSkill, SkillState][]) {
    const p = skills[k];
    skills[k] = !p || v.attempts > p.attempts || (v.attempts === p.attempts && (v.lastPlayedAt ?? '') > (p.lastPlayedAt ?? '')) ? v : p;
  }
  const gamesPlayed = { ...a.gamesPlayed };
  for (const [k, v] of Object.entries(b.gamesPlayed)) gamesPlayed[k] = Math.max(gamesPlayed[k] ?? 0, v);
  const union = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  return {
    version: MEMORY_VERSION,
    xp: Math.max(a.xp, b.xp),
    currentWorld: newer.currentWorld,
    companion: newer.companion,
    completedQuests,
    skills,
    recent: [...a.recent, ...b.recent]
      .filter((r, i, all) => all.findIndex((x) => x.at === r.at && x.gameId === r.gameId) === i)
      .sort((x, y) => (x.at < y.at ? -1 : 1))
      .slice(-20),
    collection: union(a.collection, b.collection),
    badges: union(a.badges, b.badges),
    magicSeen: union(a.magicSeen, b.magicSeen),
    dailyDone: a.dailyDone && b.dailyDone ? later(a.dailyDone, b.dailyDone) : (a.dailyDone ?? b.dailyDone),
    gamesPlayed,
    playMs: Math.max(a.playMs, b.playMs),
    updatedAt: later(a.updatedAt, b.updatedAt),
  };
}

/** Total stars = best stars of each quest (replaying never inflates it). */
export function totalStars(m: WorldMemory): number {
  return Object.values(m.completedQuests).reduce((s, q) => s + q.stars, 0);
}
