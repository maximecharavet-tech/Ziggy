import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { CollectionPage } from '@/components/world/CollectionPage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: `${locale === 'fr' ? 'Ma collection' : 'My collection'} — Ziggy World` };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CollectionPage />;
}
