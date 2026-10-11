'use client';

import { useCallback, useEffect, useRef } from 'react';
import { SLEEP_SOUNDS, settingsFor } from '@/lib/dodo/sound/catalog';
import { startSleepSound, type SleepSession } from '@/lib/dodo/sound/engine';
import { isMuted } from '@/lib/sound';

/** The sleep sound bed under the story (Hyper Frequencies engine). */
export function useSleepSound() {
  const ctx = useRef<AudioContext | null>(null);
  const session = useRef<SleepSession | null>(null);
  const fadeTimer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    fadeTimer.current = null;
    session.current?.stop();
    session.current = null;
  }, []);

  /** Start (or switch) the bed; must be called from a tap the first time (autoplay rules). */
  const play = useCallback(
    (soundId: string, volume: number, minutes: number) => {
      stop();
      const sound = SLEEP_SOUNDS.find((s) => s.id === soundId);
      if (!sound || sound.id === 'silence' || isMuted()) return;
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx.current ??= new AC();
      void ctx.current.resume();
      session.current = startSleepSound(ctx.current, settingsFor(sound, minutes, 1), { musicBox: sound.musicBox, volume });
    },
    [stop]
  );

  const duck = useCallback((on: boolean) => session.current?.duck(on), []);
  const setVolume = useCallback((v: number) => session.current?.setVolume(v), []);

  /** Keep playing for `minutes`, then fade out over a minute. */
  const sleepIn = useCallback(
    (minutes: number) => {
      if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
      if (minutes <= 0) {
        session.current?.fadeOut(20);
        return;
      }
      fadeTimer.current = window.setTimeout(() => session.current?.fadeOut(60), minutes * 60_000);
    },
    []
  );

  useEffect(
    () => () => {
      stop();
      void ctx.current?.close();
      ctx.current = null;
    },
    [stop]
  );

  return { play, stop, duck, setVolume, sleepIn };
}
