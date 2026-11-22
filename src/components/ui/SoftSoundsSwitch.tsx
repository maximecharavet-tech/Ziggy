'use client';

import { useLocale } from 'next-intl';
import { Volume1 } from 'lucide-react';
import { toggleSoft } from '@/lib/sound-controls';
import { useSoundState } from '@/lib/use-sound-state';
import { tr } from '@/lib/i18n-text';
import { SOUND_TEXT as T } from './sound-text';

/**
 * "Sons doux / soft sounds" as a labelled switch, the secondary sound control
 * (a tap on the sound button mutes; a long press on it does this too).
 * - `row`: always visible, in the mobile menu.
 * - `reveal`: right after the sound button, invisible until it gets keyboard
 *   focus (then it shows under the button), always there for screen readers.
 * Turning it on or off plays the little "pop" at the new level (not while muted).
 */
export function SoftSoundsSwitch({ variant = 'row' }: { variant?: 'row' | 'reveal' }) {
  const locale = useLocale();
  const { muted, soft } = useSoundState();

  const track = (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${soft ? 'bg-sky-ink' : 'bg-border'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform start-0.5 ${soft ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`}
      />
    </span>
  );

  if (variant === 'reveal') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={soft}
        onClick={() => toggleSoft()}
        data-soft-switch="reveal"
        className="pointer-events-none absolute end-0 top-full z-50 mt-2 inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-bg-card px-3 py-2 text-sm font-bold text-text-body opacity-0 shadow-lg focus-visible:pointer-events-auto focus-visible:opacity-100"
      >
        <Volume1 size={16} aria-hidden="true" />
        {tr(T.soft, locale)}
        {track}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={soft}
      onClick={() => toggleSoft()}
      data-soft-switch="row"
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-start text-base font-semibold text-text-muted transition-colors hover:bg-green/5 hover:text-text-body"
    >
      <span className="flex items-center gap-2.5">
        <Volume1 size={18} aria-hidden="true" />
        <span className="flex flex-col">
          <span>{tr(T.soft, locale)}</span>
          <span className="text-xs font-medium text-text-muted">{tr(muted ? T.mutedNote : T.softHint, locale)}</span>
        </span>
      </span>
      {track}
    </button>
  );
}
