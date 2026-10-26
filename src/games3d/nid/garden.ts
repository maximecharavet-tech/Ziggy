import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { glow, glowMat, mat } from '../kit/look';
import { rng } from '../kit/rng';
import type { DecorId, FoodId } from './logic';

/**
 * The garden-house diorama of Le Nid: a round floating island of grass with
 * a cottage, the companion's nest, an apple tree, a pond and a swing.
 * Everything is low-poly and built in code; nothing is downloaded.
 */

export const SPOT = {
  home: new THREE.Vector3(0, 0, 1.2),
  pond: new THREE.Vector3(4.8, 0, 2.4),
  pondR: 2.4,
  tree: new THREE.Vector3(4.6, 0, -4.4),
  basket: new THREE.Vector3(2.5, 0, -2.0),
  nest: new THREE.Vector3(-2.3, 0, -1.4),
  house: new THREE.Vector3(-5.4, 0, -4.6),
  swing: new THREE.Vector3(-7.0, 0, 1.6),
  blanket: new THREE.Vector3(0, 0, 3.6),
  throwFrom: new THREE.Vector3(-0.9, 0.4, 7.2),
  hoops: [new THREE.Vector3(-3.8, 0, 4.4), new THREE.Vector3(-1.0, 0, 5.4), new THREE.Vector3(1.9, 0, 5.9)],
  decor: [
    new THREE.Vector3(-8.6, 0, -1.8),
    new THREE.Vector3(-6.6, 0, 5.2),
    new THREE.Vector3(-3.4, 0, 7.9),
    new THREE.Vector3(0.8, 0, 8.9),
    new THREE.Vector3(5.4, 0, 7.4),
    new THREE.Vector3(8.8, 0, -1.4),
    new THREE.Vector3(1.6, 0, -7.6),
    new THREE.Vector3(-1.9, 0, -6.6),
  ],
  islandR: 11,
};

/* ───────────────────────── Textures & sprites ───────────────────────── */

let heartTexture: THREE.Texture | null = null;
export function heartTex(): THREE.Texture {
  if (heartTexture) return heartTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.translate(64, 70);
  const heart = () => {
    g.beginPath();
    g.moveTo(0, 38);
    g.bezierCurveTo(-60, -2, -42, -58, 0, -26);
    g.bezierCurveTo(42, -58, 60, -2, 0, 38);
    g.closePath();
  };
  heart();
  g.fillStyle = '#ff5c8a';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.beginPath();
  g.ellipse(-18, -20, 9, 6, -0.6, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fill();
  heartTexture = new THREE.CanvasTexture(c);
  heartTexture.colorSpace = THREE.SRGBColorSpace;
  return heartTexture;
}

/** Big friendly text (no background) as a sprite: bubble letters, "Z". */
export function textSprite(text: string, opts: { fg?: string; stroke?: string; size?: number } = {}): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.font = `bold ${text.length > 1 ? 70 : 92}px Fredoka, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.strokeStyle = opts.stroke ?? '#1d4e89';
  g.strokeText(text, 64, 70);
  g.fillStyle = opts.fg ?? '#ffffff';
  g.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.setScalar(opts.size ?? 0.8);
  return s;
}

/** Glow sprites tagged this way brighten at night (lanterns, windows, star lamp). */
function nightGlow(color: string, size: number, day: number, night: number) {
  const s = glow(color, size, day);
  s.userData.nightGlow = { day, night };
  return s;
}

/* ───────────────────────── Static batching ───────────────────────── */

/**
 * Merge every static flat-shaded mesh under `root` into a handful of meshes
 * (one per shadow/side combination), with the colours baked into vertex
 * colours. The garden has hundreds of little pieces; drawing them in a few
 * calls keeps phones (and software GL) smooth. Objects flagged
 * `userData.noMerge` (and their children) are left alone.
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

/* ───────────────────────── Sky ───────────────────────── */

export function makeSky(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#7cc8ff') }, bottom: { value: new THREE.Color('#ffe8c2') }, below: { value: new THREE.Color('#b9e4ff') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 bottom; uniform vec3 below; varying vec3 vP; void main(){ vec3 c = vP.y > 0.0 ? mix(bottom, top, smoothstep(0.0, 0.55, vP.y)) : mix(bottom, below, smoothstep(0.0, -0.45, vP.y)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
  });
  return new THREE.Mesh(new THREE.SphereGeometry(150, 24, 16), m);
}

export function makeStars(count: number): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
  const r = rng(77);
  const pos: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const y = 0.15 + r() * 0.85;
    const rad = 130;
    const h = Math.sqrt(1 - y * y);
    pos.push(Math.cos(a) * h * rad, y * rad, Math.sin(a) * h * rad);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#fff8dc', size: 1.4, sizeAttenuation: true, fog: false, transparent: true, opacity: 0, depthWrite: false }));
}

export function makeClouds(): THREE.Group {
  const g = new THREE.Group();
  const r = rng(12);
  const m = mat('#ffffff', { emissive: new THREE.Color('#ffffff').multiplyScalar(0.25) });
  for (let i = 0; i < 9; i++) {
    const cl = new THREE.Group();
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + r() * 1.2, 1), m);
      p.position.set((k - n / 2) * 1.4, r() * 0.6, r() * 0.8);
      p.scale.y = 0.7;
      cl.add(p);
    }
    const a = (i / 9) * Math.PI * 2 + r();
    const d = 24 + r() * 14;
    cl.position.set(Math.cos(a) * d, 5 + r() * 9, Math.sin(a) * d);
    cl.lookAt(0, cl.position.y, 0);
    g.add(cl);
  }
  return g;
}

/* ───────────────────────── Island ───────────────────────── */

export function makeIsland(): { group: THREE.Group; ground: THREE.Mesh } {
  const g = new THREE.Group();
  const R = SPOT.islandR;
  const top = new THREE.RingGeometry(0.01, R, 56, 12);
  top.rotateX(-Math.PI / 2);
  const pos = top.attributes.position;
  const cols: number[] = [];
  const a = new THREE.Color('#8fd46a');
  const b = new THREE.Color('#6fbf55');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = 0.5 + Math.sin(x * 0.9 + z * 0.3) * 0.25 + Math.cos(z * 1.1 - x * 0.4) * 0.25;
    const c = a.clone().lerp(b, n);
    cols.push(c.r, c.g, c.b);
    const d = Math.hypot(x, z);
    pos.setY(i, d > R - 0.6 ? -(d - (R - 0.6)) * 0.25 : 0);
  }
  top.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  top.computeVertexNormals();
  const ground = new THREE.Mesh(top, mat('#ffffff', { vertexColors: true }));
  ground.receiveShadow = true;
  ground.name = 'ground';
  g.add(ground);

  // Layered earth under the grass, like a cake: a cosy diorama.
  const earth = new THREE.CylinderGeometry(R, R * 0.55, 4.2, 40, 6, true);
  const ep = earth.attributes.position;
  const ec: number[] = [];
  const bands = ['#6fbf55', '#a8754a', '#8f5f3a', '#b9865a', '#7a5032', '#6a4429', '#5a3a24'].map((x) => new THREE.Color(x));
  for (let i = 0; i < ep.count; i++) {
    const y = ep.getY(i);
    const t = (2.1 - y) / 4.2;
    const idx = Math.min(bands.length - 1, Math.floor(t * bands.length * 1.02));
    const c = bands[idx].clone();
    ec.push(c.r, c.g, c.b);
    const ang = Math.atan2(ep.getZ(i), ep.getX(i));
    const wob = 1 + Math.sin(ang * 7 + y * 2) * 0.03;
    ep.setX(i, ep.getX(i) * wob);
    ep.setZ(i, ep.getZ(i) * wob);
  }
  earth.setAttribute('color', new THREE.Float32BufferAttribute(ec, 3));
  earth.computeVertexNormals();
  const earthMesh = new THREE.Mesh(earth, mat('#ffffff', { vertexColors: true }));
  earthMesh.position.y = -0.15 - 2.1;
  g.add(earthMesh);
  const bottom = new THREE.Mesh(new THREE.ConeGeometry(R * 0.55, 2.6, 18), mat('#5a3a24'));
  bottom.rotation.x = Math.PI;
  bottom.position.y = -4.35 - 1.3;
  g.add(bottom);
  // Little rocks and roots hanging under the island.
  const r = rng(3);
  for (let i = 0; i < 10; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + r() * 0.5, 0), mat(r() > 0.5 ? '#9aa3ad' : '#7d6650'));
    const ang = r() * Math.PI * 2;
    const rad = R * (0.55 + r() * 0.3);
    rock.position.set(Math.cos(ang) * rad, -3.6 - r() * 1.6, Math.sin(ang) * rad);
    g.add(rock);
  }
  return { group: g, ground };
}

/* ───────────────────────── Buildings ───────────────────────── */

export function makeCottage(): THREE.Group & { userData: { windows: THREE.Mesh[]; chimney: THREE.Vector3 } } {
  const g = new THREE.Group() as THREE.Group & { userData: { windows: THREE.Mesh[]; chimney: THREE.Vector3 } };
  const walls = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.7), mat('#fff0d8'));
  walls.position.y = 1.1;
  walls.castShadow = walls.receiveShadow = true;
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.35, 2.85), mat('#c9b8a6'));
  base.position.y = 0.17;
  const roofGeo = new THREE.CylinderGeometry(1.85, 1.85, 3.7, 3, 1, true, Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, mat('#f2766b', { side: THREE.DoubleSide }));
  roof.rotation.z = Math.PI / 2;
  roof.scale.set(1, 1, 1);
  roof.position.y = 2.2 + 0.92;
  roof.castShadow = true;
  const gable = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 3.2, 3, 1, false, Math.PI / 2), mat('#ffe6c4'));
  gable.rotation.z = Math.PI / 2;
  gable.position.y = 2.2 + 0.8;
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.8, 6), mat('#d45a50'));
  ridge.rotation.z = Math.PI / 2;
  ridge.position.y = 2.2 + 0.92 + 1.82;
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.45), mat('#c4705a'));
  chimney.position.set(0.85, 4.0, -0.4);
  // Rounded door.
  const doorMat = mat('#a0643c');
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.1), doorMat);
  door.position.set(0, 0.68, 1.36);
  const doorTop = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 14, 1, false, -Math.PI / 2, Math.PI), doorMat);
  doorTop.rotation.x = Math.PI / 2;
  doorTop.position.set(0, 1.18, 1.36);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), mat('#ffd166'));
  knob.position.set(0.25, 0.7, 1.43);
  g.add(walls, base, roof, gable, ridge, chimney, door, doorTop, knob);
  const windows: THREE.Mesh[] = [];
  for (const x of [-1.05, 1.05]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ color: '#cfeaff' }));
    w.position.set(x, 1.35, 1.36);
    const fh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.06), mat('#ffffff'));
    fh.position.set(x, 1.35, 1.38);
    const fv = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.06), mat('#ffffff'));
    fv.position.set(x, 1.35, 1.38);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.22), mat('#8a5a3a'));
    box.position.set(x, 0.95, 1.45);
    g.add(w, fh, fv, box);
    for (let k = 0; k < 3; k++) {
      const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(['#ff7ab8', '#ffd166', '#ff8a5c'][k]));
      fl.position.set(x - 0.25 + k * 0.25, 1.1, 1.5);
      g.add(fl);
    }
    windows.push(w);
    const wg = nightGlow('#ffcf6e', 1.6, 0, 0.75);
    wg.position.set(x, 1.35, 1.5);
    g.add(wg);
  }
  // Round window in the gable.
  const round = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14), new THREE.MeshBasicMaterial({ color: '#cfeaff' }));
  round.position.set(0, 2.75, 1.36);
  windows.push(round);
  const rf = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.05, 5, 14), mat('#ffffff'));
  rf.position.copy(round.position).add(new THREE.Vector3(0, 0, 0.02));
  g.add(round, rf);
  g.userData.windows = windows;
  g.userData.chimney = new THREE.Vector3(0.85, 4.7, -0.4);
  return g;
}

export function makeNest(): THREE.Group {
  const g = new THREE.Group();
  const straw = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.34, 8, 20), mat('#c48a4c'));
  straw.rotation.x = Math.PI / 2;
  straw.position.y = 0.28;
  straw.scale.z = 0.8;
  straw.castShadow = true;
  straw.receiveShadow = true;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.9, 0.18, 18), mat('#e7b77a'));
  inner.position.y = 0.12;
  const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 8), mat('#ffc4d6'));
  cushion.scale.set(1, 0.25, 1);
  cushion.position.y = 0.3;
  cushion.receiveShadow = true;
  g.add(straw, inner, cushion);
  const r = rng(9);
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.5), mat(r() > 0.5 ? '#e0b46a' : '#a8743c'));
    const a = r() * Math.PI * 2;
    s.position.set(Math.cos(a) * 1.0, 0.3 + r() * 0.25, Math.sin(a) * 1.0);
    s.rotation.set(r() - 0.5, -a, r() - 0.5);
    g.add(s);
  }
  // A little blanket with stars.
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.6), mat('#9fc6ff'));
  blanket.position.set(0.25, 0.42, -0.2);
  blanket.rotation.y = 0.4;
  g.add(blanket);
  return g;
}

/* ───────────────────────── Tree, basket, pond, swing ───────────────────────── */

export function makeAppleTree(): { group: THREE.Group; anchors: THREE.Vector3[] } {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 2.6, 8), mat('#8a5a3a'));
  trunk.position.y = 1.3;
  trunk.castShadow = true;
  g.add(trunk);
  for (const s of [-1, 1]) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), mat('#8a5a3a'));
    br.position.set(s * 0.45, 2.4, 0);
    br.rotation.z = -s * 0.7;
    g.add(br);
  }
  const blobs = [
    { p: new THREE.Vector3(0, 3.6, 0), r: 1.75, c: '#5cbf55' },
    { p: new THREE.Vector3(-1.2, 3.0, 0.3), r: 1.25, c: '#4caf50' },
    { p: new THREE.Vector3(1.25, 3.05, 0.2), r: 1.3, c: '#6ccc5e' },
    { p: new THREE.Vector3(0.2, 4.6, -0.2), r: 1.15, c: '#7dd06a' },
  ];
  for (const b of blobs) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(b.r, 1), mat(b.c));
    m.position.copy(b.p);
    m.castShadow = true;
    g.add(m);
  }
  // Where fruits hang: on the front of the foliage, facing the camera.
  const anchors: THREE.Vector3[] = [];
  const r = rng(21);
  let tries = 0;
  while (anchors.length < 14 && tries++ < 400) {
    const b = blobs[Math.floor(r() * blobs.length)];
    const a = (r() - 0.5) * 2.2;
    const y = (r() - 0.35) * 1.2;
    const dir = new THREE.Vector3(Math.sin(a), y, Math.cos(a)).normalize();
    const p = b.p.clone().addScaledVector(dir, b.r * 0.92);
    if (p.y < 2.2) continue;
    if (anchors.some((q) => q.distanceTo(p) < 0.62)) continue;
    // Not hidden inside another blob.
    if (blobs.some((o) => o !== b && o.p.distanceTo(p) < o.r * 0.85)) continue;
    anchors.push(p);
  }
  return { group: g, anchors };
}

export function makeBasket(): THREE.Group {
  const g = new THREE.Group();
  const wicker = mat('#c98b4a');
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.48, 0.55, 14, 1, true), mat('#c98b4a', { side: THREE.DoubleSide }));
  body.position.y = 0.3;
  body.castShadow = true;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 14), wicker);
  bottom.position.y = 0.05;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 6, 18), mat('#a8703a'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.57;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 16, Math.PI), mat('#a8703a'));
  handle.position.y = 0.57;
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.56 - i * 0.04, 0.025, 4, 18), mat('#e0a868'));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.18 + i * 0.14;
    g.add(band);
  }
  g.add(body, bottom, rim, handle);
  return g;
}

export function makePond(): THREE.Group & { userData: { water: THREE.Mesh } } {
  const g = new THREE.Group() as THREE.Group & { userData: { water: THREE.Mesh } };
  const R = SPOT.pondR;
  const shore = new THREE.Mesh(new THREE.CircleGeometry(R + 0.35, 32), mat('#e9d7a6'));
  shore.rotation.x = -Math.PI / 2;
  shore.position.y = 0.015;
  shore.receiveShadow = true;
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(R, 32),
    new THREE.MeshPhongMaterial({ color: '#4fc0ec', emissive: '#14507a', emissiveIntensity: 0.25, shininess: 90, specular: '#ffffff', transparent: true, opacity: 0.92, flatShading: true })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.05;
  g.add(shore, water);
  const r = rng(4);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + r() * 0.2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + r() * 0.16, 0), mat(r() > 0.5 ? '#b8c0c8' : '#9aa6b2'));
    st.position.set(Math.cos(a) * (R + 0.25), 0.1, Math.sin(a) * (R + 0.25));
    st.scale.y = 0.6;
    st.castShadow = true;
    g.add(st);
  }
  for (const [x, z, s] of [
    [-0.9, -0.8, 0.42],
    [1.0, 0.6, 0.36],
    [0.3, -1.4, 0.3],
  ]) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(s, s, 0.03, 12, 1, false, 0.3, Math.PI * 1.8), mat('#5cb85c'));
    pad.position.set(x, 0.08, z);
    g.add(pad);
  }
  const lotus = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat('#ff9fc8'));
  lotus.position.set(-0.85, 0.18, -0.78);
  g.add(lotus);
  // Reeds at the back.
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.75 + i * 0.16;
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.1 + r() * 0.5, 5), mat('#5a9a48'));
    reed.position.set(Math.cos(a) * (R + 0.1), 0.6, Math.sin(a) * (R + 0.1));
    reed.rotation.z = (r() - 0.5) * 0.3;
    const top = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 3, 6), mat('#8a5a3a'));
    top.position.set(reed.position.x, 1.25, reed.position.z);
    g.add(reed, top);
  }
  g.userData.water = water;
  return g;
}

export function makeSwing(): { group: THREE.Group; seat: THREE.Group } {
  const g = new THREE.Group();
  const wood = mat('#b07a4a');
  for (const x of [-1.1, 1.1]) {
    for (const z of [-0.5, 0.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.9, 6), wood);
      post.position.set(x, 1.4, z * 0.6);
      post.rotation.x = z * 0.35;
      post.castShadow = true;
      g.add(post);
    }
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.5, 6), wood);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 2.82;
  g.add(bar);
  const seat = new THREE.Group();
  seat.userData.noMerge = true;
  seat.position.y = 2.82;
  for (const x of [-0.42, 0.42]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.1, 4), mat('#f2e6c8'));
    rope.position.set(x, -1.05, 0);
    seat.add(rope);
  }
  const plank = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.42), mat('#ff8a7a'));
  plank.position.y = -2.1;
  plank.castShadow = true;
  seat.add(plank);
  g.add(seat);
  return { group: g, seat };
}

export function makeFence(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#f5e6cf');
  const R = SPOT.islandR - 0.5;
  for (let i = 0; i <= 26; i++) {
    const a = Math.PI * 1.08 + (i / 26) * Math.PI * 0.84;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.1), wood);
    post.position.set(Math.cos(a) * R, 0.42, Math.sin(a) * R);
    post.rotation.y = -a + Math.PI / 2;
    post.castShadow = true;
    g.add(post);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.16, 4), wood);
    tip.position.set(post.position.x, 0.92, post.position.z);
    tip.rotation.y = post.rotation.y + Math.PI / 4;
    g.add(tip);
  }
  for (const y of [0.3, 0.62]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 4, 60, Math.PI * 0.84), wood);
    rail.rotation.set(Math.PI / 2, 0, Math.PI * 1.08);
    rail.position.y = y;
    g.add(rail);
  }
  return g;
}

/** Bushes, grass tufts and little flowers around the edges. */
export function makeScatter(lowPower: boolean): THREE.Group {
  const g = new THREE.Group();
  const r = rng(31);
  const busy = [
    { p: SPOT.house, r: 3.2 },
    { p: SPOT.pond, r: SPOT.pondR + 0.8 },
    { p: SPOT.tree, r: 1.4 },
    { p: SPOT.nest, r: 1.6 },
    { p: SPOT.home, r: 2.2 },
    { p: SPOT.blanket, r: 1.6 },
    { p: SPOT.swing, r: 1.8 },
    { p: SPOT.basket, r: 1.1 },
    ...SPOT.hoops.map((p) => ({ p, r: 1.0 })),
    ...SPOT.decor.map((p) => ({ p, r: 1.0 })),
  ];
  const free = (x: number, z: number) => busy.every((b) => Math.hypot(x - b.p.x, z - b.p.z) > b.r) && Math.hypot(x, z) < SPOT.islandR - 0.8;
  const petals = ['#ff7ab8', '#ffd166', '#ffffff', '#b38cff', '#ff8a5c', '#7fd0ff'];
  let flowers = 0;
  for (let i = 0; i < (lowPower ? 60 : 120) && flowers < (lowPower ? 26 : 50); i++) {
    const x = (r() - 0.5) * 2 * SPOT.islandR;
    const z = (r() - 0.5) * 2 * SPOT.islandR;
    if (!free(x, z)) continue;
    flowers++;
    const f = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 4), mat('#4f9a3f'));
    stem.position.y = 0.16;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(petals[Math.floor(r() * petals.length)]));
    head.position.y = 0.34;
    const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), mat('#ffe08a'));
    ctr.position.set(0, 0.36, 0.06);
    f.add(stem, head, ctr);
    f.position.set(x, 0, z);
    g.add(f);
  }
  for (let i = 0; i < (lowPower ? 18 : 34); i++) {
    const a = r() * Math.PI * 2;
    const d = 6 + r() * 4.3;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (!free(x, z)) continue;
    const tuft = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.38, 3), mat('#5fae4a'));
      blade.position.set((k - 1) * 0.07, 0.19, 0);
      blade.rotation.z = (k - 1) * 0.3;
      tuft.add(blade);
    }
    tuft.position.set(x, 0, z);
    g.add(tuft);
  }
  for (const [x, z, s] of [
    [-9.2, 2.0, 1],
    [9.4, 2.6, 0.9],
    [7.8, -5.6, 1.1],
    [-4.0, -8.6, 1.0],
    [4.6, -8.8, 0.9],
    [-8.6, -4.8, 0.8],
  ]) {
    const bush = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s + k * 0.08, 1), mat(k % 2 ? '#4caf50' : '#5cbf55'));
      b.position.set((k - 1) * 0.45 * s, 0.4 * s, (k % 2) * 0.2);
      b.castShadow = true;
      bush.add(b);
    }
    bush.position.set(x, 0, z);
    g.add(bush);
  }
  return g;
}

/* ───────────────────────── Props for the cares ───────────────────────── */

export function makeFood(id: FoodId | 'pearTree'): THREE.Group {
  const g = new THREE.Group();
  const stem = () => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.12, 4), mat('#6b4226'));
    return s;
  };
  const leaf = () => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mat('#5cbf55'));
    l.scale.set(1.4, 0.35, 0.7);
    return l;
  };
  switch (id) {
    case 'apple': {
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshPhongMaterial({ color: '#e8403a', shininess: 60, flatShading: true }));
      a.scale.y = 0.92;
      const s = stem();
      s.position.y = 0.2;
      const l = leaf();
      l.position.set(0.07, 0.23, 0);
      l.rotation.z = 0.5;
      g.add(a, s, l);
      break;
    }
    case 'pear':
    case 'pearTree': {
      const m = new THREE.MeshPhongMaterial({ color: '#c8d84a', shininess: 50, flatShading: true });
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), m);
      b.position.y = -0.04;
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), m);
      t.position.y = 0.14;
      const s = stem();
      s.position.y = 0.27;
      g.add(b, t, s);
      break;
    }
    case 'cherry': {
      for (const x of [-0.09, 0.09]) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshPhongMaterial({ color: '#c8102e', shininess: 80, flatShading: true }));
        c.position.set(x, -0.05, 0);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 4), mat('#5a8a3a'));
        s.position.set(x * 0.5, 0.1, 0);
        s.rotation.z = -x * 3;
        g.add(c, s);
      }
      break;
    }
    case 'orange': {
      const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 2), mat('#ff9a2e'));
      const l = leaf();
      l.position.set(0.04, 0.2, 0);
      g.add(o, l);
      break;
    }
    case 'carrot': {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.48, 8), mat('#ff8a2e'));
      c.rotation.z = Math.PI;
      for (let i = 0; i < 3; i++) {
        const l = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 4), mat('#4caf50'));
        l.position.set((i - 1) * 0.04, 0.33, 0);
        l.rotation.z = (i - 1) * 0.4;
        g.add(l);
      }
      g.add(c);
      g.rotation.z = 0.5;
      break;
    }
    case 'potato': {
      const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), mat('#c49a5c'));
      p.scale.set(1.3, 0.85, 1);
      g.add(p);
      break;
    }
    case 'onion': {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat('#d9a066'));
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 6), mat('#d9a066'));
      t.position.y = 0.2;
      const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.2, 4), mat('#6fbf55'));
      sprout.position.y = 0.34;
      g.add(o, t, sprout);
      break;
    }
    case 'milk': {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.32, 10), mat('#ffffff'));
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.13, 0.1, 10), mat('#ffffff'));
      n.position.y = 0.21;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 10), mat('#4f8ef7'));
      cap.position.y = 0.29;
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.12, 10, 1, true), mat('#9fd0ff'));
      g.add(b, n, cap, label);
      break;
    }
    case 'egg': {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat('#fff6e6'));
      e.scale.y = 1.3;
      g.add(e);
      break;
    }
    case 'cheese': {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 3, 1, false, 0, Math.PI / 2.4), mat('#ffd24a'));
      c.position.set(-0.08, 0, -0.08);
      const hole = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), mat('#e0a92a'));
      hole.position.set(0.02, 0.06, 0.12);
      g.add(c, hole);
      break;
    }
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

export function makeBlanket(): THREE.Group {
  const g = new THREE.Group();
  const tiles = 4;
  for (let i = 0; i < tiles; i++)
    for (let j = 0; j < tiles - 1; j++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.6), mat((i + j) % 2 ? '#ff8a8a' : '#fff4ea'));
      t.position.set((i - (tiles - 1) / 2) * 0.9, 0.03, (j - (tiles - 2) / 2) * 0.6);
      t.receiveShadow = true;
      g.add(t);
    }
  return g;
}

export function makeHoop(color: string): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6), mat('#f5e6cf'));
  post.position.y = 0.35;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 8, 20), new THREE.MeshPhongMaterial({ color, shininess: 70, flatShading: true }));
  ring.position.y = 1.25;
  ring.castShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.12, 10), mat('#f5e6cf'));
  base.position.y = 0.06;
  g.add(post, ring, base);
  return g;
}

export function makeBall(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.36, 16, 12);
  const pos = geo.attributes.position;
  const cols: number[] = [];
  const seg = ['#ff5c5c', '#ffffff', '#ffd166', '#ffffff', '#4f8ef7', '#ffffff'].map((c) => new THREE.Color(c));
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getX(i), pos.getZ(i)) + Math.PI;
    const c = Math.abs(pos.getY(i)) > 0.32 ? new THREE.Color('#ffffff') : seg[Math.floor((a / (Math.PI * 2)) * 6) % 6];
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, flatShading: true }));
  m.castShadow = true;
  return m;
}

export function makeBubble(label: string): THREE.Group {
  const g = new THREE.Group();
  const b = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 14),
    new THREE.MeshPhongMaterial({ color: '#bfe9ff', emissive: '#3a7fb0', emissiveIntensity: 0.25, transparent: true, opacity: 0.5, shininess: 120, specular: '#ffffff', depthWrite: false })
  );
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }));
  shine.position.set(0.17, 0.2, 0.3);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.015, 4, 24), new THREE.MeshBasicMaterial({ color: '#ffd6f5', transparent: true, opacity: 0.7 }));
  g.add(b, shine, rim);
  if (label) {
    const t = textSprite(label, { size: 0.62, stroke: '#2b5d9a' });
    g.add(t);
  }
  return g;
}

/* ───────────────────────── Decorations ───────────────────────── */

export function makeDecor(id: DecorId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case 'flowers': {
      const cols = ['#ff7ab8', '#ffd166', '#b38cff', '#ff8a5c', '#ffffff'];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const x = Math.cos(a) * 0.35;
        const z = Math.sin(a) * 0.35;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4), mat('#4f9a3f'));
        stem.position.set(x, 0.3, z);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.06, 0.24, 6), mat(cols[i]));
        cup.position.set(x, 0.66, z);
        const lf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), mat('#5cbf55'));
        lf.position.set(x + 0.06, 0.18, z);
        lf.scale.set(0.5, 1.4, 0.3);
        g.add(stem, cup, lf);
      }
      break;
    }
    case 'mushroom': {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.6, 10), mat('#fff4e2'));
      stem.position.y = 0.3;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ff4f5e', { emissive: new THREE.Color('#ff4f5e').multiplyScalar(0.12) }));
      cap.position.y = 0.55;
      cap.scale.y = 0.8;
      g.add(stem, cap);
      const r = rng(5);
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2;
        const el = 0.3 + r() * 0.9;
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat('#ffffff'));
        d.position.set(Math.cos(a) * Math.cos(el) * 0.62, 0.55 + Math.sin(el) * 0.5, Math.sin(a) * Math.cos(el) * 0.62);
        g.add(d);
      }
      break;
    }
    case 'lantern': {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 6), mat('#6b4226'));
      post.position.y = 0.9;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), mat('#6b4226'));
      arm.position.set(0.28, 1.75, 0);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), glowMat('#ffb35c', 1.2));
      lamp.scale.y = 1.25;
      lamp.position.set(0.52, 1.38, 0);
      const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.08, 8), mat('#c4402f'));
      capT.position.set(0.52, 1.7, 0);
      const capB = capT.clone();
      capB.position.y = 1.07;
      const halo = nightGlow('#ffb35c', 2.2, 0.25, 0.95);
      halo.position.copy(lamp.position);
      g.add(post, arm, lamp, capT, capB, halo);
      break;
    }
    case 'slide': {
      const cols = ['#ff7a6b', '#ffd166', '#7fd0ff'];
      for (const x of [-0.35, 0.35]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), mat('#4f8ef7'));
        rail.position.set(x, 0.8, -0.7);
        g.add(rail);
      }
      for (let i = 0; i < 4; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.18), mat(cols[i % 3]));
        step.position.set(0, 0.3 + i * 0.36, -0.7);
        g.add(step);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.5), mat('#ffd166'));
      top.position.set(0, 1.55, -0.5);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.9), mat('#ff7a6b'));
      ramp.position.set(0, 0.85, 0.35);
      ramp.rotation.x = 0.72;
      for (const x of [-0.37, 0.37]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 1.9), mat('#ff5c5c'));
        side.position.set(x, 0.93, 0.35);
        side.rotation.x = 0.72;
        g.add(side);
      }
      g.add(top, ramp);
      g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      break;
    }
    case 'rainbow': {
      const cols = ['#ff5c5c', '#ff9a3c', '#ffd84a', '#5cd65c', '#4f9ef7', '#9b6be8'];
      cols.forEach((c, i) => {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(1.3 - i * 0.13, 0.07, 5, 24, Math.PI), mat(c, { emissive: new THREE.Color(c).multiplyScalar(0.2) }));
        arc.position.y = 0.05;
        g.add(arc);
      });
      for (const x of [-1.0, 1.0]) {
        for (let k = 0; k < 3; k++) {
          const cl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 - k * 0.04, 1), mat('#ffffff'));
          cl.position.set(x + (k - 1) * 0.22, 0.18 + (k === 1 ? 0.12 : 0), 0.05);
          g.add(cl);
        }
      }
      break;
    }
    case 'starlamp': {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6), mat('#c9a14a'));
      post.position.y = 0.8;
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), glowMat('#ffe066', 1.3));
      star.scale.set(1, 1.2, 0.45);
      star.position.y = 1.9;
      star.name = 'spin';
      const halo = nightGlow('#ffe58a', 2.4, 0.45, 1);
      halo.position.y = 1.9;
      g.add(post, star, halo);
      break;
    }
  }
  return g;
}

/** A glowing marker where a decoration can be placed (decorate mode). */
export function makeSpotMarker(): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 6, 24), glowMat('#ffe680', 1.1));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), new THREE.MeshBasicMaterial({ color: '#fff6c4', transparent: true, opacity: 0.35, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.06;
  const plus = textSprite('+', { size: 0.9, stroke: '#c48a1c' });
  plus.position.y = 0.9;
  g.add(ring, disc, plus);
  return g;
}

/** A little butterfly (two flapping wings). */
export function makeButterfly(color: string): THREE.Group & { userData: { wings: THREE.Mesh[] } } {
  const g = new THREE.Group() as THREE.Group & { userData: { wings: THREE.Mesh[] } };
  const wings: THREE.Mesh[] = [];
  const geo = new THREE.CircleGeometry(0.16, 8);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(geo, mat(color, { side: THREE.DoubleSide, emissive: new THREE.Color(color).multiplyScalar(0.2) }));
    w.position.x = s * 0.14;
    w.rotation.x = -Math.PI / 2;
    w.scale.set(1, 1.3, 1);
    const pivot = new THREE.Group();
    pivot.add(w);
    g.add(pivot);
    wings.push(pivot as unknown as THREE.Mesh);
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 3, 6), mat('#3a2a3a'));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  g.userData.wings = wings;
  return g;
}
