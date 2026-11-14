import { describe, expect, it } from 'vitest';
import { introDayStamp, lutinsIntroMode } from './LutinsIntro';

describe('lutins intro cadence', () => {
  it('stamps the local calendar day', () => {
    expect(introDayStamp(new Date(2026, 10, 14, 23, 59))).toBe('2026-11-14');
    expect(introDayStamp(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });

  it('plays once a day, or shows the poster when motion is reduced', () => {
    expect(lutinsIntroMode('2026-11-14', '2026-11-14', false)).toBe('skip');
    expect(lutinsIntroMode('2026-11-13', '2026-11-14', false)).toBe('video');
    expect(lutinsIntroMode(null, '2026-11-14', false)).toBe('video');
    expect(lutinsIntroMode(null, '2026-11-14', true)).toBe('poster');
    expect(lutinsIntroMode('2026-11-14', '2026-11-14', true)).toBe('skip');
  });
});
