/**
 * Material chute (Pépin): drops `count` raw items, one per tick while its
 * tile is free. Gift mode: `items` is a repeating list of ready-made items
 * (the dispatch and paint rooms: mixed gifts to sort).
 */
import type { ItemSpec, Material } from '../types';
import { defineMachine, fromNoSide } from './types';
import { int, itemSpec, listOf, material, obj } from './dial';

export const CHUTE_MAX = 100;

export interface ChuteDial {
  [k: string]: unknown;
  material: Material;
  count: number;
  items?: ItemSpec[];
}

export const chute = defineMachine<ChuteDial, { emitted: number }>({
  id: 'chute',
  icon: '🛝',
  crew: 'pepin',
  minBand: 'little',
  dial: {
    defaults: { material: 'wood', count: 1 },
    parse(raw) {
      const o = obj(raw, ['material', 'count', 'items']);
      if (!o) return null;
      const m = o.material === undefined ? 'wood' : material(o.material);
      const count = o.count === undefined ? 1 : int(o.count, 0, CHUTE_MAX);
      if (!m || count === null) return null;
      const d: ChuteDial = { material: m, count };
      if (o.items !== undefined) {
        const items = listOf(o.items, itemSpec, 1, 8);
        if (!items) return null;
        d.items = items;
      }
      return d;
    },
  },
  accepts: fromNoSide,
  init: () => ({ emitted: 0 }),
  emit(st, d, ctx) {
    if (st.emitted >= d.count) return null;
    const spec: ItemSpec = d.items ? d.items[st.emitted % d.items.length] : {};
    st.emitted++;
    return { item: ctx.newItem({ material: d.material, ...spec }) };
  },
  busy: (st, d) => st.emitted < d.count,
});
