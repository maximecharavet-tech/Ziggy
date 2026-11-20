/**
 * Where Ziggy's eyes and antennas sit in each official picture, measured on
 * the artwork itself (pixels of the original files in public/mascot/). The
 * living mascot uses it to blink (felt eyelids over the eyes) and to bobble
 * his antennas (each antenna is the same picture, clipped to the antenna and
 * rotated about its base, while the base picture hides that spot). No new
 * image files: everything is the existing art plus a little CSS.
 */
import type { CutoutPose } from '@/lib/mascot';

type Pt = readonly [number, number];

export interface EyeSpot {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Felt colour just above the eye (the lid's top) and beside it (the lid's edge). */
  top: string;
  side: string;
}

export interface AntennaRig {
  /** Hidden on the base picture. */
  hole: readonly Pt[];
  /** Shown on the moving copy: the hole plus a few pixels into the head, so no seam shows. */
  clip: readonly Pt[];
  /** Where the stalk meets the head (rotation centre). */
  pivot: Pt;
}

export interface MascotRig {
  w: number;
  h: number;
  eyes: readonly [EyeSpot, EyeSpot];
  antennas: readonly AntennaRig[];
  /** Where sleepy "z"s rise from (top of the head, to the side). */
  zzz: Pt;
}

export const CUTOUT_RIGS: Record<CutoutPose, MascotRig> = {
  wave: {
    w: 717,
    h: 964,
    eyes: [
      { cx: 225, cy: 356, rx: 60, ry: 56, top: '#699c59', side: '#79a860' },
      { cx: 385, cy: 286, rx: 50, ry: 53, top: '#b3e3ac', side: '#9ed292' },
    ],
    antennas: [
      {
        hole: [[6, 96], [72, 96], [78, 138], [137, 183], [115, 204], [62, 160], [8, 156]],
        clip: [[4, 94], [74, 94], [80, 137], [142, 187], [120, 208], [61, 162], [6, 158]],
        pivot: [126, 194],
      },
      {
        hole: [[250, 6], [322, 6], [322, 74], [298, 74], [298, 163], [262, 163], [262, 74], [250, 74]],
        clip: [[248, 4], [324, 4], [324, 76], [300, 76], [300, 168], [260, 168], [260, 76], [248, 76]],
        pivot: [280, 163],
      },
    ],
    zzz: [470, 150],
  },
  stand: {
    w: 556,
    h: 962,
    eyes: [
      { cx: 256, cy: 349, rx: 60, ry: 60, top: '#7aad6a', side: '#7aab69' },
      { cx: 427, cy: 322, rx: 44, ry: 55, top: '#c4eebe', side: '#b6e4ab' },
    ],
    antennas: [
      {
        hole: [[52, 62], [120, 62], [124, 112], [172, 150], [164, 166], [150, 168], [104, 130], [52, 128]],
        clip: [[50, 60], [122, 60], [126, 111], [176, 153], [168, 171], [152, 173], [103, 132], [50, 130]],
        pivot: [160, 160],
      },
      {
        hole: [[284, 6], [350, 6], [350, 80], [328, 80], [328, 153], [294, 153], [294, 80], [284, 80]],
        clip: [[282, 4], [352, 4], [352, 82], [330, 82], [330, 158], [292, 158], [292, 82], [282, 82]],
        pivot: [316, 153],
      },
    ],
    zzz: [420, 150],
  },
  heart: {
    w: 778,
    h: 1128,
    eyes: [
      { cx: 239, cy: 451, rx: 83, ry: 90, top: '#486f3b', side: '#496f38' },
      { cx: 530, cy: 449, rx: 82, ry: 92, top: '#82b679', side: '#80b36f' },
    ],
    antennas: [
      {
        hole: [[112, 8], [226, 8], [232, 92], [282, 160], [270, 186], [240, 186], [196, 120], [112, 116]],
        clip: [[110, 6], [228, 6], [234, 91], [286, 163], [274, 191], [238, 191], [195, 122], [110, 118]],
        pivot: [256, 178],
      },
      {
        hole: [[498, 170], [548, 92], [552, 36], [626, 36], [626, 114], [570, 112], [530, 186], [500, 188]],
        clip: [[495, 173], [546, 91], [550, 34], [628, 34], [628, 116], [572, 114], [533, 191], [497, 192]],
        pivot: [514, 182],
      },
    ],
    zzz: [610, 190],
  },
};

/** The round face portrait (512 × 512): eyes only (the antennas are cut by the frame). */
export const FACE_RIG = {
  w: 512,
  h: 512,
  eyes: [
    { cx: 145, cy: 292, rx: 66, ry: 69, top: '#5e8244', side: '#5b8043' },
    { cx: 366, cy: 290, rx: 65, ry: 71, top: '#90c17e', side: '#93c27c' },
  ] as const satisfies readonly [EyeSpot, EyeSpot],
};

const pct = (v: number, of: number) => `${Math.round((v / of) * 10000) / 100}%`;

/** CSS `clip-path: polygon(…)` in percentages of the picture. */
export function polygonCss(points: readonly Pt[], w: number, h: number): string {
  return `polygon(${points.map(([x, y]) => `${pct(x, w)} ${pct(y, h)}`).join(', ')})`;
}

/** CSS `transform-origin` for a point of the picture. */
export function originCss([x, y]: Pt, w: number, h: number): string {
  return `${pct(x, w)} ${pct(y, h)}`;
}

/**
 * An alpha mask (data URL) that is opaque everywhere except the given holes.
 * Stretched to the picture (preserveAspectRatio none), so it follows any size.
 */
export function holesMask(holes: readonly (readonly Pt[])[], w: number, h: number): string {
  const d = [`M0 0H${w}V${h}H0Z`, ...holes.map((pts) => `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`)].join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'><path fill-rule='evenodd' d='${d}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Position of an eyelid (a little larger than the eye, to cover its outline), in percentages. */
export function lidBox(eye: EyeSpot, w: number, h: number, grow = 1.08) {
  const rx = eye.rx * grow;
  const ry = eye.ry * grow;
  return { left: pct(eye.cx - rx, w), top: pct(eye.cy - ry, h), width: pct(rx * 2, w), height: pct(ry * 2, h) };
}
