'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Download, PartyPopper, X } from 'lucide-react';
import { SayButton, useSay } from '@/components/arcade/read-aloud';
import { tr } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { downloadCanvas, fileName, renderArtwork } from '@/coloring/raster';
import { T } from '@/coloring/text';
import type { ColoringPage, Drawing } from '@/coloring/types';
import type { PopupScene } from '@/coloring/three/popup-scene';

/**
 * "Mon dessin prend vie !": the finished drawing on a 3D pop-up card.
 * three.js is only downloaded when this view opens.
 */
export function ComeAlive({ open, onClose, page, drawing, locale }: { open: boolean; onClose: () => void; page: ColoringPage; drawing: Drawing; locale: string }) {
  const reduce = useReducedMotion() ?? false;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PopupScene | null>(null);
  const artRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const say = useSay();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setState('loading');
    playSound('reward');
    say('alive', tr(T.aliveSay, locale));
    void (async () => {
      try {
        const art = await renderArtwork(page, drawing, 1024);
        artRef.current = art;
        if (!alive) return;
        setFallbackSrc(art.toDataURL('image/png'));
        const { createPopupScene } = await import('@/coloring/three/popup-scene');
        if (!alive || !canvasRef.current) return;
        sceneRef.current = createPopupScene(canvasRef.current, art, { reduced: reduce, backLabel: tr(T.appName, locale) });
        setState('ready');
      } catch {
        if (alive) setState('fallback');
      }
    })();
    return () => {
      alive = false;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={tr(T.aliveTitle, locale)}
          className="fixed inset-0 z-[95] flex flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#FFF6E0_0%,#FFE1F0_38%,#DCD3FF_72%,#B9E6FF_100%)] text-[#3B2A7A]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative z-10 flex items-center gap-3 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-6">
            <button
              type="button"
              onClick={onClose}
              aria-label={tr(T.close, locale)}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-black/5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky"
            >
              <X size={26} aria-hidden="true" />
            </button>
            <h2 className="flex-1 text-center font-display text-2xl font-bold sm:text-4xl">✨ {tr(T.aliveTitle, locale)}</h2>
            <SayButton texts={[tr(T.aliveSay, locale)]} locale={locale} size="lg" />
          </div>

          <div className="relative min-h-0 flex-1">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing" aria-label={tr(T.aliveDrag, locale)} />
            {state === 'loading' && (
              <div className="absolute inset-0 grid place-items-center">
                <motion.div animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }} className="text-6xl" aria-hidden="true">
                  ✨
                </motion.div>
                <p className="sr-only">{tr(T.loading3d, locale)}</p>
              </div>
            )}
            {state === 'fallback' && fallbackSrc && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <motion.img
                  src={fallbackSrc}
                  alt={tr(page.title, locale)}
                  className="max-h-[60vh] max-w-full rounded-3xl border-[10px] border-white shadow-2xl"
                  initial={{ rotateX: 70, scale: 0.6, opacity: 0 }}
                  animate={{ rotateX: 0, scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', duration: 0.9, bounce: 0.45 }}
                />
                <p className="max-w-md text-center font-display text-lg">{tr(T.no3d, locale)}</p>
              </div>
            )}
            {state === 'ready' && (
              <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-display text-base font-semibold text-[#5B3FA8]/80" aria-hidden="true">
                👆 {tr(T.aliveDrag, locale)}
              </p>
            )}
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
            <motion.button
              type="button"
              whileTap={reduce ? undefined : { scale: 0.92 }}
              onClick={() => {
                playSound('star');
                sceneRef.current?.burst();
              }}
              className="flex min-h-14 items-center gap-2 rounded-full bg-gradient-to-r from-[#FF7AB8] via-[#B07CFF] to-[#5FB6EA] px-7 font-display text-lg font-bold text-white shadow-[0_10px_24px_-10px_rgba(176,124,255,0.9)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky"
            >
              <PartyPopper size={22} aria-hidden="true" /> {tr(T.confetti, locale)}
            </motion.button>
            <button
              type="button"
              onClick={() => artRef.current && void downloadCanvas(artRef.current, fileName(page.id))}
              className="flex min-h-14 items-center gap-2 rounded-full bg-white/85 px-6 font-display text-lg font-semibold shadow-sm ring-1 ring-black/5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky"
            >
              <Download size={22} aria-hidden="true" /> {tr(T.download, locale)}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
