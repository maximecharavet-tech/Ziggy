import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage, SaveStore, saveKey, type KVStorage } from './save';

type V1 = { rooms: string[] };
type V2 = { rooms: string[]; costumes: string[] };
type V3 = { done: Record<string, boolean>; costumes: string[] };

const isV3 = (d: unknown): d is V3 => !!d && typeof d === 'object' && typeof (d as V3).done === 'object' && Array.isArray((d as V3).costumes);

const migrations = {
  1: (d: unknown) => ({ ...(d as V1), costumes: [] }) satisfies V2,
  2: (d: unknown) => ({ done: Object.fromEntries((d as V2).rooms.map((r) => [r, true])), costumes: (d as V2).costumes }) satisfies V3,
};

const store = (storage: KVStorage, extra: Partial<ConstructorParameters<typeof SaveStore<V3>>[0]> = {}) =>
  new SaveStore<V3>({ gameId: 'lutin-chaos', version: 3, defaults: () => ({ done: {}, costumes: [] }), migrations, validate: isV3, storage, now: () => 1000, ...extra });

let info: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  info = vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => info.mockRestore());

describe('SaveStore', () => {
  it('fresh save when nothing is stored', () => {
    const s = store(new MemoryStorage());
    expect(s.load()).toEqual({ done: {}, costumes: [] });
    expect(s.lastSource).toBe('fresh');
  });

  it('round-trips under ziggy:game:<id>:v<N>', () => {
    const mem = new MemoryStorage();
    const s = store(mem);
    s.save({ done: { kitchen: true }, costumes: ['scarf'] });
    expect(JSON.parse(mem.getItem(saveKey('lutin-chaos', 3))!)).toEqual({ v: 3, savedAt: 1000, data: { done: { kitchen: true }, costumes: ['scarf'] } });
    expect(store(mem).load()).toEqual({ done: { kitchen: true }, costumes: ['scarf'] });
  });

  it('migrates v1 → v2 → v3, rewrites the current key and removes the old one', () => {
    const mem = new MemoryStorage();
    mem.setItem('ziggy:game:lutin-chaos:v1', JSON.stringify({ v: 1, savedAt: 1, data: { rooms: ['kitchen', 'attic'] } }));
    const s = store(mem);
    expect(s.load()).toEqual({ done: { kitchen: true, attic: true }, costumes: [] });
    expect(s.lastSource).toBe('migrated');
    expect(mem.getItem('ziggy:game:lutin-chaos:v1')).toBeNull();
    expect(JSON.parse(mem.getItem('ziggy:game:lutin-chaos:v3')!).v).toBe(3);
  });

  it('prefers the newest version present', () => {
    const mem = new MemoryStorage();
    mem.setItem('ziggy:game:lutin-chaos:v1', JSON.stringify({ v: 1, savedAt: 1, data: { rooms: ['old'] } }));
    mem.setItem('ziggy:game:lutin-chaos:v2', JSON.stringify({ v: 2, savedAt: 2, data: { rooms: ['new'], costumes: ['hat'] } }));
    expect(store(mem).load()).toEqual({ done: { new: true }, costumes: ['hat'] });
  });

  it('corrupted JSON, wrong envelope or invalid shape → fresh save, no throw', () => {
    for (const raw of ['{not json', 'null', '42', JSON.stringify({ v: 2, data: {} }), JSON.stringify({ v: 3, savedAt: 1, data: { done: 'x' } }), JSON.stringify({ v: 3 })]) {
      const mem = new MemoryStorage();
      mem.setItem('ziggy:game:lutin-chaos:v3', raw);
      const s = store(mem);
      expect(s.load()).toEqual({ done: {}, costumes: [] });
      expect(s.lastSource).toBe('reset');
    }
    expect(info).toHaveBeenCalled();
  });

  it('a missing or throwing migration → fresh save', () => {
    const mem = new MemoryStorage();
    mem.setItem('ziggy:game:lutin-chaos:v1', JSON.stringify({ v: 1, savedAt: 1, data: { rooms: ['k'] } }));
    const s = store(mem, {
      migrations: {
        1: () => {
          throw new Error('bad');
        },
      },
    });
    expect(s.load()).toEqual({ done: {}, costumes: [] });
    expect(s.lastSource).toBe('reset');
  });

  it('storage that throws everywhere (private mode) falls back to memory for the session', () => {
    const broken: KVStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const s = store(broken);
    expect(s.load()).toEqual({ done: {}, costumes: [] });
    expect(s.save({ done: { a: true }, costumes: [] })).toBe(false);
    expect(s.load()).toEqual({ done: { a: true }, costumes: [] });
    expect(() => s.clear()).not.toThrow();
  });

  it('saveSoon debounces to the latest data; flush writes now', () => {
    vi.useFakeTimers();
    try {
      const mem = new MemoryStorage();
      const s = store(mem, { debounceMs: 500 });
      s.saveSoon({ done: { a: true }, costumes: [] });
      s.saveSoon({ done: { b: true }, costumes: [] });
      expect(mem.getItem(s.key)).toBeNull();
      vi.advanceTimersByTime(499);
      expect(mem.getItem(s.key)).toBeNull();
      vi.advanceTimersByTime(1);
      expect(JSON.parse(mem.getItem(s.key)!).data).toEqual({ done: { b: true }, costumes: [] });
      s.saveSoon({ done: { c: true }, costumes: [] });
      s.flush();
      expect(JSON.parse(mem.getItem(s.key)!).data).toEqual({ done: { c: true }, costumes: [] });
    } finally {
      vi.useRealTimers();
    }
  });

  it('clear removes every version', () => {
    const mem = new MemoryStorage();
    mem.setItem('ziggy:game:lutin-chaos:v1', '{}');
    const s = store(mem);
    s.save({ done: {}, costumes: [] });
    s.clear();
    expect(mem.getItem('ziggy:game:lutin-chaos:v1')).toBeNull();
    expect(mem.getItem('ziggy:game:lutin-chaos:v3')).toBeNull();
  });
});
