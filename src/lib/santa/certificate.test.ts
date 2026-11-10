import { describe, expect, it } from 'vitest';
import { certificateLayout, certificateNameFontSize } from './certificate';

describe('certificate text layout', () => {
  it('keeps first names from one through 24 characters inside the name area', () => {
    for (let size = 1; size <= 24; size += 1) {
      const layout = certificateLayout('A'.repeat(size));
      expect(layout.name.length).toBe(size);
      expect(layout.nameFontSize * size * 0.62).toBeLessThanOrEqual(layout.maxNameWidth);
    }
  });
  it('caps long names and uses the smallest readable size', () => {
    expect(certificateLayout('A'.repeat(30)).name).toHaveLength(24);
    expect(certificateNameFontSize(24)).toBe(46);
  });
});
