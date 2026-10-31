import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { KartPlayer } from '@/components/games3d/KartPlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'Ziggy Kart des lettres — jeu 3D',
          description: 'Pilote le kart de Ziggy sur une route arc-en-ciel et passe sous les bonnes lettres pour écrire les mots, en 3D.',
        }
      : {
          title: 'Ziggy’s Letter Kart — 3D game',
          description: 'Drive Ziggy’s kart on a rainbow road and go under the right letters to spell the words, in 3D.',
        }),
    alternates: alternatesFor(locale, '/monde/3d/kart'),
  };
}

export default async function KartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <KartPlayer />;
}
