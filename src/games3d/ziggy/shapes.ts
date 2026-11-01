import * as THREE from 'three';

/**
 * The plush is made of "superellipsoids": rounded boxes, like a cushion
 * stuffed with wadding. They are analytic, so the face can be laid exactly on
 * the head (eyes, lashes and mouth follow the curve of the felt).
 */
export interface Cushion {
  /** Half sizes along x, y, z. */
  a: number;
  b: number;
  c: number;
  /** Roundness: 2 = ellipsoid, higher = boxier. */
  p: number;
}

const sgnPow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

/** Radial scale that brings a unit direction onto the cushion surface. */
function radial(s: Cushion, x: number, y: number, z: number) {
  return Math.pow(Math.pow(Math.abs(x / s.a), s.p) + Math.pow(Math.abs(y / s.b), s.p) + Math.pow(Math.abs(z / s.c), s.p), -1 / s.p);
}

/** A smooth cushion mesh (UVs from the sphere, for the felt textures). */
export function cushionGeometry(s: Cushion, wSeg = 48, hSeg = 32, shape?: (v: THREE.Vector3) => void): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, wSeg, hSeg);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    v.multiplyScalar(radial(s, v.x, v.y, v.z));
    shape?.(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Front surface depth z at (x, y), or 0 outside the silhouette. */
export function frontZ(s: Cushion, x: number, y: number): number {
  const r = 1 - Math.pow(Math.abs(x / s.a), s.p) - Math.pow(Math.abs(y / s.b), s.p);
  return r <= 0 ? 0 : s.c * Math.pow(r, 1 / s.p);
}

/** Outward surface normal at a surface point. */
export function cushionNormal(s: Cushion, p: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(sgnPow(p.x / s.a, s.p - 1) / s.a, sgnPow(p.y / s.b, s.p - 1) / s.b, sgnPow(p.z / s.c, s.p - 1) / s.c).normalize();
}

/** Point of the surface in a given direction. */
export function cushionPoint(s: Cushion, dir: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  out.copy(dir).normalize();
  return out.multiplyScalar(radial(s, out.x, out.y, out.z));
}

/**
 * Lays a flat 2D shape (centred on cx, cy) onto the front of a cushion,
 * lifted by `lift` along z: a decal that hugs the felt.
 */
export function projectOnto(g: THREE.BufferGeometry, s: Cushion, cx: number, cy: number, lift: number): THREE.BufferGeometry {
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = cx + pos.getX(i);
    const y = cy + pos.getY(i);
    pos.setXYZ(i, x, y, frontZ(s, x, y) + lift);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** A disc patch (with UVs 0–1 across its square) for textured decals. */
export function discPatch(r: number, s: Cushion, cx: number, cy: number, lift: number, seg = 40): THREE.BufferGeometry {
  // Rings of vertices inside the disc, so it bends with the felt.
  return projectOnto(new THREE.RingGeometry(0.0005, r, seg, 10), s, cx, cy, lift);
}

/** A rectangular patch (UVs 0–1) for textured decals like the mouth. */
export function rectPatch(w: number, h: number, s: Cushion, cx: number, cy: number, lift: number): THREE.BufferGeometry {
  return projectOnto(new THREE.PlaneGeometry(w, h, 12, 8), s, cx, cy, lift);
}

/**
 * A ribbed tube (the grey accordion arms and legs), hanging down from the
 * origin along -y.
 */
export function ribbedGeometry(length: number, radius: number, ribs: number, depth: number, radial = 18): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = ribs * 8;
  pts.push(new THREE.Vector2(0.0001, 0));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const rib = 0.5 + 0.5 * Math.cos(t * ribs * Math.PI * 2);
    pts.push(new THREE.Vector2(radius - depth + depth * Math.pow(rib, 0.6), -t * length));
  }
  pts.push(new THREE.Vector2(0.0001, -length));
  // Lathe expects points from bottom to top for outward normals.
  return new THREE.LatheGeometry(pts.reverse(), radial);
}

/** The classic heart outline, about 1 unit wide, centred. */
export function heartShape(scale = 1, inset = 0): THREE.Shape {
  const s = new THREE.Shape();
  const k = scale;
  const pts: THREE.Vector2[] = [];
  // Parametric heart (smooth, with a soft point at the bottom).
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const len = Math.hypot(x, y) || 1;
    const shrink = inset ? 1 - inset / (len / 32) : 1;
    pts.push(new THREE.Vector2((x / 32) * k * shrink, ((y + 2) / 32) * k * shrink));
  }
  s.setFromPoints(pts);
  return s;
}

/** A felt tube along points (antenna stalks, seams, eyebrows). */
export function tubeAlong(points: THREE.Vector3[], radius: number, seg = 24, radial = 8): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, radius, radial, false);
}
