import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Draw-call diet for the code-built plush rigs (elves, Ziggy) without
 * touching their builders: the rigs move a few named groups (shoulders,
 * elbows, head, eyes…) while most meshes sit still inside them. We find the
 * moving objects empirically (exercise the rig, watch which transforms or
 * visibilities change), then merge the still meshes that share a material
 * into one mesh per (moving ancestor, material). Silhouette and motion are
 * unchanged; an elf drops from ~70 meshes to a few dozen draw calls.
 *
 * Runtime only (client, three.js). One-off per character instance.
 */

interface Snap {
  p: THREE.Vector3;
  q: THREE.Quaternion;
  s: THREE.Vector3;
  v: boolean;
}

const EPS = 1e-5;

function snapshot(root: THREE.Object3D): Map<THREE.Object3D, Snap> {
  const out = new Map<THREE.Object3D, Snap>();
  root.traverse((o) => out.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone(), v: o.visible }));
  return out;
}

function changed(o: THREE.Object3D, s: Snap): boolean {
  return (
    o.visible !== s.v ||
    o.position.distanceToSquared(s.p) > EPS * EPS ||
    Math.abs(o.quaternion.dot(s.q)) < 1 - EPS ||
    o.scale.distanceToSquared(s.s) > EPS * EPS
  );
}

/**
 * Find the objects a rig moves: `exercise(step)` is called many times and
 * should drive the rig through every pose / cue it can play.
 */
export function findDynamic(root: THREE.Object3D, exercise: (frame: number) => void, frames = 240): Set<THREE.Object3D> {
  const base = snapshot(root);
  const dyn = new Set<THREE.Object3D>();
  for (let f = 0; f < frames; f++) {
    exercise(f);
    for (const [o, s] of base) if (!dyn.has(o) && changed(o, s)) dyn.add(o);
  }
  // Back to the rest transforms (the caller resets the rig state).
  for (const [o, s] of base) {
    o.position.copy(s.p);
    o.quaternion.copy(s.q);
    o.scale.copy(s.s);
    o.visible = s.v;
  }
  return dyn;
}

const attrKey = (g: THREE.BufferGeometry) =>
  `${g.index ? 'i' : 'n'}|${Object.keys(g.attributes)
    .sort()
    .map((k) => `${k}:${g.attributes[k].itemSize}:${(g.attributes[k] as THREE.BufferAttribute).normalized ? 1 : 0}`)
    .join(',')}|${Object.keys(g.morphAttributes).length}`;

/**
 * Merge the still meshes under `root` that share a material, per nearest
 * moving ancestor. Returns how many meshes were folded away.
 */
export function mergeStill(root: THREE.Object3D, dynamic: Set<THREE.Object3D>): number {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { anchor: THREE.Object3D; meshes: THREE.Mesh[] }>();
  const anchorId = new Map<THREE.Object3D, number>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m === root || dynamic.has(m)) return;
    if (Array.isArray(m.material) || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    if (Object.keys(m.userData).length || !m.visible || m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    const g = m.geometry;
    if (!g?.attributes.position || g.groups.length > 1) return;
    let anchor: THREE.Object3D = m.parent!;
    while (anchor !== root && !dynamic.has(anchor)) anchor = anchor.parent!;
    if (!anchorId.has(anchor)) anchorId.set(anchor, anchorId.size);
    const key = `${anchorId.get(anchor)}|${m.material.uuid}|${attrKey(g)}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${m.renderOrder}|${m.frustumCulled ? 1 : 0}`;
    const b = buckets.get(key) ?? { anchor, meshes: [] };
    b.meshes.push(m);
    buckets.set(key, b);
  });
  let folded = 0;
  const inv = new THREE.Matrix4();
  const rel = new THREE.Matrix4();
  for (const { anchor, meshes } of buckets.values()) {
    if (meshes.length < 2) continue;
    inv.copy(anchor.matrixWorld).invert();
    const geos = meshes.map((m) => {
      rel.multiplyMatrices(inv, m.matrixWorld);
      const g = m.geometry.clone();
      g.applyMatrix4(rel);
      return g;
    });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const first = meshes[0];
    const out = new THREE.Mesh(merged, first.material);
    out.castShadow = first.castShadow;
    out.receiveShadow = first.receiveShadow;
    out.renderOrder = first.renderOrder;
    out.frustumCulled = first.frustumCulled;
    out.name = `merged:${first.name || 'part'}`;
    for (const m of meshes) {
      // (geometries may be shared with moving parts: never disposed here)
      m.removeFromParent();
    }
    anchor.add(out);
    folded += meshes.length - 1;
  }
  return folded;
}

/** Count draw calls (visible meshes) and triangles under a root (tests, perf notes). */
export function meshStats(root: THREE.Object3D): { meshes: number; tris: number } {
  let meshes = 0;
  let tris = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const g = m.geometry;
    tris += (g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3;
  });
  return { meshes, tris: Math.round(tris) };
}
