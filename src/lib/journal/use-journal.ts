'use client';

import { useEffect, useState } from 'react';
import { onJournalChange, readJournal } from './store';
import type { JournalEntry } from './types';

/**
 * The whole album, read after mounting (the server can't know what is on
 * this device), and again whenever something is added (here or in another tab).
 */
export function useJournal(): { entries: JournalEntry[]; ready: boolean } {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    let run = 0;
    const reload = () => {
      const mine = ++run;
      void readJournal().then((list) => {
        if (!alive || mine !== run) return;
        setEntries(list);
        setReady(true);
      });
    };
    reload();
    const off = onJournalChange(reload);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return { entries, ready };
}
