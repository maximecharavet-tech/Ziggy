import * as THREE from 'three';
import { Post } from '../kit/post';
import { createRenderer, studioEnvironment, disposeTree, glow, glowTex, labelSprite, mat, prefersLowPower } from '../kit/look';
import { makeNightSky, makePine, makeZiggy, PALETTE } from '../kit/models';
import { Puffs, Snowfall } from '../kit/world';
import { GameAudio } from '../kit/music';
import { rng } from '../kit/rng';
import { QUESTIONS_PER_RUN, planRun, speedFor, type LugeQuestion } from './questions';
import type { Band } from '../noel/missions';

export interface LugeState {
  index: number;
  question: LugeQuestion | null;
  lane: number;
  stars: number;
  finished: boolean;
  /** Distance (units) before the next gate, for the HUD. */
  gateIn: number | null;
}

export interface LugeCallbacks {
  onState: (s: LugeState) => void;
  onSay: (text: string, kind: 'question' | 'hint' | 'praise', question?: LugeQuestion) => void;
  onFinish: (stats: { correct: number; mistakes: number; total: number; durationMs: number; stars: number }) => void;
}

const LANES = [-2.8, 0, 2.8];
const SPAWN_Z = -90;

type Gate = THREE.Group & { userData: { q: LugeQuestion; done: boolean } };

function makeSled(): THREE.Group {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 2.1), mat('#d9443b'));
  deck.position.y = 0.42;
  deck.castShadow = true;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.12), mat('#b8322b'));
  back.position.set(0, 0.68, 0.98);
  g.add(deck, back);
  for (const x of [-0.55, 0.55]) {
    const runner = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 5, 16, Math.PI * 0.55), mat('#e9d38a'));
    runner.rotation.set(0, Math.PI / 2, Math.PI);
    runner.position.set(x, 1.05, -0.05);
    runner.scale.set(1.1, 0.75, 1);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), mat('#e9d38a'));
    post.position.set(x, 0.24, 0);
    g.add(runner, post);
  }
  return g;
}

/** A candy-cane arch with the answer on top. */
function makeGate(n: number, x: number): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 8), mat(k % 2 ? '#ffffff' : '#e2453c'));
      seg.position.set(side * 1.15, 0.21 + k * 0.42, 0);
      seg.castShadow = true;
      g.add(seg);
    }
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.13, 6, 18, Math.PI), mat('#3fbf6a'));
  arch.position.y = 2.52;
  g.add(arch);
  const sign = labelSprite(String(n), { size: 1.35, bg: '#fff8e6', fg: '#1d2a6b' });
  sign.position.y = 3.95;
  const halo = glow('#fff1a8', 2.4, 0.45);
  halo.position.y = 3.95;
  g.add(halo, sign);
  g.position.x = x;
  return g;
}

export class LugeGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private dropEnv: () => void = () => {};
  private post!: Post;
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
  private clock = new THREE.Clock();
  private raf = 0;
  private sled = new THREE.Group();
  private ziggy = makeZiggy({ accessory: 'santa', lowPower: prefersLowPower() });
  private pines: THREE.Group[] = [];
  private bumps: THREE.Mesh[] = [];
  private stars: THREE.Group[] = [];
  private gates: Gate[] = [];
  private finish: THREE.Group | null = null;
  private snow: Snowfall;
  private puffs = new Puffs(glowTex());
  private sparkles = new Puffs(glowTex());
  private audio = new GameAudio();
  private lowPower = prefersLowPower();
  private resize: ResizeObserver;
  private started = performance.now();

  private qs: LugeQuestion[];
  private index = 0;
  private lane = 1;
  private x = 0;
  private speed: number;
  private boost = 0;
  private paused = false;
  private finished = false;
  private stats = { correct: 0, mistakes: 0, stars: 0 };
  private nextStarIn = 6;
  private touchStart: { x: number; y: number } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    seed: number,
    band: Band,
    level: number,
    private locale: string,
    private cb: LugeCallbacks
  ) {
    this.renderer = createRenderer(canvas, { lowPower: this.lowPower });
    this.dropEnv = studioEnvironment(this.renderer, this.ziggy, 0.45);
    this.post = new Post(this.renderer, this.scene, this.camera, { enabled: !this.lowPower, strength: 0.4, radius: 0.5, threshold: 1.25 });
    this.snow = new Snowfall(this.lowPower ? 600 : 1300, 50, 20);
    this.qs = planRun(seed, band, level);
    this.speed = speedFor(band, level);
    this.build(seed);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas.parentElement ?? canvas);
    this.fit();
    window.addEventListener('keydown', this.onKey);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    this.spawnGate();
    this.loop();
  }

  private build(seed: number) {
    const s = this.scene;
    s.fog = new THREE.Fog('#1c2657', 25, 95);
    s.add(makeNightSky());
    s.add(new THREE.HemisphereLight('#8ea4f0', '#221c3a', 0.7));
    const moon = new THREE.DirectionalLight('#c3d0ff', 1.1);
    moon.position.set(-10, 25, 10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(this.lowPower ? 512 : 1024, this.lowPower ? 512 : 1024);
    Object.assign(moon.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
    s.add(moon);
    const warm = new THREE.PointLight('#ffb35c', 18, 14, 1.6);
    warm.position.set(0, 3, 2);
    s.add(warm);

    // The slope: a long, slightly tilted plane with soft banks.
    const geo = new THREE.PlaneGeometry(80, 220, 40, 110);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors: number[] = [];
    const a = new THREE.Color('#e4ebff');
    const b = new THREE.Color('#a9b9e6');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const bank = Math.max(0, Math.abs(x) - 6) ** 1.35 * 0.12;
      pos.setY(i, bank);
      const c = a.clone().lerp(b, Math.min(1, Math.abs(x) / 30 + (Math.abs(x) < 4.5 ? 0.12 : 0)));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, mat('#ffffff', { vertexColors: true }));
    ground.position.z = -80;
    ground.receiveShadow = true;
    s.add(ground);

    // Lane tracks to read the three lanes at a glance.
    for (const x of LANES) {
      const track = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 220), new THREE.MeshBasicMaterial({ color: '#c9d6ff', transparent: true, opacity: 0.35 }));
      track.rotation.x = -Math.PI / 2;
      track.position.set(x, 0.02, -80);
      s.add(track);
    }

    const r = rng(seed + 9);
    for (let i = 0; i < (this.lowPower ? 40 : 70); i++) {
      const p = makePine(0.9 + r() * 1.3);
      const side = r() < 0.5 ? -1 : 1;
      const x = side * (6.5 + r() * 22);
      p.position.set(x, Math.max(0, Math.abs(x) - 6) ** 1.35 * 0.12, -r() * 120 + 10);
      this.pines.push(p);
      s.add(p);
    }
    for (let i = 0; i < 18; i++) {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.6 + r() * 0.5, 8, 5), mat('#eef3ff'));
      bump.scale.y = 0.25;
      bump.position.set((r() - 0.5) * 11, 0, -r() * 120 + 10);
      this.bumps.push(bump);
      s.add(bump);
    }

    this.sled.add(makeSled());
    const z = this.ziggy;
    z.position.set(0, 0.36, 0.25);
    z.rotation.y = Math.PI; // facing down the slope (-Z)
    z.userData.rig.seated = true;
    this.sled.add(z);
    s.add(this.sled);
    s.add(this.snow.points, this.puffs.group, this.sparkles.group);
  }

  private fit() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.post?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 74 : 62;
    this.camera.updateProjectionMatrix();
  }

  private emit() {
    const gate = this.gates.find((g) => !g.userData.done);
    this.cb.onState({
      index: this.index,
      question: this.qs[this.index] ?? null,
      lane: this.lane,
      stars: this.stats.stars,
      finished: this.finished,
      gateIn: gate ? Math.max(0, Math.round(-gate.position.z)) : null,
    });
  }

  private spawnGate() {
    const q = this.qs[this.index];
    if (!q) return;
    const group = new THREE.Group() as Gate;
    q.options.forEach((n, i) => group.add(makeGate(n, LANES[i])));
    group.position.z = SPAWN_Z;
    group.userData = { q, done: false };
    this.gates.push(group);
    this.scene.add(group);
    this.cb.onSay(this.locale === 'fr' ? q.text.fr : q.text.en, 'question', q);
    this.emit();
  }

  /** Move to a lane (−1 left, +1 right) or straight to a lane index. */
  steer(dir: -1 | 1) {
    if (this.finished) return;
    this.lane = Math.max(0, Math.min(2, this.lane + dir));
    this.emit();
  }
  goLane(i: number) {
    this.lane = Math.max(0, Math.min(2, i));
    this.emit();
  }
  setPaused(p: boolean) {
    this.paused = p;
  }
  setMusic(on: boolean) {
    if (on) this.audio.startMusic();
    else this.audio.stopMusic();
  }

  private onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a' || k === 'q') this.steer(-1);
    else if (k === 'arrowright' || k === 'd') this.steer(1);
    else if (k === '1' || k === '2' || k === '3') this.goLane(Number(k) - 1);
    else return;
    e.preventDefault();
  };
  private onDown = (e: PointerEvent) => {
    this.touchStart = { x: e.clientX, y: e.clientY };
  };
  private onUp = (e: PointerEvent) => {
    const s = this.touchStart;
    this.touchStart = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 30) return this.steer(dx < 0 ? -1 : 1);
    // A tap: left third, middle, right third of the screen.
    const r = this.canvas.getBoundingClientRect();
    this.goLane(Math.min(2, Math.floor(((e.clientX - r.left) / r.width) * 3)));
  };

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.step(dt, this.clock.elapsedTime);
    this.post.render(dt);
  };

  private step(dt: number, t: number) {
    const v = this.paused ? 0 : this.finished ? Math.max(0, this.speed * 0.4) : this.speed + this.boost;
    this.boost = Math.max(0, this.boost - dt * 3);
    const dz = v * dt;

    // Sled: glide to the lane, lean into turns, little bumps.
    const tx = LANES[this.lane];
    const before = this.x;
    this.x += (tx - this.x) * Math.min(1, dt * 7);
    this.sled.position.x = this.x;
    this.sled.rotation.z = (this.x - before) * -3;
    this.sled.position.y = Math.abs(Math.sin(t * 9)) * 0.05 * (v > 0 ? 1 : 0);
    // The plush rides seated; its antennas wobble with the bumps on their own.
    this.ziggy.userData.rig.update(dt);

    // Scenery flows towards the camera and loops.
    for (const p of this.pines) {
      p.position.z += dz;
      if (p.position.z > 14) p.position.z -= 125;
    }
    for (const b of this.bumps) {
      b.position.z += dz;
      if (b.position.z > 10) {
        b.position.z -= 125;
        b.position.x = (Math.random() - 0.5) * 11;
      }
    }

    // Stars to collect between gates.
    this.nextStarIn -= dz;
    if (this.nextStarIn <= 0 && !this.finished) {
      this.nextStarIn = 9 + Math.random() * 6;
      const star = new THREE.Group();
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe066').multiplyScalar(1.6), toneMapped: false }));
      m.scale.set(1, 1.25, 0.45);
      star.add(m, glow('#ffe066', 1.6, 0.6));
      star.position.set(LANES[Math.floor(Math.random() * 3)], 1.1, SPAWN_Z * 0.7);
      this.stars.push(star);
      this.scene.add(star);
    }
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      s.position.z += dz;
      s.rotation.y += dt * 3;
      if (Math.abs(s.position.z) < 0.8 && Math.abs(s.position.x - this.x) < 1.1) {
        this.stats.stars++;
        this.audio.chime('pick');
        this.sparkles.emit(s.position.clone(), { color: '#ffe066', count: 10, up: 2, life: 0.7, size: 0.35, additive: true });
        this.scene.remove(s);
        this.stars.splice(i, 1);
        this.emit();
      } else if (s.position.z > 8) {
        this.scene.remove(s);
        this.stars.splice(i, 1);
      }
    }

    // Gates: crossing decides.
    for (const g of this.gates) {
      g.position.z += dz;
      if (!g.userData.done && g.position.z >= 0) {
        g.userData.done = true;
        const q = g.userData.q;
        const chosen = q.options[this.lane];
        const at = new THREE.Vector3(LANES[this.lane], 1.6, 0);
        if (chosen === q.answer) {
          this.stats.correct++;
          this.boost = 6;
          this.audio.chime('deliver');
          this.ziggy.userData.rig.cue('cheer');
          this.sparkles.emit(at, { color: '#9bf07f', count: 26, spread: 3, up: 3, life: 1.2, size: 0.4, additive: true });
          this.cb.onSay(this.locale === 'fr' ? ['Bravo !', 'Super !', 'Génial !'][this.index % 3] : ['Well done!', 'Great!', 'Awesome!'][this.index % 3], 'praise');
        } else {
          this.stats.mistakes++;
          this.audio.chime('oops');
          this.ziggy.userData.rig.cue('oops');
          this.puffs.emit(at, { color: '#ffffff', count: 14, spread: 2.5, up: 1.6, life: 1.2, size: 0.9 });
          this.cb.onSay(this.locale === 'fr' ? `Presque ! C’était ${q.answer}.` : `Almost! It was ${q.answer}.`, 'hint');
        }
        this.index++;
        if (this.index >= QUESTIONS_PER_RUN) this.arrive();
        else window.setTimeout(() => this.spawnGate(), 900);
        this.emit();
      }
    }
    this.gates = this.gates.filter((g) => {
      if (g.position.z > 14) {
        this.scene.remove(g);
        return false;
      }
      return true;
    });
    if (this.finish) {
      this.finish.position.z += dz;
      if (this.finish.position.z > 0 && !this.finished) {
        this.finished = true;
        this.audio.chime('star');
        for (let k = 0; k < 5; k++)
          window.setTimeout(() => this.sparkles.emit(new THREE.Vector3((k - 2) * 2, 4, -4), { color: ['#ffe066', '#ff7ab8', '#7fd0ff', '#9bf07f', '#ffffff'][k], count: 24, spread: 5, up: 3, life: 1.8, size: 0.45, additive: true }), k * 300);
        this.cb.onSay(this.locale === 'fr' ? 'Arrivée ! Quelle belle descente !' : 'Finish line! What a ride!', 'praise');
        this.emit();
        window.setTimeout(() => this.cb.onFinish({ ...this.stats, total: QUESTIONS_PER_RUN, durationMs: performance.now() - this.started }), 2600);
      }
    }

    this.snow.update(dt, t, new THREE.Vector3(0, 0, -15));
    // Snow also rushes past when we go fast.
    (this.snow.points.position as THREE.Vector3).z = (this.snow.points.position.z + dz * 0.6) % 20;
    this.puffs.update(dt);
    this.sparkles.update(dt);

    this.camera.position.set(this.x * 0.6, 3.4 + Math.sin(t * 2) * 0.05, 6.8);
    this.camera.lookAt(this.x * 0.8, 1.2, -8);
  }

  private arrive() {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4.5, 8), mat(PALETTE.purple));
      post.position.set(side * 5.5, 2.25, 0);
      g.add(post);
    }
    const banner = labelSprite(this.locale === 'fr' ? '🏁' : '🏁', { size: 2.2, bg: '#ffe066', fg: '#1d2a6b' });
    banner.position.y = 4.8;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.6, 0.2), mat('#ffe066', { emissive: new THREE.Color('#806020') }));
    bar.position.y = 4.4;
    g.add(bar, banner, glow('#ffe066', 6, 0.35));
    g.position.z = SPAWN_Z * 0.6;
    this.finish = g;
    this.scene.add(g);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    window.removeEventListener('keydown', this.onKey);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.audio.dispose();
    disposeTree(this.scene);
    this.dropEnv();
    this.post.dispose();
    this.renderer.dispose();
  }
}
