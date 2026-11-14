# Rapport — Ziggy v1 : Usine à Créatures + Lutins Farceurs

Branche `claude/ziggy-creatures-lutins-20261112` (partie de `main` @ `58c56154`). Rien n'est fusionné ni déployé,
aucun réglage GitHub / Vercel / Supabase touché, aucune nouvelle variable d'environnement, aucun service payant.

## 1. L'Usine à Créatures (`/creer/creatures`)

### Ce qui a changé
- **Pièces : ×2 à ×3.** Corps 5→11, têtes 4→8, styles de pattes 3→6, styles de bras 3→6, ailes 5→9, queues 5→9,
  bouches 6→10, oreilles/cornes 6→12, chapeaux 6→12, motifs 4→8. **Nouveaux champs : nez (6), magie/aura (6), copain (6).**
  Plus d'un milliard de créatures. Toutes les pièces se combinent (même recette de 20 champs, étendue).
- **Rendu 3D** de toutes les pièces : `src/games3d/creatures/parts2.ts` (nouveau) branché dans `creature3d.ts`.
  Magie = petites choses qui flottent autour (étincelles, cœurs, bulles, étoiles, notes) ; copain = petite bête à côté
  (coccinelle, poussin, nuage, escargot, ballon) qui gigote.
- **Pouvoirs visibles** (13) : rebond, vol, nage, étincelles, danse, camouflage (le corps devient translucide), fou rire,
  arc-en-ciel, roulade, flottement, zip-zap, câlins, musique. Puces dans la barre du haut : chaque pouvoir a son animation
  (courbe calculée par le Rust), son **son** (`audio.power`) et ses **particules**.
- **Surprises rigolotes** : confettis, éclair de transformation, œil qui cligne de travers, atchoum, hoquet, applaudissements,
  « oh ! » surpris, bulles — tirées par le moteur (après un levier Surprise ~30 %, ou quand la créature s'ennuie).
- **Croiser** deux créatures (bouton 💞 : la créature sur scène × une de la Parade → un bébé avec des pièces des deux).
- **Code de partage** `ZC2-XXXXX-…` (🔑, dès 6 ans) : on le recopie ou le donne à un copain ; local, rien n'est envoyé.
- **Défis générés à l'infini** par le Rust (65 % des défis proposés ; la liste fixe reste en repli), toujours constructibles,
  toujours sans minuteur ni échec. Nouveaux types d'exigences : pouvoir, nez, magie, copain, corps.
- Sons des nouvelles familles de pièces (nez = « pouet », magie = carillon, copain = petit couinement).
- Mouvement réduit : poses à 35 %, pas de pop-in ni de sauts, aura et copain très calmes.

### Rust / WASM
- `rust/creatures-core` (MIT) : recettes, validation, Surprise, croisement, noms, pouvoirs, mouvements, voix, évènements,
  défis générés + solveur + vérificateur, album, code de partage, courbes de pose. `cargo test` : **17 tests verts**.
- Glue wasm commité dans `src/lib/creatures/wasm/` ; `src/lib/creatures/index.ts` (`getCore()` / `loadCore()`).
- **Repli TypeScript testé** : `src/lib/creatures/core.ts` (même algorithmes, même `parts.json`). Les tests de parité
  (`core.test.ts`, 12 tests) comparent wasm et TS sur 120 graines : Surprise, noms, croisement, pouvoirs, évènements,
  poses, codes, mouvements, voix, et vérification des défis générés. Seuls les défis générés n'ont pas de jumeau TS (repli : liste fixe).
- Build : `npm run creatures:wasm` (`-- --check` vérifie que les fichiers commités sont à jour : **OK**).

## 2. Les Lutins Farceurs (`/lutins`)

### Audit (constats)
| Constat | Suite |
|---|---|
| **L'exemple d'aide du studio proposait « du ski sur la rampe d'escalier »** : contraire à la règle d'en-tête de `pranks.ts` (rien qu'un enfant puisse imiter). | Remplacé par un exemple doux + rappel « pas de feu, de couteaux, d'escalade… ». |
| **Le texte libre du parent n'avait aucune porte « farce douce »** (seulement ChildShield, qui ne juge pas la dangerosité d'une imitation). | Porte `checkIdea` (Rust, liste `gentle.json` partagée Rust/TS) appliquée côté serveur : 422 `text` avant ChildShield. |
| Catalogue court (37 farces, 6 lieux). | 106 farces, 12 lieux, données dans `pranks.json` (source unique Rust/TS). |
| Pas de farce « du soir » : le parent choisit à chaque fois, on se répète. | `planPranks` (Rust + jumeau TS) : tirage déterministe, sans répétition sur 14 nuits ; bouton « Surprends-moi ». |
| Rig des elfes : peu d'expressions, aucune réaction au toucher, apparition sèche. | 6 poses (clin d'œil, fou rire, hourra, chatouilles, révérence, danse), saut, apparition élastique, confettis doux, réaction + rire au toucher. |
| Accueil 1280×800 : le bonnet de Pépin est coupé par l'en-tête (vu avec le GL logiciel du bac à sable). | **Non corrigé** (cadrage `hero.frame`) : à vérifier sur un vrai écran. |
| Perf : le simulateur plafonne `dt` à 50 ms ; avec un GL logiciel très lent les animations d'arrivée sont lentes à se jouer (sans conséquence sur de vrais appareils). | RAS |
| Accessibilité : scène décorative (`aria-hidden`), textes FR/EN, gros boutons : correct. Mouvement réduit respecté (scène calme, pas d'apparition animée). | Conservé. |

### Reprise du sous-agent coupé
Le sous-agent précédent avait laissé une branche (`worktree-agent-a8b303b3ca8f240a7`, 2 commits) et des modifications non
commitées dans un worktree : 106 farces/12 lieux, `pranks.rs`, `tonight.ts`, `checkIdea`, poses et types de réactions.
**Je les ai repris tels quels** (mon propre travail en double — 81 farces, vérification de mots — a été remplacé par le sien,
plus complet), puis j'ai fini ce qui manquait : implémentation des réactions/éclats/apparition dans `games3d/lutins/index.ts`,
clin d'œil / secousse / danse / chatouilles dans le rig (`elf.ts`), branchement du studio, et un bug de symétrie de la pose
« révérence ». Le worktree a été retiré (la branche reste dans le dépôt).

### Rust / WASM
`lutins-core` étendu (`pranks.rs`, `check_idea`, `plan_pranks`, `is_prank_id`, `pranks_hash`), wasm reconstruit et commité
(`npm run lutins:wasm`, `-- --check` OK). `cargo test` : 83 + 10 + 16 tests verts. Pipeline photo / prompts / journal / limites inchangés
(le prompt n'a changé que pour lire le catalogue partagé).

## 3. Captures (`docs/screenshots-v1/`)
- `creatures-all-new-parts.png` : les pièces nouvelles, une par case (corps, têtes, pattes, bras, ailes, queues, bouches, oreilles, chapeaux, motifs, nez, magie, copains).
- `creatures-new-faces.png` : gros plan des nouveaux nez et bouches.
- `creatures-mobile-powers.png` : mobile 390×844, créature Surprise (motif vagues, auréole, ailes d'ange, notes de musique) et puces de pouvoirs.
- `creatures-desktop.png` : bureau 1280×800, Ziggy tire le levier.
- `lutins-hero-desktop.png`, `lutins-hero-mobile-reduced-motion.png` : accueil des lutins.
Contrôle navigateur (build de production, Chrome + SwiftShader, 390×844 et 1280×800, FR/EN, mouvement réduit inclus) :
aucune erreur de page, aucun débordement horizontal, sur `/creer/creatures`, `/lutins`, `/lutins/atelier`, `/lutins/journal`.

## 4. Décisions pour Maxime
1. **Bonnet de Pépin coupé** sur l'accueil bureau (voir audit) : à regarder sur un vrai écran avant de toucher au cadrage.
2. **Porte « farce douce »** : liste de mots volontairement stricte (`gentle.json`, mots entiers, sans accents). Elle refuse
   p. ex. « bougie », « escalier » ; à ajuster si trop sévère. Elle ne remplace pas ChildShield.
3. **Code de partage** : local, sans réseau, sans parent gate. Il contient le nom de la créature (nettoyé). Dis-moi si tu veux le mettre derrière le parent gate.
4. **Défis générés** : 65 % des défis quand le wasm est chargé. Réglage dans `startChallenge` (`CreaturesPlayer.tsx`).
5. **Pièces avec peu de tests visuels sur appareil réel** : 3D vérifiée en GL logiciel uniquement (pas de passe `hardwareConcurrency = 8` : à faire sur un appareil capable, règle du CLAUDE.md).
6. `wasm-opt` n'est pas installé ici : les artefacts sont reproductibles avec la même chaîne, mais non optimisés par binaryen.
7. Pas de nouvelles covers dans le slider Atelier (le composant n'a pas été touché).
8. Non fait : sons/animations *par pièce* individuelle (seulement par famille de pièces et par pouvoir), mode « galerie » partageable
   avec les parents au-delà du code, rendu de la carte des lutins en Rust (déjà en Rust avant).

## 5. Tests lancés
- `npm run check` (tsc + eslint + vitest) : **vert**, 71 fichiers, 860 tests.
- `cargo test --release` : `creatures-core` 17/17, `lutins-core` 83 + 10 + 16.
- `npm run lutins:wasm -- --check` et `npm run creatures:wasm -- --check` : à jour.
- `next build` de production (`NEXT_DIST_DIR=.next-verify`) : OK ; pages parcourues dans Chrome headless (voir §3).

## 6. Licences ajoutées
Aucune famille nouvelle. `creatures-core` n'utilise que des crates déjà listées pour `lutins-core` (wasm-bindgen, serde, serde_json,
itoa, zmij, memchr, once_cell, cfg-if, unicode-ident : MIT/Apache-2.0, Unicode-3.0 déjà accepté). Section ajoutée à
`THIRD_PARTY_LICENSES.md`. Listes de mots et farces : texte original. Skills de jeu : déjà dans `THIRD_PARTY.md` (Apache-2.0).
