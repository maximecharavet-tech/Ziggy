import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { AgentsPageContent } from './AgentsPageContent';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'agents' });
  return {
    ...{
      title: t('pageTitle'),
      description: t('pageSubtitle'),
    },
    alternates: alternatesFor(locale, '/agents'),
  };
}

export default async function AgentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AgentsPageContent />;
}
