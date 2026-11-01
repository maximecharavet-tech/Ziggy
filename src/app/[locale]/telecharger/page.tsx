import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DownloadPage } from '@/components/download/DownloadPage';
import { alternatesFor, breadcrumbLd, localeUrl } from '@/lib/seo';
import { SITE_URL } from '@/lib/site-url';
import { APK_PATH, ANDROID_MIN } from '@/lib/downloads';
import { JsonLd } from '@/components/seo/JsonLd';

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
  const fr = locale === 'fr';
  const app = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'Ziggy',
    operatingSystem: `Android ${ANDROID_MIN}+`,
    applicationCategory: 'EducationalApplication',
    downloadUrl: `${SITE_URL}${APK_PATH}`,
    installUrl: localeUrl(SITE_URL, locale, '/telecharger'),
    inLanguage: locale,
    audience: { '@type': 'EducationalAudience', educationalRole: 'student' },
    publisher: { '@type': 'Organization', name: 'Ziggy Technologies SAS', url: SITE_URL },
  };
  const crumbs = breadcrumbLd(SITE_URL, locale, [{ name: fr ? 'Les applis Ziggy' : 'The Ziggy apps', path: '/telecharger' }]);
  return (
    <>
      <JsonLd data={[app, crumbs]} />
      <DownloadPage />
    </>
  );
}
