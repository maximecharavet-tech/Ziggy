import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Tiny geometry kit for the code-built workshop: every part is painted with
 * vertex colours so a whole machine (or a whole hall) merges into ONE mesh
 * with one shared material (draw-call budget, docs/GAME_ARCHITECTURE.md §4).
 * All geometries are normalised to position + normal + color, indexed.
 */

export type Geo = THREE.BufferGeometry;

const tmpColor = new THREE.Color();

/** Normalise: indexed, only position/normal/color, painted `color`. */
export function paint(g: Geo, color: THREE.ColorRepresentation): Geo {
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  tmpColor.set(color);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = tmpColor.r;
    c[i * 3 + 1] = tmpColor.g;
    c[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/** Normalise without painting (keeps an existing colour attribute, else white). */
export function plain(g: Geo): Geo {
  if (g.attributes.color) {
    if (!g.index) paintIndexOnly(g);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  }
  return paint(g, '#ffffff');
}

function paintIndexOnly(g: Geo) {
  const n = g.attributes.position.count;
  const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

/** Move / turn / scale a geometry in place. */
export function at(g: Geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): Geo {
  e.set(rx, ry, rz);
  q.setFromEuler(e);
  v.set(x, y, z);
  s.set(sx, sy, sz);
  m4.compose(v, q, s);
  g.applyMatrix4(m4);
  return g;
}

export const box = (w: number, h: number, d: number, color: THREE.ColorRepresentation) => paint(new THREE.BoxGeometry(w, h, d), color);
export const rbox = (w: number, h: number, d: number, r: number, color: THREE.ColorRepresentation, seg = 2) =>
  paint(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)), color);
export const cyl = (rt: number, rb: number, h: number, color: THREE.ColorRepresentation, seg = 14) => paint(new THREE.CylinderGeometry(rt, rb, h, seg), color);
export const ball = (r: number, color: THREE.ColorRepresentation, w = 14, h = 10) => paint(new THREE.SphereGeometry(r, w, h), color);
export const cone = (r: number, h: number, color: THREE.ColorRepresentation, seg = 14) => paint(new THREE.ConeGeometry(r, h, seg), color);
export const torus = (r: number, tube: number, color: THREE.ColorRepresentation, seg = 16, arc = Math.PI * 2) => paint(new THREE.TorusGeometry(r, tube, 8, seg, arc), color);

/** A flat shape (star, heart…) extruded. */
export function extrude(shape: THREE.Shape, depth: number, color: THREE.ColorRepresentation, bevel = 0): Geo {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return paint(g, color);
}

export function starShape(outer: number, inner: number, points = 5): THREE.Shape {
  const sh = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  sh.closePath();
  return sh;
}

export function heartShape(size: number): THREE.Shape {
  const k = size;
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.5 * k);
  sh.bezierCurveTo(0.55 * k, -0.05 * k, 0.55 * k, 0.45 * k, 0, 0.22 * k);
  sh.bezierCurveTo(-0.55 * k, 0.45 * k, -0.55 * k, -0.05 * k, 0, -0.5 * k);
  return sh;
}

export function moonShape(r: number): THREE.Shape {
  const sh = new THREE.Shape();
  sh.absarc(0, 0, r, Math.PI * 0.3, Math.PI * 1.7, false);
  sh.absarc(r * 0.45, 0, r * 0.78, Math.PI * 1.55, Math.PI * 0.45, true);
  return sh;
}

/** An arrow (flat triangle + stem) pointing +X, lying on the floor. */
export function arrow(len: number, width: number, color: THREE.ColorRepresentation, h = 0.03): Geo {
  const sh = new THREE.Shape();
  const hw = width / 2;
  sh.moveTo(len / 2, 0);
  sh.lineTo(0, hw);
  sh.lineTo(0, hw * 0.45);
  sh.lineTo(-len / 2, hw * 0.45);
  sh.lineTo(-len / 2, -hw * 0.45);
  sh.lineTo(0, -hw * 0.45);
  sh.lineTo(0, -hw);
  sh.closePath();
  const g = extrude(sh, h, color);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Merge normalised geometries (each already painted). Disposes the inputs. */
export function merge(list: Geo[]): Geo {
  const clean = list.filter((g) => g.attributes.position && g.attributes.position.count > 0).map((g) => (g.attributes.color && g.index ? g : plain(g)));
  if (!clean.length) return new THREE.BufferGeometry();
  const out = mergeGeometries(clean, false) ?? new THREE.BufferGeometry();
  for (const g of list) g.dispose();
  return out;
}

/** Shared flat-shaded vertex-colour felt material. */
export function feltMaterial(extra: Partial<THREE.MeshLambertMaterialParameters> = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...extra });
}

/** Turn a local (machine facing +X) geometry to face a grid direction. */
export const DIR_YAW: Record<string, number> = { E: 0, N: Math.PI / 2, W: Math.PI, S: -Math.PI / 2 };
