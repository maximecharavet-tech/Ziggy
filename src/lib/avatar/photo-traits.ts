/**
 * Avatar from a photo, worked out ON THE DEVICE: from the pixels of the photo,
 * MediaPipe's hair / face-skin / accessory masks and its face landmarks, pick
 * the drawing choices of a VisualBlueprint. Pure functions only (no DOM, no
 * network): the browser glue is photo-analyze.ts, and the tests feed synthetic
 * pictures.
 *
 * What it can tell, and what it leaves to the parent:
 * - hair colour, hair length, "covered" (headscarf), skin tone, eye colour and
 *   glasses are estimated, each only when the photo gives enough evidence;
 * - hairstyle texture (straight, wavy, curly…) and freckles are never guessed:
 *   the parent or the child picks them, as in the "no photo" mode.
 * Everything is an estimate for a cartoon: every choice stays editable.
 */
import type { VisualBlueprint } from '@/lib/hyper-engine/schemas';

export type Rgb = readonly [number, number, number];
export type Lab = readonly [number, number, number];
type Point = { x: number; y: number };

/* ── Colour maths ── */

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 24389) / 27 / 116 + 16 / 116);

/** sRGB (0–255) to CIE L*a*b* (D65). */
export function rgbToLab([r, g, b]: Rgb): Lab {
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export const hexToRgb = (hex: string): Rgb => {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const luma = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const dist = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const median = (xs: number[]) => {
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * One representative colour for a set of pixels: drop the darkest and
 * brightest shares (shadows, lashes, highlights), then the per-channel median.
 */
export function robustColour(px: readonly Rgb[], dropDark = 0.15, dropBright = 0.1): Rgb | null {
  if (!px.length) return null;
  const sorted = [...px].sort((a, b) => luma(a) - luma(b));
  const kept = sorted.slice(Math.floor(sorted.length * dropDark), Math.max(Math.floor(sorted.length * dropDark) + 1, Math.ceil(sorted.length * (1 - dropBright))));
  return [median(kept.map((p) => p[0])), median(kept.map((p) => p[1])), median(kept.map((p) => p[2]))];
}

/** The closest prototype in Lab, with how much closer it is than the runner-up. */
export function nearest<K extends string>(colour: Rgb, prototypes: Record<K, Rgb>): { id: K; distance: number; margin: number } {
  const lab = rgbToLab(colour);
  const ranked = (Object.keys(prototypes) as K[]).map((id) => ({ id, d: dist(lab, rgbToLab(prototypes[id])) })).sort((a, b) => a.d - b.d);
  return { id: ranked[0].id, distance: ranked[0].d, margin: (ranked[1]?.d ?? Infinity) - ranked[0].d };
}

/* ── Classifiers ── */

/** Hair as it looks in ordinary photos (darker and less saturated than the cartoon swatches). */
export const HAIR_PROTOTYPES: Record<VisualBlueprint['hairColor'], Rgb> = {
  black: hexToRgb('#1a1614'),
  dark_brown: hexToRgb('#3a2a20'),
  brown: hexToRgb('#6b4c36'),
  auburn: hexToRgb('#6e3020'),
  red: hexToRgb('#a8522c'),
  blond: hexToRgb('#a88a5c'),
  light_blond: hexToRgb('#d8c49a'),
  grey: hexToRgb('#a19e9b'),
  blue: hexToRgb('#3c5ca8'),
  pink: hexToRgb('#d47ca0'),
};

/** Irises in photos (small, shaded by the lids: darker than the swatches). */
export const EYE_PROTOTYPES: Record<VisualBlueprint['eyeColor'], Rgb> = {
  dark_brown: hexToRgb('#2b1d16'),
  brown: hexToRgb('#5c3b25'),
  hazel: hexToRgb('#7a6a3c'),
  green: hexToRgb('#5d7650'),
  blue: hexToRgb('#5a7ea8'),
  grey: hexToRgb('#7d878d'),
};

export function hairColourOf(colour: Rgb): VisualBlueprint['hairColor'] {
  const [L, a, b] = rgbToLab(colour);
  // Grey/white hair: bright and colourless (the nearest prototype could be light blond).
  if (Math.hypot(a, b) < 7 && L > 52) return 'grey';
  return nearest(colour, HAIR_PROTOTYPES).id;
}

export function eyeColourOf(colour: Rgb): VisualBlueprint['eyeColor'] {
  return nearest(colour, EYE_PROTOTYPES).id;
}

/**
 * Individual Typology Angle (Chardon et al., 1991), the usual colorimetric
 * skin-tone scale: ITA = atan((L* − 50) / b*) in degrees.
 */
export function ita(colour: Rgb): number {
  const [L, , b] = rgbToLab(colour);
  return (Math.atan2(L - 50, Math.max(b, 0.001)) * 180) / Math.PI;
}

/** ITA bands (very light > 55° > light > 41° > intermediate > 28° > tan > 10° > brown > −30° > dark) onto our six tones. */
export function skinToneOf(colour: Rgb): VisualBlueprint['skinTone'] {
  const a = ita(colour);
  if (a > 55) return 'tone1';
  if (a > 41) return 'tone2';
  if (a > 28) return 'tone3';
  if (a > 10) return 'tone4';
  if (a > -30) return 'tone5';
  return 'tone6';
}

/* ── From a whole frame ── */

/** What the device hands over: the downscaled photo, MediaPipe's masks and landmarks. */
export type PhotoFrame = {
  width: number;
  height: number;
  /** RGBA, width × height × 4. */
  rgba: ArrayLike<number>;
  /** Per-pixel confidences 0..1 (selfie_multiclass_256x256: hair, face skin, clothes, others/accessories). */
  hair: ArrayLike<number>;
  faceSkin: ArrayLike<number>;
  clothes: ArrayLike<number>;
  others: ArrayLike<number>;
  /** Face Landmarker points, normalised 0..1 (478 with the irises), or null when no face was found. */
  landmarks: readonly Point[] | null;
};

export type PhotoTraits = {
  face: boolean;
  /** Only the choices the photo really supports. */
  blueprint: Partial<VisualBlueprint>;
  /** Choices left to the parent or the child (not visible enough, or never guessed). */
  toPick: (keyof VisualBlueprint)[];
};

/** Face mesh indices (MediaPipe canonical face model). */
export const LM = {
  top: 10,
  chin: 152,
  faceRight: 234, // the subject's right = image left
  faceLeft: 454,
  rEyeOuter: 33,
  rEyeInner: 133,
  rEyeTop: 159,
  rEyeBottom: 145,
  lEyeOuter: 263,
  lEyeInner: 362,
  lEyeTop: 386,
  lEyeBottom: 374,
  rCheek: 50,
  lCheek: 280,
  rIris: 468,
  lIris: 473,
} as const;

const MIN = { hair: 0.03, skin: 40, iris: 12 } as const;
const NEVER_GUESSED: (keyof VisualBlueprint)[] = ['freckles'];

export function traitsFromFrame(frame: PhotoFrame): PhotoTraits {
  const { width: W, height: H, rgba, landmarks } = frame;
  if (!landmarks || landmarks.length < 468) return { face: false, blueprint: {}, toPick: ['hairColor', 'hairLength', 'hairStyle', 'skinTone', 'eyeColor', 'glasses', 'freckles'] };

  const P = (i: number) => ({ x: landmarks[i].x * W, y: landmarks[i].y * H });
  const top = P(LM.top).y;
  const chin = P(LM.chin).y;
  const left = Math.min(P(LM.faceRight).x, P(LM.faceLeft).x);
  const right = Math.max(P(LM.faceRight).x, P(LM.faceLeft).x);
  const faceW = Math.max(1, right - left);
  const faceH = Math.max(1, chin - top);
  const eyeY = (P(LM.rEyeTop).y + P(LM.lEyeTop).y + P(LM.rEyeBottom).y + P(LM.lEyeBottom).y) / 4;
  const rgb = (i: number): Rgb => [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]];
  const clampX = (x: number) => Math.max(0, Math.min(W - 1, Math.round(x)));
  const clampY = (y: number) => Math.max(0, Math.min(H - 1, Math.round(y)));

  /** Visits every pixel of a box (inclusive, clamped to the frame). */
  const box = (x0: number, y0: number, x1: number, y1: number, fn: (i: number, x: number, y: number) => void) => {
    for (let y = clampY(y0); y <= clampY(y1); y++) for (let x = clampX(x0); x <= clampX(x1); x++) fn(y * W + x, x, y);
  };

  const blueprint: Partial<VisualBlueprint> = {};
  const toPick = new Set<keyof VisualBlueprint>(['hairStyle', ...NEVER_GUESSED]);

  /* Skin: both cheeks, inside the face-skin mask (the forehead catches the lights). */
  const skin: Rgb[] = [];
  const disc = (c: Point, r: number) =>
    box(c.x - r, c.y - r, c.x + r, c.y + r, (i, x, y) => {
      if ((x - c.x) ** 2 + (y - c.y) ** 2 <= r * r && frame.faceSkin[i] > 0.5) skin.push(rgb(i));
    });
  disc(P(LM.rCheek), faceW * 0.12);
  disc(P(LM.lCheek), faceW * 0.12);
  if (skin.length < MIN.skin) box(left, top, right, chin, (i) => frame.faceSkin[i] > 0.5 && skin.push(rgb(i)));
  // Studio lights and flashes make bright patches on skin: drop many more bright pixels than dark ones.
  const skinColour = skin.length >= MIN.skin ? robustColour(skin, 0.15, 0.4) : null;
  if (skinColour) blueprint.skinTone = skinToneOf(skinColour);
  else toPick.add('skinTone');

  /* Hair: colour, length, or covered. */
  const hairPx: Rgb[] = [];
  let lowest = -1;
  const rowCount = new Map<number, number>();
  box(left - faceW * 0.7, 0, right + faceW * 0.7, H - 1, (i, _x, y) => {
    if (frame.hair[i] <= 0.5) return;
    hairPx.push(rgb(i));
    rowCount.set(y, (rowCount.get(y) ?? 0) + 1);
  });
  // The lowest row with a real strand of hair (≥ 2 % of the face width), not a stray pixel.
  for (const [y, n] of rowCount) if (n >= Math.max(2, faceW * 0.02) && y > lowest) lowest = y;
  const hairShare = hairPx.length / (faceW * faceH);

  let covered = 0;
  let band = 0;
  box(left, top - faceH * 0.45, right, top - faceH * 0.05, (i) => {
    band++;
    if (frame.clothes[i] + frame.others[i] > 0.5) covered++;
  });

  if (hairShare < MIN.hair) {
    if (band > 0 && covered / band > 0.35) {
      blueprint.hairStyle = 'covered';
      toPick.delete('hairStyle');
    } else {
      blueprint.hairLength = 'very_short';
      toPick.add('hairColor');
    }
  } else {
    const hairColour = robustColour(hairPx, 0.1, 0.1);
    if (hairColour) blueprint.hairColor = hairColourOf(hairColour);
    blueprint.hairLength = hairLengthOf({ lowest, height: H, top, chin, eyeY, hairShare });
  }

  /* Eyes: iris pixels, inside the open lids, without the pupil and the highlight. */
  if (landmarks.length >= 478) {
    const iris: Rgb[] = [];
    const eye = (center: number, ring: number[], lidTop: number, lidBottom: number) => {
      const c = P(center);
      const r = ring.reduce((s, k) => s + Math.hypot(P(k).x - c.x, P(k).y - c.y), 0) / ring.length;
      const y0 = Math.max(c.y - r, P(lidTop).y);
      const y1 = Math.min(c.y + r, P(lidBottom).y);
      box(c.x - r, y0, c.x + r, y1, (i, x, y) => {
        const d = Math.hypot(x - c.x, y - c.y);
        // (No face-skin test: the segmenter counts the eyes as face skin.)
        if (d <= r * 0.95 && d >= r * 0.35) iris.push(rgb(i));
      });
    };
    eye(LM.rIris, [469, 470, 471, 472], LM.rEyeTop, LM.rEyeBottom);
    eye(LM.lIris, [474, 475, 476, 477], LM.lEyeTop, LM.lEyeBottom);
    const irisColour = iris.length >= MIN.iris ? robustColour(iris, 0.2, 0.15) : null;
    if (irisColour) blueprint.eyeColor = eyeColourOf(irisColour);
    else toPick.add('eyeColor');
  } else toPick.add('eyeColor');

  /* Glasses: accessory pixels across the eye band. */
  const eyes = [P(LM.rEyeOuter), P(LM.lEyeOuter), P(LM.rEyeInner), P(LM.lEyeInner)];
  const bx0 = Math.min(...eyes.map((p) => p.x)) - faceW * 0.12;
  const bx1 = Math.max(...eyes.map((p) => p.x)) + faceW * 0.12;
  const by0 = Math.min(P(LM.rEyeTop).y, P(LM.lEyeTop).y) - faceH * 0.1;
  const by1 = Math.max(P(LM.rEyeBottom).y, P(LM.lEyeBottom).y) + faceH * 0.08;
  let acc = 0;
  let n = 0;
  box(bx0, by0, bx1, by1, (i) => {
    n++;
    acc += frame.others[i];
  });
  const glasses = glassesOf(n ? acc / n : 0);
  if (glasses === null) toPick.add('glasses');
  else blueprint.glasses = glasses;

  return { face: true, blueprint, toPick: [...toPick] };
}

/**
 * Hair length from the lowest hair row, relative to the face: above the eyes
 * = very short, down to the chin = short, a little below = medium, then long
 * (or hair that runs off the bottom of the photo).
 */
export function hairLengthOf(g: { lowest: number; height: number; top: number; chin: number; eyeY: number; hairShare: number }): VisualBlueprint['hairLength'] {
  const faceH = Math.max(1, g.chin - g.top);
  if (g.lowest >= g.height - 2) return 'long';
  if (g.hairShare < 0.25 || g.lowest < g.eyeY) return 'very_short';
  const below = (g.lowest - g.chin) / faceH;
  if (below > 0.7) return 'long';
  if (below > 0.05) return 'medium';
  return 'short';
}

/** Mean accessory confidence over the eye band → glasses, no glasses, or "can't tell" (null). */
export function glassesOf(score: number): boolean | null {
  if (score >= 0.08) return true;
  if (score <= 0.02) return false;
  return null;
}
