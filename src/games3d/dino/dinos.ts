import * as THREE from 'three';
import { DINO_INFO, type DinoId, type PieceId } from './logic';
import { Parts, UP, col, cone, ell, onEll, stick, tf, tubeGeo, v, type Paint, type V3 } from './geo';

/**
 * The four dinosaurs, built in code: each one twice.
 *  - Its skeleton, in pieces (skull, ribs, legs, tail…): ivory bones the
 *    child digs up and puts back on the stand. Each piece is one merged mesh
 *    whose origin is its centre, so it can fly and turn about itself.
 *  - The living dinosaur: a round, friendly toy (big shiny eyes, a smile,
 *    painted belly and spots) with a little rig to blink, roar softly,
 *    walk, dance, chew and sneeze.
 * Model units: feet on y = 0, head towards +x, seen in profile from +z.
 * No texture and no DOM here (unit tests build the skeletons in Node).
 */

export const BONE = '#f3e7cb';
const BONE_DARK = '#8a6a4a';
const BONE_SHADE = '#dcc79e';

/* ───────────────────────── Bone helpers ───────────────────────── */

/** A cartoon bone: a stick with two knobs at each end. */
function knobBone(P: Parts, a: V3, b: V3, r: number, paint: Paint = BONE) {
  stick(P, a, b, r, r * 0.85, paint, 9);
  const d = b.clone().sub(a).normalize();
  const side = v(-d.y, d.x, 0).normalize().multiplyScalar(r * 0.7);
  for (const end of [a, b])
    for (const s of [1, -1]) ell(P, end.clone().addScaledVector(side, s).addScaledVector(d, end === a ? -r * 0.3 : r * 0.3), v(r * 1.25, r * 1.25, r * 1.25), paint, [0, 0, 0], 10);
}

/** Skin paint: a lighter belly underneath and soft darker blotches on the back. */
function skin(base: string, belly: string, spot: string, seed = 1) {
  const B = col(base);
  const Be = col(belly);
  const S = col(spot);
  return (p: V3, n: V3) => {
    const c = B.clone();
    if (n.y < -0.1) c.lerp(Be, Math.min(1, (-n.y - 0.1) * 2));
    else if (n.y > 0.25) {
      const blot = Math.sin(p.x * 3.3 + seed) * Math.sin(p.z * 5.1 + p.x * 1.7 + seed) + 0.6 * Math.sin(p.x * 6.1 - p.y * 2.3 + seed * 2);
      if (blot > 0.75) c.lerp(S, Math.min(1, (blot - 0.75) * 3) * 0.85);
    }
    return c;
  };
}

/* ───────────────────────── Bones (the skeleton pieces) ───────────────────────── */

/** A vertebra at `at` along the tangent `dir`, with a spine on top (and a chevron under the tail). */
function vertebra(P: Parts, at: V3, dir: V3, r: number, opts: { spine?: number; chevron?: number } = {}) {
  const d = dir.clone().normalize();
  const g = new THREE.CylinderGeometry(r, r * 0.92, r * 1.1, 10);
  P.add(g, (p, n) => (Math.abs(n.dot(d)) > 0.7 ? col(BONE_SHADE) : col(BONE)), tf(at, new THREE.Quaternion().setFromUnitVectors(UP, d)));
  const up = v(-d.y, d.x, 0).normalize();
  if (up.y < 0) up.negate();
  if (opts.spine) stick(P, at.clone().addScaledVector(up, r * 0.6), at.clone().addScaledVector(up, r * 0.6 + opts.spine).addScaledVector(d, -opts.spine * 0.25), r * 0.32, r * 0.14, BONE, 6);
  if (opts.chevron) stick(P, at.clone().addScaledVector(up, -r * 0.6), at.clone().addScaledVector(up, -r * 0.6 - opts.chevron).addScaledVector(d, -opts.chevron * 0.3), r * 0.26, r * 0.1, BONE, 6);
  // Little side knobs, so the vertebra reads as a bone and not a coin.
  for (const s of [-1, 1]) ell(P, at.clone().add(v(0, 0, s * r * 0.85)), v(r * 0.38, r * 0.3, r * 0.3), BONE, [0, 0, 0], 8);
}

/** Vertebrae along a curve, getting smaller from r0 to r1. */
function spineAlong(P: Parts, pts: V3[], count: number, r0: number, r1: number, opts: { spine?: number; chevron?: number; from?: number; to?: number } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const from = opts.from ?? 0;
  const to = opts.to ?? 1;
  for (let i = 0; i < count; i++) {
    const t = from + (to - from) * (count === 1 ? 0 : i / (count - 1));
    const k = count === 1 ? 0 : i / (count - 1);
    const r = r0 + (r1 - r0) * k;
    vertebra(P, curve.getPointAt(t), curve.getTangentAt(t), r, { spine: opts.spine ? opts.spine * (r / r0) : 0, chevron: opts.chevron ? opts.chevron * (r / r0) : 0 });
  }
}

/** A rib cage: a backbone, curved ribs on both sides, and the hip bone. */
function ribCage(P: Parts, x0: number, x1: number, top: (x: number) => number, depth: number, n: number, z: number, hipX: number) {
  const pts = [v(x0 - 0.15, top(x0 - 0.15)), v((x0 + x1) / 2, top((x0 + x1) / 2) + 0.03), v(x1 + 0.15, top(x1 + 0.15))];
  spineAlong(P, pts, n + 3, 0.15, 0.13, { spine: 0.22 });
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const x = x0 + (x1 - x0) * k;
    const R = depth * (0.55 + 0.45 * Math.sin(Math.PI * (0.2 + 0.7 * k)));
    for (const s of [-1, 1]) {
      const g = new THREE.TorusGeometry(R / 2, 0.05, 5, 12, Math.PI);
      P.add(g, BONE, tf(v(x - 0.05, top(x) - R / 2, s * z), [0, s * 0.35, -Math.PI / 2], v(0.42, 1, 1)));
    }
  }
  // Hip bone (pelvis): a flat rounded plate each side.
  for (const s of [-1, 1]) ell(P, v(hipX, top(hipX) - 0.35, s * (z + 0.05)), v(0.42, 0.34, 0.09), (p, nn) => (Math.abs(nn.z) > 0.6 ? col(BONE) : col(BONE_SHADE)), [0, 0, 0.25], 14);
}

/** A leg: thigh bone, shin bone, and a foot with toes (claws for meat-eaters, nails otherwise). */
function legBones(P: Parts, hip: V3, knee: V3, ankle: V3, r: number, toes: { n: number; len: number; claw: boolean }) {
  knobBone(P, hip, knee, r);
  knobBone(P, knee, ankle, r * 0.85);
  const foot = v(ankle.x + toes.len * 0.35, 0.09, ankle.z);
  stick(P, ankle, foot, r * 0.7, r * 0.6, BONE, 8);
  for (let i = 0; i < toes.n; i++) {
    const s = toes.n === 1 ? 0 : (i / (toes.n - 1) - 0.5) * 2;
    const tip = foot.clone().add(v(toes.len, -0.02, s * toes.len * 0.45));
    stick(P, foot, tip, r * 0.42, r * 0.34, BONE, 6);
    ell(P, foot.clone().lerp(tip, 0.5), v(r * 0.45, r * 0.45, r * 0.45), BONE, [0, 0, 0], 8);
    if (toes.claw) cone(P, tip, v(1, -0.5, s * 0.3), r * 0.9, r * 0.32, '#fffaf0', 6);
  }
}

/** Dark hollow (eye socket, nostril) pressed into a skull. */
function hole(P: Parts, at: V3, r: V3, rot: [number, number, number] = [0, 0, 0]) {
  ell(P, at, r, BONE_DARK, rot, 12);
}

/* ── Skulls ── */

function trexSkull(P: Parts, o: V3) {
  ell(P, o.clone().add(v(0, 0.12, 0)), v(0.62, 0.5, 0.42), BONE, [0, 0, 0.05], 20);
  ell(P, o.clone().add(v(0.62, -0.02, 0)), v(0.55, 0.32, 0.34), BONE, [0, 0, -0.06], 18);
  // Lower jaw.
  ell(P, o.clone().add(v(0.42, -0.42, 0)), v(0.78, 0.13, 0.32), BONE_SHADE, [0, 0, -0.05], 16);
  for (const z of [-1, 1]) {
    hole(P, o.clone().add(v(0.05, 0.25, z * 0.36)), v(0.17, 0.2, 0.1));
    hole(P, o.clone().add(v(0.55, 0.05, z * 0.3)), v(0.24, 0.11, 0.08), [0, 0, -0.15]);
    hole(P, o.clone().add(v(1.08, 0.12, z * 0.15)), v(0.07, 0.05, 0.06));
    for (let i = 0; i < 5; i++) cone(P, o.clone().add(v(0.3 + i * 0.17, -0.27, z * 0.24)), v(0.1, -1, 0), 0.15, 0.045, '#fffdf6', 6);
  }
}

function triceratopsSkull(P: Parts, o: V3) {
  ell(P, o.clone().add(v(0.05, 0, 0)), v(0.55, 0.45, 0.44), BONE, [0, 0, 0], 18);
  ell(P, o.clone().add(v(0.5, -0.12, 0)), v(0.38, 0.3, 0.3), BONE, [0, 0, -0.15], 16);
  cone(P, o.clone().add(v(0.75, -0.2, 0)), v(1, -0.5, 0), 0.32, 0.16, BONE_SHADE, 10);
  // The frill: a bony half-disc with two windows.
  const frill = new THREE.CylinderGeometry(0.88, 0.88, 0.07, 22, 1, false, Math.PI, Math.PI);
  P.add(frill, BONE, tf(o.clone().add(v(-0.32, 0.32, 0)), [0, 0, -Math.PI / 2 + 0.75]));
  for (const z of [-1, 1]) hole(P, o.clone().add(v(-0.62, 0.62, z * 0.32)), v(0.17, 0.2, 0.06), [0.5 * z, 0, 0.7]);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.08 + (0.84 * i) / 6);
    const r = 0.9;
    const local = v(0, Math.sin(a) * r, Math.cos(a) * r).applyAxisAngle(v(0, 0, 1), 0.75);
    ell(P, o.clone().add(v(-0.32, 0.32, 0)).add(local), v(0.07, 0.07, 0.07), BONE_SHADE, [0, 0, 0], 8);
  }
  // Three horn cores: two above the eyes, a small one on the nose.
  for (const z of [-1, 1]) cone(P, o.clone().add(v(0.18, 0.35, z * 0.22)), v(0.75, 0.6, z * 0.12), 0.75, 0.09, '#fffaf0', 10);
  cone(P, o.clone().add(v(0.62, 0.12, 0)), v(0.45, 0.9, 0), 0.28, 0.07, '#fffaf0', 10);
  for (const z of [-1, 1]) hole(P, o.clone().add(v(0.2, 0.12, z * 0.38)), v(0.12, 0.13, 0.08));
  // Short neck under the frill.
  spineAlong(P, [o.clone().add(v(-0.75, -0.15, 0)), o.clone().add(v(-0.35, -0.08, 0))], 2, 0.13, 0.12, { spine: 0.12 });
}

function diplodocusSkull(P: Parts, o: V3) {
  ell(P, o.clone().add(v(0.02, 0.04, 0)), v(0.3, 0.2, 0.2), BONE, [0, 0, 0.1], 16);
  ell(P, o.clone().add(v(0.32, -0.04, 0)), v(0.26, 0.13, 0.16), BONE, [0, 0, -0.12], 14);
  ell(P, o.clone().add(v(0.18, -0.17, 0)), v(0.3, 0.06, 0.14), BONE_SHADE, [0, 0, -0.05], 12);
  for (const z of [-1, 1]) {
    hole(P, o.clone().add(v(0.0, 0.08, z * 0.17)), v(0.09, 0.09, 0.06));
    hole(P, o.clone().add(v(0.08, 0.2, z * 0.06)), v(0.07, 0.05, 0.05));
    for (let i = 0; i < 4; i++) stick(P, o.clone().add(v(0.3 + i * 0.065, -0.1, z * 0.1)), o.clone().add(v(0.32 + i * 0.065, -0.2, z * 0.1)), 0.018, 0.014, '#fffdf6', 5);
  }
}

function stegoSkull(P: Parts, o: V3) {
  ell(P, o.clone().add(v(0.0, 0.03, 0)), v(0.3, 0.2, 0.19), BONE, [0, 0, 0], 16);
  ell(P, o.clone().add(v(0.3, -0.06, 0)), v(0.24, 0.12, 0.14), BONE, [0, 0, -0.2], 14);
  ell(P, o.clone().add(v(0.18, -0.18, 0)), v(0.28, 0.06, 0.13), BONE_SHADE, [0, 0, -0.1], 12);
  for (const z of [-1, 1]) hole(P, o.clone().add(v(-0.02, 0.07, z * 0.16)), v(0.08, 0.08, 0.05));
  // Two neck vertebrae belong to the head piece.
  spineAlong(P, [o.clone().add(v(-0.85, 0.32, 0)), o.clone().add(v(-0.3, 0.05, 0))], 3, 0.13, 0.11, { spine: 0.1 });
}

/** A bony back plate (Stegosaurus): a flat diamond. */
function plateGeo(w: number, h: number, depth = 0.07): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(w * 0.62, h * 0.32, w * 0.08, h);
  s.quadraticCurveTo(-w * 0.55, h * 0.45, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.4, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/* ───────────────────────── Dinosaur definitions ───────────────────────── */

interface LegDef {
  hip: V3;
  front: boolean;
  side: -1 | 1;
}

interface DinoDef {
  scale: number;
  skin: { base: string; belly: string; spot: string };
  /** Builds the skeleton pieces in model space. */
  bones: (add: (id: PieceId, build: (P: Parts) => void) => void) => void;
  /** Builds the living dinosaur. */
  flesh: (b: FleshKit) => void;
}

interface FleshKit {
  P: () => Parts;
  skin: Paint;
  mat: THREE.Material;
  body: THREE.Group;
  bodyAt: (p: V3) => void;
  group: (parent: THREE.Object3D, at: V3) => THREE.Group;
  mesh: (parent: THREE.Object3D, P: Parts, m?: THREE.Material) => THREE.Mesh;
  eye: (parent: THREE.Object3D, at: V3, r: number, out: V3) => void;
  leg: (def: LegDef, build: (P: Parts) => void) => void;
  set: (k: 'head' | 'jaw' | 'neck' | 'tail' | 'mouth' | 'nose', o: THREE.Object3D) => void;
  arm: (g: THREE.Group) => void;
  plate: (m: THREE.Mesh) => void;
}

const WHITE = '#ffffff';
const PUPIL = '#1d1a2e';
const MOUTH = '#b8405a';
const TONGUE = '#ff8fa3';
const CLAW = '#fffaf0';
const BLUSH = '#ff9fb2';

function smile(P: Parts, from: V3, to: V3, z: number, r = 0.03) {
  const mid = from.clone().lerp(to, 0.5).add(v(0, -0.05, 0));
  const curve = new THREE.QuadraticBezierCurve3(v(from.x, from.y, z), v(mid.x, mid.y, z), v(to.x, to.y, z));
  P.add(new THREE.TubeGeometry(curve, 10, r, 5, false), '#5a2a3a');
}

const DEFS: Record<DinoId, DinoDef> = {
  /* ── T-Rex ── */
  trex: {
    scale: 1,
    skin: { base: '#6cc56f', belly: '#f6f2b0', spot: '#3f9550' },
    bones(add) {
      add('ribs', (P) => ribCage(P, -1.0, 0.9, (x) => 2.85 + x * 0.12, 1.25, 6, 0.32, -0.55));
      add('legs', (P) => {
        legBones(P, v(-0.3, 2.05, 0.42), v(0.05, 1.12, 0.42), v(-0.2, 0.35, 0.42), 0.12, { n: 3, len: 0.42, claw: true });
        legBones(P, v(-0.05, 2.05, -0.42), v(0.3, 1.12, -0.42), v(0.05, 0.35, -0.42), 0.12, { n: 3, len: 0.42, claw: true });
      });
      add('arms', (P) => {
        for (const s of [-1, 1]) {
          const sh = v(0.95 + (s > 0 ? 0 : 0.08), 1.98, s * 0.5);
          const el = sh.clone().add(v(0.16, -0.24, 0));
          const ha = el.clone().add(v(0.2, 0.04, 0));
          knobBone(P, sh, el, 0.05);
          knobBone(P, el, ha, 0.042);
          for (const k of [-1, 1]) cone(P, ha, v(0.6, -0.5, k * 0.25), 0.14, 0.03, CLAW, 6);
        }
      });
      add('neck', (P) => spineAlong(P, [v(1.0, 2.62, 0), v(1.42, 3.05, 0), v(1.75, 3.32, 0)], 4, 0.19, 0.17, { spine: 0.16 }));
      add('head', (P) => trexSkull(P, v(2.0, 3.45, 0)));
      add('tail', (P) => spineAlong(P, [v(-1.15, 2.45, 0), v(-2.25, 2.35, 0), v(-3.35, 2.12, 0), v(-4.35, 1.85, 0)], 11, 0.17, 0.06, { spine: 0.2, chevron: 0.16 }));
    },
    flesh(k) {
      k.bodyAt(v(0, 2.2, 0));
      const P = k.P();
      ell(P, v(0, 0.05, 0), v(1.35, 0.95, 0.85), k.skin, [0, 0, 0.12], 26);
      // Little rounded bumps along the back.
      for (let i = 0; i < 5; i++) ell(P, v(-0.9 + i * 0.42, 0.92 + Math.sin((i / 4) * Math.PI) * 0.06 + i * 0.03, 0), v(0.13, 0.1, 0.1), '#4fa45c', [0, 0, 0], 10);
      k.mesh(k.body, P);
      // Neck and head.
      const neck = k.group(k.body, v(1.0, 0.35, 0));
      k.set('neck', neck);
      const N = k.P();
      N.add(tubeGeo([v(-0.1, -0.1, 0), v(0.42, 0.45, 0), v(0.8, 0.85, 0)], [0.62, 0.54, 0.5], 16, 14), k.skin);
      k.mesh(neck, N);
      const head = k.group(neck, v(0.8, 0.85, 0));
      k.set('head', head);
      const H = k.P();
      const skull = { c: v(0.42, 0.22, 0), r: v(0.78, 0.6, 0.56) };
      ell(H, skull.c, skull.r, k.skin, [0, 0, 0.05], 24);
      ell(H, v(1.0, 0.08, 0), v(0.62, 0.42, 0.48), k.skin, [0, 0, -0.05], 22);
      for (const z of [-1, 1]) {
        ell(H, v(1.5, 0.27, z * 0.17), v(0.05, 0.035, 0.05), '#2c4a2f', [0, 0, 0], 8);
        ell(H, v(0.58, 0.68, z * 0.3), v(0.24, 0.1, 0.16), '#58b25f', [0, 0, 0.1], 10);
        const blush = onEll(v(1.0, 0.08, 0), v(0.62, 0.42, 0.48), v(-0.45, -0.1, z));
        ell(H, blush.p, v(0.12, 0.075, 0.03), BLUSH, [0, z * 0.5, 0], 10);
        smile(H, v(0.62, -0.18, 0), v(1.45, -0.14, 0), z * 0.43);
        for (let i = 0; i < 3; i++) cone(H, v(1.0 + i * 0.16, -0.22, z * 0.36), v(0.05, -1, 0), 0.1, 0.035, CLAW, 6);
      }
      ell(H, v(0.95, -0.2, 0), v(0.55, 0.12, 0.36), MOUTH, [0, 0, -0.05], 14);
      k.mesh(head, H);
      const jaw = k.group(head, v(0.25, -0.18, 0));
      k.set('jaw', jaw);
      const J = k.P();
      ell(J, v(0.62, -0.08, 0), v(0.74, 0.2, 0.42), (p, n) => (n.y > 0.6 && p.x < 1.05 ? col(TONGUE) : col('#f6f2b0')), [0, 0, -0.04], 18);
      k.mesh(jaw, J);
      for (const z of [-1, 1]) {
        const e = onEll(skull.c, skull.r, v(0.3, 0.42, z * 0.85), 0.07);
        k.eye(head, e.p, 0.19, e.n.clone().add(v(0.35, 0, 0)));
      }
      const mouth = new THREE.Object3D();
      mouth.position.set(1.45, -0.18, 0);
      head.add(mouth);
      k.set('mouth', mouth);
      const nose = new THREE.Object3D();
      nose.position.set(1.62, 0.25, 0);
      head.add(nose);
      k.set('nose', nose);
      // Tail.
      const tail = k.group(k.body, v(-1.1, 0.12, 0));
      k.set('tail', tail);
      const T = k.P();
      T.add(tubeGeo([v(0.15, 0, 0), v(-1.05, -0.05, 0), v(-2.15, -0.22, 0), v(-3.25, -0.48, 0)], [0.66, 0.5, 0.27, 0.05], 28, 14), k.skin);
      for (let i = 0; i < 4; i++) ell(T, v(-0.6 - i * 0.62, 0.52 - i * 0.16 - i * i * 0.02, 0), v(0.1, 0.08, 0.08), '#4fa45c', [0, 0, 0], 8);
      k.mesh(tail, T);
      // Tiny arms with two fingers.
      for (const s of [-1, 1] as const) {
        const arm = k.group(k.body, v(0.95, -0.28, s * 0.62));
        const A = k.P();
        A.add(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), k.skin, tf(v(0.08, -0.12, 0), [0, 0, 0.6]));
        A.add(new THREE.CapsuleGeometry(0.075, 0.16, 4, 8), k.skin, tf(v(0.25, -0.2, 0), [0, 0, 1.6]));
        for (const f of [-1, 1]) cone(A, v(0.36, -0.2, f * 0.04), v(1, -0.3, f * 0.2), 0.1, 0.035, CLAW, 6);
        k.mesh(arm, A);
        k.arm(arm);
      }
      // Strong legs.
      for (const s of [-1, 1] as const)
        k.leg({ hip: v(-0.35, -0.15, s * 0.6), front: false, side: s }, (L) => {
          ell(L, v(0.05, -0.32, 0), v(0.55, 0.72, 0.36), k.skin, [0, 0, -0.2], 18);
          L.add(tubeGeo([v(0.15, -0.8, 0), v(0.08, -1.35, 0), v(-0.12, -1.72, 0)], [0.24, 0.19, 0.16], 10, 10), k.skin);
          ell(L, v(0.14, -1.92, 0), v(0.45, 0.14, 0.3), k.skin, [0, 0, 0], 14);
          for (const t of [-1, 0, 1]) cone(L, v(0.52, -1.95, t * 0.15), v(1, -0.2, t * 0.3), 0.14, 0.06, CLAW, 6);
        });
    },
  },

  /* ── Triceratops ── */
  triceratops: {
    scale: 1.08,
    skin: { base: '#f39b4b', belly: '#ffe3b4', spot: '#d9742c' },
    bones(add) {
      add('ribs', (P) => ribCage(P, -1.05, 0.9, (x) => 2.15 - x * 0.02, 1.15, 6, 0.36, -0.6));
      add('legs', (P) => {
        legBones(P, v(-0.75, 1.32, 0.45), v(-0.58, 0.75, 0.45), v(-0.7, 0.22, 0.45), 0.11, { n: 3, len: 0.26, claw: false });
        legBones(P, v(-0.5, 1.32, -0.45), v(-0.33, 0.75, -0.45), v(-0.45, 0.22, -0.45), 0.11, { n: 3, len: 0.26, claw: false });
      });
      add('frontLegs', (P) => {
        legBones(P, v(0.8, 1.12, 0.45), v(0.94, 0.66, 0.45), v(0.84, 0.2, 0.45), 0.1, { n: 3, len: 0.22, claw: false });
        legBones(P, v(1.02, 1.12, -0.45), v(1.16, 0.66, -0.45), v(1.06, 0.2, -0.45), 0.1, { n: 3, len: 0.22, claw: false });
      });
      add('head', (P) => triceratopsSkull(P, v(1.82, 1.55, 0)));
      add('tail', (P) => spineAlong(P, [v(-1.25, 1.75, 0), v(-2.05, 1.5, 0), v(-2.75, 1.12, 0), v(-3.05, 0.92, 0)], 8, 0.15, 0.06, { spine: 0.14, chevron: 0.1 }));
    },
    flesh(k) {
      k.bodyAt(v(0, 1.55, 0));
      const P = k.P();
      ell(P, v(0, 0.02, 0), v(1.45, 0.92, 0.92), k.skin, [0, 0, 0.04], 26);
      k.mesh(k.body, P);
      const head = k.group(k.body, v(1.2, 0.0, 0));
      k.set('head', head);
      const H = k.P();
      const skull = { c: v(0.5, 0.02, 0), r: v(0.62, 0.55, 0.52) };
      ell(H, skull.c, skull.r, k.skin, [0, 0, 0], 24);
      ell(H, v(0.98, -0.14, 0), v(0.42, 0.36, 0.36), k.skin, [0, 0, -0.1], 18);
      cone(H, v(1.25, -0.2, 0), v(1, -0.55, 0), 0.32, 0.2, '#d99b55', 12);
      // The frill: a yellow fan with a pink scalloped rim.
      const fc = v(0.12, 0.38, 0);
      const fr = new THREE.CylinderGeometry(1.0, 1.0, 0.12, 28, 1, false, Math.PI, Math.PI);
      H.add(fr, (p) => (p.clone().sub(fc).length() > 0.82 ? col('#ff8296') : col('#ffd45e')), tf(fc, [0, 0, -Math.PI / 2 + 0.65]));
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.05 + (0.9 * i) / 8);
        const local = v(0, Math.sin(a) * 1.0, Math.cos(a) * 1.0).applyAxisAngle(v(0, 0, 1), 0.65);
        ell(H, fc.clone().add(local), v(0.11, 0.11, 0.08), '#ff8296', [0, 0, 0], 8);
      }
      for (const z of [-1, 1]) {
        // Three horns: two big ones above the eyes…
        cone(H, v(0.66, 0.42, z * 0.24), v(0.75, 0.62, z * 0.1), 0.8, 0.1, '#fff3d9', 12);
        const blush = onEll(skull.c, skull.r, v(0.45, -0.45, z));
        ell(H, blush.p, v(0.12, 0.07, 0.03), BLUSH, [0, z * 0.3, 0], 10);
        smile(H, v(0.82, -0.32, 0), v(1.18, -0.28, 0), z * 0.32, 0.025);
      }
      // …and a small one on the nose.
      cone(H, v(1.08, 0.12, 0), v(0.45, 0.9, 0), 0.32, 0.08, '#fff3d9', 12);
      k.mesh(head, H);
      const jaw = k.group(head, v(0.72, -0.34, 0));
      k.set('jaw', jaw);
      const J = k.P();
      ell(J, v(0.28, -0.03, 0), v(0.42, 0.14, 0.28), '#ffe3b4', [0, 0, -0.12], 14);
      k.mesh(jaw, J);
      for (const z of [-1, 1]) {
        const e = onEll(skull.c, skull.r, v(0.5, 0.2, z * 0.85), 0.06);
        k.eye(head, e.p, 0.16, e.n.clone().add(v(0.35, 0, 0)));
      }
      const mouth = new THREE.Object3D();
      mouth.position.set(1.3, -0.3, 0);
      head.add(mouth);
      k.set('mouth', mouth);
      const nose = new THREE.Object3D();
      nose.position.set(1.32, -0.05, 0);
      head.add(nose);
      k.set('nose', nose);
      const tail = k.group(k.body, v(-1.25, 0.05, 0));
      k.set('tail', tail);
      const T = k.P();
      T.add(tubeGeo([v(0.15, 0, 0), v(-0.75, -0.14, 0), v(-1.45, -0.42, 0), v(-1.85, -0.64, 0)], [0.56, 0.38, 0.18, 0.05], 22, 12), k.skin);
      k.mesh(tail, T);
      for (const s of [-1, 1] as const) {
        k.leg({ hip: v(-0.72, -0.32, s * 0.56), front: false, side: s }, (L) => {
          ell(L, v(0, -0.12, 0), v(0.42, 0.52, 0.32), k.skin, [0, 0, -0.1], 14);
          L.add(tubeGeo([v(0.02, -0.5, 0), v(0.05, -0.95, 0)], [0.24, 0.21], 6, 10), k.skin);
          ell(L, v(0.06, -1.12, 0), v(0.3, 0.11, 0.27), k.skin, [0, 0, 0], 12);
          for (const t of [-1, 0, 1]) ell(L, v(0.3, -1.13, t * 0.13), v(0.06, 0.06, 0.06), CLAW, [0, 0, 0], 6);
        });
        k.leg({ hip: v(0.82, -0.45, s * 0.56), front: true, side: s }, (L) => {
          ell(L, v(0, -0.08, 0), v(0.32, 0.4, 0.26), k.skin, [0, 0, 0.1], 12);
          L.add(tubeGeo([v(0, -0.35, 0), v(0.05, -0.85, 0)], [0.22, 0.2], 6, 10), k.skin);
          ell(L, v(0.06, -1.0, 0), v(0.27, 0.1, 0.25), k.skin, [0, 0, 0], 12);
          for (const t of [-1, 0, 1]) ell(L, v(0.27, -1.01, t * 0.12), v(0.055, 0.055, 0.055), CLAW, [0, 0, 0], 6);
        });
      }
    },
  },

  /* ── Diplodocus ── */
  diplodocus: {
    scale: 0.78,
    skin: { base: '#a78cea', belly: '#ece4ff', spot: '#8668d6' },
    bones(add) {
      add('ribs', (P) => ribCage(P, -1.35, 1.2, (x) => 3.5 - x * 0.03, 1.4, 7, 0.4, -0.85));
      add('legs', (P) => {
        legBones(P, v(-0.95, 2.3, 0.5), v(-0.88, 1.25, 0.5), v(-0.95, 0.3, 0.5), 0.16, { n: 3, len: 0.3, claw: false });
        legBones(P, v(-0.65, 2.3, -0.5), v(-0.58, 1.25, -0.5), v(-0.65, 0.3, -0.5), 0.16, { n: 3, len: 0.3, claw: false });
      });
      add('frontLegs', (P) => {
        legBones(P, v(1.0, 2.1, 0.5), v(1.06, 1.18, 0.5), v(1.0, 0.3, 0.5), 0.14, { n: 3, len: 0.26, claw: false });
        legBones(P, v(1.3, 2.1, -0.5), v(1.36, 1.18, -0.5), v(1.3, 0.3, -0.5), 0.14, { n: 3, len: 0.26, claw: false });
      });
      add('neck', (P) => spineAlong(P, [v(1.5, 3.12, 0), v(2.55, 3.8, 0), v(3.45, 4.8, 0), v(4.0, 5.45, 0)], 11, 0.22, 0.13, { spine: 0.16 }));
      add('head', (P) => diplodocusSkull(P, v(4.3, 5.52, 0)));
      add('tail', (P) => spineAlong(P, [v(-1.55, 3.1, 0), v(-3.3, 2.9, 0), v(-5.0, 2.25, 0), v(-6.5, 1.55, 0), v(-7.6, 1.25, 0)], 18, 0.2, 0.045, { spine: 0.2, chevron: 0.14 }));
    },
    flesh(k) {
      k.bodyAt(v(0, 2.75, 0));
      const P = k.P();
      ell(P, v(0, 0.05, 0), v(1.75, 1.1, 1.0), k.skin, [0, 0, 0.02], 28);
      k.mesh(k.body, P);
      const neck = k.group(k.body, v(1.35, 0.3, 0));
      k.set('neck', neck);
      const N = k.P();
      N.add(tubeGeo([v(-0.2, -0.15, 0), v(1.1, 0.75, 0), v(2.0, 1.75, 0), v(2.7, 2.45, 0)], [0.74, 0.52, 0.4, 0.33], 30, 14), k.skin);
      for (let i = 0; i < 6; i++) {
        const t = 0.15 + i * 0.14;
        const c = new THREE.CatmullRomCurve3([v(-0.2, -0.15, 0), v(1.1, 0.75, 0), v(2.0, 1.75, 0), v(2.7, 2.45, 0)], false, 'centripetal').getPointAt(t);
        ell(N, c.add(v(-0.12, 0.42 - t * 0.12, 0)), v(0.1, 0.08, 0.08), '#8a6fd8', [0, 0, 0], 8);
      }
      k.mesh(neck, N);
      const head = k.group(neck, v(2.7, 2.45, 0));
      k.set('head', head);
      const H = k.P();
      const skull = { c: v(0.3, 0.04, 0), r: v(0.46, 0.32, 0.31) };
      ell(H, skull.c, skull.r, k.skin, [0, 0, 0.05], 22);
      ell(H, v(0.66, -0.06, 0), v(0.28, 0.22, 0.25), k.skin, [0, 0, -0.1], 16);
      for (const z of [-1, 1]) {
        ell(H, v(0.86, 0.06, z * 0.09), v(0.035, 0.025, 0.035), '#5b4590', [0, 0, 0], 6);
        const blush = onEll(v(0.66, -0.06, 0), v(0.28, 0.22, 0.25), v(-0.2, -0.3, z));
        ell(H, blush.p, v(0.08, 0.05, 0.02), BLUSH, [0, z * 0.3, 0], 8);
        smile(H, v(0.55, -0.16, 0), v(0.88, -0.12, 0), z * 0.21, 0.018);
      }
      k.mesh(head, H);
      const jaw = k.group(head, v(0.35, -0.16, 0));
      k.set('jaw', jaw);
      const J = k.P();
      ell(J, v(0.28, -0.03, 0), v(0.32, 0.09, 0.2), (p, n) => (n.y > 0.5 ? col(TONGUE) : col('#ece4ff')), [0, 0, -0.05], 14);
      k.mesh(jaw, J);
      for (const z of [-1, 1]) {
        const e = onEll(skull.c, skull.r, v(0.25, 0.4, z * 0.85), 0.04);
        k.eye(head, e.p, 0.12, e.n.clone().add(v(0.35, 0, 0)));
      }
      const mouth = new THREE.Object3D();
      mouth.position.set(0.85, -0.15, 0);
      head.add(mouth);
      k.set('mouth', mouth);
      const nose = new THREE.Object3D();
      nose.position.set(0.92, 0.04, 0);
      head.add(nose);
      k.set('nose', nose);
      const tail = k.group(k.body, v(-1.55, 0.15, 0));
      k.set('tail', tail);
      const T = k.P();
      T.add(tubeGeo([v(0.2, 0, 0), v(-1.75, -0.05, 0), v(-3.45, -0.55, 0), v(-4.95, -1.15, 0), v(-6.1, -1.45, 0)], [0.76, 0.52, 0.3, 0.12, 0.035], 40, 14), k.skin);
      k.mesh(tail, T);
      for (const s of [-1, 1] as const) {
        k.leg({ hip: v(-0.9, -0.45, s * 0.62), front: false, side: s }, (L) => {
          ell(L, v(0, -0.1, 0), v(0.52, 0.62, 0.42), k.skin, [0, 0, -0.08], 14);
          L.add(tubeGeo([v(0, -0.5, 0), v(0.02, -1.95, 0)], [0.34, 0.31], 8, 12), k.skin);
          L.add(new THREE.CylinderGeometry(0.34, 0.38, 0.3, 14), k.skin, tf(v(0.04, -2.15, 0)));
          for (const t of [-1, 0, 1]) ell(L, v(0.36, -2.22, t * 0.15), v(0.07, 0.07, 0.07), CLAW, [0, 0, 0], 6);
        });
        k.leg({ hip: v(1.0, -0.55, s * 0.62), front: true, side: s }, (L) => {
          ell(L, v(0, -0.05, 0), v(0.42, 0.5, 0.36), k.skin, [0, 0, 0.08], 12);
          L.add(tubeGeo([v(0, -0.4, 0), v(0.02, -1.85, 0)], [0.31, 0.29], 8, 12), k.skin);
          L.add(new THREE.CylinderGeometry(0.31, 0.35, 0.3, 14), k.skin, tf(v(0.04, -2.05, 0)));
          for (const t of [-1, 0, 1]) ell(L, v(0.33, -2.12, t * 0.14), v(0.065, 0.065, 0.065), CLAW, [0, 0, 0], 6);
        });
      }
    },
  },

  /* ── Stegosaurus ── */
  stegosaurus: {
    scale: 1.05,
    skin: { base: '#48b9a9', belly: '#dff6e2', spot: '#2f978a' },
    bones(add) {
      add('ribs', (P) => ribCage(P, -1.0, 0.95, (x) => 2.55 - x * x * 0.18 - x * 0.12, 1.2, 6, 0.34, -0.55));
      add('plates', (P) => {
        for (let i = 0; i < 6; i++) {
          const x = -1.05 + i * 0.42;
          const h = 0.42 + Math.sin(((i + 0.5) / 6) * Math.PI) * 0.4;
          for (const s of [-1, 1]) P.add(plateGeo(0.5, h, 0.05), BONE, tf(v(x + (s > 0 ? 0.2 : 0), 2.66 - x * x * 0.18 - x * 0.12, s * 0.1), [0, 0, 0.08]));
        }
      });
      add('legs', (P) => {
        legBones(P, v(-0.7, 1.48, 0.42), v(-0.55, 0.88, 0.42), v(-0.66, 0.24, 0.42), 0.11, { n: 3, len: 0.24, claw: false });
        legBones(P, v(-0.45, 1.48, -0.42), v(-0.3, 0.88, -0.42), v(-0.41, 0.24, -0.42), 0.11, { n: 3, len: 0.24, claw: false });
      });
      add('frontLegs', (P) => {
        legBones(P, v(0.95, 1.12, 0.42), v(1.06, 0.68, 0.42), v(0.98, 0.2, 0.42), 0.09, { n: 3, len: 0.2, claw: false });
        legBones(P, v(1.17, 1.12, -0.42), v(1.28, 0.68, -0.42), v(1.2, 0.2, -0.42), 0.09, { n: 3, len: 0.2, claw: false });
      });
      add('head', (P) => stegoSkull(P, v(2.42, 1.08, 0)));
      add('tail', (P) => {
        spineAlong(P, [v(-1.2, 2.05, 0), v(-2.1, 1.75, 0), v(-3.0, 1.32, 0), v(-3.5, 1.1, 0)], 9, 0.15, 0.07, { spine: 0.14, chevron: 0.1 });
        for (const s of [-1, 1]) {
          cone(P, v(-3.0, 1.38, s * 0.08), v(-0.35, 0.8, s * 0.55), 0.5, 0.06, BONE, 8);
          cone(P, v(-3.35, 1.2, s * 0.07), v(-0.7, 0.55, s * 0.55), 0.46, 0.055, BONE, 8);
        }
      });
    },
    flesh(k) {
      k.bodyAt(v(0, 1.75, 0));
      const P = k.P();
      ell(P, v(0, 0.08, 0), v(1.5, 1.0, 0.88), k.skin, [0, 0, -0.1], 26);
      k.mesh(k.body, P);
      // Plates: separate meshes so each one can light up and sing.
      const plateMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: '#000000' });
      for (let i = 0; i < 6; i++) {
        const x = -1.05 + i * 0.42;
        const h = 0.5 + Math.sin(((i + 0.5) / 6) * Math.PI) * 0.45;
        for (const s of [-1, 1]) {
          const Pl = k.P();
          Pl.add(plateGeo(0.6, h, 0.08), (p) => col('#ff8a4f').lerp(col('#ffd166'), Math.max(0, Math.min(1, p.y / h))));
          const m = new THREE.Mesh(Pl.build(), plateMat.clone());
          m.position.set(x + (s > 0 ? 0.21 : 0), 0.62 - x * x * 0.17 - x * 0.1, s * 0.12);
          m.rotation.z = 0.08;
          m.castShadow = true;
          k.body.add(m);
          k.plate(m);
        }
      }
      plateMat.dispose();
      const neck = k.group(k.body, v(1.22, -0.2, 0));
      k.set('neck', neck);
      const N = k.P();
      N.add(tubeGeo([v(-0.15, 0.05, 0), v(0.45, -0.25, 0), v(0.85, -0.45, 0)], [0.52, 0.38, 0.32], 14, 12), k.skin);
      k.mesh(neck, N);
      const head = k.group(neck, v(0.85, -0.45, 0));
      k.set('head', head);
      const H = k.P();
      const skull = { c: v(0.25, 0.02, 0), r: v(0.44, 0.3, 0.29) };
      ell(H, skull.c, skull.r, k.skin, [0, 0, -0.05], 20);
      ell(H, v(0.58, -0.08, 0), v(0.26, 0.19, 0.22), k.skin, [0, 0, -0.15], 14);
      for (const z of [-1, 1]) {
        const blush = onEll(v(0.58, -0.08, 0), v(0.26, 0.19, 0.22), v(-0.2, -0.3, z));
        ell(H, blush.p, v(0.08, 0.05, 0.02), BLUSH, [0, z * 0.3, 0], 8);
        smile(H, v(0.45, -0.18, 0), v(0.78, -0.16, 0), z * 0.19, 0.018);
      }
      k.mesh(head, H);
      const jaw = k.group(head, v(0.3, -0.17, 0));
      k.set('jaw', jaw);
      const J = k.P();
      ell(J, v(0.26, -0.03, 0), v(0.3, 0.08, 0.18), '#dff6e2', [0, 0, -0.08], 12);
      k.mesh(jaw, J);
      for (const z of [-1, 1]) {
        const e = onEll(skull.c, skull.r, v(0.25, 0.42, z * 0.85), 0.04);
        k.eye(head, e.p, 0.12, e.n.clone().add(v(0.35, 0, 0)));
      }
      const mouth = new THREE.Object3D();
      mouth.position.set(0.82, -0.15, 0);
      head.add(mouth);
      k.set('mouth', mouth);
      const nose = new THREE.Object3D();
      nose.position.set(0.84, 0.0, 0);
      head.add(nose);
      k.set('nose', nose);
      const tail = k.group(k.body, v(-1.3, 0.18, 0));
      k.set('tail', tail);
      const T = k.P();
      T.add(tubeGeo([v(0.15, 0, 0), v(-0.95, -0.22, 0), v(-1.85, -0.6, 0), v(-2.3, -0.8, 0)], [0.55, 0.38, 0.2, 0.08], 24, 12), k.skin);
      // Four spikes at the end of the tail (two pairs): true to the fossils.
      for (const s of [-1, 1]) {
        cone(T, v(-1.75, -0.48, s * 0.1), v(-0.35, 0.8, s * 0.55), 0.55, 0.075, '#fff1d6', 10);
        cone(T, v(-2.12, -0.68, s * 0.08), v(-0.7, 0.55, s * 0.55), 0.5, 0.07, '#fff1d6', 10);
      }
      k.mesh(tail, T);
      for (const s of [-1, 1] as const) {
        k.leg({ hip: v(-0.7, -0.3, s * 0.52), front: false, side: s }, (L) => {
          ell(L, v(0, -0.18, 0), v(0.42, 0.55, 0.3), k.skin, [0, 0, -0.12], 14);
          L.add(tubeGeo([v(0.05, -0.62, 0), v(0.0, -1.25, 0)], [0.23, 0.2], 6, 10), k.skin);
          ell(L, v(0.06, -1.38, 0), v(0.3, 0.1, 0.25), k.skin, [0, 0, 0], 12);
          for (const t of [-1, 0, 1]) ell(L, v(0.3, -1.39, t * 0.12), v(0.055, 0.055, 0.055), CLAW, [0, 0, 0], 6);
        });
        k.leg({ hip: v(0.95, -0.58, s * 0.5), front: true, side: s }, (L) => {
          ell(L, v(0, -0.05, 0), v(0.28, 0.32, 0.22), k.skin, [0, 0, 0.1], 12);
          L.add(tubeGeo([v(0, -0.3, 0), v(0.04, -0.95, 0)], [0.19, 0.17], 6, 10), k.skin);
          ell(L, v(0.06, -1.08, 0), v(0.25, 0.09, 0.22), k.skin, [0, 0, 0], 12);
          for (const t of [-1, 0, 1]) ell(L, v(0.26, -1.09, t * 0.1), v(0.05, 0.05, 0.05), CLAW, [0, 0, 0], 6);
        });
      }
    },
  },
};

/* ───────────────────────── Skeleton pieces ───────────────────────── */

export interface PieceModel {
  id: PieceId;
  /** Geometry centred on the piece's own centre. */
  geometry: THREE.BufferGeometry;
  /** Where the centre goes on the skeleton (model space). */
  slot: V3;
  /** Width × height in profile (model units). */
  w: number;
  h: number;
  /** Longest side in profile: the size compared in "biggest / smallest" (children compare lengths). */
  size: number;
}

/** Builds the skeleton pieces of a dinosaur (pure geometry: works without WebGL or DOM). */
export function buildPieces(id: DinoId): PieceModel[] {
  const out: PieceModel[] = [];
  DEFS[id].bones((pid, build) => {
    const P = new Parts();
    build(P);
    const geometry = P.build();
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    const c = bb.getCenter(v());
    geometry.translate(-c.x, -c.y, -c.z);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const w = bb.max.x - bb.min.x;
    const h = bb.max.y - bb.min.y;
    out.push({ id: pid, geometry, slot: c, w, h, size: Math.max(w, h) });
  });
  return out.filter((p) => DINO_INFO[id].pieces.includes(p.id));
}

/* ───────────────────────── The living dinosaur ───────────────────────── */

export interface DinoParts {
  body: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  neck: THREE.Group | null;
  tail: THREE.Group;
  legs: { pivot: THREE.Group; front: boolean; side: -1 | 1 }[];
  arms: THREE.Group[];
  eyes: THREE.Group[];
  plates: THREE.Mesh[];
}

/**
 * Brings a dinosaur to life, in layers like Ziggy's rig: breathing, looking
 * around and blinking, then walking, dancing, roaring, chewing, sniffing.
 * Never scary: the roar is a small head lift with a wide smile.
 */
export class DinoRig {
  energy = 1;
  walk = 0;
  dance = 0;
  roar = 0;
  reach = 0;
  sniff = 0;
  chew = 0;
  /** 0..1 how awake (eyes closed at 0). */
  awake = 1;
  private t = Math.random() * 10;
  private walkPhase = 0;
  private blinkAt = 1.2;
  private blinkT = -1;
  private bodyY: number;
  private headRest: THREE.Euler;

  constructor(readonly parts: DinoParts) {
    this.bodyY = parts.body.position.y;
    this.headRest = parts.head.rotation.clone();
  }

  update(dt: number) {
    const p = this.parts;
    this.t += dt;
    const t = this.t;
    const E = this.energy;
    const breathe = Math.sin(t * 1.9);
    const d = this.dance;
    const beat = t * Math.PI * 2.2;
    if (this.walk > 0.01) this.walkPhase += dt * (5 + 3 * this.walk);
    const w = this.walk;
    const s = Math.sin(this.walkPhase);

    p.body.position.y = this.bodyY + breathe * 0.015 + Math.abs(Math.cos(this.walkPhase)) * 0.06 * w + Math.abs(Math.sin(beat)) * 0.12 * d * E;
    p.body.scale.set(1, 1 + breathe * 0.012, 1 + breathe * 0.01);
    p.body.rotation.x = Math.sin(beat) * 0.07 * d * E;
    p.body.rotation.z = Math.sin(beat * 0.5) * 0.04 * d * E + s * 0.02 * w;

    // Head: idle glances, roar (lift and open wide), sniff (tilt back before a sneeze), dance nods.
    const look = Math.sin(t * 0.6) * 0.12 + Math.sin(t * 1.7) * 0.04;
    p.head.rotation.x = this.headRest.x + Math.sin(beat) * 0.1 * d * E;
    p.head.rotation.y = this.headRest.y + look * E * (1 - d);
    p.head.rotation.z = this.headRest.z + this.roar * 0.35 + this.sniff * 0.4 + Math.sin(t * 1.1) * 0.03 + Math.cos(beat) * 0.12 * d * E - this.chew * 0.1;
    if (p.neck) p.neck.rotation.z = Math.sin(t * 0.8) * 0.04 + this.roar * 0.12 + this.sniff * 0.15 + Math.sin(beat) * 0.08 * d * E;
    const chewing = this.chew > 0 ? Math.abs(Math.sin(t * 12)) * 0.25 : 0;
    p.jaw.rotation.z = -(this.roar * 0.5 + chewing + this.sniff * 0.08);

    // Tail: a lazy sway, faster when happy.
    p.tail.rotation.y = Math.sin(t * 1.4) * 0.1 * E + Math.sin(beat) * 0.35 * d * E + s * 0.12 * w;
    p.tail.rotation.z = Math.sin(t * 0.9) * 0.03 + Math.cos(beat) * 0.06 * d * E;

    // Legs: walk cycle, or little dance steps.
    for (const l of p.legs) {
      const ph = (l.side > 0 ? 0 : Math.PI) + (l.front ? Math.PI : 0);
      l.pivot.rotation.z = Math.sin(this.walkPhase + ph) * 0.42 * w + Math.max(0, Math.sin(beat + ph)) * 0.25 * d * E;
    }
    // Arms (T-Rex): reaching for the cookie with tiny arms, wiggling.
    p.arms.forEach((a, i) => {
      a.rotation.z = this.reach * (1.0 + Math.sin(t * 14 + i * 2) * 0.35) + Math.sin(beat + i) * 0.4 * d * E + Math.sin(t * 2 + i) * 0.05;
    });

    // Blinks (and eyes shut while still asleep).
    let open = this.awake;
    if (this.awake > 0.9) {
      if (this.blinkT < 0 && t > this.blinkAt) this.blinkT = 0;
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        const q = this.blinkT / 0.18;
        if (q >= 1) {
          this.blinkT = -1;
          this.blinkAt = t + 1.8 + Math.random() * 2.6;
        } else open *= 1 - Math.sin(q * Math.PI) * 0.92;
      }
    }
    for (const e of p.eyes) e.scale.y = Math.max(0.08, open);
    if (this.chew > 0) this.chew = Math.max(0, this.chew - dt);
  }

  /** Make it blink right now (used when it wakes up). */
  blink() {
    this.blinkAt = this.t;
  }
}

export interface DinoModel {
  id: DinoId;
  /** Positioned on the stand by the game; scaled to the dinosaur's size. */
  root: THREE.Group;
  scale: number;
  /** The living dinosaur (hidden while it is only bones). */
  flesh: THREE.Group;
  rig: DinoRig;
  pieces: PieceModel[];
  mouth: THREE.Object3D;
  nose: THREE.Object3D;
  /** Model-space bounds of the living dinosaur. */
  box: THREE.Box3;
  dispose(): void;
}

/** Builds the living dinosaur and its skeleton pieces. */
export function buildDino(id: DinoId): DinoModel {
  const def = DEFS[id];
  const root = new THREE.Group();
  root.name = `dino-${id}`;
  const flesh = new THREE.Group();
  root.add(flesh);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
  const eyeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0 });
  const paint = skin(def.skin.base, def.skin.belly, def.skin.spot, DINO_INFO[id].lengthM);
  const parts: Partial<DinoParts> & { legs: DinoParts['legs']; arms: THREE.Group[]; eyes: THREE.Group[]; plates: THREE.Mesh[] } = { legs: [], arms: [], eyes: [], plates: [] };
  const anchors: { mouth?: THREE.Object3D; nose?: THREE.Object3D } = {};
  const body = new THREE.Group();
  flesh.add(body);
  parts.body = body;
  const kit: FleshKit = {
    P: () => new Parts(),
    skin: paint,
    mat,
    body,
    bodyAt: (p) => body.position.copy(p),
    group: (parent, at) => {
      const g = new THREE.Group();
      g.position.copy(at);
      parent.add(g);
      return g;
    },
    mesh: (parent, P, m) => {
      const mesh = new THREE.Mesh(P.build(), m ?? mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    },
    eye: (parent, at, r, out) => {
      const o = out.clone().normalize();
      const g = new THREE.Group();
      g.position.copy(at);
      const E = new Parts();
      ell(E, v(), v(r, r * 1.08, r), WHITE, [0, 0, 0], 16);
      ell(E, o.clone().multiplyScalar(r * 0.55), v(r * 0.62, r * 0.68, r * 0.62), PUPIL, [0, 0, 0], 14);
      ell(E, o.clone().multiplyScalar(r * 0.98).add(v(-0.1 * r, r * 0.38, 0)), v(r * 0.22, r * 0.22, r * 0.22), WHITE, [0, 0, 0], 8);
      ell(E, o.clone().multiplyScalar(r * 0.95).add(v(0.15 * r, -r * 0.25, 0)), v(r * 0.1, r * 0.1, r * 0.1), WHITE, [0, 0, 0], 6);
      const m = new THREE.Mesh(E.build(), eyeMat);
      g.add(m);
      parent.add(g);
      parts.eyes.push(g);
    },
    leg: (d, build) => {
      const pivot = new THREE.Group();
      pivot.position.copy(d.hip);
      body.add(pivot);
      const L = new Parts();
      build(L);
      const m = new THREE.Mesh(L.build(), mat);
      m.castShadow = true;
      m.receiveShadow = true;
      pivot.add(m);
      parts.legs.push({ pivot, front: d.front, side: d.side });
    },
    set: (k, o) => {
      if (k === 'mouth' || k === 'nose') anchors[k] = o;
      else (parts as Record<string, unknown>)[k] = o;
    },
    arm: (g) => parts.arms.push(g),
    plate: (m) => parts.plates.push(m),
  };
  def.flesh(kit);
  const full: DinoParts = { body, head: parts.head!, jaw: parts.jaw!, neck: parts.neck ?? null, tail: parts.tail!, legs: parts.legs, arms: parts.arms, eyes: parts.eyes, plates: parts.plates };
  const rig = new DinoRig(full);
  rig.update(0);
  root.scale.setScalar(def.scale);
  flesh.updateMatrixWorld(true);
  const box = new THREE.Box3();
  flesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld);
    box.union(b);
  });
  // Bounds in model space (the root's own scale removed).
  box.min.divideScalar(def.scale);
  box.max.divideScalar(def.scale);
  const pieces = buildPieces(id);
  return {
    id,
    root,
    scale: def.scale,
    flesh,
    rig,
    pieces,
    mouth: anchors.mouth ?? full.head,
    nose: anchors.nose ?? full.head,
    box,
    dispose() {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => x.dispose());
      });
      pieces.forEach((p) => p.geometry.dispose());
      mat.dispose();
      eyeMat.dispose();
    },
  };
}

/** The dinosaur's model scale (diplodocus smaller so it fits the stand). */
export const dinoScale = (id: DinoId) => DEFS[id].scale;
