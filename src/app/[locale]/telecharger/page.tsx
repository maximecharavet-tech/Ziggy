import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DownloadPage } from '@/components/download/DownloadPage';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'Les applis Ziggy — Android, Android TV, iPhone et iPad',
          description: 'Ziggy sur le téléphone, la tablette et la télévision : téléchargez l’appli Android, et ajoutez Ziggy à l’écran d’accueil de l’iPhone et de l’iPad.',
        }
      : {
          title: 'The Ziggy apps — Android, Android TV, iPhone and iPad',
          description: 'Ziggy on phones, tablets and TVs: download the Android app, and add Ziggy to the home screen of iPhone and iPad.',
        }),
    alternates: alternatesFor(locale, '/telecharger'),
  };
}

export default async function TelechargerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DownloadPage />;
}
