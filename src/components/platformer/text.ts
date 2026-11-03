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
    fr: 'Touche ou clique le jeu, puis appuie sur « Jouer ! » (ou Entrée) pour commencer.',
    en: 'Tap or click the game, then press “Jouer !” (or Enter) to start.',
  },
  devices: {
    fr: 'Se joue au doigt sur téléphone et tablette, ou au clavier sur ordinateur.',
    en: 'Play with your fingers on a phone or tablet, or with a keyboard on a computer.',
  },
  touchTitle: { fr: 'Au doigt (téléphone, tablette)', en: 'With your fingers (phone, tablet)' },
  keysTitle: { fr: 'Au clavier (ordinateur)', en: 'With a keyboard (computer)' },
  rotate: {
    fr: 'Astuce : tourne ton téléphone à l’horizontale pour jouer en grand.',
    en: 'Tip: turn your phone sideways to play bigger.',
  },
  close: { fr: 'Quitter le plein écran', en: 'Exit full screen' },
  fullscreen: { fr: 'Plein écran', en: 'Full screen' },
  controls: { fr: 'Les commandes', en: 'The controls' },
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

/** On-screen touch buttons drawn by the game (bottom-left: move, bottom-right: actions, top-right: pause). */
export const TOUCH_CONTROLS: { icon: string; what: L }[] = [
  { icon: '◀ ▶', what: { fr: 'En bas à gauche : avancer', en: 'Bottom left: move' } },
  { icon: '⬆', what: { fr: 'Gros bouton : sauter (maintenir = plus haut, retoucher en l’air = double saut)', en: 'Big button: jump (hold = higher, tap again in the air = double jump)' } },
  { icon: '⏩', what: { fr: 'Foncer (dash)', en: 'Dash' } },
  { icon: '⬇', what: { fr: 'En l’air : plonger pour écraser', en: 'In the air: ground-pound' } },
  { icon: '✸', what: { fr: 'Coup de poing (maintenir = plus fort)', en: 'Punch (hold = stronger)' } },
  { icon: 'Ⅱ', what: { fr: 'En haut à droite : pause', en: 'Top right: pause' } },
];
