import * as THREE from 'three';

/**
 * The rainbow circuit: a closed loop floating above the clouds, with gentle
 * hills and banked curves. The road has three lanes, each painted with two
 * bands of the rainbow (left = red/orange, middle = yellow/green, right =
 * blue/purple), white dashes between them and candy-striped rails.
 *
 * `frame(s)` gives the position and orientation at any distance along the
 * loop (it wraps), so the kart, the gates and the camera all ride the road.
 */

export interface Frame {
  p: THREE.Vector3;
  /** Forward. */
  t: THREE.Vector3;
  /** Screen right when looking forward. */
  side: THREE.Vector3;
  up: THREE.Vector3;
}

export const newFrame = (): Frame => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), side: new THREE.Vector3(), up: new THREE.Vector3() });

/** Lane colours (two rainbow bands per lane) — the HUD buttons use them too. */
export const BANDS = ['#ff8a8a', '#ffb36b', '#ffe170', '#93e6a0', '#7cc4ff', '#b79cff'];
export const LANE_TINT = ['#ff9f7a', '#c6e56e', '#9aa9ff'];

const STEP = 0.5;

export class Track {
  readonly length: number;
  readonly halfWidth: number;
  private n: number;
  private P: Float32Array;
  private T: Float32Array;
  private S: Float32Array;
  private U: Float32Array;

  constructor(readonly laneGap: number) {
    this.halfWidth = laneGap * 1.5 + 0.95;
    // A wobbly loop: gentle S-bends, rolling hills.
    const pts: THREE.Vector3[] = [];
    const K = 18;
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2;
      const r = 1 + 0.16 * Math.sin(2 * a + 0.6) + 0.07 * Math.sin(3 * a + 2);
      pts.push(new THREE.Vector3(Math.cos(a) * 128 * r, 4.5 * Math.sin(2 * a) + 2.2 * Math.sin(3 * a + 1), Math.sin(a) * 92 * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.length = curve.getLength();
    this.n = Math.ceil(this.length / STEP);
    const n = this.n;
    this.P = new Float32Array(n * 3);
    this.T = new Float32Array(n * 3);
    this.S = new Float32Array(n * 3);
    this.U = new Float32Array(n * 3);
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const side = new THREE.Vector3();
    const up = new THREE.Vector3();
    const Y = new THREE.Vector3(0, 1, 0);
    const tans: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      curve.getPointAt(i / n, p);
      curve.getTangentAt(i / n, t).normalize();
      p.toArray(this.P, i * 3);
      t.toArray(this.T, i * 3);
      tans.push(t.clone());
    }
    // Signed curvature toward the right, smoothed → bank angle (the inside of a bend is lower).
    const curv = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = tans[(i - 4 + n) % n];
      const b = tans[(i + 4) % n];
      const s0 = new THREE.Vector3().crossVectors(tans[i], Y).normalize();
      curv[i] = b.clone().sub(a).dot(s0) / (8 * STEP);
    }
    const bank = new Float32Array(n);
    const W = 30;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = -W; k <= W; k++) sum += curv[(i + k + n) % n];
      bank[i] = Math.max(-0.22, Math.min(0.22, (sum / (2 * W + 1)) * 11));
    }
    for (let i = 0; i < n; i++) {
      t.fromArray(this.T, i * 3);
      side.crossVectors(t, Y).normalize();
      up.crossVectors(side, t).normalize();
      const b = bank[i];
      const s2 = side.clone().multiplyScalar(Math.cos(b)).addScaledVector(up, -Math.sin(b));
      const u2 = up.clone().multiplyScalar(Math.cos(b)).addScaledVector(side, Math.sin(b));
      s2.toArray(this.S, i * 3);
      u2.toArray(this.U, i * 3);
    }
  }

  /** Position and axes at distance `s` (any value: the loop wraps). */
  frame(s: number, out: Frame): Frame {
    const L = this.length;
    const w = ((s % L) + L) % L;
    const f = w / STEP;
    const i0 = Math.floor(f) % this.n;
    const i1 = (i0 + 1) % this.n;
    const k = f - Math.floor(f);
    const lerp = (arr: Float32Array, v: THREE.Vector3) => v.set(arr[i0 * 3] + (arr[i1 * 3] - arr[i0 * 3]) * k, arr[i0 * 3 + 1] + (arr[i1 * 3 + 1] - arr[i0 * 3 + 1]) * k, arr[i0 * 3 + 2] + (arr[i1 * 3 + 2] - arr[i0 * 3 + 2]) * k);
    lerp(this.P, out.p);
    lerp(this.T, out.t).normalize();
    lerp(this.S, out.side).normalize();
    lerp(this.U, out.up).normalize();
    return out;
  }

  /** A point on the road: `x` across (right +), `y` above it. */
  at(s: number, x: number, y: number, f: Frame = newFrame()): THREE.Vector3 {
    this.frame(s, f);
    return f.p.clone().addScaledVector(f.side, x).addScaledVector(f.up, y);
  }

  /** Orient an object on the road at `s` (its +z forward, +y up). */
  place(o: THREE.Object3D, s: number, x = 0, y = 0, f: Frame = newFrame()) {
    this.frame(s, f);
    o.position.copy(f.p).addScaledVector(f.side, x).addScaledVector(f.up, y);
    const m = new THREE.Matrix4().makeBasis(f.side.clone().negate(), f.up, f.t);
    o.quaternion.setFromRotationMatrix(m);
  }

  /** The road, its dashes and rails, and lollipops along the way. */
  build(lowPower: boolean): THREE.Group {
    const g = new THREE.Group();
    g.add(this.buildRoad(), this.buildDashes(), this.buildRails(lowPower), this.buildLollipops(lowPower));
    return g;
  }

  private buildRoad(): THREE.Mesh {
    const hw = this.halfWidth;
    const gap = this.laneGap;
    const x0 = -gap * 1.5;
    // Cross-section columns: margin, six rainbow bands, margin.
    const cols: { a: number; b: number; c: THREE.Color }[] = [{ a: -hw, b: x0, c: new THREE.Color('#fff2fa') }];
    BANDS.forEach((hex, i) => cols.push({ a: x0 + (i * gap) / 2, b: x0 + ((i + 1) * gap) / 2, c: new THREE.Color(hex) }));
    cols.push({ a: x0 + 3 * gap, b: hw, c: new THREE.Color('#fff2fa') });
    const wall = new THREE.Color('#f1d7ff');
    const under = new THREE.Color('#e4cff7');
    const pos: number[] = [];
    const col: number[] = [];
    const f0 = newFrame();
    const f1 = newFrame();
    const seg = 1.0;
    const rows = Math.ceil(this.length / seg);
    const v = (f: Frame, x: number, y: number) => f.p.clone().addScaledVector(f.side, x).addScaledVector(f.up, y);
    const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, ca: THREE.Color, cb: THREE.Color = ca) => {
      // a-b on row 0, c-d on row 1 (a, c on the same side).
      pos.push(...a.toArray(), ...c.toArray(), ...b.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray());
      col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, ca.r, ca.g, ca.b, ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cb.r, cb.g, cb.b);
    };
    const shade = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k);
    for (let i = 0; i < rows; i++) {
      this.frame(i * seg, f0);
      this.frame((i + 1) * seg, f1);
      // Every few metres a slightly brighter stripe: the road seems to rush by.
      const shine = i % 6 < 3 ? 1 : 0.94;
      for (const c of cols) quad(v(f0, c.a, 0), v(f0, c.b, 0), v(f1, c.a, 0), v(f1, c.b, 0), shade(c.c, shine));
      // Sides and the soft underside.
      quad(v(f0, hw, 0), v(f0, hw, -0.7), v(f1, hw, 0), v(f1, hw, -0.7), wall);
      quad(v(f0, -hw, -0.7), v(f0, -hw, 0), v(f1, -hw, -0.7), v(f1, -hw, 0), wall);
      quad(v(f0, hw, -0.7), v(f0, -hw, -0.7), v(f1, hw, -0.7), v(f1, -hw, -0.7), under);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#2a1d3a'), side: THREE.DoubleSide }));
    road.receiveShadow = true;
    road.name = 'road';
    return road;
  }

  private buildDashes(): THREE.Mesh {
    const pos: number[] = [];
    const f = newFrame();
    const gap = this.laneGap;
    const xs = [-gap / 2, gap / 2];
    for (let s = 0; s < this.length - 2; s += 3.4) {
      for (const x of xs) {
        const a = this.at(s, x - 0.11, 0.025, f);
        const b = this.at(s, x + 0.11, 0.025, f);
        const c = this.at(s + 1.8, x - 0.11, 0.025, f);
        const d = this.at(s + 1.8, x + 0.11, 0.025, f);
        pos.push(...a.toArray(), ...c.toArray(), ...b.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray());
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.15), toneMapped: false, side: THREE.DoubleSide }));
    m.name = 'dashes';
    return m;
  }

  private buildRails(lowPower: boolean): THREE.Mesh {
    const radial = lowPower ? 5 : 7;
    const seg = 1.0;
    const rows = Math.ceil(this.length / seg);
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const f = newFrame();
    const pink = new THREE.Color('#ff7eb6');
    const white = new THREE.Color('#ffffff');
    let base = 0;
    for (const sx of [-1, 1]) {
      const x = sx * (this.halfWidth - 0.2);
      for (let i = 0; i <= rows; i++) {
        this.frame(i * seg, f);
        const c = this.at(i * seg, x, 0.42, f);
        const color = Math.floor(i / 2) % 2 ? pink : white;
        for (let k = 0; k <= radial; k++) {
          const a = (k / radial) * Math.PI * 2;
          const p = c.clone().addScaledVector(f.side, Math.cos(a) * 0.2).addScaledVector(f.up, Math.sin(a) * 0.2);
          pos.push(p.x, p.y, p.z);
          col.push(color.r, color.g, color.b);
        }
      }
      for (let i = 0; i < rows; i++)
        for (let k = 0; k < radial; k++) {
          const a = base + i * (radial + 1) + k;
          const b = a + radial + 1;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      base += (rows + 1) * (radial + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#3a2440') }));
    m.castShadow = false;
    m.receiveShadow = true;
    m.name = 'rails';
    return m;
  }

  /** Giant lollipops along both sides: they rush past and tell the speed. */
  private buildLollipops(lowPower: boolean): THREE.Group {
    const g = new THREE.Group();
    const every = lowPower ? 22 : 15;
    const count = Math.floor(this.length / every) * 2;
    const stick = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.08, 3.1, 6), new THREE.MeshLambertMaterial({ color: '#fffaf0' }), count);
    const candy = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 0.75, 0.22, 16), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: new THREE.Color('#402030') }), count);
    const swirl = new THREE.InstancedMesh(new THREE.TorusGeometry(0.42, 0.11, 6, 16), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: new THREE.Color('#555555') }), count);
    const palette = ['#ff6fa8', '#ffb347', '#7ed6ff', '#a98bff', '#7be495', '#ffe066'].map((c) => new THREE.Color(c));
    const f = newFrame();
    const o = new THREE.Object3D();
    let i = 0;
    for (let s = 4; s < this.length - every / 2 && i < count; s += every) {
      for (const sx of [-1, 1]) {
        if (i >= count) break;
        const x = sx * (this.halfWidth + 0.12);
        this.place(o, s + (sx > 0 ? every / 2 : 0), x, 0.9, f);
        o.updateMatrix();
        stick.setMatrixAt(i, o.matrix);
        // Candy disc on top, its face toward the coming kart, a white swirl on it.
        const top = o.clone();
        top.translateY(1.75);
        top.rotateX(Math.PI / 2);
        top.updateMatrix();
        candy.setMatrixAt(i, top.matrix);
        const sw = o.clone();
        sw.translateY(1.75);
        sw.translateZ(-0.1);
        sw.updateMatrix();
        swirl.setMatrixAt(i, sw.matrix);
        candy.setColorAt(i, palette[i % palette.length]);
        i++;
      }
    }
    stick.count = candy.count = swirl.count = i;
    for (const m of [stick, candy, swirl]) {
      m.instanceMatrix.needsUpdate = true;
      m.castShadow = false;
      m.frustumCulled = false;
    }
    if (candy.instanceColor) candy.instanceColor.needsUpdate = true;
    g.add(stick, candy, swirl);
    g.name = 'lollipops';
    return g;
  }
}
