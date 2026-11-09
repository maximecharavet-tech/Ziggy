/** Wrapper (Noisette): wraps the toy in paper; one pattern or a repeating cycle of patterns. */
import type { Pattern } from '../types';
import { defineMachine, notFromFront } from './types';
import { obj, pattern, single } from './dial';

export interface WrapperDial {
  [k: string]: unknown;
  pattern?: Pattern;
  patterns?: Pattern[];
}

export const wrapper = defineMachine<WrapperDial, { k: number }>({
  id: 'wrapper',
  icon: '🎁',
  crew: 'noisette',
  minBand: 'little',
  dial: {
    defaults: { pattern: 'stripes' },
    parse(raw) {
      const o = obj(raw, ['pattern', 'patterns']);
      if (!o) return null;
      const cycle = single(o, 'pattern', 'patterns', pattern);
      if (!cycle) return null;
      return o.pattern !== undefined ? { pattern: cycle[0] } : { patterns: cycle };
    },
  },
  accepts: notFromFront,
  init: () => ({ k: 0 }),
  onEnter(st, item, d) {
    const cycle = d.patterns ?? [d.pattern as Pattern];
    item.wrap = cycle[st.k % cycle.length];
    st.k++;
    return { item };
  },
});
