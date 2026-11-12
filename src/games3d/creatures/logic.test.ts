import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALBUM_MAX,
  BAND_CATEGORIES,
  DRAWER_SIZE,
  drawerFor,
  drawerPage,
  pageWith,
  CATEGORIES,
  CHALLENGES,
  COLOR_IDS,
  LOOK_KEYS,
  NAME_BLOCKLIST,
  NAME_PARTS,
  OPTIONS,
  STARTER,
  addToAlbum,
  canDoText,
  challengesFor,
  changedKeys,
  checkChallenge,
  hintFor,
  makeName,
  movesOf,
  nextChallenge,
  parseAlbum,
  randomCreature,
  removeFromAlbum,
  renameInAlbum,
  sameLook,
  sanitize,
  solveChallenge,
  voiceOf,
  type Band,
  type Creature,
} from './logic';

const BANDS: Band[] = ['little', 'middle', 'big'];

describe('Usine à Créatures — parts', () => {
  it('every category has options with FR and EN words', () => {
    for (const cat of CATEGORIES) {
      expect(cat.label.fr && cat.label.en).toBeTruthy();
      const opts = OPTIONS[cat.id];
      expect(opts.length).toBeGreaterThan(1);
      const keys = new Set(opts.map((o) => o.key));
      expect(keys.size).toBe(opts.length);
      for (const o of opts) {
        expect(o.label.fr.length).toBeGreaterThan(0);
        expect(o.label.en.length).toBeGreaterThan(0);
        expect(o.say.fr.length).toBeGreaterThan(0);
        expect(o.say.en.length).toBeGreaterThan(0);
        expect(o.icon.length).toBeGreaterThan(0);
      }
    }
  });

  it('applying an option selects it and keeps a valid creature', () => {
    for (const cat of CATEGORIES)
      for (const o of OPTIONS[cat.id]) {
        const c = o.apply(STARTER);
        expect(o.selected(c)).toBe(true);
        expect(sanitize(c)).toEqual(c);
      }
  });

  it('legs go from 0 to 8, eyes from 1 to 5', () => {
    expect(OPTIONS.legs.filter((o) => o.key.startsWith('legs:')).map((o) => o.apply(STARTER).legs)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(OPTIONS.eyes.filter((o) => o.key.startsWith('eyes:')).map((o) => o.apply(STARTER).eyes)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('Surprise lever', () => {
  it('always makes a whole, valid creature (and is deterministic)', () => {
    for (let s = 0; s < 400; s++) {
      const c = randomCreature(s);
      expect(sanitize(c)).toEqual(c);
      expect(c.accent).not.toBe(c.color);
      expect(randomCreature(s)).toEqual(c);
    }
  });

  it('mixes a lot of different creatures', () => {
    const looks = new Set<string>();
    for (let s = 0; s < 200; s++) looks.add(JSON.stringify(LOOK_KEYS.map((k) => randomCreature(s)[k])));
    expect(looks.size).toBeGreaterThan(190);
  });

  it('only the changed parts plop', () => {
    const b = { ...STARTER, legs: 6, hat: 'crown' as const };
    expect(changedKeys(STARTER, b).sort()).toEqual(['hat', 'legs']);
    expect(sameLook(STARTER, { ...STARTER, name: 'Zou', id: 'x' })).toBe(true);
  });
});

describe('Silly names', () => {
  it('two words with a hyphen, short enough to read', () => {
    for (let s = 0; s < 500; s++) {
      const n = makeName(s);
      expect(n).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+$/);
      expect(n.length).toBeLessThanOrEqual(26);
    }
  });

  it('never makes a rude word, in French or English (every combination)', () => {
    const { N1, N2, M1, M2, M3 } = NAME_PARTS;
    const first = N1.flatMap((a) => N2.map((b) => (a + b).toLowerCase()));
    const second = M1.flatMap((a) => M2.flatMap((b) => M3.map((c) => (a + b + c).toLowerCase())));
    const bad: string[] = [];
    for (const s of [...first, ...second]) for (const w of NAME_BLOCKLIST) if (s.includes(w)) bad.push(`${s}:${w}`);
    // Across the hyphen too (read as one word).
    const ends = new Set(first.map((s) => s.slice(-5)));
    const starts = new Set(second.map((s) => s.slice(0, 5)));
    for (const e of ends) for (const st of starts) for (const w of NAME_BLOCKLIST) if ((e + st).includes(w) && !e.includes(w) && !st.includes(w)) bad.push(`${e}|${st}:${w}`);
    expect(bad).toEqual([]);
  });

  it('rerolling gives many different names', () => {
    const names = new Set(Array.from({ length: 300 }, (_, i) => makeName(i)));
    expect(names.size).toBeGreaterThan(280);
  });
});

describe('Coming to life', () => {
  it('wings fly, a fish tail swims, no legs bounces, one leg hops', () => {
    expect(movesOf({ ...STARTER, wings: 'bird', legs: 0 })).toContain('fly');
    expect(movesOf({ ...STARTER, tail: 'fish' })).toContain('swim');
    expect(movesOf({ ...STARTER, legs: 0, wings: 'none', tail: 'none' })).toEqual(['bounce']);
    expect(movesOf({ ...STARTER, legs: 1 })).toEqual(['pogo']);
    expect(movesOf({ ...STARTER, wings: 'bird', tail: 'fish' })).toEqual(expect.arrayContaining(['fly', 'swim']));
    expect(movesOf({ ...STARTER, wings: 'tiny' })).toContain('flutter');
  });

  it('always does at least one thing, at most three', () => {
    for (let s = 0; s < 300; s++) {
      const m = movesOf(randomCreature(s));
      expect(m.length).toBeGreaterThan(0);
      expect(m.length).toBeLessThanOrEqual(3);
    }
  });

  it('small creatures squeak higher than giants', () => {
    for (let s = 0; s < 100; s++) {
      const c = randomCreature(s);
      const v1 = voiceOf({ ...c, size: 1 });
      const v3 = voiceOf({ ...c, size: 3 });
      expect(v1.pitch).toBeGreaterThan(v3.pitch);
      expect(v1.kind).toBe(v3.kind);
      expect(v1.syllables).toBeGreaterThan(0);
    }
  });

  it('says what it can do in both languages', () => {
    const c: Creature = { ...STARTER, wings: 'bird', tail: 'fish', legs: 4 };
    expect(canDoText(c, 'fr')).toBe('Elle marche, elle vole et elle nage !');
    expect(canDoText(c, 'en')).toBe('It walks, it flies and it swims!');
  });
});

describe('Challenges (optional)', () => {
  it('every challenge can be done, has FR/EN text and an allowed skill', () => {
    const ids = new Set<string>();
    for (const ch of CHALLENGES) {
      expect(ids.has(ch.id)).toBe(false);
      ids.add(ch.id);
      expect(ch.text.fr && ch.text.en).toBeTruthy();
      expect(['vocabulary', 'counting', 'addition', 'colors', 'logic']).toContain(ch.skill);
      const sol = solveChallenge(ch);
      expect(sol, ch.id).not.toBeNull();
      expect(checkChallenge(ch, sol!).ok).toBe(true);
    }
  });

  it('a kind hint for what is missing, and never for a finished creature', () => {
    for (const ch of CHALLENGES)
      for (const locale of ['fr', 'en']) {
        const h = hintFor(ch, STARTER, locale);
        expect(h.length).toBeGreaterThan(5);
        if (!checkChallenge(ch, STARTER).ok) expect(h).not.toMatch(/faux|wrong|perdu|lost/i);
        expect(hintFor(ch, solveChallenge(ch)!, locale)).toMatch(/Bravo|Well done/);
      }
  });

  it('counting hints say how many it has and how many it needs', () => {
    const ch = CHALLENGES.find((c) => c.id === 'insect')!;
    expect(hintFor(ch, { ...STARTER, legs: 4 }, 'fr')).toContain('4');
    expect(hintFor(ch, { ...STARTER, legs: 4 }, 'fr')).toContain('6');
  });

  it('French colour words agree with « créature »', () => {
    const ch = CHALLENGES.find((c) => c.id === 'bluePogo')!;
    expect(hintFor(ch, STARTER, 'fr')).toBe('Il faut une créature bleue !');
    expect(hintFor(ch, STARTER, 'en')).toBe('It needs to be blue!');
  });

  it('follows the age: little ones never get sums, big kids get them', () => {
    expect(challengesFor('little').some((c) => c.skill === 'addition')).toBe(false);
    expect(challengesFor('big').some((c) => c.skill === 'addition')).toBe(true);
    for (const b of BANDS) expect(challengesFor(b).length).toBeGreaterThan(3);
  });

  it('offers a fresh challenge until all are done', () => {
    const done: string[] = [];
    for (let i = 0; i < challengesFor('middle').length; i++) {
      const ch = nextChallenge('middle', 2, done, i);
      expect(done).not.toContain(ch.id);
      done.push(ch.id);
    }
    expect(nextChallenge('middle', 2, done, 3)).toBeTruthy();
  });

  it('little challenges are simple: at most 2 things, numbers up to 4', () => {
    for (const ch of CHALLENGES.filter((c) => c.band === 'little')) {
      expect(ch.reqs.length).toBeLessThanOrEqual(2);
      for (const r of ch.reqs) if ('n' in r) expect(r.n).toBeLessThanOrEqual(4);
    }
  });
});

describe('The album (La Parade)', () => {
  it('keeps the newest first, at most 60', () => {
    let album = addToAlbum([], { ...STARTER, name: 'Un' }, 1);
    expect(album[0].id).toBeTruthy();
    for (let i = 0; i < 70; i++) album = addToAlbum(album, randomCreature(i), 10 + i);
    expect(album).toHaveLength(ALBUM_MAX);
    expect(album[0].savedAt).toBe(79);
    expect(new Set(album.map((s) => s.id)).size).toBe(ALBUM_MAX);
  });

  it('saving the same creature again updates it instead of duplicating', () => {
    const a = addToAlbum([], { ...STARTER, id: 'abc' }, 1);
    const b = addToAlbum(a, { ...STARTER, id: 'abc', legs: 6 }, 2);
    expect(b).toHaveLength(1);
    expect(b[0].legs).toBe(6);
  });

  it('renames (cleaned) and deletes', () => {
    const a = addToAlbum([], { ...STARTER, id: 'abc' }, 1);
    expect(renameInAlbum(a, 'abc', '  Zou<script>  ')[0].name).toBe('Zouscript');
    expect(renameInAlbum(a, 'abc', '   ')[0].name).toBe(STARTER.name);
    expect(removeFromAlbum(a, 'abc')).toEqual([]);
  });

  it('round-trips through storage, thumbnails included', () => {
    const album = addToAlbum(addToAlbum([], randomCreature(1), 5, 'data:image/jpeg;base64,AAAA'), randomCreature(2), 6);
    expect(parseAlbum(JSON.stringify(album))).toEqual(album);
  });

  it('never crashes on broken storage, and repairs bad fields', () => {
    for (const raw of [null, '', '{', '42', '{"a":1}', '[null, 3, "x"]', '[{"id":"a","legs":99,"eyes":-4,"body":"potato","color":"plaid","thumb":"javascript:1"}]']) {
      expect(() => parseAlbum(raw)).not.toThrow();
    }
    const fixed = parseAlbum('[{"id":"a","legs":99,"eyes":-4,"body":"potato","color":"plaid","thumb":"javascript:1"}]');
    expect(fixed).toHaveLength(1);
    expect(fixed[0].legs).toBe(8);
    expect(fixed[0].eyes).toBe(1);
    expect(fixed[0].body).toBe(STARTER.body);
    expect(COLOR_IDS).toContain(fixed[0].color);
    expect(fixed[0].thumb).toBeUndefined();
    // Entries without an id are dropped, duplicates too.
    expect(parseAlbum('[{"legs":2},{"id":"a"},{"id":"a"}]')).toHaveLength(1);
  });
});

describe('What each age sees', () => {
  it('6 tabs for little ones, more later, every tab with a drawer', () => {
    expect(BAND_CATEGORIES.little.length).toBeLessThanOrEqual(7);
    expect(BAND_CATEGORIES.middle.length).toBeGreaterThan(BAND_CATEGORIES.little.length);
    expect(BAND_CATEGORIES.big.length).toBeGreaterThan(10);
    for (const b of BANDS)
      for (const cat of BAND_CATEGORIES[b]) {
        const d = drawerFor(cat, b);
        expect(d.options.length + (d.stepper ? 1 : 0)).toBeGreaterThan(0);
      }
  });

  it('never more tiles than the drawer size, and every option reachable by paging', () => {
    for (const b of BANDS)
      for (const cat of BAND_CATEGORIES[b]) {
        const { options, stepper } = drawerFor(cat, b);
        const size = DRAWER_SIZE[b] - (stepper ? 2 : 0);
        const first = drawerPage(options, 0, size);
        const seen = new Set<string>();
        for (let p = 0; p < first.pages; p++) {
          const pg = drawerPage(options, p, size);
          expect(pg.items.length + (pg.more ? 1 : 0)).toBeLessThanOrEqual(size);
          for (const o of pg.items) seen.add(o.key);
        }
        expect(seen.size).toBe(options.length);
        // The drawer opens on the page of the current choice.
        for (const o of options) {
          const c = o.apply(STARTER);
          expect(drawerPage(options, pageWith(options, c, size), size).items.some((x) => x.selected(c))).toBe(true);
        }
      }
  });

  it('little ones see at most 4 pictures at once (+ “more”)', () => {
    for (const cat of BAND_CATEGORIES.little) {
      const pg = drawerPage(drawerFor(cat, 'little').options, 0, DRAWER_SIZE.little);
      expect(pg.items.length).toBeLessThanOrEqual(4);
    }
  });

  it('every challenge can be built with what its age can see', () => {
    for (const ch of CHALLENGES) {
      const sol = solveChallenge(ch)!;
      const band = ch.band;
      const reach = (field: string, value: unknown) =>
        BAND_CATEGORIES[band].some((cat) => {
          const d = drawerFor(cat, band);
          if (d.stepper && d.stepper.field === field) return typeof value === 'number' && value >= d.stepper.min && value <= d.stepper.max;
          return d.options.some((o) => (o.apply(STARTER) as unknown as Record<string, unknown>)[field] === value);
        });
      for (const r of ch.reqs) {
        const fields: string[] = { legs: ['legs'], arms: ['arms'], eyes: ['eyes'], wings: ['wings'], wingsIs: ['wings'], tail: ['tail'], top: ['top'], hat: ['hat'], hatIs: ['hat'], mouth: ['mouth'], pattern: ['pattern'], color: ['color'], legStyle: ['legStyle', 'legs'], limbs: ['legs', 'arms'], sumAll: ['legs', 'arms', 'eyes'], eyesEqLegs: ['eyes', 'legs'], oddLegs: ['legs'] }[r.k];
        for (const f of fields) {
          const v = (sol as unknown as Record<string, unknown>)[f];
          if (v === (STARTER as unknown as Record<string, unknown>)[f] && !['legs', 'eyes', 'arms'].includes(f)) continue;
          expect(reach(f, v), `${ch.id}: ${f}=${String(v)} in ${band}`).toBe(true);
        }
      }
    }
  });
});

describe('Parts catalogue (shared with the Rust core)', () => {
  const parts = JSON.parse(readFileSync('src/data/creatures/parts.json', 'utf8')).parts as Record<string, string[]>;
  it('every part of parts.json has a TS list, and the other way round', async () => {
    const L = await import('./logic');
    const map: Record<string, readonly string[]> = { body: L.BODIES, head: L.HEADS, legStyle: L.LEG_STYLES, armStyle: L.ARM_STYLES, wings: L.WINGS, tail: L.TAILS, mouth: L.MOUTHS, top: L.TOPS, hat: L.HATS, pattern: L.PATTERNS, nose: L.NOSES, aura: L.AURAS, pet: L.PETS, eyeSize: L.EYE_SIZES, color: L.COLOR_IDS };
    for (const [k, v] of Object.entries(parts)) expect([...map[k]], k).toEqual(v);
  });
  it('every option has FR + EN words and gives a creature that survives sanitize()', () => {
    for (const cat of CATEGORIES) {
      expect(OPTIONS[cat.id].length, cat.id).toBeGreaterThan(0);
      for (const o of OPTIONS[cat.id]) {
        expect(o.label.fr && o.label.en && o.say.fr && o.say.en, o.key).toBeTruthy();
        const c = o.apply(STARTER);
        expect(sameLook(sanitize(c)!, c), o.key).toBe(true);
      }
    }
  });
  it('is at least 2x richer than the first version', () => {
    const n = (k: string) => parts[k].length;
    expect(n('body')).toBeGreaterThanOrEqual(10);
    expect(n('hat')).toBeGreaterThanOrEqual(12);
    expect(n('top')).toBeGreaterThanOrEqual(12);
    expect(n('wings') + n('tail') + n('mouth') + n('legStyle') + n('armStyle')).toBeGreaterThanOrEqual(40);
  });
});
