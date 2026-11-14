import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { CreaturesPlayer } from '@/components/games3d/CreaturesPlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'L’Usine à Créatures de Ziggy — jeu de création 3D',
          description: 'Fabrique des créatures loufoques en 3D avec Ziggy : pattes, ailes, yeux, chapeaux… donne-leur vie, prends-les en photo et fais défiler ta Parade.',
        }
      : {
          title: 'Ziggy’s Creature Factory — 3D creative game',
          description: 'Build silly 3D creatures with Ziggy: legs, wings, eyes, hats… bring them to life, take their photo and watch your Parade.',
        }),
    alternates: alternatesFor(locale, '/creer/creatures'),
  };
}

export default async function CreaturesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <h1 className="sr-only">{locale === 'fr' ? 'L’Usine à Créatures de Ziggy' : 'Ziggy’s Creature Factory'}</h1>
      <CreaturesPlayer />
    </>
  );
}
