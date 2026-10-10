/**
 * Ziggy's lane runner — a small Phaser 3 scene with no external assets.
 *
 * Every texture is drawn with Graphics at boot. The scene knows nothing about
 * questions: React tells it the gate labels for a round (`startRound`), the
 * scene reports which lane Ziggy ran through (`onGate`), and React answers
 * with `feedback`. Import this file only from the browser (dynamic import).
 */
import * as Phaser from 'phaser';

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
}

const LANE_TINTS = [0x5fb6ea, 0xf9be7c, 0xa78bfa, 0x4fc9c0];
const FONT = '"Fredoka Variable", "Fredoka", ui-rounded, system-ui, sans-serif';

function hexNum(hex: string, fallback = 0x22c55e): number {
  const h = hex.replace('#', '');
  const n = Number.parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return Number.isFinite(n) ? n : fallback;
}

interface Gate {
  container: Phaser.GameObjects.Container;
  panel: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  lane: number;
}

export class RunnerScene extends Phaser.Scene {
  private cb: RunnerCallbacks;
  private opts: RunnerOptions;

  private laneCount = 3;
  private lane = 1;
  private player!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private road!: Phaser.GameObjects.Graphics;
  private dividers: Phaser.GameObjects.TileSprite[] = [];
  private sides: Phaser.GameObjects.TileSprite[] = [];
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;

  private gates: Gate[] = [];
  private gateY = -100;
  private gatesLive = false;
  private resolved = false;
  private pending: string[] | null = null;
  private ready = false;
  private swipeStart: { x: number; y: number; t: number } | null = null;

  constructor(cb: RunnerCallbacks, opts: RunnerOptions) {
    super({ key: 'ziggy-runner' });
    this.cb = cb;
    this.opts = opts;
  }

  /* ── Layout helpers ── */

  private get W() {
    return this.scale.gameSize.width;
  }
  private get H() {
    return this.scale.gameSize.height;
  }
  private laneX(i: number) {
    const roadW = Math.min(this.W - 24, 560);
    const left = (this.W - roadW) / 2;
    return left + (roadW / this.laneCount) * (i + 0.5);
  }
  private laneWidth() {
    return Math.min(this.W - 24, 560) / this.laneCount;
  }
  private playerY() {
    return this.H * 0.8;
  }
  /** Pixels per second: about 4.5 s (calm: 6 s) from the top to Ziggy. */
  private speed() {
    return (this.playerY() + 100) / (this.opts.calm ? 6 : 4.5);
  }

  /* ── Textures (drawn once) ── */

  private makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const green = hexNum('#7FC85C');

    // Ziggy: a round green buddy with big eyes and a little antenna.
    if (!this.textures.exists('ziggy')) {
      g.clear();
      g.fillStyle(0x000000, 0.12).fillEllipse(48, 92, 60, 10);
      g.fillStyle(green, 1).fillRoundedRect(14, 22, 68, 66, 30);
      g.fillStyle(0x9ad97c, 1).fillRoundedRect(24, 30, 34, 20, 10);
      g.lineStyle(4, 0x4f9a35, 1).lineBetween(48, 22, 48, 8);
      g.fillStyle(0xfbbf24, 1).fillCircle(48, 7, 6);
      g.fillStyle(0xffffff, 1).fillCircle(36, 50, 11).fillCircle(60, 50, 11);
      g.fillStyle(0x1a1a2e, 1).fillCircle(38, 48, 5.5).fillCircle(62, 48, 5.5);
      g.fillStyle(0xffffff, 1).fillCircle(40, 46, 2).fillCircle(64, 46, 2);
      g.fillStyle(0xf472b6, 0.55).fillCircle(26, 64, 5).fillCircle(70, 64, 5);
      g.lineStyle(3, 0x2f6b1f, 1).beginPath().arc(48, 62, 9, 0.15 * Math.PI, 0.85 * Math.PI).strokePath();
      g.fillStyle(0x4f9a35, 1).fillRoundedRect(24, 84, 16, 10, 5).fillRoundedRect(56, 84, 16, 10, 5);
      g.generateTexture('ziggy', 96, 100);
    }
    if (!this.textures.exists('dash')) {
      g.clear();
      g.fillStyle(0xffffff, 0.9).fillRoundedRect(0, 0, 6, 34, 3);
      g.generateTexture('dash', 6, 64);
    }
    if (!this.textures.exists('grass')) {
      g.clear();
      g.fillStyle(0xd9f2c9, 1).fillRect(0, 0, 64, 64);
      g.fillStyle(0xbfe6a8, 1).fillCircle(14, 12, 4).fillCircle(44, 40, 5).fillCircle(26, 54, 3);
      g.fillStyle(0xf9be7c, 1).fillCircle(50, 14, 3);
      g.fillStyle(0xf472b6, 0.9).fillCircle(10, 40, 3);
      g.generateTexture('grass', 64, 64);
    }
    if (!this.textures.exists('spark')) {
      g.clear();
      g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
      g.fillStyle(0xfff3b0, 1).fillCircle(8, 8, 5);
      g.generateTexture('spark', 16, 16);
    }
    g.destroy();
  }

  /* ── Lifecycle ── */

  create() {
    this.makeTextures();
    this.cameras.main.setBackgroundColor('#EAF6E2');

    this.sides = [
      this.add.tileSprite(0, 0, 10, 10, 'grass').setOrigin(0, 0),
      this.add.tileSprite(0, 0, 10, 10, 'grass').setOrigin(0, 0),
    ];
    this.road = this.add.graphics();

    this.shadow = this.add.ellipse(0, 0, 54, 12, 0x000000, 0.12);
    this.player = this.add.image(0, 0, 'ziggy').setDepth(10);

    this.sparkles = this.add.particles(0, 0, 'spark', {
      speed: { min: 90, max: 260 },
      angle: { min: 200, max: 340 },
      lifespan: 700,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 260,
      tint: [0xfbbf24, 0xffffff, hexNum(this.opts.color), 0x7fc85c],
      emitting: false,
    });
    this.sparkles.setDepth(20);

    this.layout();
    this.scale.on('resize', this.layout, this);

    if (!this.opts.calm) {
      this.tweens.add({ targets: this.player, scaleY: 0.94, scaleX: 1.04, yoyo: true, repeat: -1, duration: 220, ease: 'Sine.easeInOut' });
    }

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
    const W = this.W;
    const H = this.H;
    const roadW = Math.min(W - 24, 560);
    const left = (W - roadW) / 2;

    this.sides[0].setPosition(0, 0).setSize(Math.max(1, left), H);
    this.sides[1].setPosition(left + roadW, 0).setSize(Math.max(1, W - left - roadW), H);

    this.road.clear();
    this.road.fillStyle(0xfff7e8, 1).fillRect(left, 0, roadW, H);
    this.road.fillStyle(hexNum(this.opts.color), 0.08).fillRect(left, 0, roadW, H);
    this.road.lineStyle(4, 0xffffff, 1).lineBetween(left, 0, left, H).lineBetween(left + roadW, 0, left + roadW, H);

    this.dividers.forEach((d) => d.destroy());
    this.dividers = [];
    for (let i = 1; i < this.laneCount; i++) {
      const x = left + (roadW / this.laneCount) * i;
      this.dividers.push(this.add.tileSprite(x - 3, 0, 6, H, 'dash').setOrigin(0, 0).setDepth(1).setAlpha(0.8));
    }

    const scale = Math.max(0.6, Math.min(1.1, this.laneWidth() / 130, H / 480));
    this.player.setScale(scale).setPosition(this.laneX(this.lane), this.playerY());
    this.shadow.setPosition(this.laneX(this.lane), this.playerY() + 46 * scale).setScale(scale);
    this.gates.forEach((g) => this.drawGate(g, g.container.getData('tint') as number, null));
  }

  private setupInput() {
    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.moveLane(-1));
    kb?.on('keydown-RIGHT', () => this.moveLane(1));
    kb?.on('keydown-A', () => this.moveLane(-1));
    kb?.on('keydown-D', () => this.moveLane(1));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.swipeStart = { x: p.x, y: p.y, t: p.downTime };
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
      let best = 0;
      for (let i = 1; i < this.laneCount; i++) {
        if (Math.abs(this.laneX(i) - p.x) < Math.abs(this.laneX(best) - p.x)) best = i;
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
    const tilt = next > this.lane ? 8 : -8;
    this.lane = next;
    this.tweens.add({ targets: [this.player, this.shadow], x: this.laneX(next), duration: 170, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.player, angle: { from: tilt, to: 0 }, duration: 200 });
    this.cb.onLane?.(next);
  }

  getLane() {
    return this.lane;
  }

  /** Spawn a row of gates, one per option, at the top of the track. */
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
      this.layout();
    }
    this.gateY = -90;
    this.resolved = false;
    this.gatesLive = true;

    options.slice(0, count).forEach((text, lane) => {
      const container = this.add.container(this.laneX(lane), this.gateY).setDepth(5);
      const panel = this.add.graphics();
      const label = this.add
        .text(0, 0, text, {
          fontFamily: FONT,
          fontSize: '22px',
          fontStyle: '700',
          color: '#1A1A2E',
          align: 'center',
          wordWrap: { width: this.laneWidth() - 34, useAdvancedWrap: true },
        })
        .setOrigin(0.5)
        .setResolution(Math.min(2, window.devicePixelRatio || 1));
      container.add([panel, label]);
      const gate: Gate = { container, panel, label, lane };
      const tint = LANE_TINTS[lane % LANE_TINTS.length];
      container.setData('tint', tint);
      this.drawGate(gate, tint, null);
      container.setScale(0.6).setAlpha(0);
      this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
      this.gates.push(gate);
    });
  }

  /** React's verdict on the gate Ziggy took. */
  feedback(right: boolean, answerLane: number) {
    const x = this.player.x;
    const y = this.player.y - 30;
    if (right) {
      this.sparkles.explode(this.opts.calm ? 10 : 26, x, y);
      if (!this.opts.calm) this.tweens.add({ targets: this.player, y: this.playerY() - 36, yoyo: true, duration: 200, ease: 'Quad.easeOut' });
    } else {
      // A soft wobble, then the right gate glows so the child sees it.
      this.tweens.add({ targets: this.player, angle: { from: -10, to: 0 }, duration: 380, ease: 'Elastic.easeOut' });
    }
    this.gates.forEach((g) => {
      if (g.lane === answerLane) {
        this.drawGate(g, 0x22c55e, 'right');
        this.tweens.add({ targets: g.container, scale: 1.12, yoyo: true, duration: 220 });
        if (!right) this.sparkles.explode(8, g.container.x, g.container.y);
      } else {
        this.tweens.add({ targets: g.container, alpha: 0.35, duration: 200 });
      }
    });
  }

  /* ── Internals ── */

  private drawGate(gate: Gate, tint: number, state: 'right' | null) {
    const w = this.laneWidth() - 14;
    const h = Math.max(64, Math.min(84, this.H * 0.13));
    gate.panel.clear();
    gate.panel.fillStyle(0x000000, 0.08).fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, 22);
    gate.panel.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    gate.panel.lineStyle(state === 'right' ? 6 : 5, tint, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    gate.panel.fillStyle(tint, 0.16).fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 16);
    const fs = Math.max(16, Math.min(28, w / Math.max(4, gate.label.text.length) * 1.5));
    gate.label.setFontSize(fs).setWordWrapWidth(w - 20, true);
    gate.container.x = this.laneX(gate.lane);
  }

  private clearGates() {
    this.gates.forEach((g) => g.container.destroy());
    this.gates = [];
    this.gatesLive = false;
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    const v = this.speed();
    this.dividers.forEach((d) => (d.tilePositionY -= v * dt));
    this.sides.forEach((s) => (s.tilePositionY -= v * dt));

    if (!this.gatesLive) return;
    this.gateY += v * dt;
    this.gates.forEach((g) => (g.container.y = this.gateY));

    if (!this.resolved && this.gateY >= this.playerY() - 12) {
      this.resolved = true;
      this.cb.onGate(this.lane);
    }
    if (this.gateY > this.H + 120) this.clearGates();
  }
}

/** Build the Phaser game inside `parent`. */
export function createRunnerGame(parent: HTMLElement, cb: RunnerCallbacks, opts: RunnerOptions) {
  const scene = new RunnerScene(cb, opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: Math.max(280, parent.clientWidth),
    height: Math.max(320, parent.clientHeight),
    backgroundColor: '#EAF6E2',
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
    render: { antialias: true, roundPixels: false },
    scene,
  });
  return { game, scene };
}
