import { createMemoryStore, isQuotaError, newestFirst, parseArtwork, serializeArtwork, type ArtStore, type ArtworkMeta } from './storage';

/**
 * The artworks live in IndexedDB on this device (plenty of room for PNG
 * thumbnails, nothing is sent anywhere). If IndexedDB is unavailable (some
 * private modes), an in-memory store keeps the session working.
 */

const DB = 'ziggy-coloring';
const STORE = 'artworks';
type Row = ArtworkMeta & { data: string };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        let result: T;
        req.onsuccess = () => {
          result = req.result;
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error ?? req.error);
        tx.onabort = () => reject(tx.error ?? req.error);
      })
  );
}

function createIdbStore(): ArtStore {
  return {
    async list() {
      const rows = await run<Row[]>('readonly', (s) => s.getAll() as IDBRequest<Row[]>);
      return rows.map(({ data: _data, ...meta }) => meta).sort(newestFirst);
    },
    async get(id) {
      const row = await run<Row | undefined>('readonly', (s) => s.get(id) as IDBRequest<Row | undefined>);
      return row ? parseArtwork(row.data) : null;
    },
    async put(art) {
      const row: Row = { id: art.id, pageId: art.pageId, createdAt: art.createdAt, updatedAt: art.updatedAt, thumb: art.thumb, data: serializeArtwork(art) };
      try {
        await run('readwrite', (s) => s.put(row));
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: isQuotaError(e) ? 'quota' : 'unavailable' };
      }
    },
    async remove(id) {
      await run('readwrite', (s) => s.delete(id));
    },
  };
}

let shared: ArtStore | null = null;

/** The device's art store (falls back to memory when IndexedDB is missing or broken). */
export function artStore(): ArtStore {
  if (shared) return shared;
  const memory = createMemoryStore();
  if (typeof indexedDB === 'undefined') return (shared = memory);
  const idb = createIdbStore();
  let broken = false;
  const pick = async <T>(f: (s: ArtStore) => Promise<T>): Promise<T> => {
    if (!broken) {
      try {
        await openDb();
      } catch {
        broken = true;
      }
    }
    return f(broken ? memory : idb);
  };
  shared = {
    list: () => pick((s) => s.list()),
    get: (id) => pick((s) => s.get(id)),
    put: (a) => pick((s) => s.put(a)),
    remove: (id) => pick((s) => s.remove(id)),
  };
  return shared;
}
