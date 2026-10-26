import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { NoelPlayer } from '@/components/games3d/NoelPlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'Le Noël de Ziggy — jeu 3D',
          description: 'Livre les cadeaux du village enneigé et illumine le grand sapin, en 3D.',
        }
      : {
          title: 'Ziggy’s Christmas — 3D game',
          description: 'Deliver the presents in the snowy village and light up the big tree, in 3D.',
        }),
    alternates: alternatesFor(locale, '/monde/3d/noel'),
  };
}

export default async function NoelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NoelPlayer />;
}
