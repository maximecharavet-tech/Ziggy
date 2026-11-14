import { describe, expect, it } from 'vitest';
import { CHALLENGES, DISCOVERIES, EL, REACTIONS, TOOLS, WORLDS, WORLD_INFO, drawerTools, invitation } from './content';

const all = () => {
  const out: string[] = [];
  for (const d of DISCOVERIES) out.push(d.title.fr, d.title.en, d.science.fr, d.science.en, d.hint.fr, d.hint.en);
  for (const t of TOOLS) out.push(t.name.fr, t.name.en, t.say.fr, t.say.en);
  for (const w of WORLDS) out.push(WORLD_INFO[w].name.fr, WORLD_INFO[w].name.en, WORLD_INFO[w].hello.fr, WORLD_INFO[w].hello.en);
  return out;
};

describe('sandbox content', () => {
  it('keeps the ten first reaction ids, in place, and the four challenges', () => {
    expect(REACTIONS.slice(0, 10)).toEqual(['sprout', 'melt_ice', 'melt_snow', 'evaporate', 'condense', 'rain', 'bloom', 'sink', 'bubble', 'wind']);
    expect(CHALLENGES.map((c) => c.id)).toEqual(['flowers', 'melt', 'cloud', 'rain']);
  });

  it('has one notebook card per reaction and nothing else', () => {
    expect(new Set(DISCOVERIES.map((d) => d.id)).size).toBe(DISCOVERIES.length);
    expect([...DISCOVERIES.map((d) => d.id)].sort()).toEqual([...REACTIONS].sort());
    expect(DISCOVERIES.filter((d) => !d.gift).length).toBeGreaterThanOrEqual(45);
    expect(Object.keys(EL).length).toBeGreaterThanOrEqual(35);
  });

  it('speaks French and English everywhere, gently', () => {
    const banned = /\b(mort|meurt|tuer|détruit|détruire|brûle|brûler|explos|kill|dead|die|destroy|burn|explod|fail|perdu|lost)\w*/i;
    for (const s of all()) {
      expect(s.trim().length).toBeGreaterThan(1);
      expect(s).not.toMatch(banned);
    }
  });

  it('gives each world six big tools that exist, and a drawer with everything', () => {
    for (const w of WORLDS) {
      const big = WORLD_INFO[w].big;
      expect(big).toHaveLength(6);
      for (const id of big) expect(TOOLS.some((t) => t.id === id)).toBe(true);
      expect(drawerTools(w)).toHaveLength(TOOLS.length);
      expect(DISCOVERIES.some((d) => d.world === w)).toBe(true);
    }
  });

  it('offers an idea from a discovery not made yet', () => {
    expect(invitation('garden', {})?.world).toBe('garden');
    const done = Object.fromEntries(DISCOVERIES.filter((d) => d.world === 'moon').map((d) => [d.id, 1]));
    expect(invitation('moon', done)).toBeNull();
  });
});
