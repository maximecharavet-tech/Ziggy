/** Painter (Pépin): one of the six paints, or a repeating cycle of paints (patterns). */
import type { Paint } from '../types';
import { defineMachine, notFromFront } from './types';
import { obj, paint, paintItem, single } from './dial';

export interface PainterDial {
  [k: string]: unknown;
  color?: Paint;
  colors?: Paint[];
}

export const painter = defineMachine<PainterDial, { k: number }>({
  id: 'painter',
  icon: '🖌️',
  crew: 'pepin',
  minBand: 'little',
  dial: {
    defaults: { color: 'red' },
    parse(raw) {
      const o = obj(raw, ['color', 'colors']);
      if (!o) return null;
      const cycle = single(o, 'color', 'colors', paint);
      if (!cycle) return null;
      return o.color !== undefined ? { color: cycle[0] } : { colors: cycle };
    },
  },
  accepts: notFromFront,
  init: () => ({ k: 0 }),
  onEnter(st, item, d) {
    const cycle = d.colors ?? [d.color as Paint];
    paintItem(item, cycle[st.k % cycle.length]);
    st.k++;
    return { item };
  },
});
