/**
 * Game progress.
 *
 * Every finished round is kept in localStorage, so a child can play as a guest.
 * When a parent account is signed in, the round is also saved to the database,
 * and guest trophies are carried over the first time they sign in.
 */
import { getSupabase } from './supabase';

export const PROGRESS_KEY = 'ziggy:progress';
export const PROGRESS_EVENT = 'ziggy:progress';
const SYNCED_KEY = 'ziggy:progress-synced';

/** Games scored in moves, where fewer is better. */
export const LOWER_IS_BETTER = new Set(['memory', 'puzzle']);

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

function better(gameId: string, a: number | undefined, b: number): number {
  if (a === undefined) return b;
  return LOWER_IS_BETTER.has(gameId) ? Math.min(a, b) : Math.max(a, b);
}

function emit(map: ProgressMap) {
  window.dispatchEvent(new CustomEvent<ProgressMap>(PROGRESS_EVENT, { detail: map }));
}

export function getProgress(): ProgressMap {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function recordLocally(gameId: string, score: number, stars: number) {
  const all = getProgress();
  const prev = all[gameId];
  all[gameId] = {
    gameId,
    bestScore: better(gameId, prev?.bestScore, score),
    bestStars: Math.max(prev?.bestStars ?? 0, stars),
    plays: (prev?.plays ?? 0) + 1,
    lastPlayedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  emit(all);
}

export function recordGameResult(gameId: string, rawScore: number, rawStars: number): void {
  if (!isBrowser()) return;
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.round(rawScore)) : 0;
  const stars = Number.isFinite(rawStars) ? Math.min(3, Math.max(0, Math.round(rawStars))) : 0;

  const sb = getSupabase();
  void (async () => {
    const session = sb ? (await sb.auth.getSession()).data.session : null;
    if (session && sb) {
      const { error } = await sb.from('game_results').insert({ game_id: gameId, score, stars });
      // Network hiccup: keep the round locally rather than lose it.
      if (!error) {
        emit(getProgress());
        return;
      }
    }
    try {
      recordLocally(gameId, score, stars);
    } catch {
      /* storage blocked — nothing more we can do */
    }
  })();
}

/** Aggregate a signed-in child's rounds into the same shape as local progress. */
export async function fetchAccountProgress(): Promise<ProgressMap | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('game_results')
    .select('game_id, score, stars, created_at')
    .order('created_at', { ascending: true })
    .limit(2000);
  if (error || !data) return null;

  const map: ProgressMap = {};
  for (const r of data) {
    const prev = map[r.game_id];
    map[r.game_id] = {
      gameId: r.game_id,
      bestScore: better(r.game_id, prev?.bestScore, r.score),
      bestStars: Math.max(prev?.bestStars ?? 0, r.stars),
      plays: (prev?.plays ?? 0) + 1,
      lastPlayedAt: r.created_at,
    };
  }
  return map;
}

/**
 * The first time a child signs in on this device, their guest trophies are
 * saved to the account — one row per game, carrying the best result.
 */
export async function syncGuestProgress(userId: string): Promise<void> {
  if (!isBrowser()) return;
  const sb = getSupabase();
  if (!sb) return;
  const flag = `${SYNCED_KEY}:${userId}`;
  if (window.localStorage.getItem(flag)) return;

  const local = Object.values(getProgress());
  if (local.length > 0) {
    const rows = local.map((p) => ({ game_id: p.gameId, score: p.bestScore, stars: p.bestStars }));
    const { error } = await sb.from('game_results').insert(rows);
    if (error) return; // try again next sign-in
    window.localStorage.removeItem(PROGRESS_KEY);
  }
  window.localStorage.setItem(flag, '1');
  emit({});
}

export function totalStars(progress: ProgressMap): number {
  return Object.values(progress).reduce((sum, p) => sum + (p.bestStars ?? 0), 0);
}

export function totalPlays(progress: ProgressMap): number {
  return Object.values(progress).reduce((sum, p) => sum + (p.plays ?? 0), 0);
}
