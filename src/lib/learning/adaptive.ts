/**
 * Adaptive learning engine.
 *
 * Per skill it keeps four numbers — nothing else, and nothing about the child
 * as a person:
 *   - skillScore      0–100, a smoothed accuracy (exponential moving average)
 *   - masteryEstimate 0–1, a "knowledge tracing" estimate (BKT-lite)
 *   - difficulty      1–5, the level the next game is played at
 *   - streak          great rounds in a row (never shown as a loss)
 *
 * Difficulty goes up after confident rounds and gently down after hard ones,
 * so a child stays in the "just right" zone. Wording is always positive:
 * a hard round means "let's practise", never "failed".
 */
import type { Difficulty } from '@/lib/arcade/types';

export interface SkillState {
  skillScore: number;
  masteryEstimate: number;
  difficulty: Difficulty;
  streak: number;
  attempts: number;
  lastPlayedAt: string | null;
}

export interface RoundStats {
  correct: number;
  mistakes: number;
  total: number;
}

export const INITIAL_SKILL: SkillState = {
  skillScore: 50,
  masteryEstimate: 0.3,
  difficulty: 1,
  streak: 0,
  attempts: 0,
  lastPlayedAt: null,
};

/* BKT parameters: chance to learn per practice, to slip when knowing, to guess when not. */
const P_LEARN = 0.12;
const P_SLIP = 0.1;
const P_GUESS = 0.25;
const EMA = 0.35;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Accuracy of a round, 0–1. Mistakes count against first tries only once each. */
export function accuracy(r: RoundStats): number {
  const attempts = r.correct + r.mistakes;
  if (attempts <= 0) return 0;
  return clamp(r.correct / attempts, 0, 1);
}

/** One Bayesian knowledge-tracing step. */
export function bktStep(p: number, correct: boolean): number {
  const posterior = correct
    ? (p * (1 - P_SLIP)) / (p * (1 - P_SLIP) + (1 - p) * P_GUESS)
    : (p * P_SLIP) / (p * P_SLIP + (1 - p) * (1 - P_GUESS));
  return clamp(posterior + (1 - posterior) * P_LEARN, 0.01, 0.99);
}

/** Interleave correct and wrong answers evenly, so the order doesn't bias the estimate. */
function answerSequence(correct: number, mistakes: number): boolean[] {
  const n = correct + mistakes;
  const seq: boolean[] = [];
  let c = 0;
  for (let i = 0; i < n; i++) {
    const shouldBeCorrect = Math.round(((i + 1) * correct) / n) > c;
    seq.push(shouldBeCorrect);
    if (shouldBeCorrect) c++;
  }
  return seq;
}

export type DifficultyChange = 'up' | 'same' | 'down';

export function updateSkill(prev: SkillState | undefined, r: RoundStats, now = new Date()): { state: SkillState; change: DifficultyChange; great: boolean } {
  const s = prev ?? INITIAL_SKILL;
  const acc = accuracy(r);
  const skillScore = Math.round(s.attempts === 0 ? acc * 100 : (1 - EMA) * s.skillScore + EMA * acc * 100);
  let traced = s.masteryEstimate;
  // Cap the sequence so one long round can't swing the estimate wildly.
  for (const ok of answerSequence(Math.min(r.correct, 8), Math.min(r.mistakes, 8))) traced = bktStep(traced, ok);
  // One game is one sample: move halfway towards the traced estimate, so
  // mastery is earned over several sessions, not a single lucky round.
  const mastery = s.masteryEstimate + 0.5 * (traced - s.masteryEstimate);
  const great = acc >= 0.8;
  const streak = great ? s.streak + 1 : 0;

  let change: DifficultyChange = 'same';
  let difficulty = s.difficulty;
  if (acc >= 0.9 || (great && streak >= 2)) {
    if (difficulty < 5) {
      difficulty = (difficulty + 1) as Difficulty;
      change = 'up';
    }
  } else if (acc < 0.5 && difficulty > 1) {
    difficulty = (difficulty - 1) as Difficulty;
    change = 'down';
  }

  return {
    state: {
      skillScore: clamp(skillScore, 0, 100),
      masteryEstimate: Math.round(mastery * 1000) / 1000,
      difficulty,
      streak: change === 'up' ? 0 : streak,
      attempts: s.attempts + 1,
      lastPlayedAt: now.toISOString(),
    },
    change,
    great,
  };
}

/** Stars for a round: always at least one — trying is already a win. */
export function roundStars(r: RoundStats): 1 | 2 | 3 {
  const acc = accuracy(r);
  if (acc >= 0.9) return 3;
  if (acc >= 0.6) return 2;
  return 1;
}

/** A friendly word for mastery, for parents and children — never a grade. */
export type MasteryBand = 'discovering' | 'practising' | 'confident' | 'expert';
export function masteryBand(m: number): MasteryBand {
  if (m >= 0.85) return 'expert';
  if (m >= 0.6) return 'confident';
  if (m >= 0.35) return 'practising';
  return 'discovering';
}
