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
 * Owner only: pre-generates every illustration (NVIDIA FLUX or Agnes) once,
 * in small batches, until done. Ziggy's voice is no longer made here: it is
 * recorded offline by the Rust voice engine (voice-engine/) and shipped as static files.
 */
/** Illustrations do not depend on the language; the API still asks for one. */
const locales = ['fr'];

export function DodoPrepare({ locale }: { locale: string }) {
  const fr = locale === 'fr';
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const stopFlag = useRef(false);
  // Six illustrations per story.
  const images = (status?.stories ?? 0) * 6;

  const refresh = useCallback(async () => {
    const r = await api<Status>(`dodo/prepare?locales=${locales.join(',')}`);
    if (r.ok) setStatus(r.data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (kinds: 'image'[]) => {
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
      <h2 className="font-display text-2xl font-bold">🛠️ {fr ? 'Préparer les illustrations (propriétaire)' : 'Prepare the illustrations (owner)'}</h2>
      <p className="mt-2 text-sm text-white/65">
        {fr
          ? 'Génère une seule fois chaque illustration, puis la garde pour tout le monde (aucune donnée d’enfant). À relancer seulement si une histoire change. La voix de Ziggy est enregistrée à part (fichiers statiques), sans IA ni API à l’écoute.'
          : 'Generates each illustration once, then keeps it for everyone (no child data). Run again only if a story changes. Ziggy’s voice is recorded separately (static files), with no AI or API when listening.'}
      </p>
      {status ? (
        <div className="mt-4 grid gap-2 text-sm">
          <p>
            {fr ? 'Illustrations prêtes' : 'Illustrations ready'} : {images - status.missing.image}/{images}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-amber-200 transition-all" style={{ width: `${Math.round(((images - status.missing.image) / Math.max(1, images)) * 100)}%` }} />
          </div>
          <p className="text-white/60">
            {fr ? 'Images' : 'Images'} : {status.providers.imageProvider ?? (fr ? 'aucune clé (NVIDIA_API_KEY ou AGNES_API_KEY)' : 'no key (NVIDIA_API_KEY or AGNES_API_KEY)')}
          </p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={running || !status?.providers.image} onClick={() => void run(['image'])} className="rounded-full bg-amber-200 px-4 py-2 text-sm font-bold text-[#2a1650] disabled:opacity-40">
          🎨 {fr ? 'Générer les illustrations' : 'Generate illustrations'}
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
