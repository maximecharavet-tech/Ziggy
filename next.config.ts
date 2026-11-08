import { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { APK_PATH, APK_RELEASE_URL } from './src/lib/downloads';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Lets a dev server and a production build run side by side (NEXT_DIST_DIR=.next-dev).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // The share image reads the mascot from disk at request time.
  outputFileTracingIncludes: {
    '/[locale]/opengraph-image': ['./public/mascot/og-ziggy.png'],
    '/[locale]/pere-noel/opengraph-image': ['./public/mascot/og-ziggy.png'],
    '/[locale]/dodo/[story]/opengraph-image': ['./public/mascot/og-ziggy.png', './public/dodo/**/*-og.jpg'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // ziggy-ai.fr/apk: the Android app of the latest release (short enough to type with a TV remote).
  async redirects() {
    return [
      { source: APK_PATH, destination: APK_RELEASE_URL, permanent: false },
      // Short links for the Christmas campaign (TikTok bio, videos): ziggy-ai.fr/noel, /santa.
      { source: '/noel', destination: '/pere-noel', permanent: false },
      { source: '/santa', destination: '/en/pere-noel', permanent: false },
      // Search Console 404s: crawlers once read the price period ("/mois", "/Monat") and a stray "$" as links.
      { source: '/mois', destination: '/', permanent: true },
      { source: '/Monat', destination: '/', permanent: true },
      { source: '/\\$', destination: '/', permanent: true },
    ];
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // The service worker must always be re-checked, so updates reach everyone.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
      {
        source: '/(mascot|media)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
