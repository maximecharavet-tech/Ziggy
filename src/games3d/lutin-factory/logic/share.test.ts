import { describe, expect, it } from 'vitest';
import { decodeLayout, encodeLayout, SHARE_VERSION } from './share';
import { LEVELS, referenceLayout } from './levels';
import { normalizeLayout } from './grid';
import { fnv1a, simulate } from './simulator';
import { BANDS, type Layout } from './types';

const strip = (l: Layout): Layout => normalizeLayout({ ...l, pieces: l.pieces.map(({ locked: _l, dialLocked: _d, ...p }) => p) });

describe('share codes', () => {
  it('round-trips every reference layout (same pieces, same toys)', () => {
    for (const lv of LEVELS)
      for (const band of BANDS) {
        const layout = referenceLayout(lv.bands[band]);
        const code = encodeLayout(layout);
        expect(code.startsWith(`${SHARE_VERSION}.`)).toBe(true);
        expect(code).toMatch(/^[A-Za-z0-9._-]+$/); // URL-safe
        const back = decodeLayout(code);
        expect(back.ok, `${lv.id}/${band}`).toBe(true);
        if (!back.ok) continue;
        expect(strip(back.layout)).toEqual(strip(layout));
        expect(simulate(back.layout).deliveries).toEqual(simulate(layout).deliveries);
      }
  });

  it('is compact', () => {
    const code = encodeLayout(referenceLayout(LEVELS[1].bands.middle));
    expect(code.length).toBeLessThan(260);
  });

  it('tolerates spaces around a pasted code', () => {
    const code = encodeLayout(referenceLayout(LEVELS[0].bands.middle));
    expect(decodeLayout(`  ${code}\n`).ok).toBe(true);
  });

  it('rejects corrupted, truncated, foreign or tampered codes (never throws)', () => {
    const code = encodeLayout(referenceLayout(LEVELS[5].bands.big));
    const [v, payload, sum] = code.split('.');
    const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);
    const bad: [unknown, string][] = [
      [undefined, 'format'],
      [42, 'format'],
      ['', 'format'],
      ['hello', 'format'],
      [code.slice(0, -3), 'checksum'],
      [`${v}.${payload.slice(0, -4)}.${sum}`, 'checksum'],
      [`${v}.${flip(payload, 10)}.${sum}`, 'checksum'],
      [`LF9.${payload}.${sum}`, 'version'],
      [`${v}.${payload}.${sum}.extra`, 'format'],
      [`${v}.${payload}!.${sum}`, 'checksum'],
      ['x'.repeat(5000), 'format'],
    ];
    for (const [c, why] of bad) {
      const r = decodeLayout(c);
      expect(r.ok, String(c).slice(0, 30)).toBe(false);
      if (!r.ok) expect(r.why, String(c).slice(0, 30)).toBe(why);
    }
  });

  it('rejects well-formed codes with impossible content (validated like the game)', () => {
    const forge = (data: unknown) => {
      const b64 = Buffer.from(JSON.stringify(data), 'ascii').toString('base64url');
      return `LF1.${b64}.${fnv1a(b64)}`;
    };
    expect(decodeLayout(forge([5, 3, [], [['b', 1, 1, 1]]])).ok).toBe(true);
    const cases: unknown[] = [
      [5, 3, [], [['z', 1, 1, 1]]], // unknown machine
      [5, 3, [], [['b', 9, 1, 1]]], // outside
      [5, 3, [], [['b', 1, 1, 7]]], // bad dir
      [5, 3, [], [['b', 1, 1, 1], ['p', 1, 1, 1]]], // two on one tile
      [5, 3, [[1, 1]], [['b', 1, 1, 1]]], // on a blocked tile
      [5, 3, [], [['p', 1, 1, 1, { color: 'gold' }]]], // bad dial
      [5, 3, [], [['c', 1, 1, 1, { count: 1e9 }]]], // dial out of range
      [99, 3, [], []], // grid too big
      [5, 3, []], // wrong shape
      { w: 5 },
    ];
    for (const c of cases) expect(decodeLayout(forge(c)), JSON.stringify(c)).toEqual({ ok: false, why: 'content' });
  });
});
