'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import type { HotspotScreen, PlanetScene } from '@/games3d/planet/PlanetScene';
import { MascotCutout } from '@/components/ziggy/Mascot';

const SPOTS: Record<string, { href: string; emoji: string; label: L; color: string }> = {
  world: { href: '/monde', emoji: '🏰', label: { fr: 'Ziggy World', en: 'Ziggy World' }, color: '#ec5f9a' },
  games3d: { href: '/monde/3d/noel', emoji: '🚀', label: { fr: 'Jeux 3D', en: '3D games' }, color: '#e2453c' },
  coloring: { href: '/coloriage', emoji: '🖍️', label: { fr: 'Coloriage', en: 'Colouring' }, color: '#3fbf6a' },
  dodo: { href: '/dodo', emoji: '🌙', label: { fr: 'Mode dodo', en: 'Bedtime' }, color: '#6a6ee8' },
  lab: { href: '/lab', emoji: '🧪', label: { fr: 'Labo IA', en: 'AI Lab' }, color: '#5fb6ea' },
};

const T = {
  eyebrow: { fr: 'La planète de Ziggy', en: 'Ziggy’s planet' },
  title: { fr: 'Fais tourner la planète et choisis ton aventure', en: 'Spin the planet and pick your adventure' },
  hint: { fr: 'Fais glisser pour tourner · touche Ziggy pour qu’il saute !', en: 'Drag to spin · tap Ziggy to make him jump!' },
} satisfies Record<string, L>;

function webgl(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Home page: an interactive 3D planet. three.js loads only when the section
 * scrolls into view; without WebGL the mascot and the same links are shown.
 */
export function Planet3DSection() {
  const locale = useLocale();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<PlanetScene | null>(null);
  const [spots, setSpots] = useState<HotspotScreen[]>([]);
  const [mode, setMode] = useState<'idle' | '3d' | 'flat'>('idle');

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let alive = true;
    let local: PlanetScene | null = null;
    let loading = false;
    const io = new IntersectionObserver(
      ([e]) => {
        local?.setVisible(e.isIntersecting);
        if (!e.isIntersecting || local || loading) return;
        if (!webgl()) return setMode('flat');
        loading = true;
        void import('@/games3d/planet/PlanetScene').then(({ PlanetScene }) => {
          if (!alive || !canvas.current) return;
          let last = 0;
          local = new PlanetScene(canvas.current, (h) => {
            const now = performance.now();
            if (now - last > 50) {
              last = now;
              setSpots(h);
            }
          });
          scene.current = local;
          setMode('3d');
        });
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
      local?.dispose();
      scene.current = null;
    };
  }, []);

  return (
    <section className="relative overflow-clip px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="planet-title">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(150,120,255,0.18),transparent_65%)]" aria-hidden="true" />
      <div className="mx-auto max-w-6xl text-center">
        <motion.p initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="inline-flex rounded-full border border-purple/40 bg-purple/10 px-4 py-1.5 text-sm font-bold text-purple">
          🪐 {tr(T.eyebrow, locale)}
        </motion.p>
        <motion.h2 id="planet-title" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-4 font-display text-3xl font-bold text-text-body sm:text-5xl">
          {tr(T.title, locale)}
        </motion.h2>
        <p className="mt-2 text-text-muted">{tr(T.hint, locale)}</p>
      </div>

      <div ref={wrap} className="relative mx-auto mt-6 h-[440px] max-w-4xl sm:h-[540px]">
        <canvas ref={canvas} className={`absolute inset-0 h-full w-full cursor-grab touch-pan-y transition-opacity duration-1000 active:cursor-grabbing ${mode === '3d' ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
        {mode === '3d'
          ? spots.map((s) => {
              const spot = SPOTS[s.id];
              if (!spot) return null;
              return (
                <Link
                  key={s.id}
                  href={spot.href}
                  className="absolute z-10 -translate-x-1/2 -translate-y-full rounded-full border-2 bg-bg-card/95 px-3 py-1.5 text-sm font-bold text-text-body shadow-lg backdrop-blur transition-[opacity,transform] duration-300 hover:scale-110 focus-visible:outline focus-visible:outline-4"
                  style={{ left: s.x, top: s.y, opacity: s.front ? 1 : 0, pointerEvents: s.front ? 'auto' : 'none', borderColor: spot.color, outlineColor: `${spot.color}66` }}
                  tabIndex={s.front ? 0 : -1}
                  aria-hidden={!s.front}
                >
                  {spot.emoji} {tr(spot.label, locale)}
                </Link>
              );
            })
          : null}
        {mode !== '3d' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="w-44">
              <MascotCutout pose="wave" width={176} />
            </motion.div>
            <nav className="flex flex-wrap justify-center gap-3" aria-label={tr(T.eyebrow, locale)}>
              {Object.entries(SPOTS).map(([id, s]) => (
                <Link key={id} href={s.href} className="rounded-full border-2 bg-bg-card px-4 py-2 font-bold text-text-body shadow" style={{ borderColor: s.color }}>
                  {s.emoji} {tr(s.label, locale)}
                </Link>
              ))}
            </nav>
          </div>
        ) : (
          // The same links, always reachable for keyboards and screen readers.
          <nav className="sr-only" aria-label={tr(T.eyebrow, locale)}>
            {Object.entries(SPOTS).map(([id, s]) => (
              <Link key={id} href={s.href}>
                {tr(s.label, locale)}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </section>
  );
}
