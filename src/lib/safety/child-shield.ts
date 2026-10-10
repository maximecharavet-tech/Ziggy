import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { classify, type SafetyCategory } from './policy';
import { nvidiaReady, nvidiaSafety } from '@/lib/hyper-engine/providers/nvidia';
import { recordSafetyEvent } from './events';

/**
 * ChildShield — the server-side gate in front of everything a child sees.
 *
 * 1. Local policy (fast, deterministic, all languages): every string of an
 *    AI answer is checked against SafetyPolicy.
 * 2. When NVIDIA is configured, a content-safety model gives a second
 *    opinion on the whole text.
 * Anything flagged is rejected — the orchestrator then falls back to local,
 * human-written content. Children never type free prompts: inputs are
 * predefined ids, validated by schema before any AI call.
 */
export type ShieldVerdict = { ok: true } | { ok: false; category: SafetyCategory | 'model_flagged' };

/** Every string inside a JSON value. */
export function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

export function localShield(value: unknown): ShieldVerdict {
  for (const s of collectStrings(value)) {
    const c = classify(s);
    if (c) return { ok: false, category: c };
  }
  return { ok: true };
}

export async function shield(value: unknown, operation: string, sb?: SupabaseClient | null): Promise<ShieldVerdict> {
  const local = localShield(value);
  if (!local.ok) {
    await recordSafetyEvent({ operation, category: local.category, sb });
    return local;
  }
  if (nvidiaReady()) {
    try {
      const verdict = await nvidiaSafety(collectStrings(value).join('\n'));
      if (verdict && !verdict.safe) {
        await recordSafetyEvent({ operation, category: 'model_flagged', sb });
        return { ok: false, category: 'model_flagged' };
      }
    } catch {
      // The model is a second opinion; the local policy already passed.
    }
  }
  return { ok: true };
}
