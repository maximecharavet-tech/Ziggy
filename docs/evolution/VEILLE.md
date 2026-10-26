# Veille concurrentielle & idées de jeux — Ziggy

> **Date :** 2026-10-26. **Méthode :** recherches web (WebSearch) et vérification des licences par lecture directe du fichier `LICENSE` sur `raw.githubusercontent.com`. Les sites hors GitHub n'étaient pas accessibles en lecture directe depuis l'environnement (proxy) : les faits viennent donc des extraits de recherche, avec leur source.
> **Règles :** chaque fait renvoie à une source `[n]` (liste en section F). Pas de chiffre inventé : « non vérifié » quand aucune source n'a été trouvée. Les prix et notes changent souvent : ils sont donnés **à la date de la source**, pas comme des valeurs actuelles.
> **Ce que Ziggy a déjà** (lu dans `docs/GAME_ENGINE.md`, `docs/GAMES_3D.md`, `docs/DODO.md`, `src/lib/arcade/registry.ts`, `src/components/world/*`) : 20 jeux arcade adaptatifs sur 10 mécaniques (choice, runner, pairs, order, sort, spell, mix, dig, melody, slide), 20 mondes × 6 quêtes, 2 jeux 3D three.js (Noël, Luge), mode dodo (31 histoires + sons de sommeil), AI Lab (dessin + k-NN), boîtes de mémoire FSRS, palais de la mémoire, lecture à voix haute pour les non-lecteurs, console parents, atelier d'avatar (image IA), compagnons débloqués par étoiles. `docs/evolution/INVENTORY.md` n'existait pas au moment de la rédaction.

---

## A. Concurrents : tableau comparatif

### A.1 Applications internationales

| App | Ce que les enfants adorent | Ce que les parents apprécient | Modèle | Critiques |
|---|---|---|---|---|
| **Khan Academy Kids** (2–8 ans) | Mascotte Kodi l'ours, chansons originales, livres, leçons animées, activités créatives [1] | 100 % gratuit, sans pub ni abonnement [1][2] ; bibliothèque de livres documentaires (National Geographic, Bellwether), lecture à voix haute EN/ES [1] ; prix Common Sense, Parents' Choice [1] | Gratuit (non lucratif) [1] | Anglais américain [3] ; s'arrête au CE1 (2nd grade) [4] ; usage hors ligne : non vérifié |
| **Lingokids** (3+ ans) | Mélange de jeux (labyrinthes, logique, course, traçage de lettres, coloriage, mémoire, autocollants), chansons, sketchs vidéo [5] | Tableau de bord parent avec rapports de progrès, limites de temps d'écran, choix d'objectifs [8] | Abonnement après essai de 7 jours [5][9] ; Lingokids Plus listé à 14,99 $/mois [7] | Prix élevé [5] ; plaintes sur la clarté de l'essai et des prélèvements inattendus [5][6] ; peu de réflexion de haut niveau [5] |
| **Duolingo ABC** (3–7 ans) | Histoires interactives et plus de 700 leçons manipulables selon Apple [11] (300 selon [12]) | Gratuit, sans pub ni achat intégré, fonctionne hors ligne [10][11] ; parcours très progressif [10] | Gratuit [11] | On ne peut pas choisir son point de départ (les bons lecteurs doivent refaire les débuts) ; pas de profils multiples ; jeux de reconnaissance vocale = micro obligatoire [10] |
| **Toca Life World / Toca Boca World** (4+ ans) | Jeu libre de « maison de poupée » numérique : créer des histoires, Home Designer et Character Creator [15] ; diversité des personnages, jeu hors ligne [13] | Espace créatif et imaginatif [13] ; on peut masquer l'icône boutique [15] ; cadeaux gratuits chaque semaine [15] | Gratuit + achats intégrés (packs de lieux, accessoires) [15] | Beaucoup de contenu payant [14] ; achats pas toujours restaurés entre appareils, bugs avec perte de progression [13] ; avertissement confidentialité [13] |
| **Sago Mini World** (tout-petits) | Jeu ouvert « sans règles », l'enfant décide [17] ; personnages récurrents (Harvey le chien, Jinja la chatte) [18] | Sans pub ni achat intégré pour les abonnés, jeux téléchargeables hors ligne, un abonnement pour plusieurs appareils [17] ; aide officielle [16] | Abonnement mensuel/annuel après essai [17] | Certains titres jugés « un peu creux et répétitifs » [18] |
| **Pok Pok** (préscolaire) | « Jouets » numériques sans points, sans niveaux, sans gagner ni perdre ; impossible de « faire faux » [19][20] | Calme, sans pub, pas de boucles de récompense bruyantes [20] ; Apple Design Award « Delight and Fun » [21] | Abonnement : 6,99 $/mois ou 45,99 $/an après 7 jours d'essai selon [21] ; autres paliers sur l'App Store US [19] | Prix variable selon les pays (ex. 9,49 €/mois cité en France) [19][21] ; pas d'objectif d'apprentissage explicite [20] |
| **ABCmouse** (3+ ans) | Tickets gagnés à chaque leçon, dépensés pour décorer une chambre virtuelle, avatar et animaux [24] | Programme K–2 complet [23] ; sans pub [24] | Abonnement [23] | Résiliation et facturation difficiles [23][24] ; certains enfants trouvent ça répétitif [23] ; données personnelles vendues ou louées selon Common Sense [23] ; boutiques « filles/garçons » critiquées [24] |
| **PBS KIDS Games** (2–8 ans) | Personnages des séries PBS ; puzzles, appariement, aventure, outils créatifs [25] ; plus de 280 jeux selon [25] | Gratuit, sans pub ni achat intégré [26] ; jeux téléchargeables hors ligne [25][26] ; pas de messagerie [27] | Gratuit (service public) [26] | Pas de comptes enseignant, ni de rapports de progrès [25] |
| **Endless Alphabet** (Originator) | Monstres rigolos, lettres qui parlent et gigotent, chaque mot illustré par une petite animation de son sens (ex. un monstre qui grandit pour « gargantuan ») [29] | « Pas de score, pas d'échec, pas de stress » [30] ; vrai vocabulaire [29] | Achat unique (8,99 $ sur iPad selon [30]) | Nom trompeur (c'est du vocabulaire, pas l'alphabet) [29] ; connexion requise au premier lancement [30] |
| **LEGO DUPLO World** (2+ / 3–7 ans) | Briques qui réagissent, graphismes vifs, jeu ouvert + mini-jeux (tri par couleur, ordre des nombres) [31] | Pensé pour le jeu à deux parent-enfant [31] ; calme, sans score ni minuteur [32] ; version Netflix sans pub et hors ligne [33] | Packs payants (StoryToys) ou inclus dans Netflix [33] | Peu de pièces par scène ; pousse à la fidélité à la marque [31] |
| **Montessori Preschool** (Edoki, 3–7 ans) | Exploration autonome « comme une vraie classe Montessori » (avis parent) [36] | Plus de 30 apps, lecture/maths/musique [35] ; 7 langues [34] | Abonnement : 5,24 $/mois ou 59 $/an selon [35] | Un parent demande l'espagnol et le français [36] (la VF n'est pas confirmée par nos sources) |
| **Marbotic** (3+ ans) | Lettres et chiffres en bois qu'on pose sur l'iPad : le jouet physique pilote l'app [37] | Sans pile, Wi-Fi ni Bluetooth ; solide [37][38] | Matériel 50–60 $ + apps [37] | Une app difficile à débloquer ; l'intérêt dépend des apps [37] ; avis surtout de 2016–2021 |
| **Kahoot! Kids / DragonBox** (4+ / 9+) | Les « Nooms » à manipuler pour sentir les nombres [40] ; algèbre et géométrie déguisées en jeu [41] | Bundle de plusieurs apps (DragonBox, Poio, Kahoot!) [41] | Abonnement Kahoot! Kids (essai 7 jours) [39] ; 9,99 $/mois ou 59,99 $/an en 2022 [41] | Rapports parents absents au moment d'un test [40] ; doute sur la publicité personnalisée [41] |

### A.2 Acteurs francophones

| App | Points forts | Modèle | Critiques / limites |
|---|---|---|---|
| **Lalilo** (CP–CE, classe) | Web app de lecture avec reconnaissance vocale pour évaluer la lecture à voix haute, retour immédiat [43] | Fin de la gratuité pour les enseignants annoncée pour septembre 2025, puis 49 € TTC/an par classe selon [44][45] | Outil classe, pas famille ; aucun avis d'enseignant trouvé |
| **Kalulu** (lecture, 5–7 ans) | Méthode phonique de S. Dehaene / Collège de France : livrets, jeux, app [46] | App gratuite, livrets vendus à prix coûtant [47] | Une évaluation montre surtout un progrès sur ce que les mini-jeux enseignent directement, sans effet général marqué [48] |
| **Bayam** (Bayard, 3–10 ans) | Dessins animés, jeux, ateliers, livres audio ; plus de 2 500 activités selon [50] | Abonnement (5,99 €/mois ou 54,99 €/an selon [49]) ; l'offre premium débloque la gestion du temps, le compte famille et le hors ligne [49] | Prix différents selon les sources et les dates [49][51] |
| **Lunii — Ma Fabrique à Histoires** (3–8 ans) | L'enfant compose son histoire en choisissant héros, lieu et objet ; sans écran, fabriqué en France [52] | Appareil 64,90–99,90 € [53] ; location Lunii+ à 11,90 €/mois [52] | Avis détaillés rares [52] |
| **« Gus et Gaby »** | **Non vérifié** : aucune app de ce nom trouvée (seulement *Gus on the Go*, une app de langues sans pub ni tracking) [54] | — | — |

**Ce qu'on retient pour Ziggy :**
1. Les apps les plus aimées des petits (Toca, Sago, Pok Pok, DUPLO) misent sur le **jeu libre sans échec**.
2. Les parents récompensent le **sans pub / sans achat intégré**, le **hors ligne** et la **transparence de facturation**. Les pires critiques visent la facturation (Lingokids, ABCmouse).
3. Les personnages forts et animés (Kodi, les monstres d'Endless Alphabet, Harvey) fidélisent.
4. Les petits concurrents français sont soit scolaires (Lalilo, Kalulu), soit des médias (Bayam, Lunii). **Aucun ne combine jeux adaptatifs, mondes et histoires du soir en français.**

---

## B. Types de jeux les plus populaires sur les sites gratuits

| Site | Ce qui ressort | Source |
|---|---|---|
| PBS KIDS | Les jeux les plus joués de l'app cités sont des **outils de création** : *Road Repair*, *Toy Maker*, *Story Emporium* (20 millions de parties au moment de l'article). Catégories : puzzles, appariement, aventure, outils créatifs. | [28][25] |
| ABCya | *ABCya Paint* présenté comme le jeu n°1 du site (copie probable du site, non confirmée) ; catégories maths et phonologie ; « plus d'un milliard de parties par an » selon l'éditeur | [57][56] |
| National Geographic Kids | Quiz, quiz de personnalité, puzzles, action-aventure, textes à trous rigolos | [58] |
| CBC Kids (4–10 ans) | Aventure, jeux débutants, animaux, sport, puzzles (source indirecte) | [59] |
| Coolmath Games | *Run 3* (course sans fin), *Fireboy & Watergirl* (**coopération à deux** : chacun son élément), *Papa's* (restaurant, gestion du temps), *Bloxorz* (puzzle 3D), *Moto X3M* (physique). Sources faibles, sans classement officiel. | [60][61] |
| Poki Kids | Puzzles, aventure, construction et bac à sable, habillage. Sources peu fiables, aucun chiffre de parties. | non vérifié |
| Starfall | Phonologie et lecture précoce ; graphisme jugé daté ; pas de suivi des progrès | [62][63] |
| GCompris (2–10 ans) | Plus de 100 activités ([64]) ou plus de 150 ([65]) : découverte de l'ordinateur, calcul, sciences, jeux, lecture, heure, braille | [64][65] |
| Scratch (8–16 ans) | **Créer** ses jeux et animations, studios, partage ; chiffres officiels à vérifier sur scratch.mit.edu | non vérifié |
| Tendances générales | Roblox (56 %) et Minecraft (26 %) sont les jeux les plus joués par les enfants suivis par Qustodio en 2021 : **bac à sable, construction, social**. Animal virtuel : la franchise Talking Tom compte des milliards de téléchargements, et *My Talking Tom Friends* en a fait 60 millions en deux semaines. Coloriage : environ 257 millions de téléchargements pour *Happy Color*. Musique : Chrome Music Lab (Song Maker, Rhythm, Kandinsky) est très utilisé en classe. | [67][68][69][85][70][71] |

**Classement qualitatif des types de jeux** (à partir des sources ci-dessus, sans chiffres comparables entre sites) :
1. **Création** : peinture, coloriage, construction, fabrique de jouets ou d'histoires.
2. **Puzzles et logique.**
3. **Bac à sable et construction** (type Minecraft/Roblox).
4. **Action** : course sans fin, physique.
5. **Gestion et cuisine** (type Papa's).
6. **Animal ou compagnon à soigner.**
7. **Habillage et personnalisation.**
8. **Quiz thématiques.**
9. **Création musicale.**
10. **Coopération à deux.**

**Ziggy couvre bien le 2, le 4 et le 8. Il couvre peu le 1, le 3, le 6, le 7, le 9 et le 10.**

---

## C. Auto-audit : Ziggy face aux concurrents

### C.1 Là où Ziggy est en avance
- **Adaptatif réel** : BKT + niveau 1–5 + FSRS + Quest Engine (`GAME_ENGINE.md`). La plupart des concurrents gratuits n'ont pas de suivi des progrès (PBS [25], Starfall [63]). Duolingo ABC impose son point de départ [10], alors que Ziggy adapte le niveau.
- **Zéro échec avec apprentissage explicite** : le meilleur des deux mondes. Pok Pok n'a pas d'objectif d'apprentissage [20] ; Ziggy garde « pas d'échec » tout en suivant la maîtrise.
- **Français d'abord, de 4 à 12 ans** : Khan Kids est en anglais américain et s'arrête au CE1 [3][4] ; PBS vise les 2–8 ans [25] ; la VF de Montessori Preschool n'est pas confirmée [36].
- **Lecture à voix haute intégrale pour les non-lecteurs** : consignes, réponses, retours.
- **Mode dodo** : 31 histoires, sons de sommeil, minuterie. Lunii fait sans écran mais payant [52][53] ; aucun concurrent d'apps éducatives cité ne l'intègre.
- **Web, sans installation, sans pub ni achat intégré.** Pas de facturation piège : c'est la critique n°1 de Lingokids et d'ABCmouse [5][23].
- **Transparence pour les parents** : console qui montre l'usage de l'IA, ChildShield, consentements et suppression des données. ABCmouse et Toca ont des avertissements de confidentialité [13][23].
- **Originalité** : AI Lab (dessin + k-NN), palais de la mémoire, 3D dans le navigateur.

### C.2 Là où Ziggy est en retard (par priorité)

| # | Manque | Constat dans Ziggy | Qui le fait bien | Impact |
|---|---|---|---|---|
| 1 | **Jeu libre / bac à sable** | Les 10 mécaniques attendent toutes une « bonne réponse » ; aucun espace sans objectif | Toca [15], Sago [17], Pok Pok [20], DUPLO [31] | Très fort (4–7 ans) |
| 2 | **Compagnon à soigner** | Les compagnons se débloquent par étoiles et se choisissent (`CompanionsPage.tsx`), mais on ne s'en occupe pas : ni maison, ni croissance, ni interaction | Talking Tom [68][69], animaux d'ABCmouse [24] | Très fort (fidélisation) |
| 3 | **Outils de création** (peinture, coloriage, construction) | DrawPad sert seulement à l'AI Lab ; pas d'atelier de dessin ou de coloriage libre ; aucune construction | ABCya Paint [57], PBS Toy Maker [28], Crayola [76] | Très fort (premier type de jeu en B) |
| 4 | **Création musicale** | La mécanique `melody` fait répéter un air, pas composer | Chrome Music Lab [70] | Fort |
| 5 | **Vrai hors ligne / app installable** | `manifest.json` présent, mais aucun service worker trouvé dans `src/` | PBS [26], Duolingo ABC [11], Sago [17], Toca [13] | Fort (voiture, vacances, confiance des parents) |
| 6 | **Jeu à deux, parent-enfant** | Rien de prévu pour jouer à deux | DUPLO [31], Fireboy & Watergirl [60] | Fort (différenciant, et les parents l'aiment) |
| 7 | **Personnalisation vivante** (habillage, chambre ou maison) | L'atelier d'avatar produit une image IA fixe ; pas de garde-robe ni de lieu à décorer | Toca Home Designer [15], chambre d'ABCmouse [24] | Moyen-fort |
| 8 | **Finition : animation des personnages, sons, voix** | Les réponses sont des emoji ; sons procéduraux ; voix TTS | Kodi et chansons [1], monstres d'Endless Alphabet [29], chansons de Lingokids [5] | Moyen-fort (première impression) |
| 9 | **Volume de contenu et vidéos/chansons** | 20 jeux, 2 en 3D, 31 histoires | Plus de 280 jeux chez PBS [25], plus de 2 500 activités chez Bayam [50] | Moyen |
| 10 | **Profils multiples et compte-rendu aux parents** | Console riche, mais profils multiples et résumé hebdomadaire non vérifiés | Bayam jusqu'à 6 profils [49] ; Duolingo ABC critiqué faute de profils [10] ; tableau de bord Lingokids [8] | Moyen |
| 11 | **Lecture à voix haute par l'enfant** (reconnaissance vocale) | TTS seulement, Ziggy ne peut pas écouter l'enfant lire | Lalilo [43], Duolingo ABC [10] | Moyen (fort en CP), mais délicat pour la vie privée |
| 12 | **Lien avec le monde physique** (imprimer, scanner, objets) | Aucun | Quiver [73], Marbotic [37] | Faible à moyen |
| 13 | **Accueil sans texte** | AgePicker existe ; tutoriel visuel au premier lancement à vérifier | Sago, Pok Pok (pas de consignes écrites) [17][20] | Moyen |

---

## D. 25 idées de jeux innovants pour Ziggy

Mécaniques décrites avec nos propres mots ; les concurrents servent seulement d'inspiration. ★ = top 8. Effort : S ≈ moins d'une semaine, M ≈ 1 à 3 semaines, L ≈ plus de 3 semaines.

| # | Nom FR | Âge | Mécanique | Compétence | Pourquoi les enfants vont adorer | Effort | 2D/3D |
|---|---|---|---|---|---|---|---|
| 1 ★ | **Mon coloriage prend vie** | 4–10 | L'enfant colorie un gabarit à plat (créature, véhicule, maison). Le gabarit est dessiné comme le « patron » d'un modèle low-poly three.js : la toile du coloriage devient directement la texture du modèle. La créature sort de la page, marche, saute et rejoint son monde. Version 2 : coloriage papier imprimé, photo, détection de cadre, puis même rendu (principe de Quiver [73][75] et de Disney Research [80][81]). | Couleurs, motricité fine, vocabulaire | Voir son propre dessin vivre en 3D, c'est le « waouh » qu'ont prouvé Quiver et Color Alive [78] | M (écran), L (papier + caméra) | 3D |
| 2 ★ | **Le Nid de mon compagnon** | 4–9 | Le compagnon vit dans un petit jardin-maison. Ses besoins (faim, jeu, câlin, sommeil) s'affichent en pictogrammes, et chaque soin est un micro-défi : cueillir 4 baies, choisir l'aliment qui pousse dans un arbre. Il grandit et change d'apparence avec la **maîtrise**, jamais avec le temps passé. Il ne tombe jamais malade, n'est jamais triste et ne culpabilise personne. Le soir, il s'endort avec le mode dodo. | Calcul, tri, vocabulaire, routines | Avoir « son » animal qui grandit grâce à soi (attrait prouvé par Talking Tom [68]) | M | 2D, ou 3D avec le kit |
| 3 ★ | **La Fabrique à chansons** | 5–12 | Grille de séquenceur où chaque ligne est un animal-instrument. On peint des notes et la boucle tourne. Mode petits : 4 temps, 5 notes pentatoniques, impossible de jouer faux. Mode grands : mesures, silences, tempo, et les fractions de temps rendues visibles. L'enfant peut enregistrer sa voix sur un temps, et Ziggy rejoue le morceau en le chantant. Les créations vont dans la collection. | Rythme, motifs, comptage, fractions | Créer « sa » chanson et la faire écouter (succès de Chrome Music Lab en classe [70]) | M | 2D |
| 4 ★ | **Les Briques de Ziggy** | 5–12 | Constructeur de voxels en 3D : poser et retirer des blocs sur une île, choisir couleur et symétrie. Des cartes-défis facultatives (« une tour de 12, 3 étages rouges », « une maison de volume 24 ») donnent des étoiles. Ce qu'on construit devient un lieu visitable, par exemple la maison du compagnon. | Dénombrement, géométrie, volume, planification | Le bac à sable de construction est le genre n°1 des enfants (Minecraft, Roblox [67]) | L | 3D |
| 5 ★ | **À deux, c'est magique !** | 4–12 + adulte | Coopération sur une seule tablette : écran partagé et deux rôles complémentaires, par exemple le petit pousse les blocs de couleur pendant que le grand ou le parent active les ponts numérotés. Aucun des deux ne peut réussir seul (principe de Fireboy & Watergirl [60]). Ziggy adapte le défi de chaque joueur à son niveau. | Coopération, langage, calcul ou lecture selon le rôle | Jouer **avec** papa ou maman ; les parents adorent le jeu partagé (DUPLO [31]) | M | 2D |
| 6 ★ | **La Ville des formes** | 5–10 | L'enfant touche une grille pour poser formes et couleurs. Un algorithme d'assemblage de tuiles (type Wave Function Collapse [E]) choisit automatiquement la bonne pièce (toit, arche, escalier), donc la ville est toujours jolie. Défis facultatifs : « 3 maisons symétriques », « une rue de 8 ». | Formes, symétrie, repérage spatial | Tout ce qu'on touche devient beau : zéro frustration, effet jouet | M | 3D |
| 7 ★ | **Le Bac à sable magique** | 5–12 | Simulation de particules : sable, eau, graine, glace, vent, lumière. On découvre des règles (eau + graine = plante, soleil + glace = eau) qu'on note dans un carnet de découvertes. Pas d'objectif, seulement des découvertes à cocher. | Sciences (états de la matière, cause et effet), observation | Expérimenter librement et provoquer des réactions en chaîne (succès des jeux de « falling sand » comme Sandspiel [E]) | M | 2D |
| 8 ★ | **Le Musée de mes créations** | 4–12 | Galerie 3D où l'on se promène et où sont exposés les coloriages vivants, les chansons, les constructions et les histoires. Les parents la visitent depuis la console, et l'enfant peut « inviter » un grand-parent avec un lien privé lisible seulement. Elle s'appuie sur le palais de la mémoire existant. | Fierté, mémoire, langage (l'enfant commente ses œuvres) | Montrer ce qu'on a fait ; c'est la colle qui relie tous les jeux de création | M | 3D |
| 9 | Mon dessin danse | 5–10 | L'enfant dessine un bonhomme, puis touche tête, mains et pieds pour placer un squelette simple. Le dessin danse sur une musique de la Fabrique à chansons. (Idée d'Animated Drawings [82][E], en version simplifiée avec articulations manuelles.) | Schéma corporel, rythme | Son dessin bouge comme une marionnette | L | 2D |
| 10 | Le Restaurant de Ziggy | 6–12 | Commandes en images ; on dose des ingrédients (moitiés, quarts) et on rend la monnaie aux grands. Pas de chrono qui punit : les clients patientent en chantonnant. | Fractions, monnaie, mémoire de travail | Cuisiner et servir, comme les jeux Papa's [60], sans le stress | M | 2D |
| 11 | La Garde-robe des saisons | 4–7 | Ziggy annonce la météo et l'enfant habille le compagnon ou l'avatar (bottes, écharpe, chapeau de soleil). Mode libre de défilé. | Vocabulaire, saisons, logique | Habiller et personnaliser (genre populaire en B) | S | 2D |
| 12 | Les Constellations chantantes | 5–9 | Relier des étoiles dans l'ordre des nombres (ou des lettres). Chaque trait joue une note, et la figure terminée joue une mélodie et s'anime. | Suite numérique, alphabet | Dessiner de la musique | S | 2D |
| 13 | L'Atelier des machines | 7–12 | Placer rampes, ressorts, dominos et ventilateurs pour amener une bille jusqu'au compagnon. Simulation physique, plusieurs solutions possibles. | Cause et effet, logique, persévérance | Le plaisir des réactions en chaîne | M | 2D |
| 14 | La Maison de poupée de Ziggy | 4–8 | Scènes libres (cuisine, école, plage) avec des personnages et objets à déplacer. On enregistre sa voix pour raconter sa scène, puis on la rejoue comme un petit film. | Langage oral, récit | Jeu libre façon Toca [15] avec sa propre voix | L | 2D |
| 15 | Lis à Ziggy | 5–8 | L'enfant lit un mot ou une phrase à voix haute. La reconnaissance vocale tourne **sur l'appareil uniquement** (aucun audio envoyé, avec consentement parental), et Ziggy réagit par une animation. Inspiré de Lalilo et Duolingo ABC [43][10]. | Fluence de lecture | Être écouté et voir Ziggy réagir à sa voix | L | 2D |
| 16 | Les Lettres-bestioles | 4–7 | Chaque lettre est une petite bête qui gigote quand on la traîne et dit son **son**. Le mot complété joue une mini-animation de son sens (idée d'Endless Alphabet [29], adaptée aux graphèmes français). | Phonologie, vocabulaire | Des lettres vivantes et drôles | M | 2D |
| 17 | Le Potager du temps | 6–12 | Chaque carte FSRS à revoir est une plante qui mûrit au rythme réel des révisions : on la récolte en répondant. Un potager bien tenu attire des papillons rares. | Mémorisation à long terme | Revenir chaque jour voir pousser son jardin | S–M | 2D |
| 18 | L'Archipel à la voile | 7–12 | Petit monde ouvert 3D : on dirige un voilier au vent entre des îles, et chaque île est un fait de géographie ou de sciences. La boussole et les points cardinaux servent vraiment. | Géographie, orientation | Explorer librement en 3D | L | 3D |
| 19 | Le Train des nombres | 4–8 | Poser des rails (droit, virage, pont) puis charger des wagons qui doivent arriver avec le bon total (compléments à 10). | Décomposition des nombres, espace | Construire puis voir rouler son train | M | 3D |
| 20 | Le Théâtre d'ombres | 6–12 | Choisir des marionnettes et un décor, puis enregistrer le dialogue. Ziggy en fait un spectacle à rejouer, en lien avec la Fabrique à histoires. | Récit, oral, émotions | Mettre en scène sa propre pièce | M | 2D |
| 21 | La Chorale des animaux | 4–7 | Glisser un chapeau sur un animal ajoute une boucle (percussion, basse, mélodie). Toutes les boucles vont toujours ensemble. | Écoute, motifs | Créer de la musique en un geste | S | 2D |
| 22 | Programme ton compagnon | 5–9 | Cartes de commandes (avancer, tourner, sauter, répéter ×3) pour guider le compagnon sur une grille 3D jusqu'à un trésor. Mode libre : programmer sa danse. Dans l'esprit de ScratchJr [E]. | Pensée algorithmique | Donner des ordres à son compagnon | M | 3D |
| 23 | La Cabane à énigmes en famille | 6–12 + adulte | Escape game asymétrique : l'enfant joue sur la tablette, le parent reçoit des indices sur son téléphone, et ils doivent se parler pour avancer. | Communication, logique, lecture | Mener l'enquête avec ses parents | M | 2D |
| 24 | La Tour qui penche | 4–10 | Empiler des formes en équilibre sur le dos d'un éléphant. Les formes demandées (« un triangle, puis deux carrés ») servent d'exercice. | Formes, équilibre, motricité | Le suspense de la tour qui vacille, sans perdre : la tour se rattrape | S | 2D |
| 25 | La Fête des saisons | 4–12 | Événement saisonnier dans toutes les mondes (Halloween doux, Noël, printemps) : objets à collectionner pour le Nid et la ville, et quêtes spéciales générées par le Quest Engine. | Transversal | Des surprises qui reviennent (le jeu de Noël 3D existe déjà) | S par événement | 2D/3D |

**Pourquoi ce top 8 :** il comble à la fois les manques n°1 à 4 et n°6 à 7 (jeu libre, compagnon, création, musique, coopération, personnalisation). Il réutilise le kit 3D et le moteur adaptatif existants. Et il donne un lieu de vie aux créations (le Musée), ce qui fidélise. Ordre conseillé : 2 → 3 → 1 → 8 → 7 → 5 → 6 → 4.

---

## E. Dépôts open source

### E.1 Licence permissive vérifiée

Le fichier `LICENSE` de chaque dépôt a été lu sur `raw.githubusercontent.com/<repo>/HEAD/…` le 2026-10-26. Rappels : Apache-2.0 impose de conserver le fichier `NOTICE` et les avis de copyright ; MIT et BSD imposent de conserver l'avis de copyright ; les **assets** (sons, images) peuvent avoir une licence différente du code ; la règle du projet reste « idées d'abord » (`GITHUB_INSPIRATION.md`).

| Dépôt | Licence vérifiée | Idée réutilisable pour Ziggy |
|---|---|---|
| https://github.com/facebookresearch/AnimatedDrawings | MIT | Pipeline détection → segmentation → pose → animation d'un dessin d'enfant (idée 9). Le modèle est lourd (Python) : s'en inspirer, ou simplifier avec des articulations placées à la main. |
| https://github.com/googlecreativelab/chrome-music-lab | Apache-2.0 | Expériences Song Maker, Rhythm, Kandinsky : ergonomie de séquenceur pour enfants (idées 3, 12, 21) |
| https://github.com/Tonejs/Tone.js | MIT | Moteur audio web (transport, boucles, synthés) pour la Fabrique à chansons |
| https://github.com/johnnesky/beepbox | MIT | Interface de séquenceur en grille compacte, partage de morceaux par URL |
| https://github.com/MaxBittker/sandspiel | MIT | Simulation de particules type « falling sand » (idée 7) |
| https://github.com/mxgmn/WaveFunctionCollapse | MIT | Assemblage automatique de tuiles cohérentes (idée 6, Ville des formes) |
| https://github.com/liabru/matter-js | MIT | Physique 2D pour l'Atelier des machines et la Tour qui penche (idées 13, 24) |
| https://github.com/LLK/ScratchJr | BSD-3-Clause | Blocs de programmation pictographiques pour 5–7 ans (idée 22) |
| https://github.com/google/blockly · https://github.com/scratchfoundation/scratch-blocks | Apache-2.0 (les deux) | Éditeur de blocs pour la programmation des 8–12 ans |
| https://github.com/google/blockly-games | Apache-2.0 | Progression de puzzles de code sans enseignant (labyrinthe, oiseau, tortue) |
| https://github.com/googlecreativelab/teachable-machine-v1 | Apache-2.0 | Entraîner un modèle avec la webcam en direct : extension possible de l'AI Lab |
| https://github.com/googlecreativelab/semi-conductor | Apache-2.0 | Diriger un orchestre avec ses bras (pose estimée à la webcam) : variante d'une idée musicale |
| https://github.com/magenta/magenta-js | Apache-2.0 | Accompagnement musical et dessins (SketchRNN) côté navigateur |
| https://github.com/tensorflow/tfjs-models | Apache-2.0 | Pose, mains et détection d'objets dans le navigateur (danse, gestes, sans serveur) |
| https://github.com/piskelapp/piskel | Apache-2.0 | Éditeur de pixel-art avec animation image par image |
| https://github.com/1j01/jspaint | MIT | Outils de peinture classiques (remplissage, formes) pour un atelier de dessin |
| https://github.com/le-doux/bitsy | MIT | Créer son propre petit jeu (pièces, dialogues) : version simplifiée pour les 9–12 ans |
| https://github.com/increpare/PuzzleScript | MIT | Règles de puzzles à base de motifs : générateur de casse-têtes |
| https://github.com/llaske/sugarizer | Apache-2.0 | Plateforme web d'activités pour enfants (journal, multi-utilisateurs, hors ligne) |
| https://github.com/learningequality/kolibri | MIT | Apprentissage **hors ligne** et synchronisation entre appareils (manque n°5) |
| https://github.com/oppia/oppia | Apache-2.0 | Leçons interactives avec retours selon la réponse (« explorations ») |
| https://github.com/Khan/perseus | MIT | Widgets d'exercices de maths (nombres, graphes, glisser-déposer) |
| https://github.com/dicebear/dicebear · https://github.com/fangpenlin/avataaars-generator | MIT (les deux) | Avatars vectoriels combinables **sans IA**, donc hors ligne et instantanés (garde-robe, idée 11) |
| https://github.com/metafizzy/zdog | MIT (README : « Licensed MIT » ; pas de fichier LICENSE trouvé à la racine) | Pseudo-3D « plate » très légère pour des personnages animés mignons |
| https://github.com/kaplayjs/kaplay | MIT | Moteur 2D simple, alternative légère à Phaser pour de petits jeux |
| https://github.com/microsoft/pxt | MIT | MakeCode : blocs ↔ code + simulateur (programmation pour les grands) |
| https://github.com/4ian/GDevelop | MIT (cœur, GDJS, IDE ; nom et logo exclus) | Comportements prêts à l'emploi (plateforme, physique) pour un « créateur de jeux » |
| https://github.com/paperjs/paper.js | MIT | Dessin vectoriel, lissage du tracé de l'enfant |
| https://github.com/gabrielecirulli/2048 | MIT | Boucle de fusion simple, à adapter aux additions et doubles |
| https://github.com/ncase/loopy · https://github.com/ncase/polygons | CC0-1.0 (domaine public) | Simulations explicatives jouables (systèmes, cause et effet) pour les 10–12 ans |
| (déjà utilisés ou connus) https://github.com/mrdoob/three.js · https://github.com/pmndrs/react-three-fiber · https://github.com/pixijs/pixijs · https://github.com/shakiba/planck.js | MIT (tous) | Rendu 3D et 2D, physique |

### E.2 Idée seulement (copyleft, licence incertaine ou données)

| Projet | Licence | Idée |
|---|---|---|
| GCompris — https://github.com/KDE/gcompris | AGPL-3.0 pour l'application selon le README (vérifié le 2026-10-10, `GITHUB_INSPIRATION.md`) | Catalogue de plus de 100 activités par domaine [64] |
| Tux Paint — https://tuxpaint.org | GPL-2.0 (ou ultérieure selon les sources) [72] | Tampons, « outils magiques » (herbe, bulles), sons d'outils : la référence du dessin pour enfants |
| Scratch GUI — https://github.com/scratchfoundation/scratch-gui | AGPL-3.0 (vérifié) | Communauté de création et de remix |
| Snap! — https://github.com/jmoenig/Snap | AGPL-3.0 (vérifié) | Programmation par blocs avancée |
| Strudel — https://github.com/tidalcycles/strudel | AGPL-3.0 (vérifié) | Live-coding de motifs musicaux |
| Music Blocks / Turtle Blocks JS — https://github.com/sugarlabs/musicblocks · https://github.com/sugarlabs/turtleblocksjs | AGPL-3.0 (vérifié) | Musique et dessin par blocs |
| Voxel Builder — https://github.com/nimadez/voxel-builder | GPL-3.0 (vérifié) | Ergonomie d'un éditeur de voxels web |
| BrowserQuest — https://github.com/mozilla/BrowserQuest | Code sous MPL-2.0 (copyleft faible, vérifié) | Petit monde multijoueur en HTML5 |
| Simulations PhET — https://github.com/phetsims | Dépôts de simulations archivés, monorepo non public ; licence des simulations non vérifiée (la bibliothèque `phetsims/scenery` est sous MIT) | Simulations de sciences manipulables |
| Quick, Draw! dataset — https://github.com/googlecreativelab/quickdraw-dataset | Données sous CC-BY-4.0 (vérifié) : utilisable **avec attribution** | Classes de croquis pour l'AI Lab |
| Twine, EdGameClaw | GPL-3.0 / AGPL-3.0 (voir `GITHUB_INSPIRATION.md`) | Récits à embranchements, génération de jeux |

---

## Annexe : applications de coloriage et principe du « dessin qui prend vie »

- **Quiver** : on imprime une page Quiver, on la colorie à la main (crayons, feutres), puis l'app la reconnaît à la caméra. Le personnage apparaît en 3D animé avec **les couleurs de l'enfant**, on peut tourner autour et le toucher pour jouer [73][74][75]. Limite : seules les pages Quiver fonctionnent [75]. Gratuit avec achats intégrés [74].
- **Crayola Color Alive 2.0** : modèles 3D animés en réalité augmentée, qui « ressemblent exactement à ce qui a été colorié ». On peut animer, déplacer, prendre des photos et des vidéos ; fonctionne hors ligne une fois le contenu téléchargé [78][79].
- **Principe technique** (Disney Research, ISMAR 2015) : reconnaître et suivre la page, puis reporter chaque pixel du dessin 2D sur la surface correspondante du modèle 3D. Les zones cachées sont aussi texturées, pour pouvoir faire le tour du personnage [80][81]. **Pour Ziggy, sans caméra** : si le gabarit de coloriage *est* le patron UV du modèle, le canvas sert directement de texture three.js (`CanvasTexture`). Il n'y a ni vision, ni réseau, ni donnée personnelle, et le rendu se fait en temps réel pendant le coloriage. La version papier ajoute ensuite photo, détection des 4 coins et redressement de perspective.
- **Crayola Create and Play** : le coloriage reste dans les traits tant que le doigt reste posé (certains parents n'aiment pas cette « perfection automatique ») ; abonnement jugé cher (5,99 $/mois en date de la critique) [76] ; un temps inclus dans Apple Arcade [77].
- **Happy Color** : coloriage par numéros, on touche une zone pour la remplir. Énorme bibliothèque gratuite, fonctionne sans Wi-Fi, mis en avant comme relaxant (affirmation de l'éditeur) [84][85].
- **Lake, Colorfy** : non vérifié (pas de source fiable trouvée).
- **Animated Drawings (Meta)** : anime les dessins de personnages humains ; démo publique utilisée par des millions de personnes ; code et environ 180 000 dessins publiés en 2023 [82][83] ; code sous MIT (vérifié, section E).
- **Ce qui fait aimer ces apps** : résultat beau à coup sûr (rester dans les traits, remplissage), **surprise** (le dessin s'anime), sentiment de « c'est **mon** personnage », sessions courtes et calmes, hors ligne.

---

## F. Sources

1. https://apps.apple.com/app/1378467217
2. https://www.educatorstechnology.com/2026/09/khan-academy-kids-review.html
3. https://childrenandmedia.org.au/app-reviews/apps/khan-academy-kids
4. https://homeschoolfox.com/curriculum/khan-academy-kids
5. https://www.commonsensemedia.org/app-reviews/lingokids-play-and-learn
6. https://www.commonsensemedia.org/app-reviews/lingokids-play-and-learn/user-reviews/adult
7. https://www.educationalappstore.com/app/lingokids-english-for-kids
8. https://techpoint.africa/guide/lingokids-tested-review/
9. https://childrenandmedia.org.au/app-reviews/apps/lingokids
10. https://www.commonsensemedia.org/app-reviews/duolingo-abc-learn-to-read
11. https://apps.apple.com/us/app/learn-to-read-duolingo-abc/id1440502568?l=en
12. https://www.educationalappstore.com/app/duolingo-abc
13. https://www.commonsensemedia.org/app-reviews/toca-life-world-build-stories
14. https://childrenandmedia.org.au/app-reviews/apps/toca-life-world-build-stories-create-your-world
15. https://apps.apple.com/app/toca-life-world-build-a-story/id1208138685
16. https://help.sagomini.com/article/368-what-is-sago-mini-world
17. https://apps.appfollow.io/ios/sago-mini-world-kids-games/874425722?country=us
18. https://www.commonsensemedia.org/app-reviews/sago-mini-fairy-tales
19. https://apps.apple.com/us/app/pok-pok-montessori-preschool/id1550204730
20. https://www.educationalappstore.com/app/pok-pok
21. https://www.cubbyathome.com/pok-pok-playroom-kids-app-review-80027995
22. https://betakit.com/snowman-gaming-studio-spinout-pok-pok-closes-3-9-million-cad-to-help-kids-learn-through-play
23. https://www.commonsensemedia.org/website-reviews/abcmouse
24. https://www.thehomeschoolmom.com/homeschool-curriculum-reviews/abcmouse/
25. https://www.educatorstechnology.com/2026/09/pbs-kids-games-review.html
26. https://pbswisconsin.org/?p=82366
27. https://www.bark.us/app-reviews/apps/pbs-kids-games/
28. https://current.org/?p=6865515
29. https://www.commonsensemedia.org/app-reviews/endless-alphabet
30. https://apple.co/2aISrtP
31. https://www.commonsensemedia.org/app-reviews/lego-duplo-world
32. https://www.educationalappstore.com/app/lego-duplo-world
33. https://apps.apple.com/in/app/lego-duplo-world-netflix/id6748836850
34. https://apps.apple.com/app/id1138436619
35. https://homeschool.com/?p=149374
36. https://splitmetrics.com/apps/montessori-preschool-kids-3-7/id1138436619
37. https://www.ilounge.com/index.php/reviews/entry/marbotic-smart-letters-for-ipad
38. https://www.macworld.com/article/229501/marbotic-smart-letters-and-smart-numbers-review-toys-tablets-educational-fun.html
39. https://apps.apple.com/us/app/kahoot-numbers-by-dragonbox/id1529174508
40. https://www.commonsensemedia.org/app-reviews/dragonbox-numbers
41. https://www.commonsensemedia.org/app-reviews/kahoot-geometry-by-dragonbox
42. https://apps.apple.com/us/app/-/id6444439181
43. https://outilstice.com/lalilo-enseignement-apprentissage-lecture/
44. https://ressources.lalilo.com/Lalilo_CP_PLG_Offre%20de%20lancement%20Avril%202025.pdf
45. https://www.pass-education.fr/impact/acteur/lalilo/
46. https://www.college-de-france.fr/en/news/excello-program-research-and-education
47. https://www.helloasso.com/associations/excello/boutiques/des-outils-pour-excellorer
48. https://e-fran.education.gouv.fr/wp-content/uploads/2023/03/POTIER_WATKINS_Cassandra_resume.pdf
49. https://www.clubic.com/telecharger-fiche442584-bayam.html
50. https://www.futura-sciences.com/tech/definitions/logiciels-bayam-26905/
51. https://iphonesoft.fr/2017/01/27/bayam-netflix-tricolore-divertir-eduquer-enfants
52. https://www.consobaby.com/avis-abonnement-ma-fabrique-a-histoires-en-location-lunii.html
53. https://www.marques-de-france.fr/listing/lunii/
54. https://apps.apple.com/eg/app/id578992727
55. https://www.fatherly.com/play/the-best-pbs-kids-online-games-and-apps/
56. https://apps.apple.com/in/app/id1079974015
57. https://learnopoly.com/abcya-review/
58. https://kids.nationalgeographic.com/games
59. https://www.thebluemountainslibrary.ca/games-for-kids
60. https://www.lhsdoi.com/29870/opinion/top-5-coolmath-games-series/
61. https://designbeep.com/?p=127189
62. https://www.commonsensemedia.org/website-reviews/starfall
63. https://www.educatorstechnology.com/?p=209064
64. https://apps.kde.org/gcompris/
65. https://lxr.kde.org/source/education/gcompris/publiccode.yml
66. https://brightchamps.com/blog/scratch-stats/
67. https://www.qustodio.com/en/gaming-qustodio-annual-data-report-2021/
68. https://en.wikipedia.org/wiki/Outfit7
69. https://www.pocketgamer.biz/my-talking-tom-friends-60-million-downloads
70. https://www.techlearning.com/news/learning-music-art-science-math-and-more-with-chrome-music-lab
71. https://www.education.sa.gov.au/our-learning-sa/learning-home-activities/arts/chrome-music-lab
72. https://en.wikipedia.org/wiki/Tux_Paint
73. https://quivervision.com/
74. https://apps.apple.com/us/app/-/id650645305
75. https://www.commonsense.org/education/reviews/quiver-3d-coloring-app
76. https://www.commonsensemedia.org/app-reviews/crayola-create-and-play
77. https://blog.momswithapps.com/2022/05/06/app-friday-may-6th-2022
78. https://apps.appfollow.io/ios/color-alive-2-0/1170317720?country=cy
79. https://toybook.com/crayola-introduces-color-alive-4-d-experience-with-augmented-reality-interactivity/
80. https://studios.disneyresearch.com/2015/07/23/live-texturing-of-augmented-reality-characters-from-colored-drawings/
81. https://la.disneyresearch.com/wp-content/uploads/Live-Texturing-of-Augmented-Reality-Characters-from-Colored-Drawings-Paper.pdf
82. https://about.fb.com/news/2021/12/using-ai-to-animate-childrens-drawings/
83. https://analyticsvidhya.com/blog/2023/04/bring-doodles-to-life-meta-open-sources-ai-model
84. https://apps.apple.com/app/1407852246
85. https://mixrank.com/playstore/apps/com.pixel.art.coloring.color.number

Licences (section E) : fichier `LICENSE` lu pour chaque dépôt à l'adresse `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/<LICENSE|LICENSE.md|LICENSE.txt|COPYING>` le 2026-10-26 (zdog : `README.md`).
