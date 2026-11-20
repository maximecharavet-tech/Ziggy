/**
 * How people see Ziggy's sounds: emoji, French and English names, one-line
 * descriptions, grouped for the Lab gallery. Kept apart from the catalog so the
 * pages that only play sounds don't download this text.
 */
import type { L } from '@/lib/i18n-text';
import type { SoundName } from './catalog';

export type SoundGroup = 'ui' | 'feedback' | 'funny' | 'party' | 'calm';

export type SoundLabel = {
  group: SoundGroup;
  emoji: string;
  label: L;
  /** One-line description (gallery tooltip, reports). */
  about: L;
};

export const SOUND_LABELS: Record<SoundName, SoundLabel> = {
  tap: {
    group: 'ui', emoji: '👆', label: { fr: 'Toc', en: 'Tap' },
    about: { fr: 'Petit « toc » en bois pour un bouton', en: 'Soft wooden tick for a button' },
  },
  correct: {
    group: 'feedback', emoji: '✅', label: { fr: 'Bravo', en: 'Correct' },
    about: { fr: 'Deux notes de marimba qui montent', en: 'Two marimba notes going up' },
  },
  wrong: {
    group: 'feedback', emoji: '🤔', label: { fr: 'Pas tout à fait', en: 'Not quite' },
    about: { fr: '« Bou-bip ? » tout doux, qui remonte : on réessaie', en: 'A gentle "boo-bip?" that lifts: try again' },
  },
  star: {
    group: 'feedback', emoji: '⭐', label: { fr: 'Étoile', en: 'Star' },
    about: { fr: 'Trois clochettes qui grimpent', en: 'Three little bells climbing up' },
  },
  win: {
    group: 'party', emoji: '🏆', label: { fr: 'Victoire', en: 'Win' },
    about: { fr: 'Petite fanfare de trompette-jouet', en: 'Little toy-trumpet fanfare' },
  },
  reward: {
    group: 'party', emoji: '🎁', label: { fr: 'Récompense', en: 'Reward' },
    about: { fr: 'Montée, cloche frappée, puis paillettes', en: 'Rising sweep, struck bell, then glitter' },
  },
  pop: {
    group: 'ui', emoji: '👋', label: { fr: 'Coucou Ziggy', en: "Ziggy's hello" },
    about: { fr: '« Blop-pip ! » le bonjour de Ziggy', en: 'A "blop-pip!" hello from Ziggy' },
  },
  boing: {
    group: 'funny', emoji: '🦘', label: { fr: 'Boing', en: 'Boing' },
    about: { fr: 'Ressort de dessin animé qui vibre', en: 'Wobbly cartoon spring' },
  },
  squeak: {
    group: 'funny', emoji: '🦆', label: { fr: 'Canard qui couine', en: 'Squeaky duck' },
    about: { fr: 'Jouet en caoutchouc qu’on serre', en: 'A squeezed rubber toy' },
  },
  whoosh: {
    group: 'funny', emoji: '💨', label: { fr: 'Coup de vent', en: 'Whoosh' },
    about: { fr: 'Souffle qui passe de gauche à droite', en: 'A swish of air from left to right' },
  },
  sparkle: {
    group: 'calm', emoji: '✨', label: { fr: 'Paillettes', en: 'Sparkles' },
    about: { fr: 'Nuage de petites clochettes magiques', en: 'A cloud of tiny magic bells' },
  },
  bubble: {
    group: 'funny', emoji: '🫧', label: { fr: 'Bulle', en: 'Bubble' },
    about: { fr: '« Bloup ! » une bulle qui éclate', en: 'A "bloop!" popping bubble' },
  },
  giggle: {
    group: 'funny', emoji: '🤭', label: { fr: 'Rire de robot', en: 'Robot giggle' },
    about: { fr: '« Hi-hi-hi » de petit robot (synthétisé)', en: 'A little robot "hee-hee-hee" (synthesised)' },
  },
  slideUp: {
    group: 'funny', emoji: '⤴️', label: { fr: 'Sifflet qui monte', en: 'Slide whistle up' },
    about: { fr: 'Sifflet à coulisse vers le haut', en: 'Slide whistle going up' },
  },
  slideDown: {
    group: 'funny', emoji: '⤵️', label: { fr: 'Sifflet qui descend', en: 'Slide whistle down' },
    about: { fr: 'Sifflet à coulisse vers le bas', en: 'Slide whistle going down' },
  },
  drumroll: {
    group: 'party', emoji: '🥁', label: { fr: 'Roulement de tambour', en: 'Drum roll' },
    about: { fr: 'Roulement qui monte puis « tom ! »', en: 'A swelling roll, then "tom!"' },
  },
  tada: {
    group: 'party', emoji: '🎉', label: { fr: 'Tadaa !', en: 'Ta-da!' },
    about: { fr: 'Deux accords de cuivres tout ronds', en: 'Two round brass chords' },
  },
  honk: {
    group: 'funny', emoji: '🤡', label: { fr: 'Klaxon de clown', en: 'Clown horn' },
    about: { fr: 'Poire de klaxon, tout doux', en: 'A soft clown bulb horn' },
  },
  plop: {
    group: 'ui', emoji: '🧩', label: { fr: 'Plop', en: 'Plop' },
    about: { fr: 'Une pièce qui se pose à sa place', en: 'A piece dropping into place' },
  },
  magic: {
    group: 'calm', emoji: '🪄', label: { fr: 'Baguette magique', en: 'Magic wand' },
    about: { fr: 'Harpe qui monte et carillon scintillant', en: 'A rising harp and a shimmering chime' },
  },
  hover: {
    group: 'ui', emoji: '🖱️', label: { fr: 'Survol (souris)', en: 'Hover (mouse)' },
    about: { fr: 'Tic tout léger quand la souris passe', en: 'A barely-there tick under the mouse' },
  },
  unlock: {
    group: 'feedback', emoji: '🔓', label: { fr: 'Déverrouillé', en: 'Unlock' },
    about: { fr: '« Clic-clac, ding-ding ! »', en: '"Click-clack, ding-ding!"' },
  },
  bonk: {
    group: 'funny', emoji: '🥥', label: { fr: 'Bonk', en: 'Bonk' },
    about: { fr: 'Petit choc de noix de coco, rigolo', en: 'A funny little coconut bump' },
  },
  pageIn: {
    group: 'ui', emoji: '📄', label: { fr: 'Nouvelle page', en: 'Page in' },
    about: { fr: 'Souffle léger de papier', en: 'A light paper swoosh' },
  },
  confetti: {
    group: 'party', emoji: '🎊', label: { fr: 'Confettis', en: 'Confetti' },
    about: { fr: '« Pok ! » puis les papiers qui retombent', en: 'A soft "pok!", then paper bits falling' },
  },
  snore: {
    group: 'calm', emoji: '😴', label: { fr: 'Petit ronflement', en: 'Tiny snore' },
    about: { fr: '« Khrrr… fiouu » quand Ziggy fait la sieste', en: 'A "khrrr… fyoo" while Ziggy naps' },
  },
  yay: {
    group: 'feedback', emoji: '🙌', label: { fr: 'Youpi robot', en: 'Robot yay' },
    about: { fr: '« Youpiii » de robot (synthétisé)', en: 'A robot "yaaay!" (synthesised)' },
  },
};

export const GROUP_LABELS: Record<SoundGroup, L> = {
  ui: { fr: 'Petits bruits', en: 'Little clicks' },
  feedback: { fr: 'Réponses', en: 'Answers' },
  funny: { fr: 'Rigolos', en: 'Funny' },
  party: { fr: 'La fête', en: 'Party' },
  calm: { fr: 'Magie et dodo', en: 'Magic and naps' },
};
