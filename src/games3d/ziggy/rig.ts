import type * as THREE from 'three';
import type { MouthShape } from './face';
import type { ZiggyModel } from './model';
import type { ZiggyCue, ZiggyIdle, ZiggyMood } from './types';

/**
 * Brings the plush to life. Every frame a pose is built in layers — breathing
 * and idle play, walking, the current one-shot cue, where Ziggy looks, blinks
 * and talks — then written onto the model. Antennas ride on springs, so they
 * wobble after every hop and nod. Nothing here is ever sad: "oops" is a
 * curious little shrug that ends in a smile.
 */

interface ArmPose {
  up: number;
  fwd: number;
  elbow: number;
  bend: number;
  wrist: number;
}

interface Pose {
  y: number;
  sq: number;
  lean: number;
  sway: number;
  turn: number;
  pitch: number;
  yaw: number;
  roll: number;
  arms: [ArmPose, ArmPose];
  legs: [number, number];
  lift: [number, number];
  open: number;
  happy: boolean;
  brow: number;
  gx: number;
  gy: number;
  mouth: MouthShape;
  heart: number;
}

const CUE_LENGTH: Record<ZiggyCue, number> = { wave: 2.2, cheer: 1.7, jump: 0.95, nod: 1.3, oops: 1.6, think: 2.2, love: 2.2, giggle: 1.1 };

const arm = (): ArmPose => ({ up: 0, fwd: 0, elbow: 0, bend: 0, wrist: 0 });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
/** 0→1→0 envelope with soft in/out over `edge` of the time. */
const envelope = (p: number, edge = 0.15) => smooth(Math.min(1, p / edge, (1 - p) / edge));
/** A hop: 0 on the ground, 1 at the top. */
const hop = (p: number) => Math.max(0, Math.sin(p * Math.PI));

class Spring {
  v = 0;
  x = 0;
  step(target: number, dt: number, k = 140, c = 7) {
    const a = k * (target - this.x) - c * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

export class ZiggyRig {
  idle: ZiggyIdle = 'calm';
  mood: ZiggyMood = 'happy';
  talking = false;
  /** 0 = standing, 1 = walking briskly. */
  walk = 0;
  /** Arms held out in front (carrying presents). */
  carrying = false;
  /** Sitting on a sled: legs forward. */
  seated = false;
  /** Amplitude of all motion (reduced motion: about 0.35). */
  energy = 1;
  /** Called when a cue starts (for sparkles, sounds…). */
  onCue: ((cue: ZiggyCue) => void) | null = null;

  private t = 0;
  private cueKind: ZiggyCue | null = null;
  private cueT = 0;
  private nextWave = 0.8;
  private blinkAt = 1.5;
  private blinkT = -1;
  private doubleBlink = false;
  private walkPhase = 0;
  private talkT = 0;
  private talkShape: MouthShape = 'open';
  private look = { x: 0, y: 0, tx: 0, ty: 0, idleAt: 0, wanderAt: 0 };
  private springs = [new Spring(), new Spring(), new Spring(), new Spring()];
  private prev = { y: 0, pitch: 0, roll: 0, vy: 0, vp: 0, vr: 0 };
  private pose: Pose = this.basePose();

  constructor(private model: ZiggyModel) {}

  cue(kind: ZiggyCue) {
    this.cueKind = kind;
    this.cueT = 0;
    this.onCue?.(kind);
  }

  get busy() {
    return this.cueKind !== null;
  }

  /** Look toward a point given in -1..1 (x right, y up), e.g. the pointer. */
  lookAt(x: number, y: number) {
    this.look.tx = Math.max(-1.2, Math.min(1.2, x));
    this.look.ty = Math.max(-1, Math.min(1, y));
    this.look.idleAt = this.t;
  }

  private basePose(): Pose {
    return { y: 0, sq: 0, lean: 0, sway: 0, turn: 0, pitch: 0, yaw: 0, roll: 0, arms: [arm(), arm()], legs: [0, 0], lift: [0, 0], open: 1, happy: false, brow: 0, gx: 0, gy: 0, mouth: 'smile', heart: 0 };
  }

  update(dt: number) {
    dt = Math.min(dt, 0.05);
    this.t += dt;
    const t = this.t;
    const E = this.energy;
    const P = this.basePose();
    const [L, R] = P.arms;

    // --- Mood: the resting face.
    P.mouth = this.mood === 'excited' ? 'grin' : this.mood === 'calm' ? 'small' : this.mood === 'sleepy' ? 'sleep' : 'smile';
    if (this.mood === 'curious') P.brow = 0.6;
    if (this.mood === 'excited') P.brow = 0.35;
    if (this.mood === 'sleepy') P.open = 0.5;

    // --- Breathing and idle play.
    const breathe = Math.sin(t * 2.1);
    P.sq += breathe * 0.012 * E;
    P.sway += Math.sin(t * 0.9) * 0.025 * E;
    P.roll += Math.sin(t * 0.7 + 1) * 0.03 * E;
    L.up = 0.04 + Math.sin(t * 2.1) * 0.03 * E;
    R.up = 0.04 + Math.sin(t * 2.1 + 0.4) * 0.03 * E;
    L.bend = R.bend = 0.12;

    if (this.idle === 'dance' && !this.seated) {
      const b = t * Math.PI * 2.2;
      P.y += Math.abs(Math.sin(b)) * 0.09 * E;
      P.sq -= Math.abs(Math.sin(b)) * 0.03 * E;
      P.sway += Math.sin(b) * 0.14 * E;
      P.roll += Math.sin(b) * 0.12 * E;
      P.pitch += Math.cos(b * 2) * 0.05 * E;
      L.up = 1.2 + Math.sin(b) * 0.9 * E;
      R.up = 1.2 - Math.sin(b) * 0.9 * E;
      L.bend = R.bend = 0.6;
      P.lift = [Math.max(0, Math.sin(b)) * 0.07 * E, Math.max(0, -Math.sin(b)) * 0.07 * E];
      P.mouth = 'grin';
      P.happy = Math.sin(t * 0.8) > 0.6;
      P.heart = 0.4 + Math.abs(Math.sin(b)) * 0.6;
    } else if (this.idle === 'sleep') {
      P.open = 0;
      P.mouth = 'sleep';
      P.pitch = 0.22;
      P.roll = 0.16 + Math.sin(t * 0.8) * 0.02;
      P.sq += Math.sin(t * 1.3) * 0.02;
      L.up = R.up = -0.05;
      P.heart = -0.5;
    } else if (this.idle === 'wave' && !this.cueKind && t > this.nextWave) {
      this.cue('wave');
      this.nextWave = t + CUE_LENGTH.wave + 4 + Math.random() * 3;
    }

    // --- Walking (games), carrying, sitting.
    if (this.walk > 0.01) {
      const k = Math.min(1.3, this.walk);
      this.walkPhase += dt * (6 + 5 * k);
      const s = Math.sin(this.walkPhase);
      P.legs = [s * 0.5 * k, -s * 0.5 * k];
      P.lift = [Math.max(0, s) * 0.05 * k, Math.max(0, -s) * 0.05 * k];
      P.y += Math.abs(Math.cos(this.walkPhase)) * 0.05 * k;
      P.lean += 0.09 * k;
      P.roll += s * 0.05 * k;
      L.fwd = -s * 0.45 * k;
      R.fwd = s * 0.45 * k;
    }
    if (this.carrying) {
      L.fwd = R.fwd = 1.15;
      L.up = R.up = -0.12;
      L.bend = R.bend = 0.35;
    }
    if (this.seated) {
      P.legs = [-1.35, -1.35];
      P.y -= 0.32;
      L.fwd = R.fwd = 0.55;
      L.bend = R.bend = 0.5;
    }

    // --- The one-shot cue on top.
    if (this.cueKind) {
      const len = CUE_LENGTH[this.cueKind];
      this.cueT += dt;
      const p = Math.min(1, this.cueT / len);
      this.applyCue(this.cueKind, p, P, E);
      if (p >= 1) this.cueKind = null;
    }

    // --- Looking around: the pointer, or little glances on its own.
    const lk = this.look;
    if (t - lk.idleAt > 3 && t > lk.wanderAt) {
      lk.tx = (Math.random() * 2 - 1) * 0.7;
      lk.ty = (Math.random() * 2 - 1) * 0.35;
      lk.wanderAt = t + 1.5 + Math.random() * 2.5;
    }
    const ease = 1 - Math.exp(-dt * 7);
    lk.x += (lk.tx - lk.x) * ease;
    lk.y += (lk.ty - lk.y) * ease;
    if (this.idle !== 'sleep') {
      P.yaw += lk.x * 0.42;
      P.pitch += -lk.y * 0.22;
      P.gx += lk.x * 0.9;
      P.gy += lk.y * 0.75;
    }

    // --- Blinking (never while asleep or with happy eyes).
    if (this.idle !== 'sleep' && P.open > 0.05 && !P.happy) {
      if (this.blinkT < 0 && t > this.blinkAt) {
        this.blinkT = 0;
        this.doubleBlink = Math.random() < 0.2;
      }
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        const d = 0.16;
        const q = this.blinkT / d;
        if (q >= 1) {
          if (this.doubleBlink) {
            this.doubleBlink = false;
            this.blinkT = -0.0001;
            this.blinkAt = t + 0.08;
          } else {
            this.blinkT = -1;
            this.blinkAt = t + (this.mood === 'sleepy' ? 1.5 : 2.2) + Math.random() * 3;
          }
        } else P.open *= 1 - Math.sin(q * Math.PI);
      }
    }

    // --- Talking: the mouth chatters through open shapes.
    if (this.talking && this.idle !== 'sleep') {
      this.talkT -= dt;
      if (this.talkT <= 0) {
        const shapes: MouthShape[] = ['open', 'o', 'grin', 'smile', 'open', 'small'];
        this.talkShape = shapes[Math.floor(Math.random() * shapes.length)];
        this.talkT = 0.07 + Math.random() * 0.1;
      }
      P.mouth = this.talkShape;
      P.pitch += Math.sin(t * 9) * 0.02;
    }

    this.pose = P;
    this.write(dt);
  }

  private applyCue(kind: ZiggyCue, p: number, P: Pose, E: number) {
    const w = envelope(p);
    const [L, R] = P.arms;
    switch (kind) {
      case 'wave': {
        // Hand up beside the head (not behind it), forearm upright, waving from the wrist.
        R.up = lerp(R.up, 1.9, w);
        R.bend = lerp(R.bend, 0.95, w);
        R.fwd = lerp(R.fwd, 0.3, w);
        R.wrist = Math.sin(p * Math.PI * 7) * 0.55 * w * E;
        R.elbow = Math.sin(p * Math.PI * 7 + 0.6) * 0.25 * w * E;
        P.roll = lerp(P.roll, -0.1, w);
        P.sway = lerp(P.sway, 0.05, w);
        P.mouth = 'grin';
        P.brow = lerp(P.brow, 0.4, w);
        break;
      }
      case 'cheer': {
        // Crouch, spring up with both arms high, land with a squash.
        const crouch = p < 0.18 ? smooth(p / 0.18) : p < 0.25 ? 1 - smooth((p - 0.18) / 0.07) : 0;
        const air = p > 0.22 && p < 0.72 ? hop((p - 0.22) / 0.5) : 0;
        const land = p > 0.72 && p < 0.86 ? Math.sin(((p - 0.72) / 0.14) * Math.PI) : 0;
        P.sq += (-0.12 * crouch + 0.08 * air - 0.1 * land) * E;
        P.y += 0.42 * air * E;
        L.up = lerp(L.up, 2.7, w);
        R.up = lerp(R.up, 2.7, w);
        L.bend = R.bend = lerp(0.12, 0.35, w);
        L.wrist = R.wrist = Math.sin(p * 30) * 0.3 * w;
        P.happy = p > 0.15 && p < 0.92;
        P.mouth = 'grin';
        P.brow = 0.6 * w;
        P.heart += 1.6 * w;
        P.pitch -= 0.1 * air;
        break;
      }
      case 'jump': {
        const crouch = p < 0.2 ? Math.sin((p / 0.2) * Math.PI) : 0;
        const air = p > 0.2 && p < 0.75 ? hop((p - 0.2) / 0.55) : 0;
        const land = p > 0.75 ? Math.sin(((p - 0.75) / 0.25) * Math.PI) : 0;
        P.sq += (-0.1 * crouch + 0.07 * air - 0.08 * land) * E;
        P.y += 0.3 * air * E;
        L.up = lerp(L.up, 0.9, air);
        R.up = lerp(R.up, 0.9, air);
        P.mouth = air > 0.2 ? 'open' : 'grin';
        P.heart += 0.6 * w;
        break;
      }
      case 'nod': {
        const n = Math.sin(p * Math.PI * 4) * (1 - p);
        P.pitch += 0.22 * n * E;
        P.roll += 0.08 * w;
        P.brow = lerp(P.brow, 0.35, w);
        P.mouth = 'smile';
        R.up = lerp(R.up, 0.35, w);
        R.fwd = lerp(R.fwd, 0.5, w);
        break;
      }
      case 'oops': {
        // A curious shrug: head tilts, arms open, "oh!", then a smile.
        P.roll += 0.22 * w * E;
        L.up = lerp(L.up, 0.75, w);
        R.up = lerp(R.up, 0.75, w);
        L.bend = R.bend = lerp(0.12, 0.9, w);
        L.fwd = R.fwd = lerp(0, 0.4, w);
        P.sq += Math.sin(p * Math.PI * 2) * 0.02 * w;
        P.brow = 0.8 * w;
        P.open = lerp(P.open, 1, w);
        P.mouth = p < 0.6 ? 'o' : 'smile';
        P.gy -= 0.4 * w * (p < 0.5 ? 1 : 0);
        break;
      }
      case 'think': {
        R.up = lerp(R.up, -0.35, w);
        R.fwd = lerp(R.fwd, 1.25, w);
        R.bend = lerp(R.bend, 1.9, w);
        P.pitch -= 0.14 * w;
        P.roll += 0.12 * w;
        P.gx = lerp(P.gx, -0.6, w);
        P.gy = lerp(P.gy, 0.7, w);
        P.brow = 0.5 * w;
        P.mouth = 'small';
        break;
      }
      case 'love': {
        L.up = lerp(L.up, -0.45, w);
        R.up = lerp(R.up, -0.45, w);
        L.fwd = R.fwd = lerp(0, 1.0, w);
        L.bend = R.bend = lerp(0.12, 1.25, w);
        P.happy = p > 0.1 && p < 0.92;
        P.roll += Math.sin(p * Math.PI * 2) * 0.12 * w;
        P.mouth = 'smile';
        P.heart += (1.5 + Math.abs(Math.sin(p * Math.PI * 6)) * 1.5) * w;
        P.sq += Math.abs(Math.sin(p * Math.PI * 6)) * 0.015 * w;
        break;
      }
      case 'giggle': {
        P.happy = true;
        P.mouth = 'grin';
        P.y += Math.abs(Math.sin(p * Math.PI * 5)) * 0.06 * w * E;
        P.roll += Math.sin(p * Math.PI * 10) * 0.07 * w * E;
        P.sq -= Math.abs(Math.sin(p * Math.PI * 5)) * 0.03 * w;
        L.up = lerp(L.up, 0.5, w);
        R.up = lerp(R.up, 0.5, w);
        L.fwd = R.fwd = lerp(0, 0.6, w);
        L.bend = R.bend = 0.9 * w;
        P.heart += 0.8 * w;
        break;
      }
    }
  }

  private write(dt: number) {
    const m = this.model;
    const P = this.pose;
    m.body.position.y = P.y;
    m.body.scale.set(1 - P.sq * 0.5, 1 + P.sq, 1 - P.sq * 0.5);
    m.body.rotation.set(P.lean, P.turn, P.sway);
    m.head.rotation.set(P.pitch, P.yaw, P.roll);

    m.arms.forEach((a, i) => {
      const sx = i === 0 ? -1 : 1;
      const ap = P.arms[i];
      a.shoulder.rotation.set(-ap.fwd, 0, sx * (0.16 + ap.up));
      a.elbow.rotation.set(-ap.bend * 0.6, 0, sx * (ap.elbow + ap.bend * 0.25));
      a.wrist.rotation.set(0, 0, sx * ap.wrist);
    });
    m.legs.forEach((l, i) => {
      l.hip.rotation.x = P.legs[i];
      l.hip.position.y = 0.53 + P.lift[i];
    });

    for (const e of m.eyes) {
      e.setOpen(P.open, P.happy);
      e.setGaze(P.gx, P.gy);
    }
    m.brows.forEach((b, i) => {
      const rest = b.userData.rest as { x: number; y: number; z: number };
      b.position.y = rest.y + P.brow * 0.035;
      b.rotation.z = (i === 0 ? -1 : 1) * P.brow * 0.12;
    });
    m.setMouth(P.mouth);

    // Heartbeat: a soft double pulse.
    const beat = (this.t * 1.15) % 1;
    const pulse = Math.exp(-((beat - 0.08) ** 2) / 0.002) + 0.6 * Math.exp(-((beat - 0.28) ** 2) / 0.002);
    const glow = Math.max(0, 1 + P.heart * 0.5 + pulse * 0.35);
    m.heart.scale.setScalar(1 + pulse * 0.035 + Math.max(0, P.heart) * 0.03);
    m.heartMat.emissiveIntensity = 0.62 * glow;
    (m.heartGlow.material as THREE.SpriteMaterial).opacity = Math.min(0.8, 0.3 * glow);
    m.heartGlow.scale.setScalar(0.75 + 0.15 * glow);
    if (m.heartLight) m.heartLight.intensity = 0.35 * glow;

    // Antenna springs: they lag behind hops, nods and tilts, then wobble.
    const prev = this.prev;
    const vy = (P.y - prev.y) / Math.max(dt, 1e-3);
    const vp = (P.pitch - prev.pitch) / Math.max(dt, 1e-3);
    const vr = (P.roll - prev.roll) / Math.max(dt, 1e-3);
    const ay = (vy - prev.vy) / Math.max(dt, 1e-3);
    const ap = (vp - prev.vp) / Math.max(dt, 1e-3);
    const ar = (vr - prev.vr) / Math.max(dt, 1e-3);
    Object.assign(prev, { y: P.y, pitch: P.pitch, roll: P.roll, vy, vp, vr });
    const clamp = (v: number) => Math.max(-0.6, Math.min(0.6, v));
    m.antennas.forEach((a, i) => {
      const sx = i === 0 ? -1 : 1;
      const tz = clamp(sx * ay * 0.0035 - ar * 0.006);
      const tx = clamp(-ap * 0.006 + P.lean * 0.4 + this.walk * 0.15);
      a.rotation.z = this.springs[i * 2].step(tz, dt);
      a.rotation.x = this.springs[i * 2 + 1].step(tx, dt);
    });
  }
}

