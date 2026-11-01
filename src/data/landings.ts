/**
 * French SEO landing pages. Every sentence is taken from (or assembled from)
 * text already shown elsewhere on the site — no new claims, no prices.
 * They exist in French only: other locales are noindex and point their
 * canonical at the French page, and the sitemap lists the French URL only.
 */
export const FR_LANDING_PATHS = [
  '/jeux-educatifs-enfants',
  '/histoires-du-soir',
  '/coloriage-enfant-en-ligne',
  '/apprendre-ia-enfants',
  '/securite-parents',
] as const;

export type LandingPath = (typeof FR_LANDING_PATHS)[number];

export const LANDING_COPY: Record<LandingPath, { title: string; description: string; h1: string; intro: string[]; crumb: string; footer: string }> = {
  '/jeux-educatifs-enfants': {
    title: 'Jeux éducatifs pour enfants de 5 à 12 ans | Ziggy',
    description:
      'Mini-jeux et jeux 3D pour muscler la mémoire, le calcul et la logique des enfants de 5 à 12 ans. Sans publicité, jouable sans compte.',
    h1: 'Jeux éducatifs pour enfants',
    intro: [
      'On retient beaucoup mieux quand on s’amuse. Avec Ziggy, les enfants de 5 à 12 ans jouent pour muscler leur mémoire, leur calcul et leur logique — et tout comprendre à l’IA.',
      'Passer d’un jeu à l’autre (calcul, logique, mémoire) aide à choisir la bonne méthode. Étoiles, badges et récompenses transforment l’apprentissage en jeu : zéro pression, que du plaisir.',
    ],
    crumb: 'Jeux éducatifs',
    footer: 'Jeux éducatifs',
  },
  '/histoires-du-soir': {
    title: 'Histoires du soir pour enfants, lues par Ziggy',
    description:
      'Des histoires du soir pleines de valeurs (gentillesse, partage, courage…), racontées par la voix de Ziggy pour s’endormir en douceur.',
    h1: 'Histoires du soir pour enfants',
    intro: [
      'Le mode dodo de Ziggy, ce sont des histoires du soir pleines de valeurs, racontées par la voix de Ziggy.',
      'Chaque histoire se termine par une petite leçon, dite en une phrase. Choisissez-en une ci-dessous.',
    ],
    crumb: 'Histoires du soir',
    footer: 'Histoires du soir',
  },
  '/coloriage-enfant-en-ligne': {
    title: 'Coloriage enfant en ligne : Colorie avec Ziggy',
    description:
      'Coloriage en ligne pour enfants : choisis un dessin, une couleur, puis touche le dessin. Pinceaux magiques, paillettes, autocollants et 3D.',
    h1: 'Coloriage enfant en ligne',
    intro: [
      'Choisis un dessin, touche une couleur, puis touche le dessin. Pinceaux magiques, paillettes, autocollants… et ton dessin prend vie en 3D !',
    ],
    crumb: 'Coloriage en ligne',
    footer: 'Coloriage en ligne',
  },
  '/apprendre-ia-enfants': {
    title: 'Apprendre l’IA aux enfants de 5 à 12 ans | Ziggy',
    description:
      'Ziggy enseigne l’intelligence artificielle aux enfants en jouant : entraîne une vraie IA au Labo, découvre les biais et deviens expert de l’IA.',
    h1: 'Apprendre l’intelligence artificielle aux enfants',
    intro: [
      'Ziggy est un robot amical qui enseigne aux enfants l’intelligence artificielle, les maths, la logique et la créativité — en jouant, sans pression.',
      'Au Labo IA, l’enfant dessine des exemples, entraîne une vraie intelligence artificielle et regarde comment elle réfléchit. Tout se passe sur son appareil.',
      'Une IA reconnaît mal ce qu’elle a peu vu : c’est ce qu’on appelle un biais.',
    ],
    crumb: 'Apprendre l’IA',
    footer: 'Apprendre l’IA',
  },
  '/securite-parents': {
    title: 'Sécurité et confidentialité pour les parents | Ziggy',
    description:
      'Ziggy est pensé pour les enfants : aucune publicité, aucun échange avec des inconnus, compte géré par un parent, données stockées en Europe.',
    h1: 'Sécurité : ce que les parents doivent savoir',
    intro: [
      'Ziggy est pensé pour les enfants : aucune publicité, aucun échange avec des inconnus, et le compte est créé et géré par un parent.',
      'Nous ne conservons que le prénom de l’enfant, sa tranche d’âge et ses résultats de jeu, stockés en Europe. Le compte peut être supprimé à tout moment depuis l’espace parent.',
    ],
    crumb: 'Sécurité parents',
    footer: 'Sécurité parents',
  },
};
