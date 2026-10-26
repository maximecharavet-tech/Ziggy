'use client';

import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { Tilt3D } from '@/components/ui/Tilt3D';

const GAMES: {
  href: string;
  emoji: string;
  title: L;
  teaser: L;
  from: string;
  to: string;
  skill: L;
}[] = [
  {
    href: '/monde/3d/noel',
    emoji: '🎄',
    title: { fr: 'Le Noël de Ziggy', en: 'Ziggy’s Christmas' },
    teaser: {
      fr: 'Livre les cadeaux du village enneigé et illumine le grand sapin.',
      en: 'Deliver presents in the snowy village and light up the big tree.',
    },
    from: '#0b1238',
    to: '#7a1f3d',
    skill: {
      fr: 'Couleurs · compter · additionner · suites',
      en: 'Colours · counting · adding · patterns',
    },
  },
  {
    href: '/monde/3d/luge',
    emoji: '🛷',
    title: { fr: 'La Luge des nombres', en: 'The Number Sled' },
    teaser: {
      fr: 'Dévale la piste et passe sous l’arche de la bonne réponse.',
      en: 'Race down the slope through the arch with the right answer.',
    },
    from: '#0b1238',
    to: '#2f5fa8',
    skill: {
      fr: 'Compter · additions · tables',
      en: 'Counting · sums · times tables',
    },
  },
];

/** The 3D games, as big posters. */
export function Games3DShowcase({ locale, title = true }: { locale: string; title?: boolean }) {
  return (
    <section aria-labelledby={title ? 'games3d' : undefined} className="mt-8">
      {title ? (
        <h2 id="games3d" className="mb-4 flex items-center gap-2 font-display text-2xl font-bold text-text-body">
          ✨ {locale === 'fr' ? 'Nouveau : les jeux en 3D' : 'New: 3D games'}
        </h2>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((g, i) => (
          <motion.div key={g.href} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}>
            <Tilt3D className="rounded-[2rem]">
              <Link
                href={g.href}
                className="group relative block overflow-hidden rounded-[2rem] p-6 text-white shadow-xl ring-1 ring-white/10 transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300/60"
                style={{
                  background: `linear-gradient(140deg, ${g.from}, ${g.to})`,
                }}
              >
                <span
                  className="pointer-events-none absolute -right-4 -top-6 text-[9rem] opacity-25 transition duration-700 group-hover:rotate-6 group-hover:scale-110"
                  aria-hidden="true"
                >
                  {g.emoji}
                </span>
                {Array.from({ length: 14 }, (_, k) => (
                  <span
                    key={k}
                    className="pointer-events-none absolute h-1 w-1 rounded-full bg-white/70"
                    style={{
                      left: `${(k * 41) % 100}%`,
                      top: `${(k * 23) % 100}%`,
                    }}
                    aria-hidden="true"
                  />
                ))}
                <span className="relative inline-flex rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-black text-[#2a1650]">3D</span>
                <h3 className="relative mt-3 font-display text-2xl font-bold">
                  {g.emoji} {tr(g.title, locale)}
                </h3>
                <p className="relative mt-1 max-w-xs text-white/80">{tr(g.teaser, locale)}</p>
                <p className="relative mt-3 text-xs font-semibold text-white/60">{tr(g.skill, locale)}</p>
                <span className="relative mt-4 inline-flex rounded-full bg-white/95 px-5 py-2 font-bold text-[#1b2150] transition group-hover:scale-105">
                  ▶ {locale === 'fr' ? 'Jouer' : 'Play'}
                </span>
              </Link>
            </Tilt3D>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
