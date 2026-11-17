# L’Usine à Créatures (`/creer/creatures`)

Jeu de création 3D pour les 4–12 ans : on assemble une créature à partir de pièces, on tire le levier
Surprise, on lui donne vie, on la photographie, on la range dans « La Parade » (album local).
Zéro échec, zéro minuteur, aucun compte, rien ne quitte l’appareil.

## Une créature = une recette de pièces
`src/games3d/creatures/logic.ts` (type `Creature`, 20 champs) : corps (11), tête (8), pattes (6 styles, 0–8),
bras (6 styles, 0/2/4), ailes (9), queues (9), yeux (1–5, 2 tailles), bouche (10), oreilles/cornes (12),
chapeaux (12), motifs (8), 10 couleurs ×2, taille (3), **nez (6), magie/aura (6), copain (6)**.
Plus d’un milliard de créatures possibles (`combo_count`). Toutes les pièces se combinent.

## Où est quoi
| | |
|---|---|
| Vocabulaire partagé TS/Rust | `src/data/creatures/parts.json` (pièces, pouvoirs, noms, évènements, tirages, phrases) |
| Cœur Rust (MIT) | `rust/creatures-core` → wasm dans `src/lib/creatures/wasm/` (`npm run creatures:wasm`) |
| Jumeau TypeScript (repli) | `src/lib/creatures/core.ts`, chargeur `src/lib/creatures/index.ts` (`getCore()` / `loadCore()`) |
| Tests de parité wasm = TS | `src/lib/creatures/core.test.ts` |
| Rendu 3D | `creature3d.ts` (1re vague) + `parts2.ts` (2e vague : pièces nouvelles, aura, copain) |
| Jeu, sons, particules | `CreaturesGame.ts`, `audio.ts`, `fx.ts` |
| Interface | `src/components/games3d/CreaturesPlayer.tsx` |

## Ce que fait le cœur Rust
Surprise (tirage pondéré), croisement de deux parents (avec 7 % de mutation), noms rigolos (liste bloquée
testée), pouvoirs d’une créature (13 : rebond, vol, nage, étincelles, danse, camouflage, fou rire,
arc-en-ciel, roulade, flottement, zip-zap, câlins, musique), évènements rigolos tirés au sort,
**défis générés à l’infini** (toujours constructibles : le solveur le vérifie sur des milliers de graines),
vérification des exigences d’un défi, album (lecture sûre, 60 max), **code de partage** `ZC2-XXXXX-…`
(base32 avec somme de contrôle, tolère majuscules/minuscules et caractères qui se ressemblent), et les
courbes de pose (rebond, flotte, roulade, danse, surprise, applaudissements…) ajoutées au mouvement 3D.

## Pouvoirs et surprises
Chaque créature a des pouvoirs visibles (puces dans la barre du haut) : une animation (courbe Rust),
un son propre (`audio.power`) et des particules propres. Les petites surprises (confettis, éclair de
transformation, œil qui cligne de travers, atchoum, hoquet, applaudissements, bulles) arrivent parfois
après un levier Surprise ou quand la créature s’ennuie. Rien de cruel, rien de flippant.

## Mouvement réduit
`useReducedMotion` partout : poses à 35 %, plus de pop-in, aura et copain très calmes, pas de saut.

## Rebuild
```
npm run creatures:wasm          # test + build + écrit src/lib/creatures/wasm/
cd rust/creatures-core && cargo test --release
npx vitest run src/lib/creatures src/games3d/creatures
```
