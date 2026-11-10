import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SantaLanding } from '@/components/santa/landing/SantaLanding';
import { alternatesFor, breadcrumbLd } from '@/lib/seo';
import { SITE_URL } from '@/lib/site-url';
import { JsonLd } from '@/components/seo/JsonLd';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale === 'fr';
  return {
    title: fr ? 'L’appli du Père Noël — lettre, appel vidéo et photo avec le Père Noël' : 'Santa’s app — letter, video call and photo with Santa',
    description: fr
      ? 'Votre enfant écrit sa lettre au Père Noël, reçoit un appel vidéo du Père Noël qui dit son prénom, et prend sa photo avec lui. Sans pub, la photo reste sur votre téléphone.'
      : 'Your child writes a letter to Santa, gets a video call from Santa who says their name, and takes a photo with him. No ads, the photo stays on your phone.',
    alternates: alternatesFor(locale, '/pere-noel'),
  };
}

export default async function PereNoelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const fr = locale === 'fr';
  const crumbs = breadcrumbLd(SITE_URL, locale, [{ name: fr ? 'L’appli du Père Noël' : 'Santa’s app', path: '/pere-noel' }]);
  return (
    <>
      <JsonLd data={[crumbs]} />
      <SantaLanding />
    </>
  );
}
