/**
 * Mode dodo — stories 11 to 20.
 * Hand-written bedtime stories, French first, faithful English translation.
 */
import type { DodoStory } from './types';

export const STORIES_2: DodoStory[] = [
  // ───────────────────────────── d11 · empathy ─────────────────────────────
  {
    id: 'd11',
    title: { fr: 'La baleine qui chantait tout bas', en: 'The Whale Who Sang Softly' },
    teaser: {
      fr: 'Un petit poisson écoute la chanson d’une baleine et comprend son cœur.',
      en: 'A little fish listens to a whale’s song and understands her heart.',
    },
    value: 'empathy',
    moral: {
      fr: 'Quand on écoute vraiment le cœur des autres, on les aide déjà à aller mieux.',
      en: 'When we truly listen to someone’s heart, we are already helping them feel better.',
    },
    emoji: '🐋',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Tout au fond de la mer, là où l’eau est bleue et douce, vivait un petit poisson orange qui s’appelait Tiko. Tiko aimait nager entre les algues qui dansaient. Chaque soir, la lune posait sur l’eau une longue traînée d’argent. Et chaque soir, Tiko entendait une chanson très lointaine. Une chanson toute basse, toute douce… et un peu triste.',
          en: 'Deep down in the sea, where the water is blue and soft, lived a little orange fish called Tiko. Tiko loved to swim among the dancing seaweed. Every evening, the moon laid a long silver trail on the water. And every evening, Tiko heard a faraway song. A very soft song, a very gentle song… and a little bit sad.',
        },
        art: { sky: 'ocean', hero: '🐠', props: ['🌿', '🐚', '🌙'], ambience: 'bubbles' },
        prompt:
          'A small orange fish with one bright blue fin swims between swaying green seaweed above a sandy seabed, silver moonlight streaming down through calm blue water, a faint glow in the distance, peaceful and curious mood.',
      },
      {
        text: {
          fr: 'Tiko était curieux. Il suivit la chanson, doucement, doucement, au-dessus du sable et des coquillages. Et là, près d’un grand rocher, il vit une baleine immense. Elle était grise et bleue, avec un ventre tout pâle. Elle s’appelait Maïa. Elle chantait tout bas, les yeux fermés. Tiko s’approcha sans faire de bruit. « Bonsoir, Maïa. Pourquoi ta chanson est-elle si triste ? »',
          en: 'Tiko was curious. He followed the song, slowly, slowly, over the sand and the seashells. And there, near a big rock, he saw a huge whale. She was grey and blue, with a pale belly. Her name was Maïa. She was singing very softly, with her eyes closed. Tiko came closer without a sound. “Good evening, Maïa. Why is your song so sad?”',
        },
        art: { sky: 'ocean', hero: '🐋', props: ['🐠', '🪨', '🐚'], ambience: 'bubbles' },
        prompt:
          'A huge grey-blue whale with a pale belly and gentle closed eyes rests beside a large mossy rock on the seabed, a small orange fish with one blue fin approaching shyly, soft moonbeams in deep blue water, tender quiet mood.',
      },
      {
        text: {
          fr: 'Maïa ouvrit un œil. « Ma famille est partie nager vers les mers chaudes, dit-elle. Moi, je suis restée ici pour soigner ma nageoire. Elle va mieux, mais ils me manquent. » Tiko ne dit rien tout de suite. Il ne chercha pas à la faire rire. Il nagea tout près d’elle, et il écouta. Parfois, écouter, c’est déjà un câlin.',
          en: 'Maïa opened one eye. “My family swam away to the warm seas,” she said. “I stayed here to rest my fin. It is better now, but I miss them.” Tiko did not say anything right away. He did not try to make her laugh. He swam very close to her, and he listened. Sometimes, listening is already a hug.',
        },
        art: { sky: 'ocean', hero: '🐋', props: ['🐠', '💙', '🌿'], ambience: 'moon' },
        prompt:
          'A small orange fish with one blue fin floats close to the eye of a huge grey-blue whale with a pale belly, both quiet and attentive, seaweed swaying around them, soft silver moonlight in calm blue water, warm comforting mood.',
      },
      {
        text: {
          fr: '« Je comprends, murmura Tiko. Quand mon grand frère est parti explorer le récif, moi aussi, j’avais le cœur tout lourd. » Maïa le regarda avec douceur. « Alors tu sais ce que je ressens. » Tiko hocha la tête. Ensemble, ils regardèrent la lune trembler sur l’eau. Et la chanson de Maïa devint un peu moins triste, un peu plus tendre.',
          en: '“I understand,” whispered Tiko. “When my big brother left to explore the reef, my heart felt heavy too.” Maïa looked at him gently. “Then you know how I feel.” Tiko nodded. Together, they watched the moon shimmer on the water. And Maïa’s song became a little less sad, and a little more tender.',
        },
        art: { sky: 'ocean', hero: '🐠', props: ['🐋', '🌕', '✨'], ambience: 'moon' },
        prompt:
          'A huge grey-blue whale with a pale belly and a small orange fish with one blue fin look up together at the round moon shimmering through the sea surface, rays of silver light, calm blue water, gentle hopeful mood.',
      },
      {
        text: {
          fr: 'Soudain, très loin, une autre chanson répondit. Puis une autre encore ! C’était la famille de Maïa, qui l’appelait doucement. « Ils m’attendent, dit Maïa. Demain, je les rejoindrai. » Puis elle sourit à Tiko. « Merci d’avoir écouté mon cœur. Tu es tout petit, mais ta gentillesse est grande comme l’océan. » Tiko rougit… enfin, il devint encore plus orange !',
          en: 'Suddenly, far away, another song answered. Then another one! It was Maïa’s family, calling her softly. “They are waiting for me,” said Maïa. “Tomorrow, I will join them.” Then she smiled at Tiko. “Thank you for listening to my heart. You are very small, but your kindness is as big as the ocean.” Tiko blushed… well, he turned even more orange!',
        },
        art: { sky: 'ocean', hero: '🐋', props: ['🐳', '🐳', '🐠', '🎶'], ambience: 'bubbles' },
        prompt:
          'A huge grey-blue whale with a pale belly smiles at a small orange fish with one blue fin, while distant whale silhouettes glow softly in the deep blue sea, streams of tiny bubbles rising, joyful reassuring mood.',
      },
      {
        text: {
          fr: 'Cette nuit-là, Maïa chanta une nouvelle chanson. Une chanson toute basse, toute douce, et pleine de joie. Tiko se blottit dans une algue, juste à côté d’elle. Les bulles montaient vers la lune, une par une, comme de petites perles. Tiko bâilla. Ses nageoires ralentirent. Et toi aussi, tu peux fermer les yeux… et écouter la chanson de la mer.',
          en: 'That night, Maïa sang a new song. A very soft song, a very gentle song, full of joy. Tiko snuggled into some seaweed, right beside her. Bubbles floated up towards the moon, one by one, like tiny pearls. Tiko yawned. His fins slowed down. And you can close your eyes too… and listen to the song of the sea.',
        },
        art: { sky: 'indigo', hero: '🐠', props: ['🐋', '🌿', '🫧'], ambience: 'bubbles' },
        prompt:
          'A small orange fish with one blue fin sleeps curled in soft green seaweed next to a huge grey-blue whale with a pale belly singing peacefully, pearly bubbles rising toward a glowing moon above the water, dreamy calm night.',
      },
    ],
  },

  // ───────────────────────────── d12 · nature ─────────────────────────────
  {
    id: 'd12',
    title: { fr: 'Le jardin des abeilles', en: 'The Bee Garden' },
    teaser: {
      fr: 'Amina découvre pourquoi les abeilles et les fleurs ont besoin de nous.',
      en: 'Amina discovers why bees and flowers need our care.',
    },
    value: 'nature',
    moral: {
      fr: 'Prendre soin de la nature, même avec une toute petite fleur, c’est prendre soin de tout le monde.',
      en: 'Caring for nature, even with one tiny flower, means caring for everyone.',
    },
    emoji: '🐝',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Au bout d’une petite rue, il y avait une cour avec un vieux pommier. C’est là que vivait Amina, une petite fille aux cheveux bouclés, avec un ruban jaune. Le soir, Amina aimait s’asseoir sous le pommier. L’air sentait l’herbe tiède. Le ciel devenait rose, puis doré. Mais cette année, Amina remarqua une chose étrange : on n’entendait presque plus de bzzz.',
          en: 'At the end of a little street, there was a courtyard with an old apple tree. That is where Amina lived, a little girl with curly hair and a yellow ribbon. In the evening, Amina liked to sit under the apple tree. The air smelled of warm grass. The sky turned pink, then golden. But this year, Amina noticed something strange: she could hardly hear any buzzing.',
        },
        art: { sky: 'dawn', hero: '👧🏾', props: ['🌳', '🏡', '🌾'], ambience: 'sunrise' },
        prompt:
          'A little girl with curly black hair tied with a yellow ribbon, wearing green overalls, sits under an old apple tree in a quiet courtyard, pink and golden evening sky, few flowers around, thoughtful gentle mood.',
      },
      {
        text: {
          fr: 'Un après-midi, une petite abeille se posa sur sa main. Elle avait l’air toute fatiguée. « Bonjour, petite abeille. Qu’est-ce qui ne va pas ? » L’abeille bourdonna tout bas. Amina courut voir son grand-père, Papi Samir. « Papi, l’abeille est si fatiguée ! » Papi Samir sourit doucement. « Elle cherche des fleurs, ma chérie. Les fleurs, c’est sa cantine. Et ici, il n’y en a presque plus. »',
          en: 'One afternoon, a little bee landed on her hand. She looked very tired. “Hello, little bee. What’s wrong?” The bee buzzed very quietly. Amina ran to see her grandfather, Grandpa Samir. “Grandpa, the bee is so tired!” Grandpa Samir smiled gently. “She is looking for flowers, my darling. Flowers are her lunchroom. And here, there are hardly any left.”',
        },
        art: { sky: 'gold', hero: '🐝', props: ['👧🏾', '👴🏾', '✋'], ambience: 'sunrise' },
        prompt:
          'A little girl with curly black hair, a yellow ribbon and green overalls gently holds a tiny tired bee on her open hand, beside her kind grandfather with a short white beard and a straw hat, warm afternoon light, caring mood.',
      },
      {
        text: {
          fr: 'Papi Samir lui expliqua tout. Les abeilles boivent le nectar des fleurs. En volant de fleur en fleur, elles transportent une poudre dorée : le pollen. Grâce à elles, les fleurs donnent des fruits : des pommes, des fraises, des cerises. « Alors, les abeilles aident les fleurs, et les fleurs aident les abeilles ? » demanda Amina. « Exactement, dit Papi. Elles sont amies depuis toujours. »',
          en: 'Grandpa Samir explained everything. Bees drink the nectar from flowers. As they fly from flower to flower, they carry a golden powder: pollen. Thanks to them, flowers grow into fruit: apples, strawberries, cherries. “So the bees help the flowers, and the flowers help the bees?” asked Amina. “Exactly,” said Grandpa. “They have been friends forever.”',
        },
        art: { sky: 'gold', hero: '👴🏾', props: ['👧🏾', '🌸', '🍎', '🍓'], ambience: 'petals' },
        prompt:
          'A kind grandfather with a short white beard and a straw hat points at a blossom with a bee covered in golden pollen, a little girl with curly black hair, yellow ribbon and green overalls listens with wonder, sunny garden, curious mood.',
      },
      {
        text: {
          fr: 'Le lendemain, Amina mit ses bottes vertes. Avec Papi Samir, elle creusa de petits trous dans la terre. Elle planta de la lavande, du trèfle, des soucis et un grand tournesol. Elle posa une coupelle d’eau avec des cailloux, pour que les abeilles puissent boire sans se mouiller les pattes. Chaque jour, elle arrosait son jardin. Doucement. Patiemment.',
          en: 'The next day, Amina put on her green boots. With Grandpa Samir, she dug little holes in the earth. She planted lavender, clover, marigolds and a tall sunflower. She set out a little dish of water with pebbles, so the bees could drink without getting their feet wet. Every day, she watered her garden. Gently. Patiently.',
        },
        art: { sky: 'dawn', hero: '👧🏾', props: ['🌱', '🌻', '🪴', '💧'], ambience: 'sunrise' },
        prompt:
          'A little girl with curly black hair, a yellow ribbon, green overalls and green boots plants lavender and a young sunflower with her grandfather in a straw hat, a small dish of water with pebbles nearby, soft morning light, hopeful mood.',
      },
      {
        text: {
          fr: 'Quelques semaines plus tard, le jardin était plein de couleurs. Violet, jaune, orange, blanc. Et partout, on entendait : bzzz, bzzz, bzzz ! Les abeilles étaient revenues. La petite abeille fatiguée était là aussi, ronde et joyeuse. Elle fit trois petits tours autour d’Amina, comme une danse pour dire merci. Sur le vieux pommier, les premières pommes commençaient à pousser.',
          en: 'A few weeks later, the garden was full of colours. Purple, yellow, orange, white. And everywhere, you could hear: buzz, buzz, buzz! The bees had come back. The little tired bee was there too, round and happy. She flew three little circles around Amina, like a dance to say thank you. On the old apple tree, the first apples were starting to grow.',
        },
        art: { sky: 'gold', hero: '🐝', props: ['🌻', '🌼', '🍎', '👧🏾'], ambience: 'petals' },
        prompt:
          'A blooming courtyard garden full of purple lavender, white clover, orange marigolds and a tall sunflower, happy bees flying everywhere, a little girl with curly black hair, yellow ribbon and green overalls laughing, small apples on an old tree, joyful golden light.',
      },
      {
        text: {
          fr: 'Le soir tombe sur le jardin. Les abeilles rentrent à la ruche, les pattes pleines de pollen doré. Quelques-unes s’endorment même au creux d’une fleur, bien au chaud. La lavande sent bon. Amina bâille dans son lit, la fenêtre entrouverte. Elle entend un tout dernier bzzz… très doux, comme une berceuse. Chut… le jardin dort. Et toi aussi, tu peux t’endormir.',
          en: 'Evening falls on the garden. The bees fly home to the hive, their legs full of golden pollen. A few even fall asleep inside a flower, snug and warm. The lavender smells lovely. Amina yawns in her bed, her window half open. She hears one last buzz… very soft, like a lullaby. Shh… the garden is asleep. And you can fall asleep too.',
        },
        art: { sky: 'violet', hero: '🐝', props: ['🌸', '🪻', '🛏️', '🌙'], ambience: 'fireflies' },
        prompt:
          'Night falls over a flower garden, a bee sleeping curled inside a closed blossom, lavender under a crescent moon, a little girl with curly black hair asleep in bed behind a half-open window, soft violet light, fireflies, peaceful lullaby mood.',
      },
    ],
  },

  // ───────────────────────────── d13 · cooperation ─────────────────────────────
  {
    id: 'd13',
    title: { fr: 'Les fourmis et la feuille géante', en: 'The Ants and the Giant Leaf' },
    teaser: {
      fr: 'Une feuille trop lourde pour une fourmi… mais pas pour toutes ensemble !',
      en: 'A leaf too heavy for one ant… but not for all of them together!',
    },
    value: 'cooperation',
    moral: {
      fr: 'Ensemble, même les plus petits peuvent porter de très grandes choses.',
      en: 'Together, even the smallest ones can carry very big things.',
    },
    emoji: '🐜',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Dans un grand pré plein d’herbes hautes, il y avait une petite fourmilière. Elle ressemblait à une colline de sable, avec mille petites portes. Là vivait Pico, une fourmi rousse qui portait toujours un minuscule foulard bleu. Pico était très petit, même pour une fourmi. Mais il avait un grand cœur, et des pattes qui ne s’arrêtaient jamais de trotter.',
          en: 'In a big meadow full of tall grass, there was a little anthill. It looked like a hill of sand, with a thousand tiny doors. There lived Pico, a reddish-brown ant who always wore a tiny blue scarf. Pico was very small, even for an ant. But he had a big heart, and legs that never stopped trotting.',
        },
        art: { sky: 'gold', hero: '🐜', props: ['🌾', '⛰️', '🌼'], ambience: 'sunrise' },
        prompt:
          'A tiny reddish-brown ant wearing a small blue scarf trots in front of a sandy anthill with many little doorways, tall meadow grass and daisies towering around, warm late-afternoon light, cheerful cosy mood.',
      },
      {
        text: {
          fr: 'Un soir d’automne, le vent souffla doucement. Une feuille géante tomba de l’arbre, toute dorée, toute large. « Oh ! dit Pico. Avec cette feuille, on pourrait faire un toit pour la fourmilière. Comme ça, la pluie de cette nuit ne mouillera pas les petits. » Il attrapa la feuille et tira très fort… Mais la feuille ne bougea pas d’un millimètre.',
          en: 'One autumn evening, the wind blew softly. A giant leaf fell from the tree, all golden, all wide. “Oh!” said Pico. “With this leaf, we could make a roof for the anthill. Then tonight’s rain won’t get the little ones wet.” He grabbed the leaf and pulled very hard… But the leaf did not move one tiny bit.',
        },
        art: { sky: 'dawn', hero: '🐜', props: ['🍂', '🌳', '💨'], ambience: 'sunrise' },
        prompt:
          'A tiny reddish-brown ant in a small blue scarf pulls with all his strength on the edge of a giant golden autumn leaf lying on the grass, a big tree behind, soft autumn evening light, determined and gentle mood.',
      },
      {
        text: {
          fr: 'Nina la fourmi arriva. Elle poussa la feuille, toute seule. Rien. Puis ce fut Bilou, le plus costaud. Il souleva, souleva… Rien du tout. « Elle est trop lourde ! » soupirèrent-ils. Pico s’assit sur un caillou. Il regarda la feuille. Il regarda ses amis. Et soudain, il eut une idée. « Et si on essayait… tous ensemble ? »',
          en: 'Nina the ant arrived. She pushed the leaf, all by herself. Nothing. Then came Bilou, the strongest one. He lifted and lifted… Nothing at all. “It’s too heavy!” they sighed. Pico sat down on a pebble. He looked at the leaf. He looked at his friends. And suddenly, he had an idea. “What if we tried… all together?”',
        },
        art: { sky: 'dawn', hero: '🐜', props: ['🐜', '🐜', '🍂', '🪨'], ambience: 'sunrise' },
        prompt:
          'A tiny reddish-brown ant in a small blue scarf sits on a pebble with a bright idea, next to a slim ant with a pink bow and a sturdy ant with a green cap, a giant golden leaf beside them, autumn grass, hopeful mood.',
      },
      {
        text: {
          fr: 'Alors, toutes les fourmis vinrent. Les grandes, les petites, les rapides et les plus lentes. Chacune prit un petit bout de la feuille. « À trois ! dit Pico. Un… deux… trois ! » Et hop ! La feuille géante se souleva, comme un grand bateau doré. Elle avançait sur des centaines de petites pattes. Tap, tap, tap, tap, tout doucement.',
          en: 'So all the ants came. The big ones, the small ones, the fast ones and the slower ones. Each one held a little piece of the leaf. “On three!” said Pico. “One… two… three!” And up! The giant leaf rose, like a big golden boat. It moved forward on hundreds of tiny legs. Tap, tap, tap, tap, very gently.',
        },
        art: { sky: 'gold', hero: '🍂', props: ['🐜', '🐜', '🐜', '🐜'], ambience: 'sunrise' },
        prompt:
          'Dozens of small ants carry a giant golden leaf above their heads like a boat across the meadow, a tiny reddish-brown ant in a blue scarf leading at the front, warm golden evening light, joyful teamwork mood.',
      },
      {
        text: {
          fr: 'Ils traversèrent les herbes, passèrent sous une marguerite, contournèrent une flaque. Quand une fourmi était fatiguée, une autre prenait sa place. Personne ne restait seul. Enfin, ils posèrent la feuille sur la fourmilière. Elle faisait un toit parfait ! Pico regarda ses amis, tout fier. Aucun d’eux n’aurait pu le faire seul. Mais ensemble, ils avaient réussi.',
          en: 'They crossed the grass, passed under a daisy, and went around a puddle. When one ant was tired, another took its place. Nobody was left alone. At last, they laid the leaf on top of the anthill. It made a perfect roof! Pico looked at his friends, very proud. None of them could have done it alone. But together, they had done it.',
        },
        art: { sky: 'dawn', hero: '🐜', props: ['🍂', '⛰️', '🌼', '🎉'], ambience: 'fireflies' },
        prompt:
          'A sandy anthill covered by a giant golden leaf like a perfect roof, many small ants cheering around it, a tiny reddish-brown ant in a blue scarf smiling proudly, a daisy and a small puddle nearby, dusk light, proud happy mood.',
      },
      {
        text: {
          fr: 'Juste à ce moment, la pluie commença à tomber. Plic, ploc, plic, ploc, sur le grand toit doré. Mais dessous, tout était sec et tiède. Les fourmis se serrèrent les unes contre les autres. Pico remonta son foulard bleu jusqu’au menton. Plic, ploc… Ses yeux se fermèrent tout doucement. Écoute la pluie, toi aussi. Plic… ploc… Bonne nuit.',
          en: 'Just then, the rain began to fall. Pitter, patter, pitter, patter, on the big golden roof. But underneath, everything was dry and warm. The ants snuggled up close to one another. Pico pulled his blue scarf up to his chin. Pitter, patter… His eyes closed very slowly. Listen to the rain, you too. Pitter… patter… Good night.',
        },
        art: { sky: 'indigo', hero: '🐜', props: ['🍂', '🌧️', '💤'], ambience: 'stars' },
        prompt:
          'Inside a cosy anthill chamber under a golden leaf roof, little ants sleep snuggled together, a tiny reddish-brown ant with a blue scarf pulled up to his chin dozing, gentle raindrops on the leaf above, soft night blue light, peaceful mood.',
      },
    ],
  },

  // ───────────────────────────── d14 · self_confidence ─────────────────────────────
  {
    id: 'd14',
    title: { fr: 'Le petit hibou qui chantait différemment', en: 'The Little Owl Who Sang Differently' },
    teaser: {
      fr: 'Oscar trouve sa chanson bizarre… jusqu’à la nuit où la forêt en a besoin.',
      en: 'Oscar thinks his song is odd… until the night the forest needs it.',
    },
    value: 'self_confidence',
    moral: {
      fr: 'Crois en ta propre voix : elle a sa place dans le monde, telle qu’elle est.',
      en: 'Believe in your own voice: it has its place in the world, just as it is.',
    },
    emoji: '🦉',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Au milieu de la forêt, dans un vieux chêne, vivait un petit hibou nommé Oscar. Il avait des plumes brunes, un ventre crème tout doux et de grands yeux couleur de miel. Chaque nuit, les hiboux de la forêt chantaient sur les branches. « Hou ! Hou ! » faisaient-ils, d’une voix forte et grave. Leurs chansons résonnaient entre les arbres, jusqu’à la rivière.',
          en: 'In the middle of the forest, in an old oak tree, lived a little owl named Oscar. He had brown feathers, a soft cream-coloured belly and big honey-coloured eyes. Every night, the owls of the forest sang on the branches. “Hoo! Hoo!” they called, in strong, deep voices. Their songs echoed between the trees, all the way to the river.',
        },
        art: { sky: 'forest', hero: '🦉', props: ['🌳', '🦉', '🌙'], ambience: 'moon' },
        prompt:
          'A small round owl with brown feathers, a fluffy cream belly and big honey-coloured eyes peeks from a hollow in an old oak, larger owls hooting on moonlit branches nearby, deep green forest, a silver river far away, calm night.',
      },
      {
        text: {
          fr: 'Oscar, lui, ne chantait pas comme les autres. Quand il ouvrait le bec, il sortait un drôle de son : « Hou-lou-lou… » Une petite chanson ronde, douce et légère. Oscar baissait la tête. « Ma chanson est bizarre, pensait-il. Elle n’est pas assez forte. » Alors, chaque nuit, il restait caché dans son trou d’arbre. Et il ne chantait pas.',
          en: 'Oscar did not sing like the others. When he opened his beak, out came a funny sound: “Hoo-loo-loo…” A small, round song, soft and light. Oscar lowered his head. “My song is strange,” he thought. “It isn’t loud enough.” So every night, he stayed hidden in his tree hollow. And he did not sing.',
        },
        art: { sky: 'forest', hero: '🦉', props: ['🌳', '🎵', '🍂'], ambience: 'stars' },
        prompt:
          'A small owl with brown feathers, a fluffy cream belly and big honey-coloured eyes hides shyly inside a tree hollow, head lowered, a few tiny musical notes drifting faintly, starry forest night, gentle shy mood.',
      },
      {
        text: {
          fr: 'Une nuit, le vent se mit à souffler dans les feuilles. La forêt était agitée. Le petit faon ne trouvait pas le sommeil. Les lapereaux se tournaient et se retournaient. Même l’écureuil avait les yeux grands ouverts. Les grands hiboux chantèrent : « Hou ! Hou ! » Mais c’était trop fort. Personne n’arrivait à s’endormir. Tout le monde soupirait dans le noir.',
          en: 'One night, the wind began to blow through the leaves. The forest was restless. The little fawn could not fall asleep. The baby rabbits tossed and turned. Even the squirrel had his eyes wide open. The big owls sang: “Hoo! Hoo!” But it was too loud. Nobody could fall asleep. Everyone sighed in the dark.',
        },
        art: { sky: 'forest', hero: '🦌', props: ['🐇', '🐿️', '🍃', '💨'], ambience: 'stars' },
        prompt:
          'A spotted little fawn lying awake on moss, small grey baby rabbits wriggling in their burrow, a red squirrel wide-eyed on a branch, leaves swirling in a breezy night forest, soft blue-green moonlight, restless but safe mood.',
      },
      {
        text: {
          fr: 'Oscar regarda ses amis fatigués. Son cœur battait vite. Et si sa chanson pouvait aider ? Il prit une grande inspiration. Il ouvrit doucement le bec. « Hou-lou-lou… hou-lou-lou… » La petite chanson ronde glissa entre les arbres, comme une couverture légère. Le vent se calma. Les feuilles cessèrent de trembler. Et toute la forêt se mit à écouter.',
          en: 'Oscar looked at his tired friends. His heart was beating fast. What if his song could help? He took a big breath. He gently opened his beak. “Hoo-loo-loo… hoo-loo-loo…” The small, round song drifted between the trees, like a light blanket. The wind calmed down. The leaves stopped trembling. And the whole forest began to listen.',
        },
        art: { sky: 'forest', hero: '🦉', props: ['🎶', '🌳', '🍃'], ambience: 'moon' },
        prompt:
          'A small owl with brown feathers, a fluffy cream belly and big honey-coloured eyes sings softly from a high oak branch, gentle swirls of silvery light flowing between the trees like a blanket, the forest becoming still, moonlit, brave tender mood.',
      },
      {
        text: {
          fr: 'Le petit faon posa sa tête sur la mousse. Les lapereaux se blottirent contre leur maman. L’écureuil ferma un œil, puis l’autre. Le vieux hibou Gaspard s’approcha d’Oscar. « Ta chanson est différente, dit-il avec un sourire. Et c’est justement pour ça qu’elle est précieuse. Elle apaise toute la forêt. » Oscar gonfla ses plumes, tout heureux.',
          en: 'The little fawn laid its head on the moss. The baby rabbits snuggled up to their mother. The squirrel closed one eye, then the other. Old Gaspard the owl came over to Oscar. “Your song is different,” he said with a smile. “And that is exactly why it is precious. It soothes the whole forest.” Oscar puffed up his feathers, very happy.',
        },
        art: { sky: 'forest', hero: '🦉', props: ['🦉', '🦌', '🐇', '🐿️'], ambience: 'fireflies' },
        prompt:
          'A big grey owl with white eyebrows smiles kindly at a small owl with brown feathers, a fluffy cream belly and honey-coloured eyes who puffs up proudly, below them a spotted fawn and grey rabbits dozing on moss, fireflies glowing, warm proud mood.',
      },
      {
        text: {
          fr: 'Depuis cette nuit-là, Oscar chante chaque soir sur la plus haute branche. Il n’a plus honte de sa chanson. Il la chante avec tout son cœur. « Hou-lou-lou… » La lune l’écoute. Les étoiles clignent des yeux. Et les animaux s’endorment, un par un. Ferme les yeux, toi aussi. Écoute… hou-lou-lou… hou-lou-lou…',
          en: 'Since that night, Oscar sings every evening from the highest branch. He is not shy about his song anymore. He sings it with all his heart. “Hoo-loo-loo…” The moon listens. The stars blink their eyes. And the animals fall asleep, one by one. Close your eyes, you too. Listen… hoo-loo-loo… hoo-loo-loo…',
        },
        art: { sky: 'indigo', hero: '🦉', props: ['🌕', '⭐', '🌲'], ambience: 'stars' },
        prompt:
          'A small owl with brown feathers, a fluffy cream belly and honey-coloured eyes sings peacefully on the highest branch of an old oak under a big full moon and twinkling stars, the sleeping forest below, serene dreamy night.',
      },
    ],
  },

  // ───────────────────────────── d15 · difference ─────────────────────────────
  {
    id: 'd15',
    title: { fr: 'Le zèbre à pois', en: 'The Polka-Dot Zebra' },
    teaser: {
      fr: 'Zita a des pois au lieu des rayures. Et si c’était merveilleux ?',
      en: 'Zita has spots instead of stripes. What if that is wonderful?',
    },
    value: 'difference',
    moral: {
      fr: 'Nos différences rendent le monde plus beau, et chacun de nous est unique.',
      en: 'Our differences make the world more beautiful, and each one of us is unique.',
    },
    emoji: '🦓',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Dans la grande savane, là où l’herbe est dorée et où les acacias font de l’ombre, vivait un troupeau de zèbres. Ils avaient tous de belles rayures noires et blanches. Tous… sauf une. La petite Zita, elle, n’avait pas de rayures. Elle avait des pois ! Des ronds noirs, partout, sur son pelage blanc. Des petits, des moyens et des gros.',
          en: 'In the wide savannah, where the grass is golden and the acacia trees give shade, lived a herd of zebras. They all had beautiful black and white stripes. All of them… except one. Little Zita had no stripes. She had spots! Round black spots, all over her white coat. Small ones, medium ones and big ones.',
        },
        art: { sky: 'gold', hero: '🦓', props: ['🌳', '🌾', '🦓'], ambience: 'sunrise' },
        prompt:
          'A young zebra with a white coat covered in round black polka dots instead of stripes stands among a herd of striped zebras in golden savannah grass, flat-topped acacia trees, warm sunset glow, gentle cheerful mood.',
      },
      {
        text: {
          fr: 'Les autres zèbres la regardaient avec de grands yeux. « Un zèbre à pois ? Ça n’existe pas ! » disait Tomi. Zita était un peu triste. Un jour, elle se roula dans la boue, pour se dessiner des rayures. Elle se trouvait presque comme les autres. Mais une petite pluie tomba… et toutes les rayures de boue glissèrent par terre. Ses pois étaient toujours là.',
          en: 'The other zebras stared at her with big eyes. “A zebra with spots? That doesn’t exist!” said Tomi. Zita felt a little sad. One day, she rolled in the mud to draw stripes on herself. She looked almost like the others. But a light rain fell… and all the mud stripes slid down to the ground. Her spots were still there.',
        },
        art: { sky: 'dawn', hero: '🦓', props: ['🟤', '🌦️', '💧'], ambience: 'sunrise' },
        prompt:
          'A young polka-dot zebra with a white coat and round black spots stands in light rain as painted mud stripes wash off her coat, a curious striped young zebra watching nearby, soft rainy savannah light, gentle wistful mood.',
      },
      {
        text: {
          fr: 'Zita alla s’asseoir sous un acacia. La vieille girafe Nala pencha son long cou vers elle. « Pourquoi fais-tu cette tête, petite ? » Zita lui expliqua tout. La girafe sourit. « Tu veux connaître un secret ? Aucun zèbre n’a les mêmes rayures qu’un autre. Pas un seul ! Chaque zèbre est unique. Toi, tu es simplement unique d’une façon un peu plus visible. »',
          en: 'Zita went to sit under an acacia tree. Nala, the old giraffe, bent her long neck down towards her. “Why the long face, little one?” Zita told her everything. The giraffe smiled. “Do you want to know a secret? No zebra has the same stripes as another. Not a single one! Every zebra is unique. You are simply unique in a way that is a little easier to see.”',
        },
        art: { sky: 'gold', hero: '🦒', props: ['🦓', '🌳', '💛'], ambience: 'sunrise' },
        prompt:
          'A kind old giraffe with soft golden patches bends her long neck down to a young polka-dot zebra with a white coat and round black spots resting under an acacia tree, warm golden light, tender wise mood.',
      },
      {
        text: {
          fr: 'Le soir, les zèbres jouèrent à cache-cache dans les hautes herbes. Mais dans le troupeau, tout le monde se ressemblait ! « Qui est qui ? » riait Tomi. Tout le monde se trompait. Sauf pour Zita. On la reconnaissait tout de suite, avec ses jolis pois. « Zita, viens avec nous ! criaient les petits. Avec toi, on se retrouve toujours ! »',
          en: 'In the evening, the zebras played hide-and-seek in the tall grass. But in the herd, everyone looked alike! “Who is who?” laughed Tomi. Everybody kept getting mixed up. Except with Zita. You could spot her right away, with her pretty dots. “Zita, come with us!” the little ones called. “With you, we always find each other!”',
        },
        art: { sky: 'dawn', hero: '🦓', props: ['🦓', '🦓', '🌾', '😄'], ambience: 'fireflies' },
        prompt:
          'Young striped zebras play hide-and-seek in tall golden grass at dusk, laughing, while a young polka-dot zebra with a white coat and round black spots is easy to spot among them, fireflies appearing, playful joyful mood.',
      },
      {
        text: {
          fr: 'Tomi s’approcha de Zita, un peu gêné. « Pardon d’avoir dit que tu n’existais pas, dit-il. En vrai, je trouve tes pois très beaux. » Les autres zèbres hochèrent la tête. Ils regardèrent leurs propres rayures, toutes différentes, et ils sourirent. Chacun était unique. Et ensemble, ils formaient le plus joli troupeau de toute la savane.',
          en: 'Tomi came up to Zita, a little embarrassed. “Sorry I said you didn’t exist,” he said. “Honestly, I think your spots are really beautiful.” The other zebras nodded. They looked at their own stripes, all different, and they smiled. Each one was unique. And together, they made the loveliest herd in the whole savannah.',
        },
        art: { sky: 'rose', hero: '🦓', props: ['🦓', '🤝', '🌳'], ambience: 'fireflies' },
        prompt:
          'A young striped zebra nuzzles a young polka-dot zebra with a white coat and round black spots in friendship, the whole herd gathered around smiling, acacia trees under a rosy evening sky, warm accepting mood.',
      },
      {
        text: {
          fr: 'La nuit tombe sur la savane. Le ciel se remplit d’étoiles, comme des milliers de petits pois brillants. Zita les regarde et sourit. « Le ciel est comme moi », murmure-t-elle. Les zèbres se couchent dans l’herbe tiède, tout près les uns des autres, rayures et pois mélangés. Zita ferme les yeux. Et toi aussi, ferme les yeux, mon petit pois d’étoile.',
          en: 'Night falls over the savannah. The sky fills with stars, like thousands of shiny little dots. Zita looks at them and smiles. “The sky is like me,” she whispers. The zebras lie down in the warm grass, close together, stripes and spots all mixed up. Zita closes her eyes. And you can close your eyes too, my little starry dot.',
        },
        art: { sky: 'indigo', hero: '🦓', props: ['⭐', '✨', '🌳'], ambience: 'stars' },
        prompt:
          'A herd of striped zebras sleeps close together in warm savannah grass with a young polka-dot zebra with a white coat and round black spots nestled among them, a vast sky full of dotted stars above an acacia tree, peaceful night.',
      },
    ],
  },

  // ───────────────────────────── d16 · responsibility ─────────────────────────────
  {
    id: 'd16',
    title: { fr: 'La petite gardienne du phare', en: 'The Little Lighthouse Keeper' },
    teaser: {
      fr: 'Ce soir, Inès veille sur la lumière du phare pour guider les bateaux.',
      en: 'Tonight, Inès watches over the lighthouse light to guide the boats home.',
    },
    value: 'responsibility',
    moral: {
      fr: 'Quand on prend soin de ce qui nous est confié, on aide tout le monde à rentrer à bon port.',
      en: 'When we take good care of what we are trusted with, we help everyone get safely home.',
    },
    emoji: '⛵',
    age: 7,
    scenes: [
      {
        text: {
          fr: 'Sur une petite île, au bord de la mer, se dressait un phare blanc et rouge. Chaque nuit, sa lumière tournait, tournait, pour guider les bateaux jusqu’au port. Dans la maison du phare vivaient Inès et sa grand-mère, Mamie Lou. Inès avait deux tresses brunes, un ciré rouge et des bottes jaunes. Elle adorait regarder la lumière balayer les vagues.',
          en: 'On a small island by the sea stood a red and white lighthouse. Every night, its light turned and turned, to guide the boats back to the harbour. In the lighthouse cottage lived Inès and her grandmother, Granny Lou. Inès had two brown braids, a red raincoat and yellow boots. She loved watching the light sweep across the waves.',
        },
        art: { sky: 'ocean', hero: '👧🏻', props: ['🏝️', '🌊', '⛵'], ambience: 'stars' },
        prompt:
          'A girl with two brown braids, a red raincoat and yellow boots stands on the rocks of a small island beside a red and white striped lighthouse, its warm beam sweeping over calm evening waves, distant sailboats, peaceful mood.',
      },
      {
        text: {
          fr: 'Un soir, Mamie Lou se tordit la cheville dans l’escalier. Rien de grave, mais elle devait rester assise, la jambe sur un coussin. « Oh là là, soupira-t-elle. Qui va s’occuper de la lumière ce soir ? Les pêcheurs sont encore en mer. » Inès se redressa. « Moi, Mamie. Je sais comment faire. Je t’ai regardée tant de fois. »',
          en: 'One evening, Granny Lou twisted her ankle on the stairs. Nothing serious, but she had to stay seated, with her leg on a cushion. “Oh dear,” she sighed. “Who will look after the light tonight? The fishermen are still out at sea.” Inès stood up tall. “Me, Granny. I know how to do it. I’ve watched you so many times.”',
        },
        art: { sky: 'violet', hero: '👵🏼', props: ['👧🏻', '🛋️', '🫖'], ambience: 'moon' },
        prompt:
          'A cosy lighthouse cottage room, a grandmother with silver hair in a bun and a blue knitted cardigan rests in an armchair with her foot on a cushion, a girl with two brown braids and a red raincoat standing tall beside her, lamplight, caring mood.',
      },
      {
        text: {
          fr: 'Mamie Lou la regarda avec tendresse. « D’accord, ma grande. Je te fais confiance. » Inès prit la petite lanterne. Elle monta les marches, une à une. Cent marches qui tournaient en rond ! En haut, elle essuya la grande vitre avec un chiffon doux, pour qu’elle brille bien. Puis, comme Mamie le lui avait appris, elle alluma la grande lumière.',
          en: 'Granny Lou looked at her tenderly. “All right, my big girl. I trust you.” Inès took the little lantern. She climbed the steps, one by one. A hundred steps going round and round! At the top, she wiped the big window with a soft cloth, so it would shine brightly. Then, just as Granny had taught her, she switched on the great light.',
        },
        art: { sky: 'violet', hero: '👧🏻', props: ['🏮', '🪜', '✨'], ambience: 'stars' },
        prompt:
          'A girl with two brown braids, a red raincoat and yellow boots climbs a spiral staircase inside a lighthouse holding a small glowing lantern, then polishes the large glass of the lamp room, warm golden light, focused proud mood.',
      },
      {
        text: {
          fr: 'La lumière se mit à tourner. Un rayon doré glissa sur la mer. Mais au loin, une brume blanche arrivait doucement. Inès ne quitta pas son poste. Elle restait près de la fenêtre, attentive. Elle vérifiait la lumière. Elle comptait les tours. Un, deux, trois… Parfois, elle avait envie d’aller jouer. Mais elle savait que les bateaux comptaient sur elle.',
          en: 'The light began to turn. A golden beam glided over the sea. But far away, a white mist was slowly drifting in. Inès did not leave her post. She stayed by the window, watching carefully. She checked the light. She counted the turns. One, two, three… Sometimes, she wanted to go and play. But she knew the boats were counting on her.',
        },
        art: { sky: 'ocean', hero: '👧🏻', props: ['💡', '🌫️', '🌊'], ambience: 'stars' },
        prompt:
          'A girl with two brown braids and a red raincoat watches attentively from the round window at the top of a lighthouse, a golden beam sweeping across the dark sea, soft white mist rolling in on the horizon, calm watchful mood.',
      },
      {
        text: {
          fr: 'Soudain, dans la brume, elle vit de petites lumières. Une, puis deux, puis trois ! C’étaient les bateaux des pêcheurs. Ils suivaient le rayon du phare, tout droit vers le port. Inès fit de grands signes. Le bateau de Monsieur Malik fit tut-tut pour la saluer. Tous les bateaux étaient rentrés, sains et saufs. Inès sentit son cœur se remplir de fierté.',
          en: 'Suddenly, in the mist, she saw little lights. One, then two, then three! It was the fishermen’s boats. They were following the lighthouse beam, straight to the harbour. Inès waved her arms. Mister Malik’s boat went toot-toot to say hello. All the boats were home, safe and sound. Inès felt her heart fill up with pride.',
        },
        art: { sky: 'ocean', hero: '⛵', props: ['🚤', '⚓', '👋'], ambience: 'stars' },
        prompt:
          'Three small fishing boats with glowing lanterns follow a golden lighthouse beam through soft mist into a cosy harbour, a girl with two brown braids and a red raincoat waving happily from the lighthouse window, relieved joyful mood.',
      },
      {
        text: {
          fr: 'Inès redescendit les cent marches. Mamie Lou l’attendait avec un bol de lait chaud au miel. « Merci, ma gardienne du phare », dit-elle en l’embrassant sur le front. Inès se glissa sous sa couette. Par la fenêtre, la lumière tournait toujours, douce et fidèle, au-dessus de la mer tranquille. Les vagues chuchotaient : chhh… chhh… Et toi aussi, laisse-toi bercer… chhh…',
          en: 'Inès went back down the hundred steps. Granny Lou was waiting with a bowl of warm milk and honey. “Thank you, my little lighthouse keeper,” she said, kissing her forehead. Inès snuggled under her duvet. Through the window, the light kept turning, gentle and faithful, above the quiet sea. The waves whispered: shhh… shhh… And you too, let yourself be rocked… shhh…',
        },
        art: { sky: 'indigo', hero: '👧🏻', props: ['🛏️', '🥛', '🌊', '🌙'], ambience: 'moon' },
        prompt:
          'A girl with two brown braids sleeps snugly under a patchwork duvet in a small cottage bedroom, a grandmother with silver hair in a bun and a blue cardigan tucking her in, the lighthouse beam glowing softly over a calm moonlit sea outside, serene mood.',
      },
    ],
  },

  // ───────────────────────────── d17 · generosity ─────────────────────────────
  {
    id: 'd17',
    title: { fr: 'Le renard et l’écharpe d’hiver', en: 'The Fox and the Winter Scarf' },
    teaser: {
      fr: 'Félix offre son écharpe préférée… et reçoit bien plus de chaleur en retour.',
      en: 'Félix gives away his favourite scarf… and gets back so much warmth.',
    },
    value: 'generosity',
    moral: {
      fr: 'Plus on donne de chaleur aux autres, plus il en revient dans notre cœur.',
      en: 'The more warmth we give to others, the more comes back to our heart.',
    },
    emoji: '🦊',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Dans la forêt d’hiver, tout était blanc et silencieux. La neige couvrait les sapins comme une grosse couette. Là vivait Félix, un renard roux au museau pointu. Autour de son cou, il portait une longue écharpe verte à rayures jaunes. Sa grand-mère l’avait tricotée pour lui. Elle était douce, épaisse, et elle sentait bon la maison. Félix l’aimait beaucoup.',
          en: 'In the winter forest, everything was white and quiet. Snow covered the fir trees like a thick duvet. There lived Félix, a red fox with a pointy nose. Around his neck, he wore a long green scarf with yellow stripes. His grandmother had knitted it for him. It was soft, thick, and it smelled like home. Félix loved it very much.',
        },
        art: { sky: 'snow', hero: '🦊', props: ['🌲', '🧣', '❄️'], ambience: 'snow' },
        prompt:
          'A red fox with a pointy nose wearing a long knitted green scarf with yellow stripes walks through a quiet snowy forest of fir trees, soft snowflakes falling, pale blue evening light, cosy peaceful mood.',
      },
      {
        text: {
          fr: 'Un soir, en rentrant chez lui, Félix entendit un petit bruit. Brrr… brrr… Sous un sapin, il trouva Noisette, un petit écureuil gris. Il tremblait de froid. Sa queue touffue ne suffisait plus à le réchauffer. « Je me suis éloigné de mon arbre dans la neige, dit Noisette. Et j’ai si froid. » Félix regarda son écharpe. Puis il regarda son ami.',
          en: 'One evening, on his way home, Félix heard a little sound. Brrr… brrr… Under a fir tree, he found Noisette, a small grey squirrel. He was shivering with cold. His bushy tail was no longer enough to keep him warm. “I wandered away from my tree in the snow,” said Noisette. “And I’m so cold.” Félix looked at his scarf. Then he looked at his friend.',
        },
        art: { sky: 'snow', hero: '🐿️', props: ['🦊', '🌲', '❄️'], ambience: 'snow' },
        prompt:
          'A small grey squirrel with a bushy tail shivers under a snowy fir tree, a red fox with a pointy nose and a long green scarf with yellow stripes leans down kindly to look at him, gentle snowfall, soft twilight blue, caring mood.',
      },
      {
        text: {
          fr: 'Félix hésita un tout petit instant. C’était son écharpe préférée… Puis il la déroula doucement, et l’enroula autour de Noisette. Une fois, deux fois, trois fois ! On ne voyait plus que le bout du nez de l’écureuil. « Oh, merci, Félix, souffla Noisette. Elle est toute chaude. » Félix sourit. Et il raccompagna son ami jusqu’à son arbre.',
          en: 'Félix hesitated for just a tiny moment. It was his favourite scarf… Then he gently unwound it and wrapped it around Noisette. Once, twice, three times! You could only see the tip of the squirrel’s nose. “Oh, thank you, Félix,” whispered Noisette. “It’s so warm.” Félix smiled. And he walked his friend all the way back to his tree.',
        },
        art: { sky: 'snow', hero: '🦊', props: ['🧣', '🐿️', '🌳'], ambience: 'snow' },
        prompt:
          'A red fox with a pointy nose wraps his long green scarf with yellow stripes around a small grey squirrel until only the squirrel’s nose peeks out, snowy forest path, falling snowflakes, warm tender mood.',
      },
      {
        text: {
          fr: 'Sur le chemin du retour, le vent souffla un peu plus fort. Sans son écharpe, Félix sentait l’air froid lui chatouiller le cou. Il rentra dans son terrier et se roula en boule. Brrr. Il frissonnait un peu. Mais au fond de son cœur, il ne regrettait rien. Il pensait à Noisette, bien au chaud. Soudain, on frappa à la porte : toc, toc, toc.',
          en: 'On the way home, the wind blew a little harder. Without his scarf, Félix felt the cold air tickle his neck. He went into his den and curled up into a ball. Brrr. He shivered a little. But deep in his heart, he had no regrets. He thought of Noisette, nice and warm. Suddenly, there was a knock at the door: knock, knock, knock.',
        },
        art: { sky: 'snow', hero: '🦊', props: ['🏠', '🚪', '❄️'], ambience: 'snow' },
        prompt:
          'A red fox with a pointy nose and no scarf curls up in a ball inside his small cosy den under the snowy roots of a tree, a round wooden door, snowflakes outside the little window, quiet hopeful mood.',
      },
      {
        text: {
          fr: 'Félix ouvrit. Devant sa porte, il y avait Noisette, toujours dans l’écharpe verte. Et derrière lui, toute sa famille d’écureuils, le vieux blaireau, et même deux petits rouges-gorges ! Ils apportaient une grande couverture en patchwork, des châtaignes chaudes et du chocolat fumant. « Tu m’as donné ta chaleur, dit Noisette. Alors ce soir, c’est nous qui te la rendons. »',
          en: 'Félix opened the door. There stood Noisette, still wrapped in the green scarf. And behind him were his whole squirrel family, the old badger, and even two little robins! They had brought a big patchwork blanket, warm chestnuts and steaming hot chocolate. “You gave me your warmth,” said Noisette. “So tonight, we are giving it back to you.”',
        },
        art: { sky: 'snow', hero: '🐿️', props: ['🦡', '🐦', '🌰', '☕'], ambience: 'snow' },
        prompt:
          'At a round wooden den door in the snow, a small grey squirrel wrapped in a green scarf with yellow stripes, his squirrel family, an old badger and two robins bring a patchwork blanket, chestnuts and hot chocolate to a surprised red fox, warm mood.',
      },
      {
        text: {
          fr: 'Tout le monde se serra dans le terrier, sous la grande couverture. Les châtaignes sentaient bon. Le chocolat était doux. Noisette rendit l’écharpe à Félix, et ils la partagèrent, un bout chacun. Dehors, la neige tombait sans bruit. Dedans, tout était chaud, chaud jusqu’au bout des pattes. Félix ferma les yeux en souriant. Blottis-toi bien, toi aussi. Bonne nuit, tout au chaud.',
          en: 'Everyone squeezed into the den, under the big blanket. The chestnuts smelled lovely. The hot chocolate was sweet. Noisette gave the scarf back to Félix, and they shared it, one end each. Outside, the snow fell without a sound. Inside, everything was warm, warm right down to their toes. Félix closed his eyes, smiling. Snuggle up tight, you too. Good night, nice and warm.',
        },
        art: { sky: 'snow', hero: '🦊', props: ['🐿️', '🧣', '🛌', '💤'], ambience: 'snow' },
        prompt:
          'Inside a cosy den, a red fox with a pointy nose and a small grey squirrel share one long green scarf with yellow stripes, sleeping under a patchwork blanket with a badger and two robins, snow falling softly outside, warm golden glow.',
      },
    ],
  },

  // ───────────────────────────── d18 · listening ─────────────────────────────
  {
    id: 'd18',
    title: { fr: 'Le lapin aux grandes oreilles', en: 'The Rabbit with Big Ears' },
    teaser: {
      fr: 'Basile adore parler. Mais pour aider son ami, il va apprendre à écouter.',
      en: 'Basile loves to talk. But to help his friend, he learns to listen.',
    },
    value: 'listening',
    moral: {
      fr: 'Écouter vraiment un ami, c’est lui offrir le plus beau des cadeaux.',
      en: 'Truly listening to a friend is the most beautiful gift you can give.',
    },
    emoji: '🐰',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Dans une prairie pleine de trèfles vivait Basile, un petit lapin gris et blanc. Basile avait les plus grandes oreilles de toute la prairie. Elles étaient longues, longues, avec un intérieur tout rose. Basile portait un petit gilet bleu. Et Basile adorait parler ! Il parlait le matin, il parlait à midi, il parlait le soir. Bla-bla-bla, du matin jusqu’au soir.',
          en: 'In a meadow full of clover lived Basile, a little grey and white rabbit. Basile had the biggest ears in the whole meadow. They were long, long, and pink inside. Basile wore a little blue vest. And Basile loved to talk! He talked in the morning, he talked at noon, he talked in the evening. Blah-blah-blah, from morning till night.',
        },
        art: { sky: 'gold', hero: '🐰', props: ['☘️', '🌼', '💬'], ambience: 'sunrise' },
        prompt:
          'A little grey and white rabbit with very long ears, pink inside, wearing a small blue vest, chats happily in a sunny clover meadow full of daisies, warm golden light, playful cheerful mood.',
      },
      {
        text: {
          fr: 'Un jour, un petit hérisson arriva dans la prairie. Il s’appelait Pic. Il venait d’un autre bois, très loin. Pic avait l’air tout triste. Basile courut vers lui. « Bonjour ! Moi, c’est Basile ! Tu veux voir mon terrier ? Tu aimes les carottes ? Moi, j’adore ! Et tu sais sauter ? Regarde ! » Pic ouvrit la bouche… mais Basile parlait déjà d’autre chose.',
          en: 'One day, a little hedgehog arrived in the meadow. His name was Pic. He came from another wood, very far away. Pic looked very sad. Basile ran up to him. “Hello! I’m Basile! Do you want to see my burrow? Do you like carrots? I love them! And can you jump? Look!” Pic opened his mouth… but Basile was already talking about something else.',
        },
        art: { sky: 'gold', hero: '🦔', props: ['🐰', '🥕', '💬'], ambience: 'sunrise' },
        prompt:
          'A grey and white rabbit with very long ears and a small blue vest bounces and chatters excitedly in front of a small brown hedgehog with a shy, sad face, clover meadow, afternoon sunlight, lively but gentle mood.',
      },
      {
        text: {
          fr: 'Chaque jour, c’était pareil. Pic essayait de dire quelque chose, et Basile parlait par-dessus. Bientôt, Pic ne disait plus rien du tout. Il restait roulé en boule, sous une fougère. Basile ne comprenait pas. Il alla voir Mamie Tortue, la plus sage de la prairie. « Pourquoi Pic est-il toujours triste ? Je lui parle pourtant tout le temps ! »',
          en: 'Every day, it was the same. Pic tried to say something, and Basile talked over him. Soon, Pic stopped saying anything at all. He stayed curled up in a ball, under a fern. Basile did not understand. He went to see Granny Tortoise, the wisest one in the meadow. “Why is Pic always sad? I talk to him all the time!”',
        },
        art: { sky: 'dawn', hero: '🐢', props: ['🐰', '🦔', '🌿'], ambience: 'petals' },
        prompt:
          'A grey and white rabbit with long ears and a blue vest asks a question to a wise old tortoise with a mossy shell and little round glasses, a small brown hedgehog curled up under a fern in the background, soft evening light, thoughtful mood.',
      },
      {
        text: {
          fr: 'Mamie Tortue sourit lentement. « Tu as de très grandes oreilles, Basile. Mais t’en sers-tu vraiment ? Pour aider un ami, il faut parfois se taire… et écouter. » Basile réfléchit. Il remua ses grandes oreilles. Puis il retourna voir Pic. Il s’assit à côté de lui, tout simplement. Et pour la première fois, il ne dit rien. Il attendit, gentiment.',
          en: 'Granny Tortoise smiled slowly. “You have very big ears, Basile. But do you really use them? To help a friend, sometimes you need to be quiet… and listen.” Basile thought about it. He wiggled his big ears. Then he went back to Pic. He simply sat down beside him. And for the first time, he said nothing. He waited, kindly.',
        },
        art: { sky: 'dawn', hero: '🐰', props: ['🦔', '🌿', '🤫'], ambience: 'petals' },
        prompt:
          'A grey and white rabbit with very long ears and a blue vest sits quietly and patiently beside a small brown hedgehog curled under a fern, both calm, soft pink dusk light in the meadow, gentle attentive mood.',
      },
      {
        text: {
          fr: 'Au bout d’un moment, Pic parla tout doucement. « Dans mon ancien bois, il y avait un ruisseau. Le soir, j’écoutais son glouglou pour m’endormir. Ici, c’est trop silencieux. » Basile écouta jusqu’au bout, ses oreilles bien droites. Puis il sourit. « Je connais un ruisseau, tout près d’ici ! Viens. » Pic déroula ses piquants. Pour la première fois, il souriait.',
          en: 'After a while, Pic spoke very softly. “In my old wood, there was a stream. In the evening, I listened to its babbling to fall asleep. Here, it’s too quiet.” Basile listened all the way to the end, his ears standing tall. Then he smiled. “I know a stream, very close by! Come.” Pic uncurled his prickles. For the first time, he was smiling.',
        },
        art: { sky: 'rose', hero: '🦔', props: ['🐰', '💧', '😊'], ambience: 'fireflies' },
        prompt:
          'A small brown hedgehog uncurls and smiles while talking softly, a grey and white rabbit with very long ears standing straight up and a blue vest listens closely, a sparkling stream glimpsed nearby, rosy twilight, fireflies, warm hopeful mood.',
      },
      {
        text: {
          fr: 'Ce soir-là, Basile et Pic s’installèrent au bord du ruisseau. Ils ne parlaient pas. Ils écoutaient. Le glouglou de l’eau. Le chant des grillons. Le vent dans les herbes. Pic soupira de bonheur. Basile replia ses grandes oreilles, comme une couverture. Et ils s’endormirent côte à côte. Toi aussi, écoute… Qu’entends-tu dans le silence ? Doucement… ferme les yeux.',
          en: 'That evening, Basile and Pic settled down by the stream. They did not talk. They listened. The babbling of the water. The song of the crickets. The wind in the grass. Pic sighed happily. Basile folded down his big ears, like a blanket. And they fell asleep side by side. You too, listen… What can you hear in the quiet? Gently… close your eyes.',
        },
        art: { sky: 'indigo', hero: '🐰', props: ['🦔', '💧', '🦗', '🌙'], ambience: 'fireflies' },
        prompt:
          'A grey and white rabbit with long ears folded down like a blanket and a blue vest sleeps side by side with a small brown hedgehog on soft grass by a gently babbling stream, crickets, fireflies and a crescent moon, peaceful night.',
      },
    ],
  },

  // ───────────────────────────── d19 · calm ─────────────────────────────
  {
    id: 'd19',
    title: { fr: 'Le petit volcan qui apprit à respirer', en: 'The Little Volcano Who Learned to Breathe' },
    teaser: {
      fr: 'Tilou gronde quand il se fâche. La lune lui apprend un doux secret.',
      en: 'Tilou rumbles when he gets cross. The moon teaches him a gentle secret.',
    },
    value: 'calm',
    moral: {
      fr: 'Quand la colère monte, quelques respirations douces peuvent ramener le calme dans notre cœur.',
      en: 'When anger rises, a few gentle breaths can bring calm back into our heart.',
    },
    emoji: '🌋',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Au milieu de la mer bleue, il y avait une petite île toute ronde. Sur cette île vivait un petit volcan nommé Tilou. Il avait des pentes vertes couvertes de fougères, et un petit nuage de fumée blanche sur la tête, comme un chapeau. Autour de lui vivaient des tortues, des crabes et des oiseaux colorés. D’habitude, Tilou était gentil et tranquille.',
          en: 'In the middle of the blue sea, there was a small, round island. On this island lived a little volcano named Tilou. He had green slopes covered in ferns, and a little cloud of white smoke on his head, like a hat. Around him lived turtles, crabs and colourful birds. Usually, Tilou was kind and calm.',
        },
        art: { sky: 'ocean', hero: '🌋', props: ['🏝️', '🐢', '🦀', '🦜'], ambience: 'sunrise' },
        prompt:
          'A small friendly volcano with a smiling face, green fern-covered slopes and a little white cloud of smoke on top like a hat, on a round tropical island in a blue sea, turtles, crabs and colourful birds around, gentle evening light.',
      },
      {
        text: {
          fr: 'Mais parfois, Tilou se fâchait. Quand un oiseau se posait sur son chapeau de fumée, ou quand les vagues faisaient trop de bruit, il sentait la colère monter, monter, tout au fond de lui. Alors il grondait : « Grrrrr ! » Il tremblait un peu. Et il crachait de petites étincelles orange. Les crabes couraient se cacher. Les oiseaux s’envolaient.',
          en: 'But sometimes, Tilou got cross. When a bird landed on his smoke hat, or when the waves were too noisy, he felt the anger rising, rising, deep inside him. Then he rumbled: “Grrrrr!” He trembled a little. And he spat out tiny orange sparks. The crabs scurried away to hide. The birds flew off.',
        },
        art: { sky: 'rose', hero: '🌋', props: ['✨', '🦀', '🐦'], ambience: 'stars' },
        prompt:
          'A small volcano with a grumpy frowning face and green fern slopes rumbles and puffs a few tiny harmless orange sparks, little crabs scuttling to hide behind rocks and birds fluttering off, rosy evening sky, mildly grumpy but gentle mood.',
      },
      {
        text: {
          fr: 'Un soir, après une grosse colère, Tilou se retrouva tout seul. Plus de tortues. Plus d’oiseaux. Il se sentit triste. « Je ne veux pas gronder, murmura-t-il. Mais la colère est plus forte que moi. » La lune ronde l’entendit. Elle fit descendre un rayon d’argent jusqu’à lui. « Tilou, dit-elle doucement, la colère, c’est normal. Mais je peux t’apprendre un secret. »',
          en: 'One evening, after a big angry moment, Tilou found himself all alone. No more turtles. No more birds. He felt sad. “I don’t want to rumble,” he whispered. “But the anger is stronger than me.” The round moon heard him. She sent a silver moonbeam all the way down to him. “Tilou,” she said softly, “feeling angry is normal. But I can teach you a secret.”',
        },
        art: { sky: 'indigo', hero: '🌕', props: ['🌋', '🌊', '✨'], ambience: 'moon' },
        prompt:
          'A small volcano with a sad little face and green fern slopes sits alone on a quiet island at night, a kind smiling full moon sending a soft silver beam down to him across the calm sea, tender comforting mood.',
      },
      {
        text: {
          fr: '« Quand la colère monte, dit la lune, respire tout doucement. Inspire par le nez, comme pour sentir une fleur… Puis expire par la bouche, comme pour souffler sur une plume. » Tilou essaya. Tu veux essayer avec lui ? Inspire… tout doucement… Expire… tout doucement… Encore une fois. Inspire… Expire… Tilou sentit son ventre devenir calme, tout calme.',
          en: '“When anger rises,” said the moon, “breathe very gently. Breathe in through your nose, as if you were smelling a flower… Then breathe out through your mouth, as if you were blowing on a feather.” Tilou tried. Would you like to try with him? Breathe in… very gently… Breathe out… very gently… One more time. Breathe in… Breathe out… Tilou felt his tummy grow calm, so calm.',
        },
        art: { sky: 'violet', hero: '🌋', props: ['🌸', '🪶', '🌙'], ambience: 'stars' },
        prompt:
          'A small volcano with a peaceful face and closed eyes breathes in slowly, a tiny pink flower floating in front of him and a white feather drifting on his breath, the full moon smiling above, soft violet night, very calm mood.',
      },
      {
        text: {
          fr: 'Le lendemain, un oiseau vint se poser sur son chapeau de fumée. Tilou sentit la colère monter. Mais cette fois, il se souvint du secret. Inspire… expire… Inspire… expire… La colère redescendit doucement, comme une vague qui se retire. « Bonjour, petit oiseau », dit Tilou avec un sourire. L’oiseau chanta. Et les tortues revinrent, une par une.',
          en: 'The next day, a bird landed on his smoke hat. Tilou felt the anger rising. But this time, he remembered the secret. Breathe in… breathe out… Breathe in… breathe out… The anger slowly went back down, like a wave pulling away. “Hello, little bird,” said Tilou with a smile. The bird sang. And the turtles came back, one by one.',
        },
        art: { sky: 'dawn', hero: '🌋', props: ['🐦', '🐢', '🐢', '🎵'], ambience: 'sunrise' },
        prompt:
          'A small smiling volcano with green fern slopes greets a little colourful bird perched on his white smoke hat, sea turtles crawling happily back onto the sandy beach, soft sunrise light over the sea, joyful peaceful mood.',
      },
      {
        text: {
          fr: 'Maintenant, le soir, Tilou respire avec la mer. Les vagues montent… inspire. Les vagues redescendent… expire. Son petit nuage de fumée devient tout léger. Les tortues dorment sur la plage. Les oiseaux dorment dans ses fougères. Tout au fond de lui, une douce lumière orange brille, chaude et tranquille. Respire avec Tilou… inspire… expire… et ferme les yeux.',
          en: 'Now, in the evening, Tilou breathes with the sea. The waves come in… breathe in. The waves go out… breathe out. His little cloud of smoke becomes light as air. The turtles sleep on the beach. The birds sleep in his ferns. Deep inside him, a soft orange light glows, warm and peaceful. Breathe with Tilou… breathe in… breathe out… and close your eyes.',
        },
        art: { sky: 'indigo', hero: '🌋', props: ['🌊', '🐢', '🐦', '💤'], ambience: 'stars' },
        prompt:
          'A small volcano with a sleepy smile and a soft warm orange glow inside rests on a calm island at night, turtles asleep on the beach, birds asleep in his green ferns, gentle waves, starry sky, deeply peaceful mood.',
      },
    ],
  },

  // ───────────────────────────── d20 · curiosity ─────────────────────────────
  {
    id: 'd20',
    title: { fr: 'Le petit astronaute et l’étoile filante', en: 'The Little Astronaut and the Shooting Star' },
    teaser: {
      fr: 'Sacha a mille questions sur le ciel. Une étoile filante vient y répondre.',
      en: 'Sacha has a thousand questions about the sky. A shooting star comes to answer.',
    },
    value: 'curiosity',
    moral: {
      fr: 'Poser des questions, c’est ouvrir des fenêtres sur les merveilles du monde.',
      en: 'Asking questions opens windows onto the wonders of the world.',
    },
    emoji: '🚀',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Dans une petite maison au bord d’un champ vivait Sacha, un enfant qui adorait le ciel. Sacha avait des cheveux roux tout bouclés et plein de taches de rousseur. Chaque soir, Sacha mettait sa combinaison d’astronaute, blanche avec une bande orange, et regardait les étoiles par la fenêtre. Et chaque soir, Sacha avait mille questions dans la tête.',
          en: 'In a little house at the edge of a field lived Sacha, a child who loved the sky. Sacha had curly red hair and lots of freckles. Every evening, Sacha put on a white astronaut suit with an orange stripe and looked at the stars through the window. And every evening, Sacha had a thousand questions buzzing around in their head.',
        },
        art: { sky: 'indigo', hero: '🧑‍🚀', props: ['🏠', '🔭', '⭐'], ambience: 'stars' },
        prompt:
          'A child with curly red hair and freckles, wearing a white astronaut suit with an orange stripe, gazes at the starry sky from the window of a small house beside a field, deep blue night, curious dreamy mood.',
      },
      {
        text: {
          fr: 'Cette nuit-là, quelque chose traversa le ciel. Une longue traînée de lumière ! Et zip, zip… la lumière se posa dans le jardin. C’était une petite étoile filante, toute brillante, avec une queue scintillante. « Bonsoir, Sacha, dit-elle. Je m’appelle Lumi. On m’a dit que tu avais beaucoup de questions. Tu veux venir voir le ciel de plus près ? »',
          en: 'That night, something crossed the sky. A long trail of light! And zip, zip… the light landed in the garden. It was a little shooting star, all shiny, with a sparkly tail. “Good evening, Sacha,” she said. “My name is Lumi. I heard you have lots of questions. Would you like to come and see the sky up close?”',
        },
        art: { sky: 'violet', hero: '🌠', props: ['🧑‍🚀', '🌳', '✨'], ambience: 'stars' },
        prompt:
          'A small smiling shooting star with a long sparkling golden tail lands softly in a night garden in front of a child with curly red hair and freckles in a white astronaut suit with an orange stripe, violet sky, magical wonder mood.',
      },
      {
        text: {
          fr: 'Sacha mit son casque rond et grimpa sur le dos de Lumi. Hop ! Les voilà qui s’envolent au-dessus des toits. « Lumi, pourquoi les étoiles clignotent ? » demanda Sacha. « Leur lumière traverse l’air autour de la Terre, et l’air bouge un peu. Alors elles ont l’air de cligner des yeux. » Sacha ouvrit de grands yeux. « Waouh ! Et toi, Lumi, qu’est-ce que tu es ? »',
          en: 'Sacha put on a round helmet and climbed onto Lumi’s back. Up! Off they flew above the rooftops. “Lumi, why do stars twinkle?” asked Sacha. “Their light passes through the air around the Earth, and the air moves a little. So they look like they are blinking.” Sacha’s eyes grew wide. “Wow! And you, Lumi, what are you?”',
        },
        art: { sky: 'indigo', hero: '🧑‍🚀', props: ['🌠', '🏘️', '⭐', '✨'], ambience: 'stars' },
        prompt:
          'A child with curly red hair and freckles in a white astronaut suit with an orange stripe and a round helmet rides a smiling shooting star with a golden tail high above sleepy village rooftops, twinkling stars all around, joyful wonder.',
      },
      {
        text: {
          fr: '« Moi ? rit Lumi. Je suis un tout petit caillou de l’espace. Quand je file à travers l’air, je deviens toute chaude et je brille. » Sacha et Lumi montèrent encore plus haut. Voici la lune, ronde et grise, pleine de petits creux. « Pourquoi la lune change de forme ? » demanda Sacha. « Elle ne change pas, dit Lumi. Le soleil éclaire juste un morceau différent selon les soirs. »',
          en: '“Me?” laughed Lumi. “I’m a tiny pebble from space. When I zoom through the air, I get very warm and I glow.” Sacha and Lumi flew even higher. Here was the moon, round and grey, full of little hollows. “Why does the moon change shape?” asked Sacha. “It doesn’t really change,” said Lumi. “The sun just lights up a different part of it on different nights.”',
        },
        art: { sky: 'violet', hero: '🌕', props: ['🧑‍🚀', '🌠', '🌓'], ambience: 'stars' },
        prompt:
          'A child with curly red hair and freckles in a white astronaut suit with an orange stripe and round helmet floats on a glowing shooting star beside a huge grey moon full of little craters, half lit by soft sunlight, awe-filled mood.',
      },
      {
        text: {
          fr: 'Lumi montra des étoiles qui formaient des dessins. « Regarde, voici la Grande Ourse. Elle ressemble à une grande casserole ! » Sacha compta les étoiles, une à une. Il y en avait tant ! Chaque réponse donnait envie d’une nouvelle question. « Est-ce qu’on connaît tout du ciel ? » demanda Sacha. Lumi sourit. « Oh non. Il reste plein de mystères. Peut-être qu’un jour, c’est toi qui les découvriras. »',
          en: 'Lumi pointed to stars that made pictures. “Look, here is the Big Dipper. It looks like a big saucepan!” Sacha counted the stars, one by one. There were so many! Every answer made Sacha want to ask a new question. “Do we know everything about the sky?” asked Sacha. Lumi smiled. “Oh no. There are still lots of mysteries. Maybe one day, you will be the one to discover them.”',
        },
        art: { sky: 'indigo', hero: '✨', props: ['🧑‍🚀', '🌠', '🌌', '⭐'], ambience: 'stars' },
        prompt:
          'A child with curly red hair and freckles in a white astronaut suit with an orange stripe points at a constellation shaped like a saucepan, softly connected by faint lines of light, sitting on a smiling shooting star, deep starry space, curious wonder.',
      },
      {
        text: {
          fr: 'Lumi ramena Sacha jusqu’à sa fenêtre. « Merci pour le voyage, Lumi ! » Sacha enleva son casque et se glissa dans son lit, la tête pleine d’étoiles. Dans le ciel, une petite lumière fila, comme un clin d’œil. Sacha fit un vœu tout bas. Puis ses yeux se fermèrent doucement. Et toi, quel vœu fais-tu ce soir ? Garde-le bien… et ferme les yeux.',
          en: 'Lumi brought Sacha back to the window. “Thank you for the trip, Lumi!” Sacha took off the helmet and slipped into bed, head full of stars. In the sky, a little light zipped past, like a wink. Sacha made a wish, very quietly. Then Sacha’s eyes slowly closed. And you, what wish will you make tonight? Keep it safe… and close your eyes.',
        },
        art: { sky: 'indigo', hero: '🧑‍🚀', props: ['🛏️', '🌠', '🌙'], ambience: 'stars' },
        prompt:
          'A child with curly red hair and freckles, still in a white astronaut suit with an orange stripe, falls asleep smiling in a cosy bed by an open window, a round helmet on the nightstand, a tiny shooting star crossing the starry sky.',
      },
    ],
  },
];
