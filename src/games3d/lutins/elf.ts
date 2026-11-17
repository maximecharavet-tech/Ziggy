import * as THREE from 'three';
import { cushionGeometry, frontZ, rectPatch, type Cushion } from '../ziggy/shapes';
import { fluffTorus, mergeAll, puffAt, puffGeometry, smoothSeams, taperedTube } from '../santa/fluff';
import { damp } from '../santa/framing';
import { rng } from '../kit/rng';
import {
  acornTextures,
  beadEye,
  bowGeometry,
  braidGeometry,
  canvasTexture,
  clipGeometry,
  cupGeometry,
  earGeometry,
  elfFelt,
  goldMaterial,
  knitMaterial,
  knitTextures,
  stitchGeometry,
  threadMaterial,
  yarnTextures,
} from './craft';
import { blendPose, blinkOpen, clonePose, hipHeight, nextBlink, poseTarget, type PoseState } from './poses';
import type { ElfId, ElfPose } from './types';

/**
 * Les Lutins Farceurs: Pépin, Grelotte and Noisette, three hand-made felt
 * plush elves (~25 cm dolls), built in code from `src/data/lutins/bible.json`.
 * Felt with fibres, hand stitches on hems and seams, knitted wool hats and
 * scarf, yarn hair, glossy bead eyes with highlights, rosy cheeks.
 * Always cheerful: no sad pose exists.
 *
 * Origin on the floor between the boots, facing +z. 1 unit ≈ 25 cm: Pépin
 * and Grelotte are about 1 unit to the top of the head, Noisette half that.
 */

export const ELF_COLORS = {
  skin: '#f2c4a5',
  ear: '#efb898',
  earInner: '#f39b9b',
  cheek: '#f3848f',
  nose: '#eda287',
  mouth: '#5e1f2b',
  tongue: '#f07f8c',
  thread: '#fff4e2',
  pepin: { tunic: '#3a9d4f', tunicDark: '#2d7f3f', boots: '#2f8f47', belt: '#6b3f22', hatRed: '#e03131', hatWhite: '#fbf6ee', hair: '#d06a2c', freckle: '#e8792b' },
  grelotte: { dress: '#8a68ee', dressDark: '#6c4fd0', snow: '#fbfbff', mustard: '#e9ac2c', braid: '#4a2c1d', bow: '#e03131', boots: '#6a42cc', tights: '#f5ecdc' },
  noisette: { cape: '#8e5527', capeDark: '#6e3f1a', tunic: '#f3e5c8', leaf: '#40c057', boots: '#6d4424', stem: '#5e3a1e' },
} as const;

export interface ElfArm {
  shoulder: THREE.Group;
  elbow: THREE.Group;
  /** An empty anchor at the centre of the hand (hold props here). */
  hand: THREE.Object3D;
}

export interface ElfLeg {
  hip: THREE.Group;
  ankle: THREE.Group;
}

export interface ElfModel {
  id: ElfId;
  root: THREE.Group;
  /** Design-space group (scaled for Noisette); the rig works inside it. */
  body: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  breath: THREE.Object3D;
  neck: THREE.Group;
  head: THREE.Group;
  eyes: [THREE.Group, THREE.Group];
  happyEyes: [THREE.Object3D, THREE.Object3D];
  arms: [ElfArm, ElfArm];
  legs: [ElfLeg, ElfLeg];
  /** Things that swing with a soft spring (long hat, braids). */
  springs: { obj: THREE.Object3D; axis: 'x' | 'z'; gain: number; rest: number }[];
  setMouth(open: number): void;
  dims: ElfDims;
}

export interface ElfDims {
  /** Design-space values (before `scale`). */
  hipY: number;
  seatY: number;
  heelLift: number;
  eyeY: number;
  eyeX: number;
  /** World scale of the design space. */
  scale: number;
  /** Added to every pose's arms (Noisette keeps her hands in front, out of the cape). */
  armSwing?: number;
  armRaise?: number;
  /** Highest the arms go (Noisette's big hood would hide a hand held higher). */
  maxRaise?: number;
  /** World height to the top of the head, and with the hat. */
  headTop: number;
  height: number;
  /** World height of the head centre and the head half-height. */
  headCenter: number;
  headSize: number;
}

export interface ElfOptions {
  lowPower?: boolean;
  /** Initial pose (default 'stand'). */
  pose?: ElfPose;
}

// ---------------------------------------------------------------------------
// Shared parts

interface Mats {
  low: boolean;
  skin: THREE.MeshStandardMaterial;
  ear: THREE.MeshStandardMaterial;
  earInner: THREE.MeshStandardMaterial;
  cheek: THREE.MeshStandardMaterial;
  nose: THREE.MeshStandardMaterial;
  thread: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
}

function baseMats(low: boolean): Mats {
  return {
    low,
    skin: elfFelt(ELF_COLORS.skin, { repeat: 3, sheen: '#ffe4d2', lowPower: low }),
    ear: elfFelt(ELF_COLORS.ear, { repeat: 1.5, sheen: '#ffe0cc', lowPower: low }),
    earInner: elfFelt(ELF_COLORS.earInner, { repeat: 1, sheen: '#ffd0d0', lowPower: low }),
    cheek: elfFelt(ELF_COLORS.cheek, { repeat: 1, sheen: '#ffc6cc', lowPower: low }),
    nose: elfFelt(ELF_COLORS.nose, { repeat: 1, sheen: '#ffd2c2', lowPower: low }),
    thread: threadMaterial(ELF_COLORS.thread),
    dark: threadMaterial('#3a1d22'),
    gold: goldMaterial(low),
  };
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Horizontal radius of a cushion at height y (cushion-local). */
function cushionR(c: Cushion, y: number): number {
  const k = 1 - Math.pow(Math.abs(y / c.b), c.p);
  return k <= 0 ? 0 : c.a * Math.pow(k, 1 / c.p);
}

interface HeadSpec {
  shape: Cushion;
  eye: { x: number; y: number; r: number };
  nose: { y: number; r: number };
  cheek: { x: number; y: number; r: number };
  ear: { len: number; width: number; x: number; y: number; z: number; up: number; back: number; cup: number };
}

interface HeadParts {
  head: THREE.Group;
  eyes: [THREE.Group, THREE.Group];
  happyEyes: [THREE.Object3D, THREE.Object3D];
  fz: (x: number, y: number) => number;
}

/** The head: felt skull, bead eyes, nose, rosy cheeks, pointy ears, a seam at the back. */
function buildHead(spec: HeadSpec, m: Mats): HeadParts {
  const S = (n: number) => Math.max(8, Math.round(n * (m.low ? 0.6 : 1)));
  const head = new THREE.Group();
  const H = spec.shape;
  head.add(new THREE.Mesh(cushionGeometry(H, S(64), S(44)), m.skin));
  const fz = (x: number, y: number) => frontZ(H, x, y);

  // Eyes (beads half sunk in the felt) and the ^ ^ arcs for laughing.
  const eyes: THREE.Group[] = [];
  const happy: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const { x: ex, y: ey, r } = spec.eye;
    const e = beadEye(r, m.low);
    e.position.set(sx * ex, ey, fz(ex, ey) - r * 0.28);
    e.rotation.set(-0.06, sx * 0.22, 0);
    head.add(e);
    eyes.push(e);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, r * 0.2, 8, 20, Math.PI), m.dark);
    arc.position.set(sx * ex, ey - r * 0.25, fz(ex, ey) + 0.003);
    arc.rotation.set(-0.15, sx * 0.22, 0);
    arc.visible = false;
    head.add(arc);
    happy.push(arc);
  }

  // Nose and rosy cheeks.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(spec.nose.r, S(20), S(14)), m.nose);
  nose.scale.set(1.1, 0.9, 0.85);
  nose.position.set(0, spec.nose.y, fz(0, spec.nose.y) + spec.nose.r * 0.35);
  head.add(nose);
  for (const sx of [-1, 1]) {
    const { x, y, r } = spec.cheek;
    const ch = new THREE.Mesh(new THREE.SphereGeometry(r, S(22), S(14)), m.cheek);
    ch.scale.set(1, 0.78, 0.3);
    ch.position.set(sx * x, y, fz(x, y) - r * 0.05);
    ch.rotation.y = sx * Math.atan2(x, H.c) * 0.9;
    head.add(ch);
  }

  // Pointy ears (the right one is the mirror of the left).
  const ear = earGeometry(spec.ear.len, spec.ear.width, m.low);
  cupGeometry(ear.outer, spec.ear.cup);
  cupGeometry(ear.inner, spec.ear.cup);
  for (const p of ear.rim) p.z -= p.y * p.y * spec.ear.cup;
  const earStitch = stitchGeometry(ear.rim, { closed: true, dash: spec.ear.len * 0.08, gap: spec.ear.len * 0.05, radius: spec.ear.width * 0.025 });
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(ear.outer, m.ear), new THREE.Mesh(ear.inner, m.earInner), new THREE.Mesh(earStitch, m.thread));
    const pivot = new THREE.Group();
    pivot.position.set(sx * spec.ear.x, spec.ear.y, spec.ear.z);
    pivot.scale.x = sx;
    g.rotation.set(0, spec.ear.back, spec.ear.up);
    pivot.add(g);
    head.add(pivot);
  }

  // A seam down the back of the head (the plush is sewn from two halves).
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const y = H.b * (0.85 - (1.6 * i) / 16);
      pts.push(V(0, y, -fz(0, y) - 0.002));
    }
    head.add(new THREE.Mesh(stitchGeometry(pts, { dash: 0.016, gap: 0.012, radius: 0.0035 }), m.thread));
  }

  return { head, eyes: eyes as [THREE.Group, THREE.Group], happyEyes: happy as [THREE.Object3D, THREE.Object3D], fz };
}

/** Embroidered smile: a thread curve lying on the face. */
function threadSmile(fz: (x: number, y: number) => number, cy: number, w: number, depth: number, r: number, mat: THREE.Material): THREE.Mesh {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = -1 + (2 * i) / 14;
    const x = u * w;
    const y = cy - depth * (1 - u * u) + Math.pow(Math.abs(u), 6) * depth * 0.35;
    pts.push(V(x, y, fz(x, y) + r * 0.6));
  }
  return new THREE.Mesh(taperedTube(pts, (t) => r * (0.75 + 0.25 * Math.sin(t * Math.PI)), { tubular: 28, radial: 8 }), mat);
}

/**
 * An open felt mouth (a dark half-moon with a pink tongue), as a decal laid
 * on the face. The patch never moves (it hugs the felt); opening the mouth
 * zooms the drawing inside it: `mesh.userData.open(sx, sy)`.
 */
function mouthDecal(shape: Cushion, cx: number, cy: number, w: number, h: number, style: 'grin' | 'open'): THREE.Mesh {
  const tex = canvasTexture(320, 240, (g) => {
    g.clearRect(0, 0, 320, 240);
    // Drawn in a 256×160 box centred on the canvas: room to zoom in.
    g.translate(32, 40);
    const path = () => {
      g.beginPath();
      if (style === 'grin') {
        g.moveTo(14, 34);
        g.quadraticCurveTo(128, 64, 242, 34);
        g.bezierCurveTo(236, 120, 180, 152, 128, 152);
        g.bezierCurveTo(76, 152, 20, 120, 14, 34);
      } else {
        g.moveTo(52, 44);
        g.quadraticCurveTo(128, 60, 204, 44);
        g.bezierCurveTo(200, 118, 166, 148, 128, 148);
        g.bezierCurveTo(90, 148, 56, 118, 52, 44);
      }
      g.closePath();
    };
    g.save();
    path();
    g.fillStyle = '#3c1219';
    g.fill();
    g.clip();
    const grad = g.createRadialGradient(128, 70, 10, 128, 80, 140);
    grad.addColorStop(0, '#7a2533');
    grad.addColorStop(1, ELF_COLORS.mouth);
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = ELF_COLORS.tongue;
    g.beginPath();
    g.ellipse(128, 158, style === 'grin' ? 72 : 50, 48, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.ellipse(112, 134, 16, 7, -0.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
    path();
    g.lineWidth = 7;
    g.lineJoin = 'round';
    g.strokeStyle = '#4a1720';
    g.stroke();
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, alphaTest: 0.5, transparent: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // The patch is 1.25× the drawing box so the mouth can open wider.
  const mesh = new THREE.Mesh(rectPatch(w * 1.25, h * 1.5, shape, cx, cy, 0.0025), mat);
  mesh.userData.open = (sx: number, sy: number) => {
    tex.repeat.set(1 / sx, 1 / sy);
    // Zoom about the top edge of the drawing (the mouth opens downward).
    tex.offset.set((1 - 1 / sx) / 2, (1 - 1 / sy) * 0.7);
  };
  return mesh;
}

interface LimbSpec {
  shoulder: THREE.Vector3;
  upper: number;
  fore: number;
  armR: number;
  handR: number;
  legX: number;
  legR: number;
  ankleY: number;
}

/** Arms: felt sleeve (two soft segments), a mitten hand with a thumb. */
function buildArms(torso: THREE.Group, spec: LimbSpec, sleeve: THREE.Material, m: Mats, cuff?: THREE.Material): [ElfArm, ElfArm] {
  const S = (n: number) => Math.max(6, Math.round(n * (m.low ? 0.6 : 1)));
  return [-1, 1].map((sx) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * spec.shoulder.x, spec.shoulder.y, spec.shoulder.z);
    shoulder.rotation.order = 'XYZ';
    const top = new THREE.Mesh(new THREE.SphereGeometry(spec.armR * 1.08, S(18), S(12)), sleeve);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(spec.armR, spec.upper, 4, S(14)), sleeve);
    upper.position.y = -spec.upper / 2;
    shoulder.add(top, upper);
    const elbow = new THREE.Group();
    elbow.position.y = -spec.upper;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(spec.armR * 0.94, spec.fore, 4, S(14)), sleeve);
    fore.position.y = -spec.fore / 2;
    elbow.add(fore);
    if (cuff) {
      const c = new THREE.Mesh(new THREE.TorusGeometry(spec.armR * 0.95, spec.armR * 0.28, 8, S(20)), cuff);
      c.rotation.x = Math.PI / 2;
      c.position.y = -spec.fore - spec.armR * 0.2;
      elbow.add(c);
    }
    const hand = new THREE.Mesh(cushionGeometry({ a: spec.handR * 0.95, b: spec.handR * 1.1, c: spec.handR * 0.8, p: 2.2 }, S(18), S(14)), m.skin);
    hand.position.y = -spec.fore - spec.handR * 0.95;
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(spec.handR * 0.36, spec.handR * 0.4, 3, S(8)), m.skin);
    thumb.position.set(-sx * spec.handR * 0.2, -spec.fore - spec.handR * 0.6, spec.handR * 0.6);
    thumb.rotation.set(0.9, 0, -sx * 0.3);
    elbow.add(hand, thumb);
    const anchor = new THREE.Object3D();
    anchor.position.copy(hand.position);
    elbow.add(anchor);
    torso.add(shoulder);
    return { shoulder, elbow, hand: anchor };
  }) as [ElfArm, ElfArm];
}

/** Legs with felt boots; the toe can curl up (Pépin) or stay round. */
function buildLegs(
  hips: THREE.Group,
  spec: LimbSpec,
  legMat: THREE.Material,
  bootMat: THREE.Material,
  m: Mats,
  boot: { len: number; w: number; h: number; curl: number; cuff?: THREE.Material; cuffR?: number }
): [ElfLeg, ElfLeg] {
  const S = (n: number) => Math.max(6, Math.round(n * (m.low ? 0.6 : 1)));
  return [-1, 1].map((sx) => {
    const hip = new THREE.Group();
    hip.position.set(sx * spec.legX, 0, 0);
    const legLen = hips.position.y - spec.ankleY;
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(spec.legR, Math.max(0.01, legLen - spec.legR), 4, S(14)), legMat);
    leg.position.y = -legLen / 2;
    hip.add(leg);
    const ankle = new THREE.Group();
    ankle.position.y = -legLen;
    hip.add(ankle);
    const B: Cushion = { a: boot.w, b: boot.h, c: boot.len, p: 2.3 };
    const b = new THREE.Mesh(
      cushionGeometry(B, S(28), S(20), (v) => {
        // Flat sole.
        if (v.y < -boot.h * 0.45) v.y = -boot.h * 0.45 + (v.y + boot.h * 0.45) * 0.25;
        // A lower toe.
        if (v.z > 0) v.y -= (v.z / boot.len) * boot.h * 0.18 * (v.y > 0 ? 1 : 0);
      }),
      bootMat
    );
    b.position.set(0, -spec.ankleY + boot.h * 0.45, boot.len * 0.35);
    ankle.add(b);
    // The shaft of the boot, around the ankle.
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(spec.legR * 1.18, spec.legR * 1.3, boot.h * 1.3, S(18), 1, true), bootMat);
    shaft.position.y = -spec.ankleY + boot.h * 1.2;
    ankle.add(shaft);
    if (boot.cuff) {
      const c = new THREE.Mesh(new THREE.TorusGeometry(spec.legR * 1.25, boot.cuffR ?? spec.legR * 0.35, 10, S(22)), boot.cuff);
      c.rotation.x = Math.PI / 2;
      c.position.y = -spec.ankleY + boot.h * 1.85;
      ankle.add(c);
    }
    if (boot.curl > 0) {
      // A curled felt toe, rolling up and back.
      const z0 = boot.len * 1.2;
      const y0 = -spec.ankleY + boot.h * 0.55;
      const pts = [V(0, y0, z0 - 0.03), V(0, y0 + 0.004, z0 + boot.curl * 0.35), V(0, y0 + boot.curl * 0.45, z0 + boot.curl * 0.62), V(0, y0 + boot.curl * 0.8, z0 + boot.curl * 0.42), V(0, y0 + boot.curl * 0.62, z0 + boot.curl * 0.18)];
      const toe = new THREE.Mesh(taperedTube(pts, (t) => boot.w * 0.62 * (1 - t * 0.78) + 0.004, { tubular: 24, radial: S(12) }), bootMat);
      ankle.add(toe);
    }
    hips.add(hip);
    return { hip, ankle };
  }) as [ElfLeg, ElfLeg];
}

/** Running stitches around a lathe-like body at height y with radius r(y) (z scaled). */
function ringStitch(r: number, y: number, zScale: number, opts: { dash?: number; gap?: number; radius?: number; from?: number; to?: number; wave?: (a: number) => number } = {}): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const from = opts.from ?? 0;
  const to = opts.to ?? Math.PI * 2;
  const closed = opts.from === undefined;
  const n = 96;
  for (let i = 0; i <= (closed ? n - 1 : n); i++) {
    const a = from + ((to - from) * i) / n;
    pts.push(V(Math.sin(a) * r, y + (opts.wave?.(a) ?? 0), Math.cos(a) * r * zScale));
  }
  return stitchGeometry(pts, { closed, dash: opts.dash, gap: opts.gap, radius: opts.radius });
}

// ---------------------------------------------------------------------------
// The skeleton shared by the three elves

interface Skeleton {
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  breath: THREE.Group;
  neck: THREE.Group;
}

function skeleton(id: ElfId, hipY: number, neckY: number, scale: number): Skeleton {
  const root = new THREE.Group();
  root.name = `lutin-${id}`;
  const body = new THREE.Group();
  body.scale.setScalar(scale);
  root.add(body);
  const hips = new THREE.Group();
  hips.position.y = hipY;
  body.add(hips);
  const torso = new THREE.Group();
  torso.rotation.order = 'YXZ';
  hips.add(torso);
  const breath = new THREE.Group();
  torso.add(breath);
  const neck = new THREE.Group();
  neck.position.y = neckY;
  neck.rotation.order = 'YXZ';
  torso.add(neck);
  return { root, body, hips, torso, breath, neck };
}

// ---------------------------------------------------------------------------
// Pépin

function buildPepin(low: boolean): ElfModel {
  const C = ELF_COLORS.pepin;
  const m = baseMats(low);
  const S = (n: number) => Math.max(8, Math.round(n * (low ? 0.6 : 1)));
  const hipY = 0.21;
  const BODY: Cushion = { a: 0.235, b: 0.215, c: 0.205, p: 2.3 };
  const bodyY = 0.17;
  const sk = skeleton('pepin', hipY, 0.39, 1);
  const tunic = elfFelt(C.tunic, { repeat: 4, sheen: '#b8ffc8', lowPower: low });
  const tunicSmall = elfFelt(C.tunic, { repeat: 2, sheen: '#b8ffc8', lowPower: low });
  const boots = elfFelt(C.boots, { repeat: 2, sheen: '#b8ffc8', lowPower: low });
  const springs: ElfModel['springs'] = [];

  // Round tunic body.
  const body = new THREE.Mesh(cushionGeometry(BODY, S(56), S(40)), tunic);
  body.position.y = bodyY;
  sk.breath.add(body);
  // Pointed tunic hem: a flared felt skirt with five soft points.
  const beltY = bodyY - 0.075;
  {
    const rTop = cushionR(BODY, beltY - bodyY) + 0.006;
    const top = beltY;
    const bot = -0.085;
    const g = new THREE.CylinderGeometry(rTop, 0.252, top - bot, S(80), 6, true);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const pts = 7;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const yl = (pos.getY(i) + (top - bot) / 2) / (top - bot); // 0 at the hem, 1 at the belt
      const a = Math.atan2(x, z);
      const tri = Math.abs(((((a / (Math.PI * 2)) * pts) % 1) + 1) % 1 - 0.5) * 2; // 1 at points? 0 at points
      const drop = (1 - yl) * (0.6 - tri) * 0.05;
      pos.setY(i, pos.getY(i) - drop);
      pos.setZ(i, z * (BODY.c / BODY.a));
    }
    g.computeVertexNormals();
    smoothSeams(g);
    const skirtMat = tunic.clone();
    skirtMat.side = THREE.DoubleSide;
    const skirt = new THREE.Mesh(g, skirtMat);
    skirt.position.y = (top + bot) / 2;
    sk.breath.add(skirt);
    // Stitches along the pointed hem.
    const hemPts: THREE.Vector3[] = [];
    for (let i = 0; i < 140; i++) {
      const a = (i / 140) * Math.PI * 2;
      const tri = Math.abs(((((a / (Math.PI * 2)) * pts) % 1) + 1) % 1 - 0.5) * 2;
      const r = 0.252 + 0.004;
      hemPts.push(V(Math.sin(a) * r, bot + 0.018 - (0.6 - tri) * 0.05 * 0.92, Math.cos(a) * r * (BODY.c / BODY.a)));
    }
    sk.breath.add(new THREE.Mesh(stitchGeometry(hemPts, { closed: true, dash: 0.018, gap: 0.012, radius: 0.0038 }), m.thread));
  }
  // Leather-look belt with a brass buckle and stitched edges.
  {
    const r = cushionR(BODY, beltY - bodyY) + 0.014;
    const zs = BODY.c / BODY.a;
    const beltMat = new THREE.MeshStandardMaterial({ color: C.belt, roughness: 0.5, metalness: 0 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.004, 0.05, S(64), 1, true), beltMat);
    band.scale.z = zs;
    band.position.y = beltY;
    for (const dy of [-0.025, 0.025]) {
      const e = new THREE.Mesh(new THREE.TorusGeometry(r + 0.002, 0.004, 6, S(64)), beltMat);
      e.rotation.x = Math.PI / 2;
      e.scale.y = zs;
      e.position.y = beltY + dy;
      sk.breath.add(e);
    }
    sk.breath.add(band);
    sk.breath.add(new THREE.Mesh(ringStitch(r + 0.003, beltY + 0.016, zs, { dash: 0.012, gap: 0.009, radius: 0.0028 }), threadMaterial('#e8c99a')));
    sk.breath.add(new THREE.Mesh(ringStitch(r + 0.003, beltY - 0.016, zs, { dash: 0.012, gap: 0.009, radius: 0.0028 }), threadMaterial('#e8c99a')));
    const frame = new THREE.Shape();
    frame.moveTo(-0.04, -0.035);
    frame.lineTo(0.04, -0.035);
    frame.lineTo(0.04, 0.035);
    frame.lineTo(-0.04, 0.035);
    frame.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-0.025, -0.021);
    hole.lineTo(0.025, -0.021);
    hole.lineTo(0.025, 0.021);
    hole.lineTo(-0.025, 0.021);
    hole.closePath();
    frame.holes.push(hole);
    const buckle = new THREE.Mesh(new THREE.ExtrudeGeometry(frame, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3 }), m.gold);
    buckle.position.set(0, beltY, r * zs + 0.002);
    sk.breath.add(buckle);
  }
  // Two golden round buttons.
  for (const y of [bodyY + 0.035, bodyY + 0.11]) {
    const z = frontZ(BODY, 0, y - bodyY);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, S(18), S(12)), m.gold);
    b.scale.set(1, 1, 0.5);
    b.position.set(0, y, z + 0.004);
    b.rotation.x = -Math.atan2(y - bodyY, BODY.b) * 0.8;
    sk.breath.add(b);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.003, 6, 18), m.gold);
    rim.position.copy(b.position).add(V(0, 0, 0.009));
    rim.rotation.x = b.rotation.x;
    sk.breath.add(rim);
  }
  // A side seam on the tunic.
  for (const sx of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const y = bodyY + 0.19 - (0.24 * i) / 10;
      pts.push(V(sx * (cushionR(BODY, y - bodyY) + 0.002), y, 0));
    }
    sk.breath.add(new THREE.Mesh(stitchGeometry(pts, { dash: 0.016, gap: 0.012, radius: 0.0032 }), m.thread));
  }
  // A pointed felt collar.
  {
    const collarY = 0.36;
    const g = new THREE.CylinderGeometry(0.11, 0.17, 0.05, S(72), 3, true);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const a = Math.atan2(pos.getX(i), pos.getZ(i));
      const yl = (pos.getY(i) + 0.025) / 0.05;
      const tri = Math.abs(((((a / (Math.PI * 2)) * 8) % 1) + 1) % 1 - 0.5) * 2;
      const drop = (1 - yl) * (0.55 - tri) * 0.045;
      pos.setY(i, pos.getY(i) - drop);
      pos.setZ(i, pos.getZ(i) * 0.95);
    }
    g.computeVertexNormals();
    const mat = elfFelt(C.tunicDark, { repeat: 2, sheen: '#b8ffc8', lowPower: low });
    mat.side = THREE.DoubleSide;
    const collar = new THREE.Mesh(g, mat);
    collar.position.y = collarY;
    sk.torso.add(collar);
  }

  // Limbs.
  const limbs: LimbSpec = { shoulder: V(0.205, 0.3, 0), upper: 0.07, fore: 0.07, armR: 0.052, handR: 0.048, legX: 0.088, legR: 0.052, ankleY: 0.075 };
  const arms = buildArms(sk.torso, limbs, tunicSmall, m, elfFelt(C.tunicDark, { repeat: 1, lowPower: low }));
  const legs = buildLegs(sk.hips, limbs, tunicSmall, boots, m, { len: 0.1, w: 0.062, h: 0.06, curl: 0.075 });

  // Head.
  const headSpec: HeadSpec = {
    shape: { a: 0.24, b: 0.222, c: 0.215, p: 2.25 },
    eye: { x: 0.086, y: -0.006, r: 0.034 },
    nose: { y: -0.058, r: 0.03 },
    cheek: { x: 0.142, y: -0.072, r: 0.046 },
    ear: { len: 0.23, width: 0.13, x: 0.205, y: 0.005, z: -0.02, up: 0.36, back: 0.3, cup: 1.4 },
  };
  const hp = buildHead(headSpec, m);
  hp.head.position.y = 0.2;
  sk.neck.add(hp.head);
  const H = headSpec.shape;
  // Wide cheeky grin (a felt mouth), a bit wider when laughing.
  const grin = mouthDecal(H, 0, -0.118, 0.165, 0.095, 'grin');
  hp.head.add(grin);
  // Freckles: three embroidered orange dots on each cheek.
  {
    const fm = threadMaterial(C.freckle);
    for (const sx of [-1, 1])
      for (const [dx, dy] of [
        [-0.025, 0.012],
        [0.0, 0.026],
        [0.02, 0.006],
      ]) {
        const x = sx * (headSpec.cheek.x + dx * sx * -1 + 0.005);
        const y = headSpec.cheek.y + dy + 0.012;
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), fm);
        f.scale.set(1, 1, 0.45);
        f.position.set(x, y, frontZ(H, x, y) + headSpec.cheek.r * 0.3 * 0.55);
        f.rotation.y = Math.atan2(x, H.c);
        hp.head.add(f);
      }
  }
  // Cheeky raised brows (copper yarn).
  const yarn = yarnTextures(C.hair, 3, 11);
  const hairMat = knitMaterial(yarn, [2, 2], low, '#ffd2a8');
  for (const sx of [-1, 1]) {
    const pts = [V(sx * 0.055, 0.052, 0), V(sx * 0.085, 0.064, 0), V(sx * 0.118, 0.058, 0)].map((p) => p.setZ(frontZ(H, p.x, p.y) + 0.006));
    hp.head.add(new THREE.Mesh(taperedTube(pts, (t) => 0.0075 * (0.6 + 0.4 * Math.sin(t * Math.PI)), { tubular: 12, radial: 8 }), hairMat));
  }

  // Very long striped knitted hat flopping to the side, with a jingle bell.
  const hat = new THREE.Group();
  hat.position.set(0, 0.1, -0.012);
  hat.rotation.set(-0.12, 0, -0.06);
  hp.head.add(hat);
  {
    const knit = knitTextures({ colors: [C.hatRed, C.hatWhite], rowsPerStripe: 7, cols: 14, rows: 14, along: 'u', seed: 3, size: 512 });
    const hatMat = knitMaterial(knit, [4.5, 3], low);
    const band = knitTextures({ colors: [C.hatWhite], cols: 12, rows: 4, rib: true, seed: 9 });
    const bandMat = knitMaterial(band, [5, 1], low);
    // Folded ribbed band.
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.232, 0.036, S(14), S(64)), bandMat);
    brim.rotation.x = Math.PI / 2;
    brim.scale.set(1, 0.94, 1.15);
    hat.add(brim);
    const flop = new THREE.Group();
    flop.position.y = 0.02;
    hat.add(flop);
    const pts = [V(0, -0.01, 0), V(0.0, 0.1, -0.01), V(0.035, 0.2, -0.03), V(0.12, 0.27, -0.04), V(0.23, 0.27, -0.03), V(0.32, 0.19, -0.01), V(0.37, 0.07, 0.01), V(0.39, -0.06, 0.02), V(0.395, -0.17, 0.03)];
    const cone = new THREE.Mesh(taperedTube(pts, (t) => 0.225 * Math.pow(1 - t, 1.25) + 0.024, { tubular: S(72), radial: S(28), amp: 0.03, freq: 3, seed: 4 }), hatMat);
    flop.add(cone);
    const tip = pts[pts.length - 1];
    const bell = new THREE.Group();
    bell.position.set(tip.x, tip.y - 0.02, tip.z);
    flop.add(bell);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.036, S(22), S(16)), m.gold);
    ball.position.y = -0.03;
    const slit = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.004, 6, S(28), Math.PI), threadMaterial('#3a2a10'));
    slit.position.y = -0.042;
    slit.rotation.set(Math.PI / 2, 0, 0);
    const slot = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.022, 2, 6), threadMaterial('#2a1d08'));
    slot.position.set(0, -0.052, 0.03);
    slot.rotation.x = -0.6;
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.004, 6, 12), m.gold);
    loop.position.y = 0.006;
    bell.add(ball, slit, slot, loop);
    springs.push({ obj: flop, axis: 'z', gain: 1, rest: 0 });
    springs.push({ obj: bell, axis: 'z', gain: 1.8, rest: 0 });
  }
  // Short curly copper yarn hair peeking out under the hat: plump curls
  // (lumpy puffs of yarn) all round, a few loose loops on top of them.
  {
    const r = rng(23);
    const puffs: THREE.BufferGeometry[] = [];
    const loops: THREE.BufferGeometry[] = [];
    const at = (a: number, y: number, out: number) => V(Math.sin(a) * (0.232 + out), y, Math.cos(a) * (0.232 + out) * 0.96 - 0.012);
    for (let i = 0; i < 30; i++) {
      const a = -Math.PI + (i / 30) * Math.PI * 2 + (r() - 0.5) * 0.1;
      const front = Math.cos(a);
      // Over the forehead: a short fringe; over the ears and at the back: fuller.
      const y = front > 0.55 ? 0.068 : 0.05 - (1 - Math.max(0, front)) * 0.03;
      const rad = front > 0.55 ? 0.026 : 0.034;
      const p = at(a, y + (r() - 0.5) * 0.01, -0.008);
      puffs.push(puffAt(p.x, p.y, p.z, rad, 200 + i, { amp: 0.45, freq: 3.2, seg: low ? 10 : 14, sz: 0.85 }));
      if (front < 0.55 && r() < 0.6) {
        const q = at(a + 0.05, y - 0.03, -0.004);
        puffs.push(puffAt(q.x, q.y, q.z, rad * 0.85, 300 + i, { amp: 0.45, freq: 3.2, seg: low ? 10 : 12, sz: 0.85 }));
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI + (i / 12) * Math.PI * 2 + 0.2;
      const front = Math.cos(a);
      const g = new THREE.TorusGeometry(0.02, 0.009, 8, 16, Math.PI * 1.6);
      g.rotateZ(r() * Math.PI * 2);
      g.rotateY(a);
      const p = at(a, (front > 0.55 ? 0.07 : 0.035) + (r() - 0.5) * 0.02, 0.018);
      g.translate(p.x, p.y, p.z);
      loops.push(g);
    }
    hp.head.add(new THREE.Mesh(mergeAll(puffs), hairMat));
    hp.head.add(new THREE.Mesh(mergeAll(loops), hairMat));
  }

  const setMouth = (open: number) => {
    (grin.userData.open as (x: number, y: number) => void)(1 + open * 0.06, 0.92 + open * 0.3);
  };

  return finish('pepin', sk, hp, arms, legs, springs, setMouth, { hipY, seatY: 0.06, heelLift: 0.03, eyeY: headSpec.eye.y, eyeX: headSpec.eye.x, scale: 1 });
}

// ---------------------------------------------------------------------------
// Grelotte

function buildGrelotte(low: boolean): ElfModel {
  const C = ELF_COLORS.grelotte;
  const m = baseMats(low);
  const S = (n: number) => Math.max(8, Math.round(n * (low ? 0.6 : 1)));
  const hipY = 0.25;
  const sk = skeleton('grelotte', hipY, 0.37, 1);
  const dress = elfFelt(C.dress, { repeat: 4, sheen: '#e6dcff', lowPower: low });
  const dressSmall = elfFelt(C.dress, { repeat: 2, sheen: '#e6dcff', lowPower: low });
  const boots = elfFelt(C.boots, { repeat: 2, sheen: '#e6dcff', lowPower: low });
  const tights = elfFelt(C.tights, { repeat: 2, sheen: '#ffffff', lowPower: low });
  const springs: ElfModel['springs'] = [];
  const ZS = 0.86;

  // A-line felt dress (lathe), a little flatter front to back.
  const prof = (y: number) => {
    // y: hips-local, from the hem (-0.085) to the neck (0.36).
    const t = (y + 0.085) / 0.445;
    return 0.235 - 0.12 * Math.pow(t, 1.1) + 0.035 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - (t > 0.82 ? Math.pow((t - 0.82) / 0.18, 2) * 0.09 : 0);
  };
  {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 30; i++) {
      const y = -0.085 + (0.445 * i) / 30;
      pts.push(new THREE.Vector2(Math.max(0.001, prof(y)), y));
    }
    pts.push(new THREE.Vector2(0.001, 0.362));
    const g = new THREE.LatheGeometry(pts, S(72));
    g.scale(1, 1, ZS);
    smoothSeams(g);
    const mat = dress.clone();
    mat.side = THREE.DoubleSide;
    sk.breath.add(new THREE.Mesh(g, mat));
    // Hem: a rolled edge with white running stitches.
    const hem = new THREE.Mesh(new THREE.TorusGeometry(prof(-0.085), 0.008, 8, S(72)), dress);
    hem.rotation.x = Math.PI / 2;
    hem.scale.y = ZS;
    hem.position.y = -0.083;
    sk.breath.add(hem);
    sk.breath.add(new THREE.Mesh(ringStitch(prof(-0.06) + 0.004, -0.06, ZS, { dash: 0.018, gap: 0.012, radius: 0.0036 }), m.thread));
    // Side seams.
    for (const sx of [-1, 1]) {
      const sp: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const y = -0.07 + (0.38 * i) / 10;
        sp.push(V(sx * (prof(y) + 0.002), y, 0));
      }
      sk.breath.add(new THREE.Mesh(stitchGeometry(sp, { dash: 0.016, gap: 0.012, radius: 0.003 }), m.thread));
    }
  }
  // White felt snowflake appliqué on the chest, with tiny stitches.
  {
    const cy = 0.2;
    const r0 = prof(cy);
    const snowMat = elfFelt(C.snow, { repeat: 1, sheen: '#ffffff', lowPower: low, emissive: '#ffffff', emissiveIntensity: 0.04 });
    const flake = new THREE.Group();
    const R = 0.058;
    const parts: THREE.BufferGeometry[] = [];
    const bar = (len: number, w: number, ang: number, ox: number, oy: number) => {
      const g = new THREE.CapsuleGeometry(w, len, 3, 8);
      g.scale(1, 1, 0.45);
      g.translate(0, len / 2, 0);
      g.rotateZ(ang);
      g.translate(ox, oy, 0);
      parts.push(g);
    };
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      bar(R, 0.0085, a, 0, 0);
      const bx = -Math.sin(a) * R * 0.55;
      const by = Math.cos(a) * R * 0.55;
      bar(R * 0.34, 0.0062, a + 0.8, bx, by);
      bar(R * 0.34, 0.0062, a - 0.8, bx, by);
    }
    const centre = new THREE.CylinderGeometry(0.016, 0.016, 0.008, 6);
    centre.rotateX(Math.PI / 2);
    parts.push(centre);
    flake.add(new THREE.Mesh(mergeAll(parts.map((p) => (p.index ? p.toNonIndexed() : p))), snowMat));
    // Lean with the dress surface.
    const slope = (prof(cy + 0.01) - prof(cy - 0.01)) / 0.02;
    flake.position.set(0, cy, r0 * ZS + 0.006);
    flake.rotation.x = Math.atan(slope) * 0.9;
    sk.breath.add(flake);
  }
  // Mustard chunky knitted scarf with two tails and fringes.
  {
    const knit = knitTextures({ colors: [C.mustard], cols: 6, rows: 7, along: 'u', seed: 13 });
    const mat = knitMaterial(knit, [8, 1.5], low, '#fff1c4');
    const knit2 = knitTextures({ colors: [C.mustard], cols: 4, rows: 6, along: 'u', seed: 14 });
    const tailMat = knitMaterial(knit2, [3, 1], low, '#fff1c4');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.048, S(16), S(48)), mat);
    ring.rotation.x = Math.PI / 2 - 0.08;
    ring.scale.set(1, 0.92, 1.05);
    ring.position.y = 0.355;
    sk.torso.add(ring);
    const tails: [THREE.Vector3[], number][] = [
      [[V(0.085, 0.34, 0.1), V(0.12, 0.28, 0.135), V(0.14, 0.19, 0.145), V(0.15, 0.1, 0.15)], 0.1],
      [[V(0.06, 0.34, 0.115), V(0.08, 0.3, 0.155), V(0.09, 0.22, 0.17), V(0.095, 0.15, 0.175)], -0.1],
    ];
    const fringe = new THREE.MeshStandardMaterial({ color: '#d99a1f', roughness: 0.9 });
    for (const [pts, tw] of tails) {
      const tail = new THREE.Mesh(taperedTube(pts, () => 0.034, { tubular: 20, radial: S(14), squash: 0.55, squashAxis: V(0, 0, 1) }), tailMat);
      tail.rotation.z = tw * 0.2;
      sk.torso.add(tail);
      const end = pts[pts.length - 1];
      for (let i = 0; i < 5; i++) {
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, 0.028, 2, 6), fringe);
        f.position.set(end.x - 0.026 + i * 0.013, end.y - 0.022, end.z + 0.002);
        f.rotation.z = (i - 2) * 0.12;
        sk.torso.add(f);
      }
    }
  }

  const limbs: LimbSpec = { shoulder: V(0.135, 0.3, 0), upper: 0.08, fore: 0.075, armR: 0.042, handR: 0.043, legX: 0.065, legR: 0.042, ankleY: 0.075 };
  const arms = buildArms(sk.torso, limbs, dressSmall, m, elfFelt(C.dressDark, { repeat: 1, lowPower: low }));
  const legs = buildLegs(sk.hips, limbs, tights, boots, m, { len: 0.092, w: 0.054, h: 0.058, curl: 0.04, cuff: elfFelt(C.dressDark, { repeat: 1, lowPower: low }), cuffR: 0.012 });

  const headSpec: HeadSpec = {
    shape: { a: 0.226, b: 0.212, c: 0.205, p: 2.25 },
    eye: { x: 0.08, y: -0.012, r: 0.03 },
    nose: { y: -0.06, r: 0.025 },
    cheek: { x: 0.135, y: -0.075, r: 0.042 },
    ear: { len: 0.16, width: 0.1, x: 0.195, y: -0.015, z: -0.02, up: 0.38, back: 0.36, cup: 1.4 },
  };
  const hp = buildHead(headSpec, m);
  hp.head.position.y = 0.21;
  sk.neck.add(hp.head);
  const H = headSpec.shape;
  const smile = threadSmile(hp.fz, -0.105, 0.04, 0.016, 0.0055, threadMaterial('#8a2633'));
  hp.head.add(smile);
  const open = mouthDecal(H, 0, -0.112, 0.085, 0.06, 'open');
  open.visible = false;
  hp.head.add(open);
  // Fine brows.
  for (const sx of [-1, 1]) {
    const pts = [V(sx * 0.052, 0.058, 0), V(sx * 0.08, 0.066, 0), V(sx * 0.108, 0.06, 0)].map((p) => p.setZ(frontZ(H, p.x, p.y) + 0.004));
    hp.head.add(new THREE.Mesh(taperedTube(pts, (t) => 0.005 * (0.6 + 0.4 * Math.sin(t * Math.PI)), { tubular: 12, radial: 6 }), threadMaterial(C.braid)));
  }
  // Round golden wire glasses.
  {
    const { x: ex, y: ey } = headSpec.eye;
    const R = 0.05;
    const z = hp.fz(ex, ey) + 0.022;
    for (const sx of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0042, 8, S(40)), m.gold);
      rim.position.set(sx * ex, ey, z);
      rim.rotation.y = sx * 0.2;
      hp.head.add(rim);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(R * 0.96, S(32)), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0, depthWrite: false }));
      lens.position.copy(rim.position);
      lens.rotation.copy(rim.rotation);
      lens.renderOrder = 2;
      hp.head.add(lens);
      const temple = new THREE.Mesh(
        taperedTube([V(sx * (ex + R * 0.98), ey + 0.005, z - 0.01), V(sx * 0.17, ey + 0.012, z - 0.06), V(sx * 0.215, ey + 0.012, -0.0)], () => 0.0038, { tubular: 12, radial: 6 }),
        m.gold
      );
      hp.head.add(temple);
    }
    const bridge = new THREE.Mesh(taperedTube([V(-ex + R * 0.95, ey + 0.008, z + 0.002), V(0, ey + 0.02, z + 0.012), V(ex - R * 0.95, ey + 0.008, z + 0.002)], () => 0.0038, { tubular: 10, radial: 6 }), m.gold);
    hp.head.add(bridge);
  }
  // Dark-brown yarn hair: a cap with a parting, and two long braids with red bows.
  const yarn = yarnTextures(C.braid, 3, 7);
  const hairMat = knitMaterial(yarn, [5, 1], low, '#c9a08a');
  {
    const shell = cushionGeometry({ a: H.a * 1.04, b: H.b * 1.04, c: H.c * 1.05, p: H.p }, S(56), S(40));
    clipGeometry(shell, (c) => {
      const a = Math.atan2(c.x, c.z); // 0 in front
      const front = Math.cos(a);
      // High on the forehead, down to the ears at the sides and the nape at the back.
      const line = front > 0 ? 0.075 * front - 0.012 * (1 - front) : -0.012 + 0.14 * front;
      return c.y > line;
    });
    const hairCapMat = knitMaterial(yarnTextures(C.braid, 2, 8), [10, 6], low, '#c9a08a');
    hp.head.add(new THREE.Mesh(shell, hairCapMat));
    // Hair strands swept from the parting (a few thick yarn locks on the forehead).
    for (const sx of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const x = sx * (0.012 + t * 0.15);
        const y = 0.12 - t * t * 0.055;
        pts.push(V(x, y, hp.fz(x, y) + 0.008));
      }
      hp.head.add(new THREE.Mesh(taperedTube(pts, (t) => 0.016 * (1 - t * 0.4), { tubular: 20, radial: 8 }), hairMat));
    }
  }
  const braids: THREE.Group[] = [];
  {
    const bowMat = elfFelt(C.bow, { repeat: 1, sheen: '#ffc0c0', lowPower: low });
    const bow = bowGeometry(0.03);
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.17, -0.05, -0.07);
      hp.head.add(pivot);
      const pts = [V(0, 0, 0), V(sx * 0.03, -0.08, 0.02), V(sx * 0.045, -0.17, 0.07), V(sx * 0.04, -0.26, 0.1), V(sx * 0.035, -0.33, 0.105)];
      const strands = braidGeometry(pts, { width: 0.016, strand: 0.0145, crossings: 5.5, taper: 0.3, side: V(1, 0, 0.3), depth: V(0, 0, 1) });
      const merged = mergeAll(strands);
      pivot.add(new THREE.Mesh(merged, hairMat));
      const end = pts[pts.length - 1];
      const b = new THREE.Mesh(bow, bowMat);
      b.position.set(end.x, end.y + 0.005, end.z + 0.012);
      b.rotation.set(-0.3, sx * 0.25, 0);
      pivot.add(b);
      const tuft = new THREE.Mesh(puffGeometry({ a: 0.02, b: 0.026, c: 0.018, p: 2 }, { amp: 0.5, freq: 4, seed: 5 + sx, wSeg: 14, hSeg: 10 }), hairMat);
      tuft.position.set(end.x, end.y - 0.03, end.z);
      pivot.add(tuft);
      braids.push(pivot);
      springs.push({ obj: pivot, axis: 'z', gain: 0.6, rest: 0 });
      springs.push({ obj: pivot, axis: 'x', gain: 0.4, rest: 0 });
    }
  }
  // Short folded mustard beanie with a pompom.
  {
    const hat = new THREE.Group();
    hat.position.set(0, 0.075, -0.01);
    hat.rotation.set(-0.16, 0, 0.06);
    hp.head.add(hat);
    const knit = knitTextures({ colors: [C.mustard], cols: 8, rows: 9, seed: 21 });
    const mat = knitMaterial(knit, [6, 2], low, '#fff1c4');
    const dome = new THREE.Mesh(
      cushionGeometry({ a: 0.238, b: 0.2, c: 0.226, p: 2.2 }, S(56), S(36), (v) => {
        if (v.y < 0) v.y *= 0.05;
      }),
      mat
    );
    hat.add(dome);
    const rib = knitTextures({ colors: [C.mustard], cols: 12, rows: 4, rib: true, seed: 22 });
    const ribMat = knitMaterial(rib, [6, 1], low, '#fff1c4');
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.252, 0.252, 0.07, S(64), 1, true), ribMat);
    brim.scale.z = 0.95;
    brim.position.y = 0.015;
    const lipTop = new THREE.Mesh(new THREE.TorusGeometry(0.252, 0.012, 8, S(64)), ribMat);
    lipTop.rotation.x = Math.PI / 2;
    lipTop.scale.y = 0.95;
    lipTop.position.y = 0.05;
    const lipBot = lipTop.clone();
    lipBot.position.y = -0.02;
    hat.add(brim, lipTop, lipBot);
    const pom = new THREE.Mesh(puffGeometry({ a: 0.072, b: 0.068, c: 0.072, p: 2 }, { amp: 0.35, freq: 5, seed: 8, wSeg: S(30), hSeg: S(22) }), knitMaterial(yarnTextures(C.mustard, 4, 30), [4, 4], low, '#fff1c4'));
    pom.position.set(0.01, 0.235, -0.01);
    hat.add(pom);
  }

  const setMouth = (o: number) => {
    const isOpen = o > 0.4;
    smile.visible = !isOpen;
    open.visible = isOpen;
    (open.userData.open as (x: number, y: number) => void)(0.85 + o * 0.15, 0.7 + o * 0.4);
  };

  return finish('grelotte', sk, hp, arms, legs, springs, setMouth, { hipY, seatY: 0.07, heelLift: 0.03, eyeY: headSpec.eye.y, eyeX: headSpec.eye.x, scale: 1 });
}

// ---------------------------------------------------------------------------
// Noisette

function buildNoisette(low: boolean): ElfModel {
  const C = ELF_COLORS.noisette;
  const m = baseMats(low);
  const S = (n: number) => Math.max(8, Math.round(n * (low ? 0.6 : 1)));
  // Built at full size, shown at half: the tiniest elf.
  const hipY = 0.2;
  const BODY: Cushion = { a: 0.2, b: 0.19, c: 0.18, p: 2.3 };
  const bodyY = 0.15;
  const sk = skeleton('noisette', hipY, 0.35, 0.5);
  const tunic = elfFelt(C.tunic, { repeat: 3, sheen: '#ffffff', lowPower: low });
  const cape = elfFelt(C.cape, { repeat: 4, sheen: '#ffd9b0', lowPower: low });
  const boots = elfFelt(C.boots, { repeat: 2, sheen: '#ffd9b0', lowPower: low });
  const springs: ElfModel['springs'] = [];

  const body = new THREE.Mesh(cushionGeometry(BODY, S(48), S(36)), tunic);
  body.position.y = bodyY;
  sk.breath.add(body);
  sk.breath.add(new THREE.Mesh(ringStitch(cushionR(BODY, -0.13) + 0.003, bodyY - 0.13, BODY.c / BODY.a, { dash: 0.02, gap: 0.014, radius: 0.0045 }), threadMaterial('#c98f5a')));

  // Hooded capelet: open in front, rolled edges with blanket stitches.
  const capeTop = 0.35;
  const capeHem = 0.0;
  const capeR = (y: number) => {
    const t = (capeTop - y) / (capeTop - capeHem); // 0 at the neck, 1 at the hem
    return 0.14 + 0.12 * Math.pow(t, 0.55);
  };
  const gap = 1.05;
  {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const y = capeTop - ((capeTop - capeHem) * i) / 20;
      pts.push(new THREE.Vector2(capeR(y), y));
    }
    pts.reverse();
    const g = new THREE.LatheGeometry(pts, S(72), gap / 2, Math.PI * 2 - gap);
    g.scale(1, 1, 0.92);
    const mat = cape.clone();
    mat.side = THREE.DoubleSide;
    sk.torso.add(new THREE.Mesh(g, mat));
    // Rolled hem + front edges.
    const edge: THREE.Vector3[] = [];
    const a0 = gap / 2;
    const a1 = Math.PI * 2 - gap / 2;
    for (let i = 0; i <= 8; i++) {
      const y = capeTop - ((capeTop - capeHem) * i) / 8;
      edge.push(V(Math.sin(a0) * capeR(y), y, Math.cos(a0) * capeR(y) * 0.92));
    }
    for (let i = 1; i <= 40; i++) {
      const a = a0 + ((a1 - a0) * i) / 40;
      edge.push(V(Math.sin(a) * capeR(capeHem), capeHem, Math.cos(a) * capeR(capeHem) * 0.92));
    }
    for (let i = 1; i <= 8; i++) {
      const y = capeHem + ((capeTop - capeHem) * i) / 8;
      edge.push(V(Math.sin(a1) * capeR(y), y, Math.cos(a1) * capeR(y) * 0.92));
    }
    sk.torso.add(new THREE.Mesh(taperedTube(edge, () => 0.011, { tubular: 140, radial: 8 }), cape));
    const st = edge.map((p) => {
      const q = p.clone();
      const out = V(q.x, 0, q.z).normalize();
      return q.addScaledVector(out, 0.012).add(V(0, 0.018, 0));
    });
    sk.torso.add(new THREE.Mesh(stitchGeometry(st.slice(9, 49), { dash: 0.02, gap: 0.016, radius: 0.0048 }), threadMaterial('#f6e3c0')));
  }
  // A green felt leaf pinned on the cape.
  {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.03, 0.02, 0.05, 0.06, 0, 0.11);
    s.bezierCurveTo(-0.05, 0.06, -0.03, 0.02, 0, 0);
    const leafMat = elfFelt(C.leaf, { repeat: 1, sheen: '#d8ffd8', lowPower: low });
    const leaf = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 3, curveSegments: 16 }), leafMat);
    const g = new THREE.Group();
    g.add(leaf);
    const rib = new THREE.Mesh(stitchGeometry([V(0, 0.008, 0.011), V(0.002, 0.05, 0.012), V(0, 0.095, 0.011)], { dash: 0.014, gap: 0.008, radius: 0.0032 }), threadMaterial('#e9ffe0'));
    g.add(rib);
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.02, 2, 6), threadMaterial('#2c7a3a'));
    stem.position.set(0, -0.01, 0.004);
    g.add(stem);
    const a = gap / 2 + 0.12;
    const y = capeTop - 0.06;
    g.position.set(Math.sin(a) * capeR(y) + 0.01, y, Math.cos(a) * capeR(y) * 0.92 + 0.012);
    g.rotation.set(-0.3, 0.45, -0.7);
    sk.torso.add(g);
  }

  const limbs: LimbSpec = { shoulder: V(0.115, 0.27, 0.03), upper: 0.085, fore: 0.075, armR: 0.042, handR: 0.046, legX: 0.075, legR: 0.048, ankleY: 0.075 };
  const arms = buildArms(sk.torso, limbs, elfFelt(C.tunic, { repeat: 1.5, lowPower: low }), m);
  const legs = buildLegs(sk.hips, limbs, tunic, boots, m, { len: 0.085, w: 0.058, h: 0.058, curl: 0 });

  const headSpec: HeadSpec = {
    shape: { a: 0.265, b: 0.245, c: 0.235, p: 2.2 },
    eye: { x: 0.097, y: -0.03, r: 0.05 },
    nose: { y: -0.083, r: 0.026 },
    cheek: { x: 0.158, y: -0.097, r: 0.048 },
    ear: { len: 0.11, width: 0.075, x: 0.262, y: -0.02, z: -0.04, up: 0.45, back: 0.3, cup: 1.2 },
  };
  const hp = buildHead(headSpec, m);
  hp.head.position.y = 0.22;
  sk.neck.add(hp.head);
  const H = headSpec.shape;
  const smile = threadSmile(hp.fz, -0.13, 0.03, 0.012, 0.006, threadMaterial('#8a2633'));
  hp.head.add(smile);
  const open = mouthDecal(H, 0, -0.135, 0.07, 0.05, 'open');
  open.visible = false;
  hp.head.add(open);

  // The hood: a felt shell with an oval opening for the face, rolled edge.
  {
    const HO: Cushion = { a: H.a * 1.12, b: H.b * 1.1, c: H.c * 1.13, p: 2.2 };
    const ox = 0.66;
    const oyTop = 0.54;
    const oyBot = 0.8;
    const oc = -0.02;
    const inOpening = (d: THREE.Vector3) => {
      if (d.z <= 0) return false;
      const yy = d.y - oc;
      const ry = yy > 0 ? oyTop : oyBot;
      return (d.x / ox) ** 2 + (yy / ry) ** 2 < 1;
    };
    const g = cushionGeometry(HO, S(72), S(52), (v) => {
      // A soft point at the back of the hood.
      const back = Math.max(0, -v.z / HO.c);
      v.z -= Math.pow(back, 3) * 0.03 * Math.max(0, v.y / HO.b + 0.2);
    });
    const dir = new THREE.Vector3();
    clipGeometry(g, (c) => !inOpening(dir.set(c.x / HO.a, c.y / HO.b, c.z / HO.c).normalize()));
    const mat = cape.clone();
    mat.side = THREE.DoubleSide;
    const hood = new THREE.Mesh(g, mat);
    hood.position.y = 0.012;
    hp.head.add(hood);
    // Rolled rim around the face opening.
    const rim: THREE.Vector3[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const ry = Math.sin(a) > 0 ? oyTop : oyBot;
      const d = V(Math.cos(a) * ox * 0.985, oc + Math.sin(a) * ry * 0.985, 0);
      d.z = Math.sqrt(Math.max(0.0001, 1 - d.x * d.x - d.y * d.y));
      const p = d.clone().normalize();
      const k = Math.pow(Math.pow(Math.abs(p.x / HO.a), HO.p) + Math.pow(Math.abs(p.y / HO.b), HO.p) + Math.pow(Math.abs(p.z / HO.c), HO.p), -1 / HO.p);
      rim.push(p.multiplyScalar(k).add(V(0, 0.012, 0)));
    }
    hp.head.add(new THREE.Mesh(taperedTube([...rim, rim[0]], () => 0.016, { tubular: 128, radial: 10 }), cape));
    const st = rim.map((p) => p.clone().add(V(0, 0, 0.016)));
    hp.head.add(new THREE.Mesh(stitchGeometry(st, { closed: true, dash: 0.02, gap: 0.016, radius: 0.0048 }), threadMaterial('#f6e3c0')));
    // Seam over the top of the hood.
    const seam: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const a = 0.35 + (i / 14) * 2.2;
      const p = V(0, Math.sin(a), Math.cos(a));
      const k = Math.pow(Math.pow(Math.abs(p.y / HO.b), HO.p) + Math.pow(Math.abs(p.z / HO.c), HO.p), -1 / HO.p);
      seam.push(p.multiplyScalar(k + 0.003).add(V(0, 0.012, 0)));
    }
    hp.head.add(new THREE.Mesh(stitchGeometry(seam, { dash: 0.02, gap: 0.014, radius: 0.0042 }), threadMaterial('#c98f5a')));

    // The acorn-cap hat on top of the hood: textured cup, rolled rim, tiny stem.
    const cap = new THREE.Group();
    cap.position.set(0.0, HO.b * 0.82 + 0.012, -0.02);
    cap.rotation.set(-0.12, 0, 0.1);
    hp.head.add(cap);
    const acorn = acornTextures();
    const acornMat = knitMaterial(acorn, [3, 1.5], low, '#e8c49a');
    acornMat.roughness = 0.85;
    const cupG = new THREE.SphereGeometry(0.2, S(48), S(24), 0, Math.PI * 2, 0, Math.PI * 0.55);
    cupG.scale(1, 0.62, 1);
    const cup = new THREE.Mesh(cupG, acornMat);
    cup.position.y = -0.02;
    cap.add(cup);
    const lip = new THREE.Mesh(fluffTorus(0.192, 0.024, { amp: 0.25, freq: 14, seed: 4, tubular: S(64), radial: 10 }), acornMat);
    lip.position.y = -0.02 - 0.2 * 0.62 * Math.cos(Math.PI * 0.55);
    cap.add(lip);
    const stem = new THREE.Mesh(taperedTube([V(0, 0.08, 0), V(0.005, 0.13, 0), V(0.03, 0.17, 0), V(0.06, 0.185, 0)], (t) => 0.02 * (1 - t * 0.35), { tubular: 16, radial: 10 }), elfFelt(C.stem, { repeat: 1, lowPower: low }));
    cap.add(stem);
  }

  const setMouth = (o: number) => {
    const isOpen = o > 0.4;
    smile.visible = !isOpen;
    open.visible = isOpen;
    (open.userData.open as (x: number, y: number) => void)(0.85 + o * 0.15, 0.7 + o * 0.4);
  };

  return finish('noisette', sk, hp, arms, legs, springs, setMouth, { hipY, seatY: 0.07, heelLift: 0.03, eyeY: headSpec.eye.y, eyeX: headSpec.eye.x, scale: 0.5, armSwing: 0.4, armRaise: -0.12, maxRaise: 1.85 });
}

// ---------------------------------------------------------------------------

function finish(
  id: ElfId,
  sk: Skeleton,
  hp: HeadParts,
  arms: [ElfArm, ElfArm],
  legs: [ElfLeg, ElfLeg],
  springs: ElfModel['springs'],
  setMouth: (o: number) => void,
  d: Omit<ElfDims, 'headTop' | 'height' | 'headCenter' | 'headSize'>
): ElfModel {
  sk.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  // Measure once, standing still (world units).
  sk.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(sk.root);
  const headBox = new THREE.Box3();
  (hp.head.children[0] as THREE.Mesh).geometry.computeBoundingBox();
  headBox.copy((hp.head.children[0] as THREE.Mesh).geometry.boundingBox!).applyMatrix4(hp.head.matrixWorld);
  return {
    id,
    root: sk.root,
    body: sk.body,
    hips: sk.hips,
    torso: sk.torso,
    breath: sk.breath,
    neck: sk.neck,
    head: hp.head,
    eyes: hp.eyes,
    happyEyes: hp.happyEyes,
    arms,
    legs,
    springs,
    setMouth,
    dims: { ...d, headTop: headBox.max.y, height: box.max.y, headCenter: (headBox.max.y + headBox.min.y) / 2, headSize: (headBox.max.y - headBox.min.y) / 2 },
  };
}

/** Build the plush elf (meshes only; the rig animates it). */
export function buildElf(id: ElfId, opts: { lowPower?: boolean } = {}): ElfModel {
  const low = Boolean(opts.lowPower);
  if (id === 'grelotte') return buildGrelotte(low);
  if (id === 'noisette') return buildNoisette(low);
  return buildPepin(low);
}

// ---------------------------------------------------------------------------
// The rig

/**
 * An elf's rig: breathing, blinking, a gentle idle sway, the poses (blended
 * smoothly), a waving hand, a laugh bounce, soft springs on the long hat
 * and the braids. Call `update(dt)` every frame.
 */
export class ElfRig {
  pose: ElfPose = 'stand';
  /** Gesture side: +1 = the elf's left (picture right). */
  side: 1 | -1 = 1;
  /** Amplitude of motion (reduced motion ≈ 0.4). */
  energy = 1;
  /** Breathing amplitude (0 = still). */
  breathe = 1;
  /** Where the eyes look, -1..1. */
  gaze = { x: 0, y: 0 };

  private t = Math.random() * 10;
  private cur: PoseState;
  private target: PoseState;
  private blinkIn = nextBlink(Math.random());
  private blinkT = -1;
  private spring = new Map<THREE.Object3D, { x: number; v: number }>();
  private prevDrive = 0;
  private prevPitch = 0;

  constructor(private m: ElfModel) {
    this.target = poseTarget('stand', this.side);
    this.cur = clonePose(this.target);
    this.apply(0, 0);
  }

  setPose(p: ElfPose, side?: 1 | -1) {
    if (side) this.side = side;
    this.pose = p;
    this.target = poseTarget(p, this.side);
  }

  /** Jump straight to the current pose (no blend): reference renders. */
  snap() {
    this.cur = clonePose(this.target);
    this.apply(0, 0);
  }

  /** Blink now. */
  blink() {
    this.blinkT = 0;
  }

  /** A small jump (a tap on the elf). */
  hop() {
    this.hopT = 0;
  }
  private hopT = -1;

  update(dt: number) {
    const step = Math.max(0, Math.min(0.1, dt));
    this.t += step;
    blendPose(this.cur, this.target, damp(6, step));
    this.apply(step, this.t);
  }

  private apply(dt: number, t: number) {
    const m = this.m;
    const c = this.cur;
    const E = this.energy;
    const d = m.dims;
    const live = dt > 0 ? 1 : 0;

    const breath = Math.sin(t * 1.9) * this.breathe * E * live;
    const bounceCycle = (t * 2.4) % 1;
    const bounce = c.bounce * Math.pow(Math.abs(Math.sin(bounceCycle * Math.PI)), 0.8) * (0.4 + 0.6 * E) * live;
    const wave = Math.sin(t * 8.5) * c.wave * (0.5 + 0.5 * E) * live;

    // A tap hop: up and down in 0.55 s (a little squash on landing is left to the soft springs).
    let hopY = 0;
    if (this.hopT >= 0) {
      this.hopT += dt;
      const k = this.hopT / 0.55;
      if (k >= 1) this.hopT = -1;
      else hopY = Math.sin(k * Math.PI) * 0.06 * (0.5 + 0.5 * E);
    }
    // Giggle shakes the shoulders, dance sways the hips, tickle wiggles the fingers.
    const shake = Math.sin(t * 27) * 0.035 * c.shake * E * live;
    const swayRoll = Math.sin(t * 3.4) * 0.13 * c.sway * E * live;
    const wiggle = Math.sin(t * 21) * 0.28 * c.wiggle * E * live;

    m.hips.position.y = hipHeight(d.hipY, d.seatY, c.sit, c.tiptoe, d.heelLift) + bounce * 0.02 + hopY;
    m.torso.rotation.set(c.lean + bounce * 0.03, c.turn + Math.sin(t * 0.41) * 0.04 * E * live, c.roll + Math.sin(t * 0.57) * 0.02 * E * live + shake + swayRoll);
    m.breath.scale.set(1 + breath * 0.008, 1 + breath * 0.012, 1 + breath * 0.008);

    // Head: pose + idle drift + gaze.
    const driftY = (Math.sin(t * 0.33) * 0.07 + Math.sin(t * 0.81) * 0.025) * E * live;
    m.neck.rotation.set(c.headPitch - this.gaze.y * 0.12 + bounce * 0.05 + Math.sin(t * 0.47 + 1) * 0.02 * E * live, c.headYaw + driftY + this.gaze.x * 0.25, c.headTilt + Math.sin(t * 0.6) * 0.03 * E * live);

    // Arms.
    for (let i = 0; i < 2; i++) {
      const a = c.arms[i];
      const sx = i === 0 ? -1 : 1;
      const act = (this.side > 0 ? 1 : 0) === i;
      const sway = Math.sin(t * 1.1 + i * 2) * 0.04 * E * live;
      m.arms[i].shoulder.rotation.set(-(a.swing + (d.armSwing ?? 0) + sway + wiggle * (i === 0 ? 1 : -1)), 0, sx * Math.max(0.05, Math.min(d.maxRaise ?? 3, a.raise + (d.armRaise ?? 0)) + breath * 0.02 + bounce * 0.15));
      m.arms[i].elbow.rotation.set(-a.bend, 0, act ? -sx * wave * 0.45 : 0);
    }
    // Legs and tiptoe.
    for (let i = 0; i < 2; i++) {
      const l = c.legs[i];
      const sx = i === 0 ? -1 : 1;
      m.legs[i].hip.rotation.set(-l.swing, 0, sx * l.spread);
      m.legs[i].ankle.rotation.x = c.tiptoe * 0.55 * (1 - c.sit) + c.sit * -0.25;
    }

    m.setMouth(c.mouth + bounce * 0.2);

    // Blink and happy eyes.
    if (live) {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0 && this.blinkT < 0) this.blinkT = 0;
    }
    let open = 1;
    if (this.blinkT >= 0) {
      open = blinkOpen(this.blinkT);
      this.blinkT += dt;
      if (this.blinkT >= 0.16) {
        this.blinkT = -1;
        this.blinkIn = nextBlink(Math.random());
      }
    }
    const happy = c.happy > 0.5;
    for (let i = 0; i < 2; i++) {
      m.eyes[i].visible = !happy;
      m.happyEyes[i].visible = happy;
      // A wink closes the eye on the gesture side.
      const winkEye = (this.side > 0 ? 1 : 0) === i ? c.wink : 0;
      m.eyes[i].scale.y = Math.max(0.08, Math.min(open, 1 - winkEye * 0.92));
      m.eyes[i].position.x = (i === 0 ? -d.eyeX : d.eyeX) + this.gaze.x * 0.006;
    }

    // Springs: the long hat and the braids lag behind the head.
    if (live) {
      const drive = m.neck.rotation.z + m.torso.rotation.z;
      const pitch = m.neck.rotation.x + m.torso.rotation.x;
      const vz = (drive - this.prevDrive) / dt;
      const vx = (pitch - this.prevPitch) / dt;
      this.prevDrive = drive;
      this.prevPitch = pitch;
      for (const s of m.springs) {
        let st = this.spring.get(s.obj);
        if (!st) this.spring.set(s.obj, (st = { x: 0, v: 0 }));
        const v = s.axis === 'z' ? vz : vx;
        const acc = 55 * (-v * 0.07 * s.gain - st.x) - 5 * st.v + (s.axis === 'z' ? bounce * 0.6 * s.gain : 0);
        st.v += acc * dt;
        st.x += st.v * dt;
        st.x = Math.max(-0.35, Math.min(0.35, st.x));
        if (s.axis === 'z') s.obj.rotation.z = s.rest + st.x;
        else s.obj.rotation.x = s.rest + st.x;
      }
    }
  }
}

/** An elf for any scene: the model and its rig on `userData`. */
export type ElfActor = THREE.Group & { userData: { model: ElfModel; rig: ElfRig; id: ElfId } };

/** A ready-to-animate plush elf (call `userData.rig.update(dt)` every frame). */
export function makeElf(id: ElfId, opts: ElfOptions = {}): ElfActor {
  const model = buildElf(id, opts);
  const actor = model.root as ElfActor;
  actor.userData.model = model;
  actor.userData.id = id;
  actor.userData.rig = new ElfRig(model);
  if (opts.pose) {
    actor.userData.rig.setPose(opts.pose);
    actor.userData.rig.snap();
  }
  return actor;
}
