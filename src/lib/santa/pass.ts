import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SantaTier } from './types';
import { SANTA_VALID_UNTIL_MS, isSantaTier } from './offer';

/**
 * The Santa pass: what a family bought, proven without an account.
 *
 * After Stripe Checkout the server checks the session with Stripe, then sets
 * an HttpOnly cookie holding `base64url(JSON {sid, tier, exp}) + '.' + HMAC`
 * (HMAC-SHA256 with SANTA_PASS_SECRET). `sid` is the Checkout Session id: the
 * restore link (/pere-noel/merci?session_id=…) re-checks it with Stripe on
 * another device, and the live-call minutes are counted per sid.
 */

export const PASS_COOKIE = 'santa_pass';

export type SantaPass = { sid: string; tier: SantaTier; /** Expiry, Unix seconds. */ exp: number };

/** A Stripe Checkout Session id (cs_test_… / cs_live_…). */
export const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{8,240}$/;

/** The signing secret, or null when payments are not set up (≥ 32 characters). */
export function passSecret(): string | null {
  const s = process.env.SANTA_PASS_SECRET;
  return s && s.length >= 32 ? s : null;
}

/** Expiry of a pass sold now: the end of the season, in Unix seconds. */
export const PASS_EXP = Math.floor(SANTA_VALID_UNTIL_MS / 1000);

const b64url = (buf: Buffer) => buf.toString('base64url');
const mac = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest();

export function signPass(pass: SantaPass, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify({ sid: pass.sid, tier: pass.tier, exp: pass.exp })));
  return `${body}.${b64url(mac(body, secret))}`;
}

/** The pass in a token, or null if it is malformed, tampered with or expired. */
export function verifyPass(token: string | null | undefined, secret: string, nowMs: number = Date.now()): SantaPass | null {
  if (!token || token.length > 1024) return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot !== token.lastIndexOf('.')) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(sig)) return null;
  // Compare the canonical encodings (base64url decoding is lenient about the last character).
  const expected = Buffer.from(b64url(mac(body, secret)));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const { sid, tier, exp } = data as Record<string, unknown>;
  if (typeof sid !== 'string' || !SESSION_ID_RE.test(sid) || !isSantaTier(tier) || typeof exp !== 'number' || !Number.isFinite(exp)) return null;
  if (exp * 1000 <= nowMs) return null;
  return { sid, tier, exp };
}

/**
 * The valid pass carried by a request (NextRequest or `await cookies()`), or
 * null: no cookie, not set up, tampered with or expired. For the API routes
 * (status, chat, voice…).
 */
export function passFromRequest(req: { cookies: { get(name: string): { value: string } | undefined } }): SantaPass | null {
  const secret = passSecret();
  return secret ? verifyPass(req.cookies.get(PASS_COOKIE)?.value, secret) : null;
}

/** Cookie attributes: HttpOnly, Secure (except on localhost), SameSite=Lax, whole site, until the pass expires. */
export function passCookieOptions(hostname: string, exp: number = PASS_EXP) {
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  return { httpOnly: true, secure: !local, sameSite: 'lax' as const, path: '/', expires: new Date(exp * 1000) };
}
