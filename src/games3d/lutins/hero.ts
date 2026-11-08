import * as THREE from 'three';
import { glow, glowMat } from '../kit/look';
import { rng } from '../kit/rng';
import { Snowfall } from '../kit/world';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { cushionGeometry } from '../ziggy/shapes';
import { makeLightString, makeSoftPine, soft, twinkleBulbs } from '../santa/props';
import { planksTexture, wallpaperTexture } from '../santa/textures';
import { bowGeometry, canvasTexture, elfFelt, knitMaterial, knitTextures } from './craft';
import { heroView } from './framing';
import type { ElfId, ElfPose } from './types';

/**
 * The landing-page hero: a cosy living-room corner at night, seen from the
 * elves' height (they are 25 cm dolls, so the room is big around them).
 * The Christmas tree glows on the left, presents underneath, snow falls
 * behind a tall window, and the three elves are mid-prank: Pépin laughing
 * on a stack of books, Grelotte tiptoeing with a toilet-paper garland,
 * Noisette peeking out of a mug of marshmallows.
 */

export interface HeroSpot {
  id: ElfId;
  pos: THREE.Vector3;
  rotY: number;
  pose: ElfPose;
  side: 1 | -1;
}

export interface HeroSet {
  root: THREE.Group;
  background: THREE.Color;
  fog: THREE.Fog | null;
  spots: HeroSpot[];
  frame(aspect: number): { pos: THREE.Vector3; target: THREE.Vector3; fov: number };
  update(dt: number, t: number): void;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function shadowed<T extends THREE.Object3D>(o: T, cast = true, receive = true): T {
  o.traverse((x) => {
    if ((x as THREE.Mesh).isMesh) {
      x.castShadow = cast;
      x.receiveShadow = receive;
    }
  });
  return o;
}

/** A soft rounded box (books, presents). */
function roundBox(w: number, h: number, d: number, mat: THREE.Material, p = 7): THREE.Mesh {
  const m = new THREE.Mesh(cushionGeometry({ a: w / 2, b: h / 2, c: d / 2, p }, 24, 18), mat);
  return m;
}

/** The night outside the window: deep blue sky, moon glow, stars, snowy hills. */
function nightSkyTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 512, (g) => {
    const r = rng(12);
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0f1640');
    grad.addColorStop(0.55, '#26357a');
    grad.addColorStop(0.8, '#5d6fb8');
    grad.addColorStop(1, '#9fb0e6');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 512);
    const moon = g.createRadialGradient(760, 120, 0, 760, 120, 140);
    moon.addColorStop(0, 'rgba(255,250,230,0.95)');
    moon.addColorStop(0.18, 'rgba(255,248,225,0.9)');
    moon.addColorStop(0.22, 'rgba(220,226,255,0.35)');
    moon.addColorStop(1, 'rgba(160,180,255,0)');
    g.fillStyle = moon;
    g.fillRect(560, 0, 400, 300);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 160; i++) {
      g.globalAlpha = 0.35 + r() * 0.65;
      g.beginPath();
      g.arc(r() * 1024, r() * 300, 0.6 + r() * 1.5, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#dfe6ff';
    g.beginPath();
    g.moveTo(0, 512);
    g.lineTo(0, 400);
    g.bezierCurveTo(200, 340, 360, 420, 520, 390);
    g.bezierCurveTo(700, 350, 860, 400, 1024, 370);
    g.lineTo(1024, 512);
    g.fill();
  });
}

/** Toilet paper: soft white with perforation lines and a quilted pattern. */
function paperTexture(): THREE.CanvasTexture {
  const t = canvasTexture(256, 64, (g) => {
    g.fillStyle = '#fbfaf6';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = 'rgba(200,196,186,0.55)';
    for (let x = 0; x < 256; x += 8) for (let y = 4; y < 64; y += 8) g.fillRect(x + ((y / 8) % 2) * 4, y, 2, 2);
    g.fillStyle = 'rgba(170,165,155,0.8)';
    for (let y = 0; y < 64; y += 5) g.fillRect(126, y, 3, 3);
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** A flat paper strip following a curve (the toilet-paper garland). */
class Ribbon {
  readonly mesh: THREE.Mesh;
  private pos: THREE.BufferAttribute;
  constructor(
    private n: number,
    private width: number,
    mat: THREE.Material
  ) {
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array((n + 1) * 2 * 3), 3);
    const uv = new Float32Array((n + 1) * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      uv.set([i / 8, 0, i / 8, 1], i * 4);
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    g.setAttribute('position', this.pos);
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }
  set(points: THREE.Vector3[], twist = 0) {
    const curve = new THREE.CatmullRomCurve3(points);
    const up = V(0, 1, 0);
    const side = V();
    const tan = V();
    for (let i = 0; i <= this.n; i++) {
      const t = i / this.n;
      const p = curve.getPointAt(t);
      curve.getTangentAt(t, tan);
      side.crossVectors(tan, up);
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
      side.normalize().applyAxisAngle(tan, Math.sin(t * Math.PI * 3) * 0.6 + twist);
      const h = this.width / 2;
      this.pos.setXYZ(i * 2, p.x - side.x * h, p.y - side.y * h, p.z - side.z * h);
      this.pos.setXYZ(i * 2 + 1, p.x + side.x * h, p.y + side.y * h, p.z + side.z * h);
    }
    this.pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
  }
}

/** A big indoor tree: soft green tiers, felt baubles, warm bulbs. */
function makeTree(low: boolean): { group: THREE.Group; bulbs: THREE.Mesh[] } {
  const g = new THREE.Group();
  const r = rng(41);
  const needles = canvasTexture(256, 256, (c) => {
    const rr = rng(5);
    c.fillStyle = '#1f5236';
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const x = rr() * 256;
      const y = rr() * 256;
      const a = Math.PI / 2 + (rr() - 0.5) * 1.6;
      const l = 6 + rr() * 10;
      c.strokeStyle = rr() < 0.5 ? '#2f7a4c' : rr() < 0.5 ? '#173f2a' : '#3f8f5c';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.stroke();
    }
  });
  needles.wrapS = needles.wrapT = THREE.RepeatWrapping;
  needles.repeat.set(6, 3);
  const green = new THREE.MeshStandardMaterial({ map: needles, roughness: 0.95 });
  const tiers = [
    { r: 2.3, h: 2.4, y: 0.5 },
    { r: 1.9, h: 2.2, y: 1.9 },
    { r: 1.45, h: 2.0, y: 3.2 },
    { r: 1.0, h: 1.8, y: 4.4 },
  ];
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.8, 12), soft('#6b4226'));
  trunk.position.y = 0.4;
  g.add(trunk);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.48, 0.6, 24), soft('#b23a34', { roughness: 0.6 }));
  pot.position.y = 0.3;
  g.add(pot);
  const radiusAt = (y: number) => {
    let best = 0;
    for (const t of tiers) {
      const k = (y - t.y) / t.h;
      if (k >= 0 && k <= 1) best = Math.max(best, t.r * (1 - k) * (1 + 0.12 * Math.sin(k * Math.PI)));
    }
    return best;
  };
  for (const t of tiers) {
    const prof: THREE.Vector2[] = [V2(0.001, 0.0), V2(t.r * 0.94, 0)];
    for (let i = 0; i <= 10; i++) {
      const k = i / 10;
      // A scalloped skirt: soft bumps all round come from the lathe radius wobble below.
      prof.push(V2(Math.max(0.001, t.r * (1 - k) * (1 + 0.12 * Math.sin(k * Math.PI))), k * t.h));
    }
    const geo = new THREE.LatheGeometry(prof, low ? 18 : 40);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const a = Math.atan2(pos.getX(i), pos.getZ(i));
      const yy = pos.getY(i);
      const k = 1 + 0.06 * Math.sin(a * 9 + t.y) * (1 - yy / t.h);
      pos.setX(i, pos.getX(i) * k);
      pos.setZ(i, pos.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const cone = new THREE.Mesh(geo, green);
    cone.position.y = t.y;
    g.add(cone);
    // Soft drooping branch tips all round the tier's hem.
    const n = Math.round(t.r * 14);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.2;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 7), green);
      tip.position.set(Math.sin(a) * t.r * 0.86, t.y + 0.12, Math.cos(a) * t.r * 0.86);
      tip.rotation.set(Math.cos(a) * 1.9, 0, -Math.sin(a) * 1.9);
      g.add(tip);
    }
  }
  // Felt baubles and warm bulbs, on the side we see.
  const baubleCols = ['#d8322f', '#f2c14e', '#fbf6ee', '#3a9d4f', '#8a68ee'];
  const bulbs: THREE.Mesh[] = [];
  for (let i = 0; i < (low ? 18 : 34); i++) {
    const y = 0.8 + r() * 4.8;
    const a = 0.4 + (r() - 0.5) * 2.6;
    const rad = radiusAt(y) * 1.06 + 0.12;
    if (rad < 0.3) continue;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), elfFelt(baubleCols[i % baubleCols.length], { repeat: 1, lowPower: low }));
    b.position.set(Math.sin(a) * rad, y - 0.12, Math.cos(a) * rad);
    g.add(b);
  }
  for (let i = 0; i < (low ? 24 : 46); i++) {
    const t = i / 46;
    const y = 0.7 + t * 5.4;
    const a = t * 7 * Math.PI * 2;
    if (Math.cos(a - 0.6) < -0.1) continue;
    const rad = radiusAt(y) * 1.07 + 0.06;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glowMat('#ffcf7a', 1.9));
    bulb.position.set(Math.sin(a) * rad, y, Math.cos(a) * rad);
    bulb.userData.color = i % 5 === 0 ? '#ff9d6b' : '#ffd88a';
    bulbs.push(bulb);
    g.add(bulb);
    if (i % 3 === 0) {
      const h = glow('#ffc070', 0.32, 0.3);
      h.position.copy(bulb.position);
      g.add(h);
    }
  }
  return { group: shadowed(g, true, true), bulbs };
}

const V2 = (x: number, y: number) => new THREE.Vector2(x, y);

/** A wrapped present: paper pattern, ribbon bands, a felt bow. */
function makePresent(size: [number, number, number], paper: string, dots: string, ribbon: string, low: boolean): THREE.Group {
  const g = new THREE.Group();
  const tex = canvasTexture(128, 128, (c) => {
    c.fillStyle = paper;
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = dots;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        c.beginPath();
        c.arc(16 + x * 32 + (y % 2) * 16, 16 + y * 32, 6, 0, Math.PI * 2);
        c.fill();
      }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  const box = roundBox(size[0], size[1], size[2], new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), 9);
  box.position.y = size[1] / 2;
  const rib = new THREE.MeshStandardMaterial({ color: ribbon, roughness: 0.45, metalness: 0.1 });
  const b1 = roundBox(size[0] * 1.01, size[1] * 1.01, size[2] * 0.14, rib, 9);
  b1.position.y = size[1] / 2;
  const b2 = roundBox(size[0] * 0.14, size[1] * 1.01, size[2] * 1.01, rib, 9);
  b2.position.y = size[1] / 2;
  const bow = new THREE.Mesh(bowGeometry(Math.min(size[0], size[2]) * 0.3), elfFelt(ribbon, { repeat: 1, lowPower: low }));
  bow.position.y = size[1] + 0.02;
  bow.rotation.x = -0.6;
  g.add(box, b1, b2, bow);
  return shadowed(g);
}

/** A stack of chunky books (the elves' stage). Returns the top height. */
function makeBooks(): { group: THREE.Group; top: number } {
  const g = new THREE.Group();
  const cols = ['#2f5d9e', '#b8413a', '#d99a2b', '#3f7d57'];
  const pages = soft('#f1e6cf', { roughness: 0.95 });
  let y = 0;
  const r = rng(8);
  for (let i = 0; i < 4; i++) {
    const w = 1.0 - i * 0.07 + r() * 0.05;
    const d = 0.7 - i * 0.04;
    const h = 0.12 + r() * 0.035;
    const book = new THREE.Group();
    const coverMat = soft(cols[i % cols.length], { roughness: 0.65 });
    // Two boards and a rounded spine facing the camera; pages show on the other sides.
    for (const dy of [-1, 1]) {
      const board = new THREE.Mesh(new RoundedBoxGeometry(w, 0.022, d, 2, 0.008), coverMat);
      board.position.y = (dy * (h - 0.022)) / 2;
      book.add(board);
    }
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(h / 2, h / 2, w, 20, 1, false, 0, Math.PI), coverMat);
    spine.rotation.set(0, 0, Math.PI / 2);
    spine.rotation.order = 'ZYX';
    spine.rotation.y = Math.PI / 2;
    spine.scale.set(1, 1, 0.35);
    spine.position.z = d / 2 - 0.005;
    const block = new THREE.Mesh(new THREE.BoxGeometry(w - 0.03, h - 0.04, d - 0.02), pages);
    block.position.set(0, 0, -0.01);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.035, h + 0.004, 0.06), soft('#e8b84a', { metalness: 0.5, roughness: 0.35 }));
    band.position.set(-w * 0.32, 0, d / 2 + h * 0.12);
    const band2 = band.clone();
    band2.position.x = w * 0.32;
    book.add(spine, block, band, band2);
    book.position.y = y + h / 2;
    book.rotation.y = (r() - 0.5) * 0.3;
    g.add(book);
    y += h;
  }
  return { group: shadowed(g), top: y };
}

/** A big cocoa mug full of marshmallows (Noisette's hiding place). */
function makeMug(low: boolean): { group: THREE.Group; height: number; radius: number } {
  const g = new THREE.Group();
  const R = 0.26;
  const Hm = 0.38;
  const prof: THREE.Vector2[] = [V2(0.001, 0), V2(R - 0.02, 0), V2(R, 0.02), V2(R + 0.01, Hm - 0.03), V2(R + 0.012, Hm), V2(R - 0.02, Hm), V2(R - 0.03, Hm - 0.02), V2(R - 0.03, 0.04), V2(0.001, 0.04)];
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, low ? 24 : 56), new THREE.MeshPhysicalMaterial({ color: '#c8392f', roughness: 0.3, clearcoat: low ? 0 : 0.7, clearcoatRoughness: 0.15 }));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 12, 28, Math.PI * 1.25), new THREE.MeshPhysicalMaterial({ color: '#c8392f', roughness: 0.3 }));
  handle.position.set(R + 0.04, Hm * 0.5, 0);
  handle.rotation.z = -Math.PI * 0.62;
  const cocoa = new THREE.Mesh(new THREE.CircleGeometry(R - 0.03, 40), soft('#6b3a1f', { roughness: 0.4 }));
  cocoa.rotation.x = -Math.PI / 2;
  cocoa.position.y = Hm - 0.07;
  g.add(body, handle, cocoa);
  const r = rng(77);
  const mallow = soft('#fff6f0', { roughness: 0.95 });
  const pink = soft('#ffd3dc', { roughness: 0.95 });
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const rr = 0.06 + r() * 0.15;
    const m = roundBox(0.075, 0.06, 0.075, i % 4 === 0 ? pink : mallow, 3);
    m.position.set(Math.cos(a) * rr, Hm - 0.05 + r() * 0.03, Math.sin(a) * rr);
    m.rotation.set(r() * 1.5, r() * 3, r() * 1.5);
    g.add(m);
  }
  for (let i = 0; i < 4; i++) {
    const m = roundBox(0.075, 0.06, 0.075, i % 2 ? pink : mallow, 3);
    m.position.set(-0.35 + i * 0.22 + r() * 0.05, 0.03, 0.3 + r() * 0.12);
    m.rotation.y = r() * 3;
    g.add(m);
  }
  return { group: shadowed(g), height: Hm, radius: R };
}

export function buildHero(o: { lowPower: boolean; energy: number }): HeroSet {
  const low = o.lowPower;
  const root = new THREE.Group();

  // Floor and a round knitted rug.
  const floorTex = planksTexture('#93603a', 6);
  floorTex.repeat.set(5, 5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  const rugKnit = knitTextures({ colors: ['#e9dcc6', '#e9dcc6', '#d8c6a8'], rowsPerStripe: 4, cols: 10, rows: 12, seed: 44 });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), knitMaterial(rugKnit, [18, 18], low, '#fff4e6'));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.4, 0.008, 0.5);
  rug.receiveShadow = true;
  root.add(rug);

  // Back wall with a tall window.
  const wallZ = -3.4;
  const win = { x: 0.9, y: 2.5, w: 3.6, h: 3.8 };
  const wall = new THREE.Shape();
  wall.moveTo(-14, 0);
  wall.lineTo(14, 0);
  wall.lineTo(14, 12);
  wall.lineTo(-14, 12);
  wall.closePath();
  const hole = new THREE.Path();
  hole.moveTo(win.x - win.w / 2, win.y - win.h / 2);
  hole.lineTo(win.x + win.w / 2, win.y - win.h / 2);
  hole.lineTo(win.x + win.w / 2, win.y + win.h / 2);
  hole.lineTo(win.x - win.w / 2, win.y + win.h / 2);
  hole.closePath();
  wall.holes.push(hole);
  const wp = wallpaperTexture();
  wp.repeat.set(0.3, 0.3);
  const wallMesh = new THREE.Mesh(new THREE.ShapeGeometry(wall), new THREE.MeshStandardMaterial({ map: wp, roughness: 0.95 }));
  wallMesh.position.z = wallZ;
  wallMesh.receiveShadow = true;
  root.add(wallMesh);
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(28, 0.35, 0.08), soft('#f1e6d2'));
  skirting.position.set(0, 0.175, wallZ + 0.04);
  root.add(skirting);
  const trim = soft('#f3ead8', { roughness: 0.6 });
  for (const [w, h, x, y] of [
    [win.w + 0.36, 0.18, 0, win.h / 2 + 0.08],
    [win.w + 0.5, 0.2, 0, -win.h / 2 - 0.08],
    [0.18, win.h + 0.2, -win.w / 2 - 0.08, 0],
    [0.18, win.h + 0.2, win.w / 2 + 0.08, 0],
    [0.07, win.h, 0, 0],
    [win.w, 0.07, 0, 0.35],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), trim);
    bar.position.set(win.x + x, win.y + y, wallZ + 0.02);
    bar.castShadow = true;
    root.add(bar);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(win.w + 0.7, 0.08, 0.45), trim);
  sill.position.set(win.x, win.y - win.h / 2 - 0.16, wallZ + 0.2);
  root.add(shadowed(sill));
  // Outside: the night, snowy pines, falling snow.
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: nightSkyTexture(), toneMapped: false }));
  sky.position.set(win.x, 2.6, wallZ - 6);
  root.add(sky);
  const snowGround = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), new THREE.MeshBasicMaterial({ color: '#b9c6f0', toneMapped: false }));
  snowGround.rotation.x = -Math.PI / 2;
  snowGround.position.set(win.x, 0.6, wallZ - 3);
  root.add(snowGround);
  for (const [x, z, s] of [
    [-1.4, -7.5, 0.8],
    [0.5, -9.0, 1.0],
    [2.4, -8.0, 0.75],
    [3.8, -9.6, 0.95],
  ]) {
    const p = makeSoftPine(s, Math.round(x * 10 + 50), true);
    p.position.set(win.x + x, 0.6, z);
    p.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // Night: greens go deep blue-green, the snow stays pale blue.
      if (mat.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.6) mat.color.lerp(new THREE.Color('#2a4a78'), 0.55);
      else mat.color.set('#c9d4f6');
    });
    root.add(p);
  }
  const snow = new Snowfall(low ? 70 : 160, win.w + 1, win.h + 1);
  snow.points.position.set(win.x, win.y - win.h / 2 - 0.4, wallZ - 1.2);
  snow.points.scale.set(1, 1, 0.5);
  (snow.points.material as THREE.PointsMaterial).size = 0.07;
  root.add(snow.points);
  // A string of warm fairy lights along the top of the window.
  const lights = makeLightString(V(-win.w / 2, 0, 0), V(win.w / 2, 0, 0), 16, 0.35, 0.05);
  lights.position.set(win.x, win.y + win.h / 2 - 0.05, wallZ + 0.15);
  root.add(lights);

  // The tree and the presents.
  const tree = makeTree(low);
  tree.group.position.set(-3.3, 0, -1.9);
  root.add(tree.group);
  const presents: [number, number, number, number, string, string, string][] = [
    [-2.15, -0.9, 0.2, 0.62, '#d8322f', '#ffe9c9', '#f2c14e'],
    [-1.45, -0.55, -0.3, 0.42, '#2f6fb2', '#bfe0ff', '#fbf6ee'],
    [-2.7, -0.15, 0.4, 0.5, '#3a9d4f', '#d8ffd0', '#d8322f'],
    [-1.75, -1.6, 0.1, 0.7, '#8a68ee', '#ffe28a', '#f2c14e'],
  ];
  for (const [x, z, ry, s, paper, dots, ribbon] of presents) {
    const p = makePresent([s, s * 0.8, s * 0.9], paper, dots, ribbon, low);
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    root.add(p);
  }

  // The books (Pépin's stage) and the mug (Noisette's hiding place).
  const books = makeBooks();
  books.group.position.set(-0.8, 0, 0.05);
  root.add(books.group);
  const mug = makeMug(low);
  mug.group.position.set(1.55, 0, 0.55);
  mug.group.rotation.y = -0.5;
  root.add(mug.group);

  // Grelotte's toilet-paper garland: a roll on the floor by her feet, the
  // strip looping up over the books and off to the tree.
  const paperMat = new THREE.MeshStandardMaterial({ map: paperTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const roll = new THREE.Group();
  const rollBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.13, 28, 1, true), paperMat);
  const rollEnds = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.12, 28), soft('#f2efe8', { side: THREE.DoubleSide }));
  rollEnds.rotation.x = -Math.PI / 2;
  rollEnds.position.y = 0.065;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.132, 16, 1, true), soft('#c9a57a', { side: THREE.DoubleSide }));
  roll.add(rollBody, rollEnds, core);
  roll.rotation.set(Math.PI / 2, 0, 0.4);
  roll.position.set(0.72, 0.12, 0.62);
  root.add(shadowed(roll));
  const ribbon = new Ribbon(110, 0.12, paperMat);
  root.add(ribbon.mesh);
  const ribbonPts = [V(0.64, 0.05, 0.6), V(0.3, 0.02, 0.75), V(-0.05, 0.12, 0.55), V(-0.32, books.top + 0.05, 0.35), V(-0.75, books.top + 0.12, 0.18), V(-1.3, books.top + 0.02, -0.1), V(-1.7, 0.9, -0.6), V(-2.1, 1.7, -1.05), V(-2.4, 2.3, -1.3)];
  ribbon.set(ribbonPts);

  // Lights: a warm lamp from the right, the tree glow, moonlight from the window.
  root.add(new THREE.HemisphereLight('#7f8fd6', '#3a2418', 0.55));
  const lamp = new THREE.DirectionalLight('#ffd3a3', 2.2);
  lamp.position.set(4.5, 5.5, 5.5);
  lamp.target.position.set(0.2, 0.6, 0.2);
  lamp.castShadow = true;
  const sm = low ? 1024 : 2048;
  lamp.shadow.mapSize.set(sm, sm);
  Object.assign(lamp.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 25 });
  lamp.shadow.bias = -0.0004;
  lamp.shadow.normalBias = 0.02;
  root.add(lamp, lamp.target);
  const treeGlow = new THREE.PointLight('#ffb35c', 3, 6, 1.6);
  treeGlow.position.set(-1.6, 1.4, 0.4);
  root.add(treeGlow);
  const moon = new THREE.DirectionalLight('#9fb6ff', 1.1);
  moon.position.set(1.5, 4, -8);
  moon.target.position.set(0.3, 0.5, 0.3);
  root.add(moon, moon.target);
  const fill = new THREE.DirectionalLight('#ffe9d6', 0.6);
  fill.position.set(0, 1.5, 8);
  fill.target.position.set(0.3, 0.6, 0.3);
  root.add(fill, fill.target);

  const spots: HeroSpot[] = [
    { id: 'pepin', pos: V(-0.8, books.top, 0.08), rotY: 0.28, pose: 'laugh', side: 1 },
    { id: 'grelotte', pos: V(0.45, 0, 0.42), rotY: -0.45, pose: 'tiptoe', side: 1 },
    { id: 'noisette', pos: V(1.55, 0.19, 0.64), rotY: -0.25, pose: 'peek', side: -1 },
  ];
  const bulbs = [...tree.bulbs, ...lights.userData.bulbs];
  const focus = { x: 0.35, y: 0.62, z: 0.35 };

  return {
    root,
    background: new THREE.Color('#141029'),
    fog: null,
    spots,
    frame(aspect) {
      const v = heroView(aspect, focus, 3.3, 1.45);
      return { pos: V(v.pos.x, v.pos.y, v.pos.z), target: V(v.target.x, v.target.y, v.target.z), fov: v.fov };
    },
    update(dt, t) {
      twinkleBulbs(bulbs, t, o.energy);
      snow.update(dt, t, V(0, 0, 0));
      // The garland flutters a little.
      const k = Math.sin(t * 1.3) * 0.02 * o.energy;
      ribbonPts[3].y = books.top + 0.05 + k;
      ribbonPts[6].x = -1.7 + k;
      ribbon.set(ribbonPts, k);
    },
  };
}
