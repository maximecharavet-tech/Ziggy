/**
 * Learning goals (design doc A9) mapped to rooms and to World Memory skills.
 * World Memory has no "spatial" or "fractions" skill: they report as the
 * nearest one (`shapes`, `multiplication`).
 */
import type { Band, ChaosGoal, L, LearningSkill } from './types';

export const GOAL_SKILL: Record<ChaosGoal, LearningSkill> = {
  observation: 'memory',
  counting: 'counting',
  patterns: 'sequencing',
  logic: 'logic',
  spatial: 'shapes',
  sorting: 'logic',
  vocabulary: 'vocabulary',
  time: 'sequencing',
  fractions: 'multiplication',
};

/** Main goals of each room (A9 "Rooms (main)" column; observation is everywhere). */
export const A9_MAIN: Record<number, ChaosGoal[]> = {
  1: ['observation', 'spatial'],
  2: ['observation', 'counting', 'sorting'],
  3: ['observation', 'patterns'],
  4: ['observation', 'counting', 'sorting'],
  5: ['observation', 'spatial', 'vocabulary'],
  6: ['observation', 'spatial', 'sorting'],
  7: ['observation', 'vocabulary'],
  8: ['observation', 'patterns'],
  9: ['observation', 'spatial', 'counting'],
  10: ['observation', 'counting', 'sorting'],
  11: ['observation', 'counting', 'fractions'],
  12: ['observation', 'spatial'],
  13: ['observation', 'logic'],
  14: ['observation', 'patterns', 'time'],
  15: ['observation', 'counting', 'patterns', 'logic', 'spatial', 'sorting', 'vocabulary', 'time', 'fractions'],
};

/** Trained in every room by the loop itself: finding pranks and naming the culprit. */
export const INHERENT_GOALS: readonly ChaosGoal[] = ['observation', 'logic'];

/** What each goal looks like per band (parent "what your child practised" card). */
export const GOAL_BY_BAND: Record<ChaosGoal, Record<Band, L>> = {
  observation: {
    little: { fr: 'repérer de grandes différences', en: 'spotting big differences' },
    middle: { fr: 'repérer de petites différences', en: 'spotting small differences' },
    big: { fr: 'repérer des détails subtils', en: 'spotting subtle details' },
  },
  counting: {
    little: { fr: 'compter jusqu’à 5', en: 'counting to 5' },
    middle: { fr: 'compter jusqu’à 20, + et −', en: 'counting to 20, + and −' },
    big: { fr: 'groupes et multiplications', en: 'groups and multiplication' },
  },
  patterns: {
    little: { fr: 'suites ABAB', en: 'ABAB patterns' },
    middle: { fr: 'suites ABC et AABB', en: 'ABC and AABB patterns' },
    big: { fr: 'suites qui grandissent, trouver la règle', en: 'growing patterns, finding the rule' },
  },
  logic: {
    little: { fr: 'un indice évident', en: 'one clear clue' },
    middle: { fr: 'un ou deux indices', en: 'one or two clues' },
    big: { fr: 'grille d’élimination à plusieurs indices', en: 'elimination grid with several clues' },
  },
  spatial: {
    little: { fr: 'dans, sur, sous ; grand et petit', en: 'in, on, under; big and small' },
    middle: { fr: 'gauche, droite, devant, derrière', en: 'left, right, in front, behind' },
    big: { fr: 'coordonnées, rotation mentale', en: 'grid coordinates, mental rotation' },
  },
  sorting: {
    little: { fr: 'trier selon un critère', en: 'sorting by one rule' },
    middle: { fr: 'trier selon deux critères', en: 'sorting by two rules' },
    big: { fr: 'trouver l’intrus et sa règle', en: 'finding the odd one out and its rule' },
  },
  vocabulary: {
    little: { fr: 'nommer les objets de la maison', en: 'naming house objects' },
    middle: { fr: 'lire des mots courts', en: 'reading short words' },
    big: { fr: 'mots dans l’autre langue', en: 'words in the other language' },
  },
  time: {
    little: { fr: 'défaire 2 étapes, heures pile', en: 'undoing 2 steps, o’clock' },
    middle: { fr: 'défaire 4 étapes, demies et quarts', en: 'undoing 4 steps, halves and quarters' },
    big: { fr: 'calculer l’heure, prédire la suite', en: 'working out the time, predicting what’s next' },
  },
  fractions: {
    little: { fr: 'partager équitablement', en: 'sharing fairly' },
    middle: { fr: 'les moitiés', en: 'halves' },
    big: { fr: 'moitiés et quarts', en: 'halves and quarters' },
  },
};
