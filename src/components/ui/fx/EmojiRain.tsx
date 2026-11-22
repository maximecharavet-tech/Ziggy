'use client';

import { useRef } from 'react';
import { emojiRain, DEFAULT_RAIN } from './effects';
import { nextGroup } from './stage';
import { fxSound, type FxSound } from './sfx';
import { useTrigger } from './use-trigger';

export interface EmojiRainProps {
  /** Rains each time this becomes a new truthy value. */
  trigger: unknown;
  /** Emojis to rain (default: stars, balloons, a green heart, sparkles). */
  emojis?: readonly string[];
  /** Drops requested (default scales with the screen width, about 10–22). */
  count?: number;
  /** Emoji size, px. */
  size?: number;
  /** Seconds, capped at 2. */
  life?: number;
  /** Optional sound (default none). */
  sound?: FxSound | false;
}

/**
 * A gentle, short shower of emojis for a celebration, on the shared canvas
 * stage (one drawn sprite per emoji, so it stays cheap). Drops arrive one
 * after another, sway as they fall and fade before the bottom. Nothing under
 * reduced motion.
 */
export function EmojiRain({ trigger, emojis = DEFAULT_RAIN, count, size, life, sound = false }: EmojiRainProps) {
  const group = useRef(0);

  useTrigger(trigger, () => {
    group.current ||= nextGroup();
    const n = emojiRain({ emojis, count, size, life, group: group.current });
    if (n > 0) fxSound(sound);
  });

  return null;
}
