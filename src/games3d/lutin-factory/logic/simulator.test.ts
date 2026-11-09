import { describe, expect, it } from 'vitest';
import { FactorySim, simulate } from './simulator';
import { LEVELS, referenceLayout } from './levels';
import { BANDS, type Layout } from './types';
import { P, line } from './test-helpers';

describe('simulator', () => {
  it('moves an item one tile per tick, from the chute to the sack', () => {
    const sim = new FactorySim(line({ count: 1 }, ['belt', 'belt']));
    sim.step(); // tick 1: the chute drops the item on its own tile
    expect(sim.items().map((i) => i.at)).toEqual([[0, 1]]);
    sim.step();
    expect(sim.items().map((i) => i.at)).toEqual([[1, 1]]);
    sim.step();
    expect(sim.items().map((i) => i.at)).toEqual([[2, 1]]);
    sim.step();
    expect(sim.items()).toEqual([]);
    expect(sim.deliveries()).toHaveLength(1);
    expect(sim.deliveries()[0].tick).toBe(4);
  });

  it('is deterministic: same layout, same ticks, same hash', () => {
    for (const lv of LEVELS)
      for (const band of BANDS) {
        const layout = referenceLayout(lv.bands[band]);
        const a = new FactorySim(layout);
        const b = new FactorySim(layout);
        for (let i = 0; i < 40; i++) {
          a.step();
          b.step();
          expect(a.hash()).toBe(b.hash());
        }
        a.runUntilSettled();
        b.runUntilSettled();
        expect(a.hash(), `${lv.id}/${band}`).toBe(b.hash());
      }
  });

  it('reset() replays exactly the same run', () => {
    const layout = referenceLayout(LEVELS[8].bands.big);
    const sim = new FactorySim(layout);
    const hashes: string[] = [];
    for (let i = 0; i < 30; i++) {
      sim.step();
      hashes.push(sim.hash());
    }
    sim.reset();
    expect(sim.tick).toBe(0);
    expect(sim.items()).toEqual([]);
    for (let i = 0; i < 30; i++) {
      sim.step();
      expect(sim.hash()).toBe(hashes[i]);
    }
  });

  it('run(n) steps n ticks and stops early once settled', () => {
    const sim = new FactorySim(line({ count: 2 }, ['belt']));
    expect(sim.run(3)).toHaveLength(3);
    expect(sim.tick).toBe(3);
    sim.run(100);
    expect(sim.settled).toBe(true);
    expect(sim.finished).toBe(true);
    expect(sim.tick).toBeLessThan(20);
  });

  it('the simulator never mutates the layout it was given', () => {
    const layout = referenceLayout(LEVELS[11].bands.big);
    const before = JSON.stringify(layout);
    simulate(layout);
    expect(JSON.stringify(layout)).toBe(before);
  });

  it('a path that stops keeps the item waiting (nothing is lost), and settles', () => {
    const layout: Layout = { w: 5, h: 3, pieces: [P('chute', 0, 1, 'E', { count: 2 }), P('belt', 1, 1, 'E')] };
    const { sim, deliveries } = simulate(layout);
    expect(deliveries).toEqual([]);
    expect(sim.settled).toBe(true);
    expect(sim.finished).toBe(false);
    expect(sim.items()).toHaveLength(2); // one on the belt, one still in the chute
  });

  it('items cannot enter a belt through its front', () => {
    const layout: Layout = { w: 4, h: 3, pieces: [P('chute', 0, 1, 'E', { count: 1 }), P('belt', 1, 1, 'W'), P('sack', 2, 1)] };
    const { deliveries, sim } = simulate(layout);
    expect(deliveries).toEqual([]);
    expect(sim.items()[0].at).toEqual([0, 1]);
  });

  it('merges deterministically: straight-on beats the side, then left beats right', () => {
    // Two side feeders (from N = left and from S = right) and a straight feeder into (2,1) facing E.
    const layout: Layout = {
      w: 5,
      h: 3,
      pieces: [
        P('chute', 1, 0, 'S', { count: 1, material: 'felt' }),
        P('chute', 1, 2, 'N', { count: 1, material: 'metal' }),
        P('chute', 0, 1, 'E', { count: 1, material: 'yarn' }),
        P('belt', 1, 1, 'E'),
        P('belt', 2, 1, 'E'),
        P('sack', 3, 1),
      ],
    };
    // Tick 2: the felt (from N, left of the E belt) and metal (from S, right) both want (1,1); yarn sits at (0,1) behind.
    const { deliveries } = simulate(layout);
    expect(deliveries.map((d) => d.item.material)).toEqual(['yarn', 'felt', 'metal']);
  });

  it('a full ring of belts turns as a whole (no deadlock)', () => {
    // Ring (0,0)E → (1,0)S → (1,1)W → (0,1)N → (0,0), fed from below by a chute.
    const ring: Layout = {
      w: 3,
      h: 3,
      pieces: [P('belt', 0, 0, 'E'), P('belt', 1, 0, 'S'), P('belt', 1, 1, 'W'), P('belt', 0, 1, 'N'), P('chute', 0, 2, 'N', { count: 4 })],
    };
    const sim = new FactorySim(ring);
    sim.run(30);
    const before = sim.items();
    expect(before).toHaveLength(4);
    expect(before.every((i) => i.at[1] < 2)).toBe(true);
    const report = sim.step();
    expect(report.events.filter((e) => e.type === 'move')).toHaveLength(4);
    expect(sim.settled).toBe(false);
    expect(sim.runUntilSettled(200).settled).toBe(false); // it keeps turning: a merry-go-round, not a jam
  });

  it('reports events for the runtime (emit, move, process, deliver)', () => {
    const sim = new FactorySim(line({ count: 1 }, [P('painter', 0, 0, 'E', { color: 'red' })]));
    const types = [...sim.step().events, ...sim.step().events, ...sim.step().events].map((e) => e.type);
    expect(types).toEqual(['emit', 'move', 'process', 'move', 'deliver']);
  });
});
