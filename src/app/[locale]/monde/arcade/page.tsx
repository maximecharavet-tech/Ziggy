import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ARCADE_GAME_IDS } from '@/lib/arcade/types';
import { ArcadeHome } from '@/components/world/ArcadeHome';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...{
      title: 'Ziggy Arcade — Ziggy World',
      description: locale === 'fr' ? `${ARCADE_GAME_IDS.length} jeux éducatifs qui s’adaptent à ton enfant.` : `${ARCADE_GAME_IDS.length} learning games that adapt to your child.`,
    },
    alternates: alternatesFor(locale, '/monde/arcade'),
  };
}

export default async function ArcadePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ArcadeHome />;
}
