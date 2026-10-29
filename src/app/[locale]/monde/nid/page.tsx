import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { NidPlayer } from '@/components/games3d/nid/NidPlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'Le jardin de Ziggy — jeu 3D',
          description: 'Prends soin de Ziggy dans son petit jardin en 3D : il grandit quand tu apprends.',
        }
      : {
          title: 'Ziggy’s Garden — 3D game',
          description: 'Look after Ziggy in his little 3D garden: he grows when you learn.',
        }),
    alternates: alternatesFor(locale, '/monde/nid'),
  };
}

export default async function NidPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NidPlayer />;
}
