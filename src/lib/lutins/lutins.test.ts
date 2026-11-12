import { describe, expect, it, beforeEach, vi } from 'vitest';
import { findVideoUrl, readVideoStatus } from '@/lib/hyper-engine/providers/agnes-video';
import { takeUse, refundUse, LUTINS_LIMITS } from './limits';
import { cleanParentText } from './text';
import { signSource, checkSource } from './sign';
import { countPeople, PERSON_SCORE } from './people';
import { PRANKS, PRANK_CATEGORIES, prankById } from '@/data/lutins/pranks';
import bible from '@/data/lutins/bible.json';

describe('Agnes video answers', () => {
  it('finds the video wherever it is and reads the status', () => {
    expect(readVideoStatus({ status: 'processing' })).toEqual({ state: 'pending', url: null });
    expect(readVideoStatus({ status: 'FAILED' })).toEqual({ state: 'failed', url: null });
    expect(readVideoStatus({ status: 'succeeded', data: { video_url: 'https://cdn.x/a.mp4' } })).toEqual({ state: 'done', url: 'https://cdn.x/a.mp4' });
    expect(readVideoStatus({ status: 'completed', output: [{ url: 'https://cdn.x/b.webm?sig=1' }] }).url).toBe('https://cdn.x/b.webm?sig=1');
    expect(findVideoUrl({ a: { b: ['nope', 'https://x/thumb.png', 'https://x/video/123'] } })).toBe('https://x/video/123');
    expect(readVideoStatus({ status: 'succeeded' })).toEqual({ state: 'pending', url: null });
  });
});

describe('fair use', () => {
  beforeEach(() => vi.useRealTimers());
  it('counts per device, refunds, and caps', () => {
    const n = LUTINS_LIMITS().imagesPerDevice;
    const dev = 'testdevice' + Math.random().toString(36).slice(2, 10);
    for (let i = 0; i < n; i++) expect(takeUse('image', dev, '1.2.3.' + i).ok).toBe(true);
    expect(takeUse('image', dev, '9.9.9.9')).toEqual({ ok: false, reason: 'device' });
    refundUse('image', dev, '9.9.9.9');
    expect(takeUse('image', dev, '9.9.9.8').ok).toBe(true);
  });
  it('a new device id from the same address does not reset everything', () => {
    const ip = '5.6.7.' + Math.floor(Math.random() * 200);
    let ok = 0;
    for (let i = 0; i < 200; i++) if (takeUse('video', 'dev' + i + 'xxxxxxxxxx', ip).ok) ok++;
    expect(ok).toBeLessThan(200);
  });
});

describe('parent text, signatures, people', () => {
  it('cleans the parent’s idea', () => {
    expect(cleanParentText('  ils font du <b>ski</b> https://evil.example/x  ')).toBe('ils font du b ski /b');
    expect(cleanParentText('a'.repeat(400))).toHaveLength(240);
    expect(cleanParentText(42)).toBe('');
  });
  it('signs only with a key, and checks', () => {
    process.env.LUTINS_SECRET = 'k'.repeat(40);
    const sig = signSource('https://x/a.png')!;
    expect(checkSource('https://x/a.png', sig)).toBe(true);
    expect(checkSource('https://x/b.png', sig)).toBe(false);
    expect(checkSource('https://x/a.png', 'nope')).toBe(false);
  });
  it('counts real people, ignores specks', () => {
    const area = 1000 * 1000;
    expect(countPeople([{ score: 0.9, box: { x: 0, y: 0, w: 200, h: 400 } }], area).people).toBe(1);
    expect(countPeople([{ score: PERSON_SCORE - 0.01, box: { x: 0, y: 0, w: 200, h: 400 } }], area).people).toBe(0);
    expect(countPeople([{ score: 0.9, box: { x: 0, y: 0, w: 20, h: 20 } }], area).people).toBe(0);
  });
});

describe('prank catalogue and bible', () => {
  it('has about a hundred pranks in about a dozen places, the first 37 ids kept', () => {
    expect(PRANKS.length).toBeGreaterThanOrEqual(100);
    expect(PRANK_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    for (const c of PRANK_CATEGORIES) expect(PRANKS.filter((p) => p.cat === c.id).length).toBeGreaterThanOrEqual(3);
    for (const id of ['papier-toilette', 'cache-cache', 'livres', 'cereales', 'canard', 'sapin-decoration', 'reveil', 'chocolat-chaud']) expect(prankById(id)).not.toBeNull();
  });
  it('has unique ids, a known category, FR+EN titles and gentle actions', () => {
    const ids = new Set(PRANKS.map((p) => p.id));
    expect(ids.size).toBe(PRANKS.length);
    const cats = new Set(PRANK_CATEGORIES.map((c) => c.id));
    for (const p of PRANKS) {
      expect(cats.has(p.cat)).toBe(true);
      expect(p.title.fr && p.title.en).toBeTruthy();
      expect(p.action.length).toBeGreaterThan(30);
      expect(`${p.action} ${p.motion}`.toLowerCase()).not.toMatch(/\b(knife|knives|fire|flames?|medicine|pills?|socket|electric|blood|broken|smash|fridge|climb\w*|window ledge|stairs|ladder|scissors|candles?|oven|stove|lighter|matches|blades?|bleach|rope|balcony|railing|poison|gun)\b/);
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.action).toMatch(/^(are|have|is) /);
    }
    expect(prankById('nope')).toBeNull();
  });
  it('the bible describes three original elves', () => {
    expect(bible.elves.map((e) => e.id)).toEqual(['pepin', 'grelotte', 'noisette']);
    for (const e of bible.elves) expect(e.look.length).toBeGreaterThan(150);
    expect(bible.negative).toMatch(/No people/);
  });
});
