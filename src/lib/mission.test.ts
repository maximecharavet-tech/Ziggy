import { describe, expect, it } from 'vitest';
import { missionFor, isDone, advanceStreak, currentStreak, previousDay, dayKey } from './mission';

describe('mission of the day', () => {
  it('is stable for a day and changes across days', () => {
    expect(missionFor('2026-10-03')).toEqual(missionFor('2026-10-03'));
    const week = ['01', '02', '03', '04', '05', '06', '07'].map((d) => JSON.stringify(missionFor(`2026-10-${d}`)));
    expect(new Set(week).size).toBeGreaterThan(3);
    const m = missionFor('2026-10-03');
    expect(m.stars).toBeGreaterThanOrEqual(1);
    expect(m.stars).toBeLessThanOrEqual(3);
  });

  it('is done only by a good enough round of the right game, today', () => {
    const m = { gameId: 'math', stars: 2 };
    expect(isDone(m, { day: 'D', results: [{ gameId: 'math', stars: 1 }] }, 'D')).toBe(false);
    expect(isDone(m, { day: 'D', results: [{ gameId: 'logic', stars: 3 }] }, 'D')).toBe(false);
    expect(isDone(m, { day: 'D', results: [{ gameId: 'math', stars: 3 }] }, 'D')).toBe(true);
    expect(isDone(m, { day: 'old', results: [{ gameId: 'math', stars: 3 }] }, 'D')).toBe(false);
  });
});

describe('streak', () => {
  it('counts days in a row, across months', () => {
    expect(previousDay('2026-11-01')).toBe('2026-10-31');
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
    let s = { last: null as string | null, count: 0, best: 0 };
    s = advanceStreak(s, '2026-10-30');
    s = advanceStreak(s, '2026-10-31');
    s = advanceStreak(s, '2026-10-31'); // twice the same day counts once
    s = advanceStreak(s, '2026-11-01');
    expect(s).toEqual({ last: '2026-11-01', count: 3, best: 3 });
    expect(currentStreak(s, '2026-11-02')).toBe(3); // still alive until the day is over
    expect(currentStreak(s, '2026-11-03')).toBe(0);
    expect(advanceStreak(s, '2026-11-05')).toEqual({ last: '2026-11-05', count: 1, best: 3 });
  });

  it('formats local days', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
