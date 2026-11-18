import { fail } from '@/lib/hyper-engine/route';

/**
 * Retired: the avatar photo is now read on the device (src/lib/avatar/photo-analyze.ts),
 * so no photo is ever sent to Ziggy's server or to an AI provider. This route only
 * refuses, without reading the request body, so an old page can't upload a photo.
 */
export const runtime = 'nodejs';

export async function POST() {
  return fail(410, 'on_device_only');
}
