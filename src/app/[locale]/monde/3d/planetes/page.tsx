import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PlanetesPlayer } from '@/components/games3d/PlanetesPlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'Le Facteur des Planètes — jeu 3D',
          description: 'Ziggy livre des colis dans le système solaire : trouve la bonne planète grâce aux énigmes, en 3D.',
        }
      : {
          title: 'The Planet Postman — 3D game',
          description: 'Ziggy delivers parcels across the solar system: solve the riddles to find the right planet, in 3D.',
        }),
    alternates: alternatesFor(locale, '/monde/3d/planetes'),
  };
}

export default async function PlanetesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlanetesPlayer />;
}
