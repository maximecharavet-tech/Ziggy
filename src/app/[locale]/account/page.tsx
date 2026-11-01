import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { AccountPageContent } from './AccountPageContent';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return {
    ...{
      title: `${t('badge')} — Ziggy`,
      description: t('dashboardSubtitle'),
      robots: { index: false },
    },
    alternates: alternatesFor(locale, '/account'),
  };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountPageContent />;
}
