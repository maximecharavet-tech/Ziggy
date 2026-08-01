import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { OwnerDashboard } from './OwnerDashboard';

export const metadata: Metadata = {
  title: 'Owner — Ziggy',
  robots: { index: false, follow: false },
};

export default async function OwnerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OwnerDashboard />;
}
