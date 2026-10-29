import { describe, expect, it } from 'vitest';
import { LEARNING_SKILLS } from '@/lib/learning/skills';
import {
  DINOS,
  DINO_INFO,
  PIECES,
  PIECE_INFO,
  awakeText,
  boneChoices,
  bonesFor,
  checkAnswer,
  checkPiece,
  checkTurns,
  choiceKey,
  choiceLabel,
  compareQuestion,
  countQuestion,
  digText,
  dietQuestion,
  featureQuestion,
  funText,
  nameQuestion,
  pieceHint,
  planGame,
  presetQuestion,
  roundTotal,
  roundsFor,
  sameTimeQuestion,
  sizeQuestion,
  sumQuestion,
  timegapQuestion,
  turnHint,
  turnsLeft,
  type Band,
  type Question,
} from './logic';
import { rng } from '../kit/rng';

const BANDS: Band[] = ['little', 'middle', 'big'];
const LOCALES = ['fr', 'en'] as const;

function allPlans() {
  const out = [];
  for (const band of BANDS) for (let level = 1; level <= 5; level++) for (let seed = 0; seed < 40; seed++) out.push(planGame(seed, band, level));
  return out;
}

function questionsOf(plan: ReturnType<typeof planGame>): Question[] {
  return plan.rounds.flatMap((r) => [r.digQuestion, r.quiz].filter((q): q is Question => Boolean(q)));
}

function expectWellFormed(q: Question) {
  expect(q.choices.length).toBeGreaterThanOrEqual(2);
  expect(q.choices.length).toBeLessThanOrEqual(4);
  expect(new Set(q.choices.map(choiceKey)).size).toBe(q.choices.length);
  expect(q.answer).toBeGreaterThanOrEqual(0);
  expect(q.answer).toBeLessThan(q.choices.length);
  expect(checkAnswer(q, q.answer)).toBe(true);
  for (const l of LOCALES) {
    expect(q.text[l].trim().length).toBeGreaterThan(5);
    expect(q.hint[l].trim().length).toBeGreaterThan(5);
    expect(q.explain[l].trim().length).toBeGreaterThan(3);
    for (const c of q.choices) expect(choiceLabel(c, l).trim().length).toBeGreaterThan(0);
  }
  expect(q.text.fr).not.toBe(q.text.en);
  expect(LEARNING_SKILLS).toContain(q.skill);
}

describe('Ziggy the Dino Digger — the dinosaurs', () => {
  it('only states true, consistent facts', () => {
    expect(DINO_INFO.trex.diet).toBe('meat');
    for (const d of DINOS) if (d !== 'trex') expect(DINO_INFO[d].diet).toBe('plants');
    // The Diplodocus is the longest, the T-Rex longer than the Triceratops and the Stegosaurus.
    expect(Math.max(...DINOS.map((d) => DINO_INFO[d].lengthM))).toBe(DINO_INFO.diplodocus.lengthM);
    expect(DINO_INFO.trex.lengthM).toBeGreaterThan(DINO_INFO.triceratops.lengthM);
    // Jurassic (older) vs Cretaceous.
    for (const d of DINOS) expect(DINO_INFO[d].ageMy).toBeGreaterThan(DINO_INFO[d].era === 'jurassic' ? 140 : 60);
    expect(DINO_INFO.trex.era).toBe(DINO_INFO.triceratops.era);
    expect(DINO_INFO.diplodocus.era).toBe(DINO_INFO.stegosaurus.era);
  });

  it('describes every piece of every skeleton in French and English', () => {
    for (const d of DINOS) {
      const info = DINO_INFO[d];
      expect(info.pieces.length).toBeGreaterThanOrEqual(5);
      for (const p of info.pieces) {
        expect(PIECES).toContain(p);
        expect(info.sizes[p]).toBeGreaterThan(0);
        for (const l of LOCALES) {
          expect(PIECE_INFO[p].name[l]).toBeTruthy();
          expect(PIECE_INFO[p].looks[l]).toBeTruthy();
        }
      }
      for (const l of LOCALES) {
        expect(info.name[l]).toBeTruthy();
        expect(info.fact[l].length).toBeGreaterThan(10);
        expect(awakeText(d, l)).toContain(l === 'fr' ? info.name.fr : info.name.en);
        expect(funText(info.fun, l).length).toBeGreaterThan(10);
      }
    }
    expect(digText('little', 'fr')).toContain('Gratter');
    expect(digText('little', 'en')).toContain('Brush');
  });
});

describe('Ziggy the Dino Digger — a game', () => {
  it('is deterministic for a seed', () => {
    expect(planGame(7, 'middle', 3)).toEqual(planGame(7, 'middle', 3));
    expect(planGame(7, 'big', 2)).not.toEqual(planGame(8, 'big', 2));
  });

  it('has 2 dinosaurs for little ones, 3 for the others, never the same twice', () => {
    for (const band of BANDS)
      for (let seed = 0; seed < 30; seed++) {
        const plan = planGame(seed, band, 2);
        expect(plan.rounds).toHaveLength(roundsFor(band));
        expect(new Set(plan.rounds.map((r) => r.dino)).size).toBe(plan.rounds.length);
      }
    expect(roundsFor('little')).toBe(2);
    expect(roundsFor('big')).toBe(3);
  });

  it('splits each skeleton into bones to dig and bones already on the stand', () => {
    for (const plan of allPlans())
      for (const r of plan.rounds) {
        const all = DINO_INFO[r.dino].pieces;
        expect([...r.buried, ...r.preset].sort()).toEqual([...all].sort());
        expect(r.buried.filter((p) => r.preset.includes(p))).toEqual([]);
        expect(r.buried).toContain('head');
        expect(r.buried).toContain('tail');
        expect(r.placements.map((p) => p.piece).sort()).toEqual([...r.buried].sort());
        expect(r.buried.length).toBe(Math.min(bonesFor(plan.band, plan.level), all.length));
        // Body first: placements follow the skeleton order.
        const idx = r.placements.map((p) => PIECES.indexOf(p.piece));
        expect([...idx].sort((a, b) => a - b)).toEqual(idx);
        expect(LEARNING_SKILLS).toContain(r.skill);
        expect(roundTotal(r)).toBeGreaterThan(r.placements.length);
      }
  });

  it('follows the age: more bones and turning bones for the big ones only', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const lv of [1, 2, 3, 4, 5]) {
        const little = planGame(seed, 'little', lv);
        for (const r of little.rounds) {
          expect(r.buried.length).toBeLessThanOrEqual(4);
          expect(r.options).toBeLessThanOrEqual(3);
          expect(r.placements.every((p) => p.turns === 0)).toBe(true);
          // Pre-readers answer with pictures, emoji and numbers, never with text.
          for (const q of [r.digQuestion, r.quiz]) if (q) expect(q.choices.every((c) => c.kind !== 'text')).toBe(true);
          expect(r.digQuestion).not.toBeNull();
        }
      }
      const big = planGame(seed, 'big', 3);
      expect(big.rounds.some((r) => r.placements.some((p) => p.turns > 0))).toBe(true);
      expect(big.rounds.every((r) => r.digQuestion === null)).toBe(true);
    }
    expect(bonesFor('little', 1)).toBeLessThan(bonesFor('middle', 1));
    expect(bonesFor('middle', 1)).toBeLessThan(bonesFor('big', 1));
    expect(bonesFor('big', 4)).toBeGreaterThan(bonesFor('big', 1));
  });

  it('asks well-formed questions with exactly one right answer', () => {
    for (const plan of allPlans()) for (const q of questionsOf(plan)) expectWellFormed(q);
  });

  it('trains the four dinosaur skills across ages', () => {
    const skills = new Set<string>();
    for (const plan of allPlans()) for (const r of plan.rounds) skills.add(r.skill);
    expect([...skills].sort()).toEqual(['animals', 'counting', 'science', 'shapes']);
  });

  it('does not repeat the same quiz in a game', () => {
    for (const band of BANDS)
      for (let seed = 0; seed < 40; seed++) {
        const kinds = planGame(seed, band, 3).rounds.map((r) => r.quiz.kind);
        expect(new Set(kinds).size).toBe(kinds.length);
      }
  });

  it('plans hide-and-seek only for the Triceratops, behind a real palm', () => {
    for (const plan of allPlans())
      for (const r of plan.rounds) {
        if (r.dino === 'triceratops') {
          expect(r.hide).not.toBeNull();
          expect(r.hide!.spot).toBeGreaterThanOrEqual(0);
          expect(r.hide!.spot).toBeLessThan(r.hide!.palms);
          expect(r.hide!.palms).toBe(plan.band === 'little' ? 2 : 3);
        } else expect(r.hide).toBeNull();
      }
  });
});

describe('Ziggy the Dino Digger — right answers', () => {
  const r = () => rng(5);

  it('counts the bones found', () => {
    for (let n = 1; n <= 6; n++)
      for (const band of BANDS) {
        const q = countQuestion(n, band, r());
        expect(q.choices[q.answer]).toEqual({ kind: 'number', n });
        expect(q.choices.every((c) => c.kind === 'number' && c.n >= 1)).toBe(true);
      }
    const p = presetQuestion(6, 4, r());
    expect(p.choices[p.answer]).toEqual({ kind: 'number', n: 2 });
  });

  it('finds the biggest and the smallest bone, drawn to scale', () => {
    for (const d of DINOS) {
      const pool = DINO_INFO[d].pieces;
      const sizes = DINO_INFO[d].sizes;
      for (const mode of ['biggest', 'smallest'] as const) {
        const q = sizeQuestion(d, pool, rng(3), mode)!;
        expectWellFormed(q);
        const vals = q.choices.map((c) => (c.kind === 'piece' ? sizes[c.piece]! : 0));
        const right = vals[q.answer];
        expect(right).toBe(mode === 'biggest' ? Math.max(...vals) : Math.min(...vals));
        // The answer is clearly bigger (or smaller) than every other choice.
        for (const v of vals) if (v !== right) expect(mode === 'biggest' ? right / v : v / right).toBeGreaterThanOrEqual(1.25);
        expect(q.choices.every((c) => c.kind === 'piece' && c.toScale)).toBe(true);
      }
    }
  });

  it('names the dinosaur and knows what it ate', () => {
    for (const d of DINOS) {
      const n = nameQuestion(d, r());
      expect(n.choices[n.answer]).toEqual({ kind: 'dino', dino: d });
      for (const band of BANDS) {
        const q = dietQuestion(d, band, r());
        const c = q.choices[q.answer];
        expect(c.kind === 'emoji' && c.emoji).toBe(DINO_INFO[d].diet === 'meat' ? '🍖' : '🌿');
      }
    }
  });

  it('counts true features: 2 fingers, 3 horns, 4 spikes, the long neck', () => {
    const want = { trex: 2, triceratops: 3, stegosaurus: 4 } as const;
    for (const d of DINOS) {
      const q = featureQuestion(d, r());
      expectWellFormed(q);
      const c = q.choices[q.answer];
      if (d === 'diplodocus') expect(c).toEqual({ kind: 'dino', dino: 'diplodocus' });
      else expect(c).toEqual({ kind: 'number', n: want[d] });
    }
  });

  it('computes lengths and ages right', () => {
    for (const d of DINOS)
      for (let s = 0; s < 10; s++) {
        const c = compareQuestion(d, rng(s));
        const nums = [...c.text.en.matchAll(/about (\d+) m/g)].map((m) => Number(m[1]));
        expect(c.choices[c.answer]).toEqual({ kind: 'number', n: Math.abs(nums[0] - nums[1]) });
        const sum = sumQuestion(d, rng(s));
        const s2 = [...sum.text.en.matchAll(/about (\d+) m/g)].map((m) => Number(m[1]));
        expect(sum.choices[sum.answer]).toEqual({ kind: 'number', n: s2[0] + s2[1] });
        const t = timegapQuestion(d, rng(s));
        const ages = [...t.text.en.matchAll(/about (\d+) million/g)].map((m) => Number(m[1]));
        expect(t.choices[t.answer]).toEqual({ kind: 'number', n: ages[0] - ages[1] });
        expect(ages[0]).toBeGreaterThan(ages[1]);
        // "lived closer to our time": only true if the late one is nearer to us than to the early one.
        expect(ages[1]).toBeLessThan(ages[0] - ages[1]);
        const same = sameTimeQuestion(d, rng(s));
        const mate = same.choices[same.answer];
        expect(mate.kind === 'dino' && DINO_INFO[mate.dino].era).toBe(DINO_INFO[d].era);
        for (const [i, ch] of same.choices.entries()) if (i !== same.answer && ch.kind === 'dino') expect(DINO_INFO[ch.dino].era).not.toBe(DINO_INFO[d].era);
      }
  });
});

describe('Ziggy the Dino Digger — rebuilding', () => {
  it('offers the right bone among the others still on the tarp, stable between tries', () => {
    for (const plan of allPlans())
      for (const r of plan.rounds)
        r.placements.forEach((p, step) => {
          const c = boneChoices(r, step, 3);
          expect(c).toContain(p.piece);
          expect(new Set(c).size).toBe(c.length);
          expect(c.length).toBeLessThanOrEqual(r.options);
          expect(c.length).toBe(Math.min(r.options, r.placements.length - step));
          // Never a bone that is already placed.
          for (const x of c) expect(r.placements.slice(step).map((q) => q.piece)).toContain(x);
          expect(boneChoices(r, step, 3)).toEqual(c);
          expect(checkPiece(r, step, p.piece)).toBe(true);
          for (const x of c) if (x !== p.piece) expect(checkPiece(r, step, x)).toBe(false);
        });
  });

  it('turns a bone back the right way', () => {
    expect(turnsLeft(0)).toBe(0);
    expect(turnsLeft(1)).toBe(3);
    expect(turnsLeft(2)).toBe(2);
    expect(turnsLeft(3)).toBe(1);
    expect(checkTurns(4)).toBe(true);
    expect(checkTurns(3 + 1)).toBe(true);
    expect(checkTurns(5)).toBe(false);
    expect(turnHint(3, 2, 'fr')).toContain('1 quart de tour');
    expect(turnHint(2, 2, 'en')).toContain('2 more quarter turns');
    expect(turnHint(2, 0, 'fr')).not.toMatch(/\d/);
  });

  it('gives a gentle hint naming the piece, with its size for little ones', () => {
    const plan = planGame(4, 'little', 2);
    const r = plan.rounds[0];
    for (const l of LOCALES)
      r.placements.forEach((p, step) => {
        const h = pieceHint(r, step, 'little', l);
        expect(h).toContain(PIECE_INFO[p.piece].name[l]);
      });
    const fr = r.placements.map((_, s) => pieceHint(r, s, 'little', 'fr')).join(' ');
    expect(fr).toMatch(/plus (grand|petit) os/);
  });
});
