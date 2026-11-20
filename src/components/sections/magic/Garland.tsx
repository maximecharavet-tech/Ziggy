import type { CSSProperties } from 'react';

const BULBS = ['#FF5D73', '#FFD447', '#5FD3A1', '#6FB8FF', '#FF9F43', '#C792FF'];

/** Height of the wire (px) at a point 0–1 across: two sags between three hooks (plain arithmetic, the same on server and browser). */
const wire = (x: number) => {
  const f = (x * 2) % 1;
  return Math.round((3 + 44 * f * (1 - f)) * 100) / 100;
};

/**
 * A string of Christmas lights across the top of a card (code-made). The wire
 * stretches with the card, the bulbs keep their shape and glow softly in turn
 * (opacity only); still for reduced motion.
 */
export function Garland({ count = 12, className = 'relative w-full' }: { count?: number; /** Must position it: `relative w-full` (default) or `absolute inset-x-… top-…`. */ className?: string }) {
  const path = Array.from({ length: 41 }, (_, i) => `${i === 0 ? 'M' : 'L'}${(i * 2.5).toFixed(1)} ${wire(i / 40)}`).join(' ');
  return (
    <div aria-hidden="true" className={`pointer-events-none h-9 ${className}`}>
      <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d={path} fill="none" stroke="rgb(170 210 180 / 0.55)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: count }, (_, i) => {
        const x = (i + 0.5) / count;
        const c = BULBS[i % BULBS.length];
        return (
          <span key={i} className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: `${(x * 100).toFixed(2)}%`, top: `${wire(x) - 1}px` }}>
            <span className="h-1.5 w-2 rounded-[2px] bg-[#3b4a3f]" />
            <span
              className="mg-bulb -mt-px h-3.5 w-2.5 rounded-full"
              style={{ background: `radial-gradient(circle at 35% 30%, #fff 0 12%, ${c} 45%)`, boxShadow: `0 0 8px 1px ${c}`, '--delay': `${-(i % 4) * 0.6}s` } as CSSProperties}
            />
          </span>
        );
      })}
    </div>
  );
}
