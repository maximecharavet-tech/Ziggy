/** Sticker stamper (Noisette): presses a sticker (star, heart, moon, snowflake) on the item. */
import type { Sticker } from '../types';
import { defineMachine, notFromFront } from './types';
import { obj, sticker } from './dial';

export interface StamperDial {
  [k: string]: unknown;
  sticker: Sticker;
}

export const stamper = defineMachine<StamperDial, null>({
  id: 'stamper',
  icon: '⭐',
  crew: 'noisette',
  minBand: 'little',
  dial: {
    defaults: { sticker: 'star' },
    parse(raw) {
      const o = obj(raw, ['sticker']);
      const s = o ? sticker(o.sticker) : null;
      return s ? { sticker: s } : null;
    },
  },
  accepts: notFromFront,
  init: () => null,
  onEnter(_st, item, d) {
    item.sticker = d.sticker;
    return { item };
  },
});
