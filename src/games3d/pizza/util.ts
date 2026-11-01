import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Small helpers for the pizzeria scene (kept here so the game only depends
 * on the shared kit): static batching, a gradient sky, canvas textures.
 */

/**
 * Merge every static flat-shaded mesh under `root` into a handful of meshes
 * (one per shadow/side combination), the colours baked into vertex colours:
 * the village has hundreds of little pieces, drawn in a few calls.
 * Objects flagged `userData.noMerge` (and their children) are left alone.
 * (Same approach as the garden of Le Nid.)
 */
export function mergeStatic(root: THREE.Object3D, receive = false): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { geos: THREE.BufferGeometry[]; cast: boolean; side: THREE.Side }>();
  const done: THREE.Mesh[] = [];
  const skipped = (o: THREE.Object3D) => {
    for (let x: THREE.Object3D | null = o; x && x !== root.parent; x = x.parent) if (x.userData.noMerge) return true;
    return false;
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || skipped(m)) return;
    const mt = m.material as THREE.MeshLambertMaterial;
    if (Array.isArray(m.material) || !mt.isMeshLambertMaterial || mt.transparent || mt.map) return;
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(inv.clone().multiply(m.matrixWorld));
    const base = mt.color.clone().add(mt.emissive ?? new THREE.Color(0));
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    const src = mt.vertexColors ? (g.attributes.color as THREE.BufferAttribute | undefined) : undefined;
    for (let i = 0; i < n; i++) {
      cols[i * 3] = base.r * (src ? src.getX(i) : 1);
      cols[i * 3 + 1] = base.g * (src ? src.getY(i) : 1);
      cols[i * 3 + 2] = base.b * (src ? src.getZ(i) : 1);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const key = `${m.castShadow}-${mt.side}`;
    if (!buckets.has(key)) buckets.set(key, { geos: [], cast: m.castShadow, side: mt.side });
    buckets.get(key)!.geos.push(g);
    done.push(m);
  });
  for (const m of done) {
    m.parent?.remove(m);
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: b.side }));
    mesh.castShadow = b.cast;
    mesh.receiveShadow = receive;
    root.add(mesh);
  }
}

/** A soft gradient sky dome (no fog, behind everything). */
export function makeSky(top: string, bottom: string, below: string): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) }, below: { value: new THREE.Color(below) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 bottom; uniform vec3 below; varying vec3 vP; void main(){ vec3 c = vP.y > 0.0 ? mix(bottom, top, smoothstep(0.0, 0.5, vP.y)) : mix(bottom, below, smoothstep(0.0, -0.3, vP.y)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 16), m);
  sky.renderOrder = -10;
  return sky;
}

/** A texture painted on a canvas. */
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

export const EMOJI_FONT = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Soft, smooth plush-like material for characters and food. */
export const soft = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...extra });

/** A sprite with a canvas drawing (round number flags, "?" bubbles…). */
export function canvasSprite(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, scale: number): THREE.Sprite {
  const tex = canvasTex(w, h, draw);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(scale * (w / h), scale, 1);
  return s;
}

export const easeOut = (k: number) => 1 - (1 - k) ** 3;
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
export const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
