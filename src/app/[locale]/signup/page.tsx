import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { SignupPageContent } from './SignupPageContent';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return {
    ...{
      title: `${t('signupTitle')} — Ziggy`,
      description: t('signupSubtitle'),
      robots: { index: false },
    },
    alternates: alternatesFor(locale, '/signup'),
  };
}

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignupPageContent />;
}
