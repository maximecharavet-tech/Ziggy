import { describe, expect, it } from 'vitest';
import { adventNeedsPass, canOpenAdventDay, parisCalendarDate } from './advent';

describe('Santa Advent calendar unlocks', () => {
  it('offers only the first preview door before December', () => {
    const november = new Date('2026-11-30T18:00:00Z');
    expect(canOpenAdventDay(1, november)).toBe(true);
    expect(canOpenAdventDay(2, november)).toBe(false);
  });
  it('opens on the Paris calendar date, including its timezone boundary', () => {
    expect(canOpenAdventDay(1, new Date('2026-11-30T23:30:00Z'))).toBe(true); // Dec 1 in Paris
    expect(canOpenAdventDay(2, new Date('2026-12-01T22:59:59Z'))).toBe(false);
    expect(canOpenAdventDay(2, new Date('2026-12-01T23:00:00Z'))).toBe(true);
    expect(parisCalendarDate(new Date('2026-12-01T23:00:00Z'))).toEqual({year:2026,month:12,day:2});
  });
  it('gates only doors 4 through 24 behind the pass', () => {
    expect([1,2,3].map(adventNeedsPass)).toEqual([false,false,false]);
    expect(adventNeedsPass(4)).toBe(true);
    expect(adventNeedsPass(24)).toBe(true);
    expect(adventNeedsPass(25)).toBe(false);
  });
});
