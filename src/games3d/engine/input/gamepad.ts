import type { Action, Dir, InputEvent } from './actions';

/**
 * Gamepad API → actions (TV boxes, consoles). Standard mapping:
 * A(0) select · B(1) back · X(2) step · Y(3) rotate · LB(4) hint · RB(5) replay ·
 * Start(9) go · D-pad(12–15) focus · left stick = focus (edge-triggered) ·
 * right stick = pan (continuous).
 *
 * `gamepadActions(prev, cur)` is pure (edge detection on plain snapshots);
 * `GamepadInput.poll()` is called once per frame by the host.
 */

export interface PadSnapshot {
  buttons: boolean[];
  axes: number[];
}

export const STICK_THRESHOLD = 0.5;
const DEAD = 0.2;

const BUTTONS: Record<number, Action> = {
  0: { type: 'select', target: null },
  1: { type: 'back' },
  2: { type: 'step' },
  3: { type: 'rotate' },
  4: { type: 'hint' },
  5: { type: 'replay' },
  9: { type: 'go' },
  12: { type: 'focus', dir: 'up' },
  13: { type: 'focus', dir: 'down' },
  14: { type: 'focus', dir: 'left' },
  15: { type: 'focus', dir: 'right' },
};

function stickDir(x: number, y: number): Dir | null {
  if (Math.max(Math.abs(x), Math.abs(y)) < STICK_THRESHOLD) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

/** Pure: actions produced between two snapshots of one pad. */
export function gamepadActions(prev: PadSnapshot | null, cur: PadSnapshot): Action[] {
  const out: Action[] = [];
  for (const [i, a] of Object.entries(BUTTONS)) {
    const n = Number(i);
    if (cur.buttons[n] && !prev?.buttons[n]) out.push({ ...a });
  }
  const d = stickDir(cur.axes[0] ?? 0, cur.axes[1] ?? 0);
  const pd = prev ? stickDir(prev.axes[0] ?? 0, prev.axes[1] ?? 0) : null;
  if (d && d !== pd) out.push({ type: 'focus', dir: d });
  const rx = cur.axes[2] ?? 0;
  const ry = cur.axes[3] ?? 0;
  if (Math.abs(rx) > DEAD || Math.abs(ry) > DEAD) out.push({ type: 'pan', dx: Math.abs(rx) > DEAD ? rx : 0, dy: Math.abs(ry) > DEAD ? ry : 0 });
  return out;
}

export function snapshot(p: { buttons: readonly { pressed: boolean }[]; axes: readonly number[] }): PadSnapshot {
  return { buttons: p.buttons.map((b) => b.pressed), axes: [...p.axes] };
}

export class GamepadInput {
  private prev = new Map<number, PadSnapshot>();

  constructor(private emit: (e: InputEvent) => void) {}

  /** Read every connected pad; cheap when none is connected. */
  poll(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    let pads: (Gamepad | null)[];
    try {
      pads = navigator.getGamepads();
    } catch {
      return;
    }
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const cur = snapshot(p);
      for (const action of gamepadActions(this.prev.get(p.index) ?? null, cur)) this.emit({ action, source: 'gamepad' });
      this.prev.set(p.index, cur);
    }
  }

  dispose(): void {
    this.prev.clear();
  }
}
