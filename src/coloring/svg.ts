import { MAGIC, fillAttr, gradientVector } from './palette';
import type { ColoringPage, Detail } from './types';

/**
 * SVG text for a page, used to rasterize (save, 3D, download) and print.
 * The live page is rendered with React from the same rules (see Stage).
 *
 * Layers, bottom to top:
 *   1. fills     the colours of the regions, no outline
 *   2. brush     freehand strokes (canvas)
 *   3. line art  white regions + black outlines, blended with "multiply" so
 *                white disappears and only the outlines stay above the colours
 *   4. stickers
 */

export const INK = '#1d1d2b';
export const OUTLINE = 5;
export const DETAIL = 4;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function viewSize(page: ColoringPage): { w: number; h: number } {
  const [, , w, h] = page.viewBox.split(/\s+/).map(Number);
  return { w, h };
}

export function magicDefs(): string {
  return MAGIC.map((m) => {
    const v = gradientVector(m.angle);
    const stops = m.stops.map((c, i) => `<stop offset="${(i / (m.stops.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join('');
    return `<linearGradient id="magic-${m.id}" x1="${v.x1}" y1="${v.y1}" x2="${v.x2}" y2="${v.y2}">${stops}</linearGradient>`;
  }).join('');
}

export function detailAttrs(x: Detail): { fill: string; stroke: string; strokeWidth: number } {
  if (x.fill === 'ink') return { fill: INK, stroke: INK, strokeWidth: x.w ?? 1 };
  if (x.fill === 'white') return { fill: '#ffffff', stroke: 'none', strokeWidth: 0 };
  return { fill: 'none', stroke: INK, strokeWidth: x.w ?? DETAIL };
}

const detailSvg = (x: Detail) => {
  const a = detailAttrs(x);
  return `<path d="${esc(x.d)}" fill="${a.fill}" stroke="${a.stroke}" stroke-width="${a.strokeWidth}"/>`;
};

const open = (page: ColoringPage, w?: number, h?: number) => {
  const size = w && h ? ` width="${w}" height="${h}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${page.viewBox}"${size}>`;
};

/** Layer 1: the colours only. */
export function fillsSvg(page: ColoringPage, fills: Record<string, string>, w?: number, h?: number): string {
  const paths = page.regions.map((r) => `<path d="${esc(r.d)}" fill="${fillAttr(fills[r.id])}"/>`).join('');
  return `${open(page, w, h)}<defs>${magicDefs()}</defs>${paths}</svg>`;
}

/** Layer 3: white regions with outlines (and the decorative lines). */
export function lineArtSvg(page: ColoringPage, w?: number, h?: number): string {
  return flatSvg(page, {}, w, h);
}

/** Colours and outlines in one picture (thumbnails, model, printing a blank sheet). */
export function flatSvg(page: ColoringPage, fills: Record<string, string>, w?: number, h?: number): string {
  // Outlines are drawn per region, in order, so covered outlines stay hidden.
  const outlined = page.regions
    .map((r) => `<path d="${esc(r.d)}" fill="${fillAttr(fills[r.id])}" stroke="${INK}" stroke-width="${OUTLINE}"/>${(r.deco ?? []).map(detailSvg).join('')}`)
    .join('');
  const details = page.details.map(detailSvg).join('');
  return `${open(page, w, h)}<defs>${magicDefs()}</defs><g stroke-linejoin="round" stroke-linecap="round">${outlined}${details}</g></svg>`;
}

/** The model's colours for every region. */
export const modelFills = (page: ColoringPage): Record<string, string> => Object.fromEntries(page.regions.map((r) => [r.id, r.c]));
