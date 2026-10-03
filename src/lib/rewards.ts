/**
 * Levels, XP and badges, all derived from the child's game progress.
 *
 * Nothing new is stored on the server: the same rounds that make the trophy
 * shelf also make the level and the badges, so a parent sees one consistent
 * story wherever they look. XP rewards both quality (best stars) and practice
 * (plays, capped so grinding one game does not outrun learning several).
 */
import { GAMES } from './games';
import type { ProgressMap } from './progress';

export const LEVELS = ['curious', 'explorer', 'inventor', 'coder', 'genius', 'legend'] as const;
export type LevelId = (typeof LEVELS)[number];

/** XP needed to *reach* each level (index = level - 1). */
const THRESHOLDS = [0, 120, 320, 650, 1100, 1700];

export type BadgeId =
  | 'first_game'
  | 'three_stars'
  | 'explorer'
  | 'star_collector'
  | 'all_games'
  | 'marathon'
  | 'perfectionist'
  | 'brave';

export const BADGES: { id: BadgeId; emoji: string; color: string }[] = [
  { id: 'first_game', emoji: '🚀', color: '#5FB6EA' },
  { id: 'three_stars', emoji: '⭐', color: '#F59E0B' },
  { id: 'explorer', emoji: '🧭', color: '#4FC9C0' },
  { id: 'star_collector', emoji: '🌟', color: '#FBBF24' },
  { id: 'brave', emoji: '💪', color: '#F2647B' },
  { id: 'marathon', emoji: '🏃', color: '#8B5CF6' },
  { id: 'all_games', emoji: '🗺️', color: '#22C55E' },
  { id: 'perfectionist', emoji: '🏆', color: '#E9B949' },
];

export interface Rewards {
  xp: number;
  level: number; // 1-based
  levelId: LevelId;
  /** XP at which the current level started, and the next one starts (null at max). */
  floor: number;
  next: number | null;
  /** 0..1 progress toward the next level. */
  ratio: number;
  badges: Record<BadgeId, boolean>;
  earnedCount: number;
}

export function computeRewards(progress: ProgressMap): Rewards {
  const games = Object.values(progress).filter((p) => p.gameId !== 'trial');
  const all = Object.values(progress);

  const xp = all.reduce((sum, p) => sum + (p.bestStars ?? 0) * 40 + Math.min(p.plays ?? 0, 30) * 6, 0);

  let level = 1;
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  const floor = THRESHOLDS[level - 1];
  const next = level < THRESHOLDS.length ? THRESHOLDS[level] : null;
  const ratio = next === null ? 1 : Math.min(1, (xp - floor) / (next - floor));

  const plays = all.reduce((s, p) => s + (p.plays ?? 0), 0);
  const stars = games.reduce((s, p) => s + (p.bestStars ?? 0), 0);
  const played = new Set(games.map((p) => p.gameId));

  const badges: Record<BadgeId, boolean> = {
    first_game: plays >= 1,
    three_stars: games.some((p) => p.bestStars >= 3),
    explorer: played.size >= 4,
    star_collector: stars >= 15,
    brave: games.some((p) => (p.plays ?? 0) >= 5),
    marathon: plays >= 25,
    all_games: GAMES.every((g) => played.has(g.id)),
    perfectionist: games.length >= 4 && games.every((p) => p.bestStars >= 3),
  };

  return {
    xp,
    level,
    levelId: LEVELS[level - 1],
    floor,
    next,
    ratio,
    badges,
    earnedCount: Object.values(badges).filter(Boolean).length,
  };
}

/** What changed between two snapshots: new badges, and a level-up. */
export function newlyEarned(before: Rewards, after: Rewards): { badges: BadgeId[]; levelUp: boolean } {
  return {
    badges: BADGES.map((b) => b.id).filter((id) => after.badges[id] && !before.badges[id]),
    levelUp: after.level > before.level,
  };
}
