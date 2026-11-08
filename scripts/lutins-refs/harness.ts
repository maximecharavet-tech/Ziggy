/**
 * Browser side of the elves' reference renderer (bundled by render.mjs with
 * esbuild, opened by Playwright). Two jobs, chosen by the URL query:
 *
 * - `job=sheet&layout=lineup|lineup34|turnaround|avatar[&elf=id]&w=&h=&ss=&transparent=1`
 *   renders a still at `ss`× the size, downsamples it (supersampling) and
 *   leaves a PNG data URL in `window.__result`;
 * - `job=live&mode=hero|stage[&transparent=1&az=&el=&zoom=&reduce=1&low=1]`
 *   mounts the animated scene full-window (screenshots, page-error checks)
 *   and sets `window.__ready` after a few frames.
 */
import { mountLutinsScene } from '../../src/games3d/lutins';
import type { ElfId, LutinsSceneMode, SheetLayout } from '../../src/games3d/lutins/types';

declare global {
  interface Window {
    __result?: string;
    __ready?: boolean;
    __error?: string;
  }
}

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);

/** Halve repeatedly with high-quality smoothing (cleaner than one big step). */
function downsample(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  let cur: HTMLCanvasElement = src;
  while (cur.width / 2 >= w && cur.height / 2 >= h) {
    const c = document.createElement('canvas');
    c.width = Math.round(cur.width / 2);
    c.height = Math.round(cur.height / 2);
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  if (cur.width !== w || cur.height !== h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, w, h);
    cur = c;
  }
  return cur;
}

function sheetJob() {
  const w = num('w', 1536);
  const h = num('h', 1024);
  const ss = num('ss', 2);
  const kind = q.get('layout') ?? 'lineup';
  const elf = (q.get('elf') ?? 'pepin') as ElfId;
  const layout: SheetLayout = kind === 'lineup' || kind === 'lineup34' ? { kind } : { kind: kind as 'turnaround' | 'avatar', elf };
  const transparent = q.get('transparent') === '1';
  const canvas = document.createElement('canvas');
  canvas.width = w * ss;
  canvas.height = h * ss;
  const handle = mountLutinsScene(canvas, { mode: 'sheet', sheet: layout, transparent, pixelRatio: 1, lowPower: false, reducedMotion: true });
  handle.renderSheetFrame?.();
  const out = downsample(canvas, w, h);
  window.__result = out.toDataURL('image/png');
  handle.dispose();
}

function liveJob() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';
  document.body.appendChild(canvas);
  const transparent = q.get('transparent') === '1';
  if (transparent) document.body.style.background = 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 24px 24px';
  const handle = mountLutinsScene(canvas, {
    mode: (q.get('mode') ?? 'hero') as LutinsSceneMode,
    transparent,
    reducedMotion: q.get('reduce') === '1',
    lowPower: q.has('low') ? q.get('low') === '1' : undefined,
    camera: { azimuth: num('az', 0), elevation: num('el', 12), zoom: num('zoom', 1) },
  });
  let frames = 0;
  const tick = () => {
    frames++;
    if (frames > num('frames', 40)) window.__ready = true;
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  (window as unknown as { __handle: unknown }).__handle = handle;
}

try {
  if ((q.get('job') ?? 'sheet') === 'sheet') sheetJob();
  else liveJob();
} catch (e) {
  window.__error = String((e as Error)?.stack ?? e);
}
