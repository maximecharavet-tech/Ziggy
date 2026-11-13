import { describe, expect, it } from 'vitest';
import { buildCall, callClips, CALL_KINDS, type CallKind } from './call-script';
import { santaText, SANTA_LINES } from '@/data/santa/lines';
import { SANTA_GIFTS } from '@/data/santa/gifts';
import { SANTA_PROUD } from '@/data/santa/proud';
import { cleanName } from './name';
import type { SantaChild } from './types';

const child = (over: Partial<SantaChild> = {}): SantaChild => ({ id: 'a', name: 'Léa', age: 6, wishes: ['velo', 'licorne', 'puzzle', 'livre'], proud: 'lire', letterSentAt: '2026-12-01', ...over });
const kinds: CallKind[] = [...CALL_KINDS, 'message'];

describe('guided calls', () => {
  it('every clip of every call has words in French and English', () => {
    for (const kind of kinds)
      for (const c of [child(), child({ wishes: [], proud: null, letterSentAt: null, name: 'Jean-Baptiste' })])
        for (const preview of [false, true])
          for (const ai of [false, true]) {
            const clips = callClips(buildCall(kind, c, { preview, ai }));
            expect(clips.length).toBeGreaterThan(2);
            for (const k of clips) {
              expect(santaText(k, 'fr'), `${kind} ${k}`).toBeTruthy();
              expect(santaText(k, 'en'), `${kind} ${k}`).toBeTruthy();
            }
          }
  });

  it('every call ends, previews end early, the AI part only when asked', () => {
    for (const kind of kinds) {
      const full = buildCall(kind, child());
      expect(full.at(-1)).toMatchObject({ t: 'end' });
      expect(full.some((s) => s.t === 'ai')).toBe(false);
    }
    const preview = buildCall('liste', child(), { preview: true });
    expect(preview.at(-1)).toEqual({ t: 'end', reason: 'preview' });
    expect(preview.length).toBeLessThan(buildCall('liste', child()).length);
    expect(buildCall('liste', child(), { ai: true }).some((s) => s.t === 'ai')).toBe(true);
  });

  it('reads at most three wishes and mentions the proud moment', () => {
    const clips = callClips(buildCall('liste', child()));
    expect(clips.filter((k) => k.startsWith('gift:'))).toEqual(['gift:velo', 'gift:licorne', 'gift:puzzle']);
    expect(clips).toContain('proud:lire');
  });
});

describe('Santa’s words', () => {
  it('only speaks known keys and real first names', () => {
    expect(santaText('line:nope', 'fr')).toBeNull();
    expect(santaText('gift:nope', 'fr')).toBeNull();
    expect(santaText('age:40', 'fr')).toBeNull();
    expect(santaText('name:hello:<script>', 'fr')).toBeNull();
    expect(santaText('name:hello:Zoé', 'fr')).toBe('Bonjour Zoé !');
    expect(santaText('free text', 'en')).toBeNull();
  });

  it('every gift and proud moment can be spoken', () => {
    for (const g of SANTA_GIFTS) expect(santaText(`gift:${g.id}`, 'fr')).toMatch(/ !$/);
    for (const p of SANTA_PROUD) expect(santaText(`proud:${p.id}`, 'en')).toMatch(/^I heard that you /);
    expect(Object.keys(SANTA_LINES).length).toBeGreaterThan(40);
  });

  it('never uses a naughty list or a sad word', () => {
    const all = JSON.stringify(SANTA_LINES).toLowerCase();
    for (const w of ['naughty', 'méchant', 'pas sage', 'triste', 'sad', 'punish', 'puni']) expect(all).not.toContain(w);
  });

  it('cleans first names', () => {
    expect(cleanName('  léa ')).toBe('Léa');
    expect(cleanName('Anne-Marie')).toBe('Anne-Marie');
    expect(cleanName('O’Neil')).toBe("O'Neil");
    expect(cleanName('12')).toBe('');
    expect(cleanName('a'.repeat(30))).toBe('');
    expect(cleanName('Léa <b>')).toBe('');
  });
});

describe('scheduled calls', () => {
  it('open with the "right on time" line and keep a stable seed', async () => {
    const { buildCall, callClips, seedFromId } = await import('./call-script');
    const child = { id: 'c', name: 'Léa', age: 6, wishes: [], proud: null };
    const steps = buildCall('veille', child, { scheduled: true, seed: seedFromId('abc123') });
    expect(callClips(steps)).toContain('line:sched.open');
    expect(seedFromId('abc123')).toBe(seedFromId('abc123'));
    expect(callClips(buildCall('veille', child, {}))).not.toContain('line:sched.open');
  });
});
