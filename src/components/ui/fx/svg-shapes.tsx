/** The DOM effects' shapes, as 24 × 24 SVG paths (same family as the canvas shapes). */

export type SvgShape = 'star' | 'heart' | 'sparkle' | 'dot';

export const SVG_PATHS: Record<SvgShape, string> = {
  star: 'M12 1.5l3.1 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.3l-6.4 3.6 1.5-7.1L1.7 8.9l7.2-.8z',
  heart: 'M12 21.2C11 20.4 2.5 14.6 2.5 8.6 2.5 5.4 5 3 8 3c1.8 0 3.2.9 4 2.2C12.8 3.9 14.2 3 16 3c3 0 5.5 2.4 5.5 5.6 0 6-8.5 11.8-9.5 12.6z',
  sparkle: 'M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z',
  dot: 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16z',
};

export function ShapeSvg({ shape, color, size, className = '' }: { shape: SvgShape; color: string; size: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <path d={SVG_PATHS[shape]} fill={color} />
    </svg>
  );
}
