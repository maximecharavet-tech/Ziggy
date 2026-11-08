import { describe, expect, it } from 'vitest';
import { actionFrame, arCaption, coverFov, lineupDistance, coverRect, deviceQuaternion, hideScale, HIDE_PERIOD, lightFromSample, pitchOf, qrotate, recentered, yawOf } from './ar-math';

const close = (a: number[], b: number[], eps = 1e-6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], -Math.log10(eps)));

describe('magic camera maths', () => {
  it('estimates the field of view of a cover-fitted camera picture', () => {
    // Landscape 4:3 stream in a tall phone box: the whole height is visible.
    const tall = coverFov(640, 480, 390, 844);
    expect(tall).toBeGreaterThan(40);
    expect(tall).toBeLessThan(60);
    // Portrait stream in the same box: the long side is vertical, wider view.
    expect(coverFov(480, 640, 390, 844)).toBeGreaterThan(tall);
    // A wide box crops the top and bottom of a 4:3 stream: narrower vertical view.
    expect(coverFov(640, 480, 1280, 800)).toBeLessThan(tall);
    expect(coverFov(0, 0, 10, 10)).toBe(60);
    const r = coverRect(640, 480, 390, 844);
    expect(r.sh).toBeCloseTo(480);
    expect(r.sw).toBeCloseTo((390 / 844) * 480);
    expect(r.sx).toBeCloseTo((640 - r.sw) / 2);
  });

  it('stands the line-up far enough to fit a narrow phone picture', () => {
    const phone = lineupDistance(3, 52, 390 / 844, 3.2);
    const wide = lineupDistance(3, 45, 1280 / 800, 3.2);
    expect(phone).toBeGreaterThan(wide);
    // At that distance the row of three (≈ 2.8 wide) takes ≤ 70 % of the picture width.
    const slant = Math.hypot(phone, 3.2);
    const visibleW = 2 * slant * Math.tan((52 * Math.PI) / 360) * (390 / 844);
    expect(2.8 / visibleW).toBeLessThanOrEqual(0.71);
    expect(lineupDistance(1, 60, 1, 3.2)).toBeGreaterThan(0);
    expect(Number.isFinite(lineupDistance(Number.NaN, Number.NaN, Number.NaN, 3.2))).toBe(true);
  });

  it('turns the phone orientation into a camera orientation', () => {
    // Upright phone in portrait (β = 90°): the camera looks at the horizon.
    const up = deviceQuaternion(0, 90, 0, 0);
    close(qrotate(up, [0, 0, -1]), [0, 0, -1]);
    close(qrotate(up, [0, 1, 0]), [0, 1, 0]);
    expect(pitchOf(up)).toBeCloseTo(0);
    // Lying flat, screen up (β = 0): the camera looks at the floor.
    expect(pitchOf(deviceQuaternion(0, 0, 0, 0))).toBeCloseTo(-90);
    // Tilted down 40° from upright.
    expect(pitchOf(deviceQuaternion(0, 50, 0, 0))).toBeCloseTo(-40);
    // Turning around (α = 90°) turns the heading; recentering brings it back to 0.
    const turned = deviceQuaternion(90, 60, 0, 0);
    expect(Math.abs(yawOf(turned))).toBeCloseTo(Math.PI / 2);
    expect(yawOf(recentered(turned, yawOf(turned)))).toBeCloseTo(0);
    expect(pitchOf(recentered(turned, yawOf(turned)))).toBeCloseTo(pitchOf(turned));
    // Landscape (screen turned 90°), phone upright: still the horizon.
    expect(pitchOf(deviceQuaternion(0, 0, -90, 90))).toBeCloseTo(0);
    expect(deviceQuaternion(Number.NaN, Number.NaN, Number.NaN).every(Number.isFinite)).toBe(true);
  });

  it('matches the room light softly', () => {
    const warm = lightFromSample(200, 150, 90);
    expect(warm.sky[0]).toBeGreaterThan(warm.sky[2]);
    expect(Math.min(...warm.sky)).toBeGreaterThanOrEqual(0.55); // never more than half saturated
    const dark = lightFromSample(20, 20, 25);
    const bright = lightFromSample(230, 230, 230);
    expect(dark.exposure).toBeLessThan(bright.exposure);
    expect(dark.exposure).toBeGreaterThanOrEqual(0.55);
    expect(bright.exposure).toBeLessThanOrEqual(1.35);
    expect(lightFromSample(Number.NaN, 0, 0).exposure).toBeGreaterThan(0);
  });

  it('loops the hide-and-reappear and dance actions', () => {
    expect(hideScale(0)).toBe(1);
    expect(hideScale(3)).toBe(0);
    expect(hideScale(2.2)).toBeGreaterThan(0);
    expect(hideScale(2.2)).toBeLessThan(1);
    expect(Math.max(...Array.from({ length: 60 }, (_, i) => hideScale(3.4 + i * 0.01)))).toBeGreaterThan(1); // pop with overshoot
    expect(Math.max(...Array.from({ length: 60 }, (_, i) => hideScale(3.4 + i * 0.01, true)))).toBeLessThanOrEqual(1);
    expect(hideScale(1 + HIDE_PERIOD * 3)).toBe(1);
    const d0 = actionFrame('dance', 0);
    const d1 = actionFrame('dance', 0.7);
    expect(Math.hypot(d0.x, d0.z)).toBeCloseTo(Math.hypot(d1.x, d1.z));
    expect(d0.x !== d1.x || d0.z !== d1.z).toBe(true);
    expect(actionFrame('dance', 0.1, true).hop).toBe(0);
    expect(actionFrame('hide', 3).pose).toBe('peek');
    expect(actionFrame('wave', 5)).toMatchObject({ x: 0, z: 0, scale: 1, pose: 'wave' });
  });

  it('writes captions naming the elves', () => {
    expect(arCaption(['Pépin'], 'fr', 1)).toBe('Chut… Pépin prépare une surprise !');
    expect(arCaption(['Pépin', 'Grelotte', 'Noisette'], 'fr', 1)).toBe('Chut… Pépin, Grelotte et Noisette préparent une surprise !');
    expect(arCaption(['Pip', 'Jingle'], 'en', 2)).toBe('Pip and Jingle are up to mischief in the house!');
    expect(arCaption([], 'en', 0)).toContain('The elves');
    for (let s = 0; s < 8; s++) expect(arCaption(['Hazel'], 'en', s)).toContain('Hazel');
  });
});
