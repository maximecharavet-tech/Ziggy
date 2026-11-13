import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { getServerSupabase } from '@/lib/supabase-server';

vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: vi.fn() }));
const getServer = vi.mocked(getServerSupabase);
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

function expectPenguinFallback(images: Record<string, Record<string, string>>) {
  for (const n of [4, 5, 6]) {
    expect(images.d10?.[n]).toBe(`/dodo/pingouins/${n}.jpg`);
    expect(existsSync(join('public', images.d10[n]))).toBe(true);
  }
}

describe('Mode dodo manifest with bundled illustrations', () => {
  it('ships the three missing penguin scenes even without Supabase', async () => {
    getServer.mockReturnValue(null);
    expectPenguinFallback((await (await GET()).json()).images);
  });

  it('keeps bundled scenes when the remote manifest fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    getServer.mockReturnValue({ from: () => ({ select: () => ({ limit: async () => ({ data: null, error: { message: 'offline' } }) }) }) } as never);
    expectPenguinFallback((await (await GET()).json()).images);
  });

  it('merges remote images and narration without losing bundled scenes', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    const rows = [
      { story_id: 'd10', scene: 1, kind: 'image', path: 'img/d10/1.jpg', locale: '-', created_at: '2026-11-08T00:00:00Z' },
      { story_id: 'lili', scene: 1, kind: 'audio', path: 'lili/fr/scene-1.wav', locale: 'fr', created_at: '2026-11-08T00:00:00Z' },
    ];
    getServer.mockReturnValue({ from: () => ({ select: () => ({ limit: async () => ({ data: rows, error: null }) }) }) } as never);
    const body = await (await GET()).json();
    expectPenguinFallback(body.images);
    expect(body.images.d10[1]).toContain('/ziggy-dodo/img/d10/1.jpg?v=');
    expect(body.audio.lili.fr[1]).toContain('/ziggy-dodo/lili/fr/scene-1.wav?v=');
  });

  it('prefers a subsequently published remote scene over the bundled fallback', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    const row = { story_id: 'd10', scene: 4, kind: 'image', path: 'img/d10/4.jpg', locale: '-', created_at: '2026-11-08T00:00:00Z' };
    getServer.mockReturnValue({ from: () => ({ select: () => ({ limit: async () => ({ data: [row], error: null }) }) }) } as never);
    const body = await (await GET()).json();
    expect(body.images.d10[4]).toContain('/ziggy-dodo/img/d10/4.jpg?v=');
    // Each request starts fresh: a remote override never mutates the bundled map.
    getServer.mockReturnValue(null);
    expectPenguinFallback((await (await GET()).json()).images);
  });
});
