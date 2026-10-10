/**
 * The learning skills Ziggy World trains. Every game, quest and world says
 * which of these it exercises; the adaptive engine keeps one score per skill.
 */
import type { L } from '@/lib/i18n-text';

export const LEARNING_SKILLS = [
  'counting',
  'addition',
  'subtraction',
  'multiplication',
  'shapes',
  'letters',
  'reading',
  'vocabulary',
  'logic',
  'memory',
  'colors',
  'science',
  'geography',
  'music',
  'art',
  'ecology',
  'sequencing',
  'animals',
  'nutrition',
  'astronomy',
] as const;

export type LearningSkill = (typeof LEARNING_SKILLS)[number];

/** Skill families shown to parents (never to children). */
export const SKILL_FAMILY: Record<LearningSkill, 'math' | 'language' | 'logic' | 'discovery' | 'creativity'> = {
  counting: 'math',
  addition: 'math',
  subtraction: 'math',
  multiplication: 'math',
  shapes: 'math',
  letters: 'language',
  reading: 'language',
  vocabulary: 'language',
  logic: 'logic',
  memory: 'logic',
  sequencing: 'logic',
  colors: 'creativity',
  art: 'creativity',
  music: 'creativity',
  science: 'discovery',
  geography: 'discovery',
  ecology: 'discovery',
  animals: 'discovery',
  nutrition: 'discovery',
  astronomy: 'discovery',
};

export const SKILL_NAMES: Record<LearningSkill, L> = {
  counting: { fr: 'Compter', en: 'Counting' },
  addition: { fr: 'Additions', en: 'Addition' },
  subtraction: { fr: 'Soustractions', en: 'Subtraction' },
  multiplication: { fr: 'Multiplications', en: 'Multiplication' },
  shapes: { fr: 'Formes', en: 'Shapes' },
  letters: { fr: 'Lettres', en: 'Letters' },
  reading: { fr: 'Lecture', en: 'Reading' },
  vocabulary: { fr: 'Vocabulaire', en: 'Vocabulary' },
  logic: { fr: 'Logique', en: 'Logic' },
  memory: { fr: 'Mémoire', en: 'Memory' },
  colors: { fr: 'Couleurs', en: 'Colours' },
  science: { fr: 'Sciences', en: 'Science' },
  geography: { fr: 'Géographie', en: 'Geography' },
  music: { fr: 'Musique', en: 'Music' },
  art: { fr: 'Art', en: 'Art' },
  ecology: { fr: 'Écologie', en: 'Ecology' },
  sequencing: { fr: 'Ordre et étapes', en: 'Sequencing' },
  animals: { fr: 'Animaux', en: 'Animals' },
  nutrition: { fr: 'Alimentation', en: 'Food' },
  astronomy: { fr: 'Astronomie', en: 'Astronomy' },
};
