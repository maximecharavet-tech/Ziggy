import { describe, expect, it } from 'vitest';
import { computeRewards, newlyEarned, BADGES } from './rewards';
import { GAMES } from './games';
import type { ProgressMap } from './progress';

const entry = (gameId: string, bestStars: number, plays: number) => ({
  gameId,
  bestScore: 10,
  bestStars,
  plays,
  lastPlayedAt: '2026-10-01T00:00:00Z',
});

describe('computeRewards', () => {
  it('starts a new child at level 1 with nothing earned', () => {
    const r = computeRewards({});
    expect(r).toMatchObject({ xp: 0, level: 1, levelId: 'curious', earnedCount: 0, ratio: 0 });
  });

  it('rewards quality and practice, with plays capped per game', () => {
    expect(computeRewards({ math: entry('math', 3, 1) }).xp).toBe(3 * 40 + 6);
    expect(computeRewards({ math: entry('math', 0, 500) }).xp).toBe(30 * 6);
  });

  it('climbs levels at the thresholds and stops at the top', () => {
    expect(computeRewards({ math: entry('math', 3, 0) }).level).toBe(2); // 120 XP
    const all: ProgressMap = Object.fromEntries(GAMES.map((g) => [g.id, entry(g.id, 3, 30)]));
    const top = computeRewards(all);
    expect(top.level).toBe(6);
    expect(top.next).toBeNull();
    expect(top.ratio).toBe(1);
    expect(top.earnedCount).toBe(BADGES.length);
  });

  it('does not count the one-minute trial as a game for badges', () => {
    const r = computeRewards({ trial: entry('trial', 3, 1) });
    expect(r.badges.first_game).toBe(true);
    expect(r.badges.three_stars).toBe(false);
  });
});

describe('newlyEarned', () => {
  it('reports only what changed', () => {
    const before = computeRewards({ math: entry('math', 1, 1) });
    const after = computeRewards({ math: entry('math', 3, 5) });
    const diff = newlyEarned(before, after);
    expect(diff.badges).toEqual(['three_stars', 'brave']);
    expect(diff.levelUp).toBe(true);
  });
});
