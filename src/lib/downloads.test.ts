import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, detectDevice } from './downloads';

describe('downloads', () => {
  it('reads the app version from apps/ziggy-app (same as the Tauri config)', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    const tauri = JSON.parse(readFileSync(join(process.cwd(), 'apps/ziggy-app/src-tauri/tauri.conf.json'), 'utf8'));
    expect(APP_VERSION).toBe(tauri.version);
  });
  it('detects the device', () => {
    expect(detectDevice('Mozilla/5.0 (Linux; Android 14)')).toBe('android');
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('ios');
    expect(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 5)).toBe('ios');
    expect(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 0)).toBe('desktop');
  });
});
