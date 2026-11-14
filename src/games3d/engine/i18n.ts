import { tr, type L } from '@/lib/i18n-text';

/**
 * Text helpers for game data. Every visible text is `L = { fr, en }` read
 * with `tr(l, locale)`; the 10 other site locales fall back to English like
 * the rest of the site. The canvas never draws text except label sprites
 * made from `L`; RTL (`ar`) only affects the React HUD.
 */

export { tr, type L };

export type GameLocale = 'fr' | 'en';

/** The text language for a site locale (fr → fr, everything else → en). */
export function gameLocale(locale: string): GameLocale {
  return locale === 'fr' ? 'fr' : 'en';
}

/** Is this a usable bilingual text (both strings non-empty)? */
export function isL(x: unknown): x is L {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.fr === 'string' && typeof o.en === 'string' && o.fr.trim() !== '' && o.en.trim() !== '';
}

/** Validator helper: an error message per problem, with the JSON path. */
export function checkL(x: unknown, path: string): string[] {
  if (isL(x)) return [];
  if (!x || typeof x !== 'object') return [`${path}: expected { fr, en } text`];
  const o = x as Record<string, unknown>;
  const errs: string[] = [];
  for (const k of ['fr', 'en'] as const) if (typeof o[k] !== 'string' || (o[k] as string).trim() === '') errs.push(`${path}.${k}: missing or empty`);
  return errs;
}

/** Fill `{name}` placeholders in both languages: `fmt({fr:'{n} chaussettes', en:'{n} socks'}, {n: 3})`. */
export function fmt(l: L, vars: Record<string, string | number | L>): L {
  const fill = (s: string, lang: GameLocale) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? (typeof vars[k] === 'object' ? (vars[k] as L)[lang] : String(vars[k])) : m));
  return { fr: fill(l.fr, 'fr'), en: fill(l.en, 'en') };
}

/** Join several texts into one (both languages), e.g. a hint after a praise. */
export function joinL(parts: L[], sep = ' '): L {
  return { fr: parts.map((p) => p.fr).join(sep), en: parts.map((p) => p.en).join(sep) };
}

/** Same text in both languages (numbers, names). */
export const same = (s: string): L => ({ fr: s, en: s });

/** Read a list of texts in a locale, dropping empty ones (for `speakSequence`). */
export function trAll(list: readonly L[], locale: string): string[] {
  return list.map((l) => tr(l, locale)).filter((s) => s.trim() !== '');
}
