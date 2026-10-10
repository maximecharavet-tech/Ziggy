import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ArcadeHome } from '@/components/world/ArcadeHome';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Ziggy Arcade — Ziggy World',
    description: locale === 'fr' ? '20 jeux éducatifs qui s’adaptent à ton enfant.' : '20 learning games that adapt to your child.',
  };
}

export default async function ArcadePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ArcadeHome />;
}
