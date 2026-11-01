# Audit du site Ziggy — 26 octobre 2026

> Audit réalisé sur le build de production du commit `2388b05` (« Hero no longer reads audience figures from settings »), servi par `next start -p 3300`.
> Un premier passage a été fait sur un build plus ancien (19 h 48). Il a été refait entièrement après les trois commits de 20 h 02-20 h 04 (planète 3D, service worker, faits du hero). Les dossiers non suivis en cours d'écriture (`src/coloring/`, `src/games2d/sandbox/`, `src/games3d/nid/`, `src/components/sandbox/`) ne font **pas** partie du build audité.
> Aucun fichier source n'a été modifié.

## 1. Méthode

| Volet | Détail |
|---|---|
| Pages | Les 30 routes statiques de `src/app/[locale]/**/page.tsx`, dont `/creer` et `/monde/musique` ajoutées entre-temps, et les routes dynamiques : 8 jeux `/games/*`, 3 mondes (princess, space, flower_fairy), 5 jeux d'arcade (math_runner, alphabet_quest, memory_magic, color_lab, little_scientist), 3 histoires dodo (lili, d01, d02) et 5 agents. **53 pages × 2 viewports (390×844 tactile, 1366×900) = 106 vues en français.** |
| Échantillon i18n | 6 pages (`/`, `/monde`, `/dodo`, `/monde/arcade`, `/games`, `/login`) en `/en` et `/ar` (RTL), sur les 2 viewports : 24 vues. |
| Mode sombre | Les mêmes 6 pages avec `colorScheme: 'dark'`, sur les 2 viewports : 12 vues. |
| Mesures par page | Statut HTTP, erreurs et warnings console, erreurs JS, requêtes en échec, débordement horizontal, images sans `alt`, contrôles sans nom accessible, cibles tactiles < 44 px, contraste (calcul WCAG sur fond uni), temps de chargement, liens internes. |
| Liens | 285 liens internes collectés puis vérifiés par `fetch` : statut HTTP et détection des « soft 404 ». |
| Lighthouse | `lighthouse@12.8.2` mobile (profil par défaut : CPU ×4, réseau 4G lent), Chromium headless **sans GPU (SwiftShader)**, sur 4 pages. |
| Parcours | Écran d'intro, thème, son, langue (desktop, mobile, RTL), menu mobile, quête Ziggy World, arcade (course des calculs, mémoire magique), dodo (couverture puis écoute), intros 3D (Noël, Luge), OS sombre + thème clair forcé. |
| Captures | `/tmp/claude-0/-home-user-Ziggy/1dfba0fd-d72f-59bf-8aec-fced0bce0035/scratchpad/audit/` (`fr-m-*.png`, `fr-d-*.png`, `en-*`, `ar-*`, `dark-*`, parcours dans `flows/`, planches de lecture dans `sheets/` et `combo/`). |

Limites :
- La synthèse vocale serveur (`/api/tts`, 503 sans clé) et Supabase ne sont pas disponibles dans le bac à sable.
- Le WebGL tourne en logiciel (SwiftShader), ce qui gonfle fortement le TBT de Lighthouse sur les pages 3D et animées.
- Les captures pleine page sont plafonnées à 6 000 px (mobile) et 5 000 px (desktop). La page d'accueil mobile mesure 19 757 px.

## 2. Synthèse des scores

### Lighthouse mobile

| Page | Perf. | Accessibilité | Bonnes pratiques | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| `/` | **42** | **81** | 100 | 100* | 1,4 s | 6,0 s | 3,3 s | 0 |
| `/monde` | **38** | 95 | 100 | 100* | 1,6 s | 5,9 s | 12,3 s | 0,09 |
| `/dodo` | **35** | 100 | 100 | 100* | 1,4 s | 9,7 s | 15,7 s | 0 |
| `/monde/arcade` | **54** | 96 | 100 | 100* | 1,2 s | 5,2 s | 1,1 s | 0 |

\* Le score SEO de 100 est trompeur : Lighthouse ne voit pas que **toutes les pages déclarent la page d'accueil comme canonique** (voir P0-1).

Le TBT est surestimé par l'absence de GPU, mais la tendance est réelle. Sur `/dodo`, le chunk `1275` (framer-motion) cumule 19,7 s de « bootup » à cause des animations infinies. Sur `/monde`, l'élément LCP est le visage du splash d'intro (`.ziggy-intro__face`).

### Crawl (142 vues)

| Indicateur | Résultat |
|---|---|
| Statut HTTP des pages | 142/142 en 200 ✅ |
| Erreurs JS (`pageerror`) | 0 ✅ (une erreur d'hydratation React #418 vue sur `/dodo` avec l'ancien build ne se reproduit plus) |
| Débordement horizontal | 0 page ✅ |
| Images sans `alt` | 0 ✅ |
| Contrôles sans nom accessible | 1 composant (bascule mensuel/annuel des tarifs), présent sur 8 vues |
| Liens internes | 282/285 OK. `/coloriage` en **404** (×3 langues). `/monde/bac-a-sable` et `/monde/nid` en **soft 404** (non collectés par le crawl, vérifiés à la main) |
| Contraste < seuil WCAG AA | **293 occurrences sur 98 des 106 vues FR** |
| Cibles tactiles < 44 px (mobile) | 0, grâce à la règle globale `@media (pointer: coarse)`. En desktop, 19 en moyenne (liens de nav de 36 px, acceptable à la souris) |
| Chargement local (`loadEventEnd`) | ~0,5 s en moyenne, 1 s au maximum (`/`, `/account`) |
| Poids transféré | 852 Ko au maximum (`/` desktop), 617 Ko (`/` mobile) |
| Console | `THREE.Clock deprecated` sur `/` ; 404 sur le préchargement de `/coloriage` (`/`, `/creer`, `/ar`) ; warnings de préchargement de polices sur `/monde/jouer` |

## 3. Problèmes classés par priorité

Légende : **P0** = bug bloquant ou à fort impact, **P1** = problème visible, **P2** = finition.

### P0 — bugs

| # | Page(s) | Viewport | Description | Cause probable | Correctif suggéré |
|---|---|---|---|---|---|
| P0-1 | **Toutes** | — | Toutes les pages ont `<link rel="canonical" href="/">` et des `hreflang` qui pointent vers les **accueils** de chaque langue. Exemple : `/monde/arcade` déclare la home comme canonique. Le `hreflang="fr"` vise `/fr`, qui répond en 307 vers `/`. Pas de `x-default`. Google risque de désindexer toutes les pages intérieures comme doublons de la home. | `src/app/[locale]/layout.tsx` L65-80 : `alternates` est défini une seule fois dans le layout et hérité par toutes les pages. | Supprimer `alternates` du layout. Dans chaque `generateMetadata`, calculer `canonical` et `languages` pour le chemin courant (`getPathname` de next-intl, FR sans préfixe) et ajouter `x-default`. |
| P0-2 | `/creer` (lien « Créer · NOUVEAU » du menu), section planète de `/` | tous | **3 des 6 cartes de l'Atelier mènent à une impasse.** « Colorie avec Ziggy » → `/coloriage` en **404**. « Le Bac à sable magique » → `/monde/bac-a-sable` et « Le Nid de mon compagnon » → `/monde/nid` affichent « page introuvable » avec un statut 200 (attrapés par `/monde/[world]`). Le bouton « Coloriage » de la planète 3D est aussi en 404, et la home précharge `/coloriage` (404 en console). | `src/components/create/CreateHub.tsx` L13, L31, L40 ; `src/components/sections/Planet3DSection.tsx` L14. Les routes sont dans des dossiers non commités (`src/coloring`, `src/games2d/sandbox`, `src/games3d/nid`). | Commiter les routes avec les liens, ou masquer les cartes derrière un flag « bientôt » tant que la route n'existe pas. Ajouter un test qui vérifie que chaque `href` du hub correspond à une `page.tsx`. |
| P0-3 | Toutes | **mobile** | **Changer de langue est impossible sur mobile.** Dans le menu burger, le bouton « FR » ouvre une liste positionnée en `absolute` (y = 525, hauteur 320) à l'intérieur d'un panneau en `overflow-hidden` qui se termine vers y ≈ 480. La liste est entièrement rognée et invisible (capture `flows/mob-menu-lang.png`, idem en RTL). | `src/components/layout/Navbar.tsx` L106 (`overflow-hidden` du panneau) + `src/components/layout/LanguageSwitcher.tsx` L43 (`absolute right-0 top-full`). | Dans le menu mobile, afficher les langues dans une grille en ligne plutôt qu'en dropdown, ou rendre la liste via un portail. Ou passer `overflow-visible` une fois l'animation de hauteur terminée. |
| P0-4 | `/ar/*` (et `es`, `de`, `ja`… pour les contenus) | tous | Ziggy World, l'Arcade, le Dodo et l'âge sont **en anglais** dans les 10 langues autres que FR/EN. En **arabe (RTL)**, les titres découpés en mots s'affichent **dans l'ordre inverse** : « that games 20 you with grow » au lieu de « 20 games that grow with you », « ?Who is playing », « .sounds to drift off… » (capture `combo/ar-m.png`). « Powered by Hyper™ » est inversé dans le footer. | `src/lib/i18n-text.ts` : `tr()` ne connaît que `fr` et `en`. Les titres animés mot à mot (`inline-block`) suivent `dir="rtl"`. | À court terme : envelopper tout texte de repli dans `lang="en" dir="ltr"` (ou `<bdi>`/`dir="auto"`). Ensuite, traduire au moins les titres et l'interface, ou ne proposer Ziggy World/Dodo qu'en FR/EN avec un message clair. |
| P0-5 | `/dodo/[story]` | tous | **La narration se fige ou s'emballe.** (a) Si le son est coupé avec le bouton du site, `speakSequence` renvoie `false` sans rien dire, donc `finished()` n'est jamais appelé et l'histoire reste bloquée sur la scène 1 sans indication. (b) Sans clé TTS et sans voix système (`onerror` immédiat), chaque scène se « termine » tout de suite : **6 scènes défilent en 12 s** (mesuré, `flows/dodo-5-after12s.png`). Les fichiers audio pré-générés ne sont pas servis dans ce bac à sable (Supabase indisponible) ; en production, ce repli concerne surtout les histoires sans audio dans le manifeste. | `src/components/dodo/useNarrator.ts` L79-85 (`.then((ok) => ok && finished())`) ; `src/lib/voice.ts` L147-171 (sortie anticipée si `isMuted()`) et `browserVoice` (`onerror` → résout tout de suite). | Si aucune voix n'est réellement jouée, avancer au rythme de lecture (~14 caractères/s + pause) avec sous-titres forcés. Si le son est coupé, proposer « Activer le son pour écouter » ou passer en mode lecture. |

### P1 — problèmes visibles

| # | Page(s) | Viewport | Description | Cause probable | Correctif suggéré |
|---|---|---|---|---|---|
| P1-1 | `/`, `/games`, `/account` (« Mission du jour ») | mobile | La carte est **écrasée** : « Gagne / 3 / étoiles / à / Calcul / éclair », un mot par ligne, dans une colonne d'environ 60 px. C'est le premier bloc de contenu sous le hero. | `src/components/rewards/MissionCard.tsx` L65 et L79 : `flex flex-wrap` + `min-w-0 flex-1` (base 0), le texte ne passe jamais à la ligne entière. | Mettre `basis-[12rem] grow` sur la colonne texte, ou une grille `grid-cols-[auto_1fr]` avec les actions sur une ligne dédiée en mobile. |
| P1-2 | Toutes | mobile | **Menu burger** : (a) le panneau « verre » laisse voir le texte de la page **sous** les liens (le H1 de `/games` traverse le menu, `flows/s-menu.png`) ; (b) pas de fermeture par Échap ; (c) pas d'`aria-expanded` ni d'`aria-controls` ; (d) la page défile derrière le menu ouvert (scrollY = 600) ; (e) libellé « Toggle menu » en anglais. | `src/components/layout/Navbar.tsx` L90-134 ; `glass-strong` (85 % d'opacité + flou, `globals.css` L179). Le flou n'a pas été appliqué dans Chromium headless, à vérifier sur appareil. | Fond opaque `bg-bg-card` pour le panneau mobile. Écouter Échap, ajouter `aria-expanded`, bloquer le scroll (`overflow:hidden` sur `html`), traduire le libellé. |
| P1-3 | `/dodo` (carte vedette Lili) et grille | mobile et desktop | Le texte posé sur l'image **déborde en haut** : le titre « Princesse Lili et le… » est coupé. Il se superpose au titre déjà peint dans l'illustration, et l'image contient un **faux bouton « JOUER »** à côté du vrai bouton « Écouter ». Un enfant appuie sur le mauvais. | `src/components/dodo/DodoHome.tsx` L126-150 (`aspect-[16/10]` + overlay absolu) ; visuel `public/dodo/lili/*` avec titre et bouton incrustés. | Utiliser un visuel sans texte ni bouton. En mobile, placer le texte sous l'image (bloc statique) ou passer l'image en `aspect-[4/5]`. |
| P1-4 | `/dodo/[story]` (couverture) | mobile | Le contenu est aligné en bas (`justify-end`) sans défilement possible : la pastille « Gentillesse · 4 min » est coupée en haut à 844 px, et sur un écran de 667 px le titre devient inaccessible. Les accessoires décoratifs (oiseau 🐦, vignette paysage) **chevauchent** le titre et les puces de sons (`combo/m13.png`). | `src/components/dodo/DodoPlayer.tsx` L133 (`absolute inset-0 flex flex-col justify-end`) ; `NightScene.tsx` (placement des accessoires). | `overflow-y-auto` + `min-h-full` + `my-auto`. Replier « Sons du sommeil » et « Après l'histoire » dans un tiroir « Réglages ». Réserver une zone sans accessoires derrière le texte. |
| P1-5 | `/cookies`, `/terms` (+ footer) | tous | Politique cookies et CGU **entièrement en anglais** dans toutes les langues (titre « Cookie Policy — Ziggy »). Le footer FR affiche « GDPR » au lieu de « RGPD ». C'est un problème de conformité pour un public français. | `src/app/[locale]/cookies/page.tsx` L9 et L22, `src/app/[locale]/terms/page.tsx` L9 et L22 : texte écrit en dur. | Passer ces pages dans `messages/*.json` (ou des fichiers MDX par langue) et traduire. |
| P1-6 | Plusieurs | tous | Libellés **en anglais codés en dur** : « Try now » sur les cartes agents (`src/components/agents/AgentCard.tsx` L68) ; aria-labels « Toggle menu », « Switch language », « Turn sound on/off » (`SoundToggle.tsx`), « Skip to content » (`layout.tsx` L152), « Ziggy — home » ; titre « Quest — Ziggy World » ; 29 ternaires `locale === 'fr' ? … : …` (par ex. `WorldMapHome.tsx` L80 « changer/change »). | Textes hors du catalogue de messages. | Les déplacer dans `messages/*.json`, puis ajouter un test lint (regex `locale === 'fr' ?`). |
| P1-7 | Tout le site | tous | **Contraste insuffisant, de façon systémique** : les couleurs de marque servent de couleur de texte sur fond clair. Vert `#22C55E` (2,2:1, eyebrows, « Créer mon profil »), ciel `#5FB6EA` (2,2:1, « NOUVEAU » 10 px), `text-dim #9CA3AF` (2,5:1, légendes des chiffres, « vs », dates), blanc sur bouton vert (2,3:1), blanc sur les cartes pastel de `/creer` (abricot, jaune, vert clair), étiquettes pastel de l'arcade (« Animaux » jaune). Lighthouse : accessibilité 81 sur `/`. | Jetons `src/app/globals.css` L14-32 utilisés tels quels pour le texte. | Créer des variantes « encre » (vert `#15803D`, ciel `#0369A1`, abricot `#B45309`). Passer `text-dim` à `#6B7280` en clair. Boutons verts : `bg-green-600/700` ou texte foncé. Assombrir les dégradés de `/creer` ou y mettre du texte foncé. |
| P1-8 | `/`, `/monde`, `/dodo` | mobile | **Performance** Lighthouse de 35 à 42, LCP de 6 à 9,7 s, TBT élevé. Causes repérées : 70 étoiles animées en framer-motion en boucle infinie (`DodoHome.tsx` L320-345), une quarantaine d’animations `repeat: Infinity` sur le site, planète et plateau WebGL chargés tôt, splash d'intro comptabilisé comme LCP, catalogue complet de messages (766 clés) sérialisé dans chaque page. | Voir la description. | Remplacer les champs d'étoiles et les flottements par des `@keyframes` CSS (compositor) et les mettre en pause hors écran. Charger les sections WebGL avec `dynamic(…, { ssr:false })` déclenché par un IntersectionObserver. Ne passer au client que les namespaces utiles (`pick(messages, …)`). Garder le splash très court ou non bloquant. |
| P1-9 | `/monde/arcade/math_runner` (en jeu) | mobile | La pile d'emojis 🍎🍎🍎 + 🍎 **chevauche** l'en-tête « MANCHE 1/6 » et ses points de progression. L'opération « 3 + 1 = ? » est collée au bouton haut-parleur, et la piste est en grande partie sous la ligne de flottaison (`flows/s-arcade.png`). | `src/components/arcade/mechanics/RunnerMechanic.tsx` / `runner/` : zone visuelle sans hauteur réservée. | Réserver une hauteur fixe pour la représentation visuelle, réduire les emojis quand il y en a plus de 3 (ex. « 3 × 🍎 »), et caler la piste dans `100dvh`. |
| P1-10 | `/games` vs `/monde/arcade` vs `/` | tous | **Deux « arcades » concurrentes** : `/games` s'appelle « L'arcade de Ziggy — Huit mini-jeux » (icônes Lucide), `/monde/arcade` « Ziggy Arcade — 20 jeux » (emojis), et la home annonce « 22 jeux qui s'adaptent ». Noms, chiffres et styles visuels différents : le parent ne sait pas où est « le » jeu. | Deux systèmes de jeux historiques. | Fusionner, ou renommer `/games` en « Mini-jeux classiques » et l'intégrer à l'arcade. Utiliser un seul compteur et un seul style de carte. |
| P1-11 | `/` (section Tarifs) | tous | La bascule mensuel/annuel est un `<button>` **sans nom accessible**, sans `role="switch"` ni `aria-checked` (échec Lighthouse « button-name »). | `src/components/sections/PricingSection.tsx` L64-70. | `role="switch" aria-checked={yearly} aria-label={t('yearly')}`. |
| P1-12 | `/monde/xxx`, `/dodo/xxx`, `/monde/nid`… | — | **Soft 404** : une URL inconnue sous un segment dynamique répond **200** (97 Ko) avec deux balises robots contradictoires (`noindex` et `index, follow`). | `src/app/[locale]/loading.tsx` déclenche le streaming : le statut est figé à 200 avant `notFound()`. Pas de `dynamicParams = false`. | Ajouter `export const dynamicParams = false` aux routes `[world]`, `[story]`, `[game]`, `[agent]` (toutes ont `generateStaticParams`). |

### P2 — finitions

| # | Page(s) | Viewport | Description | Cause / fichier | Correctif suggéré |
|---|---|---|---|---|---|
| P2-1 | `/monde/jouer` sans paramètres | — | La redirection passe par `/fr/monde` puis un 307 vers `/monde`. Elle est faite côté client après un 200, avec warnings de préchargement de polices. | `src/app/[locale]/monde/jouer/page.tsx` : `redirect(`/${locale}/monde`)`. | Utiliser `redirect({ href: '/monde', locale })` de `@/i18n/navigation`. |
| P2-2 | Config | — | Sitemap, robots, canonical et Open Graph utilisent `http://localhost:3000` si aucune variable d'hôte n'est définie. | `src/lib/site-url.ts`. | Vérifier que `NEXT_PUBLIC_SITE_URL` est défini en production et faire échouer le build si ce n'est pas le cas. |
| P2-3 | Global | — | `/favicon.ico` répond 404 (seul `favicon.svg` existe). Certains navigateurs et robots le demandent. | `public/`. | Ajouter `app/favicon.ico` ou `public/favicon.ico`. |
| P2-4 | `/` (chiffres du hero) | tous | Les compteurs affichent **« 0 »** au rendu serveur et jusqu'à leur apparition à l'écran : sans JS ou pour un robot, on lit « 0 monde, 0 histoire ». L'animation affiche des décimales (« 14,7 ») pour les nombres entiers. | `src/components/ui/AnimatedCounter.tsx` (`useState('0')`, `toFixed(1)` pour 1-99). | Rendre la valeur finale côté serveur et animer depuis 0 seulement côté client. Arrondir les entiers. |
| P2-5 | Footer (toutes) | tous | « Powered by » affiche deux icônes : le logo `hyper-mark.webp` réduit à 28 px (bruit bleu illisible) et une icône puce. Le footer adulte complet (mentions légales) apparaît aussi sous les écrans de jeu et de quête. | `src/components/layout/Footer.tsx` L40. | Garder une seule icône simplifiée. Masquer ou réduire le footer en « mode enfant » (jeux, quêtes, dodo). |
| P2-6 | Contenu | — | Le site mélange tutoiement et vouvoiement : « L'aventure IA **de votre** enfant », « **Essayez** Ziggy maintenant », « **Connectez-vous** » à côté de « **Essaie** Ziggy », « **Ton** prénom ». | Messages. | Règle éditoriale : *vous* pour les blocs parents, *tu* pour l'enfant, et l'appliquer partout. |
| P2-7 | `/signup`, `/monde` | — | Tranches d'âge incohérentes : inscription 5-7 / 8-10 / 11-12, Ziggy World 4-6 / 6-8 / 8-12, accroche « 5-12 ans ». | Messages et `AgePicker.tsx`. | Un seul référentiel d'âges partagé. |
| P2-8 | `/games/*` | tous | Le titre et la description du jeu sont répétés **trois fois** (en-tête de page, en-tête de carte, corps de carte). | `GameShell.tsx`. | Garder l'en-tête de page et ne mettre que les consignes et le bouton dans la carte. |
| P2-9 | `/dodo` | mobile | Mur de 27 puces de valeurs (environ 330 px de haut) avant les histoires. | `DodoHome.tsx`. | Rangée horizontale défilante, ou « Toutes / Préférées / + filtres ». |
| P2-10 | `/monde` (« Qui va jouer ? ») | tous | Modale sans focus initial ni piège de focus, impossible à fermer. Elle bloque la navigation (langue, menu) au premier passage. | `src/components/world/AgePicker.tsx` L45. | Focus sur la première option, piège de focus, bouton « Plus tard » qui choisit un âge par défaut. |
| P2-11 | `/monde` desktop (carte 3D) | desktop | Plateau olive et kaki terne, noms de mondes en gris foncé d'environ 11 px peu lisibles, 16 cadenas gris qui dominent. | Section plateau 3D (commit d2dc4fb). | Fond plus lumineux, étiquettes en pastille blanche ≥ 14 px, et ne montrer que les 2 ou 3 prochains mondes verrouillés, en teaser. |
| P2-12 | `/monde/musique` | mobile | La rangée d'animaux est coupée des deux côtés et la grille de notes est rognée à droite (défilement horizontal non signalé). | Composant de la Fabrique à chansons. | Réduire les colonnes en mobile ou ajouter un dégradé et une flèche « glisse ». |
| P2-13 | `/memo` | mobile | Emoji ✖️ pour « Tables de multiplication » (ressemble à « fermer » ou « erreur »). Les axes de « La courbe de l'oubli » sont en ~6 px. | `src/components/memo/MemoApp.tsx`, `src/components/learn/ForgettingCurve.tsx`. | Emoji 🔢 ou « 2×3 », libellés d'axes ≥ 11 px. |
| P2-14 | `/monde/3d/*` | desktop | Consigne « **Touche** le sol… » affichée sur desktop. « sapin **!** » orphelin (pas d'espace insécable). | `NoelPlayer.tsx`, `LugePlayer.tsx`. | Texte selon `pointer: coarse`. Utiliser ` ` avant ! ? : ; en français. |
| P2-15 | `/dodo/*` | — | Libellés « Endormissement (Hyper Fréquences) » et « Berceuse 432 Hz » : vocabulaire pseudo-scientifique qui peut entamer la confiance des parents. | `DodoPlayer.tsx` (SoundPicker). | « Musique douce pour s'endormir », sans allégation. |
| P2-16 | Service worker | — | Le cache-first sur `/media` (vidéos servies en 206 partiels) fait échouer `cache.put` (« partial response »). Caches sans limite. Les assets non versionnés (`/mascot`) ne se rafraîchissent qu'au changement de `VERSION`. | `public/sw.js`. | Exclure `/media` (ou ne mettre en cache que les réponses 200 complètes), plafonner le nombre d'entrées, dériver `VERSION` du `BUILD_ID`. |
| P2-17 | `/` | — | Ordre des titres : `h4` du footer sans `h3`. `<ol>` de « Comment ça marche » contenant des enfants non-`li` (Lighthouse « list »). Warning console `THREE.Clock` déprécié. | `Footer.tsx` L52 et L71 ; `HowItWorksSection.tsx` L28 ; planète 3D. | `h2`/`p` stylés, vérifier les enfants `li`, `THREE.Timer`. |
| P2-18 | Toutes | — | La balise `theme-color` suit le thème de l'OS, pas le bouton de thème du site. Le sélecteur de langue utilise `right-0` et `text-left` (non logiques). Les noms de langue n'ont pas d'attribut `lang`. | `layout.tsx`, `LanguageSwitcher.tsx`. | Mettre à jour la meta au changement de thème. Utiliser `end-0`/`text-start`. `<span lang="ja">日本語</span>`. |
| P2-19 | `/` | mobile | La page d'accueil mesure **19 757 px** sur mobile (environ 23 écrans). Le premier écran ne montre que la mascotte : le H1 et les CTA sont sous la ligne de flottaison. | Empilement des sections. | Réduire la carte mascotte en mobile, faire remonter H1 et CTA, regrouper ou supprimer des sections (FAQ, avis, modules). |

### Ce qui fonctionne bien ✅

- **Intro** : le splash s'affiche une fois par session, se passe au toucher et disparaît avant 3,2 s.
- **Thème** : sombre/clair avec transition circulaire, persistant après rechargement. OS sombre + thème clair forcé : correct.
- **Son** : `aria-pressed` correct, persisté dans `ziggy:muted`.
- **Langue** sur desktop : FR → EN (`/en`, `lang=en`), EN → AR (`dir=rtl`), AR → FR (`/games`, sans préfixe).
- **Quête Ziggy World** : âge → « Commencer l'aventure » → intro → « C'est parti ! » → manche 1 jouable.
- **Arcade** : « C'est parti ! » lance la course des calculs et la mémoire magique.
- **Dodo** : couverture → « Écouter l'histoire » → scènes + contrôles (Retour, Précédent, Pause, Suivant, Texte).
- **Intros 3D** : Noël et Luge, canvas présent et bouton « Jouer » visible, sur mobile et desktop.
- **Mise en page** : aucun débordement horizontal, toutes les images ont un `alt`, cibles tactiles ≥ 44 px sur mobile.
- **Mode sombre** : globalement soigné (seule la carte mascotte reste claire).

## 4. Critique design et motion

### Avec les yeux d'un enfant (5-8 ans)
- **Ce qui plaît** : Ziggy, peluche 3D très expressive, est un vrai personnage. Il y a des humeurs, un cœur lumineux, le compagnon dragon qui commente, des boutons ronds et colorés, des sons. Le Dodo, ciel étoilé et histoire lue, est l'écran le plus magique. Les intros 3D (Noël, Luge) donnent envie de cliquer.
- **Ce qui gêne** :
  - Beaucoup de **texte à lire** avant de jouer : l'arcade mobile est une liste de 20 cartes de texte sur 7 000 px.
  - Les pastilles pastel sont pâles.
  - Les images contiennent de **faux boutons** (« JOUER » sur Lili).
  - Les emojis 🍎 recouvrent le jeu.
  - Un enfant qui ne lit pas encore n'a pas de repère visuel fort : il faudrait de grosses tuiles-icônes en grille 2×N, le son lancé au toucher et moins de mots.
  - La page de jeu se termine par un long footer « Mentions légales / GDPR » qui ne lui parle pas.
  - En arabe ou en espagnol, Ziggy World « parle anglais ».

### Avec les yeux d'un parent
- **Rassurant** : « Sans publicité », « Données en Europe », « Compte géré par le parent », Espace parents, rappels de pause, pas de faux chiffres d'audience (le hero affiche désormais des faits produits).
- **Ce qui inquiète ou agace** :
  - L'offre est confuse : 2 arcades, 8, 20 ou 22 jeux selon l'écran, Labo IA, Agents « métiers » (vente, marketing, publicité ?! pour 5-12 ans), Mémo, Palais, Créer…
  - Les **CGU et la politique cookies en anglais**.
  - Tutoiement et vouvoiement mélangés.
  - Des promesses « Hyper™ AI Engine » et « Hyper Fréquences 432 Hz » au ton marketing un peu trop appuyé.
  - Des liens « Nouveau » qui mènent à des 404.
  - Une home de 23 écrans sur mobile.
  - Le sélecteur de langue inaccessible sur téléphone.

### Motion
- **Bien** : `MotionConfig reducedMotion="user"`, `prefers-reduced-motion` respecté par le splash et la transition de thème. Les entrées sont courtes (≤ 0,5 s) avec un *ease-out* cohérent, et les révélations au scroll utilisent un seul IntersectionObserver.
- **À revoir** :
  - **Trop d'animations infinies simultanées** : étoiles, flottements, halos pulsés en `boxShadow`, sheen sur les cartes. Le coût CPU se voit dans le TBT de `/dodo` et `/monde`, et le mouvement permanent fatigue au coucher alors que le Dodo vise l'apaisement.
  - Le « sheen » qui balaye la carte Mission du jour, en sombre, donne un effet de rayure.
  - La marquee « APPRENDRE · COMPRENDRE · CRÉER » est décorative mais coupe les mots.
  - Recommandation : animations décoratives en CSS, pause hors écran, **mode Dodo quasi statique** (étoiles fixes, lent fondu au noir) et un « budget motion » d'une animation en boucle par écran.

### Cohérence visuelle
Deux langages cohabitent :
1. « SaaS pastel » : Lucide, cartes blanches, eyebrows verts (home, `/games`, `/apprendre`, `/memo`, `/lab`).
2. « Jeu enfant » : emojis, dégradés saturés, Fredoka (`/monde`, `/creer`, `/dodo`).

Les espaces enfants sont les plus réussis. Il faudrait **unifier** autour du second pour tout ce que touche l'enfant, garder le premier pour l'espace parents et le marketing, et harmoniser la palette pour que les couleurs de texte passent AA.

## 5. Les 15 problèmes à traiter en premier

1. **P0-1** Canonical et hreflang globaux qui pointent vers la home (SEO de tout le site).
2. **P0-2** Hub « Créer · NOUVEAU » : 3 liens morts (`/coloriage` 404, `/monde/bac-a-sable` et `/monde/nid` en soft 404).
3. **P0-3** Sélecteur de langue rogné, donc inutilisable, dans le menu mobile.
4. **P0-4** Contenus World, Arcade et Dodo en anglais hors FR/EN, mots inversés en arabe.
5. **P0-5** Dodo : histoire figée si le son est coupé, défilement accéléré sans voix.
6. **P1-1** Carte « Mission du jour » écrasée (un mot par ligne) sur mobile.
7. **P1-2** Menu mobile translucide, sans Échap, sans `aria-expanded`, sans blocage du scroll.
8. **P1-3** Carte vedette Lili : titre coupé et faux bouton « JOUER » dans l'image.
9. **P1-4** Couverture Dodo : contenu coupé en haut et accessoires qui chevauchent l'interface.
10. **P1-5** CGU et politique cookies en anglais, « GDPR » dans le footer FR.
11. **P1-6** Libellés et aria-labels anglais codés en dur (« Try now », « Toggle menu »…).
12. **P1-7** Contraste systémique des couleurs de marque utilisées comme texte (293 cas).
13. **P1-8** Performance mobile 35-54 (animations infinies, WebGL chargé tôt, catalogue de messages complet).
14. **P1-10** Deux arcades aux noms et compteurs incohérents (8, 20, 22 jeux).
15. **P1-12** Soft 404 sur les segments dynamiques (`dynamicParams` absent + `loading.tsx`).
