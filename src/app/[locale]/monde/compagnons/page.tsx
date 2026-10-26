import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { CompanionsPage } from '@/components/world/CompanionsPage';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...{
      title: `${locale === 'fr' ? 'Compagnons' : 'Companions'} — Ziggy World`,
    },
    alternates: alternatesFor(locale, '/monde/compagnons'),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CompanionsPage />;
}
