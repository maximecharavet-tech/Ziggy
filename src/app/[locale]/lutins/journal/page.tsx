import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LutinsJournal } from '@/components/lutins/LutinsJournal';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'fr' ? 'Le journal des lutins' : 'The elves’ journal', robots: { index: false, follow: false } };
}

export default async function JournalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LutinsJournal />;
}
