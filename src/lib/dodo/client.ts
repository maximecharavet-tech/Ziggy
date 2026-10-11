'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { DodoStory } from '@/data/dodo/types';

/* ── Settings kept on this device ── */

export interface DodoSettings {
  sound: string;
  volume: number;
  /** Minutes the sleep sounds keep playing after the story (0 = stop with the story). */
  timer: 0 | 10 | 20 | 30 | 45;
  showText: boolean;
  /** Ziggy's voice: 1 = normal, gentler values slow the browser voice down. */
  favorites: string[];
  /** Stories already heard (ids), to suggest new ones. */
  heard: string[];
}

const KEY = 'ziggy:dodo';
const EVENT = 'ziggy:dodo';
const DEFAULTS: DodoSettings = { sound: 'rain', volume: 0.6, timer: 20, showText: true, favorites: [], heard: [] };
let cache: DodoSettings | null = null;

function read(): DodoSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...(JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<DodoSettings>) };
  } catch {
    cache = DEFAULTS;
  }
  return cache;
}

export function updateDodo(patch: Partial<DodoSettings>) {
  cache = { ...read(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage blocked: settings last for this visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useDodoSettings(): DodoSettings {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    read,
    () => DEFAULTS
  );
}

/* ── Pre-generated assets ── */

export type DodoManifest = {
  images: Record<string, Record<number, string>>;
  audio: Record<string, Record<string, Record<number, string>>>;
};

let manifest: Promise<DodoManifest> | null = null;

export function loadManifest(): Promise<DodoManifest> {
  manifest ??= fetch('/api/ziggy/dodo/assets')
    .then((r) => (r.ok ? (r.json() as Promise<DodoManifest>) : { images: {}, audio: {} }))
    .catch(() => ({ images: {}, audio: {} }));
  return manifest;
}

export function useManifest(): DodoManifest | null {
  const [m, setM] = useState<DodoManifest | null>(null);
  useEffect(() => {
    let alive = true;
    void loadManifest().then((x) => alive && setM(x));
    return () => {
      alive = false;
    };
  }, []);
  return m;
}

/* ── Text helpers ── */

/** Sentences, for subtitles and for the browser voice (keeps « … » dialogue together). */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    cur += c;
    if (c === '«' || c === '“') depth++;
    else if ((c === '»' || c === '”') && depth > 0) depth--;
    else if (c === '"') depth = depth > 0 ? depth - 1 : depth + 1;
    // A sentence ends on . ! ? … followed by a space (or the end), outside quotes.
    if (depth === 0 && /[.!?…]/.test(c) && !/[.!?…]/.test(chars[i + 1] ?? '') && (i + 1 >= chars.length || /\s/.test(chars[i + 1]))) {
      out.push(cur.trim());
      cur = '';
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [text];
}

/** Minutes, at a calm bedtime pace (~105 words per minute plus pauses). */
export function storyMinutes(story: DodoStory, locale: string): number {
  const words = story.scenes.reduce((n, s) => n + (locale === 'fr' ? s.text.fr : s.text.en).split(/\s+/).length, 0);
  return Math.max(2, Math.round(words / 105 + story.scenes.length * 0.1));
}

/** A story for tonight: one not heard yet if possible, varied by day. */
export function storyOfTheNight(stories: DodoStory[], heard: string[], day = new Date()): DodoStory {
  const fresh = stories.filter((s) => !heard.includes(s.id));
  const pool = fresh.length ? fresh : stories;
  const n = day.getFullYear() * 400 + day.getMonth() * 31 + day.getDate();
  return pool[n % pool.length];
}
