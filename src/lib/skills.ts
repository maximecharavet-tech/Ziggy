/**
 * The six skills of the "cognitive profile", each fed by the games that train
 * it. A skill grows with how well the child did (best stars) and with a little
 * practice; games not tried yet count as zero, which nudges toward variety.
 */
import type { ProgressMap } from './progress';

export const SKILLS = [
  { id: 'memory', games: ['memory', 'simon'], color: '#8B5CF6' },
  { id: 'logic', games: ['logic', 'oddone'], color: '#3B82F6' },
  { id: 'math', games: ['math'], color: '#22C55E' },
  { id: 'knowledge', games: ['quiz'], color: '#F59E0B' },
  { id: 'code_ai', games: ['coding', 'lab'], color: '#EC4899' },
  { id: 'spatial', games: ['puzzle'], color: '#14B8A6' },
] as const;

export type SkillId = (typeof SKILLS)[number]['id'];

/** 0..100 for one game: up to 80 from stars, up to 20 from practice. */
export function gameScore(bestStars: number, plays: number): number {
  const stars = Math.max(0, Math.min(3, bestStars));
  return Math.round((stars / 3) * 80 + Math.min(Math.max(plays, 0), 5) * 4);
}

export function computeSkills(progress: ProgressMap): Record<SkillId, number> {
  const out = {} as Record<SkillId, number>;
  for (const s of SKILLS) {
    const total = s.games.reduce((sum, g) => {
      const p = progress[g];
      return sum + (p ? gameScore(p.bestStars, p.plays) : 0);
    }, 0);
    out[s.id] = Math.round(total / s.games.length);
  }
  return out;
}

/** The strongest skill, and the one to work on next (the weakest, ties to the first). */
export function strengths(skills: Record<SkillId, number>): { best: SkillId; next: SkillId } {
  const ids = SKILLS.map((s) => s.id);
  const best = ids.reduce((a, b) => (skills[b] > skills[a] ? b : a));
  const next = ids.reduce((a, b) => (skills[b] < skills[a] ? b : a));
  return { best, next };
}
