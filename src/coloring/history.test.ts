import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, push, redo, reset, undo } from './history';

describe('undo / redo history', () => {
  it('starts empty', () => {
    const h = createHistory(0);
    expect(h.present).toBe(0);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('undoes and redoes in order', () => {
    let h = createHistory('a');
    h = push(h, 'b');
    h = push(h, 'c');
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe('c');
    expect(canRedo(h)).toBe(false);
  });

  it('a new action after undo forgets the redo branch', () => {
    let h = createHistory(1);
    h = push(h, 2);
    h = push(h, 3);
    h = undo(h);
    h = push(h, 4);
    expect(h.present).toBe(4);
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe(2);
  });

  it('keeps at least 30 steps and caps the past at the limit', () => {
    let h = createHistory(0, 40);
    for (let i = 1; i <= 100; i++) h = push(h, i);
    expect(h.past.length).toBe(40);
    for (let i = 0; i < 30; i++) h = undo(h);
    expect(h.present).toBe(70);
    for (let i = 0; i < 100; i++) h = undo(h);
    expect(h.present).toBe(60);
    expect(canUndo(h)).toBe(false);
  });

  it('the default limit allows 30+ undos', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 35; i++) h = push(h, i);
    for (let i = 0; i < 35; i++) h = undo(h);
    expect(h.present).toBe(0);
  });

  it('pushing the same value is a no-op; undo/redo at the ends are no-ops', () => {
    const obj = { x: 1 };
    const h = createHistory(obj);
    expect(push(h, obj)).toBe(h);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('reset clears both stacks', () => {
    let h = createHistory(1);
    h = push(h, 2);
    h = undo(h);
    h = reset(h, 9);
    expect(h.present).toBe(9);
    expect(canUndo(h) || canRedo(h)).toBe(false);
  });
});
