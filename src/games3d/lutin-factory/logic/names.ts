/**
 * Toy phrases with real grammar (French gender/number agreement, English
 * a/an) and the funny generated names of surprise toys ("La roue violette
 * rigolote" / "The giggly purple wheel"). Pure; the adjective is picked by the
 * kit's seeded rng from the toy's look, so the same toy always gets the same
 * name (the Catalogue stays stable).
 */
import { rng } from '@/games3d/kit/rng';
import type { Color, Item, L, Material, OrderSpec, Pattern, Shape, Sticker } from './types';
import { getToy, identifyToy } from './toys';
import { COLOR_NAMES, GRAMMAR, MATERIAL_NAMES, PATTERN_NAMES, RAW_NOUN, SHAPE_NAMES, STICKER_NAMES, SURPRISE_ADJECTIVES } from './texts';
import { fnv1a } from './simulator';

/** What a toy looks like (from a delivered item, or wanted by an order). */
export interface Look {
  /** Toy id, `'surprise'`, or null for a shape / a lump of material that is no toy. */
  toy: string | null;
  shape?: Shape;
  material?: Material;
  color?: Color;
  sticker?: Sticker;
  wrap?: Pattern;
  n?: number;
  partColors?: Color[];
}

export function lookOf(item: Item): Look {
  const look: Look = { toy: identifyToy(item), material: item.material };
  if (item.shape) look.shape = item.shape;
  if (item.color) look.color = item.color;
  if (item.sticker) look.sticker = item.sticker;
  if (item.wrap) look.wrap = item.wrap;
  if (item.n !== undefined) look.n = item.n;
  if (item.parts && item.parts.length) {
    const pc = item.parts.map((p) => p.color);
    if (pc.every((c): c is Color => !!c)) look.partColors = pc;
  }
  return look;
}

export function lookOfSpec(spec: OrderSpec): Look {
  const p = spec.props ?? {};
  const look: Look = { toy: spec.toy };
  if (p.color) look.color = p.color;
  if (p.material) look.material = p.material;
  if (p.sticker && p.sticker !== 'none') look.sticker = p.sticker;
  if (p.wrap && p.wrap !== 'none') look.wrap = p.wrap;
  if (p.n !== undefined) look.n = p.n;
  if (p.partColors) look.partColors = p.partColors;
  return look;
}

interface Noun {
  fr: string;
  frPlural: string;
  gender: 'm' | 'f';
  en: string;
  enPlural: string;
}

function nounOf(look: Look): Noun {
  if (look.toy === 'surprise') return { fr: 'surprise', frPlural: 'surprises', gender: 'f', en: 'surprise', enPlural: 'surprises' };
  const toy = look.toy ? getToy(look.toy) : undefined;
  if (toy) return { fr: toy.name.fr, frPlural: toy.plural.fr, gender: toy.gender, en: toy.name.en, enPlural: toy.plural.en };
  if (look.shape) return SHAPE_NAMES[look.shape];
  const m = MATERIAL_NAMES[look.material ?? 'wood'];
  return {
    fr: RAW_NOUN.fr.replace('{material}', m.fr),
    frPlural: RAW_NOUN.frPlural.replace('{material}', m.fr),
    gender: RAW_NOUN.gender,
    en: RAW_NOUN.en.replace('{material}', m.en),
    enPlural: RAW_NOUN.enPlural.replace('{material}', m.en),
  };
}

const startsWithVowelFr = (s: string) => /^[aeiouyhéèêàâîôûœ]/i.test(s);
const startsWithVowelEn = (s: string) => /^[aeiou]/i.test(s);
export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export interface PhraseOptions {
  article?: 'indef' | 'def' | 'none';
  /** Number of toys (FR/EN plural agreement); shown as a digit. */
  count?: number;
  /** Extra adjective (surprise names). */
  adjective?: { fr: { m: string; f: string }; en: string };
}

/** "une balle rouge" / "a red ball", "3 trains bleus à 4 wagons" / "3 blue trains with 4 wagons". */
export function phrase(look: Look, opts: PhraseOptions = {}): L {
  const noun = nounOf(look);
  const plural = opts.count !== undefined && opts.count > 1;
  const g = noun.gender;
  const key = (plural ? (g === 'm' ? 'mp' : 'fp') : g) as 'm' | 'f' | 'mp' | 'fp';

  // French: [article] noun [colour] [adjective] [n] [sticker] [wrapping]
  const fr: string[] = [noun[plural ? 'frPlural' : 'fr']];
  if (look.color) fr.push(COLOR_NAMES[look.color].fr[key]);
  if (opts.adjective) fr.push(plural ? `${opts.adjective.fr[g]}s` : opts.adjective.fr[g]);
  // English: [article] [adjective] [colour] noun [n] [sticker] [wrapping]
  const en: string[] = [];
  if (opts.adjective) en.push(opts.adjective.en);
  if (look.color) en.push(COLOR_NAMES[look.color].en);
  en.push(noun[plural ? 'enPlural' : 'en']);

  const toy = look.toy ? getToy(look.toy) : undefined;
  if (toy?.n && look.n !== undefined) {
    const i = look.n > 1 ? 1 : 0;
    fr.push(`${toy.n.join.fr} ${look.n} ${toy.n.unit.fr[i]}`);
    en.push(`${toy.n.join.en} ${look.n} ${toy.n.unit.en[i]}`);
  }
  if (look.sticker) {
    fr.push(`${GRAMMAR.with.fr} ${STICKER_NAMES[look.sticker].fr}`);
    en.push(`${GRAMMAR.with.en} ${STICKER_NAMES[look.sticker].en}`);
  }
  let frText = fr.join(' ');
  let enText = en.join(' ');
  if (look.wrap) {
    const w = GRAMMAR.wrapped.fr[g] + (plural ? 's' : '');
    frText += `, ${w} ${PATTERN_NAMES[look.wrap].paper.fr}`;
    enText += `, ${GRAMMAR.wrapped.en} ${PATTERN_NAMES[look.wrap].paper.en}`;
  }

  const article = opts.article ?? 'indef';
  if (plural) return { fr: `${opts.count} ${frText}`, en: `${opts.count} ${enText}` };
  if (article === 'indef') {
    return {
      fr: `${GRAMMAR.indef[g]} ${frText}`,
      en: `${startsWithVowelEn(enText) ? GRAMMAR.indef.enVowel : GRAMMAR.indef.en} ${enText}`,
    };
  }
  if (article === 'def') {
    return {
      fr: startsWithVowelFr(frText) ? `${GRAMMAR.def.elided}${frText}` : `${GRAMMAR.def[g]} ${frText}`,
      en: `${GRAMMAR.def.en} ${enText}`,
    };
  }
  return { fr: frText, en: enText };
}

/** Stable funny name for the surprise shelf / Catalogue. */
export function surpriseName(item: Item): L {
  const look = lookOf(item);
  const signature = JSON.stringify({ ...look, partColors: undefined });
  const seed = parseInt(fnv1a(signature), 16);
  const adjective = SURPRISE_ADJECTIVES[Math.floor(rng(seed)() * SURPRISE_ADJECTIVES.length)];
  const p = phrase(look, { article: 'def', adjective });
  return { fr: capitalize(p.fr), en: capitalize(p.en) };
}
