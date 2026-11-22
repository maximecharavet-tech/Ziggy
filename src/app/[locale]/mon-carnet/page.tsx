import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { JournalApp } from '@/components/journal/JournalApp';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? { title: 'Mon carnet de découvertes — Ziggy', description: 'Toutes les découvertes de ton enfant dans Ziggy, en autocollants, et une histoire du soir faite de sa journée. Tout reste sur l’appareil.' }
      : { title: 'My discovery book — Ziggy', description: 'Every discovery your child made in Ziggy, as stickers, and a bedtime story made of their day. Everything stays on the device.' }),
    // A child's own album, read on the device: not a page for search engines.
    robots: { index: false, follow: true },
  };
}

export default async function JournalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <JournalApp />;
}
