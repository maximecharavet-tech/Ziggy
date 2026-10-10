import 'server-only';

/**
 * Download the image an image provider returned, defensively: https only,
 * no private/loopback hosts, image types only, 5 MB cap. Data URIs (base64
 * answers) are decoded in memory.
 */
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX = 5 * 1024 * 1024;

export function isSafeImageUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(':')) return false; // literal IPs
  return true;
}

export async function fetchImage(src: string): Promise<{ bytes: Uint8Array; type: string; ext: string } | null> {
  const data = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(src);
  if (data) {
    const bytes = Uint8Array.from(Buffer.from(data[2], 'base64'));
    return bytes.length <= MAX ? { bytes, type: data[1], ext: TYPES[data[1]] } : null;
  }
  if (!isSafeImageUrl(src)) return null;
  try {
    const res = await fetch(src, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!res.ok || !TYPES[type]) return null;
    if (Number(res.headers.get('content-length') ?? 0) > MAX) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length <= MAX ? { bytes, type, ext: TYPES[type] } : null;
  } catch {
    return null;
  }
}
