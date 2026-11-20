/**
 * Photosensitivity guard.
 *
 * WCAG 2.3.1: nothing may flash more than three times in any one second, and
 * saturated red flashes are the most dangerous. Every effect that brightens a
 * large area at once (a glow ring, a page splash, a sheen) asks this guard
 * first and simply skips the flash when the budget is spent. Particles are not
 * flashes; their twinkle is capped at MAX_TWINKLE_HZ in physics.ts.
 */

export const MAX_FLASHES_PER_SECOND = 3;
/** Two flashes are never closer than this, so three in a second is the most possible. */
export const MIN_FLASH_GAP_MS = 334;

export interface FlashGuard {
  /** True (and counted) when a flash may play now; false when it must be skipped. */
  tryFlash(now: number): boolean;
  /** Flashes counted in the last second. */
  recent(now: number): number;
  reset(): void;
}

export function createFlashGuard({ max = MAX_FLASHES_PER_SECOND, windowMs = 1000, minGapMs = MIN_FLASH_GAP_MS } = {}): FlashGuard {
  const times: number[] = [];
  const prune = (now: number) => {
    while (times.length && now - times[0] >= windowMs) times.shift();
  };
  return {
    tryFlash(now) {
      prune(now);
      const last = times[times.length - 1];
      if (times.length >= max) return false;
      if (last !== undefined && now - last < minGapMs) return false;
      times.push(now);
      return true;
    },
    recent(now) {
      prune(now);
      return times.length;
    },
    reset() {
      times.length = 0;
    },
  };
}

/** The page-wide guard shared by every effect. */
export const flashGuard = createFlashGuard();

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Saturated red (hue within ±20° of red, saturated, mid lightness): never used for a flash. */
export function isSaturatedRed(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return false;
  const s = d / (1 - Math.abs(2 * l - 1));
  let hue = 0;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  const reddish = hue <= 20 || hue >= 340;
  return reddish && s >= 0.6 && l >= 0.25 && l <= 0.75;
}

/** The colour to flash with: a saturated red becomes a soft warm yellow. */
export function safeFlashColor(hex: string, fallback = '#FFE58A'): string {
  return isSaturatedRed(hex) ? fallback : hex;
}
