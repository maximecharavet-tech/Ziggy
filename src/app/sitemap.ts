import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';

const locales = ['fr', 'en', 'es', 'de', 'pt', 'it', 'nl', 'tr', 'ja', 'ko', 'zh', 'ar'];
const baseUrl = SITE_URL;

const routes = ['', '/demo', '/agents', '/agents/sales', '/agents/marketing', '/agents/finance', '/agents/accounting', '/agents/advertising', '/games', '/games/memory', '/games/math', '/games/logic', '/games/quiz', '/games/simon', '/games/coding', '/games/oddone', '/games/puzzle', '/signup', '/login', '/account', '/privacy', '/terms', '/cookies'];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const route of routes) {
    for (const locale of locales) {
      const path = locale === 'fr' ? route : `/${locale}${route}`;
      entries.push({
        url: `${baseUrl}${path || '/'}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'weekly' : 'monthly',
        priority: route === '' ? 1.0 : 0.7,
      });
    }
  }

  return entries;
}
