import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { CollectionPage } from '@/components/world/CollectionPage';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...{
      title: `${locale === 'fr' ? 'Ma collection' : 'My collection'} — Ziggy World`,
    },
    alternates: alternatesFor(locale, '/monde/collection'),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CollectionPage />;
}
