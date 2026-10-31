import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createRenderer, disposeTree, prefersLowPower } from '../kit/look';
import { makeZiggy, type ZiggyActor } from '../kit/models';
import { Post } from '../kit/post';
import { tr } from '@/lib/i18n-text';
import { PizzaAudio } from './audio';
import { Critter, Pigeon } from './animals';
import { Pizza, bubbleTexture, disposeFood, makeMoney, type BubbleKind, type Piece } from './food';
import { Particles, confettiTexture, disposeFxTextures, dotTexture, heartTexture, starTexture } from './fx';
import { TRUCK, makeTruck, type Truck } from './truck';
import { makeVillage, type Village } from './village';
import { canvasSprite, easeInOut, easeOut, makeSky } from './util';
import {
  CANDY_OOPS,
  CANDY_ORDER,
  CUSTOMERS,
  CUSTOMER_INFO,
  FINALE,
  PICK_FIRST,
  TOPPING_INFO,
  askHint,
  askText,
  checkChange,
  checkPizza,
  checkSum,
  emptyPizza,
  gobbleText,
  helloText,
  hintText,
  orderText,
  payHint,
  payText,
  pigeonText,
  praiseFor,
  stepsOf,
  wanted,
  type Band,
  type CustomerId,
  type PizzaState,
  type Round,
  type ToppingId,
} from './logic';

export type Step = 'arrive' | 'build' | 'ask' | 'bake' | 'pay' | 'eat' | 'party' | 'done';
export type Speaker = 'ziggy' | CustomerId;
export type SayKind = 'hello' | 'order' | 'hint' | 'praise' | 'ask' | 'pay' | 'yum' | 'gag' | 'finale' | 'fun';

export interface PizzaView {
  round: number;
  step: Step;
  pizza: PizzaState;
  selected: ToppingId | null;
  coins: number[];
  served: number;
  canUndo: boolean;
}

export interface PizzaCallbacks {
  onState: (s: PizzaView) => void;
  onSay: (lines: string[], kind: SayKind, who: Speaker) => void;
  /** A piece of a wanted topping landed: "3!" */
  onCount: (n: number, t: ToppingId) => void;
  /** The customer's face, mirrored in the HUD. */
  onReact: (kind: 'surprised' | 'happy') => void;
  onRoundDone: (round: Round, stats: { correct: number; mistakes: number; total: number }, durationMs: number) => void;
  onFinish: () => void;
}

type ViewName = 'wide' | 'street' | 'pizza' | 'oven' | 'party' | 'giraffe';
interface View {
  c: THREE.Vector3;
  r: number;
  pitch: number;
  yaw: number;
}

interface Flight {
  obj: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3 | (() => THREE.Vector3);
  t: number;
  dur: number;
  arc: number;
  spin: number;
  shrink: number;
  done?: () => void;
}

interface Mover {
  path: THREE.Vector3[];
  speed: number;
  endYaw: number | null;
  hop: boolean;
  done?: () => void;
}

type Action = { kind: 'piece'; piece: Piece } | { kind: 'slice'; i: number; prev: ToppingId | null };

const lerpAngle = (a: number, b: number, k: number) => {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * k;
};

/** Where each customer stands at the counter, and dances at the end. */
const SPOT: Record<CustomerId, { at: THREE.Vector3; yaw: number; look: number; party: THREE.Vector3 }> = {
  bear: { at: new THREE.Vector3(-2.75, 0, 2.75), yaw: 0.75, look: 0, party: new THREE.Vector3(3.3, 0, 3.7) },
  elephant: { at: new THREE.Vector3(-2.8, 0, 2.8), yaw: 0.75, look: 0, party: new THREE.Vector3(-3.5, 0, 3.6) },
  rabbit: { at: new THREE.Vector3(TRUCK.crate.x, TRUCK.crateTop, TRUCK.crate.z), yaw: 0.6, look: 0, party: new THREE.Vector3(-1.4, 0, 4.7) },
  penguin: { at: new THREE.Vector3(TRUCK.crate.x, TRUCK.crateTop, TRUCK.crate.z), yaw: 0.6, look: 0, party: new THREE.Vector3(1.3, 0, 4.7) },
  giraffe: { at: new THREE.Vector3(-3.95, 0, 2.2), yaw: Math.PI / 2, look: -1.05, party: new THREE.Vector3(-5.8, 0, 1.6) },
};
const ENTRY = new THREE.Vector3(-9, 0, 6);
const EXIT = new THREE.Vector3(13, 0, 6);

/** Ziggy's chef hat: a puffy white toque, sewn like his felt. */
function makeToque(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#fffdf8', roughness: 0.95 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.17, 24), white);
  band.position.y = 0.06;
  g.add(band);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10), white);
    p.position.set(Math.cos(a) * 0.13, 0.25, Math.sin(a) * 0.13);
    g.add(p);
  }
  const topP = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), white);
  topP.position.y = 0.33;
  g.add(topP);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.018, 6, 28), new THREE.MeshStandardMaterial({ color: '#ec4a3f', roughness: 0.8 }));
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 0.03;
  g.add(stripe);
  g.rotation.z = -0.08;
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  return g;
}

export class PizzaGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  private post: Post;
  private clock = new THREE.Clock();
  private raf = 0;
  private resize: ResizeObserver;
  private lowPower = prefersLowPower();
  private reduce = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  private audio = new PizzaAudio();
  private pmrem: THREE.PMREMGenerator;
  private env: THREE.Texture;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  // World.
  private truck: Truck;
  private village: Village;
  private sun = new THREE.DirectionalLight('#fff0d6', 2.05);
  private ziggy: ZiggyActor;
  private critters = new Map<CustomerId, Critter>();
  private pigeons: Pigeon[] = [];
  private thief: Pigeon;
  private pizza = new Pizza();
  private fx = new Particles(240);
  private glowFx = new Particles(140);
  private bubble: THREE.Sprite;
  private bubbleK = 0;
  private bubbleWant = 0;
  private huh: THREE.Sprite;
  private huhT = 0;
  private money = new THREE.Group();
  private note: THREE.Group | null = null;
  private coinMeshes: THREE.Group[] = [];

  // Time & animation.
  private time = 0;
  private tasks: { at: number; fn: () => void }[] = [];
  private tweens: { t: number; dur: number; fn: (k: number) => void; done?: () => void }[] = [];
  private flights: Flight[] = [];
  private movers = new Map<Critter, Mover>();
  private paused = false;
  private hidden = false;
  private awningLift = 0;
  private ovenHeat = 0.25;
  private ovenWant = 0.25;
  private timerSpin = false;
  private waterT = 0;
  private smokeT = 0;
  private partyT = 0;
  private perf = { frames: 0, time: 0, ratio: 0 };
  /** Test hook only (the automated playthrough on slow software GL): game speed. */
  timeScale = 1;

  // Ziggy.
  private zig = { pos: TRUCK.ziggy.clone(), target: null as THREE.Vector3 | null, yaw: 0, yawWant: 0, onArrive: null as (() => void) | null, carry: false };

  // Camera.
  private views: Record<ViewName, View>;
  private view: View;
  private cur: View;
  private insets = { top: 0, bottom: 0 };
  private size = { w: 1, h: 1 };

  // The game.
  private index = -1;
  private step: Step = 'arrive';
  private state!: PizzaState;
  private selected: ToppingId | null = null;
  private coins: number[] = [];
  private history: Action[] = [];
  private mistakes = 0;
  private roundStart = 0;
  private pigeonDone = false;
  private busy = false;
  private served = 0;
  private placed = 0;
  private pointerDown: { x: number; y: number } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private rounds: Round[],
    private opts: { locale: string; band: Band },
    private cb: PizzaCallbacks
  ) {
    this.renderer = createRenderer(canvas, { lowPower: this.lowPower });
    this.renderer.toneMappingExposure = 1.0;
    if (this.lowPower) this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.env;
    this.post = new Post(this.renderer, this.scene, this.camera, { enabled: !this.lowPower, strength: 0.32, radius: 0.5, threshold: 1.15 });

    this.truck = makeTruck(this.lowPower);
    this.village = makeVillage(this.lowPower);
    this.ziggy = makeZiggy({ lowPower: this.lowPower });
    this.ziggy.userData.model.hatAnchor.add(makeToque());
    this.ziggy.userData.rig.energy = this.reduce ? 0.35 : 1;
    this.thief = new Pigeon();
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture({ kind: 'text', text: '…' }), transparent: true, depthWrite: false, depthTest: false }));
    this.bubble.renderOrder = 10;
    this.huh = canvasSprite(
      128,
      128,
      (g) => {
        g.font = 'bold 100px Fredoka, system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 14;
        g.strokeStyle = '#ffffff';
        g.strokeText('?!', 64, 70);
        g.fillStyle = '#ff5c8a';
        g.fillText('?!', 64, 70);
      },
      0.7
    );
    (this.huh.material as THREE.SpriteMaterial).depthTest = false;
    this.huh.renderOrder = 11;

    this.views = {
      wide: { c: new THREE.Vector3(0, 3, 0.5), r: 8.5, pitch: 0.34, yaw: 0.55 },
      street: { c: new THREE.Vector3(-1.0, 2.45, 1.7), r: 3.3, pitch: 0.2, yaw: 0.22 },
      pizza: { c: TRUCK.pizza.clone().add(new THREE.Vector3(0, 0.36, -0.36)), r: 1.0, pitch: 0.78, yaw: 0 },
      oven: { c: new THREE.Vector3(1.85, 1.95, 0.05), r: 1.45, pitch: 0.3, yaw: 0.42 },
      party: { c: new THREE.Vector3(0.1, 2.2, 2.4), r: 5.4, pitch: 0.22, yaw: 0 },
      giraffe: { c: new THREE.Vector3(-1.1, 3.25, 1.4), r: 3.5, pitch: 0.18, yaw: 0.28 },
    };
    this.view = this.copyView(this.views.street);
    this.cur = this.copyView(this.views.wide);

    this.build();
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas.parentElement ?? canvas);
    this.fit();
    this.loop();
    this.wait(this.reduce ? 0.2 : 0.9, () => this.beginRound(0));
  }

  /* ───────────────────────── Scene ───────────────────────── */

  private build() {
    const s = this.scene;
    s.fog = new THREE.Fog('#f5dfc0', 60, 170);
    s.add(makeSky('#3d9be9', '#ffe2b8', '#f5dfc0'));
    s.add(new THREE.HemisphereLight('#dcefff', '#c99a6e', 0.95));
    const sun = this.sun;
    sun.position.set(8, 15, 11);
    sun.target.position.set(-0.5, 0, 1);
    sun.castShadow = true;
    const sm = this.lowPower ? 1024 : 2048;
    this.renderer.toneMappingExposure = 0.95;
    sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 9, bottom: -8, near: 2, far: 45 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    s.add(sun, sun.target);

    s.add(this.village.group, this.truck.group);
    const z = this.ziggy;
    z.position.copy(TRUCK.ziggy);
    s.add(z);
    for (const id of CUSTOMERS) {
      const c = new Critter(id);
      c.root.visible = false;
      this.critters.set(id, c);
      s.add(c.root);
    }
    // Pigeons: one on the truck roof (the olive thief), two around the square.
    this.thief.group.position.set(1.3, 3.99, 1.15);
    this.thief.group.rotation.y = 0.3;
    this.pigeons.push(this.thief);
    for (const [i, p] of this.village.perches.slice(4, 6).entries()) {
      const pg = new Pigeon();
      pg.group.position.copy(p);
      pg.group.rotation.y = i * 2 + 0.5;
      this.pigeons.push(pg);
    }
    const lamp = new Pigeon();
    lamp.group.position.copy(this.village.perches[0]);
    lamp.group.rotation.y = 0.8;
    this.pigeons.push(lamp);
    for (const p of this.pigeons) s.add(p.group);

    this.pizza.group.position.copy(TRUCK.pizza);
    this.pizza.group.visible = false;
    s.add(this.pizza.group, this.fx.group, this.glowFx.group, this.bubble, this.huh, this.money);
    this.bubble.visible = false;
    this.huh.visible = false;

    // Characters and food catch soft studio reflections; the flat world keeps its own light.
    s.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const x of Array.isArray(m) ? m : m ? [m] : []) if ((x as THREE.MeshStandardMaterial).isMeshStandardMaterial) (x as THREE.MeshStandardMaterial).envMapIntensity = 0.5;
    });
  }

  private copyView(v: View): View {
    return { c: v.c.clone(), r: v.r, pitch: v.pitch, yaw: v.yaw };
  }

  private setView(name: ViewName) {
    const v = this.views[name];
    this.view = this.copyView(v);
    if (this.camera.aspect < 0.8) {
      // Portrait phones: a little closer on the pizza and the oven.
      if (name === 'pizza') this.view.r = 0.9;
      if (name === 'oven') this.view.r = 1.3;
      if (name === 'street') {
        this.view.c.set(-1.35, 2.15, 1.9);
        this.view.r = 2.1;
        this.view.pitch = 0.3;
      }
      if (name === 'giraffe') {
        this.view.c.set(-1.5, 2.9, 1.6);
        this.view.r = 2.4;
      }
      if (name === 'party') {
        this.view.c.set(-0.6, 1.9, 3.0);
        this.view.r = 3.3;
        this.view.pitch = 0.3;
      }
    }
  }

  private fit() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 50 : 40;
    this.applyOffset();
  }

  private applyOffset() {
    const { w, h } = this.size;
    const dy = (this.insets.top - this.insets.bottom) / 2;
    if (Math.abs(dy) > 1) this.camera.setViewOffset(w, h, 0, -dy, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  /** The HUD covers the top and the bottom: frame the action in between (CSS px). */
  setInsets(top: number, bottom: number) {
    if (Math.abs(top - this.insets.top) < 2 && Math.abs(bottom - this.insets.bottom) < 2) return;
    this.insets = { top, bottom };
    this.applyOffset();
  }

  setMusic(on: boolean) {
    if (on) this.audio.startMusic();
    else this.audio.stopMusic();
  }

  private onVisibility = () => {
    this.hidden = document.hidden;
    this.audio.suspend(this.hidden);
  };

  /* ───────────────────────── Scheduling ───────────────────────── */

  private wait(sec: number, fn: () => void) {
    this.tasks.push({ at: this.time + sec, fn });
  }
  private tween(dur: number, fn: (k: number) => void, done?: () => void) {
    this.tweens.push({ t: 0, dur: Math.max(0.001, dur), fn, done });
  }
  private fly(obj: THREE.Object3D, to: THREE.Vector3 | (() => THREE.Vector3), dur: number, opts: { arc?: number; spin?: number; shrink?: number; done?: () => void } = {}) {
    this.flights = this.flights.filter((f) => f.obj !== obj);
    this.flights.push({ obj, from: obj.position.clone(), to, t: 0, dur, arc: opts.arc ?? 0.4, spin: opts.spin ?? 0, shrink: opts.shrink ?? 0, done: opts.done });
  }
  private moveCritter(c: Critter, path: THREE.Vector3[], opts: { speed?: number; endYaw?: number | null; hop?: boolean; done?: () => void } = {}) {
    this.movers.set(c, { path: path.map((p) => p.clone()), speed: opts.speed ?? 2.8, endYaw: opts.endYaw ?? null, hop: opts.hop ?? false, done: opts.done });
  }

  private emit() {
    this.cb.onState({
      round: this.index,
      step: this.step,
      pizza: { counts: { ...this.state.counts }, parts: [...this.state.parts] },
      selected: this.selected,
      coins: [...this.coins],
      served: this.served,
      canUndo: this.step === 'build' ? this.history.length > 0 : this.step === 'pay' ? this.coins.length > 0 : false,
    });
  }

  private say(lines: string[], kind: SayKind, who: Speaker) {
    this.cb.onSay(lines.filter(Boolean), kind, who);
  }

  private get round(): Round {
    return this.rounds[this.index];
  }
  private get critter(): Critter {
    return this.critters.get(this.round.customer)!;
  }
  private get L() {
    return this.opts.locale;
  }

  /* ───────────────────────── A round ───────────────────────── */

  private beginRound(i: number) {
    this.index = i;
    const r = this.round;
    this.step = 'arrive';
    this.state = emptyPizza(r.order);
    this.selected = null;
    this.coins = [];
    this.history = [];
    this.mistakes = 0;
    this.placed = 0;
    this.busy = false;
    this.roundStart = performance.now();
    this.pizza.reset();
    this.pizza.group.visible = false;
    this.pizza.group.position.copy(TRUCK.pizza);
    this.setView(r.customer === 'giraffe' ? 'giraffe' : 'street');
    this.emit();
    const c = this.critter;
    const spot = SPOT[r.customer];
    c.root.visible = true;
    c.root.position.copy(ENTRY);
    c.root.rotation.set(0, Math.PI / 2, 0);
    c.root.scale.setScalar(1);
    c.mood = 'smile';
    c.slide = 0;
    c.dance = false;
    c.lookYaw = 0;
    c.neckTilt = 0.4;
    c.reach = 0;
    this.ziggy.userData.rig.lookAt(-0.9, 0.1);
    const ground = spot.at.clone().setY(0);
    const path = c.small ? [ground.clone().add(new THREE.Vector3(0.3, 0, 1.0))] : [ground];
    this.moveCritter(c, path, {
      endYaw: c.small ? 2.6 : spot.yaw,
      done: () => {
        if (c.small) {
          // Hop onto the crate.
          const from = c.root.position.clone();
          this.audio.whoosh();
          this.tween(
            0.45,
            (k) => {
              c.root.position.lerpVectors(from, spot.at, k);
              c.root.position.y += Math.sin(k * Math.PI) * 0.5;
              c.root.rotation.y = lerpAngle(c.root.rotation.y, spot.yaw, k);
            },
            () => this.arrived()
          );
        } else this.arrived();
      },
    });
  }

  private arrived() {
    const r = this.round;
    const c = this.critter;
    c.root.userData.yaw = SPOT[r.customer].yaw;
    c.lookYaw = SPOT[r.customer].look;
    c.cue('wave');
    c.mood = 'talk';
    this.audio.babble(r.customer, 6);
    if (r.customer === 'elephant') this.audio.toot();
    this.ziggy.userData.rig.cue('wave');
    this.say([helloText(r, this.L)], 'hello', r.customer);
    this.wait(1.6, () => {
      c.mood = 'smile';
      if (r.candy) {
        this.showBubble({ kind: 'candy' });
        c.mood = 'talk';
        this.audio.babble(r.customer, 5);
        this.say([tr(CANDY_ORDER, this.L)], 'gag', r.customer);
        this.wait(2.8, () => {
          c.mood = 'smile';
          this.ziggy.userData.rig.cue('oops');
          this.audio.boing();
          this.say([tr(CANDY_OOPS, this.L)], 'gag', 'ziggy');
          this.showBubble({ kind: 'text', text: '?' });
          this.wait(3.6, () => this.takeOrder());
        });
      } else this.takeOrder();
    });
  }

  private takeOrder() {
    const r = this.round;
    const c = this.critter;
    this.showBubble({ kind: 'order', order: r.order, pictures: this.opts.band !== 'big' });
    c.mood = 'talk';
    this.audio.babble(r.customer, 7);
    this.wait(1.6, () => (c.mood = 'smile'));
    this.say([orderText(r, this.L)], 'order', r.customer);
    this.tossDough(() => {
      this.step = 'build';
      this.hideBubble();
      if (r.order.kind === 'parts') this.pizza.setParts(r.order.parts);
      this.setView('pizza');
      this.ziggy.userData.rig.lookAt(0, -0.7);
      this.emit();
    });
  }

  /** Ziggy juggles the dough, it lands on the counter, the sauce spreads. */
  private tossDough(done: () => void) {
    const pie = this.pizza.pie;
    const rig = this.ziggy.userData.rig;
    this.pizza.group.visible = true;
    this.pizza.sauce.scale.set(0.001, 1, 0.001);
    const tosses = this.reduce ? 1 : 2;
    const h = this.reduce ? 0.45 : 1.15;
    let n = 0;
    const one = () => {
      n++;
      this.audio.whoosh();
      if (n === 1) rig.cue('cheer');
      this.tween(
        0.85,
        (k) => {
          pie.position.y = 0.04 + Math.sin(k * Math.PI) * h;
          pie.rotation.y += 0.25;
          pie.rotation.x = Math.sin(k * Math.PI * 2) * 0.25;
          const sq = 1 + Math.sin(k * Math.PI) * 0.12;
          pie.scale.set(sq, 1, sq);
        },
        () => {
          pie.rotation.x = 0;
          // The dough is round: it lands square to the counter (slices start at 12 o'clock).
          pie.rotation.y = 0;
          if (n < tosses) one();
          else {
            this.audio.splat();
            this.tween(0.3, (k) => pie.scale.set(1 + Math.sin(k * Math.PI) * 0.12, 1 - Math.sin(k * Math.PI) * 0.3, 1 + Math.sin(k * Math.PI) * 0.12));
            this.tween(0.55, (k) => this.pizza.sauce.scale.set(Math.max(0.001, easeOut(k)), 1, Math.max(0.001, easeOut(k))), done);
          }
        }
      );
    };
    one();
  }

  /* ───────────────────────── Building (called from the HUD) ───────────────────────── */

  /** A topping button: picks it, and (count orders) drops one piece. */
  chooseTopping(t: ToppingId) {
    if (this.step !== 'build' || this.busy) return;
    this.selected = t;
    if (this.round.order.kind === 'count') this.addPiece(t);
    else this.emit();
  }

  /** A slice button (fraction orders). */
  toggleSlice(i: number) {
    if (this.step !== 'build' || this.busy || this.round.order.kind !== 'parts') return;
    if (!this.selected) {
      this.say([tr(PICK_FIRST, this.L)], 'hint', 'ziggy');
      return;
    }
    const prev = this.state.parts[i] ?? null;
    this.history.push({ kind: 'slice', i, prev });
    this.setSlice(i, prev === this.selected ? null : this.selected);
    this.emit();
  }

  highlightSlice(i: number) {
    this.pizza.highlight(i);
  }

  undo() {
    if (this.busy) return;
    if (this.step === 'pay') {
      const v = this.coins.pop();
      const m = this.coinMeshes.pop();
      if (m) this.money.remove(m);
      if (v !== undefined) this.audio.plop(0);
      this.emit();
      return;
    }
    if (this.step !== 'build') return;
    const a = this.history.pop();
    if (!a) return;
    if (a.kind === 'piece') {
      this.pizza.remove(a.piece);
      this.state = { ...this.state, counts: { ...this.state.counts, [a.piece.topping]: Math.max(0, (this.state.counts[a.piece.topping] ?? 0) - 1) } };
      this.puff(this.pieceWorld(a.piece.mesh.position), '#ffffff');
    } else this.setSlice(a.i, a.prev);
    this.audio.plop(0);
    this.emit();
  }

  private pieceWorld(local: THREE.Vector3) {
    return this.pizza.toppings.localToWorld(local.clone());
  }

  private addPiece(t: ToppingId, at?: THREE.Vector3) {
    const r = this.round;
    const spot = this.pizza.freeSpot(at);
    const piece = this.pizza.add(t, spot);
    this.history.push({ kind: 'piece', piece });
    this.state = { ...this.state, counts: { ...this.state.counts, [t]: (this.state.counts[t] ?? 0) + 1 } };
    this.dropIn(piece.mesh, t);
    const n = this.state.counts[t] ?? 0;
    const want = wanted(r.order);
    if (want.has(t)) this.cb.onCount(n, t);
    this.audio.plop(this.placed++);
    if (!this.ziggy.userData.rig.busy && this.placed % 2 === 0) this.ziggy.userData.rig.cue('nod');
    this.emit();
    // The pigeon's moment: it pinches the olive that completes the order.
    if (r.pigeon && !this.pigeonDone && t === 'olive' && n === want.get('olive')) {
      this.wait(0.5, () => this.pigeonSteal(piece));
      return;
    }
    if (!r.autoFinish) return;
    // Little ones: feedback at once.
    if (!want.has(t)) {
      this.busy = true;
      this.wait(0.45, () => {
        this.mistakes++;
        this.surprise();
        this.say([hintText(r, { kind: 'wrong', topping: t }, this.L)], 'hint', 'ziggy');
        this.removeTopping(t);
        this.busy = false;
        this.emit();
      });
      return;
    }
    if (n > (want.get(t) ?? 0)) {
      this.busy = true;
      this.wait(0.4, () => {
        this.mistakes++;
        this.gobble(piece);
        this.say([gobbleText(r, t, this.L)], 'hint', 'ziggy');
        this.busy = false;
        this.emit();
      });
      return;
    }
    if (!checkPizza(r.order, this.state)) {
      this.busy = true;
      this.wait(0.7, () => {
        this.busy = false;
        this.goOven();
      });
    }
  }

  /** A piece drops from its bowl onto the pizza. */
  private dropIn(mesh: THREE.Mesh, t: ToppingId) {
    const target = mesh.position.clone();
    const bowl = this.truck.bowls.get(t);
    const from = bowl ? this.pizza.toppings.worldToLocal(bowl.clone()) : target.clone().add(new THREE.Vector3(0, 0.8, 0));
    mesh.position.copy(from);
    this.fly(mesh, target, this.reduce ? 0.2 : 0.38, {
      arc: 0.35,
      spin: 4,
      done: () => {
        this.tween(0.18, (k) => mesh.scale.set(1 + Math.sin(k * Math.PI) * 0.35, 1 - Math.sin(k * Math.PI) * 0.4, 1 + Math.sin(k * Math.PI) * 0.35));
        this.glowFx.emit(this.pieceWorld(target).add(new THREE.Vector3(0, 0.05, 0)), { tex: starTexture(), color: ['#fff3a0', '#ffffff'], count: this.lowPower ? 2 : 4, spread: 0.6, up: 0.6, life: 0.45, size: 0.12, additive: true });
      },
    });
  }

  private setSlice(i: number, t: ToppingId | null) {
    for (const p of this.pizza.pieces.filter((x) => x.slice === i)) this.pizza.remove(p);
    this.state = { ...this.state, parts: this.state.parts.map((x, k) => (k === i ? t : x)) };
    if (!t) {
      this.audio.plop(0);
      return;
    }
    const pts = this.pizza.slicePoints(i);
    pts.forEach((p, k) => {
      const piece = this.pizza.add(t, p, i);
      const target = piece.mesh.position.clone();
      piece.mesh.position.y += 0.6;
      piece.mesh.scale.setScalar(0.01);
      this.wait(k * 0.05, () => {
        this.tween(0.25, (q) => {
          piece.mesh.position.y = target.y + (1 - easeOut(q)) * 0.6;
          piece.mesh.scale.setScalar(Math.max(0.01, easeOut(q)));
        });
      });
    });
    this.audio.plop(this.placed++);
    // The pigeon, on a fraction pizza: it takes one olive, Ziggy puts another.
    const r = this.round;
    if (r.pigeon && !this.pigeonDone && t === 'olive') {
      const piece = this.pizza.pieces.filter((x) => x.slice === i).at(-1);
      if (piece) this.wait(0.6, () => this.pigeonSteal(piece));
    }
  }

  /** Tap on the pizza (touch / mouse). */
  private tapPizza(world: THREE.Vector3) {
    const local = this.pizza.pie.worldToLocal(world.clone());
    if (this.round.order.kind === 'parts') {
      const i = this.pizza.sliceAt(local);
      if (i >= 0) this.toggleSlice(i);
      return;
    }
    if (!this.selected) {
      this.say([tr(PICK_FIRST, this.L)], 'hint', 'ziggy');
      return;
    }
    if (this.busy) return;
    this.addPiece(this.selected, local.setY(0));
  }

  private removeTopping(t: ToppingId) {
    for (const p of this.pizza.pieces.filter((x) => x.topping === t)) {
      const bowl = this.truck.bowls.get(t);
      const mesh = p.mesh;
      const world = this.pieceWorld(mesh.position);
      this.pizza.remove(p);
      this.scene.add(mesh);
      mesh.position.copy(world);
      if (bowl) this.fly(mesh, bowl, 0.45, { arc: 0.4, spin: 6, done: () => this.scene.remove(mesh) });
      else this.scene.remove(mesh);
    }
    this.history = this.history.filter((a) => a.kind !== 'piece' || a.piece.topping !== t);
    if (this.round.order.kind === 'parts') this.state = { ...this.state, parts: this.state.parts.map((x) => (x === t ? null : x)) };
    this.state = { ...this.state, counts: { ...this.state.counts, [t]: 0 } };
  }

  /** One too many: Ziggy gobbles it up. */
  private gobble(piece: Piece) {
    const mesh = piece.mesh;
    const t = piece.topping;
    const world = this.pieceWorld(mesh.position);
    this.pizza.remove(piece);
    this.history = this.history.filter((a) => a.kind !== 'piece' || a.piece !== piece);
    this.state = { ...this.state, counts: { ...this.state.counts, [t]: Math.max(0, (this.state.counts[t] ?? 0) - 1) } };
    this.scene.add(mesh);
    mesh.position.copy(world);
    const rig = this.ziggy.userData.rig;
    const mouth = () => this.ziggy.userData.model.mouth.getWorldPosition(new THREE.Vector3());
    rig.lookAt(0, -0.2);
    this.fly(mesh, mouth, 0.5, {
      arc: 0.3,
      shrink: 1,
      done: () => {
        this.scene.remove(mesh);
        rig.cue('giggle');
        this.audio.munch(2);
        this.hearts(mouth(), 3);
        rig.lookAt(0, -0.7);
      },
    });
  }

  private pigeonSteal(piece: Piece) {
    if (this.pigeonDone) return;
    this.pigeonDone = true;
    this.busy = true;
    const p = this.thief;
    const home = p.group.position.clone();
    const r = this.round;
    p.flying = true;
    this.audio.coo();
    const above = this.pieceWorld(piece.mesh.position).add(new THREE.Vector3(0, 0.25, 0));
    p.group.lookAt(above.x, p.group.position.y, above.z);
    this.fly(p.group, above, 0.9, {
      arc: 0.6,
      done: () => {
        // Grab the olive.
        const mesh = piece.mesh;
        this.pizza.remove(piece);
        this.history = this.history.filter((a) => a.kind !== 'piece' || a.piece !== piece);
        if (r.order.kind === 'count') this.state = { ...this.state, counts: { ...this.state.counts, olive: Math.max(0, (this.state.counts.olive ?? 0) - 1) } };
        p.beak.add(mesh);
        mesh.position.set(0, -0.03, 0.04);
        mesh.scale.setScalar(0.8);
        this.ziggy.userData.rig.cue('oops');
        this.say([pigeonText(r, this.L)], 'gag', 'ziggy');
        this.emit();
        const away = new THREE.Vector3(-14, 7, -12);
        p.group.lookAt(away.x, p.group.position.y, away.z);
        this.fly(p.group, away, 2.2, {
          arc: 1.5,
          done: () => {
            p.beak.remove(mesh);
            // The pigeon comes back to the roof, a bit later, happy.
            p.group.position.set(8, 9, -10);
            this.fly(p.group, home, 2.5, {
              arc: 1,
              done: () => {
                p.flying = false;
                p.group.rotation.set(0, 0.3, 0);
              },
            });
          },
        });
        this.wait(0.5, () => {
          this.busy = false;
          // On a fraction pizza, Ziggy simply puts another olive.
          if (r.order.kind === 'parts' && piece.slice >= 0 && this.state.parts[piece.slice] === 'olive') {
            const np = this.pizza.add('olive', this.pizza.slicePoints(piece.slice)[0], piece.slice);
            this.dropIn(np.mesh, 'olive');
            this.ziggy.userData.rig.cue('giggle');
          }
          this.emit();
        });
      },
    });
  }

  /** "Bake it!" */
  bake() {
    if (this.step !== 'build' || this.busy) return;
    const r = this.round;
    const issue = checkPizza(r.order, this.state);
    if (!issue) {
      this.goOven();
      return;
    }
    this.mistakes++;
    this.surprise();
    this.say([hintText(r, issue, this.L)], 'hint', 'ziggy');
    if (issue.kind === 'wrong') {
      this.busy = true;
      this.wait(0.8, () => {
        this.removeTopping(issue.topping);
        this.busy = false;
        this.emit();
      });
    }
  }

  /** The customer's funny "oh?" face, and Ziggy's shrug. */
  private surprise() {
    const c = this.critter;
    c.cue('surprise');
    this.huhT = 1.4;
    this.audio.boing();
    this.ziggy.userData.rig.cue('oops');
    this.cb.onReact('surprised');
  }

  /* ───────────────────────── Oven ───────────────────────── */

  private goOven() {
    const r = this.round;
    this.step = 'bake';
    this.busy = true;
    this.selected = null;
    this.pizza.highlight(-1);
    this.emit();
    this.audio.yay();
    this.say([praiseFor(this.index + this.served, this.L)], 'praise', 'ziggy');
    this.cb.onReact('happy');
    this.hideBubble();
    const rig = this.ziggy.userData.rig;
    rig.cue('cheer');
    this.wait(this.reduce ? 0.4 : 1.1, () => {
      this.zig.carry = true;
      rig.carrying = true;
      this.setView('oven');
      this.walkZiggy(TRUCK.ziggyOven, () => {
        this.zig.yawWant = Math.atan2(TRUCK.oven.x - this.zig.pos.x, TRUCK.oven.z - this.zig.pos.z);
        this.wait(0.35, () => {
          this.zig.carry = false;
          rig.carrying = false;
          this.audio.whoosh();
          this.fly(this.pizza.group, TRUCK.ovenInside.clone().setY(TRUCK.ovenInside.y - 0.08), 0.6, {
            arc: 0.15,
            done: () => {
              this.pizza.group.visible = false;
              this.ovenWant = 1;
              this.timerSpin = true;
              this.audio.crackleOn(true);
              this.zig.yawWant = 0;
              if (r.ask) {
                this.wait(0.7, () => {
                  this.step = 'ask';
                  this.busy = false;
                  this.say([askText(r, this.L)], 'ask', 'ziggy');
                  rig.cue('think');
                  this.emit();
                });
              } else this.wait(this.reduce ? 1.6 : 2.6, () => this.dingOut());
            },
          });
        });
      });
    });
  }

  /** Middle band: the sum asked while the pizza bakes. */
  answerSum(n: number) {
    const r = this.round;
    if (this.step !== 'ask' || this.busy || !r.ask) return;
    if (checkSum(r.ask, n)) {
      this.busy = true;
      this.step = 'bake';
      this.audio.yay();
      this.ziggy.userData.rig.cue('cheer');
      this.say([praiseFor(this.index + 2, this.L)], 'praise', 'ziggy');
      this.emit();
      this.wait(1.2, () => this.dingOut());
    } else {
      this.mistakes++;
      this.audio.boing();
      this.ziggy.userData.rig.cue('think');
      this.say([askHint(r, this.L)], 'hint', 'ziggy');
    }
  }

  private dingOut() {
    const rig = this.ziggy.userData.rig;
    this.step = 'bake';
    this.busy = true;
    this.audio.ding();
    this.audio.crackleOn(false);
    this.timerSpin = false;
    this.ovenWant = 0.25;
    const timer = this.truck.timer;
    const y0 = timer.position.y;
    this.tween(0.5, (k) => {
      timer.position.y = y0 + Math.sin(k * Math.PI) * 0.18;
      timer.rotation.z = Math.sin(k * Math.PI * 4) * 0.25 * (1 - k);
    });
    this.glowFx.emit(timer.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0)), { tex: starTexture(), color: ['#fff3a0', '#ffd166'], count: 10, spread: 1, up: 1.2, life: 0.8, size: 0.2, additive: true });
    rig.cue('jump');
    this.zig.yawWant = Math.atan2(TRUCK.oven.x - this.zig.pos.x, TRUCK.oven.z - this.zig.pos.z);
    this.wait(0.6, () => {
      const p = this.pizza;
      p.setBake(1);
      p.group.visible = true;
      p.group.position.copy(TRUCK.ovenInside);
      this.fly(p.group, () => this.carryPoint(), 0.5, {
        arc: 0.15,
        done: () => {
          this.zig.carry = true;
          rig.carrying = true;
          this.steam(4);
          this.zig.yawWant = 0;
          this.walkZiggy(TRUCK.ziggy, () => {
            this.zig.carry = false;
            rig.carrying = false;
            this.fly(p.group, TRUCK.pizza, 0.35, {
              arc: 0.1,
              done: () => {
                this.steam(6);
                if (this.round.pay) this.startPay();
                else this.serve();
              },
            });
          });
        },
      });
    });
  }

  private carryPoint(): THREE.Vector3 {
    // Held out in front, at arm's length (the peel is big for a little plush).
    const fwd = new THREE.Vector3(Math.sin(this.zig.yaw), 0, Math.cos(this.zig.yaw)).multiplyScalar(0.45);
    return this.ziggy.userData.model.carry.getWorldPosition(new THREE.Vector3()).add(fwd).add(new THREE.Vector3(0, -0.12, 0));
  }

  private walkZiggy(to: THREE.Vector3, done: () => void) {
    this.zig.target = to.clone();
    this.zig.onArrive = done;
  }

  /* ───────────────────────── Paying (big band) ───────────────────────── */

  private startPay() {
    const r = this.round;
    const pay = r.pay!;
    this.step = 'pay';
    this.busy = false;
    this.setView(r.customer === 'giraffe' ? 'giraffe' : 'street');
    this.showBubble({ kind: 'money', price: pay.price, paid: pay.paid });
    const note = makeMoney(pay.paid);
    this.envify(note);
    note.position.copy(this.critter.mouth.getWorldPosition(new THREE.Vector3()));
    this.money.add(note);
    this.note = note;
    this.fly(note, new THREE.Vector3(-0.85, TRUCK.counterY + 0.02, 1.85), 0.8, { arc: 0.5, spin: 3, done: () => (note.rotation.set(0, 0.2, 0), this.audio.coin()) });
    this.critter.mood = 'talk';
    this.wait(1.2, () => (this.critter.mood = 'smile'));
    this.say([payText(r, this.L)], 'pay', 'ziggy');
    this.emit();
  }

  addCoin(v: number) {
    if (this.step !== 'pay' || this.busy) return;
    if (this.coins.length >= 12) return;
    this.coins.push(v);
    const m = makeMoney(v);
    this.envify(m);
    const i = this.coinMeshes.length;
    const at = new THREE.Vector3(-0.15 + (i % 4) * 0.25, TRUCK.counterY + 0.01 + Math.floor(i / 4) * 0.025, 1.78 + Math.floor(i / 4) * 0.03);
    m.position.copy(at).add(new THREE.Vector3(0, 0.5, -0.4));
    this.money.add(m);
    this.coinMeshes.push(m);
    this.fly(m, at, 0.3, { arc: 0.2, spin: 8, done: () => m.rotation.set(0, 0, 0) });
    this.audio.coin();
    this.emit();
  }

  giveChange() {
    if (this.step !== 'pay' || this.busy) return;
    const r = this.round;
    const res = checkChange(r.pay!, this.coins);
    if (res === 'ok') {
      this.busy = true;
      this.audio.yay();
      this.ziggy.userData.rig.cue('cheer');
      this.say([praiseFor(this.index + 3, this.L)], 'praise', 'ziggy');
      const hand = this.critter.mouth.getWorldPosition(new THREE.Vector3());
      this.coinMeshes.forEach((m, i) => this.wait(i * 0.08, () => this.fly(m, hand, 0.5, { arc: 0.4, shrink: 1, spin: 6, done: () => this.money.remove(m) })));
      if (this.note) {
        const n = this.note;
        this.fly(n, new THREE.Vector3(-1.2, 1.2, 0.2), 0.6, { arc: 0.3, shrink: 1, done: () => this.money.remove(n) });
      }
      this.coinMeshes = [];
      this.note = null;
      this.wait(0.9, () => this.serve());
    } else {
      this.mistakes++;
      this.critter.cue('surprise');
      this.huhT = 1.2;
      this.audio.boing();
      this.cb.onReact('surprised');
      this.say([payHint(r, this.coins, this.L)], 'hint', 'ziggy');
    }
  }

  /* ───────────────────────── Serving & eating ───────────────────────── */

  private serve() {
    const r = this.round;
    const c = this.critter;
    this.step = 'eat';
    this.busy = true;
    this.hideBubble();
    this.setView(r.customer === 'giraffe' ? 'giraffe' : 'street');
    this.emit();
    const p = this.pizza.group;
    const mouth = () => c.mouth.getWorldPosition(new THREE.Vector3());
    const yum = () => {
      c.cue('joy');
      this.audio.yay();
      this.hearts(mouth().add(new THREE.Vector3(0, 0.3, 0)), this.lowPower ? 6 : 12);
      this.cb.onReact('happy');
      const first = r.order.items[0].topping;
      this.say([tr(CUSTOMER_INFO[r.customer].yum, this.L), tr(TOPPING_INFO[first].fact, this.L)], 'yum', r.customer);
      this.ziggy.userData.rig.cue('love');
      this.served++;
      const steps = stepsOf(r);
      this.cb.onRoundDone(r, { correct: steps, mistakes: this.mistakes, total: steps }, performance.now() - this.roundStart);
      this.emit();
      this.wait(2.6, () => this.leave());
    };
    const eatNormal = (style: 'gulp' | 'nibble' | 'beak') => {
      this.fly(p, TRUCK.serve, 0.6, {
        arc: 0.05,
        done: () => {
          c.lookYaw = 0;
          if (style === 'nibble') {
            c.mood = 'chew';
            let k = 0;
            const bite = () => {
              k++;
              this.audio.munch(1);
              p.scale.multiplyScalar(0.72);
              this.crumbs(TRUCK.serve.clone().add(new THREE.Vector3(0, 0.2, 0)));
              if (k < 5) this.wait(0.32, bite);
              else {
                p.visible = false;
                this.wait(0.4, () => {
                  c.mood = 'smile';
                  yum();
                });
              }
            };
            bite();
            return;
          }
          if (style === 'beak') {
            c.cue('fan');
            this.steam(8);
            this.audio.babble(r.customer, 3);
          }
          this.wait(style === 'beak' ? 1.4 : 0.3, () =>
            this.fly(p, mouth, 0.55, {
              arc: 0.5,
              shrink: 1,
              spin: 4,
              done: () => {
                p.visible = false;
                p.scale.setScalar(1);
                c.cue('gulp');
                c.mood = 'chew';
                this.audio.gulp();
                this.audio.munch(3);
                this.wait(1.0, () => {
                  c.mood = 'smile';
                  yum();
                });
              },
            })
          );
        },
      });
    };
    switch (r.customer) {
      case 'bear':
        eatNormal('gulp');
        break;
      case 'rabbit':
        eatNormal('nibble');
        break;
      case 'penguin':
        eatNormal('beak');
        break;
      case 'elephant': {
        this.fly(p, TRUCK.serve, 0.6, {
          arc: 0.05,
          done: () => {
            this.tween(0.6, (k) => (c.reach = easeInOut(k)));
            this.wait(0.7, () => {
              this.audio.slurp();
              this.fly(p, mouth, 0.9, {
                arc: 0.2,
                shrink: 1,
                spin: 14,
                done: () => {
                  p.visible = false;
                  p.scale.setScalar(1);
                  this.tween(0.6, (k) => (c.reach = 1 - easeInOut(k)));
                  c.mood = 'chew';
                  this.glowFx.emit(mouth(), { tex: starTexture(), color: ['#fff3a0', '#ffffff', '#ffb35c'], count: 12, spread: 1.4, up: 1.6, life: 0.9, size: 0.18, additive: true });
                  this.wait(0.9, () => {
                    c.mood = 'smile';
                    yum();
                  });
                },
              });
            });
          },
        });
        break;
      }
      case 'giraffe': {
        // Gina eats through the roof: the hatch opens, the pizza pops up.
        const hatch = this.truck.hatch;
        this.audio.whoosh();
        this.tween(0.5, (k) => (hatch.rotation.x = -easeOut(k) * 1.9));
        this.tween(1.2, (k) => {
          c.neckTilt = 0.4 + easeInOut(k) * 0.42;
          c.lookYaw = -1.05 + easeInOut(k) * 0.75;
          c.root.position.x = SPOT.giraffe.at.x + easeInOut(k) * 0.9;
        });
        this.ziggy.userData.rig.cue('cheer');
        this.wait(0.55, () => {
          const up = TRUCK.hatch.clone().add(new THREE.Vector3(0, 0.7, 0));
          this.fly(p, up, 0.6, {
            arc: 0.1,
            spin: 6,
            done: () =>
              this.fly(p, mouth, 0.55, {
                arc: 0.4,
                shrink: 1,
                done: () => {
                  p.visible = false;
                  p.scale.setScalar(1);
                  c.mood = 'chew';
                  this.audio.munch(4);
                  this.tween(0.5, (k) => (hatch.rotation.x = -1.9 * (1 - k)));
                  this.wait(1.2, () => {
                    c.mood = 'smile';
                    this.tween(1.0, (k) => {
                      c.neckTilt = 0.82 - easeInOut(k) * 0.42;
                      c.lookYaw = -0.3 - easeInOut(k) * 0.75;
                      c.root.position.x = SPOT.giraffe.at.x + 0.9 * (1 - easeInOut(k));
                    });
                    yum();
                  });
                },
              }),
          });
        });
        break;
      }
    }
  }

  private leave() {
    const r = this.round;
    const c = this.critter;
    c.cue('spin');
    this.wait(0.9, () => {
      const go = () => {
        const exitPath = [new THREE.Vector3(-0.8, 0, 4.6), EXIT];
        if (r.customer === 'penguin' && !this.reduce) {
          c.slide = 1;
          this.moveCritter(c, exitPath, { speed: 6, done: () => this.next() });
        } else this.moveCritter(c, exitPath, { speed: 3.2, done: () => this.next() });
      };
      if (c.small) {
        const from = c.root.position.clone();
        const to = from.clone().add(new THREE.Vector3(0.6, 0, 0.9)).setY(0);
        this.tween(0.4, (k) => {
          c.root.position.lerpVectors(from, to, k);
          c.root.position.y += Math.sin(k * Math.PI) * 0.4;
        }, go);
      } else go();
    });
    // The next customer can start walking in while this one leaves.
  }

  private next() {
    const c = this.critter;
    c.root.visible = false;
    c.slide = 0;
    if (this.index + 1 < this.rounds.length) this.beginRound(this.index + 1);
    else this.party();
  }

  /* ───────────────────────── The party ───────────────────────── */

  private party() {
    this.step = 'party';
    this.setView('party');
    this.emit();
    const rig = this.ziggy.userData.rig;
    rig.idle = 'dance';
    rig.cue('cheer');
    this.audio.fanfare();
    this.partyT = this.reduce ? 2 : 7;
    this.say([tr(FINALE, this.L)], 'finale', 'ziggy');
    let k = 0;
    for (const id of CUSTOMERS) {
      const c = this.critters.get(id)!;
      const sp = SPOT[id];
      c.root.visible = true;
      c.mood = 'smile';
      c.slide = 0;
      c.neckTilt = 0.4;
      c.lookYaw = id === 'giraffe' ? -0.9 : 0;
      c.root.position.copy(id === 'giraffe' || id === 'elephant' ? ENTRY : EXIT.clone().setX(EXIT.x - 2));
      const delay = k++ * 0.35;
      this.wait(delay, () =>
        this.moveCritter(c, [sp.party], {
          speed: 4,
          endYaw: id === 'giraffe' ? Math.PI / 2 : 0,
          done: () => {
            c.dance = !this.reduce;
            c.cue('joy');
          },
        })
      );
    }
    this.wait(this.reduce ? 2.5 : 4.5, () => {
      this.step = 'done';
      this.emit();
      this.cb.onFinish();
    });
  }

  /* ───────────────────────── Bubbles & effects ───────────────────────── */

  private showBubble(b: BubbleKind) {
    const m = this.bubble.material as THREE.SpriteMaterial;
    m.map?.dispose();
    m.map = bubbleTexture(b);
    m.needsUpdate = true;
    this.bubble.visible = true;
    this.bubbleK = 0;
    this.bubbleWant = 1;
  }
  private hideBubble() {
    this.bubbleWant = 0;
  }

  private hearts(at: THREE.Vector3, n: number) {
    this.fx.emit(at, { tex: heartTexture(), count: n, spread: 1.4, up: 1.4, life: 1.6, size: 0.32, gravity: -0.3 });
  }
  private steam(n: number) {
    if (this.lowPower) n = Math.ceil(n / 2);
    const at = this.pizza.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0));
    this.fx.emit(at, { tex: dotTexture(), color: '#ffffff', count: n, spread: 0.6, up: 0.9, life: 1.6, size: 0.35, grow: 2, opacity: 0.6 });
  }
  private crumbs(at: THREE.Vector3) {
    this.fx.emit(at, { tex: dotTexture(), color: ['#f2c27a', '#e0412f', '#fff3d6'], count: 6, spread: 1.2, up: 1.2, life: 0.7, size: 0.1, gravity: 4 });
  }
  private puff(at: THREE.Vector3, color: string) {
    this.fx.emit(at, { tex: dotTexture(), color, count: 5, spread: 0.6, up: 0.5, life: 0.5, size: 0.15, grow: 1, opacity: 0.8 });
  }
  private confetti() {
    const cols = ['#ff5c8a', '#ffd166', '#4cc9b7', '#7fb3ef', '#9bf07f', '#c99bff', '#ff8a5c'];
    const at = new THREE.Vector3((Math.random() - 0.5) * 8, 6 + Math.random() * 1.5, 1.5 + Math.random() * 3);
    this.fx.emit(at, { tex: confettiTexture(), color: cols, count: this.lowPower ? 10 : 22, spread: 4, up: 1.5, life: 3, size: 0.16, gravity: 1.8, spin: 10 });
  }

  private envify(o: THREE.Object3D) {
    o.traverse((x) => {
      const m = (x as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.isMeshStandardMaterial) m.envMapIntensity = 0.5;
    });
  }

  /* ───────────────────────── Input ───────────────────────── */

  private pick(e: PointerEvent): THREE.Intersection | null {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const objs: THREE.Object3D[] = [this.pizza.hit, this.ziggy, ...this.pigeons.map((p) => p.group)];
    if (this.index >= 0) objs.push(this.critter.root);
    const hit = this.ray.intersectObjects(objs, true).find((h) => h.object.visible !== false || h.object === this.pizza.hit);
    return hit ?? null;
  }

  private owner(o: THREE.Object3D): 'pizza' | 'ziggy' | 'critter' | Pigeon | null {
    for (let x: THREE.Object3D | null = o; x; x = x.parent) {
      if (x === this.pizza.hit) return 'pizza';
      if (x === this.ziggy) return 'ziggy';
      if (this.index >= 0 && x === this.critter.root) return 'critter';
      const pg = this.pigeons.find((p) => p.group === x);
      if (pg) return pg;
    }
    return null;
  }

  private onDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY };
  };

  private onMove = (e: PointerEvent) => {
    if (this.step !== 'build' || this.round?.order.kind !== 'parts' || e.pointerType === 'touch') return;
    const h = this.pick(e);
    if (h && this.owner(h.object) === 'pizza') this.pizza.highlight(this.pizza.sliceAt(this.pizza.pie.worldToLocal(h.point.clone())));
    else this.pizza.highlight(-1);
  };

  private onUp = (e: PointerEvent) => {
    const d = this.pointerDown;
    this.pointerDown = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 16) return;
    const h = this.pick(e);
    if (!h) return;
    const who = this.owner(h.object);
    if (who === 'pizza') {
      if (this.step === 'build' && this.pizza.group.visible) this.tapPizza(h.point);
    } else if (who === 'ziggy') {
      this.ziggy.userData.rig.cue('giggle');
      this.audio.babble('ziggy', 4);
    } else if (who === 'critter') {
      if (!this.critter.busy && !this.movers.has(this.critter)) this.critter.cue('hop');
      this.audio.babble(this.round.customer, 3);
    } else if (who instanceof Pigeon && !who.flying) {
      this.audio.coo();
      const g = who.group;
      const y0 = g.position.y;
      this.tween(0.5, (k) => (g.position.y = y0 + Math.sin(k * Math.PI) * 0.4));
    }
  };

  /** "Coucou" button (and TV): Ziggy and the customer wave. */
  hello() {
    this.ziggy.userData.rig.cue('giggle');
    this.audio.babble('ziggy', 4);
    if (this.index >= 0 && this.critter.root.visible && !this.critter.busy && !this.movers.has(this.critter)) this.critter.cue('hop');
  }

  /* ───────────────────────── Loop ───────────────────────── */

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    if (this.hidden || this.paused) return;
    const dt = Math.min(0.1, raw) * this.timeScale;
    this.time += dt;
    this.step3(dt, this.time);
    this.post.render(dt);
    this.adaptResolution(raw);
  };

  /** Weak device: lower the internal resolution step by step (never below 0.55). */
  private adaptResolution(raw: number) {
    const p = this.perf;
    p.frames++;
    p.time += Math.min(raw, 0.25);
    if (p.time < 2.5) return;
    const fps = p.frames / p.time;
    p.frames = 0;
    p.time = 0;
    if (!p.ratio) p.ratio = this.renderer.getPixelRatio();
    if (fps < 24 && p.ratio > 0.56) {
      p.ratio = Math.max(0.55, p.ratio - 0.15);
      this.renderer.setPixelRatio(p.ratio);
      this.fit();
      // Draw at once: resizing clears the canvas.
      this.post.render(0);
    }
  }

  private step3(dt: number, t: number) {
    const E = this.reduce ? 0.35 : 1;
    // Timed tasks and tweens.
    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      if (task.at <= t) {
        this.tasks.splice(i--, 1);
        task.fn();
      }
    }
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      tw.fn(tw.t);
      if (tw.t >= 1) {
        this.tweens.splice(i, 1);
        tw.done?.();
      }
    }
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = easeInOut(f.t);
      const to = typeof f.to === 'function' ? f.to() : f.to;
      f.obj.position.lerpVectors(f.from, to, e);
      f.obj.position.y += Math.sin(f.t * Math.PI) * f.arc;
      if (f.spin) f.obj.rotation.y += dt * f.spin;
      if (f.shrink) f.obj.scale.setScalar(Math.max(0.01, 1 - f.shrink * f.t * f.t));
      if (f.t >= 1) {
        this.flights.splice(i, 1);
        f.done?.();
      }
    }

    // Customers walking.
    for (const [c, m] of this.movers) {
      const target = m.path[0];
      const pos = c.root.position;
      const d = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
      const dist = d.length();
      if (dist < 0.05) {
        m.path.shift();
        if (!m.path.length) {
          this.movers.delete(c);
          c.walk = 0;
          if (m.endYaw !== null) c.root.userData.yaw = m.endYaw;
          m.done?.();
        }
        continue;
      }
      c.walk = c.slide > 0 ? 0 : 1;
      pos.addScaledVector(d.normalize(), Math.min(dist, m.speed * dt));
      c.root.userData.yaw = Math.atan2(d.x, d.z);
    }
    for (const c of this.critters.values()) {
      if (!c.root.visible) continue;
      if (c.root.userData.yaw !== undefined) c.root.rotation.y = lerpAngle(c.root.rotation.y, c.root.userData.yaw as number, Math.min(1, dt * 8));
      c.update(dt, t, E);
    }

    // Ziggy.
    const z = this.zig;
    const rig = this.ziggy.userData.rig;
    if (z.target) {
      const d = z.target.clone().sub(z.pos).setY(0);
      const dist = d.length();
      if (dist < 0.03) {
        z.pos.copy(z.target);
        z.target = null;
        rig.walk = 0;
        z.yawWant = 0;
        const fn = z.onArrive;
        z.onArrive = null;
        fn?.();
      } else {
        rig.walk = 1;
        z.pos.addScaledVector(d.normalize(), Math.min(dist, 2.0 * dt));
        z.yawWant = Math.atan2(d.x, d.z);
      }
    }
    z.yaw = lerpAngle(z.yaw, z.yawWant, Math.min(1, dt * 8));
    this.ziggy.position.copy(z.pos);
    this.ziggy.rotation.y = z.yaw;
    rig.update(dt);
    if (z.carry) this.pizza.group.position.copy(this.carryPoint());

    // Pigeons, pizza, bubble, oven, timer, lights.
    for (const p of this.pigeons) p.update(dt, t, E);
    this.pizza.update(t);
    if (this.index >= 0 && this.bubble.visible) {
      const c = this.critter;
      const top = c.top.getWorldPosition(new THREE.Vector3());
      this.bubbleK += (this.bubbleWant - this.bubbleK) * Math.min(1, dt * 9);
      const s = this.bubbleK * (1 + Math.sin(t * 2.4) * 0.02 * E);
      this.bubble.scale.set(1.55 * s, 1.03 * s, 1);
      this.bubble.position.copy(top).add(new THREE.Vector3(0.75, 0.55, 0.1));
      if (this.bubbleWant === 0 && this.bubbleK < 0.02) this.bubble.visible = false;
    }
    if (this.huhT > 0 && this.index >= 0) {
      this.huhT -= dt;
      this.huh.visible = true;
      this.huh.position.copy(this.critter.top.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(-0.35, 0.15, 0.2));
      this.huh.scale.setScalar(0.7 * Math.min(1, (1.4 - this.huhT) * 6, this.huhT * 4));
    } else this.huh.visible = false;
    this.ovenHeat += (this.ovenWant - this.ovenHeat) * Math.min(1, dt * 2);
    const heat = this.ovenHeat;
    this.truck.flames.forEach((f, i) => {
      const ph = f.userData.phase as number;
      const fl = 0.6 + Math.sin(t * 13 + ph) * 0.18 + Math.sin(t * 7.3 + ph * 2) * 0.12;
      f.scale.set(0.8 + heat * 0.4, (0.5 + heat * 1.1) * fl, 0.8 + heat * 0.4);
      f.position.y = (f.userData.base as THREE.Vector3).y + f.scale.y * 0.1 - 0.05;
      f.rotation.z = Math.sin(t * 5 + i) * 0.15;
    });
    (this.truck.ovenGlow.material as THREE.SpriteMaterial).opacity = 0.35 + heat * 0.45 + Math.sin(t * 9) * 0.05;
    this.truck.ovenGlow.scale.setScalar(1.3 + heat * 0.9);
    this.truck.ovenLight.intensity = 2 + heat * 7 + Math.sin(t * 11) * 0.6;
    if (this.timerSpin) {
      this.truck.timerHand.rotation.z -= dt * 2.4;
      if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) this.audio.tick();
    }
    this.truck.spinner.rotation.y += dt * 0.9 * E;
    // The awning lifts like a serving hatch when the camera comes close.
    const lift = this.step === 'build' ? 1 : 0;
    this.awningLift += (lift - this.awningLift) * Math.min(1, dt * 3);
    this.truck.awning.rotation.x = -easeInOut(this.awningLift) * 1.9;
    this.truck.bulbs.forEach((b) => {
      (b.material as THREE.SpriteMaterial).opacity = 0.4 + Math.sin(t * 2.5 + (b.userData.phase as number)) * 0.2 * E;
    });
    this.village.clouds.rotation.y += dt * 0.004;
    (this.village.water.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.32 + Math.sin(t * 2) * 0.05;

    // Smoke from the oven chimney, water from the fountain.
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.5 + (1 - heat) * 0.8;
      this.fx.emit(this.truck.chimneyTop, { tex: dotTexture(), color: '#ffffff', count: 1, spread: 0.3, up: 0.8, life: 3, size: 0.5, grow: 2.5, opacity: 0.55 });
    }
    if (!this.lowPower) {
      this.waterT -= dt;
      if (this.waterT <= 0) {
        this.waterT = 0.12;
        this.fx.emit(this.village.fountain, { tex: dotTexture(), color: ['#bfeaff', '#ffffff'], count: 2, spread: 1.6, up: 2.2, life: 0.9, size: 0.14, gravity: 5, opacity: 0.85 });
      }
    }
    if (this.partyT > 0) {
      const before = this.partyT;
      this.partyT -= dt;
      if (Math.floor(before * 2.5) !== Math.floor(this.partyT * 2.5)) {
        this.confetti();
        if (Math.random() < 0.4) this.audio.babble(CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)], 3);
      }
    }
    this.fx.update(dt);
    this.glowFx.update(dt);

    // Camera.
    const v = this.view;
    const cur = this.cur;
    const k = 1 - Math.exp(-dt * (this.reduce ? 6 : 2.4));
    cur.c.lerp(v.c, k);
    cur.r += (v.r - cur.r) * k;
    cur.pitch += (v.pitch - cur.pitch) * k;
    cur.yaw = lerpAngle(cur.yaw, v.yaw, k);
    const vf = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const safe = Math.max(0.42, Math.min(1, (this.size.h - this.insets.top - this.insets.bottom) / this.size.h));
    const vfs = Math.atan(Math.tan(vf) * safe);
    const hf = Math.atan(Math.tan(vf) * this.camera.aspect);
    const dist = cur.r / Math.tan(Math.min(vfs, hf));
    const sway = this.reduce ? 0 : Math.sin(t * 0.15) * 0.03;
    const yaw = cur.yaw + sway;
    this.camera.position.set(cur.c.x + Math.sin(yaw) * Math.cos(cur.pitch) * dist, cur.c.y + Math.sin(cur.pitch) * dist, cur.c.z + Math.cos(yaw) * Math.cos(cur.pitch) * dist);
    this.camera.lookAt(cur.c);
  }

  /** Lets the end-to-end test look inside (never used by the game itself). */
  debug() {
    return { step: this.step, index: this.index, state: this.state, round: this.round, busy: this.busy, selected: this.selected, coins: this.coins, bubble: this.bubble.visible && this.bubbleK > 0.9 };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.dispose();
    this.fx.clear();
    this.glowFx.clear();
    this.pizza.dispose();
    for (const c of this.critters.values()) c.dispose();
    for (const p of this.pigeons) p.dispose();
    this.ziggy.userData.model.dispose();
    (this.bubble.material as THREE.SpriteMaterial).map?.dispose();
    disposeTree(this.scene);
    disposeFood();
    disposeFxTextures();
    this.env.dispose();
    this.pmrem.dispose();
    this.post.dispose();
    this.renderer.dispose();
  }
}
