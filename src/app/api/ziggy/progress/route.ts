import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, fail, limited, ok, readBody } from '@/lib/hyper-engine/route';
import { WorldMemorySchema, type WorldMemory } from '@/lib/world/memory';
import { syncMemory } from '@/lib/world/server-state';
import { COMPANIONS } from '@/data/companions';
import { unlockedCompanions } from '@/lib/world/engine';

/**
 * World Memory sync. GET: the account's memory. POST: merge this device's
 * memory into the account (best of both, nothing lost) and return it.
 * Companion choice is checked against what is really unlocked.
 */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  try {
    return ok({ memory: await syncMemory(auth.sb, auth.user.id) });
  } catch {
    return fail(503, 'storage_unavailable');
  }
}

const Body = z.object({ memory: WorldMemorySchema });

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  const rl = limited(request, auth, 'progress', 30, 60_000);
  if (rl) return rl;
  const body = await readBody(request, Body, 200_000);
  if (!body.ok) return body.res;
  const device = body.data.memory as WorldMemory;
  try {
    const merged = await syncMemory(auth.sb, auth.user.id, device);
    if (!unlockedCompanions(merged, COMPANIONS).includes(merged.companion)) merged.companion = 'dragon';
    return ok({ memory: merged });
  } catch {
    return fail(503, 'storage_unavailable');
  }
}
