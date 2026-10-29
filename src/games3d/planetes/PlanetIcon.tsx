'use client';

import { useId } from 'react';
import type { BodyId } from './logic';

/**
 * Little painted planets for the HUD buttons and the end map (SVG, drawn in
 * code): each one is recognisable at a glance — Saturn's rings, Jupiter's
 * stripes and red spot, the blue and green Earth, the red Mars…
 */
export function PlanetIcon({ body, size = 64, className = '' }: { body: BodyId | 'sun'; size?: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const clip = `pc-${uid}`;
  const shade = `ps-${uid}`;
  const ball = (fill: string, children?: React.ReactNode, r = 34) => (
    <>
      <circle cx="50" cy="50" r={r} fill={fill} />
      <g clipPath={`url(#${clip})`}>{children}</g>
      <circle cx="50" cy="50" r={r} fill={`url(#${shade})`} />
    </>
  );
  let body3d: React.ReactNode;
  let r = 34;
  switch (body) {
    case 'sun':
      r = 30;
      body3d = (
        <>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <line key={i} x1={50 + Math.cos(a) * 34} y1={50 + Math.sin(a) * 34} x2={50 + Math.cos(a) * 46} y2={50 + Math.sin(a) * 46} stroke="#ffb12e" strokeWidth="6" strokeLinecap="round" />;
          })}
          <circle cx="50" cy="50" r="30" fill="#ffcc33" />
          <circle cx="42" cy="42" r="12" fill="#fff0a0" opacity="0.7" />
        </>
      );
      break;
    case 'mercury':
      body3d = ball(
        '#a39d96',
        <>
          <circle cx="38" cy="40" r="7" fill="#7f7a74" />
          <circle cx="60" cy="58" r="9" fill="#857f78" />
          <circle cx="62" cy="34" r="4" fill="#7f7a74" />
          <circle cx="40" cy="66" r="5" fill="#8a847e" />
        </>
      );
      break;
    case 'venus':
      body3d = ball(
        '#ecc982',
        <>
          <path d="M10 40 Q35 30 55 42 T95 38" stroke="#f8e3b0" strokeWidth="8" fill="none" />
          <path d="M8 60 Q30 70 52 58 T96 64" stroke="#d9a24f" strokeWidth="7" fill="none" />
          <path d="M14 76 Q40 70 70 80" stroke="#f3dca0" strokeWidth="6" fill="none" />
        </>
      );
      break;
    case 'earth':
      body3d = ball(
        '#2f80dc',
        <>
          <path d="M30 26 Q44 22 46 34 Q40 44 48 52 Q42 62 32 58 Q24 46 30 26Z" fill="#4caf50" />
          <path d="M58 46 Q72 40 80 52 Q76 66 64 72 Q56 62 58 46Z" fill="#5dbb5a" />
          <path d="M20 40 Q36 36 46 42" stroke="#ffffff" strokeWidth="5" fill="none" opacity="0.85" strokeLinecap="round" />
          <path d="M52 30 Q66 26 76 32" stroke="#ffffff" strokeWidth="4" fill="none" opacity="0.8" strokeLinecap="round" />
          <path d="M40 74 Q54 70 66 76" stroke="#ffffff" strokeWidth="4" fill="none" opacity="0.8" strokeLinecap="round" />
          <ellipse cx="50" cy="16" rx="16" ry="5" fill="#f4fbff" />
        </>
      );
      break;
    case 'moon':
      r = 28;
      body3d = ball(
        '#d4d4da',
        <>
          <circle cx="40" cy="42" r="8" fill="#a9a9b2" />
          <circle cx="60" cy="56" r="6" fill="#b4b4bc" />
          <circle cx="48" cy="64" r="4" fill="#a9a9b2" />
          <circle cx="62" cy="38" r="3" fill="#b4b4bc" />
        </>,
        28
      );
      break;
    case 'mars':
      body3d = ball(
        '#d2693c',
        <>
          <path d="M20 46 Q40 38 52 50 Q66 58 82 50 L84 66 Q60 72 40 64 Q24 62 18 56Z" fill="#a8482a" opacity="0.8" />
          <ellipse cx="50" cy="17" rx="13" ry="4" fill="#fff6f0" />
          <circle cx="64" cy="36" r="4" fill="#b85a34" />
        </>
      );
      break;
    case 'jupiter':
      body3d = ball(
        '#e8cfa6',
        <>
          <rect x="0" y="24" width="100" height="7" fill="#c98d58" />
          <rect x="0" y="38" width="100" height="9" fill="#b97b4b" />
          <rect x="0" y="54" width="100" height="6" fill="#d9a56b" />
          <rect x="0" y="66" width="100" height="8" fill="#b97b4b" />
          <ellipse cx="62" cy="62" rx="9" ry="5.5" fill="#c4553a" stroke="#f1c79a" strokeWidth="2" />
        </>
      );
      break;
    case 'saturn':
      r = 27;
      body3d = (
        <>
          <ellipse cx="50" cy="52" rx="46" ry="13" fill="none" stroke="#c8b07a" strokeWidth="7" transform="rotate(-14 50 52)" />
          {ball(
            '#e8d3a0',
            <>
              <rect x="0" y="36" width="100" height="6" fill="#d4b06d" />
              <rect x="0" y="50" width="100" height="5" fill="#d8b878" />
              <rect x="0" y="62" width="100" height="6" fill="#d4b06d" />
            </>,
            27
          )}
          <path d="M8 58 A46 13 -14 0 0 92 37" transform="rotate(0)" fill="none" stroke="#efe0b6" strokeWidth="7" strokeLinecap="round" />
        </>
      );
      break;
    case 'uranus':
      r = 30;
      body3d = (
        <>
          <ellipse cx="50" cy="50" rx="12" ry="44" fill="none" stroke="#c8f4f6" strokeWidth="3" opacity="0.8" transform="rotate(12 50 50)" />
          {ball(
            '#93dfe6',
            <>
              <rect x="0" y="40" width="100" height="5" fill="#a6ecef" />
              <rect x="0" y="58" width="100" height="4" fill="#7fcdd6" />
            </>,
            30
          )}
        </>
      );
      break;
    case 'neptune':
      body3d = ball(
        '#3f63d9',
        <>
          <rect x="0" y="30" width="100" height="6" fill="#2a4bbd" />
          <rect x="0" y="62" width="100" height="7" fill="#2a4bbd" />
          <ellipse cx="38" cy="56" rx="8" ry="5" fill="#1b2a7a" />
          <path d="M52 44 Q64 40 76 44" stroke="#e6f0ff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r={r} />
        </clipPath>
        <radialGradient id={shade} cx="0.35" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1238" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      {body3d}
    </svg>
  );
}
