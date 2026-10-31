import * as THREE from 'three';
import { glow, glowMat, mat } from '../kit/look';
import { rng } from '../kit/rng';
import { CLUE_SPOTS, type MysteryId } from './logic';

/**
 * The village square of Ziggy Détective: a sunny cobbled square with a
 * fountain, colourful houses, the town hall, a bakery, a market, a café
 * terrace, a well, trees, flowers and bunting. Everything is low-poly and
 * built in code (canvas textures only); the game merges the static pieces
 * into a few draw calls.
 */

export const SLOT_X = { left: -3.1, center: 0, right: 3.1 } as const;
export const SLOT_Z = { front: 2.5, back: -2.5 } as const;

/** Where Ziggy waits, watching the line-up. */
export const ZIGGY_HOME = new THREE.Vector3(-5.0, 0, 4.2);
/** The scene of the mystery (party table) in front of the town hall. */
export const MYSTERY_SPOT = new THREE.Vector3(0, 0, -7.6);

/** Clue spots: the prop's place, the direction the camera looks from, and the side where Ziggy kneels. */
export const CLUE_PLACES: { at: THREE.Vector3; face: number; side: 1 | -1 }[] = [
  { at: new THREE.Vector3(-8.9, 0, -1.6), face: 1.2, side: 1 }, // bakery door
  { at: new THREE.Vector3(8.8, 0, -1.2), face: -1.2, side: 1 }, // market stall
  { at: new THREE.Vector3(-7.0, 0, 6.2), face: 0.6, side: 1 }, // flower bed
  { at: new THREE.Vector3(6.9, 0, 6.0), face: -0.6, side: 1 }, // lamp post
  { at: new THREE.Vector3(9.3, 0, 3.0), face: -1.0, side: -1 }, // well
  { at: new THREE.Vector3(-9.4, 0, 2.6), face: 1.0, side: 1 }, // big tree
];
if (CLUE_PLACES.length !== CLUE_SPOTS) throw new Error('clue places');

/** Where cleared friends go and relax (café terrace and bench). */
export const REST_SPOTS: THREE.Vector3[] = [
  new THREE.Vector3(-5.2, 0, -5.6),
  new THREE.Vector3(5.2, 0, -5.6),
  new THREE.Vector3(-6.9, 0, -6.4),
  new THREE.Vector3(6.9, 0, -6.4),
  new THREE.Vector3(-8.4, 0, -5.2),
  new THREE.Vector3(8.4, 0, -5.2),
];

const put = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => {
  o.position.set(x, y, z);
  return o;
};
const box = (w: number, h: number, d: number, color: THREE.ColorRepresentation, cast = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};
const cyl = (rt: number, rb: number, h: number, color: THREE.ColorRepresentation, seg = 12, cast = true) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.castShadow = cast;
  return m;
};
const blob = (r: number, color: THREE.ColorRepresentation, detail = 1) => {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color));
  m.castShadow = true;
  return m;
};

/* ───────────────────────── Textures ───────────────────────── */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 4;
  return t;
}

function cobbleTex(): THREE.CanvasTexture {
  return canvasTex(
    256,
    256,
    (g) => {
      g.fillStyle = '#b9a48a';
      g.fillRect(0, 0, 256, 256);
      const r = rng(5);
      const cols = ['#efe2cc', '#e6d4b8', '#f3e8d6', '#ddc9ab', '#e9d9c2', '#f6eddc'];
      const n = 8;
      const s = 256 / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const ox = (y % 2) * s * 0.5;
          g.fillStyle = cols[Math.floor(r() * cols.length)];
          const px = x * s + ox + 3;
          const py = y * s + 3;
          const w = s - 6;
          const h = s - 6;
          g.beginPath();
          g.roundRect(px % 256, py, w, h, 9);
          g.fill();
          if (px + w > 256) {
            g.beginPath();
            g.roundRect(px - 256, py, w, h, 9);
            g.fill();
          }
          // A soft highlight on each stone.
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.beginPath();
          g.ellipse((px % 256) + w * 0.35, py + h * 0.3, w * 0.22, h * 0.12, -0.3, 0, Math.PI * 2);
          g.fill();
        }
    },
    [9, 9]
  );
}

/** Red-and-white (or other) awning stripes. */
function stripeTex(a: string, b: string): THREE.CanvasTexture {
  return canvasTex(64, 8, (g) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? b : a;
      g.fillRect(i * 8, 0, 8, 8);
    }
  });
}

/* ───────────────────────── Buildings ───────────────────────── */

interface HouseOpts {
  w: number;
  h: number;
  d: number;
  walls: string;
  roof: string;
  shutters: string;
  door: string;
  floors?: number;
  chimney?: boolean;
}

/** A cosy house, facing +Z, origin on the ground. */
export function makeVillageHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const walls = box(o.w, o.h, o.d, o.walls);
  walls.position.y = o.h / 2;
  const base = box(o.w + 0.15, 0.3, o.d + 0.15, '#c9b8a6', false);
  base.position.y = 0.15;
  // Gable roof: a triangular prism.
  const rh = o.w * 0.42;
  const shape = new THREE.Shape();
  shape.moveTo(-o.w / 2 - 0.3, 0);
  shape.lineTo(0, rh);
  shape.lineTo(o.w / 2 + 0.3, 0);
  shape.lineTo(-o.w / 2 - 0.3, 0);
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: o.d + 0.5, bevelEnabled: false });
  roofGeo.translate(0, 0, -(o.d + 0.5) / 2);
  const roof = new THREE.Mesh(roofGeo, mat(o.roof));
  roof.position.y = o.h;
  roof.castShadow = true;
  // Roof edges a shade darker.
  const ridge = cyl(0.09, 0.09, o.d + 0.6, new THREE.Color(o.roof).multiplyScalar(0.8), 6);
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = o.h + rh;
  g.add(walls, base, roof, ridge);
  if (o.chimney !== false) {
    const ch = box(0.45, 1.1, 0.45, '#c4705a');
    ch.position.set(o.w * 0.25, o.h + rh * 0.75, -o.d * 0.15);
    g.add(ch);
  }
  // Door (rounded top).
  const doorM = mat(o.door);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.05, 0.1), doorM);
  door.position.set(0, 0.62, o.d / 2 + 0.02);
  const doorTop = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 14, 1, false, -Math.PI / 2, Math.PI), doorM);
  doorTop.rotation.x = Math.PI / 2;
  doorTop.position.set(0, 1.14, o.d / 2 + 0.02);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), mat('#ffd166'));
  knob.position.set(0.24, 0.65, o.d / 2 + 0.09);
  const step = box(1.1, 0.12, 0.4, '#d8c8b4', false);
  step.position.set(0, 0.06, o.d / 2 + 0.2);
  g.add(door, doorTop, knob, step);
  // Windows with shutters and flower boxes.
  const floors = o.floors ?? (o.h > 3 ? 2 : 1);
  const glass = new THREE.MeshLambertMaterial({ color: '#bfe3ff', emissive: new THREE.Color('#5f8fbf').multiplyScalar(0.35) });
  const flowerCols = ['#ff7ab8', '#ffd166', '#ff8a5c', '#ffffff', '#c99bff'];
  for (let f = 0; f < floors; f++) {
    const y = f === 0 ? 1.35 : 1.35 + f * 1.45;
    const xs = f === 0 ? [-o.w * 0.3, o.w * 0.3] : [-o.w * 0.3, 0, o.w * 0.3];
    for (const x of xs) {
      if (f === 0 && Math.abs(x) < 0.7) continue;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.65), glass);
      w.position.set(x, y, o.d / 2 + 0.01);
      const fr = box(0.66, 0.08, 0.06, '#ffffff', false);
      fr.position.set(x, y, o.d / 2 + 0.03);
      const fv = box(0.06, 0.72, 0.06, '#ffffff', false);
      fv.position.set(x, y, o.d / 2 + 0.03);
      g.add(w, fr, fv);
      for (const s of [-1, 1]) {
        const sh = box(0.26, 0.72, 0.05, o.shutters, false);
        sh.position.set(x + s * 0.43, y, o.d / 2 + 0.03);
        g.add(sh);
      }
      const fb = box(0.7, 0.16, 0.22, '#8a5a3a', false);
      fb.position.set(x, y - 0.42, o.d / 2 + 0.1);
      g.add(fb);
      for (let k = 0; k < 4; k++) {
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(flowerCols[(k + f + Math.round(x * 3)) % flowerCols.length]));
        fl.position.set(x - 0.24 + k * 0.16, y - 0.3, o.d / 2 + 0.16);
        g.add(fl);
      }
    }
  }
  return g;
}

function makeTownHall(): THREE.Group {
  const g = new THREE.Group();
  const W = 8;
  const H = 4.6;
  const D = 3.6;
  const walls = box(W, H, D, '#fff4e0');
  walls.position.y = H / 2;
  const base = box(W + 0.3, 0.45, D + 0.3, '#d9c9b2', false);
  base.position.y = 0.22;
  // Steps.
  for (let i = 0; i < 3; i++) {
    const st = box(3.6 - i * 0.4, 0.16, 0.5, '#e8dccb', false);
    st.position.set(0, 0.08 + i * 0.16, D / 2 + 0.75 - i * 0.3);
    g.add(st);
  }
  // Columns.
  for (const x of [-1.5, -0.5, 0.5, 1.5]) {
    const c = cyl(0.17, 0.2, 3.3, '#ffffff', 10);
    c.position.set(x, 0.5 + 1.65, D / 2 + 0.55);
    const cap = box(0.5, 0.15, 0.5, '#ffffff', false);
    cap.position.set(x, 0.5 + 3.35, D / 2 + 0.55);
    g.add(c, cap);
  }
  const lintel = box(4.0, 0.4, 1.0, '#fffaf0');
  lintel.position.set(0, 4.1, D / 2 + 0.45);
  // Pediment with a big clock.
  const ped = new THREE.Shape();
  ped.moveTo(-2.3, 0);
  ped.lineTo(0, 1.2);
  ped.lineTo(2.3, 0);
  ped.lineTo(-2.3, 0);
  const pedGeo = new THREE.ExtrudeGeometry(ped, { depth: 0.9, bevelEnabled: false });
  const pedM = new THREE.Mesh(pedGeo, mat('#ffe9c7'));
  pedM.position.set(0, 4.3, D / 2 - 0.05);
  pedM.castShadow = true;
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-W / 2 - 0.3, 0);
  roofShape.lineTo(0, 1.6);
  roofShape.lineTo(W / 2 + 0.3, 0);
  roofShape.lineTo(-W / 2 - 0.3, 0);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: D + 0.4, bevelEnabled: false });
  roofGeo.translate(0, 0, -(D + 0.4) / 2);
  const roof = new THREE.Mesh(roofGeo, mat('#5b7fd0'));
  roof.position.y = H;
  roof.castShadow = true;
  // Little clock tower.
  const tower = box(1.6, 1.6, 1.6, '#fff4e0');
  tower.position.set(0, H + 1.6, 0);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.4, 4), mat('#4a6cc0'));
  towerRoof.rotation.y = Math.PI / 4;
  towerRoof.position.set(0, H + 3.1, 0);
  towerRoof.castShadow = true;
  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), mat('#ffffff'));
  clockFace.position.set(0, H + 1.6, 0.81);
  const clockRim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.06, 6, 24), mat('#e0b040'));
  clockRim.position.copy(clockFace.position);
  const hand1 = box(0.06, 0.4, 0.03, '#2a2438', false);
  hand1.position.set(0, H + 1.75, 0.83);
  const hand2 = box(0.3, 0.06, 0.03, '#2a2438', false);
  hand2.position.set(0.12, H + 1.6, 0.83);
  // Flag.
  const pole = cyl(0.04, 0.04, 1.8, '#9aa3ad', 6);
  pole.position.set(0, H + 4.6, 0);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55, 4, 1), mat('#ff6f91', { side: THREE.DoubleSide }));
  flag.position.set(0.48, H + 5.2, 0);
  flag.name = 'flag';
  flag.userData.noMerge = true;
  g.add(walls, base, lintel, pedM, roof, tower, towerRoof, clockFace, clockRim, hand1, hand2, pole, flag);
  // Tall windows.
  const glass = new THREE.MeshLambertMaterial({ color: '#bfe3ff', emissive: new THREE.Color('#5f8fbf').multiplyScalar(0.35) });
  for (const x of [-3.1, -2.2, 2.2, 3.1])
    for (const y of [1.4, 3.2]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.0), glass);
      w.position.set(x, y, D / 2 + 0.01);
      const fr = box(0.68, 0.08, 0.06, '#ffffff', false);
      fr.position.set(x, y + 0.52, D / 2 + 0.03);
      const sill = box(0.72, 0.08, 0.14, '#ffffff', false);
      sill.position.set(x, y - 0.52, D / 2 + 0.05);
      g.add(w, fr, sill);
    }
  // Big door.
  const door = box(1.3, 2.1, 0.12, '#7a4a2a', false);
  door.position.set(0, 1.5, D / 2 + 0.02);
  g.add(door);
  return g;
}

function makeBakery(): THREE.Group {
  const g = makeVillageHouse({ w: 4.2, h: 3.2, d: 3.2, walls: '#ffe2b8', roof: '#d9603c', shutters: '#7fb8e6', door: '#8a5a3a', floors: 1 });
  // Striped awning over the shop window.
  const aw = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 1.0), new THREE.MeshLambertMaterial({ map: stripeTex('#ff6f61', '#fff6e8') }));
  aw.position.set(0, 2.45, 2.05);
  aw.rotation.x = 0.35;
  aw.castShadow = true;
  // A big bread loaf hanging as a sign.
  const arm = box(0.08, 0.08, 0.9, '#3a3040', false);
  arm.position.set(1.6, 2.95, 2.0);
  const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 10), mat('#e0a052'));
  loaf.rotation.z = Math.PI / 2;
  loaf.position.set(1.6, 2.65, 2.35);
  for (let i = 0; i < 3; i++) {
    const cut = box(0.04, 0.05, 0.2, '#fff0cc', false);
    cut.position.set(1.42 + i * 0.18, 2.86, 2.35);
    cut.rotation.y = 0.5;
    g.add(cut);
  }
  // Croissants in the window.
  for (let i = 0; i < 3; i++) {
    const cr = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.07, 6, 10, Math.PI), mat('#e8a64f'));
    cr.position.set(-1.6 + i * 0.4, 1.1, 1.75);
    g.add(cr);
  }
  g.add(aw, arm, loaf);
  return g;
}

function makeStall(a: string, b: string, fruit: string[]): THREE.Group {
  const g = new THREE.Group();
  const table = box(2.4, 0.12, 1.1, '#b07a4c');
  table.position.y = 0.9;
  for (const x of [-1.05, 1.05])
    for (const z of [-0.45, 0.45]) {
      const leg = box(0.1, 0.9, 0.1, '#8a5a3a', false);
      leg.position.set(x, 0.45, z);
      g.add(leg);
    }
  for (const x of [-1.15, 1.15]) {
    const post = cyl(0.05, 0.05, 2.4, '#8a5a3a', 6);
    post.position.set(x, 1.2, -0.5);
    g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 1.5), new THREE.MeshLambertMaterial({ map: stripeTex(a, b) }));
  roof.position.set(0, 2.35, 0.05);
  roof.rotation.x = 0.28;
  roof.castShadow = true;
  // Scalloped edge.
  for (let i = 0; i < 9; i++) {
    const sc = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(i % 2 ? b : a));
    sc.rotation.x = Math.PI;
    sc.position.set(-1.2 + i * 0.3, 2.13, 0.8);
    g.add(sc);
  }
  g.add(table, roof);
  // Crates of fruit.
  fruit.forEach((col, i) => {
    const crate = box(0.65, 0.25, 0.5, '#d9a066', false);
    crate.position.set(-0.75 + i * 0.75, 1.08, 0);
    g.add(crate);
    for (let k = 0; k < 6; k++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(col));
      f.position.set(-0.75 + i * 0.75 + ((k % 3) - 1) * 0.18, 1.25, (Math.floor(k / 3) - 0.5) * 0.2);
      g.add(f);
    }
  });
  return g;
}

function makeWell(): THREE.Group {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.9, 16, 1, true), mat('#b8b0a4', { side: THREE.DoubleSide }));
  wall.position.y = 0.45;
  wall.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.1, 6, 18), mat('#d6cfc4'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.9;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.78, 16), mat('#4fa3e0'));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.5;
  // Stone pattern.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const st = box(0.36, 0.2, 0.08, i % 2 ? '#a69d90' : '#c4bcb0', false);
    st.position.set(Math.cos(a) * 0.86, 0.25 + (i % 2) * 0.35, Math.sin(a) * 0.86);
    st.rotation.y = -a + Math.PI / 2;
    g.add(st);
  }
  for (const x of [-0.75, 0.75]) {
    const p = box(0.12, 1.5, 0.12, '#8a5a3a');
    p.position.set(x, 1.6, 0);
    g.add(p);
  }
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-1.1, 0);
  roofShape.lineTo(0, 0.7);
  roofShape.lineTo(1.1, 0);
  roofShape.lineTo(-1.1, 0);
  const rg = new THREE.ExtrudeGeometry(roofShape, { depth: 1.2, bevelEnabled: false });
  rg.translate(0, 0, -0.6);
  const roof = new THREE.Mesh(rg, mat('#d9603c'));
  roof.position.y = 2.3;
  roof.rotation.y = Math.PI / 2;
  roof.castShadow = true;
  const axle = cyl(0.05, 0.05, 1.6, '#6b4226', 6);
  axle.rotation.z = Math.PI / 2;
  axle.position.y = 1.9;
  const bucket = cyl(0.17, 0.13, 0.25, '#9a6b42', 10);
  bucket.position.set(0.25, 1.35, 0);
  g.add(wall, rim, water, roof, axle, bucket);
  return g;
}

function makeTree(r: () => number, kind: 'round' | 'cherry' | 'pine', s = 1): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'pine') {
    const trunk = cyl(0.14, 0.18, 0.7, '#7a4a2a', 6);
    trunk.position.y = 0.35;
    g.add(trunk);
    [
      { r: 1.1, h: 1.4, y: 1.1 },
      { r: 0.85, h: 1.2, y: 1.8 },
      { r: 0.55, h: 1.0, y: 2.4 },
    ].forEach((t, i) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 7), mat(i % 2 ? '#3f8a5e' : '#357a50'));
      c.position.y = t.y;
      c.castShadow = true;
      g.add(c);
    });
  } else {
    const trunk = cyl(0.16, 0.24, 1.6, '#8a5a3a', 7);
    trunk.position.y = 0.8;
    g.add(trunk);
    const cols = kind === 'cherry' ? ['#ffb3cf', '#ff9cc2', '#ffc8dc'] : ['#5cb85c', '#4caf50', '#6cc46a'];
    for (let i = 0; i < 4; i++) {
      const b = blob(0.75 + r() * 0.35, cols[i % cols.length]);
      b.position.set((r() - 0.5) * 1.1, 2.0 + r() * 0.8, (r() - 0.5) * 1.0);
      g.add(b);
    }
  }
  g.scale.setScalar(s);
  return g;
}

function makeLampPost(): THREE.Group {
  const g = new THREE.Group();
  const pole = cyl(0.06, 0.09, 2.8, '#2f3a4f', 8);
  pole.position.y = 1.4;
  const arm = box(0.5, 0.06, 0.06, '#2f3a4f', false);
  arm.position.set(0.22, 2.75, 0);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.34, 6), glowMat('#ffe2a8', 1.05));
  lamp.position.set(0.45, 2.55, 0);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.2, 6), mat('#2f3a4f'));
  cap.position.set(0.45, 2.82, 0);
  const pot = cyl(0.3, 0.24, 0.3, '#c4705a', 10);
  pot.position.y = 0.15;
  g.add(pole, arm, lamp, cap, pot);
  for (let k = 0; k < 5; k++) {
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(['#ff7ab8', '#ffd166', '#ffffff', '#ff8a5c', '#c99bff'][k]));
    fl.position.set(Math.cos(k * 1.3) * 0.18, 0.38, Math.sin(k * 1.3) * 0.18);
    g.add(fl);
  }
  return g;
}

function makeBench(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const slat = box(2.0, 0.07, 0.16, '#c98a52', false);
    slat.position.set(0, 0.5, -0.18 + i * 0.18);
    g.add(slat);
  }
  for (let i = 0; i < 2; i++) {
    const back = box(2.0, 0.14, 0.06, '#c98a52', false);
    back.position.set(0, 0.75 + i * 0.22, -0.32);
    g.add(back);
  }
  for (const x of [-0.85, 0.85]) {
    const leg = box(0.08, 0.5, 0.5, '#3a3040', false);
    leg.position.set(x, 0.25, -0.05);
    const bl = box(0.08, 0.6, 0.06, '#3a3040', false);
    bl.position.set(x, 0.8, -0.34);
    g.add(leg, bl);
  }
  return g;
}

function makeCafe(): THREE.Group {
  const g = new THREE.Group();
  [
    [0, 0, '#ff7a8a'],
    [1.9, 0.8, '#7fc8ff'],
  ].forEach(([x, z, col]) => {
    const table = cyl(0.45, 0.45, 0.06, '#ffffff', 14);
    table.position.set(x as number, 0.75, z as number);
    const leg = cyl(0.05, 0.05, 0.75, '#3a3040', 6);
    leg.position.set(x as number, 0.37, z as number);
    const pole = cyl(0.03, 0.03, 2.2, '#ffffff', 6);
    pole.position.set(x as number, 1.1, z as number);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.55, 8, 1, true), mat(col as string, { side: THREE.DoubleSide }));
    um.position.set(x as number, 2.25, z as number);
    um.castShadow = true;
    const glass = cyl(0.06, 0.05, 0.16, '#ffe066', 8);
    glass.position.set((x as number) + 0.15, 0.86, z as number);
    g.add(table, leg, pole, um, glass);
  });
  return g;
}

function makeFlowerBed(r: () => number, w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const soil = box(w, 0.25, d, '#8a5a3a', false);
  soil.position.y = 0.12;
  const rim = box(w + 0.16, 0.18, d + 0.16, '#d9c9b2', false);
  rim.position.y = 0.06;
  g.add(rim, soil);
  const cols = ['#ff5f8f', '#ffd166', '#ff7a45', '#c99bff', '#ffffff', '#ff4d6d'];
  const n = Math.round(w * d * 5);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * (w - 0.2);
    const z = (r() - 0.5) * (d - 0.2);
    const stem = cyl(0.015, 0.015, 0.35, '#4f9a3f', 4, false);
    stem.position.set(x, 0.42, z);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat(cols[Math.floor(r() * cols.length)]));
    head.position.set(x, 0.62, z);
    g.add(stem, head);
  }
  return g;
}

/** Garlands of little flags, hung in soft curves. */
function makeBunting(points: [THREE.Vector3, THREE.Vector3][]): THREE.Group {
  const g = new THREE.Group();
  const cols = ['#ff5f6d', '#ffd166', '#5fb8ff', '#7ed957', '#c99bff', '#ff9a3c'];
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.2, 0, 0, 0.2, 0, 0, 0, -0.4, 0], 3));
  flagGeo.computeVertexNormals();
  points.forEach(([a, b], li) => {
    const n = Math.max(6, Math.round(a.distanceTo(b) / 0.65));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * 0.9;
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.02, 4), mat('#fff6e0'));
    g.add(rope);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const p = curve.getPointAt(t);
      const f = new THREE.Mesh(flagGeo, mat(cols[(i + li) % cols.length], { side: THREE.DoubleSide }));
      f.position.copy(p);
      const tan = curve.getTangentAt(t);
      f.rotation.y = Math.atan2(-tan.z, tan.x);
      g.add(f);
    }
  });
  return g;
}

/** The fountain in the middle of the square; returns the water to animate. */
export function makeFountain(): THREE.Group & { userData: { water: THREE.Mesh; jets: THREE.Vector3 } } {
  const g = new THREE.Group() as THREE.Group & { userData: { water: THREE.Mesh; jets: THREE.Vector3 } };
  const R = 1.45;
  const stone = '#e9e1d4';
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.1, 0.6, 28, 1, true), mat('#d8cdbd', { side: THREE.DoubleSide }));
  outer.position.y = 0.3;
  outer.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.14, 8, 32), mat(stone));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.6;
  rim.castShadow = true;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 28), mat('#7fbfe8'));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.08;
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(R - 0.04, 28),
    new THREE.MeshPhongMaterial({ color: '#7fd0ff', emissive: '#2b7fc0', emissiveIntensity: 0.25, transparent: true, opacity: 0.8, shininess: 120, specular: '#ffffff' })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.45;
  water.userData.noMerge = true;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 1.3, 12), mat(stone));
  column.position.y = 0.9;
  column.castShadow = true;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(stone, { side: THREE.DoubleSide }));
  bowl.position.y = 1.72;
  bowl.scale.y = 0.45;
  bowl.castShadow = true;
  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.56, 18), new THREE.MeshPhongMaterial({ color: '#8fd8ff', emissive: '#2b7fc0', emissiveIntensity: 0.3, shininess: 120 }));
  bowlWater.rotation.x = -Math.PI / 2;
  bowlWater.position.y = 1.68;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(stone));
  top.position.y = 1.95;
  // A little stone fish spouting water, for fun.
  const fish = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat('#ffb36b'));
  fish.scale.set(1, 0.8, 1.5);
  fish.position.y = 2.14;
  fish.rotation.x = -0.6;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 4), mat('#ffb36b'));
  tail.position.set(0, 2.0, -0.26);
  tail.rotation.x = -2.2;
  g.add(outer, rim, floor, water, column, bowl, bowlWater, top, fish, tail);
  g.userData.water = water;
  g.userData.jets = new THREE.Vector3(0, 2.3, 0.15);
  return g;
}

/* ───────────────────────── The whole village ───────────────────────── */

export interface Village {
  group: THREE.Group;
  ground: THREE.Mesh;
  fountain: ReturnType<typeof makeFountain>;
  flag: THREE.Mesh;
}

export function buildVillage(lowPower: boolean): Village {
  const g = new THREE.Group();
  const r = rng(2024);

  // Grass, gently varied.
  const grassGeo = new THREE.CircleGeometry(80, 48, 0, Math.PI * 2);
  grassGeo.rotateX(-Math.PI / 2);
  const gp = grassGeo.attributes.position;
  const gcol: number[] = [];
  const ga = new THREE.Color('#9edc6a');
  const gb = new THREE.Color('#7cc85a');
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i);
    const z = gp.getZ(i);
    const n = 0.5 + Math.sin(x * 0.4 + z * 0.2) * 0.25 + Math.cos(z * 0.33 - x * 0.15) * 0.25;
    const c = ga.clone().lerp(gb, n);
    gcol.push(c.r, c.g, c.b);
  }
  grassGeo.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3));
  const ground = new THREE.Mesh(grassGeo, mat('#ffffff', { vertexColors: true }));
  ground.receiveShadow = true;
  ground.name = 'ground';
  g.add(ground);

  // The cobbled square and the path towards us.
  const cobble = cobbleTex();
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(10.5, 48), new THREE.MeshLambertMaterial({ map: cobble }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  const curb = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.12, 4, 64), mat('#d9c9b2'));
  curb.rotation.x = Math.PI / 2;
  curb.position.y = 0.04;
  const pathTex = cobbleTex();
  pathTex.repeat.set(2, 9);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4, 22), new THREE.MeshLambertMaterial({ map: pathTex }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.015, 19);
  path.receiveShadow = true;
  g.add(plaza, curb, path);

  const fountain = makeFountain();
  g.add(fountain);

  // Six round stone mats around the fountain: the friends' places (like the map in the clues).
  for (const x of Object.values(SLOT_X))
    for (const z of Object.values(SLOT_Z)) {
      const matStone = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.06, 28), mat('#f4ead8'));
      matStone.position.set(x, 0.04, z);
      matStone.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.87, 0.05, 4, 28), mat('#d9c2a0'));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, 0.07, z);
      g.add(matStone, rim);
    }

  // Buildings around the square.
  const hall = makeTownHall();
  hall.position.set(0, 0, -12.9);
  g.add(hall);
  const houses: [HouseOpts, number, number, number][] = [
    [{ w: 3.6, h: 3.8, d: 3.2, walls: '#ffd6e0', roof: '#d94b4b', shutters: '#5f9fd9', door: '#5f9fd9' }, -6.6, -11.4, 0.15],
    [{ w: 3.4, h: 3.2, d: 3.0, walls: '#d6f0ff', roof: '#e0663f', shutters: '#ff7a8a', door: '#ff7a8a' }, 6.4, -11.4, -0.15],
    [{ w: 3.6, h: 4.2, d: 3.2, walls: '#fff0a8', roof: '#2fa59a', shutters: '#ff8a5c', door: '#8a5a3a', floors: 2 }, 10.6, -8.6, -0.75],
    [{ w: 3.2, h: 3.4, d: 3.0, walls: '#e6d9ff', roof: '#e0663f', shutters: '#7fbf6a', door: '#7a4bc2' }, -10.6, -8.4, 0.75],
    [{ w: 3.6, h: 3.6, d: 3.2, walls: '#c8f0d8', roof: '#8a5cc8', shutters: '#ffcc33', door: '#ffcc33' }, 13.8, 2.2, -1.57],
    [{ w: 3.4, h: 4.0, d: 3.2, walls: '#ffd8b0', roof: '#4a78c8', shutters: '#ffffff', door: '#4a78c8', floors: 2 }, -14.0, 3.0, 1.57],
    [{ w: 3.0, h: 3.0, d: 3.0, walls: '#fff4e0', roof: '#d94b4b', shutters: '#3fbf6a', door: '#3fbf6a' }, 14.4, -3.4, -1.45],
  ];
  for (const [o, x, z, ry] of houses) {
    const h = makeVillageHouse(o);
    h.position.set(x, 0, z);
    h.rotation.y = ry;
    g.add(h);
  }
  const bakery = makeBakery();
  bakery.position.set(-12.4, 0, -2.2);
  bakery.rotation.y = Math.PI / 2 - 0.1;
  g.add(bakery);
  const stall1 = makeStall('#ff6f61', '#fff6e8', ['#ff4d4d', '#ffb02e', '#7ed957']);
  stall1.position.set(10.6, 0, -1.4);
  stall1.rotation.y = -Math.PI / 2;
  g.add(stall1);
  const stall2 = makeStall('#5fb8ff', '#ffffff', ['#ffd34d', '#c94dff', '#ff7a45']);
  stall2.position.set(11.2, 0, 1.9);
  stall2.rotation.y = -Math.PI / 2 - 0.3;
  g.add(stall2);
  const well = makeWell();
  well.position.set(10.4, 0, 3.6);
  g.add(well);
  const cafeL = makeCafe();
  cafeL.position.set(-7.6, 0, -7.2);
  g.add(cafeL);
  const benchR = makeBench();
  benchR.position.set(6.9, 0, -7.4);
  g.add(benchR);
  const benchR2 = makeBench();
  benchR2.position.set(9.2, 0, -6.2);
  benchR2.rotation.y = -0.6;
  g.add(benchR2);

  // Party table in front of the town hall (the scene of the mystery).
  const table = new THREE.Group();
  const top = cyl(1.3, 1.3, 0.08, '#ffffff', 20);
  top.position.y = 0.95;
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.42, 0.45, 20, 1, true), mat('#ff9fb8', { side: THREE.DoubleSide }));
  cloth.position.y = 0.73;
  const leg = cyl(0.12, 0.2, 0.95, '#8a5a3a', 8);
  leg.position.y = 0.47;
  table.add(top, cloth, leg);
  table.position.copy(MYSTERY_SPOT);
  g.add(table);

  // Lamps, flower beds, trees.
  for (const [x, z] of [
    [7.9, 5.4],
    [-4.6, -8.6],
    [4.4, -8.8],
    [-9.6, 5.8],
  ]) {
    const l = makeLampPost();
    l.position.set(x, 0, z);
    l.rotation.y = Math.atan2(-x, -z) + Math.PI / 2;
    g.add(l);
  }
  for (const [x, z, w, d] of [
    [-7.4, 7.0, 2.6, 1.2],
    [7.6, 7.6, 2.2, 1.0],
    [-3.6, -9.0, 1.6, 0.8],
    [3.6, -9.0, 1.6, 0.8],
  ]) {
    const fb = makeFlowerBed(r, w, d);
    fb.position.set(x, 0, z);
    g.add(fb);
  }
  const trees: [number, number, 'round' | 'cherry' | 'pine', number][] = [
    [-10.6, 1.2, 'round', 1.25],
    [-12.2, 8.6, 'cherry', 1.1],
    [12.6, 8.4, 'round', 1.15],
    [-16.5, -4.0, 'pine', 1.3],
    [17.0, -6.0, 'pine', 1.4],
    [-17.5, 9.5, 'round', 1.3],
    [18.0, 10.5, 'cherry', 1.2],
    [-4.0, -16.0, 'pine', 1.5],
    [4.2, -16.5, 'round', 1.4],
    [-11.0, -14.0, 'round', 1.3],
    [11.5, -14.5, 'cherry', 1.2],
    [-20, -12, 'pine', 1.6],
    [21, -13, 'pine', 1.7],
    [-23, 2, 'round', 1.5],
    [23, 3, 'round', 1.4],
    [-8.5, 15, 'round', 1.2],
    [9, 16, 'pine', 1.3],
  ];
  for (const [x, z, k, s] of trees) {
    const t = makeTree(r, k, s);
    t.position.set(x, 0, z);
    g.add(t);
  }
  // Distant rolling hills.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const d = 46 + r() * 8;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(10 + r() * 6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(i % 2 ? '#8fd46a' : '#7cc55c'));
    hill.scale.y = 0.45 + r() * 0.3;
    hill.position.set(Math.cos(a) * d, -0.5, Math.sin(a) * d);
    g.add(hill);
  }
  // Grass tufts and wild flowers outside the square.
  const petals = ['#ff7ab8', '#ffd166', '#ffffff', '#b38cff', '#ff8a5c'];
  for (let i = 0; i < (lowPower ? 50 : 110); i++) {
    const a = r() * Math.PI * 2;
    const d = 11.5 + r() * 14;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.abs(x) < 2.6 && z > 9) continue; // the path
    if (r() < 0.5) {
      const tuft = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 3), mat('#5fae4a'));
        blade.position.set((k - 1) * 0.07, 0.2, 0);
        blade.rotation.z = (k - 1) * 0.3;
        tuft.add(blade);
      }
      tuft.position.set(x, 0, z);
      g.add(tuft);
    } else {
      const stem = cyl(0.02, 0.02, 0.3, '#4f9a3f', 4, false);
      stem.position.set(x, 0.15, z);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(petals[Math.floor(r() * petals.length)]));
      head.position.set(x, 0.34, z);
      g.add(stem, head);
    }
  }
  // Bushes along the square.
  for (const [x, z, s] of [
    [-11.4, 4.8, 1],
    [11.8, 5.6, 0.9],
    [-12.6, -6.0, 1.1],
    [12.8, -6.6, 1.0],
    [-3.0, 10.4, 0.8],
    [3.2, 10.6, 0.85],
  ]) {
    const bush = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const b = blob(0.6 * s + k * 0.08, k % 2 ? '#4caf50' : '#5cbf55');
      b.position.set((k - 1) * 0.55 * s, 0.45 * s, (k % 2) * 0.2);
      bush.add(b);
    }
    bush.position.set(x, 0, z);
    g.add(bush);
  }
  // Bunting across the square.
  const bunting = makeBunting([
    [new THREE.Vector3(-6.6, 4.6, -9.8), new THREE.Vector3(-0.6, 5.4, -10.2)],
    [new THREE.Vector3(0.6, 5.4, -10.2), new THREE.Vector3(6.4, 4.4, -9.9)],
    [new THREE.Vector3(-10.4, 3.7, -7.0), new THREE.Vector3(-6.6, 4.6, -9.8)],
    [new THREE.Vector3(6.4, 4.4, -9.9), new THREE.Vector3(10.2, 4.4, -7.2)],
  ]);
  g.add(bunting);

  // Little lights to glow a bit (lanterns).
  for (const [x, z] of [
    [7.9, 5.4],
    [-4.6, -8.6],
    [4.4, -8.8],
    [-9.6, 5.8],
  ]) {
    const halo = glow('#ffe2a8', 1.2, 0.35);
    const a = Math.atan2(-x, -z) + Math.PI / 2;
    halo.position.set(x + Math.cos(a) * 0.45, 2.55, z - Math.sin(a) * 0.45);
    halo.userData.noMerge = true;
    g.add(halo);
  }

  const flag = hall.getObjectByName('flag') as THREE.Mesh;
  return { group: g, ground, fountain, flag };
}

/* ───────────────────────── Mystery scenes ───────────────────────── */

/** What is left on the party table at the start (and what comes back at the party). */
export function makeMysteryScene(id: MysteryId): { before: THREE.Group; after: THREE.Group } {
  const before = new THREE.Group();
  const after = new THREE.Group();
  switch (id) {
    case 'cake': {
      const stand = cyl(0.5, 0.55, 0.06, '#ffffff', 18);
      stand.position.y = 1.05;
      const foot = cyl(0.08, 0.2, 0.25, '#ffffff', 10);
      foot.position.y = 0.95;
      before.add(stand, foot);
      for (let i = 0; i < 12; i++) {
        const cr = new THREE.Mesh(new THREE.DodecahedronGeometry(0.04, 0), mat(i % 3 ? '#e0a35a' : '#ff8fb8'));
        cr.position.set(Math.sin(i * 2.3) * 0.35, 1.1, Math.cos(i * 1.7) * 0.3);
        before.add(cr);
      }
      after.add(makeCake());
      break;
    }
    case 'trumpet': {
      const standPole = cyl(0.03, 0.03, 1.2, '#3a3040', 6);
      standPole.position.set(0, 1.55, 0);
      const desk = box(0.7, 0.45, 0.04, '#3a3040', false);
      desk.position.set(0, 2.15, 0.05);
      desk.rotation.x = -0.3;
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38), mat('#fffaf0'));
      sheet.position.set(0, 2.16, 0.09);
      sheet.rotation.x = -0.3;
      for (let i = 0; i < 4; i++) {
        const line = box(0.5, 0.012, 0.01, '#3a3040', false);
        line.position.set(0, 2.06 + i * 0.06, 0.12 + i * 0.018);
        line.rotation.x = -0.3;
        before.add(line);
      }
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 12, Math.PI), mat('#9aa3ad'));
      hook.position.set(0.5, 1.15, 0);
      before.add(standPole, desk, sheet, hook);
      const drum = cyl(0.35, 0.35, 0.35, '#ff5f6d', 16);
      drum.position.set(-0.6, 1.17, 0.2);
      const drumTop = cyl(0.36, 0.36, 0.03, '#fff6e0', 16);
      drumTop.position.set(-0.6, 1.35, 0.2);
      before.add(drum, drumTop);
      after.add(put(makeTrumpetSign(), 0.5, 1.3, 0));
      break;
    }
    case 'mud': {
      // A washing line with sheets covered in muddy paw prints.
      for (const x of [-1.6, 1.6]) {
        const p = cyl(0.05, 0.05, 2.1, '#8a5a3a', 6);
        p.position.set(x, 1.05, -0.9);
        before.add(p);
      }
      const rope = cyl(0.012, 0.012, 3.2, '#ffffff', 4, false);
      rope.rotation.z = Math.PI / 2;
      rope.position.set(0, 2.0, -0.9);
      before.add(rope);
      const sheetTex = pawTex(true);
      const clean = pawTex(false);
      [-0.8, 0.8].forEach((x) => {
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), new THREE.MeshLambertMaterial({ map: sheetTex, side: THREE.DoubleSide }));
        sh.position.set(x, 1.45, -0.88);
        sh.name = 'dirty';
        before.add(sh);
        const sh2 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), new THREE.MeshLambertMaterial({ map: clean, side: THREE.DoubleSide }));
        sh2.position.set(x, 1.45, -0.88);
        after.add(sh2);
      });
      // A puddle.
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), mat('#7a5232'));
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.set(1.4, 1, 1);
      puddle.position.set(1.8, 0.04, 0.9);
      before.add(puddle);
      break;
    }
    case 'flowers': {
      const bed = box(2.4, 0.3, 0.9, '#8a5a3a', false);
      bed.position.set(0, 0.15, 1.6);
      const rim = box(2.56, 0.2, 1.06, '#d9c9b2', false);
      rim.position.set(0, 0.1, 1.6);
      before.add(rim, bed);
      for (let i = 0; i < 8; i++) {
        const stem = cyl(0.015, 0.015, 0.3, '#4f9a3f', 4, false);
        stem.position.set(-1.0 + (i % 4) * 0.66, 0.45, 1.4 + Math.floor(i / 4) * 0.4);
        before.add(stem);
        const tulip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(['#ff5f8f', '#ffd166', '#ff7a45', '#c99bff'][i % 4]));
        tulip.scale.y = 1.4;
        tulip.position.set(stem.position.x, 0.68, stem.position.z);
        after.add(tulip);
      }
      const vase = cyl(0.14, 0.1, 0.3, '#7fc8ff', 10);
      vase.position.set(0, 1.12, 0);
      before.add(vase);
      break;
    }
    case 'balloons': {
      const cart = box(1.2, 0.5, 0.7, '#ffcc33');
      cart.position.set(0, 0.55, 1.6);
      for (const x of [-0.45, 0.45]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 12), mat('#3a3040'));
        wheel.position.set(x, 0.22, 1.95);
        before.add(wheel);
      }
      before.add(cart);
      // Empty strings dangling.
      for (let i = 0; i < 5; i++) {
        const s = cyl(0.006, 0.006, 0.8, '#ffffff', 3, false);
        s.position.set(-0.4 + i * 0.2, 1.2, 1.6);
        s.rotation.z = Math.sin(i * 2) * 0.3;
        before.add(s);
      }
      // At the party, a fresh bunch of balloons is back on the cart.
      ['#ff5f6d', '#ffd166', '#5fb8ff', '#7ed957', '#c99bff'].forEach((col, i) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mat(col, { emissive: new THREE.Color(col).multiplyScalar(0.15) }));
        b.scale.y = 1.18;
        b.position.set(-0.4 + i * 0.2, 2.0 + Math.sin(i * 2.1) * 0.25, 1.6 + Math.cos(i * 1.3) * 0.15);
        const line = cyl(0.006, 0.006, 1.0, '#ffffff', 3, false);
        line.position.set(-0.4 + i * 0.2, 1.3, 1.6);
        after.add(b, line);
      });
      break;
    }
  }
  before.position.copy(MYSTERY_SPOT);
  after.position.copy(MYSTERY_SPOT);
  after.visible = false;
  return { before, after };
}

function makeTrumpetSign(): THREE.Group {
  // A music note popping out of the stand once the trumpet is back.
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat('#7a4bc2'));
  head.scale.set(1.2, 0.9, 0.6);
  const stem = box(0.04, 0.45, 0.04, '#7a4bc2', false);
  stem.position.set(0.12, 0.22, 0);
  g.add(head, stem);
  return g;
}

export function makeCake(): THREE.Group {
  const g = new THREE.Group();
  const stand = cyl(0.5, 0.55, 0.06, '#ffffff', 18);
  stand.position.y = 1.05;
  const foot = cyl(0.08, 0.2, 0.25, '#ffffff', 10);
  foot.position.y = 0.95;
  const t1 = cyl(0.42, 0.42, 0.3, '#ffd6e6', 20);
  t1.position.y = 1.23;
  const t2 = cyl(0.3, 0.3, 0.26, '#fff0f6', 20);
  t2.position.y = 1.5;
  const icing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20), mat('#ffffff'));
  icing.rotation.x = Math.PI / 2;
  icing.position.y = 1.38;
  const berry = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat('#ff3b5c'));
  berry.position.y = 1.7;
  g.add(stand, foot, t1, t2, icing, berry);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), mat(['#ffd166', '#7fd0ff', '#9bf07f', '#c99bff'][i % 4]));
    dot.position.set(Math.cos(a) * 0.3, 1.66, Math.sin(a) * 0.3);
    g.add(dot);
  }
  const candle = cyl(0.025, 0.025, 0.18, '#7fd0ff', 6);
  candle.position.set(0.12, 1.75, 0.05);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), glowMat('#ffcf6e', 1.6));
  flame.position.set(0.12, 1.88, 0.05);
  g.add(candle, flame);
  return g;
}

/** A slice of cake on a little plate (one for every friend at the party). */
export function makeSlice(): THREE.Group {
  const g = new THREE.Group();
  const plate = cyl(0.2, 0.18, 0.03, '#ffffff', 12);
  const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 3, 1, false, 0, Math.PI / 3), mat('#ffd6e6'));
  slice.position.y = 0.1;
  const berry = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), mat('#ff3b5c'));
  berry.position.set(0.06, 0.2, 0.08);
  g.add(plate, slice, berry);
  return g;
}

function pawTex(muddy: boolean): THREE.CanvasTexture {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#cfe8ff';
    for (let i = 0; i < 6; i++) g.fillRect(0, i * 22 + 4, 128, 4);
    if (!muddy) return;
    g.fillStyle = '#7a4e2a';
    const paw = (x: number, y: number, s: number) => {
      g.beginPath();
      g.ellipse(x, y, 9 * s, 7 * s, 0, 0, Math.PI * 2);
      g.fill();
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.arc(x - 9 * s + k * 6 * s, y - 10 * s - (k === 1 || k === 2 ? 3 * s : 0), 3.2 * s, 0, Math.PI * 2);
        g.fill();
      }
    };
    paw(30, 40, 1.2);
    paw(70, 70, 1.1);
    paw(100, 30, 1.0);
    paw(45, 100, 1.2);
  });
}

/* ───────────────────────── Clue props ───────────────────────── */

export type CluePropKind = 'bow' | 'yarn' | 'case' | 'prints' | 'note';

/** The piece of evidence Ziggy finds at a clue spot. */
export function makeClueProp(kind: CluePropKind, color: string, big: boolean, picto?: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'bow': {
      // A ribbon fallen from a hat.
      for (const s of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), mat(color));
        loop.rotation.z = (s * Math.PI) / 2;
        loop.position.set(s * 0.15, 0.12, 0);
        loop.scale.z = 0.45;
        g.add(loop);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.3), mat(color));
        tail.position.set(s * 0.08, 0.02, 0.15);
        tail.rotation.y = s * 0.4;
        g.add(tail);
      }
      g.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(color)), 0, 0.12, 0));
      break;
    }
    case 'yarn': {
      // A ball of wool and a long thread caught on the way.
      const yb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat(color));
      yb.position.y = 0.2;
      g.add(yb);
      for (let i = 0; i < 3; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 4, 16), mat(new THREE.Color(color).multiplyScalar(0.8)));
        t.position.y = 0.2;
        t.rotation.set(i * 1.1, i * 0.7, 0);
        g.add(t);
      }
      const pts = [new THREE.Vector3(0.15, 0.1, 0), new THREE.Vector3(0.5, 0.03, 0.2), new THREE.Vector3(0.8, 0.03, -0.1), new THREE.Vector3(1.1, 0.04, 0.15)];
      const thread = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.018, 4), mat(color));
      g.add(thread);
      break;
    }
    case 'case': {
      // An open, empty glasses case.
      const base = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 8), mat('#2f3a4f'));
      base.rotation.z = Math.PI / 2;
      base.scale.set(1, 1, 0.6);
      base.position.y = 0.08;
      const lid = base.clone();
      lid.position.set(0, 0.2, -0.1);
      lid.rotation.x = -0.9;
      const lining = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.26, 4, 8), mat('#ff9fb8'));
      lining.rotation.z = Math.PI / 2;
      lining.scale.set(1, 1, 0.3);
      lining.position.set(0, 0.13, 0.02);
      g.add(base, lid, lining);
      break;
    }
    case 'prints': {
      // Footprints in the flour: big or small.
      const s = big ? 1.45 : 0.6;
      const m = new THREE.MeshBasicMaterial({ color: '#7a5a3a', transparent: true, opacity: 0.85, depthWrite: false });
      for (let i = 0; i < 4; i++) {
        const foot = new THREE.Group();
        const pad = new THREE.Mesh(new THREE.CircleGeometry(0.13 * s, 12), m);
        pad.rotation.x = -Math.PI / 2;
        pad.scale.set(1, 1.2, 1);
        foot.add(pad);
        for (let k = 0; k < 3; k++) {
          const toe = new THREE.Mesh(new THREE.CircleGeometry(0.045 * s, 8), m);
          toe.rotation.x = -Math.PI / 2;
          toe.position.set((k - 1) * 0.09 * s, 0, -0.2 * s);
          foot.add(toe);
        }
        foot.position.set((i % 2 ? 0.18 : -0.18) * s, 0.03, -i * 0.55 * s + 0.6);
        g.add(foot);
      }
      // A little flour patch under them.
      const flour = new THREE.Mesh(new THREE.CircleGeometry(1.0 * Math.max(1, s), 18), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }));
      flour.rotation.x = -Math.PI / 2;
      flour.position.y = 0.02;
      flour.scale.set(0.8, 1.3, 1);
      g.add(flour);
      break;
    }
    case 'note': {
      // A note from a little bird who saw everything.
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshLambertMaterial({ color: '#fffaf0', map: picto ?? null, side: THREE.DoubleSide }));
      paper.rotation.x = -Math.PI / 2 + 0.5;
      paper.position.y = 0.3;
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), mat('#ff5f6d'));
      pin.position.set(0, 0.6, -0.14);
      const stake = cyl(0.03, 0.03, 0.5, '#8a5a3a', 5);
      stake.position.set(0, 0.25, -0.2);
      g.add(stake, paper, pin);
      break;
    }
  }
  return g;
}
