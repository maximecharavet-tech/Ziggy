import { tr, type L } from '@/lib/i18n-text';

/** Every interface string the arcade mechanics show, in French and English. */
export const ARCADE_UI: Record<string, L> = {
  round: { fr: 'Manche', en: 'Round' },
  progress: { fr: 'Progression', en: 'Progress' },
  next: { fr: 'Suivant', en: 'Next' },
  finish: { fr: 'Terminer', en: 'Finish' },
  continue: { fr: 'Continuer', en: 'Continue' },
  check: { fr: 'Vérifier', en: 'Check' },
  bravo: { fr: 'Bravo !', en: 'Well done!' },
  super: { fr: 'Super !', en: 'Great!' },
  genius: { fr: 'Génial !', en: 'Awesome!' },
  almost: { fr: 'Presque !', en: 'Almost!' },
  tryAgain: { fr: 'Presque ! Essaie encore une fois.', en: 'Almost! Have another go.' },
  answerWas: { fr: 'La bonne réponse :', en: 'The answer is:' },
  showAnswer: { fr: 'Regarde, voici la solution :', en: 'Look, here is the solution:' },
  option: { fr: 'Réponse', en: 'Answer' },

  // Runner
  runnerHint: { fr: 'Change de couloir pour passer la bonne porte !', en: 'Switch lanes to run through the right gate!' },
  left: { fr: 'Aller à gauche', en: 'Move left' },
  right: { fr: 'Aller à droite', en: 'Move right' },
  runnerLoading: { fr: 'Ziggy enfile ses baskets…', en: 'Ziggy is lacing up…' },
  runnerCanvas: { fr: 'Piste de course de Ziggy', en: "Ziggy's running track" },

  // Pairs
  pairsHint: { fr: 'Retourne deux cartes qui vont ensemble.', en: 'Flip two cards that go together.' },
  hiddenCard: { fr: 'Carte cachée', en: 'Hidden card' },
  pairsFound: { fr: 'Paires trouvées', en: 'Pairs found' },

  // Order
  orderHint: { fr: 'Touche deux étapes pour les échanger.', en: 'Tap two steps to swap them.' },
  step: { fr: 'Étape', en: 'Step' },
  selected: { fr: 'sélectionnée', en: 'selected' },
  moveUp: { fr: 'Monter', en: 'Move up' },
  moveDown: { fr: 'Descendre', en: 'Move down' },

  // Sort
  sortHint: { fr: 'Choisis un objet, puis touche sa boîte.', en: 'Pick an item, then tap its box.' },
  goesIn: { fr: 'va dans', en: 'goes in' },
  bin: { fr: 'Boîte', en: 'Box' },

  // Spell
  spellHint: { fr: 'Touche les lettres dans le bon ordre.', en: 'Tap the letters in the right order.' },
  erase: { fr: 'Effacer une lettre', en: 'Remove a letter' },
  letter: { fr: 'Lettre', en: 'Letter' },
  emptySlot: { fr: 'Case vide', en: 'Empty slot' },

  // Mix
  mixHint: { fr: 'Ajoute jusqu’à 3 couleurs dans le chaudron.', en: 'Add up to 3 colours to the cauldron.' },
  mix: { fr: 'Mélanger !', en: 'Mix!' },
  empty: { fr: 'Vider', en: 'Empty' },
  target: { fr: 'Couleur à fabriquer', en: 'Colour to make' },
  cauldron: { fr: 'Chaudron', en: 'Cauldron' },
  yourMix: { fr: 'Ton mélange', en: 'Your mix' },
  add: { fr: 'Ajouter', en: 'Add' },
  remove: { fr: 'Retirer', en: 'Remove' },
  recipe: { fr: 'La recette :', en: 'The recipe:' },

  // Dig
  digHint: { fr: 'Chaque bonne réponse enlève du sable !', en: 'Every right answer brushes away sand!' },
  found: { fr: 'Trouvé !', en: 'Found it!' },
  youFound: { fr: 'Tu as découvert', en: 'You uncovered' },
  sand: { fr: 'Sable', en: 'Sand' },

  // Melody
  listen: { fr: 'Écoute bien…', en: 'Listen…' },
  yourTurn: { fr: 'À toi de jouer !', en: 'Your turn!' },
  replay: { fr: 'Réécouter', en: 'Listen again' },
  listenAgain: { fr: 'Presque ! Écoute encore.', en: 'Almost! Listen again.' },
  pad: { fr: 'Note', en: 'Note' },

  // Slide
  slideHint: { fr: 'Glisse les tuiles pour les remettre dans l’ordre.', en: 'Slide the tiles back into order.' },
  moves: { fr: 'Coups', en: 'Moves' },
  help: { fr: 'Un coup de pouce', en: 'Give me a hint' },
  tile: { fr: 'Tuile', en: 'Tile' },
  hole: { fr: 'Case vide', en: 'Empty space' },
  solved: { fr: 'Puzzle terminé !', en: 'Puzzle solved!' },
  picture: { fr: 'Image à reconstruire', en: 'Picture to rebuild' },
};

export type ArcadeUiKey = keyof typeof ARCADE_UI;

export function ui(key: string, locale: string): string {
  const text = ARCADE_UI[key];
  return text ? tr(text, locale) : key;
}

const CHEERS = ['bravo', 'super', 'genius'] as const;

/** A cheerful word, varied by round. */
export function cheer(round: number, locale: string): string {
  return ui(CHEERS[Math.abs(round) % CHEERS.length], locale);
}
