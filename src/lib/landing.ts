import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';
import { LANDING_COPY, type LandingPath } from '@/data/landings';
import { SITE_URL } from '@/lib/site-url';
import { breadcrumbLd } from '@/lib/seo';

/** French-only page: canonical is always the French URL; other locales are noindex. */
export function landingMetadata(locale: string, path: LandingPath): Metadata {
  const c = LANDING_COPY[path];
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: path },
    openGraph: { title: c.title, description: c.description, url: path, locale: 'fr', type: 'website', siteName: 'Ziggy', images: ['/fr/opengraph-image'] },
    ...(locale === routing.defaultLocale ? {} : { robots: { index: false, follow: true } }),
  };
}

export function landingBreadcrumb(path: LandingPath) {
  return breadcrumbLd(SITE_URL, routing.defaultLocale, [{ name: LANDING_COPY[path].crumb, path }]);
}
