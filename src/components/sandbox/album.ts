/**
 * The album: worlds a child built, kept on this device only (IndexedDB
 * `ziggy-sandbox`, store `snapshots`). Each snapshot is the engine's save bytes
 * plus a small picture. Nothing leaves the device. Every call is safe when
 * IndexedDB is missing or blocked (private mode): it then simply does nothing.
 */
import type { WorldId } from '@/games2d/sandbox/content';

export interface Snapshot {
  id: string;
  world: WorldId;
  /** Grid size, so a snapshot only restores into a world of the same shape. */
  w: number;
  h: number;
  at: number;
  bytes: Uint8Array;
  /** A small PNG of the picture (data URL). */
  thumb: string;
}

/** How many creations the album keeps (the oldest goes when it is full). */
export const ALBUM_SLOTS = 12;

const DB = 'ziggy-sandbox';
const STORE = 'snapshots';

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch {
      resolve(null);
    }
  });
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const all = (await run<Snapshot[]>('readonly', (s) => s.getAll() as IDBRequest<Snapshot[]>)) ?? [];
  return all.sort((a, b) => b.at - a.at);
}

export async function saveSnapshot(snap: Omit<Snapshot, 'id' | 'at'>): Promise<Snapshot | null> {
  const full: Snapshot = { ...snap, id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`, at: Date.now() };
  const ok = await run('readwrite', (s) => s.put(full));
  if (ok === null) return null;
  const all = await listSnapshots();
  for (const old of all.slice(ALBUM_SLOTS)) await deleteSnapshot(old.id);
  return full;
}

export async function deleteSnapshot(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}
