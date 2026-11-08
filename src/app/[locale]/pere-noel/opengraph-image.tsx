import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'L’appli du Père Noël — Ziggy';

const FLAKES = Array.from({ length: 60 }, (_, i) => ({ x: (i * 97) % 1200, y: (i * 61) % 630, r: 2 + (i % 4) * 1.5, o: 0.35 + (i % 5) * 0.12 }));

/** Share card for the Christmas campaign (links posted on TikTok, Instagram, WhatsApp). */
export default async function SantaOgImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const fr = locale === 'fr';
  const mascot = await readFile(join(process.cwd(), 'public/mascot/og-ziggy.png'));
  const mascotSrc = `data:image/png;base64,${mascot.toString('base64')}`;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 70px', position: 'relative', background: 'radial-gradient(120% 120% at 20% 0%, #3b2385 0%, #17124a 55%, #0b0a26 100%)' }}>
        {FLAKES.map((f, i) => (
          <div key={i} style={{ position: 'absolute', left: f.x, top: f.y, width: f.r * 2, height: f.r * 2, borderRadius: 99, background: 'white', opacity: f.o, display: 'flex' }} />
        ))}
        <div style={{ position: 'absolute', top: -140, right: 160, width: 520, height: 420, borderRadius: 520, background: 'radial-gradient(circle, rgba(64,255,190,0.28) 0%, rgba(64,255,190,0) 70%)', display: 'flex' }} />
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 700 }}>
          <div style={{ display: 'flex', alignSelf: 'flex-start', background: '#fcc419', color: '#3b1f00', fontSize: 28, fontWeight: 800, padding: '8px 22px', borderRadius: 40 }}>{fr ? 'Nouveau pour Noël' : 'New for Christmas'}</div>
          <div style={{ marginTop: 26, fontSize: 92, fontWeight: 800, color: 'white', lineHeight: 1, letterSpacing: -2, display: 'flex' }}>{fr ? 'L’appli du Père Noël' : 'Santa’s app'}</div>
          <div style={{ marginTop: 24, fontSize: 38, color: '#e9e3ff', lineHeight: 1.3, display: 'flex' }}>{fr ? 'Sa lettre · un appel vidéo du Père Noël · une photo avec lui' : 'A letter · a video call from Santa · a photo with him'}</div>
          <div style={{ marginTop: 36, display: 'flex', alignSelf: 'flex-start', background: 'linear-gradient(90deg,#c92a2a,#f03e3e)', color: 'white', fontSize: 34, fontWeight: 800, padding: '16px 34px', borderRadius: 60 }}>ziggy-ai.fr/noel</div>
        </div>
        <img src={mascotSrc} width={380} height={380} style={{ objectFit: 'contain' }} alt="" />
      </div>
    ),
    size
  );
}
