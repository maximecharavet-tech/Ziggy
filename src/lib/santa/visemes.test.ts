import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VISEME_POSE, cuesAt } from './visemes';
import { SANTA_VOICE, clipFile, staticClipKeys } from '@/data/santa/voice-clips';
import { cueName } from './audio';

describe('lip sync cues (Rhubarb)', () => {
  it('finds the mouth shape at a time', () => {
    const c = 'X0 C6 B13 E20 X55';
    expect(cuesAt(c, -0.1)).toBe('X');
    expect(cuesAt(c, 0.07)).toBe('C');
    expect(cuesAt(c, 0.13)).toBe('B');
    expect(cuesAt(c, 0.3)).toBe('E');
    expect(cuesAt(c, 9)).toBe('X');
  });

  it('rounds the mouth for o/ou and closes it for m/b/p', () => {
    expect(VISEME_POSE.F.wide).toBeLessThan(1);
    expect(VISEME_POSE.A.open).toBe(0);
    expect(VISEME_POSE.D.open).toBeGreaterThan(VISEME_POSE.B.open);
  });

  it('maps a recorded clip URL to its cue name', () => {
    expect(cueName('/santa/voice/fr/line-open.hohoho.mp3?h=1&v=santa-v2')).toBe('line-open.hohoho');
    expect(cueName('/santa/names/fr/hello/lea.mp3?v=santa-v2')).toBeNull();
  });

  it('ships cues for every recorded clip, for this voice', () => {
    for (const loc of ['fr', 'en'] as const) {
      const j = JSON.parse(readFileSync(join(process.cwd(), `public/santa/visemes/${loc}.json`), 'utf8')) as { voice: string; clips: Record<string, string> };
      expect(j.voice).toBe(SANTA_VOICE.voice);
      for (const k of staticClipKeys()) expect(j.clips[clipFile(k)], `${loc} ${k}`).toMatch(/^[A-HX]\d+( [A-HX]\d+)*$/);
    }
  });
});
