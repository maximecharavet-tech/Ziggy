import type { CSSProperties } from 'react';
import fx from './fx.module.css';

/** Shared class names of the toy surfaces and loops (see fx.module.css). */
export { fx };

const parse = (hex: string) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
};
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** Lighter (amount > 0, towards white) or darker (amount < 0, towards a deep violet) version of a colour. */
export function shade(hex: string, amount: number): string {
  const c = parse(hex);
  const to = amount >= 0 ? [255, 255, 255] : [24, 10, 48];
  const t = Math.abs(amount);
  return toHex(c.map((v, i) => v + (to[i] - v) * t));
}

/** Hex colour with an alpha channel (0–1). */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Perceived lightness 0–1, to pick dark or white ink on a coloured toy. */
export function lightness(hex: string): number {
  const [r, g, b] = parse(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** CSS variables of a coloured toy surface: face, edge (its thickness), ink and glow. */
export function toy(face: string, opts: { depth?: number; ink?: string; ring?: string } = {}): CSSProperties {
  const ink = opts.ink ?? (lightness(face) > 0.72 ? '#2a1650' : '#ffffff');
  return {
    '--face': face,
    '--edge': shade(face, -0.32),
    '--ink': ink,
    '--glow': alpha(shade(face, -0.5), 0.45),
    ...(opts.depth !== undefined ? { '--depth': `${opts.depth}px` } : {}),
    ...(opts.ring ? { '--ring': opts.ring } : {}),
  } as CSSProperties;
}

/** Inline CSS variables for the loops (duration, delay, amplitude…). */
export function loop(vars: { dur?: number; delay?: number; amp?: number; tilt?: number; dx?: number; dy?: number; grow?: number; origin?: string }): CSSProperties {
  const s: Record<string, string> = {};
  if (vars.dur !== undefined) s['--dur'] = `${vars.dur}s`;
  if (vars.delay !== undefined) s['--delay'] = `${vars.delay}s`;
  if (vars.amp !== undefined) s['--amp'] = `${vars.amp}px`;
  if (vars.tilt !== undefined) s['--tilt'] = `${vars.tilt}deg`;
  if (vars.dx !== undefined) s['--dx'] = `${vars.dx}px`;
  if (vars.dy !== undefined) s['--dy'] = `${vars.dy}px`;
  if (vars.grow !== undefined) s['--grow'] = String(vars.grow);
  if (vars.origin !== undefined) s['--origin'] = vars.origin;
  return s as CSSProperties;
}
