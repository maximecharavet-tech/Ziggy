import { describe, expect, it } from 'vitest';
import { simulate } from './simulator';
import { getMachine, machineIds } from './machines/registry';
import { flattenProgram } from './machines/arm';
import { MACHINE_TEXT } from './texts';
import { identifyToy } from './toys';
import type { Dial, Layout } from './types';
import { P, line } from './test-helpers';

const out = (layout: Layout) => simulate(layout).deliveries.map((d) => d.item);

describe('machine registry', () => {
  it('every machine has FR/EN texts, an icon, a valid default dial', () => {
    for (const id of machineIds()) {
      const m = getMachine(id)!;
      expect(MACHINE_TEXT[id]?.name.fr, id).toBeTruthy();
      expect(MACHINE_TEXT[id]?.name.en, id).toBeTruthy();
      expect(MACHINE_TEXT[id]?.does.fr && MACHINE_TEXT[id]?.does.en, id).toBeTruthy();
      expect(m.icon, id).toBeTruthy();
      expect(m.dial.parse(m.dial.defaults), id).toEqual(m.dial.defaults);
    }
  });

  it('dials are strict: unknown keys and out-of-range values are refused', () => {
    expect(getMachine('painter')!.dial.parse({ color: 'red', glitter: true })).toBeNull();
    expect(getMachine('painter')!.dial.parse({ color: 'brown' })).toBeNull(); // brown only comes from the mixer
    expect(getMachine('painter')!.dial.parse({ color: 'red', colors: ['blue'] })).toBeNull();
    expect(getMachine('chute')!.dial.parse({ count: 101 })).toBeNull();
    expect(getMachine('chute')!.dial.parse({ count: 2.5 })).toBeNull();
    expect(getMachine('assembler')!.dial.parse({ toy: 'ball' })).toBeNull(); // single-part toys come from the shaper
    expect(getMachine('assembler')!.dial.parse({ toy: 'train', n: 99 })).toBeNull();
    expect(getMachine('assembler')!.dial.parse({ toy: 'car', n: 2 })).toBeNull();
    expect(getMachine('sorter')!.dial.parse({})).toBeNull();
    expect(getMachine('loop')!.dial.parse({ times: 1 })).toBeNull();
    expect(getMachine('arm')!.dial.parse({ program: ['dance'] })).toBeNull();
    expect(getMachine('arm')!.dial.parse({ program: [{ repeat: 3, do: [{ repeat: 2, do: ['pick'] }] }] })).toBeNull();
    expect(getMachine('sack')!.dial.parse({ bay: 'a b' })).toBeNull();
  });
});

describe('machines', () => {
  it('chute drops raw material, `count` of them, or ready-made gifts in a cycle', () => {
    expect(out(line({ count: 3, material: 'felt' }, ['belt'])).map((i) => i.material)).toEqual(['felt', 'felt', 'felt']);
    const gifts = out(line({ count: 3, items: [{ shape: 'ball', color: 'red' }, { shape: 'cone' }] }, ['belt']));
    expect(gifts.map((i) => [i.shape, i.color])).toEqual([['ball', 'red'], ['cone', undefined], ['ball', 'red']]);
    expect(out(line({ count: 0 }, ['belt']))).toEqual([]);
  });

  it('shaper gives a shape (or a cycle of shapes); toys ride through', () => {
    expect(out(line({ count: 1 }, [P('shaper', 0, 0, 'E', { shape: 'star' })]))[0].shape).toBe('star');
    expect(out(line({ count: 4 }, [P('shaper', 0, 0, 'E', { shapes: ['ball', 'cone'] })])).map((i) => i.shape)).toEqual(['ball', 'cone', 'ball', 'cone']);
  });

  it('painter paints (one colour or a cycle), and paints the parts of a toy', () => {
    expect(out(line({ count: 3 }, [P('painter', 0, 0, 'E', { colors: ['red', 'blue'] })])).map((i) => i.color)).toEqual(['red', 'blue', 'red']);
  });

  it('mixer: a + b, or a mixed into the current colour', () => {
    expect(out(line({ count: 1 }, [P('mixer', 0, 0, 'E', { a: 'yellow', b: 'blue' })]))[0].color).toBe('green');
    expect(out(line({ count: 1 }, [P('painter', 0, 0, 'E', { color: 'red' }), P('mixer', 0, 0, 'E', { a: 'blue' })]))[0].color).toBe('purple');
    expect(out(line({ count: 1 }, [P('mixer', 0, 0, 'E', { a: 'red' })]))[0].color).toBe('red');
  });

  it('assembler builds a toy from a full set of parts, keeps spare parts, lets other items through', () => {
    // engine (cylinder) from above, wagons (cubes) from below, an assembler for a 2-wagon train.
    const layout: Layout = {
      w: 5,
      h: 3,
      pieces: [
        P('chute', 0, 0, 'E', { count: 2 }), P('shaper', 1, 0, 'E', { shape: 'cylinder' }), P('belt', 2, 0, 'S'),
        P('chute', 0, 2, 'E', { count: 5 }), P('shaper', 1, 2, 'E', { shape: 'cube' }), P('belt', 2, 2, 'N'),
        P('assembler', 2, 1, 'E', { toy: 'train', n: 2 }), P('belt', 3, 1, 'E'), P('sack', 4, 1),
      ],
    };
    const { deliveries, sim } = simulate(layout);
    expect(deliveries.map((d) => [d.item.toy, d.item.n, d.item.parts?.length])).toEqual([['train', 2, 3], ['train', 2, 3]]);
    expect((sim.machineState([2, 1]) as { basket: unknown[] }).basket).toHaveLength(1); // one spare wagon waits, never lost
    // A ball is not a train part: it rides straight through.
    const through = out(line({ count: 1 }, [P('shaper', 0, 0, 'E', { shape: 'ball' }), P('assembler', 0, 0, 'E', { toy: 'car' })]));
    expect(identifyToy(through[0])).toBe('ball');
  });

  it('assembled toys take the colour of their parts when they all match', () => {
    const layout: Layout = {
      w: 5,
      h: 3,
      pieces: [P('chute', 0, 1, 'E', { count: 2, items: [{ shape: 'cylinder', color: 'blue' }, { shape: 'cone', color: 'blue' }] }), P('belt', 1, 1, 'E'), P('assembler', 2, 1, 'E', { toy: 'rocket' }), P('belt', 3, 1, 'E'), P('sack', 4, 1)],
    };
    const [rocket] = out(layout);
    expect(rocket.toy).toBe('rocket');
    expect(rocket.color).toBe('blue');
  });

  it('counter gate: "first n" straight then right; "every n-th" to the right', () => {
    const gate = (dial: Dial): Layout => ({
      w: 5,
      h: 3,
      pieces: [P('chute', 0, 1, 'E', { count: 6 }), P('counter', 1, 1, 'E', dial), P('belt', 2, 1, 'E'), P('sack', 3, 1, 'E', { bay: 'S' }), P('sack', 1, 2, 'E', { bay: 'R' })],
    });
    const first = simulate(gate({ n: 2, mode: 'first' })).deliveries;
    expect(first.filter((d) => d.bay === 'S')).toHaveLength(2);
    expect(first.filter((d) => d.bay === 'R')).toHaveLength(4);
    const every = simulate(gate({ n: 3, mode: 'every' })).deliveries;
    expect(every.filter((d) => d.bay === 'R').map((d) => d.item.id)).toEqual([3, 6]);
  });

  it('sorter: IF it matches → left, ELSE → right', () => {
    const sort = (dial: Dial): Layout => ({
      w: 4,
      h: 3,
      pieces: [P('chute', 0, 1, 'E', { count: 4, items: [{ shape: 'ball', color: 'red' }, { shape: 'cone', color: 'blue' }] }), P('belt', 1, 1, 'E'), P('sorter', 2, 1, 'E', dial), P('sack', 2, 0, 'E', { bay: 'L' }), P('sack', 2, 2, 'E', { bay: 'R' })],
    });
    const route = (d: Dial) => simulate(sort(d)).deliveries.map((x) => `${x.item.color}:${x.bay}`);
    expect(route({ color: 'red' })).toEqual(['red:L', 'blue:R', 'red:L', 'blue:R']);
    expect(route({ toy: 'top' })).toEqual(['red:R', 'blue:L', 'red:R', 'blue:L']);
    expect(route({ shape: 'ball', color: 'blue' })).toEqual(['red:R', 'blue:R', 'red:R', 'blue:R']);
  });

  it('loop: one item in, `times` identical items out', () => {
    const items = out(line({ count: 2 }, [P('painter', 0, 0, 'E', { colors: ['red', 'blue'] }), P('loop', 0, 0, 'E', { times: 3 }), 'belt']));
    expect(items.map((i) => i.color)).toEqual(['red', 'red', 'red', 'blue', 'blue', 'blue']);
    expect(new Set(items.map((i) => i.id)).size).toBe(6);
  });

  it('stamper and wrapper decorate', () => {
    const [a] = out(line({ count: 1 }, [P('stamper', 0, 0, 'E', { sticker: 'moon' }), P('wrapper', 0, 0, 'E', { pattern: 'hearts' })]));
    expect([a.sticker, a.wrap]).toEqual(['moon', 'hearts']);
    expect(out(line({ count: 3 }, [P('wrapper', 0, 0, 'E', { patterns: ['stripes', 'dots'] })])).map((i) => i.wrap)).toEqual(['stripes', 'dots', 'stripes']);
  });

  it('robot arm runs its cards: builds a tower, repeats, ships', () => {
    const program = [{ repeat: 2, do: ['pick', 'shape:cube', 'paint:red', 'stack', 'pick', 'shape:cube', 'paint:blue', 'stack'] }, 'ship'];
    expect(flattenProgram(program)).toHaveLength(17);
    const [tower] = out(line({ count: 4 }, ['belt', P('arm', 0, 0, 'E', { program }), 'belt']));
    expect(tower.toy).toBe('tower');
    expect(tower.n).toBe(4);
    expect(tower.parts?.map((p) => p.color)).toEqual(['red', 'blue', 'red', 'blue']);
    expect(tower.color).toBeUndefined();
    // A card with nothing to do is skipped kindly; pick waits for an item.
    const single = out(line({ count: 2 }, ['belt', P('arm', 0, 0, 'E', { program: ['stack', 'pick', 'shape:ball', 'ship'] }), 'belt']));
    expect(single.map((i) => i.shape)).toEqual(['ball', 'ball']);
  });

  it('sack delivers with its bay, from any side', () => {
    const layout: Layout = { w: 3, h: 3, pieces: [P('chute', 1, 0, 'S', { count: 1 }), P('sack', 1, 1, 'W', { bay: 'B2' })] };
    expect(simulate(layout).deliveries.map((d) => d.bay)).toEqual(['B2']);
  });
});
