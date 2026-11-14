import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';

/** AI search / answer engines and assistants we explicitly welcome (same rules as everyone). */
const AI_AND_SEARCH_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Bingbot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...AI_AND_SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: '/', disallow: '/api/' })),
      { userAgent: '*', allow: '/', disallow: '/api/' },
    ],
    // The index lists one sitemap per fully translated language.
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
