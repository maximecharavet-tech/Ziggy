/**
 * Gamification — calm by design.
 *
 * XP and levels grow forever, stars are the best result of each quest, badges
 * celebrate effort and discovery. There is no public leaderboard, no loss
 * when a day is skipped, no countdown, no loot box. The daily adventure is a
 * small bonus, never a debt.
 */
import type { L } from '@/lib/i18n-text';
import type { WorldDefinition } from '@/data/types';
import type { WorldMemory } from './memory';
import { totalStars } from './memory';

/** XP needed to go from level n to n+1 grows gently: 60, 90, 120, … */
export function levelFor(xp: number): { level: number; into: number; next: number } {
  let level = 1;
  let need = 60;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= need && level < 99) {
    rest -= need;
    level++;
    need = 60 + (level - 1) * 30;
  }
  return { level, into: rest, next: need };
}

export const DAILY_BONUS_XP = 15;
export const XP_FIRST_CLEAR_MULT = 1;
/** Replaying a quest is welcome: it still gives half its XP, plus effort XP. */
export const XP_REPLAY_MULT = 0.5;

export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface WorldBadge {
  id: string;
  emoji: string;
  name: L;
  test: (m: WorldMemory, worlds: WorldDefinition[]) => boolean;
}

const worldDone = (m: WorldMemory, w: WorldDefinition) => w.quests.every((q) => m.completedQuests[q.id]);

export const WORLD_BADGES: WorldBadge[] = [
  { id: 'first_step', emoji: '👣', name: { fr: 'Premier pas', en: 'First step' }, test: (m) => Object.keys(m.completedQuests).length >= 1 },
  { id: 'explorer_5', emoji: '🧭', name: { fr: 'Explorateur', en: 'Explorer' }, test: (m) => Object.keys(m.completedQuests).length >= 5 },
  { id: 'adventurer_20', emoji: '🎒', name: { fr: 'Aventurier', en: 'Adventurer' }, test: (m) => Object.keys(m.completedQuests).length >= 20 },
  { id: 'hero_60', emoji: '🦸', name: { fr: 'Héros des mondes', en: 'Hero of the worlds' }, test: (m) => Object.keys(m.completedQuests).length >= 60 },
  { id: 'world_complete', emoji: '🏰', name: { fr: 'Monde terminé', en: 'World complete' }, test: (m, ws) => ws.some((w) => worldDone(m, w)) },
  { id: 'five_worlds', emoji: '🌍', name: { fr: 'Cinq mondes', en: 'Five worlds' }, test: (m, ws) => ws.filter((w) => worldDone(m, w)).length >= 5 },
  { id: 'star_30', emoji: '⭐', name: { fr: '30 étoiles', en: '30 stars' }, test: (m) => totalStars(m) >= 30 },
  { id: 'star_100', emoji: '🌟', name: { fr: '100 étoiles', en: '100 stars' }, test: (m) => totalStars(m) >= 100 },
  { id: 'collector_10', emoji: '💎', name: { fr: 'Collectionneur', en: 'Collector' }, test: (m) => m.collection.length >= 10 },
  { id: 'curious_5_games', emoji: '🎮', name: { fr: 'Curieux de tout', en: 'Curious about everything' }, test: (m) => Object.keys(m.gamesPlayed).length >= 5 },
  { id: 'all_games', emoji: '🕹️', name: { fr: 'Toute l’arcade', en: 'The whole arcade' }, test: (m) => Object.keys(m.gamesPlayed).length >= 20 },
  { id: 'persistent', emoji: '💪', name: { fr: 'Persévérant', en: 'Keeps trying' }, test: (m) => Object.values(m.completedQuests).some((q) => q.plays >= 3) },
  { id: 'skill_expert', emoji: '🧠', name: { fr: 'Expert', en: 'Expert' }, test: (m) => Object.values(m.skills).some((s) => s && s.attempts >= 3 && s.masteryEstimate >= 0.85) },
];

export function earnedBadges(m: WorldMemory, worlds: WorldDefinition[]): string[] {
  return WORLD_BADGES.filter((b) => b.test(m, worlds)).map((b) => b.id);
}

export function isWorldUnlocked(w: WorldDefinition, m: WorldMemory): boolean {
  return totalStars(m) >= w.unlockStars;
}

export function worldProgress(w: WorldDefinition, m: WorldMemory): { done: number; total: number; stars: number; maxStars: number } {
  const done = w.quests.filter((q) => m.completedQuests[q.id]).length;
  const stars = w.quests.reduce((s, q) => s + (m.completedQuests[q.id]?.stars ?? 0), 0);
  return { done, total: w.quests.length, stars, maxStars: w.quests.length * 3 };
}
