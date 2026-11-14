import { describe, expect, it } from 'vitest';
import { createFaceAnimator } from './index';
import { PrecomputedTrackAnimator, visemesFromArkit } from './precomputed';
import { base64ToBytes, bytesToBase64, encodeTrack, sampleTrack, validateTrack, type FaceTrackFile } from './track';

const SHA = 'a'.repeat(64);

/** 1 s at 30 fps: jaw opens then closes; a pucker in the middle. */
function a2fTrack(): FaceTrackFile {
  const rows = Array.from({ length: 30 }, (_, i) => {
    const jaw = Math.sin((i / 29) * Math.PI);
    const pucker = i >= 12 && i <= 17 ? 0.9 : 0;
    return [jaw * (pucker ? 0.3 : 1), pucker, 0, i === 20 ? 1 : 0, 0.4, 0.4, 0.7];
  });
  return encodeTrack({
    id: 'santa/fr/greet-01',
    fps: 30,
    channels: ['jawOpen', 'mouthPucker', 'mouthClose', 'eyeBlinkLeft', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft'],
    rows,
    emotions: [
      [0, 'smile', 0.6],
      [0.5, 'laugh', 1],
    ],
    source: { generator: 'audio2face-3d', model: 'Audio2Face-3D-v3.0/Claire', modelLicense: 'NVIDIA Open Model License', audioSha256: SHA, createdAt: '2026-11-09' },
  });
}

describe('base64', () => {
  it('round-trips every length and rejects garbage', () => {
    for (let n = 0; n < 20; n++) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
      expect(Array.from(base64ToBytes(bytesToBase64(b))!)).toEqual(Array.from(b));
    }
    expect(bytesToBase64(Uint8Array.from([77, 97, 110]))).toBe('TWFu');
    expect(base64ToBytes('abc')).toBeNull();
    expect(base64ToBytes('ab$=')).toBeNull();
    expect(base64ToBytes('a=bc')).toBeNull();
  });
});

describe('track format', () => {
  it('encodes, drops forbidden channels, validates and samples', () => {
    const file = a2fTrack();
    expect(file.channels).not.toContain('mouthFrownLeft');
    expect(file.frames).toBe(30);
    expect(file.duration).toBe(1);
    const r = validateTrack(JSON.parse(JSON.stringify(file)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mid = sampleTrack(r.track, 0.5);
    expect(mid.mouthPucker).toBeCloseTo(0.9, 1);
    const s0 = sampleTrack(r.track, 0);
    expect(s0.jawOpen).toBe(0);
    // Interpolates between frames, clamps outside the clip.
    const a = sampleTrack(r.track, 3 / 30).jawOpen;
    const b = sampleTrack(r.track, 4 / 30).jawOpen;
    const ab = sampleTrack(r.track, 3.5 / 30).jawOpen;
    expect(ab).toBeCloseTo((a + b) / 2, 5);
    expect(sampleTrack(r.track, 99).jawOpen).toBe(sampleTrack(r.track, 1).jawOpen);
    expect(sampleTrack(r.track, NaN).jawOpen).toBe(0);
  });

  it('refuses broken or unsafe tracks with clear errors', () => {
    const good = a2fTrack();
    const cases: [string, unknown][] = [
      ['object', null],
      ['format', { ...good, format: 'x' }],
      ['version', { ...good, version: 2 }],
      ['id must', { ...good, id: '../etc/passwd' }],
      ['fps', { ...good, fps: 1000 }],
      ['duration must equal', { ...good, duration: 5 }],
      ['forbidden', { ...good, channels: ['jawOpen', 'mouthPucker', 'mouthClose', 'eyeBlinkLeft', 'mouthSmileLeft', 'mouthFrownRight'] }],
      ['unknown channel', { ...good, channels: ['jawOpen', 'mouthPucker', 'mouthClose', 'eyeBlinkLeft', 'mouthSmileLeft', 'tail'] }],
      ['duplicate', { ...good, channels: ['jawOpen', 'jawOpen', 'mouthClose', 'eyeBlinkLeft', 'mouthSmileLeft', 'mouthSmileRight'] }],
      ['bytes, expected', { ...good, data: bytesToBase64(new Uint8Array(10)) }],
      ['base64', { ...good, data: '!!!!' }],
      ['not allowed', { ...good, emotions: [[0, 'sad', 1]] }],
      ['sorted', { ...good, emotions: [[0.5, 'smile', 1], [0.1, 'laugh', 1]] }],
      ['weight', { ...good, emotions: [[0, 'smile', 2]] }],
      ['source.model', { ...good, source: { generator: 'audio2face-3d' } }],
      ['audioSha256', { ...good, source: { ...good.source, audioSha256: 'xyz' } }],
      ['frames', { ...good, frames: 0 }],
    ];
    for (const [needle, input] of cases) {
      const r = validateTrack(input);
      expect(r.ok, needle).toBe(false);
      if (!r.ok) expect(r.errors.join(' | '), needle).toContain(needle);
    }
  });

  it('accepts a web-fallback track with viseme channels', () => {
    const f = encodeTrack({ id: 'ziggy/en/hi', fps: 25, channels: ['jaw', 'AA', 'OO'], rows: [[0, 0, 0], [0.5, 1, 0], [0.2, 0, 1]], source: { generator: 'web-fallback' } });
    const r = validateTrack(f);
    expect(r.ok).toBe(true);
  });
});

describe('PrecomputedTrackAnimator', () => {
  it('plays the baked jaw in sync with playback time and derives visemes', () => {
    const anim = createFaceAnimator(a2fTrack());
    expect(anim.kind).toBe('precomputed');
    const quarter = anim.update({ dt: 0, time: 7 / 30 });
    expect(quarter.jaw).toBeGreaterThan(0.6);
    expect(quarter.viseme).toBe('AA');
    const mid = anim.update({ dt: 1 / 60, time: 0.5 });
    expect(mid.viseme).toBe('OO');
    const blink = anim.update({ dt: 1 / 60, time: 20 / 30 });
    expect(blink.expression.blinkL).toBeGreaterThan(0.9);
    expect(blink.expression.smile).toBeGreaterThanOrEqual(0.4 - 1e-6);
  });

  it('follows emotion keys, rests after the end, and stays finite', () => {
    const r = validateTrack(a2fTrack());
    if (!r.ok) throw new Error(r.errors.join());
    const anim = new PrecomputedTrackAnimator(r.track);
    let f = anim.update({ dt: 1 / 60, time: 0 });
    for (let i = 0; i < 60; i++) f = anim.update({ dt: 1 / 60, time: 0.5 + i / 600 });
    expect(f.emotion.laugh).toBeGreaterThan(0.5);
    for (let i = 0; i < 30; i++) f = anim.update({ dt: 1 / 60, time: 2 + i / 60 });
    expect(anim.ended).toBe(true);
    expect(f.viseme).toBe('rest');
    for (const input of [{ dt: NaN }, { dt: 1 / 60, time: NaN }, { dt: -5, time: -3 }]) {
      const x = anim.update(input);
      for (const v of [x.jaw, x.loudness, ...Object.values(x.visemes), ...Object.values(x.expression)]) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('maps ARKit poses to visemes', () => {
    expect(visemesFromArkit({ jawOpen: 0.9 }).visemes.AA).toBeGreaterThan(0.5);
    expect(visemesFromArkit({ mouthClose: 1 }).visemes.MM).toBeGreaterThan(0.5);
    expect(visemesFromArkit({ mouthRollLower: 0.9 }).visemes.FF).toBeGreaterThan(0.5);
    expect(visemesFromArkit({ mouthStretchLeft: 0.6, mouthStretchRight: 0.6 }).visemes.EE).toBeGreaterThan(0.5);
    expect(visemesFromArkit({}).visemes.rest).toBe(1);
  });
});
