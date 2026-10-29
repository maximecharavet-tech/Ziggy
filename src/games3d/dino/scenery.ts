import * as THREE from 'three';
import { glow, glowTex } from '../kit/look';
import { rng } from '../kit/rng';
import { makeSky } from '../nid/garden';
import { Parts, box, col, cone, ell, stick, tf, v, type V3 } from './geo';

/**
 * The sunny dig site, built in code: warm sand, striped sandstone mesas,
 * palm trees and ferns, the explorers' tent, the wooden dig box, the blue
 * tarp, the skeleton stand, and — a little further — Ziggy's museum.
 * Static pieces are merged into a handful of meshes (few draw calls).
 */

export const SITE = {
  /** The dig box (sand) centre and size. */
  box: v(0, 0, 2.3),
  boxW: 6.4,
  boxD: 4.2,
  boxTop: 0.62,
  /** Where found bones are laid out. */
  tarp: v(0, 0.03, -1.9),
  tarpW: 8.6,
  tarpD: 2.7,
  /** The wooden stand the skeleton is rebuilt on. */
  stand: v(0, 0, -6.4),
  standW: 13.5,
  standD: 3.8,
  standTop: 0.42,
  /** Palm trees for hide-and-seek. */
  hide: [v(9.5, 0, -6.8), v(13.4, 0, -8.6), v(17.2, 0, -6.6)],
  /** The museum. */
  museum: v(40, 0, -6),
};

export interface World {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  /** Hide-and-seek palms (each one can shake). */
  hidePalms: THREE.Group[];
  /** Museum pedestal tops (world). */
  pedestals: V3[];
  /** Plaques to write the dinosaurs' names on. */
  setPlaque: (i: number, text: string) => void;
  update: (dt: number, t: number) => void;
  dispose: () => void;
}

const SAND = '#f1d39b';
const WOOD = '#b77a45';
const WOOD_DARK = '#8a5530';

function noise(x: number, z: number) {
  return Math.sin(x * 0.21 + Math.cos(z * 0.13) * 2) * Math.cos(z * 0.17 - x * 0.05) + Math.sin(x * 0.53 + z * 0.41) * 0.35;
}

/* ───────────────────────── Text on wood / stone ───────────────────────── */

function textCanvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function fitText(g: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 'bold') {
  let s = size;
  do {
    g.font = `${weight} ${s}px Fredoka, "Baloo 2", system-ui, sans-serif`;
    s -= 2;
  } while (g.measureText(text).width > maxW && s > 10);
}

/** A wooden board with burnt-in letters (and a little bone icon). */
function signTexture(text: string): THREE.CanvasTexture {
  return textCanvas(512, 200, (g) => {
    g.fillStyle = '#c98b52';
    g.fillRect(0, 0, 512, 200);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#bf8049' : '#cf935a';
      g.fillRect(0, i * 50, 512, 48);
    }
    g.strokeStyle = '#7a4a26';
    g.lineWidth = 10;
    g.strokeRect(5, 5, 502, 190);
    g.fillStyle = '#5a3216';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitText(g, text, 440, 76);
    g.fillText(text, 256, 104);
  });
}

/** The museum banner, and the brass name plates. */
function bannerTexture(text: string, bg: string, fg: string, w = 1024, h = 256, size = 120): THREE.CanvasTexture {
  return textCanvas(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.55)';
    g.lineWidth = 10;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitText(g, text, w - 90, size);
    g.fillText(text, w / 2, h / 2 + 6);
  });
}

/* ───────────────────────── Plants ───────────────────────── */

/** One palm frond: a folded, drooping leaf strip. */
function frond(P: Parts, base: V3, ang: number, len: number, rise: number, droop: number, width: number, rnd: () => number) {
  const n = 9;
  const dir = v(Math.cos(ang), 0, Math.sin(ang));
  const side = v(-dir.z, 0, dir.x);
  const pos: number[] = [];
  const idx: number[] = [];
  const pt = (t: number) => base.clone().addScaledVector(dir, len * t).add(v(0, rise * Math.sin(t * Math.PI * 0.55) - droop * t * t, 0));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = pt(t);
    const w = width * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.06)) * (1 - t * 0.3);
    const fold = w * 0.35;
    for (const s of [-1, 0, 1]) {
      const p = c.clone().addScaledVector(side, s * w).add(v(0, s === 0 ? 0.02 : -fold, 0));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < n; i++)
    for (let k = 0; k < 2; k++) {
      const a = i * 3 + k;
      idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const tone = rnd() * 0.12;
  P.add(g, (p) => {
    const t = Math.min(1, p.clone().sub(base).length() / len);
    return col('#2f7f3a').lerp(col('#7ccf4c'), t * 0.8 + tone);
  });
}

/** A palm tree: a ringed, leaning trunk, a crown of fronds and coconuts. */
function palm(trunkP: Parts, leafP: Parts, at: V3, height: number, lean: number, dirA: number, seed: number) {
  const r = rng(seed);
  const segs = 9;
  const dir = v(Math.cos(dirA), 0, Math.sin(dirA));
  let prev = at.clone();
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const p = at.clone().addScaledVector(dir, lean * t * t * height * 0.35).add(v(0, height * t, 0));
    const rr = 0.24 - 0.09 * t;
    stick(trunkP, prev, p, rr * 1.12, rr * 0.92, i % 2 ? '#a8743f' : '#8c5c31', 8);
    prev = p;
  }
  const top = prev;
  ell(trunkP, top, v(0.3, 0.22, 0.3), '#6f8a32', [0, 0, 0], 10);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + r();
    ell(trunkP, top.clone().add(v(Math.cos(a) * 0.2, -0.22, Math.sin(a) * 0.2)), v(0.16, 0.18, 0.16), '#7a4a22', [0, 0, 0], 10);
  }
  const count = 8;
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + r() * 0.4;
    frond(leafP, top.clone().add(v(0, 0.08, 0)), a, 2.2 + r() * 0.7, 0.45 + r() * 0.2, 1.4 + r() * 0.5, 0.42, r);
  }
}

/** A round fern bush (the hide-and-seek bushes are big ones). */
function bush(leafP: Parts, solidP: Parts, at: V3, size: number, seed: number) {
  const r = rng(seed);
  for (let k = 0; k < 4; k++) {
    const a = r() * Math.PI * 2;
    ell(solidP, at.clone().add(v(Math.cos(a) * size * 0.35, size * (0.35 + r() * 0.25), Math.sin(a) * size * 0.3)), v(size * 0.55, size * 0.45, size * 0.5), r() > 0.5 ? '#4f9a3c' : '#5fae45', [0, r(), 0], 10);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + r() * 0.3;
    frond(leafP, at.clone().add(v(0, size * 0.25, 0)), a, size * (1.0 + r() * 0.35), size * 0.75, size * 0.7, size * 0.2, r);
  }
}

function cactus(P: Parts, at: V3, s: number, seed: number) {
  const r = rng(seed);
  const ribs = (p: V3) => {
    const a = Math.atan2(p.z - at.z, p.x - at.x);
    return Math.sin(a * 8) > 0.2 ? col('#3e9a52') : col('#4fb562');
  };
  ell(P, at.clone().add(v(0, 0.42 * s, 0)), v(0.36 * s, 0.45 * s, 0.36 * s), ribs, [0, 0, 0], 16);
  if (r() > 0.4) {
    ell(P, at.clone().add(v(0.32 * s, 0.6 * s, 0)), v(0.16 * s, 0.24 * s, 0.16 * s), ribs, [0, 0, -0.5], 10);
  }
  for (let i = 0; i < 3; i++) ell(P, at.clone().add(v((i - 1) * 0.1 * s, 0.88 * s, 0)), v(0.08 * s, 0.06 * s, 0.08 * s), i === 1 ? '#ffd166' : '#ff7ab8', [0, 0, 0], 8);
}

function rock(P: Parts, at: V3, s: number, seed: number) {
  const r = rng(seed);
  const g = new THREE.DodecahedronGeometry(1, 0);
  P.add(g, r() > 0.5 ? '#d39a62' : '#c48555', tf(at.clone().add(v(0, s * 0.3, 0)), [r(), r() * 3, r()], v(s * (1 + r() * 0.4), s * 0.65, s)));
}

/** A striped sandstone mesa (layers of red, orange and cream). */
function mesa(P: Parts, at: V3, radius: number, height: number, seed: number) {
  const r = rng(seed);
  const g = new THREE.CylinderGeometry(radius * 0.86, radius, height, 9, 7, false);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const jit: number[] = Array.from({ length: 9 }, () => 0.82 + r() * 0.3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = Math.round(((a + Math.PI) / (Math.PI * 2)) * 9) % 9;
    const y = pos.getY(i);
    const w = jit[k] * (1 + Math.sin(y * 1.7 + k) * 0.04);
    pos.setX(i, x * w);
    pos.setZ(i, z * w);
  }
  g.computeVertexNormals();
  const bands = ['#c0603a', '#de8a4f', '#f0b06a', '#d4733f', '#f5c98c', '#e39a58', '#cf6c3e'].map(col);
  P.add(g, (p, n) => {
    if (n.y > 0.8) return col('#e8a862');
    const t = (p.y - at.y) / height;
    return bands[Math.min(bands.length - 1, Math.max(0, Math.floor(t * bands.length * 1.3) % bands.length))].clone();
  }, tf(at.clone().add(v(0, height / 2 - 0.5, 0)), [0, r() * 3, 0]));
}

/* ───────────────────────── The world ───────────────────────── */

export function buildWorld(scene: THREE.Scene, opts: { lowPower: boolean; locale: string }): World {
  const fr = opts.locale === 'fr';
  const group = new THREE.Group();
  scene.add(group);
  const disposables: { dispose: () => void }[] = [];

  /* Sky, light, fog */
  const sky = makeSky();
  sky.material.uniforms.top.value.set('#47a8f5');
  sky.material.uniforms.bottom.value.set('#ffe6b5');
  sky.material.uniforms.below.value.set('#f4cf96');
  group.add(sky);
  scene.fog = new THREE.Fog('#f7dcaa', 55, 150);
  const hemi = new THREE.HemisphereLight('#d8ecff', '#e2b47a', 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d2', 2.5);
  sun.position.set(14, 22, 12);
  sun.castShadow = true;
  const sm = opts.lowPower ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(5, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff7d8').multiplyScalar(1.2), fog: false, toneMapped: false }));
  sunDisc.position.set(55, 62, -110);
  sunDisc.lookAt(0, 0, 0);
  const sunGlow = glow('#ffe7a8', 70, 0.55);
  (sunGlow.material as THREE.SpriteMaterial).fog = false;
  sunGlow.position.copy(sunDisc.position);
  group.add(sunDisc, sunGlow);

  /* Ground: warm sand, flat around the site, dunes further away */
  const gsize = 280;
  const gseg = opts.lowPower ? 70 : 110;
  const gg = new THREE.PlaneGeometry(gsize, gsize, gseg, gseg);
  gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position as THREE.BufferAttribute;
  const gcols: number[] = [];
  const sandA = col('#f6dcaa');
  const sandB = col('#e8bd7c');
  const sandC = col('#dca869');
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i);
    const z = gp.getZ(i);
    const d = Math.max(Math.abs(x - 12) / 34, Math.abs(z + 4) / 22);
    const k = Math.max(0, Math.min(1, d - 1));
    const y = (noise(x, z) * 1.6 + 1.2) * k * k * 2.2 + Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.03;
    gp.setY(i, y);
    const n = noise(x * 2.3, z * 2.1);
    const c = sandA.clone().lerp(sandB, 0.35 + n * 0.25).lerp(sandC, Math.min(0.6, k * 0.5));
    gcols.push(c.r, c.g, c.b);
  }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(gcols, 3));
  gg.computeVertexNormals();
  gg.deleteAttribute('uv');
  const ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  /* Merged static pieces */
  const flatCast = new Parts();
  const flatNo = new Parts();
  const smooth = new Parts();
  const leaves = new Parts();
  const r = rng(42);

  // Mesas on the horizon (behind and on the sides).
  const mesas: [number, number, number, number][] = [
    [-46, -62, 10, 13],
    [-18, -74, 13, 17],
    [16, -70, 9, 11],
    [44, -58, 12, 15],
    [70, -40, 9, 12],
    [-72, -30, 11, 10],
    [-58, 14, 7, 7],
    [82, 6, 8, 9],
    [30, -88, 8, 22],
  ];
  mesas.forEach(([x, z, rad, h], i) => mesa(flatNo, v(x, 0, z), rad, h, i + 3));
  // A natural arch, far away.
  for (const s of [-1, 1]) mesa(flatNo, v(-30 + s * 6, 0, -52), 2.6, 9, 20 + s);
  const arch = new THREE.TorusGeometry(6, 1.8, 6, 14, Math.PI);
  flatNo.add(arch, (p) => (Math.sin(p.y * 1.5) > 0 ? col('#d97a45') : col('#e9a35f')), tf(v(-30, 8.2, -52), [0, 0, 0], v(1, 0.55, 0.8)));

  // Rocks and cacti around the site.
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = 14 + r() * 26;
    const x = Math.cos(a) * d + 6;
    const z = Math.sin(a) * d * 0.7 - 6;
    if (Math.abs(x - SITE.museum.x) < 14 && Math.abs(z - SITE.museum.z) < 9) continue;
    rock(flatCast, v(x, 0, z), 0.4 + r() * 0.9, i);
  }
  for (const [x, z, s] of [
    [-7.5, 5.5, 1],
    [6.8, 6.2, 0.8],
    [-12.5, -9, 1.2],
    [21, 1.5, 1],
    [-6, -12.5, 0.9],
    [24, -12, 1.1],
  ] as const)
    cactus(smooth, v(x, 0, z), s, Math.round(x * 7 + z));

  // Palm trees and ferns.
  const palms: [number, number, number, number, number][] = [
    [-9.5, -9.5, 6.2, 0.6, 0.3],
    [-13, -4.5, 5.2, 0.8, 2.6],
    [9.5, 3.5, 5.6, 0.7, -0.4],
    [-9, 7.5, 5.0, 0.9, 2.2],
    [6.5, -12.5, 6.8, 0.4, 1.4],
    [-3, -14, 5.8, 0.5, 1.9],
    [21, -10, 6, 0.6, 2.8],
    [30, -2, 5.4, 0.8, 0.6],
    [50, -3, 5.6, 0.7, 2.5],
    [29, -12, 6.4, 0.5, 0.2],
  ];
  palms.forEach(([x, z, h, lean, a], i) => palm(smooth, leaves, v(x, 0, z), h, lean, a, 100 + i));
  for (const [x, z, s] of [
    [-8.2, -8.2, 1.2],
    [-11.8, -3.6, 1.0],
    [8.5, 4.6, 1.0],
    [-4.2, -12.6, 1.1],
    [7.7, -11.4, 1.3],
    [20, -8.6, 1.1],
    [-8, 8.6, 0.9],
  ] as const)
    bush(leaves, smooth, v(x, 0, z), s, Math.round(x * 13 + z * 3));

  /* The explorers' tent, a table and crates */
  {
    const at = v(-10.5, 0, -1.5);
    const rot = 0.7;
    const T = new THREE.Group();
    const tentP = new Parts();
    const g = new THREE.CylinderGeometry(1.7, 1.7, 3.6, 3, 8, false);
    tentP.add(g, (p) => (Math.floor((p.z + 1.8) / 0.45) % 2 ? col('#f28f3b') : col('#fff1d6')), tf(v(0, 0.85, 0), [Math.PI / 2, 0, Math.PI], v(1.15, 1, 1)));
    // Dark doorway.
    const door = new THREE.Shape();
    door.moveTo(-0.7, 0);
    door.lineTo(0, 1.55);
    door.lineTo(0.7, 0);
    door.closePath();
    tentP.add(new THREE.ShapeGeometry(door), '#6a3a1e', tf(v(0, 0.01, 1.82)));
    stick(tentP, v(0, 0, 1.95), v(0, 2.6, 1.95), 0.05, 0.05, WOOD_DARK, 6);
    stick(tentP, v(0, 0, -1.95), v(0, 2.6, -1.95), 0.05, 0.05, WOOD_DARK, 6);
    for (const s of [-1, 1]) {
      stick(tentP, v(0, 2.55, 1.95), v(s * 1.6, 0, 2.9), 0.015, 0.015, '#efe3c8', 4);
      stick(tentP, v(0, 2.55, -1.95), v(s * 1.6, 0, -2.9), 0.015, 0.015, '#efe3c8', 4);
    }
    // Camp table with a big book and a magnifying glass.
    box(tentP, v(2.6, 0.75, 1.3), v(1.4, 0.08, 0.9), WOOD);
    for (const [x, z] of [
      [2.0, 0.95],
      [3.2, 0.95],
      [2.0, 1.65],
      [3.2, 1.65],
    ])
      stick(tentP, v(x, 0, z), v(x, 0.72, z), 0.04, 0.04, WOOD_DARK, 5);
    box(tentP, v(2.4, 0.84, 1.3), v(0.6, 0.08, 0.44), '#3f7fe0', [0, 0.2, 0]);
    box(tentP, v(2.4, 0.885, 1.3), v(0.56, 0.02, 0.4), '#fff7e6', [0, 0.2, 0]);
    const lens = new THREE.TorusGeometry(0.13, 0.025, 6, 16);
    tentP.add(lens, '#c9a227', tf(v(2.95, 0.81, 1.25), [Math.PI / 2, 0, 0]));
    stick(tentP, v(3.06, 0.81, 1.37), v(3.25, 0.81, 1.6), 0.025, 0.025, WOOD_DARK, 5);
    const mesh = new THREE.Mesh(tentP.build(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    T.add(mesh);
    T.position.copy(at);
    T.rotation.y = rot;
    group.add(T);
  }
  // Crates (with brushes) and a stack near the tent.
  for (const [x, z, s, a] of [
    [-7.8, 1.0, 0.9, 0.3],
    [-8.9, 1.6, 0.75, -0.2],
    [-8.4, 1.4, 0.6, 0.6],
    [4.9, -0.1, 0.8, -0.3],
  ] as const) {
    const y = x === -8.4 ? 0.75 + 0.3 : s / 2;
    box(flatCast, v(x, y, z), v(s, s, s), WOOD, [0, a, 0]);
    box(flatCast, v(x, y, z), v(s * 1.02, s * 0.14, s * 1.02), WOOD_DARK, [0, a, 0]);
  }
  for (let i = 0; i < 3; i++) {
    const at = v(4.65 + i * 0.22, 0.85, -0.2 + i * 0.05);
    stick(flatCast, at, at.clone().add(v(0.05, 0, 0.45)), 0.03, 0.03, ['#e2453c', '#3f7fe0', '#ffcc33'][i], 6);
    box(flatCast, at.clone().add(v(0.06, 0, 0.55)), v(0.12, 0.08, 0.16), '#f3e3b8');
  }

  /* The dig box: boards, corner posts with pennants, grid strings, tools */
  const B = SITE.box;
  const hw = SITE.boxW / 2;
  const hd = SITE.boxD / 2;
  const bt = 0.2;
  const bh = SITE.boxTop + 0.12;
  for (const s of [-1, 1]) {
    box(flatCast, v(B.x, bh / 2, B.z + s * (hd + bt / 2)), v(SITE.boxW + bt * 2, bh, bt), WOOD);
    box(flatCast, v(B.x + s * (hw + bt / 2), bh / 2, B.z), v(bt, bh, SITE.boxD), WOOD);
    box(flatCast, v(B.x, bh + 0.02, B.z + s * (hd + bt / 2)), v(SITE.boxW + bt * 2 + 0.06, 0.06, bt + 0.06), WOOD_DARK);
    box(flatCast, v(B.x + s * (hw + bt / 2), bh + 0.02, B.z), v(bt + 0.06, 0.06, SITE.boxD + 0.06), WOOD_DARK);
  }
  const flags: THREE.Mesh[] = [];
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.32, 0, 0.55, -0.16, 0], 3));
  flagGeo.computeVertexNormals();
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([sx, sz], i) => {
    const at = v(B.x + sx * (hw + bt / 2), 0, B.z + sz * (hd + bt / 2));
    stick(flatCast, at, at.clone().add(v(0, 1.45, 0)), 0.045, 0.04, WOOD_DARK, 6);
    const f = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: i % 2 ? '#ffcc33' : '#e2453c', side: THREE.DoubleSide }));
    f.position.copy(at).add(v(0, 1.42, 0));
    f.castShadow = true;
    flags.push(f);
    group.add(f);
  });
  // Archaeologists' grid strings.
  for (const k of [-1 / 3, 1 / 3]) box(flatNo, v(B.x + k * SITE.boxW, bh + 0.07, B.z), v(0.025, 0.025, SITE.boxD + bt * 2), '#fffdf2');
  box(flatNo, v(B.x, bh + 0.07, B.z), v(SITE.boxW + bt * 2, 0.025, 0.025), '#fffdf2');
  // A bucket, a sieve, a shovel in a little heap of dug sand.
  {
    const at = v(-4.4, 0, 4.9);
    const bucket = new THREE.CylinderGeometry(0.3, 0.23, 0.5, 14, 1, true);
    smooth.add(bucket, '#3f7fe0', tf(at.clone().add(v(0, 0.25, 0))));
    smooth.add(new THREE.CircleGeometry(0.23, 14), '#2f5fb0', tf(at.clone().add(v(0, 0.02, 0)), [-Math.PI / 2, 0, 0]));
    smooth.add(new THREE.TorusGeometry(0.29, 0.018, 5, 16, Math.PI), '#c0c6d0', tf(at.clone().add(v(0, 0.48, 0)), [0, 0.4, 0]));
    ell(smooth, at.clone().add(v(0, 0.42, 0)), v(0.26, 0.06, 0.26), SAND);
    const sieve = v(-3.4, 0, 5.3);
    smooth.add(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 18, 1, true), WOOD, tf(sieve.clone().add(v(0, 0.08, 0)), [0.25, 0, 0]));
    smooth.add(new THREE.CircleGeometry(0.41, 18), '#c8ccd2', tf(sieve.clone().add(v(0, 0.06, 0)), [-Math.PI / 2 + 0.25, 0, 0]));
    const heap = v(5.6, 0, 4.4);
    ell(smooth, heap, v(1.3, 0.65, 1.1), SAND, [0, 0.4, 0], 16);
    ell(smooth, heap.clone().add(v(1.1, 0, 0.7)), v(0.8, 0.4, 0.7), SAND, [0, 0.4, 0], 14);
    stick(flatCast, heap.clone().add(v(-0.2, 0.4, 0)), heap.clone().add(v(-0.45, 1.7, 0.1)), 0.04, 0.04, WOOD_DARK, 6);
    box(flatCast, heap.clone().add(v(-0.13, 0.25, 0)), v(0.32, 0.4, 0.05), '#9aa3ad', [0, 0, -0.18]);
    // A wheelbarrow.
    const wb = v(6.8, 0, 1.6);
    box(flatCast, wb.clone().add(v(0, 0.62, 0)), v(1.3, 0.36, 0.85), '#e2453c', [0, 0.5, 0]);
    ell(smooth, wb.clone().add(v(0, 0.82, 0)), v(0.55, 0.12, 0.34), SAND, [0, 0.5, 0], 12);
    smooth.add(new THREE.TorusGeometry(0.22, 0.07, 6, 14), '#2b2b3a', tf(wb.clone().add(v(0.58, 0.24, -0.33)), [0, 0.5, 0]));
    for (const s of [-1, 1]) stick(flatCast, wb.clone().add(v(-0.3 - 0.15 * s, 0.5, s * 0.33)), wb.clone().add(v(-1.2 - 0.15 * s, 0.6, s * 0.6)), 0.03, 0.03, WOOD_DARK, 5);
  }

  /* The tarp for the found bones */
  {
    const T = SITE.tarp;
    const tg = new THREE.PlaneGeometry(SITE.tarpW, SITE.tarpD, 16, 6);
    tg.rotateX(-Math.PI / 2);
    const tp = tg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) tp.setY(i, Math.sin(tp.getX(i) * 2.3) * Math.cos(tp.getZ(i) * 3.1) * 0.012);
    tg.computeVertexNormals();
    flatNo.add(tg, (p) => (Math.abs(p.x - T.x) > SITE.tarpW / 2 - 0.12 || Math.abs(p.z - T.z) > SITE.tarpD / 2 - 0.12 ? col('#2f6fc4') : col('#4f9bf0')), tf(T));
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      ell(flatNo, T.clone().add(v((sx * SITE.tarpW) / 2, 0.02, (sz * SITE.tarpD) / 2)), v(0.09, 0.06, 0.09), '#c0c6d0', [0, 0, 0], 8);
  }

  /* The skeleton stand: a wooden stage with steps and metal supports */
  {
    const S = SITE.stand;
    const H = SITE.standTop;
    box(flatCast, v(S.x, H / 2, S.z), v(SITE.standW, H, SITE.standD), (p, n) => (n.y > 0.5 ? (Math.floor((p.x + 20) / 0.8) % 2 ? col('#c88a52') : col('#bd8049')) : col(WOOD_DARK)));
    box(flatCast, v(S.x, H / 4, S.z + SITE.standD / 2 + 0.3), v(3, H / 2, 0.6), WOOD);
    // A little sign on the front.
  }

  /* Museum: a stone floor, columns, a roof, a banner, pedestals, ropes */
  const M = SITE.museum;
  const pedestals: V3[] = [];
  const plaqueMats: THREE.MeshBasicMaterial[] = [];
  const plaqueMeshes: THREE.Mesh[] = [];
  {
    const W = 26;
    const D = 12;
    box(flatCast, v(M.x, 0.25, M.z), v(W, 0.5, D), (p, n) => (n.y > 0.5 ? ((Math.floor((p.x + 100) / 1.6) + Math.floor((p.z + 100) / 1.6)) % 2 ? col('#f3e6cc') : col('#e6d4b0')) : col('#cdb892')));
    box(flatCast, v(M.x, 0.12, M.z + D / 2 + 0.4), v(W - 2, 0.24, 0.8), '#e6d4b0');
    // Back wall and columns.
    box(flatCast, v(M.x, 3.6, M.z - D / 2 + 0.3), v(W, 6.2, 0.5), '#f5ead2');
    for (let i = 0; i < 7; i++) {
      const x = M.x - W / 2 + 1.2 + (i * (W - 2.4)) / 6;
      const z = M.z - D / 2 + 1.1;
      smooth.add(new THREE.CylinderGeometry(0.42, 0.48, 6, 14), (p) => (Math.sin(Math.atan2(p.z - z, p.x - x) * 10) > 0 ? col('#fbf3e2') : col('#ece0c6')), tf(v(x, 3.5, z)));
      box(flatCast, v(x, 0.65, z), v(1.2, 0.3, 1.2), '#e6d4b0');
      box(flatCast, v(x, 6.55, z), v(1.2, 0.3, 1.2), '#e6d4b0');
    }
    box(flatCast, v(M.x, 7.0, M.z - D / 2 + 1.0), v(W + 0.6, 0.6, 2.6), '#efe1c3');
    const ped = new THREE.CylinderGeometry(W / 2 + 0.3, W / 2 + 0.3, 2.4, 3, 1);
    flatCast.add(ped, '#f3e6cc', tf(v(M.x, 8.1, M.z - D / 2 + 1.0), [Math.PI / 2, 0, Math.PI / 2], v(1, 1, 0.18)));
    // Pedestals (up to 3).
    for (let i = 0; i < 3; i++) {
      const x = M.x + (i - 1) * 8;
      const z = M.z - 0.5;
      box(flatCast, v(x, 0.5 + 0.35, z), v(5.6, 0.7, 3.2), '#d6c39d');
      box(flatCast, v(x, 0.5 + 0.72, z), v(5.9, 0.08, 3.5), '#bfa77c');
      pedestals.push(v(x, 1.26, z));
      const pm = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
      plaqueMats.push(pm);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), pm);
      pl.position.set(x, 0.86, z + 1.61);
      pl.visible = false;
      plaqueMeshes.push(pl);
      group.add(pl);
    }
    // Velvet ropes on brass posts.
    for (let i = 0; i < 6; i++) {
      const x = M.x - 11 + i * 4.4;
      const z = M.z + 3.6;
      stick(smooth, v(x, 0.5, z), v(x, 1.5, z), 0.06, 0.06, '#d9a927', 8);
      ell(smooth, v(x, 1.55, z), v(0.1, 0.1, 0.1), '#e8bd3a', [0, 0, 0], 8);
      if (i < 5) {
        const curve = new THREE.QuadraticBezierCurve3(v(x, 1.4, z), v(x + 2.2, 1.0, z), v(x + 4.4, 1.4, z));
        smooth.add(new THREE.TubeGeometry(curve, 10, 0.045, 5, false), '#c2334a');
      }
    }
    // Banner.
    const bannerTex = bannerTexture(fr ? 'Musée de Ziggy' : 'Ziggy’s Museum', '#c2334a', '#fff6dc');
    disposables.push(bannerTex);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.75), new THREE.MeshBasicMaterial({ map: bannerTex, toneMapped: false }));
    banner.position.set(M.x, 5.0, M.z - D / 2 + 0.6);
    group.add(banner);
    // Hanging pennants in rainbow colours.
    const pen = new THREE.BufferGeometry();
    pen.setAttribute('position', new THREE.Float32BufferAttribute([-0.25, 0, 0, 0.25, 0, 0, 0, -0.5, 0], 3));
    pen.computeVertexNormals();
    for (let i = 0; i < 18; i++) {
      const x = M.x - 11.5 + i * 1.35;
      const y = 6.2 - Math.sin((i / 17) * Math.PI) * 0.7;
      flatNo.add(pen.clone(), ['#e2453c', '#ffcc33', '#3fbf6a', '#3f7fe0', '#9b6be8', '#ff7ab8'][i % 6], tf(v(x, y, M.z - D / 2 + 1.9)));
    }
    pen.dispose();
  }

  /* A signpost at the dig */
  const signTex = signTexture(fr ? 'Fouilles de Ziggy' : 'Ziggy’s Dig');
  disposables.push(signTex);
  {
    const at = v(-4.6, 0, -0.2);
    stick(flatCast, at, at.clone().add(v(0, 2.0, 0)), 0.07, 0.07, WOOD_DARK, 6);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.78), new THREE.MeshLambertMaterial({ map: signTex }));
    board.position.copy(at).add(v(0, 1.75, 0.08));
    board.rotation.y = 0.35;
    board.castShadow = true;
    group.add(board);
  }

  /* Hide-and-seek palms with big fern bushes (separate: they shake) */
  const hidePalms: THREE.Group[] = SITE.hide.map((at, i) => {
    const tP = new Parts();
    const lP = new Parts();
    palm(tP, lP, v(), 5.4 + i * 0.4, 0.5, 1.2 + i, 300 + i);
    bush(lP, tP, v(0, 0, 0.35), 1.9, 400 + i);
    const g = new THREE.Group();
    const m1 = new THREE.Mesh(tP.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    const m2 = new THREE.Mesh(lP.build(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    m1.castShadow = m2.castShadow = true;
    m1.receiveShadow = true;
    g.add(m1, m2);
    g.position.copy(at);
    g.userData.home = at.clone();
    group.add(g);
    return g;
  });

  /* Build the merged meshes */
  const addMerged = (P: Parts, m: THREE.Material, cast: boolean) => {
    const mesh = new THREE.Mesh(P.build(), m);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  addMerged(flatCast, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), true);
  addMerged(flatNo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), false);
  addMerged(smooth, new THREE.MeshLambertMaterial({ vertexColors: true }), true);
  addMerged(leaves, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), true);

  /* Life: clouds, birds (dinosaurs' grandchildren!), floating dust */
  const clouds = new THREE.Group();
  {
    const cP = new Parts();
    const cr = rng(9);
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * 0.9 + (i / 8) * Math.PI * 1.1 + cr() * 0.2;
      const d = 70 + cr() * 30;
      const c = v(Math.cos(a) * d + 10, 26 + cr() * 14, Math.sin(a) * d * 0.8 - 20);
      for (let k = 0; k < 5; k++) ell(cP, c.clone().add(v((k - 2) * 3.2, cr() * 1.5, cr() * 2)), v(3 + cr() * 2.5, 2 + cr(), 2.6), '#ffffff', [0, 0, 0], 10);
    }
    const cm = new THREE.Mesh(cP.build(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#fff3dc', emissiveIntensity: 0.45, fog: false }));
    clouds.add(cm);
    group.add(clouds);
  }
  const birds: THREE.Group[] = [];
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.9, 0, -0.35, 0, 0, -0.25, 0, 0, 0, 0, 0, -0.25, 0.9, 0, -0.35], 3));
  birdGeo.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: '#4a3a5a', side: THREE.DoubleSide });
  for (let i = 0; i < (opts.lowPower ? 3 : 5); i++) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(birdGeo, birdMat);
    g.add(m);
    g.userData = { phase: i * 1.3, radius: 18 + i * 4, height: 15 + (i % 3) * 3, speed: 0.12 + i * 0.015 };
    birds.push(g);
    group.add(g);
  }
  const dustN = opts.lowPower ? 60 : 140;
  const dustPos = new Float32Array(dustN * 3);
  const dr = rng(5);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (dr() - 0.5) * 34;
    dustPos[i * 3 + 1] = 0.3 + dr() * 5;
    dustPos[i * 3 + 2] = (dr() - 0.5) * 22 - 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: glowTex(), color: '#fff2c8', size: 0.16, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  group.add(dust);

  const shake = new Map<THREE.Group, number>();
  (hidePalms as (THREE.Group & { shake?: () => void })[]).forEach((p) => {
    p.userData.shake = () => shake.set(p, 1);
  });

  return {
    group,
    sun,
    hemi,
    hidePalms,
    pedestals,
    setPlaque(i, text) {
      const pm = plaqueMats[i];
      if (!pm) return;
      pm.map?.dispose();
      const t = bannerTexture(text, '#b8892d', '#fffbea', 640, 136, 84);
      pm.map = t;
      pm.needsUpdate = true;
      plaqueMeshes[i].visible = true;
    },
    update(dt, t) {
      clouds.position.x = Math.sin(t * 0.01) * 8;
      for (const b of birds) {
        const u = b.userData as { phase: number; radius: number; height: number; speed: number };
        const a = t * u.speed + u.phase;
        b.position.set(Math.cos(a) * u.radius + 6, u.height + Math.sin(t * 0.7 + u.phase) * 0.8, Math.sin(a) * u.radius * 0.6 - 14);
        b.rotation.y = -a;
        const m = b.children[0] as THREE.Mesh;
        m.scale.y = 1;
        m.rotation.z = 0;
        m.scale.x = 0.9 + Math.sin(t * 7 + u.phase) * 0.25;
        m.position.y = Math.sin(t * 7 + u.phase) * 0.08;
      }
      flags.forEach((f, i) => (f.rotation.y = Math.sin(t * 3 + i) * 0.35 - 0.6));
      const dp = dust.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < dustN; i++) {
        dustPos[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.15 + dt * 0.12;
        dustPos[i * 3 + 1] += Math.sin(t * 0.5 + i * 0.7) * dt * 0.05;
        if (dustPos[i * 3] > 17) dustPos[i * 3] = -17;
      }
      dp.needsUpdate = true;
      for (const [p, k] of shake) {
        const nk = Math.max(0, k - dt * 1.6);
        p.rotation.z = Math.sin(t * 30) * 0.05 * nk;
        p.rotation.x = Math.cos(t * 26) * 0.03 * nk;
        if (nk <= 0) shake.delete(p);
        else shake.set(p, nk);
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      birdGeo.dispose();
      flagGeo.dispose();
    },
  };
}
