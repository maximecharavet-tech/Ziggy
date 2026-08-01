'use client';

import { useCallback, useEffect, useState } from 'react';
import { playSound, isMuted, setMuted, MUTE_EVENT, type SoundName } from '@/lib/sound';

export function useSound() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
    const onChange = (e: Event) => setMutedState((e as CustomEvent<boolean>).detail);
    window.addEventListener(MUTE_EVENT, onChange);
    return () => window.removeEventListener(MUTE_EVENT, onChange);
  }, []);

  const play = useCallback((name: SoundName) => playSound(name), []);
  const toggleMute = useCallback(() => setMuted(!isMuted()), []);

  return { play, muted, toggleMute };
}
