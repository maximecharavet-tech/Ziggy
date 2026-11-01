import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Small geometry kit for the dig site: coloured parts merged into one
 * geometry (one draw call), a matrix helper and a few shapes. No DOM.
 */

export type V3 = THREE.Vector3;
export const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const UP = v(0, 1, 0);
export const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);

export type Paint = THREE.ColorRepresentation | ((p: V3, n: V3) => THREE.Color);

/** Collects coloured parts and merges them into one geometry (one draw call). */
export class Parts {
  private list: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, paint: Paint, m?: THREE.Matrix4): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (m) g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.clearGroups();
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const cols = new Float32Array(pos.count * 3);
    const fixed = typeof paint === 'function' ? null : col(paint);
    const p = v();
    const n = v();
    for (let i = 0; i < pos.count; i++) {
      let c: THREE.Color;
      if (fixed) c = fixed;
      else {
        p.fromBufferAttribute(pos, i);
        n.fromBufferAttribute(nor, i);
        c = (paint as (p: V3, n: V3) => THREE.Color)(p, n);
      }
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.list.push(g);
    return this;
  }

  get empty() {
    return this.list.length === 0;
  }

  build(): THREE.BufferGeometry {
    const g = this.list.length ? (mergeGeometries(this.list, false) ?? new THREE.BufferGeometry()) : new THREE.BufferGeometry();
    this.list.forEach((x) => x.dispose());
    this.list = [];
    return g;
  }
}

/** Matrix from a position, Euler angles (or a quaternion) and a scale. */
export function tf(pos: V3 = v(), rot: [number, number, number] | THREE.Quaternion = [0, 0, 0], scale: V3 | number = 1): THREE.Matrix4 {
  const q = rot instanceof THREE.Quaternion ? rot : new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  const s = typeof scale === 'number' ? v(scale, scale, scale) : scale;
  return new THREE.Matrix4().compose(pos, q, s);
}

/** An ellipsoid with radii r at c. */
export function ell(P: Parts, c: V3, r: V3, paint: Paint, rot: [number, number, number] = [0, 0, 0], seg = 20) {
  P.add(new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.65))), paint, tf(c, rot, r));
}

/** A point on the surface of the ellipsoid (c, r) in direction d (and the outward direction). */
export function onEll(c: V3, r: V3, d: V3, inset = 0): { p: V3; n: V3 } {
  const u = d.clone().normalize();
  const p = c.clone().add(v(u.x * r.x, u.y * r.y, u.z * r.z));
  const n = v(u.x / r.x, u.y / r.y, u.z / r.z).normalize();
  return { p: p.addScaledVector(n, -inset), n };
}

/** A tapered cylinder (or cone when r1 = 0) from a to b. */
export function stick(P: Parts, a: V3, b: V3, r0: number, r1: number, paint: Paint, seg = 10) {
  const d = b.clone().sub(a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, r1 === 0);
  P.add(g, paint, tf(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())));
}

/** A cone from `at` pointing along `dir` (claws, horns, spikes). */
export function cone(P: Parts, at: V3, dir: V3, len: number, r: number, paint: Paint, seg = 10) {
  stick(P, at, at.clone().addScaledVector(dir.clone().normalize(), len), r, 0, paint, seg);
}

/** A box. */
export function box(P: Parts, c: V3, size: V3, paint: Paint, rot: [number, number, number] = [0, 0, 0]) {
  P.add(new THREE.BoxGeometry(size.x, size.y, size.z), paint, tf(c, rot));
}

/**
 * A smooth tube along a planar curve (x-y plane) with a varying, slightly
 * squashed cross-section: bodies, necks and tails.
 */
export function tubeGeo(points: V3[], radii: number[], seg = 32, rad = 14, squashY = 1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const radiusAt = (t: number) => {
    const f = t * (radii.length - 1);
    const i = Math.min(radii.length - 2, Math.floor(f));
    const k = f - i;
    const s = k * k * (3 - 2 * k);
    return radii[i] + (radii[i + 1] - radii[i]) * s;
  };
  const verts: number[] = [];
  const idx: number[] = [];
  let prevN: V3 | null = null;
  const b = v(0, 0, 1);
  let handed = 1;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const c = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = v(-tan.y, tan.x, 0);
    if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
    n.normalize();
    if (prevN ? n.dot(prevN) < 0 : n.y < 0) n.negate();
    prevN = n;
    if (i === 0) handed = n.clone().cross(b).dot(tan) >= 0 ? 1 : -1;
    const r = radiusAt(t);
    for (let j = 0; j < rad; j++) {
      const a = (j / rad) * Math.PI * 2;
      verts.push(c.x + n.x * Math.cos(a) * r * squashY, c.y + n.y * Math.cos(a) * r * squashY, c.z + Math.sin(a) * r);
    }
  }
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < rad; j++) {
      const a = i * rad + j;
      const bb = i * rad + ((j + 1) % rad);
      const c = (i + 1) * rad + j;
      const d = (i + 1) * rad + ((j + 1) % rad);
      if (handed > 0) idx.push(a, bb, c, bb, d, c);
      else idx.push(a, c, bb, bb, c, d);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Dispose every geometry and material under an object (textures included). */
export function disposeDeep(root: THREE.Object3D, keep: Set<THREE.Texture> = new Set()) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const x of mats) {
      for (const val of Object.values(x)) if (val instanceof THREE.Texture && !keep.has(val)) val.dispose();
      x.dispose();
    }
  });
}
