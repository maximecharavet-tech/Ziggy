/**
 * name-it: vocabulary. little: "where is the whisk?" with 3 pictures ·
 * middle: 4 pictures, the word is shown · big: second-language mode (the word
 * is given in the other language: a French child finds "whisk").
 */
import { pick, sample, shuffle } from '../rand';
import { FIX_TEXT, HINT, fill } from '../texts';
import { the, WORDS, wordById, type Word } from '../vocab';
import { defineFix, isStr, itemOf, type BasePuzzle } from './define';

export interface NameItPuzzle extends BasePuzzle {
  fix: 'name-it';
  target: string;
  choices: string[];
  /** big: the prompt shows the word in the other language. */
  secondLanguage: boolean;
  solution: string;
}

/** No two choices may share a picture or a name in either language. */
function distinct(words: Word[]): boolean {
  const keys = words.flatMap((x) => [`e:${x.emoji}`, `f:${x.fr}`, `n:${x.en}`]);
  return new Set(keys).size === keys.length;
}

export const nameItFix = defineFix<NameItPuzzle, string>({
  id: 'name-it',
  label: { fr: 'Trouve le mot', en: 'Name it' },
  icon: '🗣️',
  goal: 'vocabulary',
  params: { item: { type: 'string' }, words: { type: 'string[]' } },
  make(ctx) {
    const { band, rng } = ctx;
    const k = band === 'little' ? 3 : 4;
    const listed = Array.isArray(ctx.params.words) ? (ctx.params.words as string[]).map((id) => wordById(id)).filter((x): x is Word => !!x) : [];
    const roomWords = (ctx.roomWords ?? []).map((id) => wordById(id)).filter((x): x is Word => !!x);
    const target = wordById(itemOf(ctx, listed[0]?.id ?? roomWords[0]?.id ?? 'whisk')) ?? pick(rng, WORDS);
    // distractors: the listed words, then the room's, then the same category, then anything
    const pools = [listed, roomWords, WORDS.filter((x) => x.cat === target.cat), WORDS];
    let chosen: Word[] = [target];
    for (const pool of pools) {
      for (const cand of shuffle(rng, pool)) {
        if (chosen.length >= k) break;
        if (distinct([...chosen, cand])) chosen.push(cand);
      }
    }
    chosen = chosen.slice(0, k);
    const secondLanguage = band === 'big';
    const prompt =
      band === 'little'
        ? fill(FIX_TEXT.nameFind, { item: the(target) })
        : secondLanguage
          ? fill(FIX_TEXT.nameWord, { word: { fr: target.en, en: target.fr } })
          : fill(FIX_TEXT.nameWord, { word: { fr: target.fr, en: target.en } });
    return {
      fix: 'name-it',
      band,
      prompt,
      seconds: band === 'little' ? 10 : band === 'middle' ? 12 : 14,
      goal: 'vocabulary',
      skill: 'vocabulary',
      target: target.id,
      choices: shuffle(rng, chosen.map((x) => x.id)),
      secondLanguage,
      solution: target.id,
    };
  },
  solve: (p) => p.solution,
  isAnswer: isStr,
  check(p, a) {
    if (a === p.solution) return { ok: true };
    return { ok: false, hints: [HINT.almost, HINT.lookAt], focus: [a] };
  },
  wrong: (p, rng) => sample(rng, p.choices.filter((c) => c !== p.solution), 1)[0],
});
