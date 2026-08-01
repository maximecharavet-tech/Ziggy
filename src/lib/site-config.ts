/**
 * Owner-editable site settings, stored in localStorage.
 *
 * These are presentation values the owner can tune without a deploy. They are
 * read by the components that display them, falling back to the defaults in
 * `src/lib/constants.ts` when nothing has been saved.
 */
import { STATS } from './constants';

export const SITE_CONFIG_KEY = 'ziggy:site-config';
export const SITE_CONFIG_EVENT = 'ziggy:site-config';

export interface SiteConfig {
  stats: {
    children: string;
    sessions: string;
    countries: string;
    rating: string;
  };
  /** Sections the owner can hide from the landing page. */
  sections: {
    showcase: boolean;
    agents: boolean;
    games: boolean;
    reviews: boolean;
    pricing: boolean;
  };
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  stats: {
    children: STATS.children,
    sessions: STATS.sessions,
    countries: STATS.countries,
    rating: STATS.rating,
  },
  sections: { showcase: true, agents: true, games: true, reviews: true, pricing: true },
};

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getSiteConfig(): SiteConfig {
  if (!isBrowser()) return DEFAULT_SITE_CONFIG;
  try {
    const raw = window.localStorage.getItem(SITE_CONFIG_KEY);
    if (!raw) return DEFAULT_SITE_CONFIG;
    const parsed = JSON.parse(raw) as Partial<SiteConfig>;
    return {
      stats: { ...DEFAULT_SITE_CONFIG.stats, ...(parsed.stats ?? {}) },
      sections: { ...DEFAULT_SITE_CONFIG.sections, ...(parsed.sections ?? {}) },
    };
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}

export function saveSiteConfig(config: SiteConfig): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(SITE_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(SITE_CONFIG_EVENT, { detail: config }));
  } catch {
    /* storage full or blocked — keep the in-memory value */
  }
}

export function resetSiteConfig(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(SITE_CONFIG_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(SITE_CONFIG_EVENT, { detail: DEFAULT_SITE_CONFIG }));
}
