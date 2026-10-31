import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DinoPlayer } from '@/components/games3d/DinoPlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'Ziggy Paléontologue — jeu 3D',
          description: 'Creuse le sable avec Ziggy, reconstruis les squelettes de dinosaures et regarde-les se réveiller, en 3D.',
        }
      : {
          title: 'Ziggy the Dino Digger — 3D game',
          description: 'Dig the sand with Ziggy, rebuild dinosaur skeletons and watch them wake up, in 3D.',
        }),
    alternates: alternatesFor(locale, '/monde/3d/dino'),
  };
}

export default async function DinoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DinoPlayer />;
}
