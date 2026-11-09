/**
 * place: spatial vocabulary. little: in / on / under · middle: left / right /
 * behind / in front · big: a 3×3 shelf, two relations at once ("left of the
 * box, one shelf above").
 */
import { int, pick, shuffle } from '../rand';
import { FIX_TEXT, HINT, RELATION, fill } from '../texts';
import { the, word } from '../vocab';
import { defineFix, isStr, itemOf, type BasePuzzle } from './define';

export interface PlacePuzzle extends BasePuzzle {
  fix: 'place';
  item: string;
  anchor: string;
  /** little / middle: relation ids; big: cells "x,y" (anchor excluded). */
  options: string[];
  /** big: the anchor's cell on the 3×3 grid (x right, y up). */
  anchorCell: [number, number] | null;
  solution: string;
}

const LITTLE = ['in', 'on', 'under'];
const MIDDLE = ['left', 'right', 'behind', 'front'];

export const placeFix = defineFix<PlacePuzzle, string>({
  id: 'place',
  label: { fr: 'Bien placer', en: 'Put it in place' },
  icon: '📍',
  goal: 'spatial',
  params: { item: { type: 'string' }, anchor: { type: 'string' } },
  make(ctx) {
    const { band, rng } = ctx;
    const item = itemOf(ctx, 'teddy');
    const anchor = typeof ctx.params.anchor === 'string' ? ctx.params.anchor : 'box';
    const vars = { item: the(word(item)), anchor: the(word(anchor)) };
    if (band !== 'big') {
      const options = band === 'little' ? LITTLE : MIDDLE;
      const rel = pick(rng, options);
      return {
        fix: 'place',
        band,
        prompt: fill(FIX_TEXT.placeIt, { ...vars, relation: RELATION[rel] }),
        seconds: band === 'little' ? 10 : 12,
        goal: 'spatial',
        skill: 'vocabulary',
        item,
        anchor,
        options: shuffle(rng, options),
        anchorCell: null,
        solution: rel,
      };
    }
    const anchorCell: [number, number] = [1, 1];
    let dx = 0;
    let dy = 0;
    while (dx === 0 && dy === 0) {
      dx = int(rng, -1, 1);
      dy = int(rng, -1, 1);
    }
    const target = `${1 + dx},${1 + dy}`;
    const hRel = dx < 0 ? RELATION.left : dx > 0 ? RELATION.right : null;
    const vRel = dy > 0 ? { fr: 'une étagère au-dessus', en: 'one shelf above' } : dy < 0 ? { fr: 'une étagère en dessous', en: 'one shelf below' } : null;
    const prompt =
      hRel && vRel
        ? fill(FIX_TEXT.placeGrid, { ...vars, rel1: hRel, rel2: vRel })
        : hRel
          ? fill(FIX_TEXT.placeIt, { ...vars, relation: hRel })
          : fill(FIX_TEXT.placeIt, { ...vars, relation: dy > 0 ? RELATION.above : RELATION.below });
    const options: string[] = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (x !== 1 || y !== 1) options.push(`${x},${y}`);
    return { fix: 'place', band, prompt, seconds: 14, goal: 'spatial', skill: 'shapes', item, anchor, options, anchorCell, solution: target };
  },
  solve: (p) => p.solution,
  isAnswer: isStr,
  check(p, a) {
    if (a === p.solution) return { ok: true };
    return { ok: false, hints: [HINT.almost, HINT.lookAt], focus: [p.anchor] };
  },
  wrong: (p, rng) => pick(rng, p.options.filter((o) => o !== p.solution)),
});
