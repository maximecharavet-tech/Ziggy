import { describe, expect, it } from 'vitest';
import {
  BODIES,
  BODY,
  DELIVERIES,
  GIFT,
  PLANETS,
  PRAISE,
  PRETEND,
  REVEAL_AFTER,
  SKILLS,
  TEMPLATES,
  arriveText,
  candidateWords,
  checkAnswer,
  endText,
  factText,
  openText,
  peekText,
  planGame,
  questionText,
  speechText,
  wrongText,
  type Band,
  type BodyId,
  type Delivery,
} from './logic';
import { LEARNING_SKILLS } from '@/lib/learning/skills';
import { classify } from '@/lib/safety/policy';

const BANDS: Band[] = ['little', 'middle', 'big'];
const LOCALES = ['fr', 'en'];
const SEEDS = Array.from({ length: 80 }, (_, i) => i * 7919 + 13);

function games(band: Band, level: number): Delivery[][] {
  return SEEDS.map((s) => planGame(s, band, { astronomy: level, science: level, counting: level }));
}

/** Does `body` satisfy the riddle? Re-derived from the data, independently of the planner. */
function satisfies(d: Delivery, body: BodyId): boolean | null {
  const order = BODY[body].order;
  const m = /numéro (\d+)(?: ([+−×]) (\d+))?/.exec(d.text.fr);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[3] ?? 0);
    const n = m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a;
    return order === n;
  }
  if (d.id === 'compare') {
    const key = d.text.fr.includes('loin') ? 'far' : d.text.fr.includes('proche') ? 'near' : d.text.fr.includes('grande') ? 'big' : 'small';
    const val = (b: BodyId) => (key === 'far' || key === 'near' ? BODY[b].order! : BODY[b].diameterKm);
    const best = [...d.candidates].sort((x, y) => (key === 'far' || key === 'big' ? val(y) - val(x) : val(x) - val(y)))[0];
    return body === best;
  }
  if (d.id === 'size-between') {
    const names = PLANETS.filter((p) => d.text.fr.includes(BODY[p].the.fr));
    const [lo, hi] = names.sort((x, y) => BODY[x].diameterKm - BODY[y].diameterKm);
    return BODY[body].diameterKm > BODY[lo].diameterKm && BODY[body].diameterKm < BODY[hi].diameterKm;
  }
  if (d.id === 'no-ground') return BODY[body].kind === 'gas' || BODY[body].kind === 'ice';
  return null;
}

describe('Le Facteur des Planètes — the data is true', () => {
  it('lists the eight planets in order from the Sun', () => {
    expect(PLANETS).toEqual(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
    PLANETS.forEach((p, i) => expect(BODY[p].order).toBe(i + 1));
    expect(BODY.moon.order).toBeNull();
  });

  it('has the right sizes: Jupiter is the biggest, Mercury the smallest planet, the Moon smaller still', () => {
    const bySize = [...PLANETS].sort((a, b) => BODY[b].diameterKm - BODY[a].diameterKm);
    expect(bySize).toEqual(['jupiter', 'saturn', 'uranus', 'neptune', 'earth', 'venus', 'mars', 'mercury']);
    expect(BODY.moon.diameterKm).toBeLessThan(BODY.mercury.diameterKm);
  });

  it('has years that get longer away from the Sun', () => {
    for (let i = 1; i < PLANETS.length; i++) expect(BODY[PLANETS[i]].yearDays).toBeGreaterThan(BODY[PLANETS[i - 1]].yearDays);
    expect(BODY.mercury.yearDays).toBe(88);
    expect(BODY.earth.yearDays).toBe(365);
    expect(BODY.mars.yearDays).toBe(687);
    expect(Math.round(BODY.jupiter.yearDays / 365)).toBe(12);
    expect(Math.round(BODY.saturn.yearDays / 365)).toBe(29);
    expect(Math.round(BODY.uranus.yearDays / 365)).toBe(84);
    expect(Math.round(BODY.neptune.yearDays / 365)).toBe(165);
  });

  it('knows which worlds have no ground', () => {
    expect(PLANETS.filter((p) => BODY[p].kind === 'rocky')).toEqual(['mercury', 'venus', 'earth', 'mars']);
    expect(BODY.moon.kind).toBe('moon');
  });

  it('has facts for every age, in French and English', () => {
    for (const b of BODIES)
      for (const band of BANDS) {
        expect(BODY[b].facts[band].length).toBeGreaterThan(0);
        for (const f of BODY[b].facts[band]) {
          expect(f.fr.length).toBeGreaterThan(10);
          expect(f.en.length).toBeGreaterThan(10);
          expect(f.fr).not.toBe(f.en);
        }
      }
    for (const g of Object.values(GIFT)) {
      expect(g.line.fr).not.toBe(g.line.en);
      expect(g.name.fr && g.name.en).toBeTruthy();
    }
  });
});

describe('Le Facteur des Planètes — planning a game', () => {
  it('trains only learning skills the engine knows', () => {
    for (const s of SKILLS) expect(LEARNING_SKILLS).toContain(s);
    for (const t of TEMPLATES) expect(SKILLS).toContain(t.skill);
  });

  for (const band of BANDS)
    for (const level of [1, 2, 3, 4, 5])
      it(`makes ${DELIVERIES} solvable deliveries for ${band}, level ${level}`, () => {
        for (const game of games(band, level)) {
          expect(game).toHaveLength(DELIVERIES);
          // Five different addresses and five different riddles.
          expect(new Set(game.map((d) => d.answer)).size).toBe(DELIVERIES);
          expect(new Set(game.map((d) => d.id)).size).toBe(DELIVERIES);
          for (const d of game) {
            expect(d.candidates).toHaveLength(band === 'big' ? 4 : 3);
            expect(new Set(d.candidates).size).toBe(d.candidates.length);
            expect(d.candidates).toContain(d.answer);
            // Exactly one right planet among the choices.
            expect(d.candidates.filter((b) => checkAnswer(d, b))).toEqual([d.answer]);
            for (const b of d.candidates) {
              const ok = satisfies(d, b);
              if (ok !== null) expect(ok, `${d.id}: ${b} for "${d.text.fr}"`).toBe(b === d.answer);
            }
            expect(d.parcels).toBeGreaterThanOrEqual(1);
            expect(d.parcels).toBeLessThanOrEqual(band === 'little' ? 3 : band === 'middle' ? 2 : 1);
            expect(Object.keys(GIFT)).toContain(d.gift);
          }
          // One giant sock and one sneeze per game, on two different deliveries.
          expect(game.filter((d) => d.gift === 'sock')).toHaveLength(1);
          expect(game.filter((d) => d.sneeze)).toHaveLength(1);
          expect(game.findIndex((d) => d.gift === 'sock')).not.toBe(game.findIndex((d) => d.sneeze));
        }
      });

  it('is deterministic: same seed, same game', () => {
    expect(planGame(42, 'middle', { astronomy: 2 })).toEqual(planGame(42, 'middle', { astronomy: 2 }));
    expect(planGame(42, 'middle')).not.toEqual(planGame(43, 'middle'));
  });

  it('mixes skills: counting and science come up', () => {
    for (const band of BANDS) {
      const all = games(band, 3).flat();
      for (const s of SKILLS) expect(all.some((d) => d.skill === s), `${band} ${s}`).toBe(true);
    }
  });

  it('follows the age: little ones get colours, shapes and counting up to 4; big ones get sums and comparisons', () => {
    const little = games('little', 2).flat();
    const littleIds = new Set(little.map((d) => d.id));
    for (const id of ['calc', 'compare', 'year', 'size-between', 'order', 'neighbour']) expect(littleIds.has(id)).toBe(false);
    for (const d of little.filter((x) => x.id === 'count')) expect(BODY[d.answer].order!).toBeLessThanOrEqual(4);
    // Level 1: counting stays within 3.
    for (const d of games('little', 1).flat().filter((x) => x.id === 'count')) expect(BODY[d.answer].order!).toBeLessThanOrEqual(3);

    const middle = games('middle', 1).flat();
    for (const d of middle.filter((x) => x.id === 'order')) expect(BODY[d.answer].order!).toBeLessThanOrEqual(4);
    expect(middle.some((d) => d.id === 'neighbour')).toBe(false);
    expect(games('middle', 3).flat().some((d) => d.id === 'neighbour')).toBe(true);

    const big = games('big', 5).flat();
    const bigIds = new Set(big.map((d) => d.id));
    for (const id of ['calc', 'compare', 'size-between', 'year']) expect(bigIds.has(id)).toBe(true);
    expect(big.some((d) => d.text.fr.includes('×'))).toBe(true);
    // Level 1 sums only.
    for (const d of games('big', 1).flat().filter((x) => x.id === 'calc')) expect(d.text.fr).toMatch(/ \+ /);
  });

  it('brings the Moon (and its giant jumps) often', () => {
    const withMoon = games('little', 1).filter((g) => g.some((d) => d.answer === 'moon')).length;
    expect(withMoon / SEEDS.length).toBeGreaterThan(0.4);
  });
});

describe('Le Facteur des Planètes — words', () => {
  it('says everything in French and English, kindly', () => {
    for (const band of BANDS)
      for (const game of games(band, 3).slice(0, 25))
        for (const d of game) {
          const lines: string[] = [];
          for (const locale of LOCALES) {
            const wrong = d.candidates.find((b) => b !== d.answer)!;
            lines.push(
              questionText(d, locale),
              ...candidateWords(d, locale),
              wrongText(d, wrong, 1, locale),
              wrongText(d, wrong, REVEAL_AFTER, locale),
              peekText(wrong, locale),
              arriveText(d, locale),
              ...openText(d, locale),
              factText(d, band, locale, 3),
              endText(5, locale)
            );
          }
          expect(questionText(d, 'fr')).not.toBe(questionText(d, 'en'));
          expect(arriveText(d, 'fr')).not.toBe(arriveText(d, 'en'));
          for (const line of lines) {
            expect(line.trim().length, line).toBeGreaterThan(1);
            expect(line).not.toMatch(/undefined|NaN|\[object/);
            expect(classify(line), line).toBeNull();
            expect(line).not.toMatch(/triste|perdu|échec|raté|faux|nul\b|sad|lost|fail|wrong answer|stupid/i);
          }
        }
    for (const p of [...PRAISE, PRETEND]) expect(p.fr).not.toBe(p.en);
  });

  it('never calls a wrong planet a failure: it is a wrong address with a hint, then the right planet shines', () => {
    const d = planGame(5, 'middle')[0];
    const wrong = d.candidates.find((b) => b !== d.answer)!;
    expect(wrongText(d, wrong, 1, 'fr')).toMatch(/bonne adresse/);
    expect(wrongText(d, wrong, 1, 'fr')).toContain(d.hint.fr);
    expect(wrongText(d, wrong, 1, 'en')).toContain(d.hint.en);
    expect(wrongText(d, wrong, REVEAL_AFTER, 'fr')).toMatch(/brille/);
    expect(wrongText(d, wrong, REVEAL_AFTER, 'en')).toMatch(/shining/);
  });

  it('tells the sneeze and the giant sock', () => {
    const game = planGame(11, 'big');
    const sneeze = game.find((d) => d.sneeze)!;
    const sock = game.find((d) => d.gift === 'sock')!;
    expect(openText(sneeze, 'fr').join(' ')).toMatch(/ATCHOUM/);
    expect(openText(sneeze, 'en').join(' ')).toMatch(/ACHOO/);
    expect(openText(sock, 'fr').join(' ')).toMatch(/chaussette géante/);
    expect(openText(sock, 'en').join(' ')).toMatch(/giant sock/);
  });

  it('says maths signs as words for the voice', () => {
    expect(speechText('la planète numéro 2 × 3', 'fr')).toBe('la planète numéro 2 fois 3');
    expect(speechText('planet number 7 − 4', 'en')).toBe('planet number 7 minus 4');
    expect(speechText('numéro 1 + 2', 'fr')).toBe('numéro 1 plus 2');
  });

  it('explains that there is no ground on the giants', () => {
    const fake = (answer: BodyId): Delivery => ({ ...planGame(1, 'big')[0], answer });
    expect(arriveText(fake('jupiter'), 'fr')).toMatch(/pas de sol/i);
    expect(arriveText(fake('saturn'), 'en')).toMatch(/no ground/);
    expect(arriveText(fake('neptune'), 'fr')).toMatch(/sans sol/);
    expect(arriveText(fake('mars'), 'fr')).toMatch(/Atterrissage sur Mars/);
  });
});
