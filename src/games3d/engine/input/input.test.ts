import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYMAP, createKeyMap, keyToAction } from './keyboard';
import { gamepadActions, type PadSnapshot } from './gamepad';
import { isTap, toNdc } from './pointer';

const pad = (pressed: number[] = [], axes: number[] = [0, 0, 0, 0]): PadSnapshot => ({
  buttons: Array.from({ length: 17 }, (_, i) => pressed.includes(i)),
  axes,
});

describe('keyboard → actions', () => {
  it('maps the base keys to semantic actions', () => {
    expect(keyToAction({ key: 'Enter' })).toEqual({ type: 'select', target: null });
    expect(keyToAction({ key: ' ' })).toEqual({ type: 'select', target: null });
    expect(keyToAction({ key: 'ArrowLeft' })).toEqual({ type: 'focus', dir: 'left' });
    expect(keyToAction({ key: 'Escape' })).toEqual({ type: 'back' });
    expect(keyToAction({ key: 'H' })).toEqual({ type: 'hint' });
    expect(keyToAction({ key: '?' })).toEqual({ type: 'hint' });
    expect(keyToAction({ key: '3' })).toEqual({ type: 'pick', index: 2 });
    expect(keyToAction({ key: 'x' })).toBeNull();
  });

  it('works with AZERTY and QWERTY: Q and A both pan left, D pans right', () => {
    expect(keyToAction({ key: 'q' })).toEqual({ type: 'pan', dx: -1, dy: 0 });
    expect(keyToAction({ key: 'a' })).toEqual({ type: 'pan', dx: -1, dy: 0 });
    expect(keyToAction({ key: 'd' })).toEqual({ type: 'pan', dx: 1, dy: 0 });
  });

  it('Ctrl/Cmd+Z undo, +Shift / +Y redo; other shortcuts left to the browser', () => {
    expect(keyToAction({ key: 'z', ctrlKey: true })).toEqual({ type: 'undo' });
    expect(keyToAction({ key: 'Z', metaKey: true, shiftKey: true })).toEqual({ type: 'redo' });
    expect(keyToAction({ key: 'y', ctrlKey: true })).toEqual({ type: 'redo' });
    expect(keyToAction({ key: 'r', ctrlKey: true })).toBeNull();
    expect(keyToAction({ key: 'h', altKey: true })).toBeNull();
  });

  it('game overrides: Factory Space = go, Chaos R = replay, null removes a key', () => {
    const factory = createKeyMap({ ' ': { type: 'go' } });
    expect(keyToAction({ key: ' ' }, factory)).toEqual({ type: 'go' });
    const chaos = createKeyMap({ R: { type: 'replay' }, g: null });
    expect(keyToAction({ key: 'r' }, chaos)).toEqual({ type: 'replay' });
    expect(keyToAction({ key: 'g' }, chaos)).toBeNull();
    // The default map is not mutated.
    expect(DEFAULT_KEYMAP.g).toEqual({ type: 'go' });
  });

  it('returns a copy (callers may mutate it)', () => {
    const a = keyToAction({ key: 'Enter' })!;
    (a as { target: string | null }).target = 'x';
    expect(keyToAction({ key: 'Enter' })).toEqual({ type: 'select', target: null });
  });
});

describe('gamepad → actions', () => {
  it('buttons fire on the press edge only', () => {
    expect(gamepadActions(null, pad([0]))).toEqual([{ type: 'select', target: null }]);
    expect(gamepadActions(pad([0]), pad([0]))).toEqual([]);
    expect(gamepadActions(pad(), pad([1, 9]))).toEqual([{ type: 'back' }, { type: 'go' }]);
    expect(gamepadActions(pad(), pad([14]))).toEqual([{ type: 'focus', dir: 'left' }]);
  });

  it('left stick = edge-triggered focus, right stick = continuous pan with dead zone', () => {
    expect(gamepadActions(pad(), pad([], [0.9, 0.1, 0, 0]))).toEqual([{ type: 'focus', dir: 'right' }]);
    expect(gamepadActions(pad([], [0.9, 0.1, 0, 0]), pad([], [0.95, 0, 0, 0]))).toEqual([]);
    expect(gamepadActions(pad(), pad([], [0, -0.8, 0, 0]))).toEqual([{ type: 'focus', dir: 'up' }]);
    expect(gamepadActions(pad(), pad([], [0, 0, 0.6, 0.1]))).toEqual([{ type: 'pan', dx: 0.6, dy: 0 }]);
    expect(gamepadActions(pad(), pad([], [0.1, 0.1, 0.1, 0.1]))).toEqual([]);
  });
});

describe('pointer', () => {
  it('tap = within 14 px and 450 ms', () => {
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 10, y: 9, t: 300 })).toBe(true);
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 15, y: 0, t: 100 })).toBe(false);
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 451 })).toBe(false);
  });

  it('client point → NDC (y up)', () => {
    const r = { left: 100, top: 50, width: 400, height: 200 };
    expect(toNdc(300, 150, r)).toEqual({ x: 0, y: 0 });
    expect(toNdc(100, 50, r)).toEqual({ x: -1, y: 1 });
    expect(toNdc(500, 250, r)).toEqual({ x: 1, y: -1 });
  });
});
