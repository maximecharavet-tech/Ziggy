'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DodoStory } from '@/data/dodo/types';
import { tr, type L } from '@/lib/i18n-text';
import { useGrownUpGate } from '@/components/app/GrownUpGate';
import { isStoryKept, requestKeep, storyOfflineUrls } from '@/lib/dodo/offline';
import type { DodoVoiceTiming } from '@/lib/dodo/voice';

const T = {
  title: { fr: 'Garder pour ce soir', en: 'Keep for tonight' },
  hint: { fr: 'Télécharge l’histoire sur cet appareil pour l’écouter sans internet.', en: 'Saves the story on this device so it plays without internet.' },
  button: { fr: 'Garder pour ce soir', en: 'Keep for tonight' },
  busy: { fr: 'Je prépare l’histoire…', en: 'Getting the story ready…' },
  kept: { fr: 'Disponible hors-ligne', en: 'Available offline' },
  retry: { fr: 'Un fichier n’a pas pu être gardé. Réessayer', en: 'A file could not be saved. Try again' },
  unsupported: { fr: 'Cet appareil ne peut pas garder l’histoire hors-ligne.', en: 'This device cannot keep the story offline.' },
} satisfies Record<string, L>;

/** Grown-up button (behind the grown-up gate in the app) that keeps the story for offline listening. */
export function KeepForTonight({ story, locale, timing, images }: { story: DodoStory; locale: string; timing: DodoVoiceTiming | null; images: string[] }) {
  const gate = useGrownUpGate();
  const urls = useMemo(() => storyOfflineUrls(story, locale, { timing, images }), [story, locale, timing, images]);
  const [state, setState] = useState<'idle' | 'busy' | 'kept' | 'failed' | 'unsupported'>('idle');

  useEffect(() => {
    let alive = true;
    if (typeof navigator !== 'undefined' && !('serviceWorker' in navigator)) setState('unsupported');
    else void isStoryKept(urls).then((kept) => alive && kept && setState('kept'));
    return () => {
      alive = false;
    };
  }, [urls]);

  const keep = async () => {
    if (!(await gate.ask('parents'))) return;
    setState('busy');
    const report = await requestKeep(story.id, urls);
    setState(report && report.failed === 0 && report.ok > 0 ? 'kept' : 'failed');
  };

  return (
    <div>
      {state === 'kept' ? (
        <p role="status" className="rounded-2xl bg-emerald-300/15 px-4 py-3 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-200/25">
          ✓ {tr(T.kept, locale)}
        </p>
      ) : state === 'unsupported' ? (
        <p className="text-sm text-white/70">{tr(T.unsupported, locale)}</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-white/70">{tr(T.hint, locale)}</p>
          <button
            type="button"
            onClick={keep}
            disabled={state === 'busy'}
            aria-busy={state === 'busy'}
            className="min-h-12 w-full rounded-2xl bg-amber-200 px-4 py-2 font-display text-base font-bold text-[#24164a] shadow transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:opacity-60"
          >
            🌙 {tr(state === 'busy' ? T.busy : state === 'failed' ? T.retry : T.button, locale)}
          </button>
        </>
      )}
    </div>
  );
}

export const KEEP_TITLE = T.title;
