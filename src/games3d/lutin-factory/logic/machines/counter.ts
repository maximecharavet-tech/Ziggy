/**
 * Counter gate (Noisette, 7+): counts the items going through.
 * mode "first": the first `n` go straight on, the rest turn right.
 * mode "every": every n-th item turns right (skip counting, modulo).
 */
import { defineMachine, notFromFront } from './types';
import { int, obj, oneOf } from './dial';

export interface CounterDial {
  [k: string]: unknown;
  n: number;
  mode: 'first' | 'every';
}

export const counter = defineMachine<CounterDial, { seen: number }>({
  id: 'counter',
  icon: '🔢',
  crew: 'noisette',
  minBand: 'middle',
  dial: {
    defaults: { n: 3, mode: 'every' },
    parse(raw) {
      const o = obj(raw, ['n', 'mode']);
      if (!o) return null;
      const n = int(o.n, 1, 50);
      const mode = o.mode === undefined ? 'every' : oneOf(o.mode, ['first', 'every'] as const);
      return n !== null && mode ? { n, mode } : null;
    },
  },
  accepts: notFromFront,
  init: () => ({ seen: 0 }),
  onEnter(st, item, d) {
    st.seen++;
    const turn = d.mode === 'first' ? st.seen > d.n : st.seen % d.n === 0;
    return { item, exit: turn ? 'right' : 'front' };
  },
});
