'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { SantaTier } from './types';

/**
 * What this family bought, read once per page from /api/santa/status (the
 * pass itself is an HttpOnly cookie the page cannot read). Shared by every
 * component through a module-level cache. When the API fails, the free part
 * still works: tier null.
 */

export type SantaPassState = { tier: SantaTier | null; loading: boolean; aiSecondsLeft: number; exp: number | null };

const INITIAL: SantaPassState = { tier: null, loading: true, aiSecondsLeft: 0, exp: null };

let state: SantaPassState = INITIAL;
let inflight: Promise<void> | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function set(next: SantaPassState) {
  state = next;
  listeners.forEach((l) => l());
}

async function load(): Promise<void> {
  try {
    const res = await fetch('/api/santa/status', { cache: 'no-store', credentials: 'same-origin' });
    const data = res.ok ? ((await res.json()) as Partial<SantaPassState>) : null;
    const tier = data?.tier === 'essentiel' || data?.tier === 'magique' ? data.tier : null;
    set({
      tier,
      loading: false,
      aiSecondsLeft: tier === 'magique' && typeof data?.aiSecondsLeft === 'number' ? Math.max(0, data.aiSecondsLeft) : 0,
      exp: tier && typeof data?.exp === 'number' ? data.exp : null,
    });
  } catch {
    set({ ...INITIAL, loading: false });
  }
}

/** Reads the status again (after a payment, a restore, or a live call). */
export function refreshSantaPass(): Promise<void> {
  loaded = true;
  inflight = load().finally(() => {
    inflight = null;
  });
  return inflight;
}

function ensureLoaded() {
  if (loaded || inflight) return;
  void refreshSantaPass();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => state;
const getServerSnapshot = () => INITIAL;

export function useSantaPass(): SantaPassState & { refresh(): void } {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(ensureLoaded, []);
  return { ...s, refresh: () => void refreshSantaPass() };
}
