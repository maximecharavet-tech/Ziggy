import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cushionGeometry, type Cushion } from '../ziggy/shapes';
import { fbm3, puffs3 } from './noise';

/**
 * Soft, stuffed shapes for the felt Santa: lumpy "puffs" (beard, fur trims,
 * pompom), tapered tubes (hat, moustache, eyebrows) and a helper that welds
 * the normals along UV seams so nothing shows a crease.
 */

/** Average the normals of vertices that share a position (UV seams, poles). */
export function smoothSeams(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeVertexNormals();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const groups = new Map<string, number[]>();
  const q = (v: number) => Math.round(v * 1e4);
  for (let i = 0; i < pos.count; i++) {
    const k = `${q(pos.getX(i))},${q(pos.getY(i))},${q(pos.getZ(i))}`;
    const list = groups.get(k);
    if (list) list.push(i);
    else groups.set(k, [i]);
  }
  const n = new THREE.Vector3();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of list) n.set(n.x + nor.getX(i), n.y + nor.getY(i), n.z + nor.getZ(i));
    n.normalize();
    for (const i of list) nor.setXYZ(i, n.x, n.y, n.z);
  }
  nor.needsUpdate = true;
  return g;
}

export interface PuffOptions {
  /** Bump height, as a fraction of the size. */
  amp?: number;
  /** How many bumps across. */
  freq?: number;
  seed?: number;
  wSeg?: number;
  hSeg?: number;
  /** Extra shaping applied before the bumps (unit-sphere direction in, point out). */
  shape?: (v: THREE.Vector3) => void;
}

/** A lumpy cushion: like a handful of wadding or a curl of beard. */
export function puffGeometry(c: Cushion, o: PuffOptions = {}): THREE.BufferGeometry {
  const amp = o.amp ?? 0.18;
  const freq = o.freq ?? 2.6;
  const seed = o.seed ?? 1;
  const g = cushionGeometry(c, o.wSeg ?? 28, o.hSeg ?? 20, o.shape);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const d = new THREE.Vector3();
  const size = Math.min(c.a, c.b, c.c);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    d.copy(v).normalize();
    const bump = (puffs3(d.x * freq + seed, d.y * freq, d.z * freq, seed) - 0.45) * amp * size * 2 + fbm3(d.x * 9, d.y * 9, d.z * 9, seed + 5, 2) * amp * size * 0.18;
    v.addScaledVector(d, bump);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  return smoothSeams(g);
}

/** A fluffy fur ring (hat rim, cuffs, coat hem), lying in the XZ plane. */
export function fluffTorus(R: number, r: number, o: { amp?: number; freq?: number; seed?: number; radial?: number; tubular?: number; zScale?: number } = {}): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(R, r, o.radial ?? 12, o.tubular ?? 48);
  g.rotateX(Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  const amp = o.amp ?? 0.35;
  const freq = o.freq ?? 7;
  const seed = o.seed ?? 3;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    c.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    const out = v.clone().sub(c);
    const len = out.length() || 1;
    out.divideScalar(len);
    const n = puffs3(Math.cos(a) * freq + seed, Math.sin(a) * freq, out.y * 1.6 + out.x * 0.4, seed) - 0.45;
    v.copy(c).addScaledVector(out, len * (1 + n * amp));
    if (o.zScale) v.z *= o.zScale;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  return smoothSeams(g);
}

/**
 * A tube along points whose radius follows `radius(t)` (t = 0..1 along it):
 * a tapering hat, a curled moustache, a bushy eyebrow. Optional bumps.
 */
export function taperedTube(
  points: THREE.Vector3[],
  radius: (t: number) => number,
  o: { tubular?: number; radial?: number; amp?: number; freq?: number; seed?: number; squash?: number; squashAxis?: THREE.Vector3 } = {}
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const tubular = o.tubular ?? 32;
  const radial = o.radial ?? 14;
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const tmp = new THREE.Vector3();
  const axis = o.squashAxis?.clone().normalize();
  const amp = o.amp ?? 0;
  const freq = o.freq ?? 5;
  const seed = o.seed ?? 2;
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / (radial + 1));
    const j = i % (radial + 1);
    const t = ring / tubular;
    const c = curve.getPointAt(t);
    tmp.fromBufferAttribute(pos, i).sub(c).normalize();
    let r = radius(t);
    if (amp) r *= 1 + (puffs3(t * freq * 2 + seed, Math.cos((j / radial) * Math.PI * 2) * 1.3, Math.sin((j / radial) * Math.PI * 2) * 1.3, seed) - 0.45) * amp;
    if (axis && o.squash) {
      // Squash along an axis (a flat moustache, a fur strip lying on the coat).
      tmp.addScaledVector(axis, -tmp.dot(axis) * o.squash);
    }
    pos.setXYZ(i, c.x + tmp.x * r, c.y + tmp.y * r, c.z + tmp.z * r);
  }
  return smoothSeams(g);
}

/** Merge geometries (same attributes) into one, disposing the parts. */
export function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') p.deleteAttribute(k);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged ?? new THREE.BufferGeometry();
}

/** A sphere-ish puff placed and scaled, ready to merge. */
export function puffAt(x: number, y: number, z: number, r: number, seed: number, o: { sx?: number; sy?: number; sz?: number; amp?: number; freq?: number; seg?: number } = {}): THREE.BufferGeometry {
  const seg = o.seg ?? 18;
  const g = puffGeometry({ a: r * (o.sx ?? 1), b: r * (o.sy ?? 1), c: r * (o.sz ?? 1), p: 2 }, { amp: o.amp ?? 0.2, freq: o.freq ?? 2.2, seed, wSeg: seg, hSeg: Math.round(seg * 0.7) });
  g.translate(x, y, z);
  return g;
}
