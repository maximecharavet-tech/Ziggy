'use client';

import type { ReactNode } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Snow } from './Snow';

const STARS = Array.from({ length: 46 }, (_, i) => ({
  left: (i * 37.7) % 100,
  top: (i * 23.3) % 62,
  size: 1 + ((i * 7) % 3),
  delay: (i % 7) * 0.6,
}));

/** Night sky, aurora glow, stars and snow behind the Santa pages (dark in both themes). */
export function SantaBackdrop({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <div className="santa-app relative isolate min-h-screen overflow-clip bg-[#0b0a26] text-white print:bg-white print:text-black">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 print:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,#2b1d6b_0%,#14113f_45%,#0b0a26_100%)]" />
        <div className="santa-aurora absolute -top-1/4 left-[-20%] h-[70%] w-[140%] bg-[radial-gradient(40%_50%_at_30%_50%,rgba(64,255,190,0.20),transparent_70%),radial-gradient(35%_45%_at_70%_40%,rgba(130,110,255,0.22),transparent_70%)] blur-2xl" />
        {STARS.map((s, i) => (
          <span
            key={i}
            className="santa-star absolute rounded-full bg-white"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(70%_100%_at_50%_100%,rgba(255,255,255,0.16),transparent_70%)]" />
        <Snow count={reduced ? 0 : 36} />
      </div>
      {children}
      <style>{`
        @keyframes santa-twinkle { 0%,100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes santa-aurora { 0%,100% { transform: translate3d(0,0,0) scaleY(1); opacity: .8; } 50% { transform: translate3d(4%,2%,0) scaleY(1.15); opacity: 1; } }
        .santa-star { animation: santa-twinkle 3.6s ease-in-out infinite; }
        .santa-aurora { animation: santa-aurora 14s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .santa-star, .santa-aurora { animation: none; } }
        @media print {
          header, nav, footer, [data-print-hide] { display: none !important; }
          .santa-letter { transform: none !important; box-shadow: none !important; margin-top: 0 !important; }
        }
      `}</style>
    </div>
  );
}
