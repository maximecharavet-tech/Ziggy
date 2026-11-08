import { describe, expect, it } from 'vitest';
import { blendPose, blinkOpen, clonePose, hipHeight, mirrorPose, nextBlink, poseTarget, type PoseState } from './poses';
import { ELF_POSES } from './types';

const flat = (p: PoseState) => [
  p.sit,
  p.lean,
  p.roll,
  p.turn,
  p.headPitch,
  p.headYaw,
  p.headTilt,
  p.happy,
  p.mouth,
  p.wave,
  p.bounce,
  p.tiptoe,
  ...p.arms.flatMap((a) => [a.raise, a.swing, a.bend]),
  ...p.legs.flatMap((l) => [l.swing, l.spread]),
];

describe('poseTarget', () => {
  it('gives finite, bounded numbers for every pose and side', () => {
    for (const pose of ELF_POSES)
      for (const side of [1, -1] as const) {
        const values = flat(poseTarget(pose, side));
        for (const v of values) {
          expect(Number.isFinite(v)).toBe(true);
          expect(Math.abs(v)).toBeLessThan(Math.PI);
        }
      }
  });

  it('only "sit" sits, only "laugh" closes the eyes, only "tiptoe" lifts the heels', () => {
    for (const pose of ELF_POSES) {
      const p = poseTarget(pose);
      expect(p.sit).toBe(pose === 'sit' ? 1 : 0);
      expect(p.happy).toBe(pose === 'laugh' ? 1 : 0);
      expect(p.tiptoe).toBe(pose === 'tiptoe' ? 1 : 0);
    }
  });

  it('waves with the chosen arm, high above the shoulder', () => {
    const left = poseTarget('wave', 1);
    const right = poseTarget('wave', -1);
    expect(left.arms[1].raise).toBeGreaterThan(Math.PI / 2);
    expect(left.arms[0].raise).toBeLessThan(0.5);
    expect(right.arms[0].raise).toBeGreaterThan(Math.PI / 2);
    expect(right.arms[1].raise).toBeLessThan(0.5);
  });

  it('a pose on the other side is the mirror image', () => {
    for (const pose of ELF_POSES) {
      const m = mirrorPose(poseTarget(pose, 1));
      const o = poseTarget(pose, -1);
      flat(m).forEach((v, i) => expect(v).toBeCloseTo(flat(o)[i], 9));
    }
  });

  it('is never a sad pose: the mouth never droops and the head never hangs low', () => {
    for (const pose of ELF_POSES) {
      const p = poseTarget(pose);
      expect(p.mouth).toBeGreaterThanOrEqual(0);
      expect(p.headPitch).toBeLessThan(0.2);
    }
  });
});

describe('blendPose', () => {
  it('k = 0 keeps the pose, k = 1 arrives, k = 0.5 is halfway', () => {
    const a = poseTarget('stand');
    const b = poseTarget('laugh');
    expect(flat(blendPose(clonePose(a), b, 0))).toEqual(flat(a));
    flat(blendPose(clonePose(a), b, 1)).forEach((v, i) => expect(v).toBeCloseTo(flat(b)[i], 12));
    const half = flat(blendPose(clonePose(a), b, 0.5));
    half.forEach((v, i) => expect(v).toBeCloseTo((flat(a)[i] + flat(b)[i]) / 2, 12));
  });

  it('clamps bad factors and never touches the target', () => {
    const a = poseTarget('stand');
    const b = poseTarget('sit');
    const before = flat(b);
    expect(flat(blendPose(clonePose(a), b, Number.NaN))).toEqual(flat(a));
    flat(blendPose(clonePose(a), b, 7)).forEach((v, i) => expect(v).toBeCloseTo(before[i], 12));
    expect(flat(b)).toEqual(before);
  });

  it('clonePose is a deep copy', () => {
    const a = poseTarget('point');
    const c = clonePose(a);
    c.arms[1].raise = 99;
    c.legs[0].swing = 99;
    expect(a.arms[1].raise).not.toBe(99);
    expect(a.legs[0].swing).not.toBe(99);
  });
});

describe('hipHeight', () => {
  it('goes from standing to the seat, and up on tiptoe only when standing', () => {
    expect(hipHeight(0.2, 0.06, 0, 0, 0.03)).toBeCloseTo(0.2);
    expect(hipHeight(0.2, 0.06, 1, 0, 0.03)).toBeCloseTo(0.06);
    expect(hipHeight(0.2, 0.06, 0, 1, 0.03)).toBeCloseTo(0.23);
    expect(hipHeight(0.2, 0.06, 1, 1, 0.03)).toBeCloseTo(0.06);
    expect(hipHeight(0.2, 0.06, 5, -3, 0.03)).toBeCloseTo(0.06);
  });
});

describe('blink', () => {
  it('waits 2.2–5 s between blinks', () => {
    expect(nextBlink(0)).toBeCloseTo(2.2);
    expect(nextBlink(1)).toBeCloseTo(5);
    expect(nextBlink(-4)).toBeCloseTo(2.2);
  });

  it('closes then reopens in 0.16 s', () => {
    expect(blinkOpen(-1)).toBe(1);
    expect(blinkOpen(0)).toBe(1);
    expect(blinkOpen(0.08)).toBeCloseTo(0, 6);
    expect(blinkOpen(0.04)).toBeCloseTo(0.5, 6);
    expect(blinkOpen(0.2)).toBe(1);
  });
});
