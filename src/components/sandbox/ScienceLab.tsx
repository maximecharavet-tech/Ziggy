'use client';

import { motion } from 'motion/react';
import { SayButton } from '@/components/arcade/read-aloud';
import { GRAVITY_LEVELS, LAB_TEXT, TEMPERATURE_LEVELS, levelLabel, scienceLine, type Level } from '@/games2d/sandbox/science';
import { tr } from '@/lib/i18n-text';
import { fx, toy } from '@/components/create/fx/toy';

/**
 * The big kids' lab (10–12 only): gravity and temperature of the world, each
 * in five steps with big − / + buttons (64 px), the setting in words, and the
 * science of what changed, read aloud. It floats above the tools, so the
 * sandbox stays in view while the child experiments.
 */
export function ScienceLab({
  locale,
  gravity,
  temperature,
  reduceMotion,
  onGravity,
  onTemperature,
  onClose,
}: {
  locale: string;
  gravity: number;
  temperature: number;
  reduceMotion: boolean;
  onGravity: (k: number) => void;
  onTemperature: (k: number) => void;
  onClose: () => void;
}) {
  return (
    <motion.section
      aria-label={tr(LAB_TEXT.title, locale)}
      data-science-lab=""
      className="absolute inset-x-0 bottom-full z-20 mx-auto mb-2 w-[min(100%,560px)] rounded-[26px] bg-[#2a2366]/95 p-3 shadow-2xl ring-1 ring-white/20 backdrop-blur-sm sm:p-4"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden="true" className="text-2xl">
          🔬
        </span>
        <h2 className="min-w-0 flex-1 font-display text-base font-bold leading-tight sm:text-lg">{tr(LAB_TEXT.title, locale)}</h2>
        <SayButton size="sm" texts={[tr(LAB_TEXT.title, locale), tr(LAB_TEXT.intro, locale)]} locale={locale} className="!bg-white/10 !text-white !ring-white/20" />
        <button type="button" onClick={onClose} aria-label={tr(LAB_TEXT.close, locale)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 text-lg ring-1 ring-white/15 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" data-lab-close="">
          ✕
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <Stepper kind="gravity" levels={GRAVITY_LEVELS} k={gravity} locale={locale} onChange={onGravity} color="#7c6cf0" />
        <Stepper kind="temperature" levels={TEMPERATURE_LEVELS} k={temperature} locale={locale} onChange={onTemperature} color="#f08a4c" />
      </div>
    </motion.section>
  );
}

function Stepper({ kind, levels, k, locale, onChange, color }: { kind: 'gravity' | 'temperature'; levels: Level[]; k: number; locale: string; onChange: (k: number) => void; color: string }) {
  const label = tr(levelLabel(kind, k), locale);
  const btn = `${fx.toy} grid h-16 w-16 shrink-0 place-items-center rounded-full text-3xl font-black disabled:opacity-40`;
  return (
    <div className="rounded-2xl bg-white/[0.07] p-2 ring-1 ring-white/10" role="group" aria-label={tr(kind === 'gravity' ? LAB_TEXT.gravity : LAB_TEXT.temperature, locale)} data-lab={kind}>
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <p className="min-w-0 flex-1 text-sm font-black leading-tight" aria-live="polite" data-lab-value={levels[k].value}>
          {label}
        </p>
        <SayButton size="sm" texts={[tr(scienceLine(kind, k), locale)]} locale={locale} className="!bg-white/10 !text-white !ring-white/20" />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} style={toy(color, { depth: 5 })} disabled={k <= 0} onClick={() => onChange(k - 1)} aria-label={`${tr(kind === 'gravity' ? LAB_TEXT.gravity : LAB_TEXT.temperature, locale)} : ${tr(LAB_TEXT.less, locale)}`} data-lab-less="">
          <span aria-hidden="true">−</span>
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1" aria-hidden="true">
          {levels.map((lv, i) => (
            <span key={lv.value} className={`grid place-items-center rounded-xl transition-transform ${i === k ? 'h-11 w-11 bg-white text-2xl shadow-[0_3px_0_#b9b2e6]' : 'h-7 w-7 bg-white/10 text-sm opacity-70'}`}>
              {lv.emoji}
            </span>
          ))}
        </div>
        <button type="button" className={btn} style={toy(color, { depth: 5 })} disabled={k >= levels.length - 1} onClick={() => onChange(k + 1)} aria-label={`${tr(kind === 'gravity' ? LAB_TEXT.gravity : LAB_TEXT.temperature, locale)} : ${tr(LAB_TEXT.more, locale)}`} data-lab-more="">
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}
