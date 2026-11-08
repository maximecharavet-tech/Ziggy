'use client';

import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { tr } from '@/lib/i18n-text';
import { PLATFORMER_PATH, PT } from './text';

/** Poster for the 2D platformer, shown in the arcade next to the 3D games. */
export function PlatformerCard({ locale }: { locale: string }) {
  return (
    <section aria-labelledby="platformer-card" className="mt-8">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href={PLATFORMER_PATH}
          className="group relative block overflow-hidden rounded-[2rem] p-6 text-white shadow-xl ring-1 ring-white/10 transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300/60"
          style={{ background: 'linear-gradient(140deg, #10172a, #2f7a4f)' }}
        >
          <span
            className="pointer-events-none absolute -right-4 -top-6 text-[9rem] opacity-25 transition duration-700 group-hover:rotate-6 group-hover:scale-110"
            aria-hidden="true"
          >
            ⭐
          </span>
          <span className="relative inline-flex rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-black text-[#2a1650]">
            {tr(PT.badge, locale)} · 2D
          </span>
          <h3 id="platformer-card" className="relative mt-3 font-display text-2xl font-bold">
            🌟 {tr(PT.title, locale)}
          </h3>
          <p className="relative mt-1 max-w-md text-white/80">{tr(PT.teaser, locale)}</p>
          <p className="relative mt-3 text-xs font-semibold text-white/60">{tr(PT.skill, locale)}</p>
          <span className="relative mt-4 inline-flex rounded-full bg-white/95 px-5 py-2 font-bold text-[#1b2150] transition group-hover:scale-105">
            ▶ {tr(PT.play, locale)}
          </span>
        </Link>
      </motion.div>
    </section>
  );
}
