/**
 * The decks of the memory boxes. Built from code rather than written out, so
 * they work in every language: numbers are universal, and the word deck pairs
 * a picture (dual coding) with a word in a second language.
 */

export type DeckId = 'times' | 'bonds' | 'words';

export interface MemoCard {
  id: string;
  /** What is shown: a sum, or an emoji. */
  prompt: string;
  /** The answer to recall. */
  answer: string;
  /** Numeric cards are answered on a keypad and checked automatically. */
  numeric: boolean;
}

/** Times tables 2 to 10, the classic. */
function times(): MemoCard[] {
  const out: MemoCard[] = [];
  for (let a = 2; a <= 10; a++) {
    for (let b = 2; b <= 10; b++) {
      if (b < a) continue; // 7 × 3 and 3 × 7 are one fact
      out.push({ id: `t${a}x${b}`, prompt: `${a} × ${b}`, answer: String(a * b), numeric: true });
    }
  }
  return out;
}

/** Number bonds: what makes 10, and what makes 20. */
function bonds(): MemoCard[] {
  const out: MemoCard[] = [];
  for (let a = 1; a <= 9; a++) out.push({ id: `b10-${a}`, prompt: `${a} + ? = 10`, answer: String(10 - a), numeric: true });
  for (let a = 11; a <= 19; a++) out.push({ id: `b20-${a}`, prompt: `${a} + ? = 20`, answer: String(20 - a), numeric: true });
  return out;
}

/** Picture words: [emoji, English, French]. */
export const WORDS: [string, string, string][] = [
  ['🐱', 'cat', 'chat'], ['🐶', 'dog', 'chien'], ['🐦', 'bird', 'oiseau'], ['🐟', 'fish', 'poisson'],
  ['🐴', 'horse', 'cheval'], ['🐮', 'cow', 'vache'], ['🐭', 'mouse', 'souris'], ['🐻', 'bear', 'ours'],
  ['🍎', 'apple', 'pomme'], ['🍌', 'banana', 'banane'], ['🍓', 'strawberry', 'fraise'], ['🍞', 'bread', 'pain'],
  ['🥛', 'milk', 'lait'], ['🧀', 'cheese', 'fromage'], ['🥚', 'egg', 'œuf'], ['🍰', 'cake', 'gâteau'],
  ['☀️', 'sun', 'soleil'], ['🌙', 'moon', 'lune'], ['⭐', 'star', 'étoile'], ['🌧️', 'rain', 'pluie'],
  ['🌳', 'tree', 'arbre'], ['🌸', 'flower', 'fleur'], ['🏠', 'house', 'maison'], ['🚗', 'car', 'voiture'],
  ['📚', 'book', 'livre'], ['✏️', 'pencil', 'crayon'], ['⚽', 'ball', 'ballon'], ['🎈', 'balloon', 'ballon de baudruche'],
  ['👟', 'shoe', 'chaussure'], ['🎩', 'hat', 'chapeau'], ['🔑', 'key', 'clé'], ['🕐', 'clock', 'horloge'],
  ['🤖', 'robot', 'robot'], ['🚀', 'rocket', 'fusée'], ['🌈', 'rainbow', 'arc-en-ciel'], ['❤️', 'heart', 'cœur'],
];

/** The second language: English for everyone, French for English speakers. */
export const wordLanguage = (locale: string) => (locale === 'en' ? 'fr' : 'en');

function words(locale: string): MemoCard[] {
  const fr = wordLanguage(locale) === 'fr';
  return WORDS.map(([emoji, en, frWord], i) => ({ id: `w${i}`, prompt: emoji, answer: fr ? frWord : en, numeric: false }));
}

export const DECKS: { id: DeckId; emoji: string; color: string }[] = [
  { id: 'times', emoji: '✖️', color: '#8B5CF6' },
  { id: 'bonds', emoji: '🔟', color: '#22C55E' },
  { id: 'words', emoji: '🗣️', color: '#F59E0B' },
];

export function buildDeck(id: DeckId, locale: string): MemoCard[] {
  if (id === 'times') return times();
  if (id === 'bonds') return bonds();
  return words(locale);
}

/** Lenient check for a typed or spoken answer: case, accents and spaces don't matter. */
export function sameAnswer(given: string, expected: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{L}\p{N}]/gu, '');
  return norm(given) !== '' && norm(given) === norm(expected);
}
