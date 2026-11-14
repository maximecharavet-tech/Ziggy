/**
 * Browser helpers around the Rust engine (./engine.ts): canvas in, results out.
 * The page decodes images with the browser (canvas), so the browser build of
 * the engine has no image decoders.
 */
import { loadEngine } from './engine';
import type { CardStyle, CctvStyle, ElfId, Rect, RgbaLike, SceneAnalysis, Verification } from './types';

export type Scene = SceneAnalysis;

/** Longest side used for the on-device verification (the engine compares at 256 px). */
const VERIFY_MAX = 512;

type Drawable = HTMLCanvasElement | ImageBitmap;

/** RGBA pixels of a drawable, downscaled (high-quality smoothing) to fit `max` if given. */
function pixels(src: Drawable, max = Infinity): RgbaLike {
  const s = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * s));
  const h = Math.max(1, Math.round(src.height * s));
  if (s === 1 && src instanceof HTMLCanvasElement) {
    const d = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h);
    return { data: d.data, width: w, height: h };
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
}

/** Scene analysis of the room photo (sent with the generation request). */
export async function analyzePhoto(photo: HTMLCanvasElement): Promise<Scene> {
  const engine = await loadEngine();
  return engine.analyzeScene(pixels(photo));
}

/**
 * Checks a generated picture against the photo: same room, requested elves
 * present, no extra elf. `mask`: where the elves were asked to be (e.g. the
 * scene's stages), optional. Pass `reasons` as `failed` to the retry.
 */
export async function verifyResult(generated: Blob, photo: HTMLCanvasElement, elves: string[], mask?: Rect[]): Promise<Verification> {
  const engine = await loadEngine();
  const bmp = await createImageBitmap(generated);
  try {
    return engine.verify(pixels(bmp, VERIFY_MAX), pixels(photo, VERIFY_MAX), { elves: elves as ElfId[], mask });
  } finally {
    bmp.close();
  }
}

/**
 * Prepares the magic card of `base` drawn into `out` (its size is the card's
 * size) and returns `draw(t)`, which paints the frame at `t` seconds. The
 * returned function also has `free()` (the renderer is otherwise freed when
 * garbage-collected).
 */
export async function renderCard(
  base: HTMLCanvasElement,
  out: HTMLCanvasElement,
  opts: { seed?: number; style?: CardStyle } = {},
): Promise<((t: number) => void) & { free: () => void }> {
  const engine = await loadEngine();
  const r = engine.createCardRenderer(pixels(base), opts.seed ?? 1, { ...opts.style, out_w: out.width, out_h: out.height });
  const ctx = out.getContext('2d')!;
  const draw = (t: number) => {
    const view = r.renderView(t);
    ctx.putImageData(new ImageData(view as Uint8ClampedArray<ArrayBuffer>, r.width, r.height), 0, 0);
  };
  return Object.assign(draw, { free: () => r.free() });
}

/**
 * Prepares the security-camera look of `base` drawn into `out` (its size is
 * the clip's size) and returns `draw(t)`, which paints the frame at `t`
 * seconds (no text: draw the camera name / REC / timestamp on top). Also
 * carries `free()` and the zoom target `focus` (normalised).
 */
export async function renderCctv(
  base: HTMLCanvasElement,
  out: HTMLCanvasElement,
  opts: { seed?: number; style?: CctvStyle } = {},
): Promise<((t: number) => void) & { free: () => void; focus: { x: number; y: number } }> {
  const engine = await loadEngine();
  const r = engine.createCctvRenderer(pixels(base), opts.seed ?? 1, { ...opts.style, out_w: out.width, out_h: out.height });
  const ctx = out.getContext('2d')!;
  const draw = (t: number) => {
    const view = r.renderView(t);
    ctx.putImageData(new ImageData(view as Uint8ClampedArray<ArrayBuffer>, r.width, r.height), 0, 0);
  };
  return Object.assign(draw, { free: () => r.free(), focus: r.focus });
}
