import { paintAll } from './brush-render';
import { fillsSvg, lineArtSvg, viewSize } from './svg';
import type { ColoringPage, Drawing, Sticker } from './types';

/**
 * Turns a drawing into pixels (save thumbnail, download, print, 3D texture):
 * colours, then brush strokes, then the line art multiplied on top, then the
 * stickers — the same layers as on screen.
 */

export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

export function drawSticker(ctx: CanvasRenderingContext2D, s: Sticker, scale: number) {
  ctx.save();
  ctx.translate(s.x * scale, s.y * scale);
  ctx.rotate((s.r * Math.PI) / 180);
  ctx.font = `${Math.round(s.s * scale)}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.e, 0, 0);
  ctx.restore();
}

export async function renderArtwork(page: ColoringPage, drawing: Drawing, size: number): Promise<HTMLCanvasElement> {
  const { w, h } = viewSize(page);
  const height = Math.round((size * h) / w);
  const scale = size / w;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, height);
  const [fills, lines] = await Promise.all([loadImage(svgDataUrl(fillsSvg(page, drawing.fills, size, height))), loadImage(svgDataUrl(lineArtSvg(page, size, height)))]);
  ctx.drawImage(fills, 0, 0, size, height);
  if (drawing.strokes.length) {
    const layer = document.createElement('canvas');
    layer.width = size;
    layer.height = height;
    paintAll(layer.getContext('2d')!, drawing.strokes, scale);
    ctx.drawImage(layer, 0, 0);
  }
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lines, 0, 0, size, height);
  ctx.globalCompositeOperation = 'source-over';
  for (const s of drawing.stickers) drawSticker(ctx, s, scale);
  return canvas;
}

/** Small PNG for the gallery. */
export function thumbnail(canvas: HTMLCanvasElement, width = 320): string {
  const t = document.createElement('canvas');
  t.width = width;
  t.height = Math.round((canvas.height * width) / canvas.width);
  const ctx = t.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL('image/png');
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve();
    }, 'image/png');
  });
}

export const fileName = (pageId: string) => `ziggy-coloriage-${pageId}-${new Date().toISOString().slice(0, 10)}.png`;
