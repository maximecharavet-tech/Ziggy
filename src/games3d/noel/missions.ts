/**
 * Le Noël de Ziggy — game logic, separate from the 3D scene and fully
 * deterministic: the engine decides the missions from a seed, the child's age
 * band and level. Zero failure: a wrong gift is never "lost", it simply goes
 * back with a hint.
 */
import { rng } from '../kit/rng';
import type { L } from '@/lib/i18n-text';

export const GIFT_COLORS = ['red', 'blue', 'yellow', 'green', 'purple', 'pink'] as const;
export type GiftColor = (typeof GIFT_COLORS)[number];

export const COLOR_HEX: Record<GiftColor, string> = {
  red: '#e2453c',
  blue: '#3f7fe0',
  yellow: '#ffcc33',
  green: '#3fbf6a',
  purple: '#9b6be8',
  pink: '#ff7ab8',
};
export const COLOR_NAME: Record<GiftColor, L> = {
  red: { fr: 'rouge', en: 'red' },
  blue: { fr: 'bleu', en: 'blue' },
  yellow: { fr: 'jaune', en: 'yellow' },
  green: { fr: 'vert', en: 'green' },
  purple: { fr: 'violet', en: 'purple' },
  pink: { fr: 'rose', en: 'pink' },
};

export type Band = 'little' | 'middle' | 'big';

/** Six houses around the square; each has a roof colour. Their signs show numbers per mission. */
export const HOUSE_ROOFS: GiftColor[] = ['red', 'blue', 'yellow', 'green', 'purple', 'pink'];

export type Mission =
  | { kind: 'color'; color: GiftColor; count: number; house: number }
  | { kind: 'count'; count: number; house: number }
  | { kind: 'sum'; target: number; house: number };

export interface Gift {
  id: number;
  color: GiftColor;
  /** Number written on the gift (sum missions). */
  value?: number;
}

export interface MissionPlan {
  mission: Mission;
  gifts: Gift[];
  /** The number shown on each house sign during this mission. */
  signs: number[];
}

/** Number of missions before the tree decoration. */
export const MISSIONS = 4;

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The kind of mission the engine picks for a band and level (1–5). */
export function missionKind(band: Band, level: number, index: number): Mission['kind'] {
  if (band === 'little') return level >= 2 && index % 2 === 1 ? 'count' : 'color';
  if (band === 'middle') return level <= 1 ? (index % 2 ? 'count' : 'color') : index % 2 ? 'sum' : 'count';
  return 'sum';
}

export function planMission(seed: number, band: Band, level: number, index: number): MissionPlan {
  const r = rng(seed * 31 + index * 7919);
  const kind = missionKind(band, level, index);
  const house = Math.floor(r() * HOUSE_ROOFS.length);
  let id = 0;
  const gift = (color: GiftColor, value?: number): Gift => ({ id: id++, color, value });
  const signs = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15], r).slice(0, HOUSE_ROOFS.length);

  if (kind === 'color') {
    const color = HOUSE_ROOFS[house];
    const count = Math.min(5, 2 + Math.floor(level / 2) + (r() < 0.5 ? 0 : 1));
    const others = shuffle(GIFT_COLORS.filter((c) => c !== color), r).slice(0, 2);
    const gifts = shuffle([...Array.from({ length: count + 1 }, () => gift(color)), ...others.flatMap((c) => [gift(c), gift(c)])], r);
    return { mission: { kind, color, count, house }, gifts, signs };
  }

  if (kind === 'count') {
    const max = band === 'little' ? 5 : Math.min(10, 4 + level * 2);
    const count = 2 + Math.floor(r() * (max - 1));
    signs[house] = count;
    // Make sure no other house shows the same number.
    for (let i = 0; i < signs.length; i++) if (i !== house && signs[i] === count) signs[i] = count + 11;
    const gifts = Array.from({ length: count + 3 }, () => gift(GIFT_COLORS[Math.floor(r() * GIFT_COLORS.length)]));
    return { mission: { kind, count, house }, gifts, signs };
  }

  // sum: gifts carry small numbers; reach the target exactly.
  const top = band === 'big' ? Math.min(20, 8 + level * 3) : Math.min(10, 4 + level * 2);
  const target = Math.max(4, Math.floor(top * (0.6 + r() * 0.4)));
  signs[house] = target;
  for (let i = 0; i < signs.length; i++) if (i !== house && signs[i] === target) signs[i] = target + 13;
  // A guaranteed solution (2–3 gifts), plus distractors.
  const parts = band === 'big' && target > 9 ? 3 : 2;
  const sol: number[] = [];
  let left = target;
  for (let p = parts; p > 1; p--) {
    const v = 1 + Math.floor(r() * Math.min(9, left - p + 1));
    sol.push(v);
    left -= v;
  }
  sol.push(left);
  const maxVal = band === 'big' ? 9 : 6;
  const extra = Array.from({ length: 4 }, () => 1 + Math.floor(r() * maxVal));
  const gifts = shuffle([...sol, ...extra].map((v) => gift(GIFT_COLORS[Math.floor(r() * GIFT_COLORS.length)], v)), r);
  return { mission: { kind: 'sum', target, house }, gifts, signs };
}

export type PickVerdict = { ok: true } | { ok: false; reason: 'wrong_color' | 'full' | 'too_much'; missing?: number };

/** May Ziggy pick up this gift, given what he already carries? */
export function canPick(m: Mission, carried: Gift[], g: Gift): PickVerdict {
  if (m.kind === 'color') {
    if (g.color !== m.color) return { ok: false, reason: 'wrong_color' };
    if (carried.length >= m.count) return { ok: false, reason: 'full' };
    return { ok: true };
  }
  if (m.kind === 'count') return carried.length >= m.count ? { ok: false, reason: 'full' } : { ok: true };
  const sum = carried.reduce((s, x) => s + (x.value ?? 0), 0);
  if (sum >= m.target) return { ok: false, reason: 'full' };
  if (sum + (g.value ?? 0) > m.target) return { ok: false, reason: 'too_much', missing: m.target - sum };
  return { ok: true };
}

export function isReady(m: Mission, carried: Gift[]): boolean {
  if (m.kind === 'sum') return carried.reduce((s, x) => s + (x.value ?? 0), 0) === m.target;
  return carried.length === m.count;
}

/** How far along the mission is (for the HUD), 0..1. */
export function progressOf(m: Mission, carried: Gift[]): { have: number; need: number } {
  if (m.kind === 'sum') return { have: carried.reduce((s, x) => s + (x.value ?? 0), 0), need: m.target };
  return { have: carried.length, need: m.count };
}

/** What Ziggy says for the mission (short, read aloud). */
export function missionText(p: MissionPlan, locale: string): string {
  const fr = locale === 'fr';
  const m = p.mission;
  if (m.kind === 'color') {
    const c = COLOR_NAME[m.color][fr ? 'fr' : 'en'];
    return fr
      ? `Ramasse ${m.count} cadeaux ${c}s et apporte-les à la maison au toit ${c}.`
      : `Pick up ${m.count} ${c} presents and bring them to the house with the ${c} roof.`;
  }
  if (m.kind === 'count')
    return fr ? `La maison numéro ${m.count} attend ${m.count} cadeaux. Ramasse-les et apporte-les !` : `House number ${m.count} is waiting for ${m.count} presents. Collect them and bring them over!`;
  return fr
    ? `La maison numéro ${m.target} veut des cadeaux qui font ${m.target} en tout. Additionne les nombres !`
    : `House number ${m.target} wants presents that add up to ${m.target}. Add the numbers!`;
}

export function hintText(v: PickVerdict, m: Mission, locale: string): string {
  const fr = locale === 'fr';
  if (v.ok) return '';
  if (v.reason === 'wrong_color' && m.kind === 'color') {
    const c = COLOR_NAME[m.color][fr ? 'fr' : 'en'];
    return fr ? `Presque ! On cherche les cadeaux ${c}s.` : `Almost! We're looking for ${c} presents.`;
  }
  if (v.reason === 'too_much') return fr ? `Trop grand ! Il manque seulement ${v.missing}.` : `Too big! Only ${v.missing} left to make.`;
  return fr ? 'J’ai tout ce qu’il faut ! Allons à la maison.' : 'I have everything! Let’s go to the house.';
}

/* ── Final: decorate the tree with a pattern ── */

export const ORNAMENTS = ['red', 'yellow', 'blue', 'green', 'purple'] as const;
export type Ornament = (typeof ORNAMENTS)[number];

export interface PatternRound {
  /** Shown sequence; the child chooses what comes next. */
  shown: Ornament[];
  answer: Ornament;
  choices: Ornament[];
}

/** 3 rounds of "what comes next?": AB patterns for little ones, ABC / AAB for bigger. */
export function planPattern(seed: number, band: Band): PatternRound[] {
  const r = rng(seed * 13 + 101);
  const rounds: PatternRound[] = [];
  for (let k = 0; k < 3; k++) {
    const pool = shuffle([...ORNAMENTS], r);
    const unit: Ornament[] = band === 'little' ? [pool[0], pool[1]] : band === 'middle' ? (k === 2 ? [pool[0], pool[0], pool[1]] : [pool[0], pool[1], pool[2]]) : [pool[0], pool[1], pool[1], pool[2]];
    const len = unit.length * 2 + 1;
    const seq = Array.from({ length: len }, (_, i) => unit[i % unit.length]);
    const answer = seq.pop()!;
    const choices = shuffle([answer, ...shuffle(ORNAMENTS.filter((o) => o !== answer), r).slice(0, 2)], r);
    rounds.push({ shown: seq, answer, choices });
  }
  return rounds;
}
