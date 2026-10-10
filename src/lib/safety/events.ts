import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logEvent } from '@/lib/analytics/log';

/**
 * SafetyEvent: that something was blocked, in which operation and category —
 * never the text itself, never a photo. Logged anonymously, and stored for
 * the parent console (row-level security: the parent's own rows only).
 */
export async function recordSafetyEvent(e: { operation: string; category: string; sb?: SupabaseClient | null }) {
  logEvent({ kind: 'safety', operation: e.operation, status: 'blocked', detail: e.category });
  if (!e.sb) return;
  await e.sb.from('ziggy_safety_events').insert({ operation: e.operation, category: e.category });
}
