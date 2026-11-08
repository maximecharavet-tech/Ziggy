import { beforeEach, describe, expect, it } from 'vitest';
import { PRANKS } from '@/data/lutins/pranks';
import {
  EMPTY_SETTINGS,
  arrivalDue,
  autoPlan,
  cleanSpots,
  decemberNights,
  departureDue,
  doneNights,
  favouritesFirst,
  hintFor,
  hitSpot,
  lettersReached,
  lutinsStore,
  nightKey,
  parseSettings,
  seasonYear,
  tonightNight,
  type ElfSpot,
} from './family';

describe('December date maths', () => {
  it('a night belongs to its evening until 6 a.m.', () => {
    expect(nightKey(new Date(2026, 11, 5, 21, 30))).toBe('2026-12-05');
    expect(nightKey(new Date(2026, 11, 6, 1, 15))).toBe('2026-12-05');
    expect(nightKey(new Date(2026, 11, 6, 6, 0))).toBe('2026-12-06');
    expect(nightKey(new Date(2027, 0, 1, 2, 0))).toBe('2026-12-31');
  });

  it('the season is last December until July', () => {
    expect(seasonYear(new Date(2026, 10, 8))).toBe(2026);
    expect(seasonYear(new Date(2027, 0, 3))).toBe(2026);
    expect(seasonYear(new Date(2027, 7, 1))).toBe(2027);
  });

  it('has 24 nights, Dec 1 → Dec 24', () => {
    const n = decemberNights(2026);
    expect(n).toHaveLength(24);
    expect(n[0]).toEqual({ n: 1, key: '2026-12-01' });
    expect(n[23]).toEqual({ n: 24, key: '2026-12-24' });
  });

  it('finds tonight only on the planner’s evenings', () => {
    expect(tonightNight(new Date(2026, 11, 12, 20))).toEqual({ n: 12, key: '2026-12-12' });
    expect(tonightNight(new Date(2026, 11, 13, 2))?.n).toBe(12);
    expect(tonightNight(new Date(2026, 11, 1, 3))).toBeNull(); // still Nov 30's night
    expect(tonightNight(new Date(2026, 11, 25, 20))).toBeNull();
    expect(tonightNight(new Date(2026, 10, 8, 20))).toBeNull();
  });

  it('marks the nights done from the journal', () => {
    const done = doneNights([{ createdAt: new Date(2026, 11, 3, 22).toISOString() }, { createdAt: new Date(2026, 11, 5, 0, 30).toISOString() }, { createdAt: 'garbage' }]);
    expect([...done].sort()).toEqual(['2026-12-03', '2026-12-04']);
  });
});

describe('letters timing', () => {
  const s = { ...EMPTY_SETTINGS };
  it('arrival letter: from Dec 1 6:00, or at the first prank, once', () => {
    expect(arrivalDue(s, new Date(2026, 10, 30, 20), false)).toBe(false);
    expect(arrivalDue(s, new Date(2026, 10, 30, 20), true)).toBe(true);
    expect(arrivalDue(s, new Date(2026, 11, 1, 5, 59), false)).toBe(false);
    expect(arrivalDue(s, new Date(2026, 11, 1, 6, 0), false)).toBe(true);
    expect(arrivalDue({ ...s, arrival: '2026-11-28' }, new Date(2026, 10, 28, 7), false)).toBe(true);
    expect(arrivalDue({ ...s, opened: ['arrival-2026'] }, new Date(2026, 11, 2), false)).toBe(false);
    expect(arrivalDue(s, new Date(2026, 11, 26), true)).toBe(false); // after the departure
  });
  it('departure letter: on the chosen morning, until mid-January', () => {
    expect(departureDue(s, new Date(2026, 11, 24, 12))).toBe(false);
    expect(departureDue(s, new Date(2026, 11, 25, 6))).toBe(true);
    expect(departureDue({ ...s, departure: 24 }, new Date(2026, 11, 24, 7))).toBe(true);
    expect(departureDue(s, new Date(2027, 0, 10))).toBe(true);
    expect(departureDue(s, new Date(2027, 0, 20))).toBe(false);
    expect(departureDue({ ...s, opened: ['departure-2026'] }, new Date(2026, 11, 25, 8))).toBe(false);
  });
  it('lists the letters the child can reopen', () => {
    expect(lettersReached({ ...s, opened: ['arrival-2026'] }, new Date(2026, 11, 25, 8), true)).toEqual(['arrival', 'departure']);
    expect(lettersReached(s, new Date(2026, 10, 10), false)).toEqual([]);
  });
});

describe('favourites', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
    lutinsStore._reset();
  });

  it('persists favourites in localStorage and reads them back', () => {
    lutinsStore.toggleFav('bulles');
    lutinsStore.toggleFav('canard');
    lutinsStore.toggleFav('bulles');
    lutinsStore.toggleFav('reveil');
    lutinsStore._reset(); // a new visit: read from storage
    expect(lutinsStore.get().favs).toEqual(['canard', 'reveil']);
  });

  it('survives broken storage', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    lutinsStore._reset();
    expect(lutinsStore.get()).toEqual(EMPTY_SETTINGS);
    lutinsStore.toggleFav('bulles'); // kept in memory for this visit
    expect(lutinsStore.get().favs).toEqual(['bulles']);
  });

  it('parses garbage safely', () => {
    expect(parseSettings('{oops')).toEqual(EMPTY_SETTINGS);
    expect(parseSettings(JSON.stringify({ favs: ['ok', 3, '<b>', 'ok'], plan: { '2026-12-01': 'bulles', nope: 'x', '2026-12-02': 5 }, departure: 24, arrival: 'tomorrow' }))).toEqual({
      favs: ['ok'],
      plan: { '2026-12-01': 'bulles' },
      arrival: null,
      departure: 24,
      opened: [],
    });
  });

  it('shows favourites first, keeping the order', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(favouritesFirst(items, ['c', 'a']).map((x) => x.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('plans and clears nights', () => {
    lutinsStore.setPlan('2026-12-03', 'cinema');
    lutinsStore.setPlan('2026-12-04', 'bulles');
    lutinsStore.setPlan('2026-12-03', null);
    lutinsStore._reset();
    expect(lutinsStore.get().plan).toEqual({ '2026-12-04': 'bulles' });
  });
});

describe('auto-planner', () => {
  it('fills every night, keeps the parent’s choices, no repeats, varies rooms', () => {
    const plan = autoPlan({ '2026-12-05': 'cinema' }, PRANKS, ['bulles'], 2026, 7);
    const nights = decemberNights(2026);
    expect(nights.every((n) => plan[n.key])).toBe(true);
    expect(plan['2026-12-05']).toBe('cinema');
    expect(plan['2026-12-24']).toBe('lettre-pere-noel');
    const ids = nights.map((n) => plan[n.key]);
    expect(new Set(ids).size).toBe(24);
    expect(ids.slice(0, 4)).toContain('bulles'); // favourites come early
    const cat = (id: string) => PRANKS.find((p) => p.id === id)!.cat;
    let same = 0;
    for (let i = 1; i < ids.length; i++) if (cat(ids[i]) === cat(ids[i - 1])) same++;
    expect(same).toBeLessThanOrEqual(2);
    expect(autoPlan({}, PRANKS, [], 2026, 7)).toEqual(autoPlan({}, PRANKS, [], 2026, 7)); // deterministic
  });
});

describe('find-the-elves hit test', () => {
  const spots: ElfSpot[] = [
    { id: 'pepin', x: 0.2, y: 0.5, r: 0.1 },
    { id: 'grelotte', x: 0.7, y: 0.5, r: 0.1 },
    { id: 'noisette', x: 0.75, y: 0.55, r: 0.02 },
  ];
  it('hits inside a spot, misses outside', () => {
    expect(hitSpot(spots, 0.22, 0.52, 4 / 3)).toBe('pepin');
    expect(hitSpot(spots, 0.5, 0.1, 4 / 3)).toBeNull();
  });
  it('accounts for the picture’s aspect (radius is a fraction of the width)', () => {
    // 0.1 of the width = 0.133 of the height on a 4:3 picture.
    expect(hitSpot(spots, 0.2, 0.62, 4 / 3)).toBe('pepin');
    expect(hitSpot(spots, 0.2, 0.7, 4 / 3)).toBeNull();
  });
  it('is generous with tiny spots and picks the nearest when they overlap', () => {
    expect(hitSpot(spots, 0.78, 0.56, 4 / 3)).toBe('noisette');
    expect(hitSpot(spots, 0.69, 0.49, 4 / 3)).toBe('grelotte');
  });
  it('skips the elves already found', () => {
    expect(hitSpot(spots, 0.2, 0.5, 4 / 3, ['pepin'])).toBeNull();
  });
  it('gives a playful direction towards the nearest elf left', () => {
    expect(hintFor(spots, 0.01, 0.5, 4 / 3)).toBe('right');
    expect(hintFor(spots, 0.2, 0.05, 4 / 3)).toBe('down');
    expect(hintFor(spots, 0.21, 0.6, 4 / 3)).toBe('close');
    expect(hintFor(spots, 0.5, 0.5, 4 / 3, ['pepin', 'grelotte', 'noisette'])).toBeNull();
  });
  it('cleans stored spots', () => {
    expect(cleanSpots([{ id: 'pepin', x: 2, y: -1, r: 9 }, { id: 'pepin', x: 0.1, y: 0.1, r: 0.1 }, { id: 'ziggy', x: 0, y: 0, r: 0.1 }, null], ['pepin'])).toEqual([{ id: 'pepin', x: 1, y: 0, r: 0.4 }]);
    expect(cleanSpots('nope', ['pepin'])).toEqual([]);
  });
});
