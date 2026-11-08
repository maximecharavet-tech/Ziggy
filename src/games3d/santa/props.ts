import * as THREE from 'three';
import { felt } from '../ziggy/felt';
import { cushionGeometry } from '../ziggy/shapes';
import { glow, glowMat } from '../kit/look';
import { makeGift, makeZiggy, type ZiggyActor } from '../kit/models';
import { makeScarf } from '../ziggy/model';
import { rng } from '../kit/rng';
import { fluffTorus, puffGeometry, taperedTube } from './fluff';
import { bricksTexture, logsTexture, planksTexture, stripesTexture, warmWindowTexture } from './textures';

/**
 * Props for the Santa scenes, all built in code: plush reindeer, the sleigh,
 * candy canes, Santa's log cabin, soft snowy pines, the aurora, the
 * fireplace, the toy shelves and Ziggy dressed as a little elf.
 * Every model's origin sits on the ground, facing +z.
 */

/** A soft, smooth-shaded material (wood, paint, toys). */
export const soft = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...extra });

export const shadowed = <T extends THREE.Object3D>(o: T, receive = true): T => {
  o.traverse((x) => {
    if ((x as THREE.Mesh).isMesh) {
      x.castShadow = true;
      x.receiveShadow = receive;
    }
  });
  return o;
};

// ---------------------------------------------------------------------------
// Reindeer

export type Reindeer = THREE.Group & { userData: { head: THREE.Group; tail: THREE.Object3D; ears: THREE.Object3D[]; phase: number; body: THREE.Group } };

/**
 * A plush reindeer: round felt body, cream chest and muzzle, bead eyes,
 * soft felt antlers, a collar with golden bells. `glowNose` gives a softly
 * shining red nose (a generic touch, no film character).
 */
export function makeReindeer(opts: { lowPower?: boolean; glowNose?: boolean; seed?: number; color?: string } = {}): Reindeer {
  const low = Boolean(opts.lowPower);
  const S = (n: number) => Math.max(8, Math.round(n * (low ? 0.6 : 1)));
  const coat = felt(opts.color ?? '#a8703f', { repeat: 3, sheen: '#ffd9a8', lowPower: low });
  const cream = felt('#f1dcb6', { repeat: 2, sheen: '#ffffff', lowPower: low });
  const antlerMat = felt('#e2bd84', { repeat: 2, sheen: '#fff1cc', lowPower: low });
  const hoofMat = felt('#4a3328', { repeat: 2, lowPower: low });
  const collarMat = felt('#c9283a', { repeat: 2, lowPower: low });
  const gold = new THREE.MeshStandardMaterial({ color: '#f0bd45', metalness: 0.8, roughness: 0.3, emissive: '#5a3a00', emissiveIntensity: 0.3 });
  const bead = new THREE.MeshStandardMaterial({ color: '#1c1218', roughness: 0.15 });
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  const g = new THREE.Group() as Reindeer;
  const body = new THREE.Group();
  g.add(body);
  const torso = new THREE.Mesh(cushionGeometry({ a: 0.27, b: 0.25, c: 0.44, p: 2.3 }, S(32), S(24)), coat);
  torso.position.set(0, 0.68, 0);
  const chest = new THREE.Mesh(cushionGeometry({ a: 0.2, b: 0.2, c: 0.16, p: 2.2 }, S(24), S(16)), cream);
  chest.position.set(0, 0.66, 0.33);
  const tail = new THREE.Mesh(puffGeometry({ a: 0.08, b: 0.09, c: 0.07, p: 2 }, { amp: 0.3, seed: (opts.seed ?? 1) + 4, wSeg: S(16), hSeg: S(12) }), cream);
  tail.position.set(0, 0.8, -0.44);
  body.add(torso, chest, tail);
  // Legs.
  for (const [x, z] of [
    [-0.15, 0.26],
    [0.15, 0.26],
    [-0.15, -0.26],
    [0.15, -0.26],
  ]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.34, 4, S(12)), coat);
    leg.position.set(x, 0.33, z);
    const hoof = new THREE.Mesh(cushionGeometry({ a: 0.075, b: 0.05, c: 0.085, p: 2.6 }, S(14), S(10)), hoofMat);
    hoof.position.set(x, 0.05, z + 0.01);
    body.add(leg, hoof);
  }
  // Neck, collar and bells.
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.22, 4, S(14)), coat);
  neck.position.set(0, 0.95, 0.33);
  neck.rotation.x = 0.45;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.035, 8, S(24)), collarMat);
  collar.position.set(0, 0.9, 0.31);
  collar.rotation.x = Math.PI / 2 + 0.45;
  body.add(neck, collar);
  for (const a of [-0.6, 0, 0.6]) {
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), gold);
    bell.position.set(Math.sin(a) * 0.15, 0.85 - Math.abs(a) * 0.03, 0.31 + Math.cos(a) * 0.14);
    body.add(bell);
  }
  // Head.
  const head = new THREE.Group();
  head.position.set(0, 1.1, 0.42);
  body.add(head);
  const skull = new THREE.Mesh(cushionGeometry({ a: 0.19, b: 0.18, c: 0.2, p: 2.2 }, S(28), S(20)), coat);
  const muzzle = new THREE.Mesh(cushionGeometry({ a: 0.13, b: 0.1, c: 0.12, p: 2.2 }, S(22), S(14)), cream);
  muzzle.position.set(0, -0.07, 0.15);
  const noseMat = opts.glowNose ? glowMat('#ff4a4a', 1.4) : felt('#3b2626', { repeat: 1, lowPower: low });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 10), noseMat);
  nose.position.set(0, -0.04, 0.27);
  head.add(skull, muzzle, nose);
  if (opts.glowNose) {
    const halo = glow('#ff6a5a', 0.45, 0.65);
    halo.position.copy(nose.position);
    halo.position.z += 0.02;
    head.add(halo);
  }
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), bead);
    eye.scale.set(0.9, 1.1, 0.7);
    eye.position.set(sx * 0.085, 0.04, 0.165);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), shine);
    hi.position.set(sx * 0.085 - 0.008, 0.055, 0.19);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), felt('#f19aa0', { repeat: 1, lowPower: low }));
    cheek.scale.set(1, 0.7, 0.4);
    cheek.position.set(sx * 0.125, -0.025, 0.15);
    const ear = new THREE.Mesh(cushionGeometry({ a: 0.05, b: 0.1, c: 0.025, p: 2.2 }, 12, 10), coat);
    ear.position.set(sx * 0.2, 0.08, -0.02);
    ear.rotation.set(0, 0, sx * -1.1);
    head.add(eye, hi, cheek, ear);
    g.userData.ears = [...(g.userData.ears ?? []), ear];
    // Antlers: a soft branch with two tines.
    const base = new THREE.Vector3(sx * 0.08, 0.15, -0.04);
    const main = [base, new THREE.Vector3(sx * 0.13, 0.28, -0.06), new THREE.Vector3(sx * 0.22, 0.38, -0.1), new THREE.Vector3(sx * 0.3, 0.5, -0.1)];
    const antler = new THREE.Mesh(taperedTube(main, (t) => 0.03 - t * 0.012, { tubular: 16, radial: 8 }), antlerMat);
    const tine1 = new THREE.Mesh(taperedTube([new THREE.Vector3(sx * 0.15, 0.3, -0.07), new THREE.Vector3(sx * 0.13, 0.42, -0.02), new THREE.Vector3(sx * 0.14, 0.48, 0.01)], (t) => 0.022 - t * 0.008, { tubular: 10, radial: 8 }), antlerMat);
    const tine2 = new THREE.Mesh(taperedTube([new THREE.Vector3(sx * 0.24, 0.4, -0.1), new THREE.Vector3(sx * 0.33, 0.42, -0.06), new THREE.Vector3(sx * 0.38, 0.45, -0.04)], (t) => 0.02 - t * 0.007, { tubular: 10, radial: 8 }), antlerMat);
    for (const tip of [main[3], new THREE.Vector3(sx * 0.14, 0.48, 0.01), new THREE.Vector3(sx * 0.38, 0.45, -0.04)]) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), antlerMat);
      ball.position.copy(tip);
      head.add(ball);
    }
    head.add(antler, tine1, tine2);
  }
  g.userData.head = head;
  g.userData.tail = tail;
  g.userData.body = body;
  g.userData.phase = rng(opts.seed ?? 1)() * 10;
  return shadowed(g, !low);
}

/** Gentle life for a reindeer: breathing, head bob, ear flicks, tail wag. */
export function animateReindeer(r: Reindeer, t: number, energy = 1) {
  const p = t + r.userData.phase;
  r.userData.body.position.y = Math.sin(p * 1.6) * 0.008 * energy;
  r.userData.head.rotation.set(Math.sin(p * 0.7) * 0.08 * energy, Math.sin(p * 0.45) * 0.18 * energy, Math.sin(p * 0.6) * 0.05 * energy);
  r.userData.tail.rotation.y = Math.sin(p * 7) * 0.4 * energy * (Math.sin(p * 0.5) > 0.6 ? 1 : 0.15);
  const flick = Math.max(0, Math.sin(p * 0.9) - 0.92) * 8;
  r.userData.ears.forEach((e, i) => (e.rotation.x = Math.sin(p * 20 + i) * 0.3 * flick * energy));
}

// ---------------------------------------------------------------------------
// Sleigh

/** Santa's sleigh: a red toy sleigh with gold trim and runners, full of gifts. */
export function makeSleigh(opts: { lowPower?: boolean; gifts?: boolean } = {}): THREE.Group {
  const low = Boolean(opts.lowPower);
  const g = new THREE.Group();
  const red = soft('#c8202f', { roughness: 0.45, metalness: 0.05 });
  const gold = new THREE.MeshStandardMaterial({ color: '#f0bd45', metalness: 0.85, roughness: 0.28, emissive: '#5a3a00', emissiveIntensity: 0.35 });
  const seatMat = felt('#2f8f52', { repeat: 2, lowPower: low });
  // Side profile (z along the sleigh, y up), extruded across x.
  const s = new THREE.Shape();
  s.moveTo(-0.95, 0.35);
  s.lineTo(-1.0, 1.05);
  s.quadraticCurveTo(-1.02, 1.32, -0.75, 1.3);
  s.quadraticCurveTo(-0.55, 1.28, -0.5, 1.0);
  s.lineTo(-0.35, 0.8);
  s.lineTo(0.55, 0.8);
  s.quadraticCurveTo(0.85, 0.82, 0.95, 1.05);
  s.quadraticCurveTo(1.05, 1.28, 1.2, 1.2);
  s.quadraticCurveTo(1.3, 1.1, 1.15, 0.95);
  s.quadraticCurveTo(1.0, 0.45, 0.6, 0.35);
  s.closePath();
  const w = 1.0;
  const bodyGeo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: low ? 2 : 4, curveSegments: low ? 8 : 16 });
  bodyGeo.translate(0, 0, -w / 2);
  bodyGeo.rotateY(-Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, red);
  g.add(body);
  // Gold trim along both sides (scroll lines).
  for (const sx of [-1, 1]) {
    const pts = [
      new THREE.Vector3(sx * (w / 2 + 0.065), 0.5, -0.85),
      new THREE.Vector3(sx * (w / 2 + 0.065), 0.62, -0.2),
      new THREE.Vector3(sx * (w / 2 + 0.065), 0.58, 0.4),
      new THREE.Vector3(sx * (w / 2 + 0.065), 0.72, 0.85),
      new THREE.Vector3(sx * (w / 2 + 0.065), 0.95, 1.05),
    ];
    g.add(new THREE.Mesh(taperedTube(pts, () => 0.025, { tubular: 30, radial: 8 }), gold));
    const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 20), gold);
    swirl.position.set(sx * (w / 2 + 0.065), 0.98, -0.75);
    swirl.rotation.y = Math.PI / 2;
    g.add(swirl);
    // Runners.
    const run = [
      new THREE.Vector3(sx * 0.42, 0.05, -1.0),
      new THREE.Vector3(sx * 0.42, 0.03, -0.2),
      new THREE.Vector3(sx * 0.42, 0.04, 0.8),
      new THREE.Vector3(sx * 0.42, 0.2, 1.3),
      new THREE.Vector3(sx * 0.42, 0.45, 1.38),
      new THREE.Vector3(sx * 0.42, 0.55, 1.22),
    ];
    g.add(new THREE.Mesh(taperedTube(run, () => 0.035, { tubular: 40, radial: 8 }), gold));
    for (const z of [-0.7, 0.0, 0.7]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8), gold);
      strut.position.set(sx * 0.42, 0.22, z);
      g.add(strut);
    }
  }
  // Seat cushion.
  const seat = new THREE.Mesh(cushionGeometry({ a: 0.45, b: 0.07, c: 0.22, p: 3 }, 24, 12), seatMat);
  seat.position.set(0, 1.02, -0.68);
  g.add(seat);
  if (opts.gifts !== false) {
    const colors = ['#3f7fe0', '#ffcc33', '#3fbf6a', '#9b6be8', '#ff7ab8', '#ff8a3d'];
    const r = rng(3);
    const spots: [number, number, number, number][] = [
      [-0.25, 0.8, -0.1, 0.42],
      [0.22, 0.8, -0.05, 0.38],
      [0.0, 0.8, 0.35, 0.34],
      [-0.2, 1.2, 0.05, 0.3],
      [0.2, 1.16, 0.2, 0.28],
      [0.02, 1.48, 0.08, 0.24],
    ];
    spots.forEach(([x, y, z, sz], i) => {
      const gift = makeGift(colors[i % colors.length], undefined, sz);
      gift.position.set(x, y, z);
      gift.rotation.y = (r() - 0.5) * 0.8;
      g.add(gift);
    });
    // A big felt sack peeking out at the back.
    const sack = new THREE.Mesh(puffGeometry({ a: 0.32, b: 0.38, c: 0.3, p: 2.1 }, { amp: 0.1, seed: 33, wSeg: 24, hSeg: 18 }), felt('#b4793f', { repeat: 2, lowPower: low }));
    sack.position.set(0.0, 1.15, -0.45);
    g.add(sack);
  }
  return shadowed(g, !low);
}

// ---------------------------------------------------------------------------
// Small things

let stripes: THREE.CanvasTexture | null = null;
/** A candy cane stuck in the snow (about 1 unit tall at scale 1). */
export function makeCandyCane(scale = 1): THREE.Group {
  stripes ??= stripesTexture();
  const t = stripes.clone();
  t.needsUpdate = true;
  t.repeat.set(10, 1);
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0.06, 1.05, 0), new THREE.Vector3(0.18, 1.1, 0), new THREE.Vector3(0.3, 1.03, 0), new THREE.Vector3(0.33, 0.9, 0)];
  const m = new THREE.Mesh(taperedTube(pts, () => 0.05, { tubular: 40, radial: 10 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 }));
  const g = new THREE.Group();
  g.add(m);
  g.scale.setScalar(scale);
  return shadowed(g);
}

/** A soft snowy pine: rounded tiers, smooth shading, thick snow on each tier. */
export function makeSoftPine(scale = 1, seed = 1, lowPower = false): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed);
  const green = soft(new THREE.Color('#2f6f4c').offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.06), { roughness: 0.9 });
  const snow = soft('#f4f7ff', { roughness: 0.95 });
  const seg = lowPower ? 10 : 16;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 8), soft('#6b4226'));
  trunk.position.y = 0.25;
  g.add(trunk);
  for (const t of PINE_TIERS) {
    // A cone with a puffy, slightly scalloped skirt.
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      const rr = t.r * (1 - k) * (1 + 0.12 * Math.sin(k * Math.PI));
      prof.push(new THREE.Vector2(Math.max(0.001, rr), k * t.h));
    }
    prof.unshift(new THREE.Vector2(0.001, 0.02), new THREE.Vector2(t.r * 0.92, 0));
    const cone = new THREE.Mesh(new THREE.LatheGeometry(prof, seg), green);
    cone.position.y = t.y;
    g.add(cone);
    const capProf: THREE.Vector2[] = [];
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      capProf.push(new THREE.Vector2(Math.max(0.001, t.r * 0.62 * (1 - k) * (1 + 0.18 * Math.sin(k * Math.PI)) + 0.03), t.h * (0.42 + k * 0.6)));
    }
    capProf.unshift(new THREE.Vector2(0.001, t.h * 0.4));
    const cap = new THREE.Mesh(new THREE.LatheGeometry(capProf, seg), snow);
    cap.position.y = t.y;
    g.add(cap);
  }
  g.scale.setScalar(scale);
  g.rotation.y = r() * Math.PI;
  return shadowed(g, false);
}

const PINE_TIERS = [
  { r: 1.0, h: 1.2, y: 0.45 },
  { r: 0.8, h: 1.05, y: 1.1 },
  { r: 0.58, h: 0.9, y: 1.7 },
];

/** Radius of a soft pine (scale 1) at a height: the widest tier there. */
function pineRadius(y: number) {
  let r = 0;
  for (const t of PINE_TIERS) {
    const k = (y - t.y) / t.h;
    if (k >= 0 && k <= 1) r = Math.max(r, t.r * (1 - k) * (1 + 0.12 * Math.sin(k * Math.PI)));
  }
  return r;
}

/** Glowing bulbs spiralling around a soft pine (add to the pine's parent at the pine's place). */
export function makePineBulbs(scale: number, n = 22, turns = 3.2): THREE.Group & { userData: { bulbs: THREE.Mesh[] } } {
  const g = new THREE.Group() as THREE.Group & { userData: { bulbs: THREE.Mesh[] } };
  const colors = ['#ff4d4d', '#ffd23d', '#4dc3ff', '#7cff6b', '#ff7ad9'];
  const bulbs: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const y = 0.55 + t * 1.85;
    const a = t * turns * Math.PI * 2;
    // Only the front half: the back is never seen and costs draw calls.
    if (Math.cos(a) < -0.35) continue;
    const r = pineRadius(y) * 0.92 + 0.03;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glowMat(colors[i % colors.length], 1.8));
    b.position.set(Math.sin(a) * r * scale, y * scale, Math.cos(a) * r * scale);
    b.userData.color = colors[i % colors.length];
    bulbs.push(b);
    g.add(b);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glowMat('#ffe066', 1.6));
  star.scale.set(1, 1.25, 0.5);
  star.position.y = 2.75 * scale;
  const halo = glow('#ffe066', 0.8 * scale, 0.7);
  halo.position.set(0, 2.75 * scale, 0.05);
  g.add(star, halo);
  g.userData.bulbs = bulbs;
  return g;
}

/** A smooth, friendly snowman with a felt scarf and a little hat. */
export function makeSoftSnowman(lowPower = false): THREE.Group {
  const g = new THREE.Group();
  const snow = soft('#f6f9ff', { roughness: 0.95 });
  const seg = lowPower ? 16 : 28;
  for (const [r, y] of [
    [0.62, 0.56],
    [0.46, 1.4],
    [0.34, 2.02],
  ]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), snow);
    b.position.y = y;
    b.scale.y = 0.94;
    g.add(b);
  }
  const coal = soft('#2a2430', { roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), coal);
    eye.position.set(sx * 0.12, 2.1, 0.3);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), soft('#ff9fb0'));
    cheek.scale.set(1, 0.6, 0.4);
    cheek.position.set(sx * 0.2, 1.98, 0.27);
    g.add(eye, cheek);
  }
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + (i / 4) * 1.0;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), coal);
    dot.position.set(Math.sin(a) * 0.17, 1.9 - Math.cos(a) * 0.06 - 0.03, 0.31);
    g.add(dot);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 12), soft('#ff8a3d'));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 2.02, 0.45);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.08, 10, 28), felt('#e2453c', { repeat: 2, lowPower }));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.76;
  const tail = new THREE.Mesh(cushionGeometry({ a: 0.08, b: 0.22, c: 0.04, p: 2.4 }, 12, 10), felt('#e2453c', { repeat: 2, lowPower }));
  tail.position.set(0.2, 1.55, 0.3);
  tail.rotation.set(0.3, 0, 0.25);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20), soft('#2b2b3a'));
  brim.position.y = 2.32;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.3, 20), soft('#2b2b3a'));
  crown.position.y = 2.48;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.212, 0.06, 20), soft('#2f9152'));
  band.position.y = 2.38;
  g.add(nose, scarf, tail, brim, crown, band);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(taperedTube([new THREE.Vector3(sx * 0.4, 1.45, 0), new THREE.Vector3(sx * 0.7, 1.7, 0.05), new THREE.Vector3(sx * 0.85, 1.9, 0.05)], (t) => 0.035 - t * 0.02, { tubular: 10, radial: 6 }), soft('#6b4226'));
    g.add(arm);
  }
  return shadowed(g, !lowPower);
}

/** A string of coloured bulbs hanging between points (a sagging curve). */
export function makeLightString(from: THREE.Vector3, to: THREE.Vector3, n: number, sag = 0.18, size = 0.06): THREE.Group & { userData: { bulbs: THREE.Mesh[] } } {
  const g = new THREE.Group() as THREE.Group & { userData: { bulbs: THREE.Mesh[] } };
  const colors = ['#ff4d4d', '#ffd23d', '#4dc3ff', '#7cff6b', '#ff7ad9'];
  const bulbs: THREE.Mesh[] = [];
  const wirePts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = from.clone().lerp(to, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    wirePts.push(p);
    if (i > 0 && i < n) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), glowMat(colors[i % colors.length], 1.8));
      b.scale.y = 1.3;
      b.position.copy(p).add(new THREE.Vector3(0, -size, 0));
      b.userData.color = colors[i % colors.length];
      bulbs.push(b);
      g.add(b);
    }
  }
  g.add(new THREE.Mesh(taperedTube(wirePts, () => 0.008, { tubular: n * 2, radial: 4 }), soft('#1d3a26')));
  g.userData.bulbs = bulbs;
  return g;
}

/** Make string-light bulbs twinkle softly. */
export function twinkleBulbs(bulbs: THREE.Mesh[], t: number, energy = 1) {
  bulbs.forEach((b, i) => {
    const m = b.material as THREE.MeshBasicMaterial;
    const k = 1.2 + 0.7 * Math.max(0, Math.sin(t * 1.3 + i * 1.7)) * energy;
    m.color.set(b.userData.color as string).multiplyScalar(k);
  });
}

// ---------------------------------------------------------------------------
// Ziggy the little elf

/** A felt elf hat for Ziggy: green, with a red-and-white band and a gold bell. */
export function makeElfHat(lowPower = false): THREE.Group {
  const g = new THREE.Group();
  const green = felt('#2e9a55', { repeat: 2, lowPower });
  const band = felt('#ffffff', { repeat: 1, lowPower });
  band.map = stripesTexture('#e23b3b', '#fff8f0', 8);
  (band.map as THREE.Texture).repeat.set(6, 1);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector3(-0.28 * t * t, 0.48 * t - 0.12 * t * t * t, -0.1 * t * t));
  }
  const cone = new THREE.Mesh(taperedTube(pts, (t) => 0.27 * Math.pow(1 - t, 1.05) + 0.02, { tubular: 28, radial: 16 }), green);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.055, 10, 32), band);
  rim.rotation.x = Math.PI / 2;
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), new THREE.MeshStandardMaterial({ color: '#f0bd45', metalness: 0.85, roughness: 0.25, emissive: '#5a3a00', emissiveIntensity: 0.3 }));
  bell.position.copy(pts[pts.length - 1]).add(new THREE.Vector3(-0.02, -0.03, 0));
  g.add(cone, rim, bell);
  g.position.y = -0.02;
  g.rotation.z = 0.1;
  return shadowed(g);
}

/** Ziggy (the real felt plush) dressed as Santa's little helper. */
export function makeElfZiggy(lowPower = false): ZiggyActor {
  const z = makeZiggy({ lowPower });
  const model = z.userData.model;
  model.hatAnchor.add(makeElfHat(lowPower));
  model.body.add(makeScarf(lowPower));
  // A softer heart glow: at night and with bloom the full glow veils him in white.
  (model.heartGlow.material as THREE.SpriteMaterial).color.set('#a8853f');
  model.heartMat.emissiveIntensity = 0.55;
  if (model.heartLight) model.heartLight.intensity = 0.25;
  return z;
}

// ---------------------------------------------------------------------------
// Santa's log cabin

export type Cabin = THREE.Group & { userData: { door: THREE.Vector3; chimney: THREE.Vector3; bulbs: THREE.Mesh[]; windows: THREE.Mesh[] } };

/** Santa's cosy log cabin: snowy roof, warm windows, open glowing door, string lights. */
export function makeCabin(lowPower = false): Cabin {
  const g = new THREE.Group() as Cabin;
  const W = 5.2;
  const D = 3.8;
  const H = 2.7;
  const logs = logsTexture(10);
  logs.repeat.set(2, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: logs, roughness: 0.9 });
  const wood = soft('#6d3d1e');
  const trim = soft('#f3ead8');
  const snow = soft('#f6f9ff', { roughness: 0.95 });
  const roofMat = soft('#8f2a2e', { roughness: 0.8 });
  const warm = new THREE.MeshBasicMaterial({ map: warmWindowTexture(), color: new THREE.Color('#ffffff').multiplyScalar(1.25), toneMapped: false });

  const walls = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat);
  walls.position.y = H / 2;
  g.add(walls);
  // Gable (front and back triangles).
  const gable = new THREE.Shape();
  gable.moveTo(-W / 2, 0);
  gable.lineTo(W / 2, 0);
  gable.lineTo(0, 1.7);
  gable.closePath();
  for (const sz of [-1, 1]) {
    const gm = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.1, bevelEnabled: false }), wallMat);
    gm.position.set(0, H, sz > 0 ? D / 2 - 0.1 : -D / 2);
    g.add(gm);
  }
  // Corner posts (log ends).
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, H, 10), wood);
      post.position.set((sx * W) / 2, H / 2, (sz * D) / 2);
      g.add(post);
    }
  // Roof: two slabs and a thick, rounded snow blanket over each, with a ridge.
  const roofLen = D + 0.9;
  const slope = Math.atan2(1.7, W / 2);
  const slabW = Math.hypot(W / 2, 1.7) + 0.6;
  for (const sx of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slabW, 0.16, roofLen), roofMat);
    slab.position.set((sx * W) / 4 + sx * 0.12, H + 0.85 - 0.1, 0);
    slab.rotation.z = -sx * slope;
    g.add(slab);
    const blanket = new THREE.Mesh(
      cushionGeometry({ a: slabW / 2 + 0.05, b: 0.16, c: roofLen / 2 + 0.05, p: 3.2 }, lowPower ? 20 : 36, lowPower ? 10 : 16, (v) => {
        // Thicker toward the eaves, like a pillow of snow sliding down.
        v.y += 0.04 * Math.sin((v.z / roofLen) * 12) * 0.5;
      }),
      snow
    );
    blanket.position.set((sx * W) / 4 + sx * 0.12, H + 0.85 + 0.04, 0);
    blanket.rotation.z = -sx * slope;
    g.add(blanket);
    // Icicles under the eaves.
    const icy = soft('#cfe6ff', { roughness: 0.2, metalness: 0.1, emissive: '#3a5a8a', emissiveIntensity: 0.4 });
    const r = rng(17 + sx);
    for (let i = 0; i < 9; i++) {
      const len = 0.15 + r() * 0.3;
      const ic = new THREE.Mesh(new THREE.ConeGeometry(0.045, len, 6), icy);
      ic.rotation.x = Math.PI;
      ic.position.set(sx * (W / 2 + 0.55), H - 0.2 - len / 2 + 0.05, -roofLen / 2 + 0.3 + (i / 8) * (roofLen - 0.6));
      g.add(ic);
    }
  }
  const ridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, roofLen - 0.2, 4, 12), snow);
  ridge.rotation.x = Math.PI / 2;
  ridge.position.set(0, H + 1.78, 0);
  g.add(ridge);

  // Door: an arched frame, open onto a warm glow.
  const doorW = 1.15;
  const doorH = 1.9;
  const arch = new THREE.Shape();
  arch.moveTo(-doorW / 2, 0);
  arch.lineTo(-doorW / 2, doorH - doorW / 2);
  arch.absarc(0, doorH - doorW / 2, doorW / 2, Math.PI, 0, true);
  arch.lineTo(doorW / 2, 0);
  arch.closePath();
  const glowDoor = new THREE.Mesh(new THREE.ShapeGeometry(arch, 16), warm);
  glowDoor.position.set(0, 0, D / 2 + 0.02);
  g.add(glowDoor);
  const frameShape = new THREE.Shape();
  frameShape.moveTo(-doorW / 2 - 0.14, 0);
  frameShape.lineTo(-doorW / 2 - 0.14, doorH - doorW / 2);
  frameShape.absarc(0, doorH - doorW / 2, doorW / 2 + 0.14, Math.PI, 0, true);
  frameShape.lineTo(doorW / 2 + 0.14, 0);
  frameShape.lineTo(doorW / 2, 0);
  frameShape.lineTo(doorW / 2, doorH - doorW / 2);
  frameShape.absarc(0, doorH - doorW / 2, doorW / 2, 0, Math.PI, false);
  frameShape.lineTo(-doorW / 2, 0);
  frameShape.closePath();
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 16 }), trim);
  frame.position.set(0, 0, D / 2);
  g.add(frame);
  // The open door leaf, swung inward-left (a green door with a heart window).
  const leaf = new THREE.Mesh(new THREE.ExtrudeGeometry(arch, { depth: 0.08, bevelEnabled: false, curveSegments: 16 }), soft('#2f7d4c'));
  leaf.position.set(-doorW / 2, 0, D / 2 - 0.02);
  leaf.geometry.translate(doorW / 2, 0, 0);
  leaf.rotation.y = -1.9;
  g.add(leaf);
  // Wreath above the door.
  const wreath = new THREE.Mesh(fluffTorus(0.28, 0.09, { seed: 5, tubular: 32, amp: 0.5 }), soft('#2f7a48'));
  wreath.rotation.x = Math.PI / 2;
  wreath.position.set(0, doorH + 0.45, D / 2 + 0.12);
  const bow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), soft('#d8263a'));
  bow.position.set(0, doorH + 0.2, D / 2 + 0.2);
  g.add(wreath, bow);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), glowMat('#ff3b3b', 0.9));
    berry.position.set(Math.cos(a) * 0.28, doorH + 0.45 + Math.sin(a) * 0.28, D / 2 + 0.2);
    g.add(berry);
  }
  // Step.
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.7), wood);
  step.position.set(0, 0.08, D / 2 + 0.35);
  g.add(step);

  // Windows with warm light, white mullions, snowy sills.
  const windows: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.85), warm);
    win.position.set(sx * 1.65, 1.45, D / 2 + 0.02);
    windows.push(win);
    g.add(win);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 0.08), trim);
    fr.position.set(sx * 1.65, 1.45, D / 2 - 0.01);
    fr.scale.z = 0.5;
    g.add(fr);
    for (const [w, h, x, y] of [
      [0.06, 0.85, 0, 0],
      [0.95, 0.06, 0, 0],
      [1.1, 0.08, 0, 0.46],
      [0.08, 0.95, -0.51, 0],
      [0.08, 0.95, 0.51, 0],
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), trim);
      bar.position.set(sx * 1.65 + x, 1.45 + y, D / 2 + 0.05);
      g.add(bar);
    }
    const sill = new THREE.Mesh(cushionGeometry({ a: 0.62, b: 0.08, c: 0.16, p: 3 }, 20, 10), snow);
    sill.position.set(sx * 1.65, 0.98, D / 2 + 0.1);
    g.add(sill);
  }
  // Round window in the gable.
  const round = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), warm);
  round.position.set(0, H + 0.7, D / 2 + 0.02);
  const roundFr = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 8, 28), trim);
  roundFr.position.copy(round.position);
  g.add(round, roundFr);
  windows.push(round);

  // Chimney (bricks) with a snow cap.
  const bricks = bricksTexture();
  bricks.repeat.set(1, 2);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), new THREE.MeshStandardMaterial({ map: bricks, roughness: 0.9 }));
  chim.position.set(1.45, H + 1.6, -0.6);
  const chimCap = new THREE.Mesh(cushionGeometry({ a: 0.48, b: 0.13, c: 0.48, p: 3 }, 16, 10), snow);
  chimCap.position.set(1.45, H + 2.44, -0.6);
  g.add(chim, chimCap);

  // String lights along the front eaves.
  const bulbs: THREE.Mesh[] = [];
  const eaveY = H + 0.05;
  for (const sx of [-1, 1]) {
    const from = new THREE.Vector3(0, H + 1.55, D / 2 + 0.5);
    const to = new THREE.Vector3(sx * (W / 2 + 0.45), eaveY - 0.15, D / 2 + 0.5);
    const str = makeLightString(from, to, 9, 0.1, 0.055);
    g.add(str);
    bulbs.push(...str.userData.bulbs);
  }
  const front = makeLightString(new THREE.Vector3(-W / 2 - 0.4, eaveY - 0.1, D / 2 + 0.55), new THREE.Vector3(W / 2 + 0.4, eaveY - 0.1, D / 2 + 0.55), 16, 0.25, 0.055);
  // (Only on the side eaves when seen from the front, the gable string already crosses.)
  front.visible = false;
  g.add(front);

  shadowed(g, !lowPower);
  for (const w of windows) w.castShadow = false;
  glowDoor.castShadow = false;
  g.userData.door = new THREE.Vector3(0, 0, D / 2 + 0.75);
  g.userData.chimney = new THREE.Vector3(1.45, H + 2.6, -0.6);
  g.userData.bulbs = bulbs;
  g.userData.windows = windows;
  return g;
}

// ---------------------------------------------------------------------------
// Aurora borealis

const AURORA_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float t = uTime * 0.12 + uPhase;
    p.y += sin(uv.x * 9.0 + t * 2.0) * 1.6 + sin(uv.x * 23.0 - t * 3.0) * 0.6;
    p.z += sin(uv.x * 6.0 + t) * 3.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const AURORA_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float t = uTime * 0.1 + uPhase;
    // Curtain folds drifting along the ribbon.
    float folds = 0.55 + 0.45 * sin(vUv.x * 60.0 + sin(vUv.x * 13.0 + t * 2.0) * 3.0 + t * 4.0);
    folds *= 0.6 + 0.4 * sin(vUv.x * 17.0 - t * 1.5);
    // Bright at the lower edge, fading up like a curtain of light.
    float v = vUv.y;
    float edge = smoothstep(0.0, 0.08, v) * pow(1.0 - v, 1.6);
    float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    vec3 col = mix(uLow, uHigh, smoothstep(0.1, 0.9, v));
    float a = edge * ends * (0.35 + 0.65 * folds) * uOpacity;
    gl_FragColor = vec4(col * a, a);
  }
`;

export type Aurora = THREE.Group & { userData: { mats: THREE.ShaderMaterial[] } };

/** Layered glowing ribbons of light in the sky (green, teal, a touch of violet). */
export function makeAurora(opts: { radius?: number; y?: number; lowPower?: boolean; opacity?: number } = {}): Aurora {
  const g = new THREE.Group() as Aurora;
  const R = opts.radius ?? 80;
  const y0 = opts.y ?? 18;
  const ribbons = [
    { low: '#3dffa8', high: '#3fb6ff', phase: 0, h: 16, arc: [-1.25, 0.15], dy: 0, r: R },
    { low: '#5cff7a', high: '#9a6bff', phase: 2.1, h: 13, arc: [-0.5, 0.9], dy: 6, r: R * 1.08 },
    { low: '#2fe0c4', high: '#ff7ad9', phase: 4.2, h: 10, arc: [-0.95, 0.55], dy: 12, r: R * 1.15 },
  ];
  const mats: THREE.ShaderMaterial[] = [];
  for (const rb of opts.lowPower ? ribbons.slice(0, 2) : ribbons) {
    const seg = opts.lowPower ? 60 : 120;
    const geo = new THREE.PlaneGeometry(1, 1, seg, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5;
      const v = pos.getY(i) + 0.5;
      const a = rb.arc[0] + (rb.arc[1] - rb.arc[0]) * u - Math.PI / 2;
      const r = rb.r + Math.sin(u * 7 + rb.phase) * 6;
      pos.setXYZ(i, Math.cos(a) * r, y0 + rb.dy + v * rb.h, Math.sin(a) * r);
    }
    const mat = new THREE.ShaderMaterial({
      vertexShader: AURORA_VERT,
      fragmentShader: AURORA_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: rb.phase },
        uLow: { value: new THREE.Color(rb.low) },
        uHigh: { value: new THREE.Color(rb.high) },
        uOpacity: { value: opts.opacity ?? 0.85 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    mats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    g.add(mesh);
  }
  g.userData.mats = mats;
  return g;
}

// ---------------------------------------------------------------------------
// Fireplace, stockings

export type Fireplace = THREE.Group & { userData: { flames: THREE.Mesh[]; glows: THREE.Sprite[]; light: THREE.PointLight | null; mantelY: number } };

/** A brick fireplace with a wooden mantel and a crackling (code-built) fire. */
export function makeFireplace(lowPower = false, withLight = true): Fireplace {
  const g = new THREE.Group() as Fireplace;
  const bricks = bricksTexture();
  bricks.repeat.set(2, 1.5);
  const brickMat = new THREE.MeshStandardMaterial({ map: bricks, roughness: 0.95 });
  const W = 2.2;
  const H = 1.5;
  const Dp = 0.7;
  // Frame around an arched opening.
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, H);
  s.lineTo(-W / 2, H);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-0.6, 0);
  hole.lineTo(-0.6, 0.65);
  hole.absarc(0, 0.65, 0.6, Math.PI, 0, true);
  hole.lineTo(0.6, 0);
  hole.closePath();
  s.holes.push(hole);
  const front = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: Dp, bevelEnabled: false, curveSegments: 16 }), brickMat);
  front.position.z = -Dp;
  g.add(front);
  // Dark firebox inside.
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.25, 0.1), new THREE.MeshBasicMaterial({ color: '#1b0d08' }));
  box.position.set(0, 0.62, -Dp + 0.05);
  g.add(box);
  // Mantel shelf.
  const mantel = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.14, Dp + 0.25), soft('#6d3d1e'));
  mantel.position.set(0, H + 0.07, -Dp / 2 + 0.1);
  g.add(mantel);
  // Logs and fire.
  const logMat = soft('#5a3420');
  for (const [x, rot] of [
    [-0.15, 0.3],
    [0.15, -0.3],
  ]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 10), logMat);
    log.rotation.set(0, rot, Math.PI / 2);
    log.position.set(x, 0.1, -Dp / 2);
    g.add(log);
  }
  const flames: THREE.Mesh[] = [];
  const glows: THREE.Sprite[] = [];
  const flameCols = ['#ff6a1a', '#ffb02e', '#ffe27a'];
  for (let i = 0; i < 5; i++) {
    const c = flameCols[i % 3];
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.12 - (i % 3) * 0.025, 0.5 - (i % 3) * 0.1, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.5), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    f.position.set((i - 2) * 0.12, 0.38 - (i % 3) * 0.04, -Dp / 2 + 0.05 + (i % 2) * 0.05);
    f.userData.base = f.position.clone();
    flames.push(f);
    g.add(f);
  }
  for (const [size, op] of [
    [1.6, 0.55],
    [0.9, 0.7],
  ]) {
    const gl = glow('#ff9a3c', size, op);
    gl.position.set(0, 0.4, -Dp / 2 + 0.2);
    glows.push(gl);
    g.add(gl);
  }
  let light: THREE.PointLight | null = null;
  if (withLight) {
    light = new THREE.PointLight('#ff9a4a', lowPower ? 6 : 9, 7, 1.6);
    light.position.set(0, 0.6, 0.4);
    g.add(light);
  }
  shadowed(g, !lowPower);
  flames.forEach((f) => (f.castShadow = false));
  g.userData.flames = flames;
  g.userData.glows = glows;
  g.userData.light = light;
  g.userData.mantelY = H + 0.14;
  return g;
}

/** Flicker the fire. */
export function animateFire(f: Fireplace, t: number, energy = 1) {
  f.userData.flames.forEach((m, i) => {
    const k = 1 + (Math.sin(t * (7 + i) + i * 2) * 0.12 + Math.sin(t * (13 + i * 1.3)) * 0.08) * energy;
    m.scale.set(1, k, 1);
    const base = m.userData.base as THREE.Vector3;
    m.position.y = base.y + (k - 1) * 0.2;
    m.position.x = base.x + Math.sin(t * 3 + i) * 0.01 * energy;
  });
  const flick = 1 + (Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04) * energy;
  f.userData.glows.forEach((g, i) => (g.material.opacity = (i ? 0.7 : 0.55) * flick));
  if (f.userData.light) f.userData.light.intensity = (f.userData.light.userData.base ??= f.userData.light.intensity) * flick;
}

/** A felt Christmas stocking with a white cuff. */
export function makeStocking(color: string, lowPower = false): THREE.Group {
  const g = new THREE.Group();
  const m = felt(color, { repeat: 2, lowPower });
  const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 4, 12), m);
  leg.position.y = -0.25;
  const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 12), m);
  foot.rotation.z = Math.PI / 2;
  foot.position.set(0.08, -0.45, 0);
  const cuff = new THREE.Mesh(cushionGeometry({ a: 0.14, b: 0.07, c: 0.12, p: 2.6 }, 14, 10), felt('#fbf6ee', { repeat: 1, lowPower }));
  cuff.position.y = -0.04;
  g.add(leg, foot, cuff);
  return shadowed(g);
}

// ---------------------------------------------------------------------------
// Toys

/** A wooden toy block with a painted star (no letters: for everyone). */
export function makeBlock(color: string, size = 0.22): THREE.Mesh {
  const m = new THREE.Mesh(cushionGeometry({ a: size / 2, b: size / 2, c: size / 2, p: 6 }, 12, 10), soft(color, { roughness: 0.6 }));
  m.position.y = size / 2;
  return m;
}

/** A little toy drum. */
export function makeDrum(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 18), soft('#2f6fd6', { roughness: 0.5 }));
  shell.position.y = 0.1;
  const rims = [0.01, 0.19].map((y) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 18), soft('#f0bd45', { metalness: 0.6, roughness: 0.3 }));
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    return r;
  });
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.155, 18), soft('#fff6e6'));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.201;
  g.add(shell, ...rims, top);
  return g;
}

/** A small toy train engine. */
export function makeTrain(): THREE.Group {
  const g = new THREE.Group();
  const red = soft('#d8263a', { roughness: 0.5 });
  const blue = soft('#2f6fd6', { roughness: 0.5 });
  const cab = new THREE.Mesh(cushionGeometry({ a: 0.1, b: 0.12, c: 0.1, p: 5 }, 10, 10), blue);
  cab.position.set(0, 0.2, -0.1);
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.26, 14), red);
  boiler.rotation.x = Math.PI / 2;
  boiler.position.set(0, 0.14, 0.08);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.1, 10), soft('#2b2b3a'));
  stack.position.set(0, 0.25, 0.15);
  g.add(cab, boiler, stack);
  for (const z of [-0.1, 0.12])
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), soft('#f0bd45', { metalness: 0.5 }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 0.1, 0.05, z);
      g.add(wheel);
    }
  return g;
}

/** A felt teddy bear sitting. */
export function makeTeddy(color = '#c48a55', lowPower = false): THREE.Group {
  const g = new THREE.Group();
  const m = felt(color, { repeat: 2, lowPower });
  const light = felt('#f1dcb6', { repeat: 1, lowPower });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), m);
  body.scale.set(1, 1.1, 0.9);
  body.position.y = 0.17;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), m);
  head.position.y = 0.4;
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), light);
  snout.position.set(0, 0.38, 0.1);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), soft('#2a1a1c'));
  nose.position.set(0, 0.4, 0.15);
  g.add(body, head, snout, nose);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), m);
    ear.position.set(sx * 0.09, 0.5, 0);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), soft('#1c1218', { roughness: 0.2 }));
    eye.position.set(sx * 0.045, 0.43, 0.105);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.1, 4, 8), m);
    arm.position.set(sx * 0.15, 0.2, 0.05);
    arm.rotation.z = sx * 0.6;
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.08, 4, 8), m);
    leg.position.set(sx * 0.09, 0.05, 0.1);
    leg.rotation.x = Math.PI / 2;
    g.add(ear, eye, arm, leg);
  }
  return shadowed(g);
}

/** A cosy wooden shelf, `w` wide. */
export function makeShelf(w: number): THREE.Mesh {
  const tex = planksTexture('#8a5530', 1);
  tex.repeat.set(1, 1);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.38), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Spheres of soft light floating like magic dust (a cheap sparkle field). */
export function makeSparkles(n: number, box: THREE.Box3, color = '#fff2c4', size = 0.12): THREE.Points {
  const pos = new Float32Array(n * 3);
  const r = rng(91);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = box.min.x + r() * (box.max.x - box.min.x);
    pos[i * 3 + 1] = box.min.y + r() * (box.max.y - box.min.y);
    pos[i * 3 + 2] = box.min.z + r() * (box.max.z - box.min.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g2 = c.getContext('2d')!;
  const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = grad;
  g2.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  p.frustumCulled = false;
  return p;
}
