'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { WORLDS, WORLD_INFO, type WorldId } from '@/games2d/sandbox/content';
import { tr, type L } from '@/lib/i18n-text';

const TEXT = {
  title: { fr: 'Choisis un monde', en: 'Pick a world' },
  close: { fr: 'Fermer', en: 'Close' },
  here: { fr: 'Tu es ici', en: 'You are here' },
} satisfies Record<string, L>;

/**
 * The eight worlds as big cards. Picking one zooms into it (a calm fade under
 * reduced motion) before the sandbox switches.
 */
export function WorldPicker({ locale, current, found, reduceMotion, onPick, onClose }: { locale: string; current: WorldId; found: Record<WorldId, number>; reduceMotion: boolean; onPick: (w: WorldId) => void; onClose: () => void }) {
  const [zoom, setZoom] = useState<WorldId | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <motion.div className="fixed inset-0 z-[68] flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}>
      <button type="button" aria-label={tr(TEXT.close, locale)} className="absolute inset-0 bg-[#0d0b2a]/70" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={tr(TEXT.title, locale)}
        className="relative max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-t-[30px] bg-[#2a2366] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-white/15 sm:rounded-[30px]"
        initial={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      >
        <div className="mb-3 flex items-center gap-3">
          <h2 className="flex-1 font-display text-xl font-bold">{tr(TEXT.title, locale)}</h2>
          <button type="button" onClick={onClose} aria-label={tr(TEXT.close, locale)} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-lg ring-1 ring-white/15 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {WORLDS.map((w, k) => {
            const info = WORLD_INFO[w];
            const on = w === current;
            return (
              <motion.button
                key={w}
                ref={k === 0 ? first : undefined}
                type="button"
                data-world={w}
                onClick={() => {
                  if (zoom) return;
                  setZoom(w);
                  window.setTimeout(() => onPick(w), reduceMotion ? 60 : 380);
                }}
                className="relative flex min-h-[120px] flex-col items-center justify-end overflow-hidden rounded-3xl p-3 text-center font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] ring-2 focus-visible:outline focus-visible:outline-4 focus-visible:outline-white"
                style={{ background: `linear-gradient(160deg, ${info.colors[0]}, ${info.colors[1]})`, borderColor: on ? '#fff' : 'transparent', ['--tw-ring-color' as string]: on ? '#fff' : 'transparent' }}
                animate={zoom === w ? (reduceMotion ? { opacity: 0.6 } : { scale: [1, 0.94, 1.6], opacity: [1, 1, 0] }) : zoom ? { opacity: 0.4, scale: 0.96 } : { scale: 1, opacity: 1 }}
                whileHover={reduceMotion ? undefined : { y: -3 }}
                whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                transition={{ duration: zoom === w ? 0.38 : 0.2, ease: [0.5, 0, 0.3, 1] }}
              >
                <span aria-hidden="true" className="absolute left-1/2 top-3 -translate-x-1/2 text-[44px] drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]">
                  {info.emoji}
                </span>
                <span aria-hidden="true" className="absolute right-2 top-2 text-2xl">
                  {info.critterEmoji}
                </span>
                <span className="text-base leading-tight [text-shadow:0_2px_4px_rgba(0,0,0,0.45)]">{tr(info.name, locale)}</span>
                <span className="text-xs font-semibold opacity-90 [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
                  {on ? tr(TEXT.here, locale) : `📒 ${found[w]}`}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
