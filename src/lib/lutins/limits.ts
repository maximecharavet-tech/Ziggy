import 'server-only';

/**
 * Fair use for the free Lutins Farceurs: per device+address daily counts and a
 * global daily cap (env), so the free service stays free for families and
 * can't be used as a general image generator. In memory, per server instance
 * (good enough for fair use; a durable table can replace it later).
 */

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

export const LUTINS_LIMITS = () => ({
  imagesPerDevice: num(process.env.LUTINS_DAILY_IMAGES_PER_DEVICE, 12),
  videosPerDevice: num(process.env.LUTINS_DAILY_VIDEOS_PER_DEVICE, 3),
  imagesGlobal: num(process.env.LUTINS_GLOBAL_DAILY_IMAGES, 4000),
  videosGlobal: num(process.env.LUTINS_GLOBAL_DAILY_VIDEOS, 300),
});

type Kind = 'image' | 'video';
const day = () => new Date().toISOString().slice(0, 10);
let today = day();
const counts = new Map<string, number>();

function roll() {
  const d = day();
  if (d !== today) {
    today = d;
    counts.clear();
  }
}

export const DEVICE_RE = /^[a-z0-9]{12,40}$/;

/** Takes one use if allowed; returns what is left today for this device (or why not). */
export function takeUse(kind: Kind, device: string, ip: string): { ok: true; left: number } | { ok: false; reason: 'device' | 'global' } {
  roll();
  const l = LUTINS_LIMITS();
  const perDevice = kind === 'image' ? l.imagesPerDevice : l.videosPerDevice;
  const global = kind === 'image' ? l.imagesGlobal : l.videosGlobal;
  const kDev = `${kind}:d:${device}`;
  const kIp = `${kind}:i:${ip}`;
  const kAll = `${kind}:all`;
  const used = Math.max(counts.get(kDev) ?? 0, Math.floor((counts.get(kIp) ?? 0) / 3));
  if (used >= perDevice) return { ok: false, reason: 'device' };
  if ((counts.get(kAll) ?? 0) >= global) return { ok: false, reason: 'global' };
  counts.set(kDev, (counts.get(kDev) ?? 0) + 1);
  counts.set(kIp, (counts.get(kIp) ?? 0) + 1);
  counts.set(kAll, (counts.get(kAll) ?? 0) + 1);
  return { ok: true, left: perDevice - used - 1 };
}

/** Gives a use back (the generation failed on our side or the provider's). */
export function refundUse(kind: Kind, device: string, ip: string) {
  for (const k of [`${kind}:d:${device}`, `${kind}:i:${ip}`, `${kind}:all`]) {
    const v = counts.get(k) ?? 0;
    if (v > 0) counts.set(k, v - 1);
  }
}

export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
