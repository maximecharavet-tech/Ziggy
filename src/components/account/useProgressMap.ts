'use client';

import { useEffect, useState } from 'react';
import { getProgress, PROGRESS_EVENT, type ProgressMap } from '@/lib/progress';

/**
 * Reads game progress reactively. Starts empty so server and client agree on
 * the first render, then fills in once mounted.
 */
export function useProgressMap(): ProgressMap {
  const [progress, setProgress] = useState<ProgressMap>({});

  useEffect(() => {
    const read = () => setProgress(getProgress());
    read();
    window.addEventListener(PROGRESS_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, []);

  return progress;
}
