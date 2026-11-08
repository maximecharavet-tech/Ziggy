'use client';

import { useMemo } from 'react';

/** Soft falling snow (CSS only, transform/opacity). `count = 0` for reduced motion. */
export function Snow({ count = 40, className = '' }: { count?: number; className?: string }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (n: number) => ((Math.sin(i * 9301 + n * 49297) + 1) / 2) % 1;
        return { left: r(1) * 100, size: 3 + r(2) * 6, dur: 7 + r(3) * 9, delay: -r(4) * 16, drift: (r(5) - 0.5) * 60, opacity: 0.45 + r(6) * 0.5 };
      }),
    [count]
  );
  if (!count) return null;
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {flakes.map((f, i) => (
        <span
          key={i}
          className="santa-flake absolute top-[-12px] rounded-full bg-white"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
            ['--drift' as string]: `${f.drift}px`,
            filter: f.size > 6 ? 'blur(1px)' : undefined,
          }}
        />
      ))}
      <style>{`
        @keyframes santa-fall { from { transform: translate3d(0,-20px,0); } to { transform: translate3d(var(--drift), 110vh, 0); } }
        .santa-flake { animation: santa-fall linear infinite; will-change: transform; }
        @media (prefers-reduced-motion: reduce) { .santa-flake { animation: none; display: none; } }
      `}</style>
    </div>
  );
}
