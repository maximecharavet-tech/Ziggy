import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AppHome } from '@/components/app/AppHome';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'fr' ? 'Ziggy — Accueil' : 'Ziggy — Home',
    // The app's home, not a page of the website.
    robots: { index: false, follow: false },
  };
}

export default async function AppHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AppHome />;
}
