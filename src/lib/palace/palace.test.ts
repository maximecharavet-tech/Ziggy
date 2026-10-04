import { describe, expect, it } from 'vitest';
import { makeRound, itemsFor, palaceStars, ROOMS, MAX_LEVEL } from './palace';

describe('memory palace', () => {
  it('grows by one thing per level, up to every room', () => {
    expect(itemsFor(1)).toBe(3);
    expect(itemsFor(3)).toBe(5);
    expect(itemsFor(MAX_LEVEL)).toBe(ROOMS.length);
    expect(itemsFor(99)).toBe(ROOMS.length);
  });

  it('builds a walk in house order with different things and fair choices', () => {
    const round = makeRound(4, 42);
    expect(round.map((s) => s.room.id)).toEqual(ROOMS.slice(0, 6).map((r) => r.id));
    expect(new Set(round.map((s) => s.item)).size).toBe(6);
    for (const stop of round) {
      expect(stop.choices).toHaveLength(4);
      expect(new Set(stop.choices).size).toBe(4);
      expect(stop.choices).toContain(stop.item);
    }
  });

  it('is replayable from its seed, and varies between seeds', () => {
    expect(makeRound(2, 7)).toEqual(makeRound(2, 7));
    expect(makeRound(2, 7).map((s) => s.item)).not.toEqual(makeRound(2, 8).map((s) => s.item));
  });

  it('never gives zero stars', () => {
    expect([palaceStars(5, 5), palaceStars(3, 5), palaceStars(0, 5)]).toEqual([3, 2, 1]);
  });
});
