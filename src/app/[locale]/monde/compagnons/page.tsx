import { COMPANIONS } from '@/data/companions';
import { tr } from '@/lib/i18n-text';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { CompanionsPage } from '@/components/world/CompanionsPage';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...{
      title: locale === 'fr' ? 'Choisis ton compagnon de jeu | Ziggy World' : 'Companions — Ziggy World',
      description: `${locale === 'fr' ? 'Choisis le compagnon qui joue avec toi dans Ziggy World' : 'Pick the companion who plays with you in Ziggy World'}${locale === 'fr' ? ' : ' : ': '}${COMPANIONS.map((c) => tr(c.name, locale)).join(', ')}.`,
    },
    alternates: alternatesFor(locale, '/monde/compagnons'),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CompanionsPage />;
}
