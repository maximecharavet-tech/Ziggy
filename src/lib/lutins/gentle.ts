import gentle from '@/data/lutins/gentle.json';

/**
 * Is a parent's prank idea gentle enough for the elves? Same word list and same
 * folding (lower case, no accents, whole words) as `rust/lutins-core/src/pranks.rs`
 * (a test compares the two). Returns the words that are not OK (empty = fine).
 */
const WORDS = new Set<string>(gentle.words);

export function gentleCheck(text: string): string[] {
  const tokens = text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/œ/g, 'o')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const found: string[] = [];
  for (const t of tokens) if (WORDS.has(t) && !found.includes(t)) found.push(t);
  return found;
}
