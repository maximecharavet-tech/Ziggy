import type { InputEvent } from './actions';

/**
 * Pointer (touch / mouse / pen) → actions. Tap = released within 14 px and
 * 450 ms of the press (as kit `Controls`); a longer move is a drag = `pan`.
 * No multi-touch gestures, no long press: every drag has a tap alternative.
 *
 * A tap emits `select` with the canvas point in NDC (-1..1, y up) and the
 * hotspot id returned by the game's `pick` (a raycast), so pointer taps and
 * the DOM hotspot buttons resolve to the same ids.
 */

export const TAP_SLOP_PX = 14;
export const TAP_MAX_MS = 450;

export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

/** Pure: was this press/release a tap? */
export function isTap(down: PointerSample, up: PointerSample, slop = TAP_SLOP_PX, maxMs = TAP_MAX_MS): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) <= slop && up.t - down.t <= maxMs;
}

/** Pure: client coordinates → NDC inside a rect. */
export function toNdc(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): { x: number; y: number } {
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  return { x: ((clientX - rect.left) / w) * 2 - 1, y: -((clientY - rect.top) / h) * 2 + 1 };
}

export class PointerInput {
  private down: (PointerSample & { id: number; lastX: number; lastY: number; dragging: boolean }) | null = null;

  constructor(
    private el: HTMLElement,
    private emit: (e: InputEvent) => void,
    /** Game raycast: NDC → hotspot id (or null for empty space). */
    private pick: (ndc: { x: number; y: number }) => string | null = () => null,
    /** Allow drags to pan (off for games without a camera pan). */
    public panEnabled = true
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
  }

  setPick(pick: (ndc: { x: number; y: number }) => string | null): void {
    this.pick = pick;
  }

  private onDown = (e: PointerEvent) => {
    if (this.down || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), lastX: e.clientX, lastY: e.clientY, dragging: false };
  };

  private onMove = (e: PointerEvent) => {
    const d = this.down;
    if (!d || e.pointerId !== d.id || !this.panEnabled) return;
    if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP_PX) {
      d.dragging = true;
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
        /* capture is optional */
      }
    }
    if (d.dragging) {
      this.emit({ action: { type: 'pan', dx: e.clientX - d.lastX, dy: e.clientY - d.lastY }, source: 'pointer' });
      d.lastX = e.clientX;
      d.lastY = e.clientY;
    }
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    if (!d || e.pointerId !== d.id) return;
    this.down = null;
    if (d.dragging || !isTap(d, { x: e.clientX, y: e.clientY, t: performance.now() })) return;
    const ndc = toNdc(e.clientX, e.clientY, this.el.getBoundingClientRect());
    this.emit({ action: { type: 'select', target: this.pick(ndc), ndc }, source: 'pointer' });
  };

  private onCancel = () => {
    this.down = null;
  };

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onCancel);
  }
}
