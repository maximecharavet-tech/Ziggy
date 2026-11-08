/**
 * The prank catalogue of Les Lutins Farceurs: ready-made ideas a parent picks
 * in one tap (or they describe their own). Gentle mischief only: nothing
 * broken, wasted, dangerous, dirty or mean; nothing a child should copy that
 * could hurt them (no climbing, no fire, no knives, no medicine, no electricity).
 *
 * `action` is the English sentence for the image model (the elves' names are
 * added by the prompt builder); `motion` is for the image-to-video model.
 */
import type { L } from '@/lib/i18n-text';

export type PrankCategory = 'cuisine' | 'salon' | 'chambre' | 'salle-de-bain' | 'sapin' | 'partout';

export type Prank = { id: string; emoji: string; cat: PrankCategory; title: L; action: string; motion: string };

export const PRANK_CATEGORIES: { id: PrankCategory; emoji: string; label: L }[] = [
  { id: 'partout', emoji: '✨', label: { fr: 'Partout', en: 'Anywhere' } },
  { id: 'cuisine', emoji: '🍪', label: { fr: 'Cuisine', en: 'Kitchen' } },
  { id: 'salon', emoji: '🛋️', label: { fr: 'Salon', en: 'Living room' } },
  { id: 'chambre', emoji: '🛏️', label: { fr: 'Chambre', en: 'Bedroom' } },
  { id: 'salle-de-bain', emoji: '🛁', label: { fr: 'Salle de bain', en: 'Bathroom' } },
  { id: 'sapin', emoji: '🎄', label: { fr: 'Sapin', en: 'Tree' } },
];

const p = (id: string, emoji: string, cat: PrankCategory, fr: string, en: string, action: string, motion: string): Prank => ({ id, emoji, cat, title: { fr, en }, action, motion });

export const PRANKS: Prank[] = [
  // Anywhere
  p('papier-toilette', '🧻', 'partout', 'Guirlande de papier toilette', 'Toilet-paper garland', 'have strung a long garland of white toilet paper across the room, draped in loops over the furniture, and are proudly holding the end of the roll', 'the elves tug the paper garland and giggle, the loops sway gently'),
  p('cache-cache', '🙈', 'partout', 'Partie de cache-cache', 'Hide and seek', 'are playing hide-and-seek: one covers its eyes and counts while the others hide behind objects, only their hats peeking out', 'the counting elf peeks through its fingers, the hidden elves duck back behind the objects'),
  p('course-voitures', '🏎️', 'partout', 'Course de petites voitures', 'Toy car race', 'are racing each other sitting in small toy cars along a track made of masking tape on the floor, with a little chequered flag', 'the toy cars roll forward, the elves cheer with their arms up'),
  p('tente', '⛺', 'partout', 'Camping dans la maison', 'Indoor camping', 'have built a tiny camping tent from a tea towel and two pencils, with a little battery fairy-light lantern, and are telling stories while sharing marshmallows', 'the fairy-light lantern twinkles, an elf tells a story with big gestures'),
  p('post-it', '🟨', 'partout', 'Invasion de post-it', 'Sticky-note invasion', 'have covered part of the furniture with colourful sticky notes forming a big smiley face, one elf still holding a pad of notes', 'one more sticky note flutters onto the smiley, the elves high-five'),
  p('bulles', '🫧', 'partout', 'Fête des bulles', 'Bubble party', 'are blowing soap bubbles with tiny wands, shiny bubbles floating all around them', 'iridescent bubbles drift up and pop, the elves laugh and chase them'),
  p('photo-lutins', '📸', 'partout', 'Séance photo', 'Photo shoot', 'are taking a selfie together with a tiny toy camera, making funny faces and peace signs', 'the elves lean in, pose, and a little camera flash twinkles'),
  p('dominos', '🁢', 'partout', 'Grand parcours de dominos', 'Domino run', 'have lined up a long winding row of dominoes and one elf is about to push the first one, the others watching excitedly', 'the dominoes topple one after the other as the elves cover their mouths in delight'),
  p('peluches', '🧸', 'partout', 'Réunion des doudous', 'Cuddly-toy meeting', 'are holding a serious meeting with the soft toys of the house sitting in a circle, one elf presenting with a pointer', 'the elf taps the pointer, the others nod, a teddy slowly tips over'),
  p('livres', '📚', 'partout', 'Toboggan de livres', 'Book slide', 'have made a slide out of a big open book leaning on a pile of books and are sliding down it one after the other', 'an elf slides down the book with its arms raised, the next one waits its turn'),
  // Kitchen
  p('farine-anges', '❄️', 'cuisine', 'Anges dans la farine', 'Flour snow angels', 'have spilled a small patch of flour on the counter and are making snow angels in it, little white footprints everywhere', 'the elves sweep their arms and legs in the flour, a puff of white rises'),
  p('guimauves', '🍡', 'cuisine', 'Bain de guimauves', 'Marshmallow bath', 'are bathing in a big mug filled with mini marshmallows like a bubble bath, one wearing a tiny shower cap', 'the elf splashes marshmallows, one bounces out of the mug'),
  p('cereales', '🥣', 'cuisine', 'Piscine de céréales', 'Cereal pool', 'are swimming in a bowl of breakfast cereal with a spoon as a diving board', 'an elf bounces on the spoon and plops into the cereal'),
  p('pancakes', '🥞', 'cuisine', 'Tour de pancakes', 'Pancake tower', 'have stacked a tall wobbly tower of small pancakes and one elf is placing a strawberry on top', 'the tower wobbles, the elf balances the strawberry on top'),
  p('visages-fruits', '🍌', 'cuisine', 'Fruits rigolos', 'Funny fruit faces', 'have drawn funny faces on the bananas and oranges in the fruit bowl with a food-safe marker and are giggling', 'the elves add one last smile and hold their bellies laughing'),
  p('peche-bonbons', '🎣', 'cuisine', 'Pêche aux bonbons', 'Candy fishing', 'are fishing for wrapped sweets in a bowl with tiny fishing rods made of sticks and string', 'a rod jerks up with a sweet hanging on the line'),
  p('biscuits', '🍪', 'cuisine', 'Atelier biscuits', 'Cookie workshop', 'are decorating gingerbread cookies with icing, one elf covered in sprinkles', 'sprinkles shower down as an elf shakes the jar too hard'),
  // Living room
  p('origami', '🦢', 'salon', 'Atelier origami', 'Origami workshop', 'have folded dozens of little paper swans and boats and are lining them up in a parade', 'an elf finishes folding a swan and adds it to the parade'),
  p('canape-fort', '🏰', 'salon', 'Château de coussins', 'Cushion castle', 'have built a castle out of the sofa cushions with a little flag on top and are defending it with paper swords', 'the elves wave the paper swords and the flag flutters'),
  p('telecommande', '🎁', 'salon', 'Télécommande emballée', 'Wrapped-up remote', 'have gift-wrapped the TV remote control in shiny Christmas paper with a big bow and are presenting it proudly', 'the elves present the parcel with a bow and a flourish'),
  p('cinema', '🍿', 'salon', 'Soirée cinéma', 'Movie night', 'are having a movie night in front of a little cardboard TV, sharing a bowl of popcorn, wrapped in a sock blanket', 'the elves munch popcorn, one gasps, popcorn jumps'),
  p('chaussettes', '🧦', 'salon', 'Bataille de chaussettes', 'Sock fight', 'are having a playful pillow fight with rolled-up socks, socks flying in the air', 'rolled socks fly back and forth, the elves duck and laugh'),
  p('bonhomme', '⛄', 'salon', 'Bonhomme de neige en papier', 'Paper snowman', 'have built a snowman out of rolled-up white paper balls and are putting a tiny scarf on it', 'an elf wraps the scarf around the paper snowman and steps back proudly'),
  // Bedroom
  p('coton-neige', '☁️', 'chambre', 'Bataille de boules de coton', 'Cotton-ball snow fight', 'are having a snowball fight with fluffy cotton balls, cotton "snow" scattered around them', 'cotton balls fly softly, an elf gets one on the hat and laughs'),
  p('chaussures', '👟', 'chambre', 'Train de chaussures', 'Shoe train', 'have lined up the shoes into a little train and are riding in it, one blowing a whistle', 'the shoe train shuffles forward, the whistle elf puffs its cheeks'),
  p('dessin', '🖍️', 'chambre', 'Galerie d’art', 'Art gallery', 'have pinned up their own drawings of the family and of the elves like an art gallery and are admiring them with tiny glasses', 'the elves tilt their heads admiring the drawings, one adjusts its glasses'),
  p('cabane-draps', '🏕️', 'chambre', 'Cabane de draps', 'Blanket fort', 'have built a cosy blanket fort with fairy lights and are reading a book inside with a torch', 'the fairy lights twinkle, an elf turns the page'),
  // Bathroom
  p('dentifrice', '🪥', 'salle-de-bain', 'Concours de brossage', 'Tooth-brushing contest', 'are having a tooth-brushing contest with giant toothbrushes, foam on their faces', 'the elves brush with exaggerated moves, foam bubbles grow'),
  p('canard', '🦆', 'salle-de-bain', 'Course de canards', 'Rubber-duck race', 'are racing rubber ducks in the dry bathtub, riding on their backs like horses', 'the elves ride the ducks, bouncing, waving their hats'),
  p('mousse', '🛁', 'salle-de-bain', 'Bain moussant', 'Bubble bath', 'are relaxing in a small dish full of bubble foam like a spa, with cucumber slices on their eyes', 'bubbles rise, an elf lifts a cucumber slice to wink'),
  // Christmas tree
  p('sapin-decoration', '🎄', 'sapin', 'Décoration surprise', 'Surprise decorating', 'have hung themselves on the Christmas tree like ornaments, swinging from the branches and laughing', 'the elves swing gently on the branches, ornaments twinkle'),
  p('cadeaux-tour', '🎁', 'sapin', 'Pyramide de cadeaux', 'Gift pyramid', 'are building a pyramid with small wrapped presents under the tree, one elf on top placing a star', 'the elf on top places the star, the pyramid wobbles'),
  p('guirlande', '💡', 'sapin', 'Guirlande lumineuse', 'Fairy-light tangle', 'are hopelessly but happily tangled in a string of fairy lights near the tree, glowing', 'the lights blink in colours, the tangled elves wriggle and laugh'),
  p('boules-jonglage', '🔴', 'sapin', 'Jonglage de boules', 'Bauble juggling', 'are juggling shatterproof Christmas baubles like circus performers', 'the baubles arc through the air between the elves'),
  p('lettre-pere-noel', '✉️', 'sapin', 'Lettre au Père Noël', 'Letter to Santa', 'are writing a giant letter to Santa with a big feather quill, one elf licking the envelope', 'the quill scribbles, an elf seals the envelope with a happy face'),
  p('chocolat-chaud', '☕', 'sapin', 'Pause chocolat chaud', 'Hot-chocolate break', 'are taking a hot-chocolate break next to the tree, sipping from thimbles with whipped cream moustaches', 'the elves sip, wipe their cream moustaches and giggle'),
  p('reveil', '⏰', 'partout', 'Réveil en fanfare', 'Wake-up parade', 'are marching in a little parade with toy instruments, a drum and a tiny trumpet, to wake everybody up', 'the elves march in step, the drum taps and the trumpet toots'),
];

export const prankById = (id: string | null | undefined) => PRANKS.find((x) => x.id === id) ?? null;

/** What the parent may type: their own prank idea, short (the prompt template does the rest). */
export const MAX_PARENT_TEXT = 240;
