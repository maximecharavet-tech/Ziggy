import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PlatformerPlayer } from '@/components/platformer/PlatformerPlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'Ziggy et les Étoiles Perdues : jeu de plateforme pour enfants | Ziggy',
          description: 'Saute, glisse et rebondis avec Ziggy à travers 7 mondes pour retrouver les étoiles perdues.',
        }
      : {
          title: 'Ziggy and the Lost Stars — platform game',
          description: 'Jump, dash and bounce with Ziggy through 7 worlds to find the lost stars.',
        }),
    alternates: alternatesFor(locale, '/monde/ziggy-plateforme'),
  };
}

export default async function ZiggyPlatformerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlatformerPlayer />;
}
