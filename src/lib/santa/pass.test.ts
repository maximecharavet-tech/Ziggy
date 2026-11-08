import { describe, expect, it } from 'vitest';
import { PASS_EXP, SESSION_ID_RE, passCookieOptions, signPass, verifyPass } from './pass';
import { passHash } from './ai-usage';
import { SANTA_OFFERS, SANTA_VALID_UNTIL_MS, isSantaTier, santaMaxChildren } from './offer';

const SECRET = 'test-secret-0123456789abcdef0123456789abcdef';
const SID = 'cs_test_a1B2c3D4e5F6g7H8i9J0';
const NOW = Date.parse('2026-12-01T10:00:00Z');
const pass = { sid: SID, tier: 'magique' as const, exp: PASS_EXP };

const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);

describe('santa pass token', () => {
  it('round-trips a signed pass', () => {
    const token = signPass(pass, SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyPass(token, SECRET, NOW)).toEqual(pass);
  });

  it('rejects a tampered body or signature', () => {
    const token = signPass(pass, SECRET);
    const [body, sig] = token.split('.');
    expect(verifyPass(`${flip(body, 3)}.${sig}`, SECRET, NOW)).toBeNull();
    expect(verifyPass(`${body}.${flip(sig, 5)}`, SECRET, NOW)).toBeNull();
    expect(verifyPass(`${body}.${sig}x`, SECRET, NOW)).toBeNull();
    // An upgraded tier with the old signature.
    const forged = Buffer.from(JSON.stringify({ ...pass, tier: 'magique', sid: 'cs_test_zzzzzzzzzzzz' })).toString('base64url');
    expect(verifyPass(`${forged}.${sig}`, SECRET, NOW)).toBeNull();
  });

  it('rejects another secret, junk and malformed tokens', () => {
    const token = signPass(pass, SECRET);
    expect(verifyPass(token, `${SECRET}!`, NOW)).toBeNull();
    for (const bad of [undefined, null, '', '.', 'abc', 'a.b.c', `${token}.x`, 'x'.repeat(2000)]) expect(verifyPass(bad, SECRET, NOW)).toBeNull();
  });

  it('rejects a well-signed pass with bad contents', () => {
    expect(verifyPass(signPass({ ...pass, tier: 'premium' as never }, SECRET), SECRET, NOW)).toBeNull();
    expect(verifyPass(signPass({ ...pass, sid: 'pi_123' }, SECRET), SECRET, NOW)).toBeNull();
  });

  it('rejects an expired pass', () => {
    const token = signPass({ ...pass, exp: Math.floor(NOW / 1000) - 1 }, SECRET);
    expect(verifyPass(token, SECRET, NOW)).toBeNull();
    expect(verifyPass(signPass(pass, SECRET), SECRET, SANTA_VALID_UNTIL_MS + 1000)).toBeNull();
  });

  it('expires at the end of January 2027, Paris time', () => {
    expect(new Date(PASS_EXP * 1000).toISOString()).toBe('2027-01-31T22:59:59.000Z');
  });

  it('cookie is HttpOnly, Lax, whole site, Secure except on localhost', () => {
    expect(passCookieOptions('ziggy-ai.fr')).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(passCookieOptions('localhost').secure).toBe(false);
    expect(passCookieOptions('ziggy-ai.fr').expires.getTime()).toBe(PASS_EXP * 1000);
  });

  it('accepts only Checkout Session ids', () => {
    expect(SESSION_ID_RE.test(SID)).toBe(true);
    expect(SESSION_ID_RE.test('cs_live_a1B2c3D4e5F6g7H8')).toBe(true);
    for (const bad of ['cs_test_', 'cs_test_abc/../x', 'pi_test_abcdefghijk', 'cs_test_abc def ghi', 'cs_prod_abcdefghijk']) expect(SESSION_ID_RE.test(bad)).toBe(false);
  });
});

describe('santa offer', () => {
  it('prices and limits', () => {
    expect(SANTA_OFFERS.essentiel.amount).toBe(499);
    expect(SANTA_OFFERS.magique.amount).toBe(999);
    expect(santaMaxChildren(null)).toBe(1);
    expect(santaMaxChildren('essentiel')).toBe(3);
    expect(isSantaTier('magique')).toBe(true);
    expect(isSantaTier('toString')).toBe(false);
  });
});

describe('ai usage key', () => {
  it('is 64 hex characters and depends on the secret', () => {
    const h = passHash(SID, SECRET);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(passHash(SID, `${SECRET}x`)).not.toBe(h);
  });
});
