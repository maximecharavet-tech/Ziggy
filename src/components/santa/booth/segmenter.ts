/**
 * Photo booth — on-device person segmentation (MediaPipe Tasks Vision, Apache-2.0).
 *
 * Privacy: the child's picture never leaves the device. Everything is
 * self-hosted under /santa/mediapipe (wasm + models, see
 * scripts/santa-mediapipe.mjs), loaded only on the booth page.
 *
 * MediaPipe 1.2.2 also ships a usage logger that POSTs task statistics (task
 * type, timings, platform — never pixels) to odml.pa.googleapis.com every
 * minute. Ziggy has no tracking, so `blockMediapipeLogging()` answers those
 * requests locally with an empty 204 before the library loads: the logger
 * sees a failure and switches itself off for good.
 *
 * One segmenter instance only (one wasm heap on a phone): the live preview
 * uses the small selfie model in VIDEO mode; the photo itself uses the
 * multiclass model (better hair) in IMAGE mode, swapped in with setOptions.
 * Masks come back at the input's size (e.g. 410 × 512 for a 512 px input).
 */
import type { ImageSegmenter, MPMask } from '@mediapipe/tasks-vision';

export const MEDIAPIPE_BASE = '/santa/mediapipe';
export type SegModel = 'quality' | 'fast';
const MODEL_FILE: Record<SegModel, string> = {
  quality: 'selfie_multiclass_256x256.tflite',
  fast: 'selfie_segmenter.tflite',
};
type Mode = 'IMAGE' | 'VIDEO';

export type SegResult = { conf: Float32Array; w: number; h: number; model: SegModel; ms: number };

declare global {
  interface Window {
    __ziggyNoMpLog?: boolean;
  }
}

/** Answers MediaPipe's usage-log requests locally (see the file comment). Idempotent. */
export function blockMediapipeLogging() {
  if (typeof window === 'undefined' || window.__ziggyNoMpLog) return;
  window.__ziggyNoMpLog = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const host = new URL(url, window.location.href).hostname;
      if (host === 'googleapis.com' || host.endsWith('.googleapis.com')) return Promise.resolve(new Response(null, { status: 204 }));
    } catch {
      /* not a URL we can read: let the browser decide */
    }
    return orig(input, init);
  };
}

let instance: Promise<ImageSegmenter> | null = null;
let current: { model: SegModel; mode: Mode } | null = null;
let chain: Promise<unknown> = Promise.resolve();

/** Runs jobs one at a time (setOptions and segment calls must not interleave). */
function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = chain.then(job, job);
  chain = next.catch(() => undefined);
  return next;
}

async function create(model: SegModel, mode: Mode): Promise<ImageSegmenter> {
  blockMediapipeLogging();
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_BASE}/wasm`);
  // CPU (wasm SIMD), not GPU: the 3D Santa already uses the GPU, a second WebGL context
  // competes with it (and risks a lost context on phones), and on the CPU the small model
  // runs in ≈ 20–30 ms and the multiclass one in ≈ 0.6 s (measured headless, 4 cores),
  // against 1.5–5 s on a software GPU.
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${MEDIAPIPE_BASE}/${MODEL_FILE[model]}`, delegate: 'CPU' },
    runningMode: mode,
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
}

async function ensure(model: SegModel, mode: Mode): Promise<ImageSegmenter> {
  if (!instance) {
    instance = create(model, mode);
    instance.catch(() => {
      instance = null;
      current = null;
    });
    const seg = await instance;
    current = { model, mode };
    return seg;
  }
  const seg = await instance;
  if (!current || current.model !== model || current.mode !== mode) {
    await seg.setOptions({ baseOptions: { modelAssetPath: `${MEDIAPIPE_BASE}/${MODEL_FILE[model]}` }, runningMode: mode });
    current = { model, mode };
  }
  return seg;
}

/** Starts downloading / compiling the runtime early (e.g. while the parent reads the camera note). */
export function warmSegmenter(model: SegModel = 'fast', mode: Mode = 'VIDEO'): Promise<void> {
  return serial(() => ensure(model, mode)).then(
    () => undefined,
    () => undefined,
  );
}

/** "Person" confidence from MediaPipe's masks: the selfie model gives it directly, the multiclass one gives 1 − background. */
function personConfidence(masks: MPMask[] | undefined): { conf: Float32Array; w: number; h: number } | null {
  if (!masks || !masks.length) return null;
  const m0 = masks[0];
  const raw = m0.getAsFloat32Array();
  const conf = new Float32Array(raw.length);
  if (masks.length === 1) conf.set(raw);
  else for (let i = 0; i < raw.length; i++) conf[i] = 1 - raw[i];
  return { conf, w: m0.width, h: m0.height };
}

/** Segments a still picture (the photo). Tries the multiclass model, falls back to the small one. */
export function segmentStill(image: HTMLCanvasElement, model: SegModel = 'quality'): Promise<SegResult> {
  return serial(async () => {
    const run = async (m: SegModel): Promise<SegResult> => {
      const seg = await ensure(m, 'IMAGE');
      const t0 = performance.now();
      let out: { conf: Float32Array; w: number; h: number } | null = null;
      seg.segment(image, (r) => {
        out = personConfidence(r.confidenceMasks);
      });
      if (!out) throw new Error('no mask');
      const o = out as { conf: Float32Array; w: number; h: number };
      return { ...o, model: m, ms: performance.now() - t0 };
    };
    try {
      return await run(model);
    } catch (e) {
      if (model === 'fast') throw e;
      return run('fast');
    }
  });
}

/** Segments the current camera frame (live preview). Resolves null when the segmenter is busy or not ready. */
let videoBusy = false;
export function segmentFrame(source: HTMLCanvasElement | HTMLVideoElement, timestamp: number): Promise<SegResult | null> {
  if (videoBusy) return Promise.resolve(null);
  videoBusy = true;
  return serial(async () => {
    const seg = await ensure('fast', 'VIDEO');
    const t0 = performance.now();
    let out: { conf: Float32Array; w: number; h: number } | null = null;
    seg.segmentForVideo(source, timestamp, (r) => {
      out = personConfidence(r.confidenceMasks);
    });
    const o = out as { conf: Float32Array; w: number; h: number } | null;
    return o ? { ...o, model: 'fast' as const, ms: performance.now() - t0 } : null;
  }).finally(() => {
    videoBusy = false;
  });
}
