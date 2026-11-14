import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGE_MAX, AGE_MIN, SANTA_AGE_MIN, ageRange } from './ages';

const DIR = join(process.cwd(), 'messages');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.json'));
const get = (data: Record<string, Record<string, string>>, path: string) => {
  const [a, b] = path.split('.');
  return data[a!]?.[b!] ?? '';
};
/** The messages that state the audience (home badge, meta description, FAQ, two modules). */
const AGE_KEYS = ['metadata.description', 'hero.badge', 'faq.a2', 'modules.ai_basics_ages', 'modules.holiday_ages'];

describe('one age range everywhere', () => {
  it('is 4 to 12 and the Santa app starts at 3', () => {
    expect([AGE_MIN, AGE_MAX, ageRange()]).toEqual([4, 12, '4-12']);
    expect(SANTA_AGE_MIN).toBeLessThan(AGE_MIN);
  });
  it('is spelled the same in the 12 message files', () => {
    expect(FILES).toHaveLength(12);
    for (const f of FILES) {
      const data = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
      for (const key of AGE_KEYS) {
        const text = get(data, key);
        expect(text, `${f} ${key}`).toMatch(new RegExp(`(?<![\\d.])${AGE_MIN}(?!\\d)[^0-9"]{0,10}${AGE_MAX}(?!\\d)`));
      }
    }
  });
  it('has no leftover "5-12" in any message', () => {
    for (const f of FILES) {
      expect(readFileSync(join(DIR, f), 'utf8'), f).not.toMatch(/(?<![\d.])5(?!\d)[^0-9"]{0,10}12(?!\d)/);
    }
  });
  it('has no leftover "5-12" in the site pages and prompts', () => {
    for (const rel of ['src/data/landings.ts', 'src/app/[locale]/terms/page.tsx', 'src/app/[locale]/privacy/page.tsx', 'src/lib/ai.ts', 'src/lib/agents.ts', 'src/lib/seo.ts']) {
      expect(readFileSync(join(process.cwd(), rel), 'utf8'), rel).not.toMatch(/(?<![\d.])5(?!\d)\s?(-|–|à|to)\s?12(?!\d)/);
    }
  });
});
