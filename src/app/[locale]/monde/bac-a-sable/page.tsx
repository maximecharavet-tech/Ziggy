import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SandboxGame } from '@/components/sandbox/SandboxGame';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return locale === 'fr'
    ? { title: 'Le Bac à sable magique — Ziggy', description: 'Sable, eau, graines, glace et soleil : expérimente librement et note tes découvertes scientifiques dans ton carnet.' }
    : { title: 'The Magic Sandbox — Ziggy', description: 'Sand, water, seeds, ice and sunshine: experiment freely and collect your science discoveries in your notebook.' };
}

export default async function SandboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SandboxGame />;
}
