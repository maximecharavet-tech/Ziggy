import type { Action, InputEvent } from './actions';

/**
 * Keyboard → actions. Works with AZERTY and QWERTY by listening to the
 * character (`event.key`): Q and A both pan left, Z and W both mean "up"
 * where a game wants it. The map is data: a game passes overrides
 * (Lutin Factory: Space = go, R = rotate; Lutin Chaos: R = replay).
 *
 * Keys pressed inside a text field are ignored. Arrow keys and Enter/Space
 * on a focused hotspot button are left to the hotspot layer / the browser
 * (a native button click), so nothing fires twice.
 */

export type KeyMap = Record<string, Action | null>;

/** Base map (key = lower-cased `event.key`; ' ' is Space). */
export const DEFAULT_KEYMAP: KeyMap = {
  enter: { type: 'select', target: null },
  ' ': { type: 'select', target: null },
  arrowup: { type: 'focus', dir: 'up' },
  arrowdown: { type: 'focus', dir: 'down' },
  arrowleft: { type: 'focus', dir: 'left' },
  arrowright: { type: 'focus', dir: 'right' },
  escape: { type: 'back' },
  backspace: { type: 'back' },
  h: { type: 'hint' },
  '?': { type: 'hint' },
  l: { type: 'replay' },
  r: { type: 'rotate' },
  z: { type: 'undo' },
  y: { type: 'redo' },
  g: { type: 'go' },
  s: { type: 'step' },
  delete: { type: 'remove' },
  q: { type: 'pan', dx: -1, dy: 0 },
  a: { type: 'pan', dx: -1, dy: 0 },
  d: { type: 'pan', dx: 1, dy: 0 },
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i + 1), { type: 'pick', index: i } as Action])),
};

/** A keymap with game overrides (`null` removes a key). */
export function createKeyMap(overrides: KeyMap = {}): KeyMap {
  const m: KeyMap = { ...DEFAULT_KEYMAP };
  for (const [k, v] of Object.entries(overrides)) {
    const key = k.toLowerCase();
    if (v === null) delete m[key];
    else m[key] = v;
  }
  return m;
}

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
}

/** The action for a key press, or null. Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z / +Y = redo; other shortcuts are left to the browser. */
export function keyToAction(e: KeyLike & { shiftKey?: boolean }, map: KeyMap = DEFAULT_KEYMAP): Action | null {
  const key = (e.key ?? '').toLowerCase();
  if (e.ctrlKey || e.metaKey) {
    if (key === 'z') return e.shiftKey ? { type: 'redo' } : { type: 'undo' };
    if (key === 'y') return { type: 'redo' };
    return null;
  }
  if (e.altKey) return null;
  const a = map[key];
  return a ? { ...a } : null;
}

const TEXT_FIELD = 'input, textarea, select, [contenteditable="true"]';

/** Listens on `window`; calls `emit` with the mapped actions. */
export class KeyboardInput {
  constructor(
    private emit: (e: InputEvent) => void,
    private map: KeyMap = DEFAULT_KEYMAP,
    /** Element whose descendants own their keys (the hotspot layer). */
    private ownKeys?: () => HTMLElement | null
  ) {
    window.addEventListener('keydown', this.onKey);
  }

  setMap(map: KeyMap): void {
    this.map = map;
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.(TEXT_FIELD)) return;
    const k = e.key.toLowerCase();
    const focusKey = k.startsWith('arrow') || k === 'enter' || k === ' ';
    // A focused button (hotspot or HUD) handles Enter/Space itself; the hotspot layer handles arrows.
    if (focusKey && t && t !== document.body && t.closest?.('button, a[href], [role="button"]')) return;
    const own = this.ownKeys?.();
    if (focusKey && own && t && own.contains(t)) return;
    // TV mode: the site's spatial navigation owns the arrows (it moves the DOM focus over the hotspots).
    if (k.startsWith('arrow') && document.documentElement.hasAttribute('data-tv')) return;
    const a = keyToAction(e, this.map);
    if (!a) return;
    if (e.repeat && a.type !== 'pan' && a.type !== 'focus') return;
    e.preventDefault();
    this.emit({ action: a, source: 'keyboard' });
  };

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
  }
}
