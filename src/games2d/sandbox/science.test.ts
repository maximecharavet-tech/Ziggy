import { describe, expect, it } from 'vitest';
import { GRAVITY_LEVELS, LAB_TEXT, NORMAL, TEMPERATURE_LEVELS, levelLabel, scienceLine } from './science';

describe('big kids’ lab (gravity and temperature)', () => {
  it('has five steps each, the middle one being the world as it is', () => {
    expect(GRAVITY_LEVELS).toHaveLength(5);
    expect(TEMPERATURE_LEVELS).toHaveLength(5);
    expect(GRAVITY_LEVELS[NORMAL].value).toBe(100);
    expect(TEMPERATURE_LEVELS[NORMAL].value).toBe(0);
    // Within what the engine accepts (set_gravity 20–200 %, set_temperature ±70).
    for (const l of GRAVITY_LEVELS) expect(l.value >= 20 && l.value <= 200).toBe(true);
    for (const l of TEMPERATURE_LEVELS) expect(Math.abs(l.value)).toBeLessThanOrEqual(70);
  });

  it('says what changed, in French and English, gently, for every step', () => {
    const banned = /\b(mort|meurt|tuer|détruit|brûle|explos|kill|dead|die|destroy|burn|explod|fail|perdu|lost)\w*/i;
    const texts: string[] = Object.values(LAB_TEXT).flatMap((l) => [l.fr, l.en]);
    for (const kind of ['gravity', 'temperature'] as const) {
      for (let k = 0; k < 5; k++) {
        const line = scienceLine(kind, k);
        const label = levelLabel(kind, k);
        texts.push(line.fr, line.en, label.fr, label.en);
        expect(line.fr).not.toBe(line.en);
        expect(line.fr.startsWith(label.fr)).toBe(true);
      }
    }
    for (const t of texts) {
      expect(t.trim().length).toBeGreaterThan(1);
      expect(t).not.toMatch(banned);
    }
    // Lower and higher than normal say different things.
    expect(scienceLine('gravity', 0).en).not.toBe(scienceLine('gravity', 4).en);
    expect(scienceLine('temperature', 1).fr).toMatch(/froid/);
    expect(scienceLine('temperature', 3).en).toMatch(/warmer/);
  });
});
