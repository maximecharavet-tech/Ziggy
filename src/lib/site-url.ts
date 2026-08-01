/**
 * Where this deployment actually lives.
 *
 * Canonical links, the sitemap and the Open Graph image all need an absolute
 * URL, and hardcoding one means every preview and every non-production domain
 * advertises the wrong address. Vercel injects the real host, so prefer it and
 * fall back in order of how specific the answer is.
 */
export function getSiteUrl(): string {
  // Set this when a custom domain is in use — it always wins.
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  // The stable production host of the Vercel project, e.g. ziggy-jbwu.vercel.app
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // The per-deployment host — right for preview builds.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return 'http://localhost:3000';
}

export const SITE_URL = getSiteUrl();
