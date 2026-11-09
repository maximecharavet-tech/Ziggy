import { describe, expect, it } from 'vitest';
import bible from '@/data/lutins/bible.json';
import { CLUES, CLUE_COUNT, cluesValid, eliminationGrid, makeClues, suspects } from './clues';
import { makeRng } from './rand';
import { ROOMS } from './rooms';
import { startRoom } from './session';
import { BANDS, ELF_IDS } from './types';

describe('clues', () => {
  it('the catalogue matches the bible elves and every clue fits 1 or 2 elves', () => {
    expect(bible.elves.map((e) => e.id).sort()).toEqual([...ELF_IDS].sort());
    for (const c of CLUES) {
      expect(c.fits.length === 1 || c.fits.length === 2, c.id).toBe(true);
      expect(c.label.fr && c.label.en && c.reason.fr && c.reason.en, c.id).toBeTruthy();
      if (c.kind === 'thread') expect(c.pattern ?? c.icon, `${c.id} colour clue needs a pattern`).toBeTruthy();
      if (c.kind === 'sound') expect(c.icon, `${c.id} sound clue needs an icon`).toBeTruthy();
    }
    expect(new Set(CLUES.map((c) => c.id)).size).toBe(CLUES.length);
  });

  it('every elf has sure clues, and partial clues can rule out each elf', () => {
    for (const e of ELF_IDS) {
      expect(CLUES.filter((c) => c.fits.length === 1 && c.fits[0] === e).length).toBeGreaterThanOrEqual(3);
      expect(CLUES.filter((c) => c.fits.length === 2 && !c.fits.includes(e)).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('clues point to exactly one elf — the culprit — across many seeds, elves and bands', () => {
    for (const band of BANDS)
      for (const elf of ELF_IDS)
        for (let seed = 0; seed < 300; seed++) {
          const clues = makeClues(elf, band, makeRng(seed * 31 + band.length), seed % 3 ? [] : ['footprint']);
          expect(suspects(clues)).toEqual([elf]);
          expect(cluesValid(clues, elf, band)).toBe(true);
          expect(clues.length).toBeGreaterThanOrEqual(CLUE_COUNT[band].min);
          expect(clues.length).toBeLessThanOrEqual(CLUE_COUNT[band].max);
        }
  });

  it('big kids need elimination (no single sure clue), little/middle get a sure one', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(makeClues('noisette', 'big', makeRng(seed)).every((c) => c.fits.length === 2)).toBe(true);
      expect(makeClues('pepin', 'little', makeRng(seed)).some((c) => c.fits.length === 1)).toBe(true);
    }
  });

  it('the elimination grid rules out everyone but the culprit', () => {
    const clues = makeClues('grelotte', 'big', makeRng(5));
    const out = new Set(eliminationGrid(clues).flatMap((r) => r.out));
    expect(ELF_IDS.filter((e) => !out.has(e))).toEqual(['grelotte']);
  });

  it('a set pointing to two elves is rejected', () => {
    const big = CLUES.find((c) => c.id === 'footprint-big')!;
    expect(cluesValid([big], 'pepin', 'big')).toBe(false);
    expect(cluesValid([CLUES.find((c) => c.id === 'bell-jingle')!], 'grelotte', 'little')).toBe(false);
  });

  it('in every room session, every prank’s clues identify its culprit', () => {
    for (const room of ROOMS)
      for (const band of BANDS)
        for (let seed = 0; seed < 20; seed++)
          for (const p of startRoom(room, band, seed).pranks) expect(cluesValid(p.clues, p.culprit, band), `${room.id} ${band} ${seed} ${p.id}`).toBe(true);
  });
});
