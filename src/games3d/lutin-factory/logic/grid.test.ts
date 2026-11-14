import { describe, expect, it } from 'vitest';
import { autoBeltDir, cellLabel, ccw, cw, dirToRel, emptyLayout, opposite, pieceAt, place, relToDir, remove, rotate, setDial } from './grid';
import { DIRS } from './types';
import { P } from './test-helpers';

describe('grid model', () => {
  it('directions turn and relate consistently', () => {
    for (const d of DIRS) {
      expect(cw(ccw(d))).toBe(d);
      expect(opposite(opposite(d))).toBe(d);
      for (const rel of ['front', 'left', 'right', 'back'] as const) expect(dirToRel(d, relToDir(d, rel))).toBe(rel);
    }
    expect(relToDir('E', 'left')).toBe('N');
    expect(relToDir('E', 'right')).toBe('S');
  });

  it('labels cells like the sleigh bays (A1 = top-left)', () => {
    expect(cellLabel([0, 0])).toBe('A1');
    expect(cellLabel([2, 4])).toBe('C5');
  });

  it('places, rotates, sets dials and removes, immutably', () => {
    const l0 = emptyLayout(4, 3, [[3, 2]]);
    const r1 = place(l0, P('painter', 1, 1, 'E', { color: 'blue' }));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(l0.pieces).toHaveLength(0);
    const r2 = rotate(r1.layout, [1, 1]);
    expect(r2.ok && pieceAt(r2.layout, [1, 1])?.dir).toBe('S');
    const r3 = setDial(r1.layout, [1, 1], { color: 'green' });
    expect(r3.ok && pieceAt(r3.layout, [1, 1])?.dial).toEqual({ color: 'green' });
    expect(setDial(r1.layout, [1, 1], { color: 'pink' })).toEqual({ ok: false, why: 'bad-dial' });
    const r4 = remove(r1.layout, [1, 1]);
    expect(r4.ok && r4.layout.pieces).toEqual([]);
  });

  it('refuses kindly: outside, blocked, occupied, locked, unknown', () => {
    const l = { ...emptyLayout(4, 3, [[3, 2]]), pieces: [{ ...P('chute', 0, 1), locked: true }] };
    expect(place(l, P('belt', 5, 1))).toEqual({ ok: false, why: 'outside' });
    expect(place(l, P('belt', 3, 2))).toEqual({ ok: false, why: 'blocked' });
    expect(place(l, P('belt', 0, 1))).toEqual({ ok: false, why: 'occupied' });
    expect(place(l, P('rocket-launcher', 1, 1))).toEqual({ ok: false, why: 'unknown-machine' });
    expect(remove(l, [0, 1])).toEqual({ ok: false, why: 'locked' });
    expect(rotate(l, [0, 1])).toEqual({ ok: false, why: 'locked' });
    expect(setDial(l, [0, 1], { count: 3 })).toEqual({ ok: false, why: 'dial-locked' });
  });

  it('a new belt continues the flow of its neighbour', () => {
    const l = { ...emptyLayout(5, 3), pieces: [P('chute', 0, 1, 'E'), P('sack', 4, 1)] };
    expect(autoBeltDir(l, [1, 1])).toBe('E');
    const l2 = { ...emptyLayout(5, 3), pieces: [P('belt', 2, 0, 'S')] };
    expect(autoBeltDir(l2, [2, 1])).toBe('S');
  });
});

describe('undo / redo history', () => {
  it('undoes and redoes layouts without limit; a new edit clears redo', async () => {
    const { createHistory, push, undo, redo, canUndo, canRedo } = await import('./history');
    let h = createHistory(emptyLayout(4, 3));
    const r = place(h.present, P('belt', 1, 1));
    if (!r.ok) throw new Error('place');
    h = push(h, r.layout);
    expect(h.present.pieces).toHaveLength(1);
    h = undo(h);
    expect(h.present.pieces).toHaveLength(0);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present.pieces).toHaveLength(1);
    h = undo(h);
    h = push(h, emptyLayout(5, 3));
    expect(canRedo(h)).toBe(false);
    expect(canUndo(h)).toBe(true);
    expect(undo(undo(undo(h))).present.w).toBe(4);
  });
});
