import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { MagicCamera } from '@/components/lutins/MagicCamera';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'fr' ? 'La caméra magique des lutins (parents)' : 'The elves’ magic camera (parents)', robots: { index: false, follow: false } };
}

export default async function LutinsCameraPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MagicCamera />;
}
