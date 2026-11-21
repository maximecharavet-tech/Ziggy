import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyMemory } from '@/lib/world/memory';
import { parseAlbum } from '@/games3d/creatures/logic';
import { WORLDS } from '@/data/worlds';
import { coloringEntries, creatureEntries, gameEntries, GAME_NAMES, KEYS, lutinsEntries, readAllStores, sandboxAlbumEntries, sandboxEntries, songEntries, worldEntries } from './adapters';
import { addToJournal, JOURNAL_KEY, lastStoryTemplates, parseOwn, readOwn, saveStory } from './store';
import { buildStory } from './story';

const NOW = Date.parse('2026-11-21T19:00:00');

class Mem {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe('sandbox adapter', () => {
  it('reads the notebook as it is written (v1 fixture too), skipping unknown ids', () => {
    const v1 = readFileSync(join(process.cwd(), 'src/components/sandbox/__fixtures__/save-v1.json'), 'utf8');
    const out = sandboxEntries(v1);
    expect(out.map((e) => e.id).sort()).toEqual(['sandbox:bloom', 'sandbox:rain', 'sandbox:sprout']);
    const sprout = out.find((e) => e.id === 'sandbox:sprout')!;
    expect(sprout).toMatchObject({ source: 'sandbox', world: 'sandbox', kind: 'discovery', emoji: '🌱', at: 1731400000000 });
    expect(sprout.title.fr).toBeTruthy();
    expect(sprout.title.en).toBeTruthy();
  });

  it('never crashes on damaged data', () => {
    expect(sandboxEntries(null)).toEqual([]);
    expect(sandboxEntries('{oops')).toEqual([]);
    expect(sandboxEntries(JSON.stringify({ discoveries: { sprout: 'yesterday' } }))).toEqual([]);
  });

  it('reads built worlds from the album rows', () => {
    const out = sandboxAlbumEntries([{ id: 'a1', world: 'moon', at: 5, thumb: 'data:image/png;base64,AAA' }, { id: 'a2', world: 'nowhere', at: 6 }, { nope: true }]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: 'sandbox-album:a1', kind: 'creation', thumb: 'data:image/png;base64,AAA', emoji: '🌙' });
    expect(out[0].title.en).toContain('Moon');
    expect(out[1].title.fr).toBe('Mon monde du bac à sable');
  });
});

describe('creatures adapter', () => {
  it('reads « La Parade » through the lab’s own parser; names are personal', () => {
    const raw = JSON.stringify([
      { id: 'c1', name: 'Bloupi', savedAt: 100, body: 'round', thumb: 'data:image/png;base64,QQ' },
      { id: 'c2', name: 'Zorg', savedAt: 200 },
      'junk',
    ]);
    const out = creatureEntries(parseAlbum(raw));
    expect(out.length).toBeGreaterThanOrEqual(1);
    const bloupi = out.find((e) => e.id === 'creatures:c1')!;
    expect(bloupi).toMatchObject({ world: 'creatures', kind: 'creature', personal: true, at: 100, title: { fr: 'Bloupi', en: 'Bloupi' } });
    expect(creatureEntries(parseAlbum('nope'))).toEqual([]);
  });
});

describe('lutins adapter', () => {
  it('shows only pictures already revealed, without the parent’s caption', () => {
    const rows = [
      { id: 'p1', revealAt: '2026-11-20T06:00:00', caption: 'Léa, look!', image: 'blob' },
      { id: 'p2', revealAt: '2026-11-22T06:00:00', caption: 'tomorrow', image: 'blob' },
      { id: 3 },
    ];
    const out = lutinsEntries(rows, NOW, (id) => `blob:test/${id}`);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'lutins:p1', kind: 'prank', thumb: 'blob:test/p1' });
    expect(JSON.stringify(out)).not.toContain('Léa');
  });
});

describe('Ziggy World adapters', () => {
  const memory = emptyMemory();
  const quest = WORLDS[0].quests[0];
  memory.completedQuests = { [quest.id]: { stars: 1, plays: 2, at: '2026-11-21T10:00:00.000Z' }, unknown_q9: { stars: 3, plays: 1, at: '2026-11-21T10:00:00.000Z' } };
  memory.recent = [
    { gameId: 'pizza', skill: 'counting', accuracy: 0.2, at: '2026-11-21T09:00:00.000Z' },
    { gameId: 'pizza', skill: 'counting', accuracy: 0.9, at: '2026-11-21T11:00:00.000Z' },
    { gameId: 'bac_a_sable', skill: 'science', accuracy: 1, at: '2026-11-21T11:00:00.000Z' },
    { gameId: 'mystery', skill: 'logic', accuracy: 1, at: '2026-11-21T11:00:00.000Z' },
  ];

  it('turns completed quests into places, friends and treasures (stars never read)', () => {
    const out = worldEntries(memory, WORLDS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: `world:${quest.outcome.id}`, world: 'adventure', title: quest.outcome.label, emoji: quest.outcome.emoji });
    expect(JSON.stringify(out)).not.toMatch(/stars/);
  });

  it('keeps one game sticker per game and day, never the accuracy', () => {
    const out = gameEntries(memory, GAME_NAMES);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ world: 'games', kind: 'game', emoji: '🍕', at: Date.parse('2026-11-21T11:00:00.000Z') });
    expect(JSON.stringify(out)).not.toMatch(/accuracy|0\.9/);
  });
});

describe('colouring and songs adapters', () => {
  it('reads gallery rows and kept songs', () => {
    expect(coloringEntries([{ id: 'a', pageId: 'cat', createdAt: 1, updatedAt: 9, thumb: 'data:image/png;base64,x' }, { id: 7 }])).toEqual([
      expect.objectContaining({ id: 'coloring:a', at: 9, kind: 'drawing', thumb: 'data:image/png;base64,x' }),
    ]);
    const songs = songEntries(JSON.stringify([{ id: 's1', emoji: '🦄', code: 'x', at: '2026-11-21T08:00:00Z' }, { id: 's2', at: 'never' }]));
    expect(songs).toEqual([expect.objectContaining({ id: 'songs:s1', emoji: '🦄', world: 'music' })]);
    expect(songEntries('{')).toEqual([]);
  });
});

describe('readAllStores', () => {
  it('reads every localStorage store at once and is read-only', async () => {
    const s = new Mem();
    s.setItem(KEYS.sandbox, JSON.stringify({ v: 2, discoveries: { sprout: 10, rain: 20 } }));
    s.setItem(KEYS.songs, JSON.stringify([{ id: 's', emoji: '🎵', at: 30 }]));
    s.setItem(KEYS.creatures, JSON.stringify([{ id: 'c', name: 'Pof', savedAt: 40 }]));
    s.setItem('ziggy:world', '{broken');
    const before = new Map(s.m);
    const out = await readAllStores(s, NOW);
    expect(out.map((e) => e.source).sort()).toEqual(['creatures', 'sandbox', 'sandbox', 'songs']);
    expect(s.m).toEqual(before);
  });
});

describe('the journal’s own store', () => {
  it('appends, updates by id, and drops damaged entries', () => {
    const s = new Mem();
    const a = addToJournal({ id: 'r', world: 'moments', kind: 'moment', emoji: '🌈', title: { fr: 'Un arc-en-ciel', en: 'A rainbow' }, at: 5 }, s);
    expect(a?.id).toBe('journal:r');
    addToJournal({ id: 'r', world: 'moments', kind: 'moment', emoji: '🌈', title: { fr: 'Deux arcs-en-ciel', en: 'Two rainbows' }, at: 6 }, s);
    expect(readOwn(s)).toHaveLength(1);
    expect(readOwn(s)[0].title.en).toBe('Two rainbows');
    expect(addToJournal({ world: 'moments', kind: 'moment', emoji: 'x', title: { fr: '', en: '' } }, s)).toBeNull();
    const raw = JSON.parse(s.getItem(JOURNAL_KEY)!);
    raw.entries.push({ id: 'evil', world: 'moments' }, 42);
    expect(parseOwn(JSON.stringify(raw))).toHaveLength(1);
    expect(parseOwn('nope')).toEqual([]);
  });

  it('keeps stories so they can be read again, and remembers their sentences', () => {
    const s = new Mem();
    const story = buildStory([{ ref: 'sandbox:sprout', world: 'sandbox', kind: 'discovery', title: { fr: 'La graine germe !', en: 'The seed sprouts!' }, emoji: '🌱' }], 7);
    const e = saveStory(story, { fr: 'Titre', en: 'Title' }, 100, s);
    expect(e?.kind).toBe('story');
    const back = readOwn(s)[0];
    expect(back.story).toEqual(story);
    const ids = lastStoryTemplates(readOwn(s));
    expect(ids).toContain(story.title);
    expect(ids.length).toBeGreaterThan(5);
  });
});
