/**
 * Code-drawn particle shapes for the canvas stage: no image files. Each shape
 * is a unit Path2D built once (radius 1, centred), then scaled per particle.
 */
import type { Particle } from './physics';

let paths: Record<'star' | 'heart' | 'sparkle' | 'ribbon' | 'dot', Path2D> | null = null;

function buildPaths() {
  const star = new Path2D();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 1 : 0.46;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  star.closePath();

  const heart = new Path2D();
  heart.moveTo(0, 0.95);
  heart.bezierCurveTo(-0.15, 0.78, -1, 0.3, -1, -0.25);
  heart.bezierCurveTo(-1, -0.8, -0.35, -1.05, 0, -0.55);
  heart.bezierCurveTo(0.35, -1.05, 1, -0.8, 1, -0.25);
  heart.bezierCurveTo(1, 0.3, 0.15, 0.78, 0, 0.95);
  heart.closePath();

  // The four-point sparkle of the mascot artwork.
  const sparkle = new Path2D();
  sparkle.moveTo(0, -1);
  sparkle.bezierCurveTo(0.08, -0.42, 0.42, -0.08, 1, 0);
  sparkle.bezierCurveTo(0.42, 0.08, 0.08, 0.42, 0, 1);
  sparkle.bezierCurveTo(-0.08, 0.42, -0.42, 0.08, -1, 0);
  sparkle.bezierCurveTo(-0.42, -0.08, -0.08, -0.42, 0, -1);
  sparkle.closePath();

  // A curly party ribbon (stroked).
  const ribbon = new Path2D();
  ribbon.moveTo(-1, 0);
  ribbon.bezierCurveTo(-0.66, -0.9, -0.33, 0.9, 0, 0);
  ribbon.bezierCurveTo(0.33, -0.9, 0.66, 0.9, 1, 0);

  const dot = new Path2D();
  dot.arc(0, 0, 1, 0, Math.PI * 2);

  return { star, heart, sparkle, ribbon, dot };
}

const sprites = new Map<string, HTMLCanvasElement>();
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

/** An emoji drawn once into a small canvas, then stamped (text layout every frame is slow). */
function emojiSprite(emoji: string, size: number): HTMLCanvasElement | null {
  const px = Math.max(8, Math.round(size / 8) * 8);
  const key = `${emoji}|${px}`;
  const hit = sprites.get(key);
  if (hit) return hit;
  if (sprites.size > 64) sprites.clear();
  const c = document.createElement('canvas');
  const side = Math.ceil(px * 1.35);
  c.width = c.height = side;
  const g = c.getContext('2d');
  if (!g) return null;
  g.font = `${px}px ${EMOJI_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, side / 2, side / 2 + px * 0.06);
  sprites.set(key, c);
  return c;
}

/** Draws one particle. `ctx` already carries the device-pixel transform. */
export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number, scale: number, dpr: number): void {
  if (alpha <= 0.01 || scale <= 0.01) return;
  paths ??= buildPaths();
  const s = (p.size / 2) * scale;
  const cos = Math.cos(p.rot);
  const sin = Math.sin(p.rot);
  ctx.globalAlpha = alpha;
  ctx.setTransform(cos * s * dpr, sin * s * dpr, -sin * s * dpr, cos * s * dpr, p.x * dpr, p.y * dpr);

  switch (p.kind) {
    case 'rect': {
      // Paper turning over: one axis shrinks with the flip, as if seen edge-on.
      const f = Math.cos(p.flip);
      ctx.fillStyle = p.color;
      ctx.fillRect(-1, -0.6 * Math.abs(f) - 0.04, 2, 1.2 * Math.abs(f) + 0.08);
      break;
    }
    case 'ribbon': {
      const f = Math.cos(p.flip);
      ctx.scale(1, 0.35 + 0.65 * Math.abs(f));
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.32;
      ctx.lineCap = 'round';
      ctx.stroke(paths.ribbon);
      break;
    }
    case 'ball': {
      // Ziggy's antenna ball: felt-green ball, a little stalk and a soft highlight.
      ctx.fillStyle = '#5E9E40';
      ctx.fillRect(-0.14, 0.55, 0.28, 0.75);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 0.78, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(-0.25, -0.28, 0.24, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'emoji': {
      const sprite = p.emoji ? emojiSprite(p.emoji, p.size * scale) : null;
      if (sprite) {
        ctx.setTransform(cos * dpr, sin * dpr, -sin * dpr, cos * dpr, p.x * dpr, p.y * dpr);
        const w = (sprite.width * p.size * scale) / Math.max(8, Math.round((p.size * scale) / 8) * 8);
        ctx.drawImage(sprite, -w / 2, -w / 2, w, w);
      }
      break;
    }
    case 'dot':
      ctx.fillStyle = p.color;
      ctx.fill(paths.dot);
      break;
    case 'heart':
      ctx.fillStyle = p.color;
      ctx.fill(paths.heart);
      break;
    case 'sparkle':
      ctx.fillStyle = p.color;
      ctx.fill(paths.sparkle);
      break;
    case 'star':
    default:
      ctx.fillStyle = p.color;
      ctx.fill(paths.star);
      break;
  }
}
