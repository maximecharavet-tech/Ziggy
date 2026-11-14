/**
 * "Caméra de surveillance des lutins": a prank picture shown as a short
 * "caught on camera" clip (night vision or grey CCTV, slow zoom toward the
 * elves, grain, scanlines, interference), with a camera name, a blinking REC
 * dot and a running timestamp. Everything is made on the device: the Rust
 * engine draws the camera look (./client-engine.ts `renderCctv`), the overlay
 * is drawn here on a 2D canvas, and the browser records the canvas
 * (MediaRecorder). Nothing is uploaded.
 *
 *   const blob = await makeCctvClip(entry, { room: 'Salon', locale });   // stored on the entry
 *   const live = await prepareCctv(entry.image, { room: 'Salon', locale }); // live preview: live.draw(t)
 */
import type { JournalEntry } from './journal';
import type { CctvStyle, Rect } from './types';

export type CctvLook = NonNullable<CctvStyle['look']>;

export type CctvOptions = {
  /** Room shown in the camera name ("Salon" → "CAM 02 · SALON"). */
  room: string;
  /** Wall-clock time of the first frame [the night before `revealAt`, between 2:00 and 4:00]. */
  time?: Date;
  /** "fr" → French labels and day/month/year; anything else English (year-month-day). */
  locale: string;
  /** Clip length in seconds, 6–8 [7]. */
  seconds?: number;
  /** Camera number, 1–9 [from the entry id]. */
  camera?: number;
  /** Night vision or grey CCTV [night between 19:00 and 7:59, else grey]. */
  look?: CctvLook;
  /** Store the clip on the journal entry (`cctv`) [true]. */
  store?: boolean;
  onProgress?: (p: number) => void;
};

/** What the overlay shows. */
export type CctvLabels = {
  camera: string;
  start: Date;
  look: CctvLook;
  locale: string;
  /** Seconds the zoom takes (the "MOTION" tag shows once it is done). */
  zoomSeconds: number;
};

/** FNV-1a 32 of a string (stable seeds and defaults per entry). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "24/12/2026 03:12:47" (fr) or "2026-12-24 03:12:47" (other locales). */
export function formatCctvTime(d: Date, locale: string): string {
  const day = locale === 'fr' ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** "CAM 02 · SALON": the room in capitals, without accents (DVR fonts have none), at most 16 characters. */
export function cctvCameraLabel(camera: number, room: string): string {
  const n = Math.min(9, Math.max(1, Math.round(Number.isFinite(camera) ? camera : 1)));
  const clean = room
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 '-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return clean ? `CAM ${pad(n)} · ${clean}` : `CAM ${pad(n)}`;
}

/** When the elves were "caught": the night before the reveal, between 2:00 and 3:59, stable per entry. */
export function defaultCctvTime(entry: Pick<JournalEntry, 'id' | 'revealAt' | 'createdAt'>): Date {
  const h = hash32(entry.id);
  const reveal = new Date(entry.revealAt);
  const base = Number.isFinite(reveal.getTime()) ? reveal : new Date(entry.createdAt);
  const d = Number.isFinite(base.getTime()) ? new Date(base) : new Date();
  // Revealed in the morning → that same night; revealed later in the day → the night before.
  if (d.getHours() >= 4) d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - 1);
  d.setHours(2 + (h % 2), (h >>> 3) % 60, (h >>> 9) % 60, 0);
  return d;
}

/** Night vision at night (19:00–7:59), grey CCTV in the day. */
export function cctvLookFor(d: Date): CctvLook {
  const hr = d.getHours();
  return hr >= 19 || hr < 8 ? 'night' : 'grey';
}

/** The zoom target from the parent's marks of the elves (`entry.spots`), or null (the engine looks for them). */
export function focusFromSpots(spots: JournalEntry['spots'], aspect: number): Rect | null {
  if (!spots?.length) return null;
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  for (const s of spots) {
    if (![s.x, s.y, s.r].every(Number.isFinite)) continue;
    const ry = s.r * (Number.isFinite(aspect) && aspect > 0 ? aspect : 1);
    x0 = Math.min(x0, s.x - s.r);
    x1 = Math.max(x1, s.x + s.r);
    y0 = Math.min(y0, s.y - ry);
    y1 = Math.max(y1, s.y + ry);
  }
  if (x1 <= x0 || y1 <= y0) return null;
  const c = (v: number) => Math.min(1, Math.max(0, v));
  return { x: c(x0), y: c(y0), w: c(x1) - c(x0), h: c(y1) - c(y0) };
}

const T = {
  motion: { fr: 'MOUVEMENT', en: 'MOTION' },
  ir: { fr: 'IR ACTIF', en: 'IR ON' },
};

/**
 * Draws the camera overlay (text in a chunky pixel style, viewfinder corners,
 * blinking REC) for time `t`. The text is rasterised on a small canvas with
 * hard alpha and scaled up without smoothing; it is rebuilt only when the
 * visible state changes (twice a second at most).
 */
export function makeOverlay(w: number, h: number, labels: CctvLabels): (ctx: CanvasRenderingContext2D, t: number) => void {
  const px = Math.max(2, Math.round(Math.min(w, h) / 240));
  const sw = Math.ceil(w / px);
  const sh = Math.ceil(h / px);
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const g = small.getContext('2d', { willReadFrequently: true })!;
  const fr = labels.locale === 'fr';
  let key = '';

  const build = (t: number) => {
    g.clearRect(0, 0, sw, sh);
    g.font = 'bold 10px ui-monospace, "DejaVu Sans Mono", "Courier New", monospace';
    g.textBaseline = 'top';
    const m = 6;
    const text = (s: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') => {
      g.textAlign = align;
      g.fillStyle = 'rgba(0,0,0,0.85)';
      g.fillText(s, x + 1, y + 1);
      g.fillStyle = color;
      g.fillText(s, x, y);
    };
    const white = labels.look === 'night' ? '#eaffea' : '#ffffff';
    text(labels.camera, m, m, white);
    const rec = Math.floor(t * 2) % 2 === 0;
    if (rec) {
      g.fillStyle = '#ff2b2b';
      g.beginPath();
      g.arc(sw - m - g.measureText('REC').width - 6, m + 4.5, 3.5, 0, Math.PI * 2);
      g.fill();
    }
    text('REC', sw - m, m, white, 'right');
    const now = new Date(labels.start.getTime() + Math.floor(t) * 1000);
    text(formatCctvTime(now, labels.locale), m, sh - m - 10, white);
    if (labels.look === 'night') text(fr ? T.ir.fr : T.ir.en, sw - m, sh - m - 10, white, 'right');
    // "MOTION" once the camera has zoomed in, blinking.
    if (t >= labels.zoomSeconds * 0.6 && Math.floor(t * 2) % 2 === 0) {
      const label = fr ? T.motion.fr : T.motion.en;
      g.font = 'bold 9px ui-monospace, "DejaVu Sans Mono", "Courier New", monospace';
      const tw = Math.ceil(g.measureText(label).width) + 8;
      const x = Math.round(sw / 2 - tw / 2);
      const y = sh - m - 26;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(x, y - 2, tw, 13);
      g.strokeStyle = '#ffd43b';
      g.strokeRect(x + 0.5, y - 1.5, tw - 1, 12);
      text(label, sw / 2, y, '#ffd43b', 'center');
    }
    // Viewfinder corners.
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 1;
    const c = Math.round(Math.min(sw, sh) * 0.08);
    const i0 = m + 14;
    const corners: [number, number, number, number][] = [
      [m, i0, 1, 1],
      [sw - m, i0, -1, 1],
      [m, sh - i0, 1, -1],
      [sw - m, sh - i0, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      g.beginPath();
      g.moveTo(x + 0.5 * dx, y + c * dy);
      g.lineTo(x + 0.5 * dx, y + 0.5 * dy);
      g.lineTo(x + c * dx, y + 0.5 * dy);
      g.stroke();
    }
    // Hard alpha: no anti-aliased fringes, so the upscale looks like a DVR font.
    const img = g.getImageData(0, 0, sw, sh);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 90 ? 255 : 0;
    g.putImageData(img, 0, 0);
  };

  return (ctx, t) => {
    const k = `${Math.floor(t)}|${Math.floor(t * 2) % 2}|${t >= labels.zoomSeconds * 0.6}`;
    if (k !== key) {
      key = k;
      build(t);
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, sw * px, sh * px);
    ctx.restore();
  };
}

/** A live security-camera view of a picture: `draw(t)` paints the frame at `t` seconds on `canvas`. */
export type CctvView = {
  canvas: HTMLCanvasElement;
  draw: (t: number) => void;
  free: () => void;
  labels: CctvLabels;
};

/**
 * Prepares the camera view of `image` (output fits `maxSide`, default 900 px,
 * keeping the picture's aspect). `spots` (the parent's marks of the elves)
 * aim the zoom; without them the engine looks for the elves' colours.
 */
export async function prepareCctv(
  image: Blob,
  opts: Omit<CctvOptions, 'store' | 'onProgress' | 'seconds'> & { seed?: number; spots?: JournalEntry['spots']; maxSide?: number; zoomSeconds?: number },
): Promise<CctvView> {
  const { renderCctv } = await import('./client-engine');
  const bmp = await createImageBitmap(image);
  const max = opts.maxSide ?? 900;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(16, Math.round((bmp.width * s) / 2) * 2);
  const h = Math.max(16, Math.round((bmp.height * s) / 2) * 2);
  // The engine samples the picture a little larger than the clip (its digital zoom stays sharp).
  const k = Math.min(1, (max * 1.4) / Math.max(bmp.width, bmp.height));
  const base = document.createElement('canvas');
  base.width = Math.max(2, Math.round(bmp.width * k));
  base.height = Math.max(2, Math.round(bmp.height * k));
  const bctx = base.getContext('2d', { willReadFrequently: true })!;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(bmp, 0, 0, base.width, base.height);
  const aspect = bmp.width / bmp.height;
  bmp.close();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const start = opts.time ?? new Date();
  const look = opts.look ?? cctvLookFor(start);
  const zoomSeconds = opts.zoomSeconds ?? 5.5;
  const focus = focusFromSpots(opts.spots, aspect);
  const draw = await renderCctv(base, canvas, { seed: opts.seed ?? 1, style: { look, duration: zoomSeconds, ...(focus ? { focus } : {}) } });
  const labels: CctvLabels = { camera: cctvCameraLabel(opts.camera ?? 2, opts.room), start, look, locale: opts.locale, zoomSeconds };
  const overlay = makeOverlay(w, h, labels);
  const ctx = canvas.getContext('2d')!;
  return {
    canvas,
    labels,
    draw: (t: number) => {
      draw(t);
      overlay(ctx, t);
    },
    free: () => draw.free(),
  };
}

/**
 * Records the "caught on camera" clip of a journal entry (6–8 s, MP4 or WebM)
 * and, unless `store: false`, saves it on the entry (`cctv`). Rejects when the
 * browser cannot record a canvas.
 */
export async function makeCctvClip(entry: JournalEntry, opts: CctvOptions): Promise<Blob> {
  const { recordCanvas, canRecordVideo } = await import('@/components/santa/booth/record');
  if (!canRecordVideo()) throw new Error('no recorder');
  const seconds = Math.min(8, Math.max(6, opts.seconds ?? 7));
  const h = hash32(entry.id);
  const time = opts.time ?? defaultCctvTime(entry);
  const view = await prepareCctv(entry.image, {
    room: opts.room,
    time,
    locale: opts.locale,
    camera: opts.camera ?? 1 + (h % 4),
    look: opts.look,
    seed: h,
    spots: entry.spots,
    zoomSeconds: seconds * 0.8,
  });
  try {
    const clip = await recordCanvas(view.canvas, { seconds, draw: view.draw, fps: 24, onProgress: opts.onProgress });
    if (opts.store !== false) {
      const { journal } = await import('./journal');
      await journal.patch(entry.id, { cctv: clip.blob });
    }
    return clip.blob;
  } finally {
    view.free();
  }
}
