import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SantaCall } from '@/components/santa/call/SantaCall';
import { alternatesFor } from '@/lib/seo';
import type { CallKind } from '@/lib/santa/call-script';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? { title: 'Appel vidéo avec le Père Noël — l’appli du Père Noël de Ziggy', description: 'Le Père Noël appelle votre enfant en vidéo, l’appelle par son prénom, parle de sa liste et l’écoute répondre. Le son reste sur l’appareil.' }
      : { title: 'Video call with Santa — Ziggy’s Santa app', description: 'Santa video-calls your child, says their name, talks about their wish list and listens to their answers. Sound stays on the device.' }),
    alternates: alternatesFor(locale, '/pere-noel/appel'),
  };
}

const KINDS = ['liste', 'nouvelles', 'veille', 'message'] as const;

export default async function AppelPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ k?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { k } = await searchParams;
  const kind = (KINDS as readonly string[]).includes(k ?? '') ? (k as CallKind | 'message') : undefined;
  return <SantaCall initialKind={kind} />;
}
