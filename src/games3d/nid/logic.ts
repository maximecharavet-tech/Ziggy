/**
 * Le Nid de mon compagnon — pure logic (no three.js, no DOM).
 *
 * Child-safety rules, enforced here:
 *  - The companion is never sick, never sad, never hungry "because you left".
 *    Needs are "envies" (wishes) that only fill UP when the child takes care;
 *    nothing ever decreases with time. Only the child's own "Fête du nid"
 *    starts a new round of wishes.
 *  - The companion grows with the child's learning (stars + mastered skills
 *    in World Memory), never with time spent in the game.
 *  - Every care is a micro-challenge with zero failure: a wrong choice gives a
 *    gentle hint and the child simply tries again.
 */
import type { LearningSkill } from '@/lib/learning/skills';
import type { WorldMemory } from '@/lib/world/memory';
import { totalStars } from '@/lib/world/memory';
import { rng } from '../kit/rng';
import type { L } from '@/lib/i18n-text';
import { tr } from '@/lib/i18n-text';

export type Band = 'little' | 'middle' | 'big';

/* ───────────────────────── Needs (wishes) ───────────────────────── */

export const NEEDS = ['food', 'play', 'hug', 'bath'] as const;
export type NeedId = (typeof NEEDS)[number];
/** Each wish fills in 3 cares. */
export const NEED_MAX = 3;
export type Needs = Record<NeedId, number>;

export const NEED_INFO: Record<NeedId, { emoji: string; label: L; wish: L }> = {
  food: { emoji: '🍎', label: { fr: 'Manger', en: 'Eat' }, wish: { fr: 'a envie d’un bon goûter', en: 'would love a tasty snack' } },
  play: { emoji: '⚽', label: { fr: 'Jouer', en: 'Play' }, wish: { fr: 'a envie de jouer à la balle', en: 'would love to play ball' } },
  hug: { emoji: '🤗', label: { fr: 'Câlin', en: 'Cuddle' }, wish: { fr: 'a envie d’un câlin', en: 'would love a cuddle' } },
  bath: { emoji: '🛁', label: { fr: 'Bain', en: 'Bath' }, wish: { fr: 'a envie de faire des bulles', en: 'would love a bubble bath' } },
};

export const emptyNeeds = (): Needs => ({ food: 0, play: 0, hug: 0, bath: 0 });

/** A care was given: that wish goes up by one (capped). Never lowers anything. */
export function careNeed(needs: Needs, id: NeedId): Needs {
  return { ...needs, [id]: Math.min(NEED_MAX, Math.max(0, needs[id]) + 1) };
}

export const allFull = (needs: Needs) => NEEDS.every((n) => needs[n] >= NEED_MAX);

/**
 * The child chose to throw the "Fête du nid" (only possible when every wish is
 * full): the party is counted and a fresh round of wishes begins. This is the
 * only way levels go back to zero — the child's own celebration, never time.
 */
export function celebrate(save: NidSave): NidSave {
  if (!allFull(save.needs)) return save;
  return { ...save, needs: emptyNeeds(), parties: save.parties + 1 };
}

/* ───────────────────────── Growth ───────────────────────── */

export const STAGES = ['baby', 'small', 'big', 'legend'] as const;
export type StageId = (typeof STAGES)[number];
/** Growth points needed for each stage: 1 star = 1 point, 1 mastered skill = 3 points. */
export const STAGE_POINTS: Record<StageId, number> = { baby: 0, small: 5, big: 15, legend: 35 };
export const MASTERY_THRESHOLD = 0.6;
export const POINTS_PER_SKILL = 3;

export const STAGE_INFO: Record<StageId, { label: L; emoji: string; scale: number }> = {
  baby: { label: { fr: 'bébé', en: 'baby' }, emoji: '🥚', scale: 0.74 },
  small: { label: { fr: 'petit', en: 'little one' }, emoji: '🌱', scale: 0.88 },
  big: { label: { fr: 'grand', en: 'big' }, emoji: '🌳', scale: 1.02 },
  legend: { label: { fr: 'légendaire', en: 'legendary' }, emoji: '👑', scale: 1.14 },
};

export interface Growth {
  stage: StageId;
  index: number;
  stars: number;
  mastered: number;
  points: number;
  /** Points still needed for the next stage (null at the top). */
  missing: number | null;
  next: StageId | null;
  /** 0..1 within the current stage. */
  progress: number;
}

/** Pure: the companion's stage from the child's learning — never from time spent. */
export function growthFrom(stars: number, mastered: number): Growth {
  const s = Math.max(0, Math.floor(stars));
  const k = Math.max(0, Math.floor(mastered));
  const points = s + k * POINTS_PER_SKILL;
  let index = 0;
  STAGES.forEach((st, i) => {
    if (points >= STAGE_POINTS[st]) index = i;
  });
  const stage = STAGES[index];
  const next = STAGES[index + 1] ?? null;
  const missing = next ? STAGE_POINTS[next] - points : null;
  const progress = next ? (points - STAGE_POINTS[stage]) / (STAGE_POINTS[next] - STAGE_POINTS[stage]) : 1;
  return { stage, index, stars: s, mastered: k, points, missing, next, progress };
}

export function masteredSkills(m: Pick<WorldMemory, 'skills'>): number {
  return Object.values(m.skills).filter((x) => (x?.masteryEstimate ?? 0) >= MASTERY_THRESHOLD).length;
}

export function growthOf(m: WorldMemory): Growth {
  return growthFrom(totalStars(m), masteredSkills(m));
}

export function nextStageHint(g: Growth, locale: string): string {
  if (!g.next || g.missing === null)
    return tr({ fr: 'Ton compagnon est légendaire ! Merci pour tout ce que tu as appris.', en: 'Your companion is legendary! Thank you for everything you learned.' }, locale);
  const n = g.missing;
  const stage = tr(STAGE_INFO[g.next].label, locale);
  return locale === 'fr' ? `Encore ${n} étoile${n > 1 ? 's' : ''} dans Ziggy World pour devenir ${stage} !` : `${n} more star${n > 1 ? 's' : ''} in Ziggy World to become ${stage}!`;
}

/* ───────────────────────── Decorations ───────────────────────── */

export const DECOR_SPOTS = 8;
export const DECOR = ['flowers', 'mushroom', 'lantern', 'slide', 'rainbow', 'starlamp'] as const;
export type DecorId = (typeof DECOR)[number];
export const DECOR_INFO: Record<DecorId, { emoji: string; label: L; stage: StageId }> = {
  flowers: { emoji: '🌷', label: { fr: 'Fleurs', en: 'Flowers' }, stage: 'baby' },
  mushroom: { emoji: '🍄', label: { fr: 'Champignon', en: 'Mushroom' }, stage: 'baby' },
  lantern: { emoji: '🏮', label: { fr: 'Lanterne', en: 'Lantern' }, stage: 'baby' },
  slide: { emoji: '🛝', label: { fr: 'Toboggan', en: 'Slide' }, stage: 'small' },
  rainbow: { emoji: '🌈', label: { fr: 'Arc-en-ciel', en: 'Rainbow' }, stage: 'big' },
  starlamp: { emoji: '🌟', label: { fr: 'Étoile magique', en: 'Magic star' }, stage: 'legend' },
};

export const decorUnlocked = (d: DecorId, g: Growth) => STAGES.indexOf(DECOR_INFO[d].stage) <= g.index;

export function placeDecor(decor: (DecorId | null)[], spot: number, item: DecorId | null): (DecorId | null)[] {
  if (spot < 0 || spot >= DECOR_SPOTS) return decor;
  const next = Array.from({ length: DECOR_SPOTS }, (_, i) => decor[i] ?? null);
  next[spot] = item;
  return next;
}

/* ───────────────────────── Save (localStorage `ziggy:nid`) ───────────────────────── */

export const NID_KEY = 'ziggy:nid';

export interface NidSave {
  v: 1;
  needs: Needs;
  parties: number;
  cares: number;
  decor: (DecorId | null)[];
}

export const emptySave = (): NidSave => ({
  v: 1,
  needs: emptyNeeds(),
  parties: 0,
  cares: 0,
  // A few flowers already, so the garden is pretty from the first visit.
  decor: ['flowers', null, null, 'flowers', null, null, null, null],
});

const int = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.floor(x))) : lo);

/** Read anything (old, corrupted, hand-edited) into a valid save. */
export function parseSave(raw: unknown): NidSave {
  const base = emptySave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Record<keyof NidSave, unknown>>;
  const needsIn = (r.needs && typeof r.needs === 'object' ? r.needs : {}) as Record<string, unknown>;
  const needs = emptyNeeds();
  for (const n of NEEDS) needs[n] = int(needsIn[n], 0, NEED_MAX);
  const decorIn = Array.isArray(r.decor) ? r.decor : base.decor;
  const decor = Array.from({ length: DECOR_SPOTS }, (_, i) => {
    const d = decorIn[i];
    return typeof d === 'string' && (DECOR as readonly string[]).includes(d) ? (d as DecorId) : null;
  });
  return { v: 1, needs, parties: int(r.parties, 0, 1e6), cares: int(r.cares, 0, 1e7), decor };
}

/* ───────────────────────── Foods ───────────────────────── */

export const FOODS = ['apple', 'pear', 'cherry', 'orange', 'carrot', 'potato', 'onion', 'milk', 'egg', 'cheese'] as const;
export type FoodId = (typeof FOODS)[number];
export type FoodGroup = 'tree' | 'ground' | 'animal';

export const FOOD_INFO: Record<FoodId, { emoji: string; group: FoodGroup; name: L }> = {
  apple: { emoji: '🍎', group: 'tree', name: { fr: 'une pomme', en: 'an apple' } },
  pear: { emoji: '🍐', group: 'tree', name: { fr: 'une poire', en: 'a pear' } },
  cherry: { emoji: '🍒', group: 'tree', name: { fr: 'des cerises', en: 'cherries' } },
  orange: { emoji: '🍊', group: 'tree', name: { fr: 'une orange', en: 'an orange' } },
  carrot: { emoji: '🥕', group: 'ground', name: { fr: 'une carotte', en: 'a carrot' } },
  potato: { emoji: '🥔', group: 'ground', name: { fr: 'une pomme de terre', en: 'a potato' } },
  onion: { emoji: '🧅', group: 'ground', name: { fr: 'un oignon', en: 'an onion' } },
  milk: { emoji: '🥛', group: 'animal', name: { fr: 'du lait', en: 'milk' } },
  egg: { emoji: '🥚', group: 'animal', name: { fr: 'un œuf', en: 'an egg' } },
  cheese: { emoji: '🧀', group: 'animal', name: { fr: 'du fromage', en: 'cheese' } },
};

const GROUP_TEXT: Record<FoodGroup, { yes: L; odd: L }> = {
  tree: { yes: { fr: 'qui pousse dans un arbre', en: 'that grows on a tree' }, odd: { fr: 'ne pousse pas dans un arbre', en: 'does not grow on a tree' } },
  ground: { yes: { fr: 'qui pousse sous la terre', en: 'that grows under the ground' }, odd: { fr: 'ne pousse pas sous la terre', en: 'does not grow under the ground' } },
  animal: { yes: { fr: 'qui vient d’un animal', en: 'that comes from an animal' }, odd: { fr: 'ne vient pas d’un animal', en: 'does not come from an animal' } },
};

/* ───────────────────────── Challenges ───────────────────────── */

export type Challenge =
  | {
      kind: 'pick';
      need: 'food';
      skill: LearningSkill;
      /** Fruits already in the basket (big ones count on). */
      start: number;
      target: number;
      /** Apples hanging in the tree (always more than needed). */
      apples: number;
      /** Pears in the tree too (not to pick), for the big ones. */
      pears: number;
      /** Little ones: the basket says "that's it!" by itself at the target. */
      autoFinish: boolean;
    }
  | { kind: 'choose'; need: 'food'; skill: LearningSkill; mode: 'yes' | 'odd'; group: FoodGroup; choices: FoodId[]; answer: FoodId }
  | { kind: 'throw'; need: 'play'; skill: LearningSkill; mode: 'count' | 'number' | 'sequence'; rounds: { targets: number[]; answer: number | null; shown: number[] }[] }
  | { kind: 'rub'; need: 'hug'; skill: LearningSkill; hearts: number; expr: [number, number] | null }
  | { kind: 'bubbles'; need: 'bath'; skill: LearningSkill; mode: 'any' | 'order' | 'word'; labels: string[]; order: string[] };

export type ChallengeKind = Challenge['kind'];

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = <T>(arr: readonly T[], r: () => number): T => arr[Math.floor(r() * arr.length)];
const between = (lo: number, hi: number, r: () => number) => lo + Math.floor(r() * (hi - lo + 1));

const WORDS: Record<'fr' | 'en', string[]> = {
  fr: ['BAIN', 'EAU', 'NID', 'SAVON', 'PLOUF'],
  en: ['BATH', 'SOAP', 'NEST', 'SPLASH', 'DUCK'],
};

function hashSeed(seed: number, need: NeedId, index: number) {
  return (seed * 31 + NEEDS.indexOf(need) * 7919 + index * 104729) >>> 0;
}

/**
 * Decide the next micro-challenge for a wish, locally and deterministically
 * (same seed → same challenge), adapted to the age band and the skill level.
 */
export function planChallenge(seed: number, band: Band, need: NeedId, index: number, level = 1, locale = 'fr'): Challenge {
  const r = rng(hashSeed(seed, need, index));
  const lv = Math.max(1, Math.min(5, Math.floor(level)));
  if (need === 'food') {
    // Alternate picking (counting) and choosing (vocabulary / sorting).
    const choose = (index + Math.floor(r() * 2)) % 2 === 1;
    if (!choose) {
      if (band === 'big') {
        const target = between(6, 8 + Math.min(2, lv - 1), r);
        const start = between(2, target - 3, r);
        const need2 = target - start;
        return { kind: 'pick', need, skill: 'addition', start, target, apples: need2 + 2, pears: 3, autoFinish: false };
      }
      const target = band === 'little' ? between(3, 4, r) : between(4, 6 + Math.min(1, lv - 1), r);
      return { kind: 'pick', need, skill: 'counting', start: 0, target, apples: target + 2, pears: band === 'middle' ? 2 : 0, autoFinish: band === 'little' };
    }
    const groups: FoodGroup[] = band === 'little' ? ['tree', 'ground'] : ['tree', 'ground', 'animal'];
    const group = pick(groups, r);
    const inGroup = FOODS.filter((f) => FOOD_INFO[f].group === group);
    const outGroup = FOODS.filter((f) => FOOD_INFO[f].group !== group);
    if (band === 'big') {
      // Odd one out: two that share the group, one that doesn't.
      const two = shuffle(inGroup, r).slice(0, 2);
      const odd = pick(outGroup, r);
      return { kind: 'choose', need, skill: 'logic', mode: 'odd', group, choices: shuffle([...two, odd], r), answer: odd };
    }
    const answer = pick(inGroup, r);
    const others = shuffle(outGroup, r);
    // Two distractors from two different groups when possible (clearer for little ones).
    const d1 = others[0];
    const d2 = others.find((f) => FOOD_INFO[f].group !== FOOD_INFO[d1].group) ?? others[1];
    return { kind: 'choose', need, skill: 'vocabulary', mode: 'yes', group, choices: shuffle([answer, d1, d2], r), answer };
  }
  if (need === 'play') {
    if (band === 'little') return { kind: 'throw', need, skill: 'counting', mode: 'count', rounds: Array.from({ length: 3 }, () => ({ targets: [1, 2, 3], answer: null, shown: [] })) };
    if (band === 'middle') {
      const max = lv >= 3 ? 20 : 10;
      const rounds = Array.from({ length: 3 }, () => {
        const nums = new Set<number>();
        while (nums.size < 3) nums.add(between(1, max, r));
        const targets = shuffle([...nums], r);
        return { targets, answer: pick(targets, r), shown: [] };
      });
      return { kind: 'throw', need, skill: 'counting', mode: 'number', rounds };
    }
    const rounds = Array.from({ length: 2 }, () => {
      const step = pick(lv >= 3 ? [2, 3, 5, 10] : [1, 2, 5, 10], r);
      const startN = between(0, 4, r) * step;
      const shown = [startN, startN + step, startN + 2 * step];
      const answer = startN + 3 * step;
      const wrong = new Set<number>();
      for (const w of [answer + step, answer - 1, answer + 1, answer + 2 * step]) if (w !== answer && w >= 0 && wrong.size < 2) wrong.add(w);
      return { targets: shuffle([answer, ...wrong], r), answer, shown };
    });
    return { kind: 'throw', need, skill: 'logic', mode: 'sequence', rounds };
  }
  if (need === 'hug') {
    if (band === 'big') {
      const a = between(2, 4, r);
      const b = between(2, 4 + Math.min(2, lv - 1), r);
      return { kind: 'rub', need, skill: 'addition', hearts: a + b, expr: [a, b] };
    }
    return { kind: 'rub', need, skill: 'counting', hearts: band === 'little' ? 3 : between(4, 6, r), expr: null };
  }
  // bath
  if (band === 'little') {
    const n = between(4, 5, r);
    const labels = Array.from({ length: n }, () => '');
    return { kind: 'bubbles', need, skill: 'counting', mode: 'any', labels, order: [] };
  }
  if (band === 'middle') {
    const n = lv >= 3 ? 6 : 5;
    const from = lv >= 3 ? between(1, 4, r) : 1;
    const order = Array.from({ length: n }, (_, i) => String(from + i));
    return { kind: 'bubbles', need, skill: 'counting', mode: 'order', labels: shuffle(order, r), order };
  }
  const word = pick(WORDS[locale === 'fr' ? 'fr' : 'en'], r);
  const order = word.split('');
  return { kind: 'bubbles', need, skill: 'vocabulary', mode: 'word', labels: shuffle(order, r), order };
}

/* ── Checks: every step is decided here, the scene only animates ── */

export type PickVerdict = 'more' | 'done' | 'over';
/** Basket holds `count` fruits (start included). */
export function checkPick(ch: Extract<Challenge, { kind: 'pick' }>, count: number): PickVerdict {
  return count < ch.target ? 'more' : count === ch.target ? 'done' : 'over';
}

export const checkChoice = (ch: Extract<Challenge, { kind: 'choose' }>, food: FoodId) => food === ch.answer;

export function checkThrow(ch: Extract<Challenge, { kind: 'throw' }>, round: number, value: number): boolean {
  const rd = ch.rounds[round];
  if (!rd) return false;
  return rd.answer === null ? true : value === rd.answer;
}

/** Hearts earned after rubbing `px` pixels (gentle rubbing fills it quickly). */
export const RUB_PX_PER_HEART = 160;
export const heartsFromRub = (ch: Extract<Challenge, { kind: 'rub' }>, px: number) => Math.min(ch.hearts, Math.floor(Math.max(0, px) / RUB_PX_PER_HEART));

/** Can this bubble be popped now? `popped` = labels already popped, in order. */
export function checkBubble(ch: Extract<Challenge, { kind: 'bubbles' }>, popped: string[], label: string): boolean {
  if (ch.mode === 'any') return popped.length < ch.labels.length;
  return ch.order[popped.length] === label;
}

export function bubblesDone(ch: Extract<Challenge, { kind: 'bubbles' }>, popped: string[]): boolean {
  return popped.length >= (ch.mode === 'any' ? ch.labels.length : ch.order.length);
}

/** How many steps the challenge has (the "total" sent to the learning engine). */
export function stepsOf(ch: Challenge): number {
  switch (ch.kind) {
    case 'pick':
      return ch.target - ch.start;
    case 'choose':
      return 1;
    case 'throw':
      return ch.rounds.length;
    case 'rub':
      return ch.hearts;
    case 'bubbles':
      return ch.mode === 'any' ? ch.labels.length : ch.order.length;
  }
}

/* ───────────────────────── Words ───────────────────────── */

export function challengeText(ch: Challenge, locale: string, name: string, round = 0): string {
  const fr = locale === 'fr';
  switch (ch.kind) {
    case 'pick':
      if (ch.start > 0)
        return fr
          ? `Il y a déjà ${ch.start} pommes dans le panier. Cueille des pommes pour en avoir ${ch.target} en tout, puis touche « C’est prêt ».`
          : `There are already ${ch.start} apples in the basket. Pick apples until there are ${ch.target} in all, then tap “Ready”.`;
      if (ch.autoFinish) return fr ? `Cueille ${ch.target} pommes dans l’arbre pour ${name} !` : `Pick ${ch.target} apples from the tree for ${name}!`;
      return fr ? `Cueille ${ch.target} pommes rouges, puis touche « C’est prêt ».` : `Pick ${ch.target} red apples, then tap “Ready”.`;
    case 'choose':
      return ch.mode === 'yes'
        ? fr
          ? `Donne à ${name} un aliment ${GROUP_TEXT[ch.group].yes.fr}.`
          : `Give ${name} a food ${GROUP_TEXT[ch.group].yes.en}.`
        : fr
          ? `Trouve l’intrus : lequel ${GROUP_TEXT[ch.group].odd.fr} ?`
          : `Find the odd one out: which one ${GROUP_TEXT[ch.group].odd.en}?`;
    case 'throw': {
      const rd = ch.rounds[round] ?? ch.rounds[0];
      if (ch.mode === 'count') return fr ? `Lance la balle ${ch.rounds.length} fois : touche un cerceau !` : `Throw the ball ${ch.rounds.length} times: tap a hoop!`;
      if (ch.mode === 'number') return fr ? `Lance la balle dans le cerceau ${rd.answer} !` : `Throw the ball into hoop ${rd.answer}!`;
      return fr ? `Continue la suite : ${rd.shown.join(', ')}… Quel cerceau vient ensuite ?` : `Continue the pattern: ${rd.shown.join(', ')}… Which hoop comes next?`;
    }
    case 'rub':
      if (ch.expr) return fr ? `Câlin ! Frotte doucement ${name} pour faire ${ch.expr[0]} + ${ch.expr[1]} cœurs.` : `Cuddle time! Gently rub ${name} to make ${ch.expr[0]} + ${ch.expr[1]} hearts.`;
      return fr ? `Câlin ! Frotte doucement ${name} pour faire ${ch.hearts} cœurs.` : `Cuddle time! Gently rub ${name} to make ${ch.hearts} hearts.`;
    case 'bubbles':
      if (ch.mode === 'any') return fr ? `C’est l’heure du bain ! Éclate ${ch.labels.length} bulles.` : `Bath time! Pop ${ch.labels.length} bubbles.`;
      if (ch.mode === 'order')
        return fr ? `Éclate les bulles dans l’ordre : ${ch.order[0]}, ${ch.order[1]}, ${ch.order[2]}…` : `Pop the bubbles in order: ${ch.order[0]}, ${ch.order[1]}, ${ch.order[2]}…`;
      return fr ? `Éclate les bulles pour écrire le mot ${ch.order.join('')} !` : `Pop the bubbles to spell the word ${ch.order.join('')}!`;
  }
}

/** The choices read aloud one by one (for children who can't read yet). */
export function choiceWords(ch: Challenge, locale: string): string[] {
  if (ch.kind === 'choose') return ch.choices.map((f) => tr(FOOD_INFO[f].name, locale));
  return [];
}

export type HintReason = 'wrong' | 'more' | 'over' | 'tooFast';

export function hintText(ch: Challenge, reason: HintReason, locale: string, ctx: { count?: number; popped?: string[]; round?: number } = {}): string {
  const fr = locale === 'fr';
  switch (ch.kind) {
    case 'pick':
      if (reason === 'over') return fr ? 'Une de trop ! Je la remets dans l’arbre. Compte bien.' : 'One too many! I’ll put it back. Count carefully.';
      if (reason === 'more') return fr ? `Il y en a ${ctx.count ?? 0}. Encore un peu !` : `There are ${ctx.count ?? 0}. A few more!`;
      return fr ? 'Celle-ci est une poire. Cherche les pommes rouges !' : 'That one is a pear. Look for the red apples!';
    case 'choose':
      return ch.mode === 'yes'
        ? fr
          ? `Presque ! Cherche ce qui ${GROUP_TEXT[ch.group].yes.fr.replace(/^qui /, '')}.`
          : `Almost! Look for the one ${GROUP_TEXT[ch.group].yes.en}.`
        : fr
          ? 'Presque ! Deux vont ensemble, un seul est différent.'
          : 'Almost! Two go together, only one is different.';
    case 'throw': {
      const rd = ch.rounds[ctx.round ?? 0];
      if (ch.mode === 'sequence' && rd) {
        const step = rd.shown[1] - rd.shown[0];
        return fr ? `Presque ! Regarde : on ajoute ${step} à chaque fois.` : `Almost! Look: we add ${step} each time.`;
      }
      return fr ? `Presque ! Cherche le cerceau ${rd?.answer ?? ''}.` : `Almost! Look for hoop ${rd?.answer ?? ''}.`;
    }
    case 'rub':
      return fr ? 'Tout doucement… frotte sur ton compagnon.' : 'Gently… rub on your companion.';
    case 'bubbles': {
      const nextLabel = ch.order[(ctx.popped ?? []).length];
      if (ch.mode === 'word') return fr ? `Presque ! La lettre suivante est ${nextLabel}.` : `Almost! The next letter is ${nextLabel}.`;
      return fr ? `Presque ! Cherche la bulle ${nextLabel}.` : `Almost! Look for bubble ${nextLabel}.`;
    }
  }
}

const COUNT_WORDS: Record<'fr' | 'en', string[]> = {
  fr: ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'],
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'],
};
export const countWord = (n: number, locale: string) => COUNT_WORDS[locale === 'fr' ? 'fr' : 'en'][n] ?? String(n);

export const PRAISE: L[] = [
  { fr: 'Bravo ! Tu prends si bien soin de moi !', en: 'Well done! You take such good care of me!' },
  { fr: 'Merci ! Je suis tout content !', en: 'Thank you! I’m so happy!' },
  { fr: 'Youpi ! Tu es mon meilleur ami !', en: 'Yay! You’re my best friend!' },
  { fr: 'Super ! On est une belle équipe !', en: 'Super! We make a great team!' },
];

export function praiseFor(seed: number, locale: string): string {
  return tr(PRAISE[Math.abs(Math.floor(seed)) % PRAISE.length], locale);
}
