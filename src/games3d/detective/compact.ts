import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Fewer draw calls without changing the look: the still meshes under one
 * moving node (an eye, an ear, a hat…) are merged per kind of material
 * (Lambert, Phong, plain, see-through…), each part's colour kept as a vertex
 * colour. Nodes in `skip` (and `userData.noMerge` ones), hidden meshes,
 * textured meshes and hit boxes are left alone.
 */
export function mergeLocal(root: THREE.Object3D, skip: Set<THREE.Object3D> = new Set()): number {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[]; cast: boolean; receive: boolean; order: number }>();
  const visit = (o: THREE.Object3D) => {
    for (const ch of o.children) {
      if (skip.has(ch) || ch.userData.noMerge) continue;
      const m = ch as THREE.Mesh;
      if (m.isMesh) {
        const key = mergeKey(m);
        if (key) {
          let g = m.geometry.clone();
          if (g.index) g = g.toNonIndexed();
          for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
          if (!g.attributes.normal) g.computeVertexNormals();
          g.applyMatrix4(inv.clone().multiply(m.matrixWorld));
          const mt = m.material as THREE.MeshPhongMaterial;
          const base = mt.color.clone();
          const n = g.attributes.position.count;
          const cols = new Float32Array(n * 3);
          const src = mt.vertexColors ? (g.attributes.color as THREE.BufferAttribute | undefined) : undefined;
          for (let i = 0; i < n; i++) {
            cols[i * 3] = base.r * (src ? src.getX(i) : 1);
            cols[i * 3 + 1] = base.g * (src ? src.getY(i) : 1);
            cols[i * 3 + 2] = base.b * (src ? src.getZ(i) : 1);
          }
          g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
          const k = `${key}|${m.castShadow}|${m.receiveShadow}|${m.renderOrder}`;
          if (!buckets.has(k)) buckets.set(k, { mat: mt, geos: [], meshes: [], cast: m.castShadow, receive: m.receiveShadow, order: m.renderOrder });
          const b = buckets.get(k)!;
          b.geos.push(g);
          b.meshes.push(m);
        }
      }
      visit(ch);
    }
  };
  visit(root);
  let added = 0;
  const dropped = new Set<THREE.Material>();
  for (const b of buckets.values()) {
    // A single part gains nothing from merging: leave it as it is.
    const merged = b.geos.length >= 2 ? mergeGeometries(b.geos, false) : null;
    b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mat = b.mat.clone() as THREE.MeshPhongMaterial;
    mat.color.set('#ffffff');
    mat.vertexColors = true;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.renderOrder = b.order;
    root.add(mesh);
    added++;
    for (const m of b.meshes) {
      m.parent?.remove(m);
      m.geometry.dispose();
      dropped.add(m.material as THREE.Material);
    }
  }
  // Materials nothing uses any more.
  const used = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) used.add(m.material as THREE.Material);
  });
  for (const mt of dropped) if (!used.has(mt)) mt.dispose();
  return added;
}

/** What makes two parts drawable together (everything but the colour), or null if it can't be merged. */
function mergeKey(m: THREE.Mesh): string | null {
  // A mesh holding other things is kept (removing it would take its children away).
  if (!m.visible || m.children.length || m.userData.hitbox || Array.isArray(m.material) || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return null;
  const mt = m.material as THREE.MeshPhongMaterial & { map?: THREE.Texture | null };
  if (!mt || mt.map || !mt.visible || mt.opacity === 0) return null;
  if (!((mt as unknown as THREE.MeshLambertMaterial).isMeshLambertMaterial || mt.isMeshPhongMaterial || (mt as unknown as THREE.MeshBasicMaterial).isMeshBasicMaterial || (mt as unknown as THREE.MeshStandardMaterial).isMeshStandardMaterial)) return null;
  const parts: (string | number | boolean)[] = [mt.type, mt.transparent, +mt.opacity.toFixed(3), mt.side, Boolean(mt.flatShading), mt.depthWrite, mt.depthTest, mt.toneMapped, mt.blending];
  if (mt.emissive) parts.push(mt.emissive.getHexString(), +((mt.emissiveIntensity ?? 1) as number).toFixed(3));
  // Phong parts merge whatever their shininess (tiny eye parts: the first one's is kept).
  const st = mt as unknown as THREE.MeshStandardMaterial;
  if (st.isMeshStandardMaterial) parts.push(+st.roughness.toFixed(3), +st.metalness.toFixed(3));
  return parts.join(',');
}
