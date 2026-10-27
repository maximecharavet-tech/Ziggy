import { MascotCutout, ZiggyAvatar } from '@/components/ziggy/Mascot';

/** The robot emoji stands for Ziggy in some data; on screen he is always the real Ziggy. */
export const ZIGGY_EMOJI = '🤖';

/**
 * Ziggy in a slot where an emoji would be: his round face for small sizes,
 * the whole plush (waving) for big ones.
 */
export function ZiggyMark({ size, full = false, className = '' }: { size: number; full?: boolean; className?: string }) {
  if (full) return <MascotCutout pose="wave" width={size} glow className={`inline-block ${className}`} />;
  return <ZiggyAvatar size={size} ring={false} className={`!bg-transparent ${className}`} />;
}

/** An emoji, or the real Ziggy when the emoji is the robot. */
export function Glyph({ e, size, full = false, className = '' }: { e: string; size: number; full?: boolean; className?: string }) {
  if (e === ZIGGY_EMOJI) return <ZiggyMark size={size} full={full} className={className} />;
  return <span className={className}>{e}</span>;
}
