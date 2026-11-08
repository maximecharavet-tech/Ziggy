import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LutinsPortraits } from '@/components/lutins/LutinsPortraits';

export const metadata: Metadata = { title: 'Portraits des lutins (propriétaire)', robots: { index: false, follow: false } };

export default async function PortraitsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LutinsPortraits />;
}
