import 'server-only';
import { getServerSupabase } from './supabase-server';
import { DEFAULT_SITE_CONFIG, normaliseSiteConfig, type SiteConfig } from './site-config';

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
