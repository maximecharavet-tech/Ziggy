/**
 * Read-only adapters: each existing store, as journal entries. They never
 * write and never change a store's format; anything broken is skipped (never
 * a crash, never a scary message). Mapping functions are pure (tested in
 * adapters.test.ts); the readers below them do the storage work.
 *
 * Store keys are written here, not imported, so the album does not load the
 * games' code; the heavier tables (world quests, creature parts, arcade
 * names) are imported lazily, only when the album opens.
 */
import type { L } from '@/lib/i18n-text';
import { parseSave as parseSandbox } from '@/components/sandbox/storage';
import { discoveryById, WORLD_INFO as SANDBOX_WORLDS, type WorldId as SandboxWorld } from '@/games2d/sandbox/content';
import { normalizeMemory, type WorldMemory } from '@/lib/world/memory';
import type { JournalEntry, JournalKind } from './types';
import { WORLD_INFO } from './types';

export type Reader = { getItem(key: string): string | null };

export const KEYS = {
  sandbox: 'ziggy:sandbox',
  creatures: 'ziggy:creatures:v1',
  world: 'ziggy:world',
  songs: 'ziggy:songs',
} as const;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const timeOf = (v: unknown): number | null => {
  if (finite(v)) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) && t > 0 ? t : null;
  }
  return null;
};
const isPicture = (s: unknown): s is string => typeof s === 'string' && (s.startsWith('data:image/') || s.startsWith('blob:')) && s.length <= 400_000;
const json = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/* ── Magic Sandbox: the notebook's discoveries (localStorage `ziggy:sandbox`) ── */

export function sandboxEntries(raw: string | null): JournalEntry[] {
  const save = parseSandbox(json(raw));
  const out: JournalEntry[] = [];
  for (const [id, at] of Object.entries(save.discoveries)) {
    const d = discoveryById(id as Parameters<typeof discoveryById>[0]);
    if (!d || !finite(at)) continue;
    out.push({ id: `sandbox:${id}`, source: 'sandbox', world: 'sandbox', kind: 'discovery', title: d.title, emoji: d.output, color: d.color, at });
  }
  return out;
}

/* ── Magic Sandbox: worlds the child built (IndexedDB `ziggy-sandbox` / `snapshots`) ── */

export function sandboxAlbumEntries(rows: unknown[]): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const r of rows) {
    const s = r as { id?: unknown; world?: unknown; at?: unknown; thumb?: unknown };
    if (typeof s?.id !== 'string' || !finite(s.at)) continue;
    const w = typeof s.world === 'string' && s.world in SANDBOX_WORLDS ? SANDBOX_WORLDS[s.world as SandboxWorld] : null;
    const title: L = w ? { fr: `Mon monde : ${w.name.fr}`, en: `My world: ${w.name.en}` } : { fr: 'Mon monde du bac à sable', en: 'My sandbox world' };
    out.push({ id: `sandbox-album:${s.id}`, source: 'sandbox-album', world: 'sandbox', kind: 'creation', title, emoji: w?.emoji ?? '🏖️', ...(isPicture(s.thumb) ? { thumb: s.thumb } : {}), color: w?.colors[0], at: s.at });
  }
  return out;
}

/* ── Creature factory: « La Parade » (localStorage `ziggy:creatures:v1`) ── */

/** `album` is the creature lab's own parse (`parseAlbum`): only well-formed creatures. */
export function creatureEntries(album: { id: string; name: string; savedAt: number; thumb?: string }[]): JournalEntry[] {
  return album
    .filter((c) => c.id && c.name && finite(c.savedAt))
    .map((c) => ({
      id: `creatures:${c.id}`,
      source: 'creatures' as const,
      world: 'creatures' as const,
      kind: 'creature' as const,
      // A name the child typed or kept: shown as is, spoken by the device only.
      title: { fr: c.name, en: c.name },
      personal: true,
      emoji: '👾',
      ...(isPicture(c.thumb) ? { thumb: c.thumb } : {}),
      at: c.savedAt,
    }));
}

/* ── Lutins: « Le journal des lutins » (IndexedDB `ziggy-lutins` / `journal`) ── */

/**
 * Only pictures the child may already discover (`revealAt` passed). The
 * parent's caption is not shown: the album says what it is, kindly.
 * `pictureOf` turns the stored image into a URL (a `blob:` URL in the browser).
 */
export function lutinsEntries(rows: unknown[], now: number, pictureOf: (id: string, image: unknown) => string | undefined): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const r of rows) {
    const e = r as { id?: unknown; revealAt?: unknown; image?: unknown };
    const at = timeOf(e?.revealAt);
    if (typeof e?.id !== 'string' || at === null || at > now) continue;
    const thumb = pictureOf(e.id, e.image);
    out.push({ id: `lutins:${e.id}`, source: 'lutins', world: 'lutins', kind: 'prank', title: { fr: 'Une farce des lutins', en: 'An elf prank' }, emoji: '🧝', ...(thumb ? { thumb } : {}), at });
  }
  return out;
}

/* ── Ziggy World: places, friends and treasures found in quests (localStorage `ziggy:world`) ── */

type QuestTable = { quests: { id: string; outcome: { kind: 'place' | 'character' | 'item'; id: string; label: L; emoji: string } }[] }[];

const OUTCOME_KIND: Record<'place' | 'character' | 'item', JournalKind> = { place: 'place', character: 'friend', item: 'treasure' };

/** Stars are never read: only what was found, and when. */
export function worldEntries(memory: WorldMemory, worlds: QuestTable): JournalEntry[] {
  const byQuest = new Map(worlds.flatMap((w) => w.quests.map((q) => [q.id, q.outcome] as const)));
  const out: JournalEntry[] = [];
  for (const [questId, rec] of Object.entries(memory.completedQuests)) {
    const o = byQuest.get(questId);
    const at = timeOf(rec?.at);
    if (!o || at === null) continue;
    out.push({ id: `world:${o.id}`, source: 'world', world: 'adventure', kind: OUTCOME_KIND[o.kind], title: o.label, emoji: o.emoji, at });
  }
  return out;
}

/* ── Games: one sticker per game and per day (World Memory's recent rounds) ── */

/** The 3D and extra games that report to World Memory (arcade games come from their registry). */
export const GAME_NAMES: Record<string, { name: L; emoji: string }> = {
  detective: { name: { fr: 'Ziggy Détective', en: 'Detective Ziggy' }, emoji: '🕵️' },
  dino: { name: { fr: 'Ziggy Paléontologue', en: 'Ziggy the Dino Digger' }, emoji: '🦕' },
  grand_huit: { name: { fr: 'Le Grand Huit des Nombres', en: 'The Number Coaster' }, emoji: '🎢' },
  kart: { name: { fr: 'Le Kart des lettres', en: 'The Letter Kart' }, emoji: '🏎️' },
  luge_3d: { name: { fr: 'La Luge des nombres', en: 'The Number Sled' }, emoji: '🛷' },
  noel_3d: { name: { fr: 'Le Noël de Ziggy', en: 'Ziggy’s Christmas' }, emoji: '🎄' },
  pizza: { name: { fr: 'La Pizzeria de Ziggy', en: 'Ziggy’s Pizzeria' }, emoji: '🍕' },
  planetes: { name: { fr: 'Le Facteur des Planètes', en: 'The Planet Postman' }, emoji: '🪐' },
  nid: { name: { fr: 'Le jardin de Ziggy', en: 'Ziggy’s Garden' }, emoji: '🐣' },
  'lutin-chaos': { name: { fr: 'Le Chaos des lutins', en: 'Elf Chaos' }, emoji: '🧝' },
  'lutin-factory': { name: { fr: 'La Fabrique des lutins', en: 'The Elf Factory' }, emoji: '🏭' },
};

/** Games that already have their own, richer stickers (sandbox, creatures, songs). */
const OWN_STICKERS = new Set(['bac_a_sable', 'creatures', 'fabrique_chansons']);

/** Accuracy is never read: a game played is a moment, not a result. */
export function gameEntries(memory: WorldMemory, names: Record<string, { name: L; emoji: string }>): JournalEntry[] {
  const seen = new Map<string, JournalEntry>();
  for (const r of memory.recent) {
    const at = timeOf(r.at);
    const g = names[r.gameId];
    if (!g || at === null || OWN_STICKERS.has(r.gameId)) continue;
    const day = new Date(at);
    const key = `${r.gameId}-${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}`;
    const prev = seen.get(key);
    if (!prev || prev.at < at) seen.set(key, { id: `games:${key}`, source: 'games', world: 'games', kind: 'game', title: g.name, emoji: g.emoji, at });
  }
  return [...seen.values()];
}

/* ── Colouring: the gallery (IndexedDB `ziggy-coloring` / `artworks`) ── */

export function coloringEntries(rows: unknown[]): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const r of rows) {
    const a = r as { id?: unknown; createdAt?: unknown; updatedAt?: unknown; thumb?: unknown };
    const at = timeOf(a?.updatedAt) ?? timeOf(a?.createdAt);
    if (typeof a?.id !== 'string' || at === null) continue;
    out.push({ id: `coloring:${a.id}`, source: 'coloring', world: 'art', kind: 'drawing', title: { fr: 'Mon coloriage', en: 'My colouring' }, emoji: '🖍️', ...(isPicture(a.thumb) ? { thumb: a.thumb } : {}), color: WORLD_INFO.art.color, at });
  }
  return out;
}

/* ── Song factory: kept songs (localStorage `ziggy:songs`) ── */

export function songEntries(raw: string | null): JournalEntry[] {
  const data = json(raw);
  if (!Array.isArray(data)) return [];
  const out: JournalEntry[] = [];
  for (const s of data) {
    const song = s as { id?: unknown; emoji?: unknown; at?: unknown };
    const at = timeOf(song?.at);
    if (typeof song?.id !== 'string' || at === null) continue;
    const emoji = typeof song.emoji === 'string' && song.emoji.length <= 8 ? song.emoji : '🎵';
    out.push({ id: `songs:${song.id}`, source: 'songs', world: 'music', kind: 'song', title: { fr: 'Ma chanson', en: 'My song' }, emoji, color: WORLD_INFO.music.color, at });
  }
  return out;
}

/* ────────────────────────────── Readers (browser) ────────────────────────────── */

function readKey(storage: Reader | null, key: string): string | null {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function readMemory(storage: Reader | null): WorldMemory | null {
  const data = json(readKey(storage, KEYS.world));
  if (!data) return null;
  try {
    return normalizeMemory(data);
  } catch {
    return null;
  }
}

/**
 * All rows of another feature's IndexedDB store, without ever creating that
 * database: if it does not exist yet, the open is aborted (so the feature
 * later creates it with its own schema). Opened without a version, closed
 * right after, and closed at once if the feature wants to upgrade it.
 */
export function readIdb(db: string, store: string): Promise<unknown[]> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve([]);
      const req = indexedDB.open(db);
      req.onupgradeneeded = () => {
        try {
          req.transaction?.abort();
        } catch {
          /* already aborted */
        }
      };
      req.onerror = () => resolve([]);
      req.onblocked = () => resolve([]);
      req.onsuccess = () => {
        const conn = req.result;
        conn.onversionchange = () => conn.close();
        try {
          if (!conn.objectStoreNames.contains(store)) {
            conn.close();
            return resolve([]);
          }
          const tx = conn.transaction(store, 'readonly');
          const all = tx.objectStore(store).getAll();
          all.onsuccess = () => resolve(Array.isArray(all.result) ? all.result : []);
          all.onerror = () => resolve([]);
          tx.oncomplete = () => conn.close();
          tx.onabort = () => {
            conn.close();
            resolve([]);
          };
        } catch {
          conn.close();
          resolve([]);
        }
      };
    } catch {
      resolve([]);
    }
  });
}

/** Lutins pictures as `blob:` URLs, made once per entry for the whole visit. */
const pictureUrls = new Map<string, string>();
function lutinsPicture(id: string, image: unknown): string | undefined {
  const hit = pictureUrls.get(id);
  if (hit) return hit;
  if (typeof Blob === 'undefined' || !(image instanceof Blob) || typeof URL.createObjectURL !== 'function') return undefined;
  try {
    const url = URL.createObjectURL(image);
    pictureUrls.set(id, url);
    return url;
  } catch {
    return undefined;
  }
}

const settle = async (f: () => Promise<JournalEntry[]> | JournalEntry[]): Promise<JournalEntry[]> => {
  try {
    return await f();
  } catch {
    return [];
  }
};

/** Every existing store, as journal entries (each adapter on its own: one broken store never hides the others). */
export async function readAllStores(storage: Reader | null, now = Date.now()): Promise<JournalEntry[]> {
  const memory = readMemory(storage);
  const parts = await Promise.all([
    settle(() => sandboxEntries(readKey(storage, KEYS.sandbox))),
    settle(async () => sandboxAlbumEntries(await readIdb('ziggy-sandbox', 'snapshots'))),
    settle(async () => {
      const raw = readKey(storage, KEYS.creatures);
      if (!raw) return [];
      const { parseAlbum } = await import('@/games3d/creatures/logic');
      return creatureEntries(parseAlbum(raw));
    }),
    settle(async () => lutinsEntries(await readIdb('ziggy-lutins', 'journal'), now, lutinsPicture)),
    settle(async () => {
      if (!memory || !Object.keys(memory.completedQuests).length) return [];
      const { WORLDS } = await import('@/data/worlds');
      return worldEntries(memory, WORLDS);
    }),
    settle(async () => {
      if (!memory?.recent.length) return [];
      const { ARCADE_GAMES } = await import('@/lib/arcade/registry');
      const arcade = Object.fromEntries(Object.values(ARCADE_GAMES).map((g) => [g.id, { name: g.name, emoji: g.emoji }]));
      return gameEntries(memory, { ...arcade, ...GAME_NAMES });
    }),
    settle(async () => coloringEntries(await readIdb('ziggy-coloring', 'artworks'))),
    settle(() => songEntries(readKey(storage, KEYS.songs))),
  ]);
  return parts.flat();
}
