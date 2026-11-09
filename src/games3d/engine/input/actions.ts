/**
 * Semantic actions: every device (touch, mouse, keyboard, gamepad, TV remote,
 * switch) produces these, so game code never reads raw events.
 *
 * | Action          | Touch / mouse       | Keyboard          | TV remote | Gamepad      |
 * |-----------------|---------------------|-------------------|-----------|--------------|
 * | select(target)  | tap / hotspot       | Enter / Space     | OK        | A            |
 * | focus(dir)      | —                   | arrows (hotspots) | D-pad     | D-pad/stick  |
 * | pan(dx, dy)     | drag                | Q/A ◀ D ▶         | —         | right stick  |
 * | rotate          | button              | R                 | button    | Y            |
 * | go / step       | buttons             | G / S             | buttons   | Start / X    |
 * | undo / back     | buttons             | Z / Esc           | Back      | B            |
 * | hint / replay   | buttons             | H or ? / L        | buttons   | LB / RB      |
 * | pick(n)         | tray buttons        | 1–9               | —         | —            |
 */

export type Dir = 'up' | 'right' | 'down' | 'left';
export type InputSource = 'pointer' | 'keyboard' | 'gamepad' | 'hotspot' | 'scan' | 'replay' | 'ui';

export type Action =
  /** Activate something: a hotspot id, or (pointer) the canvas point in NDC for the game to pick. */
  | { type: 'select'; target: string | null; ndc?: { x: number; y: number } }
  /** Move the focus between hotspots; `target` is set when the focus already landed (DOM focus). */
  | { type: 'focus'; dir?: Dir; target?: string | null }
  /** Pan the camera; pixels for drag, -1..1 per frame for stick/keys. */
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'rotate' }
  | { type: 'go' }
  | { type: 'step' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'back' }
  | { type: 'hint' }
  | { type: 'replay' }
  | { type: 'remove' }
  /** Pick the n-th entry of a tray / menu (0-based). */
  | { type: 'pick'; index: number };

export type ActionType = Action['type'];

/** An action plus where it came from (for analytics-free debugging and replays). */
export interface InputEvent {
  action: Action;
  source: InputSource;
}

/** Two actions are the same command (used by tests and de-duplication). */
export function sameAction(a: Action, b: Action): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
