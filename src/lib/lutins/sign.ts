import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Only pictures our own generate route produced can be animated: it returns a
 * signature of the picture's address, and the video route checks it. The key is
 * LUTINS_SECRET, or derived from the Agnes key (server-only either way).
 */
function key(): string | null {
  const k = process.env.LUTINS_SECRET || (process.env.AGNES_API_KEY ? `lutins:${process.env.AGNES_API_KEY}` : '');
  return k || null;
}

export function signSource(url: string): string | null {
  const k = key();
  return k ? createHmac('sha256', k).update(url).digest('hex').slice(0, 40) : null;
}

export function checkSource(url: string, sig: unknown): boolean {
  const expected = signSource(url);
  if (!expected || typeof sig !== 'string' || sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
