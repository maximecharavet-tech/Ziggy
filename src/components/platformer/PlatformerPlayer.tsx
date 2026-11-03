'use client';

import { useRef } from 'react';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft, Keyboard, Maximize2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { tr } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { CONTROLS, PLATFORMER_SRC, PT } from './text';

/**
 * Ziggy et les Étoiles Perdues: the Rust/macroquad platformer, compiled to
 * WebAssembly and served as static files from public/jeux/ziggy-plateforme/.
 * Embedded in a same-origin iframe (no network calls, no data, no ads).
 */
export function PlatformerPlayer() {
  const locale = useLocale();
  const frame = useRef<HTMLIFrameElement>(null);

  function focusGame() {
    frame.current?.focus({ preventScroll: true });
  }

  function fullscreen() {
    const el = frame.current;
    if (!el) return;
    if (el.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
    el.focus({ preventScroll: true });
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

        <div className="relative w-full overflow-hidden rounded-[1.5rem] bg-[#10172a] shadow-2xl ring-1 ring-white/15">
          <div className="relative aspect-[16/9] w-full">
            <iframe
              ref={frame}
              src={PLATFORMER_SRC}
              title={tr(PT.frame, locale)}
              className="absolute inset-0 h-full w-full border-0"
              allow="fullscreen; autoplay"
              allowFullScreen
              onLoad={focusGame}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fullscreen}
            className="inline-flex min-h-[56px] items-center gap-2 rounded-full bg-amber-300 px-6 font-display text-lg font-bold text-[#2a1650] shadow-lg transition hover:scale-105"
          >
            <Maximize2 size={20} />
            {tr(PT.fullscreen, locale)}
          </button>
          <p className="text-white/80">{tr(PT.start, locale)}</p>
        </div>

        <section aria-labelledby="platformer-controls" className="mt-6 rounded-[1.5rem] bg-white/5 p-5 ring-1 ring-white/10">
          <h2 id="platformer-controls" className="flex items-center gap-2 font-display text-xl font-bold text-amber-100">
            <Keyboard size={20} />
            {tr(PT.controls, locale)}
          </h2>
          <p className="mt-1 text-sm text-white/70">{tr(PT.keyboard, locale)}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map((c) => (
              <li key={c.keys} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                <kbd className="shrink-0 rounded-lg bg-white/90 px-2 py-1 font-mono text-xs font-bold text-[#1b2150]">{c.keys}</kbd>
                <span className="text-sm text-white/90">{tr(c.what, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
