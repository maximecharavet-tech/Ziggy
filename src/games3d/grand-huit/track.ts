import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { glow, glowMat, glowTex } from '../kit/look';
import { applyOp, opLabel, type Band, type Op } from './logic';
import { FAIR_COLORS, makeBalloon } from './fair';
import { badgeTexture, bubbleTexture, flat, mergeStatic, pillTexture, shiny, soft, spriteOf, stripes, type BadgeStyle } from './util';

/**
 * The coaster: the number line (a straight rail on striped pillars, one
 * station per number), the rail pieces the child adds (a hill for "+", a
 * dip for "−", a big purple hill for "×"), the cart, the target gate with
 * its balloons, the splash pool with its rubber duck, and the loop that
 * appears when the cart stops right at the station.
 */

/** Height of the number line rail. */
export const Y0 = 1.6;
export const OP_COLORS: Record<Op['kind'], string> = { add: '#1fbf9a', sub: '#ff8a3d', mul: '#9b5cff' };
const RAIL = '#f4f6ff';
const LANES = [0, 0.62, -0.62, 1.24, -1.24];

export interface Layout {
  max: number;
  /** World units between two stations. */
  sp: number;
  x(v: number): number;
  /** Is this station's number written on the line? */
  labelled(v: number): boolean;
}

export function layoutFor(max: number): Layout {
  const sp = max <= 10 ? 1.6 : Math.max(0.72, Math.min(1.6, 30 / max));
  const every = sp >= 0.95 ? 1 : 5;
  return { max, sp, x: (v) => (v - max / 2) * sp, labelled: (v) => v % every === 0 };
}

/* ───────────────────────── Sampled paths ───────────────────────── */

/** A path the cart can ride: sampled points, arc lengths, and which way the cart faces. */
export class RidePath {
  readonly cum: number[] = [0];
  readonly len: number;
  constructor(
    readonly pts: THREE.Vector3[],
    /** +1: the cart's nose points along the path; -1: it rolls backwards (a "−" piece). */
    readonly face: 1 | -1 = 1,
    /** Optional "up" for each point (inside a loop the cart's up points to the centre). */
    readonly ups: THREE.Vector3[] | null = null
  ) {
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.len = this.cum[this.cum.length - 1];
  }
  private index(s: number): [number, number] {
    const c = this.cum;
    s = Math.max(0, Math.min(this.len, s));
    let lo = 0;
    let hi = c.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (c[m] <= s) lo = m;
      else hi = m;
    }
    const span = c[hi] - c[lo] || 1;
    return [lo, (s - c[lo]) / span];
  }
  at(s: number, out = new THREE.Vector3()): THREE.Vector3 {
    const [i, f] = this.index(s);
    return out.lerpVectors(this.pts[i], this.pts[Math.min(i + 1, this.pts.length - 1)], f);
  }
  tangent(s: number, out = new THREE.Vector3()): THREE.Vector3 {
    const a = this.at(Math.max(0, s - 0.05));
    const b = this.at(Math.min(this.len, s + 0.05));
    return out.subVectors(b, a).normalize();
  }
  up(s: number, out = new THREE.Vector3()): THREE.Vector3 {
    if (!this.ups) return out.set(0, 1, 0);
    const [i, f] = this.index(s);
    return out.lerpVectors(this.ups[i], this.ups[Math.min(i + 1, this.ups.length - 1)], f).normalize();
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Rails, spine, sleepers and posts along a path (one merged mesh). */
function railMesh(pts: THREE.Vector3[], color: string, opts: { ups?: THREE.Vector3[] | null; posts?: 'up' | 'down' | 'none'; rail?: string } = {}): THREE.Group {
  const g = new THREE.Group();
  const n = pts.length;
  const side: THREE.Vector3[] = [];
  const down: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const t = new THREE.Vector3().subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    const up = opts.ups ? opts.ups[i].clone() : new THREE.Vector3(0, 1, 0);
    const s = new THREE.Vector3().crossVectors(t, up).normalize();
    if (s.lengthSq() < 0.5) s.set(0, 0, 1);
    const u = new THREE.Vector3().crossVectors(s, t).normalize();
    side.push(s);
    down.push(u.negate());
  }
  const along = (off: (i: number) => THREE.Vector3) => new THREE.CatmullRomCurve3(pts.map((p, i) => p.clone().add(off(i))));
  const segs = Math.max(8, Math.min(220, n * 2));
  for (const k of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.TubeGeometry(along((i) => side[i].clone().multiplyScalar(0.2 * k)), segs, 0.045, 6, false), soft(opts.rail ?? RAIL));
    rail.castShadow = true;
    g.add(rail);
  }
  const spine = new THREE.Mesh(new THREE.TubeGeometry(along((i) => down[i].clone().multiplyScalar(0.17)), segs, 0.085, 7, false), soft(color));
  spine.castShadow = true;
  g.add(spine);
  // Sleepers every ~0.3 units.
  const path = new RidePath(pts);
  const tieGeo = new THREE.BoxGeometry(0.07, 0.05, 0.52);
  const tieMat = soft(new THREE.Color(color).multiplyScalar(0.7));
  for (let s = 0.12; s < path.len; s += 0.3) {
    const p = path.at(s);
    const t = path.tangent(s);
    const i = Math.min(n - 1, Math.round((s / path.len) * (n - 1)));
    const tie = new THREE.Mesh(tieGeo.clone(), tieMat.clone());
    const m = new THREE.Matrix4().makeBasis(t, down[i].clone().negate(), side[i]);
    tie.quaternion.setFromRotationMatrix(m);
    tie.position.copy(p).addScaledVector(down[i], 0.06);
    g.add(tie);
    if (opts.posts && opts.posts !== 'none' && Math.abs(s % 0.9) < 0.3) {
      const top = p.y - 0.2;
      const bottom = opts.posts === 'up' ? Y0 + 0.05 : 0;
      if (top - bottom > 0.3) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, top - bottom, 5), soft('#ffffff'));
        post.position.set(p.x, (top + bottom) / 2, p.z);
        g.add(post);
      }
    }
  }
  tieGeo.dispose();
  tieMat.dispose();
  mergeStatic(g, { smooth: true });
  return g;
}

/* ───────────────────────── The number line ───────────────────────── */

export class NumberLine {
  readonly group = new THREE.Group();
  private labels = new Map<number, THREE.Sprite>();
  private labelSize: number;
  constructor(
    readonly layout: Layout,
    private band: Band
  ) {
    const L = layout;
    const x0 = L.x(0) - 1.2;
    const x1 = L.x(L.max) + 1.2;
    const statics = new THREE.Group();
    const len = x1 - x0;
    for (const z of [-0.2, 0.2]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 6), soft(RAIL));
      rail.rotation.z = Math.PI / 2;
      rail.position.set((x0 + x1) / 2, Y0, z);
      statics.add(rail);
    }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 0.16), soft('#ff5d73'));
    spine.position.set((x0 + x1) / 2, Y0 - 0.17, 0);
    spine.castShadow = true;
    statics.add(spine);
    for (let x = x0 + 0.1; x < x1; x += 0.3) {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.52), soft('#7a4fa8'));
      tie.position.set(x, Y0 - 0.05, 0);
      statics.add(tie);
    }
    // Striped A-frame pillars every two stations (or so).
    const step = Math.max(1, Math.round(1.7 / L.sp));
    for (let v = 0; v <= L.max; v += step) {
      const x = L.x(v);
      for (const z of [-0.45, 0.45]) {
        for (let k = 0; k < 3; k++) {
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, (Y0 - 0.25) / 3, 6), soft(k % 2 ? '#ffffff' : '#ff5d73'));
          seg.position.set(x, ((Y0 - 0.25) / 3) * (k + 0.5), z * (1 - (k + 0.5) / 6));
          seg.rotation.x = z > 0 ? 0.12 : -0.12;
          seg.castShadow = true;
          statics.add(seg);
        }
      }
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.08, 10), soft('#c9b8e8'));
      foot.position.set(x, 0.04, 0);
      foot.scale.z = 2.6;
      statics.add(foot);
    }
    // A yellow stud for every station, so each number is a place on the rail.
    for (let v = 0; v <= L.max; v++) {
      const stud = new THREE.Mesh(new THREE.CylinderGeometry(L.labelled(v) ? 0.11 : 0.07, L.labelled(v) ? 0.11 : 0.07, 0.05, 10), soft(v % 5 === 0 ? '#ffcc33' : '#ffe79a'));
      stud.rotation.x = Math.PI / 2;
      stud.position.set(L.x(v), Y0 - 0.17, 0.09);
      statics.add(stud);
    }
    mergeStatic(statics, { smooth: true, receive: true });
    this.group.add(statics);
    this.labelSize = band === 'little' ? 1.05 : L.sp >= 1.4 ? 0.82 : L.sp >= 0.95 ? 0.7 : 0.62;
    for (let v = 0; v <= L.max; v++) if (L.labelled(v)) this.label(v, 'station');
  }

  /** Where a station's number sits (in front of the rail, below it). */
  labelPos(v: number): THREE.Vector3 {
    return new THREE.Vector3(this.layout.x(v), Y0 - 0.82, 0.78);
  }

  /** Show (or restyle) the number of a station. */
  label(v: number, style: BadgeStyle) {
    const old = this.labels.get(v);
    if (old) {
      if (old.userData.style === style) return old;
      this.group.remove(old);
      old.material.map?.dispose();
      old.material.dispose();
    }
    const dotsN = this.band === 'little' && v > 0 ? v : 0;
    const big = style === 'target' || style === 'start' ? 1.18 : style === 'small' ? 0.85 : 1;
    const s = spriteOf(badgeTexture(String(v), style, dotsN), this.labelSize * big * (dotsN ? 1.2 : 1));
    s.position.copy(this.labelPos(v));
    if (dotsN) s.position.y -= 0.12;
    s.userData.style = style;
    s.renderOrder = 2;
    this.labels.set(v, s);
    this.group.add(s);
    return s;
  }

  /** Back to plain numbers (between rides keeps start/target styling). */
  plain(v: number) {
    if (this.layout.labelled(v)) this.label(v, 'station');
    else {
      const old = this.labels.get(v);
      if (!old) return;
      this.group.remove(old);
      old.material.map?.dispose();
      old.material.dispose();
      this.labels.delete(v);
    }
  }

  labelOf(v: number) {
    return this.labels.get(v);
  }
}

/* ───────────────────────── Rail pieces ───────────────────────── */

export interface Piece {
  op: Op;
  from: number;
  to: number;
  lane: number;
  group: THREE.Group;
  path: RidePath;
  apex: THREE.Vector3;
  label: THREE.Sprite;
  grow: number;
}

/** Height of a hill (or depth of a dip) for a piece spanning `span` units. */
function bumpOf(op: Op, span: number, up: boolean): number {
  if (!up) return Math.min(Y0 - 0.5, 0.45 + span * 0.16);
  if (op.kind === 'mul') return Math.min(4.6, 1.5 + span * 0.2);
  return Math.min(3.4, 0.6 + span * 0.33);
}

/** Pick a lane (z) where this piece doesn't overlap an earlier one on the same side. */
function laneFor(prev: Piece[], a: number, b: number, up: boolean): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (let k = 0; k < LANES.length; k++) {
    const clash = prev.some((p) => p.lane === k && p.to > p.from === up && Math.min(p.from, p.to) < hi && Math.max(p.from, p.to) > lo);
    if (!clash) return k;
  }
  return prev.length % LANES.length;
}

export function buildPieces(layout: Layout, start: number, ops: readonly Op[], band: Band, preset: number): Piece[] {
  const out: Piece[] = [];
  let v = start;
  let z = 0;
  ops.forEach((op, i) => {
    const w = applyOp(v, op);
    const up = w > v;
    const lane = laneFor(out, v, w, up);
    const z1 = LANES[lane];
    const xa = layout.x(v);
    const xb = layout.x(w);
    const span = Math.abs(xb - xa);
    const h = bumpOf(op, span, up);
    const n = Math.max(16, Math.min(90, Math.round(span * 7)));
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const bump = Math.sin(Math.PI * t);
      pts.push(new THREE.Vector3(xa + (xb - xa) * t, Y0 + (up ? h : -h) * bump, z + (z1 - z) * smooth(t)));
    }
    const color = OP_COLORS[op.kind];
    const mesh = railMesh(pts, color, { posts: up ? 'up' : 'down' });
    const apex = new THREE.Vector3((xa + xb) / 2, Y0 + (up ? h : -h), (z + z1) / 2);
    const dotsN = band === 'little' && op.kind === 'add' ? op.n : 0;
    const label = spriteOf(pillTexture(opLabel(op), color, dotsN), band === 'little' ? 0.95 : layout.sp < 1 ? 0.62 : 0.75);
    label.position.copy(apex).add(new THREE.Vector3(0, up ? 0.62 : -0.5, up ? 0 : 0.35));
    label.renderOrder = 3;
    // Grows out of the line: scale from the rail height.
    const holder = new THREE.Group();
    holder.position.set((xa + xb) / 2, Y0, 0);
    mesh.position.set(-(xa + xb) / 2, -Y0, 0);
    holder.add(mesh);
    const group = new THREE.Group();
    group.add(holder, label);
    group.userData.holder = holder;
    group.userData.preset = i < preset;
    out.push({ op, from: v, to: w, lane, group, path: new RidePath(pts, xb >= xa ? 1 : -1), apex, label, grow: 1 });
    v = w;
    z = z1;
  });
  return out;
}

/* ───────────────────────── Cart ───────────────────────── */

export interface Cart {
  group: THREE.Group;
  /** Rocks and bounces on its own (springs, boing). */
  body: THREE.Group;
  seat: THREE.Group;
  light: THREE.Sprite;
}

export function makeCart(): Cart {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const red = shiny('#ff4f5e', 80);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.52, 0.84, 3, 0.16), red);
  shell.position.y = 0.42;
  shell.castShadow = true;
  const inside = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.3, 0.66, 2, 0.08), soft('#5a2a6b'));
  inside.position.set(-0.08, 0.6, 0);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.09, 0.86), shiny('#ffcc33', 60));
  stripe.position.y = 0.44;
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.86, 16), shiny('#ffcc33', 60));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0.6, 0.3, 0);
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.5, 0.84, 2, 0.06), red);
  back.position.set(-0.56, 0.78, 0);
  back.castShadow = true;
  // Lap bar in front of Ziggy.
  const bar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 16, Math.PI), shiny('#ffcc33', 60));
  bar.rotation.set(0, Math.PI / 2, 0);
  bar.position.set(0.3, 0.68, 0);
  body.add(shell, inside, stripe, nose, back, bar);
  for (const x of [-0.38, 0.38])
    for (const z of [-0.3, 0.3]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), soft('#3a3550'));
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.12, z * 1.25);
      body.add(w);
    }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), glowMat('#fff3b0', 1.8));
  lamp.position.set(0.76, 0.32, 0);
  const light = glow('#fff1a8', 0.9, 0.7);
  light.position.copy(lamp.position);
  body.add(lamp, light);
  // Little stars painted on the sides.
  for (const z of [-0.43, 0.43]) {
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.11, 5), soft('#ffffff'));
    star.position.set(0.05, 0.3, z);
    star.rotation.y = z > 0 ? 0 : Math.PI;
    body.add(star);
  }
  const seat = new THREE.Group();
  seat.position.set(-0.12, 0.28, 0);
  body.add(seat);
  return { group, body, seat, light };
}

/* ───────────────────────── Pool, duck, loop, gate ───────────────────────── */

export interface Pool {
  group: THREE.Group;
  water: THREE.Mesh<THREE.RingGeometry, THREE.MeshPhongMaterial>;
  duck: THREE.Group;
  center: THREE.Vector3;
  radius: number;
}

export function makeDuck(): THREE.Group {
  const g = new THREE.Group();
  const yellow = shiny('#ffd23d', 90);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), yellow);
  body.scale.set(1.25, 0.8, 1);
  body.position.y = 0.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), yellow);
  head.position.set(0.22, 0.36, 0);
  const beak = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 6), shiny('#ff8a3d', 60));
  beak.scale.set(1.4, 0.45, 1);
  beak.position.set(0.41, 0.33, 0);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 8), yellow);
  tail.position.set(-0.36, 0.2, 0);
  tail.rotation.z = 0.9;
  g.add(body, head, beak, tail);
  for (const z of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), soft('#1d2a6b'));
    eye.position.set(0.33, 0.43, z);
    g.add(eye);
  }
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  return g;
}

export function makePool(): Pool {
  const group = new THREE.Group();
  const radius = 1.5;
  const tex = stripes(['#ff5d73', '#ffffff'], 16);
  tex.repeat.set(2, 1);
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.12, radius + 0.2, 0.7, 32, 1, true), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  tub.position.y = 0.35;
  tub.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.13, 0.11, 8, 36), shiny('#3fc1c9', 60));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.7;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius + 0.1, 28), soft('#2a8fd6'));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.06;
  const water = new THREE.Mesh(
    new THREE.RingGeometry(0.001, radius + 0.08, 40, 9),
    new THREE.MeshPhongMaterial({ color: '#56c8f5', emissive: new THREE.Color('#1a6fb0').multiplyScalar(0.35), shininess: 110, specular: new THREE.Color('#ffffff'), transparent: true, opacity: 0.9 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.48;
  water.userData.base = Float32Array.from((water.geometry.attributes.position as THREE.BufferAttribute).array);
  const duck = makeDuck();
  duck.position.set(0.55, 0.48, 0.45);
  duck.rotation.y = 2.3;
  group.add(tub, rim, floor, water, duck);
  // Little buoys around.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), shiny(FAIR_COLORS[i % FAIR_COLORS.length], 60));
    b.position.set(Math.cos(a) * (radius + 0.13), 0.82, Math.sin(a) * (radius + 0.13));
    group.add(b);
  }
  return { group, water, duck, center: new THREE.Vector3(), radius };
}

/** Splash geometry relative to the target station: loop (appears on success) and slide to the pool. */
export interface Finale {
  loop: THREE.Group | null;
  slide: THREE.Group | null;
  /** Station → loop → slide → water, in world space. */
  path: RidePath;
  /** Arc length where the cart is at the top of the loop, and where it reaches the water. */
  topAt: number;
  waterAt: number;
  poolCenter: THREE.Vector3;
}

const LOOP_R = 1.15;

export function buildFinale(xt: number, zFrom: number, parts: { loop: boolean; slide: boolean }): Finale {
  const pts: THREE.Vector3[] = [];
  const ups: THREE.Vector3[] = [];
  const upY = new THREE.Vector3(0, 1, 0);
  // 1. From the station into the loop.
  const entry = new THREE.Vector3(xt + 1.0, Y0, -0.35);
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    pts.push(new THREE.Vector3(xt + t * 1.0, Y0, zFrom + (entry.z - zFrom) * smooth(t)));
    ups.push(upY.clone());
  }
  const loopStart = pts.length;
  // 2. The loop, drifting backwards so the exit passes beside the entry.
  const c = new THREE.Vector3(xt + 1.0, Y0 + LOOP_R, 0);
  const N = 44;
  for (let k = 1; k <= N; k++) {
    const th = (k / N) * Math.PI * 2;
    const z = -0.35 - 0.9 * (k / N);
    const p = new THREE.Vector3(c.x + LOOP_R * Math.sin(th), c.y - LOOP_R * Math.cos(th), z);
    pts.push(p);
    ups.push(new THREE.Vector3(c.x - p.x, c.y - p.y, 0).normalize());
  }
  const loopEnd = pts.length;
  // 3. The slide down to the pool behind the line.
  const poolCenter = new THREE.Vector3(xt + 0.6, 0, -4.7);
  const slideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(xt + 1.0, Y0, -1.25),
    new THREE.Vector3(xt + 1.8, Y0 - 0.1, -1.55),
    new THREE.Vector3(xt + 2.25, Y0 - 0.45, -2.5),
    new THREE.Vector3(xt + 1.95, 1.05, -3.55),
    new THREE.Vector3(xt + 1.25, 0.72, -4.25),
    new THREE.Vector3(poolCenter.x + 0.05, 0.5, poolCenter.z + 0.05),
  ]);
  const slidePts = slideCurve.getSpacedPoints(30);
  for (let k = 1; k < slidePts.length; k++) {
    pts.push(slidePts[k]);
    ups.push(upY.clone());
  }
  const path = new RidePath(pts, 1, ups);
  const topAt = path.cum[loopStart + Math.round(N / 2)];
  const waterAt = path.len;

  const slide = parts.slide ? railMesh(slidePts, '#3fc1c9', { posts: 'down' }) : null;
  if (!parts.loop) return { loop: null, slide, path, topAt, waterAt, poolCenter };
  const loop = railMesh(pts.slice(0, loopEnd + 1), '#ffcc33', { ups: ups.slice(0, loopEnd + 1), rail: '#ffffff' });
  const struts = new THREE.Group();
  for (const dx of [-0.75, 0.75]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, Y0 - 0.2, 6), soft('#ffffff'));
    post.position.set(c.x + dx, (Y0 - 0.2) / 2, -0.8);
    struts.add(post);
  }
  mergeStatic(struts);
  const loopGroup = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.set(c.x, Y0, -0.8);
  loop.position.set(-c.x, -Y0, 0.8);
  struts.position.set(-c.x, -Y0, 0.8);
  holder.add(loop, struts);
  loopGroup.add(holder);
  loopGroup.userData.holder = holder;
  return { loop: loopGroup, slide, path, topAt, waterAt, poolCenter };
}

/** The target gate: striped posts, a banner with the number, bulbs and balloons. */
export function makeGate(label: { tex: THREE.Texture; aspect: number }, h = 3.6): { group: THREE.Group; balloons: THREE.Group[]; banner: THREE.Sprite } {
  const g = new THREE.Group();
  const statics = new THREE.Group();
  for (const z of [-1.6, 1.6]) {
    for (let k = 0; k < 6; k++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, h / 6, 8), soft(k % 2 ? '#ffffff' : '#ff7a1a'));
      seg.position.set(0, (h / 6) * (k + 0.5), z);
      statics.add(seg);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), soft('#ffcc33'));
    knob.position.set(0, h + 0.1, z);
    statics.add(knob);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 3.2), soft('#ffcc33'));
  beam.position.set(0, h, 0);
  statics.add(beam);
  mergeStatic(statics, { smooth: true });
  statics.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  g.add(statics);
  const banner = spriteOf(label, 1.5);
  banner.position.set(0, h + 0.85, 0);
  banner.renderOrder = 4;
  const halo = glow('#ffe066', 3.2, 0.45);
  halo.position.copy(banner.position);
  g.add(halo, banner);
  // Checkered flag on the front post.
  const flagTex = stripes(['#1d2a6b', '#ffffff'], 6);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshLambertMaterial({ map: flagTex, side: THREE.DoubleSide }));
  flag.position.set(0.42, h - 0.35, 1.6);
  flag.name = 'flag';
  g.add(flag);
  const balloons: THREE.Group[] = [];
  for (const z of [-1.6, 1.6])
    for (let k = 0; k < 3; k++) {
      const b = makeBalloon(FAIR_COLORS[(k * 2 + (z > 0 ? 1 : 0)) % FAIR_COLORS.length], 0.9 + k * 0.25);
      b.position.set(0, h + 0.05, z);
      b.rotation.set((k - 1) * 0.28, 0, (k - 1) * 0.22 * (z > 0 ? 1 : -1));
      b.userData.phase = k * 1.3 + z;
      balloons.push(b);
      g.add(b);
    }
  return { group: g, balloons, banner };
}

/** Pulsing dots from where the cart stopped to the target, with "+2" on top: Ziggy shows the gap. */
export function makeGapMarker(layout: Layout, from: number, to: number, text: string): THREE.Group {
  const g = new THREE.Group();
  const xa = layout.x(from);
  const xb = layout.x(to);
  const span = Math.abs(xb - xa);
  const h = 0.7 + Math.min(1.6, span * 0.25);
  const pos: number[] = [];
  const n = Math.max(6, Math.round(span * 3.2));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pos.push(xa + (xb - xa) * t, Y0 + 0.25 + h * Math.sin(Math.PI * t), 0.15);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const dotsMesh = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.34, map: glowTex(), color: new THREE.Color('#ff5ca8').multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const bubble = spriteOf(bubbleTexture(text), 0.95);
  bubble.position.set((xa + xb) / 2, Y0 + 0.25 + h + 0.7, 0.2);
  bubble.renderOrder = 5;
  g.add(dotsMesh, bubble);
  g.userData.bubble = bubble;
  g.userData.dots = dotsMesh;
  return g;
}
