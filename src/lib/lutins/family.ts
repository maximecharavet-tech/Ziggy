'use client';

import { useSyncExternalStore } from 'react';
import { activeChild, santaStore, useSantaFamily } from '@/lib/santa/store';

/**
 * The family's Lutins settings, on this device only (localStorage), like the
 * Santa app's store: favourite pranks, the 24-night planner, the elves' arrival
 * and departure days, and which letters were already opened.
 *
 * The child's first name is NOT stored here: it is the Santa app's active child
 * (`useSantaFamily`), so a family types it once for Santa and the elves.
 *
 * Also holds the pure helpers of the ritual (December date maths, the
 * auto-planner, the find-the-elves hit test), tested in family.test.ts.
 */

export type LutinsPlan = Record<string, string>; // 'YYYY-MM-DD' (evening) → prank id

export type LutinsSettings = {
  favs: string[];
  plan: LutinsPlan;
  /** Arrival morning 'YYYY-MM-DD' (null = December 1st). */
  arrival: string | null;
  /** Departure morning: December 24 or 25. */
  departure: 24 | 25;
  /** Letters already opened by the child, e.g. 'arrival-2026'. */
  opened: string[];
};

const KEY = 'ziggy:lutins:v1';
export const EMPTY_SETTINGS: LutinsSettings = { favs: [], plan: {}, arrival: null, departure: 25, opened: [] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9-]{1,40}$/;

/** Parses whatever is stored (old, broken or hand-edited) into valid settings. */
export function parseSettings(raw: string | null): LutinsSettings {
  try {
    const p = raw ? (JSON.parse(raw) as Partial<LutinsSettings>) : null;
    if (!p || typeof p !== 'object') return { ...EMPTY_SETTINGS };
    const plan: LutinsPlan = {};
    if (p.plan && typeof p.plan === 'object') {
      for (const [k, v] of Object.entries(p.plan)) if (DATE_RE.test(k) && typeof v === 'string' && ID_RE.test(v)) plan[k] = v;
    }
    return {
      favs: Array.isArray(p.favs) ? [...new Set(p.favs.filter((x): x is string => typeof x === 'string' && ID_RE.test(x)))].slice(0, 60) : [],
      plan,
      arrival: typeof p.arrival === 'string' && DATE_RE.test(p.arrival) ? p.arrival : null,
      departure: p.departure === 24 ? 24 : 25,
      opened: Array.isArray(p.opened) ? p.opened.filter((x): x is string => typeof x === 'string' && x.length < 40).slice(-40) : [],
    };
  } catch {
    return { ...EMPTY_SETTINGS };
  }
}

let cache: LutinsSettings | null = null;
const listeners = new Set<() => void>();

function read(): LutinsSettings {
  if (cache) return cache;
  let raw: string | null = null;
  try {
    raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  } catch {
    raw = null;
  }
  cache = parseSettings(raw);
  return cache;
}

function write(next: LutinsSettings) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: keep it in memory for this visit */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
}

export function useLutinsSettings(): LutinsSettings {
  return useSyncExternalStore(subscribe, read, () => EMPTY_SETTINGS);
}

export const lutinsStore = {
  get: read,
  toggleFav(id: string) {
    const s = read();
    write({ ...s, favs: s.favs.includes(id) ? s.favs.filter((x) => x !== id) : [...s.favs, id] });
  },
  setPlan(key: string, prankId: string | null) {
    const s = read();
    const plan = { ...s.plan };
    if (prankId) plan[key] = prankId;
    else delete plan[key];
    write({ ...s, plan });
  },
  replacePlan(plan: LutinsPlan) {
    write({ ...read(), plan });
  },
  setArrival(date: string | null) {
    write({ ...read(), arrival: date && DATE_RE.test(date) ? date : null });
  },
  setDeparture(day: 24 | 25) {
    write({ ...read(), departure: day });
  },
  markOpened(id: string) {
    const s = read();
    if (!s.opened.includes(id)) write({ ...s, opened: [...s.opened, id] });
  },
  /** For tests only. */
  _reset() {
    cache = null;
  },
};

/* ── The child's first name: the Santa app's active child (typed once) ── */

export function useChildName(): string | null {
  const f = useSantaFamily();
  return activeChild(f)?.name ?? null;
}

/** Sets (or renames) the active child; '' forgets nothing (use the Santa parents' area). */
export function setChildName(name: string): boolean {
  const cur = activeChild(santaStore.get());
  if (cur) {
    santaStore.updateChild(cur.id, { name });
    return true;
  }
  // The Santa app also asks the age; 6 is its own default until the family sets it there.
  return santaStore.addChild(name, 6) !== null;
}

/* ── December date maths (local time) ── */

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The hour the child's day starts (and the elves' night ends). */
export const MORNING_HOUR = 6;

/** The evening a moment belongs to: 1 a.m. on Dec 5 is still the night of Dec 4. */
export function nightKey(now: Date): string {
  const d = new Date(now);
  if (d.getHours() < MORNING_HOUR) d.setDate(d.getDate() - 1);
  return dateKey(d);
}

/** Which December the family is living (January still belongs to last Christmas). */
export function seasonYear(now: Date): number {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

export type Night = { n: number; key: string };

/** The 24 nights of the planner: the evenings of December 1st to 24th. */
export function decemberNights(year: number): Night[] {
  return Array.from({ length: 24 }, (_, i) => ({ n: i + 1, key: `${year}-12-${pad(i + 1)}` }));
}

/** Tonight's night of the planner (1–24), or null outside those evenings. */
export function tonightNight(now: Date): Night | null {
  const k = nightKey(now);
  const y = seasonYear(now);
  return decemberNights(y).find((n) => n.key === k) ?? null;
}

/** The nights already done: those with a prank in the journal (by the evening it was made). */
export function doneNights(entries: { createdAt: string }[]): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    const t = Date.parse(e.createdAt);
    if (Number.isFinite(t)) out.add(nightKey(new Date(t)));
  }
  return out;
}

/** 'YYYY-MM-DD' → that day at the morning hour, local time. */
export function morningOf(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, MORNING_HOUR, 0, 0, 0);
}

export function arrivalKey(s: Pick<LutinsSettings, 'arrival'>, year: number): string {
  return s.arrival ?? `${year}-12-01`;
}

/**
 * Is the arrival letter there for the child? From the arrival morning on, or
 * as soon as a first prank is in the journal ("first use"), until the
 * departure; once per season.
 */
export function arrivalDue(s: LutinsSettings, now: Date, hasPrank: boolean): boolean {
  const y = seasonYear(now);
  if (s.opened.includes(`arrival-${y}`)) return false;
  if (departureDue({ ...s, opened: [] }, now)) return false;
  return hasPrank || now >= morningOf(arrivalKey(s, y));
}

/** Is the departure letter there? From the departure morning to mid-January. */
export function departureDue(s: LutinsSettings, now: Date): boolean {
  const y = seasonYear(now);
  if (s.opened.includes(`departure-${y}`)) return false;
  return now >= morningOf(`${y}-12-${s.departure}`) && now < new Date(y + 1, 0, 16);
}

/** The letters a child can reopen (already reached this season). */
export function lettersReached(s: LutinsSettings, now: Date, hasPrank: boolean): ('arrival' | 'departure')[] {
  const y = seasonYear(now);
  const out: ('arrival' | 'departure')[] = [];
  if (s.opened.includes(`arrival-${y}`) || arrivalDue(s, now, hasPrank)) out.push('arrival');
  if (s.opened.includes(`departure-${y}`) || departureDue(s, now)) out.push('departure');
  return out;
}

/* ── Favourites first ── */

export function favouritesFirst<T extends { id: string }>(items: T[], favs: string[]): T[] {
  const f = new Set(favs);
  return [...items.filter((x) => f.has(x.id)), ...items.filter((x) => !f.has(x.id))];
}

/* ── The auto-planner: fills the empty nights with varied pranks ── */

/** A small deterministic PRNG (mulberry32), so a seed gives the same plan. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fills the empty nights of `year` (keeps what the parent chose): favourites
 * first, no prank twice in the month while there are unused ones, never the
 * same room two nights in a row when another room is possible, the letter to
 * Santa on the 24th if it is free.
 */
export function autoPlan(plan: LutinsPlan, pranks: { id: string; cat: string }[], favs: string[], year: number, seed = 1): LutinsPlan {
  const out: LutinsPlan = { ...plan };
  const nights = decemberNights(year);
  const used = new Set(Object.values(out));
  const r = rng(seed);
  const shuffled = [...pranks].map((p) => ({ p, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.p);
  const pool = favouritesFirst(shuffled, favs);
  const last = nights[23].key;
  if (!out[last] && pranks.some((p) => p.id === 'lettre-pere-noel') && !used.has('lettre-pere-noel')) {
    out[last] = 'lettre-pere-noel';
    used.add('lettre-pere-noel');
  }
  const catOf = (id: string | undefined) => pranks.find((p) => p.id === id)?.cat;
  for (const night of nights) {
    if (out[night.key]) continue;
    const prev = catOf(out[decemberNights(year)[night.n - 2]?.key]);
    const next = catOf(out[decemberNights(year)[night.n]?.key]);
    let fresh = pool.filter((p) => !used.has(p.id));
    if (!fresh.length) {
      used.clear();
      fresh = pool;
    }
    const pick = fresh.find((p) => p.cat !== prev && p.cat !== next) ?? fresh.find((p) => p.cat !== prev) ?? fresh[0];
    if (!pick) break;
    out[night.key] = pick.id;
    used.add(pick.id);
  }
  return out;
}

/* ── "Trouve les lutins": where the child taps on the picture ── */

/** An elf's spot on the picture: centre (fractions of width / height) and radius (fraction of the width). */
export type ElfSpot = { id: string; x: number; y: number; r: number };

/** The smallest circle a little finger can hit (fraction of the picture's width). */
export const MIN_SPOT_R = 0.075;

const dist = (s: ElfSpot, x: number, y: number, aspect: number) => Math.hypot(x - s.x, (y - s.y) / aspect);

/**
 * The elf (not found yet) under a tap at (x, y), fractions of the picture;
 * `aspect` = width / height of the picture. Generous: the radius is never below
 * MIN_SPOT_R, and when two spots overlap the nearest wins.
 */
export function hitSpot(spots: ElfSpot[], x: number, y: number, aspect: number, found: string[] = []): string | null {
  let best: { id: string; d: number } | null = null;
  for (const s of spots) {
    if (found.includes(s.id)) continue;
    const d = dist(s, x, y, aspect);
    if (d <= Math.max(s.r, MIN_SPOT_R) && (!best || d < best.d)) best = { id: s.id, d };
  }
  return best?.id ?? null;
}

export type Hint = 'left' | 'right' | 'up' | 'down' | 'close';

/** A playful hint towards the nearest elf not found yet ("look a bit more to the right"). */
export function hintFor(spots: ElfSpot[], x: number, y: number, aspect: number, found: string[] = []): Hint | null {
  const left = spots.filter((s) => !found.includes(s.id));
  if (!left.length) return null;
  const s = left.reduce((a, b) => (dist(a, x, y, aspect) <= dist(b, x, y, aspect) ? a : b));
  const dx = s.x - x;
  const dy = (s.y - y) / aspect;
  if (Math.hypot(dx, dy) < Math.max(s.r, MIN_SPOT_R) * 1.6) return 'close';
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** Spots made valid (inside the picture, sane radius, known elves, one per elf). */
export function cleanSpots(raw: unknown, elves: string[]): ElfSpot[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ElfSpot[] = [];
  for (const s of raw as Partial<ElfSpot>[]) {
    if (!s || typeof s.id !== 'string' || !elves.includes(s.id) || seen.has(s.id)) continue;
    const ok = [s.x, s.y, s.r].every((v) => typeof v === 'number' && Number.isFinite(v));
    if (!ok) continue;
    seen.add(s.id);
    out.push({ id: s.id, x: Math.min(1, Math.max(0, s.x!)), y: Math.min(1, Math.max(0, s.y!)), r: Math.min(0.4, Math.max(0.02, s.r!)) });
  }
  return out;
}
