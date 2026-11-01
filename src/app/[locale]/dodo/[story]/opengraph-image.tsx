import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { DODO_STORIES, getDodoStory } from '@/data/dodo';
import { tr } from '@/lib/i18n-text';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Mode dodo Ziggy';

export function generateStaticParams() {
  return DODO_STORIES.map((s) => ({ story: s.id }));
}

/**
 * Share image of one bedtime story: the story's own artwork when it ships a
 * cover (a JPEG copy sits next to it, since the renderer can't read WebP),
 * otherwise Ziggy with the story's title and teaser.
 */
export default async function OpengraphImage({ params }: { params: Promise<{ locale: string; story: string }> }) {
  const { locale, story } = await params;
  const s = getDodoStory(story);
  const title = s ? tr(s.title, locale) : 'Ziggy';
  const teaser = s ? tr(s.teaser, locale) : '';
  let art: string;
  try {
    if (!s?.cover) throw new Error('no cover');
    const jpg = await readFile(join(process.cwd(), 'public', s.cover.replace(/\.webp$/, '-og.jpg')));
    art = `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch {
    const png = await readFile(join(process.cwd(), 'public/mascot/og-ziggy.png'));
    art = `data:image/png;base64,${png.toString('base64')}`;
  }
  const isCover = art.startsWith('data:image/jpeg');

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px 0 70px', background: 'linear-gradient(135deg, #1B1446 0%, #2E2470 55%, #4B3A8F 100%)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: isCover ? 520 : 640 }}>
          <span style={{ fontSize: 28, color: '#F3D27A', fontWeight: 700 }}>{locale === 'fr' ? 'Mode dodo · Ziggy' : 'Bedtime · Ziggy'}</span>
          <span style={{ marginTop: 18, fontSize: 62, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.1 }}>{title}</span>
          <span style={{ marginTop: 22, fontSize: 28, color: '#D9D2FF', lineHeight: 1.3 }}>{teaser}</span>
        </div>
        {isCover ? (
          <img src={art} width={560} height={470} alt="" style={{ borderRadius: 32, objectFit: 'cover' }} />
        ) : (
          <img src={art} width={372} height={500} alt="" style={{ marginTop: 60 }} />
        )}
      </div>
    ),
    size
  );
}
