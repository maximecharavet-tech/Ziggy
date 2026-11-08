'use client';

import { useEffect, useState } from 'react';

/**
 * "Le journal des lutins": every prank picture (and its video) stays on the
 * device, in IndexedDB. Nothing is stored on a server.
 */

export type JournalEntry = {
  id: string;
  createdAt: string;
  /** When the child may discover it (e.g. tomorrow 6:00). */
  revealAt: string;
  caption: string;
  prankId: string | null;
  elves: string[];
  image: Blob;
  video?: Blob | null;
  /** The AI's temporary URL of the picture, to make the video (expires). */
  sourceUrl?: string | null;
  /** The server's signature of `sourceUrl` (only our own pictures can be animated). */
  sourceSig?: string | null;
  seen?: boolean;
  /**
   * Where each elf is in the picture, for the child's "Trouve les lutins" game
   * (marked by the parent in the studio): centre as fractions of the picture's
   * width / height, radius as a fraction of its width. Optional: without it the
   * game asks "Qui a fait la farce ?" instead.
   */
  spots?: { id: string; x: number; y: number; r: number }[];
};

const DB = 'ziggy-lutins';
const STORE = 'journal';
const listeners = new Set<() => void>();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export const journal = {
  async list(): Promise<JournalEntry[]> {
    try {
      const all = await tx<JournalEntry[]>('readonly', (s) => s.getAll() as IDBRequest<JournalEntry[]>);
      return all.sort((a, b) => b.revealAt.localeCompare(a.revealAt));
    } catch {
      return [];
    }
  },
  async put(e: JournalEntry) {
    await tx('readwrite', (s) => s.put(e));
    listeners.forEach((l) => l());
  },
  async patch(id: string, patch: Partial<JournalEntry>) {
    const cur = await tx<JournalEntry | undefined>('readonly', (s) => s.get(id) as IDBRequest<JournalEntry | undefined>);
    if (cur) await journal.put({ ...cur, ...patch });
  },
  async remove(id: string) {
    await tx('readwrite', (s) => s.delete(id));
    listeners.forEach((l) => l());
  },
  async clear() {
    await tx('readwrite', (s) => s.clear());
    listeners.forEach((l) => l());
  },
};

/** The next morning at 6:00 (local time), when the child usually wakes up. */
export function nextMorning(now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + (now.getHours() >= 6 ? 1 : 0));
  d.setHours(6, 0, 0, 0);
  return d;
}

export function useJournal(): { entries: JournalEntry[]; ready: boolean } {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let on = true;
    const load = () =>
      journal.list().then((e) => {
        if (on) {
          setEntries(e);
          setReady(true);
        }
      });
    void load();
    listeners.add(load);
    return () => {
      on = false;
      listeners.delete(load);
    };
  }, []);
  return { entries, ready };
}

/** A random id for this device (fair-use counting only; not linked to anyone). */
export function deviceId(): string {
  try {
    const k = 'ziggy:lutins:device';
    let v = localStorage.getItem(k);
    if (!v || !/^[a-z0-9]{12,40}$/.test(v)) {
      v = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return 'anonymousdevice00';
  }
}
