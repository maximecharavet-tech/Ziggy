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

export type PrankCategory = 'cuisine' | 'salon' | 'chambre' | 'salle-de-bain' | 'sapin' | 'bureau' | 'entree' | 'jouets' | 'table' | 'partout';

export type Prank = { id: string; emoji: string; cat: PrankCategory; title: L; action: string; motion: string };

export const PRANK_CATEGORIES: { id: PrankCategory; emoji: string; label: L }[] = [
  { id: 'partout', emoji: '✨', label: { fr: 'Partout', en: 'Anywhere' } },
  { id: 'cuisine', emoji: '🍪', label: { fr: 'Cuisine', en: 'Kitchen' } },
  { id: 'salon', emoji: '🛋️', label: { fr: 'Salon', en: 'Living room' } },
  { id: 'chambre', emoji: '🛏️', label: { fr: 'Chambre', en: 'Bedroom' } },
  { id: 'salle-de-bain', emoji: '🛁', label: { fr: 'Salle de bain', en: 'Bathroom' } },
  { id: 'sapin', emoji: '🎄', label: { fr: 'Sapin', en: 'Tree' } },
  { id: 'table', emoji: '🍽️', label: { fr: 'Table', en: 'Dining table' } },
  { id: 'bureau', emoji: '📎', label: { fr: 'Bureau', en: 'Desk' } },
  { id: 'entree', emoji: '🧥', label: { fr: 'Entrée', en: 'Hallway' } },
  { id: 'jouets', emoji: '🧩', label: { fr: 'Coin jeux', en: 'Play corner' } },
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
  // More anywhere
  p('chasse-tresor', '🗺️', 'partout', 'Chasse au trésor', 'Treasure hunt', 'are following a hand-drawn treasure map across the room, one elf holding a magnifying glass and another pointing at a small box of chocolate coins', 'the elves tiptoe along the map, the magnifying-glass elf gasps at the treasure box'),
  p('ombres', '🔦', 'partout', 'Théâtre d’ombres', 'Shadow puppets', 'are putting on a shadow-puppet show on the wall with a tiny torch, making a bunny and a bird with their hands', 'the shadow bunny hops across the wall, the elves bow'),
  p('ballons', '🎈', 'partout', 'Ballons joyeux', 'Happy balloons', 'are holding the strings of colourful balloons and giggling, one elf floating a few centimetres above the floor', 'the balloons bob gently, the floating elf wiggles its feet'),
  p('karaoke', '🎤', 'partout', 'Karaoké des lutins', 'Elf karaoke', 'are singing karaoke into a toy microphone made from a pen cap, one elf dancing and another holding up a handwritten lyrics sheet', 'the singing elf sways with the microphone, the others clap along'),
  // More kitchen
  p('sandwich', '🥪', 'cuisine', 'Sandwich géant', 'Giant sandwich', 'are building a giant sandwich from tiny slices of bread, cheese and lettuce on a plate, one elf adding a cherry tomato on top', 'the elf places the cherry tomato on top and the elves cheer'),
  p('soupe', '🥣', 'cuisine', 'Soupe magique', 'Magic soup', 'are stirring a big mixing bowl like a magic cauldron with a wooden spoon, tossing in colourful sprinkles', 'sprinkles swirl in the bowl, an elf tastes and goes wide-eyed'),
  p('collier-fruits', '🍇', 'cuisine', 'Colliers de fruits', 'Fruit necklaces', 'are threading blueberries and grapes onto string to make fruit necklaces and are wearing them proudly', 'an elf lifts its necklace and spins, the others admire theirs'),
  // More living room
  p('puzzle', '🧩', 'salon', 'Grand puzzle', 'Big jigsaw', 'are working together on a huge jigsaw puzzle on the coffee table, one elf carrying a single piece on its head', 'the elf with the piece on its head wobbles over and clicks it into place'),
  p('yoga', '🧘', 'salon', 'Yoga des lutins', 'Elf yoga', 'are doing yoga poses together on a tiny mat made of a folded dish cloth, one elf wobbling in tree pose', 'the elves breathe in and stretch, the wobbling elf giggles and keeps its balance'),
  p('theatre', '🎭', 'salon', 'Théâtre de chaussettes', 'Sock-puppet theatre', 'are performing a puppet show behind the sofa armrest with sock puppets and a little curtain made of a scarf', 'the sock puppets bow and wave from behind the curtain'),
  p('plante', '🪴', 'salon', 'Soins de la plante', 'Plant care', 'are taking care of a houseplant, watering it with a tiny spoon and polishing the leaves with cotton balls', 'an elf pours a spoonful of water, another polishes a leaf until it shines'),
  // More bedroom
  p('lecture-doudous', '📖', 'chambre', 'Histoire pour les doudous', 'Story for the cuddly toys', 'are lying on the pillows reading a bedtime story to the cuddly toys, one elf holding a tiny book upside down', 'the elf turns a page, the toys lean in, one yawns'),
  p('ciel-etoile', '⭐', 'chambre', 'Ciel étoilé en papier', 'Paper starry sky', 'have hung paper stars and a paper moon from threads over the bed to make a little starry night, and are admiring it', 'the paper stars twirl slowly on their threads, the elves gaze up'),
  p('defile-mode', '👗', 'chambre', 'Défilé de mode', 'Fashion show', 'are having a fashion show on a runway made of a ruler, wearing doll clothes and tiny hats and striking poses', 'an elf struts along the ruler and twirls, the others clap'),
  p('piscine-oreillers', '🛌', 'chambre', 'Piscine d’oreillers', 'Pillow pool', 'have made a pile of soft pillows on the floor and are rolling around in it laughing', 'the elves tumble softly in the pillows and pop up with messy hats'),
  // More bathroom
  p('pantoufles-bateaux', '🥿', 'salle-de-bain', 'Bateaux en pantoufles', 'Slipper boats', 'are sailing across the bathmat in fluffy slippers like little boats, using spoons as oars', 'the elves row with their spoons, the slippers glide forward'),
  p('grimaces-miroir', '🪞', 'salle-de-bain', 'Grimaces au miroir', 'Mirror faces', 'are pulling funny faces in the bathroom mirror, noses pressed close, their reflections making faces back', 'the elves cross their eyes and stick out their tongues, then burst out laughing'),
  p('spa', '🧖', 'salle-de-bain', 'Journée spa', 'Spa day', 'are having a spa day with towel turbans and cotton-pad face masks, one elf relaxing with eyes closed', 'the relaxing elf sighs happily, another peeks from under its mask'),
  // More tree
  p('flocons-papier', '❄️', 'sapin', 'Flocons de papier', 'Paper snowflakes', 'are hanging paper snowflakes on the tree branches with tiny clothes pegs, standing on a wrapped gift box', 'the paper snowflakes turn gently, an elf steps back to admire them'),
  p('chorale', '🎶', 'sapin', 'Chorale de Noël', 'Christmas choir', 'are standing in a row like a choir singing Christmas carols from tiny songbooks, bells jingling on their hats', 'the elves sway in time, their hat bells jingle'),
  p('calendrier-avent', '🗓️', 'sapin', 'Calendrier de l’Avent', 'Advent calendar', 'are opening the little doors of an advent calendar, one elf peeking inside and another holding up a tiny chocolate', 'an elf opens a door and gasps, the other holds up the chocolate'),
  // Dining table
  p('serviettes', '🪁', 'table', 'Serviettes en chapeaux', 'Napkin hats', 'have folded the napkins into little hats and boats and set the table elf-style with tiny plates', 'the elves place the last napkin hat and tip theirs to each other'),
  p('tapis-rouge', '🔴', 'table', 'Tapis rouge', 'Red carpet', 'are marching along the table runner like a red carpet, bowing to the salt and pepper shakers as if they were celebrities', 'the elves strut along the runner and wave to the shakers'),
  p('course-cuilleres', '🥄', 'table', 'Course de cuillères', 'Spoon race', 'are in a spoon race, each balancing a marshmallow on a spoon, concentrating hard', 'the elves tiptoe forward with their spoons, a marshmallow wobbles but stays'),
  p('gobelets-tambours', '🥁', 'table', 'Orchestre de gobelets', 'Cup orchestra', 'are drumming on upside-down plastic cups with tiny wooden spoons like a band', 'the elves drum on the cups in rhythm, nodding their heads'),
  p('tour-sucre', '🍬', 'table', 'Tour de sucre', 'Sugar-cube tower', 'are carefully building a tower of sugar cubes, one elf holding its breath while placing the top cube', 'the elf places the last cube, everyone freezes, then cheers'),
  p('menu-lutins', '🧾', 'table', 'Restaurant des lutins', 'Elf restaurant', 'have written a funny menu on a card and are playing restaurant, one elf as waiter with a napkin over its arm bringing a tiny tray', 'the waiter elf bows and sets the tiny tray down with a flourish'),
  // Desk
  p('trombones', '📎', 'bureau', 'Chaîne de trombones', 'Paper-clip chain', 'have linked paper clips into a long chain and are carrying it like a rope, marching in a line', 'the elves march in step holding the shiny chain'),
  p('patinoire-gommes', '🧽', 'bureau', 'Patinoire de gommes', 'Eraser rink', 'are sliding on erasers like ice skates across a smooth desk, arms out for balance', 'the elves glide on the erasers and wobble happily'),
  p('globe', '🌍', 'bureau', 'Tour du monde', 'Around the world', 'are spinning a small globe and pointing at countries, one elf wearing a tiny pilot cap', 'the globe spins, the pilot elf points to where it stops'),
  p('carte-voeux', '💌', 'bureau', 'Grande carte de vœux', 'Giant greeting card', 'are drawing a huge greeting card for the family with felt-tip pens, decorating the border with hearts', 'the elves colour in hearts, one holds the card up proudly'),
  p('calculatrice', '🔢', 'bureau', 'Les lutins comptent', 'Elves counting', 'are pressing the buttons of a calculator and cheering at the numbers on its screen, one elf holding a tiny notepad', 'an elf presses a button and all of them gasp and cheer at the screen'),
  p('orchestre-stylos', '🖊️', 'bureau', 'Orchestre de crayons', 'Pencil band', 'are drumming on a pencil pot and pens like a band, with a sticky note as a tiny banner', 'the elves drum along, heads bobbing in rhythm'),
  // Hallway
  p('echarpes', '🧣', 'entree', 'Défilé d’écharpes', 'Scarf parade', 'are trying on scarves and woolly hats from a basket in the hallway, parading up and down like models', 'the elves swirl their scarves and strike a pose'),
  p('bottes', '🥾', 'entree', 'Lutins dans les bottes', 'Elves in boots', 'are standing in a row inside big rain boots with only their heads and hats sticking out', 'the elves wiggle inside the boots and pop their hats up and down'),
  p('tapis-volant', '🧹', 'entree', 'Tapis volant', 'Magic doormat', 'are riding the doormat like a magic carpet gliding just above the floor, holding on to its tassels', 'the doormat glides forward, the elves lean into the wind'),
  p('parapluie', '☂️', 'entree', 'Pluie de papier', 'Paper rain', 'are sheltering together under an open umbrella while paper raindrops hang from threads above them', 'the paper drops sway, the elves hold the umbrella up and giggle'),
  p('courrier', '📬', 'entree', 'Facteur lutin', 'Elf postman', 'are sorting letters and postcards into little piles and stamping them with a rubber stamp, one elf wearing a postman cap', 'the postman elf stamps a postcard and holds it up'),
  // Play corner
  p('briques', '🧱', 'jouets', 'Château de briques', 'Brick castle', 'are building a tiny castle out of toy building bricks, one elf placing the last brick on top of a tower', 'the elf adds the last brick and all of them throw up their arms'),
  p('train-bois', '🚂', 'jouets', 'Train en bois', 'Wooden train', 'are riding on a wooden toy train round its track, one elf pulling the whistle cord', 'the wooden train rolls on, the whistle elf puffs out its cheeks'),
  p('dinette', '🫖', 'jouets', 'Goûter de poupées', 'Toy tea party', 'are having a tea party with the toy tea set, little cups raised and little fingers out', 'the elves clink their tiny cups and sip politely'),
  p('maison-poupee', '🏠', 'jouets', 'Maison de poupée', 'Dolls’ house', 'are living in the dolls’ house, one waving from the tiny doorway, another sweeping the floor with a toy broom', 'the elf in the doorway waves, the other sweeps happily'),
  p('cirque', '🎪', 'jouets', 'Cirque des peluches', 'Plush circus', 'are running a circus with toy animals, one elf as ringmaster in a tiny top hat and a plush lion sitting politely', 'the ringmaster elf bows and points to the lion, who tilts its head'),
  p('lavage-voiture', '🚗', 'jouets', 'Lavage de voiture', 'Toy-car wash', 'are washing a toy car with tiny sponges and soap bubbles, one elf polishing the shiny bonnet', 'the elves scrub the toy car and bubbles pop around them'),
];

export const prankById = (id: string | null | undefined) => PRANKS.find((x) => x.id === id) ?? null;

/** What the parent may type: their own prank idea, short (the prompt template does the rest). */
export const MAX_PARENT_TEXT = 240;
