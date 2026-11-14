import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(process.cwd(), 'src/components/app/AppChristmas.tsx'), 'utf8');
const pill = readFileSync(join(process.cwd(), 'src/components/wellbeing/BreakReminder.tsx'), 'utf8');

describe('Christmas card typography and pause pill', () => {
  it('keeps the exclamation mark on the same line (nbsp) in FR and EN', () => {
    expect(src).toMatch(/Noël\\u00A0!/);
    expect(src).toMatch(/coming\\u00A0!/);
    expect(src).toMatch(/min-w-0 flex-1 text-balance/);
  });

  it('sits the break reminder above the app tab bar', () => {
    expect(pill).toContain('bottom-[calc(var(--tabbar-h,0px)+env(safe-area-inset-bottom,0px)+1rem)]');
  });
});
