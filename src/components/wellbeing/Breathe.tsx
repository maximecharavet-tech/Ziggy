'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';

const PHASES = [
  { key: 'in', ms: 4000, scale: 1.45 },
  { key: 'hold', ms: 2000, scale: 1.45 },
  { key: 'out', ms: 5000, scale: 1 },
] as const;
export const BREATHS = 5;

/**
 * Breathe with Ziggy: a slow inhale, a little hold, a longer exhale, five
 * times. A longer exhale is what calms — about a minute in all.
 */
export function Breathe({ onDone }: { onDone?: () => void }) {
  const t = useTranslations('breathe');
  const [step, setStep] = useState(0); // phase index across all breaths
  const breath = Math.floor(step / PHASES.length);
  const phase = PHASES[step % PHASES.length];
  const finished = breath >= BREATHS;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (finished) {
      done.current?.();
      return;
    }
    const id = window.setTimeout(() => setStep((s) => s + 1), phase.ms);
    return () => window.clearTimeout(id);
  }, [step, finished, phase.ms]);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex h-64 w-64 items-center justify-center">
        <motion.span
          className="absolute h-40 w-40 rounded-full bg-gradient-to-br from-sky/40 to-leaf/40 blur-md"
          animate={{ scale: finished ? 1 : phase.scale }}
          transition={{ duration: phase.ms / 1000, ease: 'easeInOut' }}
          aria-hidden="true"
        />
        <motion.span
          className="absolute h-40 w-40 rounded-full border-4 border-white/70 dark:border-white/20"
          animate={{ scale: finished ? 1 : phase.scale }}
          transition={{ duration: phase.ms / 1000, ease: 'easeInOut' }}
          aria-hidden="true"
        />
        <ZiggyAvatar size={96} />
      </div>
      <p className="mt-2 font-display text-3xl font-bold text-text-body" aria-live="polite">
        {finished ? t('done') : t(phase.key)}
      </p>
      <div className="mt-4 flex gap-2" aria-label={`${Math.min(breath, BREATHS)}/${BREATHS}`}>
        {Array.from({ length: BREATHS }, (_, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full transition-colors ${i < breath ? 'bg-green' : 'bg-border'}`} />
        ))}
      </div>
    </div>
  );
}
