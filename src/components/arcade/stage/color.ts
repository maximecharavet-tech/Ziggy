/**
 * Tiny colour helpers for the game stages: every scene, tile and button is
 * shaded from the game's (or world's) one accent colour, so each game keeps
 * its own identity with the same "toy" lighting.
 */

type RGB = [number, number, number];

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function rgbOf(hex: string): RGB {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (!/^[0-9a-f]{6}$/i.test(full) || !Number.isFinite(n)) return [127, 127, 127];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Linear mix of two colours, t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export const lighten = (hex: string, t: number) => mix(hex, '#FFFFFF', t);

function toHsl([r, g, b]: RGB): [number, number, number] {
  const x = r / 255;
  const y = g / 255;
  const z = b / 255;
  const max = Math.max(x, y, z);
  const min = Math.min(x, y, z);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === x ? (y - z) / d + (y < z ? 6 : 0) : max === y ? (z - x) / d + 2 : (x - y) / d + 4;
  return [h / 6, s, l];
}

function fromHsl([h, s, l]: [number, number, number]): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [ch(h + 1 / 3) * 255, ch(h) * 255, ch(h - 1 / 3) * 255];
}

/**
 * Darker and a touch richer, like the shaded side of coloured plastic
 * (lightness down, saturation kept up) — never muddy brown.
 */
export function darken(hex: string, t: number): string {
  const [h, s, l] = toHsl(rgbOf(hex));
  return toHex(fromHsl([h, Math.min(0.86, s * (1 + t * 0.2)), Math.max(0.06, l * (1 - t * 0.95))]));
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** The three tones of a physical toy surface: lit top, body, and the darker side (thickness). */
export function toyTones(color: string) {
  return {
    light: lighten(color, 0.32),
    body: color,
    low: darken(color, 0.12),
    edge: darken(color, 0.32),
    glow: rgba(color, 0.45),
  };
}

/** Perceived brightness 0–1, to keep labels readable on light accent colours. */
export function luma(hex: string): number {
  const [r, g, b] = rgbOf(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** The accent, deepened just enough to carry white text (sunny yellows, pale greys…). */
export function strong(color: string): string {
  const l = luma(color);
  return l > 0.72 ? darken(color, 0.42) : l > 0.6 ? darken(color, 0.28) : l > 0.5 ? darken(color, 0.12) : color;
}
