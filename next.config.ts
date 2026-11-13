import { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { APK_PATH, APK_RELEASE_URL } from './src/lib/downloads';
import { defaultLocale, locales } from './src/i18n/config';

// Short links of L'appli du Père Noël: ziggy-ai.fr/appel, /avent, /certificat (and /en/appel…).
const SANTA_SHORT = '(appel|avent|certificat)';
const OTHER_LOCALES = locales.filter((l) => l !== defaultLocale).join('|');

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

const SANTA_PERMISSIONS = { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' };

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
    '/[locale]/pere-noel/opengraph-image': ['./public/santa/art/og-fr.jpg', './public/santa/art/og-en.jpg'],
    '/api/lutins/generate': ['./public/lutins/refs/sheet.png', './src/lib/lutins/wasm/lutins_core_full_bg.wasm'],
    '/api/lutins/**': ['./src/lib/lutins/wasm/lutins_core_full_bg.wasm'],
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
      { source: `/:page${SANTA_SHORT}`, destination: '/pere-noel/:page', permanent: false },
      { source: `/${defaultLocale}/:page${SANTA_SHORT}`, destination: '/pere-noel/:page', permanent: false },
      { source: `/:locale(${OTHER_LOCALES})/:page${SANTA_SHORT}`, destination: '/:locale/pere-noel/:page', permanent: false },
      // Search Console 404s: crawlers once read the price period ("/mois", "/Monat") and a stray "$" as links.
      { source: '/mois', destination: '/', permanent: true },
      { source: '/Monat', destination: '/', permanent: true },
      { source: '/\\$', destination: '/', permanent: true },
    ];
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // L'appli du Père Noël: the call listens with the microphone and shows the child's camera
      // (both stay on the device), and the photo booth uses the camera. Same origin only.
      { source: '/pere-noel/:path*', headers: [SANTA_PERMISSIONS] },
      { source: '/:locale/pere-noel/:path*', headers: [SANTA_PERMISSIONS] },
      // Les Lutins Farceurs: the parent photographs a room (camera only).
      { source: '/lutins/:path*', headers: [SANTA_PERMISSIONS] },
      { source: '/:locale/lutins/:path*', headers: [SANTA_PERMISSIONS] },
      // The service worker must always be re-checked, so updates reach everyone.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
      // The WebAssembly platformer is embedded by /monde/ziggy-plateforme in a same-origin iframe.
      {
        source: '/jeux/ziggy-plateforme/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
      // Santa's recorded voice: the site asks for each file with ?h=<hash of its words>.
      { source: '/santa/voice/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
      {
        source: '/(mascot|media|covers)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
