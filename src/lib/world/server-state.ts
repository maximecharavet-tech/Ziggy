import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyMemory, mergeMemory, normalizeMemory, WorldMemorySchema, type WorldMemory } from './memory';

/** World Memory in the database: one row per parent account (RLS: own row only). */

export async function loadMemory(sb: SupabaseClient): Promise<WorldMemory | null> {
  const { data, error } = await sb.from('ziggy_world_state').select('data').maybeSingle();
  if (error) throw new Error('load_failed');
  return data ? normalizeMemory(data.data) : null;
}

export async function saveMemory(sb: SupabaseClient, userId: string, m: WorldMemory): Promise<void> {
  const valid = WorldMemorySchema.parse(m);
  const { error } = await sb.from('ziggy_world_state').upsert({ user_id: userId, data: valid, updated_at: new Date().toISOString() });
  if (error) throw new Error('save_failed');
}

/** The account's memory, merged with what this device brings (never loses progress). */
export async function syncMemory(sb: SupabaseClient, userId: string, device?: WorldMemory | null): Promise<WorldMemory> {
  const stored = await loadMemory(sb);
  const merged = stored && device ? mergeMemory(stored, device) : (stored ?? device ?? emptyMemory());
  if (!stored || device) await saveMemory(sb, userId, merged);
  return merged;
}
