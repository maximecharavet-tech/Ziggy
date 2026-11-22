'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useInView } from 'motion/react';
import { Snow } from '@/components/santa/Snow';
import { isChristmasSeason } from './season';
import { Sparkle4 } from './Sparkle4';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * A code-made sky behind a section: soft gradient blobs, Ziggy's four-point
 * sparkles, drifting clouds and, in the Christmas season, a little snow on
 * the night skies. Cheap: a few dozen compositor-only loops, paused when the
 * section is off screen, all still for reduced motion. Decorative only.
 */
export type SkyVariant = 'day' | 'candy' | 'dusk' | 'night';

const PALETTES: Record<SkyVariant, { blobs: string[]; stars: string[]; cloud: string }> = {
  day: { blobs: ['rgb(127 200 92 / 0.32)', 'rgb(95 182 234 / 0.28)', 'rgb(255 217 160 / 0.6)'], stars: ['#FBBF24', '#F2647B', '#5FB6EA', '#7FC85C'], cloud: '#ffffff' },
  candy: { blobs: ['rgb(176 124 255 / 0.28)', 'rgb(255 122 184 / 0.26)', 'rgb(255 212 71 / 0.3)'], stars: ['#B07CFF', '#FF7AB8', '#FBBF24', '#5FB6EA'], cloud: '#ffffff' },
  dusk: { blobs: ['rgb(255 217 160 / 0.55)', 'rgb(251 201 196 / 0.55)', 'rgb(176 124 255 / 0.22)'], stars: ['#F9BE7C', '#F2647B', '#B07CFF'], cloud: '#fff7ee' },
  night: { blobs: ['rgb(90 95 255 / 0.3)', 'rgb(53 229 198 / 0.18)', 'rgb(176 124 255 / 0.28)'], stars: ['#FFF3C4', '#FFFFFF', '#CFE8FF'], cloud: 'rgb(255 255 255 / 0.1)' },
};

/** Integer PRNG (mulberry32): the same numbers on the server and in every browser. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;


function Cloud({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 120 50" className="mg-cloud" style={style} aria-hidden="true">
      <path d="M22 46C10 46 2 39 2 30.5S10 16 21 16c2-8.5 10-14 19-14 9.5 0 17 5.8 19.6 14C62 12 67 9.5 73 9.5c10 0 18 7.5 18.5 17C102 26 118 30 118 37.5 118 43 113 46 106 46Z" fill="currentColor" />
    </svg>
  );
}

export function MagicBackdrop({
  variant = 'day',
  stars = 10,
  clouds = 0,
  blobs = true,
  snow = false,
  parallax = true,
  seed = 7,
  className = '',
}: {
  variant?: SkyVariant;
  /** Number of twinkling sparkles. */
  stars?: number;
  /** Number of drifting clouds. */
  clouds?: number;
  blobs?: boolean;
  /** Seasonal snow (Christmas season only, night skies only). */
  snow?: boolean;
  /** Sparkles drift with the scroll of the section (CSS scroll timeline). */
  parallax?: boolean;
  seed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: '120px 0px' });
  const reduced = useReducedMotion();
  const [season, setSeason] = useState(false);
  useEffect(() => setSeason(snow && isChristmasSeason()), [snow]);

  const pal = PALETTES[variant];
  const r = rng(seed);
  const sparkles = Array.from({ length: stars }, (_, i) => ({
    left: round(r() * 96 + 2),
    top: round(r() * 88 + 4),
    size: round(8 + r() * (i % 4 === 0 ? 14 : 8)),
    dur: round(2.4 + r() * 2.6),
    delay: round(-r() * 4),
    depth: round(0.4 + r() * 1.4),
    c: pal.stars[i % pal.stars.length],
  }));
  const puffs = Array.from({ length: clouds }, (_, i) => ({
    left: round(-6 + (i * 100) / Math.max(1, clouds) + r() * 14),
    top: round(4 + r() * 30),
    width: round(90 + r() * 90),
    dur: round(28 + r() * 22),
    delay: round(-r() * 20),
    dx: round(30 + r() * 50) * (i % 2 ? -1 : 1),
  }));

  return (
    <div ref={ref} aria-hidden="true" data-still={visible ? undefined : ''} className={`mg-sky ${className}`}>
      {blobs ? (
        <>
          <span className="mg-blob -start-[12%] -top-[18%] h-[26rem] w-[26rem] sm:h-[34rem] sm:w-[34rem]" style={{ '--c': pal.blobs[0], '--dur': '19s' } as CSSProperties} />
          <span className="mg-blob -end-[14%] top-[10%] h-[24rem] w-[24rem] sm:h-[32rem] sm:w-[32rem]" style={{ '--c': pal.blobs[1], '--dur': '23s', '--dx': '-36px', '--dy': '28px' } as CSSProperties} />
          <span className="mg-blob bottom-[-20%] start-[30%] h-[22rem] w-[22rem] sm:h-[28rem] sm:w-[28rem]" style={{ '--c': pal.blobs[2], '--dur': '27s', '--dx': '24px', '--dy': '-30px' } as CSSProperties} />
        </>
      ) : null}
      {puffs.map((c, i) => (
        <Cloud key={i} style={{ left: `${c.left}%`, top: `${c.top}%`, width: c.width, '--c': pal.cloud, '--dur': `${c.dur}s`, '--delay': `${c.delay}s`, '--dx': `${c.dx}px` } as CSSProperties} />
      ))}
      <div className={parallax ? 'mg-parallax absolute inset-0' : 'absolute inset-0'} style={{ '--depth': 1 } as CSSProperties}>
        {sparkles.map((s, i) => (
          <Sparkle4
            key={i}
            className="mg-star"
            style={{ left: `${s.left}%`, top: `${s.top}%`, '--size': `${s.size}px`, '--dur': `${s.dur}s`, '--delay': `${s.delay}s`, '--c': s.c } as CSSProperties}
          />
        ))}
      </div>
      {season && variant === 'night' && !reduced ? <Snow count={14} /> : null}
    </div>
  );
}
