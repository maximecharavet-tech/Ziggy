import { describe, expect, it } from 'vitest';
import { breadcrumbLd, clampTitle, frSeoTitle, FR_GAME_KEYWORDS, localeUrl } from './seo';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('seo helpers', () => {
  it('builds French titles of at most 60 characters', () => {
    for (const n of ['Taquin', 'Jeu de mémoire', 'Un nom de jeu vraiment très très long pour tester la coupe']) {
      expect(frSeoTitle(n, FR_GAME_KEYWORDS).length).toBeLessThanOrEqual(60);
    }
    expect(frSeoTitle('Taquin', FR_GAME_KEYWORDS).length).toBeGreaterThanOrEqual(50);
  });
  it('clamps long titles', () => {
    expect(clampTitle('x '.repeat(50)).length).toBeLessThanOrEqual(60);
  });
  it('keeps the home trailing slash and prefixes other locales', () => {
    expect(localeUrl('https://a.fr', 'fr', '')).toBe('https://a.fr/');
    expect(localeUrl('https://a.fr', 'en', '/games')).toBe('https://a.fr/en/games');
    expect(breadcrumbLd('https://a.fr', 'fr', [{ name: 'Jeux', path: '/games' }]).itemListElement).toHaveLength(2);
  });
});

describe('robots & sitemap', () => {
  it('welcomes AI crawlers and keeps /api/ closed', () => {
    const rules = [robots().rules].flat();
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', '*']) {
      expect(rules.find((r) => r.userAgent === bot)?.disallow).toBe('/api/');
    }
  });
  it('lists no private or excluded page and no fake dates', () => {
    const urls = sitemap();
    expect(urls.some((u) => /\/(login|signup|account|agents|hyper|owner)(\/|$)|\/monde\/jouer/.test(u.url))).toBe(false);
    expect(urls.every((u) => !('lastModified' in u) && !('priority' in u))).toBe(true);
    expect(urls.filter((u) => u.url.endsWith('/histoires-du-soir'))).toHaveLength(1);
  });
});
