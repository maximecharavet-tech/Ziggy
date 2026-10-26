import { describe, expect, it } from 'vitest';
import { PAGES, THEMES, pageById } from './pages';
import { flatSvg, fillsSvg, modelFills } from './svg';
import { validatePage } from './validate';

describe('coloring pages', () => {
  it('has at least 16 pages with unique ids', () => {
    expect(PAGES.length).toBeGreaterThanOrEqual(16);
    expect(new Set(PAGES.map((p) => p.id)).size).toBe(PAGES.length);
  });

  it.each(PAGES.map((p) => [p.id, p] as const))('%s is valid', (_id, page) => {
    expect(validatePage(page)).toEqual([]);
    expect(page.regions.length).toBeGreaterThanOrEqual(6);
  });

  it('covers every theme', () => {
    for (const t of THEMES) expect(PAGES.some((p) => p.theme === t.id)).toBe(true);
  });

  it('includes the requested subjects', () => {
    for (const id of ['ziggy', 'lili', 'castle', 'christmas-tree', 'snowman', 'rocket', 'dinosaur', 'underwater', 'unicorn', 'cat', 'house', 'butterfly', 'train', 'mandala', 'car', 'owl']) {
      expect(pageById(id), id).toBeDefined();
    }
  });

  it('the validator catches broken data', () => {
    const bad = { ...PAGES[0], viewBox: '0 0 -1 x', regions: [{ id: 'a', d: '', c: 'nope' }, { id: 'a', d: 'M0 0LNaN 1Z', c: 'red' }] };
    const errors = validatePage(bad);
    expect(errors.some((e) => e.includes('viewBox'))).toBe(true);
    expect(errors.some((e) => e.includes('duplicate'))).toBe(true);
    expect(errors.some((e) => e.includes('empty path'))).toBe(true);
    expect(errors.some((e) => e.includes('invalid path'))).toBe(true);
    expect(errors.some((e) => e.includes('only 2 regions'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown model colour'))).toBe(true);
  });

  it('builds SVG text for every page', () => {
    for (const p of PAGES) {
      const s = flatSvg(p, modelFills(p));
      expect(s.startsWith('<svg')).toBe(true);
      expect(s).not.toContain('NaN');
      expect(fillsSvg(p, {})).toContain('magic-rainbow');
    }
  });
});
