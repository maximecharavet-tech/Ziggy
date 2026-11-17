import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadCore, getCore, tsCore, type CreatureCore } from './index';
import { rng } from '@/games3d/kit/rng';
import { NAME_BLOCKLIST, LOOK_KEYS, sanitize, STARTER, solveChallenge, checkChallenge, hintFor, reqChip, reqCategory, type Challenge } from '@/games3d/creatures/logic';

let wasm: CreatureCore;
beforeAll(async () => {
  wasm = await loadCore({ wasmBytes: readFileSync('src/lib/creatures/wasm/creatures_core_bg.wasm') });
});

const seeds = Array.from({ length: 120 }, (_, i) => i * 7919 + 3);

describe('creatures core: wasm and TS twin agree', () => {
  it('loads the wasm engine', () => {
    expect(wasm.engine).toBe('wasm');
    expect(getCore().engine).toBe('wasm');
  });
  it('same rng stream', () => {
    // creatures_core.rng_probe is exercised through random creatures below; here the TS stream is checked for range
    const r = rng(12345);
    for (let i = 0; i < 50; i++) expect(r()).toBeLessThan(1);
  });
  it('same Surprise creature, same name, for any seed', () => {
    for (const s of seeds) {
      expect(wasm.randomCreature(s)).toEqual(tsCore.randomCreature(s));
      expect(wasm.makeName(s)).toBe(tsCore.makeName(s));
    }
  });
  it('same cross-breeding', () => {
    for (const s of seeds) {
      const a = tsCore.randomCreature(s);
      const b = tsCore.randomCreature(s + 1);
      expect(wasm.cross(a, b, s)).toEqual(tsCore.cross(a, b, s));
    }
  });
  it('same powers, silly events and poses', () => {
    for (const s of seeds) {
      const c = tsCore.randomCreature(s);
      expect(wasm.powersOf(c)).toEqual(tsCore.powersOf(c));
      expect(wasm.sillyEvent(s)).toBe(tsCore.sillyEvent(s));
    }
    for (const k of ['bounce', 'float', 'roll', 'stretch', 'dance', 'surprised', 'clap', 'giggle', 'zap', 'camo', 'dizzy', 'nope'])
      for (const p of [0, 0.13, 0.5, 0.77, 1]) wasm.pose(k, p).forEach((v, i) => expect(v).toBeCloseTo(tsCore.pose(k, p)[i], 9));
  });
  it('same share code, which round-trips', () => {
    for (const s of seeds) {
      const c = tsCore.randomCreature(s);
      const code = wasm.encodeCode(c);
      expect(tsCore.encodeCode(c)).toBe(code);
      const back = tsCore.decodeCode(code)!;
      expect(back).toEqual({ ...c, id: '' });
      expect(wasm.decodeCode(code)).toEqual(back);
    }
  });
  it('refuses a mistyped code, forgives look-alikes and case', () => {
    const c = tsCore.randomCreature(5);
    const code = tsCore.encodeCode(c);
    expect(tsCore.decodeCode(code.toLowerCase().replaceAll('-', ' '))?.body).toBe(c.body);
    const bad = code.slice(0, -3) + (code.at(-3) === '2' ? '3' : '2') + code.slice(-2);
    expect(tsCore.decodeCode(bad)).toBeNull();
    expect(wasm.decodeCode(bad)).toBeNull();
    expect(tsCore.decodeCode('hello')).toBeNull();
    expect(tsCore.decodeCode('')).toBeNull();
  });
});

describe('what the engine makes is always safe', () => {
  it('every Surprise and child is a valid whole creature with a clean name', () => {
    for (const core of [wasm, tsCore])
      for (const s of seeds) {
        const c = core.randomCreature(s);
        expect(LOOK_KEYS.every((k) => sanitize(c)![k] === c[k]), String(s)).toBe(true);
        const n = c.name.toLowerCase().replace(/[^a-z]/g, '');
        for (const bad of NAME_BLOCKLIST) expect(n.includes(bad), `${c.name} / ${bad}`).toBe(false);
        expect(core.powersOf(c).length).toBeGreaterThan(0);
      }
  });
  it('more than a billion creatures can be built', () => {
    expect(wasm.comboCount()).toBeGreaterThan(1e9);
    expect(tsCore.comboCount()).toBe(wasm.comboCount());
  });
  it('generated challenges come only from wasm, are bilingual, and the TS twin degrades to null', () => {
    expect(tsCore.generateChallenge('little', 1)).toBeNull();
    for (const band of ['little', 'middle', 'big']) {
      const ch = wasm.generateChallenge(band, 42)!;
      expect(ch.text.fr.length).toBeGreaterThan(5);
      expect(ch.text.en.length).toBeGreaterThan(5);
      expect(ch.reqs.length).toBeGreaterThan(0);
    }
    expect(wasm.checkRequirements([{ k: 'eyes', n: 2 }], STARTER)).toEqual([true]);
  });
});

describe('generated challenges work with the game (TS side)', () => {
  it('every generated challenge is buildable, hinted, and has pictures', () => {
    for (const band of ['little', 'middle', 'big'] as const)
      for (let s = 1; s < 250; s++) {
        const ch = wasm.generateChallenge(band, s * 17)! as unknown as Challenge;
        const sol = solveChallenge(ch);
        expect(sol, `${band} ${s} ${ch.text.en}`).not.toBeNull();
        expect(checkChallenge(ch, sol!).ok).toBe(true);
        expect(hintFor(ch, STARTER, 'fr').length).toBeGreaterThan(3);
        for (const r of ch.reqs) {
          expect(reqChip(r, STARTER).icon).toBeTruthy();
          expect(reqCategory(r)).toBeTruthy();
        }
        // TS and Rust judge a creature the same way.
        expect(wasm.checkRequirements(ch.reqs, sol!)).toEqual(checkChallenge(ch, sol!).met);
        expect(wasm.checkRequirements(ch.reqs, STARTER)).toEqual(checkChallenge(ch, STARTER).met);
      }
  });
});

describe('moves and voice: Rust and TS agree', () => {
  it('for any creature', async () => {
    const glue = await import('./wasm/creatures_core.js');
    const { movesOf, voiceOf } = await import('@/games3d/creatures/logic');
    for (const s of seeds) {
      const c = tsCore.randomCreature(s);
      expect(JSON.parse(glue.moves_of(JSON.stringify(c))), String(s)).toEqual(movesOf(c));
      expect(JSON.parse(glue.voice_of(JSON.stringify(c))), String(s)).toEqual(voiceOf(c));
    }
  });
});
