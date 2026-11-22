'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { createPressTimer, LONG_PRESS_MS, toggleMute, toggleSoft } from '@/lib/sound-controls';
import { useSoundState } from '@/lib/use-sound-state';
import { tr } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SoftSoundsSwitch } from './SoftSoundsSwitch';
import { SOUND_TEXT as T } from './sound-text';

/**
 * The sound button in the navigation.
 * - One tap mutes / unmutes, at once.
 * - A long press (≥ 500 ms) switches "sons doux": the funny sounds, quieter and
 *   rounder (remembered on this device). A fill shows the press building up.
 * - The same setting is a labelled switch too: right after this button for the
 *   keyboard and screen readers (`softSwitch`), and in the mobile menu.
 * Every change is heard as well as seen: the little hello plays at the new
 * level, and the change is announced to screen readers.
 */
export function SoundToggle({ softSwitch = true }: { softSwitch?: boolean }) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { muted, soft } = useSoundState();
  const [said, setSaid] = useState('');
  const [pressing, setPressing] = useState(false);

  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);
  const [press] = useState(() =>
    createPressTimer(() => {
      setPressing(false);
      setSaid(tr(toggleSoft() ? T.soft : T.normal, localeRef.current));
    })
  );
  useEffect(() => () => press.cancel(), [press]);

  const level = muted ? 'off' : soft ? 'soft' : 'on';
  const Icon = level === 'off' ? VolumeX : level === 'soft' ? Volume1 : Volume2;
  const action = muted ? t('sound_on') : t('sound_off');
  const state = tr(muted ? T.muted : soft ? T.soft : T.normal, locale);
  const hint = tr(soft ? T.longToNormal : T.longToSoft, locale);

  const stop = () => {
    press.cancel();
    setPressing(false);
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          if (press.takeLong()) return; // that was a long press: soft sounds, not mute
          setSaid(tr(toggleMute() ? T.muted : T.unmuted, locale));
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          press.start();
          setPressing(true);
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        // A long press on a phone must not open the system menu.
        onContextMenu={(e) => e.preventDefault()}
        className="press relative w-9 h-9 flex items-center justify-center overflow-hidden rounded-xl text-text-muted hover:text-green hover:bg-green/10 transition-colors select-none touch-manipulation [-webkit-touch-callout:none]"
        aria-label={action}
        title={`${state} · ${action} · ${hint}`}
        data-sound-level={level}
      >
        {!reduced && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 rounded-xl bg-sky/25 transition-transform ease-linear ${pressing ? 'scale-100' : 'scale-0 duration-150'}`}
            style={pressing ? { transitionDuration: `${LONG_PRESS_MS}ms` } : undefined}
          />
        )}
        <motion.span
          key={level}
          initial={reduced ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="relative flex"
        >
          <Icon size={18} />
        </motion.span>
        {level === 'soft' && <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky" />}
      </button>
      {softSwitch && <SoftSoundsSwitch variant="reveal" />}
      <span className="sr-only" aria-live="polite">
        {said}
      </span>
    </span>
  );
}
