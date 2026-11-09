/**
 * Shaper (Grelotte): carves a loose item into a shape. A cycle of shapes
 * (`shapes`) makes patterns. Assembled toys ride through untouched.
 */
import type { Shape } from '../types';
import { defineMachine, notFromFront } from './types';
import { obj, shape, single } from './dial';

export interface ShaperDial {
  [k: string]: unknown;
  shape?: Shape;
  shapes?: Shape[];
}

export const shaper = defineMachine<ShaperDial, { k: number }>({
  id: 'shaper',
  icon: '🔷',
  crew: 'grelotte',
  minBand: 'little',
  dial: {
    defaults: { shape: 'cube' },
    parse(raw) {
      const o = obj(raw, ['shape', 'shapes']);
      if (!o) return null;
      const cycle = single(o, 'shape', 'shapes', shape);
      if (!cycle) return null;
      return o.shape !== undefined ? { shape: cycle[0] } : { shapes: cycle };
    },
  },
  accepts: notFromFront,
  init: () => ({ k: 0 }),
  onEnter(st, item, d) {
    if (item.toy) return { item };
    const cycle = d.shapes ?? [d.shape as Shape];
    item.shape = cycle[st.k % cycle.length];
    st.k++;
    return { item };
  },
});
