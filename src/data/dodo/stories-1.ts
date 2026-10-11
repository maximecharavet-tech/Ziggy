/**
 * Mode dodo — stories d01 to d10.
 * Hand-written bedtime stories told by Ziggy (French + English), 6 scenes each.
 */
import type { DodoStory } from './types';

export const STORIES_1: DodoStory[] = [
  // ─────────────────────────────────────────────────────────── d01 · kindness
  {
    id: 'd01',
    title: { fr: 'Le petit nuage qui voulait aider', en: 'The Little Cloud Who Wanted to Help' },
    teaser: {
      fr: 'Un tout petit nuage offre sa pluie à des fleurs qui ont soif.',
      en: 'A tiny cloud gives its rain to thirsty flowers.',
    },
    value: 'kindness',
    moral: {
      fr: 'Même quand on est petit, on peut faire beaucoup de bien.',
      en: 'Even when you are small, you can do a lot of good.',
    },
    emoji: '☁️',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Tout en haut du ciel, au-dessus d’une vallée tranquille, flotte un petit nuage blanc. Il s’appelle Plume. Il est rond, léger et tout doux, comme un oreiller de coton. Chaque jour, Plume se promène avec le vent. Il regarde les maisons, les rivières et les oiseaux. Et chaque jour, il se demande : « Moi aussi, est-ce que je peux aider quelqu’un ? »',
          en: 'High up in the sky, above a quiet valley, floats a little white cloud. His name is Plume. He is round, light and very soft, like a cotton pillow. Every day, Plume drifts along with the wind. He watches the houses, the rivers and the birds. And every day, he wonders: “Could I help someone too?”',
        },
        art: { sky: 'dawn', hero: '☁️', props: ['🏡', '🏞️', '🐦'], ambience: 'sunrise' },
        prompt:
          'A small round fluffy white cloud with rosy cheeks and a gentle smile floats above a peaceful green valley with tiny houses, a winding river and a few birds, soft morning light, calm and dreamy mood.',
      },
      {
        text: {
          fr: 'Un après-midi, Plume arrive au-dessus d’un grand champ de fleurs. Il y a des coquelicots, des marguerites et des boutons d’or. Mais toutes les fleurs baissent la tête. La terre est sèche et craquelée. Il n’a pas plu depuis très longtemps. « Nous avons si soif », murmure une petite marguerite. Le cœur de Plume se serre tout doucement.',
          en: 'One afternoon, Plume arrives above a big field of flowers. There are poppies, daisies and buttercups. But all the flowers are hanging their heads. The ground is dry and cracked. It has not rained for a very long time. “We are so thirsty,” whispers a little daisy. Plume’s heart feels a soft little squeeze.',
        },
        art: { sky: 'gold', hero: '☁️', props: ['🌼', '🌺', '🌾'], ambience: 'sunrise' },
        prompt:
          'The small round fluffy white cloud with rosy cheeks looks down with concern at a wide field of drooping poppies, daisies and buttercups on dry cracked earth, warm golden afternoon light, gentle and tender mood.',
      },
      {
        text: {
          fr: 'Plume réfléchit très fort. Il est rempli de gouttes d’eau, rondes et fraîches, qu’il gardait pour son grand voyage. « Si je donne ma pluie, je vais devenir tout petit », pense-t-il. Puis il regarde encore les fleurs, si fatiguées. Plume sourit. « Tant pis. Elles en ont plus besoin que moi. Je vais les aider. »',
          en: 'Plume thinks very hard. He is full of water drops, round and fresh, that he was saving for his big journey. “If I give away my rain, I will become very small,” he thinks. Then he looks again at the flowers, so very tired. Plume smiles. “Never mind. They need it more than I do. I am going to help them.”',
        },
        art: { sky: 'gold', hero: '☁️', props: ['💧', '🌼', '🌾'], ambience: 'sunrise' },
        prompt:
          'The small round fluffy white cloud with rosy cheeks, plump with sparkling water drops, smiles kindly above the field of tired drooping flowers, soft late afternoon glow, thoughtful and warm mood.',
      },
      {
        text: {
          fr: 'Plume prend une grande inspiration et laisse partir sa pluie. Plic, ploc, plic, ploc. De petites gouttes toutes douces tombent sur les pétales, sur les feuilles, sur les racines. La terre boit lentement. Une à une, les fleurs relèvent la tête et s’ouvrent vers le ciel. Le champ sent bon, comme l’herbe mouillée après l’orage.',
          en: 'Plume takes a deep breath and lets his rain go. Pitter, patter, pitter, patter. Soft little drops fall on the petals, on the leaves, on the roots. The earth drinks slowly. One by one, the flowers lift their heads and open up to the sky. The field smells lovely, like wet grass after a summer shower.',
        },
        art: { sky: 'ocean', hero: '🌧️', props: ['💧', '🌼', '🌺', '🌷'], ambience: 'bubbles' },
        prompt:
          'The small round fluffy white cloud with rosy cheeks gently sprinkles soft raindrops over the flower field, poppies and daisies lifting their heads and opening, shimmering drops on petals, fresh pastel light, joyful and peaceful mood.',
      },
      {
        text: {
          fr: 'Maintenant, Plume est minuscule, très léger, presque transparent. Mais il n’est pas triste du tout. Les fleurs se balancent et chantent : « Merci, petit nuage ! » Le soleil du soir peint Plume en rose et en doré. Et le vent lui souffle à l’oreille : « Tu es tout petit, Plume, mais ton cœur est immense. »',
          en: 'Now Plume is tiny, very light, almost see-through. But he is not sad at all. The flowers sway and sing: “Thank you, little cloud!” The evening sun paints Plume pink and gold. And the wind whispers in his ear: “You are very small, Plume, but your heart is enormous.”',
        },
        art: { sky: 'rose', hero: '☁️', props: ['🌼', '🌺', '🌬️'], ambience: 'petals' },
        prompt:
          'The small fluffy white cloud with rosy cheeks, now tiny and almost transparent, glows pink and gold in the sunset above a blooming field of happy swaying poppies and daisies, warm tender evening light.',
      },
      {
        text: {
          fr: 'La nuit tombe sur la vallée. Les fleurs referment leurs pétales, comme de petites mains qui se joignent. Plume se pose au-dessus de la colline, tout près de la lune. Peu à peu, d’autres nuages viennent se blottir contre lui, et il redevient tout rond. Plume bâille. Les fleurs bâillent. Et toi aussi, ferme doucement les yeux.',
          en: 'Night falls over the valley. The flowers close their petals, like little hands folding together. Plume settles above the hill, right next to the moon. Little by little, other clouds come to snuggle up against him, and he grows round again. Plume yawns. The flowers yawn. And you too, gently close your eyes.',
        },
        art: { sky: 'indigo', hero: '☁️', props: ['🌙', '⛰️', '🌸'], ambience: 'stars' },
        prompt:
          'The small round fluffy white cloud with rosy cheeks, sleepy eyes half closed, rests above a quiet hill beside a glowing crescent moon, other soft clouds snuggling close, sleeping flower field below, starry indigo night, cozy mood.',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────── d02 · sharing
  {
    id: 'd02',
    title: { fr: 'L’écureuil et la grande noisette', en: 'The Squirrel and the Big Hazelnut' },
    teaser: {
      fr: 'Tifou trouve une noisette géante… et découvre qu’elle grandit quand on la partage.',
      en: 'Tifou finds a giant hazelnut and learns that sharing makes it grow.',
    },
    value: 'sharing',
    moral: {
      fr: 'Quand on partage, le bonheur grandit.',
      en: 'When we share, happiness grows.',
    },
    emoji: '🐿️',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Dans une forêt pleine de feuilles rousses vivait un petit écureuil nommé Tifou. Il avait une queue toute touffue et une écharpe verte que sa grand-mère lui avait tricotée. Tifou aimait grimper, sauter de branche en branche et, surtout, chercher des noisettes. Ce matin-là, le vent d’automne chantait doucement entre les arbres.',
          en: 'In a forest full of russet leaves lived a little squirrel named Tifou. He had a very bushy tail and a green scarf that his grandmother had knitted for him. Tifou loved to climb, to leap from branch to branch and, most of all, to look for hazelnuts. That morning, the autumn wind was singing softly between the trees.',
        },
        art: { sky: 'gold', hero: '🐿️', props: ['🍂', '🌳', '🧣'], ambience: 'petals' },
        prompt:
          'A little red squirrel with a big bushy tail and a knitted green scarf leaps between branches in an autumn forest full of orange and russet leaves, soft morning sunlight, cheerful and cozy mood.',
      },
      {
        text: {
          fr: 'Au pied d’un vieux noisetier, Tifou découvrit une noisette énorme. Elle était ronde, brillante, grosse comme une pomme ! « Elle est à moi, rien qu’à moi », chuchota Tifou. Il la roula jusqu’à sa cachette, dans le creux d’un arbre, et la serra très fort contre lui, avec ses petites pattes.',
          en: 'At the foot of an old hazel tree, Tifou found an enormous hazelnut. It was round and shiny, as big as an apple! “It’s mine, all mine,” whispered Tifou. He rolled it all the way to his hiding place, in the hollow of a tree, and hugged it very tightly with his little paws.',
        },
        art: { sky: 'gold', hero: '🐿️', props: ['🌰', '🌳', '🍂'], ambience: 'petals' },
        prompt:
          'The little red squirrel with the bushy tail and green scarf hugs a giant shiny hazelnut as big as an apple inside a cozy tree hollow, falling autumn leaves outside, warm golden light.',
      },
      {
        text: {
          fr: 'Mais dans sa cachette, Tifou se sentait un peu seul. Dehors, il entendit sa voisine la souris, puis le petit geai bleu, puis le lapin. Ils cherchaient eux aussi de quoi manger, et leurs paniers étaient presque vides. Tifou regarda sa grande noisette. Elle était belle, oui. Mais elle ne le faisait pas sourire.',
          en: 'But in his hiding place, Tifou felt a little lonely. Outside, he heard his neighbour the mouse, then the little blue jay, then the rabbit. They were looking for food too, and their baskets were almost empty. Tifou looked at his big hazelnut. It was beautiful, yes. But it did not make him smile.',
        },
        art: { sky: 'forest', hero: '🐿️', props: ['🌰', '🐭', '🐦', '🐰'], ambience: 'petals' },
        prompt:
          'The little red squirrel with the green scarf peeks thoughtfully out of his tree hollow beside the giant hazelnut, watching a small grey mouse, a little blue jay and a brown rabbit with nearly empty baskets, soft forest light.',
      },
      {
        text: {
          fr: 'Alors Tifou sortit de sa cachette. « Venez, mes amis ! J’ai trouvé une très grande noisette. Partageons-la ! » Il la cassa doucement. Crac ! À l’intérieur, il y avait assez pour tout le monde. La souris, le geai et le lapin s’assirent en rond autour de lui, les yeux pleins d’étoiles.',
          en: 'So Tifou came out of his hiding place. “Come, my friends! I found a very big hazelnut. Let’s share it!” He cracked it open gently. Crack! Inside, there was enough for everyone. The mouse, the jay and the rabbit sat in a circle around him, their eyes full of stars.',
        },
        art: { sky: 'gold', hero: '🐿️', props: ['🌰', '🐭', '🐦', '🐰'], ambience: 'sunrise' },
        prompt:
          'The little red squirrel with the green scarf cracks open the giant hazelnut in a sunny clearing while a small grey mouse, a little blue jay and a brown rabbit sit in a circle with delighted sparkling eyes, warm happy light.',
      },
      {
        text: {
          fr: 'Ils grignotèrent ensemble, en riant et en racontant des histoires. La souris apporta trois mûres, le geai des graines, le lapin un brin de trèfle. Le petit repas devint une vraie fête. Et Tifou comprit une chose étonnante : en partageant sa noisette, elle n’avait pas rapetissé. Son bonheur, lui, était devenu bien plus grand.',
          en: 'They nibbled together, laughing and telling stories. The mouse brought three blackberries, the jay some seeds, the rabbit a sprig of clover. The little meal became a real party. And Tifou understood something surprising: by sharing his hazelnut, nothing had grown smaller. His happiness had grown much, much bigger.',
        },
        art: { sky: 'rose', hero: '🐿️', props: ['🫐', '🍀', '🐭', '🐦', '🐰'], ambience: 'petals' },
        prompt:
          'The little red squirrel with the green scarf shares a cozy picnic with a small grey mouse, a little blue jay and a brown rabbit, blackberries, seeds and clover on a leaf, everyone laughing, soft pink evening light.',
      },
      {
        text: {
          fr: 'Le soir tomba sur la forêt. Les amis se blottirent les uns contre les autres, au chaud dans le creux de l’arbre. La grande queue touffue de Tifou devint une couverture pour tout le monde. Dehors, la lune souriait. Un petit bâillement, puis un autre… Bonne nuit, Tifou. Bonne nuit, les amis. Et toi aussi, ferme doucement les yeux.',
          en: 'Evening fell over the forest. The friends snuggled up together, warm inside the hollow of the tree. Tifou’s big bushy tail became a blanket for everyone. Outside, the moon was smiling. One little yawn, then another… Good night, Tifou. Good night, friends. And you too, gently close your eyes.',
        },
        art: { sky: 'indigo', hero: '🐿️', props: ['🌙', '🌳', '🐭', '🐰'], ambience: 'stars' },
        prompt:
          'The little red squirrel with the green scarf sleeps curled in a tree hollow, his bushy tail like a blanket over a small grey mouse, a little blue jay and a brown rabbit, smiling moon and stars outside, cozy night.',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────── d03 · honesty
  {
    id: 'd03',
    title: { fr: 'Le lapin et le vase de la lune', en: 'The Rabbit and the Moon Vase' },
    teaser: {
      fr: 'Pompon a cassé le vase de Mamie. Va-t-il oser dire la vérité ?',
      en: 'Pompon broke Grandma’s vase. Will he dare to tell the truth?',
    },
    value: 'honesty',
    moral: {
      fr: 'Dire la vérité rend le cœur léger.',
      en: 'Telling the truth makes your heart feel light.',
    },
    emoji: '🐰',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Au bord d’un pré, dans un terrier tout rond, vivait Pompon, un petit lapin gris aux grandes oreilles. Il portait toujours une salopette bleue. Sur la cheminée de sa grand-mère trônait un trésor : le vase de la lune. Il était bleu pâle, avec une lune d’argent peinte dessus. Le soir, il brillait doucement.',
          en: 'At the edge of a meadow, in a cosy round burrow, lived Pompon, a little grey rabbit with big ears. He always wore blue overalls. On his grandmother’s mantelpiece stood a treasure: the moon vase. It was pale blue, with a silver moon painted on it. In the evening, it glowed softly.',
        },
        art: { sky: 'violet', hero: '🐰', props: ['🏺', '🌙', '🏡'], ambience: 'moon' },
        prompt:
          'A little grey rabbit with big ears and blue overalls stands in a cozy round burrow living room, gazing at a pale blue vase painted with a silver moon on the mantelpiece, warm lamplight, gentle mood.',
      },
      {
        text: {
          fr: 'Un après-midi de pluie, Pompon jouait au ballon dans le salon. « Pas de ballon dans la maison », disait souvent grand-mère. Mais Pompon s’ennuyait tellement ! Boing, boing… Le ballon rebondit trop haut. Il toucha la cheminée, et le vase de la lune glissa par terre. Cling ! Il se cassa en trois morceaux.',
          en: 'One rainy afternoon, Pompon was playing ball in the living room. “No ball games in the house,” Grandma often said. But Pompon was so bored! Boing, boing… The ball bounced too high. It hit the mantelpiece, and the moon vase slid to the floor. Clink! It broke into three pieces.',
        },
        art: { sky: 'ocean', hero: '🐰', props: ['⚽', '🏺', '🌧️'], ambience: 'bubbles' },
        prompt:
          'The little grey rabbit with big ears and blue overalls looks surprised as a bouncing ball nudges the pale blue moon vase off the mantelpiece, rain on the round window, soft indoor light, gentle surprised mood.',
      },
      {
        text: {
          fr: 'Pompon resta immobile, le cœur battant. Vite, il ramassa les morceaux et les cacha sous le tapis. Quand grand-mère rentra, elle demanda : « Tout va bien, mon lapinou ? » Pompon répondit : « Oui, oui. » Mais son ventre devint lourd, lourd comme une pierre. Il ne réussit même pas à finir sa soupe de carottes.',
          en: 'Pompon stood very still, his heart pounding. Quickly, he picked up the pieces and hid them under the rug. When Grandma came home, she asked: “Is everything all right, my little bunny?” Pompon answered: “Yes, yes.” But his tummy felt heavy, heavy as a stone. He could not even finish his carrot soup.',
        },
        art: { sky: 'violet', hero: '🐰', props: ['🥕', '🥣', '👵'], ambience: 'moon' },
        prompt:
          'The little grey rabbit with big ears and blue overalls sits at a small wooden table with a bowl of carrot soup, looking worried, while a kind grandmother rabbit in a lavender shawl smiles at him, cozy burrow kitchen.',
      },
      {
        text: {
          fr: 'Au moment du coucher, Pompon n’arrivait pas à dormir. Le mensonge le piquait comme une petite épine. Alors il prit une grande respiration, tout doucement, comme on souffle sur une plume. Il se leva, souleva le tapis et apporta les morceaux à sa grand-mère. « Pardon, Mamie. C’est moi. J’ai cassé le vase de la lune. »',
          en: 'At bedtime, Pompon could not fall asleep. The fib pricked him like a little thorn. So he took a big breath, very gently, the way you blow on a feather. He got up, lifted the rug and brought the pieces to his grandmother. “I’m sorry, Grandma. It was me. I broke the moon vase.”',
        },
        art: { sky: 'indigo', hero: '🐰', props: ['🏺', '🕯️', '👵'], ambience: 'moon' },
        prompt:
          'The little grey rabbit with big ears and blue pyjamas bravely holds out three pieces of the pale blue moon vase to his grandmother rabbit in a lavender shawl, sitting in her armchair, soft candlelight, tender honest mood.',
      },
      {
        text: {
          fr: 'Grand-mère regarda les morceaux, puis elle regarda Pompon. Elle ouvrit grand les bras. « Merci de m’avoir dit la vérité. Il faut beaucoup de courage pour ça. » Ensemble, ils recollèrent le vase avec une colle dorée. Les fissures devinrent de jolies lignes d’or. « Regarde, dit grand-mère, il est encore plus beau qu’avant. »',
          en: 'Grandma looked at the pieces, then she looked at Pompon. She opened her arms wide. “Thank you for telling me the truth. That takes a lot of courage.” Together, they glued the vase back with golden glue. The cracks became pretty golden lines. “Look,” said Grandma, “it is even more beautiful than before.”',
        },
        art: { sky: 'gold', hero: '🐰', props: ['🏺', '✨', '👵'], ambience: 'stars' },
        prompt:
          'The little grey rabbit with big ears and blue pyjamas and his grandmother rabbit in a lavender shawl mend the pale blue moon vase together, its cracks glowing with golden lines, warm lamplight, loving mood.',
      },
      {
        text: {
          fr: 'Le vase de la lune retrouva sa place sur la cheminée. Ses lignes d’or brillaient dans la nuit, comme de petits chemins d’étoiles. Pompon se sentait léger, léger comme un nuage. Il se blottit sous sa couverture, ses grandes oreilles bien rangées. Grand-mère lui fit un bisou sur le front. Chut… Pompon dort. Toi aussi, ferme doucement les yeux.',
          en: 'The moon vase went back to its place on the mantelpiece. Its golden lines shone in the night, like little paths of stars. Pompon felt light, as light as a cloud. He snuggled under his blanket, his big ears neatly tucked in. Grandma gave him a kiss on the forehead. Shh… Pompon is asleep. You too, gently close your eyes.',
        },
        art: { sky: 'indigo', hero: '🐰', props: ['🏺', '🛏️', '🌙'], ambience: 'stars' },
        prompt:
          'The little grey rabbit with big ears sleeps peacefully under a patchwork blanket in a round burrow bedroom, the mended pale blue moon vase glowing with golden lines nearby, moonlight through a round window, calm night.',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────── d04 · courage
  {
    id: 'd04',
    title: {
      fr: 'La petite luciole qui avait peur du noir',
      en: 'The Little Firefly Who Was Afraid of the Dark',
    },
    teaser: {
      fr: 'Lila n’aime pas la nuit… jusqu’au soir où elle découvre sa lumière.',
      en: 'Lila does not like the night… until she discovers her own light.',
    },
    value: 'courage',
    moral: {
      fr: 'Tout au fond de toi, il y a une lumière plus forte que ta peur.',
      en: 'Deep inside you, there is a light stronger than your fear.',
    },
    emoji: '✨',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Dans un jardin plein de fleurs, sous une feuille de trèfle, habite une toute petite luciole. Elle s’appelle Lila. Elle a des ailes transparentes et un petit nœud rose sur la tête. Lila aime le soleil, les pétales chauds et le parfum du chèvrefeuille. Mais il y a une chose que Lila n’aime pas du tout : le noir.',
          en: 'In a garden full of flowers, under a clover leaf, lives a tiny little firefly. Her name is Lila. She has see-through wings and a little pink bow on her head. Lila loves the sun, warm petals and the sweet smell of honeysuckle. But there is one thing Lila does not like at all: the dark.',
        },
        art: { sky: 'gold', hero: '🐞', props: ['🍀', '🌸', '🌼'], ambience: 'sunrise' },
        prompt:
          'A tiny cute firefly with transparent wings and a little pink bow on her head rests under a big clover leaf in a sunny flower garden full of honeysuckle and daisies, warm daylight, sweet peaceful mood.',
      },
      {
        text: {
          fr: 'Chaque soir, quand le soleil se couche, toutes les lucioles s’envolent pour danser dans la nuit. Lila, elle, reste cachée sous sa feuille. « Le noir est trop grand, et moi, je suis trop petite », murmure-t-elle. Ses amies l’appellent : « Viens, Lila ! » Mais Lila ferme les yeux et ne bouge pas.',
          en: 'Every evening, when the sun goes down, all the fireflies fly off to dance in the night. But Lila stays hidden under her leaf. “The dark is too big, and I am too small,” she whispers. Her friends call to her: “Come on, Lila!” But Lila closes her eyes and does not move.',
        },
        art: { sky: 'violet', hero: '🐞', props: ['🍀', '🌙'], ambience: 'fireflies' },
        prompt:
          'The tiny firefly with transparent wings and a pink bow hides shyly under a clover leaf at dusk while other glowing fireflies dance among the flowers above, soft violet evening sky, gentle mood.',
      },
      {
        text: {
          fr: 'Un soir, Lila entend une toute petite voix. « Où est ma maison ? Je ne vois rien… » C’est Tic, un bébé escargot, perdu dans l’herbe haute. Il a l’air si inquiet. Lila sent son cœur battre très vite. Elle a peur du noir, oui. Mais elle a encore plus envie d’aider Tic.',
          en: 'One evening, Lila hears a tiny little voice. “Where is my home? I can’t see anything…” It is Tic, a baby snail, lost in the tall grass. He looks so worried. Lila feels her heart beating very fast. She is afraid of the dark, yes. But she wants to help Tic even more.',
        },
        art: { sky: 'indigo', hero: '🐌', props: ['🌿', '🍀', '🐞'], ambience: 'stars' },
        prompt:
          'A small baby snail with a swirly orange shell looks lost in tall grass at night while the tiny firefly with transparent wings and a pink bow peeks out from her clover leaf, soft starry blue night.',
      },
      {
        text: {
          fr: 'Lila sort de sous sa feuille, tout doucement. Le noir est là, autour d’elle. Elle respire une fois, deux fois, trois fois. Et soudain, quelque chose de magique arrive : son ventre se met à briller ! Une petite lumière dorée, chaude et douce, éclaire l’herbe tout autour. « Oh ! C’est moi qui brille ! »',
          en: 'Lila comes out from under her leaf, very slowly. The dark is there, all around her. She breathes once, twice, three times. And suddenly, something magical happens: her tummy starts to glow! A little golden light, warm and soft, lights up the grass all around. “Oh! I’m the one who is shining!”',
        },
        art: { sky: 'indigo', hero: '✨', props: ['🐞', '🌿', '🐌'], ambience: 'fireflies' },
        prompt:
          'The tiny firefly with transparent wings and a pink bow glows with a warm golden light for the first time, surprised and delighted, lighting up blades of grass and the little snail with a swirly orange shell, magical night.',
      },
      {
        text: {
          fr: 'Avec sa lumière, Lila guide Tic entre les brins d’herbe, jusqu’à sa maison sous la grosse pierre. Maman escargot dit merci avec un grand sourire. Puis les autres lucioles arrivent et dansent autour de Lila. Le jardin scintille comme un ciel rempli d’étoiles. Lila n’a plus peur. Elle porte sa lumière en elle.',
          en: 'With her light, Lila guides Tic between the blades of grass, all the way to his home under the big stone. Mummy snail says thank you with a big smile. Then the other fireflies come and dance around Lila. The garden twinkles like a sky full of stars. Lila is not afraid anymore. She carries her light inside her.',
        },
        art: { sky: 'forest', hero: '✨', props: ['🐌', '🪨', '🐞', '🌸'], ambience: 'fireflies' },
        prompt:
          'The tiny glowing firefly with a pink bow leads the baby snail with a swirly orange shell home to a smiling mother snail beside a mossy stone, many fireflies dancing around, garden twinkling like stars, joyful night.',
      },
      {
        text: {
          fr: 'Plus tard, Lila revient sous sa feuille de trèfle. Sa lumière devient plus douce, plus douce, comme une veilleuse. Le noir n’est plus si grand : c’est juste la nuit qui berce le jardin. Lila bâille, Tic bâille, la lune bâille aussi. Toi aussi, tu as une petite lumière dans ton cœur. Ferme doucement les yeux.',
          en: 'Later, Lila goes back under her clover leaf. Her light grows softer and softer, like a night-light. The dark does not feel so big anymore: it is just the night, rocking the garden to sleep. Lila yawns, Tic yawns, and the moon yawns too. You also have a little light in your heart. Gently close your eyes.',
        },
        art: { sky: 'indigo', hero: '🐞', props: ['🍀', '🌙', '🐌'], ambience: 'fireflies' },
        prompt:
          'The tiny firefly with transparent wings and a pink bow sleeps under her clover leaf, glowing softly like a night-light, a crescent moon above the quiet garden, gentle starry night, peaceful sleepy mood.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── d05 · patience
  {
    id: 'd05',
    title: { fr: 'La graine de Noé', en: 'Noé’s Seed' },
    teaser: {
      fr: 'Noé plante une graine… et apprend que les belles choses prennent leur temps.',
      en: 'Noé plants a seed and learns that beautiful things take time.',
    },
    value: 'patience',
    moral: {
      fr: 'Les plus belles choses poussent quand on sait attendre.',
      en: 'The most beautiful things grow when we know how to wait.',
    },
    emoji: '🌻',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Noé habitait une petite maison avec un jardin. Il avait des cheveux bruns tout bouclés et des bottes rouges qu’il adorait. Un matin de printemps, sa voisine Yuki lui offrit une petite graine brune, toute ronde. « Plante-la, prends-en soin, et tu verras, dit-elle avec un clin d’œil. Elle a une surprise pour toi. »',
          en: 'Noé lived in a little house with a garden. He had curly brown hair and red boots that he loved. One spring morning, his neighbour Yuki gave him a little brown seed, perfectly round. “Plant it, take care of it, and you will see,” she said with a wink. “It has a surprise for you.”',
        },
        art: { sky: 'dawn', hero: '👦', props: ['🌱', '🏡', '👢'], ambience: 'sunrise' },
        prompt:
          'A little boy with curly brown hair, a yellow t-shirt and red rain boots receives a small brown seed from his smiling neighbour, a woman with a short black bob and a green cardigan, in a sunny spring garden.',
      },
      {
        text: {
          fr: 'Noé creusa un petit trou dans la terre avec ses doigts. Il déposa la graine, la recouvrit doucement et l’arrosa avec son petit arrosoir vert. Puis il s’assit devant et attendit. Il attendit une minute. Puis deux. « Elle ne pousse pas ! » soupira Noé. Yuki sourit : « Les graines prennent leur temps. »',
          en: 'Noé dug a little hole in the soil with his fingers. He put the seed in, covered it gently and watered it with his little green watering can. Then he sat down in front of it and waited. He waited one minute. Then two. “It isn’t growing!” sighed Noé. Yuki smiled: “Seeds take their time.”',
        },
        art: { sky: 'dawn', hero: '👦', props: ['🪴', '💧', '👢'], ambience: 'sunrise' },
        prompt:
          'The little boy with curly brown hair, yellow t-shirt and red rain boots sits on the grass waiting impatiently beside a tiny patch of soil, holding a small green watering can, his smiling neighbour with a black bob nearby, morning light.',
      },
      {
        text: {
          fr: 'Alors, chaque jour, Noé prit soin de sa graine. Le matin, il l’arrosait. Quand il faisait trop chaud, il lui faisait de l’ombre avec son chapeau. Le soir, il lui chantait une petite chanson. Il ne voyait rien encore. Mais sous la terre, en secret, la graine écoutait, buvait et grandissait.',
          en: 'So, every day, Noé took care of his seed. In the morning, he watered it. When it was too hot, he gave it shade with his hat. In the evening, he hummed it a little song. He could not see anything yet. But under the ground, in secret, the seed was listening, drinking and growing.',
        },
        art: { sky: 'gold', hero: '👦', props: ['👒', '🎶', '🌱'], ambience: 'sunrise' },
        prompt:
          'The little boy with curly brown hair, yellow t-shirt and red rain boots kneels by the patch of soil, holding his straw hat over it for shade and singing softly, a hidden seed glowing gently underground, warm golden light.',
      },
      {
        text: {
          fr: 'Un matin, Noé courut au jardin et s’arrêta net. Une petite pousse verte sortait de la terre ! Elle avait deux feuilles toutes fines, comme deux mains ouvertes. « Bonjour, toi ! » chuchota Noé. Il était si heureux qu’il fit une danse avec ses bottes rouges. Mais la pousse, elle, avait encore besoin de temps.',
          en: 'One morning, Noé ran into the garden and stopped short. A little green sprout was poking out of the soil! It had two very thin leaves, like two open hands. “Hello, you!” whispered Noé. He was so happy that he did a dance in his red boots. But the sprout still needed more time.',
        },
        art: { sky: 'dawn', hero: '🌱', props: ['👦', '👢', '🦋'], ambience: 'sunrise' },
        prompt:
          'The little boy with curly brown hair, yellow t-shirt and red rain boots dances joyfully beside a tiny green sprout with two delicate leaves poking out of the soil, a butterfly nearby, fresh spring morning light.',
      },
      {
        text: {
          fr: 'Les jours passèrent, puis les semaines. La tige grandit, plus haute que les bottes de Noé, puis plus haute que ses genoux. Et un beau matin d’été, un bouton s’ouvrit enfin. C’était un grand tournesol, jaune comme le soleil ! Il se tourna vers Noé, comme pour lui dire merci. Noé applaudit de joie.',
          en: 'The days went by, then the weeks. The stem grew taller than Noé’s boots, then taller than his knees. And one fine summer morning, a bud finally opened. It was a big sunflower, as yellow as the sun! It turned towards Noé, as if to say thank you. Noé clapped with joy.',
        },
        art: { sky: 'gold', hero: '🌻', props: ['👦', '🐝', '☀️'], ambience: 'sunrise' },
        prompt:
          'The little boy with curly brown hair, yellow t-shirt and red rain boots claps with joy in front of a tall bright sunflower that has just bloomed and seems to smile at him, a bee buzzing nearby, sunny summer garden.',
      },
      {
        text: {
          fr: 'Ce soir-là, Noé s’assit près de son tournesol avec Yuki. Le ciel devenait rose, puis violet. Le tournesol baissa doucement la tête pour se reposer. Noé bâilla. Attendre, c’était long, mais c’était beau. Dans son lit, Noé rêva de jardins pleins de fleurs. Et toi aussi, tout doucement, laisse tes yeux se fermer.',
          en: 'That evening, Noé sat beside his sunflower with Yuki. The sky turned pink, then purple. The sunflower gently lowered its head to rest. Noé yawned. Waiting had been long, but it had been beautiful. In his bed, Noé dreamed of gardens full of flowers. And you too, very softly, let your eyes close.',
        },
        art: { sky: 'rose', hero: '🌻', props: ['👦', '🌙', '🛏️'], ambience: 'stars' },
        prompt:
          'The little boy with curly brown hair, now in yellow pyjamas, sits sleepily beside his tall sunflower with his neighbour with a black bob, under a pink and purple twilight sky with the first stars, peaceful mood.',
      },
    ],
  },

  // ───────────────────────────────────────────────────────── d06 · friendship
  {
    id: 'd06',
    title: { fr: 'L’ours et l’oiseau', en: 'The Bear and the Bird' },
    teaser: {
      fr: 'Un très grand ours et un tout petit oiseau deviennent les meilleurs amis.',
      en: 'A very big bear and a very small bird become best friends.',
    },
    value: 'friendship',
    moral: {
      fr: 'Grand ou petit, chaque ami a quelque chose de précieux à offrir.',
      en: 'Big or small, every friend has something precious to give.',
    },
    emoji: '🐻',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Au fond de la grande forêt vit Bruno, un ours très grand et très doux. Il a une fourrure brune et une écharpe rouge. Bruno est si grand que les petits animaux n’osent pas trop s’approcher de lui. Alors Bruno se promène souvent tout seul, en regardant les nuages et en fredonnant une chanson.',
          en: 'Deep in the big forest lives Bruno, a very big and very gentle bear. He has brown fur and a red scarf. Bruno is so big that the little animals do not really dare to come near him. So Bruno often goes walking on his own, watching the clouds and humming a song.',
        },
        art: { sky: 'forest', hero: '🐻', props: ['🌲', '☁️', '🧣'], ambience: 'sunrise' },
        prompt:
          'A very big gentle brown bear wearing a red scarf walks alone through a tall pine forest, looking up at fluffy clouds and humming, soft morning light through the trees, calm slightly wistful mood.',
      },
      {
        text: {
          fr: 'Un matin, Bruno entend un tout petit « cui-cui » au pied d’un sapin. C’est Pépite, une minuscule mésange bleue au ventre jaune. Le vent a fait tomber son nid de la branche. Pépite est assise dans l’herbe, toute ébouriffée. « Je ne peux pas le remonter, mon nid est trop lourd pour moi », dit-elle.',
          en: 'One morning, Bruno hears a tiny “tweet-tweet” at the foot of a fir tree. It is Pépite, a teeny blue tit with a yellow tummy. The wind has knocked her nest off the branch. Pépite is sitting in the grass, all ruffled. “I can’t carry it back up, my nest is too heavy for me,” she says.',
        },
        art: { sky: 'forest', hero: '🐦', props: ['🪺', '🌲', '🐻'], ambience: 'petals' },
        prompt:
          'A teeny blue tit bird with a yellow tummy sits ruffled in the grass beside her fallen nest at the foot of a fir tree, while the big gentle brown bear with a red scarf leans down kindly, soft forest light.',
      },
      {
        text: {
          fr: 'Bruno s’approche tout doucement, sur la pointe des pattes. Il prend le nid dans sa grosse patte, avec beaucoup de délicatesse. Puis il se met debout, se fait très, très grand, et repose le nid sur la plus haute branche. Pépite vole jusqu’à lui. « Merci, Bruno ! Tu es grand, et tu es gentil ! »',
          en: 'Bruno comes closer very gently, on the tips of his paws. He picks up the nest in his big paw, ever so carefully. Then he stands up, stretches very, very tall, and puts the nest back on the highest branch. Pépite flies up to him. “Thank you, Bruno! You are big, and you are kind!”',
        },
        art: { sky: 'gold', hero: '🐻', props: ['🪺', '🐦', '🌲'], ambience: 'sunrise' },
        prompt:
          'The big gentle brown bear with a red scarf stands on tiptoe and carefully places the little nest back on a high fir branch, the teeny blue tit with a yellow tummy fluttering happily beside him, warm golden light.',
      },
      {
        text: {
          fr: 'Depuis ce jour, Bruno et Pépite se voient tous les jours. Pépite se pose sur l’oreille de Bruno et lui raconte ce qu’elle voit du haut du ciel. Bruno, lui, montre à Pépite les coins secrets de la forêt : les fraises sauvages, la source fraîche, le rocher tout chaud. Un très grand ami, un tout petit ami.',
          en: 'From that day on, Bruno and Pépite see each other every day. Pépite perches on Bruno’s ear and tells him what she sees from high up in the sky. Bruno shows Pépite the secret corners of the forest: the wild strawberries, the cool spring, the sun-warmed rock. One very big friend, one very small friend.',
        },
        art: { sky: 'forest', hero: '🐻', props: ['🐦', '🍓', '💧', '🪨'], ambience: 'petals' },
        prompt:
          'The big gentle brown bear with a red scarf walks through the forest with the teeny blue tit with a yellow tummy perched on his ear, passing wild strawberries and a sparkling spring, cheerful dappled sunlight.',
      },
      {
        text: {
          fr: 'Un jour, Bruno a une épine plantée dans la patte. Aïe ! Ses grosses griffes sont trop maladroites pour l’enlever. Pépite arrive en voletant. Avec son petit bec fin, elle retire l’épine, hop, en un clin d’œil. Bruno sourit. « Tu vois, Pépite ? Être grand, c’est utile. Mais être petit, c’est utile aussi. »',
          en: 'One day, Bruno gets a thorn stuck in his paw. Ouch! His big claws are too clumsy to take it out. Pépite comes fluttering over. With her thin little beak, she pulls out the thorn, hop, in the blink of an eye. Bruno smiles. “You see, Pépite? Being big is useful. But being small is useful too.”',
        },
        art: { sky: 'gold', hero: '🐦', props: ['🐻', '🌿', '🌼'], ambience: 'sunrise' },
        prompt:
          'The teeny blue tit with a yellow tummy carefully helps the big gentle brown bear with a red scarf, who sits in a meadow holding out his paw, both smiling warmly at each other, soft afternoon sunshine.',
      },
      {
        text: {
          fr: 'Le soir, Bruno s’installe au pied du sapin. Pépite se blottit au creux de sa fourrure chaude, bien à l’abri. Bruno respire lentement, et Pépite se laisse bercer comme dans un hamac. Les étoiles s’allument une à une au-dessus d’eux. Le grand ours et le petit oiseau s’endorment ensemble. Ferme doucement les yeux, toi aussi.',
          en: 'In the evening, Bruno settles down at the foot of the fir tree. Pépite snuggles into his warm fur, safe and sound. Bruno breathes slowly, and Pépite is rocked as if in a hammock. The stars light up one by one above them. The big bear and the little bird fall asleep together. Gently close your eyes, you too.',
        },
        art: { sky: 'indigo', hero: '🐻', props: ['🐦', '🌲', '🌙'], ambience: 'stars' },
        prompt:
          'The big gentle brown bear with a red scarf sleeps curled at the foot of a fir tree, the teeny blue tit with a yellow tummy nestled asleep in his warm fur, stars appearing in a deep blue night sky, peaceful.',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────── d07 · respect
  {
    id: 'd07',
    title: { fr: 'Le vieux chêne qui chuchotait', en: 'The Old Whispering Oak' },
    teaser: {
      fr: 'Amina et Malik apprennent à écouter un très vieil arbre plein d’histoires.',
      en: 'Amina and Malik learn to listen to a very old tree full of stories.',
    },
    value: 'respect',
    moral: {
      fr: 'Ceux qui ont vécu longtemps ont de belles choses à nous apprendre, si on prend le temps de les écouter.',
      en: 'Those who have lived a long time have beautiful things to teach us, if we take the time to listen.',
    },
    emoji: '🌳',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Au milieu d’une prairie se dressait un chêne très, très vieux. Ses branches étaient longues comme des bras ouverts, et ses racines plongeaient profond dans la terre. Les gens du village l’appelaient Grand-Père Chêne. On disait que, les soirs calmes, il chuchotait. Mais pour l’entendre, il fallait savoir écouter.',
          en: 'In the middle of a meadow stood a very, very old oak tree. Its branches were long like open arms, and its roots reached deep into the earth. The people of the village called it Grandpa Oak. It was said that, on calm evenings, it whispered. But to hear it, you had to know how to listen.',
        },
        art: { sky: 'dawn', hero: '🌳', props: ['🌾', '🏡', '🐦'], ambience: 'sunrise' },
        prompt:
          'A huge ancient oak tree with wide spreading branches like open arms and deep gnarled roots stands alone in the middle of a soft green meadow, a small village in the distance, gentle golden light, peaceful mood.',
      },
      {
        text: {
          fr: 'Un jour, Amina et Malik arrivèrent en courant. Amina avait de longues tresses et un pull orange. Malik portait des lunettes rondes et un pull vert. Ils criaient, sautaient, tiraient sur les feuilles et grimpaient partout. « Ce vieil arbre est trop lent et trop ennuyeux ! » rit Malik, en cassant une petite branche. Le chêne ne dit rien.',
          en: 'One day, Amina and Malik came running up. Amina had long braids and an orange jumper. Malik wore round glasses and a green jumper. They shouted, jumped, pulled at the leaves and climbed everywhere. “This old tree is too slow and too boring!” laughed Malik, snapping off a small branch. The oak said nothing.',
        },
        art: { sky: 'gold', hero: '🌳', props: ['👧', '👦', '🍃'], ambience: 'petals' },
        prompt:
          'A girl with long dark braids and an orange jumper and a boy with round glasses and a green jumper run and play noisily around the huge ancient oak, pulling at its leaves, bright afternoon light, lively mood.',
      },
      {
        text: {
          fr: 'Le soir, leur grand-mère Inès les emmena près de l’arbre. Elle posa sa main ridée sur l’écorce. « Asseyez-vous et faites silence un petit moment. Écoutez. » Les enfants s’assirent dans l’herbe. Au début, ils n’entendirent rien. Puis le vent passa dans les feuilles. Et une voix très douce murmura : « Bonsoir, les enfants… »',
          en: 'In the evening, their grandmother Inès took them to the tree. She placed her wrinkled hand on the bark. “Sit down and be quiet for a little while. Listen.” The children sat in the grass. At first, they heard nothing. Then the wind passed through the leaves. And a very soft voice murmured: “Good evening, children…”',
        },
        art: { sky: 'violet', hero: '👵', props: ['🌳', '👧', '👦'], ambience: 'fireflies' },
        prompt:
          'A kind grandmother with silver hair in a bun and a purple shawl rests her hand on the bark of the huge ancient oak, the girl with braids and orange jumper and the boy with round glasses sit quietly in the grass, dusk.',
      },
      {
        text: {
          fr: 'Le vieux chêne leur raconta des histoires. Il avait vu passer cent hivers et mille oiseaux. Il avait abrité des écureuils, des hiboux et des enfants, il y a très longtemps… comme grand-mère Inès quand elle était petite ! Amina et Malik ouvraient de grands yeux. Ce vieil arbre savait tant de choses.',
          en: 'The old oak told them stories. It had seen a hundred winters and a thousand birds. It had sheltered squirrels, owls and children, a very long time ago… like Grandma Inès when she was little! Amina and Malik listened with wide eyes. This old tree knew so many things.',
        },
        art: { sky: 'violet', hero: '🌳', props: ['🦉', '🐿️', '❄️', '🐦'], ambience: 'fireflies' },
        prompt:
          'The girl with braids and orange jumper and the boy with round glasses and green jumper listen with wide amazed eyes beneath the huge ancient oak, faint glowing images of owls, squirrels and snowy winters in its branches, twilight.',
      },
      {
        text: {
          fr: 'Malik regarda la petite branche cassée. « Pardon, Grand-Père Chêne. Je ne savais pas. » Amina caressa l’écorce. « On fera attention à toi, promis. » Le chêne fit danser ses feuilles, comme un sourire. « Merci, chuchota-t-il. Ceux qui ont vécu longtemps ont beaucoup à offrir. Il suffit de prendre le temps de les écouter. »',
          en: 'Malik looked at the little broken branch. “I’m sorry, Grandpa Oak. I didn’t know.” Amina stroked the bark. “We’ll take care of you, we promise.” The oak made its leaves dance, like a smile. “Thank you,” it whispered. “Those who have lived a long time have a lot to give. You only need to take the time to listen.”',
        },
        art: { sky: 'rose', hero: '👦', props: ['🌳', '👧', '🍃'], ambience: 'fireflies' },
        prompt:
          'The boy with round glasses and green jumper gently holds a small twig with an apologetic look while the girl with braids and orange jumper strokes the bark of the huge ancient oak, its leaves rustling warmly, rosy dusk.',
      },
      {
        text: {
          fr: 'La nuit tomba sur la prairie. Grand-mère Inès prit les enfants par la main, et ils rentrèrent tout doucement. Derrière eux, le chêne chantait une berceuse de feuilles. Ce soir-là, Amina et Malik demandèrent à leur grand-mère une histoire de quand elle était petite. Ils l’écoutèrent jusqu’au bout, puis s’endormirent. Chut… écoute le vent, et ferme les yeux.',
          en: 'Night fell over the meadow. Grandma Inès took the children by the hand, and they walked home slowly. Behind them, the oak was singing a lullaby of leaves. That night, Amina and Malik asked their grandmother for a story from when she was little. They listened all the way to the end, then fell asleep. Shh… listen to the wind, and close your eyes.',
        },
        art: { sky: 'indigo', hero: '👵', props: ['👧', '👦', '🌳', '🌙'], ambience: 'stars' },
        prompt:
          'The grandmother with silver hair and a purple shawl tells a story to the sleepy girl with braids and the boy with round glasses tucked in bed, the huge ancient oak visible through the window under a starry moonlit sky.',
      },
    ],
  },

  // ────────────────────────────────────────────────────────── d08 · gratitude
  {
    id: 'd08',
    title: { fr: 'Le merci du hérisson', en: 'The Hedgehog’s Thank You' },
    teaser: {
      fr: 'Gaspard découvre que la journée est pleine de petits cadeaux.',
      en: 'Gaspard discovers that the day is full of little gifts.',
    },
    value: 'gratitude',
    moral: {
      fr: 'Quand on dit merci, on voit mieux toutes les belles choses autour de nous.',
      en: 'When we say thank you, we notice all the lovely things around us.',
    },
    emoji: '🦔',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'À l’orée d’un bois, sous un tas de feuilles dorées, vit Gaspard, un petit hérisson. Il porte un bonnet bleu tricoté, tout petit, posé entre ses piquants. Ce matin, Gaspard se réveille de mauvaise humeur. « Il ne m’arrive jamais rien de bien », grogne-t-il. Sa maman lui sourit : « Ouvre bien les yeux aujourd’hui. Tu verras. »',
          en: 'At the edge of a wood, under a pile of golden leaves, lives Gaspard, a little hedgehog. He wears a tiny knitted blue hat, perched between his prickles. This morning, Gaspard wakes up grumpy. “Nothing good ever happens to me,” he grumbles. His mummy smiles at him: “Keep your eyes wide open today. You’ll see.”',
        },
        art: { sky: 'dawn', hero: '🦔', props: ['🍂', '🌳', '🧶'], ambience: 'sunrise' },
        prompt:
          'A little hedgehog wearing a tiny knitted blue hat between his prickles wakes up grumpy in a cozy nest of golden leaves at the edge of a wood, his gentle mother hedgehog smiling beside him, soft dawn light.',
      },
      {
        text: {
          fr: 'Gaspard sort de son nid. Le soleil lui chatouille le museau. Un rayon tout chaud ! Puis une goutte de rosée tombe d’une feuille, juste sur sa langue. Elle est fraîche et délicieuse. Gaspard s’arrête. « Hmm… Merci, soleil. Merci, rosée », chuchote-t-il, un peu surpris. Et il continue sa promenade, à petits pas.',
          en: 'Gaspard comes out of his nest. The sun tickles his nose. Such a warm sunbeam! Then a drop of dew falls from a leaf, right onto his tongue. It is cool and delicious. Gaspard stops. “Hmm… Thank you, sun. Thank you, dew,” he whispers, a little surprised. And he carries on with his walk, with tiny steps.',
        },
        art: { sky: 'dawn', hero: '🦔', props: ['☀️', '💧', '🍃'], ambience: 'sunrise' },
        prompt:
          'The little hedgehog with a tiny knitted blue hat closes his eyes happily as a warm sunbeam touches his nose and a sparkling dewdrop falls from a leaf, fresh morning meadow, glowing gentle light.',
      },
      {
        text: {
          fr: 'Sur le chemin, une souris lui offre une fraise des bois. Un merle lui chante une jolie chanson. Une feuille d’automne tombe sur sa tête et le chatouille. Gaspard rit. « Merci, souris ! Merci, merle ! Merci, petite feuille ! » Et plus il dit merci, plus il remarque de jolies choses autour de lui.',
          en: 'Along the path, a mouse gives him a wild strawberry. A blackbird sings him a pretty song. An autumn leaf falls on his head and tickles him. Gaspard laughs. “Thank you, mouse! Thank you, blackbird! Thank you, little leaf!” And the more he says thank you, the more lovely things he notices around him.',
        },
        art: { sky: 'gold', hero: '🦔', props: ['🐭', '🍓', '🐦', '🍁'], ambience: 'petals' },
        prompt:
          'The little hedgehog with a tiny knitted blue hat laughs on a woodland path as a small grey mouse offers him a wild strawberry, a blackbird sings on a branch and an autumn leaf lands on his hat, golden light.',
      },
      {
        text: {
          fr: 'L’après-midi, il se met à pleuvoir. Gaspard fait la grimace. « Oh non, la pluie ! » Mais une grenouille l’invite sous un grand champignon. Ils regardent les gouttes danser dans les flaques. Ploc, ploc, ploc. Après la pluie, un arc-en-ciel s’étire dans le ciel. « Merci, la pluie ! Sans toi, pas d’arc-en-ciel ! »',
          en: 'In the afternoon, it starts to rain. Gaspard pulls a face. “Oh no, rain!” But a frog invites him under a big mushroom. They watch the drops dance in the puddles. Plip, plop, plip. After the rain, a rainbow stretches across the sky. “Thank you, rain! Without you, there would be no rainbow!”',
        },
        art: { sky: 'ocean', hero: '🦔', props: ['🐸', '🍄', '🌈'], ambience: 'bubbles' },
        prompt:
          'The little hedgehog with a tiny knitted blue hat and a friendly green frog shelter together under a big red mushroom, watching raindrops splash in puddles, a bright rainbow appearing in the clearing sky, fresh cheerful mood.',
      },
      {
        text: {
          fr: 'Le soir, Gaspard rentre chez lui. Sa maman l’attend avec un bol de soupe tiède et un câlin tout doux. Gaspard la serre fort. « Maman, aujourd’hui, j’ai reçu plein de cadeaux ! » Il compte sur ses petites pattes : le soleil, la rosée, la fraise, la chanson, la feuille, la grenouille, l’arc-en-ciel… « Et toi, maman. Merci. »',
          en: 'In the evening, Gaspard goes home. His mummy is waiting for him with a bowl of warm soup and a soft cuddle. Gaspard hugs her tight. “Mummy, today I got lots of presents!” He counts on his little paws: the sun, the dew, the strawberry, the song, the leaf, the frog, the rainbow… “And you, Mummy. Thank you.”',
        },
        art: { sky: 'rose', hero: '🦔', props: ['🥣', '🍂', '💛'], ambience: 'fireflies' },
        prompt:
          'The little hedgehog with a tiny knitted blue hat hugs his gentle mother hedgehog in their leafy nest, a small bowl of warm soup beside them, counting on his paws with a big smile, warm rosy evening light.',
      },
      {
        text: {
          fr: 'Gaspard se roule en boule dans son nid de feuilles. Il dit merci à la lune, merci aux étoiles, merci à la nuit douce et calme. Son cœur est chaud comme une petite bougie. Et toi, quelle jolie chose as-tu vue aujourd’hui ? Pense à elle, dis-lui merci tout bas… et ferme doucement les yeux.',
          en: 'Gaspard curls up into a ball in his nest of leaves. He says thank you to the moon, thank you to the stars, thank you to the soft and quiet night. His heart is as warm as a little candle. And you, what lovely thing did you see today? Think of it, whisper thank you… and gently close your eyes.',
        },
        art: { sky: 'indigo', hero: '🦔', props: ['🍂', '🌙', '⭐'], ambience: 'stars' },
        prompt:
          'The little hedgehog with a tiny knitted blue hat sleeps curled in a ball in his nest of golden leaves, a smiling crescent moon and twinkling stars above the quiet wood, deep blue night, cozy mood.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────── d09 · perseverance
  {
    id: 'd09',
    title: { fr: 'La tortue qui voulait voir la mer', en: 'The Tortoise Who Wanted to See the Sea' },
    teaser: {
      fr: 'Capucine avance lentement, un pas après l’autre, jusqu’à la mer.',
      en: 'Capucine walks slowly, one step after another, all the way to the sea.',
    },
    value: 'perseverance',
    moral: {
      fr: 'Pas à pas, on peut aller très loin.',
      en: 'Step by step, you can go a very long way.',
    },
    emoji: '🐢',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Dans un jardin plein de salades et de pâquerettes vivait Capucine, une petite tortue. Elle avait une carapace verte et brune, et un sac à dos jaune. Un jour, une mouette se posa près d’elle. « Ah, la mer ! raconta-t-elle. Elle est bleue, immense, et elle chante avec ses vagues. » Depuis ce jour, Capucine rêvait de voir la mer.',
          en: 'In a garden full of lettuces and daisies lived Capucine, a little tortoise. She had a green and brown shell, and a yellow backpack. One day, a seagull landed beside her. “Ah, the sea!” it said. “It is blue, enormous, and it sings with its waves.” From that day on, Capucine dreamed of seeing the sea.',
        },
        art: { sky: 'dawn', hero: '🐢', props: ['🥬', '🌼', '🕊️'], ambience: 'sunrise' },
        prompt:
          'A little tortoise with a green and brown shell and a small yellow backpack listens dreamily to a white seagull in a vegetable garden full of lettuces and daisies, a faint image of blue waves in her imagination, morning light.',
      },
      {
        text: {
          fr: 'Un matin, Capucine mit une pomme et une feuille de salade dans son sac. « Je pars voir la mer ! » annonça-t-elle. Le lapin rit gentiment : « Mais c’est très loin, et tu vas si lentement ! » Capucine sourit. « Je vais lentement, c’est vrai. Mais je ne m’arrête pas. Un pas, puis un autre. »',
          en: 'One morning, Capucine put an apple and a lettuce leaf in her backpack. “I’m off to see the sea!” she announced. The rabbit laughed kindly: “But it’s very far, and you go so slowly!” Capucine smiled. “I go slowly, that’s true. But I don’t stop. One step, then another.”',
        },
        art: { sky: 'dawn', hero: '🐢', props: ['🎒', '🍎', '🐰'], ambience: 'sunrise' },
        prompt:
          'The little tortoise with a green and brown shell and yellow backpack sets off cheerfully down a garden path with an apple peeking from her bag, a friendly brown rabbit watching with a kind smile, bright morning.',
      },
      {
        text: {
          fr: 'Capucine traversa la grande prairie. Un pas, puis un autre. Elle grimpa une colline toute raide. Un pas, puis un autre. Quand ses pattes étaient fatiguées, elle se reposait à l’ombre d’une fleur, puis elle repartait. Le soir, elle dormait dans sa carapace, sous les étoiles, en rêvant au bruit des vagues.',
          en: 'Capucine crossed the big meadow. One step, then another. She climbed a very steep hill. One step, then another. When her legs were tired, she rested in the shade of a flower, then set off again. At night, she slept inside her shell, under the stars, dreaming of the sound of the waves.',
        },
        art: { sky: 'violet', hero: '🐢', props: ['⛰️', '🌸', '⭐'], ambience: 'stars' },
        prompt:
          'The little tortoise with a green and brown shell and yellow backpack rests in the shade of a tall flower on a gentle hill after a long walk, a winding path behind her, violet evening sky with first stars.',
      },
      {
        text: {
          fr: 'Un jour, une grosse pluie tomba. Le chemin devint tout boueux. Capucine glissait, glissait encore. « C’est trop difficile », soupira-t-elle, et une petite larme roula sur sa joue. Alors la mouette revint. « Courage, Capucine ! Derrière la dune, la mer t’attend. » Capucine respira profondément. Un pas, puis un autre.',
          en: 'One day, heavy rain fell. The path became all muddy. Capucine slipped, and slipped again. “It’s too hard,” she sighed, and a little tear rolled down her cheek. Then the seagull came back. “Keep going, Capucine! Behind the dune, the sea is waiting for you.” Capucine took a deep breath. One step, then another.',
        },
        art: { sky: 'ocean', hero: '🐢', props: ['🌧️', '🕊️', '🏖️'], ambience: 'bubbles' },
        prompt:
          'The little tortoise with a green and brown shell and yellow backpack walks bravely along a muddy path in gentle rain, the white seagull flying beside her encouragingly, a sandy dune ahead, soft grey-blue light turning hopeful.',
      },
      {
        text: {
          fr: 'Elle grimpa la dune de sable, tout doucement. Et là, au sommet… la mer ! Bleue, immense, scintillante, exactement comme dans ses rêves. Les vagues chantaient : « chhh, chhh ». Capucine avança jusqu’à l’eau, et une vague toute douce vint lui chatouiller les pattes. « J’ai réussi ! » cria-t-elle de joie. La mouette fit une pirouette dans le ciel.',
          en: 'She climbed the sand dune, very slowly. And there, at the top… the sea! Blue, enormous, sparkling, just like in her dreams. The waves were singing: “shhh, shhh.” Capucine walked down to the water, and a very gentle wave came to tickle her feet. “I made it!” she cried with joy. The seagull did a twirl in the sky.',
        },
        art: { sky: 'ocean', hero: '🐢', props: ['🌊', '🐚', '🕊️'], ambience: 'bubbles' },
        prompt:
          'The little tortoise with a green and brown shell and yellow backpack stands joyfully at the edge of a sparkling blue sea as a gentle wave touches her feet, the white seagull twirling in the bright sky, shells on the sand.',
      },
      {
        text: {
          fr: 'Le soleil se coucha sur la mer, tout orange, puis tout rose. Capucine s’installa sur le sable tiède, à côté de la mouette. Les vagues chantaient leur berceuse : chhh, chhh, chhh. Capucine pensa à son long voyage, à tous ses petits pas. Ses yeux se fermèrent lentement. Écoute les vagues… et ferme doucement les yeux, toi aussi.',
          en: 'The sun set over the sea, all orange, then all pink. Capucine settled on the warm sand, next to the seagull. The waves were singing their lullaby: shhh, shhh, shhh. Capucine thought about her long journey, about all her little steps. Her eyes slowly closed. Listen to the waves… and gently close your eyes, you too.',
        },
        art: { sky: 'rose', hero: '🐢', props: ['🌊', '🌅', '🕊️'], ambience: 'stars' },
        prompt:
          'The little tortoise with a green and brown shell and yellow backpack falls asleep on warm sand beside the white seagull, the sea glowing orange and pink under the setting sun, first stars appearing, calm lullaby mood.',
      },
    ],
  },

  // ──────────────────────────────────────────────────────── d10 · forgiveness
  {
    id: 'd10',
    title: { fr: 'Les deux pingouins fâchés', en: 'The Two Cross Penguins' },
    teaser: {
      fr: 'Kiko et Nuna se disputent… puis découvrent la douceur du pardon.',
      en: 'Kiko and Nuna quarrel… then discover how sweet forgiving can be.',
    },
    value: 'forgiveness',
    moral: {
      fr: 'Pardonner, c’est ouvrir la porte pour que l’amitié revienne.',
      en: 'Forgiving opens the door so friendship can come back.',
    },
    emoji: '🐧',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Sur la banquise toute blanche, là où la neige brille comme du sucre, vivent deux pingouins. Kiko porte une écharpe rouge. Nuna porte un bonnet bleu avec un pompon. Ce sont les meilleurs amis du monde. Ensemble, ils glissent sur le ventre, attrapent des flocons et regardent les lumières du ciel danser la nuit.',
          en: 'On the bright white ice, where the snow sparkles like sugar, live two penguins. Kiko wears a red scarf. Nuna wears a blue bobble hat. They are the best friends in the whole world. Together, they slide on their tummies, catch snowflakes and watch the lights in the sky dance at night.',
        },
        art: { sky: 'snow', hero: '🐧', props: ['🐧', '❄️', '🧣'], ambience: 'snow' },
        prompt:
          'Two small penguins on a sparkling white ice field, one wearing a red scarf and the other a blue bobble hat, sliding happily on their tummies and catching snowflakes, soft green and pink polar lights in the sky.',
      },
      {
        text: {
          fr: 'Un matin, Kiko et Nuna décident de construire un château de neige. Le plus beau château de la banquise ! Mais très vite, ils ne sont plus d’accord. « La tour va ici ! » dit Kiko. « Non, elle va là ! » dit Nuna. Ils tirent chacun de leur côté, et pouf… le château s’écroule.',
          en: 'One morning, Kiko and Nuna decide to build a snow castle. The most beautiful castle on the ice! But very soon, they no longer agree. “The tower goes here!” says Kiko. “No, it goes there!” says Nuna. They each pull their own way, and poof… the castle tumbles down.',
        },
        art: { sky: 'snow', hero: '🏰', props: ['🐧', '🐧', '❄️'], ambience: 'snow' },
        prompt:
          'The penguin with a red scarf and the penguin with a blue bobble hat each tug at a block of snow in opposite directions as their half-built snow castle softly collapses into a fluffy heap, bright snowy morning.',
      },
      {
        text: {
          fr: '« C’est ta faute ! » dit Kiko. « Non, c’est la tienne ! » répond Nuna. Ils se tournent le dos. Kiko s’en va sur un bloc de glace, Nuna sur un autre. Chacun boude dans son coin, les ailes croisées. Le vent souffle, froid et gris. Il n’y a plus de rires sur la banquise.',
          en: '“It’s your fault!” says Kiko. “No, it’s yours!” answers Nuna. They turn their backs on each other. Kiko goes off onto one block of ice, Nuna onto another. Each one sulks in a corner, flippers folded. The wind blows, cold and grey. There is no more laughter on the ice.',
        },
        art: { sky: 'ocean', hero: '🐧', props: ['🧊', '🧊', '🌬️'], ambience: 'snow' },
        prompt:
          'The penguin with a red scarf and the penguin with a blue bobble hat sit sulking on two separate small ice blocks with their backs to each other, flippers folded, soft grey-blue sky, quiet pouting mood.',
      },
      {
        text: {
          fr: 'Le temps passe. Kiko regarde Nuna de loin. Il se souvient de leurs glissades et de leurs fous rires. Nuna, elle, regarde l’écharpe rouge de Kiko. Elle se souvient du soir où il l’a partagée avec elle, quand elle avait froid. Leurs petits cœurs sont tout serrés. « Mon amie me manque », pense Kiko. « Mon ami me manque », pense Nuna.',
          en: 'Time goes by. Kiko looks at Nuna from far away. He remembers their slides and their giggles. Nuna looks at Kiko’s red scarf. She remembers the evening he shared it with her, when she was cold. Their little hearts feel tight. “I miss my friend,” thinks Kiko. “I miss my friend,” thinks Nuna.',
        },
        art: { sky: 'violet', hero: '🐧', props: ['🧣', '💭', '🧊'], ambience: 'snow' },
        prompt:
          'The penguin with a red scarf and the penguin with a blue bobble hat glance at each other from two ice blocks, each with a soft thought bubble showing them laughing together, gentle violet light, tender longing mood.',
      },
      {
        text: {
          fr: 'Alors, en même temps, ils se lèvent et glissent l’un vers l’autre. « Pardon, Nuna. Je me suis fâché trop vite. » « Pardon, Kiko. Moi aussi. Je te pardonne. » « Et moi aussi, je te pardonne. » Ils se font un gros câlin de pingouins. Puis ils reconstruisent le château, avec deux tours : une pour chacun !',
          en: 'Then, at the very same moment, they get up and slide towards each other. “I’m sorry, Nuna. I got cross too quickly.” “I’m sorry, Kiko. Me too. I forgive you.” “And I forgive you too.” They give each other a big penguin hug. Then they build the castle again, with two towers: one for each of them!',
        },
        art: { sky: 'dawn', hero: '🐧', props: ['🐧', '🏰', '💙'], ambience: 'snow' },
        prompt:
          'The penguin with a red scarf and the penguin with a blue bobble hat share a big warm hug on the ice, then a cheerful snow castle with two towers stands beside them, soft pink sunlight on the snow, joyful mood.',
      },
      {
        text: {
          fr: 'Le soir, la lune se lève au-dessus de leur château de neige. Kiko et Nuna s’assoient tout près l’un de l’autre, sous la même écharpe rouge. Les étoiles clignent des yeux. La banquise est calme et silencieuse. Les deux amis bâillent en même temps, puis s’endorment, réconciliés. À ton tour, ferme les yeux, tout doucement.',
          en: 'In the evening, the moon rises above their snow castle. Kiko and Nuna sit very close together, under the same red scarf. The stars blink their eyes. The ice is calm and silent. The two friends yawn at the same time, then fall asleep, friends again. Now it’s your turn: close your eyes, very gently.',
        },
        art: { sky: 'indigo', hero: '🐧', props: ['🐧', '🏰', '🌙'], ambience: 'stars' },
        prompt:
          'The penguin with a red scarf and the penguin with a blue bobble hat sleep snuggled together under one red scarf beside their two-towered snow castle, a full moon and twinkling stars over the quiet ice, peaceful night.',
      },
    ],
  },
];
