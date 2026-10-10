import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * CostGuard: every AI generation is counted, priced (estimate) and capped —
 * per account per day and per month, and for the whole platform per month.
 * Limits come from the environment; the defaults are deliberately modest.
 */
export type Operation =
  | 'analyze_image'
  | 'generate_avatar'
  | 'generate_quest'
  | 'generate_story'
  | 'generate_game_content'
  | 'generate_world_scene';

/** Rough cost per call in USD (configurable), for budgeting — not billing. */
export const ESTIMATED_COST: Record<Operation, number> = {
  analyze_image: 0.002,
  generate_avatar: 0.04,
  generate_quest: 0.0015,
  generate_story: 0.003,
  generate_game_content: 0.002,
  generate_world_scene: 0.04,
};

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
export const limits = () => ({
  dailyGenerationLimit: num(process.env.ZIGGY_DAILY_GENERATION_LIMIT, 25),
  monthlyGenerationLimit: num(process.env.ZIGGY_MONTHLY_GENERATION_LIMIT, 300),
  platformMonthlyLimit: num(process.env.ZIGGY_PLATFORM_MONTHLY_LIMIT, 5000),
  dailyImageLimit: num(process.env.ZIGGY_DAILY_IMAGE_LIMIT, 4),
});

export type GuardResult = { ok: true } | { ok: false; reason: 'daily_limit' | 'monthly_limit' | 'platform_limit' | 'image_limit' };

export async function checkBudget(sb: SupabaseClient, userId: string, op: Operation): Promise<GuardResult> {
  const l = limits();
  const now = Date.now();
  const dayAgo = new Date(now - 86_400_000).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [day, month, images, totals] = await Promise.all([
    sb.from('ziggy_generations').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', dayAgo).neq('status', 'FAILED'),
    sb.from('ziggy_generations').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthStart).neq('status', 'FAILED'),
    sb
      .from('ziggy_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayAgo)
      .in('operation', ['generate_avatar', 'generate_world_scene'])
      .neq('status', 'FAILED'),
    sb.rpc('ziggy_generation_totals'),
  ]);
  if ((day.count ?? 0) >= l.dailyGenerationLimit) return { ok: false, reason: 'daily_limit' };
  if ((month.count ?? 0) >= l.monthlyGenerationLimit) return { ok: false, reason: 'monthly_limit' };
  if ((op === 'generate_avatar' || op === 'generate_world_scene') && (images.count ?? 0) >= l.dailyImageLimit) {
    return { ok: false, reason: 'image_limit' };
  }
  const platform = (totals.data as { month_count: number }[] | null)?.[0]?.month_count ?? 0;
  if (Number(platform) >= l.platformMonthlyLimit) return { ok: false, reason: 'platform_limit' };
  return { ok: true };
}

/** Usage summary for the parent console. */
export async function usageSummary(sb: SupabaseClient, userId: string) {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data } = await sb
    .from('ziggy_generations')
    .select('operation, status, estimated_cost, created_at')
    .eq('user_id', userId)
    .gte('created_at', monthStart);
  const rows = data ?? [];
  const byOperation: Record<string, number> = {};
  let cost = 0;
  for (const r of rows) {
    if (r.status === 'FAILED') continue;
    byOperation[r.operation] = (byOperation[r.operation] ?? 0) + 1;
    cost += Number(r.estimated_cost) || 0;
  }
  return { generationCount: rows.filter((r) => r.status !== 'FAILED').length, estimatedCost: Math.round(cost * 1000) / 1000, byOperation, limits: limits() };
}
