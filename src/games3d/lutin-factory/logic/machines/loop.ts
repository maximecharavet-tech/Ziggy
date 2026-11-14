/**
 * Repeat loop (7+): the item rides the little loop `times` times and an elf
 * copy comes out each lap: one item in, `times` identical items out.
 * Teaches loops and multiplication (2 rockets × repeat 5 = 10 rockets).
 */
import type { Item } from '../types';
import { defineMachine, notFromFront } from './types';
import { int, obj } from './dial';

export const LOOP_MAX = 20;

export interface LoopDial {
  [k: string]: unknown;
  times: number;
}

export const loop = defineMachine<LoopDial, { pending: number; model: Item | null }>({
  id: 'loop',
  icon: '🔁',
  crew: null,
  minBand: 'middle',
  dial: {
    defaults: { times: 2 },
    parse(raw) {
      const o = obj(raw, ['times']);
      const times = o ? int(o.times, 2, LOOP_MAX) : null;
      return times === null ? null : { times };
    },
  },
  accepts: notFromFront,
  init: () => ({ pending: 0, model: null }),
  canAccept: (st) => st.pending === 0,
  onEnter(st, item, d, ctx) {
    st.pending = d.times - 1;
    st.model = ctx.clone(item);
    return { item };
  },
  emit(st, _d, ctx) {
    if (st.pending <= 0 || !st.model) return null;
    st.pending--;
    const copy = ctx.clone(st.model);
    if (st.pending === 0) st.model = null;
    return { item: copy };
  },
  busy: (st) => st.pending > 0,
});
