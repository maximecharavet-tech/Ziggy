'use client';

import { useEffect, useState } from 'react';
import { getSiteConfig, DEFAULT_SITE_CONFIG, SITE_CONFIG_EVENT, type SiteConfig } from '@/lib/site-config';

/**
 * Owner-editable settings. Starts from the defaults so the server render and
 * the first client render agree, then picks up any saved overrides.
 */
export function useSiteConfig(): SiteConfig {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);

  useEffect(() => {
    const read = () => setConfig(getSiteConfig());
    read();
    window.addEventListener(SITE_CONFIG_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(SITE_CONFIG_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, []);

  return config;
}
