import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getCore } from '@/lib/creatures';
import { COLORS, type Creature, type LookKey } from './logic';
import { buildAura, buildNose, buildPet, extraArm, extraBody, extraHat, extraHead, extraLeg, extraMouth, extraTail, extraTop, extraWing, paintPattern, SINGLE_TOPS, type AuraSprite, type Buddy } from './parts2';

/**
 * A creature of the factory, built in code from its recipe: body, head, legs,
 * arms, wings, tail, eyes, mouth, horns, hat and pattern. Every part is placed
 * on the real surface of the body (a ray finds it), so nothing floats, nothing
 * sinks, and the feet always touch the ground, whatever the mix.
 *
 * It is alive from the first frame: it breathes (volume-keeping squash), blinks,
 * its eyes follow the finger, its antennae and ears jiggle on springs, and every
 * change makes the new part plop in with an elastic bounce.
 */

export type ActorCue =
  | 'plop'
  | 'tickle'
  | 'spin'
  | 'sneeze'
  | 'tryFly'
  | 'stomp'
  | 'peek'
  | 'tip'
  | 'wiggle'
  | 'chase'
  | 'wave'
  | 'boing'
  | 'nod'
  | 'yawn'
  | 'scratch'
  | 'hop'
  | 'shake';

const CUE_LEN: Record<ActorCue, number> = {
  plop: 0.55,
  tickle: 0.75,
  spin: 0.9,
  sneeze: 1.5,
  tryFly: 1.5,
  stomp: 1.1,
  peek: 1.2,
  tip: 0.9,
  wiggle: 0.8,
  chase: 1.3,
  wave: 1.2,
  boing: 0.7,
  nod: 0.7,
  yawn: 1.8,
  scratch: 1.4,
  hop: 0.6,
  shake: 0.8,
};

export interface ActorOpts {
  lowPower: boolean;
  env: THREE.Texture | null;
  reduce: boolean;
  shadows?: boolean;
}

/** A damped spring (squash & stretch, jiggly antennae). */
class Spring {
  x = 0;
  v = 0;
  constructor(
    private k = 260,
    private c = 13
  ) {}
  step(target: number, dt: number) {
    const h = Math.min(dt, 1 / 30);
    this.v += (this.k * (target - this.x) - this.c * this.v) * h;
    this.x += this.v * h;
    return this.x;
  }
  kick(v: number) {
    this.v += v;
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const env01 = (p: number, a = 0.15) => smooth(Math.max(0, Math.min(1, p / a, (1 - p) / a)));
/** Elastic plop: 0 → overshoot ≈ 1.25 → 0.95 → 1. */
const plopCurve = (k: number) => (k >= 1 ? 1 : 1 - Math.exp(-6 * k) * Math.cos(11 * k));

/* ───────────────────────── Textures ───────────────────────── */

const texCache = new Map<string, THREE.CanvasTexture>();

function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

function starPath(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

/** The body pattern: dots, stripes or stars of the accent colour on the main colour. */
function patternTex(kind: Creature['pattern'], base: string, accent: string, repeat: [number, number]): THREE.CanvasTexture | null {
  if (kind === 'plain') return null;
  return canvasTex(
    `p:${kind}:${base}:${accent}:${repeat.join('x')}`,
    256,
    256,
    (g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, 256, 256);
      g.fillStyle = accent;
      if (kind === 'dots')
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            g.beginPath();
            g.arc(32 + x * 64 + (y % 2) * 32, 32 + y * 64, 17, 0, Math.PI * 2);
            g.fill();
          }
      if (kind === 'stripes') for (let y = 0; y < 4; y++) g.fillRect(0, y * 64 + 8, 256, 30);
      if (kind === 'zigzag' || kind === 'hearts' || kind === 'checks' || kind === 'waves') paintPattern(kind, g);
      if (kind === 'stars')
        for (let y = 0; y < 3; y++)
          for (let x = 0; x < 3; x++) {
            starPath(g, 43 + x * 85 + (y % 2) * 42, 43 + y * 85, 26);
            g.fill();
          }
    },
    repeat
  );
}

/** Party hat stripes. */
function stripeTex(a: string, b: string) {
  return canvasTex(`s:${a}:${b}`, 64, 64, (g) => {
    g.fillStyle = a;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = b;
    for (let i = -2; i < 4; i++) {
      g.beginPath();
      g.moveTo(i * 24, 64);
      g.lineTo(i * 24 + 12, 64);
      g.lineTo(i * 24 + 12 + 40, 0);
      g.lineTo(i * 24 + 40, 0);
      g.fill();
    }
  });
}

export function disposeCreatureTextures() {
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
}

/* ───────────────────────── Geometry helpers ───────────────────────── */

const probeMat = new THREE.MeshBasicMaterial();
const ray = new THREE.Raycaster();

/** Where a ray from the centre along `dir` leaves the shape (point and outward normal). */
function surfaceOf(geo: THREE.BufferGeometry, from: THREE.Vector3, dir: THREE.Vector3): { p: THREE.Vector3; n: THREE.Vector3 } {
  const d = dir.clone().normalize();
  const probe = new THREE.Mesh(geo, probeMat);
  ray.set(from.clone().addScaledVector(d, 6), d.clone().negate());
  const hit = ray.intersectObject(probe, false)[0];
  if (!hit) return { p: from.clone().addScaledVector(d, 0.4), n: d };
  const n = hit.face ? hit.face.normal.clone() : d;
  // Smooth the faceted normal toward the ray (more pleasant orientation on low-poly shapes).
  return { p: hit.point.clone(), n: n.lerp(d, 0.35).normalize() };
}

/** Orient an object so its +Z points along `n` (keeping "up" up). */
function faceAlong(o: THREE.Object3D, n: THREE.Vector3, up = new THREE.Vector3(0, 1, 0)) {
  const z = n.clone().normalize();
  let x = up.clone().cross(z);
  if (x.lengthSq() < 1e-4) x = new THREE.Vector3(1, 0, 0).cross(z);
  x.normalize();
  const y = z.clone().cross(x).normalize();
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function bodyGeometry(shape: Creature['body'], low: boolean): THREE.BufferGeometry {
  const seg = low ? 22 : 34;
  const more = extraBody(shape, low);
  if (more) return more;
  switch (shape) {
    case 'blob': {
      const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
      g.scale(0.62, 0.57, 0.58);
      return g;
    }
    case 'egg': {
      const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const k = 1 - 0.2 * y;
        p.setXYZ(i, p.getX(i) * k * 0.53, y * 0.7, p.getZ(i) * k * 0.53);
      }
      g.computeVertexNormals();
      return g;
    }
    case 'bean': {
      const g = new THREE.CapsuleGeometry(0.45, 0.7, low ? 6 : 10, seg);
      g.rotateZ(Math.PI / 2);
      g.scale(1, 1, 1.05);
      return g;
    }
    case 'box':
      return new RoundedBoxGeometry(1.05, 0.95, 0.95, low ? 3 : 5, 0.24);
    default: {
      // A gumdrop: a wide, softly flat bottom and a round narrower top.
      const pts: THREE.Vector2[] = [];
      const n = 28;
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / n;
        const sy = Math.sin(a);
        const c = Math.max(0, Math.cos(a));
        const r = i === 0 || i === n ? 0 : 0.66 * Math.pow(c, sy < 0 ? 0.45 : 0.85) * (1 - 0.3 * Math.max(0, sy));
        pts.push(new THREE.Vector2(r, sy < 0 ? sy * 0.48 : sy * 0.64));
      }
      const g = new THREE.LatheGeometry(pts, seg);
      g.computeVertexNormals();
      return g;
    }
  }
}

function headGeometry(shape: Creature['head'], low: boolean): THREE.BufferGeometry {
  const seg = low ? 20 : 30;
  const more = extraHead(shape, low);
  if (more) return more;
  if (shape === 'box') return new RoundedBoxGeometry(0.78, 0.66, 0.66, low ? 3 : 4, 0.2);
  if (shape === 'bean') {
    const g = new THREE.CapsuleGeometry(0.32, 0.42, low ? 6 : 8, seg);
    g.rotateZ(Math.PI / 2);
    g.scale(1, 1.04, 1.02);
    return g;
  }
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  g.scale(0.42, 0.39, 0.4);
  return g;
}

function tube(points: THREE.Vector3[], r: number, low: boolean, taper = 0): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, low ? 10 : 18, r, low ? 6 : 10, false);
  if (taper) {
    const p = g.attributes.position;
    const segs = low ? 10 : 18;
    const radial = (low ? 6 : 10) + 1;
    for (let i = 0; i < p.count; i++) {
      const ring = Math.floor(i / radial);
      const t = ring / segs;
      const c = curve.getPointAt(Math.min(1, t));
      const k = 1 - taper * t;
      p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
    }
    g.computeVertexNormals();
  }
  return g;
}

/* ───────────────────────── Materials ───────────────────────── */

export interface Kit {
  body: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  pupil: THREE.MeshStandardMaterial;
  shine: THREE.MeshBasicMaterial;
  pink: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  ivory: THREE.MeshStandardMaterial;
  ink: THREE.MeshStandardMaterial;
  wing: THREE.MeshStandardMaterial;
  all: THREE.Material[];
}

function std(color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...extra });
}

export function makeKit(c: Creature, opts: ActorOpts): Kit {
  const base = COLORS[c.color].hex;
  const accent = COLORS[c.accent].hex;
  const rep: [number, number] = c.body === 'box' ? [1, 1] : c.body === 'bean' ? [3, 2] : [3, 2];
  const map = patternTex(c.pattern, base, accent, rep);
  const kit: Kit = {
    body: std(map ? '#ffffff' : base, { map, roughness: 0.58 }),
    accent: std(accent, { roughness: 0.55 }),
    dark: std('#4a1730', { roughness: 0.5 }),
    white: std('#ffffff', { roughness: 0.25 }),
    pupil: std('#1b1530', { roughness: 0.2 }),
    shine: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    pink: std('#ff8fb8', { roughness: 0.5 }),
    gold: std('#ffc93a', { roughness: 0.3, metalness: 0.55 }),
    ivory: std('#fff3d8', { roughness: 0.5 }),
    ink: std('#2c2440', { roughness: 0.55 }),
    wing: std(accent, { roughness: 0.5, side: THREE.DoubleSide }),
    all: [],
  };
  kit.all = [kit.body, kit.accent, kit.dark, kit.white, kit.pupil, kit.shine, kit.pink, kit.gold, kit.ivory, kit.ink, kit.wing];
  for (const m of kit.all)
    if (m instanceof THREE.MeshStandardMaterial && opts.env) {
      m.envMap = opts.env;
      m.envMapIntensity = m === kit.gold ? 1 : 0.45;
    }
  return kit;
}

/* ───────────────────────── Parts ───────────────────────── */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, shadow = true): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = shadow;
  return o;
}

class Eye {
  readonly g = new THREE.Group();
  readonly lid = new THREE.Group();
  private pupil: THREE.Mesh;
  private shineM: THREE.Mesh;
  private tmp = new THREE.Vector3();
  constructor(
    readonly r: number,
    kit: Kit,
    low: boolean
  ) {
    const seg = low ? 14 : 22;
    const ball = mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), kit.white, false);
    this.pupil = mesh(new THREE.SphereGeometry(r * 0.52, seg, Math.round(seg * 0.75)), kit.pupil, false);
    this.pupil.scale.z = 0.45;
    this.shineM = mesh(new THREE.SphereGeometry(r * 0.16, 8, 6), kit.shine, false);
    this.pupil.add(this.shineM);
    this.shineM.position.set(-r * 0.2, r * 0.2, r * 0.4);
    this.lid.add(ball, this.pupil);
    this.g.add(this.lid);
    this.pupil.position.z = r * 0.82;
  }
  /** Pupils glide toward the target (a point in world space). */
  look(target: THREE.Vector3 | null, k: number, cross: number) {
    let x = 0;
    let y = 0;
    if (target) {
      this.tmp.copy(target);
      this.g.worldToLocal(this.tmp);
      const d = this.tmp.normalize();
      x = Math.max(-1, Math.min(1, d.x * 1.6 + cross));
      y = Math.max(-1, Math.min(1, d.y * 1.6));
    }
    const m = this.r * 0.4;
    const px = this.pupil.position.x + (x * m - this.pupil.position.x) * k;
    const py = this.pupil.position.y + (y * m - this.pupil.position.y) * k;
    this.pupil.position.set(px, py, Math.sqrt(Math.max(0, this.r * this.r - px * px - py * py)) * 0.86);
  }
}

/** The face: eyes (1–5), mouth, on a host (the head, or the tummy when there is no head). */
const EYE_LAYOUT: Record<number, [number, number][]> = {
  1: [[0, 0.12]],
  2: [
    [-0.36, 0.12],
    [0.36, 0.12],
  ],
  3: [
    [-0.46, 0.02],
    [0.46, 0.02],
    [0, 0.5],
  ],
  4: [
    [-0.66, -0.02],
    [-0.23, 0.2],
    [0.23, 0.2],
    [0.66, -0.02],
  ],
  5: [
    [-0.62, -0.06],
    [0, 0.06],
    [0.62, -0.06],
    [-0.32, 0.5],
    [0.32, 0.5],
  ],
};
const EYE_R: Record<number, number> = { 1: 0.21, 2: 0.15, 3: 0.125, 4: 0.112, 5: 0.105 };

export class CreatureActor {
  readonly root = new THREE.Group();
  /** Squash & stretch pivot, on the ground. */
  private squash = new THREE.Group();
  /** Jumps and flight. */
  private lift = new THREE.Group();
  /** The body, at its centre height. */
  private bodyG = new THREE.Group();
  private bodyMesh: THREE.Mesh;
  private headG: THREE.Group | null = null;
  private faceHost!: THREE.Group;
  private eyes: Eye[] = [];
  private mouth = new THREE.Group();
  private mouthJaw: THREE.Object3D | null = null;
  private legs: { pivot: THREE.Group; segs: THREE.Group[]; phase: number; len: number }[] = [];
  private arms: { pivot: THREE.Group; side: number; level: number }[] = [];
  private wings: { pivot: THREE.Group; side: number; base: number }[] = [];
  private tail: THREE.Group | null = null;
  private tops: { pivot: THREE.Group; sx: Spring; sz: Spring }[] = [];
  private hat: THREE.Group | null = null;
  private propeller: THREE.Object3D | null = null;
  private tongue: THREE.Object3D | null = null;
  private parts = new Map<string, THREE.Object3D[]>();
  private pops: { obj: THREE.Object3D; t: number; base: THREE.Vector3 }[] = [];
  private kit: Kit;

  /** Height of the body centre above the ground; total height. */
  readonly centerY: number;
  readonly height: number;
  readonly halfWidth: number;
  readonly scale: number;

  // Life.
  private t = Math.random() * 10;
  private sq = new Spring(260, 12);
  private hopY = new Spring(120, 11);
  private blinkT = 1.5 + Math.random() * 2;
  private blink = 0;
  private lookTarget: THREE.Vector3 | null = null;
  private lookK = 0;
  private cueKind: ActorCue | null = null;
  private cueT = 0;
  private cueDone: (() => void) | null = null;
  private walkPhase = 0;
  private flapPhase = 0;
  private talkT = 0;
  private talkLen = 0;
  private colorFade: { from: THREE.Color; to: THREE.Color; t: number } | null = null;
  private highlightT = new Map<THREE.Object3D, number>();
  private prevWorld = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private hatOff = 0;
  /** Set by the game every frame: 0..1 walking, flying, swimming. */
  gait = { walk: 0, fly: 0, swim: 0, pogo: 0 };
  /** Sneeze burst (for particles), wings tried, etc. */
  onEvent: ((e: 'sneeze' | 'land' | 'hatLand' | 'step') => void) | null = null;

  constructor(
    readonly recipe: Creature,
    private opts: ActorOpts
  ) {
    const c = recipe;
    const low = opts.lowPower;
    const shadow = opts.shadows !== false;
    this.kit = makeKit(c, opts);
    const k = this.kit;
    this.scale = c.size === 1 ? 0.72 : c.size === 3 ? 1.32 : 1;

    // ── Body ──
    const bodyGeo = bodyGeometry(c.body, low);
    bodyGeo.computeBoundingBox();
    const bb = bodyGeo.boundingBox!;
    const hx = Math.max(-bb.min.x, bb.max.x);
    const hz = Math.max(-bb.min.z, bb.max.z);
    this.bodyMesh = mesh(bodyGeo, k.body, shadow);
    this.bodyG.add(this.bodyMesh);
    this.halfWidth = hx * this.scale;
    this.reg('body', this.bodyMesh);

    // ── Legs: rows across the body, every foot on the ground ──
    const legLen = c.legs === 0 ? 0 : c.legStyle === 'long' ? 0.6 : c.legStyle === 'tentacle' ? 0.42 : c.legStyle === 'spring' ? 0.34 : 0.24;
    const slots = legSlots(c.legs, hx, hz, c.body);
    const bottomAt = (x: number, z: number) => surfaceOf(bodyGeo, V(x, 0, z), V(0, -1, 0)).p.y;
    const minBottom = c.legs === 0 ? bb.min.y : Math.min(...slots.map((s) => bottomAt(s.x, s.z)));
    this.centerY = c.legs === 0 ? -bb.min.y : legLen - minBottom - 0.07;
    this.bodyG.position.y = this.centerY;
    const legsG = new THREE.Group();
    const thick = Math.min(1, 3.2 / Math.max(1, Math.ceil(c.legs / 2)));
    slots.forEach((s) => {
      const hipY = bottomAt(s.x, s.z) + 0.07;
      const len = this.centerY + hipY;
      const pivot = new THREE.Group();
      pivot.position.set(s.x, hipY, s.z);
      const segs = buildLeg(c.legStyle, len, thick, k, low, shadow, s.x);
      for (const sg of segs) if (!sg.parent) pivot.add(sg);
      legsG.add(pivot);
      this.legs.push({ pivot, segs, phase: s.phase, len });
    });
    this.bodyG.add(legsG);
    this.reg('legs', legsG);

    // ── Head ──
    let hostGeo = bodyGeo;
    let hostCenter = V();
    this.faceHost = this.bodyG;
    let hostHalf = hx;
    if (c.head !== 'none') {
      const neck = surfaceOf(bodyGeo, V(), V(0, 1, 0.12));
      const hg = headGeometry(c.head, low);
      hg.computeBoundingBox();
      const hb = hg.boundingBox!;
      this.headG = new THREE.Group();
      this.headG.position.copy(neck.p).add(V(0, -0.05, 0));
      const holder = new THREE.Group();
      holder.position.y = -hb.min.y * 0.86;
      holder.add(mesh(hg, k.body, shadow));
      this.headG.add(holder);
      this.bodyG.add(this.headG);
      this.reg('head', this.headG);
      hostGeo = hg;
      hostCenter = V();
      this.faceHost = holder;
      hostHalf = Math.max(-hb.min.x, hb.max.x);
    }
    const hostBox = new THREE.Box3().setFromBufferAttribute(hostGeo.attributes.position as THREE.BufferAttribute);
    const hostH = (hostBox.max.y - hostBox.min.y) / 2;
    const hostD = Math.max(-hostBox.min.z, hostBox.max.z);
    const face = (u: number, v: number) => surfaceOf(hostGeo, hostCenter, V(u * hostHalf * 0.9, v * hostH * 0.9 + (c.head === 'none' ? hostH * 0.22 : 0), hostD));

    // ── Eyes ──
    const eyesG = new THREE.Group();
    const lay = EYE_LAYOUT[c.eyes] ?? EYE_LAYOUT[2];
    const hostK = c.head === 'none' ? Math.min(1.25, hostHalf / 0.5) : Math.min(1.2, hostHalf / 0.42);
    const er = EYE_R[c.eyes] * (c.eyeSize === 'big' ? 1.18 : 0.86) * hostK;
    for (const [u, v] of lay) {
      const s = face(u * (c.head === 'none' ? 0.62 : 0.72), v * 0.7);
      const e = new Eye(er * (c.eyes === 5 && v > 0.3 ? 0.88 : 1), k, low);
      e.g.position.copy(s.p).addScaledVector(s.n, er * 0.38);
      faceAlong(e.g, s.n);
      eyesG.add(e.g);
      this.eyes.push(e);
    }
    this.faceHost.add(eyesG);
    this.reg('eyes', eyesG);

    // ── Mouth ──
    const ms = face(0, (c.eyes >= 3 ? -0.52 : -0.42) - (c.nose !== 'none' ? 0.1 : 0));
    this.mouth.position.copy(ms.p).addScaledVector(ms.n, 0.01);
    faceAlong(this.mouth, ms.n);
    this.buildMouth(c.mouth, hostK * (c.head === 'none' ? 1.1 : 1), low);
    this.faceHost.add(this.mouth);
    this.reg('mouth', this.mouth);

    // ── Nose (between the eyes and the mouth) ──
    const noseG = buildNose(c.nose, 1.7 * hostK * (c.head === 'none' ? 1.1 : 1), k, low);
    if (noseG) {
      const ns = face(0, c.eyes >= 3 ? -0.32 : -0.24);
      noseG.position.copy(ns.p).addScaledVector(ns.n, 0.05);
      faceAlong(noseG, ns.n);
      this.faceHost.add(noseG);
      this.reg('nose', noseG);
    }

    // ── Top (horns, antennae, ears, spikes) ──
    const topG = new THREE.Group();
    const topAt = (x: number, z = 0) => surfaceOf(hostGeo, hostCenter, V(x * hostHalf, hostH * 1.1, z));
    if (c.top !== 'none') {
      const single = SINGLE_TOPS.includes(c.top);
      const pairs = c.top === 'crest' ? [] : c.top === 'unicorn' ? [0] : c.top === 'flower' ? [1] : [-1, 1];
      for (const side of pairs) {
        const spread = c.top === 'unicorn' ? 0 : c.top === 'flower' ? 0.5 : c.top === 'bunny' ? 0.36 : c.top === 'cat' ? 0.55 : c.top === 'antennae' || c.top === 'eyestalks' ? 0.3 : c.top === 'elf' || c.top === 'floppy' ? 0.85 : c.top === 'bear' ? 0.62 : 0.5;
        const s = topAt(side * spread, c.top === 'cat' ? 0.05 : 0);
        const pivot = new THREE.Group();
        pivot.position.copy(s.p).addScaledVector(s.n, -0.02);
        const up = V(0, 1, 0).lerp(s.n, 0.55).normalize();
        pivot.quaternion.setFromUnitVectors(V(0, 1, 0), up);
        pivot.add(buildTopPiece(c.top, single ? 1 : side, hostK, k, low, shadow));
        topG.add(pivot);
        this.tops.push({ pivot, sx: new Spring(90, 5), sz: new Spring(90, 5) });
      }
      if (c.top === 'crest') {
        const n = c.head === 'none' ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const z = (0.5 - i / Math.max(1, n - 1)) * hostD * 1.1;
          const s = surfaceOf(hostGeo, hostCenter, V(0, hostH, z));
          const pivot = new THREE.Group();
          pivot.position.copy(s.p).addScaledVector(s.n, -0.03);
          pivot.quaternion.setFromUnitVectors(V(0, 1, 0), s.n);
          const h = (0.2 - Math.abs(i - (n - 1) / 2) * 0.03) * hostK;
          const spike = mesh(new THREE.ConeGeometry(0.075 * hostK, h, low ? 5 : 8), k.accent, shadow);
          spike.position.y = h / 2;
          pivot.add(spike);
          topG.add(pivot);
          this.tops.push({ pivot, sx: new Spring(120, 6), sz: new Spring(120, 6) });
        }
      }
    }
    this.faceHost.add(topG);
    this.reg('top', topG);

    // ── Hat (on the head, or on the body when there is no head) ──
    if (c.hat !== 'none') {
      const s = topAt(0, 0);
      const hatHolder = new THREE.Group();
      hatHolder.position.copy(s.p).add(V(0, (c.top === 'crest' ? 0.12 : 0) - 0.03, 0));
      const { group, propeller } = buildHat(c.hat, hostK * (c.head === 'none' ? 1.15 : 1), k, low, shadow);
      group.rotation.z = c.hat === 'bow' ? 0 : -0.12;
      if (c.hat === 'bow') group.position.x = hostHalf * 0.35;
      hatHolder.add(group);
      this.hat = hatHolder;
      this.propeller = propeller;
      this.faceHost.add(hatHolder);
      this.reg('hat', hatHolder);
    }

    // ── Arms ──
    const armsG = new THREE.Group();
    if (c.arms > 0) {
      const levels = c.arms === 4 ? [0.3, -0.12] : [0.06];
      levels.forEach((lv, li) => {
        for (const side of [-1, 1]) {
          const s = surfaceOf(bodyGeo, V(), V(side, lv, 0.18));
          const pivot = new THREE.Group();
          pivot.position.copy(s.p).addScaledVector(s.n, -0.03);
          const arm = buildArm(c.armStyle, k, low, shadow);
          arm.scale.x = side;
          pivot.add(arm);
          armsG.add(pivot);
          this.arms.push({ pivot, side, level: li });
        }
      });
    }
    this.bodyG.add(armsG);
    this.reg('arms', armsG);

    // ── Wings ──
    const wingsG = new THREE.Group();
    if (c.wings !== 'none') {
      for (const side of [-1, 1]) {
        const s = surfaceOf(bodyGeo, V(), V(side * 0.72, 0.45, -0.55));
        const pivot = new THREE.Group();
        pivot.position.copy(s.p).addScaledVector(s.n, -0.04);
        const w = buildWing(c.wings, k, low, shadow, Math.max(1.0, hx * 1.5));
        w.scale.x = side;
        pivot.add(w);
        const base = -side * 0.3;
        pivot.rotation.y = base;
        wingsG.add(pivot);
        this.wings.push({ pivot, side, base });
      }
    }
    this.bodyG.add(wingsG);
    this.reg('wings', wingsG);

    // ── Tail ──
    if (c.tail !== 'none') {
      const s = surfaceOf(bodyGeo, V(), V(0, -0.25, -1));
      const pivot = new THREE.Group();
      pivot.position.copy(s.p).addScaledVector(s.n, -0.04);
      pivot.add(buildTail(c.tail, k, low, shadow));
      this.tail = pivot;
      this.bodyG.add(pivot);
      this.reg('tail', pivot);
    }

    this.lift.add(this.bodyG);
    this.squash.add(this.lift);
    this.squash.scale.setScalar(this.scale);
    this.root.add(this.squash);
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.root);
    this.height = box.max.y;

    // ── Magic around it, and a little buddy beside it (outside the squash, so they keep their size) ──
    const aura = buildAura(c.aura, this.halfWidth, this.height, low);
    if (aura) {
      this.aura = aura.sprites;
      this.auraMats = aura.mats;
      this.root.add(aura.group);
      this.reg('aura', aura.group);
    }
    const pet = buildPet(c.pet, low);
    if (pet) {
      this.pet = pet;
      pet.group.position.x = this.halfWidth + 0.42;
      pet.group.position.z = 0.15;
      pet.group.scale.setScalar(0.8 + 0.25 * this.scale);
      this.root.add(pet.group);
      this.reg('pet', pet.group);
    }
  }

  private aura: AuraSprite[] = [];
  private auraMats: THREE.Material[] = [];
  private pet: Buddy | null = null;

  private reg(key: string, o: THREE.Object3D) {
    this.parts.set(key, [...(this.parts.get(key) ?? []), o]);
  }

  private buildMouth(kind: Creature['mouth'], s: number, low: boolean) {
    const k = this.kit;
    const m = this.mouth;
    const smile = () => {
      const g = mesh(new THREE.TorusGeometry(0.1 * s, 0.026 * s, low ? 6 : 8, low ? 12 : 20, Math.PI), k.dark, false);
      g.rotation.z = Math.PI;
      g.position.y = 0.05 * s;
      m.add(g);
      return g;
    };
    if (kind === 'smile') {
      const g = smile();
      this.mouthJaw = g;
    } else if (kind === 'fangs' || kind === 'teeth') {
      const g = smile();
      this.mouthJaw = g;
      for (const side of kind === 'fangs' ? [-1, 1] : [-1, 1]) {
        const tooth =
          kind === 'fangs'
            ? mesh(new THREE.ConeGeometry(0.022 * s, 0.07 * s, 6), k.white, false)
            : mesh(new RoundedBoxGeometry(0.05 * s, 0.07 * s, 0.03 * s, 2, 0.012 * s), k.white, false);
        if (kind === 'fangs') tooth.rotation.x = Math.PI;
        tooth.position.set(side * (kind === 'fangs' ? 0.06 : 0.027) * s, kind === 'fangs' ? -0.04 * s : -0.05 * s, 0.02 * s);
        m.add(tooth);
      }
    } else if (kind === 'tongue') {
      const g = smile();
      g.scale.set(1.15, 1.1, 1);
      this.mouthJaw = g;
      const t = mesh(new THREE.CapsuleGeometry(0.04 * s, 0.05 * s, 4, 10), k.pink, false);
      t.scale.z = 0.5;
      t.position.set(0.02 * s, -0.08 * s, 0.03 * s);
      t.rotation.z = 0.25;
      this.tongue = t;
      m.add(t);
    } else if (kind === 'oh') {
      const ring = mesh(new THREE.TorusGeometry(0.06 * s, 0.024 * s, 8, 18), k.dark, false);
      const hole = mesh(new THREE.CircleGeometry(0.06 * s, 18), k.ink, false);
      hole.position.z = -0.005;
      const g = new THREE.Group();
      g.add(ring, hole);
      g.position.y = -0.01 * s;
      m.add(g);
      this.mouthJaw = g;
    } else if (kind === 'cat' || kind === 'grin' || kind === 'moustache' || kind === 'gap') {
      this.mouthJaw = extraMouth(kind, s, k, low, m);
    } else if (kind === 'beak') {
      const orange = std('#ffa23a', { roughness: 0.45 });
      this.kit.all.push(orange);
      if (this.opts.env) {
        orange.envMap = this.opts.env;
        orange.envMapIntensity = 0.45;
      }
      const up = mesh(new THREE.ConeGeometry(0.085 * s, 0.22 * s, low ? 6 : 10), orange, true);
      up.rotation.x = Math.PI / 2;
      up.scale.set(1, 1, 0.55);
      up.position.set(0, 0.02 * s, 0.1 * s);
      const jaw = new THREE.Group();
      const down = mesh(new THREE.ConeGeometry(0.07 * s, 0.16 * s, low ? 6 : 10), orange, true);
      down.rotation.x = Math.PI / 2;
      down.scale.set(1, 1, 0.45);
      down.position.set(0, 0, 0.075 * s);
      jaw.add(down);
      jaw.position.y = -0.03 * s;
      m.add(up, jaw);
      this.mouthJaw = jaw;
    }
  }

  /* ───────── Control ───────── */

  /** The changed parts plop in, one after the other (Surprise: all of them). */
  pop(keys: readonly (LookKey | 'all')[], stagger = 0.07) {
    const map: Record<string, string[]> = {
      body: ['body'],
      size: ['body'],
      head: ['head'],
      legs: ['legs'],
      legStyle: ['legs'],
      arms: ['arms'],
      armStyle: ['arms'],
      wings: ['wings'],
      tail: ['tail'],
      eyes: ['eyes'],
      eyeSize: ['eyes'],
      mouth: ['mouth'],
      top: ['top'],
      hat: ['hat'],
      nose: ['nose'],
      aura: ['aura'],
      pet: ['pet'],
      all: ['legs', 'body', 'head', 'arms', 'eyes', 'mouth', 'wings', 'tail', 'top', 'hat', 'nose', 'aura', 'pet'],
    };
    const names = [...new Set(keys.flatMap((k) => map[k] ?? []))];
    names.forEach((n, i) => {
      for (const o of this.parts.get(n) ?? []) {
        if (this.opts.reduce) continue;
        this.pops.push({ obj: o, t: -i * stagger, base: o.scale.clone() });
        o.scale.setScalar(0.0001);
      }
    });
  }

  /** The colour flows from the old one to the new one. */
  fadeFrom(old: string) {
    if (this.recipe.pattern !== 'plain') return;
    this.colorFade = { from: new THREE.Color(old), to: this.kit.body.color.clone(), t: 0 };
    this.kit.body.color.copy(this.colorFade.from);
  }

  cue(kind: ActorCue, done?: () => void) {
    this.cueKind = kind;
    this.cueT = 0;
    this.cueDone = done ?? null;
    if (kind === 'plop' || kind === 'boing') this.sq.kick(-4.5);
    if (kind === 'tickle') this.sq.kick(-3);
    if (kind === 'hop') this.hopY.kick(3.2);
  }

  /** A power or a silly reaction: the Rust `pose` curve is added to its own motion for `dur` seconds. */
  playPose(kind: string, dur: number, done?: () => void) {
    this.poseKind = kind;
    this.poseT = 0;
    this.poseDur = Math.max(0.2, dur);
    this.poseDone = done ?? null;
  }
  /** One eye pops wide and looks the wrong way, for a moment (then all is well). */
  wonky() {
    this.wonkyT = 1.6;
  }
  private wonkyT = 0;
  private poseKind: string | null = null;
  private poseT = 0;
  private poseDur = 1;
  private poseDone: (() => void) | null = null;

  get busy() {
    return this.cueKind !== null;
  }

  /** A quick squash (any tap): 1 → 1.25 → 0.9 → 1. */
  squish(amount = 1) {
    this.sq.kick(-4 * amount);
  }

  lookAt(world: THREE.Vector3 | null) {
    if (!world) {
      this.lookTarget = null;
      return;
    }
    if (!this.lookTarget) this.lookTarget = world.clone();
    else this.lookTarget.copy(world);
  }

  /** Open and close the mouth for a moment (its voice). */
  talk(seconds: number) {
    this.talkT = 0;
    this.talkLen = seconds;
  }

  /** Counting: legs, eyes or arms light up one by one. Returns how many. */
  highlight(kind: 'legs' | 'eyes' | 'arms', i: number): boolean {
    const list = kind === 'legs' ? this.legs.map((l) => l.pivot) : kind === 'eyes' ? this.eyes.map((e) => e.g) : this.arms.map((a) => a.pivot);
    const o = list[i];
    if (!o) return false;
    this.highlightT.set(o, 0);
    return true;
  }

  count(kind: 'legs' | 'eyes' | 'arms') {
    return kind === 'legs' ? this.legs.length : kind === 'eyes' ? this.eyes.length : this.arms.length;
  }

  /** World position of a part (for particles): top of the head, the tail… */
  anchor(which: 'top' | 'mouth' | 'center' | 'tail' | 'feet', out = new THREE.Vector3()): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    if (which === 'mouth') return this.mouth.getWorldPosition(out);
    if (which === 'tail' && this.tail) return this.tail.getWorldPosition(out);
    if (which === 'feet') return this.root.getWorldPosition(out);
    if (which === 'center') return this.bodyG.getWorldPosition(out);
    return out.copy(this.root.position).setY(this.root.position.y + this.height * 1.02);
  }

  /** Everything that can be tapped. */
  hitObject(): THREE.Object3D {
    return this.squash;
  }

  /* ───────── Frame ───────── */

  update(dt: number) {
    const reduce = this.opts.reduce;
    const E = reduce ? 0.35 : 1;
    this.t += dt;
    const t = this.t;

    // Speed of the body in the world (for the jiggly springs).
    this.root.getWorldPosition(_w);
    if (dt > 0) this.vel.subVectors(_w, this.prevWorld).divideScalar(dt);
    this.prevWorld.copy(_w);

    // Elastic plops.
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t += dt / CUE_LEN.plop;
      const s = p.t <= 0 ? 0.0001 : plopCurve(p.t);
      p.obj.scale.copy(p.base).multiplyScalar(Math.max(0.0001, s));
      if (p.t >= 1) {
        p.obj.scale.copy(p.base);
        this.pops.splice(i, 1);
      }
    }
    if (this.colorFade) {
      const f = this.colorFade;
      f.t = Math.min(1, f.t + dt / 0.45);
      this.kit.body.color.copy(f.from).lerp(f.to, smooth(f.t));
      if (f.t >= 1) this.colorFade = null;
    }

    // Cue progress.
    let cue = this.cueKind;
    let p = 0;
    if (cue) {
      this.cueT += dt / CUE_LEN[cue];
      p = this.cueT;
      if (p >= 1) {
        const done = this.cueDone;
        this.cueKind = null;
        this.cueDone = null;
        cue = null;
        done?.();
      }
    }

    // Breathing, squash & stretch (volume kept: sx = sz = 1/√sy).
    const breath = Math.sin(t * 2.2) * 0.022 * E;
    let sqTarget = 0;
    let liftY = 0;
    let yaw = 0;
    let roll = 0;
    let pitch = 0;
    let headYaw = 0;
    let headPitch = 0;
    const headRoll = 0;
    let eyesClosed = 0;
    let happyEyes = 0;
    let mouthOpen = 0;
    let armUp = 0;
    let armWave = 0;
    let legLiftOne = -1;
    let flapBoost = 0;

    if (cue === 'tickle') {
      roll = Math.sin(p * Math.PI * 9) * 0.16 * env01(p) * E;
      happyEyes = env01(p, 0.1);
      mouthOpen = 0.6 * env01(p);
      armUp = 0.6 * env01(p);
    } else if (cue === 'spin') {
      yaw = smooth(p) * Math.PI * 2;
      liftY = Math.sin(p * Math.PI) * 0.35 * E;
      happyEyes = env01(p);
      armUp = env01(p);
    } else if (cue === 'sneeze') {
      // a… a… (leans back, stretches up) — TCHOUM (snaps forward) — giggle.
      if (p < 0.55) {
        const a = smooth(p / 0.55);
        sqTarget = 0.14 * a;
        pitch = -0.28 * a;
        eyesClosed = a * 0.85;
        mouthOpen = a * 0.7;
      } else {
        if (this.cueT - dt / CUE_LEN.sneeze < 0.55) {
          this.sq.kick(-6);
          this.onEvent?.('sneeze');
          if (this.hat) this.hatOff = 1;
        }
        const b = 1 - smooth(Math.min(1, (p - 0.55) / 0.45));
        pitch = 0.32 * b;
        happyEyes = b;
      }
    } else if (cue === 'tryFly') {
      // Looks at its new wings, flaps hard, lifts off a little… and lands, boing.
      headYaw = p < 0.3 ? Math.sin((p / 0.3) * Math.PI) * 0.6 : 0;
      flapBoost = p > 0.2 && p < 0.85 ? 1 : 0;
      liftY = p > 0.3 && p < 0.85 ? Math.sin(((p - 0.3) / 0.55) * Math.PI) * 0.35 * E : 0;
      if (p > 0.85 && this.cueT - dt / CUE_LEN.tryFly <= 0.85) {
        this.sq.kick(-5);
        this.onEvent?.('land');
      }
      happyEyes = p > 0.86 ? 1 : 0;
    } else if (cue === 'stomp') {
      this.gaitBoost = 1;
      happyEyes = 0.4;
    } else if (cue === 'peek') {
      headYaw = Math.sin(p * Math.PI * 2) * 0.5;
      eyesClosed = p > 0.45 && p < 0.55 ? 1 : 0;
    } else if (cue === 'tip') {
      if (this.hat && this.cueT - dt / CUE_LEN.tip <= 0.05) this.hatOff = 0.6;
      happyEyes = env01(p);
    } else if (cue === 'wiggle') {
      roll = Math.sin(p * Math.PI * 6) * 0.1 * E;
      for (const tp of this.tops) tp.sx.kick(Math.sin(p * 30) * 3);
    } else if (cue === 'chase') {
      yaw = Math.sin(p * Math.PI) * 1.1;
      headYaw = Math.sin(p * Math.PI) * 0.4;
    } else if (cue === 'wave') {
      armWave = env01(p);
      happyEyes = 0.6 * env01(p);
    } else if (cue === 'boing') {
      liftY = Math.sin(p * Math.PI) * 0.25 * E;
    } else if (cue === 'nod') {
      headPitch = Math.sin(p * Math.PI * 4) * 0.18 * env01(p);
    } else if (cue === 'yawn') {
      mouthOpen = Math.sin(Math.min(1, p * 1.4) * Math.PI) * 1.1;
      eyesClosed = Math.sin(Math.min(1, p * 1.4) * Math.PI) * 0.75;
      headPitch = -0.15 * mouthOpen;
      armUp = 0.7 * mouthOpen;
    } else if (cue === 'scratch') {
      legLiftOne = 0;
      roll = 0.1 * env01(p);
      happyEyes = 0.5 * env01(p);
    } else if (cue === 'hop') {
      happyEyes = 0.5;
    } else if (cue === 'shake') {
      yaw = Math.sin(p * Math.PI * 4) * 0.35 * env01(p);
      happyEyes = env01(p);
    }

    // Powers: the pose from the engine (Rust/WASM) on top of everything else; camouflage fades the body.
    if (this.poseKind) {
      this.poseT += dt / this.poseDur;
      const q = Math.min(1, this.poseT);
      const [pl, ps, pr, py, pp] = getCore().pose(this.poseKind, q);
      liftY += pl * E;
      sqTarget += ps * E;
      roll += pr * E;
      yaw += py * (reduce ? 0 : 1);
      pitch += pp * (reduce ? 0 : 1);
      if (this.poseKind === 'camo') {
        this.kit.body.transparent = true;
        this.kit.body.opacity = 1 - 0.65 * Math.sin(q * Math.PI);
      }
      if (this.poseT >= 1) {
        if (this.poseKind === 'camo') {
          this.kit.body.opacity = 1;
          this.kit.body.transparent = false;
        }
        const d = this.poseDone;
        this.poseKind = null;
        this.poseDone = null;
        d?.();
      }
    }

    // Walking / pogo / swimming / flying, driven by the game.
    const g = this.gait;
    const walk = Math.max(g.walk, this.gaitBoost ? 0.8 : 0);
    this.walkPhase += dt * (6 + 5 * walk) * walk;
    if (this.legs.length && walk > 0.01) {
      const bob = Math.abs(Math.sin(this.walkPhase)) * 0.045 * walk * E;
      liftY += bob;
      roll += Math.sin(this.walkPhase) * 0.05 * walk * E;
    }
    if (this.legs.length === 0 && walk > 0.01) {
      // No legs: it bounces along.
      liftY += Math.abs(Math.sin(this.walkPhase * 0.8)) * 0.32 * walk * E;
      sqTarget += (Math.abs(Math.cos(this.walkPhase * 0.8)) > 0.92 ? -0.18 : 0.05) * walk;
    }
    if (g.pogo > 0.01) {
      const ph = (this.walkPhase * 0.7) % Math.PI;
      liftY += Math.sin(ph) * 0.45 * g.pogo * E;
      sqTarget += (ph < 0.35 || ph > Math.PI - 0.35 ? -0.2 : 0.08) * g.pogo;
    }
    if (g.swim > 0.01) {
      roll += Math.sin(t * 5) * 0.12 * g.swim * E;
      pitch += Math.sin(t * 2.5) * 0.12 * g.swim;
    }
    this.gaitBoost = 0;

    // Squash spring.
    const s = this.sq.step(sqTarget + breath, dt);
    const sy = Math.max(0.6, 1 + s);
    const sxz = 1 / Math.sqrt(sy);
    this.squash.scale.set(sxz * this.scale, sy * this.scale, sxz * this.scale);
    // Hop spring (a kick goes up, gravity brings it down).
    const hop = Math.max(0, this.hopY.step(0, dt));
    this.lift.position.y = liftY + hop * 0.25;
    this.lift.rotation.set(pitch, yaw, roll);

    // Legs.
    const amp = 0.55 * E;
    this.legs.forEach((l, i) => {
      const ph = this.walkPhase + l.phase;
      let rx = Math.sin(ph) * amp * walk;
      let rz = 0;
      if (i === legLiftOne) {
        rx = -0.9 * env01(p);
        rz = Math.sin(t * 30) * 0.15;
      }
      if (g.fly > 0.3 || liftY > 0.25) rx = Math.sin(t * 4 + i) * 0.25 + 0.3;
      l.pivot.rotation.set(rx, 0, rz);
      // Tentacles: a wave runs down the chain.
      if (l.segs.length > 1)
        l.segs.forEach((sg, j) => {
          if (j === 0) return;
          sg.rotation.x = Math.sin(t * 3.2 + l.phase + j * 0.9) * 0.22 * E * (j / l.segs.length) + (walk > 0.1 ? Math.sin(ph + j) * 0.2 : 0);
          sg.rotation.z = Math.cos(t * 2.6 + l.phase * 1.3 + j) * 0.12 * E;
        });
      if (this.recipe.legs === 1 && g.pogo > 0.01) l.pivot.scale.y = 1 + Math.min(0, sqTarget) * 1.2;
      else l.pivot.scale.y = 1;
      const hl = this.highlightT.get(l.pivot);
      if (hl !== undefined) this.flash(l.pivot, hl, dt);
    });

    // Arms: idle sway, raised when happy, waving.
    this.arms.forEach((a, i) => {
      const sway = Math.sin(t * 1.8 + i) * 0.12 * E;
      const swing = this.legs.length ? Math.sin(this.walkPhase + (a.side > 0 ? Math.PI : 0)) * 0.4 * walk : 0;
      const wave = armWave && a.side > 0 && a.level === 0 ? -1.6 + Math.sin(t * 14) * 0.35 : 0;
      a.pivot.rotation.set(swing, 0, a.side * (-(armUp * 1.3) + sway) + (wave ? a.side * wave * armWave : 0) - a.side * (g.fly > 0.3 ? 0.6 : 0));
      const hl = this.highlightT.get(a.pivot);
      if (hl !== undefined) this.flash(a.pivot, hl, dt);
    });

    // Wings.
    const tiny = this.recipe.wings === 'tiny';
    const flapSpeed = tiny ? (flapBoost || g.fly ? 40 : 9) : flapBoost || g.fly > 0.3 ? 14 : 2.2;
    this.flapPhase += dt * flapSpeed;
    const flapAmp = (flapBoost || g.fly > 0.3 ? 0.75 : 0.18) * E;
    for (const w of this.wings) {
      w.pivot.rotation.y = w.base + w.side * Math.sin(this.flapPhase) * flapAmp;
      w.pivot.rotation.z = w.side * (0.15 + Math.sin(this.flapPhase) * flapAmp * 0.35);
    }

    // Tail wag (fast when swimming, chasing).
    if (this.tail) {
      const wag = g.swim > 0.01 ? Math.sin(t * 9) * 0.6 : Math.sin(t * 3) * 0.22 * E + (cue === 'chase' ? Math.sin(t * 16) * 0.4 : 0);
      this.tail.rotation.y = wag;
      this.tail.rotation.x = Math.sin(t * 2) * 0.06 * E;
    }

    // Head.
    if (this.headG) {
      let ly = 0;
      let lp = 0;
      if (this.lookTarget) {
        this.headG.getWorldPosition(_w);
        const d = _v.copy(this.lookTarget).sub(_w);
        const inv = this.root.getWorldQuaternion(_q).invert();
        d.applyQuaternion(inv);
        ly = Math.atan2(d.x, Math.max(0.2, d.z)) * 0.45;
        lp = -Math.atan2(d.y, Math.hypot(d.x, d.z) + 0.001) * 0.35;
      }
      this.headLook.x += (Math.max(-0.6, Math.min(0.6, ly)) - this.headLook.x) * Math.min(1, dt * 5);
      this.headLook.y += (Math.max(-0.35, Math.min(0.35, lp)) - this.headLook.y) * Math.min(1, dt * 5);
      this.headG.rotation.set(headPitch + this.headLook.y + Math.sin(t * 1.3) * 0.03 * E, headYaw + this.headLook.x, headRoll + Math.sin(t * 0.9) * 0.05 * E);
    }

    // Antennae, ears, spikes on springs: they lag behind every move.
    const ax = this.vel.x * 0.06 + (this.lift.position.y - this.lastLift) / Math.max(dt, 1e-3) * 0.04;
    this.lastLift = this.lift.position.y;
    for (const tp of this.tops) {
      const x = tp.sx.step(-this.sq.v * 0.03 + ax * 0.2, dt);
      const z = tp.sz.step(-this.vel.x * 0.05 + Math.sin(t * 1.7) * 0.03 * E, dt);
      tp.pivot.children[0].rotation.x = x;
      tp.pivot.children[0].rotation.z = z;
    }

    // Hat: pops up when it sneezes, lands back with a bounce.
    if (this.hat) {
      if (this.hatOff > 0) {
        this.hatOff = Math.max(0, this.hatOff - dt * 1.1);
        const k = this.hatOff;
        this.hat.position.y = this.hatBaseY() + Math.sin(k * Math.PI) * 0.5;
        this.hat.rotation.z = Math.sin(k * Math.PI * 2) * 0.4;
        if (this.hatOff === 0) {
          this.sq.kick(-2);
          this.onEvent?.('hatLand');
        }
      } else {
        this.hat.position.y = this.hatBaseY();
        this.hat.rotation.z = 0;
      }
    }
    // Magic drifts around it; the buddy bobs beside it.
    if (this.aura.length) {
      const calm = reduce ? 0.3 : 1;
      for (const a of this.aura) {
        const ang = a.a + t * a.speed * 0.6 * calm;
        a.obj.position.set(Math.cos(ang) * a.r, a.y + Math.sin(t * 1.6 + a.bob) * 0.06 * calm, Math.sin(ang) * a.r * 0.8);
        a.obj.rotation.y = t * 0.8 * calm;
        a.obj.scale.setScalar(1 + Math.sin(t * 2.4 + a.bob) * 0.15 * calm);
      }
    }
    if (this.pet) this.pet.tick(t, reduce ? 0.3 : 1);
    if (this.propeller) this.propeller.rotation.y += dt * (g.fly > 0.3 || flapBoost ? 30 : 4 + Math.sin(t) * 2);
    if (this.tongue) this.tongue.rotation.z = 0.25 + Math.sin(t * 6) * 0.18 * E;

    // Blink (sometimes twice), eyes follow the target.
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 1;
      this.blinkT = Math.random() < 0.25 ? 0.22 : 2 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const lid = Math.max(this.blink > 0 ? Math.sin(this.blink * Math.PI) : 0, eyesClosed);
    const ey = Math.max(0.06, 1 - lid * 0.94 - happyEyes * 0.55);
    this.lookK = Math.min(1, dt * 9);
    if (this.wonkyT > 0 && this.eyes.length > 1) {
      this.wonkyT = Math.max(0, this.wonkyT - dt);
      const w = Math.sin(Math.min(1, this.wonkyT / 1.6) * Math.PI) * (reduce ? 0.5 : 1);
      this.eyes[0].g.scale.setScalar(1 + 0.45 * w);
      this.eyes[this.eyes.length - 1].g.scale.setScalar(1 - 0.25 * w);
      if (this.wonkyT === 0) for (const e of this.eyes) e.g.scale.setScalar(1);
    }
    this.eyes.forEach((e, i) => {
      e.lid.scale.y = ey;
      e.look(this.lookTarget, this.lookK, this.eyes.length > 2 ? Math.sin(t * 0.5 + i) * 0.04 : 0);
      const hl = this.highlightT.get(e.g);
      if (hl !== undefined) this.flash(e.g, hl, dt);
    });

    // Mouth: talking, yawning, sneezing.
    let open = mouthOpen;
    if (this.talkT < this.talkLen) {
      this.talkT += dt;
      open = Math.max(open, Math.abs(Math.sin(this.talkT * 16)) * 0.8);
    }
    if (this.mouthJaw) {
      if (this.recipe.mouth === 'beak') this.mouthJaw.rotation.x = open * 0.5;
      else this.mouthJaw.scale.set(1 + open * 0.15, 1 + open * 1.4, 1);
    }
  }

  private gaitBoost = 0;
  private lastLift = 0;
  private headLook = { x: 0, y: 0 };
  private hatY: number | null = null;
  private hatBaseY() {
    if (this.hatY === null) this.hatY = this.hat!.position.y;
    return this.hatY;
  }

  /** A counted part swells and glows for a moment. */
  private flash(o: THREE.Object3D, t0: number, dt: number) {
    const base = (o.userData.base as THREE.Vector3 | undefined) ?? (o.userData.base = o.scale.clone());
    const t = t0 + dt / 0.5;
    if (t >= 1) {
      this.highlightT.delete(o);
      o.scale.copy(base);
      delete o.userData.base;
      return;
    }
    this.highlightT.set(o, t);
    o.scale.copy(base).multiplyScalar(1 + Math.sin(t * Math.PI) * 0.35);
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    for (const m of this.kit.all) m.dispose();
    for (const m of this.auraMats) m.dispose();
    this.pet?.mats.forEach((m) => m.dispose());
  }
}

const _w = new THREE.Vector3();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

/* ───────────────────────── Leg layout & builders ───────────────────────── */

interface Slot {
  x: number;
  z: number;
  phase: number;
}

/** Legs in rows across the body, so they are easy to count from the front. */
export function legSlots(n: number, hx: number, hz: number, body: Creature['body']): Slot[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, z: 0.02, phase: 0 }];
  const wide = body === 'bean' ? 0.72 : body === 'box' ? 0.62 : 0.56;
  if (n === 2)
    return [
      { x: -hx * 0.4, z: 0.02, phase: 0 },
      { x: hx * 0.4, z: 0.02, phase: Math.PI },
    ];
  const front = Math.ceil(n / 2);
  const back = n - front;
  const out: Slot[] = [];
  const row = (count: number, z: number, w: number, r: number) => {
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 0 : -w + (2 * w * i) / (count - 1);
      // Up to 6 legs: alternate (tripod); 7 and 8: a wave runs along the row.
      const phase = n >= 7 ? (i / count) * Math.PI * 2 + r * 0.6 : ((i + r) % 2) * Math.PI + i * 0.25;
      out.push({ x, z, phase });
    }
  };
  row(front, hz * 0.3, hx * wide, 0);
  row(back, -hz * 0.32, hx * wide * (back < front ? 0.6 : 0.85), 1);
  return out;
}

/** One leg hanging from its hip down to the ground (length `len`). Returns its pieces, the first being the hip. */
function buildLeg(style: Creature['legStyle'], len: number, thick: number, k: Kit, low: boolean, shadow: boolean, x: number): THREE.Group[] {
  const more = extraLeg(style, len, thick, k, low, shadow);
  if (more) return more;
  const g = new THREE.Group();
  const seg = low ? 8 : 12;
  if (style === 'stubby') {
    const r = 0.12 * (0.7 + 0.3 * thick);
    const leg = mesh(new THREE.CylinderGeometry(r * 0.92, r, len, seg), k.body, shadow);
    leg.position.y = -len / 2;
    const foot = mesh(new THREE.SphereGeometry(1, seg, 8), k.accent, shadow);
    foot.scale.set(r * 1.35, r * 0.75, r * 1.7);
    foot.position.set(0, -len + r * 0.55, r * 0.35);
    g.add(leg, foot);
    return [g];
  }
  if (style === 'long') {
    const r = 0.045 * (0.75 + 0.25 * thick);
    const upper = mesh(new THREE.CylinderGeometry(r, r, len * 0.5, seg), k.accent, shadow);
    upper.position.y = -len * 0.25;
    const knee = mesh(new THREE.SphereGeometry(r * 1.8, seg, 8), k.body, shadow);
    knee.position.y = -len * 0.5;
    const lower = mesh(new THREE.CylinderGeometry(r * 0.85, r, len * 0.5, seg), k.accent, shadow);
    lower.position.y = -len * 0.75;
    const foot = mesh(new THREE.SphereGeometry(1, seg, 8), k.accent, shadow);
    foot.scale.set(0.07, 0.035, 0.12);
    foot.position.set(0, -len + 0.03, 0.05);
    g.add(upper, knee, lower, foot);
    return [g];
  }
  // Tentacle: a chain of 4 tapering pieces; the tip curls outward on the ground.
  const parts: THREE.Group[] = [g];
  const n = 4;
  const L = len / n;
  let parent: THREE.Group = g;
  for (let i = 0; i < n; i++) {
    const s = i === 0 ? g : new THREE.Group();
    if (i > 0) {
      s.position.y = -L;
      parent.add(s);
      parts.push(s);
    }
    const r0 = 0.085 * (1 - i * 0.17) * (0.75 + 0.25 * thick);
    const r1 = 0.085 * (1 - (i + 1) * 0.17) * (0.75 + 0.25 * thick);
    const piece = mesh(new THREE.CylinderGeometry(r0, r1, L * 1.08, seg), k.body, shadow);
    piece.position.y = -L / 2;
    s.add(piece);
    if (i === n - 1) {
      const tip = mesh(new THREE.SphereGeometry(r1 * 1.5, seg, 8), k.accent, shadow);
      tip.position.set(Math.sign(x) * r1 * 0.8, -L + r1, r1 * 0.6);
      s.add(tip);
    }
    parent = s;
  }
  return parts;
}

function buildArm(style: Creature['armStyle'], k: Kit, low: boolean, shadow: boolean): THREE.Group {
  const more = extraArm(style, k, low, shadow);
  if (more) return more;
  const g = new THREE.Group();
  const seg = low ? 8 : 12;
  if (style === 'noodle') {
    g.add(mesh(tube([V(0, 0, 0), V(0.14, 0.02, 0.03), V(0.27, -0.06, 0.06), V(0.33, -0.22, 0.08)], 0.036, low), k.body, shadow));
    const hand = mesh(new THREE.SphereGeometry(0.068, seg, 8), k.accent, shadow);
    hand.position.set(0.335, -0.25, 0.08);
    g.add(hand);
  } else if (style === 'mitten') {
    g.add(mesh(tube([V(0, 0, 0), V(0.12, -0.02, 0.03), V(0.22, -0.12, 0.06)], 0.04, low), k.body, shadow));
    const mit = mesh(new THREE.SphereGeometry(1, seg, 10), k.accent, shadow);
    mit.scale.set(0.11, 0.13, 0.08);
    mit.position.set(0.25, -0.2, 0.07);
    const thumb = mesh(new THREE.SphereGeometry(0.045, seg, 6), k.accent, shadow);
    thumb.position.set(0.18, -0.14, 0.12);
    g.add(mit, thumb);
  } else {
    // Pincer: a short arm and an open claw.
    g.add(mesh(tube([V(0, 0, 0), V(0.13, 0.04, 0.04), V(0.24, 0.0, 0.08)], 0.04, low), k.body, shadow));
    const claw = new THREE.Group();
    claw.position.set(0.27, 0.0, 0.09);
    const top = mesh(new THREE.SphereGeometry(1, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2), k.accent, shadow);
    top.scale.set(0.15, 0.09, 0.07);
    top.rotation.z = -0.5;
    top.position.set(0.06, 0.03, 0);
    const bot = mesh(new THREE.SphereGeometry(1, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2), k.accent, shadow);
    bot.scale.set(0.13, 0.07, 0.065);
    bot.rotation.z = Math.PI + 0.45;
    bot.position.set(0.05, -0.03, 0);
    claw.add(top, bot);
    g.add(claw);
  }
  return g;
}

/** One wing, built for the right side (mirrored for the left), in the XY plane. */
function buildWing(kind: Creature['wings'], k: Kit, low: boolean, shadow: boolean, span: number): THREE.Group {
  const more = extraWing(kind, k, low, shadow, span);
  if (more) return more;
  const g = new THREE.Group();
  const s = kind === 'tiny' ? span * 0.38 : span;
  if (kind === 'bird' || kind === 'tiny') {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const f = mesh(new THREE.SphereGeometry(1, low ? 10 : 14, 8), i % 2 ? k.white : k.wing, shadow);
      const len = (0.36 - i * 0.05) * s;
      f.scale.set(len, 0.075 * s, 0.03 * s);
      const a = 0.75 - i * 0.32;
      f.position.set(Math.cos(a) * len * 0.95, Math.sin(a) * len * 0.95 - 0.02, -i * 0.006);
      f.rotation.z = a;
      g.add(f);
    }
  } else if (kind === 'bat') {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.04);
    sh.quadraticCurveTo(0.3 * s, 0.34 * s, 0.62 * s, 0.32 * s);
    // Scalloped trailing edge.
    const bumps = 3;
    for (let i = 0; i < bumps; i++) {
      const x0 = 0.62 * s * (1 - i / bumps);
      const x1 = 0.62 * s * (1 - (i + 1) / bumps);
      const y0 = 0.32 * s * (1 - i / bumps) - 0.05;
      const y1 = 0.32 * s * (1 - (i + 1) / bumps) - 0.08;
      sh.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 0.14 * s, x1, y1);
    }
    sh.lineTo(0, -0.04);
    const m = mesh(new THREE.ShapeGeometry(sh, low ? 6 : 10), k.wing, shadow);
    const bone = mesh(tube([V(0, 0.03, 0.005), V(0.3 * s, 0.33 * s, 0.005), V(0.62 * s, 0.32 * s, 0.005)], 0.016, low), k.ink, false);
    g.add(m, bone);
  } else if (kind === 'butterfly') {
    const lobe = (rx: number, ry: number, cx: number, cy: number, rot: number, m: THREE.Material, z = 0) => {
      const o = mesh(new THREE.CircleGeometry(1, low ? 16 : 26), m, shadow);
      o.scale.set(rx * s, ry * s, 1);
      o.position.set(cx * s, cy * s, z);
      o.rotation.z = rot;
      return o;
    };
    g.add(lobe(0.3, 0.22, 0.3, 0.2, 0.5, k.wing), lobe(0.19, 0.15, 0.22, -0.1, -0.4, k.wing));
    const dot = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, side: THREE.DoubleSide });
    k.all.push(dot);
    g.add(lobe(0.08, 0.08, 0.36, 0.24, 0, dot, 0.004), lobe(0.05, 0.05, 0.2, -0.1, 0, dot, 0.004), lobe(0.05, 0.05, 0.2, 0.28, 0, dot, 0.004));
  }
  return g;
}

/** The tail, pointing backwards (−Z). */
function buildTail(kind: Creature['tail'], k: Kit, low: boolean, shadow: boolean): THREE.Group {
  const more = extraTail(kind, k, low, shadow);
  if (more) return more;
  const g = new THREE.Group();
  const seg = low ? 8 : 12;
  if (kind === 'fish') {
    const stalk = mesh(new THREE.ConeGeometry(0.11, 0.3, seg), k.body, shadow);
    stalk.rotation.x = -Math.PI / 2;
    stalk.position.z = -0.12;
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.quadraticCurveTo(0.12, 0.22, 0.3, 0.3);
    sh.quadraticCurveTo(0.2, 0.05, 0.3, -0.3);
    sh.quadraticCurveTo(0.12, -0.22, 0, 0);
    const fin = mesh(new THREE.ShapeGeometry(sh, low ? 6 : 10), k.wing, shadow);
    // The fin stands up (YZ plane), its base at the tip of the stalk.
    fin.rotation.y = Math.PI / 2;
    fin.position.z = -0.24;
    g.add(stalk, fin);
  } else if (kind === 'curly') {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const a = t * Math.PI * 4;
      const r = 0.07 * (1 - t * 0.4);
      pts.push(V(Math.cos(a) * r - 0.07, Math.sin(a) * r + t * 0.06, -t * 0.32));
    }
    g.add(mesh(tube(pts, 0.03, low), k.pink, shadow));
  } else if (kind === 'pompom') {
    const geo = new THREE.IcosahedronGeometry(0.16, low ? 1 : 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = V(p.getX(i), p.getY(i), p.getZ(i));
      const n = 1 + Math.sin(v.x * 40) * Math.cos(v.y * 37) * Math.sin(v.z * 31) * 0.14;
      v.multiplyScalar(n);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const pom = mesh(geo, k.white, shadow);
    pom.position.z = -0.1;
    g.add(pom);
  } else if (kind === 'dragon') {
    const pts = [V(0, 0, 0), V(0, 0.05, -0.2), V(0.05, 0.16, -0.4), V(0.02, 0.32, -0.52)];
    g.add(mesh(tube(pts, 0.07, low, 0.75), k.body, shadow));
    const tip = mesh(new THREE.ConeGeometry(0.1, 0.18, 4), k.accent, shadow);
    tip.position.set(0.02, 0.38, -0.56);
    tip.rotation.x = -0.5;
    tip.scale.z = 0.35;
    g.add(tip);
    for (let i = 0; i < 3; i++) {
      const sp = mesh(new THREE.ConeGeometry(0.035, 0.09, 4), k.accent, shadow);
      const c = new THREE.CatmullRomCurve3(pts).getPointAt(0.2 + i * 0.25);
      sp.position.copy(c).add(V(0, 0.06 - i * 0.012, 0));
      g.add(sp);
    }
  }
  return g;
}

/** One horn / antenna / ear (side −1 or 1), standing up from its pivot. */
function buildTopPiece(kind: Creature['top'], side: number, s: number, k: Kit, low: boolean, shadow: boolean): THREE.Group {
  const more = extraTop(kind, side, s, k, low, shadow);
  if (more) return more;
  const g = new THREE.Group();
  const seg = low ? 8 : 12;
  if (kind === 'horns') {
    const pts = [V(0, 0, 0), V(side * 0.05 * s, 0.12 * s, 0), V(side * 0.13 * s, 0.22 * s, 0.02), V(side * 0.12 * s, 0.3 * s, 0.05)];
    g.add(mesh(tube(pts, 0.06 * s, low, 0.85), k.ivory, shadow));
  } else if (kind === 'antennae') {
    const stem = mesh(tube([V(0, 0, 0), V(side * 0.04 * s, 0.18 * s, 0), V(side * 0.1 * s, 0.32 * s, 0.03)], 0.016 * s, low), k.ink, shadow);
    const ball = mesh(new THREE.SphereGeometry(0.055 * s, seg, 8), k.accent, shadow);
    ball.position.set(side * 0.1 * s, 0.34 * s, 0.03);
    g.add(stem, ball);
  } else if (kind === 'bunny') {
    const ear = mesh(new THREE.CapsuleGeometry(0.075 * s, 0.32 * s, 4, seg), k.body, shadow);
    ear.scale.z = 0.5;
    ear.position.y = 0.22 * s;
    ear.rotation.z = -side * 0.12;
    const inner = mesh(new THREE.CapsuleGeometry(0.042 * s, 0.24 * s, 4, seg), k.pink, false);
    inner.scale.z = 0.3;
    inner.position.set(0, 0.22 * s, 0.03 * s);
    inner.rotation.z = -side * 0.12;
    g.add(ear, inner);
  } else if (kind === 'cat') {
    const ear = mesh(new THREE.ConeGeometry(0.12 * s, 0.22 * s, 3), k.body, shadow);
    ear.scale.z = 0.45;
    ear.position.y = 0.08 * s;
    ear.rotation.z = -side * 0.15;
    const inner = mesh(new THREE.ConeGeometry(0.065 * s, 0.13 * s, 3), k.pink, false);
    inner.scale.z = 0.3;
    inner.position.set(0, 0.06 * s, 0.03 * s);
    inner.rotation.z = -side * 0.15;
    g.add(ear, inner);
  }
  return g;
}

/** Hats sit on their brim at y = 0. */
export function buildHat(kind: Creature['hat'], s: number, k: Kit, low: boolean, shadow: boolean): { group: THREE.Group; propeller: THREE.Object3D | null } {
  const more = extraHat(kind, s, k, low, shadow);
  if (more) return { group: more, propeller: null };
  const g = new THREE.Group();
  const seg = low ? 12 : 20;
  let propeller: THREE.Object3D | null = null;
  if (kind === 'top') {
    const brim = mesh(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.03 * s, seg), k.ink, shadow);
    brim.position.y = 0.015 * s;
    const crown = mesh(new THREE.CylinderGeometry(0.18 * s, 0.19 * s, 0.32 * s, seg), k.ink, shadow);
    crown.position.y = 0.19 * s;
    const band = mesh(new THREE.CylinderGeometry(0.193 * s, 0.193 * s, 0.06 * s, seg), k.accent, false);
    band.position.y = 0.07 * s;
    g.add(brim, crown, band);
  } else if (kind === 'party') {
    const m = new THREE.MeshStandardMaterial({ map: stripeTex('#ffe066', '#ff5c8a'), roughness: 0.6 });
    k.all.push(m);
    const cone = mesh(new THREE.ConeGeometry(0.17 * s, 0.42 * s, seg), m, shadow);
    cone.position.y = 0.21 * s;
    const pom = mesh(new THREE.SphereGeometry(0.06 * s, 10, 8), k.white, shadow);
    pom.position.y = 0.44 * s;
    g.add(cone, pom);
  } else if (kind === 'crown') {
    const ring = mesh(new THREE.CylinderGeometry(0.2 * s, 0.18 * s, 0.13 * s, seg, 1, true), k.gold, shadow);
    ring.position.y = 0.065 * s;
    (ring.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    g.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const pt = mesh(new THREE.ConeGeometry(0.045 * s, 0.12 * s, 5), k.gold, shadow);
      pt.position.set(Math.sin(a) * 0.19 * s, 0.18 * s, Math.cos(a) * 0.19 * s);
      const gem = mesh(new THREE.SphereGeometry(0.025 * s, 8, 6), i % 2 ? k.pink : k.accent, false);
      gem.position.set(Math.sin(a) * 0.2 * s, 0.07 * s, Math.cos(a) * 0.2 * s);
      g.add(pt, gem);
    }
  } else if (kind === 'propeller') {
    const cap = mesh(new THREE.SphereGeometry(0.2 * s, seg, 10, 0, Math.PI * 2, 0, Math.PI / 2), k.accent, shadow);
    const visor = mesh(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.02 * s, seg, 1, false, -Math.PI / 2.4, Math.PI / 1.2), k.ink, shadow);
    visor.position.set(0, 0.01 * s, 0.1 * s);
    const stick = mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.1 * s, 6), k.ink, false);
    stick.position.y = 0.24 * s;
    const p = new THREE.Group();
    p.position.y = 0.29 * s;
    for (const [i, col] of [k.pink, k.gold, k.white].entries()) {
      const blade = mesh(new THREE.BoxGeometry(0.22 * s, 0.012 * s, 0.06 * s), col, false);
      blade.position.x = 0.11 * s;
      const holder = new THREE.Group();
      holder.rotation.y = (i / 3) * Math.PI * 2;
      blade.rotation.x = 0.3;
      holder.add(blade);
      p.add(holder);
    }
    propeller = p;
    g.add(cap, visor, stick, p);
  } else if (kind === 'bow') {
    for (const side of [-1, 1]) {
      const loop = mesh(new THREE.ConeGeometry(0.1 * s, 0.18 * s, low ? 6 : 10), k.pink, shadow);
      loop.rotation.z = side * (Math.PI / 2);
      loop.scale.z = 0.5;
      loop.position.set(side * 0.09 * s, 0.05 * s, 0);
      g.add(loop);
    }
    const knot = mesh(new THREE.SphereGeometry(0.05 * s, 10, 8), k.pink, shadow);
    knot.position.y = 0.05 * s;
    g.add(knot);
  }
  return { group: g, propeller };
}

/** Pieces of a creature for Ziggy's costume ("Ziggy, become it!"). */
export function costumePieces(c: Creature, opts: ActorOpts) {
  const kit = makeKit(c, opts);
  const low = opts.lowPower;
  const hat = c.hat !== 'none' ? buildHat(c.hat, 1.25, kit, low, true) : null;
  const tops: THREE.Group[] = [];
  if (c.top !== 'none' && c.top !== 'crest') for (const side of SINGLE_TOPS.includes(c.top) ? [1] : [-1, 1]) tops.push(buildTopPiece(c.top, side, 1.3, kit, low, true));
  const wings: THREE.Group[] = [];
  if (c.wings !== 'none')
    for (const side of [-1, 1]) {
      const w = buildWing(c.wings, kit, low, true, 0.95);
      w.scale.x = side;
      wings.push(w);
    }
  const tail = c.tail !== 'none' ? buildTail(c.tail, kit, low, true) : null;
  return { kit, hat, tops, wings, tail };
}
