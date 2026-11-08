import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { aiSecondsLeft } from '@/lib/santa/ai-usage';
import { PASS_COOKIE, passFromRequest, passSecret } from '@/lib/santa/pass';
import { clientIp } from '../_lib/stripe';

/**
 * GET /api/santa/status → 200 {tier: 'essentiel'|'magique'|null, exp: number|null (Unix seconds), aiSecondsLeft: number}
 * From the `santa_pass` cookie only. A tampered or expired cookie is cleared
 * and reads as no pass. 429 {error:'too_many'}.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'cache-control': 'private, no-store' };

export async function GET(request: NextRequest) {
  if (!rateLimit(`santa-status:${clientIp(request)}`, 60, 60_000).success) {
    return NextResponse.json({ error: 'too_many' }, { status: 429, headers: noStore });
  }
  const secret = passSecret();
  const pass = passFromRequest(request);
  if (!pass || !secret) {
    const res = NextResponse.json({ tier: null, exp: null, aiSecondsLeft: 0 }, { headers: noStore });
    // Only when we can tell (a missing secret is a set-up problem, not a bad cookie).
    if (secret && request.cookies.has(PASS_COOKIE)) res.cookies.delete(PASS_COOKIE);
    return res;
  }
  return NextResponse.json({ tier: pass.tier, exp: pass.exp, aiSecondsLeft: await aiSecondsLeft(pass, secret) }, { headers: noStore });
}
