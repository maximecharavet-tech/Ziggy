/**
 * Photo booth — 2D compositing (canvas only, runs on the device).
 *
 * Layers, back to front:
 *   backdrop (the 3D scene's canvas, "cover") → soft contact shadow → golden
 *   glow around the child → the child (warm-graded to the scene's light, with a
 *   rim of light on the side of the fire / lamp) → falling snow + twinkling
 *   golden sparkles → the frame (vignette, garland of lights, gold border,
 *   red ribbon "Joyeux Noël {prénom}", "Noël 2026 · ziggy-ai.fr", watermark).
 * All positions are in REF units (an 800 × 1000 photo) scaled to the target.
 */
import type { BoothSceneId } from '@/lib/santa/types';
import { alphaToRGBA, maskBox } from './matte';
import { coverTransform, type PersonShape, type Rect, type Size } from './layout';

export const REF: Size = { w: 800, h: 1000 };

export type Cutout = {
  /** The child, graded, with alpha; cropped to the person (+ a small margin). */
  canvas: HTMLCanvasElement;
  /** Glow ring around the silhouette, `glowPad` px bigger on each side than `canvas`. */
  glow: HTMLCanvasElement;
  glowPad: number;
  person: PersonShape;
  /** True when no usable segmentation was found and the photo is shown in a soft oval. */
  oval: boolean;
};

const LIGHT: Record<BoothSceneId, { tint: string; rim: string; glow: string; dir: [number, number] }> = {
  cheminee: { tint: 'rgba(255,150,70,0.55)', rim: 'rgb(255,214,150)', glow: 'rgba(255,190,110,0.75)', dir: [1, 0.6] },
  atelier: { tint: 'rgba(255,175,95,0.5)', rim: 'rgb(255,226,170)', glow: 'rgba(255,205,130,0.7)', dir: [-0.8, 0.8] },
  traineau: { tint: 'rgba(160,170,255,0.35)', rim: 'rgb(220,230,255)', glow: 'rgba(200,215,255,0.65)', dir: [-0.7, 0.8] },
  rennes: { tint: 'rgba(255,170,160,0.42)', rim: 'rgb(255,220,205)', glow: 'rgba(255,200,190,0.65)', dir: [0.8, 0.7] },
};

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext('2d');
  if (!x) throw new Error('2d canvas unavailable');
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  return x;
}

/** A cheap, Safari-safe blur: down-scale then up-scale. */
function softBlur(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const small = makeCanvas(src.width / factor, src.height / factor);
  ctx2d(small).drawImage(src, 0, 0, small.width, small.height);
  const out = makeCanvas(src.width, src.height);
  ctx2d(out).drawImage(small, 0, 0, out.width, out.height);
  return out;
}

/**
 * Builds the child's cut-out from the still photo and its refined alpha matte
 * (`alpha`, mw × mh, any resolution: it is scaled up smoothly).
 */
export function prepareCutout(still: HTMLCanvasElement, alpha: Float32Array, mw: number, mh: number, scene: BoothSceneId, opts: { maxHeight?: number; oval?: boolean } = {}): Cutout | null {
  const box = maskBox(alpha, mw, mh, 0.04);
  if (!box) return null;
  const strong = maskBox(alpha, mw, mh, 0.5);
  const sx = still.width / mw;
  const sy = still.height / mh;
  const padX = Math.round(mw * 0.01);
  const padY = Math.round(mh * 0.01);
  const mx0 = Math.max(0, box.x - padX);
  const my0 = Math.max(0, box.y - padY);
  const mx1 = Math.min(mw, box.x + box.w + padX);
  const my1 = Math.min(mh, box.y + box.h + padY);
  // Source rectangle in still pixels
  const srcX = mx0 * sx;
  const srcY = my0 * sy;
  const srcW = (mx1 - mx0) * sx;
  const srcH = (my1 - my0) * sy;
  const k = Math.min(1, (opts.maxHeight ?? 2000) / srcH);
  const cut = makeCanvas(srcW * k, srcH * k);
  const c = ctx2d(cut);
  c.drawImage(still, srcX, srcY, srcW, srcH, 0, 0, cut.width, cut.height);
  // Alpha: the matte as a white mask, scaled up into the cut-out ("destination-in" keeps the child)
  const maskC = makeCanvas(mw, mh);
  ctx2d(maskC).putImageData(new ImageData(alphaToRGBA(alpha), mw, mh), 0, 0);
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(maskC, mx0, my0, mx1 - mx0, my1 - my0, 0, 0, cut.width, cut.height);
  c.globalCompositeOperation = 'source-over';

  const L = LIGHT[scene];
  // Warm grading: a soft-light wash of the scene's light, alpha restored after.
  const graded = makeCanvas(cut.width, cut.height);
  const g = ctx2d(graded);
  g.drawImage(cut, 0, 0);
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = L.tint;
  g.fillRect(0, 0, graded.width, graded.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(cut, 0, 0);

  // Rim light: the silhouette minus itself shifted away from the light, blurred, kept inside, added.
  const rim = makeCanvas(cut.width, cut.height);
  const r = ctx2d(rim);
  r.drawImage(cut, 0, 0);
  r.globalCompositeOperation = 'source-in';
  r.fillStyle = L.rim;
  r.fillRect(0, 0, rim.width, rim.height);
  r.globalCompositeOperation = 'destination-out';
  const off = Math.max(2, cut.width * 0.018);
  r.drawImage(cut, -L.dir[0] * off, L.dir[1] * off);
  const rimSoft = softBlur(rim, 3);
  const rs = ctx2d(rimSoft);
  rs.globalCompositeOperation = 'destination-in';
  rs.drawImage(cut, 0, 0);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = opts.oval ? 0.15 : 0.42;
  g.drawImage(rimSoft, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  // Glow ring (outside the silhouette only)
  const glowPad = Math.round(Math.max(cut.width, cut.height) * 0.06);
  const glow = makeCanvas(cut.width + glowPad * 2, cut.height + glowPad * 2);
  const gl = ctx2d(glow);
  gl.shadowColor = L.glow;
  gl.shadowBlur = glowPad * 0.9;
  gl.drawImage(cut, glowPad, glowPad);
  gl.shadowBlur = glowPad * 0.4;
  gl.drawImage(cut, glowPad, glowPad);
  gl.shadowColor = 'transparent';
  gl.shadowBlur = 0;
  gl.globalCompositeOperation = 'destination-out';
  gl.drawImage(cut, glowPad, glowPad);

  return {
    canvas: graded,
    glow,
    glowPad,
    person: { w: graded.width, h: graded.height, touchesBottom: (strong ?? box).touchesBottom },
    oval: Boolean(opts.oval),
  };
}

// ——— snow & sparkles ———

export type Flake = { x: number; y: number; r: number; speed: number; drift: number; phase: number; a: number };
export type Sparkle = { x: number; y: number; s: number; speed: number; phase: number };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function makeSnow(seed = 42, count = 110): Flake[] {
  const r = rng(seed);
  return Array.from({ length: count }, () => {
    const depth = r();
    return { x: r(), y: r(), r: 1.6 + depth * depth * 6.5, speed: 0.025 + depth * 0.07, drift: 0.4 + r() * 1.2, phase: r() * 6.28, a: 0.45 + depth * 0.5 };
  });
}

export function makeSparkles(seed = 7, count = 16): Sparkle[] {
  const r = rng(seed);
  return Array.from({ length: count }, () => ({ x: 0.05 + r() * 0.9, y: 0.08 + r() * 0.7, s: 6 + r() * 12, speed: 1.2 + r() * 2.2, phase: r() * 6.28 }));
}

let flakeSprite: HTMLCanvasElement | null = null;
let starSprite: HTMLCanvasElement | null = null;

function sprites() {
  if (!flakeSprite) {
    flakeSprite = makeCanvas(64, 64);
    const c = ctx2d(flakeSprite);
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }
  if (!starSprite) {
    starSprite = makeCanvas(96, 96);
    const c = ctx2d(starSprite);
    const g = c.createRadialGradient(48, 48, 0, 48, 48, 40);
    g.addColorStop(0, 'rgba(255,236,170,0.9)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 96, 96);
    c.fillStyle = '#fff6d6';
    c.beginPath();
    const R = 44;
    const r = 6;
    c.moveTo(48, 48 - R);
    c.quadraticCurveTo(48 + r, 48 - r, 48 + R, 48);
    c.quadraticCurveTo(48 + r, 48 + r, 48, 48 + R);
    c.quadraticCurveTo(48 - r, 48 + r, 48 - R, 48);
    c.quadraticCurveTo(48 - r, 48 - r, 48, 48 - R);
    c.fill();
  }
  return { flake: flakeSprite, star: starSprite };
}

export function drawSnow(ctx: CanvasRenderingContext2D, W: number, H: number, flakes: Flake[], sparkles: Sparkle[], t: number) {
  const { flake, star } = sprites();
  const k = W / REF.w;
  ctx.save();
  for (const f of flakes) {
    const y = ((((f.y + t * f.speed) % 1.08) + 1.08) % 1.08) - 0.04;
    const x = f.x + Math.sin(t * f.drift + f.phase) * 0.018;
    const r = f.r * k;
    ctx.globalAlpha = f.a;
    ctx.drawImage(flake, x * W - r, y * H - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const s of sparkles) {
    const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
    const size = s.s * k * (0.55 + tw * 0.7);
    ctx.globalAlpha = 0.25 + tw * 0.75;
    ctx.drawImage(star, s.x * W - size, s.y * H - size, size * 2, size * 2);
  }
  ctx.restore();
}

// ——— frame ———

export type FrameText = { title: string; subtitle: string; watermark: string | null; font: string };

/** The font family the site uses (Fredoka, loaded by next/font), for canvas text. */
export function displayFontFamily(): string {
  if (typeof document === 'undefined') return 'ui-rounded, system-ui, sans-serif';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-fredoka').trim();
  return v ? `${v}, ui-rounded, system-ui, sans-serif` : 'ui-rounded, system-ui, sans-serif';
}

function holly(c: CanvasRenderingContext2D, x: number, y: number, s: number, flip: number) {
  c.save();
  c.translate(x, y);
  c.scale(flip * s, s);
  for (const [rot, col] of [
    [-0.5, '#1f6b3a'],
    [0.35, '#2a8a4a'],
  ] as const) {
    c.save();
    c.rotate(rot);
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(10, -12, 34, -14, 46, -2);
    c.bezierCurveTo(34, 10, 10, 10, 0, 0);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(2, 0);
    c.lineTo(42, -2);
    c.stroke();
    c.restore();
  }
  for (const [bx, by] of [
    [0, -4],
    [7, 3],
    [-6, 4],
  ]) {
    const g = c.createRadialGradient(bx - 2, by - 2, 0, bx, by, 6);
    g.addColorStop(0, '#ff8a8a');
    g.addColorStop(1, '#c4111e');
    c.fillStyle = g;
    c.beginPath();
    c.arc(bx, by, 5.5, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** Renders the static frame overlay once per size / text (it is the costly part). */
export function renderFrame(W: number, H: number, text: FrameText): HTMLCanvasElement {
  const cv = makeCanvas(W, H);
  const c = ctx2d(cv);
  const k = W / REF.w;
  // Vignette, warm
  const vg = c.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(30,8,10,0)');
  vg.addColorStop(1, 'rgba(30,8,10,0.5)');
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);
  // Bottom shade for the small text
  const bs = c.createLinearGradient(0, H * 0.82, 0, H);
  bs.addColorStop(0, 'rgba(20,6,8,0)');
  bs.addColorStop(1, 'rgba(20,6,8,0.65)');
  c.fillStyle = bs;
  c.fillRect(0, H * 0.82, W, H * 0.18);

  // Garland of lights along the top
  const m = 22 * k;
  c.save();
  c.strokeStyle = '#173a26';
  c.lineWidth = 3 * k;
  c.beginPath();
  const gy = 30 * k;
  const sag = 26 * k;
  c.moveTo(m, gy);
  c.quadraticCurveTo(W / 4, gy + sag, W / 2, gy);
  c.quadraticCurveTo((W * 3) / 4, gy + sag, W - m, gy);
  c.stroke();
  const bulbs = ['#ff5a5a', '#ffd25a', '#62e08a', '#7ab8ff', '#ff9ad6'];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const half = u < 0.5 ? u * 2 : (u - 0.5) * 2;
    const x0 = u < 0.5 ? m : W / 2;
    const x1 = u < 0.5 ? W / 2 : W - m;
    const cx = u < 0.5 ? W / 4 : (W * 3) / 4;
    const x = (1 - half) ** 2 * x0 + 2 * (1 - half) * half * cx + half ** 2 * x1;
    const y = (1 - half) ** 2 * gy + 2 * (1 - half) * half * (gy + sag) + half ** 2 * gy + 9 * k;
    const col = bulbs[i % bulbs.length];
    const gg = c.createRadialGradient(x, y, 0, x, y, 22 * k);
    gg.addColorStop(0, col + 'cc');
    gg.addColorStop(1, col + '00');
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = gg;
    c.fillRect(x - 22 * k, y - 22 * k, 44 * k, 44 * k);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(x, y, 5 * k, 8 * k, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath();
    c.ellipse(x - 1.5 * k, y - 3 * k, 1.6 * k, 2.6 * k, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();

  // Gold double border
  const gold = c.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, '#f8e3a1');
  gold.addColorStop(0.35, '#d9a640');
  gold.addColorStop(0.65, '#fff1c2');
  gold.addColorStop(1, '#c58f2a');
  c.strokeStyle = gold;
  c.lineWidth = 5 * k;
  c.beginPath();
  c.roundRect(m, m, W - 2 * m, H - 2 * m, 26 * k);
  c.stroke();
  c.globalAlpha = 0.7;
  c.lineWidth = 1.6 * k;
  c.beginPath();
  c.roundRect(m + 9 * k, m + 9 * k, W - 2 * m - 18 * k, H - 2 * m - 18 * k, 19 * k);
  c.stroke();
  c.globalAlpha = 1;

  // Ribbon
  const ry = H * 0.835;
  const rh = 78 * k;
  const rx0 = W * 0.08;
  const rx1 = W * 0.92;
  // tails (behind)
  c.fillStyle = '#8c0f1a';
  for (const side of [-1, 1]) {
    const ex = side < 0 ? rx0 : rx1;
    c.beginPath();
    c.moveTo(ex - side * 30 * k, ry + 14 * k);
    c.lineTo(ex + side * 42 * k, ry + 14 * k);
    c.lineTo(ex + side * 26 * k, ry + rh / 2 + 14 * k);
    c.lineTo(ex + side * 42 * k, ry + rh + 14 * k);
    c.lineTo(ex - side * 30 * k, ry + rh + 14 * k);
    c.fill();
  }
  const rg = c.createLinearGradient(0, ry, 0, ry + rh);
  rg.addColorStop(0, '#e8323f');
  rg.addColorStop(0.45, '#c81726');
  rg.addColorStop(1, '#9c0f1c');
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.35)';
  c.shadowBlur = 14 * k;
  c.shadowOffsetY = 5 * k;
  c.fillStyle = rg;
  c.beginPath();
  c.moveTo(rx0, ry);
  c.quadraticCurveTo(W / 2, ry - 16 * k, rx1, ry);
  c.lineTo(rx1, ry + rh);
  c.quadraticCurveTo(W / 2, ry + rh - 16 * k, rx0, ry + rh);
  c.closePath();
  c.fill();
  c.restore();
  // gold piping
  c.strokeStyle = gold;
  c.lineWidth = 2.2 * k;
  for (const dy of [5 * k, rh - 5 * k]) {
    c.beginPath();
    c.moveTo(rx0, ry + dy);
    c.quadraticCurveTo(W / 2, ry + dy - 16 * k, rx1, ry + dy);
    c.stroke();
  }
  holly(c, rx0 + 6 * k, ry + 6 * k, 1.25 * k, -1);
  holly(c, rx1 - 6 * k, ry + 6 * k, 1.25 * k, 1);

  // Title, fitted to the ribbon
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  let size = 46 * k;
  const maxW = (rx1 - rx0) * 0.8;
  c.font = `700 ${size}px ${text.font}`;
  const tw = c.measureText(text.title).width;
  if (tw > maxW) size *= maxW / tw;
  c.font = `700 ${size}px ${text.font}`;
  c.fillStyle = 'rgba(90,0,10,0.55)';
  c.fillText(text.title, W / 2, ry + rh / 2 - 6 * k + 2.5 * k);
  c.fillStyle = '#fff7e6';
  c.fillText(text.title, W / 2, ry + rh / 2 - 6 * k);

  // Subtitle
  c.font = `600 ${19 * k}px ${text.font}`;
  c.fillStyle = 'rgba(255,244,220,0.92)';
  c.fillText(text.subtitle, W / 2, H - m - 24 * k);

  // Watermark (free photo): a calm pill at the top
  if (text.watermark) {
    c.font = `700 ${18 * k}px ${text.font}`;
    const ww = c.measureText(text.watermark).width + 34 * k;
    const wy = 84 * k;
    c.fillStyle = 'rgba(20,10,30,0.42)';
    c.beginPath();
    c.roundRect(W / 2 - ww / 2, wy - 17 * k, ww, 34 * k, 17 * k);
    c.fill();
    c.strokeStyle = 'rgba(255,236,180,0.6)';
    c.lineWidth = 1.2 * k;
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.fillText(text.watermark, W / 2, wy + 1 * k);
  }
  return cv;
}

// ——— composite ———

export type Scene = {
  backdrop: { canvas: CanvasImageSource; w: number; h: number } | null;
  cutout: Cutout | null;
  /** Where the cut-out goes, REF units. */
  rect: Rect | null;
  /** Live preview cut-out (fast matte), drawn instead of `cutout` when set. */
  live?: { canvas: HTMLCanvasElement; rect: Rect } | null;
  flakes: Flake[];
  sparkles: Sparkle[];
  frame: HTMLCanvasElement | null;
  t: number;
};

export function drawComposite(ctx: CanvasRenderingContext2D, W: number, H: number, s: Scene) {
  const k = W / REF.w;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Night-blue base, in case the scene is not ready yet
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#1b1f5c');
  base.addColorStop(1, '#5a1f3c');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  if (s.backdrop && s.backdrop.w > 0 && s.backdrop.h > 0) {
    const t = coverTransform({ w: s.backdrop.w, h: s.backdrop.h }, { w: W, h: H });
    try {
      ctx.drawImage(s.backdrop.canvas, t.ox, t.oy, s.backdrop.w * t.scale, s.backdrop.h * t.scale);
    } catch {
      /* a lost WebGL context: keep the base */
    }
  }
  if (s.live && s.live.rect.w > 0) {
    const r = s.live.rect;
    ctx.drawImage(s.live.canvas, r.x * k, r.y * k, r.w * k, r.h * k);
  } else if (s.cutout && s.rect && s.rect.w > 0) {
    const r = { x: s.rect.x * k, y: s.rect.y * k, w: s.rect.w * k, h: s.rect.h * k };
    const cu = s.cutout;
    if (!cu.person.touchesBottom) {
      // Soft contact shadow under the feet
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h - r.h * 0.01;
      const rw = r.w * 0.42;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rw);
      g.addColorStop(0, 'rgba(25,10,5,0.5)');
      g.addColorStop(1, 'rgba(25,10,5,0)');
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.18);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = g;
      ctx.fillRect(cx - rw, cy - rw, rw * 2, rw * 2);
      ctx.restore();
    }
    const gk = r.w / cu.canvas.width;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(cu.glow, r.x - cu.glowPad * gk, r.y - cu.glowPad * gk, cu.glow.width * gk, cu.glow.height * gk);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(cu.canvas, r.x, r.y, r.w, r.h);
  }
  drawSnow(ctx, W, H, s.flakes, s.sparkles, s.t);
  if (s.frame) ctx.drawImage(s.frame, 0, 0, W, H);
  ctx.restore();
}
