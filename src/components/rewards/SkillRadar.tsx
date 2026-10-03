'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { computeSkills, strengths, SKILLS } from '@/lib/skills';
import type { ProgressMap } from '@/lib/progress';
import { EASE_OUT } from '@/lib/motion';

const SIZE = 300;
const C = SIZE / 2;
const R = 108;

function point(i: number, value: number) {
  const a = (Math.PI * 2 * i) / SKILLS.length - Math.PI / 2;
  const r = (R * value) / 100;
  return [C + Math.cos(a) * r, C + Math.sin(a) * r] as const;
}

/**
 * The cognitive profile: six skills drawn as a radar that grows from the
 * centre, with the strongest skill and a suggestion for what to train next.
 */
export function SkillRadar({ progress }: { progress: ProgressMap }) {
  const t = useTranslations('skills');
  const skills = computeSkills(progress);
  const { best, next } = strengths(skills);
  const shape = SKILLS.map((s, i) => point(i, Math.max(skills[s.id], 4)).join(',')).join(' ');

  return (
    <section className="mt-10 rounded-3xl border border-border/50 glass-strong p-6 sm:p-7">
      <h2 className="font-display text-xl font-bold text-text-body">{t('title')}</h2>
      <p className="mt-1 text-sm text-text-muted">{t('subtitle')}</p>

      <div className="mt-4 grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[320px]" role="img" aria-label={t('title')}>
          <defs>
            <radialGradient id="radar-fill" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#7FC85C" stopOpacity="0.35" />
            </radialGradient>
          </defs>
          {/* Web */}
          {[25, 50, 75, 100].map((lvl) => (
            <polygon
              key={lvl}
              points={SKILLS.map((_, i) => point(i, lvl).join(',')).join(' ')}
              fill="none"
              stroke="currentColor"
              className="text-border"
              strokeWidth={lvl === 100 ? 1.5 : 1}
            />
          ))}
          {SKILLS.map((_, i) => {
            const [x, y] = point(i, 100);
            return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="currentColor" className="text-border" />;
          })}
          {/* The child's shape, growing from the centre */}
          <motion.polygon
            points={shape}
            fill="url(#radar-fill)"
            stroke="#22C55E"
            strokeWidth={2.5}
            strokeLinejoin="round"
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', duration: 0.9, bounce: 0.3 }}
            style={{ transformOrigin: `${C}px ${C}px` }}
          />
          {SKILLS.map((s, i) => {
            const [x, y] = point(i, Math.max(skills[s.id], 4));
            return (
              <motion.circle
                key={s.id}
                cx={x}
                cy={y}
                r={5}
                fill={s.color}
                stroke="white"
                strokeWidth={2}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + i * 0.06, type: 'spring', bounce: 0.5 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
            );
          })}
          {SKILLS.map((s, i) => {
            const [x, y] = point(i, 128);
            return (
              <text
                key={s.id}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-current text-text-muted"
                style={{ fontSize: 11, fontWeight: 700 }}
              >
                {t(`names.${s.id}`)}
              </text>
            );
          })}
        </svg>

        <div>
          <ul className="space-y-2.5">
            {SKILLS.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-bold text-text-body">{t(`names.${s.id}`)}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border/40">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: s.color }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${skills[s.id]}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 0.6, ease: EASE_OUT }}
                  />
                </div>
                <span className="w-9 text-end text-sm font-bold tabular-nums text-text-muted">{skills[s.id]}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <p className="rounded-2xl bg-green/10 px-4 py-3 text-sm text-text-body">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-green">{t('strength')}</span>
              {t(`names.${best}`)}
            </p>
            <p className="rounded-2xl bg-apricot/15 px-4 py-3 text-sm text-text-body">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#B7862C]">{t('next')}</span>
              {t(`tips.${next}`)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
