import Image from 'next/image';
import { CUTOUTS, FACE, type CutoutPose, type HeartSpot } from '@/lib/mascot';

/** Four-point sparkle, as in the mascot artwork. */
export function Sparkle({
  className = '',
  color = '#FBBF24',
  delay = 0,
}: {
  className?: string;
  color?: string;
  delay?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`absolute animate-twinkle pointer-events-none ${className}`}
      style={{ animationDelay: `${delay}s` }}
      aria-hidden="true"
    >
      <path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" fill={color} />
    </svg>
  );
}

/** A warm pulse laid over Ziggy's heart, so it seems to beat. */
export function HeartGlow({ spot, className = '' }: { spot: HeartSpot; className?: string }) {
  return (
    <span
      className={`pointer-events-none absolute rounded-full animate-heartbeat mix-blend-screen ${className}`}
      style={{
        left: `${spot.x * 100}%`,
        top: `${spot.y * 100}%`,
        width: `${spot.size * 100}%`,
        aspectRatio: '1',
        background:
          'radial-gradient(circle, rgba(255,246,196,0.95) 0%, rgba(255,214,102,0.55) 32%, rgba(255,170,60,0.18) 58%, transparent 72%)',
      }}
      aria-hidden="true"
    />
  );
}

interface MascotCutoutProps {
  pose: CutoutPose;
  /** Rendered width in px, used to pick the image size. */
  width: number;
  className?: string;
  priority?: boolean;
  glow?: boolean;
  alt?: string;
}

/** Ziggy on his own, with his heart glowing. */
export function MascotCutout({ pose, width, className = '', priority = false, glow = true, alt = '' }: MascotCutoutProps) {
  const pic = CUTOUTS[pose];
  return (
    <span className={`relative block ${className}`}>
      <Image
        src={pic.src}
        width={pic.width}
        height={pic.height}
        sizes={`${width}px`}
        alt={alt}
        priority={priority}
        className="w-full h-auto select-none drop-shadow-[0_24px_28px_rgba(47,107,28,0.28)]"
        draggable={false}
      />
      {glow && <HeartGlow spot={pic.heart} />}
    </span>
  );
}

/** Ziggy's face in a round frame: navbar, chat, avatars. */
export function ZiggyAvatar({
  size = 40,
  className = '',
  ring = true,
  alt = '',
}: {
  size?: number;
  className?: string;
  ring?: boolean;
  alt?: string;
}) {
  return (
    <span
      className={`relative inline-block shrink-0 rounded-full overflow-hidden bg-peach ${
        ring ? 'ring-2 ring-white/80 dark:ring-white/15 shadow-[0_4px_14px_-4px_rgba(47,107,28,0.45)]' : ''
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <Image src={FACE} width={512} height={512} sizes={`${size * 2}px`} alt={alt} className="w-full h-full object-cover" />
    </span>
  );
}
