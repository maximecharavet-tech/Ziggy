'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { WORLD_INFO } from '@/games2d/sandbox/content';
import { tr, type L } from '@/lib/i18n-text';
import { ALBUM_SLOTS, deleteSnapshot, listSnapshots, type Snapshot } from './album';

const TEXT = {
  title: { fr: 'Mon album de mondes', en: 'My album of worlds' },
  save: { fr: 'Garder mon monde', en: 'Keep my world' },
  empty: { fr: 'Pas encore de monde gardé. Construis, puis touche « Garder mon monde ».', en: 'No world kept yet. Build something, then tap “Keep my world”.' },
  open: { fr: 'Rouvrir ce monde', en: 'Open this world again' },
  remove: { fr: 'Enlever de l’album', en: 'Remove from the album' },
  close: { fr: 'Fermer', en: 'Close' },
  device: { fr: 'L’album reste sur cet appareil.', en: 'The album stays on this device.' },
} satisfies Record<string, L>;

/** The worlds a child kept (IndexedDB, this device only), with their little pictures. */
export function AlbumPanel({ locale, onSave, onOpen, onClose, version }: { locale: string; onSave: () => void; onOpen: (s: Snapshot) => void; onClose: () => void; version: number }) {
  const [list, setList] = useState<Snapshot[] | null>(null);
  useEffect(() => {
    let alive = true;
    void listSnapshots().then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, [version]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <motion.div className="fixed inset-0 z-[68] flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}>
      <button type="button" aria-label={tr(TEXT.close, locale)} className="absolute inset-0 bg-[#0d0b2a]/70" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={tr(TEXT.title, locale)} className="relative max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-[#2a2366] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-white/15 sm:rounded-[30px]">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="flex-1 font-display text-xl font-bold">{tr(TEXT.title, locale)}</h2>
          <button type="button" onClick={onClose} aria-label={tr(TEXT.close, locale)} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-lg ring-1 ring-white/15 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            ✕
          </button>
        </div>
        <button type="button" onClick={onSave} data-album-save="" className="mb-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#3ccf91] text-base font-black text-white shadow-[0_5px_0_#24935f] focus-visible:outline focus-visible:outline-4 focus-visible:outline-white">
          <span aria-hidden="true">💾</span> {tr(TEXT.save, locale)}
        </button>
        {list && !list.length ? <p className="py-4 text-center text-sm text-white/75">{tr(TEXT.empty, locale)}</p> : null}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(list ?? []).map((s) => (
            <li key={s.id} className="relative overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15" data-snapshot={s.id}>
              <button type="button" onClick={() => onOpen(s)} aria-label={`${tr(TEXT.open, locale)} : ${tr(WORLD_INFO[s.world].name, locale)}`} className="block w-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL made on this device */}
                <img src={s.thumb} alt="" className="block aspect-[5/3] w-full object-cover" />
                <span className="flex items-center gap-1 px-2 py-1.5 text-sm font-bold">
                  <span aria-hidden="true">{WORLD_INFO[s.world].emoji}</span> {tr(WORLD_INFO[s.world].name, locale)}
                </span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteSnapshot(s.id);
                  setList((l) => (l ?? []).filter((x) => x.id !== s.id));
                }}
                aria-label={tr(TEXT.remove, locale)}
                className="absolute right-1.5 top-1.5 grid h-10 w-10 place-items-center rounded-full bg-[#2a2366]/80 text-sm ring-1 ring-white/30"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-xs text-white/60">
          {tr(TEXT.device, locale)} ({ALBUM_SLOTS} max)
        </p>
      </div>
    </motion.div>
  );
}
