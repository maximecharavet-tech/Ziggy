'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BRUSHES, CATEGORY_INFO, WORLD_INFO, drawerTools, toolById, type BrushId, type Tool, type ToolCategory, type ToolId, type WorldId } from '@/games2d/sandbox/content';
import { tr, type L } from '@/lib/i18n-text';
import { fx, shade, toy } from '@/components/create/fx/toy';
import type { Speed } from './SandCanvas';

const TEXT = {
  elements: { fr: 'Éléments', en: 'Elements' },
  more: { fr: 'Tous les éléments', en: 'All the elements' },
  close: { fr: 'Fermer', en: 'Close' },
  brush: { fr: 'Taille du pinceau', en: 'Brush size' },
  time: { fr: 'Le temps', en: 'Time' },
  pause: { fr: 'Pause', en: 'Pause' },
  slow: { fr: 'Ralenti', en: 'Slow motion' },
  play: { fr: 'Normal', en: 'Normal' },
  night: { fr: 'Nuit', en: 'Night' },
  day: { fr: 'Jour', en: 'Day' },
  clear: { fr: 'Tout recommencer', en: 'Start again' },
  sure: { fr: 'Sûr ? Touche encore', en: 'Sure? Tap again' },
  worlds: { fr: 'Mondes', en: 'Worlds' },
  album: { fr: 'Album', en: 'Album' },
  photo: { fr: 'Photo', en: 'Photo' },
} satisfies Record<string, L>;

const ctrl = `${fx.toy} inline-flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold`;
/** Night-blue moulded plastic, for the buttons on the dark sandbox. */
const night$ = toy('#4b3fa6', { depth: 4 });

function ToolBall({ t, on, size, locale, onPick }: { t: Tool; on: boolean; size: 'big' | 'small'; locale: string; onPick: (id: ToolId) => void }) {
  const ball = size === 'big' ? 'h-16 w-16 text-[32px]' : 'h-14 w-14 text-[26px]';
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={tr(t.name, locale)}
      title={tr(t.name, locale)}
      data-tool={t.id}
      onClick={() => onPick(t.id)}
      className={`group flex shrink-0 flex-col items-center gap-1 rounded-2xl pb-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${size === 'big' ? 'w-[70px]' : 'w-[64px]'}`}
    >
      <motion.span
        className={`relative grid place-items-center rounded-full ${ball}`}
        style={{
          background: `radial-gradient(circle at 32% 26%, #ffffffdd 0%, #ffffff55 22%, ${t.color} 58%, ${shade(t.color, -0.12)})`,
          boxShadow: on ? `0 0 0 3px #fff, 0 5px 0 3px ${shade(t.color, -0.4)}, 0 0 22px 4px ${t.color}` : `0 5px 0 ${shade(t.color, -0.4)}, 0 10px 14px -6px rgba(0,0,0,0.55), inset 0 -3px 0 rgba(0,0,0,0.12)`,
        }}
        animate={{ scale: on ? 1.08 : 1, y: on ? -4 : 0 }}
        whileTap={{ scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
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
      <span className={`max-w-full truncate text-[11px] font-bold leading-tight sm:text-xs ${on ? 'text-white' : 'text-white/75'}`}>{tr(t.name, locale).replace(/ [←→]$/, '')}</span>
    </button>
  );
}

export function Toolbar({
  locale,
  world,
  tool,
  onTool,
  unlocked,
  brush,
  onBrush,
  speed,
  onSpeed,
  night,
  onNight,
  onClear,
  onWorlds,
  onAlbum,
  onPhoto,
}: {
  locale: string;
  world: WorldId;
  tool: ToolId;
  onTool: (id: ToolId) => void;
  /** Tools that must be earned (beam, parcel gifts) and are available. */
  unlocked: Set<ToolId>;
  brush: BrushId;
  onBrush: (id: BrushId) => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  night: boolean;
  onNight: () => void;
  onClear: () => void;
  onWorlds: () => void;
  onAlbum: () => void;
  onPhoto: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);
  const big = WORLD_INFO[world].big.map(toolById);
  const earned = (t: Tool) => !['beam', 'rainbowSeed', 'baby', 'pocketStar', 'toy'].includes(t.id) || unlocked.has(t.id);
  const all = drawerTools(world).filter(earned);
  const byCat = (Object.keys(CATEGORY_INFO) as ToolCategory[]).map((c) => [c, all.filter((t) => t.category === c)] as const).filter(([, list]) => list.length);
  // The tool in hand is shown in the bar even when it came from the drawer.
  const extra = big.some((t) => t.id === tool) ? null : toolById(tool);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    if (!open) return;
    drawer.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"], button[data-tool]')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const speeds: { id: Speed; label: L; icon: string }[] = [
    { id: 'pause', label: TEXT.pause, icon: '⏸' },
    { id: 'slow', label: TEXT.slow, icon: '🐢' },
    { id: 'normal', label: TEXT.play, icon: '▶' },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <div role="toolbar" aria-label={tr(TEXT.elements, locale)} className="flex max-w-full items-end gap-1 overflow-hidden rounded-[30px] bg-[#1a1650]/45 px-2 pb-1.5 pt-3 shadow-[inset_0_3px_12px_rgba(0,0,0,0.35),0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/10 sm:gap-2 sm:px-3">
        {big.map((t) => (
          <ToolBall key={t.id} t={t} on={t.id === tool} size="big" locale={locale} onPick={onTool} />
        ))}
        {extra ? <ToolBall t={extra} on size="big" locale={locale} onPick={onTool} /> : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={tr(TEXT.more, locale)}
          data-tool-drawer=""
          className={`${fx.toy} mb-6 grid h-16 w-16 shrink-0 place-items-center rounded-full text-2xl font-black`}
          style={toy('#5a4cc0', { depth: 5 })}
        >
          <span aria-hidden="true">＋</span>
        </button>
      </div>

      <div className="relative flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <button type="button" onClick={onWorlds} className={ctrl} style={night$} data-worlds-button="">
          <span aria-hidden="true">{WORLD_INFO[world].emoji}</span>
          <span className="hidden sm:inline">{tr(TEXT.worlds, locale)}</span>
          <span className="sr-only sm:hidden">{tr(TEXT.worlds, locale)}</span>
        </button>
        <div role="radiogroup" aria-label={tr(TEXT.brush, locale)} className="flex h-12 items-center gap-0.5 rounded-full bg-[#1a1650]/50 px-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
          {BRUSHES.map((b) => {
            const on = b.id === brush;
            return (
              <button key={b.id} type="button" role="radio" aria-checked={on} aria-label={tr(b.name, locale)} title={tr(b.name, locale)} onClick={() => onBrush(b.id)} className={`grid h-10 w-10 place-items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${on ? 'bg-white shadow-[0_3px_0_#b9b2e6]' : 'hover:bg-white/15'}`}>
                <span className={`block rounded-full ${on ? 'bg-indigo-600' : 'bg-white/80'}`} style={{ width: b.dot * 0.9, height: b.dot * 0.9 }} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <div role="radiogroup" aria-label={tr(TEXT.time, locale)} className="flex h-12 items-center gap-0.5 rounded-full bg-[#1a1650]/50 px-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
          {speeds.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={speed === s.id} aria-label={tr(s.label, locale)} title={tr(s.label, locale)} data-speed={s.id} onClick={() => onSpeed(s.id)} className={`grid h-10 w-10 place-items-center rounded-full text-base transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${speed === s.id ? 'bg-white text-indigo-700 shadow-[0_3px_0_#b9b2e6]' : 'hover:bg-white/15'}`}>
              <span aria-hidden="true">{s.icon}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onNight} aria-pressed={night} aria-label={tr(night ? TEXT.day : TEXT.night, locale)} title={tr(night ? TEXT.day : TEXT.night, locale)} className={`${ctrl} w-12 px-0 text-lg`} style={night ? toy('#ffd447', { depth: 4 }) : night$} data-night="">
          <span aria-hidden="true">{night ? '☀️' : '🌙'}</span>
        </button>
        <button type="button" onClick={onPhoto} aria-label={tr(TEXT.photo, locale)} title={tr(TEXT.photo, locale)} className={`${ctrl} w-12 px-0 text-lg`} style={night$} data-photo="">
          <span aria-hidden="true">📷</span>
        </button>
        <button type="button" onClick={onAlbum} className={ctrl} style={night$} data-album="">
          <span aria-hidden="true">🖼️</span>
          <span className="hidden sm:inline">{tr(TEXT.album, locale)}</span>
          <span className="sr-only sm:hidden">{tr(TEXT.album, locale)}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (armed) {
              setArmed(false);
              onClear();
            } else setArmed(true);
          }}
          aria-label={tr(armed ? TEXT.sure : TEXT.clear, locale)}
          className={ctrl}
          style={armed ? toy('#fb7185', { depth: 4 }) : night$}
        >
          <span aria-hidden="true">🔄</span>
          <span className={armed ? '' : 'hidden'}>{tr(TEXT.sure, locale)}</span>
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div key="drawer" className="fixed inset-0 z-[66]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label={tr(TEXT.close, locale)} className="absolute inset-0 bg-[#0d0b2a]/60" onClick={() => setOpen(false)} />
            <motion.div
              ref={drawer}
              role="dialog"
              aria-modal="true"
              aria-label={tr(TEXT.more, locale)}
              className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[78dvh] max-w-3xl flex-col rounded-t-[30px] bg-[#2a2366] pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-white/15"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            >
              <div className="flex items-center gap-3 px-5 pb-2 pt-4">
                <h2 className="flex-1 font-display text-lg font-bold">{tr(TEXT.more, locale)}</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label={tr(TEXT.close, locale)} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-lg ring-1 ring-white/15 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                  ✕
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                {byCat.map(([cat, list]) => (
                  <section key={cat} className="mb-3">
                    <h3 className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/60">
                      <span aria-hidden="true">{CATEGORY_INFO[cat].emoji} </span>
                      {tr(CATEGORY_INFO[cat].name, locale)}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {list.map((t) => (
                        <ToolBall
                          key={t.id}
                          t={t}
                          on={t.id === tool}
                          size="small"
                          locale={locale}
                          onPick={(id) => {
                            onTool(id);
                            setOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

