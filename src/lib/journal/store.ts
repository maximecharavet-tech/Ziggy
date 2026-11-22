/**
 * The journal's own little store (localStorage `ziggy:journal:v1`): entries
 * that new features add with `addToJournal`, and the bedtime stories Ziggy
 * told (« Ziggy raconte ma journée »), so they can be read again. On this
 * device only. Everything else in the album is read live from the features'
 * own stores (./adapters.ts).
 */
import type { L } from '@/lib/i18n-text';
import { JOURNAL_WORLDS, type JournalEntry, type JournalKind, type JournalWorld, type StorySpec } from './types';
import { readAllStores, type Reader } from './adapters';

export const JOURNAL_KEY = 'ziggy:journal:v1';
export const JOURNAL_EVENT = 'ziggy:journal';
/** The oldest own entries leave room past this (the features' stores keep their own). */
export const JOURNAL_MAX = 200;
const THUMB_MAX = 60_000;

const KINDS: readonly JournalKind[] = ['discovery', 'creation', 'creature', 'prank', 'place', 'friend', 'treasure', 'game', 'drawing', 'song', 'moment', 'story'];

interface OwnSave {
  v: 1;
  entries: JournalEntry[];
}

const isL = (v: unknown): v is L => !!v && typeof v === 'object' && typeof (v as L).fr === 'string' && typeof (v as L).en === 'string' && !!(v as L).fr.trim() && !!(v as L).en.trim();

function cleanEntry(raw: unknown): JournalEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Partial<JournalEntry>;
  if (typeof e.id !== 'string' || !e.id.startsWith('journal:')) return null;
  if (!JOURNAL_WORLDS.includes(e.world as JournalWorld) || !KINDS.includes(e.kind as JournalKind)) return null;
  if (!isL(e.title) || typeof e.emoji !== 'string' || typeof e.at !== 'number' || !Number.isFinite(e.at)) return null;
  const story = e.kind === 'story' ? cleanStory(e.story) : undefined;
  if (e.kind === 'story' && !story) return null;
  return {
    id: e.id,
    source: 'journal',
    world: e.world as JournalWorld,
    kind: e.kind as JournalKind,
    title: { fr: e.title.fr.slice(0, 120), en: e.title.en.slice(0, 120) },
    emoji: e.emoji.slice(0, 16),
    at: e.at,
    ...(typeof e.thumb === 'string' && e.thumb.startsWith('data:image/') && e.thumb.length <= THUMB_MAX ? { thumb: e.thumb } : {}),
    ...(typeof e.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(e.color) ? { color: e.color } : {}),
    ...(e.personal ? { personal: true } : {}),
    ...(story ? { story } : {}),
  };
}

function cleanStory(raw: unknown): StorySpec | undefined {
  const s = raw as Partial<StorySpec> | undefined;
  if (!s || s.v !== 1 || typeof s.title !== 'string' || typeof s.seed !== 'number' || !Array.isArray(s.items) || !Array.isArray(s.pages) || !s.pages.length) return undefined;
  const items = s.items.filter((i) => i && typeof i.ref === 'string' && isL(i.title) && typeof i.emoji === 'string' && JOURNAL_WORLDS.includes(i.world)).slice(0, 3);
  const pages = s.pages
    .filter((p) => p && Array.isArray(p.lines) && ['intro', 'item', 'end'].includes(p.scene))
    .map((p) => ({
      scene: p.scene,
      ...(typeof p.item === 'number' && p.item >= 0 && p.item < items.length ? { item: p.item } : {}),
      lines: p.lines.filter((l) => l && (('t' in l && typeof l.t === 'string') || ('item' in l && typeof l.item === 'number' && l.item >= 0 && l.item < items.length))),
    }));
  return pages.length ? { v: 1, seed: s.seed, title: s.title, items, pages } : undefined;
}

/** Reads the own store (damaged or unknown data is dropped, never a crash). */
export function parseOwn(raw: string | null): JournalEntry[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = (data as Partial<OwnSave> | null)?.entries;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: JournalEntry[] = [];
  for (const r of list) {
    const e = cleanEntry(r);
    if (!e || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out.slice(0, JOURNAL_MAX);
}

type Storage = Reader & { setItem(key: string, value: string): void };

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Kept for this visit when storage is blocked (private mode). */
let memoryOnly: JournalEntry[] | null = null;

export function readOwn(s: Reader | null = storage()): JournalEntry[] {
  if (memoryOnly) return memoryOnly;
  try {
    return parseOwn(s ? s.getItem(JOURNAL_KEY) : null);
  } catch {
    return [];
  }
}

function writeOwn(entries: JournalEntry[], s: Storage | null = storage()) {
  const list = [...entries].sort((a, b) => b.at - a.at).slice(0, JOURNAL_MAX);
  try {
    if (!s) throw new Error('no storage');
    s.setItem(JOURNAL_KEY, JSON.stringify({ v: 1, entries: list } satisfies OwnSave));
    memoryOnly = null;
  } catch {
    memoryOnly = list;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(JOURNAL_EVENT));
}

export interface NewEntry {
  /** Stable id inside the calling feature (adding the same id again updates it). */
  id?: string;
  world: Exclude<JournalWorld, 'stories'>;
  kind: Exclude<JournalKind, 'story'>;
  title: L;
  emoji: string;
  /** A small `data:image/…` picture (≤ 60 KB; bigger ones are not kept). */
  thumb?: string;
  personal?: boolean;
  color?: string;
  at?: number;
}

const newId = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/**
 * The append API for new features: put a discovery in the child's album.
 *
 *   addToJournal({ id: 'rainbow', world: 'moments', kind: 'moment', emoji: '🌈', title: { fr: 'Un arc-en-ciel !', en: 'A rainbow!' } });
 */
export function addToJournal(entry: NewEntry, s: Storage | null = storage()): JournalEntry | null {
  const e = cleanEntry({ ...entry, id: `journal:${entry.id ?? newId()}`, at: entry.at ?? Date.now() });
  if (!e) return null;
  writeOwn([e, ...readOwn(s).filter((x) => x.id !== e.id)], s);
  return e;
}

/** Keeps a bedtime story in the album (so it can be read again). */
export function saveStory(story: StorySpec, title: L, at = Date.now(), s: Storage | null = storage()): JournalEntry | null {
  const e = cleanEntry({ id: `journal:story-${at.toString(36)}`, world: 'stories', kind: 'story', title, emoji: '📖', at, story });
  if (!e) return null;
  writeOwn([e, ...readOwn(s).filter((x) => x.id !== e.id)], s);
  return e;
}

/** The template ids of the last story told (so the next one does not repeat them). */
export function lastStoryTemplates(entries: JournalEntry[]): string[] {
  const last = entries.filter((e) => e.kind === 'story' && e.story).sort((a, b) => b.at - a.at)[0];
  if (!last?.story) return [];
  return [last.story.title, ...last.story.pages.flatMap((p) => p.lines.flatMap((l) => ('t' in l ? [l.t] : [])))];
}

/** Everything in the album, newest first. */
export async function readJournal(now = Date.now()): Promise<JournalEntry[]> {
  const s = storage();
  const [stores, own] = await Promise.all([readAllStores(s, now), Promise.resolve(readOwn(s))]);
  const seen = new Set<string>();
  return [...own, ...stores]
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .filter((e) => e.at <= now + 60_000)
    .sort((a, b) => b.at - a.at);
}

/** Calls `cb` when the album may have changed (an entry added here or in another tab). */
export function onJournalChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith('ziggy:')) cb();
  };
  window.addEventListener(JOURNAL_EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(JOURNAL_EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}
