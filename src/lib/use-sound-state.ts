'use client';

import { useEffect, useState } from 'react';
import { isMuted, isSoftSounds, MUTE_EVENT, SOFT_EVENT } from './sound';

/**
 * The sound settings, kept in step with every control on the page (and other
 * tabs). Starts as "on, normal" on the server and the first client render, then
 * reads the saved settings: no hydration mismatch.
 */
export function useSoundState(): { muted: boolean; soft: boolean } {
  const [state, setState] = useState({ muted: false, soft: false });
  useEffect(() => {
    const sync = () => setState({ muted: isMuted(), soft: isSoftSounds() });
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
  return state;
}
