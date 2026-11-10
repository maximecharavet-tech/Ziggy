import { afterEach, describe, expect, it, vi } from 'vitest';
import { CALL_PAGE, lastBootCrashed, markBooted } from './crash-guard';
import { isAndroid } from './transcribe';
import { SantaCallBoundary } from '@/components/santa/call/SantaCallBoundary';

vi.mock('@/i18n/navigation', () => ({ Link: () => null }));
vi.mock('next-intl', () => ({ useLocale: () => 'fr' }));

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

afterEach(() => vi.useRealTimers());

describe('crash guard (tab killed while the call page starts)', () => {
  it('a first visit is not a crash', () => {
    expect(lastBootCrashed(CALL_PAGE, mem())).toBe(false);
  });

  it('a load that never finished starting is seen on the next load', () => {
    vi.useFakeTimers();
    const s = mem();
    markBooted(CALL_PAGE, s, 8000); // the tab dies before 8 s: no cleanup, no timer
    expect(lastBootCrashed(CALL_PAGE, s)).toBe(true);
  });

  it('a page that stayed up, or was left normally, is fine', () => {
    vi.useFakeTimers();
    const s = mem();
    markBooted(CALL_PAGE, s, 8000);
    vi.advanceTimersByTime(8000);
    expect(lastBootCrashed(CALL_PAGE, s)).toBe(false);
    const done = markBooted(CALL_PAGE, s, 8000);
    done();
    expect(lastBootCrashed(CALL_PAGE, s)).toBe(false);
  });

  it('never throws when storage is blocked', () => {
    const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(lastBootCrashed(CALL_PAGE, bad)).toBe(false);
    expect(() => markBooted(CALL_PAGE, bad, 10)()).not.toThrow();
    expect(lastBootCrashed(CALL_PAGE, null)).toBe(false);
  });
});

describe('Android: no on-device speech probe', () => {
  it('detects Android browsers', () => {
    expect(isAndroid('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36')).toBe(true);
    expect(isAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(false);
    expect(isAndroid('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36')).toBe(false);
  });
});

describe('call error boundary', () => {
  it('turns an error into the fallback state, and retry remounts', () => {
    expect(SantaCallBoundary.getDerivedStateFromError(new Error('AudioContext'))).toEqual({ error: expect.any(Error) });
    const b = new SantaCallBoundary({ children: null });
    let next: unknown;
    b.setState = ((u: (s: typeof b.state) => unknown) => {
      next = u({ error: new Error('x'), tries: 0 });
    }) as typeof b.setState;
    b.retry();
    expect(next).toEqual({ error: null, tries: 1 });
  });
});
