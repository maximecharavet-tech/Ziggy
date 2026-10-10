/**
 * Ziggy World interface text (French and English; other locales read English).
 */
import { tr, type L } from '@/lib/i18n-text';

export const WORLD_UI = {
  title: { fr: 'Ziggy World', en: 'Ziggy World' },
  tagline: { fr: '20 mondes magiques à explorer, une aventure qui se souvient de toi.', en: '20 magical worlds to explore — an adventure that remembers you.' },
  continue: { fr: 'Continuer mon aventure', en: 'Continue my adventure' },
  start: { fr: 'Commencer l’aventure', en: 'Start the adventure' },
  daily: { fr: 'Aventure du jour', en: 'Today’s adventure' },
  dailyBonus: { fr: '+15 XP bonus aujourd’hui', en: '+15 bonus XP today' },
  dailyDone: { fr: 'Bonus du jour gagné ✓', en: 'Today’s bonus earned ✓' },
  level: { fr: 'Niveau', en: 'Level' },
  stars: { fr: 'étoiles', en: 'stars' },
  xp: { fr: 'XP', en: 'XP' },
  map: { fr: 'Carte des mondes', en: 'World map' },
  locked: { fr: 'Encore {n} ⭐ pour l’ouvrir', en: '{n} more ⭐ to open it' },
  open: { fr: 'Entrer', en: 'Enter' },
  complete: { fr: 'Monde terminé !', en: 'World complete!' },
  quests: { fr: 'Quêtes', en: 'Quests' },
  play: { fr: 'Jouer', en: 'Play' },
  replay: { fr: 'Rejouer', en: 'Play again' },
  lockedQuest: { fr: 'Termine le chapitre précédent', en: 'Finish the previous chapter' },
  characters: { fr: 'Les habitants', en: 'Who lives here' },
  found: { fr: 'Trouvé dans ce monde', en: 'Found in this world' },
  back: { fr: 'Retour', en: 'Back' },
  backMap: { fr: 'Carte', en: 'Map' },
  companion: { fr: 'Ton compagnon', en: 'Your companion' },
  companions: { fr: 'Compagnons', en: 'Companions' },
  avatar: { fr: 'Mon avatar', en: 'My avatar' },
  stories: { fr: 'Histoires', en: 'Stories' },
  arcade: { fr: 'Arcade', en: 'Arcade' },
  collection: { fr: 'Collection', en: 'Collection' },
  parents: { fr: 'Espace parents', en: 'Parents' },
  loading: { fr: 'Ziggy prépare la suite…', en: 'Ziggy is getting things ready…' },
  letsGo: { fr: 'C’est parti !', en: 'Let’s go!' },
  difficulty: { fr: 'Niveau de jeu', en: 'Game level' },
  result: { fr: 'Bravo, aventure réussie !', en: 'Well done, adventure complete!' },
  resultPractice: { fr: 'Super entraînement !', en: 'Great practice!' },
  next: { fr: 'Aventure suivante', en: 'Next adventure' },
  toWorld: { fr: 'Retour au monde', en: 'Back to the world' },
  again: { fr: 'Rejouer', en: 'Play again' },
  gotXp: { fr: '+{n} XP', en: '+{n} XP' },
  levelUp: { fr: 'Ton niveau de jeu monte : défis un peu plus grands !', en: 'Your game level goes up: slightly bigger challenges!' },
  levelDown: { fr: 'On s’entraîne en douceur au prochain tour.', en: 'Next round we’ll practise gently.' },
  aiMade: { fr: 'Contenu créé par Hyper Engine et vérifié par ChildShield', en: 'Made by Hyper Engine, checked by ChildShield' },
  localMade: { fr: 'Contenu Ziggy', en: 'Ziggy content' },
  guestNote: { fr: 'Tu joues en invité : ton aventure est gardée sur cet appareil.', en: 'Playing as a guest: your adventure is kept on this device.' },
  syncedNote: { fr: 'Aventure sauvegardée dans le compte parent.', en: 'Adventure saved to the parent account.' },
  chapter: { fr: 'Chapitre', en: 'Chapter' },
  skill: { fr: 'Compétence', en: 'Skill' },
  choose: { fr: 'Choisir', en: 'Choose' },
  chosen: { fr: 'Avec toi', en: 'With you' },
  unlockAt: { fr: 'S’ouvre à {n} ⭐', en: 'Opens at {n} ⭐' },
  freePlay: { fr: 'Jeu libre', en: 'Free play' },
  badges: { fr: 'Badges', en: 'Badges' },
  empty: { fr: 'Rien pour l’instant — joue une quête pour commencer ta collection !', en: 'Nothing yet — play a quest to start your collection!' },
} satisfies Record<string, L>;

export type WorldUiKey = keyof typeof WORLD_UI;

export function wt(key: WorldUiKey, locale: string, vars: Record<string, string | number> = {}): string {
  return tr(WORLD_UI[key], locale).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export const MAGIC_TEXT: Record<string, L> = {
  FIRST_QUEST: { fr: 'Ta toute première quête !', en: 'Your very first quest!' },
  FIRST_PERFECT: { fr: 'Trois étoiles, parfait !', en: 'Three stars — perfect!' },
  NEW_ITEM: { fr: 'Nouvelle trouvaille !', en: 'New discovery!' },
  CHAPTER_COMPLETE: { fr: 'Chapitre terminé !', en: 'Chapter complete!' },
  WORLD_COMPLETE: { fr: 'Tu as sauvé tout le monde !', en: 'You saved the whole world!' },
  NEW_WORLD: { fr: 'Un nouveau monde s’ouvre !', en: 'A new world opens!' },
  NEW_COMPANION: { fr: 'Un nouveau compagnon veut jouer avec toi !', en: 'A new companion wants to play with you!' },
  LEVEL_UP: { fr: 'Niveau supérieur !', en: 'Level up!' },
  NEW_BADGE: { fr: 'Nouveau badge !', en: 'New badge!' },
  GREAT_STREAK: { fr: 'Trois super parties d’affilée !', en: 'Three great rounds in a row!' },
  DAILY_DONE: { fr: 'Aventure du jour réussie : +15 XP', en: 'Today’s adventure done: +15 XP' },
};

export const MASTERY_TEXT: Record<'discovering' | 'practising' | 'confident' | 'expert', L> = {
  discovering: { fr: 'Découvre', en: 'Discovering' },
  practising: { fr: 'S’entraîne', en: 'Practising' },
  confident: { fr: 'À l’aise', en: 'Confident' },
  expert: { fr: 'Expert', en: 'Expert' },
};
