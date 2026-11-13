'use client';

import { useMemo } from 'react';

/** Soft falling snow (CSS only, transform/opacity). `count = 0` for reduced motion. */
export function Snow({ count = 40, className = '' }: { count?: number; className?: string }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Rounded: Math.sin's last digits differ between the server and some
        // browsers, which made the snow a hydration mismatch.
        const r = (n: number) => Math.round((((Math.sin(i * 9301 + n * 49297) + 1) / 2) % 1) * 1000) / 1000;
        const q = (v: number) => Math.round(v * 100) / 100;
        return { left: q(r(1) * 100), size: q(3 + r(2) * 6), dur: q(7 + r(3) * 9), delay: q(-r(4) * 16), drift: q((r(5) - 0.5) * 60), opacity: q(0.45 + r(6) * 0.5) };
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
            width: `${f.size}px`,
            height: `${f.size}px`,
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
