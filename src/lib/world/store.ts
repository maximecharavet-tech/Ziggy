'use client';

/**
 * World Memory on this device + sync with the parent account.
 *
 * Guests play from localStorage. When a parent is signed in, the device's
 * memory is merged into the account (never losing progress) and every game
 * result is computed and saved by the server.
 */
import { useSyncExternalStore } from 'react';
import { loadSupabase } from '@/lib/supabase';
import { emptyMemory, normalizeMemory, type WorldMemory } from './memory';

export const WORLD_KEY = 'ziggy:world';
const EVENT = 'ziggy:world';

let cache: WorldMemory | null = null;
let cacheRaw: string | null = null;
const SERVER_SNAPSHOT = emptyMemory();

function read(): WorldMemory {
  if (typeof window === 'undefined') return SERVER_SNAPSHOT;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(WORLD_KEY);
  } catch {
    /* storage blocked */
  }
  if (cache && raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    cache = raw ? normalizeMemory(JSON.parse(raw)) : emptyMemory();
  } catch {
    cache = emptyMemory();
  }
  return cache;
}

export function getMemory(): WorldMemory {
  return read();
}

export function setMemory(m: WorldMemory): void {
  cache = m;
  try {
    cacheRaw = JSON.stringify(m);
    window.localStorage.setItem(WORLD_KEY, cacheRaw);
  } catch {
    cacheRaw = null;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === WORLD_KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** The World Memory, live. Returns the empty memory during server rendering. */
export function useWorldMemory(): WorldMemory {
  return useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT);
}

/** True once mounted in the browser (avoids hydration mismatches for device state). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/* ── API calls to Hyper Engine routes, with the parent's session when there is one ── */

export async function accessToken(): Promise<string | null> {
  const sb = await loadSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const token = await accessToken();
  try {
    const res = await fetch(`/api/ziggy/${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, status: res.status, error: json.error ?? 'error' };
    return { ok: true, data: json };
  } catch {
    return { ok: false, status: 0, error: 'network' };
  }
}

let syncing: Promise<void> | null = null;

/** Merge this device's memory with the account's (when signed in). Safe to call often. */
export function syncWorld(): Promise<void> {
  syncing ??= (async () => {
    try {
      if (!(await accessToken())) return;
      const res = await api<{ memory: WorldMemory }>('progress', { body: { memory: getMemory() } });
      if (res.ok) setMemory(normalizeMemory(res.data.memory));
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}
