import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { isSantaTier } from '@/lib/santa/offer';
import { PASS_COOKIE, PASS_EXP, SESSION_ID_RE, passCookieOptions, passSecret, signPass } from '@/lib/santa/pass';
import { clientIp, stripe, stripeKey } from '../_lib/stripe';

/**
 * GET /api/santa/pass?session_id=cs_…
 * Checks the Checkout Session with Stripe and, once paid, sets the signed
 * `santa_pass` cookie. Idempotent: the same link restores the pass later or
 * on another device.
 * → 200 {tier} + Set-Cookie
 * → 402 {error:'not_paid', pending:boolean} (pending: the payment may still go through, e.g. a bank transfer)
 * → 400 {error:'bad_request'} · 404 {error:'not_found'} · 429 {error:'too_many'} · 503 {error:'payments_unavailable'} · 502 {error:'stripe_failed'}
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CheckoutSession = {
  id: string;
  mode: string;
  status: 'open' | 'complete' | 'expired' | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  metadata: Record<string, string> | null;
};

const noStore = { 'cache-control': 'no-store' };

export async function GET(request: NextRequest) {
  const secret = passSecret();
  if (!stripeKey() || !secret) return NextResponse.json({ error: 'payments_unavailable' }, { status: 503, headers: noStore });

  if (!rateLimit(`santa-pass:${clientIp(request)}`, 30, 10 * 60_000).success) {
    return NextResponse.json({ error: 'too_many' }, { status: 429, headers: noStore });
  }

  const sid = request.nextUrl.searchParams.get('session_id') ?? '';
  if (!SESSION_ID_RE.test(sid)) return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: noStore });

  const result = await stripe<CheckoutSession>('GET', `/v1/checkout/sessions/${encodeURIComponent(sid)}`);
  if (!result.ok) {
    if (result.status === 404) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
    console.error('[santa/pass] Stripe lookup failed', result.status);
    return NextResponse.json({ error: 'stripe_failed' }, { status: 502, headers: noStore });
  }

  const s = result.data;
  const tier = s.metadata?.tier;
  if (s.id !== sid || s.mode !== 'payment' || s.metadata?.product !== 'santa-2026' || !isSantaTier(tier)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  }
  // A 100 % promotion code completes the session with nothing to pay.
  const paid = s.payment_status === 'paid' || (s.payment_status === 'no_payment_required' && s.status === 'complete');
  if (!paid) {
    return NextResponse.json({ error: 'not_paid', pending: s.status !== 'expired' }, { status: 402, headers: noStore });
  }
  if (PASS_EXP * 1000 <= Date.now()) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });

  const res = NextResponse.json({ tier }, { headers: noStore });
  res.cookies.set(PASS_COOKIE, signPass({ sid, tier, exp: PASS_EXP }, secret), passCookieOptions(request.nextUrl.hostname));
  return res;
}
