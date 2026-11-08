import type { ElfPose } from './types';

/**
 * The elves' poses as plain numbers (no three.js, unit tested). The rig in
 * `elf.ts` blends toward the target of the current pose and adds the living
 * layers (breath, blink, wave swing, laugh bounce) on top.
 *
 * Angles in radians. Index 0 of `arms`/`legs` is the elf's right side
 * (x < 0, picture left when the elf faces the camera), index 1 its left.
 */

export interface ArmState {
  /** Out to the side (0 = hanging down, π/2 = horizontal). */
  raise: number;
  /** Forward (0 = hanging down, π/2 = pointing at the camera). */
  swing: number;
  /** Elbow bend, forearm forward/up. */
  bend: number;
}

export interface LegState {
  /** Forward swing (π/2 = straight out in front, as when sitting). */
  swing: number;
  /** Out to the side. */
  spread: number;
}

export interface PoseState {
  /** 0 = standing, 1 = sitting on the floor. */
  sit: number;
  /** Torso pitch, forward positive. */
  lean: number;
  /** Torso side tilt, toward the elf's left positive. */
  roll: number;
  /** Torso yaw, toward the elf's left positive. */
  turn: number;
  headPitch: number;
  headYaw: number;
  headTilt: number;
  arms: [ArmState, ArmState];
  legs: [LegState, LegState];
  /** ^ ^ closed happy eyes (0..1). */
  happy: number;
  /** Mouth opening (0..1). */
  mouth: number;
  /** Waving hand swing amplitude (0..1). */
  wave: number;
  /** Laugh bounce amplitude (0..1). */
  bounce: number;
  /** Heels up (0..1). */
  tiptoe: number;
}

const arm = (raise: number, swing: number, bend: number): ArmState => ({ raise, swing, bend });
const leg = (swing: number, spread: number): LegState => ({ swing, spread });

/** Arms relaxed, a little away from the body (plush arms never hang straight). */
const REST_ARM = () => arm(0.28, 0.12, 0.25);

/**
 * The base pose of an expression (no oscillation). `side` picks the gesture
 * arm: +1 = the elf's left (picture right), -1 = its right.
 */
export function poseTarget(pose: ElfPose, side: 1 | -1 = 1): PoseState {
  const P: PoseState = {
    sit: 0,
    lean: 0,
    roll: 0,
    turn: 0,
    headPitch: 0.02,
    headYaw: 0,
    headTilt: 0.05,
    arms: [REST_ARM(), REST_ARM()],
    legs: [leg(0, 0.04), leg(0, 0.04)],
    happy: 0,
    mouth: 0,
    wave: 0,
    bounce: 0,
    tiptoe: 0,
  };
  const act = side > 0 ? 1 : 0;
  const other = 1 - act;
  switch (pose) {
    case 'sit':
      P.sit = 1;
      P.lean = -0.08;
      P.legs = [leg(1.45, 0.22), leg(1.45, 0.22)];
      P.arms = [arm(0.5, 0.35, 0.35), arm(0.5, 0.35, 0.35)];
      P.headTilt = 0.12;
      P.headPitch = -0.04;
      break;
    case 'wave':
      P.arms[act] = arm(2.35, 0.25, 0.55);
      P.headTilt = -side * 0.14;
      P.roll = -side * 0.04;
      P.mouth = 0.35;
      P.wave = 1;
      break;
    case 'laugh':
      P.arms = [arm(0.35, 0.75, 1.15), arm(0.35, 0.75, 1.15)];
      P.headPitch = -0.24;
      P.lean = -0.07;
      P.happy = 1;
      P.mouth = 1;
      P.bounce = 1;
      break;
    case 'peek':
      // Hands up on an edge in front (a mug rim, a book), head tilted, curious.
      P.arms = [arm(0.35, 1.25, 0.5), arm(0.35, 1.25, 0.5)];
      P.lean = 0.12;
      P.headTilt = side * 0.24;
      P.headPitch = -0.08;
      P.roll = side * 0.05;
      P.mouth = 0.15;
      break;
    case 'tiptoe':
      // Sneaking: heels up, leaning in, arms up like little paws.
      P.tiptoe = 1;
      P.lean = 0.14;
      P.arms = [arm(0.55, 0.9, 1.25), arm(0.55, 0.9, 1.25)];
      P.legs = [leg(0.25, 0.05), leg(-0.12, 0.05)];
      P.headYaw = side * 0.35;
      P.headPitch = -0.04;
      P.turn = side * 0.08;
      P.mouth = 0.2;
      break;
    case 'point':
      P.arms[act] = arm(0.55, 1.45, 0.05);
      P.arms[other] = arm(0.7, -0.1, 1.6);
      P.turn = side * 0.18;
      P.headYaw = side * 0.28;
      P.headTilt = side * 0.08;
      P.mouth = 0.45;
      break;
    case 'stand':
    default:
      break;
  }
  return P;
}

/** A deep copy (poses are mutated in place while blending). */
export function clonePose(p: PoseState): PoseState {
  return {
    ...p,
    arms: [{ ...p.arms[0] }, { ...p.arms[1] }],
    legs: [{ ...p.legs[0] }, { ...p.legs[1] }],
  };
}

const SCALARS = ['sit', 'lean', 'roll', 'turn', 'headPitch', 'headYaw', 'headTilt', 'happy', 'mouth', 'wave', 'bounce', 'tiptoe'] as const;

/** Moves `cur` toward `target` by `k` (0 = unchanged, 1 = arrived), in place. */
export function blendPose(cur: PoseState, target: PoseState, k: number): PoseState {
  const t = Math.max(0, Math.min(1, Number.isFinite(k) ? k : 0));
  for (const key of SCALARS) cur[key] += (target[key] - cur[key]) * t;
  for (let i = 0; i < 2; i++) {
    const a = cur.arms[i];
    const b = target.arms[i];
    a.raise += (b.raise - a.raise) * t;
    a.swing += (b.swing - a.swing) * t;
    a.bend += (b.bend - a.bend) * t;
    const l = cur.legs[i];
    const m = target.legs[i];
    l.swing += (m.swing - l.swing) * t;
    l.spread += (m.spread - l.spread) * t;
  }
  return cur;
}

/** The pose seen in a mirror (gesture on the other arm). */
export function mirrorPose(p: PoseState): PoseState {
  const m = clonePose(p);
  m.arms = [{ ...p.arms[1] }, { ...p.arms[0] }];
  m.legs = [{ ...p.legs[1] }, { ...p.legs[0] }];
  m.roll = -p.roll;
  m.turn = -p.turn;
  m.headYaw = -p.headYaw;
  m.headTilt = -p.headTilt;
  return m;
}

/** Height of the hips above the floor: standing, sitting, or on tiptoe. */
export function hipHeight(standing: number, seat: number, sit: number, tiptoe: number, heelLift: number): number {
  const s = Math.max(0, Math.min(1, sit));
  return standing + (seat - standing) * s + Math.max(0, Math.min(1, tiptoe)) * heelLift * (1 - s);
}

/** A friendly blink schedule: seconds until the next blink (2.2..5 s), from a 0..1 random. */
export function nextBlink(r: number): number {
  return 2.2 + Math.max(0, Math.min(1, r)) * 2.8;
}

/** Eye openness during a blink that started `t` seconds ago (1 = open), 0.16 s long. */
export function blinkOpen(t: number, length = 0.16): number {
  if (t < 0 || t >= length) return 1;
  const p = t / length;
  return p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
}
