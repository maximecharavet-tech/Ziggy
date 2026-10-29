import { describe, expect, it } from 'vitest';
import { APK_RELEASE_URL, detectDevice } from './downloads';

describe('detectDevice', () => {
  it('finds Android phones, tablets and TVs', () => {
    expect(detectDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36')).toBe('android');
    expect(detectDevice('Mozilla/5.0 (Linux; Android 12; BRAVIA 4K) AppleWebKit/537.36 Chrome/120 Safari/537.36')).toBe('android');
  });

  it('finds iPhones and iPads, also iPadOS presenting itself as a Mac', () => {
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')).toBe('ios');
    expect(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 5)).toBe('ios');
  });

  it('treats everything else as a computer', () => {
    expect(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 0)).toBe('desktop');
    expect(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36')).toBe('desktop');
    expect(detectDevice('')).toBe('desktop');
  });
});

describe('APK_RELEASE_URL', () => {
  it('points at the stable asset name published by apps.yml', () => {
    expect(APK_RELEASE_URL).toMatch(/\/releases\/latest\/download\/ziggy-ai-android\.apk$/);
  });
});
