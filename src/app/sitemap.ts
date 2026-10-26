import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';
import { routing } from '@/i18n/routing';
import { WORLDS } from '@/data/worlds';
import { ARCADE_GAME_IDS } from '@/lib/arcade/types';
import { DODO_STORIES } from '@/data/dodo';
import { GAMES } from '@/lib/games';

// Public, indexable pages only (no login, account or owner pages).
const MAIN = ['', '/monde', '/monde/arcade', '/creer', '/coloriage', '/dodo', '/apprendre', '/lab', '/games', '/agents', '/privacy', '/terms', '/cookies'];
const PLAY = [
  '/monde/3d/noel',
  '/monde/3d/luge',
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

const href = (locale: string, path: string) => `${SITE_URL}${locale === routing.defaultLocale ? path || '/' : `/${locale}${path}`}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [...MAIN, ...PLAY].flatMap((path) =>
    routing.locales.map((locale) => ({
      url: href(locale, path),
      lastModified,
      changeFrequency: path === '' ? 'weekly' : 'monthly',
      priority: path === '' ? 1 : MAIN.includes(path) ? 0.8 : 0.6,
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, href(l, path)])) },
    }))
  );
}
