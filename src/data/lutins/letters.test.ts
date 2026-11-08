import { describe, expect, it } from 'vitest';
import { PRANKS } from './pranks';
import { GENERIC_NOTE, MORNING_NOTES, buildLetter, greeting, letterLines, morningNote } from './letters';

const BANNED = /\b(sage|pas sage|vilain|méchant|naughty|nice list|be good|sois gentil|sinon|or else|punition|punish|triste|sad|pleure|cry)\b/i;

describe('elves’ letters', () => {
  it('has a FR + EN morning note for every prank of the catalogue', () => {
    for (const p of PRANKS) {
      const n = MORNING_NOTES[p.id];
      expect(n, p.id).toBeTruthy();
      expect(n.fr.trim().length, p.id).toBeGreaterThan(20);
      expect(n.en.trim().length, p.id).toBeGreaterThan(20);
      expect(n.fr).not.toBe(n.en);
    }
    // No orphan note (a renamed prank would silently lose its note).
    for (const id of Object.keys(MORNING_NOTES)) expect(PRANKS.some((p) => p.id === id), id).toBe(true);
  });

  it('falls back to the generic note for own ideas and unknown ids', () => {
    expect(morningNote(null)).toBe(GENERIC_NOTE);
    expect(morningNote('does-not-exist')).toBe(GENERIC_NOTE);
    expect(morningNote('bulles')).toBe(MORNING_NOTES.bulles);
  });

  it('notes are short enough to read aloud and never name a single elf', () => {
    for (const [id, n] of Object.entries(MORNING_NOTES)) {
      expect(n.fr.length, id).toBeLessThan(130);
      expect(n.en.length, id).toBeLessThan(130);
      expect(`${n.fr} ${n.en}`, id).not.toMatch(/Pépin|Grelotte|Noisette|Pip|Jingle|Hazel/);
    }
  });

  it('is always positive: no behaviour conditions, no sadness', () => {
    const all = [...Object.values(MORNING_NOTES), GENERIC_NOTE].flatMap((n) => [n.fr, n.en]);
    for (const kind of ['arrival', 'departure', 'morning'] as const) for (const loc of ['fr', 'en']) all.push(...letterLines(buildLetter(kind, loc, { name: 'Léa' })));
    for (const s of all) expect(s, s).not.toMatch(BANNED);
  });

  it('personalises with the first name, and works without one', () => {
    expect(greeting('Léa', 'fr')).toBe('Coucou Léa !');
    expect(greeting('Tom', 'en')).toBe('Hello Tom!');
    expect(greeting(null, 'fr')).toBe('Coucou !');
    expect(greeting('  ', 'en')).toBe('Hello!');
    const a = buildLetter('arrival', 'fr', { name: 'Léa' });
    expect(a.title).toMatch(/Pôle Nord/);
    expect(a.greeting).toContain('Léa');
    expect(a.elves).toEqual(['pepin', 'grelotte', 'noisette']);
    expect(buildLetter('departure', 'en').title).toMatch(/next year/);
  });

  it('a morning note is signed only by the elves who did the prank', () => {
    const m = buildLetter('morning', 'en', { prankId: 'cinema', elves: ['noisette', 'pepin'] });
    expect(m.elves).toEqual(['pepin', 'noisette']);
    expect(m.paragraphs[0]).toBe(MORNING_NOTES.cinema.en);
    expect(buildLetter('morning', 'fr', { prankId: null, elves: [] }).elves).toHaveLength(3);
  });
});
