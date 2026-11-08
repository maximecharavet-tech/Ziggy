import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SantaParents } from '@/components/santa/parents/SantaParents';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale === 'fr';
  return {
    title: fr ? 'Espace parents — L’appli du Père Noël | Ziggy' : 'Parents’ area — Santa’s app | Ziggy',
    description: fr
      ? 'Le pass de la famille, les prénoms et les moments de fierté de vos enfants, l’appel en direct et vos données : l’espace parents de l’appli du Père Noël.'
      : 'Your family pass, your children’s first names and proud moments, the live call and your data: the parents’ area of Santa’s app.',
    robots: { index: false, follow: false },
    alternates: alternatesFor(locale, '/pere-noel/parents'),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SantaParents />;
}
