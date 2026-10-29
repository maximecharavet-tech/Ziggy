'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { DioramaCard } from './fx/DioramaCard';
import { fx, shade } from './fx/toy';
import { HubHero } from './HubHero';
import { AvatarScene, ColorScene, MusicScene, NestScene, SandScene, StoryScene } from './HubScenes';

type App = { href: string; title: L; text: L; from: string; to: string; tag: L; scene: (label: string) => ReactNode };

const APPS: App[] = [
  {
    href: '/coloriage',
    title: { fr: 'Colorie avec Ziggy', en: 'Colour with Ziggy' },
    text: { fr: 'Colorie, dessine, colle des gommettes… et regarde ton dessin prendre vie en 3D !', en: 'Colour, draw, add stickers… and watch your drawing come to life in 3D!' },
    from: '#ff9a8b',
    to: '#ff5f86',
    tag: { fr: 'Dessin · 3D', en: 'Drawing · 3D' },
    scene: () => <ColorScene />,
  },
  {
    href: '/monde/musique',
    title: { fr: 'La Fabrique à chansons', en: 'The Song Factory' },
    text: { fr: 'Compose ta musique avec l’orchestre des animaux. Aucune note ne sonne faux !', en: 'Make music with the animal band. No note can sound wrong!' },
    from: '#a18cd1',
    to: '#6f4ef0',
    tag: { fr: 'Musique · rythme', en: 'Music · rhythm' },
    scene: () => <MusicScene />,
  },
  {
    href: '/monde/bac-a-sable',
    title: { fr: 'Le Bac à sable magique', en: 'The Magic Sandbox' },
    text: { fr: 'Sable, eau, graines, glace et soleil : fais tes propres découvertes de savant.', en: 'Sand, water, seeds, ice and sun: make your own scientist discoveries.' },
    from: '#f7c948',
    to: '#fb8b5b',
    tag: { fr: 'Sciences · expériences', en: 'Science · experiments' },
    scene: () => <SandScene />,
  },
  {
    href: '/monde/nid',
    title: { fr: 'Le jardin de Ziggy', en: 'Ziggy’s Garden' },
    text: { fr: 'Prends soin de Ziggy en 3D : il grandit quand toi tu apprends.', en: 'Care for Ziggy in 3D: he grows as you learn.' },
    from: '#6fdc8c',
    to: '#2fa865',
    tag: { fr: '3D · soin', en: '3D · care' },
    scene: () => <NestScene />,
  },
  {
    href: '/monde/histoires',
    title: { fr: 'Invente une histoire', en: 'Invent a story' },
    text: { fr: 'Choisis un héros, un lieu, un ami : Ziggy raconte ton histoire.', en: 'Pick a hero, a place, a friend: Ziggy tells your story.' },
    from: '#6fd6f7',
    to: '#3f8fe0',
    tag: { fr: 'Récit · lecture', en: 'Story · reading' },
    scene: () => <StoryScene />,
  },
  {
    href: '/monde/avatar',
    title: { fr: 'Mon avatar', en: 'My avatar' },
    text: { fr: 'Crée ton personnage d’aventurier : cheveux, tenue, style…', en: 'Create your explorer: hair, outfit, style…' },
    from: '#f9a8e0',
    to: '#a35bd6',
    tag: { fr: 'Personnalisation', en: 'Customisation' },
    scene: (label) => <AvatarScene label={label} />,
  },
];

const T = {
  eyebrow: { fr: 'L’Atelier des créateurs', en: 'The Makers’ Workshop' },
  title: { fr: 'Ici, c’est toi qui inventes !', en: 'Here, you are the inventor!' },
  subtitle: { fr: 'Pas de bonne ou de mauvaise réponse : dessine, compose, expérimente et construis.', en: 'No right or wrong answer: draw, compose, experiment and build.' },
  create: { fr: 'Créer', en: 'Create' },
  pick: { fr: 'Choisis ton atelier', en: 'Pick your workshop' },
} satisfies Record<string, L>;

/** All the open-ended play in one place — the "toy box" of Ziggy. */
export function CreateHub() {
  const locale = useLocale();
  return (
    <div className="relative min-h-screen overflow-clip px-4 pb-28 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_10%_8%,rgba(255,122,184,0.16),transparent_70%),radial-gradient(50%_40%_at_95%_30%,rgba(95,182,234,0.16),transparent_70%),radial-gradient(60%_40%_at_40%_95%,rgba(255,212,71,0.16),transparent_70%)] dark:bg-[radial-gradient(60%_40%_at_10%_8%,rgba(255,122,184,0.12),transparent_70%),radial-gradient(50%_40%_at_95%_30%,rgba(95,182,234,0.12),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-6xl">
        <HubHero eyebrow={tr(T.eyebrow, locale)} title={tr(T.title, locale)} subtitle={tr(T.subtitle, locale)} locale={locale} />

        <h2 className="mt-14 flex items-center justify-center gap-3 font-display text-2xl font-bold text-text-body sm:text-3xl">
          <span aria-hidden="true" className={`inline-block ${fx.wiggle}`}>
            🧰
          </span>
          {tr(T.pick, locale)}
        </h2>

        <ul className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {APPS.map((a, i) => {
            const title = tr(a.title, locale);
            return (
              <li key={a.href}>
                <DioramaCard
                  href={a.href}
                  label={`${title}. ${tr(a.text, locale)}`}
                  from={a.from}
                  to={a.to}
                  index={i}
                  window={a.scene(title)}
                  corner={<SayButton texts={[title, tr(a.text, locale)]} locale={locale} size="md" className="!bg-white/90 !text-[#5FB6EA] shadow-[0_4px_0_rgba(0,0,0,0.12)] !ring-white" />}
                >
                  <span className="flex flex-1 flex-col px-1.5 pb-1.5 pt-4">
                    <span className="w-fit rounded-full bg-white/25 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">{tr(a.tag, locale)}</span>
                    <span className="mt-2 font-display text-[1.65rem] font-bold leading-tight [text-shadow:0_2px_0_rgba(0,0,0,0.14)]">{title}</span>
                    <span className="mt-1.5 flex-1 text-[0.98rem] leading-snug text-white/90">{tr(a.text, locale)}</span>
                    <span className={`${fx.toy} ${fx.light} ${fx.sheen} mt-5 inline-flex min-h-14 w-fit items-center gap-2 rounded-full px-6 font-display text-lg font-bold`} style={{ '--ink': shade(a.to, -0.35), '--delay': `${1 + i * 0.7}s` } as CSSProperties}>
                      <span aria-hidden="true">▶</span> {tr(T.create, locale)}
                    </span>
                  </span>
                </DioramaCard>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
