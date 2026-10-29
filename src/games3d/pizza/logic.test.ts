import { describe, expect, it } from 'vitest';
import {
  CUSTOMERS,
  CUSTOMER_INFO,
  CUSTOMERS_PER_GAME,
  TOPPINGS,
  TOPPING_INFO,
  addPiece,
  askHint,
  askText,
  checkChange,
  checkPizza,
  checkSum,
  coinsTotal,
  countPhrase,
  emptyPizza,
  gobbleText,
  helloText,
  hintText,
  instructionText,
  orderText,
  partsFor,
  payHint,
  payText,
  pigeonText,
  planGame,
  solve,
  stepsOf,
  toggleSlice,
  wanted,
  type Band,
  type Round,
} from './logic';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 97 + 3);
const BANDS: Band[] = ['little', 'middle', 'big'];

function allRounds(band: Band, level: number): Round[] {
  return SEEDS.flatMap((s) => planGame(s, band, level));
}

describe('planGame', () => {
  it('serves five different customers, the same way for the same seed', () => {
    for (const band of BANDS) {
      const a = planGame(42, band, 2);
      expect(a).toHaveLength(CUSTOMERS_PER_GAME);
      expect(new Set(a.map((r) => r.customer)).size).toBe(CUSTOMERS_PER_GAME);
      expect(planGame(42, band, 2)).toEqual(a);
    }
    expect(planGame(1, 'middle', 2)).not.toEqual(planGame(2, 'middle', 2));
  });

  it('has one candy gag (the bear) and one pigeon round with olives in every game', () => {
    for (const band of BANDS)
      for (const s of SEEDS) {
        const g = planGame(s, band, 3);
        expect(g.filter((r) => r.candy).map((r) => r.customer)).toEqual(['bear']);
        const pigeons = g.filter((r) => r.pigeon);
        expect(pigeons).toHaveLength(1);
        expect(wanted(pigeons[0].order).has('olive')).toBe(true);
      }
  });

  it('gives buttons that contain the whole order, without duplicates', () => {
    for (const band of BANDS)
      for (const r of allRounds(band, 3)) {
        expect(new Set(r.choices).size).toBe(r.choices.length);
        for (const t of wanted(r.order).keys()) expect(r.choices).toContain(t);
        expect(r.choices.length).toBe(band === 'little' ? 4 : band === 'middle' ? 5 : 6);
        // Toppings of one order are all different.
        expect(new Set(r.order.items.map((it) => it.topping)).size).toBe(r.order.items.length);
      }
  });

  it('little ones count small amounts (up to 6), with pictures and no oven button', () => {
    for (const lv of [1, 2]) {
      for (const r of allRounds('little', lv)) {
        expect(r.order.kind).toBe('count');
        if (r.order.kind !== 'count') continue;
        const total = r.order.items.reduce((s, it) => s + it.n, 0);
        expect(total).toBeGreaterThanOrEqual(1);
        expect(total).toBeLessThanOrEqual(6);
        for (const it of r.order.items) expect(it.n).toBeGreaterThanOrEqual(1);
        expect(r.autoFinish).toBe(true);
        expect(r.skill).toBe('counting');
        expect(r.ask).toBeNull();
        expect(r.pay).toBeNull();
      }
    }
    const max = (lv: number) => Math.max(...allRounds('little', lv).map((r) => (r.order.kind === 'count' ? Math.max(...r.order.items.map((it) => it.n)) : 0)));
    expect(max(2)).toBeGreaterThan(max(1));
  });

  it('middle: sums while it bakes, halves, and a missing addend from level 3', () => {
    const lv1 = allRounds('middle', 1);
    expect(lv1.some((r) => r.order.kind === 'parts' && r.order.parts === 2)).toBe(true);
    for (const r of lv1) {
      if (r.order.kind === 'parts') {
        expect(r.order.items.every((it) => it.num === 1 && it.den === 2)).toBe(true);
        expect(r.skill).toBe('shapes');
        continue;
      }
      expect(r.order.items).toHaveLength(2);
      expect(r.ask).not.toBeNull();
      const sum = r.order.items[0].n + r.order.items[1].n;
      expect(r.ask!.answer).toBe(sum);
      expect(r.ask!.options).toContain(sum);
      expect(new Set(r.ask!.options).size).toBe(3);
      expect(Math.min(...r.ask!.options)).toBeGreaterThanOrEqual(1);
      expect(r.skill).toBe('addition');
    }
    const lv3 = allRounds('middle', 3);
    const missing = lv3.filter((r) => r.order.kind === 'count' && r.order.total !== null);
    expect(missing.length).toBe(SEEDS.length);
    for (const r of missing) {
      if (r.order.kind !== 'count') continue;
      expect(r.order.total).toBe(r.order.items[0].n + r.order.items[1].n);
      expect(r.order.items.map((it) => it.topping)).toContain(r.order.hidden);
      expect(r.ask).toBeNull();
    }
    expect(allRounds('middle', 4).some((r) => r.order.kind === 'parts' && r.order.parts === 4)).toBe(true);
  });

  it('big: fractions that fit the slices, and change to give back', () => {
    for (const lv of [1, 2, 3, 4, 5]) {
      for (const r of allRounds('big', lv)) {
        expect(r.order.kind).toBe('parts');
        if (r.order.kind !== 'parts') continue;
        expect(r.order.parts).toBe(lv >= 3 ? 8 : 4);
        let used = 0;
        for (const it of r.order.items) {
          const k = partsFor(it, r.order.parts);
          expect(Number.isInteger(k)).toBe(true);
          expect(k).toBeGreaterThanOrEqual(1);
          used += k;
        }
        expect(used).toBeLessThanOrEqual(r.order.parts);
        if (r.pay) {
          expect(r.pay.change).toBe(r.pay.paid - r.pay.price);
          expect(r.pay.change).toBeGreaterThan(0);
          expect(r.pay.change).toBeLessThanOrEqual(9);
          expect(r.skill).toBe('subtraction');
        } else expect(r.skill).toBe('shapes');
      }
    }
    // Eighths only at the top level.
    const dens = (lv: number) => new Set(allRounds('big', lv).flatMap((r) => (r.order.kind === 'parts' ? r.order.items.map((it) => it.den) : [])));
    expect(dens(4).has(8)).toBe(false);
    expect(dens(5).has(8)).toBe(true);
    expect(allRounds('big', 1).filter((r) => r.pay).length).toBe(SEEDS.length * 3);
  });
});

describe('checks', () => {
  it('accepts the right pizza and explains the wrong ones', () => {
    for (const band of BANDS)
      for (const r of allRounds(band, 3)) {
        const good = solve(r.order);
        expect(checkPizza(r.order, good)).toBeNull();
        expect(checkPizza(r.order, emptyPizza(r.order))?.kind).toBe('tooFew');
        const extra = TOPPINGS.find((t) => !wanted(r.order).has(t))!;
        const wrong = r.order.kind === 'count' ? addPiece(good, extra) : toggleSlice(good, good.parts.indexOf(null) >= 0 ? good.parts.indexOf(null) : 0, extra);
        expect(checkPizza(r.order, wrong)?.kind).toBe('wrong');
        if (r.order.kind === 'count') {
          const t = r.order.items[0].topping;
          expect(checkPizza(r.order, addPiece(good, t))).toEqual({ kind: 'tooMany', topping: t, have: r.order.items[0].n + 1, want: r.order.items[0].n });
          expect(checkPizza(r.order, addPiece(good, t, -1))?.kind).toBe('tooFew');
        }
      }
  });

  it('toggles a slice on and off', () => {
    const order = { kind: 'parts' as const, parts: 4, items: [{ topping: 'olive' as const, num: 1, den: 2 }] };
    let p = emptyPizza(order);
    p = toggleSlice(p, 1, 'olive');
    expect(p.parts).toEqual([null, 'olive', null, null]);
    p = toggleSlice(p, 1, 'cheese');
    expect(p.parts[1]).toBe('cheese');
    p = toggleSlice(p, 1, 'cheese');
    expect(p.parts[1]).toBeNull();
    expect(toggleSlice(p, 9, 'olive')).toBe(p);
    // Half of 4 slices is 2 slices.
    expect(checkPizza(order, toggleSlice(toggleSlice(p, 0, 'olive'), 3, 'olive'))).toBeNull();
  });

  it('checks the sum and the change', () => {
    expect(checkSum({ answer: 5, options: [4, 5, 6] }, 5)).toBe(true);
    expect(checkSum({ answer: 5, options: [4, 5, 6] }, 6)).toBe(false);
    const pay = { price: 7, paid: 10, change: 3 };
    expect(checkChange(pay, [2, 1])).toBe('ok');
    expect(checkChange(pay, [2])).toBe('less');
    expect(checkChange(pay, [5])).toBe('more');
    expect(coinsTotal([5, 2, 2])).toBe(9);
  });

  it('counts the steps of a round', () => {
    const g = planGame(9, 'big', 1);
    for (const r of g) expect(stepsOf(r)).toBe(r.pay ? 2 : 1);
  });
});

describe('words', () => {
  it('says every order, hint and question in French and English', () => {
    for (const band of BANDS)
      for (const lv of [1, 3, 5])
        for (const r of planGame(lv * 11, band, lv)) {
          const texts: [string, string][] = [
            [orderText(r, 'fr'), orderText(r, 'en')],
            [instructionText(r, 'fr'), instructionText(r, 'en')],
            [helloText(r, 'fr'), helloText(r, 'en')],
            [pigeonText(r, 'fr'), pigeonText(r, 'en')],
          ];
          const empty = emptyPizza(r.order);
          const few = checkPizza(r.order, empty)!;
          texts.push([hintText(r, few, 'fr'), hintText(r, few, 'en')]);
          const extra = TOPPINGS.find((t) => !wanted(r.order).has(t))!;
          texts.push([hintText(r, { kind: 'wrong', topping: extra }, 'fr'), hintText(r, { kind: 'wrong', topping: extra }, 'en')]);
          if (r.ask) texts.push([askText(r, 'fr'), askText(r, 'en')], [askHint(r, 'fr'), askHint(r, 'en')]);
          if (r.pay) texts.push([payText(r, 'fr'), payText(r, 'en')], [payHint(r, [1], 'fr'), payHint(r, [1], 'en')]);
          if (r.order.kind === 'count') texts.push([gobbleText(r, r.order.items[0].topping, 'fr'), gobbleText(r, r.order.items[0].topping, 'en')]);
          for (const [fr, en] of texts) {
            expect(fr.length).toBeGreaterThan(8);
            expect(en.length).toBeGreaterThan(8);
            expect(fr).not.toBe(en);
            expect(fr + en).not.toMatch(/undefined|NaN|null/);
          }
        }
  });

  it('names every topping and customer in both languages', () => {
    for (const t of TOPPINGS) {
      const i = TOPPING_INFO[t];
      for (const l of [i.one, i.many, i.label, i.some, i.fact]) {
        expect(l.fr).toBeTruthy();
        expect(l.en).toBeTruthy();
      }
    }
    for (const c of CUSTOMERS) for (const l of [CUSTOMER_INFO[c].name, CUSTOMER_INFO[c].hello, CUSTOMER_INFO[c].yum]) expect(l.fr && l.en).toBeTruthy();
  });

  it('agrees colours and plurals', () => {
    expect(countPhrase('tomato', 3, 'fr', true)).toBe('3 tomates rouges');
    expect(countPhrase('tomato', 1, 'fr', true)).toBe('1 tomate rouge');
    expect(countPhrase('tomato', 3, 'en', true)).toBe('3 red tomatoes');
    expect(countPhrase('pineapple', 2, 'fr')).toBe('2 morceaux d’ananas');
    expect(countPhrase('olive', 1, 'en')).toBe('1 olive');
  });

  it('reads halves and fractions naturally', () => {
    const r = planGame(5, 'middle', 1).find((x) => x.order.kind === 'parts')!;
    expect(orderText(r, 'fr')).toMatch(/sur une moitié, et .* sur l’autre moitié/);
    expect(orderText(r, 'en')).toMatch(/on one half, and .* on the other half/);
    const big = planGame(5, 'big', 1)[0];
    expect(orderText(big, 'fr')).toMatch(/de la pizza/);
    expect(orderText(big, 'en')).toMatch(/of the pizza/);
  });
});
