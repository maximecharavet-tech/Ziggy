import type { NextRequest } from 'next/server';
import { authenticate, fail, ok } from '@/lib/hyper-engine/route';
import { usageSummary } from '@/lib/hyper-engine/cost-guard';
import { loadMemory } from '@/lib/world/server-state';
import { engineMode } from '@/lib/hyper-engine/client';
import { deepseekReady } from '@/lib/hyper-engine/providers/deepseek';
import { nvidiaReady } from '@/lib/hyper-engine/providers/nvidia';
import { agnesReady } from '@/lib/hyper-engine/providers/agnes';

/**
 * Parent console data: progress, stories, avatars, consents, AI usage and
 * estimated cost, and what the safety shield blocked (categories only).
 * No psychological profile, no diagnosis — learning progress only.
 */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  await auth.sb.rpc('ziggy_expire_generations');
  const [memory, usage, stories, avatars, consents, safety, recent] = await Promise.all([
    loadMemory(auth.sb).catch(() => null),
    usageSummary(auth.sb, auth.user.id),
    auth.sb.from('ziggy_stories').select('id', { count: 'exact', head: true }),
    auth.sb.from('ziggy_avatars').select('id', { count: 'exact', head: true }),
    auth.sb.from('ziggy_consents').select('kind, granted_at').is('revoked_at', null),
    auth.sb.from('ziggy_safety_events').select('category, created_at').order('created_at', { ascending: false }).limit(50),
    auth.sb.from('ziggy_generations').select('id, operation, status, provider, world, safety_status, estimated_cost, latency_ms, created_at, expires_at').order('created_at', { ascending: false }).limit(20),
  ]);
  const blocked: Record<string, number> = {};
  for (const e of safety.data ?? []) blocked[e.category] = (blocked[e.category] ?? 0) + 1;
  return ok({
    memory,
    usage,
    counts: { stories: stories.count ?? 0, avatars: avatars.count ?? 0 },
    consents: Object.fromEntries((consents.data ?? []).map((c) => [c.kind, c.granted_at])),
    safety: { blocked, total: safety.data?.length ?? 0 },
    generations: recent.data ?? [],
    engine: { mode: engineMode(), text: deepseekReady() ? 'deepseek' : nvidiaReady() ? 'nvidia' : null, vision: nvidiaReady(), image: agnesReady() },
  });
}
