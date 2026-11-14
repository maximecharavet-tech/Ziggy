/** move-into: things end up somewhere silly (socks in the fridge). Params: `props`, `to` (slot). */
import { checkProps, checkSlot, definePrank, str, strs } from './define';

export const moveInto = definePrank({
  id: 'move-into',
  label: { fr: 'Déménagement rigolo', en: 'Silly move' },
  icon: '📦',
  fixes: ['count-back', 'place', 'sort', 'name-it'],
  props: (p) => strs(p, 'props'),
  validate(p, ctx) {
    const ids = strs(p, 'props');
    const to = str(p, 'to');
    const out = [...checkProps(ids, ctx), ...checkSlot(to, ctx, 'to')];
    for (const id of ids) if (ctx.state.props[id]?.slot === to) out.push(`prop "${id}" is already in "${to}"`);
    return out;
  },
  changes(state, p) {
    const to = str(p, 'to')!;
    return strs(p, 'props').map((id) => ({ prop: id, field: 'slot' as const, from: state.props[id].slot, to }));
  },
});
