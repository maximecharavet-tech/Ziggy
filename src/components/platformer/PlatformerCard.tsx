'use client';

import Image from 'next/image';
import { motion } from 'motion/react';
import { Link } from '@/i18n/navigation';
import { tr } from '@/lib/i18n-text';
import { PLATFORMER_PATH, PT } from './text';

/** Poster for the 2D platformer, shown in the arcade next to the 3D games. */
export function PlatformerCard({ locale }: { locale: string }) {
  const title = tr(PT.title, locale);
  return (
    <section aria-labelledby="platformer-card" className="mt-8">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href={PLATFORMER_PATH}
          className="group relative block overflow-hidden rounded-[2rem] text-white shadow-xl ring-1 ring-white/10 transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300/60"
          style={{ background: 'linear-gradient(140deg, #10172a, #2f7a4f)' }}
        >
          <span className="relative block aspect-[4/5] max-h-[28rem] w-full overflow-hidden sm:max-h-none sm:aspect-[16/10]">
            <Image
              src="/covers/ziggy-plateforme.webp"
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, 900px"
              className="object-cover object-top transition duration-700 group-hover:scale-105"
              loading="lazy"
            />
          </span>
          <span className="relative block space-y-2 p-5 sm:p-6">
            <span className="inline-flex rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-black text-[#2a1650]">
              {tr(PT.badge, locale)} · 2D
            </span>
            <h3 id="platformer-card" className="font-display text-2xl font-bold">
              {title}
            </h3>
            <p className="max-w-md text-white/85">{tr(PT.teaser, locale)}</p>
            <p className="text-xs font-semibold text-white/60">{tr(PT.skill, locale)}</p>
            <span className="mt-1 inline-flex rounded-full bg-white/95 px-5 py-2 font-bold text-[#1b2150] transition group-hover:scale-105">
              ▶ {tr(PT.play, locale)}
            </span>
          </span>
        </Link>
      </motion.div>
    </section>
  );
}
