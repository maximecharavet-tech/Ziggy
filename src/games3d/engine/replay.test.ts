import { describe, expect, it } from 'vitest';
import { rng } from '../kit/rng';
import { FixedStepLoop } from './loop';
import type { Action } from './input/actions';
import { ActionQueue, ReplayRecorder, decodeReplay, encodeReplay, hashState, runReplay, stableStringify, validateReplay, type Simulation } from './replay';

/** A tiny pure "game": a seeded belt of items; select picks the front one, step moves them. */
type S = { rand: () => number; items: number[]; picked: number[]; t: number };
const sim: Simulation<S, Action> = {
  create: (seed) => {
    const rand = rng(seed);
    return { rand, items: Array.from({ length: 5 }, () => Math.floor(rand() * 10)), picked: [], t: 0 };
  },
  apply: (s, a) => {
    if (a.type === 'select' && s.items.length) s.picked.push(s.items.shift()!);
    if (a.type === 'undo' && s.picked.length) s.items.unshift(s.picked.pop()!);
  },
  tick: (s, t) => {
    s.t = t;
    if (t % 30 === 0) s.items.push(Math.floor(s.rand() * 10));
  },
};
const snapshot = (s: S) => ({ items: s.items, picked: s.picked, t: s.t });

describe('replay', () => {
  it('stableStringify sorts keys; hashState is order-independent and sensitive to values', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
    expect(hashState({ a: 1, b: 2 })).toBe(hashState({ b: 2, a: 1 }));
    expect(hashState({ a: 1, b: 2 })).not.toBe(hashState({ a: 1, b: 3 }));
    expect(hashState(new Map([['x', 1]]))).toBe(hashState([['x', 1]]));
    expect(hashState({ a: 1 })).toMatch(/^[0-9a-f]{8}$/);
  });

  it('a live session (loop + queue + recorder) replays to the same state hash', () => {
    // Live: random frame times, actions arriving between frames.
    const live = sim.create(1234);
    const queue = new ActionQueue<Action>();
    const rec = new ReplayRecorder<Action>('test', 1234, 'middle');
    queue.record(rec);
    const loop = new FixedStepLoop({
      fixedUpdate: (_s, tick) => {
        queue.drain(tick, (a) => sim.apply(live, a));
        sim.tick(live, tick);
      },
      update: () => {},
    });
    const frames = rng(99);
    for (let f = 0; f < 600; f++) {
      if (f % 37 === 5) queue.push({ type: 'select', target: null });
      if (f % 113 === 7) queue.push({ type: 'undo' });
      loop.advance(0.008 + frames() * 0.03);
    }
    const replay = rec.finish(loop.tick);
    expect(replay.actions.length).toBeGreaterThan(5);
    const again = runReplay(sim, replay);
    expect(hashState(snapshot(again))).toBe(hashState(snapshot(live)));
  });

  it('the same replay always gives the same hash; a different seed does not', () => {
    const r = {
      format: 'ziggy.replay/1' as const,
      game: 'test',
      seed: 7,
      ticks: 200,
      actions: [
        [10, { type: 'select', target: null }],
        [10, { type: 'select', target: null }],
        [50, { type: 'undo' }],
      ] as [number, Action][],
    };
    const h1 = hashState(snapshot(runReplay(sim, r)));
    expect(hashState(snapshot(runReplay(sim, r)))).toBe(h1);
    expect(hashState(snapshot(runReplay(sim, { ...r, seed: 8 })))).not.toBe(h1);
  });

  it('encode/decode round-trips (URL-safe) and rejects garbage', () => {
    const r = { format: 'ziggy.replay/1' as const, game: 'lutin-factory', seed: 3, band: 'little', ticks: 5, actions: [[1, { type: 'go' }]] as [number, Action][] };
    const s = encodeReplay(r);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeReplay(s)).toEqual(r);
    expect(decodeReplay('%%%')).toBeNull();
    expect(validateReplay({ ...r, actions: [[9, {}]] })).toBe(false); // tick beyond the end
    expect(validateReplay({ ...r, actions: [[2, {}], [1, {}]] })).toBe(false); // out of order
  });
});
