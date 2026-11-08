import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LutinsStudio } from '@/components/lutins/LutinsStudio';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'fr' ? 'L’atelier des lutins (parents)' : 'The elves’ workshop (parents)', robots: { index: false, follow: false } };
}

export default async function AtelierPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LutinsStudio />;
}
