import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SANTA_ART, imageSources, videoSources } from './art';

const pub = (p: string) => join(process.cwd(), 'public', p);

describe('santa art manifest', () => {
  it('ships every encoding of every available slot', () => {
    for (const a of SANTA_ART.filter((x) => x.available)) {
      if (a.kind === 'image') {
        const s = imageSources(a.path);
        for (const part of [s.avif, s.webp]) for (const src of part.split(', ').map((x) => x.split(' ')[0]!)) expect(existsSync(pub(src)), src).toBe(true);
      } else {
        for (const v of videoSources(a.path)) expect(existsSync(pub(v.src)), v.src).toBe(true);
        expect(a.poster && existsSync(pub(a.poster)), `${a.id} poster`).toBe(true);
      }
    }
  });
  it('builds responsive sources', () => {
    expect(imageSources('/santa/art/x.webp')).toEqual({ avif: '/santa/art/x-800.avif 800w, /santa/art/x.avif 1600w', webp: '/santa/art/x-800.webp 800w, /santa/art/x.webp 1600w', src: '/santa/art/x.webp' });
    expect(videoSources('/santa/art/v.mp4').map((s) => s.type)).toEqual(['video/mp4', 'video/webm']);
  });
});
