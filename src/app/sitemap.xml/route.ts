import { SITE_URL } from '@/lib/site-url';
import { sitemapIndexXml } from '@/lib/sitemap-index';

/** `/sitemap.xml`: the index of the per-language sitemaps (`/sitemap/fr.xml`, `/sitemap/en.xml`). */
export function GET() {
  return new Response(sitemapIndexXml(SITE_URL), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
}
