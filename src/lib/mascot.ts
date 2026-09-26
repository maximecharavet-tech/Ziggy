/**
 * The official Ziggy artwork: the plush robot on the clay ZIGGY emblem.
 * Everything that shows the mascot reads from here, so the whole site stays
 * on the same pictures.
 */

export type ScenePose = 'cheer' | 'wave' | 'heart' | 'stand' | 'closeup';
export type CutoutPose = 'wave' | 'stand' | 'heart';

/** Where the glowing heart sits, as a fraction of the picture. */
export interface HeartSpot {
  x: number;
  y: number;
  /** Glow diameter, as a fraction of the picture width. */
  size: number;
}

export interface MascotPicture {
  src: string;
  width: number;
  height: number;
  heart: HeartSpot;
}

/** Full scenes, emblem included: 784 × 1168. */
export const SCENES: Record<ScenePose, MascotPicture> = {
  cheer: { src: '/mascot/scene-cheer.webp', width: 784, height: 1168, heart: { x: 0.49, y: 0.635, size: 0.24 } },
  wave: { src: '/mascot/scene-wave.webp', width: 784, height: 1168, heart: { x: 0.482, y: 0.63, size: 0.24 } },
  heart: { src: '/mascot/scene-heart.webp', width: 784, height: 1168, heart: { x: 0.5, y: 0.755, size: 0.3 } },
  stand: { src: '/mascot/scene-stand.webp', width: 784, height: 1168, heart: { x: 0.51, y: 0.64, size: 0.24 } },
  closeup: { src: '/mascot/scene-closeup.webp', width: 784, height: 1168, heart: { x: 0.5, y: 0.845, size: 0.36 } },
};

export const SCENE_ORDER: ScenePose[] = ['cheer', 'wave', 'heart', 'closeup', 'stand'];

/** Ziggy on his own, background removed. */
export const CUTOUTS: Record<CutoutPose, MascotPicture> = {
  wave: { src: '/mascot/ziggy-wave.webp', width: 717, height: 964, heart: { x: 0.506, y: 0.602, size: 0.26 } },
  stand: { src: '/mascot/ziggy-stand.webp', width: 556, height: 962, heart: { x: 0.577, y: 0.613, size: 0.3 } },
  heart: { src: '/mascot/ziggy-heart.webp', width: 778, height: 1128, heart: { x: 0.501, y: 0.745, size: 0.3 } },
};

/** Round portrait of Ziggy's face, 512 × 512. */
export const FACE = '/mascot/ziggy-face.webp';

/** Short muted loops, 640 × 954, about 1.5 MB each (H.264, with a VP9 fallback). */
export const FILMS = {
  loop: { src: '/media/ziggy-loop.mp4', webm: '/media/ziggy-loop.webm', poster: '/mascot/loop-poster.webp' },
  film: { src: '/media/ziggy-film.mp4', webm: '/media/ziggy-film.webm', poster: '/mascot/film-poster.webp' },
} as const;

export const FILM_ASPECT = '640 / 954';
