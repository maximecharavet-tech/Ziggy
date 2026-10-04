/**
 * The mission of the day and the streak of days in a row.
 *
 * The mission is picked from the date itself, so it is the same all day on
 * every device and needs no server. Today's rounds and the streak are kept on
 * this device (localStorage) — a light habit tool, not a record.
 */
import { GAMES } from './games';

export type Mission = { gameId: string; stars: number };

export const TODAY_KEY = 'ziggy:today';
export const STREAK_KEY = 'ziggy:streak';
export const MISSION_EVENT = 'ziggy:mission';

/** Local calendar day, YYYY-MM-DD. */
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Small, stable hash of a string (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Today's mission: one game, and how many stars to earn in it (1 to 3). */
export function missionFor(day: string): Mission {
  const pool = [...GAMES.map((g) => g.id), 'lab', 'palace', 'memo'];
  const h = hash(`ziggy:${day}`);
  return { gameId: pool[h % pool.length], stars: 1 + ((h >>> 8) % 3) };
}

export type TodayLog = { day: string; results: { gameId: string; stars: number }[] };
export type Streak = { last: string | null; count: number; best: number };

export function isDone(mission: Mission, log: TodayLog, day: string): boolean {
  return log.day === day && log.results.some((r) => r.gameId === mission.gameId && r.stars >= mission.stars);
}

/** The day before `day`, as a key. */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

/** Streak after completing the mission on `day`. */
export function advanceStreak(streak: Streak, day: string): Streak {
  if (streak.last === day) return streak;
  const count = streak.last === previousDay(day) ? streak.count + 1 : 1;
  return { last: day, count, best: Math.max(streak.best, count) };
}

/** The streak as it stands today: broken if yesterday's mission was missed. */
export function currentStreak(streak: Streak, day: string): number {
  return streak.last === day || streak.last === previousDay(day) ? streak.count : 0;
}

/* ── Device storage ── */

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readToday(): TodayLog {
  return readJson<TodayLog>(TODAY_KEY, { day: '', results: [] });
}

export function readStreak(): Streak {
  return readJson<Streak>(STREAK_KEY, { last: null, count: 0, best: 0 });
}

/** Called for every finished round (from recordGameResult). */
export function logRound(gameId: string, stars: number): void {
  if (typeof window === 'undefined') return;
  const day = dayKey();
  const log = readToday();
  const next: TodayLog = { day, results: [...(log.day === day ? log.results : []), { gameId, stars }].slice(-50) };
  try {
    window.localStorage.setItem(TODAY_KEY, JSON.stringify(next));
    const mission = missionFor(day);
    if (isDone(mission, next, day)) {
      window.localStorage.setItem(STREAK_KEY, JSON.stringify(advanceStreak(readStreak(), day)));
    }
  } catch {}
  window.dispatchEvent(new CustomEvent(MISSION_EVENT));
}
