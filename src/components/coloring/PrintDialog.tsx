'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { tr } from '@/lib/i18n-text';
import { printSheet } from '@/coloring/print';
import { renderArtwork, svgDataUrl } from '@/coloring/raster';
import { lineArtSvg } from '@/coloring/svg';
import { T } from '@/coloring/text';
import type { ColoringPage, Drawing } from '@/coloring/types';
import { PageArt } from './PageArt';
import { Modal } from './ui';

/** Print the child's drawing, or the blank page for a new colouring session on paper. */
export async function printDrawing(page: ColoringPage, drawing: Drawing, locale: string) {
  const canvas = await renderArtwork(page, drawing, 1600);
  await printSheet({ src: canvas.toDataURL('image/png'), title: tr(page.title, locale), footer: tr(T.appName, locale) });
}

export async function printBlank(page: ColoringPage, locale: string) {
  await printSheet({ src: svgDataUrl(lineArtSvg(page, 1600, 1600)), title: tr(page.title, locale), footer: tr(T.appName, locale) });
}

export function PrintDialog({ open, onClose, page, drawing, thumb, locale }: { open: boolean; onClose: () => void; page: ColoringPage; drawing: Drawing; thumb?: string; locale: string }) {
  const [busy, setBusy] = useState(false);
  const go = async (what: 'mine' | 'blank') => {
    setBusy(true);
    try {
      if (what === 'mine') await printDrawing(page, drawing, locale);
      else await printBlank(page, locale);
    } finally {
      setBusy(false);
      onClose();
    }
  };
  const choice = (what: 'mine' | 'blank', title: string, art: React.ReactNode) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => void go(what)}
      className="group flex flex-col items-center gap-3 rounded-3xl bg-[#F6F2FF] p-4 text-center ring-1 ring-[#B07CFF]/25 transition hover:bg-[#EFE7FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky disabled:opacity-50"
    >
      <span className="block aspect-square w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition group-hover:scale-[1.02]">{art}</span>
      <span className="flex min-h-14 items-center gap-2 font-display text-lg font-semibold text-[#3B2A7A]">
        <Printer size={20} aria-hidden="true" /> {title}
      </span>
    </button>
  );
  return (
    <Modal open={open} onClose={onClose} label={tr(T.printTitle, locale)}>
      <div className="p-5 sm:p-7">
        <h2 className="text-center font-display text-2xl font-bold text-[#3B2A7A]">🖨️ {tr(T.printTitle, locale)}</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL */}
          {choice('mine', tr(T.printMine, locale), thumb ? <img src={thumb} alt="" className="h-full w-full object-contain" /> : <PageArt page={page} model className="h-full w-full" />)}
          {choice('blank', tr(T.printBlankShort, locale), <PageArt page={page} className="h-full w-full" />)}
        </div>
        <button type="button" onClick={onClose} className="mx-auto mt-5 flex min-h-14 items-center rounded-full px-6 font-display font-semibold text-[#6B5AA8] hover:bg-[#F6F2FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky">
          {tr(T.close, locale)}
        </button>
      </div>
    </Modal>
  );
}
