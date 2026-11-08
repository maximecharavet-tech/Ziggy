import 'server-only';
import type { NextRequest } from 'next/server';
import { getSiteUrl } from '@/lib/site-url';

/**
 * Stripe's REST API with fetch (no SDK dependency): form-encoded bodies,
 * `Authorization: Bearer STRIPE_SECRET_KEY`. `STRIPE_API_BASE` points the
 * calls to a local mock in tests (default https://api.stripe.com).
 */

export function stripeKey(): string | null {
  const k = process.env.STRIPE_SECRET_KEY;
  return k && /^(sk|rk)_(test|live)_/.test(k) ? k : null;
}

function apiBase(): string {
  return (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/+$/, '');
}

/** Flattens `{a: {b: 1}, c: [x]}` into Stripe's `a[b]=1&c[0]=x`. */
export function formEncode(data: Record<string, unknown>): string {
  const out = new URLSearchParams();
  const walk = (prefix: string, v: unknown) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((item, i) => walk(`${prefix}[${i}]`, item));
    else if (typeof v === 'object') for (const [k, inner] of Object.entries(v as Record<string, unknown>)) walk(prefix ? `${prefix}[${k}]` : k, inner);
    else out.append(prefix, String(v));
  };
  walk('', data);
  return out.toString();
}

export type StripeResult<T> = { ok: true; data: T } | { ok: false; status: number };

export async function stripe<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<StripeResult<T>> {
  const key = stripeKey();
  if (!key) return { ok: false, status: 503 };
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/x-www-form-urlencoded',
        'stripe-version': '2025-03-31.basil',
      },
      body: body ? formEncode(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 502 };
  }
}

/** The client's IP for rate limiting. */
export function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

/**
 * The origin Stripe sends the parent back to. Only our own hosts (the site
 * URL, this Vercel deployment, localhost): a forged Host/Origin must never
 * turn the success URL — which carries the session id, i.e. the pass — into
 * someone else's site.
 */
export function returnOrigin(request: NextRequest): string {
  const site = getSiteUrl().replace(/\/+$/, '');
  const here = request.nextUrl;
  const trusted = new Set([site, 'https://ziggy-ai.fr', 'https://www.ziggy-ai.fr']);
  for (const v of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) if (v) trusted.add(`https://${v}`);
  if (trusted.has(here.origin)) return here.origin;
  if (here.hostname === 'localhost' || here.hostname === '127.0.0.1') return here.origin;
  return site;
}
