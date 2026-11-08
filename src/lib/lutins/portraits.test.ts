import { describe, expect, it } from 'vitest';
import { portraitPrompt, canonicalPath, lutinsPublicUrl, PORTRAIT_TARGETS } from './portraits';
import bible from '@/data/lutins/bible.json';

describe('elf portraits', () => {
  it('the sheet shows the three elves in order, on white, with each look verbatim', () => {
    const { prompt, size } = portraitPrompt('sheet', false);
    expect(size).toBe('1536x1024');
    const [p, g, n] = bible.elves.map((e) => prompt.indexOf(e.look));
    expect(p).toBeGreaterThan(0);
    expect(g).toBeGreaterThan(p);
    expect(n).toBeGreaterThan(g);
    expect(prompt).toMatch(/pure white seamless background/);
    expect(prompt).toMatch(/No text/);
  });
  it('each portrait copies its elf from the approved sheet when there is one', () => {
    for (const t of PORTRAIT_TARGETS.filter((x) => x !== 'sheet')) {
      const withRef = portraitPrompt(t, true).prompt;
      const without = portraitPrompt(t, false).prompt;
      const look = bible.elves.find((e) => e.id === t)!.look;
      expect(withRef).toContain(look);
      expect(withRef).toMatch(/reference image/);
      expect(without).not.toMatch(/reference image/);
      for (const other of bible.elves.filter((e) => e.id !== t)) expect(withRef).not.toContain(other.look);
    }
  });
  it('builds public addresses in the bucket', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co/';
    expect(lutinsPublicUrl(canonicalPath('pepin'), 5)).toBe('https://abc.supabase.co/storage/v1/object/public/ziggy-dodo/lutins/pepin.png?v=5');
  });
});
