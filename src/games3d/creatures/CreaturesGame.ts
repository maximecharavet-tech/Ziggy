import * as THREE from 'three';
import { FrameClock } from '../kit/clock';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createRenderer, prefersLowPower, studioEnvironment } from '../kit/look';
import { makeZiggy, type ZiggyActor } from '../kit/models';
import { FactoryAudio } from './audio';
import { CreatureActor, costumePieces, disposeCreatureTextures, type ActorCue, type Kit } from './creature3d';
import { SPOT, makeFactory, type Factory } from './factory';
import { Particles, RAINBOW, disposeFxTextures, easeInOut, easeOut, fxTex } from './fx';
import { COLORS, movesOf, voiceOf, type CategoryId, type Creature, type LookKey, type MoveKind } from './logic';

/**
 * L’Usine à Créatures — the 3D scene. The React player owns the recipe (and the
 * undo history); the scene shows it: every change plops in with a bounce, a
 * sound of its kind and a little discovery (new wings? it tries to fly…).
 * Nothing ever blocks: every show can be interrupted by any tap.
 */

export type Mode = 'atelier' | 'alive' | 'parade';
export type SayKind = 'surprise' | 'alive' | 'walk' | 'pogo' | 'bounce' | 'fly' | 'flutter' | 'swim' | 'sneeze' | 'dance' | 'tickle' | 'parade' | 'disguise';

export interface GameCallbacks {
  /** Ziggy says something (the player shows it and reads it aloud). */
  onSay: (kind: SayKind) => void;
  /** The child tapped the lever in 3D. */
  onLever: () => void;
  /** Counting along: part `i` (1-based) of `n` lights up. */
  onCount: (i: number, n: number, kind: 'legs' | 'eyes' | 'arms') => void;
  onMode: (m: Mode) => void;
  /** The creature popped out (intro, surprise): read its name. */
  onArrive: () => void;
  /** Tapped Ziggy (costume). */
  onZiggy: () => void;
}

interface Step {
  dur: number;
  start?: () => void;
  tick?: (k: number, dt: number) => void;
  end?: () => void;
}

interface Frame {
  c: THREE.Vector3;
  w: number;
  h: number;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const STAGE_YAW = -0.32;

/** The part's "discovery" reaction. */
const DISCOVER: Partial<Record<LookKey, ActorCue>> = {
  wings: 'tryFly',
  legs: 'stomp',
  legStyle: 'stomp',
  eyes: 'peek',
  eyeSize: 'peek',
  hat: 'tip',
  top: 'wiggle',
  tail: 'chase',
  arms: 'wave',
  armStyle: 'wave',
  body: 'boing',
  size: 'boing',
  head: 'nod',
  mouth: 'nod',
  color: 'shake',
  accent: 'shake',
  pattern: 'shake',
};

export class CreaturesGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  private clock = new FrameClock();
  private raf = 0;
  private resizeObs: ResizeObserver;
  readonly lowPower = prefersLowPower();
  private reduce = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  readonly audio = new FactoryAudio();
  private pmrem: THREE.PMREMGenerator;
  private env: THREE.Texture;
  private disposeZiggyEnv: () => void;
  private factory: Factory;
  private ziggy: ZiggyActor;
  private actor: CreatureActor | null = null;
  private fx = new Particles(320);
  private sun = new THREE.DirectionalLight('#fff1dc', 2.1);
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private size = { w: 1, h: 1 };
  private insets = { top: 0, bottom: 0, left: 0, right: 0 };
  private portrait = false;
  private perf = { frames: 0, time: 0, ratio: 0 };
  private hidden = false;
  private time = 0;

  // Camera.
  private frame: Frame = { c: V(0.7, 1.1, 0.2), w: 2.8, h: 1.6 };
  private want: Frame = { c: V(0.7, 1.1, 0.2), w: 2.8, h: 1.6 };
  private camYaw = 0.1;

  // What's going on.
  mode: Mode = 'atelier';
  private steps: Step[] = [];
  private stepT = 0;
  private tasks: { at: number; fn: () => void }[] = [];
  private pointer: THREE.Vector3 | null = null;
  private pointerAt = -10;
  private down: { x: number; y: number; t: number } | null = null;
  private lastTouch = 0;
  private gagN = 0;
  private tickles: number[] = [];
  private lever = { t: 1, pulling: false };
  private shake = 0;
  private steamT = 0;
  private bubbleT = 0;
  private zig = { pos: V(), yaw: -0.75, target: null as THREE.Vector3 | null, home: V(), costume: null as THREE.Object3D[] | null, costumeKit: null as Kit | null, imitate: 0, showOff: 0 };
  private parade: { actors: CreatureActor[]; ids: string[]; t: number; selected: number } | null = null;
  /** Test hook only (automated playthrough on slow software GL). */
  timeScale = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: GameCallbacks
  ) {
    this.renderer = createRenderer(canvas, { lowPower: this.lowPower });
    // Neutral tone mapping keeps the candy colours as saturated as their paint
    // (no bloom: on capable devices it veils sunny scenes in white).
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    if (this.lowPower) this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.factory = makeFactory(this.lowPower, this.env);
    this.ziggy = makeZiggy({ lowPower: this.lowPower });
    this.disposeZiggyEnv = studioEnvironment(this.renderer, this.ziggy, 0.3);
    this.trueGreen(this.ziggy);
    this.ziggy.userData.rig.energy = this.reduce ? 0.35 : 1;
    this.build();

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointerleave', this.onLeave);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resizeObs = new ResizeObserver(() => this.fit());
    this.resizeObs.observe(canvas.parentElement ?? canvas);
    this.fit();
    this.loop();
  }

  /* ───────────────────────── Scene ───────────────────────── */

  private build() {
    const s = this.scene;
    s.fog = new THREE.Fog('#cdeeff', 40, 120);
    s.add(this.factory.group);
    s.add(new THREE.HemisphereLight('#eaf5ff', '#8fd06a', 1.0));
    const sun = this.sun;
    sun.position.set(5, 11, 8);
    sun.target.position.set(0.8, 0, 0);
    sun.castShadow = true;
    const sm = this.lowPower ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -9, right: 10, top: 8, bottom: -6, near: 1, far: 40 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    s.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#ffe6f2', 0.55);
    fill.position.set(-6, 4, 7);
    s.add(fill);
    this.zig.home.copy(SPOT.ziggy);
    this.zig.pos.copy(SPOT.ziggy);
    this.ziggy.position.copy(SPOT.ziggy);
    this.ziggy.rotation.y = this.zig.yaw;
    s.add(this.ziggy, this.fx.group);
  }

  /** Ziggy's felt as green as the plush (the velvet sheen made him pale on capable devices). */
  private trueGreen(z: ZiggyActor) {
    z.traverse((o) => {
      const mats = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
        if (!(m instanceof THREE.MeshStandardMaterial) || !m.normalMap) continue;
        const green = m.color.g > m.color.r * 1.2 && m.color.g > m.color.b * 1.2;
        if (m instanceof THREE.MeshPhysicalMaterial && m.sheen > 0) {
          m.sheen = green ? 0.35 : 0.5;
          if (green) m.sheenColor.copy(m.color).lerp(new THREE.Color('#d8ffb0'), 0.35);
        }
      }
    });
    (z.userData.model.heartGlow.material as THREE.SpriteMaterial).color.set('#a8853f');
  }

  private fit() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const portrait = w < h * 0.9;
    if (portrait !== this.portrait) {
      this.portrait = portrait;
      this.zig.home.copy(portrait ? SPOT.ziggyPortrait : SPOT.ziggy);
      if (!this.zig.target && this.mode === 'atelier') this.zig.pos.copy(this.zig.home);
    }
    this.camera.fov = portrait ? 46 : 38;
    this.applyOffset();
    this.frameFor(this.mode);
  }

  private applyOffset() {
    const { w, h } = this.size;
    const dx = (this.insets.left - this.insets.right) / 2;
    const dy = (this.insets.top - this.insets.bottom) / 2;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) this.camera.setViewOffset(w, h, -dx, -dy, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  /** The HUD covers the edges: frame the creature in the free part (CSS px). */
  setInsets(i: { top: number; bottom: number; left: number; right: number }) {
    const o = this.insets;
    if (Math.abs(i.top - o.top) < 2 && Math.abs(i.bottom - o.bottom) < 2 && Math.abs(i.left - o.left) < 2 && Math.abs(i.right - o.right) < 2) return;
    this.insets = { ...i };
    this.applyOffset();
  }

  private frameFor(mode: Mode) {
    const a = this.actor;
    const ht = Math.max(1.4, (a?.height ?? 1.6) + 0.15);
    const halfH = Math.max(1.0, ht * 0.58);
    const hw = (a?.halfWidth ?? 0.6) + 0.55;
    if (mode === 'atelier') {
      if (this.portrait) this.want = { c: V(0.38, halfH * 0.95, 0.0), w: Math.max(1.62, hw + 0.35), h: halfH * 1.1 };
      else this.want = { c: V(0.8, halfH * 0.95, 0.1), w: Math.max(3.0, hw + 1.6), h: Math.max(1.4, halfH * 1.2) };
    } else if (mode === 'alive') this.want = this.portrait ? { c: V(2.5, 1.9, 1.0), w: 2.6, h: 2.0 } : { c: V(2.7, 1.55, 0.9), w: 4.6, h: 2.3 };
    else this.want = this.portrait ? { c: V(0.1, 0.62, 0.1), w: 2.0, h: 1.3 } : { c: V(0.1, 1.05, -0.1), w: 3.6, h: 1.6 };
  }

  private updateCamera(dt: number, t: number) {
    const f = this.frame;
    const w = this.want;
    const k = 1 - Math.exp(-dt * 3.2);
    f.c.lerp(w.c, k);
    f.w += (w.w - f.w) * k;
    f.h += (w.h - f.h) * k;
    const vf = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const safeV = Math.max(0.4, (this.size.h - this.insets.top - this.insets.bottom) / this.size.h);
    const safeH = Math.max(0.4, (this.size.w - this.insets.left - this.insets.right) / this.size.w);
    const tv = Math.tan(vf) * safeV;
    const th = Math.tan(vf) * this.camera.aspect * safeH;
    const dist = Math.max(2.4, f.h / tv, f.w / th);
    const pitch = 0.16;
    const yaw = this.camYaw + (this.reduce ? 0 : Math.sin(t * 0.13) * 0.025);
    this.camera.position.set(f.c.x + Math.sin(yaw) * Math.cos(pitch) * dist, f.c.y + Math.sin(pitch) * dist, f.c.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    this.camera.lookAt(f.c);
    if (this.shake > 0) {
      this.camera.position.x += Math.sin(t * 70) * 0.02 * this.shake;
      this.camera.position.y += Math.cos(t * 63) * 0.015 * this.shake;
    }
  }

  /* ───────────────────────── The creature ───────────────────────── */

  get creature(): Creature | null {
    return this.actor?.recipe ?? null;
  }

  private makeActor(c: Creature) {
    return new CreatureActor(c, { lowPower: this.lowPower, env: this.env, reduce: this.reduce });
  }

  private swap(c: Creature): CreatureActor {
    const old = this.actor;
    const a = this.makeActor(c);
    a.onEvent = (e) => this.onActorEvent(a, e);
    if (old) {
      a.root.position.copy(old.root.position);
      a.root.rotation.copy(old.root.rotation);
      this.scene.remove(old.root);
      old.dispose();
    } else {
      a.root.position.copy(SPOT.stage);
      a.root.rotation.y = STAGE_YAW;
    }
    this.actor = a;
    this.scene.add(a.root);
    if (this.zig.costume) this.dressZiggy(false);
    this.frameFor(this.mode);
    return a;
  }

  private onActorEvent(a: CreatureActor, e: 'sneeze' | 'land' | 'hatLand' | 'step') {
    if (a !== this.actor) return;
    if (e === 'sneeze') {
      const m = a.anchor('mouth');
      this.fx.emit(m, { tex: fxTex.star(), color: [COLORS[a.recipe.color].hex, COLORS[a.recipe.accent].hex, '#ffffff'], count: this.lowPower ? 14 : 26, spread: 2.6, up: 1.4, gravity: 3, life: 1.1, size: 0.16, spin: 6, drag: 1.5 });
      this.fx.emit(m, { tex: fxTex.puff(), color: '#ffffff', count: 5, spread: 0.8, up: 0.4, life: 0.9, size: 0.5, grow: 1.5, opacity: 0.8 });
      this.ziggy.userData.rig.cue('giggle');
      this.audio.giggle(1.2);
    }
    if (e === 'land' || e === 'hatLand') {
      this.audio.plop(e === 'hatLand' ? 1.4 : 0.8);
      this.dust(a.root.position, 6);
    }
  }

  private dust(at: THREE.Vector3, n: number) {
    this.fx.emit(at.clone().add(V(0, 0.05, 0)), { tex: fxTex.puff(), color: '#fff6ea', count: n, spread: 1.6, up: 0.35, life: 0.8, size: 0.35, grow: 1.2, opacity: 0.85, drag: 2 });
  }

  /** First creature: Ziggy pulls the lever himself and it pops out of the tube. */
  intro(c: Creature) {
    this.wait(this.reduce ? 0.2 : 0.7, () => this.pullLever(c, true));
  }

  /** A part changed (tap in the drawer): plop, sound, a little discovery. */
  setPart(c: Creature, changed: LookKey[], cat: CategoryId) {
    this.touch();
    if (this.mode !== 'atelier') this.backToAtelier(true);
    const old = this.actor?.recipe;
    const a = this.swap(c);
    const colorOnly = changed.every((k) => k === 'color' || k === 'accent' || k === 'pattern');
    if (colorOnly) {
      if (old && changed.includes('color')) a.fadeFrom(COLORS[old.color].hex);
      a.squish(0.8);
      this.colorPouf(a);
    } else a.pop(changed);
    const n = changed.includes('legs') ? c.legs : changed.includes('eyes') ? c.eyes : changed.includes('size') ? c.size : 1;
    this.audio.part(cat, n);
    if (!colorOnly) this.wait(0.04, () => this.audio.plop(1 + Math.random() * 0.2));
    const key = changed[0];
    const cue = key ? DISCOVER[key] : undefined;
    if (cue) this.wait(colorOnly ? 0 : 0.35, () => this.actor === a && a.cue(cue));
    if (key === 'mouth') this.wait(0.3, () => this.speak(a));
    // Ziggy reacts: a nod, a giggle, a cheer.
    const rig = this.ziggy.userData.rig;
    if (!rig.busy) rig.cue((['nod', 'giggle', 'cheer'] as const)[Math.floor(Math.random() * 3)]);
    this.sparkle(a);
  }

  /** The child's name dice: the creature says "that's me!". */
  rename() {
    this.touch();
    const a = this.actor;
    if (!a) return;
    a.cue('hop');
    this.speak(a, true);
  }

  private colorPouf(a: CreatureActor) {
    const c = a.anchor('center');
    this.fx.emit(c, { tex: fxTex.puff(), color: [COLORS[a.recipe.color].hex, COLORS[a.recipe.accent].hex], count: this.lowPower ? 8 : 16, spread: 2.2, up: 0.8, life: 0.9, size: 0.45, grow: 1.2, opacity: 0.9, drag: 2.2, radius: 0.3 });
  }

  private sparkle(a: CreatureActor) {
    const top = a.anchor('top');
    this.fx.emit(top, { tex: fxTex.star(), color: ['#fff6b0', '#ffffff', '#ffd1ec'], count: this.lowPower ? 5 : 9, spread: 1.6, up: 1.2, gravity: 2, life: 0.8, size: 0.12, spin: 5 });
  }

  /** Its own voice, mouth moving. */
  private speak(a: CreatureActor, excited = false) {
    const len = this.audio.voice(voiceOf(a.recipe), excited);
    a.talk(Math.max(0.4, len || 0.6));
  }

  /** Surprise! The lever, the machine bubbles and shakes, and the new one plops out. */
  surprise(c: Creature) {
    this.touch();
    if (this.mode !== 'atelier') this.backToAtelier(true);
    this.pullLever(c, false);
  }

  private pullLever(c: Creature, first: boolean) {
    this.lever = { t: 0, pulling: true };
    this.audio.machine();
    this.shake = this.reduce ? 0 : 1;
    const rig = this.ziggy.userData.rig;
    rig.cue(first ? 'cheer' : 'jump');
    // Bubbles and springs out of the funnel right away (< 100 ms).
    this.fx.emit(this.factory.funnel, { tex: fxTex.bubble(), color: RAINBOW, count: this.lowPower ? 8 : 14, spread: 1.2, up: 1.6, life: 1.6, size: 0.28, drag: 0.6 });
    const old = this.actor;
    if (old) {
      // The old one is sucked up the tube in a puff of confetti.
      old.cue('spin');
      this.wait(0.25, () => {
        if (this.actor !== old) return;
        this.confetti(old.anchor('center'), 0.7);
        old.root.visible = false;
      });
    }
    this.wait(this.reduce ? 0.3 : 0.6, () => {
      this.shake = 0;
      this.audio.whoosh();
      const a = this.swap(c);
      a.root.visible = true;
      a.root.rotation.y = STAGE_YAW;
      // Out of the tube, an arc down to the turntable, PLOP.
      const from = SPOT.tubeMouth.clone();
      const to = SPOT.stage.clone();
      a.root.position.copy(from);
      a.root.scale.setScalar(0.3);
      this.steps = [];
      this.run([
        {
          dur: this.reduce ? 0.2 : 0.45,
          tick: (k) => {
            const e = easeInOut(k);
            a.root.position.lerpVectors(from, to, e);
            a.root.position.y += Math.sin(k * Math.PI) * 0.4;
            a.root.scale.setScalar(0.3 + 0.7 * easeOut(k));
          },
          end: () => {
            a.root.position.copy(to);
            a.root.scale.setScalar(1);
            a.pop(['all'], 0.05);
            a.squish(1.4);
            this.audio.plop(0.9);
            this.confetti(a.anchor('center'), 1);
            this.dust(to, 8);
            this.wait(0.45, () => {
              if (this.actor !== a) return;
              a.cue('hop');
              this.speak(a, true);
              this.cb.onArrive();
              if (!first) this.cb.onSay('surprise');
              rig.cue('giggle');
            });
          },
        },
      ]);
    });
  }

  private confetti(at: THREE.Vector3, k: number) {
    this.audio.confetti();
    this.fx.emit(at, { tex: fxTex.confetti(), color: RAINBOW, count: Math.round((this.lowPower ? 26 : 50) * k), spread: 4, up: 2.8, gravity: 4, life: 1.6, size: 0.13, spin: 10, drag: 1.2, radius: 0.3 });
    this.fx.emit(at, { tex: fxTex.puff(), color: RAINBOW, count: Math.round(8 * k), spread: 2, up: 0.6, life: 1.0, size: 0.6, grow: 1.4, opacity: 0.75, drag: 2, radius: 0.3 });
  }

  /* ───────────────────────── "Donne-lui vie !" ───────────────────────── */

  alive() {
    this.touch();
    const a = this.actor;
    if (!a) return;
    if (this.mode === 'parade') this.endParade();
    this.steps = [];
    this.setMode('alive');
    const c = a.recipe;
    const moves = movesOf(c);
    const rig = this.ziggy.userData.rig;
    this.audio.fanfare();
    this.cb.onSay('alive');
    rig.cue('cheer');
    // Ziggy goes to watch in the meadow.
    this.zig.target = V(4.1, 0.02, -0.4);
    const seq: Step[] = [
      {
        dur: 0.8,
        start: () => {
          a.cue('hop');
          this.speak(a, true);
          this.fx.emit(a.anchor('top'), { tex: fxTex.star(), color: ['#fff6b0', '#ffffff'], count: 14, spread: 2, up: 1.5, life: 1, size: 0.14, spin: 6 });
        },
      },
    ];
    for (const m of moves) seq.push(...this.moveSteps(a, m));
    seq.push(...this.sneezeSteps(a), ...this.danceSteps(a), ...this.homeSteps(a));
    this.run(seq, () => this.setMode('atelier'));
  }

  private ground(p: THREE.Vector3) {
    // The workshop floor is a hair above the meadow; the turntable a bit more.
    const onStage = Math.hypot(p.x - SPOT.stage.x, p.z - SPOT.stage.z) < 1.45;
    return onStage ? SPOT.stage.y : p.z < 2.2 && Math.abs(p.x) < 4.2 && p.z > -4 ? 0.04 : 0;
  }

  /** Walk (or hop) from where it is to `to`, facing the way. */
  private goTo(a: CreatureActor, to: THREE.Vector3, dur: number, hop = false): Step {
    let from = V();
    return {
      dur,
      start: () => {
        from = a.root.position.clone();
        a.gait.walk = hop ? 0 : 0.9;
      },
      tick: (k) => {
        const e = easeInOut(k);
        const p = V().lerpVectors(from, to, e);
        p.y = this.ground(p) + (hop ? Math.sin(k * Math.PI) * 0.8 : 0);
        const d = V().subVectors(to, from);
        if (d.lengthSq() > 0.01) a.root.rotation.y = lerpAngle(a.root.rotation.y, Math.atan2(d.x, d.z), 0.15);
        a.root.position.copy(p);
      },
      end: () => {
        a.gait.walk = 0;
        if (hop) {
          a.squish(1);
          this.audio.plop(0.8);
        }
      },
    };
  }

  private loopPath(center: THREE.Vector3, r: number, rz: number, a0: number) {
    return (k: number) => {
      const ang = a0 + k * Math.PI * 2;
      return V(center.x + Math.cos(ang) * r, 0, center.z + Math.sin(ang) * rz);
    };
  }

  private moveSteps(a: CreatureActor, m: MoveKind): Step[] {
    const rig = this.ziggy.userData.rig;
    const say = () => this.cb.onSay(m);
    const M = SPOT.meadow;
    const r = this.reduce ? 0.6 : 1;
    if (m === 'walk' || m === 'pogo' || m === 'bounce') {
      const path = this.loopPath(M, 1.5, 0.75, Math.PI);
      let stepAcc = 0;
      return [
        this.goTo(a, path(0), 1.0, m !== 'walk'),
        {
          dur: 3.6 * r,
          start: () => {
            say();
            if (m === 'walk') a.gait.walk = 1;
            if (m === 'pogo') a.gait.pogo = 1;
            if (m === 'bounce') a.gait.walk = 1;
            this.zig.imitate = m === 'walk' ? 1 : 2;
          },
          tick: (k, dt) => {
            const p = path(k);
            const q = path(Math.min(1, k + 0.01));
            p.y = this.ground(p);
            a.root.position.copy(p);
            a.root.rotation.y = lerpAngle(a.root.rotation.y, Math.atan2(q.x - p.x, q.z - p.z), 0.2);
            stepAcc += dt;
            if (stepAcc > (m === 'walk' ? 0.28 : 0.5)) {
              stepAcc = 0;
              this.audio.step(m === 'walk' ? 1 + (a.recipe.legs % 3) * 0.1 : 0.7);
              if (m !== 'walk') this.dust(a.root.position, 2);
            }
          },
          end: () => {
            a.gait.walk = 0;
            a.gait.pogo = 0;
            this.zig.imitate = 0;
          },
        },
      ];
    }
    if (m === 'flutter') {
      return [
        {
          dur: 1.6,
          start: () => {
            say();
            a.cue('tryFly');
            this.zig.imitate = 3;
          },
        },
        { dur: 1.6, start: () => a.cue('tryFly'), end: () => (this.zig.imitate = 0) },
      ];
    }
    if (m === 'fly') {
      const C = V(2.4, 2.3, 1.2);
      let from = V();
      return [
        {
          dur: 0.9,
          start: () => {
            from = a.root.position.clone();
            a.gait.fly = 1;
            say();
            this.zig.imitate = 3;
            rig.cue('cheer');
          },
          tick: (k) => {
            const to = V(C.x + 1.6, C.y, C.z);
            a.root.position.lerpVectors(from, to, easeInOut(k));
          },
        },
        {
          dur: 4.0 * r,
          tick: (k) => {
            const ang = k * Math.PI * 2;
            const p = V(C.x + Math.cos(ang) * 1.6, C.y + Math.sin(ang * 2) * 0.35, C.z + Math.sin(ang) * 0.9);
            a.root.position.copy(p);
            a.root.rotation.y = lerpAngle(a.root.rotation.y, Math.atan2(-Math.sin(ang), Math.cos(ang) * 0.6), 0.2);
            if (Math.random() < 0.1) this.fx.emit(p, { tex: fxTex.dot(), color: '#ffffff', count: 1, spread: 0.3, up: -0.3, life: 0.6, size: 0.12, opacity: 0.8 });
          },
        },
        {
          dur: 0.9,
          start: () => (from = a.root.position.clone()),
          tick: (k) => {
            const to = V(M.x - 1.2, 0, M.z);
            a.root.position.lerpVectors(from, to, easeInOut(k));
            a.root.position.y = Math.max(this.ground(a.root.position), from.y * (1 - easeInOut(k)));
          },
          end: () => {
            a.gait.fly = 0;
            a.squish(1.2);
            this.audio.plop(0.8);
            this.dust(a.root.position, 6);
            this.zig.imitate = 0;
          },
        },
      ];
    }
    // Swim: hop into the pond, three dolphin jumps, hop out.
    const P = SPOT.pond;
    const from = V(P.x - 1.25, 0, P.z);
    const to = V(P.x + 1.25, 0, P.z);
    let arcs = 0;
    return [
      this.goTo(a, V(P.x - 2.5, 0, P.z + 0.3), 0.9, true),
      {
        dur: 3.6 * r,
        start: () => {
          say();
          a.gait.swim = 1;
          arcs = 0;
          this.zig.imitate = 1;
          this.splash(from);
        },
        tick: (k) => {
          const x = from.x + (to.x - from.x) * (0.5 - 0.5 * Math.cos(k * Math.PI * 2));
          const going = k < 0.5;
          const ph = (k * 3) % 1;
          const y = Math.sin(ph * Math.PI) * 0.75 - 0.32;
          a.root.position.set(x, y, P.z + Math.sin(k * Math.PI * 2) * 0.35);
          a.root.rotation.y = lerpAngle(a.root.rotation.y, going ? Math.PI / 2 : -Math.PI / 2, 0.15);
          const n = Math.floor(k * 3);
          if (n > arcs) {
            arcs = n;
            this.splash(a.root.position);
          }
        },
        end: () => {
          a.gait.swim = 0;
          this.zig.imitate = 0;
        },
      },
      this.goTo(a, V(M.x - 0.6, 0, M.z + 0.2), 0.9, true),
    ];
  }

  private splash(at: THREE.Vector3) {
    this.audio.splash();
    const p = V(at.x, 0.1, at.z);
    this.fx.emit(p, { tex: fxTex.dot(), color: ['#bfeaff', '#ffffff', '#7fd3ff'], count: this.lowPower ? 10 : 20, spread: 2, up: 2.6, gravity: 7, life: 0.9, size: 0.14 });
    this.fx.emit(p, { tex: fxTex.bubble(), color: '#ffffff', count: 4, spread: 0.8, up: 0.8, life: 1.2, size: 0.18 });
  }

  private sneezeSteps(a: CreatureActor): Step[] {
    return [
      {
        dur: 1.7,
        start: () => {
          a.lookAt(this.camera.position);
          a.root.rotation.y = lerpAngle(a.root.rotation.y, 0, 1);
          a.cue('sneeze');
          this.audio.sneeze(voiceOf(a.recipe));
        },
        end: () => this.cb.onSay('sneeze'),
      },
    ];
  }

  private danceSteps(a: CreatureActor): Step[] {
    const rig = this.ziggy.userData.rig;
    let noteT = 0;
    return [
      {
        dur: 3.0,
        start: () => {
          this.cb.onSay('dance');
          rig.idle = 'dance';
          a.gait.walk = 0.35;
          this.zig.imitate = 0;
        },
        tick: (k, dt) => {
          a.root.rotation.y = Math.sin(k * Math.PI * 4) * 0.6;
          if (Math.floor(k * 6) !== Math.floor((k - dt / 3) * 6)) a.cue('hop');
          noteT += dt;
          if (noteT > 0.35) {
            noteT = 0;
            this.fx.emit(a.anchor('top'), { tex: fxTex.note(), color: RAINBOW, count: 1, spread: 1, up: 0.9, life: 1.3, size: 0.22 });
          }
        },
        end: () => {
          rig.idle = 'calm';
          a.gait.walk = 0;
          rig.cue('cheer');
        },
      },
    ];
  }

  private homeSteps(a: CreatureActor): Step[] {
    return [
      {
        dur: 0.1,
        start: () => {
          this.zig.target = this.zig.home.clone();
          this.setMode('atelier');
        },
      },
      this.goTo(a, SPOT.stage.clone(), 1.1, true),
      {
        dur: 0.3,
        tick: () => (a.root.rotation.y = lerpAngle(a.root.rotation.y, STAGE_YAW, 0.2)),
        end: () => {
          a.root.position.copy(SPOT.stage);
          a.root.rotation.y = STAGE_YAW;
        },
      },
    ];
  }

  /** Back to the workshop at once (any tap during a show): a puff, and it's on the turntable. */
  backToAtelier(instant = false) {
    if (this.mode === 'parade') this.endParade();
    const a = this.actor;
    this.steps = [];
    if (a) {
      a.gait = { walk: 0, fly: 0, swim: 0, pogo: 0 };
      if (instant && a.root.position.distanceTo(SPOT.stage) > 0.1) {
        this.dust(a.root.position, 5);
        a.root.position.copy(SPOT.stage);
        a.root.rotation.y = STAGE_YAW;
        a.root.scale.setScalar(1);
        a.root.visible = true;
        this.dust(SPOT.stage, 5);
      }
    }
    this.ziggy.userData.rig.idle = 'calm';
    this.zig.target = this.zig.home.clone();
    this.zig.imitate = 0;
    this.setMode('atelier');
  }

  private setMode(m: Mode) {
    if (this.mode === m) return;
    this.mode = m;
    this.frameFor(m);
    this.cb.onMode(m);
  }

  private run(steps: Step[], done?: () => void) {
    this.steps = steps.slice();
    if (done) this.steps.push({ dur: 0, start: done });
    this.stepT = -1;
  }

  private wait(s: number, fn: () => void) {
    this.tasks.push({ at: this.time + s, fn });
  }

  /* ───────────────────────── Counting, tickles, gags ───────────────────────── */

  /** "Let's count together!": the legs (or eyes, arms) light up one by one with a pip. */
  countAlong(kind: 'legs' | 'eyes' | 'arms', gap = 0.6) {
    this.touch();
    const a = this.actor;
    if (!a) return;
    const n = a.count(kind);
    for (let i = 0; i < n; i++)
      this.wait(0.2 + i * gap, () => {
        if (this.actor !== a) return;
        a.highlight(kind, i);
        this.audio.count(i);
        this.cb.onCount(i + 1, n, kind);
      });
    if (n === 0) this.cb.onCount(0, 0, kind);
  }

  /** Tap on the creature: giggle and squash; five quick taps: a pirouette. */
  tickle() {
    const a = this.actor;
    if (!a) return;
    this.touch();
    const now = this.time;
    this.tickles = this.tickles.filter((t) => now - t < 2.2);
    this.tickles.push(now);
    a.squish(1.1);
    if (this.tickles.length >= 5) {
      this.tickles = [];
      a.cue('spin');
      this.audio.fanfare();
      this.fx.emit(a.anchor('top'), { tex: fxTex.heart(), color: ['#ff6fa8', '#ff9fc8'], count: 8, spread: 1.6, up: 1.4, life: 1.2, size: 0.2 });
    } else {
      a.cue('tickle');
      this.audio.giggle(voiceOf(a.recipe).pitch > 400 ? 1.3 : 0.9);
      if (Math.random() < 0.5) this.wait(0.2, () => this.speak(a));
      this.fx.emit(a.anchor('top'), { tex: fxTex.heart(), color: '#ff7ab8', count: 2, spread: 0.8, up: 1, life: 1, size: 0.16 });
    }
    if (this.tickles.length === 1) this.cb.onSay('tickle');
  }

  private touch() {
    this.lastTouch = this.time;
  }

  /** Nothing touched for a while: a little gag (never a reproach). */
  private idleGag() {
    const a = this.actor;
    if (!a || a.busy || this.mode !== 'atelier' || this.steps.length) return;
    const gags: (() => void)[] = [
      () => {
        a.cue('yawn');
        this.audio.voice({ ...voiceOf(a.recipe), syllables: 1 });
      },
      () => {
        if (a.recipe.legs > 1) a.cue('scratch');
        else a.cue('wiggle');
      },
      () => {
        a.cue('sneeze');
        this.audio.sneeze(voiceOf(a.recipe));
      },
      () => a.cue('peek'),
      () => {
        this.ziggy.userData.rig.cue('wave');
        a.cue('wave');
      },
    ];
    gags[this.gagN++ % gags.length]();
  }

  /* ───────────────────────── Ziggy dresses up ───────────────────────── */

  /** "Ziggy, become it!": he puts on its hat, horns, wings and tail, and imitates it. */
  disguise() {
    this.touch();
    const on = !this.zig.costume;
    this.dressZiggy(on);
    const rig = this.ziggy.userData.rig;
    if (on && this.actor) {
      this.cb.onSay('disguise');
      this.zig.showOff = 3.2;
      rig.cue('jump');
      this.confetti(this.ziggy.position.clone().add(V(0, 1.2, 0)), 0.6);
      const v = voiceOf(this.actor.recipe);
      this.wait(0.5, () => this.audio.voice({ ...v, pitch: v.pitch * 1.15 }, true));
      const m = movesOf(this.actor.recipe)[0];
      this.zig.imitate = m === 'walk' ? 1 : m === 'fly' || m === 'flutter' ? 3 : 2;
      this.wait(2.6, () => (this.zig.imitate = 0));
    } else rig.cue('giggle');
  }

  get disguised() {
    return Boolean(this.zig.costume);
  }

  private dressZiggy(on: boolean) {
    const model = this.ziggy.userData.model;
    if (this.zig.costume) {
      for (const o of this.zig.costume) {
        o.parent?.remove(o);
        o.traverse((x) => (x as THREE.Mesh).isMesh && (x as THREE.Mesh).geometry.dispose());
      }
      for (const m of this.zig.costumeKit?.all ?? []) m.dispose();
      this.zig.costume = null;
      this.zig.costumeKit = null;
    }
    if (!on || !this.actor) return;
    const p = costumePieces(this.actor.recipe, { lowPower: this.lowPower, env: this.env, reduce: this.reduce });
    const list: THREE.Object3D[] = [];
    if (p.hat) {
      p.hat.group.position.y = 0.02;
      model.hatAnchor.add(p.hat.group);
      list.push(p.hat.group);
    }
    p.tops.forEach((t, i) => {
      const side = i === 0 ? -1 : 1;
      t.position.set(side * 0.3, -0.06, 0);
      t.rotation.z = -side * 0.35;
      model.hatAnchor.add(t);
      list.push(t);
    });
    p.wings.forEach((w, i) => {
      const side = i === 0 ? -1 : 1;
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.12, 0.98, -0.2);
      pivot.rotation.y = -side * 0.6;
      pivot.add(w);
      pivot.userData.side = side;
      pivot.userData.wing = true;
      model.body.add(pivot);
      list.push(pivot);
    });
    if (p.tail) {
      p.tail.position.set(0, 0.62, -0.24);
      p.tail.scale.setScalar(1.2);
      p.tail.userData.tail = true;
      model.body.add(p.tail);
      list.push(p.tail);
    }
    this.zig.costume = list;
    this.zig.costumeKit = p.kit;
  }

  /* ───────────────────────── The Parade ───────────────────────── */

  startParade(list: Creature[]) {
    this.touch();
    this.backToAtelier(true);
    this.endParade();
    const max = this.lowPower ? 5 : 7;
    const pick = list.slice(0, max);
    if (!pick.length) return;
    const actors = pick.map((c) => {
      const a = new CreatureActor(c, { lowPower: this.lowPower, env: this.env, reduce: this.reduce, shadows: !this.lowPower });
      this.scene.add(a.root);
      a.root.scale.setScalar(0.72);
      return a;
    });
    this.parade = { actors, ids: pick.map((c) => c.id), t: 0, selected: -1 };
    if (this.actor) this.actor.root.visible = false;
    // Ziggy leads the parade from the middle of the turntable.
    this.zig.target = SPOT.stage.clone();
    this.ziggy.userData.rig.idle = 'dance';
    this.setMode('parade');
    this.audio.fanfare();
    this.cb.onSay('parade');
    this.confetti(V(0.5, 1.6, 0.5), 1);
  }

  /** One of the Parade comes forward and says hello. */
  paradeSelect(id: string) {
    const p = this.parade;
    if (!p) return;
    const i = p.ids.indexOf(id);
    p.selected = i;
    const a = p.actors[i];
    if (!a) return;
    a.cue('spin');
    const len = this.audio.voice(voiceOf(a.recipe), true);
    a.talk(len || 0.6);
    this.fx.emit(a.anchor('top'), { tex: fxTex.heart(), color: '#ff7ab8', count: 5, spread: 1, up: 1.2, life: 1, size: 0.2 });
  }

  endParade() {
    const p = this.parade;
    if (!p) return;
    for (const a of p.actors) {
      this.scene.remove(a.root);
      a.dispose();
    }
    this.parade = null;
    if (this.actor) this.actor.root.visible = true;
    this.zig.target = this.zig.home.clone();
    this.ziggy.userData.rig.idle = 'calm';
    if (this.mode === 'parade') this.setMode('atelier');
  }

  private updateParade(dt: number) {
    const p = this.parade;
    if (!p) return;
    p.t += dt * (this.reduce ? 0.03 : 0.055);
    const n = p.actors.length;
    const C = V(0.1, 0, -0.05);
    p.actors.forEach((a, i) => {
      const k = p.t + i / Math.max(n, 5);
      const ang = k * Math.PI * 2;
      const rx = this.portrait ? 1.75 : 2.6;
      const rz = this.portrait ? 1.15 : 1.3;
      const pos = V(C.x + Math.cos(ang) * rx, 0, C.z + Math.sin(ang) * rz);
      const moves = movesOf(a.recipe);
      const fly = moves[0] === 'fly';
      pos.y = this.ground(pos) + (fly ? 0.7 + Math.sin(this.time * 2 + i) * 0.15 : 0);
      a.root.position.copy(pos);
      const dir = Math.atan2(-Math.sin(ang) * rx, Math.cos(ang) * rz);
      a.root.rotation.y = lerpAngle(a.root.rotation.y, i === p.selected ? 0 : dir, 0.1);
      a.gait.walk = fly ? 0 : moves[0] === 'pogo' ? 0 : 0.8;
      a.gait.pogo = moves[0] === 'pogo' ? 0.8 : 0;
      a.gait.fly = fly ? 1 : 0;
      a.lookAt(this.camera.position);
      a.update(dt);
    });
  }

  /* ───────────────────────── Pictures ───────────────────────── */

  /**
   * A square picture of the creature (and Ziggy), rendered at `px` without
   * touching the screen (the canvas is drawn back before the browser shows it).
   */
  snapshot(px: number, withZiggy = true, type: 'image/jpeg' | 'image/png' = 'image/jpeg', quality = 0.9): string {
    const a = this.actor;
    if (!a) return '';
    a.root.updateMatrixWorld(true);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    const box = new THREE.Box3().setFromObject(a.root);
    if (withZiggy) box.expandByObject(this.ziggy);
    const c = box.getCenter(V());
    const sz = box.getSize(V());
    const r = Math.max(sz.x, sz.y) * 0.62 + 0.2;
    const dist = r / Math.tan(THREE.MathUtils.degToRad(16));
    cam.position.set(c.x + Math.sin(0.12) * dist, c.y + dist * 0.16, c.z + Math.cos(0.12) * dist);
    cam.lookAt(c);
    const ratio = this.renderer.getPixelRatio();
    const was = this.ziggy.visible;
    this.ziggy.visible = withZiggy;
    const fxVis = this.fx.group.visible;
    this.fx.group.visible = false;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(px, px, false);
    this.renderer.render(this.scene, cam);
    let url = '';
    try {
      url = this.canvas.toDataURL(type, quality);
    } catch {
      url = '';
    }
    this.ziggy.visible = was;
    this.fx.group.visible = fxVis;
    this.renderer.setPixelRatio(ratio);
    this.fit();
    this.renderer.render(this.scene, this.camera);
    if (withZiggy) {
      this.audio.shutter();
      a.cue('hop');
      this.ziggy.userData.rig.cue('cheer');
    }
    return url;
  }

  /**
   * Line art of the creature for a colouring page: the creature alone, drawn
   * with its normals, then its outlines found by an edge filter (black on white).
   */
  lineArt(px = 900): string {
    const a = this.actor;
    if (!a) return '';
    const hidden: THREE.Object3D[] = [];
    for (const o of this.scene.children) if (o !== a.root && o.visible && !(o as THREE.Light).isLight) {
      o.visible = false;
      hidden.push(o);
    }
    const saved = { pos: a.root.position.clone(), rot: a.root.rotation.y, fog: this.scene.fog };
    a.root.position.set(0, 0, 0);
    a.root.rotation.y = -0.35;
    a.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(a.root);
    const c = box.getCenter(V());
    const sz = box.getSize(V());
    const r = Math.max(sz.x, sz.y) * 0.56 + 0.05;
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const dist = r / Math.tan(THREE.MathUtils.degToRad(15));
    cam.position.set(c.x, c.y + dist * 0.1, c.z + dist);
    cam.lookAt(c);
    const normal = new THREE.MeshNormalMaterial();
    this.scene.overrideMaterial = normal;
    this.scene.fog = null;
    const ratio = this.renderer.getPixelRatio();
    const tone = this.renderer.toneMapping;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(px, px, false);
    const clear = this.renderer.getClearColor(new THREE.Color());
    const alpha = this.renderer.getClearAlpha();
    this.renderer.setClearColor('#ffffff', 1);
    this.renderer.render(this.scene, cam);
    const src = document.createElement('canvas');
    src.width = src.height = px;
    src.getContext('2d')!.drawImage(this.canvas, 0, 0, px, px);
    // Restore the scene.
    this.scene.overrideMaterial = null;
    normal.dispose();
    this.scene.fog = saved.fog;
    for (const o of hidden) o.visible = true;
    a.root.position.copy(saved.pos);
    a.root.rotation.y = saved.rot;
    this.renderer.setClearColor(clear, alpha);
    this.renderer.toneMapping = tone;
    this.renderer.setPixelRatio(ratio);
    this.fit();
    this.renderer.render(this.scene, this.camera);
    return edgesToLines(src);
  }

  /* ───────────────────────── Input ───────────────────────── */

  private toWorld(cx: number, cy: number): THREE.Vector3 {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const at = this.actor?.root.position ?? SPOT.stage;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(V()).negate(), at.clone().add(V(0, 0.8, 0.9)));
    const out = V();
    return this.ray.ray.intersectPlane(plane, out) ?? at.clone();
  }

  /** The eyes follow a point of the screen (finger, mouse, TV focus). */
  lookAtScreen(x: number, y: number) {
    this.pointer = this.toWorld(x, y);
    this.pointerAt = this.time;
    const r = this.canvas.getBoundingClientRect();
    this.ziggy.userData.rig.lookAt(((x - r.left) / r.width) * 2 - 1, -(((y - r.top) / r.height) * 2 - 1));
  }

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    this.lookAtScreen(e.clientX, e.clientY);
  };

  private onMove = (e: PointerEvent) => {
    this.lookAtScreen(e.clientX, e.clientY);
  };

  private onLeave = () => {
    this.pointer = null;
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14) return;
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const targets: THREE.Object3D[] = [this.ziggy, this.factory.leverHit];
    if (this.actor?.root.visible) targets.push(this.actor.hitObject());
    if (this.parade) targets.push(...this.parade.actors.map((a) => a.hitObject()));
    const hit = this.ray.intersectObjects(targets, true)[0];
    if (!hit) {
      if (this.mode === 'alive') this.backToAtelier(true);
      return;
    }
    const isIn = (root: THREE.Object3D) => {
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (o === root) return true;
      return false;
    };
    if (isIn(this.factory.leverHit)) this.cb.onLever();
    else if (isIn(this.ziggy)) this.cb.onZiggy();
    else if (this.parade) {
      const i = this.parade.actors.findIndex((a) => isIn(a.hitObject()));
      if (i >= 0) this.paradeSelect(this.parade.ids[i]);
    } else this.tickle();
  };

  private onVisibility = () => {
    this.hidden = document.hidden;
    if (this.hidden) this.audio.stopMusic();
    else this.audio.startMusic();
    this.clock.getDelta();
  };

  setMusic(on: boolean) {
    this.audio.setMusic(on);
  }

  /* ───────────────────────── Loop ───────────────────────── */

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    if (this.hidden) return;
    const dt = Math.min(0.1, raw) * this.timeScale;
    this.time += dt;
    this.step(dt, this.time);
    this.renderer.render(this.scene, this.camera);
    this.adaptResolution(raw);
  };

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
    }
  }

  private step(dt: number, t: number) {
    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      if (task.at <= t) {
        this.tasks.splice(i--, 1);
        task.fn();
      }
    }
    // Scripted steps.
    if (this.steps.length) {
      const s = this.steps[0];
      if (this.stepT < 0) {
        this.stepT = 0;
        s.start?.();
      }
      this.stepT += dt;
      const k = s.dur > 0 ? Math.min(1, this.stepT / s.dur) : 1;
      s.tick?.(k, dt);
      if (k >= 1) {
        s.end?.();
        if (this.steps[0] === s) this.steps.shift();
        this.stepT = -1;
      }
    }

    // Lever.
    const lv = this.lever;
    if (lv.pulling) {
      lv.t = Math.min(1, lv.t + dt / 0.9);
      const k = lv.t < 0.25 ? easeOut(lv.t / 0.25) : 1 - easeInOut((lv.t - 0.25) / 0.75);
      this.factory.lever.rotation.x = -0.55 + k * 1.15;
      if (lv.t >= 1) lv.pulling = false;
    }
    this.factory.machine.position.x = -0.2 + (this.shake ? Math.sin(t * 60) * 0.03 : 0);
    this.factory.machine.scale.y = 1 + (this.shake ? Math.sin(t * 40) * 0.012 : 0);
    this.factory.update(dt, t, this.reduce);

    // Rainbow steam and bubbles.
    this.steamT += dt;
    if (this.steamT > (this.lowPower ? 0.5 : 0.3)) {
      this.steamT = 0;
      const i = Math.floor(t * 3) % this.factory.chimneys.length;
      this.fx.emit(this.factory.chimneys[i], { tex: fxTex.puff(), color: RAINBOW[Math.floor(t * 2) % RAINBOW.length], count: 1, spread: 0.3, up: 0.7, life: 2.6, size: 0.55, grow: 2.2, opacity: 0.7 });
    }
    this.bubbleT += dt;
    if (this.bubbleT > 1.6) {
      this.bubbleT = 0;
      this.fx.emit(this.factory.funnel, { tex: fxTex.bubble(), color: RAINBOW, count: 2, spread: 0.6, up: 0.7, life: 2.4, size: 0.22 });
    }
    this.fx.update(dt);

    // The creature.
    const a = this.actor;
    if (a) {
      const look = this.pointer && t - this.pointerAt < 4 ? this.pointer : this.mode === 'atelier' ? this.camera.position : null;
      a.lookAt(look ?? this.camera.position);
      a.update(dt);
      if (this.mode === 'atelier' && !this.steps.length && t - this.lastTouch > 7 && !a.busy) {
        this.lastTouch = t - 1.5;
        this.idleGag();
      }
    }
    this.updateParade(dt);
    this.updateZiggy(dt, t);
    this.updateCamera(dt, t);
  }

  private updateZiggy(dt: number, t: number) {
    const z = this.zig;
    const rig = this.ziggy.userData.rig;
    let walking = 0;
    if (z.target) {
      const d = V().subVectors(z.target, z.pos);
      d.y = 0;
      const dist = d.length();
      if (dist < 0.05) {
        z.target = null;
      } else {
        const sp = Math.min(dist, dt * 2.2);
        z.pos.addScaledVector(d.normalize(), sp);
        z.yaw = lerpAngle(z.yaw, Math.atan2(d.x, d.z), 0.15);
        walking = 1;
      }
    } else {
      // Between the creature and the child (and straight at the child when showing off a costume).
      const a = this.actor;
      const at = a && a.root.visible ? a.root.position : SPOT.stage;
      const toCam = Math.atan2(this.camera.position.x - z.pos.x, this.camera.position.z - z.pos.z);
      const toIt = Math.atan2(at.x - z.pos.x, at.z - z.pos.z);
      const want = this.mode === 'parade' || z.showOff > 0 ? toCam : lerpAngle(toCam, toIt, 0.55);
      z.yaw = lerpAngle(z.yaw, want, 0.08);
    }
    z.showOff = Math.max(0, z.showOff - dt);
    // Imitation: marching on the spot, hopping, flapping.
    if (z.imitate === 1) walking = Math.max(walking, 0.7);
    if ((z.imitate === 2 || z.imitate === 3) && !rig.busy) rig.cue(z.imitate === 2 ? 'jump' : 'cheer');
    rig.walk = walking;
    this.ziggy.position.set(z.pos.x, this.ground(z.pos) + 0.01, z.pos.z);
    this.ziggy.rotation.y = z.yaw;
    if (this.pointer && t - this.pointerAt > 3) rig.lookAt(-0.3, 0);
    // Costume: wings flap, tail wags.
    if (z.costume)
      for (const o of z.costume) {
        if (o.userData.wing) o.rotation.y = -(o.userData.side as number) * (0.6 + Math.sin(t * (z.imitate === 3 ? 16 : 3)) * (z.imitate === 3 ? 0.6 : 0.15));
        if (o.userData.tail) o.rotation.y = Math.sin(t * 3) * 0.3;
      }
    rig.update(dt);
  }

  /** Lets the end-to-end test look inside (never used by the game itself). */
  debug() {
    return { mode: this.mode, steps: this.steps.length, creature: this.actor?.recipe ?? null, parade: this.parade?.actors.length ?? 0, disguised: this.disguised, lowPower: this.lowPower, ratio: this.renderer.getPixelRatio(), calls: this.renderer.info.render.calls };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.dispose();
    this.endParade();
    this.dressZiggy(false);
    this.actor?.dispose();
    this.fx.dispose();
    this.ziggy.userData.model.dispose();
    this.factory.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const x of mats) {
          for (const v of Object.values(x)) if (v instanceof THREE.Texture) v.dispose();
          x.dispose();
        }
      }
    });
    this.factory.dispose();
    disposeCreatureTextures();
    disposeFxTextures();
    this.disposeZiggyEnv();
    this.env.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}

/** Outlines from a normal-map picture: black lines where the surface turns sharply or ends. */
export function edgesToLines(src: HTMLCanvasElement): string {
  const w = src.width;
  const h = src.height;
  const g = src.getContext('2d')!;
  const d = g.getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const og = out.getContext('2d')!;
  const img = og.createImageData(w, h);
  const o = img.data;
  const at = (x: number, y: number, c: number) => d[(y * w + x) * 4 + c] / 255;
  const edge = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      let m = 0;
      for (let c = 0; c < 3; c++) {
        const gx = at(x + 1, y, c) - at(x - 1, y, c);
        const gy = at(x, y + 1, c) - at(x, y - 1, c);
        m += gx * gx + gy * gy;
      }
      if (m > 0.035) edge[y * w + x] = 1;
    }
  // Thicken the lines a little (crayon-friendly).
  const R = Math.max(1, Math.round(w / 450));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let dy = -R; dy <= R && !on; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && edge[yy * w + xx]) {
            on = 1;
            break;
          }
        }
      const i = (y * w + x) * 4;
      const v = on ? 30 : 255;
      o[i] = o[i + 1] = o[i + 2] = v;
      o[i + 3] = 255;
    }
  og.putImageData(img, 0, 0);
  return out.toDataURL('image/png');
}
