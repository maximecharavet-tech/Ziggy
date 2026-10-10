import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Operation } from './cost-guard';
import { ESTIMATED_COST } from './cost-guard';
import { logEvent } from '@/lib/analytics/log';

/**
 * Generation capsule: the life of one AI generation, from QUEUED to
 * COMPLETED / FAILED, stored for the parent console and the CostGuard.
 * It records what and when — never the prompt, the photo or the output.
 */
export type CapsuleStatus = 'QUEUED' | 'PROCESSING' | 'VALIDATING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export class Capsule {
  private started = Date.now();
  private constructor(
    private sb: SupabaseClient | null,
    readonly id: string,
    readonly operation: Operation,
    readonly requestId: string,
    private provider: string
  ) {}

  static async open(sb: SupabaseClient | null, op: Operation, meta: { provider: string; world?: string; scene?: string; requestId: string }) {
    let id = meta.requestId;
    if (sb) {
      const { data } = await sb
        .from('ziggy_generations')
        .insert({ operation: op, provider: meta.provider, world: meta.world ?? null, scene: meta.scene ?? null, status: 'QUEUED' })
        .select('id')
        .single();
      if (data?.id) id = data.id as string;
    }
    return new Capsule(sb, id, op, meta.requestId, meta.provider);
  }

  async status(status: CapsuleStatus, extra: { safety?: 'passed' | 'blocked' | 'not_applicable'; error?: string; provider?: string } = {}) {
    if (extra.provider) this.provider = extra.provider;
    const done = status === 'COMPLETED' || status === 'FAILED';
    const cost = status === 'COMPLETED' ? ESTIMATED_COST[this.operation] : 0;
    if (done) {
      logEvent({
        kind: 'generation',
        operation: this.operation,
        status,
        requestId: this.requestId,
        latencyMs: Date.now() - this.started,
        provider: this.provider,
        estimatedCost: cost,
        detail: extra.error,
      });
    }
    if (!this.sb) return;
    await this.sb
      .from('ziggy_generations')
      .update({
        status,
        provider: this.provider,
        ...(extra.safety ? { safety_status: extra.safety } : {}),
        ...(extra.error ? { error_code: extra.error.slice(0, 60) } : {}),
        ...(done ? { latency_ms: Date.now() - this.started, estimated_cost: cost } : {}),
      })
      .eq('id', this.id);
  }
}
