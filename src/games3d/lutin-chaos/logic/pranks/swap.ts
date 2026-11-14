/** swap: two things trade places (boots left/right, coats on the wrong hooks). Params: `pairs` [[a, b], …]. */
import type { Change } from '../types';
import { definePrank, type Params } from './define';

function pairsOf(p: Params): [string, string][] {
  const v = p.pairs;
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is [string, string] => Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && typeof x[1] === 'string');
}

export const swap = definePrank({
  id: 'swap',
  label: { fr: 'Grand échange', en: 'Big swap' },
  icon: '🔀',
  fixes: ['pair', 'order', 'sort', 'place'],
  props: (p) => pairsOf(p).flat(),
  validate(p, ctx) {
    const pairs = pairsOf(p);
    if (pairs.length === 0 || (Array.isArray(p.pairs) && pairs.length !== p.pairs.length)) return ['"pairs" must be a list of [propA, propB]'];
    const out: string[] = [];
    const ids = pairs.flat();
    if (new Set(ids).size !== ids.length) out.push('a prop is in two swaps');
    for (const [a, b] of pairs) {
      const pa = ctx.state.props[a];
      const pb = ctx.state.props[b];
      if (!pa || !pb) out.push(`unknown prop in swap [${a}, ${b}]`);
      else if (pa.slot === pb.slot) out.push(`swap [${a}, ${b}] changes nothing (same slot)`);
    }
    return out;
  },
  changes(state, p) {
    const out: Change[] = [];
    for (const [a, b] of pairsOf(p)) {
      const sa = state.props[a].slot;
      const sb = state.props[b].slot;
      out.push({ prop: a, field: 'slot', from: sa, to: sb }, { prop: b, field: 'slot', from: sb, to: sa });
    }
    return out;
  },
});
