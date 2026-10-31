import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DetectivePlayer } from '@/components/games3d/DetectivePlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'Ziggy Détective — jeu 3D',
          description: 'Un gentil mystère au village : trouve les indices avec Ziggy, écarte les suspects et découvre qui a mangé le gâteau, en 3D.',
        }
      : {
          title: 'Detective Ziggy — 3D game',
          description: 'A gentle village mystery: find the clues with Ziggy, clear the suspects and discover who ate the cake, in 3D.',
        }),
    alternates: alternatesFor(locale, '/monde/3d/detective'),
  };
}

export default async function DetectivePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DetectivePlayer />;
}
