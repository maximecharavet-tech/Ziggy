'use client';

import { useId } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { CUTOUTS, FACE, type CutoutPose, type HeartSpot } from '@/lib/mascot';
import { CUTOUT_RIGS, FACE_RIG, holesMask, lidBox, originCss, polygonCss, type EyeSpot } from './mascot-rig';
import { useMascotLife } from './use-mascot-life';

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

/** Lighten (amount > 0) or darken (amount < 0) a hex colour. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * A felt eyelid: hidden (scaleY 0) until a blink or a nap pulls it down from
 * the top. Drawn in code: a padded felt patch with a little fur texture, the
 * stitched "closed eye" curve and three lashes on the outer side, like the
 * open eye's.
 */
function Lid({ eye, w, h, closed, lidRef, outer }: { eye: EyeSpot; w: number; h: number; closed: boolean; lidRef: React.Ref<HTMLSpanElement>; outer: 'left' | 'right' }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const box = lidBox(eye, w, h);
  const m = outer === 'left' ? -1 : 1;
  const end = outer === 'left' ? 14 : 86;
  return (
    <span
      ref={lidRef}
      className="pointer-events-none absolute transition-transform duration-500 ease-in-out"
      style={{ ...box, transformOrigin: '50% 0%', transform: closed ? 'scaleY(1)' : 'scaleY(0)' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <radialGradient id={`${id}g`} cx="50%" cy="38%" r="62%">
            <stop offset="0" stopColor={shade(eye.top, 0.06)} />
            <stop offset="0.7" stopColor={eye.side} />
            <stop offset="1" stopColor={shade(eye.side, -0.14)} />
          </radialGradient>
          <filter id={`${id}f`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="7" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
        <ellipse cx="50" cy="50" rx="50" ry="50" fill={`url(#${id}g)`} />
        <ellipse cx="50" cy="50" rx="50" ry="50" fill="#000" filter={`url(#${id}f)`} />
        <path d="M14 56 Q50 80 86 56" fill="none" stroke="#1d2916" strokeWidth="6.5" strokeLinecap="round" />
        <path
          d={`M${end} 56 L${end + m * 9} 50 M${end - m * 2} 61 L${end + m * 9} 61 M${end - m * 5} 65 L${end + m * 4} 71`}
          fill="none"
          stroke="#1d2916"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** Sleepy "z"s floating up from Ziggy's head (slow: one about every second). */
function Zzz({ x, y, size }: { x: string; y: string; size: number }) {
  return (
    <span className="pointer-events-none absolute" style={{ left: x, top: y }} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute font-display font-bold text-sky drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]"
          style={{ fontSize: size * (0.7 + i * 0.25), left: 0, top: 0 }}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], x: [0, size * 0.5, size * 0.2, size * 0.7], y: [0, -size, -size * 2, -size * 3], scale: [0.6, 1, 1.05, 1.1] }}
          transition={{ duration: 3, delay: i * 1, repeat: Infinity, ease: 'easeOut' }}
        >
          z
        </motion.span>
      ))}
    </span>
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
  /** Blinks and bobbles his antennas (default: from 72 px wide). */
  alive?: boolean;
  /** Waves when the mouse comes by, hops with hearts and giggles when tapped (default: from 72 px wide). */
  interactive?: boolean;
  /** Naps (with a rare snore) after a long idle, wakes at the next tap or scroll (default: from 96 px wide). */
  sleepy?: boolean;
  /** For demos: nap sooner than the 45 s default. */
  sleepAfterMs?: number;
}

/**
 * Ziggy on his own, with his heart glowing, and alive: he blinks, his
 * antennas sway and bobble, he waves at the mouse, hops with hearts and a
 * giggle when tapped, and dozes off after a long idle. All of it is transform
 * and opacity on the official picture (no extra art), paused off screen, and
 * completely still under reduced motion.
 *
 * Callers that size the picture themselves (`[&_img]:…` classes) keep their
 * layout: there Ziggy hops, waves and naps but does not blink (the overlays
 * could not line up with a picture sized from outside).
 */
export function MascotCutout({
  pose,
  width,
  className = '',
  priority = false,
  glow = true,
  alt = '',
  alive,
  interactive,
  sleepy,
  sleepAfterMs,
}: MascotCutoutProps) {
  const pic = CUTOUTS[pose];
  const rig = CUTOUT_RIGS[pose];
  // A caller sizing the <img> from outside: overlays can't follow, so no rig there.
  const customSized = className.includes('[&_img]');
  const life = useMascotLife({
    rig: (alive ?? width >= 72) && !customSized,
    interactive: interactive ?? width >= 72,
    sleepy: sleepy ?? width >= 96,
    hop: Math.max(4, Math.round(width * 0.07)),
    needsLoads: 2,
    sleepAfterMs,
  });
  const { rigOn, rigReady, asleep } = life;
  const masked = rigReady ? holesMask(rig.antennas.map((a) => a.hole), rig.w, rig.h) : undefined;

  return (
    <span
      ref={life.rootRef}
      className={`relative block ${className}`}
      onPointerEnter={life.onPointerEnter}
      onPointerDown={life.onPointerDown}
    >
      {/* The shadow sits on the wrapper: on the picture, the antenna mask would clip it to a box. */}
      <span ref={life.bodyRef} className="relative block h-full drop-shadow-[0_24px_28px_rgba(47,107,28,0.28)]" style={{ transformOrigin: '50% 100%' }}>
        <Image
          src={pic.src}
          width={pic.width}
          height={pic.height}
          sizes={`${width}px`}
          alt={alt}
          priority={priority}
          className={`${customSized ? '' : 'block '}w-full h-auto select-none`}
          style={masked ? { maskImage: masked, WebkitMaskImage: masked, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' } : undefined}
          draggable={false}
        />
        {rigOn
          ? rig.antennas.slice(0, 2).map((a, i) => (
              <span
                key={i}
                ref={life.antennaRefs[i]}
                className="pointer-events-none absolute inset-0"
                style={{ transformOrigin: originCss(a.pivot, rig.w, rig.h), visibility: rigReady ? 'visible' : 'hidden' }}
                aria-hidden="true"
              >
                <span ref={life.swayRefs[i]} className="absolute inset-0" style={{ transformOrigin: originCss(a.pivot, rig.w, rig.h) }}>
                  <Image
                    src={pic.src}
                    width={pic.width}
                    height={pic.height}
                    sizes={`${width}px`}
                    alt=""
                    onLoad={life.onRigLoad}
                    className="absolute inset-0 h-full w-full select-none"
                    style={{ clipPath: polygonCss(a.clip, rig.w, rig.h) }}
                    draggable={false}
                  />
                </span>
              </span>
            ))
          : null}
        {rigReady
          ? rig.eyes.map((eye, i) => <Lid key={i} eye={eye} w={rig.w} h={rig.h} closed={asleep} outer={i === 0 ? 'left' : 'right'} lidRef={life.lidRefs[i]} />)
          : null}
        {glow && <HeartGlow spot={pic.heart} />}
      </span>
      {asleep ? <Zzz x={`${(rig.zzz[0] / rig.w) * 100}%`} y={`${(rig.zzz[1] / rig.h) * 100}%`} size={Math.max(12, Math.round(width * 0.09))} /> : null}
    </span>
  );
}

/** Ziggy's face in a round frame: navbar, chat, avatars. Blinks, and tilts his head with a giggle when tapped. */
export function ZiggyAvatar({
  size = 40,
  className = '',
  ring = true,
  alt = '',
  alive,
  interactive,
}: {
  size?: number;
  className?: string;
  ring?: boolean;
  alt?: string;
  /** Blinks now and then (default: from 32 px). */
  alive?: boolean;
  /** Head tilt and giggle on tap (default: from 40 px). */
  interactive?: boolean;
}) {
  const life = useMascotLife({ rig: alive ?? size >= 32, interactive: interactive ?? size >= 40, sleepy: false, hop: 0, tap: 'tilt' });
  const blinking = life.rigReady;
  return (
    <span
      ref={life.rootRef}
      className={`relative inline-block shrink-0 rounded-full overflow-hidden bg-peach ${
        ring ? 'ring-2 ring-white/80 dark:ring-white/15 shadow-[0_4px_14px_-4px_rgba(47,107,28,0.45)]' : ''
      } ${className}`}
      style={{ width: size, height: size }}
      onPointerDown={life.onPointerDown}
    >
      <span ref={life.bodyRef} className="absolute inset-0 block" style={{ transformOrigin: '50% 60%' }}>
        <Image src={FACE} width={512} height={512} sizes={`${size * 2}px`} alt={alt} className="w-full h-full object-cover" />
        {blinking
          ? FACE_RIG.eyes.map((eye, i) => <Lid key={i} eye={eye} w={FACE_RIG.w} h={FACE_RIG.h} closed={false} outer={i === 0 ? 'left' : 'right'} lidRef={life.lidRefs[i]} />)
          : null}
      </span>
    </span>
  );
}
