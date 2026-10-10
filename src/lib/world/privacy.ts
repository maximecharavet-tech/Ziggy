import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Deletions available to the parent. Each one removes rows and files for real. */

export async function deleteAvatars(sb: SupabaseClient, userId: string, onlyFromPhoto = false): Promise<number> {
  let q = sb.from('ziggy_avatars').select('id, image_path');
  if (onlyFromPhoto) q = q.eq('from_photo', true);
  const { data } = await q;
  const rows = data ?? [];
  const paths = rows.map((r) => r.image_path).filter(Boolean) as string[];
  if (!onlyFromPhoto) {
    // Also sweep any orphan file left in the family's folder.
    const listed = await sb.storage.from('ziggy-avatars').list(userId, { limit: 1000 });
    for (const f of listed.data ?? []) paths.push(`${userId}/${f.name}`);
  }
  const unique = [...new Set(paths)];
  if (unique.length) await sb.storage.from('ziggy-avatars').remove(unique);
  if (rows.length) await sb.from('ziggy_avatars').delete().in('id', rows.map((r) => r.id));
  return rows.length;
}

export async function deleteAllWorldData(sb: SupabaseClient, userId: string) {
  const avatars = await deleteAvatars(sb, userId);
  await Promise.all([
    sb.from('ziggy_stories').delete().eq('user_id', userId),
    sb.from('ziggy_world_state').delete().eq('user_id', userId),
    sb.from('ziggy_generations').delete().eq('user_id', userId),
    sb.from('ziggy_safety_events').delete().eq('user_id', userId),
    sb.from('ziggy_consents').delete().eq('user_id', userId),
  ]);
  return { avatars };
}
