import type { L } from '@/lib/i18n-text';

/**
 * The crayon box: 24 bright, kid-friendly colours, plus a few "magic" fills
 * (gradients) that make a region shine. Every colour has a name, so Ziggy can
 * say it aloud for children who cannot read yet.
 */

export type SolidColor = { id: string; hex: string; name: L };
export type MagicColor = { id: string; name: L; stops: string[]; angle: number; solid: string };

export const COLORS: SolidColor[] = [
  { id: 'red', hex: '#EF4444', name: { fr: 'Rouge', en: 'Red' } },
  { id: 'orange', hex: '#FB8C2B', name: { fr: 'Orange', en: 'Orange' } },
  { id: 'yellow', hex: '#FFD43B', name: { fr: 'Jaune', en: 'Yellow' } },
  { id: 'cream', hex: '#FFF1C7', name: { fr: 'Crème', en: 'Cream' } },
  { id: 'lime', hex: '#A3E635', name: { fr: 'Vert pomme', en: 'Lime green' } },
  { id: 'green', hex: '#34C759', name: { fr: 'Vert', en: 'Green' } },
  { id: 'forest', hex: '#1F8A4C', name: { fr: 'Vert sapin', en: 'Pine green' } },
  { id: 'mint', hex: '#86EFC4', name: { fr: 'Menthe', en: 'Mint' } },
  { id: 'turquoise', hex: '#2DD4BF', name: { fr: 'Turquoise', en: 'Turquoise' } },
  { id: 'sky', hex: '#8DD8FF', name: { fr: 'Bleu ciel', en: 'Sky blue' } },
  { id: 'blue', hex: '#3B82F6', name: { fr: 'Bleu', en: 'Blue' } },
  { id: 'navy', hex: '#28388F', name: { fr: 'Bleu nuit', en: 'Night blue' } },
  { id: 'lavender', hex: '#CDBEFF', name: { fr: 'Lavande', en: 'Lavender' } },
  { id: 'purple', hex: '#8B5CF6', name: { fr: 'Violet', en: 'Purple' } },
  { id: 'magenta', hex: '#D946EF', name: { fr: 'Magenta', en: 'Magenta' } },
  { id: 'pink', hex: '#FBA8D2', name: { fr: 'Rose', en: 'Pink' } },
  { id: 'raspberry', hex: '#E83E8C', name: { fr: 'Framboise', en: 'Raspberry' } },
  { id: 'peach', hex: '#FFD3B0', name: { fr: 'Pêche', en: 'Peach' } },
  { id: 'caramel', hex: '#E0A06A', name: { fr: 'Caramel', en: 'Caramel' } },
  { id: 'brown', hex: '#9A5B2E', name: { fr: 'Marron', en: 'Brown' } },
  { id: 'sand', hex: '#F3DDA8', name: { fr: 'Sable', en: 'Sand' } },
  { id: 'white', hex: '#FFFFFF', name: { fr: 'Blanc', en: 'White' } },
  { id: 'grey', hex: '#A3ADBD', name: { fr: 'Gris', en: 'Grey' } },
  { id: 'black', hex: '#2B2D42', name: { fr: 'Noir', en: 'Black' } },
];

export const MAGIC: MagicColor[] = [
  { id: 'rainbow', name: { fr: 'Arc-en-ciel', en: 'Rainbow' }, stops: ['#FF5A5F', '#FFB13B', '#FFE45C', '#5BD67A', '#4FA8FF', '#A77BFF'], angle: 0, solid: '#FFB13B' },
  { id: 'gold', name: { fr: 'Or', en: 'Gold' }, stops: ['#FFF4B0', '#FFD23F', '#E3A008', '#FFE27A'], angle: 45, solid: '#FFD23F' },
  { id: 'sunset', name: { fr: 'Coucher de soleil', en: 'Sunset' }, stops: ['#FFD86B', '#FF8A5B', '#F2558F'], angle: 90, solid: '#FF8A5B' },
  { id: 'ocean', name: { fr: 'Océan', en: 'Ocean' }, stops: ['#B8F3FF', '#4FC3F7', '#2563EB'], angle: 90, solid: '#4FC3F7' },
  { id: 'candy', name: { fr: 'Barbe à papa', en: 'Cotton candy' }, stops: ['#FFC4E6', '#D9B8FF', '#A8E6FF'], angle: 45, solid: '#D9B8FF' },
  { id: 'galaxy', name: { fr: 'Galaxie', en: 'Galaxy' }, stops: ['#2E1A6B', '#7C3AED', '#EC4899'], angle: 60, solid: '#7C3AED' },
];

const byId = new Map<string, SolidColor | MagicColor>([...COLORS, ...MAGIC].map((c) => [c.id, c]));

export const isMagic = (id: string): boolean => MAGIC.some((m) => m.id === id);
export const colorName = (id: string): L | null => byId.get(id)?.name ?? null;
export const knownColor = (id: string): boolean => byId.has(id);

/** A plain hex for any colour id (magic colours give their main tone). */
export function solidHex(id: string): string {
  const c = byId.get(id);
  if (!c) return '#FFFFFF';
  return 'hex' in c ? c.hex : c.solid;
}

/** The SVG fill for a region: a hex, or a reference to the magic gradient. */
export function fillAttr(id: string | undefined): string {
  if (!id) return '#FFFFFF';
  return isMagic(id) ? `url(#magic-${id})` : solidHex(id);
}

/** Gradient end points (objectBoundingBox) for an angle in degrees. */
export function gradientVector(angle: number): { x1: number; y1: number; x2: number; y2: number } {
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a) / 2;
  const dy = Math.sin(a) / 2;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return { x1: r(0.5 - dx), y1: r(0.5 - dy), x2: r(0.5 + dx), y2: r(0.5 + dy) };
}

const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** Mix two hex colours (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const A = parse(a);
  const B = parse(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}

/** Along a magic brush stroke, the colour cycles through the stops. */
export function magicAt(id: string, distance: number, period = 360): string {
  const m = MAGIC.find((x) => x.id === id);
  if (!m) return solidHex(id);
  const loop = [...m.stops, m.stops[0]];
  const u = (((distance % period) + period) % period) / period;
  const pos = u * (loop.length - 1);
  const i = Math.floor(pos);
  return mix(loop[i], loop[Math.min(i + 1, loop.length - 1)], pos - i);
}

/** The rainbow brush: hue follows the distance drawn. */
export function rainbowAt(distance: number): string {
  const h = Math.round(((distance * 0.9) % 360 + 360) % 360);
  return `hsl(${h} 92% 60%)`;
}

/** Relative luminance (0 dark → 1 light), to pick a readable check mark on a swatch. */
export function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Cheerful palettes for the "remplissage magique" surprise. */
export const SURPRISE_PALETTES: string[][] = [
  ['red', 'orange', 'yellow', 'lime', 'sky', 'purple', 'pink'],
  ['mint', 'turquoise', 'sky', 'lavender', 'pink', 'cream', 'yellow'],
  ['raspberry', 'magenta', 'purple', 'blue', 'turquoise', 'gold', 'candy'],
  ['peach', 'caramel', 'sand', 'forest', 'green', 'sunset', 'orange'],
];
