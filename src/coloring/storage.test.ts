import { describe, expect, it } from 'vitest';
import { ART_VERSION, createMemoryStore, hasContent, isQuotaError, newId, parseArtwork, serializeArtwork, type Artwork } from './storage';
import { emptyDrawing } from './types';

const art = (id = 'art-1', updatedAt = 2000): Artwork => ({
  id,
  pageId: 'ziggy',
  createdAt: 1000,
  updatedAt,
  thumb: 'data:image/png;base64,AAAA',
  drawing: {
    fills: { head: 'green', sky: 'rainbow' },
    strokes: [{ id: 's1', tool: 'glitter', color: 'pink', size: 12.345, pts: [1.234, 2.345, 9.87, 10, 20, 8] }],
    stickers: [{ id: 'k1', e: '⭐', x: 100.04, y: 200.06, s: 72, r: -8.4 }],
  },
});

describe('artwork serialization', () => {
  it('round-trips, rounding coordinates to 0.1', () => {
    const back = parseArtwork(serializeArtwork(art()));
    expect(back).not.toBeNull();
    expect(back!.drawing.fills).toEqual({ head: 'green', sky: 'rainbow' });
    expect(back!.drawing.strokes[0]).toEqual({ id: 's1', tool: 'glitter', color: 'pink', size: 12.3, pts: [1.2, 2.3, 9.9, 10, 20, 8] });
    expect(back!.drawing.stickers[0]).toEqual({ id: 'k1', e: '⭐', x: 100, y: 200.1, s: 72, r: -8 });
    expect(back!.thumb).toBe('data:image/png;base64,AAAA');
  });

  it('is versioned', () => {
    expect(JSON.parse(serializeArtwork(art())).v).toBe(ART_VERSION);
    const old = JSON.parse(serializeArtwork(art()));
    old.v = 999;
    expect(parseArtwork(old)).toBeNull();
  });

  it('rejects garbage without throwing and drops malformed parts', () => {
    expect(parseArtwork('{not json')).toBeNull();
    expect(parseArtwork(null)).toBeNull();
    expect(parseArtwork(42)).toBeNull();
    const raw = JSON.parse(serializeArtwork(art()));
    raw.strokes.push(['bad', 'laser', 'red', 3, [1, 2, 3]], ['s2', 'brush', 'red', 3, [1, 2]]);
    raw.stickers.push(['x', '⭐', 'NaN', 1, 1, 1]);
    raw.fills.bad = 12;
    const back = parseArtwork(raw)!;
    expect(back.drawing.strokes).toHaveLength(1);
    expect(back.drawing.stickers).toHaveLength(1);
    expect(back.drawing.fills.bad).toBeUndefined();
  });

  it('knows when a drawing is empty', () => {
    expect(hasContent(emptyDrawing())).toBe(false);
    expect(hasContent(art().drawing)).toBe(true);
  });

  it('makes unique ids and recognises quota errors', () => {
    expect(newId('art', 1, () => 0.1)).not.toBe(newId('art', 1, () => 0.2));
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError(new Error('x'))).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});

describe('memory store', () => {
  it('saves, lists newest first, reads back and deletes', async () => {
    const store = createMemoryStore();
    expect((await store.put(art('a', 10))).ok).toBe(true);
    expect((await store.put(art('b', 20))).ok).toBe(true);
    const list = await store.list();
    expect(list.map((m) => m.id)).toEqual(['b', 'a']);
    expect('drawing' in list[0]).toBe(false);
    expect((await store.get('a'))?.drawing.fills.head).toBe('green');
    await store.remove('a');
    expect(await store.get('a')).toBeNull();
  });

  it('reports a full store instead of throwing', async () => {
    const size = serializeArtwork(art()).length;
    const store = createMemoryStore(size + 10);
    expect((await store.put(art('a'))).ok).toBe(true);
    expect(await store.put(art('b'))).toEqual({ ok: false, reason: 'quota' });
    // Updating the same artwork still fits.
    expect((await store.put(art('a', 3000))).ok).toBe(true);
  });
});
