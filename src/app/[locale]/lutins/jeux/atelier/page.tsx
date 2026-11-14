import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LutinFactoryPlayer } from '@/components/games3d/LutinFactoryPlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'L’Atelier des Lutins : jeu de logique 3D pour enfants | Ziggy',
          description: 'Construis la chaîne de machines des lutins et fabrique les jouets des lettres d’enfants : formes, couleurs, comptage, motifs et premiers pas en programmation. Sans échec, sans chrono.',
        }
      : {
          title: 'Elf Workshop — 3D logic game for kids | Ziggy',
          description: 'Build the elves’ machine line and make the toys from the children’s letters: shapes, colours, counting, patterns and first steps in coding. No failing, no timer.',
        }),
    alternates: alternatesFor(locale, '/lutins/jeux/atelier'),
  };
}

export default async function LutinFactoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LutinFactoryPlayer />;
}
