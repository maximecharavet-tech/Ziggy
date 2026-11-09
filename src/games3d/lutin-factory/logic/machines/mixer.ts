/**
 * Colour mixer (Grelotte, 7+): two paint pots `a` + `b` → the mixed colour.
 * With only `a`, it mixes `a` into the item's current colour (so mixers can
 * be chained: red, + yellow = orange, + blue = brown).
 */
import type { Paint } from '../types';
import { mixColors } from '../colors';
import { defineMachine, notFromFront } from './types';
import { obj, paint, paintItem } from './dial';

export interface MixerDial {
  [k: string]: unknown;
  a: Paint;
  b?: Paint;
}

export const mixer = defineMachine<MixerDial, null>({
  id: 'mixer',
  icon: '🎨',
  crew: 'grelotte',
  minBand: 'middle',
  dial: {
    defaults: { a: 'red', b: 'yellow' },
    parse(raw) {
      const o = obj(raw, ['a', 'b']);
      if (!o) return null;
      const a = paint(o.a);
      if (!a) return null;
      if (o.b === undefined) return { a };
      const b = paint(o.b);
      return b ? { a, b } : null;
    },
  },
  accepts: notFromFront,
  init: () => null,
  onEnter(_st, item, d) {
    const c = d.b ? mixColors(d.a, d.b) : item.color ? mixColors(item.color, d.a) : d.a;
    paintItem(item, c);
    return { item };
  },
});
