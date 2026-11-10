import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AdventCalendar } from '@/components/santa/advent/AdventCalendar';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'fr' ? 'Calendrier de l’Avent du Pôle Nord' : 'North Pole Advent Calendar', description: locale === 'fr' ? 'Une petite histoire, une devinette ou un défi doux chaque jour.' : 'A little story, riddle or gentle challenge each day.', alternates: alternatesFor(locale, '/pere-noel/avent') };
}

export default async function AdventPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale); return <AdventCalendar />;
}
