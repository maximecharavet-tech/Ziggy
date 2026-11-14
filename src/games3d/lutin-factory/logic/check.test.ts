import { describe, expect, it } from 'vitest';
import { check, differences } from './check';
import { lookOf } from './names';
import type { Delivery, Item, Order } from './types';

let id = 1;
const item = (p: Partial<Item>): Item => ({ id: id++, material: 'wood', ...p });
const deliver = (items: Item[], bay?: string): Delivery[] => items.map((it, i) => ({ tick: i + 1, at: [4, 1], ...(bay ? { bay } : {}), item: it }));
const redBall = () => item({ shape: 'ball', color: 'red' });
const blueBall = () => item({ shape: 'ball', color: 'blue' });

describe('check gate', () => {
  it('a matching toy fulfils the letter', () => {
    const r = check([{ toy: 'ball', props: { color: 'red' }, count: 1 }], deliver([redBall()]));
    expect(r.status).toBe('done');
    expect(r.complete).toBe(true);
    expect(r.matched).toHaveLength(1);
    expect(r.reason.en).toMatch(/exactly what the letter asks/);
  });

  it('a different toy goes to the surprise shelf with a funny name and ONE friendly pointer', () => {
    const r = check([{ toy: 'ball', props: { color: 'red' }, count: 1 }], deliver([blueBall()]));
    expect(r.status).toBe('in-progress');
    expect(r.complete).toBe(false);
    expect(r.shelf).toHaveLength(1);
    expect(r.shelf[0].closest).toEqual({ order: 0, differs: ['color'] });
    expect(r.focus).toBe('color');
    expect(r.reason.fr).toBe('Oh, une balle bleue ! Direction l’étagère surprise ! La lettre demande une balle rouge. Quelle machine peint ?');
    expect(r.reason.en).toBe('Ooh, a blue ball! Off to the surprise shelf! The letter asks for a red ball. Which machine paints?');
    expect(r.blame?.en).toMatch(/Pip/);
    expect(r.shelf[0].name.fr).toMatch(/^La balle bleue /);
  });

  it('never returns a failure state, whatever arrives', () => {
    const orders: Order[] = [{ toy: 'train', props: { n: 3, color: 'red' }, count: 2, bay: 'A', exact: true }];
    const junk = [item({}), item({ shape: 'wheel', color: 'purple' }), item({ toy: 'car', parts: [] }), redBall(), item({ toy: 'train', n: 3, color: 'red' })];
    for (let k = 0; k <= junk.length; k++) {
      for (const bay of [undefined, 'A', 'Z']) {
        const r = check(orders, deliver(junk.slice(0, k), bay), { ran: true });
        expect(['done', 'in-progress', 'not-started']).toContain(r.status);
        expect(JSON.stringify(r)).not.toMatch(/fail|wrong|error/i);
        // Every delivery is accounted for: matched or on the shelf.
        expect(r.matched.length + r.shelf.length).toBe(k);
        expect(r.reason.fr && r.reason.en).toBeTruthy();
      }
    }
  });

  it('not started vs ran with an empty sack', () => {
    expect(check([{ toy: 'ball', count: 1 }], []).status).toBe('not-started');
    const r = check([{ toy: 'ball', count: 1 }], [], { ran: true });
    expect(r.status).toBe('in-progress');
    expect(r.reason.en).toMatch(/Nothing has reached the sack yet/);
  });

  it('counts: what is still missing, and extras on an exact (counting) letter', () => {
    const tops = (n: number) => Array.from({ length: n }, () => item({ shape: 'cone' }));
    const order: Order[] = [{ toy: 'top', count: 3, exact: true }];
    expect(check(order, deliver(tops(1))).reason.en).toBe('The letter still needs 2 spinning tops.');
    expect(check(order, deliver(tops(2))).reason.fr).toBe('La lettre attend encore une toupie.');
    const five = check(order, deliver(tops(5)));
    expect(five.complete).toBe(false);
    expect(five.shelf.filter((s) => s.bonus)).toHaveLength(2);
    expect(five.reason.en).toBe('Bonus: 2 spinning tops! Off to the surprise shelf. The letter asks for 3.');
    // Not exact: extras are just bonus surprises.
    const loose = check([{ toy: 'top', count: 3 }], deliver(tops(4)));
    expect(loose.complete).toBe(true);
    expect(loose.reason.en).toMatch(/bonus surprise toy on the shelf/);
  });

  it('sequences: the k-th toy must match step k of the pattern', () => {
    const order: Order[] = [{ sequence: [{ toy: 'ball', props: { color: 'red' } }, { toy: 'ball', props: { color: 'blue' } }], count: 4, exact: true }];
    expect(check(order, deliver([redBall(), blueBall(), redBall(), blueBall()])).complete).toBe(true);
    const r = check(order, deliver([redBall(), redBall(), blueBall(), blueBall()]));
    expect(r.complete).toBe(false);
    expect(r.focus).toBe('order');
  });

  it('bays: a right toy in another sack gets a "which path" pointer', () => {
    const r = check([{ toy: 'ball', props: { color: 'red' }, count: 1, bay: 'A' }], deliver([redBall()], 'B'));
    expect(r.focus).toBe('bay');
    expect(r.reason.en).toMatch(/landed in sack B; the letter wants it in sack A/);
  });

  it('surprise orders take any toy; sticker/wrap "none" means without', () => {
    expect(check([{ toy: 'surprise', count: 1 }], deliver([item({})])).complete).toBe(true);
    const plain = lookOf(item({ shape: 'ball' }));
    const starred = lookOf(item({ shape: 'ball', sticker: 'star' }));
    expect(differences(plain, { toy: 'ball', props: { sticker: 'none' } })).toEqual([]);
    expect(differences(starred, { toy: 'ball', props: { sticker: 'none' } })).toEqual(['sticker']);
    expect(differences(starred, { toy: 'ball', props: { sticker: 'star' } })).toEqual([]);
  });

  it('assembled toys: part count and part colours', () => {
    const parts = (colors: string[]) => colors.map((c) => item({ shape: 'cube', color: c as never }));
    const tower = item({ toy: 'tower', n: 4, parts: parts(['red', 'blue', 'red', 'blue']) });
    expect(differences(lookOf(tower), { toy: 'tower', props: { n: 4, partColors: ['red', 'blue'] } })).toEqual([]);
    expect(differences(lookOf(tower), { toy: 'tower', props: { n: 5 } })).toEqual(['n']);
    expect(differences(lookOf(tower), { toy: 'tower', props: { partColors: ['blue', 'red'] } })).toEqual(['partColors']);
    expect(differences(lookOf(tower), { toy: 'train', props: { n: 4 } })).toEqual(['toy']);
  });
});
