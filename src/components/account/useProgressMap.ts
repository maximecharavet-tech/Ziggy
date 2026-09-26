'use client';

import { useEffect, useState } from 'react';
import { getProgress, fetchAccountProgress, PROGRESS_EVENT, type ProgressMap } from '@/lib/progress';
import { useProfile } from './ProfileProvider';

/**
 * The child's trophies: from their account when signed in, from this device
 * otherwise. Starts empty so the server render and first client render agree.
 */
export function useProgressMap(): { progress: ProgressMap; loading: boolean } {
  const { user, ready } = useProfile();
  const [progress, setProgress] = useState<ProgressMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    let alive = true;

    const read = async () => {
      if (user) {
        const remote = await fetchAccountProgress();
        if (alive) setProgress(remote ?? {});
      } else if (alive) {
        setProgress(getProgress());
      }
      if (alive) setLoading(false);
    };

    void read();
    const onChange = () => void read();
    window.addEventListener(PROGRESS_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(PROGRESS_EVENT, onChange);
    };
  }, [user, ready]);

  return { progress, loading };
}
