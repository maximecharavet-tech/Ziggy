import { describe, expect, it } from 'vitest';
import { computeSkills, gameScore, strengths, SKILLS } from './skills';

const e = (gameId: string, bestStars: number, plays: number) => ({ gameId, bestScore: 0, bestStars, plays, lastPlayedAt: '' });

describe('skills', () => {
  it('scores a game from stars and practice', () => {
    expect(gameScore(0, 0)).toBe(0);
    expect(gameScore(3, 5)).toBe(100);
    expect(gameScore(3, 50)).toBe(100);
    expect(gameScore(2, 1)).toBe(57);
  });

  it('has six skills covering every game and the lab', () => {
    expect(SKILLS).toHaveLength(6);
    expect(SKILLS.flatMap((s) => s.games)).toEqual(
      expect.arrayContaining(['memory', 'math', 'logic', 'quiz', 'simon', 'coding', 'oddone', 'puzzle', 'lab', 'palace', 'memo'])
    );
  });

  it('averages the games of a skill, untried ones counting zero', () => {
    const s = computeSkills({ memory: e('memory', 3, 5), math: e('math', 3, 5) });
    expect(s.memory).toBe(25); // 1 of 4 memory activities, at 100
    expect(s.math).toBe(100);
    expect(s.spatial).toBe(0);
    expect(strengths(s)).toEqual({ best: 'math', next: 'logic' });
  });
});
