/**
 * Ready-made effects on the shared stage, callable from any event handler.
 * Every one is a no-op on the server and under reduced motion, and returns the
 * number of particles it actually emitted (after the budget).
 */
import { spawnBurst, spawnCannon, spawnRain, MAX_CELEBRATION_S, ZIGGY_COLORS, type ShapeKind } from './physics';
import { emit, nextGroup, viewport } from './stage';
import { reducedMotionNow } from './env';

export type Point = { x: number; y: number };

export interface ConfettiOptions {
  /** Particles requested (trimmed by the budget). */
  count?: number;
  kinds?: readonly ShapeKind[];
  colors?: readonly string[];
  /** Seconds, ≤ 2. */
  life?: number;
  /** Launch speed multiplier (1 = normal). */
  power?: number;
  group?: number;
}

/** One cannon shot from a point (viewport coordinates), aimed up by default. */
export function confettiAt(at: Point, opts: ConfettiOptions & { angle?: number; spread?: number } = {}): number {
  if (reducedMotionNow()) return 0;
  const { height } = viewport();
  const power = opts.power ?? 1;
  return emit(
    spawnCannon({
      x: at.x,
      y: at.y,
      angle: opts.angle ?? -90,
      spread: opts.spread ?? 70,
      // Air drag eats speed fast (the confetti "pop"): this rises about a third of the screen.
      speed: Math.min(1500, Math.max(800, height * 1.5)) * power,
      count: opts.count ?? 50,
      kinds: opts.kinds,
      colors: opts.colors,
      life: opts.life,
      group: opts.group ?? nextGroup(),
    }),
  );
}

/** The party: two cannons from the bottom corners, crossing over the middle. */
export function confettiParty(opts: ConfettiOptions = {}): number {
  if (reducedMotionNow()) return 0;
  const { width, height } = viewport();
  if (!width) return 0;
  const count = opts.count ?? 70;
  const group = opts.group ?? nextGroup();
  const power = opts.power ?? 1;
  // Rises to about two thirds of the screen before the paper floats down.
  const speed = Math.min(2400, Math.max(1300, height * 2.6)) * power;
  const half = Math.ceil(count / 2);
  const common = { kinds: opts.kinds, colors: opts.colors, life: opts.life ?? 1.9, group };
  return (
    emit(spawnCannon({ x: -10, y: height + 10, angle: -62, spread: 34, speed, count: half, ...common })) +
    emit(spawnCannon({ x: width + 10, y: height + 10, angle: -118, spread: 34, speed, count: count - half, ...common }))
  );
}

export interface SparkleOptions {
  count?: number;
  kinds?: readonly ShapeKind[];
  colors?: readonly string[];
  /** Outward speed, px/s. */
  speed?: number;
  size?: number;
  life?: number;
  /** Tiny UI sparkles that stay visible over the pressed control. */
  ui?: boolean;
  group?: number;
}

/** Stars, sparkles and hearts bursting from a point. */
export function sparkleAt(at: Point, opts: SparkleOptions = {}): number {
  if (reducedMotionNow()) return 0;
  return emit(
    spawnBurst({
      x: at.x,
      y: at.y,
      count: opts.count ?? 12,
      kinds: opts.kinds,
      colors: opts.colors,
      speed: opts.speed,
      size: opts.size,
      life: opts.life,
      noGhost: opts.ui,
      group: opts.group ?? nextGroup(),
    }),
  );
}

/** Hearts floating up from a point (Ziggy's tap, a kind word). */
export function heartsAt(at: Point, count = 7): number {
  if (reducedMotionNow()) return 0;
  return emit(
    spawnBurst({
      x: at.x,
      y: at.y,
      count,
      kinds: ['heart', 'heart', 'sparkle'],
      colors: ['#F472B6', '#F2647B', '#FBBF24', '#FB7185'],
      speed: 260,
      size: 16,
      life: 0.95,
      gravity: -160,
      noGhost: true,
      group: nextGroup(),
    }),
  );
}

export interface EmojiRainOptions {
  emojis?: readonly string[];
  count?: number;
  size?: number;
  /** Seconds, ≤ 2. */
  life?: number;
  group?: number;
}

export const DEFAULT_RAIN = ['⭐', '🌟', '🎈', '💚', '✨', '🎉'] as const;

/** A gentle shower of emojis across the screen. */
export function emojiRain(opts: EmojiRainOptions = {}): number {
  if (reducedMotionNow()) return 0;
  const { width } = viewport();
  if (!width) return 0;
  const count = opts.count ?? Math.round(Math.min(22, Math.max(10, width / 60)));
  return emit(
    spawnRain({
      width,
      count,
      emojis: opts.emojis ?? DEFAULT_RAIN,
      size: opts.size,
      life: Math.min(opts.life ?? MAX_CELEBRATION_S, MAX_CELEBRATION_S),
      group: opts.group ?? nextGroup(),
    }),
  );
}

/** One tiny trail sparkle (MagicTrail). */
export function trailAt(at: Point, group: number): number {
  return emit(
    spawnBurst({
      x: at.x,
      y: at.y,
      count: 1,
      kinds: ['sparkle', 'star', 'dot'],
      colors: ZIGGY_COLORS,
      speed: 40,
      size: 9,
      life: 0.55,
      gravity: 60,
      noGhost: true,
      group,
    }),
  );
}

/** Centre of an element in viewport coordinates (null if it is gone). */
export function centerOf(el: Element | null | undefined): Point | null {
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
