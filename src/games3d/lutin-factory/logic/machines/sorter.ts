/**
 * Sorter (Noisette, 7+): IF the item matches the test (colour, shape, toy,
 * sticker, wrapping, material) it turns LEFT, ELSE it turns RIGHT.
 */
import type { Color, Material, Pattern, Shape, Sticker } from '../types';
import { identifyToy, isToyId } from '../toys';
import { defineMachine, notFromFront } from './types';
import { color, material, obj, pattern, shape, sticker } from './dial';

export interface SorterDial {
  [k: string]: unknown;
  color?: Color;
  shape?: Shape;
  toy?: string;
  sticker?: Sticker;
  wrap?: Pattern;
  material?: Material;
}

const TESTS = ['color', 'shape', 'toy', 'sticker', 'wrap', 'material'] as const;

export const sorter = defineMachine<SorterDial, null>({
  id: 'sorter',
  icon: '🔀',
  crew: 'noisette',
  minBand: 'middle',
  dial: {
    defaults: { color: 'red' },
    parse(raw) {
      const o = obj(raw, TESTS);
      if (!o || Object.keys(o).length === 0) return null;
      const d: SorterDial = {};
      if (o.color !== undefined && !(d.color = color(o.color) ?? undefined)) return null;
      if (o.shape !== undefined && !(d.shape = shape(o.shape) ?? undefined)) return null;
      if (o.sticker !== undefined && !(d.sticker = sticker(o.sticker) ?? undefined)) return null;
      if (o.wrap !== undefined && !(d.wrap = pattern(o.wrap) ?? undefined)) return null;
      if (o.material !== undefined && !(d.material = material(o.material) ?? undefined)) return null;
      if (o.toy !== undefined) {
        if (!isToyId(o.toy)) return null;
        d.toy = o.toy;
      }
      return d;
    },
  },
  accepts: notFromFront,
  init: () => null,
  onEnter(_st, item, d) {
    const match =
      (d.color === undefined || item.color === d.color) &&
      (d.shape === undefined || item.shape === d.shape) &&
      (d.sticker === undefined || item.sticker === d.sticker) &&
      (d.wrap === undefined || item.wrap === d.wrap) &&
      (d.material === undefined || item.material === d.material) &&
      (d.toy === undefined || identifyToy(item) === d.toy);
    return { item, exit: match ? 'left' : 'right' };
  },
});
