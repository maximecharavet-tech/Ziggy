import { describe, expect, it } from 'vitest';
import { SANTA_AI_MINUTES, SANTA_NEW_PRICING, SANTA_OFFERS, SANTA_PROPOSED_OFFERS } from './offer';

describe('Santa offer prices', () => {
  it('keeps the proposed price table behind a disabled code flag', () => {
    expect(SANTA_NEW_PRICING).toBe(false);
    expect(SANTA_PROPOSED_OFFERS.map((offer) => offer.amount)).toEqual([599,1299,1999,399,699,299,999,1499]);
  });
  it('preserves production checkout prices and AI minutes', () => {
    expect(SANTA_OFFERS.essentiel.amount).toBe(499);
    expect(SANTA_OFFERS.magique.amount).toBe(999);
    expect(SANTA_AI_MINUTES).toBe(20);
  });
});
