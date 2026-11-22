/**
 * What Ziggy says in the album: pre-written, kind, read aloud. Never a
 * count, a score or a "missing" page: only what the child found, and a
 * gentle invitation to explore. (story.test.ts checks the words.)
 */
import type { L } from '@/lib/i18n-text';
import type { JournalWorld } from './types';

export const ALBUM_TEXT = {
  title: { fr: 'Mon carnet de découvertes', en: 'My discovery book' },
  subtitle: { fr: 'Tout ce que tu as trouvé et créé, rangé ici rien que pour toi.', en: 'Everything you found and made, kept here just for you.' },
  all: { fr: 'Tout', en: 'All' },
  filters: { fr: 'Choisir un monde', en: 'Choose a world' },
  prev: { fr: 'Page précédente', en: 'Previous page' },
  next: { fr: 'Page suivante', en: 'Next page' },
  page: { fr: 'Page', en: 'Page' },
  today: { fr: 'Aujourd’hui', en: 'Today' },
  yesterday: { fr: 'Hier', en: 'Yesterday' },
  tellMyDay: { fr: 'Ziggy raconte ma journée', en: 'Ziggy tells my day' },
  tellMyDaySub: { fr: 'Une petite histoire douce pour le dodo', en: 'A gentle little bedtime story' },
  explore: { fr: 'Explore pour en trouver d’autres !', en: 'Explore to find more!' },
  exploreSub: { fr: 'Chaque jour, de nouvelles merveilles t’attendent.', en: 'New wonders are waiting for you every day.' },
  emptyTitle: { fr: 'Ton carnet est tout neuf !', en: 'Your book is brand new!' },
  emptyText: { fr: 'Joue, crée et explore : tes découvertes viendront se coller ici comme des autocollants.', en: 'Play, create and explore: your discoveries will stick here like stickers.' },
  privacy: { fr: 'Ton carnet reste sur cet appareil.', en: 'Your book stays on this device.' },
  loading: { fr: 'Ziggy ouvre ton carnet…', en: 'Ziggy is opening your book…' },
  readStory: { fr: 'Relire l’histoire', en: 'Read the story again' },
  close: { fr: 'Fermer', en: 'Close' },
} satisfies Record<string, L>;

/** Places to explore (the invitation page and the empty album). */
export const EXPLORE_LINKS: { href: '/monde/bac-a-sable' | '/creer/creatures' | '/monde' | '/coloriage'; emoji: string; label: L; color: string }[] = [
  { href: '/monde/bac-a-sable', emoji: '🧪', label: { fr: 'Bac à sable magique', en: 'Magic sandbox' }, color: '#4FC9C0' },
  { href: '/creer/creatures', emoji: '👾', label: { fr: 'Usine à créatures', en: 'Creature factory' }, color: '#B07CFF' },
  { href: '/monde', emoji: '🗺️', label: { fr: 'Ziggy World', en: 'Ziggy World' }, color: '#3F8FE0' },
  { href: '/coloriage', emoji: '🖍️', label: { fr: 'Coloriage', en: 'Colouring' }, color: '#FF7AB8' },
];

/** Ziggy's hello at the top of the album. */
export const HELLO_LINES: L[] = [
  { fr: 'Regarde tout ce que tu as découvert ! Je suis si content.', en: 'Look at everything you discovered! I’m so happy.' },
  { fr: 'Ton carnet brille de mille couleurs.', en: 'Your book sparkles with a thousand colours.' },
  { fr: 'Chaque autocollant raconte une belle aventure.', en: 'Every sticker tells a lovely adventure.' },
  { fr: 'J’adore feuilleter ton carnet avec toi.', en: 'I love leafing through your book with you.' },
  { fr: 'Quelle collection de merveilles !', en: 'What a collection of wonders!' },
  { fr: 'Touche un autocollant, je te raconte.', en: 'Tap a sticker and I’ll tell you about it.' },
];

/** Ziggy's word when the empty album opens. */
export const EMPTY_LINES: L[] = [
  { fr: 'Coucou ! Ton carnet attend tes premières découvertes.', en: 'Hello! Your book is waiting for your first discoveries.' },
  { fr: 'Viens, on part explorer ensemble ?', en: 'Shall we go exploring together?' },
];

/** What Ziggy says when a sticker is tapped, per world. */
export const STICKER_LINES: Record<JournalWorld, L[]> = {
  sandbox: [
    { fr: 'Une vraie découverte de savant !', en: 'A real scientist’s discovery!' },
    { fr: 'La science, c’est magique.', en: 'Science is magic.' },
    { fr: 'Tu as bien observé !', en: 'You looked so carefully!' },
  ],
  creatures: [
    { fr: 'Quelle créature rigolote !', en: 'What a funny creature!' },
    { fr: 'Elle est unique, comme toi.', en: 'It’s one of a kind, like you.' },
    { fr: 'Elle te fait coucou !', en: 'It’s waving at you!' },
  ],
  lutins: [
    { fr: 'Hi hi, ces lutins sont de vrais farceurs !', en: 'Hee hee, those elves are such jokers!' },
    { fr: 'Quelle drôle de surprise !', en: 'What a funny surprise!' },
    { fr: 'Les lutins aiment te faire rire.', en: 'The elves love to make you laugh.' },
  ],
  adventure: [
    { fr: 'Un trésor de Ziggy World !', en: 'A treasure from Ziggy World!' },
    { fr: 'Quelle belle aventure !', en: 'What a lovely adventure!' },
    { fr: 'Tu as exploré si loin !', en: 'You explored so far!' },
  ],
  games: [
    { fr: 'On s’est bien amusés !', en: 'We had so much fun!' },
    { fr: 'Quelle belle partie !', en: 'What a lovely game!' },
    { fr: 'J’adore jouer avec toi.', en: 'I love playing with you.' },
  ],
  art: [
    { fr: 'Quelles jolies couleurs !', en: 'What lovely colours!' },
    { fr: 'Une œuvre d’artiste !', en: 'An artist’s masterpiece!' },
    { fr: 'Je l’accrocherais bien dans ma chambre.', en: 'I’d love to hang it in my room.' },
  ],
  music: [
    { fr: 'Ta chanson me donne envie de danser !', en: 'Your song makes me want to dance!' },
    { fr: 'Quelle jolie musique !', en: 'What pretty music!' },
    { fr: 'La la la, j’adore !', en: 'La la la, I love it!' },
  ],
  moments: [
    { fr: 'Un joli moment.', en: 'A lovely moment.' },
    { fr: 'Je m’en souviens bien !', en: 'I remember it well!' },
    { fr: 'Un souvenir tout doux.', en: 'A sweet memory.' },
  ],
  stories: [
    { fr: 'Une histoire rien qu’à toi. On la relit ?', en: 'A story all your own. Shall we read it again?' },
    { fr: 'J’adore te raconter des histoires.', en: 'I love telling you stories.' },
  ],
};

export const STORY_TEXT = {
  pickTitle: { fr: 'Choisis jusqu’à 3 souvenirs', en: 'Pick up to 3 memories' },
  pickHelp: { fr: 'Ziggy va en faire une histoire douce pour le dodo.', en: 'Ziggy will turn them into a gentle bedtime story.' },
  pickToday: { fr: 'Aujourd’hui', en: 'Today' },
  pickRecent: { fr: 'Ces derniers jours', en: 'The last few days' },
  pickFull: { fr: 'Trois, c’est parfait pour une histoire !', en: 'Three is perfect for a story!' },
  pickQuiet: { fr: 'Pas de souvenir choisi ? Ziggy racontera une journée toute douce.', en: 'No memory picked? Ziggy will tell a gentle, quiet day.' },
  tell: { fr: 'Raconte, Ziggy !', en: 'Tell it, Ziggy!' },
  read: { fr: 'Lis-moi la page', en: 'Read me the page' },
  stop: { fr: 'Stop', en: 'Stop' },
  back: { fr: 'Retour au carnet', en: 'Back to my book' },
  saved: { fr: 'Ton histoire est rangée dans ton carnet.', en: 'Your story is kept in your book.' },
  theEnd: { fr: 'Fin', en: 'The end' },
} satisfies Record<string, L>;

/** The child's first name at the very end (personal: only the device's voice says it). */
export function goodnightName(name: string, locale: string): string {
  return locale === 'fr' ? `Bonne nuit, ${name}.` : `Good night, ${name}.`;
}

/** Deterministic pick in a list (same key, same line: no flicker between renders). */
export function lineFor<T>(list: T[], key: string): T {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}
