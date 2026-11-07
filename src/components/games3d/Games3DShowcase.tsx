'use client';

import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { Tilt3D } from '@/components/ui/Tilt3D';

export const GAMES_3D: {
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
  {
    href: '/monde/3d/kart',
    emoji: '🏎️',
    title: { fr: 'Ziggy Kart des lettres', en: 'Ziggy’s Letter Kart' },
    teaser: {
      fr: 'Roule sur la route arc-en-ciel et passe sous les bonnes lettres pour écrire les mots.',
      en: 'Race along the rainbow road and drive under the right letters to spell the words.',
    },
    from: '#7b61ff',
    to: '#ff7ab8',
    skill: { fr: 'Lettres · lecture · vocabulaire', en: 'Letters · reading · vocabulary' },
  },
  {
    href: '/monde/3d/planetes',
    emoji: '🪐',
    title: { fr: 'Le Facteur des Planètes', en: 'The Planet Postman' },
    teaser: {
      fr: 'Livre les colis de planète en planète : résous l’énigme pour trouver la bonne adresse !',
      en: 'Deliver parcels from planet to planet: solve the riddle to find the right address!',
    },
    from: '#060a24',
    to: '#5b3fa8',
    skill: { fr: 'Planètes · sciences · compter', en: 'Planets · science · counting' },
  },
  {
    href: '/monde/3d/grand-huit',
    emoji: '🎢',
    title: { fr: 'Le Grand Huit des Nombres', en: 'The Number Coaster' },
    teaser: {
      fr: 'Construis le trajet du wagonnet et arrête Ziggy pile à la bonne gare… Splash !',
      en: 'Build the cart’s ride and stop Ziggy right at the station… Splash!',
    },
    from: '#4a5bc4',
    to: '#ff8a5c',
    skill: { fr: 'Compter · additions · soustractions · tables · suites', en: 'Counting · sums · take-aways · times tables · patterns' },
  },  {
    href: '/monde/3d/dino',
    emoji: '🦕',
    title: { fr: 'Ziggy Paléontologue', en: 'Ziggy the Dino Digger' },
    teaser: {
      fr: 'Creuse le sable, reconstruis les squelettes et regarde les dinosaures se réveiller !',
      en: 'Dig the sand, rebuild the skeletons and watch the dinosaurs wake up!',
    },
    from: '#7a3b12',
    to: '#f2994a',
    skill: { fr: 'Animaux · formes · sciences · compter', en: 'Animals · shapes · science · counting' },
  },  {
    href: '/monde/3d/detective',
    emoji: '🔍',
    title: { fr: 'Ziggy Détective', en: 'Detective Ziggy' },
    teaser: {
      fr: 'Trouve les indices au village et découvre qui a mangé le gâteau !',
      en: 'Find the clues in the village and discover who ate the cake!',
    },
    from: '#2f6fb3',
    to: '#f29a3c',
    skill: { fr: 'Logique · lecture · vocabulaire', en: 'Logic · reading · vocabulary' },
  },  {
    href: '/monde/3d/pizza',
    emoji: '🍕',
    title: { fr: 'La Pizzeria de Ziggy', en: 'Ziggy’s Pizzeria' },
    teaser: {
      fr: 'Garnis les pizzas des animaux du village et régale tout le monde !',
      en: 'Top the village animals’ pizzas and make everyone happy!',
    },
    from: '#ff8a3d',
    to: '#4cc9b7',
    skill: { fr: 'Compter · additions · fractions · monnaie', en: 'Counting · sums · fractions · change' },
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
        {GAMES_3D.map((g, i) => (
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
