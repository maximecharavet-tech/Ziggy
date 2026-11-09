/**
 * Assembler (Grelotte): collects the parts of its toy (the dial: `toy`, and
 * `n` for toys with a variable part like train wagons) and puts the toy
 * together as soon as a full set is in its basket. Parts for later toys wait
 * in the basket (nothing is lost); items that are not parts of this toy ride
 * straight through.
 */
import type { Item } from '../types';
import { clampN, fitsPart, getToy, recipe } from '../toys';
import { defineMachine, notFromFront } from './types';
import { commonColor, int, obj } from './dial';

export const BASKET_MAX = 60;

export interface AssemblerDial {
  [k: string]: unknown;
  toy: string;
  n?: number;
}

export const assembler = defineMachine<AssemblerDial, { basket: Item[] }>({
  id: 'assembler',
  icon: '🔧',
  crew: 'grelotte',
  minBand: 'little',
  dial: {
    defaults: { toy: 'train', n: 3 },
    parse(raw) {
      const o = obj(raw, ['toy', 'n']);
      if (!o || typeof o.toy !== 'string') return null;
      const toy = getToy(o.toy);
      if (!toy || toy.parts.length === 1 && toy.parts[0].count === 1) return null;
      if (!toy.n) return o.n === undefined ? { toy: toy.id } : null;
      const n = o.n === undefined ? toy.n.default : int(o.n, toy.n.min, toy.n.max);
      return n === null ? null : { toy: toy.id, n };
    },
  },
  accepts: notFromFront,
  init: () => ({ basket: [] }),
  onEnter(st, item, d, ctx) {
    const toy = getToy(d.toy);
    if (!toy) return { item };
    const parts = recipe(toy, d.n);
    if (!parts.some((p) => fitsPart(item, p)) || st.basket.length >= BASKET_MAX) return { item };
    st.basket.push(item);
    // A full set? Take the oldest matching parts, role by role.
    const used = new Set<number>();
    const chosen: Item[] = [];
    for (const p of parts) {
      let need = p.count;
      for (const b of st.basket) {
        if (need === 0) break;
        if (!used.has(b.id) && fitsPart(b, p)) {
          used.add(b.id);
          chosen.push(b);
          need--;
        }
      }
      if (need > 0) return null; // keep collecting
    }
    st.basket = st.basket.filter((b) => !used.has(b.id));
    const built = ctx.newItem({ material: chosen[0].material, toy: toy.id, parts: chosen });
    if (toy.n) built.n = clampN(toy, d.n);
    const c = commonColor(chosen);
    if (c) built.color = c;
    return { item: built };
  },
  busy: (st) => st.basket.length > 0,
});
