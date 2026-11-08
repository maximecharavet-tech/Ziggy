/**
 * The wish-list catalogue: big illustrated cards a child can pick without
 * reading. Generic toy types only (no brands: no advertising to children).
 * `say` is how Santa names it out loud ("Un vélo !").
 */
import type { L } from '@/lib/i18n-text';

export type GiftCategory = 'jouets' | 'jeux' | 'creatif' | 'livres' | 'dehors' | 'musique' | 'peluches' | 'deguisement' | 'sciences';

export type SantaGift = { id: string; emoji: string; cat: GiftCategory; label: L; say: L; color: string };

export const GIFT_CATEGORIES: { id: GiftCategory; emoji: string; label: L; color: string }[] = [
  { id: 'jouets', emoji: '🧸', label: { fr: 'Jouets', en: 'Toys' }, color: '#ff6b6b' },
  { id: 'jeux', emoji: '🎲', label: { fr: 'Jeux', en: 'Games' }, color: '#4dabf7' },
  { id: 'creatif', emoji: '🎨', label: { fr: 'Créer', en: 'Create' }, color: '#f783ac' },
  { id: 'livres', emoji: '📚', label: { fr: 'Livres', en: 'Books' }, color: '#9775fa' },
  { id: 'dehors', emoji: '🚲', label: { fr: 'Dehors', en: 'Outdoors' }, color: '#51cf66' },
  { id: 'musique', emoji: '🎵', label: { fr: 'Musique', en: 'Music' }, color: '#fcc419' },
  { id: 'peluches', emoji: '🐻', label: { fr: 'Doudous', en: 'Cuddly toys' }, color: '#ff922b' },
  { id: 'deguisement', emoji: '👑', label: { fr: 'Déguisements', en: 'Dress-up' }, color: '#e64980' },
  { id: 'sciences', emoji: '🔭', label: { fr: 'Sciences', en: 'Science' }, color: '#20c997' },
];

const g = (id: string, emoji: string, cat: GiftCategory, fr: string, en: string, sayFr: string, sayEn: string, color: string): SantaGift => ({
  id,
  emoji,
  cat,
  label: { fr, en },
  say: { fr: sayFr, en: sayEn },
  color,
});

export const SANTA_GIFTS: SantaGift[] = [
  g('voiture', '🚗', 'jouets', 'Petites voitures', 'Toy cars', 'des petites voitures', 'toy cars', '#ff6b6b'),
  g('train', '🚂', 'jouets', 'Un train', 'A train set', 'un train électrique', 'a train set', '#e03131'),
  g('poupee', '🪆', 'jouets', 'Une poupée', 'A doll', 'une jolie poupée', 'a lovely doll', '#f783ac'),
  g('construction', '🧱', 'jouets', 'Jeu de construction', 'Building bricks', 'un jeu de construction', 'building bricks', '#fab005'),
  g('robot', '🤖', 'jouets', 'Un robot', 'A robot', 'un robot', 'a robot', '#4dabf7'),
  g('dinosaure', '🦖', 'jouets', 'Des dinosaures', 'Dinosaurs', 'des dinosaures', 'dinosaurs', '#40c057'),
  g('chateau', '🏰', 'jouets', 'Un château', 'A castle', 'un château', 'a castle', '#845ef7'),
  g('cuisine', '🍳', 'jouets', 'Une dînette', 'A play kitchen', 'une dînette', 'a play kitchen', '#ff922b'),
  g('garage', '🛠️', 'jouets', 'Un garage', 'A toy garage', 'un garage', 'a toy garage', '#868e96'),
  g('avion', '✈️', 'jouets', 'Un avion', 'A plane', 'un avion', 'a plane', '#339af0'),
  g('bateau', '⛵', 'jouets', 'Un bateau', 'A boat', 'un bateau', 'a boat', '#1c7ed6'),
  g('fusee', '🚀', 'jouets', 'Une fusée', 'A rocket', 'une fusée', 'a rocket', '#7048e8'),
  g('puzzle', '🧩', 'jeux', 'Un puzzle', 'A puzzle', 'un puzzle', 'a puzzle', '#4dabf7'),
  g('jeu-societe', '🎲', 'jeux', 'Jeu de société', 'A board game', 'un jeu de société', 'a board game', '#ff6b6b'),
  g('cartes', '🃏', 'jeux', 'Jeu de cartes', 'A card game', 'un jeu de cartes', 'a card game', '#e64980'),
  g('console', '🎮', 'jeux', 'Un jeu vidéo', 'A video game', 'un jeu vidéo', 'a video game', '#5c7cfa'),
  g('magie', '🎩', 'jeux', 'Tours de magie', 'A magic kit', 'une boîte de magie', 'a magic kit', '#7950f2'),
  g('billes', '🔮', 'jeux', 'Des billes', 'Marbles', 'des billes', 'marbles', '#15aabf'),
  g('peinture', '🎨', 'creatif', 'De la peinture', 'Paints', 'de la peinture', 'paints', '#f783ac'),
  g('feutres', '🖍️', 'creatif', 'Feutres et crayons', 'Pens and crayons', 'des feutres et des crayons', 'pens and crayons', '#ff922b'),
  g('pate', '🟣', 'creatif', 'Pâte à modeler', 'Modelling clay', 'de la pâte à modeler', 'modelling clay', '#be4bdb'),
  g('perles', '📿', 'creatif', 'Des perles', 'Beads', 'des perles', 'beads', '#f06595'),
  g('couture', '🧵', 'creatif', 'Kit de couture', 'A sewing kit', 'un kit de couture', 'a sewing kit', '#e64980'),
  g('appareil', '📷', 'creatif', 'Un appareil photo', 'A camera', 'un appareil photo', 'a camera', '#495057'),
  g('livre', '📖', 'livres', 'Un livre d’histoires', 'A storybook', 'un livre d’histoires', 'a storybook', '#9775fa'),
  g('bd', '💬', 'livres', 'Une BD', 'A comic book', 'une bande dessinée', 'a comic book', '#fcc419'),
  g('docu', '🌍', 'livres', 'Livre des animaux', 'An animal book', 'un livre sur les animaux', 'a book about animals', '#40c057'),
  g('velo', '🚲', 'dehors', 'Un vélo', 'A bike', 'un vélo', 'a bike', '#51cf66'),
  g('trottinette', '🛴', 'dehors', 'Une trottinette', 'A scooter', 'une trottinette', 'a scooter', '#20c997'),
  g('ballon', '⚽', 'dehors', 'Un ballon', 'A ball', 'un ballon', 'a ball', '#37b24d'),
  g('patins', '⛸️', 'dehors', 'Des patins', 'Skates', 'des patins', 'skates', '#74c0fc'),
  g('luge', '🛷', 'dehors', 'Une luge', 'A sledge', 'une luge', 'a sledge', '#e03131'),
  g('cerf-volant', '🪁', 'dehors', 'Un cerf-volant', 'A kite', 'un cerf-volant', 'a kite', '#fd7e14'),
  g('cabane', '⛺', 'dehors', 'Une cabane', 'A play tent', 'une cabane', 'a play tent', '#2f9e44'),
  g('instrument', '🎸', 'musique', 'Une guitare', 'A guitar', 'une guitare', 'a guitar', '#fcc419'),
  g('piano', '🎹', 'musique', 'Un piano', 'A keyboard', 'un petit piano', 'a little keyboard', '#495057'),
  g('tambour', '🥁', 'musique', 'Un tambour', 'A drum', 'un tambour', 'a drum', '#e8590c'),
  g('micro', '🎤', 'musique', 'Un micro', 'A microphone', 'un micro pour chanter', 'a microphone to sing', '#f06595'),
  g('ours', '🧸', 'peluches', 'Un ours en peluche', 'A teddy bear', 'un ours en peluche', 'a teddy bear', '#ff922b'),
  g('licorne', '🦄', 'peluches', 'Une licorne', 'A unicorn', 'une licorne', 'a unicorn', '#da77f2'),
  g('chat', '🐱', 'peluches', 'Un chat en peluche', 'A toy cat', 'un chat en peluche', 'a cuddly cat', '#ffa94d'),
  g('chien', '🐶', 'peluches', 'Un chien en peluche', 'A toy dog', 'un chien en peluche', 'a cuddly dog', '#c0a080'),
  g('princesse', '👑', 'deguisement', 'Costume de princesse', 'Princess costume', 'un costume de princesse', 'a princess costume', '#e64980'),
  g('chevalier', '🛡️', 'deguisement', 'Costume de chevalier', 'Knight costume', 'un costume de chevalier', 'a knight costume', '#868e96'),
  g('super-heros', '🦸', 'deguisement', 'Costume de super-héros', 'Superhero costume', 'un costume de super-héros', 'a superhero costume', '#1c7ed6'),
  g('pirate', '🏴‍☠️', 'deguisement', 'Costume de pirate', 'Pirate costume', 'un costume de pirate', 'a pirate costume', '#212529'),
  g('telescope', '🔭', 'sciences', 'Un télescope', 'A telescope', 'un télescope', 'a telescope', '#20c997'),
  g('microscope', '🔬', 'sciences', 'Un microscope', 'A microscope', 'un microscope', 'a microscope', '#12b886'),
  g('chimie', '🧪', 'sciences', 'Kit d’expériences', 'A science kit', 'un kit d’expériences', 'a science kit', '#0ca678'),
  g('globe', '🌐', 'sciences', 'Un globe', 'A globe', 'un globe terrestre', 'a globe', '#1098ad'),
  g('surprise', '🎁', 'jouets', 'Une surprise !', 'A surprise!', 'une belle surprise', 'a lovely surprise', '#fa5252'),
];

export const giftById = (id: string) => SANTA_GIFTS.find((x) => x.id === id) ?? null;
