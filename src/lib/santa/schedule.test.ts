import { describe, expect, it } from 'vitest';
import {
  CHRISTMAS_EVE_CALL_AT,
  RING_WINDOW_MS,
  dueCall,
  msToParisLocal,
  msUntilNext,
  nextCall,
  parisLocalToMs,
  parseSchedule,
  schedulableKinds,
  toIcs,
  validateSchedule,
  type ScheduledCall,
} from './schedule';

const call = (id: string, at: number, extra: Partial<ScheduledCall> = {}): ScheduledCall => ({ id, childId: 'c1', kind: 'veille', at, createdAt: 0, ...extra });
const NOV = Date.parse('2026-11-20T10:00:00+01:00');

describe('schedule', () => {
  it('Christmas Eve default is 24 Dec 2026 18:30 Paris', () => {
    expect(new Date(CHRISTMAS_EVE_CALL_AT).toISOString()).toBe('2026-12-24T17:30:00.000Z');
  });

  it('free families can only schedule the voice message', () => {
    expect(schedulableKinds(null)).toEqual(['message']);
    expect(schedulableKinds('essentiel')).toContain('veille');
  });

  it('validates time, kind and count', () => {
    const ctx = { now: NOV, tier: 'essentiel' as const, pending: 0 };
    expect(validateSchedule({ kind: 'veille', at: CHRISTMAS_EVE_CALL_AT }, ctx)).toBeNull();
    expect(validateSchedule({ kind: 'veille', at: NOV - 1000 }, ctx)).toBe('past');
    // A datetime-local value for the current minute (or the next one) is accepted.
    expect(validateSchedule({ kind: 'veille', at: NOV }, { ...ctx, now: NOV + 42_000 })).toBeNull();
    expect(validateSchedule({ kind: 'veille', at: NOV + 60_000 }, { ...ctx, now: NOV + 42_000 })).toBeNull();
    expect(validateSchedule({ kind: 'veille', at: NOV - 60_000 }, { ...ctx, now: NOV + 42_000 })).toBe('past');
    expect(validateSchedule({ kind: 'veille', at: Date.parse('2027-03-01T10:00:00Z') }, ctx)).toBe('too-late');
    expect(validateSchedule({ kind: 'veille', at: CHRISTMAS_EVE_CALL_AT }, { ...ctx, tier: null })).toBe('kind');
    expect(validateSchedule({ kind: 'veille', at: CHRISTMAS_EVE_CALL_AT }, { ...ctx, pending: 6 })).toBe('full');
  });

  it('finds the due call and the next one', () => {
    const list = [call('a', NOV - 1000), call('b', NOV + 60_000), call('c', NOV - RING_WINDOW_MS - 1), call('d', NOV - 500, { doneAt: NOV })];
    expect(dueCall(list, NOV)?.id).toBe('a');
    expect(nextCall(list, NOV)?.id).toBe('b');
    expect(msUntilNext(list, NOV)).toBe(60_000);
    expect(dueCall([], NOV)).toBeNull();
  });

  it('converts Paris local time both ways (winter and summer)', () => {
    expect(parisLocalToMs('2026-12-24T18:30')).toBe(CHRISTMAS_EVE_CALL_AT);
    expect(new Date(parisLocalToMs('2026-07-01T12:00')).toISOString()).toBe('2026-07-01T10:00:00.000Z');
    expect(msToParisLocal(CHRISTMAS_EVE_CALL_AT)).toBe('2026-12-24T18:30');
    expect(Number.isNaN(parisLocalToMs('nope'))).toBe(true);
  });

  it('writes a calendar reminder with an alarm', () => {
    const ics = toIcs(call('x1', CHRISTMAS_EVE_CALL_AT), { title: 'Le Père Noël appelle Léa', description: 'Ouvre l’appli', url: 'https://ziggy-ai.fr/pere-noel/appel?ring=x1', now: NOV });
    expect(ics).toContain('DTSTART:20261224T173000Z');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('UID:santa-x1@ziggy-ai.fr');
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('drops malformed stored entries', () => {
    expect(parseSchedule([call('ok', 1), { id: 1 }, null, { ...call('bad', 1), kind: 'nope' }]).map((c) => c.id)).toEqual(['ok']);
    expect(parseSchedule('x')).toEqual([]);
  });
});
