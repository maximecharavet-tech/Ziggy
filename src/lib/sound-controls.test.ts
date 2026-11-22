import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** A tiny browser: localStorage and events, enough for the sound settings. */
const browser = vi.hoisted(() => {
  const store = new Map<string, string>();
  const events: string[] = [];
  (globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: (e: Event) => (events.push(e.type), true),
  };
  return { store, events };
});

vi.mock('./sound', async (importOriginal) => ({ ...(await importOriginal<typeof import('./sound')>()), playSound: vi.fn() }));

import { isMuted, isSoftSounds, MUTE_KEY, playSound, SOFT_KEY } from './sound';
import { createPressTimer, LONG_PRESS_MS, toggleMute, toggleSoft } from './sound-controls';

afterAll(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('sound button: one tap mutes / unmutes', () => {
  beforeEach(() => {
    browser.store.clear();
    vi.mocked(playSound).mockClear();
  });

  it('a tap mutes, the next tap unmutes, with no soft step in between', () => {
    expect(isMuted()).toBe(false);
    expect(toggleMute()).toBe(true);
    expect(browser.store.get(MUTE_KEY)).toBe('1');
    expect(playSound).not.toHaveBeenCalled(); // silence means silence
    expect(toggleMute()).toBe(false);
    expect(browser.store.get(MUTE_KEY)).toBe('0');
    expect(isSoftSounds()).toBe(false);
  });

  it('unmuting plays the little hello, so a child hears what happened', () => {
    toggleMute();
    toggleMute();
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith('pop', { variation: false });
  });

  it('keeps soft sounds across mute / unmute', () => {
    toggleSoft();
    toggleMute();
    toggleMute();
    expect(isSoftSounds()).toBe(true);
  });
});

describe('soft sounds: the secondary control', () => {
  beforeEach(() => {
    browser.store.clear();
    vi.mocked(playSound).mockClear();
  });

  it('switches soft sounds on and off, with a tiny preview at the new level', () => {
    expect(toggleSoft()).toBe(true);
    expect(browser.store.get(SOFT_KEY)).toBe('1');
    expect(playSound).toHaveBeenCalledWith('pop', { variation: false });
    expect(toggleSoft()).toBe(false);
    expect(browser.store.get(SOFT_KEY)).toBe('0');
    expect(playSound).toHaveBeenCalledTimes(2);
  });

  it('never makes a sound while muted, and leaves the mute alone', () => {
    toggleMute();
    vi.mocked(playSound).mockClear();
    expect(toggleSoft()).toBe(true);
    expect(playSound).not.toHaveBeenCalled();
    expect(isMuted()).toBe(true);
  });
});

describe('tap or long press', () => {
  it('waits 500 ms: shorter is a tap, longer is a long press', () => {
    expect(LONG_PRESS_MS).toBeGreaterThanOrEqual(500);
    vi.useFakeTimers();
    try {
      const onLong = vi.fn();
      const press = createPressTimer(onLong);

      press.start();
      vi.advanceTimersByTime(LONG_PRESS_MS - 1);
      press.cancel(); // released: a tap
      expect(onLong).not.toHaveBeenCalled();
      expect(press.takeLong()).toBe(false); // so the click mutes

      press.start();
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(onLong).toHaveBeenCalledTimes(1);
      press.cancel(); // released after the long press
      expect(press.takeLong()).toBe(true); // the click that follows must not mute
      expect(press.takeLong()).toBe(false); // only once
    } finally {
      vi.useRealTimers();
    }
  });

  it('forgets a long press whose click never came (released outside the button)', () => {
    let t = 0;
    vi.useFakeTimers();
    try {
      const press = createPressTimer(() => {}, LONG_PRESS_MS, () => t);
      press.start();
      vi.advanceTimersByTime(LONG_PRESS_MS);
      t = 5_000; // much later, a keyboard Enter: a real tap
      expect(press.takeLong()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
