/** hide: things tucked away (the drum inside the piano, letters in the pages). Params: `props`, `in` (slot). */
import type { Change } from '../types';
import { checkProps, checkSlot, definePrank, str, strs } from './define';

export const hide = definePrank({
  id: 'hide',
  label: { fr: 'Cache-cache des objets', en: 'Hide-and-seek things' },
  icon: '🙈',
  fixes: ['path', 'name-it', 'place', 'count-back'],
  props: (p) => strs(p, 'props'),
  validate(p, ctx) {
    const ids = strs(p, 'props');
    const into = str(p, 'in');
    const out = [...checkProps(ids, ctx), ...checkSlot(into, ctx, 'in')];
    for (const id of ids) if (ctx.state.props[id]?.hidden) out.push(`prop "${id}" is already hidden`);
    return out;
  },
  changes(state, p) {
    const into = str(p, 'in')!;
    const out: Change[] = [];
    for (const id of strs(p, 'props')) {
      const cur = state.props[id];
      if (cur.slot !== into) out.push({ prop: id, field: 'slot', from: cur.slot, to: into });
      out.push({ prop: id, field: 'hidden', from: false, to: true });
    }
    return out;
  },
});
