import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TOPPING_INFO, fracGlyph, type Order, type ToppingId } from './logic';
import { EMOJI_FONT, canvasSprite, canvasTex, roundRect } from './util';

/**
 * The pizza and everything that goes on it, built in code: low-poly
 * toppings with baked vertex colours (one shared material), the dough, the
 * sauce, a crust that turns golden in the oven, slice lines and little
 * numbered flags for fraction orders.
 */

/* ───────────────────────── Toppings ───────────────────────── */

function paint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

function merged(parts: [THREE.BufferGeometry, THREE.ColorRepresentation][]): THREE.BufferGeometry {
  const g = mergeGeometries(parts.map(([geo, c]) => paint(geo, c)), false)!;
  g.computeBoundingSphere();
  return g;
}

function mushroomShape(s: number): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(-0.032 * s, -0.075 * s);
  sh.lineTo(0.032 * s, -0.075 * s);
  sh.lineTo(0.03 * s, -0.005 * s);
  sh.absellipse(0, 0, 0.085 * s, 0.065 * s, 0, Math.PI, false, 0);
  sh.lineTo(-0.03 * s, -0.005 * s);
  sh.closePath();
  return sh;
}

function buildTopping(t: ToppingId | 'char'): THREE.BufferGeometry {
  switch (t) {
    case 'tomato': {
      const skin = new THREE.CylinderGeometry(0.085, 0.085, 0.024, 16);
      const flesh = new THREE.CylinderGeometry(0.064, 0.064, 0.03, 16);
      const parts: [THREE.BufferGeometry, string][] = [
        [skin, '#d8291f'],
        [flesh, '#ff5a46'],
      ];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const seed = new THREE.SphereGeometry(0.012, 5, 3).scale(1, 0.5, 1.6).rotateY(-a).translate(Math.cos(a) * 0.036, 0.016, Math.sin(a) * 0.036);
        parts.push([seed, '#ffe08a']);
      }
      parts.push([new THREE.CylinderGeometry(0.014, 0.014, 0.032, 6), '#ffd0c4']);
      return merged(parts);
    }
    case 'mushroom': {
      const outer = new THREE.ExtrudeGeometry(mushroomShape(1.08), { depth: 0.018, bevelEnabled: false, curveSegments: 10 }).rotateX(-Math.PI / 2).translate(0, 0, 0);
      const inner = new THREE.ExtrudeGeometry(mushroomShape(0.86), { depth: 0.024, bevelEnabled: false, curveSegments: 10 }).rotateX(-Math.PI / 2).translate(0, 0, -0.004);
      return merged([
        [outer, '#a8774d'],
        [inner, '#f1dcbd'],
      ]);
    }
    case 'olive':
      return merged([[new THREE.TorusGeometry(0.044, 0.021, 8, 16).rotateX(Math.PI / 2).translate(0, 0.016, 0), '#2a2230']]);
    case 'pepper': {
      const ring = new THREE.TorusGeometry(0.068, 0.017, 6, 18, Math.PI * 1.75).rotateX(Math.PI / 2).scale(1, 1, 0.78).translate(0, 0.016, 0);
      return merged([[ring, '#36a83a']]);
    }
    case 'pineapple': {
      const chunk = new THREE.BoxGeometry(0.1, 0.045, 0.075).translate(0, 0.024, 0);
      const top = new THREE.BoxGeometry(0.084, 0.012, 0.06).translate(0, 0.05, 0);
      return merged([
        [chunk, '#ffc42e'],
        [top, '#ffe27a'],
      ]);
    }
    case 'cheese': {
      const blob = new THREE.SphereGeometry(0.085, 14, 8).scale(1, 0.3, 1).translate(0, 0.014, 0);
      const shine = new THREE.SphereGeometry(0.05, 10, 6).scale(1, 0.3, 1).translate(-0.018, 0.026, -0.015);
      return merged([
        [blob, '#fff6e2'],
        [shine, '#ffffff'],
      ]);
    }
    case 'basil': {
      const leaf = new THREE.SphereGeometry(0.06, 10, 6).scale(1.55, 0.14, 0.82).translate(0, 0.014, 0);
      const vein = new THREE.BoxGeometry(0.15, 0.008, 0.008).translate(0, 0.024, 0);
      return merged([
        [leaf, '#2e9b45'],
        [vein, '#7bd36f'],
      ]);
    }
    case 'char':
      return merged([[new THREE.SphereGeometry(0.03, 6, 4).scale(1, 0.25, 1), '#7a3e17']]);
  }
}

const cache = new Map<string, THREE.BufferGeometry>();
let toppingMat: THREE.MeshStandardMaterial | null = null;

export function toppingGeometry(t: ToppingId | 'char'): THREE.BufferGeometry {
  let g = cache.get(t);
  if (!g) {
    g = buildTopping(t);
    cache.set(t, g);
  }
  return g;
}
export function toppingMaterial(): THREE.MeshStandardMaterial {
  toppingMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0 });
  return toppingMat;
}
/** One piece of a topping, ready to drop on the pizza. */
export function makePiece(t: ToppingId): THREE.Mesh {
  const m = new THREE.Mesh(toppingGeometry(t), toppingMaterial());
  m.castShadow = true;
  m.userData.topping = t;
  m.userData.shared = true;
  return m;
}

/** Free the shared topping geometries (when the game closes). */
export function disposeFood() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
  toppingMat?.dispose();
  toppingMat = null;
}

/* ───────────────────────── The pizza ───────────────────────── */

export const PIZZA_R = 0.62;
/** Pieces stay inside the sauce. */
const TOP_R = 0.45;

/** Angle (clockwise from "12 o'clock", seen from above with +z towards the viewer) → direction. */
const dirAt = (theta: number, r: number) => new THREE.Vector3(Math.sin(theta) * r, 0, -Math.cos(theta) * r);

export interface Piece {
  mesh: THREE.Mesh;
  topping: ToppingId;
  slice: number;
}

const DOUGH = new THREE.Color('#f6dcae');
const CRUST_RAW = new THREE.Color('#f2cf8f');
const CRUST_BAKED = new THREE.Color('#d6862f');
const SAUCE_RAW = new THREE.Color('#e0412f');
const SAUCE_BAKED = new THREE.Color('#c62f20');

export class Pizza {
  readonly group = new THREE.Group();
  /** The pizza itself (lifted off the board when Ziggy tosses the dough). */
  readonly pie = new THREE.Group();
  readonly board = new THREE.Group();
  readonly sauce: THREE.Mesh;
  readonly toppings = new THREE.Group();
  readonly hit: THREE.Mesh;
  pieces: Piece[] = [];
  parts = 0;
  private crustMat = new THREE.MeshStandardMaterial({ color: CRUST_RAW.clone(), roughness: 0.85 });
  private doughMat = new THREE.MeshStandardMaterial({ color: DOUGH.clone(), roughness: 0.9 });
  private sauceMat = new THREE.MeshStandardMaterial({ color: SAUCE_RAW.clone(), roughness: 0.5 });
  private slicing = new THREE.Group();
  private sectors: THREE.Mesh[] = [];
  private flags: THREE.Sprite[] = [];
  private chars: THREE.Mesh[] = [];
  private lit = -1;

  constructor() {
    const g = this.group;
    // Wooden peel.
    const wood = new THREE.MeshStandardMaterial({ color: '#c98d52', roughness: 0.8 });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.04, 40), wood);
    plate.position.y = 0.02;
    plate.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.02, 6, 40), new THREE.MeshStandardMaterial({ color: '#a86d3a', roughness: 0.8 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.04;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.42), wood);
    handle.position.set(0, 0.018, -0.95);
    this.board.add(plate, rim, handle);
    g.add(this.board);

    const dough = new THREE.Mesh(new THREE.CylinderGeometry(PIZZA_R + 0.02, PIZZA_R + 0.04, 0.05, 40), this.doughMat);
    dough.position.y = 0.025;
    dough.receiveShadow = true;
    dough.castShadow = true;
    const crust = new THREE.Mesh(new THREE.TorusGeometry(PIZZA_R - 0.01, 0.07, 10, 48), this.crustMat);
    crust.rotation.x = Math.PI / 2;
    crust.scale.z = 0.75;
    crust.position.y = 0.06;
    crust.castShadow = true;
    this.sauce = new THREE.Mesh(new THREE.CylinderGeometry(PIZZA_R - 0.07, PIZZA_R - 0.07, 0.014, 40), this.sauceMat);
    this.sauce.position.y = 0.056;
    this.sauce.receiveShadow = true;
    this.pie.add(dough, crust, this.sauce, this.toppings, this.slicing);
    this.pie.position.y = 0.04;
    g.add(this.pie);
    // Little browned bubbles on the crust, seen once baked.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.2;
      const c = new THREE.Mesh(toppingGeometry('char'), toppingMaterial());
      c.position.copy(dirAt(a, PIZZA_R - 0.02 + ((i * 7) % 3) * 0.012)).setY(0.115);
      c.scale.setScalar(0.001);
      c.userData.shared = true;
      this.chars.push(c);
      this.pie.add(c);
    }
    // Invisible tap target over the whole pizza.
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(PIZZA_R + 0.08, PIZZA_R + 0.08, 0.2, 24), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = 0.1;
    this.pie.add(this.hit);
  }

  /** 0 = raw dough, 1 = golden from the oven. */
  setBake(k: number) {
    this.crustMat.color.copy(CRUST_RAW).lerp(CRUST_BAKED, k);
    this.doughMat.color.copy(DOUGH).lerp(CRUST_BAKED, k * 0.6);
    this.sauceMat.color.copy(SAUCE_RAW).lerp(SAUCE_BAKED, k);
    for (const c of this.chars) c.scale.setScalar(Math.max(0.001, k));
    for (const p of this.pieces) if (p.topping === 'cheese') p.mesh.scale.set(1 + k * 0.45, 1 - k * 0.35, 1 + k * 0.45);
  }

  /** Back to a fresh, plain dough. */
  reset() {
    for (const p of this.pieces) this.toppings.remove(p.mesh);
    this.pieces = [];
    this.setParts(0);
    this.setBake(0);
    this.pie.position.set(0, 0.04, 0);
    this.pie.rotation.set(0, 0, 0);
    this.pie.scale.setScalar(1);
    this.sauce.scale.set(0.001, 1, 0.001);
    // A flight may have spun it: slices always start at 12 o'clock.
    this.group.rotation.set(0, 0, 0);
    this.group.scale.setScalar(1);
    this.group.visible = true;
  }

  /* ── Slices (fraction orders) ── */

  setParts(n: number) {
    for (const o of [...this.slicing.children]) {
      this.slicing.remove(o);
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material & { map?: THREE.Texture | null };
      mat?.map?.dispose();
      mat?.dispose();
    }
    this.sectors = [];
    this.flags = [];
    this.parts = n;
    this.lit = -1;
    if (n < 2) return;
    const lineMat = new THREE.MeshBasicMaterial({ color: '#8a2a16' });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, PIZZA_R + 0.02), lineMat);
      line.position.copy(dirAt(a, (PIZZA_R + 0.02) / 2)).setY(0.072);
      line.rotation.y = -a;
      this.slicing.add(line);
      // Highlight for the slice under the finger / the TV focus.
      const a0 = a;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const sec = new THREE.Mesh(
        new THREE.CircleGeometry(PIZZA_R - 0.06, 12, Math.PI / 2 - a1, a1 - a0).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0, depthWrite: false })
      );
      sec.position.y = 0.075;
      sec.renderOrder = 2;
      this.sectors.push(sec);
      this.slicing.add(sec);
      // A numbered toothpick flag at the crust.
      const mid = (a0 + a1) / 2;
      const flag = canvasSprite(
        96,
        96,
        (g) => {
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.arc(48, 48, 42, 0, Math.PI * 2);
          g.fill();
          g.lineWidth = 7;
          g.strokeStyle = '#e0412f';
          g.stroke();
          g.fillStyle = '#4a2a12';
          g.font = 'bold 54px Fredoka, system-ui, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(String(i + 1), 48, 52);
        },
        0.2
      );
      flag.position.copy(dirAt(mid, PIZZA_R + 0.1)).setY(0.2);
      this.flags.push(flag);
      this.slicing.add(flag);
      const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), new THREE.MeshBasicMaterial({ color: '#f5e1b8' }));
      pick.position.copy(dirAt(mid, PIZZA_R + 0.1)).setY(0.1);
      this.slicing.add(pick);
    }
  }

  sliceAt(local: THREE.Vector3): number {
    if (this.parts < 2) return -1;
    let a = Math.atan2(local.x, -local.z);
    if (a < 0) a += Math.PI * 2;
    return Math.min(this.parts - 1, Math.floor((a / (Math.PI * 2)) * this.parts));
  }

  highlight(i: number) {
    this.lit = i;
  }

  /** Where the pieces of a covered slice go. */
  slicePoints(i: number): THREE.Vector3[] {
    const n = this.parts;
    const a0 = (i / n) * Math.PI * 2;
    const w = (Math.PI * 2) / n;
    const rings: [number, number][] = n === 2 ? [[0.43, 4], [0.24, 2], [0.08, 1]] : n === 4 ? [[0.42, 3], [0.22, 1]] : [[0.43, 1], [0.24, 1]];
    const pts: THREE.Vector3[] = [];
    for (const [r, k] of rings) for (let j = 0; j < k; j++) pts.push(dirAt(a0 + w * ((j + 0.5) / k) * (n === 2 && r < 0.1 ? 1 : 1), r));
    return pts;
  }

  /** A free spot for one more piece (count orders), near `want` if given. */
  freeSpot(want?: THREE.Vector3): THREE.Vector3 {
    const taken = this.pieces.map((p) => p.mesh.position);
    const score = (p: THREE.Vector3) => Math.min(1, ...taken.map((q) => Math.hypot(p.x - q.x, p.z - q.z)));
    if (want) {
      const p = want.clone().setY(0);
      if (p.length() > TOP_R) p.setLength(TOP_R);
      if (score(p) > 0.13) return p;
      // Nudge it to the nearest roomy place.
      let best = p;
      let bs = -1;
      for (let k = 0; k < 24; k++) {
        const q = p.clone().add(new THREE.Vector3(Math.cos(k * 2.4) * (0.08 + k * 0.012), 0, Math.sin(k * 2.4) * (0.08 + k * 0.012)));
        if (q.length() > TOP_R) q.setLength(TOP_R);
        const s = score(q);
        if (s > bs) {
          bs = s;
          best = q;
        }
        if (s > 0.15) break;
      }
      return best;
    }
    let best = new THREE.Vector3();
    let bs = -1;
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * TOP_R;
      const q = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      const s = score(q) - r * 0.08;
      if (s > bs) {
        bs = s;
        best = q;
      }
    }
    return best;
  }

  add(t: ToppingId, at: THREE.Vector3, slice = -1): Piece {
    const mesh = makePiece(t);
    mesh.position.set(at.x, 0.066, at.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    const p = { mesh, topping: t, slice };
    this.pieces.push(p);
    this.toppings.add(mesh);
    return p;
  }

  remove(p: Piece) {
    this.pieces = this.pieces.filter((x) => x !== p);
    this.toppings.remove(p.mesh);
  }

  update(t: number) {
    this.sectors.forEach((s, i) => {
      const m = s.material as THREE.MeshBasicMaterial;
      const want = i === this.lit ? 0.32 + Math.sin(t * 6) * 0.1 : 0;
      m.opacity += (want - m.opacity) * 0.3;
    });
    this.flags.forEach((f, i) => f.scale.setScalar(i === this.lit ? 0.27 : 0.2));
  }

  dispose() {
    this.setParts(0);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.userData.shared) return;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((x) => x.dispose());
    });
  }
}

/* ───────────────────────── Money ───────────────────────── */

/** A coin (1 €, 2 €) or a note (5, 10, 20 €), lying flat. */
export function makeMoney(value: number): THREE.Group {
  const g = new THREE.Group();
  if (value <= 2) {
    const outer = value === 2 ? '#d9dde3' : '#f0c24a';
    const inner = value === 2 ? '#f0c24a' : '#d9dde3';
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.022, 20), new THREE.MeshStandardMaterial({ color: outer, metalness: 0.6, roughness: 0.35 }));
    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.026, 20),
      new THREE.MeshStandardMaterial({
        color: inner,
        metalness: 0.5,
        roughness: 0.4,
        map: canvasTex(64, 64, (c) => {
          c.fillStyle = '#ffffff';
          c.fillRect(0, 0, 64, 64);
          c.fillStyle = '#6b5a2a';
          c.font = 'bold 40px Fredoka, system-ui, sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(String(value), 32, 35);
        }),
      })
    );
    rim.position.y = face.position.y = 0.011;
    rim.castShadow = true;
    g.add(rim, face);
    return g;
  }
  const col = value === 5 ? '#9fd18b' : value === 10 ? '#f08f7d' : '#7fb3ef';
  const note = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.012, 0.22),
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.9,
      map: canvasTex(256, 134, (c) => {
        c.fillStyle = col;
        c.fillRect(0, 0, 256, 134);
        c.strokeStyle = 'rgba(255,255,255,.8)';
        c.lineWidth = 8;
        c.strokeRect(10, 10, 236, 114);
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(70, 67, 34, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#2b3a55';
        c.font = 'bold 64px Fredoka, system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(String(value), 172, 72);
        c.font = 'bold 40px Fredoka, system-ui, sans-serif';
        c.fillText('€', 70, 70);
      }),
    })
  );
  note.position.y = 0.006;
  note.castShadow = true;
  g.add(note);
  return g;
}

/* ───────────────────────── The order bubble ───────────────────────── */

export type BubbleKind = { kind: 'order'; order: Order; pictures: boolean } | { kind: 'candy' } | { kind: 'text'; text: string } | { kind: 'money'; price: number; paid: number };

function drawPie(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, parts: number, fill: (i: number) => string | null) {
  for (let i = 0; i < parts; i++) {
    const a0 = (i / parts) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / parts) * Math.PI * 2 - Math.PI / 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, r, a0, a1);
    g.closePath();
    g.fillStyle = fill(i) ?? '#f6c77c';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#a2541f';
    g.stroke();
  }
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.lineWidth = 9;
  g.strokeStyle = '#d98e3f';
  g.stroke();
}

/** The illustrated speech bubble over a customer (canvas sprite). */
export function bubbleTexture(b: BubbleKind): THREE.CanvasTexture {
  return canvasTex(512, 340, (g) => {
    g.clearRect(0, 0, 512, 340);
    g.fillStyle = 'rgba(60,30,10,0.18)';
    roundRect(g, 18, 22, 482, 262, 70);
    g.fill();
    g.fillStyle = '#ffffff';
    roundRect(g, 10, 10, 482, 262, 70);
    g.fill();
    g.beginPath();
    g.moveTo(150, 262);
    g.lineTo(118, 330);
    g.lineTo(215, 262);
    g.closePath();
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#ffb35c';
    roundRect(g, 10, 10, 482, 262, 70);
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const emoji = (e: string, x: number, y: number, s: number) => {
      g.font = `${s}px ${EMOJI_FONT}`;
      g.fillText(e, x, y + s * 0.06);
    };
    const text = (s: string, x: number, y: number, size: number, color = '#4a2a12') => {
      g.font = `bold ${size}px Fredoka, system-ui, sans-serif`;
      g.fillStyle = color;
      g.fillText(s, x, y);
    };
    if (b.kind === 'candy') {
      emoji('🍬', 140, 140, 96);
      emoji('🍭', 251, 130, 110);
      emoji('🍬', 362, 140, 96);
      return;
    }
    if (b.kind === 'text') {
      text(b.text, 251, 145, b.text.length > 3 ? 90 : 150, '#ff5c8a');
      return;
    }
    if (b.kind === 'money') {
      emoji('🍕', 120, 140, 96);
      text(`${b.price} €`, 290, 140, 92);
      return;
    }
    const o = b.order;
    if (o.kind === 'count') {
      const rows = o.items;
      const rowH = rows.length > 1 ? 112 : 160;
      rows.forEach((it, ri) => {
        const y = 141 + (ri - (rows.length - 1) / 2) * rowH;
        const e = TOPPING_INFO[it.topping].emoji;
        const hidden = o.hidden === it.topping;
        if (b.pictures && !hidden && it.n <= 6) {
          const size = it.n > 4 ? 64 : rows.length > 1 ? 80 : 96;
          const step = size * 1.05;
          for (let k = 0; k < it.n; k++) emoji(e, 251 + (k - (it.n - 1) / 2) * step, y, size);
        } else {
          text(hidden ? '?' : String(it.n), 190, y, 100, hidden ? '#ff5c8a' : '#4a2a12');
          emoji(e, 310, y, 92);
        }
      });
      if (o.total !== null) text(`= ${o.total}`, 430, 141, 70, '#2f7d32');
      return;
    }
    // Slices: halves are drawn, fractions written.
    if (o.items.every((it) => it.num * 2 === it.den) && o.items.length === 2 && b.pictures) {
      drawPie(g, 251, 141, 110, 2, () => null);
      o.items.forEach((it, i) => emoji(TOPPING_INFO[it.topping].emoji, i === 0 ? 300 : 202, 141, 70));
      return;
    }
    const rowH = o.items.length > 1 ? 112 : 160;
    o.items.forEach((it, ri) => {
      const y = 141 + (ri - (o.items.length - 1) / 2) * rowH;
      text(fracGlyph(it.num, it.den), 180, y, 104);
      emoji(TOPPING_INFO[it.topping].emoji, 320, y, 92);
    });
  });
}
