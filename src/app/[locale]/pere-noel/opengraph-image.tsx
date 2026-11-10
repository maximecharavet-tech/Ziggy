import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';
export const alt = 'L’appli du Père Noël — Ziggy';

/**
 * Share card for the Christmas campaign (TikTok, Instagram, WhatsApp links).
 * Pre-rendered JPEGs (~170 kB, vs ~1.5 MB as a runtime PNG — WhatsApp drops
 * heavy previews): ChatGPT visual public/santa/art/og-image.jpg + title,
 * one per language, in public/santa/art/og-{fr,en}.jpg.
 */
export default async function SantaOgImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Shipped with the function via outputFileTracingIncludes (next.config.ts).
  const file = await readFile(join(process.cwd(), 'public/santa/art', locale === 'fr' ? 'og-fr.jpg' : 'og-en.jpg'));
  return new Response(new Uint8Array(file), { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400, immutable' } });
}
