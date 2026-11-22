import { describe, expect, it } from 'vitest';
import { EYE_PROTOTYPES, HAIR_PROTOTYPES, LM, eyeColourOf, glassesOf, hairColourOf, hairLengthOf, hexToRgb, ita, nearest, rgbToLab, robustColour, skinToneOf, traitsFromFrame, type PhotoFrame, type Rgb } from './photo-traits';

/* ── A synthetic portrait: a face box, two irises, hair, on a plain background ── */

const W = 200;
const H = 260;
const FACE = { top: 60, chin: 180, left: 50, right: 150 };
const EYES = { r: { x: 80, y: 105 }, l: { x: 120, y: 105 }, lidTop: 100, lidBottom: 110, iris: 5 };

type Paint = {
  skin?: Rgb;
  iris?: Rgb;
  hair?: Rgb | null;
  /** Lowest row of hair (hair runs down the sides of the face to here). */
  hairTo?: number;
  scarf?: boolean;
  glasses?: boolean;
  noLandmarks?: boolean;
  irisLandmarks?: boolean;
};

function landmarks(withIris = true) {
  const pts = Array.from({ length: withIris ? 478 : 468 }, () => ({ x: 100 / W, y: 120 / H }));
  const set = (i: number, x: number, y: number) => (pts[i] = { x: x / W, y: y / H });
  set(LM.top, 100, FACE.top);
  set(LM.chin, 100, FACE.chin);
  set(LM.faceRight, FACE.left, 120);
  set(LM.faceLeft, FACE.right, 120);
  set(LM.rEyeOuter, 68, 105);
  set(LM.rEyeInner, 92, 105);
  set(LM.lEyeOuter, 132, 105);
  set(LM.lEyeInner, 108, 105);
  set(LM.rEyeTop, 80, EYES.lidTop);
  set(LM.rEyeBottom, 80, EYES.lidBottom);
  set(LM.lEyeTop, 120, EYES.lidTop);
  set(LM.lEyeBottom, 120, EYES.lidBottom);
  set(LM.rCheek, 75, 140);
  set(LM.lCheek, 125, 140);
  if (withIris) {
    for (const [c, e] of [[LM.rIris, EYES.r], [LM.lIris, EYES.l]] as const) {
      set(c, e.x, e.y);
      set(c + 1, e.x + EYES.iris, e.y);
      set(c + 2, e.x, e.y - EYES.iris);
      set(c + 3, e.x - EYES.iris, e.y);
      set(c + 4, e.x, e.y + EYES.iris);
    }
  }
  return pts;
}

function portrait(p: Paint = {}): PhotoFrame {
  const skin = p.skin ?? hexToRgb('#e8b896');
  const iris = p.iris ?? hexToRgb('#5a7ea8');
  const hair = p.hair === undefined ? hexToRgb('#1a1614') : p.hair;
  const hairTo = p.hairTo ?? 150;
  const rgba = new Uint8ClampedArray(W * H * 4);
  const masks = { hair: new Float32Array(W * H), faceSkin: new Float32Array(W * H), clothes: new Float32Array(W * H), others: new Float32Array(W * H) };
  const paint = (x: number, y: number, c: Rgb) => rgba.set([c[0], c[1], c[2], 255], (y * W + x) * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      paint(x, y, [200, 220, 235]); // background
      const inFace = x >= FACE.left && x <= FACE.right && y >= FACE.top && y <= FACE.chin;
      if (inFace) {
        paint(x, y, skin);
        masks.faceSkin[i] = 1;
        for (const e of [EYES.r, EYES.l]) {
          if (Math.hypot(x - e.x, y - e.y) <= EYES.iris && y >= EYES.lidTop && y <= EYES.lidBottom) {
            paint(x, y, Math.hypot(x - e.x, y - e.y) < 1.5 ? [5, 5, 5] : iris);
            masks.faceSkin[i] = 0;
          }
        }
        if (p.glasses && y >= 98 && y <= 112 && x >= 64 && x <= 136 && (y === 98 || y === 112 || Math.abs(x - 100) < 3 || x === 64 || x === 136)) {
          paint(x, y, [30, 30, 30]);
          masks.others[i] = 1;
        }
      }
      if (hair) {
        const cap = y >= 20 && y < FACE.top && x >= 40 && x <= 160;
        const sides = y >= FACE.top && y <= hairTo && ((x >= 36 && x < FACE.left) || (x > FACE.right && x <= 164));
        if (cap || sides) {
          paint(x, y, hair);
          masks.hair[i] = 1;
        }
      } else if (p.scarf && y >= 15 && y < FACE.top && x >= 40 && x <= 160) {
        paint(x, y, [120, 40, 90]);
        masks.clothes[i] = 1;
      }
    }
  return { width: W, height: H, rgba, ...masks, landmarks: p.noLandmarks ? null : landmarks(p.irisLandmarks !== false) };
}

describe('colour maths', () => {
  it('converts sRGB to Lab like the reference values', () => {
    const [L, a, b] = rgbToLab([255, 255, 255]);
    expect(L).toBeCloseTo(100, 1);
    expect(Math.abs(a)).toBeLessThan(0.5);
    expect(Math.abs(b)).toBeLessThan(0.5);
    expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 5);
    const red = rgbToLab([255, 0, 0]);
    expect(red[0]).toBeCloseTo(53.2, 0);
    expect(red[1]).toBeCloseTo(80.1, 0);
  });

  it('ignores highlights and shadows in a set of pixels', () => {
    const px: Rgb[] = [...Array(80).fill([120, 80, 60]), ...Array(10).fill([255, 255, 255]), ...Array(10).fill([0, 0, 0])];
    expect(robustColour(px)).toEqual([120, 80, 60]);
    expect(robustColour([])).toBeNull();
  });

  it('finds the nearest prototype and the margin to the runner-up', () => {
    const r = nearest(hexToRgb('#5a7ea8'), EYE_PROTOTYPES);
    expect(r.id).toBe('blue');
    expect(r.distance).toBeCloseTo(0, 5);
    expect(r.margin).toBeGreaterThan(5);
  });
});

describe('classifiers', () => {
  it('maps every hair and eye prototype onto itself', () => {
    for (const [id, c] of Object.entries(HAIR_PROTOTYPES)) expect(hairColourOf(c)).toBe(id);
    for (const [id, c] of Object.entries(EYE_PROTOTYPES)) expect(eyeColourOf(c)).toBe(id);
  });

  it('reads white and silver hair as grey', () => {
    expect(hairColourOf([200, 200, 198])).toBe('grey');
    expect(hairColourOf([150, 150, 152])).toBe('grey');
  });

  it('orders skin tones with the ITA scale, lightest to deepest', () => {
    const samples = ['#f6e2d3', '#e6b896', '#d9a77f', '#b97f55', '#8a5636', '#4a2c1f'].map(hexToRgb);
    const angles = samples.map(ita);
    for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeLessThan(angles[i - 1]);
    expect(samples.map(skinToneOf)).toEqual(['tone1', 'tone2', 'tone3', 'tone4', 'tone5', 'tone6']);
  });

  it('decides glasses only when the evidence is clear', () => {
    expect(glassesOf(0.2)).toBe(true);
    expect(glassesOf(0)).toBe(false);
    expect(glassesOf(0.05)).toBeNull();
  });

  it('measures hair length against the face', () => {
    const g = { height: 260, top: 60, chin: 180, eyeY: 105, hairShare: 0.5 };
    expect(hairLengthOf({ ...g, lowest: 80 })).toBe('very_short');
    expect(hairLengthOf({ ...g, lowest: 150 })).toBe('short');
    expect(hairLengthOf({ ...g, lowest: 205 })).toBe('medium');
    expect(hairLengthOf({ ...g, lowest: 259 })).toBe('long');
    expect(hairLengthOf({ ...g, lowest: 150, hairShare: 0.1 })).toBe('very_short');
  });
});

describe('traitsFromFrame (synthetic portraits)', () => {
  it('reads hair, skin, eyes and glasses from a portrait', () => {
    const t = traitsFromFrame(portrait({ skin: hexToRgb('#e6b896'), iris: hexToRgb('#5a7ea8'), hair: hexToRgb('#a88a5c'), hairTo: 150 }));
    expect(t.face).toBe(true);
    expect(t.blueprint).toMatchObject({ hairColor: 'blond', hairLength: 'short', skinTone: 'tone2', eyeColor: 'blue', glasses: false });
    // Never guessed from a photo: the texture of the hair and freckles.
    expect(t.toPick).toEqual(expect.arrayContaining(['hairStyle', 'freckles']));
    expect(t.blueprint.hairStyle).toBeUndefined();
    expect(t.blueprint.freckles).toBeUndefined();
  });

  it('tells dark skin, brown eyes and long black hair', () => {
    const t = traitsFromFrame(portrait({ skin: hexToRgb('#4a2c1f'), iris: hexToRgb('#2b1d16'), hair: hexToRgb('#1a1614'), hairTo: 259 }));
    expect(t.blueprint).toMatchObject({ skinTone: 'tone6', eyeColor: 'dark_brown', hairColor: 'black', hairLength: 'long' });
  });

  it('sees medium red hair and glasses', () => {
    const t = traitsFromFrame(portrait({ hair: hexToRgb('#a8522c'), hairTo: 205, glasses: true }));
    expect(t.blueprint).toMatchObject({ hairColor: 'red', hairLength: 'medium', glasses: true });
  });

  it('recognises a headscarf and leaves hair colour alone', () => {
    const t = traitsFromFrame(portrait({ hair: null, scarf: true }));
    expect(t.blueprint.hairStyle).toBe('covered');
    expect(t.blueprint.hairColor).toBeUndefined();
    expect(t.toPick).not.toContain('hairStyle');
  });

  it('calls almost no hair very short, without guessing its colour', () => {
    const t = traitsFromFrame(portrait({ hair: null }));
    expect(t.blueprint.hairLength).toBe('very_short');
    expect(t.blueprint.hairColor).toBeUndefined();
    expect(t.toPick).toContain('hairColor');
  });

  it('leaves the eye colour to the parent without iris landmarks', () => {
    const t = traitsFromFrame(portrait({ irisLandmarks: false }));
    expect(t.blueprint.eyeColor).toBeUndefined();
    expect(t.toPick).toContain('eyeColor');
  });

  it('reports no face (and guesses nothing) when MediaPipe found none', () => {
    const t = traitsFromFrame(portrait({ noLandmarks: true }));
    expect(t).toEqual({ face: false, blueprint: {}, toPick: expect.arrayContaining(['hairColor', 'skinTone', 'eyeColor']) });
  });
});

describe('no photo leaves the device', () => {
  it('the avatar studio and the photo reader never upload the photo', async () => {
    const { readFileSync } = await import('node:fs');
    const studio = readFileSync('src/components/world/AvatarStudio.tsx', 'utf8');
    const reader = readFileSync('src/lib/avatar/photo-analyze.ts', 'utf8');
    expect(studio).not.toMatch(/avatar\/analyze|toDataURL|readAsDataURL/);
    // The only addresses the reader loads are our own static model files.
    expect(reader).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//);
  });
});
