import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SantaThanks } from '@/components/santa/parents/SantaThanks';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale === 'fr';
  return {
    title: fr ? 'C’est prêt ! — L’appli du Père Noël | Ziggy' : 'It’s ready! — Santa’s app | Ziggy',
    description: fr
      ? 'Votre pass de l’appli du Père Noël est prêt. Gardez ce lien pour le retrouver sur un autre appareil.'
      : 'Your Santa’s app pass is ready. Keep this link to use it on another device.',
    robots: { index: false, follow: false },
    alternates: alternatesFor(locale, '/pere-noel/merci'),
    // The page URL carries the restore code: never send it to other sites.
    referrer: 'no-referrer',
  };
}

/** Stripe's return URL and the pass restore link: /pere-noel/merci?session_id=cs_… */
export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ session_id?: string | string[] }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).session_id;
  const sid = typeof raw === 'string' && /^cs_(test|live)_[A-Za-z0-9]{8,240}$/.test(raw) ? raw : null;
  return <SantaThanks sessionId={sid} />;
}
