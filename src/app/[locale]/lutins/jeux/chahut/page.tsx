import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LutinChaosPlayer } from '@/components/games3d/LutinChaosPlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'Le Grand Chahut des Lutins : jeu 3D de farces et d’enquête pour enfants | Ziggy',
          description:
            'Les lutins font des farces chez Ziggy ! Repère ce qui est rigolo, trouve le coupable grâce aux indices, attrape-le avec des chatouilles et répare tout : compter, trier, suites, logique, repérage dans l’espace.',
        }
      : {
          title: 'Elf Chaos: a 3D prank and detective game for kids | Ziggy',
          description:
            'The elves are pranking Ziggy’s house! Spot what looks silly, find the culprit from the clues, catch them with a tickle and fix everything: counting, sorting, patterns, logic and spatial words.',
        }),
    alternates: alternatesFor(locale, '/lutins/jeux/chahut'),
  };
}

export default async function LutinChaosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LutinChaosPlayer />;
}
