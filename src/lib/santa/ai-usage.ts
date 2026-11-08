import 'server-only';
import { createHash } from 'node:crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { SANTA_AI_SECONDS } from './offer';
import type { SantaPass } from './pass';

/**
 * Live AI call minutes used by a Pack magique pass.
 *
 * Durable store: table `public.santa_ai_usage` (RLS on, no policies: nobody
 * reads it directly) written only through the SECURITY DEFINER function
 * `public.santa_use_seconds(p_pass_hash, p_seconds, p_cap)`, called with the
 * publishable key (supabase/migrations/20261108120000_santa_ai_usage.sql).
 * The row key is sha256(sid + SANTA_PASS_SECRET): unguessable without the
 * secret, and it says nothing about the family.
 *
 * Fallback while the migration is not applied (or Supabase is unreachable):
 * an in-memory count per server instance with a lower cap (10 min), so the
 * call still works but cannot run for long. On serverless, instances do not
 * share memory: apply the migration before selling Pack magique.
 */

export const AI_FALLBACK_CAP_SECONDS = 10 * 60;
/** Longest slice of call time one request may add (the RPC refuses more). */
export const AI_MAX_SPEND_SECONDS = 120;

export type AiUsage = { used: number; left: number; durable: boolean };

export function passHash(sid: string, secret: string): string {
  return createHash('sha256').update(sid + secret).digest('hex');
}

const memory = new Map<string, number>();
let downUntil = 0;

async function rpc(hash: string, seconds: number): Promise<number | null> {
  if (Date.now() < downUntil) return null;
  const sb = getServerSupabase(3000);
  if (!sb) return null;
  try {
    const { data, error } = await sb.rpc('santa_use_seconds', { p_pass_hash: hash, p_seconds: seconds, p_cap: SANTA_AI_SECONDS });
    if (error || typeof data !== 'number') throw new Error(error?.code ?? 'bad result');
    return data;
  } catch {
    // Function missing (migration not applied yet) or database unreachable: don't retry for a minute.
    downUntil = Date.now() + 60_000;
    return null;
  }
}

function fallback(hash: string, seconds: number): AiUsage {
  const used = Math.min(AI_FALLBACK_CAP_SECONDS, (memory.get(hash) ?? 0) + seconds);
  if (seconds > 0) memory.set(hash, used);
  if (memory.size > 5000) memory.delete(memory.keys().next().value!);
  return { used, left: Math.max(0, AI_FALLBACK_CAP_SECONDS - used), durable: false };
}

/**
 * Adds `seconds` (0–120, rounded) of live call time to the pass and returns
 * what is used and left. `seconds = 0` only reads. Not Pack magique → nothing left.
 */
export async function spendAiSeconds(pass: SantaPass, secret: string, seconds = 0): Promise<AiUsage> {
  if (pass.tier !== 'magique') return { used: 0, left: 0, durable: true };
  const s = Math.max(0, Math.min(AI_MAX_SPEND_SECONDS, Math.round(Number(seconds) || 0)));
  const hash = passHash(pass.sid, secret);
  const used = await rpc(hash, s);
  if (used === null) return fallback(hash, s);
  return { used, left: Math.max(0, SANTA_AI_SECONDS - used), durable: true };
}

/** Seconds of live call left (reads only). */
export async function aiSecondsLeft(pass: SantaPass, secret: string): Promise<number> {
  return (await spendAiSeconds(pass, secret, 0)).left;
}
