import { FULLY_TRANSLATED_LOCALES } from '@/i18n/config';

/** Sitemap index XML: one sitemap per fully translated language (see src/app/sitemap.ts). */
export function sitemapIndexXml(siteUrl: string): string {
  const items = FULLY_TRANSLATED_LOCALES.map((id) => `  <sitemap><loc>${siteUrl}/sitemap/${id}.xml</loc></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}
