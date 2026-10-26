'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BRUSHES, SCENE_INFO, TOOLS, type BrushId, type ToolId } from '@/games2d/sandbox/content';
import { SCENES, type SceneId } from '@/games2d/sandbox/scenes';
import { tr, type L } from '@/lib/i18n-text';

const TEXT = {
  elements: { fr: 'Éléments', en: 'Elements' },
  brush: { fr: 'Taille du pinceau', en: 'Brush size' },
  pause: { fr: 'Pause', en: 'Pause' },
  play: { fr: 'Reprendre', en: 'Play' },
  scenes: { fr: 'Scènes', en: 'Scenes' },
  chooseScene: { fr: 'Choisis une scène pour commencer', en: 'Pick a scene to start from' },
  clear: { fr: 'Tout effacer', en: 'Clear all' },
  sure: { fr: 'Sûr ? Touche encore', en: 'Sure? Tap again' },
} satisfies Record<string, L>;

const ctrl =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/10 px-3.5 sm:px-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export function Toolbar({
  locale,
  tool,
  onTool,
  brush,
  onBrush,
  paused,
  onPause,
  onScene,
  onClear,
}: {
  locale: string;
  tool: ToolId;
  onTool: (id: ToolId) => void;
  brush: BrushId;
  onBrush: (id: BrushId) => void;
  paused: boolean;
  onPause: () => void;
  onScene: (id: SceneId) => void;
  onClear: () => void;
}) {
  const [scenesOpen, setScenesOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const scenesRef = useRef<HTMLDivElement>(null);

  // The 2-tap clear disarms itself after a moment.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    if (!scenesOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setScenesOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!scenesRef.current?.contains(e.target as Node)) setScenesOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [scenesOpen]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Elements: big round buttons, scrollable on a phone. */}
      <div role="toolbar" aria-label={tr(TEXT.elements, locale)} className="sandbox-scroll -mx-3 -mt-2 flex max-w-full snap-x gap-1.5 overflow-x-auto px-3 pb-1.5 pt-4 sm:gap-2">
        {TOOLS.map((t, k) => {
          const on = t.id === tool;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              aria-label={tr(t.name, locale)}
              title={`${tr(t.name, locale)}${k < 9 ? ` (${k + 1})` : ''}`}
              onClick={() => onTool(t.id)}
              className="group flex w-[60px] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl pb-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-[66px]"
            >
              <motion.span
                className="relative grid h-[52px] w-[52px] place-items-center rounded-full text-[26px] sm:h-14 sm:w-14 sm:text-[28px]"
                style={{
                  background: `radial-gradient(circle at 32% 28%, #ffffffcc, ${t.color} 62%, ${t.color})`,
                  boxShadow: on ? `0 0 0 3px #fff, 0 0 14px 1px ${t.color}` : `0 6px 14px -6px rgba(0,0,0,0.5), inset 0 -3px 0 rgba(0,0,0,0.12)`,
                }}
                animate={{ scale: on ? 1.08 : 1, y: on ? -3 : 0 }}
                whileHover={{ scale: on ? 1.1 : 1.06 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <span aria-hidden="true" className={t.wind === -1 ? '-scale-x-100' : ''}>
                  {t.emoji}
                </span>
                {t.wind ? (
                  <span aria-hidden="true" className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-black text-indigo-700 shadow">
                    {t.wind < 0 ? '←' : '→'}
                  </span>
                ) : null}
              </motion.span>
              <span className={`max-w-full truncate text-[11px] font-bold leading-tight sm:text-xs ${on ? 'text-white' : 'text-white/70'}`}>{tr(t.name, locale).replace(/ [←→]$/, '')}</span>
            </button>
          );
        })}
      </div>

      {/* Controls. */}
      <div className="relative flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <div role="radiogroup" aria-label={tr(TEXT.brush, locale)} className="flex h-12 items-center gap-0.5 rounded-full bg-white/10 px-1 ring-1 ring-white/15 sm:gap-1 sm:px-1.5">
          {BRUSHES.map((b) => {
            const on = b.id === brush;
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={tr(b.name, locale)}
                title={tr(b.name, locale)}
                onClick={() => onBrush(b.id)}
                className={`grid h-10 w-10 place-items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${on ? 'bg-white' : 'hover:bg-white/15'}`}
              >
                <span className={`block rounded-full ${on ? 'bg-indigo-600' : 'bg-white/80'}`} style={{ width: b.dot * 0.9, height: b.dot * 0.9 }} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <button type="button" onClick={onPause} aria-pressed={paused} aria-label={tr(paused ? TEXT.play : TEXT.pause, locale)} title={tr(paused ? TEXT.play : TEXT.pause, locale)} className={`${ctrl} w-12 px-0 text-lg ${paused ? 'bg-amber-300/90 text-[#3b2a00] ring-amber-200 hover:bg-amber-300' : ''}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            {paused ? <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /> : <path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" />}
          </svg>
        </button>

        <div ref={scenesRef}>
          <button type="button" onClick={() => setScenesOpen((o) => !o)} aria-expanded={scenesOpen} aria-haspopup="true" className={ctrl}>
            <span aria-hidden="true">🖼️</span>
            {tr(TEXT.scenes, locale)}
          </button>
          <AnimatePresence>
            {scenesOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className="absolute bottom-full left-1/2 z-20 mb-3 w-[min(86vw,20rem)] -translate-x-1/2 rounded-3xl bg-[#262056]/95 p-3 shadow-2xl ring-1 ring-white/15 backdrop-blur-xl"
              >
                <p className="px-1 pb-2 text-center text-sm font-bold text-white/80">{tr(TEXT.chooseScene, locale)}</p>
                <div className="grid grid-cols-3 gap-2">
                  {SCENES.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setScenesOpen(false);
                        onScene(id);
                      }}
                      className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 px-1 py-3 text-xs font-bold text-white ring-1 ring-white/10 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    >
                      <span className="text-3xl" aria-hidden="true">
                        {SCENE_INFO[id].emoji}
                      </span>
                      <span className="text-center leading-tight">{tr(SCENE_INFO[id].name, locale)}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <motion.button
          type="button"
          layout
          onClick={() => {
            if (armed) {
              setArmed(false);
              onClear();
            } else setArmed(true);
          }}
          aria-label={tr(armed ? TEXT.sure : TEXT.clear, locale)}
          className={`${ctrl} ${armed ? 'bg-rose-400 text-white ring-rose-200 hover:bg-rose-400' : ''}`}
        >
          <span aria-hidden="true">🗑️</span>
          <span className={armed ? '' : 'hidden sm:inline'}>{tr(armed ? TEXT.sure : TEXT.clear, locale)}</span>
        </motion.button>
      </div>
    </div>
  );
}
