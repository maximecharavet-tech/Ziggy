import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { LoginPageContent } from './LoginPageContent';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: `${t('loginTitle')} — Ziggy`, description: t('loginSubtitle'), robots: { index: false } };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LoginPageContent />;
}
