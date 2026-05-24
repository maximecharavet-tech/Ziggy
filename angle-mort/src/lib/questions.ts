export interface Question {
  id: number;
  question: string;
  placeholder: string;
  depth: "surface" | "pensee" | "emotion" | "pattern" | "ombre";
}

export const questions: Question[] = [
  {
    id: 1,
    question:
      "Quand vous visualisez cet engagement, quelle sensation physique éprouvez-vous en premier ? Où la ressentez-vous dans votre corps ?",
    placeholder:
      "Décrivez avec précision cette sensation — sa localisation, sa texture, son intensité. Pas ce que vous pensez devoir ressentir, mais ce qui est réellement là.",
    depth: "surface",
  },
  {
    id: 2,
    question:
      "Y a-t-il des sujets que vous évitez d'aborder dans cette relation ? Qu'est-ce qui vous retient de les nommer ?",
    placeholder:
      "Ces silences que vous avez appris à habiter. Ces mots que vous reformulez ou ravallez. Qu'est-ce qui rend ces sujets intouchables pour vous ?",
    depth: "pensee",
  },
  {
    id: 3,
    question:
      "Comment vous comportez-vous lorsque vous êtes profondément déçu dans cette relation ? Reconnaissez-vous ce comportement ailleurs dans votre vie ?",
    placeholder:
      "Pas le comportement idéal que vous voudriez avoir — celui que vous avez réellement. La retraite, l'explosion, le silence, le sarcasme...",
    depth: "pensee",
  },
  {
    id: 4,
    question:
      "Quelle part de vous-même reste invisible dans cette relation ? Pourquoi cette part demeure-t-elle dans l'ombre ?",
    placeholder:
      "Il y a des versions de vous que vous ne montrez pas. Une ambition, une peur, un désir, une tristesse. Qu'est-ce que vous gardez pour vous seul ?",
    depth: "emotion",
  },
  {
    id: 5,
    question:
      "Quels compromis avez-vous faits depuis le début de cette relation ? Lesquels vous coûtent réellement ?",
    placeholder:
      "Distinguez les accommodements naturels de tout couple et ceux qui vous font perdre quelque chose d'essentiel. Qu'avez-vous mis de côté ?",
    depth: "emotion",
  },
  {
    id: 6,
    question:
      "Si vous vous décriviez dans cette relation comme un observateur extérieur bienveillant mais lucide le ferait — que verrait-il ?",
    placeholder:
      "Sortez de votre perspective intérieure. Qu'est-ce que quelqu'un qui vous aime vraiment, et qui vous connaît bien, remarquerait dans votre façon d'être dans cette relation ?",
    depth: "emotion",
  },
  {
    id: 7,
    question:
      "Quels schémas de vos relations passées reconnaissez-vous dans celle-ci ? Qu'est-ce qui se répète ?",
    placeholder:
      "Les mêmes types de conflits, les mêmes peurs, les mêmes dynamiques. L'histoire a-t-elle une façon de se répéter pour vous ?",
    depth: "pattern",
  },
  {
    id: 8,
    question:
      "Qu'est-ce que vous pensez souvent mais ne dites jamais dans cette relation ? Depuis combien de temps portez-vous ça ?",
    placeholder:
      "Ces pensées qui reviennent, la nuit ou en silence. Pas les reproches — les vérités que vous gardez pour vous et leur poids quotidien.",
    depth: "pattern",
  },
  {
    id: 9,
    question:
      "Quelles attentes vis-à-vis de cet engagement n'avez-vous jamais exprimées ? D'où viennent-elles selon vous ?",
    placeholder:
      "Ce que vous espérez en secret. Ce que vous attendez sans l'avoir demandé. La famille, les modèles de couples que vous avez vus, les manques de votre enfance — qu'est-ce qui nourrit ces attentes ?",
    depth: "pattern",
  },
  {
    id: 10,
    question:
      "Si cette relation était un miroir, qu'est-ce qu'elle révélerait de vous que vous préférez ne pas voir ?",
    placeholder:
      "La question la plus difficile. Ce n'est pas ce que la relation dit de l'autre — c'est ce qu'elle dit de vous. Votre capacité à recevoir l'amour, à rester, à partir, à vous montrer.",
    depth: "ombre",
  },
];

export const depthLabels: Record<Question["depth"], string> = {
  surface: "Surface",
  pensee: "Pensée",
  emotion: "Émotion",
  pattern: "Pattern",
  ombre: "Zone d'Ombre",
};
