import { describe, expect, it } from 'vitest';
import { COLORS, MAGIC, SURPRISE_PALETTES, colorName, fillAttr, gradientVector, isMagic, knownColor, luminance, magicAt, mix, rainbowAt, solidHex } from './palette';
import { STICKERS, clampStickerSize, STICKER_MAX, STICKER_MIN } from './stickers';
import { cheerFor, filledRatio } from './milestones';

describe('palette', () => {
  it('has 24 named colours with valid, unique hex values', () => {
    expect(COLORS).toHaveLength(24);
    expect(new Set(COLORS.map((c) => c.id)).size).toBe(24);
    expect(new Set(COLORS.map((c) => c.hex.toLowerCase())).size).toBe(24);
    for (const c of COLORS) {
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(c.name.fr.trim()).not.toBe('');
      expect(c.name.en.trim()).not.toBe('');
    }
  });

  it('has magic fills with at least two valid stops', () => {
    expect(MAGIC.length).toBeGreaterThanOrEqual(2);
    expect(MAGIC.map((m) => m.id)).toEqual(expect.arrayContaining(['rainbow', 'gold']));
    for (const m of MAGIC) {
      expect(m.stops.length).toBeGreaterThanOrEqual(2);
      for (const s of m.stops) expect(s).toMatch(/^#[0-9A-F]{6}$/i);
      expect(isMagic(m.id)).toBe(true);
      expect(fillAttr(m.id)).toBe(`url(#magic-${m.id})`);
    }
  });

  it('gives a fill for solids, magic and unknown ids', () => {
    expect(fillAttr('red')).toBe('#EF4444');
    expect(fillAttr(undefined)).toBe('#FFFFFF');
    expect(solidHex('nope')).toBe('#FFFFFF');
    expect(colorName('blue')?.fr).toBe('Bleu');
    expect(colorName('nope')).toBeNull();
    expect(knownColor('gold')).toBe(true);
  });

  it('surprise palettes only use known colours', () => {
    for (const p of SURPRISE_PALETTES) for (const id of p) expect(knownColor(id), id).toBe(true);
  });

  it('mixes and cycles colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(magicAt('rainbow', 0)).toBe('#ff5a5f');
    expect(magicAt('rainbow', 360)).toBe(magicAt('rainbow', 0));
    expect(magicAt('red', 50)).toBe('#EF4444');
    expect(rainbowAt(0)).toMatch(/^hsl\(0 /);
    expect(rainbowAt(-10)).toMatch(/^hsl\(\d+ /);
  });

  it('gradient vectors stay inside the box', () => {
    for (const a of [0, 45, 90, 180, 270]) {
      const v = gradientVector(a);
      for (const n of [v.x1, v.y1, v.x2, v.y2]) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  it('luminance orders dark and light', () => {
    expect(luminance('#FFFFFF')).toBeGreaterThan(luminance('#2B2D42'));
  });
});

describe('stickers', () => {
  it('has named, unique stickers including the classics', () => {
    expect(new Set(STICKERS.map((s) => s.e)).size).toBe(STICKERS.length);
    for (const e of ['⭐', '❤️', '🌸', '🦋', '🎁', '❄️', '🌈']) expect(STICKERS.some((s) => s.e === e)).toBe(true);
  });
  it('clamps sizes', () => {
    expect(clampStickerSize(1)).toBe(STICKER_MIN);
    expect(clampStickerSize(9999)).toBe(STICKER_MAX);
  });
});

describe('Ziggy cheers', () => {
  it('cheers at action milestones, half and done', () => {
    expect(cheerFor({ actions: 3, ratio: 0 }, { actions: 4, ratio: 0.1 })?.kind).toBe('action');
    expect(cheerFor({ actions: 5, ratio: 0.4 }, { actions: 6, ratio: 0.5 })?.kind).toBe('half');
    expect(cheerFor({ actions: 5, ratio: 0.9 }, { actions: 6, ratio: 1 })?.kind).toBe('done');
    expect(cheerFor({ actions: 5, ratio: 0.1 }, { actions: 6, ratio: 0.2 })).toBeNull();
  });
  it('computes the coloured ratio', () => {
    expect(filledRatio(['a', 'b', 'c', 'd'], { a: 'red', b: 'blue' })).toBe(0.5);
    expect(filledRatio([], {})).toBe(0);
  });
});
