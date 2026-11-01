import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// In Chromium (the Android WebView of the app), `overscroll-behavior: none` on the
// body stops the finger from scrolling the page: keep it on <html> only.
const BODY_NO_OVERSCROLL = /(^|[}\s,])body\s*\{[^}]*overscroll-behavior\s*:\s*none/;

describe('touch scrolling in the app', () => {
  it.each([
    ['the site (globals.css)', 'src/app/globals.css'],
    ['the app shell (shell.js)', 'apps/ziggy-app/src-tauri/src/shell.js'],
  ])('%s never sets overscroll-behavior: none on the body', (_name, file) => {
    expect(readFileSync(join(process.cwd(), file), 'utf8')).not.toMatch(BODY_NO_OVERSCROLL);
  });

  it('the site undoes the rule of the first APKs on the body', () => {
    expect(readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')).toMatch(/html\[data-app\] body \{ overscroll-behavior: auto; \}/);
  });
});
