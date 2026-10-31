import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GrandHuitPlayer } from '@/components/games3d/GrandHuitPlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'Le Grand Huit des Nombres — jeu 3D',
          description: 'Construis le trajet du wagonnet avec des rails +2, −1 ou ×2 et arrête Ziggy pile à la bonne gare, dans une fête foraine en 3D.',
        }
      : {
          title: 'The Number Coaster — 3D game',
          description: 'Build the cart’s ride with +2, −1 or ×2 rails and stop Ziggy right at the station, in a 3D fairground.',
        }),
    alternates: alternatesFor(locale, '/monde/3d/grand-huit'),
  };
}

export default async function GrandHuitPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GrandHuitPlayer />;
}
