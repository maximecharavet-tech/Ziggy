import { describe, expect, it } from 'vitest';
import { MUTE_EVENT, MUTE_KEY, SOFT_KEY, SOUND_NAMES, isMuted, isSoftSounds, playSound, setMuted, setSoftSounds } from '@/lib/sound';

describe('playSound API (outside a browser)', () => {
  it('keeps the historic exports', () => {
    expect(MUTE_KEY).toBe('ziggy:muted');
    expect(MUTE_EVENT).toBe('ziggy:muted');
    expect(SOFT_KEY).toBe('ziggy:soft-sounds');
    expect(SOUND_NAMES).toContain('tap');
  });

  it('is a silent no-op on the server, with or without options', () => {
    expect(() => playSound('tap')).not.toThrow();
    expect(() => playSound('boing', { pitch: 5, volume: 0.5, pan: -1, variation: false })).not.toThrow();
    expect(() => setMuted(true)).not.toThrow();
    expect(() => setSoftSounds(true)).not.toThrow();
    expect(isMuted()).toBe(false);
    expect(isSoftSounds()).toBe(false);
  });
});
