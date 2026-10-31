import { describe, expect, it } from 'vitest';
import { LEARNING_SKILLS } from '@/lib/learning/skills';
import {
  COASTER_SKILLS,
  EMPTY_GO,
  FULL_PATH,
  GAME_ID,
  LINE_CAP,
  PRAISE,
  RIDES_PER_GAME,
  applyOp,
  canAdd,
  checkPath,
  gapLabel,
  instruction,
  missText,
  nextHint,
  opKey,
  opLabel,
  opSpoken,
  planGame,
  planRide,
  praiseFor,
  rideKey,
  solve,
  spokenLines,
  stopsOf,
  valueAfter,
  type Band,
  type Ride,
} from './logic';

const BANDS: Band[] = ['little', 'middle', 'big'];
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 13);

function allRides(): { band: Band; level: number; ride: Ride }[] {
  const out: { band: Band; level: number; ride: Ride }[] = [];
  for (const band of BANDS)
    for (let level = 1; level <= 5; level++)
      for (const seed of SEEDS) for (const ride of planGame(seed, band, level)) out.push({ band, level, ride });
  return out;
}
const RIDES = allRides();

describe('ids', () => {
  it('the game id is valid for the World Memory (letters, digits, _)', () => {
    expect(GAME_ID).toMatch(/^[a-z0-9_]{1,40}$/);
  });
});

describe('rail pieces', () => {
  it('apply, label and speak', () => {
    expect(applyOp(4, { kind: 'add', n: 3 })).toBe(7);
    expect(applyOp(4, { kind: 'sub', n: 3 })).toBe(1);
    expect(applyOp(4, { kind: 'mul', n: 3 })).toBe(12);
    expect(opLabel({ kind: 'sub', n: 2 })).toBe('−2');
    expect(opLabel({ kind: 'mul', n: 5 })).toBe('×5');
    expect(opSpoken({ kind: 'sub', n: 2 }, 'fr')).toBe('moins 2');
    expect(opSpoken({ kind: 'mul', n: 2 }, 'en')).toBe('times 2');
    expect(stopsOf(2, [{ kind: 'add', n: 3 }, { kind: 'mul', n: 2 }])).toEqual([2, 5, 10]);
    expect(gapLabel(2)).toBe('+2');
    expect(gapLabel(-3)).toBe('−3');
  });
});

describe('every ride can be won', () => {
  it('the known solution ends right on the target, inside the line', () => {
    for (const { ride } of RIDES) {
      expect(ride.solution.length).toBeGreaterThan(0);
      expect(ride.solution.length).toBeLessThanOrEqual(ride.slots);
      const stops = stopsOf(ride.start, [...ride.preset, ...ride.solution]);
      expect(stops.at(-1)).toBe(ride.target);
      for (const v of stops) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(ride.max);
      }
      for (const op of ride.solution) expect(ride.palette.some((p) => opKey(p) === opKey(op))).toBe(true);
      // The child can actually place it, piece by piece.
      const path = [] as typeof ride.solution;
      for (const op of ride.solution) {
        expect(canAdd(ride, path, op)).toBe(true);
        path.push(op);
      }
      expect(checkPath(ride, path)).toEqual({ reached: ride.target, ok: true, gap: 0 });
    }
  });

  it('the start is never already the target, pieces are all different', () => {
    for (const { ride } of RIDES) {
      expect(valueAfter(ride.start, ride.preset)).not.toBe(ride.target);
      expect(new Set(ride.palette.map(opKey)).size).toBe(ride.palette.length);
      expect(ride.palette.length).toBeGreaterThanOrEqual(1);
      expect(ride.palette.length).toBeLessThanOrEqual(5);
    }
  });

  it('one-piece questions have exactly one right piece', () => {
    for (const { ride } of RIDES.filter((x) => x.ride.slots === 1)) {
      const end = valueAfter(ride.start, ride.preset);
      const right = ride.palette.filter((op) => applyOp(end, op) === ride.target);
      expect(right).toHaveLength(1);
    }
  });

  it('chains really need every piece (no shortcut)', () => {
    for (const { ride } of RIDES.filter((x) => x.ride.kind === 'chain')) {
      expect(solve(ride, [])?.length).toBe(ride.slots);
      expect(ride.solution.some((op) => op.kind === 'mul')).toBe(true);
    }
  });

  it('solve finds a way from any partial path that can still win', () => {
    for (const { ride } of RIDES.slice(0, 400)) {
      const s = solve(ride, []);
      expect(s).not.toBeNull();
      expect(valueAfter(valueAfter(ride.start, ride.preset), s!)).toBe(ride.target);
    }
  });
});

describe('difficulty follows the age', () => {
  it('little ones count on 0..10 with +1 / +2 and compare small numbers', () => {
    for (const { ride } of RIDES.filter((x) => x.band === 'little')) {
      expect(ride.max).toBe(10);
      expect(ride.target).toBeLessThanOrEqual(10);
      expect(['hops', 'compare']).toContain(ride.kind);
      expect(ride.palette.every((op) => op.kind === 'add')).toBe(true);
      if (ride.kind === 'hops') expect(ride.palette.every((op) => op.n <= 2)).toBe(true);
      if (ride.kind === 'compare') {
        expect(ride.autoLaunch).toBe(true);
        expect(ride.hidden).toBe(true);
        const [a, b] = ride.palette.map((op) => op.n);
        expect(ride.target).toBe(ride.compare === 'less' ? Math.min(a, b) : Math.max(a, b));
      }
    }
  });

  it('level 1 little ones start with single hops of 1, up to 5', () => {
    for (const seed of SEEDS) {
      const first = planGame(seed, 'little', 1)[0];
      expect(first.palette).toEqual([{ kind: 'add', n: 1 }]);
      expect(first.target).toBeLessThanOrEqual(5);
    }
  });

  it('6-8 year olds add and subtract up to 30, with patterns and missing pieces', () => {
    const middle = RIDES.filter((x) => x.band === 'middle');
    for (const { ride } of middle) {
      expect(ride.max).toBeLessThanOrEqual(LINE_CAP.middle + 2);
      expect(ride.target).toBeLessThanOrEqual(30);
      expect(ride.palette.every((op) => op.kind !== 'mul')).toBe(true);
    }
    const kinds = new Set(middle.map((x) => x.ride.kind));
    for (const k of ['sum', 'minus', 'sequence', 'missing']) expect(kinds.has(k as Ride['kind'])).toBe(true);
    // Level 1 stays small.
    for (const { ride } of middle.filter((x) => x.level === 1)) expect(ride.target).toBeLessThanOrEqual(20);
  });

  it('8-12 year olds multiply and chain two or three pieces', () => {
    const big = RIDES.filter((x) => x.band === 'big');
    for (const { ride } of big) {
      expect(ride.max).toBeLessThanOrEqual(LINE_CAP.big);
      expect(['times', 'chain', 'sequence']).toContain(ride.kind);
    }
    expect(big.filter((x) => x.ride.kind === 'chain').some((x) => x.ride.slots === 3)).toBe(true);
    expect(big.filter((x) => x.level === 1 && x.ride.kind === 'chain').every((x) => x.ride.slots === 2)).toBe(true);
    expect(big.some((x) => x.ride.palette.some((op) => op.kind === 'mul'))).toBe(true);
  });

  it('every skill is a real learning skill, and the five are trained', () => {
    for (const s of COASTER_SKILLS) expect(LEARNING_SKILLS).toContain(s);
    const used = new Set(RIDES.map((x) => x.ride.skill));
    for (const s of COASTER_SKILLS) expect(used.has(s)).toBe(true);
  });
});

describe('a game', () => {
  it('has five different rides, deterministic per seed', () => {
    for (const band of BANDS)
      for (const seed of SEEDS) {
        const g = planGame(seed, band, 2);
        expect(g).toHaveLength(RIDES_PER_GAME);
        expect(new Set(g.map(rideKey)).size).toBe(RIDES_PER_GAME);
        expect(planGame(seed, band, 2)).toEqual(g);
      }
  });

  it('planRide avoids rides already played', () => {
    const a = planRide(42, 'middle', 2, 0);
    const b = planRide(42, 'middle', 2, 0, [rideKey(a)]);
    expect(rideKey(b)).not.toBe(rideKey(a));
  });

  it('survives odd levels', () => {
    expect(planRide(1, 'big', Number.NaN, 0).level).toBe(1);
    expect(planRide(1, 'big', 99, 0).level).toBe(5);
  });
});

describe('building the path', () => {
  const ride: Ride = planGame(5, 'middle', 1)[0];

  it('no more pieces than slots, never off the line, never a piece that does nothing', () => {
    const r: Ride = { ...ride, start: 0, target: 9, palette: [{ kind: 'add', n: 5 }, { kind: 'mul', n: 2 }], slots: 2, max: 10, preset: [] };
    expect(canAdd(r, [], { kind: 'mul', n: 2 })).toBe(false); // 0 × 2 = 0
    expect(canAdd(r, [], { kind: 'add', n: 5 })).toBe(true);
    expect(canAdd(r, [{ kind: 'add', n: 5 }], { kind: 'mul', n: 2 })).toBe(true); // 10
    expect(canAdd(r, [{ kind: 'add', n: 5 }, { kind: 'add', n: 5 }], { kind: 'add', n: 5 })).toBe(false); // full
    expect(canAdd({ ...r, slots: 4 }, [{ kind: 'add', n: 5 }, { kind: 'add', n: 5 }], { kind: 'add', n: 5 })).toBe(false); // 15 > 10
  });

  it('hints: the next good piece, or undo when the path went too far', () => {
    const r: Ride = { ...ride, start: 0, target: 4, palette: [{ kind: 'add', n: 1 }, { kind: 'add', n: 2 }], slots: 3, max: 10, preset: [] };
    expect(nextHint(r, [])).toEqual({ kind: 'piece', op: { kind: 'add', n: 2 } });
    expect(nextHint(r, [{ kind: 'add', n: 2 }, { kind: 'add', n: 2 }, { kind: 'add', n: 1 }])).toEqual({ kind: 'undo' });
    expect(nextHint(r, [{ kind: 'add', n: 2 }, { kind: 'add', n: 2 }])).toBeNull();
    expect(checkPath(r, [{ kind: 'add', n: 1 }])).toEqual({ reached: 1, ok: false, gap: 3 });
  });
});

describe('words', () => {
  it('every ride has a French and an English instruction', () => {
    for (const { ride } of RIDES.slice(0, 600)) {
      const fr = instruction(ride, 'fr');
      const en = instruction(ride, 'en');
      expect(fr.length).toBeGreaterThan(10);
      expect(en.length).toBeGreaterThan(10);
      expect(fr).not.toBe(en);
      expect(spokenLines(ride, 'fr').join(' ').length).toBeGreaterThan(10);
      expect(spokenLines(ride, 'en').join(' ').length).toBeGreaterThan(10);
      if (!ride.hidden) expect(fr).toContain(String(ride.target));
      expect(fr).not.toMatch(/undefined|NaN/);
      expect(en).not.toMatch(/undefined|NaN/);
    }
  });

  it('a wrong stop gives a kind hint with the gap, never "wrong"', () => {
    for (const { ride } of RIDES.slice(0, 600)) {
      const wrong = ride.palette.find((op) => applyOp(valueAfter(ride.start, ride.preset), op) !== ride.target) ?? ride.palette[0];
      for (const locale of ['fr', 'en']) {
        const t = missText(ride, [wrong], 1, locale);
        expect(t.length).toBeGreaterThan(10);
        expect(t).not.toMatch(/faux|perdu|wrong|lost|undefined|NaN/i);
        const t2 = missText(ride, [wrong], 2, locale);
        expect(t2.length).toBeGreaterThanOrEqual(t.length);
      }
    }
    const hopRide: Ride = { ...planGame(3, 'little', 2)[1], start: 0, target: 7 };
    expect(missText(hopRide, [{ kind: 'add', n: 2 }, { kind: 'add', n: 2 }, { kind: 'add', n: 1 }], 1, 'fr')).toContain('Encore 2');
    expect(missText(hopRide, [{ kind: 'add', n: 2 }, { kind: 'add', n: 2 }, { kind: 'add', n: 2 }, { kind: 'add', n: 2 }], 1, 'en')).toContain('1 too far');
  });

  it('praise and prompts exist in both languages', () => {
    for (const p of [...PRAISE, EMPTY_GO, FULL_PATH]) {
      expect(p.fr.length).toBeGreaterThan(5);
      expect(p.en.length).toBeGreaterThan(5);
    }
    expect(praiseFor(7, 'fr')).toBe(PRAISE[7 % PRAISE.length].fr);
    expect(praiseFor(-1, 'en')).toBe(PRAISE[1].en);
  });
});
