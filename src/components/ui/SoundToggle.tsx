'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { isMuted, isSoftSounds, MUTE_EVENT, playSound, setMuted, setSoftSounds, SOFT_EVENT } from '@/lib/sound';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';

type Level = 'on' | 'soft' | 'off';

const NEXT: Record<Level, Level> = { on: 'soft', soft: 'off', off: 'on' };

/** What the sound is now (tooltip and the announcement after a tap). */
const STATE: Record<Level, L> = {
  on: { fr: 'Sons normaux', en: 'Normal sounds' },
  soft: { fr: 'Sons doux', en: 'Soft sounds' },
  off: { fr: 'Son coupé', en: 'Sound off' },
};

const SOFT_ACTION: L = { fr: 'Passer aux sons doux', en: 'Switch to soft sounds' };

function current(): Level {
  return isMuted() ? 'off' : isSoftSounds() ? 'soft' : 'on';
}

/**
 * The sound button in the navigation. One tap cycles normal → soft → off:
 * "sons doux" keeps the funny sounds but quieter and rounder (remembered on
 * this device). Every change is heard as well as seen: the button plays the
 * little hello at the new level, so a child who can't read knows what it did.
 */
export function SoundToggle() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [level, setLevel] = useState<Level>('on');
  const [said, setSaid] = useState('');

  useEffect(() => {
    const sync = () => setLevel(current());
    sync();
    window.addEventListener(MUTE_EVENT, sync);
    window.addEventListener(SOFT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(MUTE_EVENT, sync);
      window.removeEventListener(SOFT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const next = NEXT[level];
  const action = next === 'soft' ? tr(SOFT_ACTION, locale) : next === 'off' ? t('sound_off') : t('sound_on');
  const Icon = level === 'off' ? VolumeX : level === 'soft' ? Volume1 : Volume2;

  const cycle = () => {
    if (next === 'off') {
      setMuted(true);
    } else {
      setSoftSounds(next === 'soft');
      setMuted(false);
      // Hear the new level right away.
      playSound('pop', { variation: false });
    }
    setLevel(next);
    setSaid(tr(STATE[next], locale));
  };

  return (
    <>
      <button
        type="button"
        onClick={cycle}
        className="press relative w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:text-green hover:bg-green/10 transition-colors"
        aria-label={action}
        title={`${tr(STATE[level], locale)} · ${action}`}
        data-sound-level={level}
      >
        <motion.span
          key={level}
          initial={reduced ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex"
        >
          <Icon size={18} />
        </motion.span>
        {level === 'soft' && <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky" />}
      </button>
      <span className="sr-only" aria-live="polite">
        {said}
      </span>
    </>
  );
}
