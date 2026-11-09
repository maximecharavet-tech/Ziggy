import { describe, expect, it } from 'vitest';
import lines from '@/data/games/lutin-chaos/lines.json';
import { CLUES } from './clues';
import { FIX_IDS, FIXES, makePuzzle } from './fixes';
import { GOAL_BY_BAND } from './goals';
import { LINES, MOMENTS, linesFor, validateLines } from './lines';
import { PRANK_TYPES } from './pranks';
import { makeRng } from './rand';
import { RAW_ROOMS } from './rooms';
import * as T from './texts';
import { BANDS, ELF_IDS, FACES, ZIGGY_CUES } from './types';
import { COLORS, SHAPES, WORDS } from './vocab';

/** Words children must never hear or read in this game (sad, scolding, failure). */
const BANNED = [
  'triste', 'tristesse', 'nul', 'nulle', 'raté', 'ratée', 'rater', 'perdu', 'perdue', 'perdre', 'échec', 'échoué', 'méchant', 'méchante', 'puni', 'punie', 'punition',
  'vilain', 'faux', 'fausse', 'erreur', 'mauvais', 'mauvaise', 'bête', 'idiot', 'dommage', 'pleure',
  'sad', 'fail', 'failed', 'failure', 'wrong', 'lost', 'lose', 'loser', 'naughty', 'punished', 'punish', 'bad', 'mistake', 'stupid', 'silly you', 'cry', 'game over', 'too bad',
];
const bannedRe = new RegExp(`(?<![\\p{L}])(${BANNED.map((w) => w.replace(/ /g, '\\s+')).join('|')})(?![\\p{L}])`, 'iu');

/** Every {fr, en} object found anywhere in a value. */
function collectL(v: unknown, out: { fr: string; en: string }[] = []): { fr: string; en: string }[] {
  if (Array.isArray(v)) v.forEach((x) => collectL(x, out));
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.fr === 'string' && typeof o.en === 'string') out.push({ fr: o.fr, en: o.en });
    for (const x of Object.values(o)) collectL(x, out);
  }
  return out;
}

const STATIC_TEXTS = [
  T.GAME_TITLE,
  ...Object.values(T.UI),
  ...T.PRAISE,
  ...Object.values(T.HINT),
  ...T.ELF_BLAME,
  ...Object.values(T.RELATION),
  ...Object.values(T.DIRECTION).map((d) => d.name),
  ...T.DAYS,
  ...T.ORDINALS,
  ...T.SIZE_WORDS,
  ...Object.values(T.FIX_TEXT),
  ...ELF_IDS.map(T.elfName),
  ...CLUES.flatMap((c) => [c.label, c.reason]),
  ...Object.values(PRANK_TYPES).map((p) => p.label),
  ...FIX_IDS.map((f) => FIXES[f].label),
  ...COLORS.map((c) => c.name),
  ...SHAPES.map((s) => s.name),
  ...WORDS.flatMap((w) => [{ fr: w.fr, en: w.en }, { fr: w.frPl, en: w.enPl }, { fr: w.frDef, en: w.en }]),
  ...collectL(GOAL_BY_BAND),
];

function generatedPrompts() {
  const out: { fr: string; en: string }[] = [];
  for (const f of FIX_IDS)
    for (const band of BANDS)
      for (let seed = 0; seed < 40; seed++)
        for (const params of [{}, { mode: 'share' }, { mode: 'extra' }, { by: 'days' }, { by: 'skip' }, { theme: 'numbers' }]) {
          try {
            out.push(makePuzzle(f, { band, rng: makeRng(seed), params: params as Record<string, unknown> }).prompt);
          } catch {
            /* params not for this fix: skipped */
          }
        }
  return out;
}

describe('texts FR + EN and child-safe wording', () => {
  it('every static text, line and room text has French and English', () => {
    const all = [...STATIC_TEXTS, ...LINES.map((l) => l.text), ...collectL(RAW_ROOMS)];
    expect(all.length).toBeGreaterThan(500);
    for (const t of all) {
      expect(t.fr.trim(), JSON.stringify(t)).not.toBe('');
      expect(t.en.trim(), JSON.stringify(t)).not.toBe('');
    }
  });

  it('lines.json is valid: ids, speakers, moments, happy faces and cues only', () => {
    expect(lines.schema).toBe('ziggy.lines/1');
    expect(validateLines(LINES)).toEqual([]);
    for (const l of LINES) {
      expect(FACES).toContain(l.face);
      if (l.cue) expect(ZIGGY_CUES).toContain(l.cue);
    }
  });

  it('every moment has lines; elf moments have lines for each elf', () => {
    for (const m of MOMENTS) expect(linesFor(m).length, m).toBeGreaterThan(0);
    for (const m of ['caught', 'not-me', 'peek', 'fix-oops', 'finale-start', 'photo'] as const)
      for (const e of ELF_IDS) expect(linesFor(m, e).length, `${m} ${e}`).toBeGreaterThan(0);
    for (const e of ELF_IDS) expect(linesFor('caught', e).length).toBeGreaterThanOrEqual(3);
  });

  it('when a fix goes "almost", the elf takes the blame — never the child', () => {
    for (const e of ELF_IDS) for (const l of linesFor('fix-oops', e)) expect(l.text.fr.toLowerCase()).toMatch(/ma faute|moi|mon|pardon/);
    for (const b of T.ELF_BLAME) expect(b.en.toLowerCase()).toMatch(/my |me|sorry|on me/);
  });

  it('no banned word anywhere (static texts, lines, rooms, generated puzzle prompts)', () => {
    const all = [...STATIC_TEXTS, ...LINES.map((l) => l.text), ...collectL(RAW_ROOMS), ...generatedPrompts()];
    const hits = all.flatMap((t) => [t.fr, t.en]).filter((s) => bannedRe.test(s));
    expect(hits).toEqual([]);
  });

  it('the banned-word check really bites', () => {
    for (const s of ['Tu as raté !', 'Wrong answer', 'Game over', 'You lost', 'C’est faux', 'Oh, so sad']) expect(bannedRe.test(s), s).toBe(true);
    for (const s of ['Presque !', 'Almost!', 'badge', 'Lostine', 'Badaboum']) expect(bannedRe.test(s), s).toBe(false);
  });

  it('fill replaces placeholders and contracts French articles', () => {
    expect(T.fill({ fr: 'Mets {item} à gauche de {anchor}', en: 'Put {item} to the left of {anchor}' }, { item: { fr: 'le doudou', en: 'the teddy' }, anchor: { fr: 'le carton', en: 'the box' } })).toEqual({
      fr: 'Mets le doudou à gauche du carton',
      en: 'Put the teddy to the left of the box',
    });
  });
});
