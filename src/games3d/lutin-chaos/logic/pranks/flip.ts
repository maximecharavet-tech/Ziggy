/** flip: things turned around (books upside down, the star on its head). Params: `props`, `turns` 1–3 quarter turns (default 2). */
import type { Rot } from '../types';
import { checkProps, definePrank, num, strs } from './define';

const turnsOf = (p: Record<string, unknown>) => num(p, 'turns') ?? 2;

export const flip = definePrank({
  id: 'flip',
  label: { fr: 'La tête à l’envers', en: 'Topsy-turvy' },
  icon: '🙃',
  fixes: ['rotate', 'order', 'pattern'],
  props: (p) => strs(p, 'props'),
  validate(p, ctx) {
    const out = checkProps(strs(p, 'props'), ctx);
    const t = turnsOf(p);
    if (!Number.isInteger(t) || t < 1 || t > 3) out.push('"turns" must be 1, 2 or 3');
    return out;
  },
  changes(state, p) {
    const t = turnsOf(p);
    return strs(p, 'props').map((id) => {
      const from = state.props[id].rot;
      return { prop: id, field: 'rot' as const, from, to: ((from + t) % 4) as Rot };
    });
  },
});
