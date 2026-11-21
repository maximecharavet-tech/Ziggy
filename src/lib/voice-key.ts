/**
 * The key of a sentence in Ziggy's voice bank (pre-recorded clips in
 * public/voice, made offline by scripts/voice-bake.mjs).
 *
 * Pure and dependency-free: the bake script (Node, type stripping) and the
 * browser use the very same code, so a sentence shown on the site and the one
 * baked from the source give the same id.
 *
 * - `spokenText`: what the voice actually says (no emoji, no markdown marks),
 *   the same cleaning as /api/tts (`speakable` in src/lib/tts-gemini.ts).
 * - `bankKey`: `spokenText`, then case, apostrophes, quotes and French
 *   typographic spaces folded, so « Bravo ! » and "bravo!" share one clip.
 * - `clipId`: a 53-bit hash (14 hex digits) of style + language + key.
 *   Computed on the device; the text itself never leaves it.
 */

export type BankLang = 'fr' | 'en';
export type BankStyle = 'ziggy' | 'bedtime';

/** The text the voice says: emoji and markdown marks removed, spaces collapsed. */
export function spokenText(text: string): string {
  return text
    .replace(/[*_#`~>]/g, '')
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}|[\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The folded form two sentences that sound the same share. */
export function bankKey(text: string): string {
  return spokenText(text)
    .normalize('NFC')
    .toLowerCase()
    .replace(/[    ]/g, ' ')
    .replace(/[’‘`´ʼ]/g, "'")
    .replace(/[«»“”„"]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+([!?:;.,])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** cyrb53: a small, well-mixed 53-bit string hash. */
function cyrb53(s: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** The clip id of a sentence (14 hex digits), or null when nothing would be said. */
export function clipId(text: string, lang: BankLang, style: BankStyle = 'ziggy'): string | null {
  const key = bankKey(text);
  if (!/[\p{L}\p{N}]/u.test(key)) return null;
  return cyrb53(`${style}|${lang}|${key}`).toString(16).padStart(14, '0');
}

/** Bank language of a site locale: only French and English are recorded. */
export function bankLang(locale: string): BankLang | null {
  return locale === 'fr' ? 'fr' : locale === 'en' ? 'en' : null;
}
