import { describe, expect, it } from 'vitest';
import { kWeightingCoefficients, maxLoudness, normalisingGain, peakDb } from './meter';
import { CEILING, KNEE, dbToGain, gainToDb, midi, mulberry32, seedOf, softClipCurve } from './math';

const sine = (hz: number, amp: number, seconds: number, sr = 48000) => Float32Array.from({ length: Math.round(seconds * sr) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / sr));

describe('loudness meter (ITU-R BS.1770)', () => {
  it('uses the standard K-weighting coefficients at 48 kHz', () => {
    const [shelf, hp] = kWeightingCoefficients(48000);
    expect(shelf.b0).toBeCloseTo(1.53512485958697, 6);
    expect(shelf.b1).toBeCloseTo(-2.69169618940638, 6);
    expect(shelf.b2).toBeCloseTo(1.19839281085285, 6);
    expect(shelf.a1).toBeCloseTo(-1.69065929318241, 6);
    expect(shelf.a2).toBeCloseTo(0.73248077421585, 6);
    expect(hp.a1).toBeCloseTo(-1.99004745483398, 6);
    expect(hp.a2).toBeCloseTo(0.99007225036621, 6);
  });

  it('reads a full-scale 997 Hz sine in one channel as −3.01 LUFS', () => {
    expect(maxLoudness([sine(997, 1, 1)], 48000, 0.4)).toBeCloseTo(-3.01, 1);
  });

  it('adds both channels of a stereo signal', () => {
    const s = sine(997, 1, 1);
    expect(maxLoudness([s, s], 48000, 0.4)).toBeCloseTo(0, 1);
  });

  it('follows level: −20 dB in, −20 dB out', () => {
    expect(maxLoudness([sine(997, 0.1, 1)], 48000, 0.2)).toBeCloseTo(-23.01, 1);
  });

  it('measures a short blip over the whole window, as a meter would', () => {
    const blip = new Float32Array(48000);
    blip.set(sine(997, 1, 0.05));
    expect(maxLoudness([blip], 48000, 0.4)).toBeLessThan(maxLoudness([blip], 48000, 0.2));
  });

  it('reads peaks in dBFS', () => {
    expect(peakDb([sine(440, 0.5, 0.1)])).toBeCloseTo(-6.02, 1);
    expect(peakDb([new Float32Array(10)])).toBe(-Infinity);
  });

  it('normalises to the loudness target unless the peak would pass the limit', () => {
    expect(gainToDb(normalisingGain(-20, -15, -26, -8))).toBeCloseTo(-6, 6);
    expect(gainToDb(normalisingGain(-30, -10, -20, -8))).toBeCloseTo(2, 6); // peak-limited
    expect(normalisingGain(-Infinity, -Infinity, -20, -8)).toBe(1);
  });
});

describe('soft clipper curve (master bus)', () => {
  const curve = softClipCurve();
  const x = (i: number) => (i / (curve.length - 1)) * 2 - 1;

  it('never outputs more than −3 dBFS', () => {
    expect(CEILING).toBeLessThanOrEqual(dbToGain(-3));
    for (const y of curve) expect(Math.abs(y)).toBeLessThanOrEqual(CEILING);
  });

  it('is a plain wire below the knee', () => {
    for (let i = 0; i < curve.length; i++) if (Math.abs(x(i)) <= KNEE) expect(curve[i]).toBeCloseTo(x(i), 6);
  });

  it('is smooth: monotonic and symmetric', () => {
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
    for (let i = 0; i < curve.length; i++) expect(curve[i]).toBeCloseTo(-curve[curve.length - 1 - i], 6);
  });
});

describe('number helpers', () => {
  it('converts decibels and notes', () => {
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(gainToDb(dbToGain(-13.7))).toBeCloseTo(-13.7, 9);
    expect(midi(69)).toBe(440);
    expect(midi(81)).toBeCloseTo(880, 9);
  });

  it('seeds reproducible random numbers in [0, 1)', () => {
    const a = mulberry32(seedOf('sparkle'));
    const b = mulberry32(seedOf('sparkle'));
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(seedOf('tap')).not.toBe(seedOf('pop'));
  });
});
