import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DodoHome } from '@/components/dodo/DodoHome';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return locale === 'fr'
    ? { title: 'Mode dodo — Ziggy te raconte une histoire', description: '31 histoires du soir pleines de valeurs, racontées par Ziggy, avec des sons du sommeil.' }
    : { title: 'Bedtime mode — Ziggy tells you a story', description: '31 bedtime stories full of values, told by Ziggy, with sleep sounds.' };
}

export default async function DodoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DodoHome />;
}
