import { describe, expect, it } from 'vitest';
import { findForbiddenFields, isForbiddenName, validateLevel, assertLevel, words } from './level';

const base = () => ({
  schema: 'ziggy.level/1',
  game: 'lutin-chaos',
  id: 'chaos.kitchen',
  version: '1.0.0',
  title: { fr: 'La cuisine', en: 'The kitchen' },
  season: 'winter',
  assets: ['lutins.model.pepin', 'chaos.room.kitchen'],
  skills: ['counting', 'logic'],
  bands: {
    little: { layout: 'kitchen-a', pickCount: 2, pranks: [{ id: 'socks-in-fridge', type: 'move-into', fix: { mechanic: 'count-back', params: { count: 4 } } }] },
    middle: { layout: 'kitchen-a', pickCount: 3, ideas: [{ kind: 'max-machines', value: 3 }] },
  },
});

describe('level validator', () => {
  it('accepts a good envelope', () => {
    const r = validateLevel(base());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it.each([
    ['timer', { timer: 30 }],
    ['timeLimit', { timeLimit: 60 }],
    ['time_limit', { time_limit: 60 }],
    ['time-limit', { 'time-limit': 60 }],
    ['TIMEOUT', { TIMEOUT: 5 }],
    ['countdown', { countdown: 10 }],
    ['lives', { lives: 3 }],
    ['maxLives', { maxLives: 3 }],
    ['fail', { fail: { when: 'x' } }],
    ['onFail', { onFail: 'retry' }],
    ['failScreen', { failScreen: true }],
    ['gameOver', { gameOver: true }],
    ['score', { score: 0 }],
    ['maxTries', { maxTries: 2 }],
    ['penalty', { penalty: 1 }],
  ])('rejects a "%s" field anywhere (deep in a band)', (_name, extra) => {
    const lvl = base();
    Object.assign(lvl.bands.little.pranks[0].fix.params, extra);
    const r = validateLevel(lvl);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/forbidden field/);
  });

  it('rejects them at the top level and in arrays too', () => {
    expect(validateLevel({ ...base(), timeLimit: 30 }).ok).toBe(false);
    const lvl = base();
    (lvl.bands.middle.ideas as unknown[]).push({ lives: 2 });
    const r = validateLevel(lvl);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('$.bands.middle.ideas[1].lives'))).toBe(true);
  });

  it('rejects forbidden rule kinds ("ideas": [{ "kind": "time-limit" }])', () => {
    const lvl = base();
    lvl.bands.middle.ideas = [{ kind: 'time-limit', value: 30 }];
    const r = validateLevel(lvl);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/forbidden rule "time-limit"/);
    expect(findForbiddenFields({ type: 'game-over' })).toHaveLength(1);
    expect(findForbiddenFields({ mode: 'speedRun' })).toHaveLength(1);
  });

  it('does not flag harmless names', () => {
    for (const ok of ['tile', 'olives', 'lifetimeHint', 'timeline', 'clock', 'stars', 'pickCount', 'ticks', 'tickSeconds', 'step', 'move-into', 'count-back'])
      expect(isForbiddenName(ok), ok).toBe(false);
    expect(words('timeLimitSec')).toEqual(['time', 'limit', 'sec']);
    expect(words('HTMLTimer')).toEqual(['html', 'timer']);
  });

  it('checks the envelope: schema, ids, semver, FR+EN title, skills, bands, unknown fields', () => {
    const r = validateLevel({
      schema: 'ziggy.level/2',
      game: 'Lutin Chaos',
      id: 'Kitchen',
      version: 'v1',
      title: { fr: 'La cuisine', en: '' },
      assets: ['ok.asset', 'BAD', 'ok.asset'],
      skills: ['counting', 'juggling'],
      bands: { huge: {}, little: 3 },
      extra: 1,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const all = r.errors.join('\n');
    for (const bit of ['$.schema', '$.game', '$.id', '$.version', '$.title.en', '$.assets[1]', '$.assets[2]: duplicate', '$.skills[1]', '$.bands.huge', '$.bands.little', '$.extra: unknown field']) expect(all).toContain(bit);
  });

  it('checks known assets, the expected game and the game band validator', () => {
    const r = validateLevel(base(), {
      game: 'lutin-factory',
      knownAssets: new Set(['lutins.model.pepin']),
      validateBand: (b, name, path) => ((b as { pickCount: number }).pickCount > 2 ? [`${path}.pickCount: too many for ${name}`] : []),
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain('$.game: expected "lutin-factory", got "lutin-chaos"');
    expect(r.errors).toContain('$.assets[1]: unknown asset "chaos.room.kitchen"');
    expect(r.errors).toContain('$.bands.middle.pickCount: too many for middle');
  });

  it('non-objects are rejected; assertLevel throws a readable error', () => {
    expect(validateLevel(null).ok).toBe(false);
    expect(validateLevel([]).ok).toBe(false);
    expect(() => assertLevel({ ...base(), lives: 3 })).toThrow(/forbidden field/);
    expect(assertLevel(base()).id).toBe('chaos.kitchen');
  });
});
