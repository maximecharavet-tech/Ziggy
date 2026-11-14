import { describe, expect, it } from 'vitest';
import { SANTA_GIFTS } from '@/data/santa/gifts';
import { allTexts, MACHINE_TEXT } from './texts';
import { LINES, WRITERS, validateLines } from './lines';
import { LEVELS } from './levels';
import { TOYS, validateToys } from './toys';
import toysJson from '@/data/games/lutin-factory/toys.json';
import { phrase, surpriseName } from './names';
import { check } from './check';
import { suggestNextStep } from './hints';
import { startLayout } from './levels';
import { BANDS, COLORS, SHAPES, type L } from './types';

/** Child-facing words we never use (sad, scolding, failure). Matched as whole words, accents included. */
const BANNED = [
  'triste', 'tristes', 'nul', 'nulle', 'raté', 'ratée', 'rater', 'perdu', 'perdue', 'perdre', 'échec', 'échoué', 'mauvais', 'mauvaise',
  'méchant', 'méchante', 'puni', 'punie', 'erreur', 'faux', 'fausse', 'dommage', 'bêtise', 'interdit',
  'sad', 'fail', 'failed', 'failure', 'wrong', 'lost', 'lose', 'loser', 'bad', 'naughty', 'punished', 'mistake', 'error', 'incorrect', 'game over', 'too bad', 'try harder',
];
const WORD = /[a-zà-öø-ÿœæ'’-]+/gi;
function bannedIn(text: string): string[] {
  const lower = text.toLowerCase();
  const words = new Set(lower.match(WORD) ?? []);
  return BANNED.filter((b) => (b.includes(' ') ? lower.includes(b) : words.has(b)));
}

/** Every child-facing L in the game: texts, lines, writers, toys, level titles, letters, generated phrases. */
function everyText(): L[] {
  return [...allTexts(), ...generatedTexts()];
}

/** Texts shown as they are (data and generated sentences): no {placeholder} may be left. */
function generatedTexts(): L[] {
  const out: L[] = [];
  for (const l of LINES) out.push({ fr: l.fr, en: l.en });
  for (const w of WRITERS) out.push(w.name);
  for (const t of TOYS) out.push(t.name, t.plural);
  for (const lv of LEVELS) {
    out.push(lv.title, lv.newIdea);
    for (const band of BANDS) {
      const b = lv.bands[band];
      for (const l of b.letters) out.push(l.text);
      // Generated sentences: the start layout's check and hint, plus surprise names.
      out.push(check(b.orders, [], { ran: true }).reason);
      out.push(suggestNextStep(b, startLayout(b)).text);
    }
  }
  for (const t of TOYS) for (const c of COLORS) out.push(phrase({ toy: t.id, color: c }), phrase({ toy: t.id, color: c }, { count: 3 }));
  let id = 1;
  for (const s of SHAPES) for (const c of COLORS) out.push(surpriseName({ id: id++, material: 'felt', shape: s, color: c }));
  return out;
}

describe('texts', () => {
  it('every text exists in French and English (non-empty)', () => {
    for (const t of everyText()) {
      expect(t.fr.trim(), JSON.stringify(t)).not.toBe('');
      expect(t.en.trim(), JSON.stringify(t)).not.toBe('');
    }
    for (const t of generatedTexts()) expect(`${t.fr} ${t.en}`, JSON.stringify(t)).not.toMatch(/\{\w+\}/);
  });

  it('banned words never appear (no sad, scolding or failure words)', () => {
    const hits: string[] = [];
    for (const t of everyText()) for (const lang of ['fr', 'en'] as const) for (const w of bannedIn(t[lang])) hits.push(`${w}: ${t[lang]}`);
    expect(hits).toEqual([]);
  });

  it('the banned-word detector works (whole words, accents)', () => {
    expect(bannedIn('Oh non, c’est raté !')).toEqual(['raté']);
    expect(bannedIn('That was wrong.')).toEqual(['wrong']);
    expect(bannedIn('Game over!')).toEqual(['game over']);
    expect(bannedIn('Une balle nulle part')).toEqual(['nulle']);
    expect(bannedIn('annulé, badge, sadly-named bandit')).toEqual([]);
  });

  it('every machine has an article form for hints', () => {
    for (const [id, t] of Object.entries(MACHINE_TEXT)) expect(t.def.fr && t.def.en && t.indef.fr && t.indef.en, id).toBeTruthy();
  });

  it('lines.json: valid, every moment covered, only happy emotions and rig cues', () => {
    expect(validateLines()).toEqual([]);
  });

  it('toys.json: valid, and gift links point at the Santa catalogue', () => {
    expect(validateToys(toysJson)).toEqual([]);
    const giftIds = new Set(SANTA_GIFTS.map((g) => g.id));
    for (const t of TOYS) if (t.gift) expect(giftIds.has(t.gift), t.id).toBe(true);
  });

  it('French grammar: gender and plural agreement', () => {
    expect(phrase({ toy: 'ball', color: 'blue' }).fr).toBe('une balle bleue');
    expect(phrase({ toy: 'boat', color: 'blue' }).fr).toBe('un bateau bleu');
    expect(phrase({ toy: 'top', color: 'green' }, { count: 3 }).fr).toBe('3 toupies vertes');
    expect(phrase({ toy: 'train', color: 'purple', n: 3 }, { count: 2 }).fr).toBe('2 trains violets à 3 wagons');
    expect(phrase({ toy: 'star' }, { article: 'def' }).fr).toBe('l’étoile');
    expect(phrase({ toy: 'car', wrap: 'dots' }).fr).toBe('une voiture, emballée dans du papier à pois');
    expect(phrase({ toy: null, material: 'felt' }).fr).toBe('un petit bout de feutrine');
  });

  it('English grammar: a/an, plurals, word order', () => {
    expect(phrase({ toy: 'boat', color: 'orange' }).en).toBe('an orange boat');
    expect(phrase({ toy: 'train', color: 'red', n: 1 }).en).toBe('a red train with 1 wagon');
    expect(phrase({ toy: 'tower', n: 4 }, { count: 2 }).en).toBe('2 towers of 4 blocks');
    expect(phrase({ toy: 'ball', sticker: 'star' }).en).toBe('a ball with a star sticker');
  });

  it('surprise names are funny, stable and capitalised', () => {
    const a = surpriseName({ id: 1, material: 'wood', shape: 'wheel', color: 'purple' });
    const b = surpriseName({ id: 99, material: 'wood', shape: 'wheel', color: 'purple' });
    expect(a).toEqual(b);
    expect(a.fr).toMatch(/^La roue violette \S/);
    expect(a.en).toMatch(/^The \w+ purple wheel$/);
  });
});
