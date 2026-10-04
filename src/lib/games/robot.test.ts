import { describe, expect, it } from 'vitest';
import { runProgram, shortestPath, robotStars, type Level } from './robot';
import { LEVELS } from '@/components/games/CodingGame';

const level: Level = { start: { x: 0, y: 4 }, goal: { x: 4, y: 4 }, obstacles: [{ x: 2, y: 4 }] };

describe('runProgram', () => {
  it('reaches the star', () => {
    expect(runProgram(level, ['up', 'right', 'right', 'right', 'right', 'down'])).toMatchObject({ outcome: 'goal', steps: 6 });
  });
  it('points at the instruction that bumps', () => {
    expect(runProgram(level, ['right', 'right', 'right'])).toMatchObject({ outcome: 'bump', bugAt: 1 });
    expect(runProgram(level, ['down'])).toMatchObject({ outcome: 'bump', bugAt: 0 });
  });
  it('knows when the program stops short', () => {
    expect(runProgram(level, ['up'])).toMatchObject({ outcome: 'short' });
  });
});

describe('shortestPath', () => {
  it('finds a shortest program around obstacles', () => {
    const p = shortestPath(level)!;
    expect(p).toHaveLength(6);
    expect(runProgram(level, p).outcome).toBe('goal');
  });
  it('proves every level of the game is solvable', () => {
    for (const l of LEVELS) {
      const p = shortestPath(l);
      expect(p).not.toBeNull();
      expect(runProgram(l, p!).outcome).toBe('goal');
    }
  });
  it('returns null when the star is walled in', () => {
    const walled: Level = { start: { x: 0, y: 0 }, goal: { x: 4, y: 4 }, obstacles: [{ x: 3, y: 4 }, { x: 4, y: 3 }] };
    expect(shortestPath(walled)).toBeNull();
  });
});

describe('robotStars', () => {
  it('never gives zero', () => {
    expect([robotStars(0), robotStars(4), robotStars(50)]).toEqual([3, 2, 1]);
  });
});
