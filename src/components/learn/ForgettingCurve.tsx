'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';

const W = 560;
const H = 220;
const PAD = { l: 36, r: 12, t: 14, b: 30 };
const DAYS = 30;
const x = (d: number) => PAD.l + (d / DAYS) * (W - PAD.l - PAD.r);
const y = (r: number) => PAD.t + (1 - r) * (H - PAD.t - PAD.b);

/** Memory without reviews: Ebbinghaus's curve. */
function without(): string {
  const pts: string[] = [];
  for (let d = 0; d <= DAYS; d += 0.25) pts.push(`${x(d)},${y(Math.exp(-d / 1.6) * 0.82 + 0.1)}`);
  return `M${pts.join(' L')}`;
}

/** With spaced reviews: each one lifts memory back up, and it fades slower every time. */
const REVIEWS = [1, 3, 7, 15];
function withReviews(): string {
  const pts: string[] = [];
  let since = 0;
  let strength = 1.6;
  let next = 0;
  for (let d = 0; d <= DAYS; d += 0.25) {
    if (next < REVIEWS.length && d >= REVIEWS[next]) {
      since = d;
      strength *= 2.6;
      next++;
      pts.push(`${x(d)},${y(1)}`);
    }
    pts.push(`${x(d)},${y(Math.exp(-(d - since) / strength) * 0.9 + 0.1)}`);
  }
  return `M${pts.join(' L')}`;
}

/**
 * The forgetting curve, drawn as the page scrolls in: on its own, memory
 * fades within days; reviewed at the right moments, it lasts. This is the
 * science the memory boxes are built on.
 */
export function ForgettingCurve() {
  const t = useTranslations('curve');
  return (
    <section className="rounded-3xl border border-border/50 glass-strong p-6">
      <h2 className="font-display text-xl font-bold text-text-body">{t('title')}</h2>
      <p className="mt-1 text-sm text-text-muted">{t('text')}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={t('title')}>
        {[0, 0.5, 1].map((r) => (
          <line key={r} x1={PAD.l} x2={W - PAD.r} y1={y(r)} y2={y(r)} stroke="currentColor" className="text-border" strokeDasharray="3 5" />
        ))}
        <text x={4} y={y(1) + 4} className="fill-current text-text-dim" style={{ fontSize: 11 }}>100%</text>
        <text x={8} y={y(0) + 4} className="fill-current text-text-dim" style={{ fontSize: 11 }}>0%</text>
        {[0, 7, 14, 21, 30].map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" className="fill-current text-text-dim" style={{ fontSize: 11 }}>
            {t('day', { n: d })}
          </text>
        ))}
        <motion.path
          d={without()}
          fill="none"
          stroke="#F2647B"
          strokeWidth={3}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: '-20%' }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
        />
        <motion.path
          d={withReviews()}
          fill="none"
          stroke="#22C55E"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: '-20%' }}
          transition={{ duration: 2.4, ease: 'easeInOut', delay: 0.4 }}
        />
        {REVIEWS.map((d, i) => (
          <motion.g key={d} initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.9 + i * 0.45 }} style={{ transformOrigin: `${x(d)}px ${y(1)}px` }}>
            <circle cx={x(d)} cy={y(1)} r={9} fill="#22C55E" />
            <text x={x(d)} y={y(1) + 4} textAnchor="middle" fill="white" style={{ fontSize: 10, fontWeight: 700 }}>
              ★
            </text>
          </motion.g>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
        <span className="inline-flex items-center gap-2 text-[#F2647B]">
          <span className="h-1 w-6 rounded-full bg-[#F2647B]" /> {t('without')}
        </span>
        <span className="inline-flex items-center gap-2 text-green">
          <span className="h-1 w-6 rounded-full bg-green" /> {t('with')}
        </span>
      </div>
    </section>
  );
}
