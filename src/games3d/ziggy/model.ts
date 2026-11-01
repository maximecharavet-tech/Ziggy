import * as THREE from 'three';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';
import { felt, isSharedTexture, ribbedFabric } from './felt';
import { faceTextures, isFaceTexture, lidShapes, type MouthShape } from './face';
import { cushionGeometry, cushionPoint, discPatch, frontZ, heartShape, projectOnto, rectPatch, ribbedGeometry, tubeAlong, type Cushion } from './shapes';
import type { ZiggyAccessory } from './types';

/**
 * Ziggy, the plush robot of the photos and the film, built in code:
 * a big felt cushion head (wider than the body) with stitched seams, two
 * antennas with felt balls, round "headphone" ear pads, embroidered eyes
 * with lashes and brows, a thread smile, a glowing heart with an orange
 * stitched outline, grey ribbed arms and legs, green mittens and boots.
 *
 * Origin on the ground between the boots, facing +z, about 2 units tall
 * (2.35 with the antennas).
 */

export const ZIGGY_COLORS = {
  felt: '#5f9f43',
  feltShade: '#548f3a',
  seam: '#4c8634',
  stalk: '#4f8a36',
  ribs: '#6f6c78',
  band: '#5f5c68',
  heart: '#ffe7a0',
  heartGlow: '#ffd25e',
  stitch: '#f2952f',
};

/** Head, body and boot cushions (head-local / body-local coordinates). */
export const HEAD: Cushion = { a: 0.55, b: 0.445, c: 0.44, p: 2.75 };
export const BODY: Cushion = { a: 0.31, b: 0.3, c: 0.255, p: 2.6 };
const BOOT: Cushion = { a: 0.155, b: 0.15, c: 0.215, p: 2.5 };
const HAND: Cushion = { a: 0.112, b: 0.142, c: 0.085, p: 2.3 };

const HEAD_Y = 1.555;
const NECK_Y = 1.105;
const BODY_Y = 0.805;
const EYE_R = 0.148;
const EYE_X = 0.245;
const EYE_Y = -0.03;

export interface ArmRig {
  shoulder: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
}

export interface LegRig {
  hip: THREE.Group;
  boot: THREE.Mesh;
}

export interface ZiggyModel {
  root: THREE.Group;
  /** Bounce and squash pivot (on the ground). */
  body: THREE.Group;
  torso: THREE.Mesh;
  /** Neck pivot: nod, tilt, turn. */
  head: THREE.Group;
  antennas: [THREE.Group, THREE.Group];
  arms: [ArmRig, ArmRig];
  legs: [LegRig, LegRig];
  eyes: [Eye, Eye];
  brows: [THREE.Mesh, THREE.Mesh];
  mouth: THREE.Mesh;
  setMouth(shape: MouthShape): void;
  heart: THREE.Group;
  heartMat: THREE.MeshStandardMaterial;
  heartGlow: THREE.Sprite;
  heartLight: THREE.PointLight | null;
  /** Where carried things sit (in front of the chest). */
  carry: THREE.Group;
  /** Top of the head, for hats. */
  hatAnchor: THREE.Group;
  accessory: THREE.Group;
  setAccessory(a: ZiggyAccessory): void;
  dispose(): void;
}

export interface BuildOptions {
  lowPower?: boolean;
  accessory?: ZiggyAccessory;
  shadows?: boolean;
  /** Add a small warm light in the heart that lights the chin (like the photos). */
  heartLight?: boolean;
}

// ---------------------------------------------------------------------------

/** Mirror a geometry left/right without turning it inside out. */
function mirrorX(g: THREE.BufferGeometry) {
  g.scale(-1, 1, 1);
  const idx = g.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, b);
    }
    idx.needsUpdate = true;
  } else {
    // Non-indexed: swap the 2nd and 3rd vertex of every triangle in every attribute.
    for (const attr of Object.values(g.attributes) as THREE.BufferAttribute[]) {
      const n = attr.itemSize;
      for (let t = 0; t < attr.count; t += 3)
        for (let k = 0; k < n; k++) {
          const a = attr.array[(t + 1) * n + k];
          attr.array[(t + 1) * n + k] = attr.array[(t + 2) * n + k];
          attr.array[(t + 2) * n + k] = a;
        }
      attr.needsUpdate = true;
    }
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A flat shape laid on the head. It is first cut into small triangles so it
 * can follow the curve of the felt (big flat triangles would sink into it).
 */
function shapePatch(shapes: THREE.Shape | THREE.Shape[], mirror: boolean, cx: number, cy: number, lift: number) {
  let g: THREE.BufferGeometry = new THREE.ShapeGeometry(shapes, 6);
  g = new TessellateModifier(0.012, 8).modify(g);
  if (mirror) mirrorX(g);
  return projectOnto(g, HEAD, cx, cy, lift);
}

/** One embroidered eye: white, moving iris, felt eyelid, lash line. */
export class Eye {
  readonly group = new THREE.Group();
  private iris: THREE.Mesh;
  private irisTex: THREE.Texture;
  private lid: THREE.Mesh;
  private lash: THREE.Mesh;
  private cache = new Map<string, { lid: THREE.BufferGeometry | null; lash: THREE.BufferGeometry }>();
  private key = '';
  private irisScale = 0.9;

  constructor(
    private cx: number,
    private cy: number,
    private mirror: boolean,
    headMat: THREE.Material,
    lashMat: THREE.Material
  ) {
    const t = faceTextures();
    const decal = (map: THREE.Texture, order: number) =>
      new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -order * 0.5, polygonOffsetUnits: -order });
    const sclera = new THREE.Mesh(discPatch(EYE_R, HEAD, cx, cy, 0.004), decal(t.sclera, 1));
    this.irisTex = t.iris.clone();
    this.irisTex.repeat.set(this.irisScale, this.irisScale);
    this.iris = new THREE.Mesh(discPatch(EYE_R * 0.985, HEAD, cx, cy, 0.006), decal(this.irisTex, 2));
    // The lid and lashes must win over the (transparent) eye decals beneath.
    const lidMat = headMat.clone();
    // Drawn in the same (sorted) pass as the eye decals, after them.
    lidMat.transparent = true;
    lidMat.polygonOffset = true;
    lidMat.polygonOffsetFactor = -6;
    lidMat.polygonOffsetUnits = -6;
    this.lid = new THREE.Mesh(new THREE.BufferGeometry(), lidMat);
    this.lash = new THREE.Mesh(new THREE.BufferGeometry(), lashMat);
    sclera.renderOrder = 1;
    this.iris.renderOrder = 2;
    this.lid.renderOrder = 3;
    this.lash.renderOrder = 4;
    this.group.add(sclera, this.iris, this.lid, this.lash);
    this.setGaze(0, 0);
    this.setOpen(1, false);
  }

  /** Where the eye looks, -1..1 on each axis. */
  setGaze(x: number, y: number) {
    const k = this.irisScale;
    const m = 0.2;
    this.irisTex.offset.set(0.5 - 0.5 * k - Math.max(-1, Math.min(1, x)) * m * k, 0.5 - 0.5 * k - Math.max(-1, Math.min(1, y)) * m * k);
  }

  /** 1 = wide open, 0 = closed (sleeping), `happy` = closed in a smiling arch. */
  setOpen(open: number, happy: boolean) {
    const q = happy ? 'h' : (Math.round(Math.max(0, Math.min(1, open)) * 20) / 20).toFixed(2);
    if (q === this.key) return;
    this.key = q;
    let entry = this.cache.get(q);
    if (!entry) {
      entry = happy ? this.buildHappy() : this.build(Number(q));
      this.cache.set(q, entry);
    }
    this.lid.geometry = entry.lid ?? new THREE.BufferGeometry();
    this.lid.visible = Boolean(entry.lid);
    this.lash.geometry = entry.lash;
  }

  private build(open: number) {
    const s = lidShapes(EYE_R, open);
    return {
      lid: s.lid ? shapePatch(s.lid, this.mirror, this.cx, this.cy, 0.0085) : null,
      lash: shapePatch([s.lash, ...s.lashes], this.mirror, this.cx, this.cy, 0.0105),
    };
  }

  /** ^ ^ — the eye closed in a happy arch (cheering, giggling, love). */
  private buildHappy() {
    const R = EYE_R;
    const lid = new THREE.Shape();
    lid.absarc(0, 0, R * 1.08, 0, Math.PI * 2, false);
    const arch = new THREE.Shape();
    const n = 24;
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const x = -R * 0.85 + (1.7 * R * i) / n;
      pts.push([x, -R * 0.2 + R * 0.42 * (1 - (x / (R * 0.85)) ** 2)]);
    }
    arch.moveTo(pts[0][0], pts[0][1]);
    pts.forEach(([x, y]) => arch.lineTo(x, y + R * 0.07));
    for (let i = n; i >= 0; i--) arch.lineTo(pts[i][0], pts[i][1] - R * 0.07);
    arch.closePath();
    return { lid: shapePatch(lid, this.mirror, this.cx, this.cy, 0.0085), lash: shapePatch(arch, this.mirror, this.cx, this.cy, 0.0105) };
  }

  dispose() {
    (this.lid.material as THREE.Material).dispose();
    for (const e of this.cache.values()) {
      e.lid?.dispose();
      e.lash.dispose();
    }
    this.irisTex.dispose();
  }
}

// ---------------------------------------------------------------------------

function seam(points: THREE.Vector3[], mat: THREE.Material, r = 0.0042) {
  const m = new THREE.Mesh(tubeAlong(points, r, Math.max(12, points.length * 3), 6), mat);
  return m;
}

/** Points on the front of a cushion along a 2D polyline, slightly sunk in. */
function frontLine(s: Cushion, pts: [number, number][], sink = 0.002, zScale = (_y: number) => 1) {
  return pts.map(([x, y]) => new THREE.Vector3(x, y, frontZ(s, x, y) * zScale(y) - sink));
}

/** A path over the cushion surface from direction to direction. */
function surfaceArc(s: Cushion, from: THREE.Vector3, to: THREE.Vector3, n = 16, sink = 0.002) {
  const out: THREE.Vector3[] = [];
  const d = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    d.copy(from).lerp(to, i / n).normalize();
    const p = cushionPoint(s, d);
    out.push(p.multiplyScalar(1 - sink / p.length()));
  }
  return out;
}

function stitchTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f39a34';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(255,214,140,0.65)';
  g.lineWidth = 5;
  for (let i = -64; i < 128; i += 12) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 40, 64);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(26, 26);
  return t;
}

function heartGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 60, 4, 64, 64, 64);
  grad.addColorStop(0, '#fffbe8');
  grad.addColorStop(0.3, '#fff09a');
  grad.addColorStop(0.65, '#ffd544');
  grad.addColorStop(1, '#ffae2a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,240,190,0.9)');
  grad.addColorStop(0.3, 'rgba(255,214,110,0.45)');
  grad.addColorStop(1, 'rgba(255,190,80,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Bend a flat (x, y) geometry onto the front of the body cushion. */
function wrapOnBody(g: THREE.BufferGeometry, cy: number, baseZ: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const z0 = frontZ(BODY, 0, cy);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, pos.getZ(i) + baseZ + (frontZ(BODY, x, cy + y) - z0));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------

export function buildZiggy(opts: BuildOptions = {}): ZiggyModel {
  const low = Boolean(opts.lowPower);
  const seg = low ? 0.55 : 1;
  const S = (n: number) => Math.max(8, Math.round(n * seg));
  const shadows = opts.shadows ?? true;

  const headMat = felt(ZIGGY_COLORS.felt, { repeat: 5, lowPower: low });
  const bodyMat = felt(ZIGGY_COLORS.felt, { repeat: 4, lowPower: low });
  const partMat = felt(ZIGGY_COLORS.felt, { repeat: 2, lowPower: low });
  const stalkMat = felt(ZIGGY_COLORS.stalk, { repeat: 1, lowPower: low });
  const seamMat = new THREE.MeshStandardMaterial({ color: ZIGGY_COLORS.seam, roughness: 1, transparent: true, opacity: 0.55 });
  const ribMat = ribbedFabric(ZIGGY_COLORS.ribs, low);
  const bandMat = ribbedFabric(ZIGGY_COLORS.band, low);
  const lashMat = new THREE.MeshStandardMaterial({ color: '#17141c', roughness: 0.55, transparent: true, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });

  const root = new THREE.Group();
  root.name = 'ziggy';
  const body = new THREE.Group();
  root.add(body);

  // --- Torso -----------------------------------------------------------------
  const torso = new THREE.Mesh(
    cushionGeometry(BODY, S(40), S(28), (v) => {
      v.x *= 1 - 0.07 * (v.y / BODY.b);
      v.z *= 1 - 0.04 * (v.y / BODY.b);
    }),
    bodyMat
  );
  torso.position.y = BODY_Y;
  body.add(torso);
  const bodyZ = (y: number) => 1 - 0.04 * (y / BODY.b);
  // Seams: down the middle (around the heart) and two side panels.
  {
    torso.add(seam(frontLine(BODY, [[0, 0.29], [0, 0.22], [0, 0.18]], 0.002, bodyZ), seamMat, 0.004));
    torso.add(seam(frontLine(BODY, [[0, -0.12], [0, -0.2], [0, -0.27]], 0.002, bodyZ), seamMat, 0.004));
    for (const sx of [-1, 1]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 10; i++) {
        const y = 0.27 - (0.54 * i) / 10;
        pts.push([sx * (0.205 + 0.02 * Math.sin((i / 10) * Math.PI)), y]);
      }
      torso.add(seam(frontLine(BODY, pts, 0.002, bodyZ), seamMat, 0.004));
    }
  }

  // --- Heart -----------------------------------------------------------------
  const heart = new THREE.Group();
  const heartY = 0.045;
  const heartTex = heartGlowTexture();
  heartTex.repeat.set(1 / 0.32, 1 / 0.32);
  heartTex.offset.set(0.5, 0.45);
  const heartMat = new THREE.MeshStandardMaterial({
    color: ZIGGY_COLORS.heart,
    emissive: '#ffffff',
    emissiveMap: heartTex,
    emissiveIntensity: 1,
    roughness: 0.75,
  });
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(0.28), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.024, bevelSize: 0.022, bevelSegments: low ? 2 : 5, curveSegments: 24 });
  const heartBase = frontZ(BODY, 0, heartY) * bodyZ(heartY) - 0.012;
  const heartMesh = new THREE.Mesh(wrapOnBody(heartGeo, heartY, heartBase), heartMat);
  const ring = heartShape(0.385);
  ring.holes.push(heartShape(0.325));
  const stitchMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: stitchTexture(), emissive: ZIGGY_COLORS.stitch, emissiveIntensity: 0.35, roughness: 0.8 });
  const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.004, bevelSegments: 2, curveSegments: 24 });
  const ringMesh = new THREE.Mesh(wrapOnBody(ringGeo, heartY, heartBase + 0.002), stitchMat);
  const heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: '#ffd77a', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  heartGlow.scale.setScalar(0.85);
  heartGlow.position.set(0, heartY + 0.01, heartBase + 0.08);
  heart.add(heartMesh, ringMesh, heartGlow);
  heart.position.y = BODY_Y;
  body.add(heart);
  let heartLight: THREE.PointLight | null = null;
  if (opts.heartLight ?? !low) {
    heartLight = new THREE.PointLight('#ffcf66', 0.4, 1.3, 2);
    heartLight.position.set(0, BODY_Y + heartY + 0.06, heartBase + 0.22);
    body.add(heartLight);
  }

  // --- Head ------------------------------------------------------------------
  const head = new THREE.Group();
  head.position.y = NECK_Y;
  body.add(head);
  const skull = new THREE.Group();
  skull.position.y = HEAD_Y - NECK_Y;
  head.add(skull);
  const headMesh = new THREE.Mesh(cushionGeometry(HEAD, S(56), S(40)), headMat);
  skull.add(headMesh);
  {
    // Seam over the top, from the forehead to the back, and the two face panels.
    skull.add(seam(surfaceArc(HEAD, new THREE.Vector3(0, 0.55, 0.85), new THREE.Vector3(0, 1, -0.9), 22), seamMat));
    for (const sx of [-1, 1]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 14; i++) {
        const y = 0.34 - (0.7 * i) / 14;
        pts.push([sx * (0.43 + 0.035 * Math.sin((i / 14) * Math.PI)), y]);
      }
      skull.add(seam(frontLine(HEAD, pts), seamMat));
    }
    // Chin seam where the head meets the neck.
    const chin: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
      const x = -0.36 + (0.72 * i) / 16;
      chin.push([x, -0.375 - 0.02 * Math.cos((x / 0.36) * Math.PI * 0.5)]);
    }
    skull.add(seam(frontLine(HEAD, chin), seamMat));
  }

  // Ear pads ("headphones").
  const earProfile = [
    [0.0001, -0.075],
    [0.135, -0.075],
    [0.172, -0.062],
    [0.188, -0.03],
    [0.19, 0],
    [0.188, 0.03],
    [0.172, 0.062],
    [0.135, 0.075],
    [0.0001, 0.075],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.LatheGeometry(earProfile, S(32)), partMat);
    pad.rotation.z = Math.PI / 2;
    ear.add(pad);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 8, S(32)), seamMat);
    inner.rotation.y = Math.PI / 2;
    inner.position.x = sx * 0.073;
    ear.add(inner);
    ear.position.set(sx * (HEAD.a - 0.005), -0.04, -0.02);
    skull.add(ear);
  }

  // Antennas: thin felt stalks with felt balls; pivots for the spring wobble.
  const antennas: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group();
    const base = cushionPoint(HEAD, new THREE.Vector3(sx * 0.42, 1, 0.05));
    piv.position.copy(base).multiplyScalar(0.985);
    const stalk = new THREE.Mesh(
      tubeAlong([new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(sx * 0.03, 0.12, 0), new THREE.Vector3(sx * 0.085, 0.24, -0.01), new THREE.Vector3(sx * 0.14, 0.33, -0.015)], 0.024, 20, 8),
      stalkMat
    );
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.084, S(20), S(14)), partMat);
    ball.position.set(sx * 0.158, 0.39, -0.015);
    piv.add(stalk, ball);
    skull.add(piv);
    antennas.push(piv);
  }

  // Face.
  const eyes = [-1, 1].map((sx) => new Eye(sx * EYE_X, EYE_Y, sx < 0, headMat, lashMat)) as [Eye, Eye];
  eyes.forEach((e) => skull.add(e.group));
  const ft = faceTextures();
  const browMat = new THREE.MeshStandardMaterial({ map: ft.brow, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const brows = [-1, 1].map((sx) => {
    // Laid on the felt at its place, then re-centred so it can lift and tilt about itself.
    const bx = sx * 0.26;
    const by = 0.195;
    const bz = frontZ(HEAD, bx, by);
    const m = new THREE.Mesh(rectPatch(0.2, 0.075, HEAD, bx, by, 0.005).translate(-bx, -by, -bz), browMat);
    m.position.set(bx, by, bz);
    m.userData.rest = m.position.clone();
    return m;
  }) as unknown as [THREE.Mesh, THREE.Mesh];
  brows.forEach((b) => skull.add(b));
  const mouthMats = Object.fromEntries(
    (Object.keys(ft.mouths) as MouthShape[]).map((k) => [
      k,
      new THREE.MeshStandardMaterial({ map: ft.mouths[k], transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    ])
  ) as Record<MouthShape, THREE.MeshStandardMaterial>;
  const mouth = new THREE.Mesh(rectPatch(0.27, 0.17, HEAD, 0.01, -0.215, 0.005), mouthMats.smile);
  skull.add(mouth);

  const hatAnchor = new THREE.Group();
  hatAnchor.position.set(0, HEAD.b * 0.97, 0.02);
  skull.add(hatAnchor);

  // --- Arms ------------------------------------------------------------------
  const arms = [-1, 1].map((sx) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.335, 1.0, 0);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.102, S(20), S(14)), partMat);
    ball.scale.set(1, 0.95, 1);
    shoulder.add(ball);
    const upper = new THREE.Mesh(ribbedGeometry(0.22, 0.058, 5, 0.014, S(18)), ribMat);
    upper.position.y = -0.04;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.25;
    shoulder.add(elbow);
    const cuff = new THREE.Mesh(cushionGeometry({ a: 0.078, b: 0.06, c: 0.078, p: 2.6 }, S(20), S(12)), partMat);
    cuff.position.y = -0.04;
    const band = new THREE.Mesh(ribbedGeometry(0.035, 0.07, 1, 0.008, S(18)), bandMat);
    band.position.y = -0.09;
    elbow.add(cuff, band);
    const wrist = new THREE.Group();
    wrist.position.y = -0.12;
    elbow.add(wrist);
    const palm = new THREE.Mesh(cushionGeometry(HAND, S(24), S(18)), partMat);
    palm.position.y = -0.12;
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.06, 4, S(10)), partMat);
    thumb.position.set(-sx * 0.085, -0.085, 0.035);
    thumb.rotation.set(0.3, 0, -sx * 0.7);
    wrist.add(palm, thumb);
    shoulder.rotation.z = sx * 0.16;
    body.add(shoulder);
    return { shoulder, elbow, wrist };
  }) as [ArmRig, ArmRig];

  // --- Legs ------------------------------------------------------------------
  const legs = [-1, 1].map((sx) => {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.15, 0.53, 0);
    const leg = new THREE.Mesh(ribbedGeometry(0.25, 0.064, 4, 0.014, S(18)), ribMat);
    hip.add(leg);
    const boot = new THREE.Mesh(
      cushionGeometry(BOOT, S(32), S(22), (v) => {
        if (v.y < -0.09) v.y = -0.09 + (v.y + 0.09) * 0.45;
        if (v.z > 0) v.y *= 1 - 0.18 * (v.z / BOOT.c) * (v.y > 0 ? 1 : 0);
      }),
      partMat
    );
    const sole = 0.09 + (BOOT.b - 0.09) * 0.45;
    boot.position.set(sx * 0.008, -0.53 + sole, 0.045);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.03, 10, S(26)), partMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, boot.position.y + 0.115, 0.0);
    hip.add(boot, rim);
    body.add(hip);
    return { hip, boot };
  }) as unknown as [LegRig, LegRig];

  const carry = new THREE.Group();
  carry.position.set(0, 0.95, 0.5);
  body.add(carry);

  if (shadows) root.traverse((o) => (o as THREE.Mesh).isMesh && ((o.castShadow = true), (o.receiveShadow = !low)));
  // Decals and seams don't need to cast.
  [...eyes.flatMap((e) => e.group.children), ...brows, mouth].forEach((o) => (o.castShadow = false));

  const accessory = new THREE.Group();
  hatAnchor.add(accessory);
  const model: ZiggyModel = {
    root,
    body,
    torso,
    head,
    antennas: antennas as [THREE.Group, THREE.Group],
    arms,
    legs,
    eyes,
    brows,
    mouth,
    setMouth(shape) {
      mouth.material = mouthMats[shape];
    },
    heart,
    heartMat,
    heartGlow,
    heartLight,
    carry,
    hatAnchor,
    accessory,
    setAccessory(a) {
      for (const c of [...accessory.children]) {
        accessory.remove(c);
        disposeObject(c);
      }
      const acc = makeAccessory(a, low);
      if (acc) accessory.add(acc);
      antennas.forEach((p) => (p.visible = a !== 'nightcap'));
    },
    dispose() {
      eyes.forEach((e) => e.dispose());
      Object.values(mouthMats).forEach((m) => m.dispose());
      disposeObject(root);
    },
  };
  model.setAccessory(opts.accessory ?? 'none');
  return model;
}

function disposeObject(o: THREE.Object3D) {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture && !isSharedTexture(v) && !isFaceTexture(v)) v.dispose();
      mat.dispose();
    }
  });
}

// --- Accessories ---------------------------------------------------------------

function makeAccessory(a: ZiggyAccessory, low: boolean): THREE.Object3D | null {
  const g = new THREE.Group();
  if (a === 'santa' || a === 'nightcap') {
    // A small soft hat between the antennas, its tip flopping to the side.
    const color = a === 'santa' ? '#d9343b' : '#4b5fc9';
    const hatMat = felt(color, { repeat: 2, lowPower: low });
    const white = felt(a === 'santa' ? '#fbf7f2' : '#f3e7a6', { repeat: 2, lowPower: low, sheen: '#ffffff' });
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push(new THREE.Vector3(Math.sin(t * 1.6) * 0.2 * t, t * 0.36, -t * t * 0.05));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const cone = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 1, 16, false), hatMat);
    // Taper the tube into a cone.
    const pos = cone.geometry.attributes.position as THREE.BufferAttribute;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const ring = Math.floor(i / 17);
      const t = ring / 24;
      const c = curve.getPointAt(t);
      tmp.fromBufferAttribute(pos, i).sub(c).normalize().multiplyScalar((1 - t) * (a === 'santa' ? 0.25 : 0.27) + 0.012);
      pos.setXYZ(i, c.x + tmp.x, c.y + tmp.y, c.z + tmp.z);
    }
    cone.geometry.computeVertexNormals();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.06, 12, 32), white);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.01;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), white);
    pom.position.copy(curve.getPointAt(1));
    g.add(cone, rim, pom);
    g.rotation.z = -0.12;
    g.position.y = -0.02;
    if (a === 'nightcap') g.scale.setScalar(1.25);
  } else if (a === 'beret') {
    const m = felt('#e0475f', { repeat: 2, lowPower: low });
    const disc = new THREE.Mesh(cushionGeometry({ a: 0.36, b: 0.07, c: 0.33, p: 2.2 }, 32, 16), m);
    disc.position.set(0.04, 0.03, 0);
    disc.rotation.z = -0.2;
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.05, 4, 8), m);
    stem.position.set(0.02, 0.11, 0);
    g.add(disc, stem);
  } else if (a === 'crown') {
    const gold = new THREE.MeshStandardMaterial({ color: '#ffcf3d', metalness: 0.85, roughness: 0.28, emissive: '#7a4d00', emissiveIntensity: 0.25 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.1, 32, 1, true), gold);
    band.position.y = 0.05;
    g.add(band);
    for (let i = 0; i < 5; i++) {
      const a2 = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 12), gold);
      spike.position.set(Math.sin(a2) * 0.2, 0.15, Math.cos(a2) * 0.2);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshStandardMaterial({ color: ['#ff4d6d', '#4dc3ff', '#7cff6b', '#c77dff', '#ffd23d'][i], roughness: 0.15, metalness: 0.1 }));
      gem.position.set(Math.sin(a2) * 0.212, 0.06, Math.cos(a2) * 0.212);
      g.add(spike, gem);
    }
  } else if (a === 'scarf') {
    return null; // The scarf sits on the neck: see makeScarf.
  } else {
    return null;
  }
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  return g;
}

/** A striped knitted scarf around the neck (child of the body group). */
export function makeScarf(low = false): THREE.Group {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g2 = c.getContext('2d')!;
  for (let i = 0; i < 4; i++) {
    g2.fillStyle = i % 2 ? '#fdf5ea' : '#e2453c';
    g2.fillRect(0, i * 16, 64, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const m = felt('#ffffff', { repeat: 2, lowPower: low });
  m.map = t;
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.07, 12, 40), m);
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(1, 0.85, 1);
  ring.position.set(0, NECK_Y + 0.02, 0);
  const tail = new THREE.Mesh(cushionGeometry({ a: 0.07, b: 0.2, c: 0.03, p: 2.4 }, 16, 12), m);
  tail.position.set(0.16, NECK_Y - 0.17, 0.24);
  tail.rotation.set(0.25, 0, 0.18);
  g.add(ring, tail);
  return g;
}
