import { describe, expect, it } from 'vitest';
import { ALL_TEMPLATES, buildStory, ENDINGS, GOODNIGHTS, LEADS, LINKS, OPENINGS, pageText, QUIET, REACTIONS, SLEEPY, SNUGGLES, storySeed, TITLES, type StoryFamily } from './story';
import { ALBUM_TEXT, EMPTY_LINES, HELLO_LINES, STICKER_LINES, STORY_TEXT } from './lines';
import type { StoryItem, StorySpec } from './types';
import { JOURNAL_WORLDS } from './types';

const item = (world: StoryItem['world'], n: number): StoryItem => ({ ref: `${world}:${n}`, world, kind: 'discovery', title: { fr: `Chose ${n} !`, en: `Thing ${n}!` }, emoji: '✨' });
const ids = (s: StorySpec) => [s.title, ...s.pages.flatMap((p) => p.lines.flatMap((l) => ('t' in l ? [l.t] : [])))];

/** Words that never belong in Ziggy's mouth (sadness, blame, failure, pressure, counting what is missing). */
const FORBIDDEN = /(?<![\p{L}\p{N}])(sad|sadly|cry|crying|tears?|naughty|bad|wrong|fail\w*|lose|los[st]|missing|mistakes?|punish\w*|scared|afraid|alone|lonely|streak|score|hurry|triste\w*|pleur\w*|larmes?|méchant\w*|vilain\w*|échec\w*|échou\w*|raté\w*|rater|perdu\w*|faute\w*|erreurs?|puni\w*|peur|seule?|dommage|manqu\w*|vite|série|nul|nulle)(?![\p{L}\p{N}])/iu;

describe('story templates', () => {
  it('every template has an id, French and English, and ids are unique', () => {
    const seen = new Set<string>();
    for (const t of ALL_TEMPLATES) {
      expect(t.id).toMatch(/^[a-z]+(-[a-z]+)?-\d+$/);
      expect(t.fr.trim().length).toBeGreaterThan(2);
      expect(t.en.trim().length).toBeGreaterThan(2);
      expect(seen.has(t.id)).toBe(false);
      seen.add(t.id);
    }
  });

  it('has a family of sentences for every world a story can tell', () => {
    for (const w of JOURNAL_WORLDS.filter((x) => x !== 'stories') as StoryFamily[]) {
      expect(LEADS[w].length).toBeGreaterThanOrEqual(6);
      expect(REACTIONS[w].length).toBeGreaterThanOrEqual(6);
    }
    expect(Math.min(TITLES.length, OPENINGS.length, SNUGGLES.length, LINKS.length, QUIET.length, ENDINGS.length, SLEEPY.length, GOODNIGHTS.length)).toBeGreaterThanOrEqual(8);
  });

  it('never holds a name or a slot (so every sentence can be pre-recorded)', () => {
    for (const t of ALL_TEMPLATES) for (const s of [t.fr, t.en]) expect(s).not.toMatch(/[{}$<>]|%s/);
  });

  it('no sad, blaming or pressuring word, in the stories or anything Ziggy says in the album', () => {
    const lines = [...ALL_TEMPLATES, ...Object.values(ALBUM_TEXT), ...Object.values(STORY_TEXT), ...HELLO_LINES, ...EMPTY_LINES, ...Object.values(STICKER_LINES).flat()];
    for (const l of lines) {
      expect(l.fr, l.fr).not.toMatch(FORBIDDEN);
      expect(l.en, l.en).not.toMatch(FORBIDDEN);
    }
  });

  it('the checker itself catches the words', () => {
    for (const bad of ['Ziggy est triste', 'C’est raté', 'un échec', 'You lost', 'naughty elf', 'so sad']) expect(bad).toMatch(FORBIDDEN);
  });
});

describe('buildStory', () => {
  it('is deterministic: the same choices give the same story', () => {
    const items = [item('sandbox', 1), item('creatures', 2)];
    expect(buildStory(items, 42)).toEqual(buildStory(items, 42));
    expect(buildStory(items, 42, ['open-1'])).toEqual(buildStory(items, 42, ['open-1']));
    expect(storySeed('2026-11-21', ['a', 'b'], 0)).toBe(storySeed('2026-11-21', ['a', 'b'], 0));
    expect(storySeed('2026-11-21', ['a', 'b'], 0)).not.toBe(storySeed('2026-11-21', ['a', 'b'], 1));
  });

  it('makes 3 or 4 pages, with every chosen item on its own page, ending sleepily', () => {
    for (let n = 0; n <= 3; n++) {
      const s = buildStory([item('art', 1), item('music', 2), item('lutins', 3)].slice(0, n), 9);
      expect(s.pages.length).toBeGreaterThanOrEqual(3);
      expect(s.pages.length).toBeLessThanOrEqual(4);
      expect(s.pages.at(-1)!.scene).toBe('end');
      const shown = s.pages.flatMap((p) => p.lines.flatMap((l) => ('item' in l ? [l.item] : [])));
      expect(shown).toEqual(Array.from({ length: n }, (_, i) => i));
      const last = s.pages.at(-1)!.lines.flatMap((l) => ('t' in l ? [l.t] : []));
      expect(last.some((id) => id.startsWith('sleepy-'))).toBe(true);
      expect(last.at(-1)).toMatch(/^night-/);
    }
  });

  it('keeps only three items', () => {
    const s = buildStory([1, 2, 3, 4, 5].map((n) => item('games', n)), 1);
    expect(s.items).toHaveLength(3);
  });

  it('never repeats a sentence inside a story', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = buildStory([item('sandbox', 1), item('sandbox', 2), item('sandbox', 3)], seed);
      const list = ids(s);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('never repeats a sentence from the story just before (story after story)', () => {
    for (const items of [[], [item('moments', 1)], [item('sandbox', 1), item('art', 2)], [item('creatures', 1), item('creatures', 2), item('creatures', 3)]]) {
      let previous: string[] = [];
      for (let k = 0; k < 60; k++) {
        const s = buildStory(items, storySeed('2026-11-21', items.map((i) => i.ref), k), previous);
        const now = ids(s);
        expect(now.filter((id) => previous.includes(id))).toEqual([]);
        previous = now;
      }
    }
  });

  it('varies: many different stories for the same day', () => {
    const items = [item('adventure', 1), item('games', 2)];
    const texts = new Set(Array.from({ length: 30 }, (_, k) => JSON.stringify(ids(buildStory(items, storySeed('d', ['x'], k))))));
    expect(texts.size).toBeGreaterThan(25);
  });

  it('reads in both languages, with the item titles as their own lines', () => {
    const s = buildStory([item('sandbox', 7)], 3);
    const fr = s.pages.flatMap((p) => pageText(s, p, 'fr'));
    const en = s.pages.flatMap((p) => pageText(s, p, 'en'));
    expect(fr).toContain('Chose 7 !');
    expect(en).toContain('Thing 7!');
    expect(fr.length).toBe(en.length);
    // An older story whose sentence is gone still reads (the line is skipped).
    const old: StorySpec = { ...s, pages: [{ scene: 'intro', lines: [{ t: 'gone-1' }, { t: 'open-1' }] }] };
    expect(pageText(old, old.pages[0], 'en')).toEqual([OPENINGS[0].en]);
  });
});
