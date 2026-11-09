import { describe, expect, it } from 'vitest';
import { A9_MAIN } from './goals';
import { FORBIDDEN_KEYS, RAW_ROOMS, ROOMS, roomByNumber, roomsForNightPrank, validateRoom, validateRooms } from './rooms';
import { BANDS } from './types';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('rooms 1–15', () => {
  it('all 15 rooms × 3 bands validate (schema, fixable pranks, unique clues, solvable fixes, finale, A9 goals, progression)', () => {
    expect(validateRooms(RAW_ROOMS, { seeds: 24 })).toEqual([]);
  });

  it('the house runs from the entrance hall to the Christmas Eve finale', () => {
    expect(ROOMS.map((r) => r.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(roomByNumber(1)?.id).toBe('chaos.hall');
    expect(roomByNumber(2)?.id).toBe('chaos.kitchen');
    expect(roomByNumber(15)?.id).toBe('chaos.christmas-eve');
  });

  it('every room has its three band variants and the A9 goals of its row', () => {
    for (const r of ROOMS) {
      for (const b of BANDS) expect(r.bands[b], `${r.id} ${b}`).toBeTruthy();
      for (const g of A9_MAIN[r.number]) expect(r.goals, `${r.id} ${g}`).toContain(g);
    }
  });

  it('the schema has no timer / lives / score / fail field, and the validator rejects one', () => {
    const json = JSON.stringify(RAW_ROOMS).toLowerCase();
    for (const k of FORBIDDEN_KEYS) expect(json).not.toContain(`"${k.toLowerCase()}":`);
    const bad = clone(ROOMS[1]) as unknown as Record<string, unknown>;
    (bad.bands as Record<string, Record<string, unknown>>).middle.lives = 3;
    expect(validateRoom(bad).some((i) => i.message.includes('forbidden field "lives"'))).toBe(true);
  });

  it('the validator catches broken content', () => {
    const conflict = clone(ROOMS[1]);
    conflict.pranks[1].params = { props: ['sock-1'], to: 'table' }; // touches socks like socks-in-fridge
    expect(validateRoom(conflict).some((i) => i.message.includes('both touch'))).toBe(true);

    const noop = clone(ROOMS[1]);
    noop.pranks[0].params = { props: ['sock-1'], to: 'laundry-basket' };
    expect(validateRoom(noop).length).toBeGreaterThan(0);

    const badFix = clone(ROOMS[1]);
    badFix.pranks[0].fix = { mechanic: 'juggle', params: {} };
    expect(validateRoom(badFix).some((i) => i.message.includes('unknown fix mechanic'))).toBe(true);

    const shortFinale = clone(ROOMS[1]);
    shortFinale.bands.big.finale = shortFinale.bands.big.finale.slice(0, 2);
    expect(validateRoom(shortFinale).some((i) => i.message.includes('finale has 2 steps'))).toBe(true);

    const noText = clone(ROOMS[1]);
    noText.pranks[0].spot = { fr: 'Ha !', en: '' };
    expect(validateRoom(noText).some((i) => i.message.includes('fr + en'))).toBe(true);

    const badTheme = clone(ROOMS[1]);
    badTheme.pranks[0].themes = ['not-a-prank'];
    expect(validateRoom(badTheme).some((i) => i.message.includes('planner prank'))).toBe(true);

    const missingGoal = clone(ROOMS[10]);
    missingGoal.goals = missingGoal.goals.filter((g) => g !== 'fractions');
    expect(validateRoom(missingGoal).some((i) => i.message.includes('"fractions"'))).toBe(true);
  });

  it('progression checks catch a shuffled house', () => {
    const rooms = clone(ROOMS);
    rooms[3].number = 2;
    expect(validateRooms(rooms, { seeds: 1 }).some((i) => i.room === '*')).toBe(true);
  });

  it('tonight’s planner prank id maps to rooms that can feature it', () => {
    expect(roomsForNightPrank('chaussettes')).toContain('chaos.kitchen');
    expect(roomsForNightPrank('livres')).toContain('chaos.library');
    expect(roomsForNightPrank('unknown')).toEqual([]);
  });
});
