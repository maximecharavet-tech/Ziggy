'use client';

/**
 * Avatar from a photo, entirely on the device: the photo is read by MediaPipe
 * Tasks Vision (Apache-2.0) running in this browser, never uploaded.
 *
 * - Face Landmarker (face_landmarker.task, Apache-2.0, self-hosted under
 *   /avatar/mediapipe): where the face, the eyes and the irises are.
 * - Image Segmenter with selfie_multiclass_256x256 (already self-hosted for the
 *   Santa photo booth): which pixels are hair, face skin, clothes, accessories.
 * The pixels and these masks go to traitsFromFrame (photo-traits.ts, pure and
 * tested), which returns only drawing choices. The wasm runtime is the booth's
 * (/santa/mediapipe/wasm); MediaPipe's usage logger is answered locally
 * (blockMediapipeLogging), so nothing at all is sent while a photo is read.
 */
import type { FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision';
import { blockMediapipeLogging, MEDIAPIPE_BASE } from '@/components/santa/booth/segmenter';
import { traitsFromFrame, type PhotoTraits } from './photo-traits';

const FACE_MODEL = '/avatar/mediapipe/face_landmarker.task';
const SEG_MODEL = `${MEDIAPIPE_BASE}/selfie_multiclass_256x256.tflite`;
/** Big enough for the irises of a portrait, small enough for a phone. */
const MAX_SIDE = 640;
/** selfie_multiclass_256x256 categories. */
const CAT = { hair: 1, faceSkin: 3, clothes: 4, others: 5 } as const;

type Tasks = { face: FaceLandmarker; seg: ImageSegmenter };
let tasks: Promise<Tasks> | null = null;

function load(): Promise<Tasks> {
  tasks ??= (async () => {
    blockMediapipeLogging();
    const { FilesetResolver, FaceLandmarker, ImageSegmenter } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_BASE}/wasm`);
    const [face, seg] = await Promise.all([
      FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 1 }),
      ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: SEG_MODEL, delegate: 'CPU' }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false }),
    ]);
    return { face, seg };
  })();
  tasks.catch(() => {
    tasks = null;
  });
  return tasks;
}

/** Starts downloading the models early (when the parent opens the photo panel). */
export function warmPhotoAnalysis() {
  void load().catch(() => {});
}

/**
 * Reads a photo on the device and returns the drawing choices it supports.
 * The decoded pixels are wiped before returning. Throws if MediaPipe can't run.
 */
export async function analyzePhotoOnDevice(file: Blob): Promise<PhotoTraits> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  try {
    const { face, seg } = await load();
    const landmarks = face.detect(canvas).faceLandmarks[0] ?? null;
    if (!landmarks) return traitsFromFrame({ width: canvas.width, height: canvas.height, rgba: image.data, hair: [], faceSkin: [], clothes: [], others: [], landmarks: null });

    let masks: Float32Array[] | null = null;
    seg.segment(canvas, (r) => {
      // Masks are freed after the callback: copy the four we need.
      const m = r.confidenceMasks;
      if (m && m.length > CAT.others) masks = [CAT.hair, CAT.faceSkin, CAT.clothes, CAT.others].map((k) => new Float32Array(m[k].getAsFloat32Array()));
    });
    const got = masks as Float32Array[] | null;
    if (!got || got[0].length !== canvas.width * canvas.height) throw new Error('segmentation failed');
    const [hair, faceSkin, clothes, others] = got;
    return traitsFromFrame({ width: canvas.width, height: canvas.height, rgba: image.data, hair, faceSkin, clothes, others, landmarks });
  } finally {
    image.data.fill(0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
  }
}
