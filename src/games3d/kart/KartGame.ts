import * as THREE from 'three';
import { Post } from '../kit/post';
import { createRenderer, disposeTree, glow, glowMat, glowTex, prefersLowPower, studioEnvironment } from '../kit/look';
import { makeZiggy, type ZiggyActor } from '../kit/models';
import { Puffs } from '../kit/world';
import { rng } from '../kit/rng';
import { makeScarf } from '../ziggy/model';
import { KartAudio, type KartSound } from './audio';
import { Bubbles, Confetti, RainbowTrail, bannerTexture, bubbleSprite, checkerTexture, letterTexture, puddleTexture, soapTexture, turboTexture } from './fx';
import { ScarfTail, makeKart, makeTrailer, type KartModel, type TrailerModel } from './kart';
import { BUBBLES, checkGate, reshuffle, scoreRun, type KartRun, type Step } from './logic';
import { Kit, makeFlyingCow, makeProp, mergeModel } from './props';
import { makeBalloon, makeCloudSea, makeIslands, makeRainbow, makeSky, makeSparkles, makeSun, type Island } from './scenery';
import { LANE_TINT, Track, newFrame } from './track';

/**
 * Ziggy Kart des lettres — the 3D scene. The kart drives on its own around
 * the rainbow loop; the child only picks a lane (swipe, the big ◀ ▶ buttons,
 * the letter buttons, or the arrow keys / TV remote). Gates with letters
 * come one row at a time; the right one adds its letter to the word, a
 * wrong one makes the kart do a funny corkscrew and the gate comes back.
 * A finished word: rainbow turbo, and its object jumps into the trailer.
 * At the end, a party podium with Ziggy and all the objects.
 */

export interface KartState {
  phase: 'race' | 'finish' | 'podium';
  wordIndex: number;
  wordCount: number;
  /** Gates already won in the current word. */
  stepIndex: number;
  /** Letters of the coming gates, by lane (left, middle, right). */
  options: [string, string, string] | null;
  lane: number;
  hint: 0 | 1 | 2;
  /** Words completed so far. */
  done: number;
  paused: boolean;
}

export type KartEvent =
  | { kind: 'word'; index: number; options: [string, string, string] }
  | { kind: 'retry'; index: number; step: Step; hint: 1 | 2 }
  | { kind: 'right'; index: number; step: Step; wordDone: boolean; n: number }
  | { kind: 'wrong'; index: number; step: Step; chosen: string; n: number }
  | { kind: 'finish' };

export interface KartStats {
  correct: number;
  mistakes: number;
  total: number;
  durationMs: number;
}

export interface KartCallbacks {
  onState: (s: KartState) => void;
  onEvent: (e: KartEvent) => void;
  onFinish: (stats: KartStats) => void;
}

export interface KartOptions {
  /** Canvas font family (the site's rounded font). */
  font: string;
  reduceMotion: boolean;
}

interface Arch {
  lane: number;
  text: string;
  sign: THREE.Sprite;
  halo: THREE.Sprite;
  top: THREE.Mesh;
  ring?: THREE.Mesh;
}

interface Row {
  s: number;
  word: number;
  step: number;
  data: Step;
  hint: 0 | 1 | 2;
  group: THREE.Group;
  arches: Arch[];
  done: boolean;
  sparkleT: number;
  /** Seconds since the kart passed (the arches then pop away). */
  gone: number;
}

interface Feature {
  kind: 'turbo' | 'puddle' | 'ramp' | 'finish';
  s: number;
  lane: number;
  group: THREE.Group;
  done: boolean;
  tex?: THREE.Texture;
}

interface Flyer {
  obj: THREE.Object3D;
  t: number;
  dur: number;
  from: THREE.Vector3;
  to: () => THREE.Vector3;
  arc: number;
  scaleFrom: number;
  scaleTo: number;
  spin: number;
  done?: () => void;
}

const KART_TRAIL = 3.7;

export class KartGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.2, 1400);
  private post: Post;
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private resize: ResizeObserver;
  private lowPower = prefersLowPower();
  private motion: number;
  private audio = new KartAudio();
  private dropEnv: () => void = () => {};

  // World
  private track: Track;
  private islands: Island[] = [];
  private balloons: THREE.Group[] = [];
  private sun = new THREE.DirectionalLight('#fff3df', 2.1);
  private puffs = new Puffs(glowTex());
  private sparkles = new Puffs(glowTex());
  private confetti: Confetti;
  private bubbles = new Bubbles();
  private trail = new RainbowTrail(1.8);
  private letterTex = new Map<string, THREE.Texture>();
  private gateGeo: { post: THREE.BufferGeometry; top: THREE.BufferGeometry; foot: THREE.BufferGeometry };
  private gateMat: { post: THREE.Material; tops: THREE.Material[]; foot: THREE.Material };

  // Kart & Ziggy
  private kart: KartModel;
  private trailer: TrailerModel;
  private ziggy: ZiggyActor;
  private scarf = new ScarfTail();
  private talk: THREE.Sprite | null = null;
  private talkT = 0;
  private f = newFrame();
  private f2 = newFrame();
  private f3 = newFrame();

  // Race
  private s = 0;
  private v = 0;
  private base: number;
  private lane = 1;
  private x = 0;
  private vx = 0;
  private trX = 0;
  private boostT = 0;
  private boostK = 0;
  private jumpY = 0;
  private jumpV = 0;
  private air = false;
  private spinT = -1;
  private wiggleT = 0;
  private phase: KartState['phase'] = 'race';
  private paused = false;
  private time = 0;
  private timers: { t: number; fn: () => void }[] = [];
  private rows: Row[] = [];
  private features: Feature[] = [];
  private flyers: Flyer[] = [];
  private wordIndex = 0;
  private stepIndex = 0;
  private hint: 0 | 1 | 2 = 0;
  private tries = new Map<string, number>();
  private results: { tries: number }[] = [];
  private wrongCount = 0;
  private rightCount = 0;
  private collected: THREE.Object3D[] = [];
  private started = performance.now();
  private cowDue = false;
  private cow: { g: THREE.Group; t: number; side: number; bubble: THREE.Sprite; waved: boolean } | null = null;
  private camMode: 'chase' | 'front' | 'podium' = 'front';
  private camModeT = 1.8;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camReady = false;
  private fovKick = 0;
  private podium: { center: THREE.Vector3; yaw: number; t: number; fireT: number; group: THREE.Group } | null = null;
  private stopS = 0;
  private finishCalled = false;
  private touch: { x: number; y: number } | null = null;
  private seedR: () => number;
  private perf = { frames: 0, time: 0, ratio: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private run: KartRun,
    private cb: KartCallbacks,
    private opts: KartOptions,
    seed: number
  ) {
    this.motion = opts.reduceMotion ? 0.35 : 1;
    this.seedR = rng(seed + 17);
    this.base = run.pacing.speed;
    this.renderer = createRenderer(canvas, { lowPower: this.lowPower });
    this.renderer.toneMappingExposure = 1.08;
    if (this.lowPower) this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.post = new Post(this.renderer, this.scene, this.camera, { enabled: !this.lowPower, strength: 0.32, radius: 0.5, threshold: 1.2 });
    this.track = new Track(run.pacing.laneGap);
    this.confetti = new Confetti(this.lowPower ? 160 : 280);

    const gap = run.pacing.laneGap;
    this.gateGeo = {
      post: this.stripedPost(),
      top: new THREE.TorusGeometry(gap / 2 - 0.02, 0.17, 8, 20, Math.PI),
      foot: new THREE.CylinderGeometry(0.32, 0.38, 0.3, 10),
    };
    this.gateMat = {
      post: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#2a1a2a') }),
      tops: LANE_TINT.map((c) => new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.25), flatShading: true })),
      foot: new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }),
    };

    this.kart = makeKart(opts.font);
    this.trailer = makeTrailer();
    this.ziggy = makeZiggy({ lowPower: this.lowPower });
    this.buildWorld(seed);
    this.dropEnv = studioEnvironment(this.renderer, this.ziggy, 0.45);

    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas.parentElement ?? canvas);
    this.fit();
    window.addEventListener('keydown', this.onKey);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    document.addEventListener('visibilitychange', this.onVisibility);

    // Start: Ziggy waves to the camera, then off we go.
    this.placeKart(0);
    this.ziggy.userData.rig.cue('wave');
    this.play('go');
    this.later(0.9, () => this.startWord());
    this.emit();
    this.start();
  }

  /* ───────────────────────── World ───────────────────────── */

  private buildWorld(seed: number) {
    const s = this.scene;
    s.fog = new THREE.Fog('#ffe1f0', this.lowPower ? 55 : 70, this.lowPower ? 260 : 340);
    s.add(makeSky(), makeSun());
    s.add(new THREE.HemisphereLight('#d6ecff', '#ffd9ee', 1.25));
    this.sun.castShadow = true;
    const sm = this.lowPower ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    s.add(this.sun, this.sun.target);

    s.add(makeCloudSea(this.lowPower, seed));
    this.islands = makeIslands(this.track, this.lowPower, seed);
    for (const i of this.islands) s.add(i.group);
    const r1 = makeRainbow(150);
    r1.position.set(-30, -40, -250);
    const r2 = makeRainbow(120);
    r2.position.set(330, -40, 40);
    r2.rotation.y = -Math.PI / 2;
    s.add(r1, r2);
    const r = rng(seed + 3);
    for (let i = 0; i < (this.lowPower ? 4 : 7); i++) {
      const b = makeBalloon(r);
      const a = (i / 7) * Math.PI * 2 + r();
      const d = 170 + r() * 90;
      b.position.set(Math.cos(a) * d, 8 + r() * 30, Math.sin(a) * d * 0.8);
      b.scale.setScalar(2.2 + r() * 1.5);
      b.userData.a = a;
      b.userData.d = d;
      b.userData.y = b.position.y;
      this.balloons.push(b);
      s.add(b);
    }
    s.add(makeSparkles(this.track, this.lowPower, seed));
    s.add(this.track.build(this.lowPower));

    // The kart, Ziggy in it with a striped scarf, the trailer.
    const z = this.ziggy;
    const rig = z.userData.rig;
    rig.seated = true;
    rig.energy = this.opts.reduceMotion ? 0.4 : 1;
    rig.mood = 'excited';
    const model = z.userData.model;
    model.body.add(makeScarf(this.lowPower), this.scarf.mesh);
    this.kart.seat.add(z);
    s.add(this.kart.root, this.trailer.root);
    s.add(this.puffs.group, this.sparkles.group, this.confetti.mesh, this.bubbles.group, this.trail.mesh);
  }

  /** A candy-striped post (vertex colours), shared by every gate. */
  private stripedPost(): THREE.BufferGeometry {
    const g = new THREE.CylinderGeometry(0.15, 0.15, 3.0, 10, 10).toNonIndexed();
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const a = new THREE.Color('#ff5a8a');
    const b = new THREE.Color('#ffffff');
    for (let i = 0; i < pos.count; i += 3) {
      const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const ang = Math.atan2(pos.getZ(i), pos.getX(i));
      const c = Math.floor((y + 1.5) * 3 + ang * 0.5) % 2 ? a : b;
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.translate(0, 1.5, 0);
    return g;
  }

  private fit() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private portrait() {
    return this.camera.aspect < 0.9;
  }

  /* ───────────────────────── Public controls ───────────────────────── */

  steer(dir: -1 | 1) {
    this.goLane(this.lane + dir);
  }

  goLane(i: number) {
    if (this.phase !== 'race' || this.paused) return;
    const next = Math.max(0, Math.min(2, i));
    if (next === this.lane) return;
    this.lane = next;
    this.play('lane', (next - 1) * 3);
    this.emit();
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.audio.setPaused(p);
    this.emit();
  }

  setMusic(on: boolean) {
    if (on) this.audio.startMusic();
    else this.audio.stopMusic();
  }

  /* ───────────────────────── Input ───────────────────────── */

  private onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // TV: the arrows steer only from the lane controls (elsewhere they move the focus).
    const a = document.activeElement as HTMLElement | null;
    if (document.documentElement.hasAttribute('data-tv') && a && a !== document.body && !a.closest('[data-tv-own-keys]')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a' || k === 'q') this.steer(-1);
    else if (k === 'arrowright' || k === 'd') this.steer(1);
    else if (k === '1' || k === '2' || k === '3') this.goLane(Number(k) - 1);
    else return;
    e.preventDefault();
  };

  private onDown = (e: PointerEvent) => {
    this.touch = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    const t = this.touch;
    this.touch = null;
    if (!t) return;
    const dx = e.clientX - t.x;
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(e.clientY - t.y)) return this.steer(dx < 0 ? -1 : 1);
    // A tap: the left, middle or right third of the screen.
    const r = this.canvas.getBoundingClientRect();
    this.goLane(Math.min(2, Math.floor(((e.clientX - r.left) / r.width) * 3)));
  };

  private onCancel = () => {
    this.touch = null;
  };

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
    this.audio.setPaused(document.hidden || this.paused);
  };

  /* ───────────────────────── Flow ───────────────────────── */

  private later(sec: number, fn: () => void) {
    this.timers.push({ t: sec, fn });
  }

  private play(k: KartSound, pitch = 0) {
    this.audio.play(k, pitch);
  }

  private get word() {
    return this.run.words[this.wordIndex];
  }

  private emit() {
    const row = this.rows.find((r) => !r.done);
    this.cb.onState({
      phase: this.phase,
      wordIndex: this.wordIndex,
      wordCount: this.run.words.length,
      stepIndex: this.stepIndex,
      options: row ? row.data.options : null,
      lane: this.lane,
      hint: row ? row.hint : 0,
      done: this.collected.length,
      paused: this.paused,
    });
  }

  private startWord() {
    const w = this.word;
    if (!w) return;
    this.stepIndex = 0;
    this.hint = 0;
    // A little runway at the very start while the kart speeds up.
    const extra = this.v < this.base * 0.6 ? this.base * 1.2 : 0;
    const row = this.spawnRow(w.steps[0], 0, this.run.pacing.firstGap, extra);
    this.cb.onEvent({ kind: 'word', index: this.wordIndex, options: row.data.options });
    this.emit();
  }

  private spawnRow(step: Step, hint: 0 | 1 | 2, seconds: number, extra = 0): Row {
    const dist = this.base * seconds + extra;
    const s = this.s + dist;
    const group = new THREE.Group();
    const gap = this.run.pacing.laneGap;
    const arches: Arch[] = [];
    const f = this.f2;
    this.track.place(group, s, 0, 0, f);
    // Four candy posts, three arches, a letter in each.
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * gap;
      const post = new THREE.Mesh(this.gateGeo.post, this.gateMat.post);
      post.position.set(-x, 0, 0);
      post.castShadow = true;
      const foot = new THREE.Mesh(this.gateGeo.foot, this.gateMat.foot);
      foot.position.set(-x, 0.15, 0);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), this.gateMat.foot);
      ball.position.set(-x, 3.05, 0);
      group.add(post, foot, ball);
    }
    for (let lane = 0; lane < 3; lane++) {
      const x = (lane - 1) * gap;
      const top = new THREE.Mesh(this.gateGeo.top, this.gateMat.tops[lane]);
      top.position.set(-x, 3.0, 0);
      top.castShadow = true;
      const text = step.options[lane];
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.letterTexture(text, lane), transparent: true, depthWrite: false }));
      sign.scale.setScalar(Math.min(2.3, gap * 0.7));
      sign.position.set(-x, 3.55, 0);
      sign.renderOrder = 2;
      const lit = hint > 0 && text === step.answer;
      const halo = glow(lit ? '#fff09a' : '#ffffff', lit ? 3.6 : 2.6, lit ? 0.7 : 0.28);
      halo.position.copy(sign.position);
      group.add(top, halo, sign);
      const arch: Arch = { lane, text, sign, halo, top };
      if (lit) {
        // A golden ring spins around the right letter: the gentle hint.
        const ring = new THREE.Mesh(new THREE.TorusGeometry(sign.scale.x * 0.56, 0.09, 8, 32), glowMat('#ffd84d', 1.5));
        ring.position.copy(sign.position);
        group.add(ring);
        arch.ring = ring;
      }
      arches.push(arch);
      if (hint === 2 && text !== step.answer) {
        (sign.material as THREE.SpriteMaterial).opacity = 0.32;
        sign.scale.multiplyScalar(0.8);
        halo.visible = false;
      }
    }
    this.scene.add(group);
    const row: Row = { s, word: this.wordIndex, step: this.stepIndex, data: step, hint, group, arches, done: false, sparkleT: 0, gone: 0 };
    this.rows.push(row);
    this.planFeatures(this.s, s);
    return row;
  }

  /** Between now and the next gate: maybe a jump, a turbo pad or a bubble puddle. */
  private planFeatures(from: number, to: number) {
    const d = to - from;
    if (d < 26) return;
    const r = this.seedR;
    const roll = r();
    const lane = Math.floor(r() * 3);
    if (roll < 0.3 && d > 34) this.addFeature('ramp', from + d * 0.32, 1);
    else if (roll < 0.62) this.addFeature('turbo', from + d * 0.4, lane);
    else this.addFeature('puddle', from + d * 0.42, lane);
    // Long gaps (little ones): one more surprise.
    if (d > 62) this.addFeature(r() < 0.5 ? 'puddle' : 'turbo', from + d * 0.62, (lane + 1 + Math.floor(r() * 2)) % 3);
  }

  private addFeature(kind: Feature['kind'], s: number, lane: number) {
    const gap = this.run.pacing.laneGap;
    const group = new THREE.Group();
    const x = (lane - 1) * gap;
    let tex: THREE.Texture | undefined;
    if (kind === 'turbo') {
      tex = turboTexture();
      tex.repeat.set(1, 2);
      const geo = new THREE.PlaneGeometry(gap * 0.78, 4.2);
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(Math.PI);
      const pad = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, color: new THREE.Color('#ffffff').multiplyScalar(1.25), toneMapped: false, depthWrite: false }));
      pad.position.set(-x, 0.04, 0);
      const h = glow('#7ee8ff', 4.5, 0.35);
      h.position.set(-x, 0.5, 0);
      group.add(pad, h);
    } else if (kind === 'puddle') {
      tex = puddleTexture();
      const soap = soapTexture();
      const geo = new THREE.CircleGeometry(1.35, 28);
      geo.rotateX(-Math.PI / 2);
      const p = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      p.scale.set(1, 1, 1.5);
      p.position.set(-x, 0.04, 0);
      group.add(p);
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: soap, transparent: true, depthWrite: false }));
        b.scale.setScalar(0.55 + i * 0.15);
        b.position.set(-x + Math.cos(i * 2.1) * 0.7, 0.5 + i * 0.35, Math.sin(i * 2.1) * 0.9);
        b.userData.bob = i;
        group.add(b);
      }
    } else if (kind === 'ramp') {
      const k = new Kit();
      const w = this.track.halfWidth * 2 - 0.9;
      const slices = Math.round(w / 0.9);
      const sw = w / slices;
      for (let i = 0; i < slices; i++) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(3.4, 0);
        shape.lineTo(3.4, 0.75);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: sw, bevelEnabled: false });
        geo.rotateY(-Math.PI / 2);
        geo.translate(-w / 2 + (i + 1) * sw, 0, -3.4);
        k.add(geo, i % 2 ? '#ff7eb6' : '#ffd23f');
      }
      const ramp = mergeModel(k.g, { emissive: 0x201010 });
      ramp.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.receiveShadow = true) : null));
      group.add(ramp);
      const h = glow('#fff1a8', 6, 0.25);
      h.position.set(0, 1, -1);
      group.add(h);
    } else if (kind === 'finish') {
      const hw = this.track.halfWidth;
      const pm = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: new THREE.Color('#2a2a2a') });
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 6.2, 12), pm);
        post.position.set(sx * (hw - 0.1), 3.1, 0);
        post.castShadow = true;
        group.add(post);
        ['#ff6fa8', '#ffd23f', '#7ed6ff'].forEach((c, i) => {
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.2) }));
          b.scale.y = 1.15;
          b.position.set(sx * (hw + 0.3 + i * 0.25), 6.6 + i * 0.75, (i - 1) * 0.5);
          group.add(b);
        });
      }
      tex = bannerTexture(this.opts.font);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 1.4), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, emissive: new THREE.Color('#333333') }));
      banner.position.set(0, 5.7, 0);
      const ct = checkerTexture();
      ct.wrapS = THREE.RepeatWrapping;
      ct.repeat.set(2, 1);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 1.6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: ct }));
      strip.position.y = 0.035;
      group.add(banner, strip, glow('#fff1a8', 14, 0.25));
    }
    this.track.place(group, s, 0, 0, this.f2);
    this.scene.add(group);
    this.features.push({ kind, s, lane, group, done: false, tex });
  }

  private letterTexture(text: string, lane: number) {
    const key = `${text}|${lane}`;
    let t = this.letterTex.get(key);
    if (!t) {
      t = letterTexture(text, LANE_TINT[lane], this.opts.font);
      this.letterTex.set(key, t);
    }
    return t;
  }

  /** Ziggy (or the cow) says something in a comic bubble. */
  private say(text: string, dur = 1.4) {
    if (this.talk) {
      this.kart.root.remove(this.talk);
      (this.talk.material as THREE.SpriteMaterial).map?.dispose();
      this.talk.material.dispose();
    }
    this.talk = bubbleSprite(text, this.opts.font);
    // Beside Ziggy's head (never over the gates ahead).
    this.talk.position.set(1.75, 2.75, 0.1);
    this.talk.scale.multiplyScalar(0.01);
    this.kart.root.add(this.talk);
    this.talkT = dur;
  }

  private resolve(row: Row) {
    row.done = true;
    const step = row.data;
    const lane = this.lane;
    const right = checkGate(step, lane);
    const key = `${row.word}-${row.step}`;
    const tries = (this.tries.get(key) ?? 0) + 1;
    this.tries.set(key, tries);
    const arch = row.arches[lane];
    const at = arch.sign.getWorldPosition(new THREE.Vector3());
    if (right) {
      this.rightCount++;
      this.results.push({ tries });
      this.stepIndex++;
      this.hint = 0;
      const wordDone = this.stepIndex >= this.word.steps.length;
      this.play('pick', Math.min(7, this.stepIndex * 2));
      this.sparkles.emit(at, { color: LANE_TINT[lane], count: Math.round(22 * this.motion), spread: 3, up: 3, life: 1.1, size: 0.5, additive: true });
      this.confetti.burst(at, Math.round(26 * this.motion), 2.5, 4);
      // The letter flies up to the word in the sky.
      this.flyLetter(arch);
      for (const a of row.arches) if (a !== arch) (a.sign.material as THREE.SpriteMaterial).opacity = 0.35;
      this.ziggy.userData.rig.cue(wordDone ? 'cheer' : 'nod');
      this.cb.onEvent({ kind: 'right', index: this.wordIndex, step, wordDone, n: this.rightCount });
      if (wordDone) this.wordDone();
      else this.spawnRow(this.word.steps[this.stepIndex], 0, this.run.pacing.stepGap);
    } else {
      this.wrongCount++;
      this.hint = tries >= 2 ? 2 : 1;
      this.play('oops');
      this.spinT = 0;
      this.say(BUBBLES.oops[this.run.locale]);
      this.puffs.emit(at, { color: '#ffffff', count: Math.round(12 * this.motion), spread: 2.5, up: 1.4, life: 1.0, size: 0.9 });
      // The trickster letter giggles away.
      this.flyAway(arch);
      this.ziggy.userData.rig.cue('oops');
      this.cb.onEvent({ kind: 'wrong', index: this.wordIndex, step, chosen: step.options[lane], n: this.wrongCount });
      const again = reshuffle(step, this.wrongCount * 11 + row.step);
      this.later(0.6, () => {
        this.spawnRow(again, this.hint, this.run.pacing.retryGap - 0.6);
        this.cb.onEvent({ kind: 'retry', index: this.wordIndex, step: again, hint: this.hint === 2 ? 2 : 1 });
        this.emit();
      });
    }
    this.emit();
  }

  private flyLetter(arch: Arch) {
    const sign = arch.sign;
    const from = sign.getWorldPosition(new THREE.Vector3());
    sign.parent?.remove(sign);
    this.scene.add(sign);
    sign.position.copy(from);
    const cam = this.camera;
    this.flyers.push({
      obj: sign,
      t: 0,
      dur: 0.75,
      from,
      to: () => {
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const up = cam.up.clone().applyQuaternion(cam.quaternion);
        return cam.position.clone().addScaledVector(dir, 7).addScaledVector(up, 3.2);
      },
      arc: 1.2,
      scaleFrom: sign.scale.x,
      scaleTo: 0.5,
      spin: 0,
      done: () => {
        this.scene.remove(sign);
        sign.material.dispose();
      },
    });
  }

  private flyAway(arch: Arch) {
    const sign = arch.sign;
    const from = sign.getWorldPosition(new THREE.Vector3());
    sign.parent?.remove(sign);
    this.scene.add(sign);
    sign.position.copy(from);
    const side = this.f.side.clone();
    const dir = arch.lane === 0 ? -1 : arch.lane === 2 ? 1 : this.seedR() < 0.5 ? -1 : 1;
    const to = from.clone().addScaledVector(side, dir * 9).addScaledVector(this.f.up, 4);
    this.flyers.push({
      obj: sign,
      t: 0,
      dur: 1.1,
      from,
      to: () => to,
      arc: 2,
      scaleFrom: sign.scale.x,
      scaleTo: 0.2,
      spin: dir * 9,
      done: () => {
        this.scene.remove(sign);
        sign.material.dispose();
      },
    });
  }

  private wordDone() {
    const w = this.word;
    this.play('word');
    // Rainbow turbo!
    this.boostT = 3.0;
    this.boostK = this.run.band === 'little' ? 0.5 : 0.75;
    this.fovKick = 8 * this.motion;
    if (!this.opts.reduceMotion) {
      this.camMode = 'front';
      this.camModeT = 2.5;
    }
    // The word's object pops up in front of the kart, then jumps into the trailer.
    const prop = makeProp(w.prop, 1.7);
    const slot = this.trailer.slots[this.collected.length % this.trailer.slots.length];
    this.collected.push(prop);
    this.kart.root.add(prop);
    prop.position.set(0, 1.6, 3.4);
    prop.scale.setScalar(0.01);
    const fromLocal = prop.position.clone();
    this.flyers.push({
      obj: prop,
      t: 0,
      dur: 0.5,
      from: fromLocal,
      to: () => new THREE.Vector3(0, 2.5, 3.0),
      arc: 0.6,
      scaleFrom: 0.01,
      scaleTo: 1,
      spin: Math.PI * 2,
      done: () => {
        this.sparkles.emit(prop.getWorldPosition(new THREE.Vector3()), { color: '#ffe066', count: Math.round(18 * this.motion), spread: 2.5, up: 2.5, life: 1, size: 0.45, additive: true });
        this.later(0.85, () => this.propToTrailer(prop, slot));
      },
    });
    this.emit();
    // After the 2nd and 4th words, the flying cow comes to say hello (no gate is coming).
    if (this.wordIndex === 1 || this.wordIndex === 3) this.later(0.9, () => (this.cowDue = true));
    const last = this.wordIndex >= this.run.words.length - 1;
    this.later(3.0, () => {
      if (last) {
        this.addFeature('finish', this.s + this.base * 4.2, 1);
      } else {
        this.wordIndex++;
        this.startWord();
      }
    });
  }

  private propToTrailer(prop: THREE.Object3D, slot: THREE.Group) {
    // Into the trailer: from kart space to the slot, with a big hop.
    const start = prop.getWorldPosition(new THREE.Vector3());
    this.scene.attach(prop);
    this.ziggy.userData.rig.cue('love');
    this.flyers.push({
      obj: prop,
      t: 0,
      dur: 0.9,
      from: start,
      to: () => slot.getWorldPosition(new THREE.Vector3()),
      arc: 3.2,
      scaleFrom: prop.scale.x,
      scaleTo: 0.42,
      spin: -Math.PI * 2,
      done: () => {
        slot.attach(prop);
        prop.position.set(0, 0, 0);
        prop.quaternion.identity();
        prop.scale.setScalar(0.42 / this.trailer.root.scale.x);
        this.play('land');
        this.puffs.emit(slot.getWorldPosition(new THREE.Vector3()), { color: '#ffffff', count: Math.round(8 * this.motion), spread: 1, up: 1, life: 0.7, size: 0.5 });
      },
    });
  }

  private crossFinish() {
    this.phase = 'finish';
    this.play('finish');
    this.say(BUBBLES.yay[this.run.locale], 2.2);
    this.ziggy.userData.rig.cue('cheer');
    const at = this.kart.root.position.clone().addScaledVector(this.f.up, 5);
    for (let k = 0; k < 4; k++) this.later(k * 0.25, () => this.confetti.burst(at.clone().addScaledVector(this.f.side, (k - 1.5) * 3), Math.round(40 * this.motion), 4, 6));
    this.stopS = this.s + this.v * 1.6;
    this.cb.onEvent({ kind: 'finish' });
    this.emit();
  }

  private toPodium() {
    this.phase = 'podium';
    const f = this.track.frame(this.stopS + 7.5, newFrame());
    const g = new THREE.Group();
    const k = new Kit();
    const tiers: [number, number, string][] = [
      [3.3, 0.75, '#ffb3d1'],
      [2.3, 0.75, '#b8f2c9'],
      [1.25, 0.75, '#fff0a8'],
    ];
    let y = 0;
    tiers.forEach(([r, h, c], i) => {
      k.cyl(r, r * 1.02, h, c, [0, y + h / 2, 0], [0, 0, 0], 20);
      k.torus(r, 0.12, '#ffffff', [0, y + h, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 24);
      for (let d = 0; d < 10 + i * 2; d++) {
        const a = (d / (10 + i * 2)) * Math.PI * 2;
        k.ball(0.13, '#ffffff', [Math.cos(a) * r, y + h - 0.12, Math.sin(a) * r], [0.8, 1.6, 0.8], [0, 0, 0], 8);
        k.box(0.06, 0.05, 0.22, ['#ff6fa8', '#7ed6ff', '#a98bff', '#ffb347'][d % 4], [Math.cos(a) * r * 0.75, y + h + 0.03, Math.sin(a) * r * 0.75], [0, a, 0]);
      }
      y += h;
    });
    g.add(mergeModel(k.g, { receive: true, emissive: 0x201820 }));
    // A big star behind Ziggy.
    const star = makeProp('star', 1.6);
    star.position.set(0, y + 2.6, -1.1);
    g.add(star);
    g.userData.star = star;
    this.track.place(g, this.stopS + 7.5, 0, 0, this.f2);
    this.scene.add(g);
    const center = g.position.clone();
    const top = center.clone().addScaledVector(f.up, y);
    this.podium = { center: top, yaw: 0, t: 0, fireT: 0.4, group: g };

    // Ziggy hops out of the kart onto the top of the cake podium.
    const z = this.ziggy;
    const zFrom = z.getWorldPosition(new THREE.Vector3());
    this.scene.attach(z);
    const rig = z.userData.rig;
    rig.seated = false;
    rig.cue('jump');
    this.play('jump');
    const look = new THREE.Matrix4().makeBasis(f.side.clone().negate(), f.up, f.t);
    const q = new THREE.Quaternion().setFromRotationMatrix(look);
    this.flyers.push({
      obj: z,
      t: 0,
      dur: 0.9,
      from: zFrom,
      to: () => top.clone(),
      arc: 2.5,
      scaleFrom: 1,
      scaleTo: 1,
      spin: 0,
      done: () => {
        z.quaternion.copy(q);
        rig.idle = 'dance';
        rig.mood = 'excited';
        rig.cue('cheer');
        this.play('finish');
      },
    });
    z.quaternion.copy(q);
    // The word objects jump onto the tiers, all around Ziggy.
    this.collected.forEach((p, i) => {
      const n = this.collected.length;
      const ring = i < 4 ? 0 : 1;
      const count = ring === 0 ? Math.min(4, n) : n - 4;
      const idx = ring === 0 ? i : i - 4;
      const a = (idx - (count - 1) / 2) * (ring === 0 ? 0.72 : 0.5);
      const r = ring === 0 ? 1.8 : 2.85;
      const h = ring === 0 ? 1.5 : 0.75;
      const local = new THREE.Vector3(Math.sin(a) * r, h, Math.cos(a) * r);
      this.later(0.5 + i * 0.18, () => {
        const from = p.getWorldPosition(new THREE.Vector3());
        this.scene.attach(p);
        g.updateMatrixWorld(true);
        const target = g.localToWorld(local.clone());
        this.flyers.push({
          obj: p,
          t: 0,
          dur: 0.8,
          from,
          to: () => target,
          arc: 2.4,
          scaleFrom: p.scale.x,
          scaleTo: 0.85,
          spin: Math.PI * 2,
          done: () => {
            p.quaternion.copy(q);
            p.userData.dance = { base: target.clone(), ph: i * 0.9 };
            this.play('pick', i * 2);
          },
        });
      });
    });
    this.camMode = 'podium';
    this.later(2.2, () => {
      if (this.finishCalled) return;
      this.finishCalled = true;
      const st = scoreRun(this.results);
      this.cb.onFinish({ ...st, durationMs: performance.now() - this.started });
    });
    this.emit();
  }

  private triggerFeature(ft: Feature) {
    ft.done = true;
    const gap = this.run.pacing.laneGap;
    const inLane = Math.abs(this.x - (ft.lane - 1) * gap) < gap * 0.55;
    if (ft.kind === 'ramp') {
      this.jumpV = 7.5;
      this.air = true;
      this.play('jump');
      this.say(BUBBLES.jump[this.run.locale], 1.2);
      this.ziggy.userData.rig.cue('jump');
    } else if (ft.kind === 'turbo' && inLane) {
      this.boostT = 1.6;
      this.boostK = this.run.band === 'little' ? 0.3 : 0.45;
      this.fovKick = 6 * this.motion;
      this.play('turbo');
      this.say(BUBBLES.turbo[this.run.locale], 1.1);
      this.ziggy.userData.rig.cue('giggle');
    } else if (ft.kind === 'puddle' && inLane) {
      this.wiggleT = 1.2;
      const at = this.kart.root.position.clone().addScaledVector(this.f.up, 0.8);
      this.bubbles.emit(at, Math.round(26 * this.motion), 2.4, 2.2, this.f.t.clone().multiplyScalar(this.v * 0.6));
      this.play('giggle');
      this.say(BUBBLES.bubbles[this.run.locale], 1.4);
      this.ziggy.userData.rig.cue('giggle');
    } else if (ft.kind === 'finish') {
      this.crossFinish();
    }
  }

  /* ───────────────────────── Loop ───────────────────────── */

  private start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.raf = requestAnimationFrame(this.loop);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    const dt = Math.min(0.05, raw);
    this.step(dt);
    this.post.render(dt);
    this.adaptResolution(raw);
  };

  /** Weak device: lower the internal resolution a little, step by step. */
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

  private placeKart(dt: number) {
    const f = this.track.frame(this.s, this.f);
    const k = this.kart;
    k.root.position.copy(f.p).addScaledVector(f.side, this.x).addScaledVector(f.up, this.jumpY);
    k.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side.clone().negate(), f.up, f.t));
    // Trailer follows a little behind, its lane catching up.
    this.trX += (this.x - this.trX) * Math.min(1, dt * 3.5);
    const f2 = this.track.frame(this.s - KART_TRAIL, this.f2);
    const tr = this.trailer.root;
    tr.position.copy(f2.p).addScaledVector(f2.side, this.trX).addScaledVector(f2.up, Math.max(0, this.jumpY - 0.4) * 0.6);
    const toKart = k.root.position.clone().addScaledVector(f.t, -1.6).sub(tr.position).normalize();
    const side = new THREE.Vector3().crossVectors(toKart, f2.up).normalize();
    const up = new THREE.Vector3().crossVectors(side, toKart).normalize();
    tr.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side.negate(), up, toKart));
  }

  private step(dt: number) {
    const gdt = this.paused ? 0 : dt;
    this.time += gdt;
    const t = this.time;
    const M = this.motion;

    // Timers in game time (they wait during the pause).
    if (gdt > 0) {
      const due = this.timers.filter((x) => (x.t -= gdt) <= 0);
      this.timers = this.timers.filter((x) => x.t > 0);
      due.forEach((x) => x.fn());
    }

    // Speed.
    this.boostT = Math.max(0, this.boostT - gdt);
    let target = this.base * (1 + this.boostK * Math.min(1, this.boostT));
    if (this.phase === 'finish') target = 0;
    if (this.phase === 'podium') target = 0;
    if (this.phase === 'finish') {
      // Brake gently to stop at the podium.
      const left = Math.max(0, this.stopS - this.s);
      this.v = Math.min(this.v, Math.sqrt(2 * 4.5 * left));
      if (left < 0.05 || this.v < 0.15) {
        this.v = 0;
        this.toPodium();
      }
    } else this.v += (target - this.v) * Math.min(1, gdt * (target > this.v ? 0.9 : 1.6));
    const ds = this.v * gdt;
    this.s += ds;

    // Lane: a soft spring toward the chosen lane.
    const tx = (this.lane - 1) * this.run.pacing.laneGap;
    if (gdt > 0) {
      const a = 38 * (tx - this.x) - 11 * this.vx;
      this.vx += a * gdt;
      this.x += this.vx * gdt;
    }

    // Jumps and corkscrews.
    if (this.air) {
      this.jumpV -= 19 * gdt;
      this.jumpY += this.jumpV * gdt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.jumpV = 0;
        this.air = false;
        this.play('land');
        this.puffs.emit(this.kart.root.position.clone(), { color: '#ffffff', count: Math.round(10 * M), spread: 2.2, up: 0.8, life: 0.8, size: 0.8 });
      }
    }
    this.placeKart(gdt);
    const k = this.kart;
    const body = k.body;
    let roll = this.vx * 0.025;
    let hop = 0;
    if (this.spinT >= 0) {
      this.spinT += gdt / 1.0;
      const p = Math.min(1, this.spinT);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      roll += this.opts.reduceMotion ? Math.sin(p * Math.PI * 4) * 0.25 * (1 - p) : e * Math.PI * 2;
      hop = Math.sin(p * Math.PI) * 1.3 * M;
      if (p >= 1) this.spinT = -1;
    }
    if (this.wiggleT > 0) {
      this.wiggleT = Math.max(0, this.wiggleT - gdt);
      body.rotation.y = Math.sin(this.wiggleT * 22) * 0.18 * this.wiggleT * M;
    } else body.rotation.y = -this.vx * 0.045;
    body.rotation.z = roll;
    body.rotation.x = this.air ? -this.jumpV * 0.025 : 0;
    const rumble = this.v > 1 && !this.air ? Math.abs(Math.sin(t * this.v * 1.3)) * 0.035 * M : 0;
    body.position.y = hop + rumble;
    for (const w of k.wheels) w.rotation.x += ds / 0.4;
    for (const w of this.trailer.wheels) w.rotation.x += ds / 0.3;
    for (const s of k.steer) s.rotation.y = Math.max(-0.4, Math.min(0.4, -this.vx * 0.09));
    const pennant = k.flag.getObjectByName('pennant');
    if (pennant) pennant.rotation.y = -Math.PI / 2 + Math.sin(t * 13) * 0.35 * M * Math.min(1, this.v / 6);
    this.trailer.body.position.y = this.v > 1 ? Math.abs(Math.sin(t * this.v * 1.1 + 1)) * 0.03 * M : 0;

    // Exhaust puffs and the rainbow trail during a turbo.
    if (this.v > 1 && gdt > 0 && Math.random() < (this.boostT > 0 ? 0.9 : 0.12) * M) {
      for (const e of k.exhaust) {
        const p = body.localToWorld(e.clone());
        if (this.boostT > 0) {
          const c = ['#ff8a8a', '#ffb36b', '#ffe170', '#93e6a0', '#7cc4ff', '#b79cff'][Math.floor(Math.random() * 6)];
          this.sparkles.emit(p, { color: c, count: 2, spread: 0.4, up: 0.4, life: 0.7, size: 0.55, additive: true });
        } else this.puffs.emit(p, { color: '#ffffff', count: 1, spread: 0.2, up: 0.5, life: 0.6, size: 0.35 });
      }
    }

    // The rainbow ribbon of the turbo, on the road behind the kart.
    if (gdt > 0) {
      const rear = this.track.at(this.s - 1.9, this.x, 0.06 + this.jumpY * 0.3, this.f2);
      this.trail.update(rear, this.f2.side, this.boostT > 0 && this.phase === 'race' ? Math.min(1, this.boostT * 1.5) : 0, gdt);
    }

    // Ziggy: rig, antennas and scarf in the wind.
    const rig = this.ziggy.userData.rig;
    rig.lookAt(-this.vx * 0.15 + (this.lane - 1) * 0.25, 0.05);
    rig.update(dt);
    const wind = this.phase === 'podium' ? 0 : Math.min(1, this.v / 11);
    const model = this.ziggy.userData.model;
    model.antennas.forEach((a, i) => {
      a.rotation.x += (-0.55 * wind + Math.sin(t * 24 + i * 2) * 0.06 * wind) * M;
      a.rotation.z += Math.sin(t * 17 + i) * 0.05 * wind * M;
    });
    this.scarf.update(t, wind, M);

    // Speech bubble pop.
    if (this.talk) {
      this.talkT -= dt;
      const sc = this.talkT > 0 ? Math.min(1, this.talk.scale.x / 2.1 + dt * 8) : Math.max(0, this.talk.scale.x / 2.1 - dt * 6);
      this.talk.scale.set(2.1 * sc, 1.05 * sc, 1);
      if (this.talkT <= 0 && sc <= 0.01) {
        this.kart.root.remove(this.talk);
        (this.talk.material as THREE.SpriteMaterial).map?.dispose();
        this.talk.material.dispose();
        this.talk = null;
      }
    }

    // Gates.
    for (const row of this.rows) {
      if (!row.done && this.phase === 'race' && this.s >= row.s) this.resolve(row);
      for (const a of row.arches) {
        const right = a.text === row.data.answer;
        const bob = Math.sin(t * 2.6 + a.lane) * 0.08 * M;
        if (a.sign.parent === row.group) a.sign.position.y = 3.55 + bob;
        if (a.ring) {
          a.ring.visible = !row.done;
          a.ring.position.y = 3.55 + bob;
          a.ring.lookAt(this.camera.position);
          a.ring.rotateZ(t * 2);
          a.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.08 * M);
        }
        if (!row.done && row.hint && right) {
          const pulse = 1 + Math.sin(t * 6) * 0.18 * M;
          a.halo.scale.setScalar(3.8 * pulse);
          (a.halo.material as THREE.SpriteMaterial).opacity = 0.55 + Math.sin(t * 6) * 0.2;
        }
      }
      if (row.done) {
        // Passed: the gate pops away before the camera gets there.
        row.gone += gdt;
        const k = Math.max(0, Math.min(1, (row.gone - 0.25) / 0.35));
        const sc = 1 - k * k;
        row.group.scale.set(Math.max(0.001, 1 + k * 0.25), Math.max(0.001, sc), Math.max(0.001, 1 + k * 0.25));
        row.group.visible = sc > 0.01;
      }
      if (!row.done && row.hint) {
        row.sparkleT -= gdt;
        if (row.sparkleT <= 0) {
          row.sparkleT = 0.25;
          const a = row.arches.find((x) => x.text === row.data.answer);
          if (a) this.sparkles.emit(a.sign.getWorldPosition(new THREE.Vector3()), { color: '#ffe066', count: 3, spread: 1.6, up: 1.2, life: 0.8, size: 0.4, additive: true });
        }
      }
    }
    this.rows = this.rows.filter((r) => {
      if (r.done && this.s > r.s + 14) {
        this.scene.remove(r.group);
        r.group.traverse((o) => {
          if ((o as THREE.Sprite).isSprite) (o as THREE.Sprite).material.dispose();
          const m = o as THREE.Mesh;
          if (m.isMesh && (m.geometry.type === 'SphereGeometry' || m.geometry.type === 'TorusGeometry') && m.geometry !== this.gateGeo.top) {
            m.geometry.dispose();
            if (m.material !== this.gateMat.foot) (m.material as THREE.Material).dispose();
          }
        });
        return false;
      }
      return true;
    });

    // Road features.
    for (const ft of this.features) {
      if (!ft.done && this.s + 0.5 >= ft.s && this.phase === 'race') this.triggerFeature(ft);
      if (ft.kind === 'turbo' && ft.tex) ft.tex.offset.y -= gdt * 1.6;
      if (ft.kind === 'puddle')
        ft.group.children.forEach((c) => {
          if (c.userData.bob !== undefined) c.position.y = 0.5 + c.userData.bob * 0.35 + Math.sin(t * 2 + c.userData.bob) * 0.2 * M;
        });
    }
    this.features = this.features.filter((ft) => {
      if (ft.done && this.s > ft.s + 16 && ft.kind !== 'finish') {
        this.scene.remove(ft.group);
        disposeTree(ft.group);
        return false;
      }
      return true;
    });

    // Flyers: letters to the sky, objects into the trailer, Ziggy onto the podium.
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const fl = this.flyers[i];
      fl.t = Math.min(1, fl.t + gdt / fl.dur);
      const e = fl.t < 0.5 ? 2 * fl.t * fl.t : 1 - (-2 * fl.t + 2) ** 2 / 2;
      const to = fl.to();
      fl.obj.position.lerpVectors(fl.from, to, e);
      fl.obj.position.y += Math.sin(fl.t * Math.PI) * fl.arc;
      // Growing things overshoot a little (a cartoon "pop"), shrinking ones ease.
      const back = 1 + 2.70158 * (fl.t - 1) ** 3 + 1.70158 * (fl.t - 1) ** 2;
      const sc = fl.scaleFrom + (fl.scaleTo - fl.scaleFrom) * (fl.scaleTo > fl.scaleFrom ? back : e);
      if ((fl.obj as THREE.Sprite).isSprite) {
        fl.obj.scale.setScalar(Math.max(0.01, sc));
        (fl.obj as THREE.Sprite).material.rotation = fl.spin * fl.t;
        if (fl.scaleTo < 1) (fl.obj as THREE.Sprite).material.opacity = fl.t > 0.6 ? 1 - (fl.t - 0.6) / 0.4 : 1;
      } else {
        fl.obj.scale.setScalar(Math.max(0.01, sc));
        if (fl.spin) fl.obj.rotation.y = fl.spin * e;
      }
      if (fl.t >= 1) {
        this.flyers.splice(i, 1);
        fl.done?.();
      }
    }

    // Objects in the trailer bounce a little; on the podium they dance.
    this.collected.forEach((p, i) => {
      const d = p.userData.dance as { base: THREE.Vector3; ph: number } | undefined;
      if (d) {
        p.position.copy(d.base);
        p.position.y += Math.abs(Math.sin(t * 3.2 + d.ph)) * 0.35 * M;
        p.rotation.y = Math.sin(t * 1.5 + d.ph) * 0.5 * M;
      } else if (p.parent && this.trailer.slots.includes(p.parent as THREE.Group)) {
        p.position.y = Math.abs(Math.sin(t * 5 + i)) * 0.05 * M;
        p.rotation.y = Math.sin(t * 2 + i) * 0.25 * M;
      }
    });

    this.stepCow(dt, gdt, t);
    this.stepPodium(dt);

    // Scenery life.
    for (const isl of this.islands) isl.group.position.y = isl.baseY + Math.sin(t * 0.35 + isl.phase) * 0.7 * M;
    for (const b of this.balloons) {
      b.userData.a += dt * 0.008 * M;
      b.position.set(Math.cos(b.userData.a) * b.userData.d, b.userData.y + Math.sin(t * 0.3 + b.userData.d) * 1.5 * M, Math.sin(b.userData.a) * b.userData.d * 0.8);
    }
    this.puffs.update(dt);
    this.sparkles.update(dt);
    this.confetti.update(dt);
    const popped = this.bubbles.update(dt);
    if (popped && Math.random() < 0.5) this.play('pop');

    // Shadow follows the kart.
    const kp = this.kart.root.position;
    this.sun.position.set(kp.x + 12, kp.y + 26, kp.z + 8);
    this.sun.target.position.copy(kp);

    this.stepCamera(dt, t);
  }

  private stepCow(dt: number, gdt: number, t: number) {
    if (this.phase === 'race' && !this.cow && gdt > 0) {
      if (this.cowDue) {
        this.cowDue = false;
        const g = makeFlyingCow();
        const bubble = bubbleSprite(BUBBLES.cow[this.run.locale], this.opts.font);
        bubble.scale.multiplyScalar(1.6);
        bubble.visible = false;
        g.add(bubble);
        this.scene.add(g);
        const side = this.seedR() < 0.5 ? -1 : 1;
        // Beside the cow, toward the middle of the road.
        bubble.position.set(-side * 3.4, 2.3, 0);
        this.cow = { g, t: 0, side, bubble, waved: false };
      }
    }
    const c = this.cow;
    if (!c) return;
    c.t += gdt;
    const hw = this.track.halfWidth;
    let ahead: number;
    let h: number;
    let lat = c.side * hw * 0.5;
    if (c.t < 1.4) {
      // Swoops in from high up and far ahead.
      const p = c.t / 1.4;
      const e = 1 - (1 - p) ** 3;
      ahead = 45 - 35.5 * e;
      h = 16 - 11.2 * e;
      lat = c.side * (hw + 8 - (hw * 0.5 + 8) * e);
    } else if (c.t < 4.0) {
      ahead = 9.5 + Math.sin((c.t - 1.4) * 1.6) * 1.2;
      h = 4.8 + Math.sin(c.t * 2.4) * 0.35;
      if (!c.waved) {
        c.waved = true;
        c.bubble.visible = true;
        this.play('moo');
        this.ziggy.userData.rig.cue('wave');
      }
    } else {
      const p = (c.t - 4.0) / 1.6;
      c.bubble.visible = false;
      ahead = 9.5 + p * p * 50;
      h = 4.8 + p * p * 30;
      lat += c.side * p * 12;
      if (p >= 1) {
        this.scene.remove(c.g);
        disposeTree(c.g);
        this.cow = null;
        return;
      }
    }
    this.track.place(c.g, this.s + ahead, lat, h, this.f2);
    c.g.rotateY(Math.PI + c.side * 0.35);
    c.g.rotateZ(Math.sin(t * 2.2) * 0.12);
    for (const w of c.g.userData.wings as THREE.Object3D[]) w.rotation.z = Math.sin(t * 14) * 0.55 * (w.userData.side as number);
  }

  private stepPodium(dt: number) {
    const p = this.podium;
    if (!p) return;
    p.t += dt;
    const star = p.group.userData.star as THREE.Object3D;
    star.rotation.y += dt * 1.2;
    p.fireT -= dt;
    if (p.fireT <= 0) {
      p.fireT = this.lowPower ? 1.1 : 0.7;
      const f = this.track.frame(this.stopS + 7.5, this.f2);
      const at = p.center.clone().addScaledVector(f.up, 7 + Math.random() * 5).addScaledVector(f.side, (Math.random() - 0.5) * 16).addScaledVector(f.t, -6 - Math.random() * 6);
      const col = ['#ff6fa8', '#ffd23f', '#7ed6ff', '#a98bff', '#7be495'][Math.floor(Math.random() * 5)];
      this.sparkles.emit(at, { color: col, count: Math.round(34 * this.motion), spread: 9, up: 1.5, life: 1.4, size: 0.7, additive: true });
      this.confetti.burst(at, Math.round(14 * this.motion), 3, 2);
      this.play('pop');
    }
  }

  private stepCamera(dt: number, t: number) {
    const cam = this.camera;
    const portrait = this.portrait();
    const M = this.motion;
    if (this.camModeT > 0) {
      this.camModeT -= dt;
      if (this.camModeT <= 0 && this.camMode === 'front') this.camMode = 'chase';
    }
    const kp = this.kart.root.position;
    const f = this.f;
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    let ease = 1 - Math.exp(-dt * 4.5);
    if (this.camMode === 'podium' && this.podium) {
      const p = this.podium;
      const fp = this.track.frame(this.stopS + 7.5, this.f2);
      const a = Math.sin(p.t * 0.25) * 0.55 * M;
      const r = portrait ? 13 : 10.5;
      const dir = fp.t.clone().multiplyScalar(Math.cos(a)).addScaledVector(fp.side, Math.sin(a));
      pos.copy(p.center).addScaledVector(dir, r).addScaledVector(fp.up, portrait ? 1.2 : 1.6);
      // Ziggy stays in the upper part of the screen (the result card is below).
      look.copy(p.center).addScaledVector(fp.up, portrait ? -2.6 : -1.0);
      ease = 1 - Math.exp(-dt * 2.2);
    } else if (this.camMode === 'front') {
      // A friendly "selfie" view: in front of Ziggy, looking back at him.
      const side = this.camModeT > 1.4 ? 1 : -1;
      pos.copy(kp).addScaledVector(f.t, portrait ? 9.5 : 7.8).addScaledVector(f.up, portrait ? 3.6 : 3.1).addScaledVector(f.side, side * (portrait ? 1.4 : 2.6));
      look.copy(kp).addScaledVector(f.up, portrait ? 1.1 : 1.5).addScaledVector(f.t, 0.8);
      ease = 1 - Math.exp(-dt * 3.2);
    } else {
      const back = portrait ? 11.5 : 9.0;
      const up = portrait ? 6.2 : 4.6;
      const fb = this.track.frame(this.s - back, this.f2);
      // Narrow screens keep the camera near the middle so all three gates stay in view.
      pos.copy(fb.p).addScaledVector(fb.side, this.x * (portrait ? 0.22 : 0.55)).addScaledVector(fb.up, up + this.jumpY * 0.5);
      const fa = this.track.frame(this.s + (portrait ? 16 : 13), this.f3);
      look.copy(fa.p).addScaledVector(fa.side, this.x * (portrait ? 0.12 : 0.45)).addScaledVector(fa.up, 1.2);
    }
    // Smoothed as offsets from the kart, so a fast kart (turbo) never leaves the camera behind.
    const posOff = pos.sub(kp);
    const lookOff = look.sub(kp);
    if (!this.camReady) {
      this.camReady = true;
      this.camPos.copy(posOff);
      this.camLook.copy(lookOff);
    }
    this.camPos.lerp(posOff, ease);
    this.camLook.lerp(lookOff, ease);
    cam.position.copy(kp).add(this.camPos);
    // A gentle shake when landing a jump or in a turbo.
    if (this.boostT > 0 && !this.paused) cam.position.addScaledVector(f.up, Math.sin(t * 40) * 0.03 * M);
    cam.lookAt(kp.clone().add(this.camLook));
    this.fovKick *= Math.exp(-dt * 1.5);
    const fov = (portrait ? 74 : 58) + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  /** End-to-end tests only (software GL is slow): run the race forward without drawing. */
  fastForward(seconds: number) {
    for (let i = 0; i < Math.round(seconds / 0.05); i++) this.step(0.05);
  }

  dispose() {
    this.stop();
    this.resize.disconnect();
    window.removeEventListener('keydown', this.onKey);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.dispose();
    this.bubbles.dispose();
    this.letterTex.forEach((t) => t.dispose());
    this.letterTex.clear();
    for (const g of Object.values(this.gateGeo)) g.dispose();
    this.gateMat.post.dispose();
    this.gateMat.foot.dispose();
    this.gateMat.tops.forEach((m) => m.dispose());
    disposeTree(this.scene);
    this.dropEnv();
    this.post.dispose();
    this.renderer.dispose();
  }
}
