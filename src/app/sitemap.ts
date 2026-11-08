import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';
import { routing } from '@/i18n/routing';
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
const MAIN = ['', '/monde', '/monde/arcade', '/creer', '/creer/creatures', '/pere-noel', '/pere-noel/lettre', '/pere-noel/appel', '/pere-noel/photo', '/lutins', '/coloriage', '/dodo', '/apprendre', '/lab', '/telecharger', '/games', '/privacy', '/terms', '/cookies'];
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

export default function sitemap(): MetadataRoute.Sitemap {
  const multi = [...MAIN, ...PLAY].flatMap((path) =>
    routing.locales.map((locale) => ({
      url: localeUrl(SITE_URL, locale, path),
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, localeUrl(SITE_URL, l, path)])) },
    }))
  );
  // French-only landing pages (no translation yet): one URL each, no hreflang.
  const frOnly = FR_LANDING_PATHS.map((path) => ({ url: localeUrl(SITE_URL, routing.defaultLocale, path) }));
  return [...multi, ...frOnly];
}
