'use client';

import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { AppPage } from '@/components/learn/AppPage';
import { Tilt3D } from '@/components/ui/Tilt3D';
import { SayButton } from '@/components/arcade/read-aloud';

const APPS: { href: string; emoji: string; title: L; text: L; from: string; to: string; tag: L }[] = [
  {
    href: '/coloriage',
    emoji: '🖍️',
    title: { fr: 'Colorie avec Ziggy', en: 'Colour with Ziggy' },
    text: { fr: 'Colorie, dessine, colle des gommettes… et regarde ton dessin prendre vie en 3D !', en: 'Colour, draw, add stickers… and watch your drawing come to life in 3D!' },
    from: '#ff9a8b',
    to: '#ff6a88',
    tag: { fr: 'Dessin · 3D', en: 'Drawing · 3D' },
  },
  {
    href: '/monde/musique',
    emoji: '🎶',
    title: { fr: 'La Fabrique à chansons', en: 'The Song Factory' },
    text: { fr: 'Compose ta musique avec l’orchestre des animaux. Aucune note ne sonne faux !', en: 'Make music with the animal band. No note can sound wrong!' },
    from: '#a18cd1',
    to: '#7b5cf0',
    tag: { fr: 'Musique · rythme', en: 'Music · rhythm' },
  },
  {
    href: '/monde/bac-a-sable',
    emoji: '🧪',
    title: { fr: 'Le Bac à sable magique', en: 'The Magic Sandbox' },
    text: { fr: 'Sable, eau, graines, glace et soleil : fais tes propres découvertes de savant.', en: 'Sand, water, seeds, ice and sun: make your own scientist discoveries.' },
    from: '#f6d365',
    to: '#fda085',
    tag: { fr: 'Sciences · expériences', en: 'Science · experiments' },
  },
  {
    href: '/monde/nid',
    emoji: '🏡',
    title: { fr: 'Le Nid de mon compagnon', en: 'My Companion’s Nest' },
    text: { fr: 'Prends soin de ton compagnon en 3D : il grandit quand toi tu apprends.', en: 'Care for your companion in 3D: it grows as you learn.' },
    from: '#84fab0',
    to: '#3fbf6a',
    tag: { fr: '3D · soin', en: '3D · care' },
  },
  {
    href: '/monde/histoires',
    emoji: '📚',
    title: { fr: 'Invente une histoire', en: 'Invent a story' },
    text: { fr: 'Choisis un héros, un lieu, un ami : Ziggy raconte ton histoire.', en: 'Pick a hero, a place, a friend: Ziggy tells your story.' },
    from: '#89f7fe',
    to: '#5fb6ea',
    tag: { fr: 'Récit · lecture', en: 'Story · reading' },
  },
  {
    href: '/monde/avatar',
    emoji: '🧑‍🎨',
    title: { fr: 'Mon avatar', en: 'My avatar' },
    text: { fr: 'Crée ton personnage d’aventurier : cheveux, tenue, style…', en: 'Create your explorer: hair, outfit, style…' },
    from: '#fbc2eb',
    to: '#ba68c8',
    tag: { fr: 'Personnalisation', en: 'Customisation' },
  },
];

const T = {
  eyebrow: { fr: 'L’Atelier des créateurs', en: 'The Makers’ Workshop' },
  title: { fr: 'Ici, c’est toi qui inventes !', en: 'Here, you are the inventor!' },
  subtitle: { fr: 'Pas de bonne ou de mauvaise réponse : dessine, compose, expérimente et construis.', en: 'No right or wrong answer: draw, compose, experiment and build.' },
} satisfies Record<string, L>;

/** All the open-ended play in one place — the "toy box" of Ziggy. */
export function CreateHub() {
  const locale = useLocale();
  return (
    <AppPage eyebrow={<>✨ {tr(T.eyebrow, locale)}</>} title={tr(T.title, locale)} subtitle={tr(T.subtitle, locale)} color="#FF6A88">
      <div className="-mt-6 mb-6 flex justify-center">
        <SayButton texts={[tr(T.title, locale), tr(T.subtitle, locale)]} locale={locale} />
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {APPS.map((a, i) => (
          <motion.li key={a.href} initial={{ opacity: 0, y: 24, rotateX: -12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.06 * i, type: 'spring', stiffness: 120, damping: 16 }}>
            <Tilt3D className="h-full rounded-[2rem]">
              <Link
                href={a.href}
                className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] p-6 text-white shadow-xl focus-visible:outline focus-visible:outline-4 focus-visible:outline-white/70"
                style={{ background: `linear-gradient(140deg, ${a.from}, ${a.to})` }}
              >
                <motion.span
                  className="mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-white/25 text-5xl shadow-inner [transform:translateZ(40px)]"
                  animate={{ y: [0, -6, 0], rotate: [0, i % 2 ? 5 : -5, 0] }}
                  transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden="true"
                >
                  {a.emoji}
                </motion.span>
                <span className="text-xs font-bold uppercase tracking-widest text-white/80">{tr(a.tag, locale)}</span>
                <span className="mt-1 font-display text-2xl font-bold drop-shadow">{tr(a.title, locale)}</span>
                <span className="mt-2 flex-1 text-white/90">{tr(a.text, locale)}</span>
                <span className="mt-5 inline-flex w-fit rounded-full bg-white px-5 py-2 font-bold text-[#2a1650] transition group-hover:scale-105">▶ {locale === 'fr' ? 'Créer' : 'Create'}</span>
              </Link>
            </Tilt3D>
          </motion.li>
        ))}
      </ul>
    </AppPage>
  );
}
