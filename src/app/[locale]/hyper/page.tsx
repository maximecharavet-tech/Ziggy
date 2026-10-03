import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { HyperPageContent } from './HyperPageContent';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'hyper' });
  return {
    title: `${t('title')} — Ziggy`,
    description: t('subtitle'),
    // A brand page: kept out of search so it never competes with Ziggy's own pages.
    robots: { index: false, follow: true },
  };
}

export default async function HyperPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HyperPageContent />;
}
