'use client';

/**
 * "No people in the photo": on-device person detection before a parent's room
 * photo is sent to the image AI, so no child's picture ever leaves the device.
 *
 * MediaPipe Object Detector (Apache-2.0) with EfficientDet-Lite0 (int8, COCO,
 * Apache-2.0), self-hosted: the wasm runtime is the one the Santa booth already
 * serves (/santa/mediapipe/wasm), the model is public/lutins/mediapipe. MediaPipe's
 * usage logger is answered locally (see src/components/santa/booth/segmenter.ts).
 */
import type { ObjectDetector } from '@mediapipe/tasks-vision';
import { blockMediapipeLogging, MEDIAPIPE_BASE } from '@/components/santa/booth/segmenter';

const MODEL = '/lutins/mediapipe/efficientdet_lite0.tflite';
/** A person is "there" from this score; low on purpose (we'd rather ask again than send a child). */
export const PERSON_SCORE = 0.32;

let detector: Promise<ObjectDetector> | null = null;

function load(): Promise<ObjectDetector> {
  detector ??= (async () => {
    blockMediapipeLogging();
    const { FilesetResolver, ObjectDetector } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_BASE}/wasm`);
    return ObjectDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
      runningMode: 'IMAGE',
      scoreThreshold: 0.2,
      maxResults: 20,
      categoryAllowlist: ['person'],
    });
  })();
  detector.catch(() => {
    detector = null;
  });
  return detector;
}

/** Starts loading the detector early (e.g. when the studio opens). */
export function warmPeopleDetector() {
  void load().catch(() => {});
}

export type PeopleCheck = { people: number; best: number; boxes: { x: number; y: number; w: number; h: number; score: number }[] };

/** Pure decision: which detections count as a person (testable). */
export function countPeople(detections: { score: number; box: { x: number; y: number; w: number; h: number } }[], imageArea: number): PeopleCheck {
  const boxes = detections
    // Ignore specks smaller than 0.15 % of the photo (posters, tiny reflections).
    .filter((d) => d.score >= PERSON_SCORE && (d.box.w * d.box.h) / imageArea >= 0.0015)
    .map((d) => ({ ...d.box, score: d.score }));
  return { people: boxes.length, best: Math.max(0, ...detections.map((d) => d.score)), boxes };
}

/**
 * Looks for people in the photo (a canvas at upload size). Throws if the
 * detector can't run: the caller then refuses to upload (safe default).
 */
export async function findPeople(canvas: HTMLCanvasElement): Promise<PeopleCheck> {
  const d = await load();
  const result = d.detect(canvas);
  const detections = result.detections.map((det) => ({
    score: Math.max(0, ...det.categories.filter((c) => c.categoryName === 'person').map((c) => c.score)),
    box: { x: det.boundingBox?.originX ?? 0, y: det.boundingBox?.originY ?? 0, w: det.boundingBox?.width ?? 0, h: det.boundingBox?.height ?? 0 },
  }));
  return countPeople(detections, canvas.width * canvas.height);
}
