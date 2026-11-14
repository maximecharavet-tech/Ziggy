import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';
import { routing } from '@/i18n/routing';
import { FULLY_TRANSLATED_LOCALES, isFullyTranslated } from '@/i18n/config';
import { WORLDS } from '@/data/worlds';
import { ARCADE_GAME_IDS } from '@/lib/arcade/types';
import { DODO_STORIES } from '@/data/dodo';
import { GAMES } from '@/lib/games';
import { localeUrl } from '@/lib/seo';
import { FR_LANDING_PATHS } from '@/data/landings';

// Public, indexable pages only. Not listed: login/signup/account/owner (noindex),
// /agents*, /hyper and /monde/jouer?… (query-driven quest pages).
// No lastmod / changefreq / priority: we have no real per-page modification date,
// and uniform values are ignored by search engines.
const MAIN = ['', '/monde', '/monde/arcade', '/creer', '/creer/creatures', '/pere-noel', '/pere-noel/lettre', '/pere-noel/appel', '/pere-noel/photo', '/pere-noel/avent', '/pere-noel/certificat', '/lutins', '/coloriage', '/dodo', '/apprendre', '/lab', '/telecharger', '/games', '/privacy', '/terms', '/cookies'];
const PLAY = [
  '/monde/3d/noel',
  '/monde/3d/luge',
  '/monde/3d/kart',
  '/monde/3d/planetes',
  '/monde/3d/grand-huit',
  '/monde/3d/dino',
  '/monde/3d/detective',
  '/monde/3d/pizza',
  '/monde/ziggy-plateforme',
  '/monde/musique',
  '/monde/bac-a-sable',
  '/monde/nid',
  '/monde/histoires',
  '/monde/avatar',
  '/monde/compagnons',
  ...WORLDS.map((w) => `/monde/${w.id}`),
  ...ARCADE_GAME_IDS.map((g) => `/monde/arcade/${g}`),
  ...DODO_STORIES.map((s) => `/dodo/${s.id}`),
  ...GAMES.map((g) => `/games/${g.id}`),
];

/** Every indexable page path (without locale). */
export const SITEMAP_PATHS: readonly string[] = [...MAIN, ...PLAY];

/**
 * One sitemap per fully translated language (`/sitemap/fr.xml`, `/sitemap/en.xml`);
 * `/sitemap.xml` is the index (src/app/sitemap.xml/route.ts). The other locales are
 * noindex and not listed (see FULLY_TRANSLATED_LOCALES).
 */
export async function generateSitemaps() {
  return FULLY_TRANSLATED_LOCALES.map((id) => ({ id }));
}

/** The entries of one language's sitemap; hreflang lists the translated languages only. */
export function sitemapEntries(locale: string): MetadataRoute.Sitemap {
  const alternates = (path: string) => ({ languages: Object.fromEntries(FULLY_TRANSLATED_LOCALES.map((l) => [l, localeUrl(SITE_URL, l, path)])) });
  const entries: MetadataRoute.Sitemap = SITEMAP_PATHS.map((path) => ({ url: localeUrl(SITE_URL, locale, path), alternates: alternates(path) }));
  // French-only landing pages (no translation yet): one URL each, no hreflang.
  if (locale === routing.defaultLocale) entries.push(...FR_LANDING_PATHS.map((path) => ({ url: localeUrl(SITE_URL, locale, path) })));
  return entries;
}

// Next 15 passes the id as a string; later versions as a promise.
export default async function sitemap(props: { id: string | Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = String(await props.id);
  return isFullyTranslated(id) ? sitemapEntries(id) : [];
}
