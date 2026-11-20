/** Colour helpers for the hub pages: readable ink on any clay tint (WCAG AA). */

const channels = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number];
};

const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** Relative luminance (WCAG 2.x). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colours, 1–21. */
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The colour mixed towards a deep violet ink by `t` (0–1). */
export function deepen(hex: string, t: number): string {
  const to = [24, 10, 48];
  return toHex(channels(hex).map((v, i) => v + (to[i] - v) * t));
}

/**
 * The tint itself, or the closest deeper version of it, that white text
 * can sit on with at least `ratio` contrast (AA = 4.5).
 */
export function deepFor(hex: string, ratio = 4.5): string {
  for (let t = 0; t <= 1; t += 0.04) {
    const c = deepen(hex, t);
    if (contrast(c, '#ffffff') >= ratio) return c;
  }
  return '#180a30';
}

/** Text in the tint's hue that stays readable on a light card (AA on white). */
export function inkFor(hex: string, ratio = 4.5): string {
  return deepFor(hex, ratio);
}
