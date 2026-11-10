import * as THREE from 'three';
import { felt } from '../ziggy/felt';
import { cushionGeometry, frontZ, type Cushion } from '../ziggy/shapes';
import { fluffTorus, mergeAll, puffAt, puffGeometry, taperedTube } from './fluff';
import { damp, followTalk } from './framing';
import { rng } from '../kit/rng';
import { scrollTexture, sparkleTexture } from './textures';

/**
 * Santa, a felt plush like Ziggy, built in code: a big round red belly with
 * white fur trims, a black belt with a gold buckle, a big fluffy beard made
 * of soft puffs (its lower half rides on the jaw, so it moves when he
 * talks), a curled moustache, rosy apple cheeks, round gold glasses over
 * twinkling bead eyes, a floppy hat with a pompom, green mittens and black
 * boots. Always happy: there is no sad or cross pose at all.
 *
 * Origin on the ground between the boots, facing +z, about 2.3 units tall.
 */

export type SantaPose = 'idle' | 'laugh' | 'wave' | 'listen' | 'write' | 'wink' | 'hug';

export const SANTA_COLORS = {
  red: '#cf2531',
  redSheen: '#ff9c9c',
  fur: '#fbf6ee',
  skin: '#f6c2a0',
  cheek: '#f17f88',
  nose: '#ee8b82',
  black: '#2c2528',
  mitten: '#2f9152',
  gold: '#f0bd45',
};

const HIP_Y = 0.45;
const BELLY_Y = 0.86;
const NECK_Y = 1.33;
const HEAD_Y = 1.64;
const BELLY: Cushion = { a: 0.56, b: 0.52, c: 0.5, p: 2.15 };
const HEAD: Cushion = { a: 0.32, b: 0.31, c: 0.3, p: 2.2 };
const BOOT: Cushion = { a: 0.14, b: 0.115, c: 0.2, p: 2.4 };
const HAND: Cushion = { a: 0.1, b: 0.125, c: 0.082, p: 2.3 };
const L1 = 0.34;
const L2 = 0.32;
const EYE_X = 0.105;
const EYE_Y = 0.04;
const JAW = new THREE.Vector3(0, -0.06, 0.02);
const HEAD_SCALE = 1.1;
/** Head-space height where the lower beard (the bib on the belly) starts. */
const BIB_Y = -0.36;

/** Belly is a little pear-shaped: wider at the bottom. */
const pear = (yLocal: number) => 1 - 0.08 * (yLocal / BELLY.b);
/** Horizontal radius of the belly at a height (belly-local). */
function bellyR(yLocal: number) {
  const k = 1 - Math.pow(Math.abs(yLocal / BELLY.b), BELLY.p);
  return k <= 0 ? 0 : BELLY.a * Math.pow(k, 1 / BELLY.p) * pear(yLocal);
}

export interface SantaArm {
  shoulder: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
}

export interface SantaModel {
  root: THREE.Group;
  torso: THREE.Group;
  belly: THREE.Mesh;
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  /** The lower beard, lying on the belly. */
  bib: THREE.Group;
  hat: THREE.Group;
  moustache: THREE.Group;
  /** The dark mouth opening behind the moustache (its width follows the visemes). */
  mouth: THREE.Mesh;
  brows: [THREE.Mesh, THREE.Mesh];
  eyes: [THREE.Group, THREE.Group];
  happyEyes: [THREE.Mesh, THREE.Mesh];
  twinkles: [THREE.Sprite, THREE.Sprite];
  arms: [SantaArm, SantaArm];
  scroll: THREE.Group;
  quill: [THREE.Group, THREE.Group];
}

// ---------------------------------------------------------------------------

function goldMat(low: boolean) {
  return new THREE.MeshStandardMaterial({ color: SANTA_COLORS.gold, metalness: low ? 0.4 : 0.85, roughness: 0.3, emissive: '#5a3a00', emissiveIntensity: low ? 0.5 : 0.2 });
}

/** Build the plush Santa (meshes only; the rig animates it). */
export function buildSanta(opts: { lowPower?: boolean } = {}): SantaModel {
  const low = Boolean(opts.lowPower);
  const S = (n: number) => Math.max(8, Math.round(n * (low ? 0.6 : 1)));
  const red = felt(SANTA_COLORS.red, { repeat: 4, sheen: SANTA_COLORS.redSheen, lowPower: low });
  const redSmall = felt(SANTA_COLORS.red, { repeat: 2, sheen: SANTA_COLORS.redSheen, lowPower: low });
  const fur = felt(SANTA_COLORS.fur, { repeat: 3, sheen: '#ffffff', roughness: 1, lowPower: low, emissive: '#fff4e6', emissiveIntensity: 0.07 });
  fur.normalScale.set(0.8, 0.8);
  const skin = felt(SANTA_COLORS.skin, { repeat: 3, sheen: '#ffe2cf', lowPower: low });
  const cheekMat = felt(SANTA_COLORS.cheek, { repeat: 2, sheen: '#ffc0c8', lowPower: low });
  const noseMat = felt(SANTA_COLORS.nose, { repeat: 2, sheen: '#ffc8c0', lowPower: low });
  const black = felt(SANTA_COLORS.black, { repeat: 3, sheen: '#8a7a80', lowPower: low });
  const mittenMat = felt(SANTA_COLORS.mitten, { repeat: 2, sheen: '#b6ffcc', lowPower: low });
  const gold = goldMat(low);
  const bead = new THREE.MeshStandardMaterial({ color: '#1c1218', roughness: 0.16, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a1a1c', roughness: 0.6 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: '#5a1d28', roughness: 0.9 });
  const lipMat = new THREE.MeshStandardMaterial({ color: '#d6626c', roughness: 0.7 });
  const tongueMat = new THREE.MeshStandardMaterial({ color: '#ee7f86', roughness: 0.7 });
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  const root = new THREE.Group();
  root.name = 'santa';

  // --- Legs and boots (stay on the ground) -------------------------------
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.22, 6, S(16)), red);
    leg.position.set(sx * 0.2, 0.34, 0);
    const boot = new THREE.Mesh(
      cushionGeometry(BOOT, S(28), S(18), (v) => {
        if (v.y < -0.06) v.y = -0.06 + (v.y + 0.06) * 0.4;
        if (v.z > 0.05 && v.y > 0) v.y *= 1 - 0.3 * ((v.z - 0.05) / BOOT.c);
      }),
      black
    );
    boot.position.set(sx * 0.21, 0.1, 0.05);
    const cuff = new THREE.Mesh(fluffTorus(0.13, 0.055, { seed: 10 + sx, tubular: S(36) }), fur);
    cuff.position.set(sx * 0.2, 0.22, 0.01);
    root.add(leg, boot, cuff);
  }

  // --- Torso (pivot at the hips) -----------------------------------------
  const torso = new THREE.Group();
  torso.position.y = HIP_Y;
  root.add(torso);
  const by = BELLY_Y - HIP_Y;
  const belly = new THREE.Mesh(
    cushionGeometry(BELLY, S(48), S(36), (v) => {
      const k = pear(v.y);
      v.x *= k;
      v.z *= k;
    }),
    red
  );
  belly.position.y = by;
  torso.add(belly);
  // Coat hem.
  const hemY = -0.4;
  const hemR = bellyR(hemY);
  const hem = new THREE.Mesh(fluffTorus(hemR + 0.01, 0.075, { seed: 4, tubular: S(64), radial: S(12), zScale: BELLY.c / BELLY.a }), fur);
  hem.position.y = by + hemY;
  torso.add(hem);
  // Front fur strip, from the collar down to the hem.
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const y = 0.44 - (0.82 * i) / 10;
      pts.push(new THREE.Vector3(0, by + y, frontZ(BELLY, 0, y) * pear(y) + 0.005));
    }
    const strip = new THREE.Mesh(taperedTube(pts, () => 0.07, { tubular: S(40), radial: S(12), amp: 0.35, freq: 9, seed: 6, squash: 0.55, squashAxis: new THREE.Vector3(0, 0, 1) }), fur);
    torso.add(strip);
  }
  // Belt and buckle.
  {
    const beltY = -0.07;
    const r = Math.max(bellyR(beltY - 0.06), bellyR(beltY + 0.06), bellyR(beltY)) + 0.014;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.13, S(48), 1, true), black);
    belt.scale.z = BELLY.c / BELLY.a;
    belt.position.y = by + beltY;
    const edge = (dy: number) => {
      const e = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, S(48)), black);
      e.rotation.x = Math.PI / 2;
      e.scale.y = BELLY.c / BELLY.a;
      e.position.y = by + beltY + dy;
      return e;
    };
    const outer = new THREE.Shape();
    outer.moveTo(-0.11, -0.09);
    outer.absarc(0.08, -0.06, 0.03, -Math.PI / 2, 0, false);
    outer.absarc(0.08, 0.06, 0.03, 0, Math.PI / 2, false);
    outer.absarc(-0.08, 0.06, 0.03, Math.PI / 2, Math.PI, false);
    outer.absarc(-0.08, -0.06, 0.03, Math.PI, Math.PI * 1.5, false);
    const hole = new THREE.Path();
    hole.moveTo(-0.055, -0.045);
    hole.absarc(0.045, -0.035, 0.012, -Math.PI / 2, 0, false);
    hole.absarc(0.045, 0.035, 0.012, 0, Math.PI / 2, false);
    hole.absarc(-0.045, 0.035, 0.012, Math.PI / 2, Math.PI, false);
    hole.absarc(-0.045, -0.035, 0.012, Math.PI, Math.PI * 1.5, false);
    outer.holes.push(hole);
    const buckle = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: low ? 1 : 3, curveSegments: 6 }), gold);
    buckle.position.set(0, by + beltY, r * (BELLY.c / BELLY.a) + 0.004);
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.02), gold);
    prong.position.set(0, by + beltY, r * (BELLY.c / BELLY.a) + 0.012);
    torso.add(belt, edge(0.065), edge(-0.065), buckle, prong);
  }

  // --- Arms (IK in torso space) ------------------------------------------
  const quill: THREE.Group[] = [];
  const arms = [-1, 1].map((sx) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.4, 1.2 - HIP_Y, -0.01);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.135, S(20), S(14)), red);
    pad.scale.set(0.95, 1, 1);
    shoulder.add(pad);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.118, L1 - 0.1, 6, S(16)), redSmall);
    upper.position.y = -L1 / 2;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -L1;
    shoulder.add(elbow);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.112, S(16), S(12)), redSmall);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, L2 - 0.12, 6, S(16)), redSmall);
    fore.position.y = -L2 / 2 + 0.02;
    const cuff = new THREE.Mesh(fluffTorus(0.1, 0.052, { seed: 20 + sx, tubular: S(32) }), fur);
    cuff.position.y = -L2 + 0.04;
    elbow.add(joint, fore, cuff);
    const wrist = new THREE.Group();
    wrist.position.y = -L2;
    elbow.add(wrist);
    const palm = new THREE.Mesh(
      cushionGeometry(HAND, S(22), S(16), (v) => {
        // A mitten: a little flatter at the palm, rounder at the tip.
        if (v.y < 0) v.x *= 1 + 0.08 * (-v.y / HAND.b);
      }),
      mittenMat
    );
    palm.position.y = -0.1;
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.055, 4, S(10)), mittenMat);
    thumb.position.set(0, -0.07, 0.075);
    thumb.rotation.set(0.75, 0, 0);
    wrist.add(palm, thumb);
    // A feather quill (shown while writing).
    const q = new THREE.Group();
    const feather = new THREE.Mesh(
      taperedTube(
        [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.01, 0.12, 0), new THREE.Vector3(0.03, 0.26, 0), new THREE.Vector3(0.07, 0.36, 0)],
        (t) => 0.004 + Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.04,
        { tubular: 20, radial: 8, squash: 0.85, squashAxis: new THREE.Vector3(0, 0, 1) }
      ),
      new THREE.MeshStandardMaterial({ color: '#fff6e0', roughness: 0.8, side: THREE.DoubleSide })
    );
    const nib = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.06, 6), gold);
    nib.rotation.x = Math.PI;
    nib.position.y = -0.03;
    q.add(feather, nib);
    q.position.set(0, -0.12, 0.09);
    q.rotation.set(0.2, 0, -sx * 0.5);
    q.scale.setScalar(0.0001);
    q.visible = false;
    wrist.add(q);
    quill.push(q);
    torso.add(shoulder);
    return { shoulder, elbow, wrist };
  }) as [SantaArm, SantaArm];

  // --- The "nice things" scroll (held while writing) ---------------------
  const scroll = new THREE.Group();
  {
    const w = 0.5;
    const h = 0.4;
    const paperGeo = new THREE.PlaneGeometry(w, h, 12, 1);
    const pp = paperGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) pp.setZ(i, -Math.pow(pp.getX(i) / (w / 2), 2) * 0.03);
    paperGeo.computeVertexNormals();
    const paper = new THREE.Mesh(paperGeo, new THREE.MeshStandardMaterial({ map: scrollTexture(), roughness: 0.9, side: THREE.DoubleSide }));
    const rollMat = new THREE.MeshStandardMaterial({ color: '#f1dca8', roughness: 0.85 });
    for (const dy of [-1, 1]) {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, w + 0.02, 14), rollMat);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, (dy * h) / 2, 0.005);
      const capL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), gold);
      capL.position.set(-(w + 0.04) / 2, (dy * h) / 2, 0.005);
      const capR = capL.clone();
      capR.position.x *= -1;
      scroll.add(roll, capL, capR);
    }
    scroll.add(paper);
    scroll.position.set(0, 0.62, 0.68);
    scroll.rotation.x = -0.75;
    scroll.scale.setScalar(0.0001);
    scroll.visible = false;
    torso.add(scroll);
  }

  // --- Head --------------------------------------------------------------
  const neck = new THREE.Group();
  neck.position.y = NECK_Y - HIP_Y;
  torso.add(neck);
  const head = new THREE.Group();
  head.position.y = HEAD_Y - NECK_Y;
  head.scale.setScalar(HEAD_SCALE);
  neck.add(head);
  const skull = new THREE.Mesh(cushionGeometry(HEAD, S(48), S(36)), skin);
  head.add(skull);
  const fz = (x: number, y: number) => frontZ(HEAD, x, y);

  // Nose and rosy apple cheeks.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.062, S(20), S(14)), noseMat);
  nose.position.set(0, -0.035, fz(0, -0.035) + 0.028);
  head.add(nose);
  for (const sx of [-1, 1]) {
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.072, S(18), S(12)), cheekMat);
    ch.scale.set(1, 0.85, 0.55);
    ch.position.set(sx * 0.175, -0.05, fz(0.175, -0.05) - 0.005);
    head.add(ch);
  }

  // Eyes: glossy beads with a highlight; ^ ^ arcs for laughing and winking.
  const eyes: THREE.Group[] = [];
  const happyEyes: THREE.Mesh[] = [];
  const twinkles: THREE.Sprite[] = [];
  const sparkTex = sparkleTexture();
  for (const sx of [-1, 1]) {
    const x = sx * EYE_X;
    const z = fz(x, EYE_Y);
    const eye = new THREE.Group();
    eye.position.set(x, EYE_Y, z - 0.012);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.042, S(18), S(14)), bead);
    ball.scale.set(0.9, 1.08, 0.7);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), shine);
    hi.position.set(-0.012, 0.018, 0.028);
    const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), shine);
    hi2.position.set(0.014, -0.012, 0.028);
    eye.add(ball, hi, hi2);
    head.add(eye);
    eyes.push(eye);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.009, 6, 16, Math.PI), dark);
    arc.position.set(x, EYE_Y - 0.012, z + 0.012);
    arc.visible = false;
    head.add(arc);
    happyEyes.push(arc);
    const tw = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: '#fff6d8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    tw.position.set(x + sx * 0.045, EYE_Y + 0.05, z + 0.07);
    tw.scale.setScalar(0.08);
    head.add(tw);
    twinkles.push(tw);
  }

  // Round gold glasses.
  {
    const lensMat = new THREE.MeshStandardMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0.2, depthWrite: false });
    const z = fz(EYE_X, EYE_Y) + 0.04;
    for (const sx of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.0075, 8, S(36)), gold);
      rim.position.set(sx * EYE_X, EYE_Y, z);
      rim.rotation.y = sx * 0.12;
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.064, S(28)), lensMat);
      lens.position.copy(rim.position);
      lens.rotation.y = rim.rotation.y;
      lens.renderOrder = 2;
      const temple = new THREE.Mesh(
        taperedTube([new THREE.Vector3(sx * (EYE_X + 0.066), EYE_Y + 0.01, z - 0.01), new THREE.Vector3(sx * 0.26, EYE_Y + 0.02, z - 0.09), new THREE.Vector3(sx * 0.31, EYE_Y + 0.01, 0.06)], () => 0.0065, { tubular: 10, radial: 6 }),
        gold
      );
      head.add(rim, lens, temple);
    }
    const bridge = new THREE.Mesh(
      taperedTube([new THREE.Vector3(-EYE_X + 0.066, EYE_Y + 0.01, z), new THREE.Vector3(0, EYE_Y + 0.03, z + 0.03), new THREE.Vector3(EYE_X - 0.066, EYE_Y + 0.01, z)], () => 0.0065, { tubular: 10, radial: 6 }),
      gold
    );
    head.add(bridge);
  }

  // Bushy white eyebrows.
  const brows = [-1, 1].map((sx) => {
    const pts = [new THREE.Vector3(sx * 0.035, 0, 0.01), new THREE.Vector3(sx * 0.085, 0.018, 0), new THREE.Vector3(sx * 0.14, 0.01, -0.03), new THREE.Vector3(sx * 0.175, -0.015, -0.06)];
    const m = new THREE.Mesh(
      taperedTube(pts, (t) => 0.012 + Math.sin(Math.min(1, t * 1.2 + 0.1) * Math.PI) * 0.024, { tubular: 18, radial: 10, amp: 0.4, freq: 4, seed: 30 + sx, squash: 0.35, squashAxis: new THREE.Vector3(0, 0, 1) }),
      fur
    );
    const y = 0.135;
    m.position.set(0, y, fz(0.1, y) + 0.012);
    m.userData.restY = y;
    head.add(m);
    return m;
  }) as unknown as [THREE.Mesh, THREE.Mesh];

  // Mouth: a dark opening behind the moustache, seen when the jaw drops.
  const cavity = new THREE.Mesh(new THREE.SphereGeometry(1, S(18), S(12)), mouthMat);
  cavity.scale.set(0.09, 0.08, 0.05);
  cavity.position.set(0, -0.18, fz(0, -0.18) - 0.014);
  head.add(cavity);

  // Moustache: two plump curls.
  const moustache = new THREE.Group();
  {
    const z0 = fz(0, -0.1) + 0.04;
    const parts: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      const pts = [
        new THREE.Vector3(sx * 0.012, -0.095, z0 + 0.01),
        new THREE.Vector3(sx * 0.08, -0.115, z0 - 0.005),
        new THREE.Vector3(sx * 0.16, -0.11, z0 - 0.035),
        new THREE.Vector3(sx * 0.22, -0.075, z0 - 0.075),
        new THREE.Vector3(sx * 0.245, -0.03, z0 - 0.1),
        new THREE.Vector3(sx * 0.225, -0.005, z0 - 0.105),
      ];
      parts.push(
        taperedTube(pts, (t) => 0.014 + Math.pow(Math.sin(Math.min(1, 0.12 + t * 0.95) * Math.PI), 0.7) * 0.046, {
          tubular: S(32),
          radial: S(14),
          amp: 0.3,
          freq: 4,
          seed: 40 + sx,
          squash: 0.3,
          squashAxis: new THREE.Vector3(0, 0, 1),
        })
      );
    }
    moustache.add(new THREE.Mesh(mergeAll(parts), fur));
    head.add(moustache);
  }

  // Cheek beard (sideburns) and hair under the hat: fixed on the head.
  {
    const r = rng(77);
    const parts: THREE.BufferGeometry[] = [];
    const seg = low ? 12 : 16;
    for (const sx of [-1, 1]) {
      // From the sideburn down along the jaw to the corner of the mouth.
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const x = sx * (0.31 - t * 0.12);
        const y = 0.06 - t * 0.25;
        const z = 0.02 + t * 0.2;
        parts.push(puffAt(x, y, z, 0.085 - t * 0.012, 50 + i * 3 + sx, { seg, sz: 0.85 }));
      }
      // Hair at the back and sides.
      for (let i = 0; i < 4; i++) {
        const a = 0.35 + i * 0.42;
        parts.push(puffAt(sx * Math.cos(a) * 0.3, 0.08 - r() * 0.06, -Math.sin(a) * 0.29 + 0.02, 0.1, 60 + i + sx * 7, { seg }));
      }
    }
    parts.push(puffAt(0, 0.06, -0.31, 0.11, 71, { seg }));
    head.add(new THREE.Mesh(mergeAll(parts), fur));
  }

  // Jaw: lower lip, tongue and the big lower beard move together.
  const jaw = new THREE.Group();
  jaw.position.copy(JAW);
  head.add(jaw);
  const bib = new THREE.Group();
  {
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.014, 8, 20, Math.PI), lipMat);
    lip.rotation.z = Math.PI;
    lip.position.set(0, -0.135, fz(0, -0.15) + 0.012).sub(JAW);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), tongueMat);
    tongue.scale.set(0.05, 0.022, 0.03);
    tongue.position.set(0, -0.19, fz(0, -0.18) - 0.02).sub(JAW);
    jaw.add(lip, tongue);

    const r = rng(5);
    const upper: THREE.BufferGeometry[] = [];
    const lower: THREE.BufferGeometry[] = [];
    const seg = low ? 12 : 18;
    const top = -0.25;
    const bottom = -0.64;
    const rows = 6;
    // The beard lies on the face, then on the round belly: every puff sits
    // on that surface (in head space; the head is scaled by HEAD_SCALE).
    const chestZ = (x: number, y: number) => {
      const yb = HEAD_Y + y * HEAD_SCALE - BELLY_Y;
      const k = pear(yb);
      return (frontZ(BELLY, (x * HEAD_SCALE) / k, yb) * k) / HEAD_SCALE;
    };
    const surf = (x: number, y: number) => Math.max(y > -0.29 ? fz(x, y) : 0, chestZ(x, y));
    // Wide under the cheeks, tapering to a soft rounded tip. Big curly
    // puffs in staggered rows, like a cloud of wadding.
    const halfW = (u: number) => 0.235 + 0.1 * Math.sin(Math.PI * u * 0.85) - 0.21 * u * u * u;
    for (let j = 0; j < rows; j++) {
      const u = j / (rows - 1);
      const y = top + (bottom - top) * u;
      const w = halfW(u);
      const n = Math.max(1, Math.round((2 * w) / 0.125));
      const into = y > BIB_Y ? upper : lower;
      for (let i = 0; i <= n; i++) {
        const s = -1 + (2 * (i + (j % 2 ? 0.5 : 0) * (i < n ? 1 : 0))) / n;
        if (s > 1.001) continue;
        const x = s * w + (r() - 0.5) * 0.02;
        const edge = s * s;
        // The top row climbs up the cheeks at the sides, leaving the mouth free.
        const yy = y + edge * 0.07 * (1 - u) + (r() - 0.5) * 0.02 + (j === 0 ? edge * 0.07 : 0);
        const rad = (0.1 + r() * 0.024 - u * 0.018) * (j === 0 ? 0.85 + edge * 0.15 : 1);
        const z = surf(x, yy) + rad * 0.3 + (1 - edge) * 0.012;
        into.push(puffAt(x, yy, z, rad, 100 + j * 13 + i, { seg, sz: 0.78, amp: 0.17, freq: 2.2 }));
        // A second layer underneath for volume (no gap ever shows the chin).
        into.push(puffAt(x * 0.95, yy + 0.04, surf(x * 0.95, yy + 0.04) + rad * 0.05, rad * 1.15, 300 + j * 13 + i, { seg: Math.max(10, seg - 6), sz: 0.7 }));
      }
    }
    // A soft curl at the tip.
    lower.push(puffAt(0.01, bottom - 0.065, surf(0, bottom - 0.065) + 0.04, 0.068, 401, { seg, amp: 0.3 }));
    const beard = new THREE.Mesh(mergeAll(upper), fur);
    beard.position.sub(JAW);
    jaw.add(beard);
    // The lower beard hangs from a pivot under the chin, so it keeps lying on
    // the belly when the head nods (the rig counter-rotates it).
    bib.position.set(0, BIB_Y, surf(0, BIB_Y)).sub(JAW);
    const bibMesh = new THREE.Mesh(mergeAll(lower), fur);
    bibMesh.position.set(0, -BIB_Y, -surf(0, BIB_Y));
    bib.add(bibMesh);
    jaw.add(bib);
  }

  // Hat: a floppy felt cone with a fluffy rim and a pompom.
  const hat = new THREE.Group();
  hat.position.set(0, 0.2, -0.02);
  hat.rotation.x = -0.18;
  head.add(hat);
  {
    const rim = new THREE.Mesh(fluffTorus(0.305, 0.075, { seed: 8, tubular: S(56), radial: S(12), amp: 0.4 }), fur);
    rim.scale.z = 0.96;
    hat.add(rim);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector3(0.36 * t * t, 0.5 * t - 0.26 * Math.pow(t, 2.6), -0.16 * t * t));
    }
    const cone = new THREE.Mesh(
      taperedTube(pts, (t) => 0.29 * Math.pow(1 - t, 0.95) + 0.03, { tubular: S(40), radial: S(20), amp: 0.06, freq: 3, seed: 12 }),
      red
    );
    cone.position.y = 0.01;
    hat.add(cone);
    const tip = pts[pts.length - 1];
    const pom = new THREE.Mesh(puffGeometry({ a: 0.085, b: 0.085, c: 0.085, p: 2 }, { amp: 0.35, freq: 3, seed: 13, wSeg: S(22), hSeg: S(16) }), fur);
    pom.position.set(tip.x + 0.02, tip.y - 0.04, tip.z);
    hat.add(pom);
    hat.userData.cone = cone;
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = !low;
    }
  });
  for (const t of twinkles) t.castShadow = false;

  return {
    root,
    torso,
    belly,
    neck,
    head,
    jaw,
    bib,
    hat,
    moustache,
    mouth: cavity,
    brows,
    eyes: eyes as [THREE.Group, THREE.Group],
    happyEyes: happyEyes as [THREE.Mesh, THREE.Mesh],
    twinkles: twinkles as [THREE.Sprite, THREE.Sprite],
    arms,
    scroll,
    quill: quill as [THREE.Group, THREE.Group],
  };
}

// ---------------------------------------------------------------------------

interface Pose {
  lean: number;
  roll: number;
  turn: number;
  pitch: number;
  yaw: number;
  tilt: number;
  hands: [THREE.Vector3, THREE.Vector3];
  twist: [number, number];
  brow: number;
  scroll: number;
  quill: number;
  /** Eyes look down (-1) or up (+1). */
  look: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const DOWN = new THREE.Vector3(0, -1, 0);
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Santa's rig: breathing, blinking, head tilt and drift, two-bone IK arms
 * reaching for hand targets, a jaw that follows the voice, and a gesture
 * for each expression (always cheerful). Call `update(dt)` every frame.
 */
export class SantaRig {
  pose: SantaPose = 'idle';
  /** Which side gestures (wave, hug, quill) use: +1 = Santa's left (picture right). */
  side: 1 | -1 = 1;
  /** Amplitude of motion (reduced motion ≈ 0.4). */
  energy = 1;
  /** Where the hands rest between gestures: on the belly, or on a desk in front (call). */
  rest: 'belly' | 'desk' = 'belly';
  /** Where Santa looks, -1..1 (x right, y up), e.g. toward the camera. */
  gaze = { x: 0, y: 0 };

  private t = 0;
  private poseT = 0;
  private talkTarget = 0;
  private talk = 0;
  private wideTarget = 1;
  private wide = 1;
  private blinkAt = 2.6;
  private blinkT = -1;
  private cur: Pose;
  private w = { laugh: 0, wave: 0, write: 0, listen: 0, wink: 0, hug: 0 };
  private hatSpring = { x: 0, v: 0, prev: 0 };
  private twinkleAt = 2;
  private twinkleT = -1;
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Quaternion(), qi: new THREE.Quaternion() };
  private restShoulders: THREE.Vector3[];

  constructor(private m: SantaModel) {
    this.cur = this.target(0);
    this.restShoulders = m.arms.map((a) => a.shoulder.position.clone());
  }

  setPose(p: SantaPose) {
    if (p === this.pose) return;
    this.pose = p;
    this.poseT = 0;
    if (p === 'wink' || p === 'laugh') this.twinkleT = 0;
  }

  setTalk(level: number) {
    this.talkTarget = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
    this.wideTarget = 1;
  }

  /** Lip sync: a mouth shape's jaw opening (0–1) and width (1 rest, < 1 rounded "o"/"ou"). */
  setMouth(open: number, wide: number) {
    this.talkTarget = Math.max(0, Math.min(1, Number.isFinite(open) ? open : 0));
    this.wideTarget = Math.max(0.5, Math.min(1.3, Number.isFinite(wide) ? wide : 1));
  }

  /** The base pose of an expression (no oscillation). */
  private target(_t: number): Pose {
    const s = this.side;
    const desk = this.rest === 'desk';
    const restHands: [THREE.Vector3, THREE.Vector3] = desk ? [V(-0.4, 0.52, 0.6), V(0.4, 0.52, 0.6)] : [V(-0.46, 0.36, 0.3), V(0.46, 0.36, 0.3)];
    const P: Pose = { lean: 0, roll: 0, turn: 0, pitch: 0.02, yaw: 0, tilt: 0.04, hands: restHands, twist: desk ? [-1.4, 1.4] : [0, 0], brow: 0, scroll: 0, quill: 0, look: 0 };
    const act = s > 0 ? 1 : 0;
    const other = 1 - act;
    switch (this.pose) {
      case 'laugh':
        P.pitch = -0.22;
        P.lean = -0.06;
        if (!desk) P.hands = [V(-0.4, 0.3, 0.38), V(0.4, 0.3, 0.38)];
        P.brow = 0.6;
        break;
      case 'wave':
        P.hands[act] = V(s * 0.74, 1.2, 0.22);
        P.twist[act] = -s * 1.4;
        P.tilt = -s * 0.1;
        P.roll = -s * 0.03;
        P.brow = 0.4;
        break;
      case 'listen':
        P.hands[act] = V(s * 0.46, 1.16, 0.08);
        P.twist[act] = -s * 1.8;
        P.lean = 0.12;
        P.tilt = s * 0.2;
        P.yaw = -s * 0.12;
        P.brow = 0.8;
        break;
      case 'write':
        P.hands[act] = V(s * 0.05, 0.66, 0.66);
        P.hands[other] = V(-s * 0.3, 0.56, 0.62);
        P.twist[act] = s * 0.6;
        P.pitch = 0.1;
        P.lean = 0.07;
        P.look = -1;
        P.tilt = -s * 0.06;
        P.scroll = 1;
        P.quill = 1;
        break;
      case 'wink':
        P.hands[act] = V(s * 0.62, 0.86, 0.36);
        P.twist[act] = -s * 1.2;
        P.tilt = -s * 0.16;
        P.roll = -s * 0.04;
        P.brow = 0.3;
        break;
      case 'hug':
        P.hands[act] = V(s * 1.0, 0.6, -0.02);
        P.twist[act] = -s * 0.6;
        P.tilt = s * 0.12;
        P.roll = s * 0.035;
        P.turn = s * 0.12;
        P.brow = 0.3;
        break;
      default:
        break;
    }
    return P;
  }

  update(dt: number) {
    const m = this.m;
    const E = this.energy;
    this.t += dt;
    this.poseT += dt;
    const t = this.t;
    const s = this.side;
    const act = s > 0 ? 1 : 0;

    // Blend the base pose.
    const T = this.target(t);
    const k = damp(5.5, dt);
    const c = this.cur;
    c.lean += (T.lean - c.lean) * k;
    c.roll += (T.roll - c.roll) * k;
    c.turn += (T.turn - c.turn) * k;
    c.pitch += (T.pitch - c.pitch) * k;
    c.yaw += (T.yaw - c.yaw) * k;
    c.tilt += (T.tilt - c.tilt) * k;
    c.brow += (T.brow - c.brow) * k;
    c.look += (T.look - c.look) * k;
    c.scroll += (T.scroll - c.scroll) * damp(4, dt);
    c.quill += (T.quill - c.quill) * damp(4, dt);
    for (let i = 0; i < 2; i++) {
      c.hands[i].lerp(T.hands[i], damp(6, dt));
      c.twist[i] += (T.twist[i] - c.twist[i]) * k;
    }
    const W = this.w;
    const kw = damp(4, dt);
    for (const key of Object.keys(W) as (keyof typeof W)[]) W[key] += ((this.pose === key ? 1 : 0) - W[key]) * kw;

    // Oscillation layers.
    const breathe = Math.sin(t * 1.7) * E;
    const hoCycle = (t * 2.2) % 1.6;
    const ho = hoCycle < 1.2 ? Math.pow(Math.max(0, Math.sin((hoCycle / 0.4) * Math.PI)), 0.8) : 0;
    const laugh = W.laugh * ho * (0.4 + 0.6 * E);
    const waveSwing = Math.sin(t * 9) * W.wave * (0.5 + 0.5 * E);
    const scribble = W.write * (0.5 + 0.5 * E);

    // Body.
    const bob = breathe * 0.006 + laugh * 0.03;
    m.torso.position.y = HIP_Y + bob;
    m.torso.rotation.set(c.lean + laugh * 0.03, c.turn + Math.sin(t * 0.37) * 0.03 * E, c.roll + Math.sin(t * 0.53) * 0.015 * E);
    const sq = breathe * 0.012 + laugh * 0.05;
    m.belly.scale.set(1 + sq * 0.6, 1 - sq * 0.4, 1 + sq * 0.6);
    // Shoulders rise and fall with the breath (and shake with the laugh).
    m.arms.forEach((a, i) => a.shoulder.position.copy(this.restShoulders[i]).setY(this.restShoulders[i].y + breathe * 0.006 + laugh * 0.02));

    // Head: pose, idle drift, gaze, laugh nods.
    const driftY = (Math.sin(t * 0.31) * 0.08 + Math.sin(t * 0.77) * 0.03) * E * (1 - W.write * 0.6);
    const driftX = Math.sin(t * 0.43 + 1) * 0.03 * E;
    m.neck.rotation.set(c.pitch + driftX + laugh * 0.08 - this.gaze.y * 0.12, c.yaw + driftY + this.gaze.x * 0.25, c.tilt + Math.sin(t * 0.6) * 0.025 * E);
    m.head.rotation.x = W.write * Math.sin(t * 1.3) * 0.03 * E;
    // The bib stays on the belly: undo most of the nod and tilt.
    {
      const pitch = m.neck.rotation.x + m.head.rotation.x;
      m.bib.rotation.x = -Math.max(0, pitch) * 0.95 - Math.min(0, pitch) * 0.35;
      m.bib.rotation.z = -m.neck.rotation.z * 0.6;
      m.bib.rotation.y = -m.neck.rotation.y * 0.5;
    }

    // Hat tip lags behind the head (a soft spring).
    {
      const hs = this.hatSpring;
      const drive = m.neck.rotation.z + m.torso.rotation.z;
      const vel = dt > 0 ? (drive - hs.prev) / dt : 0;
      hs.prev = drive;
      const a = 60 * (-vel * 0.06 - hs.x) - 6 * hs.v;
      hs.v += a * dt;
      hs.x += hs.v * dt;
      const cone = m.hat.userData.cone as THREE.Object3D | undefined;
      if (cone) cone.rotation.z = Math.max(-0.25, Math.min(0.25, hs.x + laugh * 0.04));
    }

    // Arms: IK toward the hand targets plus gesture motion.
    const hands = [this.tmp.a.copy(c.hands[0]), this.tmp.b.copy(c.hands[1])];
    hands[act].x += waveSwing * 0.1 * s;
    hands[act].y += Math.abs(waveSwing) * 0.02;
    if (scribble > 0.01) {
      const line = Math.floor((this.poseT * 0.6) % 5);
      hands[act].x += (Math.sin(t * 11) * 0.025 + (((this.poseT * 0.6) % 1) - 0.5) * 0.12) * scribble;
      hands[act].y += (0.06 - line * 0.03) * scribble;
    }
    hands[0].y += laugh * 0.02;
    hands[1].y += laugh * 0.02;
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? -1 : 1;
      const pole = this.tmp.c.set(sx * 1, -0.25, -0.35).add(m.arms[i].shoulder.position);
      this.solveArm(m.arms[i], hands[i], pole);
      m.arms[i].wrist.rotation.set(0, c.twist[i] + (i === act ? waveSwing * 0.25 : 0), 0);
    }

    // Props.
    const sc = smooth(Math.max(0, Math.min(1, c.scroll)));
    m.scroll.visible = sc > 0.02;
    m.scroll.scale.set(Math.max(0.0001, sc), Math.max(0.0001, sc * sc), Math.max(0.0001, sc));
    m.quill.forEach((q, i) => {
      const v = i === act ? smooth(Math.max(0, Math.min(1, c.quill))) : 0;
      q.visible = v > 0.02;
      q.scale.setScalar(Math.max(0.0001, v));
    });

    // Jaw: the voice, or "ho ho ho".
    this.talk = followTalk(this.talk, this.talkTarget, dt);
    const open = Math.min(1, this.talk + laugh * 0.9);
    // The jaw drops (and tips a little) rather than swinging, so the long
    // beard stays on the belly instead of sinking into it.
    m.jaw.rotation.x = open * 0.1;
    m.jaw.position.set(JAW.x, JAW.y - open * 0.075, JAW.z + open * 0.045);
    this.wide += (this.wideTarget - this.wide) * damp(22, dt);
    m.moustache.position.y = open * 0.012;
    m.moustache.scale.set((1 + open * 0.04) * (0.9 + this.wide * 0.1), 1, 1);
    // The opening: rounder and narrower for "o"/"ou", wider for "è"/"a".
    m.mouth.scale.set(0.09 * this.wide, 0.08 * (1 + open * 0.35) * (1.6 - this.wide * 0.6), 0.05);

    // Brows.
    const browLift = c.brow * 0.018 + open * 0.008;
    m.brows.forEach((b) => (b.position.y = (b.userData.restY as number) + browLift));

    // Eyes: blink, ^ ^ when laughing, wink.
    this.blinkAt -= dt;
    if (this.blinkAt <= 0 && this.blinkT < 0) this.blinkT = 0;
    let openAmt = 1;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const p = this.blinkT / 0.16;
      openAmt = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
      if (p >= 1) {
        this.blinkT = -1;
        this.blinkAt = 2.4 + Math.random() * 3;
      }
    }
    const happy = W.laugh > 0.5;
    // Wink: the eye on the gesture side closes for a moment, then again later.
    const winkPhase = this.pose === 'wink' ? this.poseT % 3.2 : 99;
    const winking = winkPhase > 0.25 && winkPhase < 1.25;
    for (let i = 0; i < 2; i++) {
      const closedHappy = happy || (winking && i === act);
      m.eyes[i].visible = !closedHappy;
      m.happyEyes[i].visible = closedHappy;
      m.eyes[i].scale.y = Math.max(0.08, openAmt);
      m.eyes[i].position.y = EYE_Y + c.look * 0.012 + this.gaze.y * 0.006;
      m.eyes[i].position.x = (i === 0 ? -EYE_X : EYE_X) + this.gaze.x * 0.008;
    }

    // Twinkle in the glasses (now and then, and on a wink or laugh).
    this.twinkleAt -= dt;
    if (this.twinkleAt <= 0 && this.twinkleT < 0) {
      this.twinkleT = 0;
      this.twinkleAt = 4 + Math.random() * 4;
    }
    if (this.twinkleT >= 0) {
      this.twinkleT += dt;
      const p = this.twinkleT / 0.7;
      const v = Math.sin(Math.min(1, p) * Math.PI);
      const tw = m.twinkles[act];
      (tw.material as THREE.SpriteMaterial).opacity = v;
      tw.scale.setScalar(0.05 + v * 0.07);
      tw.material.rotation = p * 1.5;
      if (p >= 1) {
        this.twinkleT = -1;
        (tw.material as THREE.SpriteMaterial).opacity = 0;
      }
    }
  }

  /** Two-bone IK in torso space: shoulder → elbow → wrist reaching `target`. */
  private solveArm(arm: SantaArm, target: THREE.Vector3, pole: THREE.Vector3) {
    const S = arm.shoulder.position;
    const d = this.tmp.d.copy(target).sub(S);
    const dist = Math.max(0.08, Math.min(L1 + L2 - 0.002, d.length()));
    const dir = d.normalize();
    const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const p = new THREE.Vector3().copy(pole).sub(S);
    p.addScaledVector(dir, -p.dot(dir));
    if (p.lengthSq() < 1e-6) p.set(0, 0, -1);
    p.normalize();
    const elbow = new THREE.Vector3().copy(S).addScaledVector(dir, a).addScaledVector(p, h);
    const wrist = new THREE.Vector3().copy(S).addScaledVector(dir, dist);
    const up = elbow.clone().sub(S).normalize();
    arm.shoulder.quaternion.setFromUnitVectors(DOWN, up);
    const fore = wrist.sub(elbow).normalize();
    this.tmp.qi.copy(arm.shoulder.quaternion).invert();
    fore.applyQuaternion(this.tmp.qi);
    arm.elbow.quaternion.setFromUnitVectors(DOWN, fore);
  }
}

/** Santa for any scene: the model and its rig on `userData`. */
export type SantaActor = THREE.Group & { userData: { model: SantaModel; rig: SantaRig } };

/** A ready-to-animate plush Santa (call `userData.rig.update(dt)` every frame). */
export function makeSanta(opts: { lowPower?: boolean } = {}): SantaActor {
  const model = buildSanta(opts);
  const actor = model.root as SantaActor;
  actor.userData.model = model;
  actor.userData.rig = new SantaRig(model);
  return actor;
}
