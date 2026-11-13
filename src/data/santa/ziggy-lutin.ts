/**
 * Ziggy dressed as an elf, as 2D art in the Santa call (ChatGPT images made
 * for Ziggy, public/santa/art/ziggy-lutin/<pose>.webp, transparent). Written by
 * `node scripts/santa-ziggy-lutin.mjs` from /workspace/pere-noel/art/ziggy-lutin;
 * until the art is there, the call uses the 3D elf Ziggy of the office scene.
 */
export type ZiggyPose = 'idle' | 'waving' | 'laughing' | 'talking';

export const ZIGGY_LUTIN: { available: boolean; poses: Partial<Record<ZiggyPose, string>> } = {
  available: true,
  poses: {
    idle: '/santa/art/ziggy-lutin/idle.webp',
    waving: '/santa/art/ziggy-lutin/waving.webp',
    laughing: '/santa/art/ziggy-lutin/laughing.webp',
    talking: '/santa/art/ziggy-lutin/talking.webp',
  },
};

/** The image for a pose (idle when that pose has no picture), or null. */
export function ziggyPose(p: ZiggyPose): string | null {
  if (!ZIGGY_LUTIN.available) return null;
  return ZIGGY_LUTIN.poses[p] ?? ZIGGY_LUTIN.poses.idle ?? null;
}
