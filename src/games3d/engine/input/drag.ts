/**
 * One press → tap or drag, the gesture logic shared by the canvas
 * (`PointerInput`) and the DOM hotspot buttons (`HotspotLayer`), so a drag
 * that starts on a hotspot pans the camera exactly like one on the canvas,
 * and a tap still activates the hotspot.
 *
 * Pure (no DOM): feed it pointer ids and client coordinates. The first
 * pointer down owns the gesture (no multi-touch); moves past `slop` px turn
 * it into a drag, and every later move returns the pan delta since the last.
 */

export const DRAG_SLOP_PX = 14;

export interface PanDelta {
  dx: number;
  dy: number;
}

export type PressEnd = 'tap' | 'drag';

export class DragGesture {
  private s: { id: number; x: number; y: number; lx: number; ly: number; dragging: boolean } | null = null;

  constructor(public slop = DRAG_SLOP_PX) {}

  /** A press is in progress. */
  get active(): boolean {
    return this.s !== null;
  }

  /** The press moved past the slop. */
  get dragging(): boolean {
    return this.s?.dragging ?? false;
  }

  /** Where the press started (null when idle). */
  get start(): { x: number; y: number } | null {
    return this.s ? { x: this.s.x, y: this.s.y } : null;
  }

  /** Start a press. False (ignored) while another pointer owns the gesture. */
  down(id: number, x: number, y: number): boolean {
    if (this.s) return false;
    this.s = { id, x, y, lx: x, ly: y, dragging: false };
    return true;
  }

  /**
   * A move of the owning pointer. Returns the pan delta once dragging (the
   * whole way from the press on the move that crosses the slop, so no
   * distance is lost), or null (other pointer, still within the slop,
   * or `canDrag` false: the press stays a possible tap).
   */
  move(id: number, x: number, y: number, canDrag = true): PanDelta | null {
    const s = this.s;
    if (!s || s.id !== id) return null;
    if (!s.dragging) {
      if (!canDrag || Math.hypot(x - s.x, y - s.y) <= this.slop) return null;
      s.dragging = true;
    }
    const d = { dx: x - s.lx, dy: y - s.ly };
    s.lx = x;
    s.ly = y;
    return d;
  }

  /** The owning pointer is released: was it a tap or a drag? Null for another pointer. */
  up(id: number): PressEnd | null {
    const s = this.s;
    if (!s || s.id !== id) return null;
    this.s = null;
    return s.dragging ? 'drag' : 'tap';
  }

  /** Forget the press (pointercancel, blur, dispose). */
  cancel(): void {
    this.s = null;
  }
}

/**
 * After a drag that started on a button, the browser may still fire a
 * `click` on it: swallow that one click, but only a pointer click (detail > 0)
 * that arrives soon after the drag and before any new press — Enter/Space/TV
 * OK clicks (detail 0) and later taps always go through.
 */
export class ClickSwallow {
  private until = -1;

  constructor(public windowMs = 600) {}

  /** A drag just ended at time `now` (ms). */
  arm(now: number): void {
    this.until = now + this.windowMs;
  }

  /** A new press started: the drag's click did not come (released off the button), never swallow a later tap. */
  reset(): void {
    this.until = -1;
  }

  /** Should this click be swallowed? Disarms after one swallowed click. */
  take(now: number, detail: number): boolean {
    if (detail === 0 || now > this.until) return false;
    this.until = -1;
    return true;
  }
}
