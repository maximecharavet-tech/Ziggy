import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Creature } from './logic';
import type { Kit } from './creature3d';

/**
 * The second wave of parts of the factory: more bodies, heads, legs, arms, wings,
 * tails, ears and horns, hats, mouths, noses, magic auras and little buddies.
 * Same rules as the first wave: built in code, soft shapes, no sharp spikes.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, shadow = true): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = shadow;
  return o;
}

function tube(points: THREE.Vector3[], r: number, low: boolean): THREE.BufferGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), low ? 10 : 18, r, low ? 6 : 8, false);
}

/** A material owned by the kit (disposed with it). */
function own(k: Kit, color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
  k.all.push(m);
  return m;
}

/** A solid of revolution from a profile `(angle −π/2..π/2) → [radius, y]`. */
function lathe(profile: (a: number) => [number, number], seg: number, steps = 28): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / steps;
    const [r, y] = profile(a);
    pts.push(new THREE.Vector2(i === 0 || i === steps ? 0 : Math.max(0.001, r), y));
  }
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  return g;
}

function sphereAt(r: number, x: number, y: number, z: number, seg: number, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75));
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}

/* ───────────────────────── Bodies and heads ───────────────────────── */

export function extraBody(shape: Creature['body'], low: boolean): THREE.BufferGeometry | null {
  const seg = low ? 22 : 34;
  switch (shape) {
    case 'pear':
      return lathe((a) => [0.68 * Math.cos(a) * (1 - 0.4 * (0.5 + 0.5 * Math.sin(a))), 0.7 * Math.sin(a) - 0.04], seg);
    case 'cloud': {
      const s = low ? 14 : 22;
      const g = mergeGeometries([sphereAt(1, 0, 0, 0, s, 0.5, 0.42, 0.46), sphereAt(1, -0.4, -0.06, 0, s, 0.34, 0.3, 0.36), sphereAt(1, 0.4, -0.06, 0, s, 0.34, 0.3, 0.36), sphereAt(1, -0.17, 0.2, 0.03, s, 0.3, 0.3, 0.3), sphereAt(1, 0.2, 0.22, -0.02, s, 0.27, 0.27, 0.28)])!;
      g.computeVertexNormals();
      return g;
    }
    case 'tall': {
      const g = new THREE.CapsuleGeometry(0.34, 0.78, low ? 6 : 10, seg);
      g.scale(1, 1, 0.92);
      return g;
    }
    case 'barrel': {
      const pts = [
        [0, -0.52],
        [0.34, -0.52],
        [0.52, -0.44],
        [0.62, -0.25],
        [0.66, 0],
        [0.62, 0.25],
        [0.52, 0.44],
        [0.34, 0.52],
        [0, 0.52],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const curve = new THREE.SplineCurve(pts);
      const g = new THREE.LatheGeometry(curve.getPoints(24), seg);
      g.computeVertexNormals();
      return g;
    }
    case 'bell':
      return lathe((a) => {
        const t = (Math.sin(a) + 1) / 2; // 0 bottom … 1 top
        const flare = 0.42 + 0.3 * Math.pow(1 - t, 2.2);
        return [flare * Math.pow(Math.cos(a), 0.55) * (a < -1.2 ? 1 : 1), 0.62 * Math.sin(a) + 0.02];
      }, seg);
    case 'pillow': {
      const g = new RoundedBoxGeometry(1.2, 0.78, 0.6, low ? 4 : 6, 0.3);
      return g;
    }
    default:
      return null;
  }
}

export function extraHead(shape: Creature['head'], low: boolean): THREE.BufferGeometry | null {
  const seg = low ? 20 : 30;
  const ball = (sx: number, sy: number, sz: number) => {
    const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
    g.scale(sx, sy, sz);
    return g;
  };
  if (shape === 'wide') return ball(0.56, 0.34, 0.4);
  if (shape === 'tall') return ball(0.33, 0.5, 0.36);
  if (shape === 'drop') return lathe((a) => [0.4 * Math.cos(a) * (1 - 0.45 * Math.max(0, Math.sin(a))), 0.42 * Math.sin(a)], seg, 24);
  if (shape === 'cone') return lathe((a) => [0.42 * Math.pow(Math.cos(a), 0.8) * (1 - 0.75 * Math.pow(Math.max(0, Math.sin(a)), 1.4)), 0.5 * Math.sin(a)], seg, 24);
  return null;
}

/* ───────────────────────── Legs ───────────────────────── */

/** Spring, wheel and flipper legs. Returns null for the first-wave styles. */
export function extraLeg(style: Creature['legStyle'], len: number, thick: number, k: Kit, low: boolean, shadow: boolean): THREE.Group[] | null {
  const g = new THREE.Group();
  const seg = low ? 8 : 12;
  if (style === 'spring') {
    const pts: THREE.Vector3[] = [];
    const turns = 5;
    for (let i = 0; i <= turns * 12; i++) {
      const t = i / (turns * 12);
      const a = t * Math.PI * 2 * turns;
      pts.push(V(Math.cos(a) * 0.065, -t * (len - 0.05), Math.sin(a) * 0.065));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(mesh(new THREE.TubeGeometry(curve, low ? 60 : 120, 0.016, 6, false), k.gold, shadow));
    const foot = mesh(new THREE.SphereGeometry(1, seg, 8), k.accent, shadow);
    foot.scale.set(0.1, 0.05, 0.13);
    foot.position.set(0, -len + 0.035, 0.03);
    g.add(foot);
    return [g];
  }
  if (style === 'wheel') {
    const r = Math.max(0.07, Math.min(0.17, len * 0.5));
    const strut = mesh(new THREE.CylinderGeometry(0.03, 0.03, Math.max(0.02, len - r), 8), k.ink, shadow);
    strut.position.y = -(len - r) / 2;
    const tyre = mesh(new THREE.CylinderGeometry(r, r, 0.08 * (0.8 + 0.2 * thick), low ? 14 : 22), k.ink, shadow);
    tyre.rotation.z = Math.PI / 2;
    tyre.position.y = -len + r;
    const hub = mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.1, 12), k.accent, false);
    hub.rotation.z = Math.PI / 2;
    hub.position.y = -len + r;
    g.add(strut, tyre, hub);
    return [g];
  }
  if (style === 'paddle') {
    const r = 0.1 * (0.7 + 0.3 * thick);
    const leg = mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.8, len, seg), k.accent, shadow);
    leg.position.y = -len / 2;
    const foot = mesh(new THREE.ConeGeometry(0.17, 0.2, 3), k.accent, shadow);
    foot.rotation.x = Math.PI / 2;
    foot.rotation.z = Math.PI;
    foot.scale.set(1, 1, 0.3);
    foot.position.set(0, -len + 0.025, 0.12);
    g.add(leg, foot);
    return [g];
  }
  return null;
}

/* ───────────────────────── Arms ───────────────────────── */

export function extraArm(style: Creature['armStyle'], k: Kit, low: boolean, shadow: boolean): THREE.Group | null {
  const g = new THREE.Group();
  const seg = low ? 8 : 12;
  if (style === 'glove') {
    g.add(mesh(tube([V(0, 0, 0), V(0.12, -0.01, 0.03), V(0.24, -0.1, 0.06)], 0.036, low), k.body, shadow));
    const palm = mesh(new THREE.SphereGeometry(0.1, seg, 10), k.white, shadow);
    palm.position.set(0.27, -0.16, 0.07);
    g.add(palm);
    for (let i = 0; i < 3; i++) {
      const f = mesh(new THREE.CapsuleGeometry(0.026, 0.05, 3, 6), k.white, false);
      f.position.set(0.27 + (i - 1) * 0.05, -0.25, 0.07);
      f.rotation.z = (i - 1) * 0.25;
      g.add(f);
    }
    const cuff = mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 10), k.accent, false);
    cuff.position.set(0.22, -0.09, 0.06);
    cuff.rotation.z = -0.7;
    g.add(cuff);
    return g;
  }
  if (style === 'fin') {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.04);
    sh.quadraticCurveTo(0.2, 0.06, 0.34, -0.2);
    sh.quadraticCurveTo(0.14, -0.1, 0.02, -0.05);
    sh.lineTo(0, 0.04);
    const m = new THREE.MeshStandardMaterial({ color: k.accent.color, roughness: 0.4, side: THREE.DoubleSide });
    k.all.push(m);
    g.add(mesh(new THREE.ShapeGeometry(sh, low ? 6 : 10), m, shadow));
    return g;
  }
  if (style === 'feather') {
    for (let i = 0; i < 3; i++) {
      const f = mesh(new THREE.SphereGeometry(1, seg, 8), i === 1 ? k.white : k.wing, shadow);
      f.scale.set(0.2 - i * 0.025, 0.045, 0.02);
      const a = -0.25 - i * 0.4;
      f.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, i * 0.004);
      f.rotation.z = a;
      g.add(f);
    }
    return g;
  }
  return null;
}

/* ───────────────────────── Wings ───────────────────────── */

function lensShape(len: number, w: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(len * 0.5, w, len, 0);
  s.quadraticCurveTo(len * 0.5, -w, 0, 0);
  return s;
}

export function extraWing(kind: Creature['wings'], k: Kit, low: boolean, shadow: boolean, span: number): THREE.Group | null {
  const g = new THREE.Group();
  const s = span;
  const feathers = (cols: THREE.Material[], n: number) => {
    for (let i = 0; i < n; i++) {
      const f = mesh(new THREE.SphereGeometry(1, low ? 10 : 14, 8), cols[i % cols.length], shadow);
      const len = (0.38 - i * 0.04) * s;
      f.scale.set(len, 0.08 * s, 0.03 * s);
      const a = 0.9 - i * 0.3;
      f.position.set(Math.cos(a) * len * 0.95, Math.sin(a) * len * 0.95 - 0.02, -i * 0.006);
      f.rotation.z = a;
      g.add(f);
    }
  };
  if (kind === 'angel') {
    feathers([k.white], 5);
    return g;
  }
  if (kind === 'rainbow') {
    const cols = ['#ff4d5e', '#ff9a2e', '#ffd23f', '#62d34a', '#3f7bff'].map((c) => own(k, c, { side: THREE.DoubleSide }));
    feathers(cols, 5);
    return g;
  }
  if (kind === 'fairy') {
    const m = own(k, '#ffffff', { transparent: true, opacity: 0.62, roughness: 0.2, side: THREE.DoubleSide, emissive: k.accent.color, emissiveIntensity: 0.25, depthWrite: false });
    const up = mesh(new THREE.CircleGeometry(1, low ? 16 : 26), m, false);
    up.scale.set(0.3 * s, 0.2 * s, 1);
    up.position.set(0.28 * s, 0.2 * s, 0);
    up.rotation.z = 0.55;
    const dn = mesh(new THREE.CircleGeometry(1, low ? 14 : 22), m, false);
    dn.scale.set(0.2 * s, 0.13 * s, 1);
    dn.position.set(0.2 * s, -0.08 * s, 0.002);
    dn.rotation.z = -0.5;
    g.add(up, dn);
    const vein = mesh(tube([V(0, 0, 0.004), V(0.28 * s, 0.2 * s, 0.004), V(0.5 * s, 0.32 * s, 0.004)], 0.008, low), k.gold, false);
    g.add(vein);
    return g;
  }
  if (kind === 'leaf') {
    const m = own(k, '#62d34a', { side: THREE.DoubleSide, roughness: 0.6 });
    const m2 = own(k, '#3fae4a', { side: THREE.DoubleSide, roughness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const leaf = mesh(new THREE.ShapeGeometry(lensShape((0.46 - i * 0.08) * s, 0.12 * s), low ? 6 : 10), i % 2 ? m2 : m, shadow);
      leaf.rotation.z = 0.7 - i * 0.55;
      leaf.position.z = -i * 0.004;
      const vein = mesh(new THREE.CylinderGeometry(0.006, 0.006, (0.44 - i * 0.08) * s, 5), k.ivory, false);
      vein.rotation.z = Math.PI / 2;
      vein.position.set((0.22 - i * 0.04) * s, 0, 0.004);
      leaf.add(vein);
      g.add(leaf);
    }
    return g;
  }
  return null;
}

/* ───────────────────────── Tails ───────────────────────── */

export function extraTail(kind: Creature['tail'], k: Kit, low: boolean, shadow: boolean): THREE.Group | null {
  const g = new THREE.Group();
  if (kind === 'lightning') {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.07);
    sh.lineTo(0.2, 0.12);
    sh.lineTo(0.1, 0.0);
    sh.lineTo(0.34, 0.06);
    sh.lineTo(0.06, -0.16);
    sh.lineTo(0.14, -0.02);
    sh.lineTo(-0.02, -0.04);
    const m = own(k, '#ffd23f', { emissive: '#ffb300', emissiveIntensity: 0.55, side: THREE.DoubleSide, roughness: 0.35 });
    const bolt = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }), m, shadow);
    bolt.rotation.y = Math.PI / 2;
    bolt.scale.setScalar(1.3);
    bolt.position.set(0, 0.02, -0.04);
    bolt.rotation.z = 0.6;
    g.add(bolt);
    return g;
  }
  if (kind === 'plume') {
    const eye = own(k, '#1fc8b8', { roughness: 0.35 });
    for (let i = 0; i < 3; i++) {
      const f = mesh(new THREE.SphereGeometry(1, low ? 10 : 14, 8), i === 1 ? k.accent : k.wing, shadow);
      f.scale.set(0.05, 0.16, 0.34);
      const a = (i - 1) * 0.5;
      f.position.set(Math.sin(a) * 0.3, 0.06 + Math.abs(a) * -0.03, -Math.cos(a) * 0.3);
      f.rotation.y = a;
      f.rotation.x = -0.2;
      const dot = mesh(new THREE.SphereGeometry(0.06, 8, 6), eye, false);
      dot.scale.set(1, 1.6, 0.6);
      dot.position.set(0, 0.05, -0.26);
      f.add(dot);
      g.add(f);
    }
    return g;
  }
  if (kind === 'balloon') {
    g.add(mesh(tube([V(0, 0, 0), V(0, 0.15, -0.12), V(0.02, 0.32, -0.16)], 0.007, low), k.ink, false));
    const m = own(k, k.accent.color, { roughness: 0.2, metalness: 0.05 });
    const b = mesh(new THREE.SphereGeometry(0.16, low ? 14 : 22, 14), m, shadow);
    b.scale.set(1, 1.15, 1);
    b.position.set(0.02, 0.5, -0.17);
    const knot = mesh(new THREE.ConeGeometry(0.03, 0.04, 6), m, false);
    knot.rotation.x = Math.PI;
    knot.position.set(0.02, 0.33, -0.17);
    g.add(b, knot);
    return g;
  }
  if (kind === 'ribbon') {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) pts.push(V(Math.sin(i * 0.9) * 0.07, i * 0.012, -i * 0.045));
    g.add(mesh(tube(pts, 0.026, low), k.pink, shadow));
    for (const side of [-1, 1]) {
      const loop = mesh(new THREE.ConeGeometry(0.07, 0.15, 6), k.pink, shadow);
      loop.rotation.z = side * Math.PI / 2;
      loop.scale.z = 0.4;
      loop.position.set(side * 0.08, 0.13, -0.47);
      g.add(loop);
    }
    const knot = mesh(new THREE.SphereGeometry(0.04, 8, 6), k.pink, false);
    knot.position.set(0, 0.13, -0.47);
    g.add(knot);
    return g;
  }
  return null;
}

/* ───────────────────────── Ears, horns, stalks ───────────────────────── */

/** `single` tops (unicorn, flower) are built once, the others in pairs. */
export const SINGLE_TOPS: readonly Creature['top'][] = ['unicorn', 'flower'];

export function extraTop(kind: Creature['top'], side: number, s: number, k: Kit, low: boolean, shadow: boolean): THREE.Group | null {
  const g = new THREE.Group();
  const seg = low ? 8 : 12;
  if (kind === 'eyestalks') {
    g.add(mesh(tube([V(0, 0, 0), V(side * 0.03 * s, 0.14 * s, 0), V(side * 0.07 * s, 0.26 * s, 0.02)], 0.02 * s, low), k.body, shadow));
    const eye = mesh(new THREE.SphereGeometry(0.075 * s, seg, 10), k.white, shadow);
    eye.position.set(side * 0.07 * s, 0.31 * s, 0.03);
    const pup = mesh(new THREE.SphereGeometry(0.038 * s, seg, 8), k.pupil, false);
    pup.position.set(0, 0, 0.055 * s);
    eye.add(pup);
    g.add(eye);
    return g;
  }
  if (kind === 'elf') {
    const ear = mesh(new THREE.ConeGeometry(0.075 * s, 0.34 * s, 4), k.body, shadow);
    ear.scale.z = 0.4;
    ear.rotation.z = -side * 1.15;
    ear.position.set(side * 0.1 * s, 0.05 * s, 0);
    const inner = mesh(new THREE.ConeGeometry(0.04 * s, 0.22 * s, 4), k.pink, false);
    inner.scale.z = 0.3;
    inner.rotation.z = -side * 1.15;
    inner.position.set(side * 0.09 * s, 0.05 * s, 0.025 * s);
    g.add(ear, inner);
    return g;
  }
  if (kind === 'floppy') {
    const ear = mesh(new THREE.CapsuleGeometry(0.075 * s, 0.22 * s, 4, seg), k.accent, shadow);
    ear.scale.z = 0.45;
    ear.position.set(side * 0.1 * s, -0.04 * s, 0);
    ear.rotation.z = side * 0.4;
    g.add(ear);
    return g;
  }
  if (kind === 'bear') {
    const ear = mesh(new THREE.SphereGeometry(0.1 * s, seg, 10), k.body, shadow);
    ear.scale.z = 0.55;
    ear.position.y = 0.05 * s;
    const inner = mesh(new THREE.SphereGeometry(0.055 * s, seg, 8), k.pink, false);
    inner.scale.z = 0.4;
    inner.position.set(0, 0.05 * s, 0.045 * s);
    g.add(ear, inner);
    return g;
  }
  if (kind === 'unicorn') {
    const horn = mesh(new THREE.ConeGeometry(0.07 * s, 0.4 * s, seg), k.gold, shadow);
    horn.position.y = 0.19 * s;
    g.add(horn);
    for (let i = 0; i < 3; i++) {
      const ring = mesh(new THREE.TorusGeometry((0.058 - i * 0.015) * s, 0.01 * s, 5, 12), k.white, false);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = (0.08 + i * 0.1) * s;
      g.add(ring);
    }
    return g;
  }
  if (kind === 'flower') {
    const petal = own(k, '#ff8fb8', { roughness: 0.5 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = mesh(new THREE.SphereGeometry(0.06 * s, 8, 6), petal, false);
      p.position.set(Math.cos(a) * 0.075 * s, 0.05 * s + Math.sin(a) * 0.075 * s, 0);
      p.scale.z = 0.5;
      g.add(p);
    }
    const mid = mesh(new THREE.SphereGeometry(0.052 * s, 10, 8), k.gold, false);
    mid.position.set(0, 0.05 * s, 0.015);
    mid.scale.z = 0.7;
    g.add(mid);
    g.rotation.x = 0.4;
    return g;
  }
  return null;
}

/* ───────────────────────── Hats ───────────────────────── */

export function extraHat(kind: Creature['hat'], s: number, k: Kit, low: boolean, shadow: boolean): THREE.Group | null {
  const g = new THREE.Group();
  const seg = low ? 12 : 20;
  if (kind === 'wizard') {
    const m = own(k, '#5b3fd0', { roughness: 0.6 });
    const brim = mesh(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.025 * s, seg), m, shadow);
    brim.position.y = 0.012 * s;
    const cone = mesh(new THREE.ConeGeometry(0.2 * s, 0.55 * s, seg), m, shadow);
    cone.position.y = 0.3 * s;
    cone.rotation.z = 0.12;
    const band = mesh(new THREE.CylinderGeometry(0.2 * s, 0.205 * s, 0.05 * s, seg), k.gold, false);
    band.position.y = 0.06 * s;
    const star = mesh(new THREE.OctahedronGeometry(0.04 * s), k.gold, false);
    star.position.set(0.01 * s, 0.22 * s, 0.14 * s);
    g.add(brim, cone, band, star);
    return g;
  }
  if (kind === 'chef') {
    const band = mesh(new THREE.CylinderGeometry(0.17 * s, 0.17 * s, 0.1 * s, seg), k.white, shadow);
    band.position.y = 0.05 * s;
    g.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const puff = mesh(new THREE.SphereGeometry(0.1 * s, 12, 10), k.white, shadow);
      puff.position.set(Math.cos(a) * 0.1 * s, 0.16 * s, Math.sin(a) * 0.1 * s);
      g.add(puff);
    }
    const top = mesh(new THREE.SphereGeometry(0.13 * s, 12, 10), k.white, shadow);
    top.position.y = 0.22 * s;
    g.add(top);
    return g;
  }
  if (kind === 'cap') {
    const cap = mesh(new THREE.SphereGeometry(0.2 * s, seg, 10, 0, Math.PI * 2, 0, Math.PI / 2), k.accent, shadow);
    const visor = mesh(new THREE.CylinderGeometry(0.17 * s, 0.17 * s, 0.02 * s, seg, 1, false, -Math.PI / 2.4, Math.PI / 1.2), k.accent, shadow);
    visor.position.set(0, 0.01 * s, 0.11 * s);
    const button = mesh(new THREE.SphereGeometry(0.025 * s, 8, 6), k.white, false);
    button.position.y = 0.2 * s;
    g.add(cap, visor, button);
    return g;
  }
  if (kind === 'beanie') {
    const cap = mesh(new THREE.SphereGeometry(0.21 * s, seg, 10, 0, Math.PI * 2, 0, Math.PI / 2), k.pink, shadow);
    cap.position.y = 0.0;
    const fold = mesh(new THREE.CylinderGeometry(0.215 * s, 0.215 * s, 0.07 * s, seg), k.accent, shadow);
    fold.position.y = 0.02 * s;
    const pom = mesh(new THREE.SphereGeometry(0.06 * s, 10, 8), k.white, shadow);
    pom.position.y = 0.23 * s;
    g.add(cap, fold, pom);
    return g;
  }
  if (kind === 'halo') {
    const m = own(k, '#ffe066', { emissive: '#ffd23f', emissiveIntensity: 0.9, roughness: 0.3 });
    const ring = mesh(new THREE.TorusGeometry(0.15 * s, 0.025 * s, 8, 28), m, false);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2 * s;
    g.add(ring);
    return g;
  }
  if (kind === 'captain') {
    const crown = mesh(new THREE.CylinderGeometry(0.19 * s, 0.2 * s, 0.14 * s, seg), k.white, shadow);
    crown.position.y = 0.12 * s;
    const band = mesh(new THREE.CylinderGeometry(0.205 * s, 0.205 * s, 0.05 * s, seg), k.ink, false);
    band.position.y = 0.07 * s;
    const visor = mesh(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.02 * s, seg, 1, false, -Math.PI / 2.4, Math.PI / 1.2), k.ink, shadow);
    visor.position.set(0, 0.04 * s, 0.1 * s);
    const badge = mesh(new THREE.SphereGeometry(0.035 * s, 8, 6), k.gold, false);
    badge.position.set(0, 0.13 * s, 0.2 * s);
    badge.scale.z = 0.4;
    g.add(crown, band, visor, badge);
    return g;
  }
  return null;
}

/* ───────────────────────── Mouths ───────────────────────── */

/** Cat, grin, moustache and gap-tooth mouths, added to `m`. Returns the part that opens, if any. */
export function extraMouth(kind: Creature['mouth'], s: number, k: Kit, low: boolean, m: THREE.Group): THREE.Object3D | null {
  const arc = (r: number, x = 0, y = 0.05, rot = Math.PI) => {
    const g = mesh(new THREE.TorusGeometry(r * s, 0.022 * s, low ? 6 : 8, low ? 10 : 16, Math.PI), k.dark, false);
    g.rotation.z = rot;
    g.position.set(x * s, y * s, 0);
    return g;
  };
  if (kind === 'cat') {
    const a = arc(0.05, -0.05, 0.03);
    const b = arc(0.05, 0.05, 0.03);
    m.add(a, b);
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const w = mesh(new THREE.CylinderGeometry(0.006 * s, 0.006 * s, 0.2 * s, 5), k.ink, false);
        w.rotation.z = Math.PI / 2 + side * (i - 1) * 0.22;
        w.position.set(side * 0.2 * s, (0.06 + (1 - i) * 0.0) * s - i * 0.03 * s + 0.03 * s, 0);
        m.add(w);
      }
    return null;
  }
  if (kind === 'grin') {
    const g = new THREE.Group();
    const mouth = mesh(new THREE.CircleGeometry(0.14 * s, low ? 14 : 24, Math.PI, Math.PI), k.dark, false);
    mouth.position.y = 0.05 * s;
    const teeth = mesh(new THREE.PlaneGeometry(0.22 * s, 0.035 * s), k.white, false);
    teeth.position.set(0, 0.032 * s, 0.003);
    const tongue = mesh(new THREE.CircleGeometry(0.06 * s, 12, Math.PI, Math.PI), k.pink, false);
    tongue.position.set(0, -0.06 * s + 0.05 * s, 0.002);
    g.add(mouth, teeth, tongue);
    m.add(g);
    return g;
  }
  if (kind === 'moustache') {
    const mat = k.ink;
    for (const side of [-1, 1]) {
      const curl = mesh(new THREE.SphereGeometry(1, 10, 8), mat, false);
      curl.scale.set(0.085 * s, 0.035 * s, 0.03 * s);
      curl.position.set(side * 0.075 * s, 0.065 * s, 0.01);
      curl.rotation.z = side * -0.4;
      const tip = mesh(new THREE.SphereGeometry(0.022 * s, 8, 6), mat, false);
      tip.position.set(side * 0.15 * s, 0.085 * s, 0.01);
      m.add(curl, tip);
    }
    const g = arc(0.07, 0, -0.01);
    m.add(g);
    return g;
  }
  if (kind === 'gap') {
    const g = arc(0.1);
    m.add(g);
    const tooth = mesh(new RoundedBoxGeometry(0.045 * s, 0.065 * s, 0.025 * s, 2, 0.01 * s), k.white, false);
    tooth.position.set(-0.03 * s, -0.01 * s, 0.015);
    const tooth2 = tooth.clone();
    tooth2.position.x = 0.045 * s;
    m.add(tooth, tooth2);
    return g;
  }
  return null;
}

/* ───────────────────────── Noses ───────────────────────── */

export function buildNose(kind: Creature['nose'], s: number, k: Kit, low: boolean): THREE.Group | null {
  if (kind === 'none') return null;
  const g = new THREE.Group();
  const seg = low ? 10 : 16;
  if (kind === 'button') {
    const n = mesh(new THREE.SphereGeometry(0.04 * s, seg, 10), k.dark, false);
    n.scale.z = 0.7;
    g.add(n);
  } else if (kind === 'clown') {
    const m = own(k, '#ff3b4a', { roughness: 0.25 });
    const n = mesh(new THREE.SphereGeometry(0.075 * s, seg, 12), m, true);
    const sh = mesh(new THREE.SphereGeometry(0.02 * s, 8, 6), k.shine, false);
    sh.position.set(-0.025 * s, 0.03 * s, 0.062 * s);
    g.add(n, sh);
  } else if (kind === 'snout') {
    const n = mesh(new THREE.CylinderGeometry(0.075 * s, 0.085 * s, 0.07 * s, seg), k.pink, true);
    n.rotation.x = Math.PI / 2;
    n.position.z = 0.03 * s;
    g.add(n);
    for (const side of [-1, 1]) {
      const h = mesh(new THREE.SphereGeometry(0.014 * s, 8, 6), k.dark, false);
      h.position.set(side * 0.03 * s, 0, 0.068 * s);
      g.add(h);
    }
  } else if (kind === 'carrot') {
    const m = own(k, '#ff8a1f', { roughness: 0.5 });
    const n = mesh(new THREE.ConeGeometry(0.045 * s, 0.24 * s, seg), m, true);
    n.rotation.x = Math.PI / 2;
    n.position.z = 0.1 * s;
    g.add(n);
  } else {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.05);
    sh.bezierCurveTo(-0.1, 0.02, -0.06, 0.09, 0, 0.04);
    sh.bezierCurveTo(0.06, 0.09, 0.1, 0.02, 0, -0.05);
    const m = own(k, '#ff4f7e', { roughness: 0.35, side: THREE.DoubleSide });
    const n = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), m, true);
    n.scale.setScalar(s * 0.9);
    g.add(n);
  }
  return g;
}

/* ───────────────────────── Magic aura ───────────────────────── */

export interface AuraSprite {
  obj: THREE.Object3D;
  r: number;
  a: number;
  y: number;
  speed: number;
  bob: number;
}

function heartShape(): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.5);
  sh.bezierCurveTo(-0.75, 0.05, -0.4, 0.62, 0, 0.2);
  sh.bezierCurveTo(0.4, 0.62, 0.75, 0.05, 0, -0.5);
  return sh;
}

function starShape(): THREE.Shape {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? 0.24 : 0.55;
    if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  sh.closePath();
  return sh;
}

/** Little things drifting around the creature. `r` is the creature's half width, `h` its height. */
export function buildAura(kind: Creature['aura'], r: number, h: number, low: boolean): { group: THREE.Group; sprites: AuraSprite[]; mats: THREE.Material[] } | null {
  if (kind === 'none') return null;
  const group = new THREE.Group();
  const sprites: AuraSprite[] = [];
  const mats: THREE.Material[] = [];
  const n = low ? 6 : 10;
  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4, side: THREE.DoubleSide, ...extra });
    mats.push(m);
    return m;
  };
  const geo: THREE.BufferGeometry =
    kind === 'hearts'
      ? new THREE.ShapeGeometry(heartShape(), 8)
      : kind === 'stars'
        ? new THREE.ShapeGeometry(starShape(), 1)
        : kind === 'bubbles'
          ? new THREE.SphereGeometry(0.5, 14, 10)
          : kind === 'notes'
            ? new THREE.SphereGeometry(0.3, 10, 8)
            : new THREE.OctahedronGeometry(0.4);
  const m =
    kind === 'hearts'
      ? mat('#ff6fb5')
      : kind === 'stars'
        ? mat('#ffd23f')
        : kind === 'bubbles'
          ? mat('#bfe8ff', { transparent: true, opacity: 0.5, emissiveIntensity: 0.15, roughness: 0.1 })
          : kind === 'notes'
            ? mat('#4fd1ff')
            : mat('#fff3a0');
  for (let i = 0; i < n; i++) {
    const o = new THREE.Group();
    const piece = new THREE.Mesh(geo, m);
    const size = (0.07 + (i % 3) * 0.025) * Math.max(0.8, r);
    piece.scale.setScalar(size * (kind === 'bubbles' ? 1.2 : 1));
    o.add(piece);
    if (kind === 'notes') {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5), m);
      stem.position.set(0.05, 0.08, 0);
      o.add(stem);
    }
    sprites.push({ obj: o, r: r + 0.25 + (i % 4) * 0.08, a: (i / n) * Math.PI * 2, y: h * (0.15 + ((i * 37) % 10) / 12), speed: 0.5 + (i % 3) * 0.2, bob: i * 1.7 });
    group.add(o);
  }
  return { group, sprites, mats };
}

/* ───────────────────────── Buddies ───────────────────────── */

export interface Buddy {
  group: THREE.Group;
  /** Called every frame: bobbing, wiggling. */
  tick: (t: number, calm: number) => void;
  mats: THREE.Material[];
}

export function buildPet(kind: Creature['pet'], low: boolean): Buddy | null {
  if (kind === 'none') return null;
  const g = new THREE.Group();
  const mats: THREE.Material[] = [];
  const M = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });
    mats.push(m);
    return m;
  };
  const seg = low ? 10 : 16;
  const dark = M('#2c2440');
  const white = M('#ffffff', { roughness: 0.3 });
  const eyes = (parent: THREE.Object3D, x: number, y: number, z: number, r: number) => {
    for (const side of [-1, 1]) {
      const e = mesh(new THREE.SphereGeometry(r, 8, 6), white, false);
      e.position.set(side * x, y, z);
      const p = mesh(new THREE.SphereGeometry(r * 0.55, 8, 6), dark, false);
      p.position.z = r * 0.6;
      e.add(p);
      parent.add(e);
    }
  };
  let tick: Buddy['tick'] = () => {};
  if (kind === 'ladybug') {
    const red = M('#ff3b3b', { roughness: 0.25 });
    const shell = mesh(new THREE.SphereGeometry(0.15, seg, 10, 0, Math.PI * 2, 0, Math.PI / 1.7), red, true);
    shell.scale.set(1, 0.7, 1.2);
    shell.position.y = 0.06;
    const head = mesh(new THREE.SphereGeometry(0.075, 10, 8), dark, true);
    head.position.set(0, 0.07, 0.17);
    g.add(shell, head);
    for (const [x, z] of [
      [-0.07, -0.02],
      [0.07, 0.03],
      [0, -0.1],
    ]) {
      const dot = mesh(new THREE.SphereGeometry(0.03, 8, 6), dark, false);
      dot.position.set(x, 0.15, z);
      dot.scale.y = 0.4;
      g.add(dot);
    }
    eyes(head, 0.032, 0.02, 0.05, 0.022);
    tick = (t, c) => {
      g.position.y = Math.abs(Math.sin(t * 5)) * 0.02 * c;
      g.rotation.y = Math.sin(t * 1.2) * 0.5 * c;
    };
  } else if (kind === 'chick') {
    const yellow = M('#ffd84a');
    const body = mesh(new THREE.SphereGeometry(0.17, seg, 12), yellow, true);
    body.position.y = 0.17;
    const beak = mesh(new THREE.ConeGeometry(0.035, 0.07, 6), M('#ff9a2e'), false);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.17, 0.18);
    g.add(body, beak);
    eyes(body, 0.07, 0.05, 0.13, 0.03);
    for (const side of [-1, 1]) {
      const w = mesh(new THREE.SphereGeometry(0.06, 8, 6), yellow, false);
      w.scale.set(0.5, 1, 0.9);
      w.position.set(side * 0.17, 0.16, 0);
      g.add(w);
      const f = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.06, 5), M('#ff9a2e'), false);
      f.position.set(side * 0.05, 0.03, 0);
      g.add(f);
    }
    tick = (t, c) => {
      g.position.y = Math.max(0, Math.sin(t * 4)) * 0.06 * c;
      body.scale.y = 1 + Math.sin(t * 8) * 0.04 * c;
    };
  } else if (kind === 'cloud') {
    const cl = M('#ffffff', { roughness: 0.9, emissive: '#cfe8ff', emissiveIntensity: 0.2 });
    for (const [x, y, r] of [
      [0, 0, 0.14],
      [-0.12, -0.03, 0.1],
      [0.12, -0.03, 0.1],
      [0.03, 0.09, 0.1],
    ])
      g.add(mesh(new THREE.SphereGeometry(r, seg, 10), cl, false).translateX(x).translateY(y));
    const face = new THREE.Group();
    face.position.set(0, 0, 0.12);
    eyes(face, 0.045, 0.02, 0, 0.018);
    g.add(face);
    g.position.y = 0.7;
    tick = (t, c) => {
      g.position.y = 0.7 + Math.sin(t * 1.4) * 0.05 * (0.4 + c);
    };
  } else if (kind === 'snail') {
    const skin = M('#d9c9a8');
    const shell = M('#b07a4f');
    const body = mesh(new THREE.CapsuleGeometry(0.05, 0.22, 4, 10), skin, true);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.05, 0);
    const sh = mesh(new THREE.TorusGeometry(0.09, 0.05, 8, 18), shell, true);
    sh.position.set(-0.04, 0.17, 0);
    const sh2 = mesh(new THREE.SphereGeometry(0.06, 10, 8), shell, true);
    sh2.position.set(-0.04, 0.17, 0);
    g.add(body, sh, sh2);
    const st: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const stalk = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 5), skin, false);
      stalk.position.set(0.14, 0.14, side * 0.025);
      const ball = mesh(new THREE.SphereGeometry(0.02, 6, 6), dark, false);
      ball.position.y = 0.06;
      stalk.add(ball);
      g.add(stalk);
      st.push(stalk);
    }
    g.rotation.y = Math.PI / 2;
    tick = (t, c) => {
      st.forEach((s, i) => (s.rotation.x = Math.sin(t * 2 + i) * 0.25 * c));
      body.scale.x = 1 + Math.sin(t * 2.4) * 0.05 * c;
    };
  } else {
    const col = M('#ff5c8a', { roughness: 0.2 });
    const b = mesh(new THREE.SphereGeometry(0.15, seg, 12), col, true);
    b.scale.y = 1.15;
    b.position.y = 0.95;
    const str = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.8, 4), dark, false);
    str.position.y = 0.5;
    g.add(b, str);
    tick = (t, c) => {
      g.rotation.z = Math.sin(t * 1.3) * 0.08 * c;
      g.position.y = Math.sin(t * 1.6) * 0.03 * c;
    };
  }
  return { group: g, tick, mats };
}

/* ───────────────────────── Patterns (second wave) ───────────────────────── */

export function paintPattern(kind: Creature['pattern'], g: CanvasRenderingContext2D) {
  if (kind === 'zigzag') {
    g.strokeStyle = g.fillStyle as string;
    g.lineWidth = 16;
    g.lineJoin = 'round';
    for (let y = 0; y < 4; y++) {
      g.beginPath();
      for (let x = 0; x <= 8; x++) g.lineTo(x * 32, y * 64 + 12 + (x % 2) * 30);
      g.stroke();
    }
  } else if (kind === 'hearts') {
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++) {
        const cx = 43 + x * 85 + (y % 2) * 42;
        const cy = 50 + y * 85;
        g.beginPath();
        g.moveTo(cx, cy + 20);
        g.bezierCurveTo(cx - 36, cy - 4, cx - 18, cy - 30, cx, cy - 10);
        g.bezierCurveTo(cx + 18, cy - 30, cx + 36, cy - 4, cx, cy + 20);
        g.fill();
      }
  } else if (kind === 'checks') {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) g.fillRect(x * 64, y * 64, 64, 64);
  } else if (kind === 'waves') {
    g.strokeStyle = g.fillStyle as string;
    g.lineWidth = 14;
    for (let y = 0; y < 4; y++) {
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) g.lineTo(x, y * 64 + 32 + Math.sin((x / 256) * Math.PI * 4) * 16);
      g.stroke();
    }
  }
}
