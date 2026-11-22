import { describe, expect, it } from 'vitest';
import { ClickSwallow, DRAG_SLOP_PX, DragGesture } from './drag';
import { TAP_SLOP_PX } from './pointer';

describe('DragGesture (drag on a hotspot or the canvas → pan; tap → select)', () => {
  it('a press released within the slop is a tap, with no pan', () => {
    const g = new DragGesture();
    expect(g.down(1, 100, 100)).toBe(true);
    expect(g.move(1, 105, 108)).toBeNull();
    expect(g.dragging).toBe(false);
    expect(g.up(1)).toBe('tap');
    expect(g.active).toBe(false);
  });

  it('crossing the slop starts a drag and returns the whole distance from the press, then step deltas', () => {
    const g = new DragGesture();
    g.down(1, 100, 100);
    expect(g.move(1, 110, 100)).toBeNull();
    expect(g.move(1, 100 + DRAG_SLOP_PX + 1, 100)).toEqual({ dx: DRAG_SLOP_PX + 1, dy: 0 });
    expect(g.dragging).toBe(true);
    expect(g.move(1, 120, 90)).toEqual({ dx: 120 - (100 + DRAG_SLOP_PX + 1), dy: -10 });
    // Once dragging, even a tiny move pans (no dead zone mid-drag).
    expect(g.move(1, 121, 90)).toEqual({ dx: 1, dy: 0 });
    expect(g.up(1)).toBe('drag');
  });

  it('a drag that comes back to the start is still a drag (never a surprise tap)', () => {
    const g = new DragGesture();
    g.down(1, 0, 0);
    g.move(1, 40, 0);
    g.move(1, 0, 0);
    expect(g.up(1)).toBe('drag');
  });

  it('the first pointer owns the gesture: a second finger is ignored', () => {
    const g = new DragGesture();
    expect(g.down(1, 0, 0)).toBe(true);
    expect(g.down(2, 50, 50)).toBe(false);
    expect(g.move(2, 200, 200)).toBeNull();
    expect(g.up(2)).toBeNull();
    expect(g.active).toBe(true);
    expect(g.up(1)).toBe('tap');
  });

  it('with dragging not allowed (no pan), a long move stays a non-drag press', () => {
    const g = new DragGesture();
    g.down(1, 0, 0);
    expect(g.move(1, 80, 0, false)).toBeNull();
    expect(g.dragging).toBe(false);
    // The caller decides a far release is not a tap (`isTap` checks the distance).
    expect(g.up(1)).toBe('tap');
  });

  it('cancel forgets the press; moves and ups after it do nothing', () => {
    const g = new DragGesture();
    g.down(1, 0, 0);
    g.move(1, 50, 0);
    g.cancel();
    expect(g.move(1, 80, 0)).toBeNull();
    expect(g.up(1)).toBeNull();
    expect(g.down(3, 0, 0)).toBe(true);
  });

  it('is diagonal-aware (distance, not per axis) and shares the canvas tap slop', () => {
    expect(TAP_SLOP_PX).toBe(DRAG_SLOP_PX);
    const g = new DragGesture();
    g.down(1, 0, 0);
    expect(g.move(1, 9, 9)).toBeNull(); // 12.7 px from the press
    expect(g.move(1, 0, 13)).toBeNull(); // 13 px: still a tap
    expect(g.move(1, 11, 11)).not.toBeNull();
  });

  it('start reports the press point while active', () => {
    const g = new DragGesture();
    expect(g.start).toBeNull();
    g.down(7, 12, 34);
    expect(g.start).toEqual({ x: 12, y: 34 });
  });
});

describe('ClickSwallow (the click that ends a drag on a button is not a tap)', () => {
  it('swallows one pointer click right after a drag, then lets clicks through', () => {
    const s = new ClickSwallow(600);
    s.arm(1000);
    expect(s.take(1010, 1)).toBe(true);
    expect(s.take(1020, 1)).toBe(false);
  });

  it('never swallows keyboard / TV OK clicks (detail 0)', () => {
    const s = new ClickSwallow();
    s.arm(0);
    expect(s.take(5, 0)).toBe(false);
    // …and the pointer click of the drag is still caught after it.
    expect(s.take(6, 1)).toBe(true);
  });

  it('expires: a tap long after the drag goes through', () => {
    const s = new ClickSwallow(600);
    s.arm(0);
    expect(s.take(601, 1)).toBe(false);
  });

  it('a new press disarms it (the drag ended off the button, no click came)', () => {
    const s = new ClickSwallow(600);
    s.arm(0);
    s.reset();
    expect(s.take(100, 1)).toBe(false);
  });

  it('does nothing until armed', () => {
    expect(new ClickSwallow().take(0, 1)).toBe(false);
  });
});
