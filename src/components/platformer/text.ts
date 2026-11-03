import type { L } from '@/lib/i18n-text';

/** Where the WebAssembly build of the platformer lives (public/jeux/ziggy-plateforme/). */
export const PLATFORMER_SRC = '/jeux/ziggy-plateforme/index.html';
export const PLATFORMER_PATH = '/monde/ziggy-plateforme';

export const PT = {
  title: { fr: 'Ziggy et les Étoiles Perdues', en: 'Ziggy and the Lost Stars' },
  teaser: {
    fr: 'Saute, glisse et rebondis avec Ziggy à travers 7 mondes pour retrouver les étoiles perdues.',
    en: 'Jump, dash and bounce with Ziggy through 7 worlds to find the lost stars.',
  },
  skill: { fr: 'Adresse · réflexes · orientation', en: 'Skill · reflexes · finding your way' },
  back: { fr: 'Retour à l’arcade', en: 'Back to the arcade' },
  start: {
    fr: 'Clique sur le jeu, puis appuie sur Entrée pour commencer.',
    en: 'Click the game, then press Enter to start.',
  },
  keyboard: {
    fr: 'Ce jeu se joue avec un clavier (ordinateur).',
    en: 'This game is played with a keyboard (computer).',
  },
  fullscreen: { fr: 'Plein écran', en: 'Full screen' },
  controls: { fr: 'Les touches', en: 'The keys' },
  frame: { fr: 'Jeu Ziggy et les Étoiles Perdues', en: 'Ziggy and the Lost Stars game' },
  badge: { fr: 'Nouveau', en: 'New' },
  play: { fr: 'Jouer', en: 'Play' },
} satisfies Record<string, L>;

/** Short controls summary (the game itself is in French). */
export const CONTROLS: { keys: string; what: L }[] = [
  { keys: '← → (Q / D)', what: { fr: 'Avancer', en: 'Move' } },
  { keys: 'Espace / ↑', what: { fr: 'Sauter (2 fois = double saut)', en: 'Jump (twice = double jump)' } },
  { keys: 'Shift / C', what: { fr: 'Foncer (dash)', en: 'Dash' } },
  { keys: '↓ (S) en l’air', what: { fr: 'Plonger pour écraser', en: 'Ground-pound' } },
  { keys: 'X / J', what: { fr: 'Coup de poing (maintenir = plus fort)', en: 'Punch (hold = stronger)' } },
  { keys: 'Échap / P', what: { fr: 'Pause', en: 'Pause' } },
  { keys: '1 … 7', what: { fr: 'Choisir un monde (écran titre)', en: 'Pick a world (title screen)' } },
];
