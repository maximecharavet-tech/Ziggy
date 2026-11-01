import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LandingShell } from '@/components/seo/LandingShell';
import { LANDING_COPY } from '@/data/landings';
import { landingBreadcrumb, landingMetadata } from '@/lib/landing';
import { GAMES } from '@/lib/games';
import { ARCADE_GAMES } from '@/lib/arcade/registry';
import { tr } from '@/lib/i18n-text';

const PATH = '/jeux-educatifs-enfants' as const;
const GAMES_3D = [
  { href: '/monde/3d/kart', label: 'Ziggy Kart des lettres' },
  { href: '/monde/3d/luge', label: 'La Luge des nombres' },
  { href: '/monde/3d/grand-huit', label: 'Le Grand Huit des Nombres' },
  { href: '/monde/3d/planetes', label: 'Le Facteur des Planètes' },
  { href: '/monde/3d/pizza', label: 'La Pizzeria de Ziggy' },
  { href: '/monde/3d/dino', label: 'Ziggy Paléontologue' },
  { href: '/monde/3d/detective', label: 'Ziggy Détective' },
  { href: '/monde/3d/noel', label: 'Le Noël de Ziggy' },
];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return landingMetadata(locale, PATH);
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale: 'fr', namespace: 'games' });
  const c = LANDING_COPY[PATH];
  const mini = GAMES.map((g) => ({ href: `/games/${g.id}`, label: t(`${g.id}.name`), text: t(`${g.id}.description`) }));
  const arcade = Object.values(ARCADE_GAMES).map((g) => ({ href: `/monde/arcade/${g.id}`, label: tr(g.name, 'fr'), text: tr(g.description, 'fr') }));
  return (
    <LandingShell
      h1={c.h1}
      intro={c.intro}
      jsonLd={[landingBreadcrumb(PATH)]}
      sections={[
        { title: 'Les mini-jeux de Ziggy', links: mini },
        { title: 'L’arcade de Ziggy World', links: arcade },
        { title: 'Les jeux en 3D', links: GAMES_3D },
      ]}
    />
  );
}
