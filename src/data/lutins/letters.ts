/**
 * The elves' letters: the arrival letter (first morning), a short morning note
 * for every prank of the catalogue (src/data/lutins/pranks.ts) plus one for the
 * parents' own ideas, and the departure letter (Christmas morning).
 *
 * Always warm and funny: no behaviour conditions, no "be good or else", no
 * guilt, the elves are never sad (even when they leave, they are happy and
 * coming back). The notes say "we": the elves who actually did the prank sign
 * them (the entry's elves), so a note never names an elf who wasn't there.
 */
import type { L } from '@/lib/i18n-text';

export type LetterKind = 'arrival' | 'morning' | 'departure';

/** One short note per prank id. Tested: every prank has one, in FR and EN. */
export const MORNING_NOTES: Record<string, L> = {
  'papier-toilette': {
    fr: 'On voulait décorer pour Noël… mais on n’a trouvé que du papier toilette ! Joli, non ?',
    en: 'We wanted to decorate for Christmas… but all we found was toilet paper! Pretty, right?',
  },
  'cache-cache': {
    fr: 'On a joué à cache-cache toute la nuit. Chut… on est peut-être encore cachés !',
    en: 'We played hide-and-seek all night. Shh… we might still be hiding!',
  },
  'course-voitures': {
    fr: 'Grande course de nuit ! Le gagnant a eu droit à une miette de biscuit. Tu veux ta revanche ?',
    en: 'Big night-time race! The winner got a cookie crumb. Fancy a rematch?',
  },
  tente: {
    fr: 'Cette nuit, on a fait du camping chez toi. Les meilleures histoires se racontent sous la tente !',
    en: 'Last night we went camping at your place. The best stories are told in a tent!',
  },
  'post-it': {
    fr: 'On avait plein de petits papiers de couleur… alors on t’a fait un GRAND sourire !',
    en: 'We had loads of little sticky notes… so we made you a BIG smile!',
  },
  bulles: {
    fr: 'Pop ! Pop ! Pop ! Fête des bulles ! On en a attrapé cent douze… ou peut-être trois.',
    en: 'Pop! Pop! Pop! Bubble party! We caught a hundred and twelve… or maybe three.',
  },
  'photo-lutins': {
    fr: 'Ouistiti ! On voulait une photo souvenir de notre visite. Tu nous trouves beaux ?',
    en: 'Say cheese! We wanted a souvenir photo of our visit. Don’t we look great?',
  },
  dominos: {
    fr: 'Clac, clac, clac ! Toute la nuit pour les aligner, et trois secondes pour tout faire tomber !',
    en: 'Click, clack, click! All night to line them up, and three seconds to knock them all down!',
  },
  peluches: {
    fr: 'Grande réunion avec tes doudous : on a voté pour plus de câlins. Adopté par tout le monde !',
    en: 'Big meeting with your cuddly toys: we voted for more hugs. Everybody said yes!',
  },
  livres: {
    fr: 'Tes livres font des toboggans géniaux ! On a glissé jusqu’au matin. Wiiiii !',
    en: 'Your books make brilliant slides! We slid all the way to morning. Wheee!',
  },
  'farine-anges': {
    fr: 'Il a neigé dans la cuisine ! On a fait des anges… un tout petit peu farinés.',
    en: 'It snowed in the kitchen! We made angels… just a little bit floury.',
  },
  guimauves: {
    fr: 'Rien de tel qu’un bain de guimauves après une longue nuit de farces. Tout doux, tout moelleux !',
    en: 'Nothing beats a marshmallow bath after a long night of pranks. So soft and squishy!',
  },
  cereales: {
    fr: 'On a plongé dans tes céréales. Ça fait une super piscine… qui croustille !',
    en: 'We dived into your cereal. It makes a super pool… a crunchy one!',
  },
  pancakes: {
    fr: 'Une tour de pancakes plus haute que nous ! La fraise tout en haut, c’est la touche du chef.',
    en: 'A pancake tower taller than us! The strawberry on top is the chef’s special touch.',
  },
  'visages-fruits': {
    fr: 'Tes fruits avaient l’air de s’ennuyer, alors on leur a dessiné un sourire !',
    en: 'Your fruit looked a bit bored, so we drew them some smiles!',
  },
  'peche-bonbons': {
    fr: 'Partie de pêche ! Pas un seul poisson… mais des bonbons, c’est encore mieux.',
    en: 'Fishing trip! Not a single fish… but sweets are even better.',
  },
  biscuits: {
    fr: 'Atelier biscuits ! On en a décoré plein… et goûté un tout petit bout. Juste pour vérifier.',
    en: 'Cookie workshop! We decorated loads… and tasted a teeny bit. Just to check.',
  },
  origami: {
    fr: 'On plie, on replie… Voici la grande parade des cygnes et des bateaux en papier !',
    en: 'Fold, fold again… Here comes the grand parade of paper swans and boats!',
  },
  'canape-fort': {
    fr: 'Ce château de coussins est à nous ! Le mot de passe pour entrer : « chaussette ».',
    en: 'This cushion castle is ours! The password to get in: “sock”.',
  },
  telecommande: {
    fr: 'On t’a fait un cadeau : la télécommande ! Bon… on l’a juste emballée.',
    en: 'We got you a present: the remote! Well… we just wrapped it up.',
  },
  cinema: {
    fr: 'Soirée cinéma ! On a partagé le pop-corn… enfin, presque tout.',
    en: 'Movie night! We shared the popcorn… well, almost all of it.',
  },
  chaussettes: {
    fr: 'Bataille de chaussettes ! Personne n’a gagné, et tout le monde a rigolé.',
    en: 'Sock fight! Nobody won, and everybody laughed.',
  },
  bonhomme: {
    fr: 'Pas de neige dehors ? Pas grave : voici un bonhomme de neige en papier. Lui, il ne fond jamais !',
    en: 'No snow outside? No problem: here’s a paper snowman. This one never melts!',
  },
  'coton-neige': {
    fr: 'Bataille de boules de neige… en coton ! Toutes douces, et pas froides du tout.',
    en: 'Snowball fight… with cotton balls! All soft, and not cold at all.',
  },
  chaussures: {
    fr: 'Tchou-tchou ! Le train des chaussures va partir. Tout le monde à bord !',
    en: 'Choo-choo! The shoe train is leaving. All aboard!',
  },
  dessin: {
    fr: 'On a ouvert une galerie d’art ! L’entrée est gratuite et les artistes sont très mignons.',
    en: 'We opened an art gallery! Entry is free and the artists are very cute.',
  },
  'cabane-draps': {
    fr: 'On a construit une cabane pour lire avec une lampe. Il reste de la place pour toi !',
    en: 'We built a fort for reading by torchlight. There’s room for you too!',
  },
  dentifrice: {
    fr: 'Concours de brossage de dents ! Regarde nos sourires : ils brillent comme des étoiles.',
    en: 'Tooth-brushing contest! Look at our smiles: they shine like stars.',
  },
  canard: {
    fr: 'Course de canards ! Coin-coin, à vos marques… partez !',
    en: 'Rubber-duck race! Quack-quack, ready, steady… go!',
  },
  mousse: {
    fr: 'Petite pause au spa des lutins : des bulles, du concombre et beaucoup de détente. Ahhh !',
    en: 'A little break at the elves’ spa: bubbles, cucumber and lots of relaxing. Ahhh!',
  },
  'sapin-decoration': {
    fr: 'Surprise ! Cette année, les nouvelles décorations du sapin… c’est nous !',
    en: 'Surprise! This year’s new tree decorations… are us!',
  },
  'cadeaux-tour': {
    fr: 'On a construit une pyramide de cadeaux. Et tout en haut, la plus belle des étoiles !',
    en: 'We built a gift pyramid. And right at the top, the most beautiful star!',
  },
  guirlande: {
    fr: 'On voulait juste vérifier que la guirlande marchait… et on s’est un peu emmêlés !',
    en: 'We only wanted to check the fairy lights worked… and we got a little tangled!',
  },
  'boules-jonglage': {
    fr: 'Mesdames et messieurs, le grand cirque des lutins ! Hop, hop, hop, les boules s’envolent !',
    en: 'Ladies and gentlemen, the great elf circus! Hop, hop, hop, the baubles fly!',
  },
  'lettre-pere-noel': {
    fr: 'On a écrit une grande lettre au Père Noël pour lui raconter nos farces chez toi. Il va bien rire !',
    en: 'We wrote a big letter to Santa all about our pranks at your place. He’ll have a good laugh!',
  },
  'chocolat-chaud': {
    fr: 'Pause chocolat chaud ! Regarde nos moustaches de chantilly : très chic, non ?',
    en: 'Hot-chocolate break! Look at our whipped-cream moustaches: very fancy, right?',
  },
  reveil: {
    fr: 'Pouet ! Boum ! Debout, c’est le matin ! Notre fanfare te souhaite une journée magique.',
    en: 'Toot! Boom! Rise and shine! Our little band wishes you a magical day.',
  },
  'echarpe-geante': {
    fr: 'On s’est tous glissés dans une écharpe géante. Une chenille de lutins, ça tient chaud !',
    en: 'We all squeezed into one giant scarf. A caterpillar of elves is super cosy!',
  },
  'theatre-ombres': {
    fr: 'Cette nuit, spectacle d’ombres sur ton mur ! Tu as reconnu le lapin ? C’était un dragon.',
    en: 'Shadow show on your wall last night! Did you spot the rabbit? It was a dragon.',
  },
  'chasse-tresor': {
    fr: 'On a suivi une carte au trésor toute la nuit. Le trésor est tout près… bonne chasse !',
    en: 'We followed a treasure map all night. The treasure is very close… happy hunting!',
  },
  ballons: {
    fr: 'Règle du jeu : le ballon ne doit jamais toucher le sol. On a tenu jusqu’à… presque dix !',
    en: 'Rule of the game: the balloon must never touch the floor. We lasted until… almost ten!',
  },
  'yoga-lutins': {
    fr: 'Cette nuit, yoga des lutins ! Notre posture préférée : le flocon qui s’étire.',
    en: 'Elf yoga last night! Our favourite pose: the stretching snowflake.',
  },
  'bateau-fruit': {
    fr: 'Ohé ! On a navigué sur un bateau d’orange. Ça sentait bon, et personne n’est tombé à l’eau.',
    en: 'Ahoy! We sailed an orange-peel boat. It smelled lovely, and nobody fell overboard.',
  },
  'colliers-pates': {
    fr: 'On t’a fabriqué des colliers de pâtes. Très chic… mais pas à manger !',
    en: 'We made you pasta necklaces. Very fancy… but not for eating!',
  },
  'petits-chefs': {
    fr: 'Les petits chefs ont cuisiné toute la nuit ! Recette secrète : un gâteau imaginaire.',
    en: 'The little chefs cooked all night! Secret recipe: a pretend cake.',
  },
  'pique-nique-table': {
    fr: 'Pique-nique de minuit sur la table ! Une miette chacun, c’était un vrai festin.',
    en: 'Midnight picnic on the table! One crumb each, it was a real feast.',
  },
  'course-cuilleres': {
    fr: 'Grande course de cuillères ! La guimauve est tombée trois fois. On rejoue ce soir ?',
    en: 'Big spoon race! The marshmallow fell off three times. Rematch tonight?',
  },
  chorale: {
    fr: 'La chorale des lutins a chanté pour toi cette nuit. Tout bas, pour ne pas te réveiller !',
    en: 'The elf choir sang for you last night. Very softly, so we didn’t wake you!',
  },
  'trampoline-coussins': {
    fr: 'Boing ! Boing ! Les coussins font des trampolines géniaux. On a presque touché la lune.',
    en: 'Boing! Boing! Cushions make great trampolines. We nearly touched the moon.',
  },
  'jeu-societe': {
    fr: 'Soirée jeux de société ! On a lancé le dé si fort qu’on le cherche encore.',
    en: 'Board game night! We rolled the dice so hard we’re still looking for it.',
  },
  puzzle: {
    fr: 'On a fait un puzzle géant. Il manque une pièce… à toi de poser la dernière !',
    en: 'We did a giant puzzle. One piece is missing… you get to place the last one!',
  },
  'jungle-plantes': {
    fr: 'Expédition dans la jungle des plantes ! On a vu une feuille géante. Brrr, quelle aventure.',
    en: 'Expedition into the houseplant jungle! We saw a giant leaf. Phew, what an adventure.',
  },
  'pyjama-party': {
    fr: 'Soirée pyjama sur ton lit ! On a gardé un peu de pop-corn… enfin, une miette.',
    en: 'Pyjama party on your bed! We saved you some popcorn… well, one crumb.',
  },
  'dodo-doudou': {
    fr: 'On a fait un gros dodo dans une pantoufle. Super confortable, on te la conseille !',
    en: 'We had a big snooze in a slipper. Super comfy, we recommend it!',
  },
  'etoiles-papier': {
    fr: 'On t’a fait un ciel plein d’étoiles en papier. Fais un vœu en les regardant !',
    en: 'We made you a sky full of paper stars. Make a wish when you look at them!',
  },
  'collection-boutons': {
    fr: 'On a rangé tous les boutons en arc-en-ciel. On a compté jusqu’à… beaucoup !',
    en: 'We sorted all the buttons into a rainbow. We counted up to… loads!',
  },
  'navire-oreiller': {
    fr: 'À l’abordage ! Ton oreiller est devenu un bateau pirate. Le trésor : un câlin.',
    en: 'Ahoy, pirates! Your pillow became a pirate ship. The treasure: a cuddle.',
  },
  'grimaces-miroir': {
    fr: 'Concours de grimaces devant le miroir ! On a tous gagné. Tu nous montres la tienne ?',
    en: 'Funny-face contest in the mirror! We all won. Will you show us yours?',
  },
  'turbans-serviette': {
    fr: 'Spa des lutins cette nuit ! Turban, concombre et grosse détente. Ahhh…',
    en: 'Elf spa night! Turbans, cucumber and lots of relaxing. Ahhh…',
  },
  'regate-baignoire': {
    fr: 'Régate dans la baignoire (toute sèche) ! Le vainqueur a eu une bulle imaginaire.',
    en: 'Regatta in the (dry) bathtub! The winner got a pretend bubble.',
  },
  'traineau-carton': {
    fr: 'On a essayé notre traîneau en carton. Le renne en peluche était très rapide !',
    en: 'We tried out our cardboard sleigh. The cuddly reindeer was very fast!',
  },
  'chorale-noel': {
    fr: 'On a chanté des chants de Noël autour du sapin. Les guirlandes clignotaient en rythme !',
    en: 'We sang carols around the tree. The fairy lights twinkled in time!',
  },
  'cartes-voeux': {
    fr: 'On a fabriqué des cartes de vœux pleines de flocons. Il y en a peut-être une pour toi !',
    en: 'We made Christmas cards full of snowflakes. There might be one for you!',
  },
  'biscuits-pere-noel': {
    fr: 'On a préparé des biscuits pour le Père Noël. On en a goûté un tout petit bout… pour vérifier !',
    en: 'We set out cookies for Santa. We tasted a teeny bit… just to check!',
  },
  'manteaux-cachette': {
    fr: 'Coucou ! On s’est cachés dans les poches des manteaux. C’est tout doux là-dedans.',
    en: 'Peekaboo! We hid in the coat pockets. It’s so soft in there.',
  },
  'parapluie-bateau': {
    fr: 'Un parapluie à l’envers, ça fait un super bateau ! On a ramé toute la nuit.',
    en: 'An upside-down umbrella makes a great boat! We paddled all night.',
  },
  'concours-bonnets': {
    fr: 'Concours du plus grand bonnet ! On n’y voyait plus rien, on s’est cognés en rigolant.',
    en: 'Biggest-hat contest! We couldn’t see a thing and bumped into each other, giggling.',
  },
  'comite-accueil': {
    fr: 'Bienvenue ! On t’a préparé un comité d’accueil avec des petits drapeaux. Bonne journée !',
    en: 'Welcome! We set up a welcome committee with little flags. Have a great day!',
  },
  'defile-mode': {
    fr: 'Grand défilé de mode cette nuit ! Les gants font de très jolies capes.',
    en: 'Big fashion show last night! Gloves make very fine capes.',
  },
  'spectacle-gants': {
    fr: 'Spectacle de marionnettes en gants ! Le public était ravi : c’était nous.',
    en: 'Glove puppet show! The audience loved it: it was us.',
  },
  'bottes-fleurs': {
    fr: 'On a planté un jardin dans tes bottes ! Ne t’inquiète pas, les fleurs sont en papier.',
    en: 'We planted a garden in your boots! Don’t worry, the flowers are paper.',
  },
  'chaine-trombones': {
    fr: 'On a fait une chaîne de trombones longue comme… très très longue !',
    en: 'We made a paperclip chain as long as… really, really long!',
  },
  'patinoire-gommes': {
    fr: 'Patinoire sur le bureau ! Avec des gommes comme patins, on a fait des pirouettes.',
    en: 'Ice rink on the desk! With erasers as skates, we did twirls.',
  },
  'tipi-crayons': {
    fr: 'On a construit un tipi en crayons de couleur. On y a raconté des histoires !',
    en: 'We built a tipi out of coloured pencils. We told stories inside!',
  },
  'avions-papier': {
    fr: 'L’aéroport des lutins était ouvert cette nuit ! Tous les avions en papier sont bien arrivés.',
    en: 'The elf airport was open last night! Every paper plane landed safely.',
  },
  'calendrier-avent': {
    fr: 'On a fabriqué un calendrier de l’Avent géant ! Une petite porte à ouvrir chaque jour.',
    en: 'We made a giant Advent calendar! One little door to open every day.',
  },
  'tour-du-monde': {
    fr: 'On a fait le tour du monde sur ton globe cette nuit ! Où veux-tu aller, toi ?',
    en: 'We travelled round the world on your globe last night! Where would you like to go?',
  },
  'bascule-regle': {
    fr: 'Une règle, un crayon, et hop : une balançoire ! Haut, bas, haut, bas… quel fou rire.',
    en: 'A ruler, a pencil, and hop: a seesaw! Up, down, up, down… what giggles.',
  },
  'chateau-briques': {
    fr: 'On a construit un château fort en briques ! Le pont-levis s’ouvre pour toi.',
    en: 'We built a brick castle! The drawbridge opens for you.',
  },
  'gare-train': {
    fr: 'Tchou tchou ! La gare des lutins a ouvert. Prochain départ : ce soir.',
    en: 'Choo choo! The elf station is open. Next departure: tonight.',
  },
  dinette: {
    fr: 'Thé des lutins avec le petit doigt levé ! Ta peluche était notre invitée d’honneur.',
    en: 'Elf tea party, little fingers up! Your cuddly toy was our guest of honour.',
  },
  'piscine-balles': {
    fr: 'Plouf ! On a nagé dans la piscine à balles. On a perdu un bonnet quelque part dedans !',
    en: 'Splash! We swam in the ball pool. We lost a hat somewhere in there!',
  },
  'tour-cubes': {
    fr: 'On a construit une tour de cubes très haute. Elle tient encore ? Chut, souffle doucement !',
    en: 'We built a very tall block tower. Is it still standing? Shh, breathe gently!',
  },
  'bal-poupees': {
    fr: 'Grand bal cette nuit ! On a dansé la valse avec tes poupées. Un, deux, trois…',
    en: 'Grand ball last night! We waltzed with your dolls. One, two, three…',
  },
  'quilles-peluches': {
    fr: 'Partie de quilles avec tes peluches ! Strike ! Elles ont adoré rouler par terre.',
    en: 'Skittles with your cuddly toys! Strike! They loved tumbling over.',
  },
  'cirque-peluches': {
    fr: 'Mesdames et messieurs, le cirque des lutins ! Ta peluche a sauté dans le cerceau. Bravo !',
    en: 'Ladies and gentlemen, the elf circus! Your cuddly toy jumped through the hoop. Bravo!',
  },
  jardiniers: {
    fr: 'Les lutins jardiniers ont planté des fleurs en papier. Elles ne fanent jamais !',
    en: 'The gardener elves planted paper flowers. They never wilt!',
  },
  coccinelle: {
    fr: 'Balade à dos de coccinelle cette nuit ! Elle est en bois, mais elle va très vite.',
    en: 'A ladybird ride last night! She’s made of wood, but she’s very fast.',
  },
  'cabane-pot': {
    fr: 'On a transformé un pot de fleurs en petite maison. Tu viens nous rendre visite ?',
    en: 'We turned a flowerpot into a little house. Will you come and visit?',
  },
  'feuilles-bateaux': {
    fr: 'Régate de feuilles ! Nos casques en glands nous allaient à merveille.',
    en: 'Leaf-boat regatta! Our acorn-cap helmets looked marvellous.',
  },
  'cailloux-visage': {
    fr: 'On t’a fait un grand sourire en cailloux. Il te dit bonjour !',
    en: 'We made you a big pebble smile. It says good morning!',
  },
  'lanterne-jardin': {
    fr: 'Veillée autour de la lanterne du jardin. On s’est raconté nos plus belles histoires.',
    en: 'Story time around the garden lantern. We told our best tales.',
  },
  epouvantail: {
    fr: 'On s’est fait un nouveau copain épouvantail. Il est très gentil et adore les câlins !',
    en: 'We made a new scarecrow friend. He’s very friendly and loves cuddles!',
  },
  'labyrinthe-livres': {
    fr: 'On a construit un labyrinthe de livres. On a mis longtemps à trouver la sortie !',
    en: 'We built a maze of books. It took us ages to find the way out!',
  },
  'tente-livre': {
    fr: 'On a dormi sous un livre ouvert, comme sous une tente. Une histoire, ça protège bien !',
    en: 'We slept under an open book like a tent. A story makes a great shelter!',
  },
  'pont-livres': {
    fr: 'On a construit un pont en livres. Ta peluche l’a traversé sans peur !',
    en: 'We built a bridge of books. Your cuddly toy crossed it bravely!',
  },
  bibliothecaires: {
    fr: 'Les lutins bibliothécaires ont rangé les livres par couleur. Chut, c’est très sérieux !',
    en: 'The librarian elves sorted the books by colour. Shh, it’s very serious!',
  },
  'livre-popup': {
    fr: 'Cette nuit, on est entrés dans un livre animé ! Tu nous as vus entre les pages ?',
    en: 'Last night we stepped into a pop-up book! Did you spot us between the pages?',
  },
  chut: {
    fr: 'Chuuut ! On est passés sur la pointe des pieds… mais on a un peu rigolé.',
    en: 'Shhh! We tiptoed past… but we giggled a little.',
  },
  'arc-en-ciel-livres': {
    fr: 'On a fait un arc-en-ciel avec tes livres. Lequel est ta couleur préférée ?',
    en: 'We made a rainbow out of your books. Which is your favourite colour?',
  },
  'radeau-linge': {
    fr: 'On a navigué sur une mer de serviettes, dans un panier-radeau. Quelle traversée !',
    en: 'We sailed a sea of towels on a laundry-basket raft. What a voyage!',
  },
  'marionnettes-chaussettes': {
    fr: 'Spectacle de chaussettes ! Elles ont chanté, dansé… et l’une a perdu sa jumelle.',
    en: 'Sock puppet show! They sang, they danced… and one lost its twin.',
  },
  'montagne-serviettes': {
    fr: 'On a glissé sur la montagne de serviettes ! Toute douce, on a recommencé cent fois.',
    en: 'We slid down the towel mountain! So soft, we did it a hundred times.',
  },
  pliage: {
    fr: 'Grand concours de pliage ! Nos carrés étaient presque parfaits… presque.',
    en: 'Big folding contest! Our squares were nearly perfect… nearly.',
  },
  'guirlande-chaussettes': {
    fr: 'Une guirlande de chaussettes dépareillées, c’est très festif, non ?',
    en: 'A bunting of odd socks is very festive, don’t you think?',
  },
  'enquete-chaussette': {
    fr: 'Enquête de la nuit : où est passée la chaussette ? On a un indice… à toi de trouver !',
    en: 'Tonight’s case: where did the sock go? We have a clue… your turn to find it!',
  },
};

/** The note for the parents' own prank ideas (and any unknown id). */
export const GENERIC_NOTE: L = {
  fr: 'Cette nuit, on a encore fait des nôtres ! On espère que notre farce t’a bien fait rire.',
  en: 'Last night we got up to mischief again! We hope our prank made you laugh.',
};

export function morningNote(prankId: string | null | undefined): L {
  return (prankId && MORNING_NOTES[prankId]) || GENERIC_NOTE;
}

export type Letter = {
  kind: LetterKind;
  title: string;
  greeting: string;
  paragraphs: string[];
  signoff: string;
  /** The elves who sign it (bible ids). */
  elves: string[];
};

const ALL = ['pepin', 'grelotte', 'noisette'];

const TEXT = {
  hello: { fr: 'Coucou {name} !', en: 'Hello {name}!' },
  helloAnon: { fr: 'Coucou !', en: 'Hello!' },
  morningTitle: { fr: 'Le mot des lutins', en: 'A note from the elves' },
  morningSign: { fr: 'Tes lutins farceurs', en: 'Your prankster elves' },
  arrivalTitle: { fr: 'Nous sommes arrivés du Pôle Nord !', en: 'We’ve arrived from the North Pole!' },
  arrival: [
    {
      fr: 'Après un long voyage en traîneau, à travers les nuages et les flocons, nous voilà enfin chez toi !',
      en: 'After a long sleigh ride through the clouds and the snowflakes, here we are at your place at last!',
    },
    {
      fr: 'Nous sommes Pépin, Grelotte et Noisette, les lutins farceurs de Ziggy. Jusqu’à Noël, chaque nuit, pendant que tu dors, nous préparerons une petite farce rien que pour toi.',
      en: 'We’re Pip, Jingle and Hazel, Ziggy’s prankster elves. Every night until Christmas, while you sleep, we’ll get up to a little prank just for you.',
    },
    {
      fr: 'Chaque matin, ouvre le journal des lutins pour découvrir ce que nous avons fait. Et regarde bien : nous adorons nous cacher !',
      en: 'Every morning, open the elves’ journal to see what we’ve been up to. And look closely: we love to hide!',
    },
    {
      fr: 'Nous sommes tellement contents d’être là. Ça va être le plus joyeux des mois de décembre !',
      en: 'We’re so happy to be here. This is going to be the jolliest December ever!',
    },
  ],
  arrivalSign: { fr: 'Avec des paillettes plein les poches,', en: 'With pockets full of glitter,' },
  departureTitle: { fr: 'À l’année prochaine !', en: 'See you next year!' },
  departure: [
    {
      fr: 'C’est le grand jour : le Père Noël a besoin de nous au Pôle Nord pour sa grande tournée.',
      en: 'Today is the big day: Santa needs us back at the North Pole for his big trip.',
    },
    {
      fr: 'Merci pour ce mois de décembre plein de rires. On a adoré chaque nuit chez toi : les cachettes, les farces, et les matins tout pétillants.',
      en: 'Thank you for a December full of laughter. We loved every night at your place: the hiding spots, the pranks, and the sparkly mornings.',
    },
    {
      fr: 'On emporte tous ces souvenirs dans notre sac à paillettes. Ils vont nous tenir chaud tout l’hiver !',
      en: 'We’re packing all these memories into our glitter bag. They’ll keep us warm all winter!',
    },
    {
      fr: 'Joyeux Noël ! On reviendra l’année prochaine, promis juré.',
      en: 'Merry Christmas! We’ll be back next year, cross our hearts.',
    },
  ],
  departureSign: { fr: 'Gros bisous givrés,', en: 'Big frosty hugs,' },
} satisfies Record<string, L | L[]>;

/** French typography: a non-breaking space before ! ? : ; » and after « (no lonely "!" on a new line). */
const frSpaces = (x: string) => x.replace(/ ([!?:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
const t = (l: L, locale: string) => (locale === 'fr' ? frSpaces(l.fr) : l.en);

export function greeting(name: string | null | undefined, locale: string): string {
  const n = name?.trim();
  return n ? t(TEXT.hello, locale).replace('{name}', n) : t(TEXT.helloAnon, locale);
}

/** A letter ready to show, print and read aloud. */
export function buildLetter(kind: LetterKind, locale: string, opts: { name?: string | null; prankId?: string | null; elves?: string[] } = {}): Letter {
  const elves = opts.elves?.length ? ALL.filter((id) => opts.elves!.includes(id)) : ALL;
  const g = greeting(opts.name, locale);
  if (kind === 'morning') {
    return { kind, title: t(TEXT.morningTitle, locale), greeting: g, paragraphs: [t(morningNote(opts.prankId), locale)], signoff: t(TEXT.morningSign, locale), elves };
  }
  if (kind === 'arrival') {
    return { kind, title: t(TEXT.arrivalTitle, locale), greeting: g, paragraphs: TEXT.arrival.map((p) => t(p, locale)), signoff: t(TEXT.arrivalSign, locale), elves: ALL };
  }
  return { kind, title: t(TEXT.departureTitle, locale), greeting: g, paragraphs: TEXT.departure.map((p) => t(p, locale)), signoff: t(TEXT.departureSign, locale), elves: ALL };
}

/** What the read-aloud button says, in order. */
export function letterLines(l: Letter): string[] {
  return [l.title, l.greeting, ...l.paragraphs];
}
