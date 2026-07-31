/**
 * Local game progress — stored in this browser's `localStorage` only.
 * Nothing leaves the device.
 */

export const PROGRESS_KEY = 'ziggy:progress';
export const PROGRESS_EVENT = 'ziggy:progress';

export interface GameProgress {
  gameId: string;
  bestScore: number;
  bestStars: number;
  plays: number;
  lastPlayedAt: string;
}

export type ProgressMap = Record<string, GameProgress>;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getProgress(): ProgressMap {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

export function recordGameResult(gameId: string, score: number, stars: number): void {
  if (!isBrowser()) return;
  try {
    const all = getProgress();
    const prev = all[gameId];
    all[gameId] = {
      gameId,
      bestScore: Math.max(prev?.bestScore ?? 0, Number.isFinite(score) ? score : 0),
      bestStars: Math.max(prev?.bestStars ?? 0, Number.isFinite(stars) ? stars : 0),
      plays: (prev?.plays ?? 0) + 1,
      lastPlayedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent<ProgressMap>(PROGRESS_EVENT, { detail: all }));
  } catch {
    /* ignore */
  }
}

export function totalStars(progress: ProgressMap = getProgress()): number {
  return Object.values(progress).reduce((sum, p) => sum + (p.bestStars ?? 0), 0);
}

export function totalPlays(progress: ProgressMap = getProgress()): number {
  return Object.values(progress).reduce((sum, p) => sum + (p.plays ?? 0), 0);
}

export function clearProgress(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(PROGRESS_KEY);
    window.dispatchEvent(new CustomEvent<ProgressMap>(PROGRESS_EVENT, { detail: {} }));
  } catch {
    /* ignore */
  }
}
