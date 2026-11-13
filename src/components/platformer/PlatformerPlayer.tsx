'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { motion } from 'motion/react';
import { ArrowLeft, Hand, Keyboard, Maximize2, Minimize2, Smartphone } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { tr } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { CONTROLS, PLATFORMER_SRC, PT, TOUCH_CONTROLS } from './text';

type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

/**
 * Ziggy et les Étoiles Perdues: the Rust/macroquad platformer, compiled to
 * WebAssembly and served as static files from public/jeux/ziggy-plateforme/.
 * Embedded in a same-origin iframe (no network calls, no data, no ads).
 * Playable with a keyboard or with the game's own on-screen touch buttons.
 */
export function PlatformerPlayer() {
  const locale = useLocale();
  const frame = useRef<HTMLIFrameElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  /** Native fullscreen (Fullscreen API) is active. */
  const [nativeFull, setNativeFull] = useState(false);
  /** CSS full-viewport fallback (iPhone Safari has no element fullscreen). */
  const [pseudoFull, setPseudoFull] = useState(false);
  const full = nativeFull || pseudoFull;

  const focusGame = useCallback(() => {
    frame.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onChange = () => {
      const d = document as FsDocument;
      setNativeFull(!!(d.fullscreenElement || d.webkitFullscreenElement));
      // Let the game re-measure its canvas after the size change.
      window.setTimeout(() => frame.current?.contentWindow?.dispatchEvent(new Event('resize')), 60);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  useEffect(() => {
    if (!pseudoFull) return;
    const iframe = frame.current;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPseudoFull(false);
    };
    window.addEventListener('keydown', onKey);
    window.setTimeout(() => iframe?.contentWindow?.dispatchEvent(new Event('resize')), 60);
    return () => {
      html.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.setTimeout(() => iframe?.contentWindow?.dispatchEvent(new Event('resize')), 60);
    };
  }, [pseudoFull]);

  function enterFullscreen() {
    const el = wrap.current as FsElement | null;
    if (!el) return;
    const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    if (request) {
      try {
        const res = request();
        if (res && typeof (res as Promise<void>).catch === 'function') {
          (res as Promise<void>).catch(() => setPseudoFull(true));
        }
      } catch {
        setPseudoFull(true);
      }
    } else {
      setPseudoFull(true);
    }
    focusGame();
  }

  function exitFullscreen() {
    setPseudoFull(false);
    const d = document as FsDocument;
    if (d.fullscreenElement && d.exitFullscreen) void d.exitFullscreen().catch(() => undefined);
    else if (d.webkitFullscreenElement && d.webkitExitFullscreen) void d.webkitExitFullscreen();
    focusGame();
  }

  return (
    <div className="min-h-screen bg-[#10172a] pb-16 pt-20 text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/monde/arcade"
          className="mb-4 inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/15"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
          {tr(PT.back, locale)}
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-5 flex flex-wrap items-center gap-3"
        >
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold text-amber-200 sm:text-4xl">⭐ {tr(PT.title, locale)}</h1>
            <p className="mt-1 max-w-2xl text-white/80">{tr(PT.teaser, locale)}</p>
          </div>
          <SayButton texts={[tr(PT.title, locale), tr(PT.teaser, locale), tr(PT.start, locale)]} locale={locale} />
        </motion.header>

        <div
          ref={wrap}
          className={
            full
              ? 'fixed inset-0 z-[100] h-[100dvh] w-screen bg-black'
              : 'relative w-full overflow-hidden rounded-[1.5rem] bg-[#10172a] shadow-2xl ring-1 ring-white/15'
          }
          onPointerDown={focusGame}
        >
          <div
            className={
              full
                ? 'relative h-full w-full'
                : 'relative aspect-[4/5] w-full min-[480px]:aspect-[4/3] sm:aspect-[16/9]'
            }
          >
            <iframe
              ref={frame}
              src={PLATFORMER_SRC}
              title={tr(PT.frame, locale)}
              className="absolute inset-0 h-full w-full touch-none border-0"
              allow="fullscreen; autoplay"
              allowFullScreen
              onLoad={focusGame}
            />
          </div>
          {full && (
            <button
              type="button"
              onClick={exitFullscreen}
              aria-label={tr(PT.close, locale)}
              title={tr(PT.close, locale)}
              className="absolute left-1/2 top-[max(0.375rem,env(safe-area-inset-top))] z-10 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/30 backdrop-blur"
            >
              <Minimize2 size={18} />
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={enterFullscreen}
            className="inline-flex min-h-[56px] items-center gap-2 rounded-full bg-amber-300 px-6 font-display text-lg font-bold text-[#2a1650] shadow-lg transition hover:scale-105"
          >
            <Maximize2 size={20} />
            {tr(PT.fullscreen, locale)}
          </button>
          <p className="text-white/80">{tr(PT.start, locale)}</p>
        </div>
        <p className="mt-2 hidden items-center gap-2 text-sm text-amber-100/90 pointer-coarse:flex">
          <Smartphone size={16} className="shrink-0" />
          {tr(PT.rotate, locale)}
        </p>

        <section aria-labelledby="platformer-controls" className="mt-6 rounded-[1.5rem] bg-white/5 p-5 ring-1 ring-white/10">
          <h2 id="platformer-controls" className="font-display text-xl font-bold text-amber-100">
            {tr(PT.controls, locale)}
          </h2>
          <p className="mt-1 text-sm text-white/70">{tr(PT.devices, locale)}</p>

          {/* Touch help first on phones/tablets (coarse pointer), keyboard first on computers. */}
          <div className="mt-4 flex flex-col gap-5 pointer-coarse:flex-col-reverse">
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-white/90">
                <Keyboard size={18} />
                {tr(PT.keysTitle, locale)}
              </h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CONTROLS.map((c) => (
                  <li key={c.keys} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                    <kbd className="shrink-0 rounded-lg bg-white/90 px-2 py-1 font-mono text-xs font-bold text-[#1b2150]">{c.keys}</kbd>
                    <span className="text-sm text-white/90">{tr(c.what, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-white/90">
                <Hand size={18} />
                {tr(PT.touchTitle, locale)}
              </h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {TOUCH_CONTROLS.map((c) => (
                  <li key={c.icon} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                    <span
                      aria-hidden="true"
                      className="grid h-9 min-w-9 shrink-0 place-items-center rounded-full bg-white/85 px-2 text-sm font-bold text-[#1b2150]"
                    >
                      {c.icon}
                    </span>
                    <span className="text-sm text-white/90">{tr(c.what, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
