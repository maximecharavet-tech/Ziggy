/** multiply: suddenly too many (5 plates for 3 guests, a tower of ducks). Params: `prop`, `count` (new total, > now, ≤ 20). */
import { checkProps, definePrank, num, str } from './define';

export const MAX_MULTIPLY = 20;

export const multiply = definePrank({
  id: 'multiply',
  label: { fr: 'Ça se multiplie !', en: 'Multiplying!' },
  icon: '✖️',
  fixes: ['count-back', 'sort', 'order'],
  props: (p) => (str(p, 'prop') ? [str(p, 'prop')!] : []),
  validate(p, ctx) {
    const id = str(p, 'prop');
    const out = checkProps(id ? [id] : [], ctx, 'prop');
    const n = num(p, 'count');
    const cur = id ? ctx.state.props[id]?.count : undefined;
    if (n === undefined || !Number.isInteger(n)) out.push('"count" must be a whole number');
    else if (cur !== undefined && (n <= cur || n > MAX_MULTIPLY)) out.push(`"count" must be more than ${cur} and at most ${MAX_MULTIPLY}`);
    return out;
  },
  changes(state, p) {
    const id = str(p, 'prop')!;
    return [{ prop: id, field: 'count', from: state.props[id].count, to: num(p, 'count')! }];
  },
});
