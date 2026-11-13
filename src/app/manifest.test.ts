import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './manifest';

const m = manifest();
const onDisk = (src: string) => existsSync(join(process.cwd(), 'public', src));

describe('web app manifest', () => {
  it('identifies the app and opens the app home', () => {
    expect(m.id).toBe('/');
    expect(m.start_url).toBe('/app');
    expect(m.scope).toBe('/');
    expect(m.lang).toBe('fr');
    expect(m.description).toContain('4 à 12 ans');
  });
  it('keeps "any" and "maskable" icons separate (never "any maskable")', () => {
    const purposes = (m.icons ?? []).map((i) => i.purpose);
    expect(purposes).not.toContain('any maskable');
    expect(purposes).toContain('maskable');
    expect(purposes).toContain('any');
  });
  it('only references files that exist', () => {
    const files = [...(m.icons ?? []), ...(m.screenshots ?? []), ...(m.shortcuts ?? []).flatMap((s) => s.icons ?? [])].map((i) => i.src);
    expect(files.length).toBeGreaterThan(8);
    for (const f of files) expect(onDisk(f), f).toBe(true);
  });
  it('has the three shortcuts', () => {
    expect((m.shortcuts ?? []).map((s) => s.url)).toEqual(['/dodo', '/monde', '/pere-noel']);
  });
});
