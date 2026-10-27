'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { DodoStory } from '@/data/dodo/types';
import { forgetPosition, parseTiming, readPositions, rememberPosition, type DodoPosition, type FallbackVoice, type HighlightMode } from './player';
import { voiceBase, voiceLocale, type DodoVoiceTiming } from './voice';

/* ── Settings kept on this device ── */

export interface DodoSettings {
  sound: string;
  volume: number;
  /** Minutes the sleep sounds keep playing after the story (0 = stop with the story). */
  timer: 0 | 10 | 20 | 30 | 45;
  showText: boolean;
  /** Teleprompter text size step (see TEXT_SIZES). */
  textSize: number;
  /** Light each word as it is said, or the whole line. */
  highlight: HighlightMode;
  /** Ziggy's voice speed (audio playbackRate), 0.85–1.15. */
  speed: number;
  /** When a story has no recording yet: silent reading at a calm pace, or the device's own voice. */
  fallback: FallbackVoice;
  favorites: string[];
  /** Stories already heard (ids), to suggest new ones. */
  heard: string[];
}

const KEY = 'ziggy:dodo';
const EVENT = 'ziggy:dodo';
const DEFAULTS: DodoSettings = {
  sound: 'rain',
  volume: 0.6,
  timer: 20,
  showText: true,
  textSize: 2,
  highlight: 'word',
  speed: 1,
  fallback: 'read',
  favorites: [],
  heard: [],
};

/** Teleprompter sizes, as factors of the base size (big already, for little readers). */
export const TEXT_SIZES = [0.82, 0.91, 1, 1.12, 1.26, 1.42] as const;
export const SPEEDS = [0.85, 1, 1.15] as const;
let cache: DodoSettings | null = null;

function read(): DodoSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  if (cache) return cache;
  try {
    const stored = { ...DEFAULTS, ...(JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<DodoSettings>) };
    stored.textSize = Math.max(0, Math.min(TEXT_SIZES.length - 1, Math.round(Number(stored.textSize) || DEFAULTS.textSize)));
    stored.speed = Math.max(0.85, Math.min(1.15, Number(stored.speed) || 1));
    if (stored.highlight !== 'line') stored.highlight = 'word';
    if (stored.fallback !== 'device') stored.fallback = 'read';
    cache = stored;
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

/* ── Ziggy's recorded voice (static files, see voice.ts) ── */

const timings = new Map<string, Promise<DodoVoiceTiming | null>>();
const known = new Map<string, DodoVoiceTiming | null>();

/** timing.json of a story (null when not recorded yet). Fetched once per visit. */
export function loadTiming(locale: string, storyId: string): Promise<DodoVoiceTiming | null> {
  const key = `${voiceLocale(locale)}/${storyId}`;
  let p = timings.get(key);
  if (!p) {
    // No redirects: a missing file must not turn into the home page (the site redirects unknown paths).
    p = fetch(`${voiceBase(locale, storyId)}/timing.json`, { redirect: 'manual' })
      .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
      .then((j) => parseTiming(j, storyId))
      .catch(() => null)
      .then((t) => {
        known.set(key, t);
        return t;
      });
    timings.set(key, p);
  }
  return p;
}

/** Already fetched timing: undefined while unknown. */
export const knownTiming = (locale: string, storyId: string) => known.get(`${voiceLocale(locale)}/${storyId}`);

/**
 * One story's timing; `ready` turns true once we know whether it is recorded.
 * `known` comes from the page (read when it was built): then nothing is fetched.
 */
export function useTiming(locale: string, storyId: string, known?: DodoVoiceTiming | null): { timing: DodoVoiceTiming | null; ready: boolean } {
  const [state, setState] = useState<{ key: string; timing: DodoVoiceTiming | null } | null>(null);
  const key = `${voiceLocale(locale)}/${storyId}`;
  const look = known === undefined;
  useEffect(() => {
    if (!look) return;
    let alive = true;
    void loadTiming(locale, storyId).then((timing) => alive && setState({ key, timing }));
    return () => {
      alive = false;
    };
  }, [locale, storyId, key, look]);
  if (!look) return { timing: known, ready: true };
  return state?.key === key ? { timing: state.timing, ready: true } : { timing: null, ready: false };
}

/**
 * Every story's timing (durations on the home), fetched quietly once the page
 * is idle, a few at a time. Returns a version number that changes as they arrive.
 */
export function useAllTimings(locale: string, storyIds: string[], enabled = true): number {
  const [version, setVersion] = useState(0);
  const ids = storyIds.join(',');
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const queue = ids.split(',').filter(Boolean);
    const worker = async () => {
      while (alive && queue.length) {
        const id = queue.shift()!;
        await loadTiming(locale, id);
        if (alive) setVersion((v) => v + 1);
      }
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    const go = () => void Promise.all([worker(), worker(), worker()]);
    const handle = w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 2500 }) : window.setTimeout(go, 1200);
    return () => {
      alive = false;
      if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [locale, ids, enabled]);
  return version;
}

/* ── Where each story stopped (this device only) ── */

const POS_KEY = 'ziggy:dodo:pos';

function positions(): Record<string, DodoPosition> {
  try {
    return readPositions(window.localStorage.getItem(POS_KEY));
  } catch {
    return {};
  }
}

export function savedPosition(storyId: string): DodoPosition | undefined {
  if (typeof window === 'undefined') return undefined;
  return positions()[storyId];
}

export function savePosition(storyId: string, seg: number, t: number) {
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify(rememberPosition(positions(), storyId, { seg, t: Math.round(t * 10) / 10, at: Date.now() })));
  } catch {
    /* storage blocked: the story starts from the beginning next time */
  }
}

export function clearPosition(storyId: string) {
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify(forgetPosition(positions(), storyId)));
  } catch {
    /* storage blocked */
  }
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
