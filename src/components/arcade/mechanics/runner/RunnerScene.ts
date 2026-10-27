/**
 * Ziggy's lane runner — a small pseudo-3D Phaser scene.
 *
 * A perspective road runs to the horizon under a painted sky and parallax
 * hills; its stripes, kerbs and roadside trees rush by; answer arches grow
 * from the horizon and Ziggy (the official plush cutout, with squash and
 * stretch, bob, lean and a soft shadow) runs through the one he is in.
 *
 * The scene knows nothing about questions: React tells it the gate labels for
 * a round (`startRound`), the scene reports which lane Ziggy ran through
 * (`onGate`), and React answers with `feedback`. Import this file only from
 * the browser (dynamic import).
 */
import * as Phaser from 'phaser';
import { darken, lighten, mix } from '../../stage/color';

export interface RunnerCallbacks {
  /** The scene is built and can take rounds. */
  onReady: () => void;
  /** Ziggy crossed the gate row in this lane. */
  onGate: (lane: number) => void;
  /** Lane changed (for the DOM to mirror). */
  onLane?: (lane: number) => void;
}

export interface RunnerOptions {
  color: string;
  /** Prefers-reduced-motion: no bobbing, fewer sparkles, a calmer pace. */
  calm: boolean;
  /** Starry night version (space games). */
  night?: boolean;
  /** Sky colours from the page's scene, so the canvas continues it. */
  sky?: { top: string; bottom: string };
}

/** Lane colours, shared with the DOM chips above the canvas. */
export const LANE_COLORS = ['#5FB6EA', '#F9A86B', '#A78BFA', '#4FC9C0'];
const FONT = '"Fredoka Variable", "Fredoka", ui-rounded, system-ui, sans-serif';
const ZIGGY_SRC = '/mascot/ziggy-stand.webp';

const num = (hex: string) => Number.parseInt(hex.replace('#', '').slice(0, 6), 16);

interface Gate {
  container: Phaser.GameObjects.Container;
  panel: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  lane: number;
  tint: string;
  state: 'idle' | 'right' | 'faded';
}

interface Prop {
  img: Phaser.GameObjects.Image;
  side: -1 | 1;
  off: number;
  z: number;
  base: number;
}

const Z_FAR = 26;
const Z_SPAWN = 7.5;
const Z_NEAR = 0.82;
const SEG = 0.32;

export class RunnerScene extends Phaser.Scene {
  private cb: RunnerCallbacks;
  private opts: RunnerOptions;
  private theme: ReturnType<typeof makeTheme>;

  private laneCount = 3;
  private lane = 1;

  private sky!: Phaser.GameObjects.Image;
  private hills!: Phaser.GameObjects.Image;
  private world!: Phaser.GameObjects.Graphics;
  private player!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private props: Prop[] = [];

  private gates: Gate[] = [];
  private gateZ = Z_SPAWN;
  private gatesLive = false;
  private resolved = false;
  private pending: string[] | null = null;
  private ready = false;
  private swipeStart: { x: number; y: number } | null = null;

  /** Distance travelled (world units), drives the stripes. */
  private travelled = 0;
  private runPhase = 0;
  /** Ziggy's lateral position in world units, tweened between lanes. */
  private body = { wx: 0, lean: 0, jump: 0, wobble: 0 };

  constructor(cb: RunnerCallbacks, opts: RunnerOptions) {
    super({ key: 'ziggy-runner' });
    this.cb = cb;
    this.opts = opts;
    this.theme = makeTheme(opts);
  }

  /* ── Projection ── */

  private get W() {
    return this.scale.gameSize.width;
  }
  private get H() {
    return this.scale.gameSize.height;
  }
  private get horizon() {
    return Math.round(this.H * 0.3);
  }
  private get roadW() {
    return Math.min(this.W * 0.94, 700);
  }
  private get laneW() {
    return this.roadW / this.laneCount;
  }
  private playerY() {
    return this.H * 0.86;
  }
  /** Depth at which Ziggy runs. */
  private get zPlayer() {
    return (this.H - this.horizon) / (this.playerY() - this.horizon);
  }
  private laneWX(i: number) {
    return (i - (this.laneCount - 1) / 2) * this.laneW;
  }
  private camX() {
    return this.body.wx * 0.42;
  }
  private py(z: number) {
    return this.horizon + (this.H - this.horizon) / z;
  }
  private px(wx: number, z: number) {
    return this.W / 2 + (wx - this.camX()) / z;
  }
  /** Calm, readable pace: about 5 s (calm: 6.5 s) from the horizon to Ziggy. */
  private speedZ() {
    return (Z_SPAWN - this.zPlayer) / (this.opts.calm ? 6.5 : 5);
  }
  private ziggyHeight() {
    return Math.min(this.H * 0.3, this.laneW * 1.05 / this.zPlayer);
  }

  /* ── Assets ── */

  preload() {
    if (!this.textures.exists('ziggy-cutout')) this.load.image('ziggy-cutout', ZIGGY_SRC);
  }

  private canvasTexture(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
    if (this.textures.exists(key)) this.textures.remove(key);
    const t = this.textures.createCanvas(key, Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h)));
    if (!t) return;
    draw(t.getContext());
    t.refresh();
  }

  private makePropTextures() {
    const th = this.theme;
    if (this.opts.night) {
      this.canvasTexture('prop-a', 90, 150, (c) => {
        // Glowing lamp
        c.fillStyle = '#2B2470';
        c.fillRect(42, 40, 6, 110);
        const g = c.createRadialGradient(45, 36, 2, 45, 36, 40);
        g.addColorStop(0, 'rgba(255,240,180,1)');
        g.addColorStop(0.3, 'rgba(255,214,120,0.7)');
        g.addColorStop(1, 'rgba(255,214,120,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 90, 80);
        c.fillStyle = '#FFF4C2';
        c.beginPath();
        c.arc(45, 36, 9, 0, Math.PI * 2);
        c.fill();
      });
      this.canvasTexture('prop-b', 120, 110, (c) => {
        // Crystal cluster
        const cols = [lighten(th.accent, 0.4), th.accent, lighten(th.accent, 0.6)];
        [
          [30, 110, 18, 70],
          [60, 110, 22, 100],
          [90, 110, 16, 60],
        ].forEach(([x, y, w, h], i) => {
          c.fillStyle = cols[i];
          c.beginPath();
          c.moveTo(x - w, y);
          c.lineTo(x - w * 0.6, y - h * 0.8);
          c.lineTo(x, y - h);
          c.lineTo(x + w * 0.6, y - h * 0.8);
          c.lineTo(x + w, y);
          c.closePath();
          c.fill();
          c.fillStyle = 'rgba(255,255,255,0.35)';
          c.beginPath();
          c.moveTo(x - w * 0.5, y - 4);
          c.lineTo(x - w * 0.35, y - h * 0.75);
          c.lineTo(x, y - h * 0.95);
          c.lineTo(x - w * 0.1, y - 4);
          c.closePath();
          c.fill();
        });
      });
      this.canvasTexture('prop-c', 100, 100, (c) => {
        // Little planet on a stand
        const g = c.createRadialGradient(40, 36, 4, 50, 50, 40);
        g.addColorStop(0, lighten(th.accent, 0.6));
        g.addColorStop(1, darken(th.accent, 0.2));
        c.fillStyle = g;
        c.beginPath();
        c.arc(50, 50, 34, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.7)';
        c.lineWidth = 5;
        c.beginPath();
        c.ellipse(50, 52, 48, 12, -0.3, 0, Math.PI * 2);
        c.stroke();
      });
      return;
    }
    this.canvasTexture('prop-a', 110, 170, (c) => {
      // Lollipop tree
      c.fillStyle = '#9A6B44';
      roundRect(c, 48, 90, 14, 80, 6);
      c.fill();
      const g = c.createRadialGradient(42, 46, 6, 55, 60, 56);
      g.addColorStop(0, lighten(th.tree, 0.35));
      g.addColorStop(0.7, th.tree);
      g.addColorStop(1, darken(th.tree, 0.18));
      c.fillStyle = g;
      c.beginPath();
      c.arc(55, 60, 50, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.ellipse(38, 38, 16, 10, -0.6, 0, Math.PI * 2);
      c.fill();
    });
    this.canvasTexture('prop-b', 130, 80, (c) => {
      // Bush with berries
      [
        [34, 52, 30],
        [66, 40, 36],
        [98, 52, 30],
      ].forEach(([x, y, r]) => {
        const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, 2, x, y, r);
        g.addColorStop(0, lighten(th.bush, 0.35));
        g.addColorStop(1, th.bush);
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      });
      c.fillStyle = '#F472B6';
      [
        [44, 40],
        [78, 30],
        [92, 50],
        [58, 56],
      ].forEach(([x, y]) => {
        c.beginPath();
        c.arc(x, y, 5, 0, Math.PI * 2);
        c.fill();
      });
    });
    this.canvasTexture('prop-c', 70, 90, (c) => {
      // Big flower
      c.strokeStyle = '#4C9A3A';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(35, 88);
      c.quadraticCurveTo(30, 60, 35, 36);
      c.stroke();
      const petal = th.flower;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        c.fillStyle = petal;
        c.beginPath();
        c.ellipse(35 + Math.cos(a) * 14, 30 + Math.sin(a) * 14, 11, 8, a, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#FCD34D';
      c.beginPath();
      c.arc(35, 30, 10, 0, Math.PI * 2);
      c.fill();
    });
  }

  private makeSmallTextures() {
    if (!this.textures.exists('spark')) {
      this.canvasTexture('spark', 24, 24, (c) => {
        c.fillStyle = '#FFFFFF';
        c.beginPath();
        c.moveTo(12, 0);
        c.quadraticCurveTo(13, 11, 24, 12);
        c.quadraticCurveTo(13, 13, 12, 24);
        c.quadraticCurveTo(11, 13, 0, 12);
        c.quadraticCurveTo(11, 11, 12, 0);
        c.fill();
      });
    }
    if (!this.textures.exists('puff')) {
      this.canvasTexture('puff', 20, 20, (c) => {
        const g = c.createRadialGradient(10, 10, 1, 10, 10, 10);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 20, 20);
      });
    }
    if (!this.textures.exists('ziggy-cutout') || this.textures.get('ziggy-cutout').key === '__MISSING') {
      // The picture could not load: a simple green buddy keeps the game playable.
      this.canvasTexture('ziggy-cutout', 120, 200, (c) => {
        c.fillStyle = '#7FB65A';
        roundRect(c, 10, 10, 100, 90, 34);
        c.fill();
        roundRect(c, 28, 96, 64, 70, 24);
        c.fill();
        c.fillStyle = '#FFE08A';
        c.beginPath();
        c.arc(60, 128, 12, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(42, 52, 13, 0, Math.PI * 2);
        c.arc(78, 52, 13, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#2A5A20';
        c.beginPath();
        c.arc(44, 54, 7, 0, Math.PI * 2);
        c.arc(80, 54, 7, 0, Math.PI * 2);
        c.fill();
      });
    }
  }

  private paintSky() {
    const W = this.W;
    const hz = this.horizon;
    const th = this.theme;
    this.canvasTexture('runner-sky', W, hz + 4, (c) => {
      const g = c.createLinearGradient(0, 0, 0, hz);
      g.addColorStop(0, th.skyTop);
      g.addColorStop(1, th.skyBottom);
      c.fillStyle = g;
      c.fillRect(0, 0, W, hz + 4);
      if (this.opts.night) {
        for (let i = 0; i < 70; i++) {
          const x = (i * 97.3) % W;
          const y = ((i * 53.7) % (hz * 0.95)) + 2;
          c.fillStyle = `rgba(255,255,255,${0.35 + ((i * 7) % 10) / 16})`;
          c.beginPath();
          c.arc(x, y, i % 9 === 0 ? 1.8 : 1, 0, Math.PI * 2);
          c.fill();
        }
        const m = c.createRadialGradient(W * 0.8, hz * 0.32, 4, W * 0.8, hz * 0.32, hz * 0.5);
        m.addColorStop(0, 'rgba(255,250,230,1)');
        m.addColorStop(0.18, 'rgba(255,240,200,0.9)');
        m.addColorStop(0.22, 'rgba(200,190,255,0.25)');
        m.addColorStop(1, 'rgba(200,190,255,0)');
        c.fillStyle = m;
        c.fillRect(0, 0, W, hz);
      } else {
        const s = c.createRadialGradient(W * 0.78, hz * 0.38, 4, W * 0.78, hz * 0.38, hz * 0.9);
        s.addColorStop(0, 'rgba(255,250,225,1)');
        s.addColorStop(0.12, 'rgba(255,240,180,0.95)');
        s.addColorStop(0.35, 'rgba(255,230,160,0.35)');
        s.addColorStop(1, 'rgba(255,230,160,0)');
        c.fillStyle = s;
        c.fillRect(0, 0, W, hz + 4);
        c.fillStyle = 'rgba(255,255,255,0.92)';
        [
          [0.16, 0.3, 1],
          [0.46, 0.18, 0.7],
          [0.92, 0.55, 0.8],
        ].forEach(([fx, fy, k]) => cloud(c, W * fx, hz * fy, 46 * k));
      }
    });
    this.sky.setTexture('runner-sky').setPosition(0, 0).setOrigin(0, 0);

    const hw = W * 1.4;
    const hh = Math.max(40, hz * 0.55);
    this.canvasTexture('runner-hills', hw, hh, (c) => {
      const layer = (color: string, base: number, amp: number, freq: number, phase: number) => {
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(0, hh);
        for (let x = 0; x <= hw; x += 8) {
          const y = base - amp * (0.6 * Math.sin(x * freq + phase) + 0.4 * Math.sin(x * freq * 2.3 + phase * 1.7));
          c.lineTo(x, y);
        }
        c.lineTo(hw, hh);
        c.closePath();
        c.fill();
      };
      layer(th.hillFar, hh * 0.45, hh * 0.28, 0.012, 0.4);
      layer(th.hillNear, hh * 0.78, hh * 0.18, 0.018, 2.1);
    });
    this.hills.setTexture('runner-hills').setOrigin(0.5, 1);
  }

  /* ── Lifecycle ── */

  create() {
    this.makeSmallTextures();
    this.makePropTextures();
    this.cameras.main.setBackgroundColor(this.theme.grassA);

    this.sky = this.add.image(0, 0, '__DEFAULT').setDepth(0);
    this.hills = this.add.image(0, 0, '__DEFAULT').setDepth(1);
    this.world = this.add.graphics().setDepth(2);

    this.shadow = this.add.ellipse(0, 0, 60, 14, 0x1b1035, 0.22);
    this.player = this.add.image(0, 0, 'ziggy-cutout').setOrigin(0.5, 1);

    const keys = ['prop-a', 'prop-b', 'prop-c'];
    for (let i = 0; i < 16; i++) {
      const side: -1 | 1 = i % 2 ? 1 : -1;
      const key = keys[(i * 7 + (i >> 1)) % keys.length];
      const img = this.add.image(0, 0, key).setOrigin(0.5, 1);
      this.props.push({ img, side, off: 0.62 + ((i * 37) % 10) / 14, z: Z_NEAR + 0.4 + (i / 16) * (Z_FAR - Z_NEAR), base: key === 'prop-a' ? 1 : key === 'prop-b' ? 0.8 : 0.6 });
    }

    this.sparkles = this.add.particles(0, 0, 'spark', {
      speed: { min: 120, max: 320 },
      angle: { min: 200, max: 340 },
      lifespan: 800,
      scale: { start: 1, end: 0 },
      rotate: { start: 0, end: 360 },
      alpha: { start: 1, end: 0 },
      gravityY: 420,
      tint: [0xfbbf24, 0xffffff, num(this.opts.color), 0x4ade80, 0xf472b6],
      emitting: false,
    });
    this.sparkles.setDepth(120);

    if (!this.opts.calm) {
      this.dust = this.add.particles(0, 0, 'puff', {
        speed: { min: 10, max: 40 },
        angle: { min: 60, max: 120 },
        lifespan: 500,
        scale: { start: 0.8, end: 2 },
        alpha: { start: 0.55, end: 0 },
        frequency: 160,
        tint: this.opts.night ? 0xb9a8ff : 0xfff3d6,
      });
      this.dust.setDepth(1);
    }

    this.body.wx = this.laneWX(this.lane);
    this.layout();
    this.scale.on('resize', this.layout, this);

    this.setupInput();
    this.ready = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));
    this.cb.onReady();
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      this.startRound(p);
    }
  }

  private layout() {
    this.paintSky();
    const d = 10 + 50 / this.zPlayer;
    this.player.setDepth(d + 1);
    this.shadow.setDepth(d + 0.4);
    this.dust?.setDepth(d + 0.6);
    const tex = this.textures.get('ziggy-cutout').getSourceImage() as { width: number; height: number };
    const h = this.ziggyHeight();
    this.player.setScale(h / Math.max(1, tex.height));
    this.gates.forEach((g) => this.drawGate(g));
  }

  private setupInput() {
    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.moveLane(-1));
    kb?.on('keydown-RIGHT', () => this.moveLane(1));
    kb?.on('keydown-A', () => this.moveLane(-1));
    kb?.on('keydown-D', () => this.moveLane(1));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.swipeStart = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const s = this.swipeStart;
      this.swipeStart = null;
      if (!s) return;
      const dx = p.x - s.x;
      if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(p.y - s.y)) {
        this.moveLane(dx > 0 ? 1 : -1);
        return;
      }
      // A plain tap: run to the lane that was tapped.
      const zp = this.zPlayer;
      let best = 0;
      for (let i = 1; i < this.laneCount; i++) {
        if (Math.abs(this.px(this.laneWX(i), zp) - p.x) < Math.abs(this.px(this.laneWX(best), zp) - p.x)) best = i;
      }
      this.setLane(best);
    });
  }

  /* ── Public API (called from React) ── */

  moveLane(dir: -1 | 1) {
    this.setLane(this.lane + dir);
  }

  setLane(lane: number) {
    if (!this.ready) return;
    const next = Phaser.Math.Clamp(lane, 0, this.laneCount - 1);
    if (next === this.lane) return;
    const dir = next > this.lane ? 1 : -1;
    this.lane = next;
    this.tweens.add({ targets: this.body, wx: this.laneWX(next), duration: 230, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.body, lean: { from: dir * 14, to: 0 }, duration: 380, ease: 'Sine.easeOut' });
    this.cb.onLane?.(next);
  }

  getLane() {
    return this.lane;
  }

  /** Spawn a row of arches, one per option, far down the road. */
  startRound(options: string[]) {
    if (!this.ready) {
      this.pending = options;
      return;
    }
    this.clearGates();
    const count = Phaser.Math.Clamp(options.length, 2, 4);
    if (count !== this.laneCount) {
      this.laneCount = count;
      this.lane = Math.min(this.lane, count - 1);
      this.body.wx = this.laneWX(this.lane);
      this.layout();
    }
    this.gateZ = Z_SPAWN;
    this.resolved = false;
    this.gatesLive = true;

    options.slice(0, count).forEach((text, lane) => {
      const container = this.add.container(0, 0);
      const panel = this.add.graphics();
      const label = this.add
        .text(0, 0, text, { fontFamily: FONT, fontSize: '30px', fontStyle: '700', color: '#2A2340', align: 'center' })
        .setOrigin(0.5)
        .setResolution(Math.min(2, window.devicePixelRatio || 1) * 1.5);
      container.add([panel, label]);
      const gate: Gate = { container, panel, label, lane, tint: LANE_COLORS[lane % LANE_COLORS.length], state: 'idle' };
      this.drawGate(gate);
      container.setAlpha(0);
      this.tweens.add({ targets: container, alpha: 1, duration: 400 });
      this.gates.push(gate);
    });
  }

  /** React's verdict on the gate Ziggy took. */
  feedback(right: boolean, answerLane: number) {
    const x = this.player.x;
    const y = this.player.y - this.player.displayHeight * 0.55;
    if (right) {
      this.sparkles.explode(this.opts.calm ? 10 : 28, x, y);
      if (!this.opts.calm) {
        this.tweens.add({ targets: this.body, jump: 1, duration: 230, yoyo: true, ease: 'Quad.easeOut' });
      }
      this.floatText('+⭐', x, y - 30);
    } else {
      // A soft wobble, then the right arch glows so the child sees it.
      this.tweens.add({ targets: this.body, wobble: { from: 1, to: 0 }, duration: 700, ease: 'Sine.easeOut' });
    }
    this.gates.forEach((g) => {
      if (g.lane === answerLane) {
        g.state = 'right';
        this.drawGate(g);
        if (!right) {
          const gx = g.container.x;
          const gy = g.container.y - g.container.scale * this.gateHeight() * 0.8;
          this.sparkles.explode(10, gx, gy);
        }
      } else {
        g.state = 'faded';
        this.tweens.add({ targets: g.container, alpha: 0.35, duration: 220 });
      }
    });
  }

  /* ── Internals ── */

  private floatText(text: string, x: number, y: number) {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '30px', fontStyle: '700', color: '#FFFFFF', stroke: '#F59E0B', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(130);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, scale: 1.4, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private gateHeight() {
    return (this.ziggyHeight() * 1.32) * this.zPlayer;
  }

  /** Arch drawn at its full (near) size; the container is scaled by depth. */
  private drawGate(gate: Gate) {
    const w = this.laneW * 0.86;
    const h = this.gateHeight();
    const panelH = Math.max(56, Math.min(h * 0.36, 96));
    const post = Math.max(10, w * 0.07);
    const right = gate.state === 'right';
    const tint = right ? '#22C55E' : gate.tint;
    const g = gate.panel;
    g.clear();
    // Posts with candy stripes
    [-1, 1].forEach((s) => {
      const x = s * (w / 2 - post / 2) - post / 2;
      g.fillStyle(num(darken(tint, 0.25)), 1).fillRoundedRect(x + 2, -h + panelH * 0.5, post, h - panelH * 0.5, post / 2);
      g.fillStyle(num(lighten(tint, 0.15)), 1).fillRoundedRect(x, -h + panelH * 0.5, post, h - panelH * 0.5, post / 2);
      for (let k = 0; k < 5; k++) {
        g.fillStyle(0xffffff, 0.75).fillRect(x, -h + panelH + k * ((h - panelH) / 5), post, (h - panelH) / 10);
      }
    });
    // Shadow of the arch on the road
    g.fillStyle(0x1b1035, 0.12).fillEllipse(0, 0, w * 0.95, 16);
    // Banner
    const top = -h;
    g.fillStyle(num(darken(tint, 0.3)), 1).fillRoundedRect(-w / 2, top + 7, w, panelH, 22);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, top, w, panelH, 22);
    g.lineStyle(right ? 8 : 6, num(tint), 1).strokeRoundedRect(-w / 2, top, w, panelH, 22);
    g.fillStyle(num(tint), right ? 0.22 : 0.12).fillRoundedRect(-w / 2 + 8, top + 8, w - 16, panelH - 16, 14);
    g.fillStyle(0xffffff, 0.8).fillRoundedRect(-w / 2 + 14, top + 6, w - 28, 6, 3);
    if (right) {
      g.fillStyle(0x22c55e, 1).fillCircle(w / 2 - 6, top + 4, 15);
      g.lineStyle(4, 0xffffff, 1);
      g.beginPath();
      g.moveTo(w / 2 - 13, top + 4);
      g.lineTo(w / 2 - 7, top + 10);
      g.lineTo(w / 2 + 1, top - 3);
      g.strokePath();
    }
    const fs = Math.max(20, Math.min(40, ((w - 24) / Math.max(3, gate.label.text.length)) * 1.6));
    gate.label.setFontSize(fs).setWordWrapWidth(w - 24, true).setPosition(0, top + panelH / 2 + 1);
  }

  private clearGates() {
    this.gates.forEach((g) => g.container.destroy());
    this.gates = [];
    this.gatesLive = false;
  }

  private quad(color: number, alpha: number, xa1: number, xa2: number, ya: number, xb1: number, xb2: number, yb: number) {
    const g = this.world;
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(xa1, ya);
    g.lineTo(xa2, ya);
    g.lineTo(xb2, yb);
    g.lineTo(xb1, yb);
    g.closePath();
    g.fillPath();
  }

  private drawWorld() {
    const g = this.world;
    const th = this.theme;
    const W = this.W;
    const H = this.H;
    const hz = this.horizon;
    const half = this.roadW / 2;
    const kerb = Math.max(10, this.roadW * 0.04);
    g.clear();
    g.fillStyle(num(th.grassA), 1).fillRect(0, hz, W, H - hz);

    const first = Math.floor(this.travelled / SEG);
    const offset = this.travelled - first * SEG;
    const n = Math.ceil((Z_FAR - Z_NEAR) / SEG);
    // From far to near, so near bands paint over far ones.
    for (let k = n; k >= 0; k--) {
      const za = Z_NEAR + k * SEG - offset;
      const zb = za + SEG;
      if (za <= 0.2) continue;
      const ya = this.py(za);
      const yb = this.py(zb);
      if (yb > H + 2 && ya > H + 2) continue;
      const odd = (first + k) % 2 === 0;
      const la = this.px(-half, za);
      const ra = this.px(half, za);
      const lb = this.px(-half, zb);
      const rb = this.px(half, zb);
      // Grass bands (only near: far away they would shimmer)
      if (odd && za < 9) {
        this.quad(num(th.grassB), 1, 0, la, ya, 0, lb, yb);
        this.quad(num(th.grassB), 1, ra, W, ya, rb, W, yb);
      }
      // Road
      this.quad(num(odd ? th.roadA : th.roadB), 1, la, ra, ya, lb, rb, yb);
      // Kerbs
      const ka = kerb / za;
      const kb = kerb / zb;
      const kc = num(odd ? th.kerbA : th.kerbB);
      this.quad(kc, 1, la - ka, la, ya, lb - kb, lb, yb);
      this.quad(kc, 1, ra, ra + ka, ya, rb, rb + kb, yb);
      // Lane dashes
      if (odd) {
        for (let i = 1; i < this.laneCount; i++) {
          const wx = -half + this.laneW * i;
          const d = Math.max(3, this.roadW * 0.012);
          this.quad(num(th.dash), th.dashAlpha, this.px(wx - d, za), this.px(wx + d, za), ya, this.px(wx - d, zb), this.px(wx + d, zb), yb);
        }
      }
    }
    // Soft haze where the road meets the hills
    g.fillStyle(num(th.skyBottom), 0.55).fillRect(0, hz, W, Math.max(3, (H - hz) * 0.02));
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    const v = this.speedZ();
    this.travelled += v * dt;

    // Parallax: the hills slide a little opposite to the camera.
    this.hills.setPosition(this.W / 2 - this.camX() * 0.06, this.horizon + 2);
    this.drawWorld();

    // Roadside props rushing by
    const half = this.roadW / 2;
    for (const p of this.props) {
      p.z -= v * dt;
      if (p.z < Z_NEAR) p.z += Z_FAR - Z_NEAR;
      const s = 1 / p.z;
      const wx = p.side * (half + this.roadW * 0.12 + this.roadW * 0.5 * (p.off - 0.6));
      const k = (this.roadW / 640) * p.base * 1.35;
      p.img
        .setPosition(this.px(wx, p.z), this.py(p.z))
        .setScale(s * k)
        .setDepth(10 + 50 / p.z)
        .setAlpha(Phaser.Math.Clamp((Z_FAR - p.z) / 5, 0, 1));
    }

    // Ziggy: run cycle, lean, hop, wobble
    const zp = this.zPlayer;
    const calm = this.opts.calm;
    this.runPhase += dt * (calm ? 0 : 11);
    const bob = calm ? 0 : Math.abs(Math.sin(this.runPhase)) * 9;
    const jump = this.body.jump * 70;
    const squash = calm ? 0 : Math.cos(this.runPhase * 2) * 0.035;
    const baseScale = this.ziggyHeight() / Math.max(1, (this.textures.get('ziggy-cutout').getSourceImage() as { height: number }).height);
    const stretch = this.body.jump * 0.08;
    const x = this.px(this.body.wx, zp);
    const y = this.playerY() - bob - jump;
    this.player
      .setPosition(x, y)
      .setScale(baseScale * (1 + squash - stretch * 0.6), baseScale * (1 - squash + stretch))
      .setAngle(this.body.lean + (calm ? 0 : Math.sin(this.runPhase) * 2.5) + Math.sin(this.body.wobble * 18) * this.body.wobble * 9);
    const lift = (bob + jump) / 80;
    this.shadow
      .setPosition(x, this.playerY() + 2)
      .setSize(this.player.displayWidth * 0.9 * (1 - lift * 0.4), Math.max(8, this.player.displayWidth * 0.18))
      .setAlpha(0.24 * (1 - lift * 0.5));
    this.dust?.setPosition(x, this.playerY() - 2);

    if (!this.gatesLive) return;
    this.gateZ -= v * dt;
    const gz = this.gateZ;
    const s = 1 / gz;
    this.gates.forEach((g) => {
      g.container.setPosition(this.px(this.laneWX(g.lane), gz), this.py(gz)).setScale(s).setDepth(10 + 50 / gz);
    });

    if (!this.resolved && gz <= zp + 0.02) {
      this.resolved = true;
      this.cb.onGate(this.lane);
    }
    if (gz < 0.55) this.clearGates();
  }
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r * 0.55, 0, Math.PI * 2);
  c.arc(x + r * 0.6, y - r * 0.25, r * 0.65, 0, Math.PI * 2);
  c.arc(x + r * 1.3, y, r * 0.5, 0, Math.PI * 2);
  c.rect(x, y - r * 0.1, r * 1.3, r * 0.55);
  c.fill();
}

/** All the colours of the run, from the game's accent (day) or a starry night. */
function makeTheme(o: RunnerOptions) {
  const a = o.color;
  if (o.night) {
    return {
      accent: a,
      skyTop: o.sky?.top ?? '#0B1038',
      skyBottom: o.sky?.bottom ?? '#3B2A7A',
      hillFar: mix('#3A2F86', a, 0.2),
      hillNear: mix('#2A2266', a, 0.15),
      grassA: '#211A55',
      grassB: '#1C1649',
      roadA: mix('#40338A', a, 0.15),
      roadB: mix('#3A2E7E', a, 0.15),
      kerbA: lighten(a, 0.2),
      kerbB: '#E9E5FF',
      dash: '#8FF3FF',
      dashAlpha: 0.9,
      tree: a,
      bush: a,
      flower: a,
    };
  }
  return {
    accent: a,
    skyTop: o.sky?.top ?? mix('#8FD3FF', a, 0.12),
    skyBottom: o.sky?.bottom ?? '#FFF6E6',
    hillFar: mix('#BFE7C6', a, 0.18),
    hillNear: mix('#97D98A', a, 0.14),
    grassA: mix('#A8E392', a, 0.1),
    grassB: mix('#94D97E', a, 0.1),
    roadA: '#FFF1DC',
    roadB: '#FBE6C8',
    kerbA: a,
    kerbB: '#FFFFFF',
    dash: '#FFFFFF',
    dashAlpha: 1,
    tree: mix('#5DBB63', a, 0.12),
    bush: mix('#6CC570', a, 0.1),
    flower: lighten(a, 0.15),
  };
}

/** Build the Phaser game inside `parent`. */
export function createRunnerGame(parent: HTMLElement, cb: RunnerCallbacks, opts: RunnerOptions) {
  const scene = new RunnerScene(cb, opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: Math.max(280, parent.clientWidth),
    height: Math.max(320, parent.clientHeight),
    backgroundColor: opts.night ? '#211A55' : '#A8E392',
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
    render: { antialias: true, roundPixels: false },
    scene,
  });
  return { game, scene };
}

