/**
 * Les Lutins Farceurs — shared types of the 3D elves (no three.js here, so
 * the UI can import them without pulling the 3D in).
 */

export const ELF_IDS = ['pepin', 'grelotte', 'noisette'] as const;
export type ElfId = (typeof ELF_IDS)[number];

export const ELF_POSES = ['stand', 'sit', 'wave', 'laugh', 'peek', 'tiptoe', 'point'] as const;
export type ElfPose = (typeof ELF_POSES)[number];

export type LutinsSceneMode = 'hero' | 'sheet' | 'stage';

/** Orbit camera of the `stage` mode (the offline "AR" overlay on a photo). */
export interface StageCamera {
  /** Degrees around the elves, 0 = in front, positive = camera moves to the elves' left (picture right). */
  azimuth?: number;
  /** Degrees above the floor (0 = at the elves' eye level, 90 = straight down). */
  elevation?: number;
  /** 1 = the whole group fits the frame; 2 = twice as big. */
  zoom?: number;
}

/**
 * What a `sheet` render shows (the reference images for the image AI, see
 * docs/lutins-research.md recommendations 1–2):
 * - `lineup`: the three elves side by side, front view, full body, pure white,
 *   no floor shadow, fixed order Pépin, Grelotte, Noisette, one scale;
 * - `lineup34`: the same line-up in 3/4 view;
 * - `turnaround`: one elf, front + 3/4 + back;
 * - `avatar`: one elf, a cheerful bust portrait (use with `transparent`).
 */
export type SheetLayout = { kind: 'lineup' } | { kind: 'lineup34' } | { kind: 'turnaround'; elf: ElfId } | { kind: 'avatar'; elf: ElfId };

export interface LutinsSceneOptions {
  mode: LutinsSceneMode;
  /** Which elves to show (stage, and the order left to right). Default: all three. */
  elves?: ElfId[];
  /** Calmer motion (no camera drift, softer gestures). */
  reducedMotion?: boolean;
  /** Force the light path (simpler materials, smaller shadow maps); default: detected. */
  lowPower?: boolean;
  /** Transparent background (alpha 0) and a readable drawing buffer, for compositing. */
  transparent?: boolean;
  /** Stage camera (stage mode). */
  camera?: StageCamera;
  /** Initial poses. */
  poses?: Partial<Record<ElfId, ElfPose>>;
  /** Sheet mode: what to render (default lineup). */
  sheet?: SheetLayout;
  /** Override the device pixel ratio (reference renders). */
  pixelRatio?: number;
}

export interface LutinsSceneHandle {
  canvas: HTMLCanvasElement;
  setPose(id: ElfId, pose: ElfPose): void;
  /** Stage mode: move the orbit camera. */
  setCamera(cam: StageCamera): void;
  resize(): void;
  dispose(): void;
  /** Sheet mode: draw one frame now (the drawing buffer is kept for reading back). */
  renderSheetFrame?(): void;
}
