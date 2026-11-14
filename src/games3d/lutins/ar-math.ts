import type { ElfPose } from './types';

/**
 * Pure maths of "La caméra magique" (the live AR view, src/games3d/lutins/ar.ts):
 * camera field of view, phone orientation, light matching, the looping
 * actions and the captions. No three.js here: unit tested.
 */

const DEG = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Vertical field of view (degrees) of a camera picture shown "cover" in a box:
 * a phone's main camera sees about `diagDeg` across its diagonal; the part
 * the cover fit crops away is not seen.
 */
export function coverFov(srcW: number, srcH: number, boxW: number, boxH: number, diagDeg = 76): number {
  if (!(srcW > 0 && srcH > 0 && boxW > 0 && boxH > 0)) return 60;
  const tanHalfDiag = Math.tan((clamp(diagDeg, 20, 140) * DEG) / 2);
  const tanHalfV = (tanHalfDiag * srcH) / Math.hypot(srcW, srcH);
  const s = Math.max(boxW / srcW, boxH / srcH);
  const visible = boxH / (srcH * s); // ≤ 1
  return clamp((2 * Math.atan(tanHalfV * visible)) / DEG, 15, 120);
}

/** The source rectangle of a "cover" fit (what part of the picture fills the box). */
export function coverRect(srcW: number, srcH: number, boxW: number, boxH: number): { sx: number; sy: number; sw: number; sh: number } {
  const s = Math.max(boxW / srcW, boxH / srcH);
  const sw = boxW / s;
  const sh = boxH / s;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}

/**
 * Side-by-side spacing of a line-up of `n` elves seen `slant` away: the row
 * takes about 60 % of the picture width (a narrow phone picture packs them
 * closer), never closer than 0.45 nor farther than 0.85 elf units.
 */
export function lineupSpacing(n: number, vfovDeg: number, aspect: number, slant: number): number {
  const tv = Math.tan((clamp(Number.isFinite(vfovDeg) ? vfovDeg : 55, 15, 120) * DEG) / 2);
  const visibleW = 2 * Math.max(0.5, Number.isFinite(slant) ? slant : 5) * tv * clamp(Number.isFinite(aspect) ? aspect : 1, 0.2, 5);
  return clamp((visibleW * 0.6) / Math.max(1, Number.isFinite(n) ? n : 1), 0.45, 0.85);
}

export type Quat = [number, number, number, number];

function qmul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [ax * bw + aw * bx + ay * bz - az * by, ay * bw + aw * by + az * bx - ax * bz, az * bw + aw * bz + ax * by - ay * bx, aw * bw - ax * bx - ay * by - az * bz];
}

/** Rotates vector `v` by quaternion `q`. */
export function qrotate(q: Quat, v: [number, number, number]): [number, number, number] {
  const [x, y, z] = qmul(qmul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]);
  return [x, y, z];
}

/**
 * Camera orientation (y up, the camera looking down its −z) from the W3C
 * DeviceOrientation angles in degrees and the screen orientation angle, as in
 * three.js's former DeviceOrientationControls (MIT): Euler(β, α, −γ, 'YXZ'),
 * then −90° about x (the camera looks out of the back of the phone), then the
 * screen rotation about z.
 */
export function deviceQuaternion(alpha: number, beta: number, gamma: number, screenDeg = 0): Quat {
  const a = (Number.isFinite(alpha) ? alpha : 0) * DEG;
  const b = (Number.isFinite(beta) ? beta : 0) * DEG;
  const g = -(Number.isFinite(gamma) ? gamma : 0) * DEG;
  const o = (Number.isFinite(screenDeg) ? screenDeg : 0) * DEG;
  // Euler YXZ (x = β, y = α, z = −γ) → quaternion.
  const [c1, s1] = [Math.cos(b / 2), Math.sin(b / 2)];
  const [c2, s2] = [Math.cos(a / 2), Math.sin(a / 2)];
  const [c3, s3] = [Math.cos(g / 2), Math.sin(g / 2)];
  const q: Quat = [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3];
  const q1: Quat = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];
  const q0: Quat = [0, 0, Math.sin(-o / 2), Math.cos(-o / 2)];
  return qmul(qmul(q, q1), q0);
}

/** Heading (radians about y) of where a camera with orientation `q` looks. */
export function yawOf(q: Quat): number {
  const [x, , z] = qrotate(q, [0, 0, -1]);
  return Math.atan2(-x, -z);
}

/** Pitch (degrees, negative = looking down) of a camera with orientation `q`. */
export function pitchOf(q: Quat): number {
  const [, y] = qrotate(q, [0, 0, -1]);
  return Math.asin(clamp(y, -1, 1)) / DEG;
}

/** `q` turned about y so that it looks toward heading 0 (the elves stay in front after a recenter). */
export function recentered(q: Quat, yaw: number): Quat {
  return qmul([0, Math.sin(-yaw / 2), 0, Math.cos(-yaw / 2)], q);
}

export type LightMatch = {
  /** Hemisphere sky and ground colours, 0–1 linear-ish RGB. */
  sky: [number, number, number];
  ground: [number, number, number];
  /** Renderer exposure. */
  exposure: number;
  /** Key light intensity. */
  key: number;
};

/**
 * Light that blends the elves into the camera picture, from its average
 * colour (0–255): the hemisphere light takes a soft tint of the room colour
 * (never more than half saturated, so the felt colours survive) and the
 * exposure follows the room's brightness (a dim room gives dimmer elves).
 */
export function lightFromSample(r: number, g: number, b: number): LightMatch {
  const c = [r, g, b].map((v) => clamp(Number.isFinite(v) ? v : 128, 0, 255) / 255) as [number, number, number];
  const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const max = Math.max(c[0], c[1], c[2], 1e-3);
  const tint = c.map((v) => 0.55 + 0.45 * (v / max)) as [number, number, number];
  return {
    sky: tint,
    ground: tint.map((v) => v * 0.55) as [number, number, number],
    exposure: clamp(0.5 + lum * 1.1, 0.55, 1.35),
    key: clamp(1.1 + lum * 1.6, 1.1, 2.6),
  };
}

/** What a looping action does to an elf at time `t` (seconds since it started). */
export type ActionFrame = {
  /** Offset on the floor from the elf's spot (its own units, before scale). */
  x: number;
  z: number;
  /** Extra turn (radians). */
  rotY: number;
  /** Height of a hop. */
  hop: number;
  /** Uniform scale (hide-and-reappear), 0–1.1. */
  scale: number;
  pose: ElfPose;
  side: 1 | -1;
};

export const DANCE_RADIUS = 0.45;
export const HIDE_PERIOD = 4.2;

const easeOutBack = (x: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Scale of the hide-and-reappear loop: visible, sink into the floor, hidden, pop back up. */
export function hideScale(t: number, reduce = false): number {
  const p = ((t % HIDE_PERIOD) + HIDE_PERIOD) % HIDE_PERIOD;
  if (p < 2.0) return 1;
  if (p < 2.4) {
    const k = (p - 2.0) / 0.4;
    return 1 - k * k;
  }
  if (p < 3.4) return 0;
  if (p < 3.9) {
    const k = (p - 3.4) / 0.5;
    return reduce ? k : easeOutBack(k);
  }
  return 1;
}

/**
 * The looping actions: `dance` runs in a little circle on tiptoe with hops
 * (slower, without hops for reduced motion), `hide` sinks into the floor and
 * pops back up peeking. Plain poses stay where they are.
 */
export function actionFrame(action: ElfPose | 'dance' | 'hide', t: number, reduce = false): ActionFrame {
  const still: ActionFrame = { x: 0, z: 0, rotY: 0, hop: 0, scale: 1, pose: 'stand', side: 1 };
  const tt = Number.isFinite(t) ? Math.max(0, t) : 0;
  if (action === 'dance') {
    const w = reduce ? 0.9 : 2.2;
    const th = tt * w;
    const stepT = reduce ? 0.5 : 0.28;
    return {
      x: Math.sin(th) * DANCE_RADIUS,
      z: Math.cos(th) * DANCE_RADIUS,
      rotY: th + Math.PI / 2,
      hop: reduce ? 0 : Math.abs(Math.sin((tt / stepT) * Math.PI)) * 0.05,
      scale: 1,
      pose: 'tiptoe',
      side: Math.floor(tt / stepT) % 2 === 0 ? 1 : -1,
    };
  }
  if (action === 'hide') {
    const p = tt % HIDE_PERIOD;
    return { ...still, scale: hideScale(tt, reduce), pose: p >= 2.4 && p < 4.2 ? 'peek' : 'wave', rotY: p >= 2.0 && p < 2.4 && !reduce ? ((p - 2.0) / 0.4) * 1.2 : 0 };
  }
  return { ...still, pose: action };
}

const CAPTIONS: { fr: [string, string]; en: [string, string] }[] = [
  { fr: ['Regarde qui est venu jouer ici : {n} !', 'Regarde qui est venu jouer ici : {n} !'], en: ['Look who came to play here: {n}!', 'Look who came to play here: {n}!'] },
  { fr: ['Chut… {n} prépare une surprise !', 'Chut… {n} préparent une surprise !'], en: ['Shh… {n} is planning a surprise!', 'Shh… {n} are planning a surprise!'] },
  { fr: ['{n} fait des bêtises dans la maison !', '{n} font des bêtises dans la maison !'], en: ['{n} is up to mischief in the house!', '{n} are up to mischief in the house!'] },
  { fr: ['Coucou ! {n} te dit bonjour de la part du Père Noël !', 'Coucou ! {n} te disent bonjour de la part du Père Noël !'], en: ['Peekaboo! {n} says hello from Santa!', 'Peekaboo! {n} say hello from Santa!'] },
];

/** A cheerful journal caption naming the elves ("Pépin, Grelotte et Noisette"), FR or EN, picked by `seed`. */
export function arCaption(names: string[], locale: string, seed: number): string {
  const fr = locale === 'fr';
  const list = names.filter(Boolean);
  const joined = list.length <= 1 ? (list[0] ?? (fr ? 'Les lutins' : 'The elves')) : `${list.slice(0, -1).join(', ')} ${fr ? 'et' : 'and'} ${list[list.length - 1]}`;
  const plural = list.length !== 1;
  const tpl = CAPTIONS[Math.abs(Math.floor(Number.isFinite(seed) ? seed : 0)) % CAPTIONS.length];
  const text = (fr ? tpl.fr : tpl.en)[plural ? 1 : 0].replace('{n}', joined);
  // French typography: a narrow no-break space before ! and :.
  return fr ? text.replace(/ ([!:?])/g, ' $1') : text;
}
