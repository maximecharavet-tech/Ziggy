'use client';

import { useSyncExternalStore } from 'react';
import type { SantaChild, SantaFamily } from './types';
import { cleanName } from './name';

export { NAME_RE, cleanName } from './name';

/** The family's Santa data, on this device only (localStorage). */
const KEY = 'ziggy:santa:v1';
const EMPTY: SantaFamily = { children: [], activeChildId: null, aiConsentAt: null };

let cache: SantaFamily | null = null;
const listeners = new Set<() => void>();

function read(): SantaFamily {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as Partial<SantaFamily>) : null;
    cache = {
      children: Array.isArray(parsed?.children) ? parsed!.children.filter((c) => c && typeof c.name === 'string' && cleanName(c.name)) : [],
      activeChildId: typeof parsed?.activeChildId === 'string' ? parsed.activeChildId : null,
      aiConsentAt: typeof parsed?.aiConsentAt === 'string' ? parsed.aiConsentAt : null,
    };
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}

function write(next: SantaFamily) {
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

export function useSantaFamily(): SantaFamily {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function activeChild(f: SantaFamily): SantaChild | null {
  return f.children.find((c) => c.id === f.activeChildId) ?? f.children[0] ?? null;
}

export const santaStore = {
  get: read,
  /** Adds a child (or returns the existing one with the same name) and makes it active. */
  addChild(name: string, age: number): SantaChild | null {
    const n = cleanName(name);
    if (!n) return null;
    const f = read();
    const existing = f.children.find((c) => c.name.toLocaleLowerCase() === n.toLocaleLowerCase());
    if (existing) {
      write({ ...f, activeChildId: existing.id });
      return existing;
    }
    const child: SantaChild = { id: Math.random().toString(36).slice(2, 10), name: n, age: Math.min(12, Math.max(2, Math.round(age) || 6)), wishes: [], proud: null };
    write({ ...f, children: [...f.children, child].slice(-3), activeChildId: child.id });
    return child;
  },
  updateChild(id: string, patch: Partial<Omit<SantaChild, 'id'>>) {
    const f = read();
    write({ ...f, children: f.children.map((c) => (c.id === id ? { ...c, ...patch, name: patch.name ? cleanName(patch.name) || c.name : c.name } : c)) });
  },
  removeChild(id: string) {
    const f = read();
    const children = f.children.filter((c) => c.id !== id);
    write({ ...f, children, activeChildId: f.activeChildId === id ? (children[0]?.id ?? null) : f.activeChildId });
  },
  setActive(id: string) {
    write({ ...read(), activeChildId: id });
  },
  setAiConsent(on: boolean) {
    write({ ...read(), aiConsentAt: on ? new Date().toISOString() : null });
  },
  /** Forget everything (parents' area). */
  clear() {
    write({ ...EMPTY });
  },
};
