/**
 * Owner-editable site settings.
 *
 * The single `site_settings` row is publicly readable and only the owner can
 * change it (enforced by row level security). The landing page reads it on the
 * server and is regenerated at most a minute later — or immediately, when the
 * owner dashboard asks /api/revalidate after saving.
 */
import { getServerSupabase } from './supabase';

export interface SiteConfig {
  stats: { children: string; sessions: string; countries: string; rating: string };
  sections: { showcase: boolean; agents: boolean; games: boolean; reviews: boolean; pricing: boolean };
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  stats: { children: '50K+', sessions: '2M+', countries: '45+', rating: '4.9/5' },
  sections: { showcase: true, agents: true, games: true, reviews: true, pricing: true },
};

/** Merge untrusted JSON over the defaults, keeping only known keys of the right type. */
export function normaliseSiteConfig(raw: { stats?: unknown; sections?: unknown } | null | undefined): SiteConfig {
  const stats = { ...DEFAULT_SITE_CONFIG.stats };
  const sections = { ...DEFAULT_SITE_CONFIG.sections };
  const s = (raw?.stats ?? {}) as Record<string, unknown>;
  const v = (raw?.sections ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(stats) as (keyof SiteConfig['stats'])[]) {
    if (typeof s[k] === 'string' && (s[k] as string).trim()) stats[k] = (s[k] as string).trim().slice(0, 16);
  }
  for (const k of Object.keys(sections) as (keyof SiteConfig['sections'])[]) {
    if (typeof v[k] === 'boolean') sections[k] = v[k] as boolean;
  }
  return { stats, sections };
}

export async function fetchSiteConfig(): Promise<SiteConfig> {
  const sb = getServerSupabase();
  if (!sb) return DEFAULT_SITE_CONFIG;
  try {
    const { data, error } = await sb.from('site_settings').select('stats, sections').eq('id', 1).maybeSingle();
    if (error || !data) return DEFAULT_SITE_CONFIG;
    return normaliseSiteConfig(data);
  } catch {
    // Unreachable database (or a build machine without network): show the defaults.
    return DEFAULT_SITE_CONFIG;
  }
}
