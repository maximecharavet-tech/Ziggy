'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/world/store';

type Status = {
  stories: number;
  planned: number;
  ready: number;
  missing: { image: number; audio: number };
  providers: { image: boolean; imageProvider: string | null; voice: boolean };
};

/**
 * Owner only: pre-generates every illustration (NVIDIA FLUX or Agnes) and
 * Ziggy's narration (Gemini TTS) once, in small batches, until done.
 */
export function DodoPrepare({ locale }: { locale: string }) {
  const fr = locale === 'fr';
  const [locales, setLocales] = useState<('fr' | 'en')[]>(['fr']);
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const stopFlag = useRef(false);

  const refresh = useCallback(async () => {
    const r = await api<Status>(`dodo/prepare?locales=${locales.join(',')}`);
    if (r.ok) setStatus(r.data);
  }, [locales]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (kinds: ('image' | 'audio')[]) => {
    setRunning(true);
    stopFlag.current = false;
    let failures = 0;
    for (;;) {
      if (stopFlag.current) break;
      const r = await api<{ done: { story: string; scene: number; kind: string; locale: string }[]; failed: { key: { story: string; scene: number; kind: string }; error: string }[]; remaining: number }>('dodo/prepare', {
        body: { locales, kinds, max: 1 },
      });
      if (!r.ok) {
        setLog((l) => [`⚠️ ${r.error}`, ...l].slice(0, 30));
        break;
      }
      setLog((l) => [...r.data.done.map((d) => `✓ ${d.story} · ${d.kind} ${d.scene}${d.locale !== '-' ? ` (${d.locale})` : ''}`), ...r.data.failed.map((f) => `⚠️ ${f.key.story} · ${f.key.kind} ${f.key.scene}: ${f.error}`), ...l].slice(0, 30));
      failures = r.data.done.length ? 0 : failures + 1;
      await refresh();
      if (r.data.remaining <= 0 || failures >= 3) break;
    }
    setRunning(false);
  };

  return (
    <section className="mt-14 rounded-3xl bg-white/5 p-6 ring-1 ring-amber-200/20">
      <h2 className="font-display text-2xl font-bold">🛠️ {fr ? 'Préparer les histoires (propriétaire)' : 'Prepare the stories (owner)'}</h2>
      <p className="mt-2 text-sm text-white/65">
        {fr
          ? 'Génère une seule fois chaque illustration et la voix de Ziggy pour chaque scène, puis les garde pour tout le monde (aucune donnée d’enfant). À relancer seulement si une histoire change.'
          : 'Generates each illustration and Ziggy’s voice for every scene once, then keeps them for everyone (no child data). Run again only if a story changes.'}
      </p>
      {status ? (
        <div className="mt-4 grid gap-2 text-sm">
          <p>
            {status.ready}/{status.planned} {fr ? 'éléments prêts' : 'assets ready'} · {fr ? 'illustrations manquantes' : 'missing images'} : {status.missing.image} · {fr ? 'voix manquantes' : 'missing voices'} : {status.missing.audio}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-amber-200 transition-all" style={{ width: `${Math.round((status.ready / Math.max(1, status.planned)) * 100)}%` }} />
          </div>
          <p className="text-white/60">
            {fr ? 'Images' : 'Images'} : {status.providers.imageProvider ?? (fr ? 'aucune clé (NVIDIA_API_KEY ou AGNES_API_KEY)' : 'no key (NVIDIA_API_KEY or AGNES_API_KEY)')} · {fr ? 'Voix' : 'Voice'} :{' '}
            {status.providers.voice ? 'Gemini TTS' : fr ? 'aucune clé (GEMINI_API_KEY)' : 'no key (GEMINI_API_KEY)'}
          </p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {(['fr', 'en'] as const).map((l) => (
          <label key={l} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={locales.includes(l)} disabled={running} onChange={(e) => setLocales((x) => (e.target.checked ? [...new Set([...x, l])] : x.filter((y) => y !== l).length ? x.filter((y) => y !== l) : x))} />
            {fr ? 'Voix' : 'Voice'} {l.toUpperCase()}
          </label>
        ))}
        <button type="button" disabled={running || !status?.providers.image} onClick={() => void run(['image'])} className="rounded-full bg-amber-200 px-4 py-2 text-sm font-bold text-[#2a1650] disabled:opacity-40">
          🎨 {fr ? 'Générer les illustrations' : 'Generate illustrations'}
        </button>
        <button type="button" disabled={running || !status?.providers.voice} onClick={() => void run(['audio'])} className="rounded-full bg-pink-200 px-4 py-2 text-sm font-bold text-[#2a1650] disabled:opacity-40">
          🎙️ {fr ? 'Enregistrer la voix de Ziggy' : 'Record Ziggy’s voice'}
        </button>
        {running ? (
          <button type="button" onClick={() => (stopFlag.current = true)} className="rounded-full bg-white/10 px-4 py-2 text-sm">
            ⏹ {fr ? 'Arrêter' : 'Stop'}
          </button>
        ) : null}
      </div>
      {log.length ? (
        <ul className="mt-4 max-h-48 overflow-y-auto rounded-2xl bg-black/30 p-3 font-mono text-xs text-white/70">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
