import { getServerSupabase } from '@/lib/supabase-server';
import { DODO_BUCKET } from '@/lib/dodo/prepare';

/**
 * Mode dodo manifest: which illustrations and narrations are ready, as public
 * URLs. Shared by everyone and cached briefly at the edge.
 */
export const revalidate = 300;

export type DodoManifest = {
  images: Record<string, Record<number, string>>;
  audio: Record<string, Record<string, Record<number, string>>>;
};

export async function GET() {
  const empty: DodoManifest = { images: {}, audio: {} };
  const sb = getServerSupabase(6000);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!sb || !base) return Response.json(empty);
  const { data, error } = await sb.from('ziggy_dodo_assets').select('story_id, scene, kind, locale, path, created_at').limit(5000);
  if (error || !data) return Response.json(empty, { headers: { 'cache-control': 'public, max-age=60' } });
  const out: DodoManifest = { images: {}, audio: {} };
  for (const r of data) {
    // The version stamp makes a regenerated file bypass caches.
    const url = `${base}/storage/v1/object/public/${DODO_BUCKET}/${r.path}?v=${new Date(r.created_at).getTime().toString(36)}`;
    if (r.kind === 'image') (out.images[r.story_id] ??= {})[r.scene] = url;
    else ((out.audio[r.story_id] ??= {})[r.locale] ??= {})[r.scene] = url;
  }
  return Response.json(out, { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
}
