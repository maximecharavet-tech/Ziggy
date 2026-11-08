/**
 * Proud moments a parent can pick for each child (never free text: nothing
 * personal is typed or sent). Santa mentions it during the call. All positive:
 * no "naughty list", no guilt (child-safety red line).
 * Santa's words avoid gendered French adjectives (the child can be a girl or a boy).
 * `say` is what Santa says, after "Il paraît que tu…" / "I heard that you…".
 */
export type SantaProud = { id: string; fr: string; en: string; say: { fr: string; en: string } };

export const SANTA_PROUD: SantaProud[] = [
  { id: 'velo', fr: 'A appris à faire du vélo', en: 'Learned to ride a bike', say: { fr: 'as appris à faire du vélo', en: 'learned to ride a bike' } },
  { id: 'lire', fr: 'A appris à lire', en: 'Learned to read', say: { fr: 'as appris à lire', en: 'learned to read' } },
  { id: 'ecrire', fr: 'Écrit de mieux en mieux', en: 'Writes better and better', say: { fr: 'écris de mieux en mieux', en: 'write better and better every day' } },
  { id: 'compter', fr: 'Sait compter loin', en: 'Can count very far', say: { fr: 'sais compter très très loin', en: 'can count very, very far' } },
  { id: 'nager', fr: 'A appris à nager', en: 'Learned to swim', say: { fr: 'as appris à nager', en: 'learned to swim' } },
  { id: 'maison', fr: 'Aide à la maison', en: 'Helps at home', say: { fr: 'aides beaucoup à la maison', en: 'help a lot at home' } },
  { id: 'table', fr: 'Aide à mettre la table', en: 'Helps set the table', say: { fr: 'aides à mettre la table', en: 'help set the table' } },
  { id: 'ranger', fr: 'Range sa chambre', en: 'Tidies their room', say: { fr: 'ranges ta chambre comme un vrai lutin', en: 'tidy your room like a real elf' } },
  { id: 'partage', fr: 'Partage ses jouets', en: 'Shares their toys', say: { fr: 'partages tes jouets', en: 'share your toys' } },
  { id: 'frere-soeur', fr: 'Prend soin de son frère ou sa sœur', en: 'Looks after a brother or sister', say: { fr: 'prends soin de ton frère ou de ta sœur', en: 'look after your brother or sister' } },
  { id: 'medecin', fr: 'A montré du courage chez le médecin', en: 'Was brave at the doctor’s', say: { fr: 'as montré beaucoup de courage chez le médecin', en: 'were very brave at the doctor’s' } },
  { id: 'dents', fr: 'Se brosse bien les dents', en: 'Brushes their teeth well', say: { fr: 'te brosses très bien les dents', en: 'brush your teeth really well' } },
  { id: 'ecole', fr: 'Fait de beaux efforts à l’école', en: 'Works hard at school', say: { fr: 'fais de beaux efforts à l’école', en: 'work really hard at school' } },
  { id: 'copains', fr: 'Est plein de gentillesse avec ses copains', en: 'Is kind to friends', say: { fr: 'es plein de gentillesse avec tes copains', en: 'are very kind to your friends' } },
  { id: 'animal', fr: 'S’occupe bien d’un animal', en: 'Takes good care of a pet', say: { fr: 't’occupes très bien de ton animal', en: 'take very good care of your pet' } },
  { id: 'dessin', fr: 'Fait de très beaux dessins', en: 'Makes beautiful drawings', say: { fr: 'fais de très beaux dessins', en: 'make beautiful drawings' } },
  { id: 'musique', fr: 'Apprend la musique', en: 'Is learning music', say: { fr: 'apprends la musique', en: 'are learning music' } },
  { id: 'sport', fr: 'Fait du sport avec énergie', en: 'Loves doing sport', say: { fr: 'fais du sport avec plein d’énergie', en: 'do sport with lots of energy' } },
  { id: 'dormir', fr: 'Va au lit sans faire d’histoires', en: 'Goes to bed nicely', say: { fr: 'vas au lit comme un champion', en: 'go to bed like a champion' } },
  { id: 'legumes', fr: 'Goûte de nouveaux aliments', en: 'Tries new foods', say: { fr: 'goûtes de nouveaux aliments', en: 'try new foods' } },
  { id: 'habiller', fr: 'S’habille sans aide', en: 'Gets dressed on their own', say: { fr: 't’habilles sans aide', en: 'get dressed all by yourself' } },
  { id: 'politesse', fr: 'Dit merci et s’il te plaît', en: 'Says please and thank you', say: { fr: 'dis toujours merci et s’il te plaît', en: 'always say please and thank you' } },
  { id: 'nouvelle-ecole', fr: 'S’est adapté à une nouvelle école', en: 'Settled into a new school', say: { fr: 'as été formidable dans ta nouvelle école', en: 'did wonderfully at your new school' } },
  { id: 'aide-autres', fr: 'Aide les autres', en: 'Helps others', say: { fr: 'aides les autres', en: 'help others' } },
];

export const proudById = (id: string | null | undefined) => SANTA_PROUD.find((p) => p.id === id) ?? null;
