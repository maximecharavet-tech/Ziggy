import { describe, expect, it } from 'vitest';
import { checkGateAnswer, englishNumber, frenchNumber, gateReasonFor, isParentsPath, makeGateQuestion, type GateQuestion } from './grown-up-gate';
import { locales } from '@/i18n/config';

describe('number words', () => {
  it('writes French numbers the traditional way', () => {
    const cases: [number, string][] = [
      [0, 'zéro'],
      [16, 'seize'],
      [17, 'dix-sept'],
      [21, 'vingt et un'],
      [22, 'vingt-deux'],
      [30, 'trente'],
      [47, 'quarante-sept'],
      [61, 'soixante et un'],
      [70, 'soixante-dix'],
      [71, 'soixante et onze'],
      [72, 'soixante-douze'],
      [77, 'soixante-dix-sept'],
      [80, 'quatre-vingts'],
      [81, 'quatre-vingt-un'],
      [89, 'quatre-vingt-neuf'],
      [90, 'quatre-vingt-dix'],
      [91, 'quatre-vingt-onze'],
      [99, 'quatre-vingt-dix-neuf'],
    ];
    for (const [n, w] of cases) expect(frenchNumber(n)).toBe(w);
  });

  it('writes English numbers', () => {
    expect(englishNumber(13)).toBe('thirteen');
    expect(englishNumber(40)).toBe('forty');
    expect(englishNumber(47)).toBe('forty-seven');
    expect(englishNumber(99)).toBe('ninety-nine');
  });

  it('never spells two numbers the same way, nor with digits', () => {
    for (const spell of [frenchNumber, englishNumber]) {
      const all = Array.from({ length: 100 }, (_, n) => spell(n));
      expect(new Set(all).size).toBe(100);
      for (const w of all) expect(w).not.toMatch(/\d/);
    }
  });

  it('refuses numbers it cannot spell', () => {
    expect(() => frenchNumber(100)).toThrow();
    expect(() => englishNumber(-1)).toThrow();
    expect(() => frenchNumber(4.5)).toThrow();
  });
});

describe('gate questions', () => {
  /** Every question the generator can ask, by sweeping its random source. */
  function sweep(): GateQuestion[] {
    const out: GateQuestion[] = [];
    for (let i = 0; i < 400; i++) {
      const values = [i % 2 ? 0.2 : 0.8, ((i * 37) % 100) / 100, ((i * 53) % 100) / 100];
      let k = 0;
      out.push(makeGateQuestion(() => values[k++ % values.length]));
    }
    return out;
  }

  it('asks both kinds, in French and English, with no digits for the word kind', () => {
    const qs = sweep();
    expect(qs.some((q) => q.kind === 'words')).toBe(true);
    expect(qs.some((q) => q.kind === 'product')).toBe(true);
    for (const q of qs) {
      expect(q.text.fr.length).toBeGreaterThan(5);
      expect(q.text.en.length).toBeGreaterThan(5);
      if (q.kind === 'words') {
        expect(q.text.fr).not.toMatch(/\d/);
        expect(q.text.en).not.toMatch(/\d/);
      }
    }
  });

  it('keeps answers out of a small child’s reach', () => {
    for (const q of sweep()) {
      if (q.kind === 'words') {
        expect(q.answer).toBeGreaterThanOrEqual(21);
        expect(q.answer).toBeLessThanOrEqual(99);
        expect(q.answer % 10).not.toBe(0); // no round numbers
        expect(q.answer % 11).not.toBe(0); // no 33, 44…
        expect(q.text.fr).toContain(frenchNumber(q.answer));
      } else {
        expect(q.answer).toBeGreaterThanOrEqual(36);
        expect(q.answer).toBeLessThanOrEqual(81);
      }
    }
  });

  it('works with the real random source', () => {
    for (let i = 0; i < 200; i++) {
      const q = makeGateQuestion();
      expect(checkGateAnswer(q, String(q.answer))).toBe(true);
    }
  });

  it('accepts only the exact digits', () => {
    const q: GateQuestion = { kind: 'words', text: { fr: 'Écris le nombre : quarante-sept', en: 'Type the number: forty-seven' }, answer: 47 };
    expect(checkGateAnswer(q, '47')).toBe(true);
    expect(checkGateAnswer(q, ' 47 ')).toBe(true);
    expect(checkGateAnswer(q, '047')).toBe(true);
    expect(checkGateAnswer(q, '74')).toBe(false);
    expect(checkGateAnswer(q, '')).toBe(false);
    expect(checkGateAnswer(q, '4')).toBe(false);
    expect(checkGateAnswer(q, '47.0')).toBe(false);
    expect(checkGateAnswer(q, 'quarante-sept')).toBe(false);
    expect(checkGateAnswer(q, '4747')).toBe(false);
  });
});

describe('which links need a grown-up', () => {
  const here = 'https://ziggy-ai.fr/monde';

  it('lets ordinary links inside Ziggy through', () => {
    expect(gateReasonFor('/dodo', here, locales)).toBeNull();
    expect(gateReasonFor('/en/monde/arcade/memory_magic', here, locales)).toBeNull();
    expect(gateReasonFor('https://www.ziggy-ai.fr/creer', here, locales)).toBeNull();
    expect(gateReasonFor('#top', here, locales)).toBeNull();
    expect(gateReasonFor('', here, locales)).toBeNull();
    expect(gateReasonFor('?tab=2', here, locales)).toBeNull();
  });

  it('stops anything that leaves Ziggy', () => {
    expect(gateReasonFor('https://example.com/', here, locales)).toBe('external');
    expect(gateReasonFor('//evil.example/x', here, locales)).toBe('external');
    expect(gateReasonFor('mailto:contact@ziggy-ai.fr', here, locales)).toBe('external');
    expect(gateReasonFor('tel:+33100000000', here, locales)).toBe('external');
    expect(gateReasonFor('sms:123', here, locales)).toBe('external');
    expect(gateReasonFor('intent://scan/#Intent;end', here, locales)).toBe('external');
    expect(gateReasonFor('https://ziggy-ai.fr.evil.example/', here, locales)).toBe('external');
  });

  it('counts the page’s own host as Ziggy (previews, local tests)', () => {
    expect(gateReasonFor('http://localhost:3321/dodo', 'http://localhost:3321/tv', locales)).toBeNull();
    expect(gateReasonFor('http://localhost:3000/dodo', 'http://localhost:3321/tv', locales)).toBe('external');
  });

  it('stops the parents’ area, account and legal pages, in every language', () => {
    for (const p of ['/monde/parents', '/en/monde/parents', '/account', '/ar/account', '/login', '/signup', '/owner', '/privacy', '/en/terms', '/cookies']) {
      expect(gateReasonFor(p, here, locales)).toBe('parents');
    }
    expect(isParentsPath('/accounts-of-ziggy', locales)).toBe(false);
    expect(isParentsPath('/monde/parentsx', locales)).toBe(false);
  });

  it('ignores javascript: links (never ours anyway)', () => {
    expect(gateReasonFor('javascript:void(0)', here, locales)).toBeNull();
  });
});
