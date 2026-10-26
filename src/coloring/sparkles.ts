import { sparklePath } from './brush-render';

/**
 * A small particle system for the coloring stage: bursts when a zone is
 * filled, a trail behind the glitter brush, and slow twinkles on glitter
 * strokes. Soft fades only (no flashing).
 */
type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; color: string; spin: number };

const COLORS = ['#ffffff', '#FFE27A', '#FFC4E6', '#B8F3FF'];

export class Sparkles {
  private parts: Particle[] = [];
  private raf = 0;
  private last = 0;
  private twinkleAcc = 0;
  /** Points (canvas pixels) where ambient twinkles may appear. */
  twinkleSpots: { x: number; y: number; w: number }[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private reduced: boolean
  ) {}

  private kick() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  burst(x: number, y: number, n = 14, spread = 1, colors = COLORS) {
    const count = this.reduced ? Math.ceil(n / 3) : n;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.05 + Math.random() * 0.18) * spread * (this.reduced ? 0.3 : 1);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.03, age: 0, life: 520 + Math.random() * 380, size: 5 + Math.random() * 9, color: colors[i % colors.length], spin: Math.random() });
    }
    this.kick();
  }

  trail(x: number, y: number, size: number) {
    if (Math.random() > (this.reduced ? 0.15 : 0.6)) return;
    this.parts.push({ x: x + (Math.random() - 0.5) * size, y: y + (Math.random() - 0.5) * size, vx: (Math.random() - 0.5) * 0.04, vy: -0.02 - Math.random() * 0.03, age: 0, life: 600 + Math.random() * 500, size: size * (0.25 + Math.random() * 0.25), color: COLORS[Math.floor(Math.random() * COLORS.length)], spin: Math.random() });
    this.kick();
  }

  setSpots(spots: { x: number; y: number; w: number }[]) {
    this.twinkleSpots = spots;
    if (spots.length && !this.reduced) this.kick();
  }

  private tick = (now: number) => {
    const dt = Math.min(50, now - this.last);
    this.last = now;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    if (!this.reduced && this.twinkleSpots.length) {
      this.twinkleAcc += dt;
      while (this.twinkleAcc > 140) {
        this.twinkleAcc -= 140;
        const s = this.twinkleSpots[Math.floor(Math.random() * this.twinkleSpots.length)];
        this.parts.push({ x: s.x + (Math.random() - 0.5) * s.w, y: s.y + (Math.random() - 0.5) * s.w, vx: 0, vy: 0, age: 0, life: 900 + Math.random() * 600, size: s.w * (0.3 + Math.random() * 0.25), color: Math.random() > 0.5 ? '#ffffff' : '#FFF3B0', spin: Math.random() });
      }
    }
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.parts = this.parts.filter((p) => (p.age += dt) < p.life);
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.00012 * dt;
      const u = p.age / p.life;
      const alpha = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(255,240,180,0.9)';
      ctx.shadowBlur = p.size * 0.8;
      sparklePath(ctx, p.x, p.y, p.size * (0.6 + 0.4 * Math.sin((u + p.spin) * Math.PI)));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    if (this.parts.length || (!this.reduced && this.twinkleSpots.length)) this.raf = requestAnimationFrame(this.tick);
    else this.raf = 0;
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.parts = [];
  }
}
