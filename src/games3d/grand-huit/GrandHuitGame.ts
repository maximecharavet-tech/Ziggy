import * as THREE from 'three';
import { Post } from '../kit/post';
import { createRenderer, disposeTree, glowTex, prefersLowPower, studioEnvironment } from '../kit/look';
import { makeZiggy, type ZiggyActor } from '../kit/models';
import { Puffs } from '../kit/world';
import { FairAudio } from './audio';
import { FAIR_COLORS, makeBigTop, makeCarousel, makeClouds, makeFerrisWheel, makeGarlands, makeGround, makeScenery, makeSky, makeStall, type Bulbs, type Carousel, type Sky, type Wheel } from './fair';
import { Pops, Scarf, Sparks, makeDizzy } from './fx';
import { applyOp, gapLabel, valueAfter, type Band, type Op, type Ride } from './logic';
import { NumberLine, RidePath, Y0, buildFinale, buildPieces, layoutFor, makeCart, makeGapMarker, makeGate, makePool, type Cart, type Finale, type Layout, type Piece, type Pool } from './track';
import { badgeTexture, bubbleTexture, spriteOf } from './util';

/**
 * Le Grand Huit des Nombres — the three.js scene.
 *
 * A fairground at sunset. The number line is a straight coaster rail with one
 * station per number; every rail piece the child adds grows out of it as a
 * hill ("+"), a dip ("−") or a big purple hill ("×"). On "Let's go!" Ziggy
 * rides the pieces one by one (a ding and a big number at every station).
 * Right on the target: a loop appears, balloons fly off, the scarf too, and
 * the cart dives into the pool with the rubber duck — splash, dizzy stars,
 * giggles. Anywhere else: a funny "boing", the gap is drawn ("+2"), and the
 * cart rolls back to the start so the child can adjust. After five rides:
 * a victory lap on the Ferris wheel at sunset, with fireworks.
 *
 * The scene never decides anything: the logic (logic.ts) and the React HUD do.
 */

export interface CoasterCallbacks {
  /** The cart landed at the end of piece `index` (the station's number). */
  onStation: (value: number, index: number) => void;
  /** The ride stopped: right on the target or not. */
  onStop: (ok: boolean, reached: number) => void;
  /** Ready again: back at the start after a miss, or after the splash. */
  onReady: (ok: boolean) => void;
  onLapDone: () => void;
  onZiggyTap: () => void;
}

type Mode = 'build' | 'ride' | 'boing' | 'rewind' | 'finale' | 'splashed' | 'lap';

const ZIGGY_SCALE = 0.58;
const LIGHT_DIR = new THREE.Vector3(-0.55, 1, 0.75).normalize();

interface Floater {
  obj: THREE.Object3D;
  v: THREE.Vector3;
  life: number;
  spin: number;
}

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

export class GrandHuitGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
  private post: Post;
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private resize: ResizeObserver;
  private lowPower = prefersLowPower();
  private reduce = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  private motion = this.reduce ? 0.35 : 1;
  private audio = new FairAudio();
  private dropEnv: () => void;
  private timers: number[] = [];
  private paused = false;
  private disposed = false;

  // World
  private sky: Sky;
  private hemi = new THREE.HemisphereLight('#ffe2d0', '#6f9a5c', 1.25);
  private sun = new THREE.DirectionalLight('#ffd7a8', 2.2);
  private rim = new THREE.DirectionalLight('#ff9ec2', 0.8);
  private wheel: Wheel;
  private carousel: Carousel;
  private garlands: { group: THREE.Group; bulbs: Bulbs };
  private clouds: THREE.Group;
  private sparks: Sparks;
  private puffs = new Puffs(glowTex());
  private pops = new Pops();
  private floaters: Floater[] = [];
  private dusk = 0;
  private duskTarget = 0;

  // Ziggy and the cart
  private cart: Cart;
  private ziggy: ZiggyActor;
  private scarf: Scarf;
  private scarfFree: { v: THREE.Vector3; back: number; from?: THREE.Vector3; fromQ?: THREE.Quaternion } | null = null;
  private dizzy: THREE.Group;
  private dizzyT = 0;
  private wind = 0;
  private lastCartPos = new THREE.Vector3();

  // The ride
  private ride: Ride | null = null;
  private band: Band;
  private layout: Layout = layoutFor(10);
  private rideGroup = new THREE.Group();
  private line: NumberLine | null = null;
  private pieces: Piece[] = [];
  private path: Op[] = [];
  private pendingPath: Op[] | null = null;
  private gate: ReturnType<typeof makeGate> | null = null;
  private pool: Pool | null = null;
  private finale: Finale | null = null;
  private gapMarker: THREE.Group | null = null;
  private question: THREE.Sprite[] = [];
  private mode: Mode = 'build';
  private run = { k: 0, u: 0, dwell: 0, s: 0, boingT: 0, rewindK: 0, splashT: 0, top: false, splashed: false, ok: false };
  private ripple = 0;
  private duckJump = { y: 0, v: 0 };

  // Camera
  private camPos = new THREE.Vector3(0, 8, 22);
  private camLook = new THREE.Vector3(0, 1.5, 0);
  private wantPos = new THREE.Vector3(0, 8, 22);
  private wantLook = new THREE.Vector3(0, 1.5, 0);
  private insets = { top: 0, bottom: 0 };
  private shift = 0;
  private framedAt = -1;

  // Lap
  private lap = { t: 0, gondola: -1, fired: 0, done: false };

  // Input
  private down: { x: number; y: number } | null = null;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private perf = { frames: 0, time: 0, ratio: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    opts: { band: Band; locale: string },
    private cb: CoasterCallbacks
  ) {
    this.band = opts.band;
    this.renderer = createRenderer(canvas, { lowPower: this.lowPower });
    this.renderer.toneMappingExposure = 1.0;
    if (this.lowPower) this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.post = new Post(this.renderer, this.scene, this.camera, { enabled: !this.lowPower, strength: 0.42, radius: 0.45, threshold: 1.0 });

    this.sky = makeSky();
    this.wheel = makeFerrisWheel();
    this.carousel = makeCarousel();
    this.garlands = makeGarlands();
    this.clouds = makeClouds();
    this.sparks = new Sparks(this.lowPower ? 260 : 520, 0.34);
    this.cart = makeCart();
    this.ziggy = makeZiggy({ accessory: 'none', lowPower: this.lowPower });
    this.scarf = new Scarf();
    this.dizzy = makeDizzy();
    this.dropEnv = studioEnvironment(this.renderer, this.ziggy, 0.5);
    this.buildWorld();

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas.parentElement ?? canvas);
    this.fit();
    this.start();
  }

  /* ───────────────────────── World ───────────────────────── */

  private buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color('#f59bb8');
    s.fog = new THREE.Fog(this.sky.fog, 55, 190);
    s.add(this.sky.mesh, this.clouds);
    s.add(this.hemi);
    this.sun.castShadow = true;
    const sm = this.lowPower ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    Object.assign(this.sun.shadow.camera, { left: -24, right: 24, top: 16, bottom: -16, near: 1, far: 90 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    s.add(this.sun, this.sun.target);
    this.rim.position.set(8, 10, -30);
    s.add(this.rim);

    s.add(makeGround(), makeScenery(this.lowPower));
    this.wheel.group.position.set(6, 0, -27);
    this.carousel.group.position.set(21, 0, -12);
    const top = makeBigTop();
    top.position.set(-14, 0, -22);
    top.rotation.y = 0.3;
    const stalls: [Parameters<typeof makeStall>[0], string, number, number, number][] = [
      ['popcorn', '#ff4f5e', -24, -9, 0.35],
      ['candy', '#ff7ab8', -5, -12.5, 0],
      ['balloon', '#3fc1c9', 11, -12, -0.1],
      ['duck', '#ffb63d', 27, -2, -0.9],
    ];
    for (const [kind, col, x, z, ry] of stalls) {
      const st = makeStall(kind, col);
      st.position.set(x, 0, z);
      st.rotation.y = ry;
      s.add(st);
    }
    s.add(this.wheel.group, this.carousel.group, top, this.garlands.group);
    // A balloon seller's bunch, swaying near the big top.
    s.add(this.sparks.points, this.puffs.group, this.pops.group, this.rideGroup);

    // Ziggy rides the cart, with his scarf.
    const rig = this.ziggy.userData.rig;
    rig.seated = true;
    rig.energy = this.reduce ? 0.35 : 1;
    this.ziggy.scale.setScalar(ZIGGY_SCALE);
    this.ziggy.rotation.y = Math.PI / 2;
    this.cart.seat.add(this.ziggy);
    const model = this.ziggy.userData.model;
    model.body.add(this.scarf.group);
    this.scarf.rest.pos.copy(this.scarf.group.position);
    this.scarf.rest.quat.copy(this.scarf.group.quaternion);
    model.head.add(this.dizzy);
    this.cart.group.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
    s.add(this.cart.group);
  }

  private fit() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 58 : 46;
    this.applyShift(true);
    this.framedAt = -1;
  }

  /** Room taken by the HUD at the top and the bottom (px): the action stays between. */
  setInsets(top: number, bottom: number) {
    this.insets = { top: Math.max(0, top), bottom: Math.max(0, bottom) };
    this.framedAt = -1;
  }

  /** Shift the picture so its centre is the middle of the free band between the HUD bars. */
  private applyShift(force = false) {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    const top = Math.min(this.insets.top, h * 0.4);
    const bottom = Math.min(this.insets.bottom, h * 0.5);
    const want = h / 2 - (top + (h - bottom)) / 2;
    const next = force ? want : this.shift + (want - this.shift) * 0.12;
    if (!force && Math.abs(next - this.shift) < 0.25) return;
    this.shift = next;
    const s = Math.round(this.shift);
    if (Math.abs(s) < 1) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h + 2 * Math.abs(s), 0, s > 0 ? 2 * s : 0, w, h);
    this.camera.updateProjectionMatrix();
  }

  /* ───────────────────────── Rides ───────────────────────── */

  /** A new ride: rebuild the number line, the target gate and the pool; the cart goes to the start. */
  setRide(ride: Ride) {
    this.clearTimers();
    this.ride = ride;
    this.path = [];
    this.pendingPath = null;
    this.clearRide();
    this.layout = layoutFor(ride.max);
    this.line = new NumberLine(this.layout, this.band);
    this.rideGroup.add(this.line.group);
    this.line.label(ride.start, 'start');
    if (!ride.hidden) this.showGoal(false);
    else this.showQuestions();
    this.rebuildPieces(false);
    // Ziggy back in the cart if he was on the Ferris wheel.
    if (this.ziggy.parent !== this.cart.seat) this.seatZiggy();
    this.restoreScarf();
    this.dizzyT = 0;
    this.dizzy.visible = false;
    this.cart.group.visible = true;
    this.placeCart(ride.start);
    this.puffs.emit(this.cart.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)), { color: '#ffffff', count: this.lowPower ? 8 : 16, spread: 2.2, up: 1.6, life: 1.0, size: 0.8 });
    this.sparks.emit(this.cart.group.position.clone().add(new THREE.Vector3(0, 1, 0)), { count: 30, colors: FAIR_COLORS, speed: 3.2, life: 0.9, gravity: 3 });
    this.mode = 'build';
    this.ziggy.userData.rig.cue('wave');
    this.framedAt = -1;
    this.lap = { t: 0, gondola: -1, fired: 0, done: false };
    this.duskTarget = 0;
  }

  private clearRide() {
    for (const o of [...this.rideGroup.children]) {
      this.rideGroup.remove(o);
      disposeTree(o);
    }
    this.pieces = [];
    this.gate = null;
    this.pool = null;
    this.finale = null;
    this.gapMarker = null;
    this.question = [];
    this.pops.clear();
  }

  /** Target gate, slide and pool at the target station (popping in when revealed). */
  private showGoal(pop: boolean) {
    const ride = this.ride!;
    const xt = this.layout.x(ride.target);
    const dotsN = this.band === 'little' ? ride.target : 0;
    this.gate = makeGate(badgeTexture(String(ride.target), 'target', dotsN), 3.6);
    this.gate.group.position.set(xt, 0, 0);
    this.rideGroup.add(this.gate.group);
    this.line!.label(ride.target, 'target');
    this.finale = buildFinale(xt, 0, { loop: false, slide: true });
    this.rideGroup.add(this.finale.slide!);
    this.pool = makePool();
    this.pool.center.copy(this.finale.poolCenter);
    this.pool.group.position.copy(this.finale.poolCenter);
    this.rideGroup.add(this.pool.group);
    if (pop) {
      for (const g of [this.gate.group, this.finale.slide!, this.pool.group]) {
        g.scale.setScalar(0.01);
        g.userData.grow = 0;
      }
      this.sparks.emit(new THREE.Vector3(xt, 4.4, 0), { count: 50, colors: FAIR_COLORS, speed: 4.5, life: 1.2, gravity: 4 });
    }
  }

  /** "?" over the stations a hidden ride hints at (the two choices, or after the pattern). */
  private showQuestions() {
    const ride = this.ride!;
    const spots: THREE.Vector3[] = [];
    if (ride.kind === 'compare') for (const op of ride.palette) spots.push(new THREE.Vector3(this.layout.x(applyOp(ride.start, op)), Y0 + 1.25, 0.2));
    else {
      const end = valueAfter(ride.start, ride.preset);
      spots.push(new THREE.Vector3(this.layout.x(end) + Math.max(1.4, this.layout.sp * 2), Y0 + 1.7, 0.2));
    }
    for (const p of spots) {
      const q = spriteOf(bubbleTexture('?', '#ff5ca8'), 0.9);
      q.position.copy(p);
      q.userData.base = p.clone();
      q.renderOrder = 6;
      this.question.push(q);
      this.rideGroup.add(q);
    }
  }

  /** The child's pieces changed (only while building). */
  setPath(ops: Op[]) {
    if (this.mode !== 'build') {
      this.pendingPath = [...ops];
      return;
    }
    const grew = ops.length > this.path.length;
    const shrank = ops.length < this.path.length;
    this.path = [...ops];
    this.rebuildPieces(grew);
    if (this.gapMarker) {
      this.rideGroup.remove(this.gapMarker);
      disposeTree(this.gapMarker);
      this.gapMarker = null;
    }
    if (grew) {
      this.audio.click(ops[ops.length - 1].kind === 'mul' ? 4 : ops[ops.length - 1].n);
      const p = this.pieces[this.pieces.length - 1];
      this.sparks.emit(p.apex.clone(), { count: 18, colors: [FAIR_COLORS[ops.length % FAIR_COLORS.length], '#ffffff'], speed: 2.4, life: 0.7, gravity: 2 });
      this.ziggy.userData.rig.cue(ops.length % 2 ? 'nod' : 'jump');
    } else if (shrank) {
      this.audio.undo();
      this.ziggy.userData.rig.cue('think');
    }
    this.framedAt = -1;
  }

  private rebuildPieces(popLast: boolean) {
    const ride = this.ride;
    if (!ride || !this.line) return;
    for (const p of this.pieces) {
      this.rideGroup.remove(p.group);
      disposeTree(p.group);
    }
    const ops = [...ride.preset, ...this.path];
    this.pieces = buildPieces(this.layout, ride.start, ops, this.band, ride.preset.length);
    for (const p of this.pieces) this.rideGroup.add(p.group);
    if (popLast && this.pieces.length) {
      const last = this.pieces[this.pieces.length - 1];
      last.grow = 0;
      (last.group.userData.holder as THREE.Group).scale.set(0.9, 0.01, 1);
      last.label.scale.setScalar(0.01);
    }
    // Number badges: the stops of the path are always written (big lines skip some numbers).
    const stops = new Set<number>();
    let v = ride.start;
    for (const op of ops) stops.add((v = applyOp(v, op)));
    for (let n = 0; n <= this.layout.max; n++) {
      if (n === ride.start || (n === ride.target && !ride.hidden)) continue;
      if (stops.has(n) && !this.layout.labelled(n)) this.line.label(n, 'small');
      else if (!stops.has(n)) this.line.plain(n);
    }
  }

  /** Put the cart (and Ziggy) at rest on a station of the line. */
  private placeCart(v: number) {
    const g = this.cart.group;
    g.position.set(this.layout.x(v), Y0 + 0.03, 0);
    g.quaternion.identity();
    this.cart.body.position.set(0, 0, 0);
    this.cart.body.rotation.set(0, 0, 0);
    this.cart.body.scale.set(1, 1, 1);
    this.lastCartPos.copy(g.position);
  }

  private seatZiggy() {
    const z = this.ziggy;
    z.parent?.remove(z);
    z.position.set(0, 0, 0);
    z.rotation.set(0, Math.PI / 2, 0);
    z.scale.setScalar(ZIGGY_SCALE);
    this.cart.seat.add(z);
    z.userData.rig.idle = 'calm';
  }

  /** Ride the pieces. The HUD has already decided whether this stops on the target. */
  launch() {
    if (!this.ride || this.mode !== 'build' || !this.pieces.length) return;
    this.mode = 'ride';
    this.run = { k: 0, u: 0, dwell: 0, s: 0, boingT: 0, rewindK: 0, splashT: 0, top: false, splashed: false, ok: false };
    this.audio.go();
    this.ziggy.userData.rig.cue('cheer');
    if (this.gapMarker) {
      this.rideGroup.remove(this.gapMarker);
      disposeTree(this.gapMarker);
      this.gapMarker = null;
    }
  }

  private pieceDuration(p: Piece) {
    const base = (0.75 + p.path.len * 0.14) * (this.band === 'little' ? 1.2 : 1);
    return Math.max(0.85, Math.min(3.6, base));
  }

  /** Orient the cart on a path: nose along the travel (or backwards on "−" pieces), up from the path. */
  private orientCart(path: RidePath, s: number, face: number) {
    const f = path.tangent(s).multiplyScalar(face);
    const up = path.up(s);
    const side = new THREE.Vector3().crossVectors(f, up).normalize();
    if (side.lengthSq() < 0.5) return;
    const u = new THREE.Vector3().crossVectors(side, f).normalize();
    const m = new THREE.Matrix4().makeBasis(f, u, side);
    this.cart.group.quaternion.setFromRotationMatrix(m);
    this.cart.group.position.copy(path.at(s)).addScaledVector(u, 0.03);
  }

  private stepRide(dt: number) {
    const r = this.run;
    const ride = this.ride!;
    if (r.dwell > 0) {
      r.dwell -= dt;
      if (r.dwell <= 0) {
        r.k++;
        r.u = 0;
        if (r.k >= this.pieces.length) this.endRide();
      }
      return;
    }
    const p = this.pieces[r.k];
    if (!p) return this.endRide();
    r.u = Math.min(1, r.u + dt / this.pieceDuration(p));
    const s = ease(r.u) * p.path.len;
    this.orientCart(p.path, s, p.path.face);
    if (r.u >= 1) {
      // Landed on a station.
      r.dwell = this.band === 'little' ? 0.45 : 0.3;
      this.audio.ding(p.to);
      const at = this.line!.labelPos(p.to).add(new THREE.Vector3(0, 2.75, 0));
      const isTarget = p.to === ride.target && r.k === this.pieces.length - 1;
      this.pops.pop(String(p.to), at, this.band === 'little' ? 1.15 : 0.95, isTarget ? '#ff7a1a' : '#5b6fd8');
      this.cart.body.position.y = -0.05;
      this.cb.onStation(p.to, r.k);
    }
  }

  private endRide() {
    const ride = this.ride!;
    const reached = valueAfter(ride.start, [...ride.preset, ...this.path]);
    const ok = reached === ride.target;
    this.run.ok = ok;
    this.cb.onStop(ok, reached);
    if (ok) this.startFinale();
    else this.startBoing(reached);
  }

  /* ── A miss: boing, show the gap, roll back ── */

  private startBoing(reached: number) {
    this.mode = 'boing';
    this.run.boingT = 0;
    this.audio.boing();
    const rig = this.ziggy.userData.rig;
    rig.cue('oops');
    this.later(1300, () => rig.cue('think'));
    const ride = this.ride!;
    const gap = ride.target - reached;
    if (!ride.hidden && gap !== 0) {
      this.gapMarker = makeGapMarker(this.layout, reached, ride.target, gapLabel(gap));
      this.rideGroup.add(this.gapMarker);
    }
    this.puffs.emit(this.cart.group.position.clone().add(new THREE.Vector3(0, 0.3, 0)), { color: '#ffffff', count: 8, spread: 1.4, up: 0.8, life: 0.8, size: 0.6 });
    this.framedAt = -1;
  }

  private stepBoing(dt: number) {
    const r = this.run;
    r.boingT += dt;
    const t = r.boingT;
    const k = Math.exp(-t * 3.2);
    const b = this.cart.body;
    b.position.x = Math.sin(t * 17) * 0.22 * k * this.motion;
    b.position.y = Math.abs(Math.sin(t * 11)) * 0.25 * k * this.motion;
    b.scale.set(1 + Math.sin(t * 22) * 0.12 * k, 1 - Math.sin(t * 22) * 0.12 * k, 1);
    if (t > 2.3) {
      b.position.set(0, 0, 0);
      b.scale.set(1, 1, 1);
      this.mode = 'rewind';
      this.run.rewindK = this.pieces.length - 1;
      this.run.u = 0;
      this.audio.whoosh(Math.min(2, 0.35 * this.pieces.length + 0.3), 0.1);
    }
  }

  private stepRewind(dt: number) {
    const r = this.run;
    const p = this.pieces[r.rewindK];
    if (!p) return this.finishRewind();
    const dur = Math.max(0.28, Math.min(0.7, 1.6 / this.pieces.length));
    r.u = Math.min(1, r.u + dt / dur);
    this.orientCart(p.path, (1 - r.u) * p.path.len, p.path.face);
    if (r.u >= 1) {
      r.rewindK--;
      r.u = 0;
      if (r.rewindK < 0) this.finishRewind();
    }
  }

  private finishRewind() {
    this.placeCart(this.ride!.start);
    this.mode = 'build';
    this.framedAt = -1;
    if (this.pendingPath) {
      const p = this.pendingPath;
      this.pendingPath = null;
      this.setPath(p);
    }
    this.cb.onReady(false);
  }

  /* ── Right on target: loop, balloons, splash ── */

  private startFinale() {
    const ride = this.ride!;
    this.mode = 'finale';
    this.audio.fanfare();
    const xt = this.layout.x(ride.target);
    if (!this.gate) this.showGoal(true);
    this.line?.label(ride.target, 'target');
    // The loop appears, starting from where the cart stands.
    const z0 = this.cart.group.position.z;
    const f = buildFinale(xt, z0, { loop: true, slide: false });
    const loop = f.loop!;
    this.finale = { ...f, slide: this.finale?.slide ?? null };
    loop.userData.grow = 0;
    (loop.userData.holder as THREE.Group).scale.setScalar(0.01);
    this.rideGroup.add(loop);
    this.sparks.emit(new THREE.Vector3(xt + 1, Y0 + 1.2, -0.8), { count: 60, colors: ['#ffe066', '#ffffff', '#ff7ab8'], speed: 4, life: 1.1, gravity: 2 });
    this.run.s = 0;
    this.run.u = -0.75; // a breath while the loop grows
    this.ziggy.userData.rig.cue('cheer');
    this.framedAt = -1;
  }

  private stepFinale(dt: number, t: number) {
    const f = this.finale!;
    const r = this.run;
    if (r.u < 0) {
      r.u += dt;
      return;
    }
    if (!r.splashed) {
      const p = f.path.at(r.s);
      const v = Math.max(3.2, Math.min(9, 4.4 + 2.2 * (Y0 + 2.3 - p.y))) * (this.reduce ? 0.8 : 1);
      r.s = Math.min(f.waterAt, r.s + v * dt);
      this.orientCart(f.path, r.s, 1);
      if (!r.top && r.s >= f.topAt) {
        r.top = true;
        this.releaseBalloons();
        this.releaseScarf();
        this.audio.whoosh(0.8, 0.14);
      }
      if (r.s >= f.waterAt) this.splash();
      return;
    }
    // In the pool: bob, dizzy stars, giggles.
    r.splashT += dt;
    const pc = f.poolCenter;
    const g = this.cart.group;
    const sink = Math.max(0, 1 - r.splashT * 1.5);
    g.position.set(pc.x + Math.sin(t * 0.7) * 0.15 * this.motion, 0.3 - sink * 0.2 + Math.sin(t * 3) * 0.04 * this.motion, pc.z);
    const yaw = new THREE.Euler(Math.sin(t * 2.1) * 0.06 * this.motion, -0.6, Math.sin(t * 2.6) * 0.07 * this.motion);
    g.quaternion.setFromEuler(yaw);
  }

  private splash() {
    const f = this.finale!;
    const r = this.run;
    r.splashed = true;
    r.splashT = 0;
    this.mode = 'splashed';
    this.audio.splash();
    this.later(350, () => this.audio.quack());
    const at = f.poolCenter.clone().setY(0.55);
    this.sparks.emit(at, { count: this.lowPower ? 60 : 120, colors: ['#bfefff', '#ffffff', '#7fd6ff'], speed: 5.5, spread: 1.6, dir: new THREE.Vector3(0, 1, 0), life: 1.3, gravity: 9, glow: 1.1 });
    this.puffs.emit(at, { color: '#e9f8ff', count: this.lowPower ? 8 : 16, spread: 3, up: 1.4, life: 1.3, size: 1.0 });
    this.ripple = 1;
    this.duckJump.v = 4.2;
    const rig = this.ziggy.userData.rig;
    rig.cue('oops');
    this.dizzyT = 2.6;
    this.dizzy.visible = true;
    this.later(2300, () => {
      rig.cue('giggle');
      this.returnScarf();
    });
    this.later(3400, () => rig.cue('cheer'));
    this.later(4300, () => this.cb.onReady(true));
    this.framedAt = -1;
  }

  private releaseBalloons() {
    if (!this.gate) return;
    this.audio.pop();
    for (const b of this.gate.balloons) {
      this.scene.attach(b);
      this.floaters.push({ obj: b, v: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.6 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8), life: 7, spin: (Math.random() - 0.5) * 1.5 });
    }
    this.gate.balloons = [];
  }

  private releaseScarf() {
    if (this.scarfFree || this.reduce) return;
    this.scene.attach(this.scarf.group);
    this.scarfFree = { v: new THREE.Vector3(-1.2, 2.6, 0.9), back: -1 };
  }

  private returnScarf() {
    if (!this.scarfFree) return;
    this.scarfFree.back = 0;
    this.scarfFree.from = this.scarf.group.position.clone();
    this.scarfFree.fromQ = this.scarf.group.quaternion.clone();
  }

  private restoreScarf() {
    const g = this.scarf.group;
    const body = this.ziggy.userData.model.body;
    if (g.parent !== body) {
      g.parent?.remove(g);
      body.add(g);
    }
    g.position.copy(this.scarf.rest.pos);
    g.quaternion.copy(this.scarf.rest.quat);
    g.scale.set(1, 1, 1);
    this.scarfFree = null;
  }

  private stepScarf(dt: number, t: number) {
    const fr = this.scarfFree;
    if (!fr) {
      this.scarf.flutter(t, this.wind, this.motion);
      return;
    }
    const g = this.scarf.group;
    if (fr.back < 0) {
      // Flying free: up, drifting, tumbling.
      fr.v.y -= dt * 0.6;
      fr.v.multiplyScalar(1 - dt * 0.25);
      g.position.addScaledVector(fr.v, dt);
      g.rotation.z += dt * 1.6;
      g.rotation.y += dt * 0.9;
      this.scarf.flutter(t, 1, this.motion, 1);
      return;
    }
    // Flying back to the neck.
    fr.back = Math.min(1, fr.back + dt / 0.9);
    const e = ease(fr.back);
    const body = this.ziggy.userData.model.body;
    body.updateWorldMatrix(true, false);
    const target = this.scarf.rest.pos.clone().applyMatrix4(body.matrixWorld);
    const tq = body.getWorldQuaternion(new THREE.Quaternion()).multiply(this.scarf.rest.quat);
    g.position.lerpVectors(fr.from!, target, e);
    g.position.y += Math.sin(e * Math.PI) * 1.2;
    g.quaternion.slerpQuaternions(fr.fromQ!, tq, e);
    this.scarf.flutter(t, 0.8, this.motion, 1 - e);
    if (fr.back >= 1) {
      this.restoreScarf();
      this.sparks.emit(target, { count: 16, colors: ['#ff4f5e', '#ffffff', '#ffcc33'], speed: 1.8, life: 0.6, gravity: 1 });
    }
  }

  /* ───────────────────────── Victory lap ───────────────────────── */

  /** Ziggy hops into a gondola for a lap of honour on the Ferris wheel at sunset. */
  honorLap() {
    this.clearTimers();
    this.mode = 'lap';
    this.lap = { t: 0, gondola: -1, fired: 0, done: false };
    this.restoreScarf();
    this.dizzy.visible = false;
    // The gondola nearest the bottom.
    let best = 0;
    let bestY = Infinity;
    this.wheel.wheel.updateMatrixWorld(true);
    this.wheel.gondolas.forEach((g, i) => {
      const y = g.getWorldPosition(new THREE.Vector3()).y;
      if (y < bestY) {
        bestY = y;
        best = i;
      }
    });
    this.lap.gondola = best;
    const holder = this.wheel.gondolas[best];
    const cabin = holder.userData.cabin as THREE.Group;
    const z = this.ziggy;
    this.puffs.emit(this.cart.group.position.clone().add(new THREE.Vector3(0, 1, 0)), { color: '#ffffff', count: 14, spread: 2, up: 1.4, life: 1, size: 0.9 });
    z.parent?.remove(z);
    z.position.set(0, -1.62, 0.05);
    z.rotation.set(0, 0, 0);
    z.scale.setScalar(0.62);
    cabin.add(z);
    z.userData.rig.idle = 'wave';
    this.cart.group.visible = false;
    this.duskTarget = 1;
    this.audio.fanfare();
    this.framedAt = -1;
  }

  private stepLap(dt: number) {
    const L = this.lap;
    L.t += dt;
    if (!L.done && L.t > 9.5) {
      L.done = true;
      this.cb.onLapDone();
    }
    // Fireworks over the fair once Ziggy is high up.
    const every = this.reduce ? 1.6 : 0.75;
    if (L.t > 4 && L.t - 4 > L.fired * every) {
      L.fired++;
      const at = new THREE.Vector3(this.wheel.group.position.x + (Math.random() - 0.5) * 36, 20 + Math.random() * 10, -40 - Math.random() * 12);
      const cols = [FAIR_COLORS[L.fired % FAIR_COLORS.length], '#ffffff', FAIR_COLORS[(L.fired + 2) % FAIR_COLORS.length]];
      this.sparks.emit(at, { count: this.lowPower ? 50 : 90, colors: cols, speed: 7, life: 1.6, gravity: 2.2, glow: 1.8 });
      if (L.fired % 2 === 1 || !this.reduce) this.audio.firework();
    }
  }

  /* ───────────────────────── Camera ───────────────────────── */

  /** Fit a set of points between the HUD bars, seen from a 3/4 front view. */
  private fitPoints(pts: THREE.Vector3[], yaw: number, pitch: number) {
    const box = new THREE.Box3().setFromPoints(pts);
    const c = box.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const el = this.canvas.parentElement ?? this.canvas;
    const h = el.clientHeight || 600;
    const yHi = 1 - (2 * Math.min(this.insets.top, h * 0.4)) / h - 0.06;
    const yLo = -1 + (2 * Math.min(this.insets.bottom, h * 0.5)) / h + 0.06;
    const cam = this.camera;
    const saved = cam.position.clone();
    const savedQ = cam.quaternion.clone();
    const v = new THREE.Vector3();
    const fits = (d: number) => {
      cam.position.copy(c).addScaledVector(dir, d);
      cam.lookAt(c);
      cam.updateMatrixWorld(true);
      for (const p of pts) {
        v.copy(p).project(cam);
        if (v.z > 1 || Math.abs(v.x) > 0.9 || v.y > yHi || v.y < yLo) return false;
      }
      return true;
    };
    let lo = 4;
    let hi = 140;
    for (let i = 0; i < 22; i++) {
      const m = (lo + hi) / 2;
      if (fits(m)) hi = m;
      else lo = m;
    }
    cam.position.copy(saved);
    cam.quaternion.copy(savedQ);
    this.wantPos.copy(c).addScaledVector(dir, hi);
    this.wantLook.copy(c);
  }

  private view(): { yaw: number; pitch: number } {
    const a = this.camera.aspect;
    if (a < 0.8) return { yaw: 0.62, pitch: 0.5 };
    if (a < 1.25) return { yaw: 0.45, pitch: 0.46 };
    return { yaw: 0.3, pitch: 0.42 };
  }

  private frameBuild() {
    const ride = this.ride;
    if (!ride) return;
    const L = this.layout;
    const pts: THREE.Vector3[] = [];
    const addStation = (v: number) => {
      const x = L.x(v);
      pts.push(new THREE.Vector3(x - 0.6, 0.1, 1.1), new THREE.Vector3(x + 0.6, Y0 + 1.9, 0));
    };
    addStation(ride.start);
    for (const p of this.pieces) {
      addStation(p.to);
      pts.push(p.apex.clone().add(new THREE.Vector3(0, p.to > p.from ? 1.0 : -0.8, 0)));
    }
    if (!ride.hidden || this.gate) {
      addStation(ride.target);
      pts.push(new THREE.Vector3(L.x(ride.target), 5.1, 0));
      if (this.pool) pts.push(this.pool.center.clone().add(new THREE.Vector3(-1.6, 0.6, -1.4)), this.pool.center.clone().add(new THREE.Vector3(1.6, 0.6, 0)));
    }
    for (const q of this.question) pts.push(q.position.clone().add(new THREE.Vector3(0, 0.6, 0)));
    if (ride.kind === 'compare') for (const op of ride.palette) addStation(applyOp(ride.start, op));
    // Never too close: at least a few stations around.
    const box = new THREE.Box3().setFromPoints(pts);
    const cx = (box.min.x + box.max.x) / 2;
    const minW = this.camera.aspect < 0.8 ? 7 : 10;
    if (box.max.x - box.min.x < minW) pts.push(new THREE.Vector3(cx - minW / 2, Y0, 0), new THREE.Vector3(cx + minW / 2, Y0, 0));
    const { yaw, pitch } = this.view();
    this.fitPoints(pts, yaw, pitch);
  }

  private stepCamera(dt: number, t: number) {
    const portrait = this.camera.aspect < 0.8;
    const c = this.cart.group.position;
    if (this.mode === 'build' || this.mode === 'rewind') {
      if (this.framedAt < 0) {
        this.frameBuild();
        this.framedAt = t;
      }
    } else if (this.mode === 'ride') {
      const off = portrait ? new THREE.Vector3(2.6, 3.0, 8.4) : new THREE.Vector3(2.4, 2.4, 6.6);
      this.wantPos.copy(c).add(off);
      this.wantLook.copy(c).add(new THREE.Vector3(1.0, 0.5, 0));
    } else if (this.mode === 'boing') {
      if (this.framedAt < 0) {
        const ride = this.ride!;
        const pts = [c.clone().add(new THREE.Vector3(0, 1.8, 0)), c.clone().add(new THREE.Vector3(0, -1.2, 1))];
        if (!ride.hidden) {
          const x = this.layout.x(ride.target);
          pts.push(new THREE.Vector3(x, 5, 0), new THREE.Vector3(x, 0.2, 1.1));
        }
        const box = new THREE.Box3().setFromPoints(pts);
        const cx = (box.min.x + box.max.x) / 2;
        if (box.max.x - box.min.x < 7) pts.push(new THREE.Vector3(cx - 3.5, Y0, 0), new THREE.Vector3(cx + 3.5, Y0, 0));
        const { yaw, pitch } = this.view();
        this.fitPoints(pts, yaw, pitch * 0.85);
        this.framedAt = t;
      }
    } else if (this.mode === 'finale' && this.finale) {
      const xt = this.layout.x(this.ride!.target);
      if (this.run.top || this.run.s > 1) {
        this.wantLook.set(xt + 1.0, Y0 + 0.4, -1.8);
        this.wantPos.set(xt + (portrait ? 5.4 : 5.6), Y0 + (portrait ? 4.2 : 3.2), portrait ? 9.4 : 6.8);
      } else {
        this.wantPos.copy(c).add(portrait ? new THREE.Vector3(3.6, 3.2, 9) : new THREE.Vector3(3.6, 2.6, 7));
        this.wantLook.copy(c).add(new THREE.Vector3(0.8, 0.8, -0.6));
      }
    } else if (this.mode === 'splashed' && this.finale) {
      const pc = this.finale.poolCenter;
      this.wantLook.copy(pc).add(new THREE.Vector3(0, 0.9, 0));
      this.wantPos.copy(pc).add(portrait ? new THREE.Vector3(2.6, 3.8, 9.4) : new THREE.Vector3(3.4, 3.0, 7.2));
    } else if (this.mode === 'lap' && this.lap.gondola >= 0) {
      const g = this.wheel.gondolas[this.lap.gondola];
      const p = g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -1.0, 0));
      const k = Math.min(1, this.lap.t / 3);
      this.wantLook.copy(p);
      this.wantPos.copy(p).add(new THREE.Vector3(-3.5 + Math.sin(this.lap.t * 0.25) * 1.5, 1.4 + k * 0.8, portrait ? 13 : 9.5));
    }
    const kk = 1 - Math.exp(-dt * (this.mode === 'ride' || this.mode === 'finale' ? 3.2 : 2.4));
    this.camPos.lerp(this.wantPos, kk);
    this.camLook.lerp(this.wantLook, kk);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    // The sun's shadows follow the action.
    this.sun.target.position.copy(this.camLook).setY(0);
    this.sun.position.copy(this.sun.target.position).addScaledVector(LIGHT_DIR, 40);
    this.applyShift();
  }

  /* ───────────────────────── Loop ───────────────────────── */

  private start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.clock.getDelta();
    this.loop();
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private onVisibility = () => {
    if (document.hidden) {
      this.stop();
      this.audio.suspend(true);
    } else {
      this.audio.suspend(false);
      this.start();
    }
  };

  setPaused(p: boolean) {
    this.paused = p;
  }

  setMusic(on: boolean) {
    if (on) this.audio.startMusic();
    else this.audio.stopMusic();
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    const dt = this.paused ? 0 : Math.min(0.05, raw);
    const t = this.clock.elapsedTime;
    this.step(dt, t);
    this.post.render(dt);
    this.adaptResolution(raw);
  };

  /** Weak device: lower the internal resolution step by step (never below 0.55). */
  private adaptResolution(raw: number) {
    const p = this.perf;
    p.frames++;
    p.time += raw;
    if (p.time < 2.5) return;
    const fps = p.frames / p.time;
    p.frames = 0;
    p.time = 0;
    if (!p.ratio) p.ratio = this.renderer.getPixelRatio();
    if (fps < 24 && p.ratio > 0.56) {
      p.ratio = Math.max(0.55, p.ratio - 0.15);
      this.renderer.setPixelRatio(p.ratio);
      this.fit();
    }
  }

  private step(dt: number, t: number) {
    const m = this.motion;
    // The fair lives on its own.
    const lapSpeed = this.mode === 'lap' ? 0.33 : 0.07;
    this.wheel.wheel.rotation.z += dt * lapSpeed * (this.mode === 'lap' ? 1 : m);
    for (const g of this.wheel.gondolas) {
      g.rotation.z = -this.wheel.wheel.rotation.z;
      const cabin = g.userData.cabin as THREE.Group;
      cabin.rotation.z = Math.sin(t * 1.3 + g.position.x) * 0.05 * m;
    }
    this.carousel.spin.rotation.y += dt * 0.35 * m;
    for (const h of this.carousel.horses) h.position.y = 1.6 + Math.sin(t * 2.2 * m + (h.userData.phase as number)) * 0.32 * m;
    const lights = 0.2 + this.dusk;
    this.garlands.bulbs.update(t, lights, m);
    this.wheel.bulbs.update(t * 0.8, lights, m);
    this.carousel.bulbs.update(t * 1.2, lights, m);
    this.clouds.rotation.y += dt * 0.002 * m;
    // Sunset deepens for the victory lap.
    this.dusk += (this.duskTarget - this.dusk) * Math.min(1, dt * 0.35);
    this.sky.setDusk(this.dusk);
    (this.scene.fog as THREE.Fog).color.copy(this.sky.fog);
    (this.scene.background as THREE.Color).copy(this.sky.fog);
    this.sun.intensity = 2.2 - this.dusk * 1.1;
    this.hemi.intensity = 1.25 - this.dusk * 0.45;

    switch (this.mode) {
      case 'ride':
        this.stepRide(dt);
        break;
      case 'boing':
        this.stepBoing(dt);
        break;
      case 'rewind':
        this.stepRewind(dt);
        break;
      case 'finale':
      case 'splashed':
        this.stepFinale(dt, t);
        break;
      case 'lap':
        this.stepLap(dt);
        break;
      default:
        break;
    }
    // The cart settles after a landing.
    if (this.mode === 'ride' && this.cart.body.position.y < 0) this.cart.body.position.y = Math.min(0, this.cart.body.position.y + dt * 0.5);

    // Wind from the cart's speed: antennas and scarf.
    const cp = this.cart.group.position;
    const speed = dt > 0 ? cp.distanceTo(this.lastCartPos) / dt : 0;
    this.lastCartPos.copy(cp);
    const wantWind = this.mode === 'lap' ? 0.25 : Math.min(1, speed / 5);
    this.wind += (wantWind - this.wind) * Math.min(1, dt * 4);

    const rig = this.ziggy.userData.rig;
    rig.update(dt);
    const model = this.ziggy.userData.model;
    if (this.wind > 0.02) {
      model.antennas.forEach((a, i) => {
        a.rotation.x += (-0.65 * this.wind + Math.sin(t * 23 + i * 1.3) * 0.12 * this.wind) * m;
        a.rotation.z += Math.sin(t * 17 + i * 2.1) * 0.1 * this.wind * m;
      });
    }
    this.stepScarf(dt, t);
    if (this.dizzyT > 0) {
      this.dizzyT -= dt;
      this.dizzy.rotation.y += dt * 5 * Math.max(0.4, m);
      const k = Math.min(1, this.dizzyT / 0.5);
      this.dizzy.scale.setScalar(k);
      if (this.dizzyT <= 0) this.dizzy.visible = false;
    }

    // Growing pieces, gate, loop.
    for (const p of this.pieces) {
      if (p.grow >= 1) continue;
      p.grow = Math.min(1, p.grow + dt * 3);
      const e = 1 + Math.sin(p.grow * Math.PI) * 0.18 * m - (1 - p.grow) * 0.9;
      (p.group.userData.holder as THREE.Group).scale.set(0.9 + 0.1 * p.grow, Math.max(0.01, e), 1);
      const base = p.label.userData.baseScale as THREE.Vector3;
      const ls = Math.max(0.01, p.grow);
      p.label.scale.set(base.x * ls, base.y * ls, 1);
    }
    const growIn = (g: THREE.Object3D | undefined, target?: THREE.Object3D) => {
      if (!g || g.userData.grow === undefined || g.userData.grow >= 1) return;
      g.userData.grow = Math.min(1, (g.userData.grow as number) + dt * 2.2);
      const k = g.userData.grow as number;
      (target ?? g).scale.setScalar(Math.max(0.01, 1 + Math.sin(k * Math.PI) * 0.15 - (1 - k) * 0.95));
    };
    growIn(this.gate?.group);
    growIn(this.finale?.slide ?? undefined);
    growIn(this.pool?.group);
    if (this.finale?.loop) growIn(this.finale.loop, this.finale.loop.userData.holder as THREE.Group);

    // Gate balloons sway; the flag flaps; "?" bob; the gap marker pulses.
    if (this.gate) {
      for (const b of this.gate.balloons) b.rotation.z = Math.sin(t * 1.4 + (b.userData.phase as number)) * 0.12 * m + (b.userData.tilt ?? 0);
      const flag = this.gate.group.getObjectByName('flag');
      if (flag) flag.rotation.y = Math.sin(t * 4) * 0.25 * m;
      this.gate.banner.position.y = 3.6 + 0.85 + Math.sin(t * 2) * 0.06 * m;
    }
    for (const q of this.question) q.position.y = (q.userData.base as THREE.Vector3).y + Math.sin(t * 2.4 + q.position.x) * 0.12 * m;
    if (this.gapMarker) {
      const b = this.gapMarker.userData.bubble as THREE.Sprite;
      const base = b.userData.baseScale as THREE.Vector3;
      const k = 1 + Math.sin(t * 5) * 0.06 * m;
      b.scale.set(base.x * k, base.y * k, 1);
      const dm = (this.gapMarker.userData.dots as THREE.Points).material as THREE.PointsMaterial;
      dm.opacity = 0.65 + Math.sin(t * 6) * 0.35;
    }
    // Floating balloons fly away into the sky.
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.v.x += Math.sin(t * 1.3 + i) * dt * 0.4;
      f.obj.position.addScaledVector(f.v, dt);
      f.obj.rotation.z = Math.sin(t * 2 + i) * 0.25;
      f.obj.rotation.y += f.spin * dt;
      if (f.life <= 0) {
        this.scene.remove(f.obj);
        disposeTree(f.obj);
        this.floaters.splice(i, 1);
      }
    }
    // Water ripples and the duck.
    if (this.pool) this.stepPool(dt, t);

    this.sparks.update(dt);
    this.puffs.update(dt);
    this.pops.update(dt);
    // A little life in the cart while waiting.
    if (this.mode === 'build') this.cart.body.rotation.x = Math.sin(t * 2.2) * 0.02 * m;
    this.stepCamera(dt, t);
  }

  private stepPool(dt: number, t: number) {
    const pool = this.pool!;
    this.ripple = Math.max(0, this.ripple - dt * 0.45);
    const pos = pool.water.geometry.attributes.position as THREE.BufferAttribute;
    const base = pool.water.userData.base as Float32Array;
    const amp = 0.012 * this.motion + this.ripple * 0.14 * this.motion;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const r = Math.hypot(x, y);
      pos.setZ(i, Math.sin(r * 7 - t * (3 + this.ripple * 6)) * amp * (1 - r / (pool.radius + 0.2)));
    }
    pos.needsUpdate = true;
    // The rubber duck bobs (and jumps at the splash).
    const d = this.duckJump;
    d.v -= 12 * dt;
    d.y = Math.max(0, d.y + d.v * dt);
    if (d.y === 0 && d.v < 0) d.v = 0;
    const duck = pool.duck;
    duck.position.y = 0.48 + d.y + Math.sin(t * 2.4) * 0.03 * this.motion;
    duck.rotation.z = Math.sin(t * 1.9) * 0.08 * this.motion;
    duck.rotation.y = 2.3 + (d.y > 0 ? d.y * 3 : Math.sin(t * 0.5) * 0.3 * this.motion);
  }

  /* ───────────────────────── Input ───────────────────────── */

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14) return;
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const targets: THREE.Object3D[] = [this.ziggy, this.cart.body];
    if (this.pool) targets.push(this.pool.duck);
    const hit = this.ray.intersectObjects(targets, true)[0];
    if (!hit) return;
    let o: THREE.Object3D | null = hit.object;
    while (o && o !== this.ziggy && o !== this.pool?.duck && o !== this.cart.body) o = o.parent;
    if (o === this.pool?.duck) {
      this.audio.quack();
      this.duckJump.v = 3.2;
      return;
    }
    const rig = this.ziggy.userData.rig;
    if (!rig.busy) rig.cue(Math.random() < 0.5 ? 'giggle' : 'love');
    this.sparks.emit(hit.point, { count: 14, colors: ['#ff7ab8', '#ffe066', '#ffffff'], speed: 2, life: 0.7, gravity: 1 });
    this.cb.onZiggyTap();
  };

  /* ───────────────────────── Cleanup ───────────────────────── */

  private later(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== id);
      if (!this.disposed) fn();
    }, ms);
    this.timers.push(id);
  }

  private clearTimers() {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers = [];
  }

  /** For tests and the HUD: what the scene is doing. */
  get state() {
    return { mode: this.mode, pieces: this.pieces.length, dusk: this.dusk };
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.clearTimers();
    this.resize.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointerup', this.onUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.dispose();
    this.scarf.dispose();
    this.ziggy.userData.model.dispose();
    disposeTree(this.scene);
    this.dropEnv();
    this.post.dispose();
    this.renderer.dispose();
  }
}
