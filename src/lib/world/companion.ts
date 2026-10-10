/**
 * Companion state machine.
 *
 *   IDLE ──answer──▶ THINKING ──correct──▶ HAPPY / EXCITED (on a roll)
 *                          └──wrong────▶ SAD (a short, caring "oh!") ──▶ THINKING
 *   hint ▶ THINKING · levelUp ▶ EXCITED · questComplete ▶ CELEBRATE · rest ▶ IDLE
 *
 * SAD is empathy, never disappointment: the line that goes with it always
 * encourages ("we'll find it together").
 */
import type { CompanionMood, CompanionProfile } from '@/data/types';
import type { L } from '@/lib/i18n-text';
import { tr } from '@/lib/i18n-text';

export type CompanionEvent = 'start' | 'correct' | 'wrong' | 'hint' | 'levelUp' | 'questComplete' | 'rest';
export type Reaction = keyof CompanionProfile['reactions'];

export interface CompanionState {
  mood: CompanionMood;
  /** Correct answers in a row during this game. */
  roll: number;
}

export const INITIAL_COMPANION: CompanionState = { mood: 'IDLE', roll: 0 };

export function companionStep(s: CompanionState, e: CompanionEvent): CompanionState {
  switch (e) {
    case 'start':
      return { mood: 'THINKING', roll: 0 };
    case 'correct': {
      const roll = s.roll + 1;
      return { mood: roll >= 3 ? 'EXCITED' : 'HAPPY', roll };
    }
    case 'wrong':
      return { mood: 'SAD', roll: 0 };
    case 'hint':
      return { mood: 'THINKING', roll: s.roll };
    case 'levelUp':
      return { mood: 'EXCITED', roll: s.roll };
    case 'questComplete':
      return { mood: 'CELEBRATE', roll: s.roll };
    case 'rest':
      // A SAD face never lingers: it always turns back into thinking.
      return { mood: s.mood === 'SAD' ? 'THINKING' : 'IDLE', roll: s.roll };
  }
}

export function reactionFor(e: CompanionEvent): Reaction | null {
  if (e === 'correct') return 'success';
  if (e === 'wrong') return 'failure';
  if (e === 'hint') return 'hint';
  if (e === 'levelUp') return 'levelUp';
  if (e === 'questComplete') return 'questComplete';
  return null;
}

/** Pick a line deterministically from a seed (no repetition back-to-back when seeds differ). */
export function companionLine(profile: CompanionProfile, reaction: Reaction, seed: number, locale: string): string {
  const lines: L[] = profile.reactions[reaction];
  if (!lines.length) return '';
  const i = Math.abs(Math.floor(seed)) % lines.length;
  return tr(lines[i], locale);
}

/** Visual cues per mood, used by the companion component. */
export const MOOD_STYLE: Record<CompanionMood, { anim: 'float' | 'bounce' | 'tilt' | 'spin' | 'droop'; badge: string }> = {
  IDLE: { anim: 'float', badge: '' },
  HAPPY: { anim: 'bounce', badge: '😊' },
  THINKING: { anim: 'tilt', badge: '💭' },
  EXCITED: { anim: 'bounce', badge: '⚡' },
  SAD: { anim: 'droop', badge: '🤗' },
  CELEBRATE: { anim: 'spin', badge: '🎉' },
};
