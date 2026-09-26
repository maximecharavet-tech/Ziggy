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

        {/* Ziggy's plush head, as on the site */}
        <div
          style={{
            width: 170,
            height: 150,
            borderRadius: 80,
            background: 'radial-gradient(circle at 42% 30%, #A3DE7B 0%, #7FC85C 50%, #5AA83E 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            marginBottom: 40,
            boxShadow: '0 0 90px rgba(127,200,92,0.45)',
          }}
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                width: 50,
                height: 56,
                borderRadius: 50,
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 30, background: '#4F9E33', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 16, height: 16, borderRadius: 16, background: '#12100E', display: 'flex' }} />
              </div>
            </div>
          ))}
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

        <div
          style={{
            marginTop: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 26px',
            borderRadius: 999,
            border: '2px solid rgba(233,196,106,0.55)',
            background: 'linear-gradient(160deg, #2B2208 0%, #3D300D 55%, #1E1805 100%)',
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          <span style={{ color: 'rgba(232,214,160,0.8)' }}>Powered by</span>
          <span style={{ color: '#F3D27A' }}>Hyper™ AI Engine</span>
        </div>
      </div>
    ),
    size
  );
}
