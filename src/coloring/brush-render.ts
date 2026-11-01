import { isMagic, magicAt, mix, rainbowAt, solidHex } from './palette';
import { hashString, seeded, segPoint, segments } from './smoothing';
import type { Stroke } from './types';

/** Colour of a stroke at a distance along it. */
export function strokeColorAt(s: Stroke, dist: number): string {
  if (s.tool === 'rainbow') return rainbowAt(dist);
  if (isMagic(s.color)) return magicAt(s.color, dist);
  return solidHex(s.color);
}

/** A tiny four-point sparkle. */
export function sparklePath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const k = r * 0.28;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.closePath();
}

/**
 * Paints segments [from, to) of a stroke. `scale` maps page units to canvas
 * pixels. Glitter dots are seeded by the stroke id, so redraws are identical.
 */
export function paintStroke(ctx: CanvasRenderingContext2D, s: Stroke, scale: number, from = 0, to?: number) {
  const segs = segments(s.pts);
  const end = Math.min(to ?? segs.length, segs.length);
  if (from >= end) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (s.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
  for (let i = from; i < end; i++) {
    const g = segs[i];
    const w = Math.max(0.5, g.w * scale);
    let color = s.tool === 'eraser' ? '#000' : strokeColorAt(s, g.dist);
    if (s.tool === 'glitter' && color.startsWith('#')) color = mix(color, '#ffffff', 0.12);
    if (g.x0 === g.x1 && g.y0 === g.y1 && g.cx === g.x0 && g.cy === g.y0) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(g.x0 * scale, g.y0 * scale, w / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(g.x0 * scale, g.y0 * scale);
    ctx.quadraticCurveTo(g.cx * scale, g.cy * scale, g.x1 * scale, g.y1 * scale);
    ctx.stroke();
  }
  if (s.tool === 'glitter') {
    for (let i = from; i < end; i++) {
      const g = segs[i];
      const rnd = seeded(hashString(s.id) + i * 7919);
      const count = 1 + Math.floor(rnd() * 2.2);
      for (let k = 0; k < count; k++) {
        const p = segPoint(g, rnd());
        const off = (rnd() - 0.5) * g.w * 0.8;
        const ang = rnd() * Math.PI * 2;
        const x = (p.x + Math.cos(ang) * off) * scale;
        const y = (p.y + Math.sin(ang) * off) * scale;
        const r = (0.12 + rnd() * 0.16) * g.w * scale;
        ctx.globalAlpha = 0.75 + rnd() * 0.25;
        ctx.fillStyle = rnd() > 0.45 ? '#ffffff' : '#FFE27A';
        sparklePath(ctx, x, y, r);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function paintAll(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const s of strokes) paintStroke(ctx, s, scale);
}

/** Random points on glitter strokes (for the twinkles that live on them). */
export function glitterPoints(strokes: Stroke[], max = 400): { x: number; y: number; w: number }[] {
  const out: { x: number; y: number; w: number }[] = [];
  for (const s of strokes) {
    if (s.tool !== 'glitter') continue;
    for (let i = 0; i < s.pts.length; i += 9) out.push({ x: s.pts[i], y: s.pts[i + 1], w: s.pts[i + 2] });
  }
  if (out.length <= max) return out;
  const step = out.length / max;
  return Array.from({ length: max }, (_, i) => out[Math.floor(i * step)]);
}
