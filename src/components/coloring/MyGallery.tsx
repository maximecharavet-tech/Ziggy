'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Download, Printer, Trash2 } from 'lucide-react';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { tr } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { artStore } from '@/coloring/art-db';
import { pageById } from '@/coloring/pages';
import { downloadCanvas, fileName, renderArtwork } from '@/coloring/raster';
import type { Artwork, ArtworkMeta } from '@/coloring/storage';
import { T } from '@/coloring/text';
import { printDrawing } from './PrintDialog';
import { TiltCard } from './TiltCard';

/** The child's saved drawings, on this device only. */
export function MyGallery({ locale, onOpen, onCount }: { locale: string; onOpen: (art: Artwork) => void; onCount?: (n: number) => void }) {
  const [items, setItems] = useState<ArtworkMeta[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const list = await artStore().list();
      setItems(list);
      onCount?.(list.length);
    } catch {
      setItems([]);
    }
  }, [onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(null), 3000);
    return () => window.clearTimeout(t);
  }, [confirm]);

  const withArt = async (id: string, f: (a: Artwork) => Promise<void> | void) => {
    const a = await artStore().get(id);
    if (a) await f(a);
  };

  const remove = async (id: string) => {
    if (confirm !== id) {
      setConfirm(id);
      playSound('tap');
      return;
    }
    setConfirm(null);
    await artStore().remove(id);
    playSound('pop');
    void load();
  };

  if (items === null) return <div className="h-40" aria-busy="true" />;

  if (!items.length)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-[2rem] bg-white/80 p-8 text-center shadow-sm ring-1 ring-black/5 dark:bg-white/5">
        <ZiggyAvatar size={88} />
        <p className="font-display text-xl font-semibold text-text-body">{tr(T.galleryEmpty, locale)}</p>
      </div>
    );

  const small = 'grid h-14 w-14 place-items-center rounded-full bg-white/90 text-[#5B3FA8] shadow-sm ring-1 ring-black/5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky';

  return (
    <div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        <AnimatePresence>
          {items.map((it, i) => {
            const page = pageById(it.pageId);
            if (!page) return null;
            const title = tr(page.title, locale);
            return (
              <motion.li key={it.id} layout={!reduce} exit={{ opacity: 0, scale: 0.8 }} className="list-none">
                <TiltCard delay={Math.min(i, 10) * 0.04}>
                  <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_18px_40px_-24px_rgba(76,52,160,0.6)] ring-1 ring-black/5 dark:bg-[#17142f] dark:ring-white/10">
                    <button
                      type="button"
                      onClick={() => void withArt(it.id, (a) => onOpen(a))}
                      aria-label={`${tr(T.continue, locale)} : ${title}`}
                      className="block w-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky"
                    >
                      <span className="block aspect-square bg-white p-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.thumb} alt="" className="h-full w-full rounded-2xl object-contain" />
                      </span>
                      <span className="block px-3 pt-1 text-start font-display text-base font-semibold text-text-body">
                        <span aria-hidden="true">{page.emoji} </span>
                        {title}
                      </span>
                      <span className="block px-3 text-start text-xs text-text-muted">{new Date(it.updatedAt).toLocaleDateString(locale)}</span>
                    </button>
                    <div className="flex items-center justify-between gap-1 p-2.5">
                      <button
                        type="button"
                        className={small}
                        aria-label={`${tr(T.download, locale)} : ${title}`}
                        onClick={() => void withArt(it.id, async (a) => downloadCanvas(await renderArtwork(page, a.drawing, 1600), fileName(page.id)))}
                      >
                        <Download size={20} aria-hidden="true" />
                      </button>
                      <button type="button" className={small} aria-label={`${tr(T.print, locale)} : ${title}`} onClick={() => void withArt(it.id, (a) => printDrawing(page, a.drawing, locale))}>
                        <Printer size={20} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`${small} ${confirm === it.id ? '!w-auto !bg-[#FFE4E6] px-3 !text-[#BE123C] ring-2 ring-[#FB7185]' : ''}`}
                        aria-label={confirm === it.id ? tr(T.deleteSure, locale) : `${tr(T.delete, locale)} : ${title}`}
                        onClick={() => void remove(it.id)}
                      >
                        <span className="flex items-center gap-1 font-display text-sm font-bold">
                          <Trash2 size={20} aria-hidden="true" />
                          {confirm === it.id && tr(T.deleteSure, locale)}
                        </span>
                      </button>
                    </div>
                  </div>
                </TiltCard>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
