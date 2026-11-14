import { describe, expect, it } from 'vitest';
import type { MouthShape } from '@/games3d/ziggy/face';
import type { SantaSceneHandle } from '@/lib/santa/types';
import {
  EMOTIONS,
  VISEMES,
  WebFallbackAnimator,
  analyseSamples,
  analyseSpectrum,
  classifyFrame,
  createFaceAnimator,
  dbToMagnitudes,
  smoothTowards,
  spectrumFromSamples,
  type FaceFrame,
  type Viseme,
} from './index';
import { EmotionMixer, blendExpression, sanitizeEmotion, weightsFromA2fEmotions } from './emotion';
import { toArkitWeights, toElfMouth, toSantaExpression, toSantaTalk, toZiggyMouth } from './mapping';

const SR = 16000;
const N = 1024;

/** Deterministic noise in -1..1. */
function lcg(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 31 - 1;
  };
}

/** A voiced sound: harmonics of f0 shaped by formants [freq, bandwidth, gain]. */
function voiced(formants: [number, number, number][], start: number, f0 = 150, amp = 0.3): Float32Array {
  const out = new Float32Array(N);
  const env = (f: number) => formants.reduce((a, [F, bw, g]) => a + g * Math.exp(-(((f - F) / bw) ** 2)), 0);
  const amps: number[] = [];
  for (let h = 1; h * f0 < SR / 2; h++) amps.push(env(h * f0));
  const norm = Math.max(...amps);
  for (let i = 0; i < N; i++) {
    const t = (start + i) / SR;
    let s = 0;
    for (let h = 0; h < amps.length; h++) if (amps[h] > 1e-4 * norm) s += (amps[h] / norm) * Math.sin(2 * Math.PI * (h + 1) * f0 * t);
    out[i] = s * amp * 0.25;
  }
  return out;
}

/** f / s: high-passed noise (first difference twice). */
function fricative(start: number, amp = 0.2): Float32Array {
  const r = lcg(start + 7);
  const raw = Array.from({ length: N + 2 }, r);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = (raw[i + 2] - 2 * raw[i + 1] + raw[i]) * amp * 0.25;
  return out;
}

const soundsAt = (f0: number): Record<Exclude<Viseme, 'rest'>, (start: number) => Float32Array> => ({
  AA: (s) => voiced([[750, 150, 1], [1250, 180, 0.8], [2600, 250, 0.15]], s, f0),
  EE: (s) => voiced([[300, 80, 1], [2300, 220, 0.9], [3000, 250, 0.3]], s, f0),
  OO: (s) => voiced([[350, 90, 1], [800, 120, 0.8]], s, f0),
  MM: (s) => voiced([[250, 70, 1]], s, f0, 0.12),
  FF: (s) => fricative(s),
});
const SOUNDS = soundsAt(150);

/** Run an animator over n frames of a sound (60 fps, overlapping windows). */
function run(anim: WebFallbackAnimator, gen: ((start: number) => Float32Array) | null, frames: number, offset = 0): FaceFrame[] {
  const out: FaceFrame[] = [];
  const hop = Math.round(SR / 60);
  for (let k = 0; k < frames; k++) {
    const samples = gen ? gen(offset + k * hop) : new Float32Array(N);
    out.push(anim.update({ dt: 1 / 60, samples, sampleRate: SR }));
  }
  return out;
}

function assertSane(f: FaceFrame) {
  const nums = [f.jaw, f.loudness, ...Object.values(f.visemes), ...Object.values(f.emotion), ...Object.values(f.expression)];
  for (const n of nums) expect(Number.isFinite(n)).toBe(true);
  expect(f.jaw).toBeGreaterThanOrEqual(0);
  expect(f.jaw).toBeLessThanOrEqual(1);
  expect(Object.values(f.visemes).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  expect(Object.values(f.emotion).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  expect(f.expression.headTilt).toBeGreaterThanOrEqual(-1);
  expect(f.expression.headTilt).toBeLessThanOrEqual(1);
}

describe('features', () => {
  it('puts a 1 kHz tone in the right band and estimates rms from the spectrum', () => {
    const s = new Float32Array(N).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 1250 * i) / SR));
    const a = analyseSamples(s, SR);
    expect(a.bands[2]).toBeGreaterThan(0.95);
    expect(a.rms).toBeCloseTo(0.5 / Math.SQRT2, 2);
    const b = analyseSpectrum(spectrumFromSamples(s, SR));
    expect(b.rms).toBeGreaterThan(a.rms * 0.7);
    expect(b.rms).toBeLessThan(a.rms * 1.3);
  });

  it('reads AnalyserNode dB data on the same scale', () => {
    const spec = spectrumFromSamples(SOUNDS.AA(0), SR);
    const db = Array.from(spec.magnitudes, (m) => 20 * Math.log10(m / spec.fftSize));
    const back = analyseSpectrum({ magnitudes: dbToMagnitudes(db, spec.fftSize), sampleRate: SR, fftSize: spec.fftSize });
    const direct = analyseSpectrum(spec);
    expect(back.rms).toBeCloseTo(direct.rms, 6);
    back.bands.forEach((v, i) => expect(v).toBeCloseTo(direct.bands[i], 6));
  });

  it('treats silence, garbage and tiny windows as silent', () => {
    expect(analyseSamples(new Float32Array(N), SR).energy).toBe(0);
    expect(analyseSamples([NaN, Infinity, -Infinity, ...new Array(100).fill(NaN)], SR).rms).toBe(0);
    expect(analyseSamples([0.5, 0.5], SR).rms).toBe(0);
    expect(analyseSamples(new Float32Array(N), undefined).rms).toBe(0);
    expect(analyseSpectrum({ magnitudes: [], sampleRate: SR, fftSize: 1024 }).rms).toBe(0);
  });
});

describe('viseme classification on synthetic frames', () => {
  for (const v of ['AA', 'EE', 'OO', 'MM', 'FF'] as const) {
    it(`recognises ${v} from a single frame (low, mid and high voices)`, () => {
      // 110 Hz ~ Santa, 150 Hz ~ adult, 220 Hz ~ Ziggy / the elves.
      for (const f0 of [110, 150, 220]) {
        const w = classifyFrame(analyseSamples(soundsAt(f0)[v](0), SR), 1);
        const best = (Object.keys(w) as Viseme[]).reduce((a, b) => (w[b] > w[a] ? b : a));
        expect(best, `${v} at ${f0} Hz`).toBe(v);
      }
    });

    it(`settles on ${v} through the animator`, () => {
      const anim = new WebFallbackAnimator();
      // Warm the gain with a loud "a" so quiet sounds (m) are judged against speech, as in real use.
      run(anim, SOUNDS.AA, 20);
      const frames = run(anim, SOUNDS[v], 20, 20 * 267);
      expect(frames.at(-1)!.viseme).toBe(v);
      frames.forEach(assertSane);
    });
  }

  it('opens the jaw most for AA, least for MM', () => {
    const jawOf = (v: keyof typeof SOUNDS) => {
      const anim = new WebFallbackAnimator();
      run(anim, SOUNDS.AA, 20);
      return run(anim, SOUNDS[v], 25, 20 * 267).at(-1)!.jaw;
    };
    const aa = jawOf('AA');
    expect(aa).toBeGreaterThan(0.5);
    expect(aa).toBeGreaterThan(jawOf('OO'));
    expect(jawOf('OO')).toBeGreaterThan(jawOf('MM'));
    expect(jawOf('EE')).toBeGreaterThan(jawOf('MM'));
    expect(jawOf('MM')).toBeLessThan(0.15);
  });

  it('rests on silence', () => {
    const frames = run(new WebFallbackAnimator(), null, 30);
    const last = frames.at(-1)!;
    expect(last.viseme).toBe('rest');
    expect(last.jaw).toBe(0);
    frames.forEach(assertSane);
  });

  it('works from a spectrum and from a bare level too', () => {
    const a = new WebFallbackAnimator();
    let f!: FaceFrame;
    for (let k = 0; k < 20; k++) f = a.update({ dt: 1 / 60, spectrum: spectrumFromSamples(SOUNDS.OO(k * 267), SR) });
    expect(f.viseme).toBe('OO');
    const b = new WebFallbackAnimator();
    for (let k = 0; k < 20; k++) f = b.update({ dt: 1 / 60, level: 0.8 });
    expect(f.jaw).toBeGreaterThan(0.3);
    assertSane(f);
  });
});

describe('smoothing', () => {
  it('rises with the attack and falls with the release time constant', () => {
    expect(smoothTowards(0, 1, 0.03, 0.03, 0.08)).toBeCloseTo(1 - Math.exp(-1), 6);
    expect(smoothTowards(1, 0, 0.08, 0.03, 0.08)).toBeCloseTo(Math.exp(-1), 6);
    expect(smoothTowards(0.4, 0.4, 1, 0.03, 0.08)).toBe(0.4);
    expect(smoothTowards(NaN, 1, NaN, 0.03, 0.08)).toBe(0);
  });

  it('does not snap open on the first loud frame, and closes gradually', () => {
    const anim = new WebFallbackAnimator();
    run(anim, null, 5);
    const up = run(anim, SOUNDS.AA, 15).map((f) => f.jaw);
    expect(up[0]).toBeLessThan(up.at(-1)! * 0.8);
    for (let i = 1; i < up.length; i++) expect(up[i]).toBeGreaterThanOrEqual(up[i - 1] - 0.05);
    const down = run(anim, null, 20).map((f) => f.jaw);
    expect(down[0]).toBeGreaterThan(0.05);
    for (let i = 1; i < down.length; i++) expect(down[i]).toBeLessThanOrEqual(down[i - 1] + 1e-9);
    expect(down.at(-1)!).toBeLessThan(0.02);
  });
});

describe('robustness (no NaN)', () => {
  it('survives NaN / Infinity samples, odd dt and empty input', () => {
    const anim = new WebFallbackAnimator();
    const bad = new Float32Array(N).map((_, i) => (i % 3 === 0 ? NaN : i % 3 === 1 ? Infinity : -Infinity));
    const inputs = [
      { dt: NaN, samples: bad, sampleRate: SR },
      { dt: -1, samples: SOUNDS.AA(0), sampleRate: SR },
      { dt: 1e9, samples: SOUNDS.EE(0), sampleRate: SR },
      { dt: 1 / 60 },
      { dt: 1 / 60, level: NaN },
      { dt: 1 / 60, level: 1e9 },
      { dt: 1 / 60, samples: [], sampleRate: 0 },
      { dt: 1 / 60, spectrum: { magnitudes: [NaN, Infinity, 1], sampleRate: NaN, fftSize: 0 } },
    ];
    for (const i of inputs) assertSane(anim.update(i));
    anim.setEmotion('laugh');
    for (let k = 0; k < 200; k++) assertSane(anim.update({ dt: k % 7 === 0 ? NaN : 1 / 60, samples: k % 2 ? bad : SOUNDS.FF(k), sampleRate: SR }));
  });
});

describe('emotions (never sad)', () => {
  it('maps every negative or unknown label to a happy emotion', () => {
    for (const l of ['sad', 'sadness', 'grief', 'anger', 'fear', 'pain', 'disgust', 'SAD', '', 'whatever']) {
      const e = sanitizeEmotion(l);
      expect(EMOTIONS).toContain(e);
      expect(['smile', 'neutral']).toContain(e);
    }
    expect(sanitizeEmotion('amazement')).toBe('surprise');
    expect(sanitizeEmotion('Laugh')).toBe('laugh');
  });

  it('drops Audio2Face negative emotions entirely', () => {
    const labels = ['amazement', 'anger', 'cheekiness', 'disgust', 'fear', 'grief', 'joy', 'outofbreath', 'pain', 'sadness'];
    const w = weightsFromA2fEmotions(labels, [0, 1, 0, 1, 1, 1, 0, 1, 1, 1]);
    expect(w.neutral).toBe(1);
    const j = weightsFromA2fEmotions(labels, [0.5, 0, 0, 0, 0, 0, 0.9, 0, 0, 1]);
    expect(j.surprise).toBeGreaterThan(0.3);
    expect(j.smile).toBeGreaterThan(0.5);
    expect(Object.values(j).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it('blends presets and never lets the smile drop below the rest smile', () => {
    for (const e of EMOTIONS) expect(blendExpression({ [e]: 1 }).smile).toBeGreaterThanOrEqual(0.28);
    const mix = blendExpression({ smile: 0.5, surprise: 0.5 });
    expect(mix.browUp).toBeGreaterThan(blendExpression({ smile: 1 }).browUp);
    const over = blendExpression({ laugh: 5, wink: 5, surprise: NaN });
    for (const v of Object.values(over)) expect(Number.isFinite(v)).toBe(true);
  });

  it('moves smoothly to a held emotion and plays one-shot cues', () => {
    const m = new EmotionMixer();
    m.hold('laugh');
    const first = m.update(1 / 60).weights.laugh;
    let w = m.update(1 / 60).weights;
    expect(first).toBeLessThan(0.3);
    for (let i = 0; i < 120; i++) w = m.update(1 / 60).weights;
    expect(w.laugh).toBeGreaterThan(0.95);
    m.cue('wink', 0.6);
    let peak = 0;
    for (let i = 0; i < 30; i++) peak = Math.max(peak, m.update(1 / 60).weights.wink);
    expect(peak).toBeGreaterThan(0.6);
    for (let i = 0; i < 120; i++) w = m.update(1 / 60).weights;
    expect(w.wink).toBeLessThan(0.05);
    expect(w.laugh).toBeGreaterThan(0.9);
    m.hold('sad');
    for (let i = 0; i < 120; i++) w = m.update(1 / 60).weights;
    expect(w.smile).toBeGreaterThan(0.95);
  });

  it('a wink closes one eye only', () => {
    const x = blendExpression({ wink: 1 });
    expect(x.blinkL).toBe(1);
    expect(x.blinkR).toBe(0);
  });
});

describe('character mapping', () => {
  const frameFor = (v: keyof typeof SOUNDS) => {
    const anim = new WebFallbackAnimator();
    run(anim, SOUNDS.AA, 20);
    return run(anim, SOUNDS[v], 25, 20 * 267).at(-1)!;
  };

  it('gives Ziggy the matching mouth texture (type-compatible with MouthShape)', () => {
    const shapes: MouthShape[] = (['AA', 'EE', 'OO', 'MM', 'FF'] as const).map((v) => toZiggyMouth(frameFor(v)));
    expect(shapes).toEqual(['open', 'grin', 'o', 'small', 'small']);
    const quiet = run(new WebFallbackAnimator(), null, 10).at(-1)!;
    expect(toZiggyMouth(quiet)).toBe('smile');
  });

  it("drives Santa's setTalk and setExpression (type-compatible)", () => {
    const talk: Parameters<SantaSceneHandle['setTalk']>[0] = toSantaTalk(frameFor('AA'));
    expect(talk).toBeGreaterThan(0.5);
    expect(toSantaTalk(run(new WebFallbackAnimator(), null, 10).at(-1)!)).toBe(0);
    const anim = new WebFallbackAnimator();
    anim.setEmotion('laugh');
    const f = run(anim, null, 90).at(-1)!;
    const e: Parameters<SantaSceneHandle['setExpression']>[0] = toSantaExpression(f);
    expect(e).toBe('laugh');
    expect(toSantaTalk(f)).toBeGreaterThan(0);
  });

  it("opens the elves' mouths in 0..1, less for m than for a", () => {
    for (const elf of ['pepin', 'grelotte', 'noisette'] as const) {
      const a = toElfMouth(frameFor('AA'), elf);
      const m = toElfMouth(frameFor('MM'), elf);
      expect(a).toBeGreaterThan(m);
      expect(a).toBeLessThanOrEqual(1);
      expect(m).toBeGreaterThanOrEqual(0);
    }
  });

  it('exports ARKit weights without any frown', () => {
    const w = toArkitWeights(frameFor('OO'));
    expect(w.mouthPucker).toBeGreaterThan(0.3);
    expect('mouthFrownLeft' in w).toBe(false);
    for (const v of Object.values(w)) expect(Number.isFinite(v)).toBe(true);
  });

  it('createFaceAnimator falls back to the web animator without a valid track', () => {
    expect(createFaceAnimator().kind).toBe('web-fallback');
    expect(createFaceAnimator({ format: 'nope' }).kind).toBe('web-fallback');
  });

  it('VISEMES and EMOTIONS have no sad entry', () => {
    expect([...VISEMES, ...EMOTIONS].some((x) => /sad|grief|cry|anger|fear/i.test(x))).toBe(false);
  });
});
