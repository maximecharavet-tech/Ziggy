'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import { CHALLENGES, DISCOVERIES, type Discovery } from '@/games2d/sandbox/content';
import { tr, type L } from '@/lib/i18n-text';
import type { SandboxSave } from './storage';

export const NOTEBOOK_TEXT = {
  title: { fr: 'Mon carnet de découvertes', en: 'My discovery notebook' },
  short: { fr: 'Carnet', en: 'Notebook' },
  challenges: { fr: 'Petits défis', en: 'Little challenges' },
  discoveries: { fr: 'Découvertes', en: 'Discoveries' },
  locked: { fr: 'À découvrir', en: 'To discover' },
  done: { fr: 'Réussi !', en: 'Done!' },
  close: { fr: 'Fermer le carnet', en: 'Close the notebook' },
} satisfies Record<string, L>;

/** The illustrated equation: 🌰 + 💧 → 🌱. */
export function Equation({ d, size = 'md', hidden = false }: { d: Discovery; size?: 'md' | 'lg'; hidden?: boolean }) {
  const tile = size === 'lg' ? 'h-14 w-14 text-3xl sm:h-16 sm:w-16 sm:text-4xl' : 'h-9 w-9 text-xl';
  const sign = size === 'lg' ? 'text-2xl' : 'text-sm';
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {d.inputs.map((e, k) => (
        <span key={k} className="contents">
          {k > 0 ? <span className={`${sign} font-bold opacity-70`}>+</span> : null}
          <span className={`grid place-items-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-black/5 ${tile}`}>{hidden && k > 0 ? '❔' : e}</span>
        </span>
      ))}
      <span className={`${sign} font-bold opacity-70`}>→</span>
      <span className={`grid place-items-center rounded-2xl shadow-md ring-2 ring-white/70 ${tile}`} style={{ backgroundColor: hidden ? '#e5e7eb' : `${d.color}33` }}>
        {hidden ? '❔' : d.output}
      </span>
    </div>
  );
}

function DiscoveryCard({ d, found, locale, index }: { d: Discovery; found: boolean; locale: string; index: number }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className={`relative rounded-2xl p-3 ${found ? 'bg-white text-[#1f1b3a] shadow-md' : 'border-2 border-dashed border-white/25 bg-white/5 text-white/80'}`}
      style={found ? { boxShadow: `0 8px 24px -12px ${d.color}aa, inset 0 0 0 2px ${d.color}40` } : undefined}
    >
      <Equation d={d} hidden={!found} />
      {found ? (
        <>
          <div className="mt-2 flex items-start gap-2">
            <h4 className="flex-1 font-display text-base font-bold leading-tight">{tr(d.title, locale)}</h4>
            <SayButton size="sm" texts={[tr(d.title, locale), tr(d.science, locale)]} locale={locale} />
          </div>
          <p className="mt-1 text-sm leading-snug text-[#4b4669]">{tr(d.science, locale)}</p>
        </>
      ) : (
        <p className="mt-2 text-center text-sm font-semibold italic">{tr(d.hint, locale)}</p>
      )}
    </motion.li>
  );
}

/** Challenges + discoveries. Used as the side panel (large screens) and inside the drawer (phones). */
export const Notebook = forwardRef<HTMLDivElement, { save: SandboxSave; locale: string; onClose?: () => void; className?: string }>(function Notebook(
  { save, locale, onClose, className = '' },
  ref
) {
  const found = DISCOVERIES.filter((d) => save.discoveries[d.id]).length;
  return (
    <div ref={ref} className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <span className="text-3xl" aria-hidden="true">
          📒
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-tight">{tr(NOTEBOOK_TEXT.title, locale)}</h2>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={DISCOVERIES.length} aria-valuenow={found} aria-label={tr(NOTEBOOK_TEXT.discoveries, locale)}>
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#ffd447] via-[#ff7eb6] to-[#b48cff]" initial={false} animate={{ width: `${(found / DISCOVERIES.length) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
            </div>
            <span className="text-sm font-bold tabular-nums text-white/80">
              {found}/{DISCOVERIES.length}
            </span>
          </div>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label={tr(NOTEBOOK_TEXT.close, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-lg ring-1 ring-white/15 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            ✕
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 [scrollbar-width:thin]">
        <h3 className="mb-2 mt-1 text-xs font-bold uppercase tracking-[0.14em] text-white/60">{tr(NOTEBOOK_TEXT.challenges, locale)}</h3>
        <ul className="space-y-2">
          {CHALLENGES.map((c) => {
            const done = Boolean(save.challenges[c.id]);
            const n = Math.min(c.target, save.totals[c.reaction] ?? 0);
            return (
              <li key={c.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 transition ${done ? 'bg-[#3ccf91]/20 ring-[#3ccf91]/50' : 'bg-white/[0.07] ring-white/10'}`}>
                <span className="text-2xl" aria-hidden="true">
                  {c.emoji}
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold leading-tight">
                  {tr(c.title, locale)}
                  {c.target > 1 && !done ? <span className="ml-1.5 font-semibold tabular-nums text-white/60">{`${n}/${c.target}`}</span> : null}
                </span>
                <motion.span
                  initial={false}
                  animate={done ? { scale: [1, 1.35, 1], rotate: [0, -10, 0] } : { scale: 1 }}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ${done ? 'bg-[#3ccf91] text-white shadow-[0_0_16px_rgba(60,207,145,0.7)]' : 'border-2 border-white/25'}`}
                  aria-label={done ? tr(NOTEBOOK_TEXT.done, locale) : undefined}
                >
                  {done ? '✓' : ''}
                </motion.span>
              </li>
            );
          })}
        </ul>
        <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-[0.14em] text-white/60">{tr(NOTEBOOK_TEXT.discoveries, locale)}</h3>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
          {DISCOVERIES.map((d, k) => (
            <DiscoveryCard key={d.id} d={d} found={Boolean(save.discoveries[d.id])} locale={locale} index={k} />
          ))}
        </ul>
      </div>
    </div>
  );
});
