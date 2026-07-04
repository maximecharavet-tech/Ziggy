import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Ziggy — AI Learning for Kids';

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0A0A1A 0%, #12122A 60%, #0F2318 100%)',
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

        {/* Robot face */}
        <div
          style={{
            width: 150,
            height: 130,
            borderRadius: 40,
            background: '#F5F7FA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            marginBottom: 40,
            boxShadow: '0 0 80px rgba(34,197,94,0.4)',
          }}
        >
          <div style={{ width: 30, height: 30, borderRadius: 30, background: '#22C55E', display: 'flex' }} />
          <div style={{ width: 30, height: 30, borderRadius: 30, background: '#22C55E', display: 'flex' }} />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 72, fontWeight: 800, color: '#FFFFFF', letterSpacing: -2 }}>Ziggy</span>
          <div style={{ width: 20, height: 20, borderRadius: 20, background: '#22C55E', display: 'flex' }} />
        </div>

        <div
          style={{
            fontSize: 30,
            color: '#9CA3AF',
            maxWidth: 850,
            textAlign: 'center',
            display: 'flex',
          }}
        >
          {t('description')}
        </div>
      </div>
    ),
    size
  );
}
