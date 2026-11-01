import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { TvHome } from '@/components/tv/TvHome';
import { readVoiceSummary } from '../dodo/voice-files';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'fr' ? 'Ziggy sur la télé' : 'Ziggy on TV',
    // The app's TV home, not a page of the website.
    robots: { index: false, follow: false },
  };
}

export default async function TvPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TvHome voices={await readVoiceSummary(locale)} />;
}
