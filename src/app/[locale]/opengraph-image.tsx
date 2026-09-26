import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Ziggy — AI Learning for Kids';

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const mascot = await readFile(join(process.cwd(), 'public/mascot/og-ziggy.png'));
  const mascotSrc = `data:image/png;base64,${mascot.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 70px 0 80px',
          background: 'linear-gradient(135deg, #FFF4E2 0%, #FFD9A0 55%, #FBC9C4 100%)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: 400,
            background: 'radial-gradient(circle, rgba(34,197,94,0.25) 0%, rgba(34,197,94,0) 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -120,
            left: -80,
            width: 350,
            height: 350,
            borderRadius: 350,
            background: 'radial-gradient(circle, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0) 70%)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 640 }}>
          <span style={{ fontSize: 110, fontWeight: 800, color: '#3B2410', letterSpacing: -3, lineHeight: 1 }}>Ziggy</span>
          <div style={{ marginTop: 22, fontSize: 32, color: '#6B4A2B', lineHeight: 1.3, display: 'flex' }}>{t('description')}</div>
          <div
            style={{
              marginTop: 36,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 26px',
              borderRadius: 999,
              border: '2px solid rgba(233,196,106,0.7)',
              background: 'linear-gradient(160deg, #2B2208 0%, #3D300D 55%, #1E1805 100%)',
              fontSize: 26,
              fontWeight: 700,
              alignSelf: 'flex-start',
            }}
          >
            <span style={{ color: 'rgba(232,214,160,0.85)' }}>Powered by</span>
            <span style={{ color: '#F3D27A' }}>Hyper™ AI Engine</span>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mascotSrc} width={417} height={560} alt="" style={{ marginTop: 40 }} />
      </div>
    ),
    size
  );
}
