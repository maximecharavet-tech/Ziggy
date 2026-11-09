/** recolour: things change colour (toothbrushes in the wrong cups' colours). Params: `props`, optional `color` or `colors`. */
import { pick } from '../rand';
import { BRIGHT, isColor } from '../vocab';
import { checkProps, definePrank, str, strs } from './define';

export const recolour = definePrank({
  id: 'recolour',
  label: { fr: 'Peinture surprise', en: 'Surprise paint' },
  icon: '🎨',
  fixes: ['sort', 'pattern', 'pair', 'name-it'],
  props: (p) => strs(p, 'props'),
  validate(p, ctx) {
    const ids = strs(p, 'props');
    const out = checkProps(ids, ctx);
    const one = str(p, 'color');
    const list = strs(p, 'colors');
    if (one && !isColor(one)) out.push(`unknown colour "${one}"`);
    if (p.colors !== undefined) {
      if (list.length !== ids.length) out.push('"colors" must give one colour per prop');
      for (const c of list) if (!isColor(c)) out.push(`unknown colour "${c}"`);
    }
    ids.forEach((id, i) => {
      const c = list[i] ?? one;
      if (c && ctx.state.props[id]?.color === c) out.push(`prop "${id}" is already ${c}`);
    });
    return out;
  },
  changes(state, p, rng) {
    const list = strs(p, 'colors');
    const one = str(p, 'color');
    return strs(p, 'props').map((id, i) => {
      const from = state.props[id].color;
      const to = list[i] ?? one ?? pick(rng, BRIGHT.filter((c) => c !== from));
      return { prop: id, field: 'color' as const, from, to };
    });
  },
});
