import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ParentConsole } from '@/components/world/ParentConsole';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: `${locale === 'fr' ? 'Espace parents' : 'Parents’ area'} — Ziggy World`, robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ParentConsole />;
}
