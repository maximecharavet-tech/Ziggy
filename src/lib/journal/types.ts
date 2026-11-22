/**
 * « Mon carnet de découvertes »: one album for everything a child found or
 * made in Ziggy. Each feature keeps its own store (and format); the journal
 * reads them through small read-only adapters (./adapters.ts) and keeps only
 * its own little store for new entries and bedtime stories (./store.ts).
 * Everything stays on this device.
 */
import type { L } from '@/lib/i18n-text';

/** The album's "worlds": the filters, and the story templates' families. */
export const JOURNAL_WORLDS = ['sandbox', 'creatures', 'lutins', 'adventure', 'games', 'art', 'music', 'moments', 'stories'] as const;
export type JournalWorld = (typeof JOURNAL_WORLDS)[number];

/** Where an entry comes from (one adapter each, plus the journal's own store). */
export type JournalSource = 'sandbox' | 'sandbox-album' | 'creatures' | 'lutins' | 'world' | 'games' | 'coloring' | 'songs' | 'journal';

export type JournalKind = 'discovery' | 'creation' | 'creature' | 'prank' | 'place' | 'friend' | 'treasure' | 'game' | 'drawing' | 'song' | 'moment' | 'story';

export interface JournalEntry {
  /** Unique across sources: `<source>:<id in that store>`. */
  id: string;
  source: JournalSource;
  world: JournalWorld;
  kind: JournalKind;
  title: L;
  /** Shown when there is no picture (and on top of the sticker otherwise). */
  emoji: string;
  /** A picture: a `data:image/…` URL, or a `blob:` URL made on this device. */
  thumb?: string;
  /** The title was typed by the child (a creature's name): only the device's own voice says it. */
  personal?: boolean;
  /** Sticker tint. */
  color?: string;
  /** When it was found / made (ms since epoch). */
  at: number;
  /** For `kind: 'story'`: what is needed to read the story again. */
  story?: StorySpec;
}

/** One line of a story: a fixed template sentence, or the title of the chosen item. */
export type StoryLine = { t: string } | { item: number };

export interface StoryPage {
  /** The chosen item this page shows (its sticker), if any. */
  item?: number;
  /** 'intro' (moon and Ziggy), 'item' or 'end' (sleepy Ziggy). */
  scene: 'intro' | 'item' | 'end';
  lines: StoryLine[];
}

/** What a story needs to be read again; small enough for localStorage (no pictures). */
export interface StoryItem {
  /** The journal entry it came from (its picture is looked up there when reading again). */
  ref: string;
  world: JournalWorld;
  kind: JournalKind;
  title: L;
  emoji: string;
  personal?: boolean;
}

export interface StorySpec {
  v: 1;
  seed: number;
  /** Template id of the story's title. */
  title: string;
  items: StoryItem[];
  pages: StoryPage[];
}

export interface WorldInfo {
  emoji: string;
  name: L;
  color: string;
}

export const WORLD_INFO: Record<JournalWorld, WorldInfo> = {
  sandbox: { emoji: '🧪', name: { fr: 'Bac à sable', en: 'Sandbox' }, color: '#4FC9C0' },
  creatures: { emoji: '👾', name: { fr: 'Créatures', en: 'Creatures' }, color: '#B07CFF' },
  lutins: { emoji: '🧝', name: { fr: 'Lutins', en: 'Elves' }, color: '#E5484D' },
  adventure: { emoji: '🗺️', name: { fr: 'Ziggy World', en: 'Ziggy World' }, color: '#3F8FE0' },
  games: { emoji: '🎮', name: { fr: 'Jeux', en: 'Games' }, color: '#22C55E' },
  art: { emoji: '🎨', name: { fr: 'Dessins', en: 'Drawings' }, color: '#FF7AB8' },
  music: { emoji: '🎵', name: { fr: 'Musique', en: 'Music' }, color: '#FFB13B' },
  moments: { emoji: '✨', name: { fr: 'Moments', en: 'Moments' }, color: '#F59E0B' },
  stories: { emoji: '📖', name: { fr: 'Histoires', en: 'Stories' }, color: '#7A6CF0' },
};

/** Local day key (YYYY-MM-DD) of a time, for "today" and the story seed. */
export function dayOf(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
