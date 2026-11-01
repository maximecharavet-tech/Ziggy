# Ziggy Voice Engine v3 (Rust)

Le narrateur hors-ligne des histoires du **mode dodo**. Il enregistre une fois pour toutes
chaque histoire avec la voix de Ziggy (un petit robot-peluche enfant : jeune, doux, gentil) et
écrit des fichiers statiques que le site sert tels quels — aucune IA, aucun appel d’API quand un
enfant écoute.

```
public/dodo/voice/{fr|en}/{storyId}/title.mp3, s1.mp3 … s6.mp3, outro.mp3
public/dodo/voice/{fr|en}/{storyId}/timing.json     (DodoVoiceTiming v2, voice "ziggy-v3", src/lib/dodo/voice.ts)
```

**v3 = la lecture d’un conteur.** Le timbre de v2 est gardé tel quel. Ce qui change, c’est la
façon de lire : la mélodie de chaque phrase (questions, listes, suspens, fins posées), les mots
mis en valeur, le rythme et les pauses. Ces éléments sont planifiés par des règles et imposés
**dans** Kokoro : durées de chaque phonème, courbe de hauteur et énergie (voir « La lecture »).

Tout le moteur est en Rust (`ziggy-voice/`) : préparation du modèle (npm/PyPI → jointure →
sha256 → patch du graphe ONNX), front-end texte (normalisation, nombres, phrases, dialogues,
G2P), plan de narration, **analyse et rendu de l’intonation**, synthèse Kokoro en deux passes
(ONNX Runtime via `ort`), voix d’enfant (WORLD + filtre STFT), mastering, minutage des mots,
visèmes. Seuls outils externes : `node` (lire les
histoires TypeScript), `ffmpeg` (encodage MP3), `npm`/`curl` (téléchargements de `prepare`).

## Installation (une fois)

Prérequis : Rust ≥ 1.92 (testé 1.97), Node 22 (les `node_modules` du dépôt, pour esbuild),
`ffmpeg` avec `libmp3lame`, accès réseau à registry.npmjs.org et pypi.org /
files.pythonhosted.org (Hugging Face et GitHub ne sont **pas** nécessaires).

```bash
cd voice-engine
cargo build --release
./target/release/ziggy-voice prepare        # ≈ 330 Mo depuis npm + 3 wheels PyPI → .cache/
```

`prepare` télécharge :

- **Kokoro-82M** depuis npm : `kokoro-js@1.2.1` (les 54 voix `.bin`, float32 [510, 1, 256]) et
  `kokoro-fp32{a,b,c}-shards@1.0.0` (le graphe fp32 de onnx-community/Kokoro-82M-v1.0-ONNX en
  19 morceaux), joints dans l’ordre puis vérifiés (325 532 232 octets, sha256
  `8fbea51e…a34cb`) ;
- trois wheels PyPI, utilisées comme simples archives (aucun Python ne tourne) :
  `onnxruntime 1.31.1` (son `libonnxruntime.so`, chargé par `ort`), `espeakng-loader 0.2.4`
  (`libespeak-ng.so` + `espeak-ng-data`) et `misaki 0.9.4` (les dictionnaires anglais
  `us_gold.json`/`us_silver.json` sur lesquels Kokoro a été entraîné) ;

puis **patche le graphe en Rust** (`onnx_patch.rs`, un mini-éditeur protobuf, pas de protoc) :
il expose les durées de phonèmes prédites (`/encoder/Gather_output_0` → `duration`) et insère,
entre le prédicteur et le décodeur, les contrôles de Ziggy. Aucun poids n’est modifié.

| Entrée ajoutée (v3) | Où | Effet |
|---|---|---|
| `dur_scale` [1, N] | sur les durées flottantes (`/encoder/Div_output_0`, avant `Round`) | multiplie la durée prédite de chaque phonème |
| `dur_frames` [1, N] + `dur_mix` | mélange `a·(1−mix) + b·mix`, même endroit | impose des durées exactes (en trames de 25 ms) |
| `f0_override` [1, T] + `f0_mix` | entre `/encoder/Reshape_output_0` et le décodeur | impose la courbe de hauteur (2 valeurs par trame) |
| `n_override` [1, T] + `n_mix` | entre `/encoder/Reshape_1_output_0` et le décodeur | impose l’énergie (souffle, effort) |
| `f0_scale`, `f0_gamma`, `f0_ref` (v2) | transformation de la F0 prédite | hauteur et ampleur globales |

Sorties : `duration`, `f0`, `f0_pred`, `n_pred`. Chaque entrée de longueur variable a son propre
nom de dimension symbolique (avec un nom partagé, ONNX Runtime réutilisait à tort un tampon
d’une autre taille). Le graphe sans contrôle reste identique au modèle d’origine, au bit près
(vérifié). `prepare` écrit aussi un **graphe prédicteur élagué**
(`kokoro-ziggy-v3-predictor.onnx`, 86 Mo : seuls les nœuds dont dépendent `duration`, `f0_pred`
et `n_pred`). Il répond en ≈ 0,2 s au lieu de 3,3 s pour la synthèse complète. Le mode
« durées seules » du patch (`ziggy-voice patch --mode duration`) produit un fichier **identique
octet pour octet** à celui de l’ancien `prepare_model.py` (bibliothèque `onnx` en Python) : c’est
ainsi que l’écrivain protobuf a été validé ; le portage Python n’a donc plus de raison d’être.

Le cache (`voice-engine/.cache`, ignoré par git, ≈ 1,2 Go avec les deux graphes v3 + les prises brutes) peut être déplacé
avec `ZIGGY_VOICE_CACHE`. `ORT_DYLIB_PATH` permet d’utiliser une autre `libonnxruntime.so`.

**Télémétrie coupée.** La build Linux d’ONNX Runtime 1.31 embarque la télémétrie « 1DS » de
Microsoft (`telemetry_1ds.cc`, envoi vers `mobile.events.data.microsoft.com`) ; l’option de l’API
ne suffit pas. Le moteur pose `ORT_DISABLE_TELEMETRY=1` avant de charger la bibliothèque (et
désactive aussi l’option `ort`). Vérifié avec `strace` : 3 tentatives de connexion pendant une
synthèse sans la variable, 0 avec. Rien ne quitte la machine de fabrication.

## Générer

```bash
cd voice-engine
B=./target/release/ziggy-voice
$B generate                                  # tout : 31 histoires, fr puis en (reprend où il en était)
$B generate --locale fr --story d07 --force  # réenregistrer une histoire même si elle est à jour
$B generate --out /tmp/voice-v3 --progress /tmp/progress.txt   # dans un dossier d’attente, avec journal
$B generate --sample lili:s2 --out /tmp/try  # un segment : wav brut, wav masterisé, mp3, json
$B generate --check                          # rapport phonèmes, sans audio
$B plan --locale en --story d12              # le plan : voix, vitesses, pauses ET la lecture prévue
```

**Reprise après interruption.** Chaque histoire est rendue dans un dossier voisin
`.{histoire}.partial`, puis échangée d’un bloc avec l’ancienne (`.{histoire}.old` le temps de
l’échange) : une coupure ne mélange jamais anciens et nouveaux fichiers, et le lancement suivant
répare un échange interrompu. Une histoire déjà à la recette courante (`voice: "ziggy-v3"`, mêmes
textes, tous les MP3 présents) est sautée, sauf avec `--force`. `--progress` ajoute une ligne par
histoire terminée.

Pour aller deux fois plus vite sur 4 cœurs, lancer les deux langues en parallèle :
`$B generate --locale fr --threads 2 --jobs 2 & $B generate --locale en --threads 2 --jobs 2`.
Débit mesuré en v3 (deux passes) : ≈ 1,3 × le temps réel par processus, soit les 2 h 53 de voix
en ≈ 70 min sur 4 cœurs (deux processus). Pour régénérer sans toucher au dépôt tant que tout
n’est pas prêt : `--out` vers un dossier d’attente, vérifier (`check-prosody --dir …`), puis copier
dans `public/dodo/voice/`.
Les prises brutes de Kokoro sont en cache (`.cache/raw`, clé = phonèmes + style + vitesse +
durées + courbes imposées) : changer le filtre de voix, le mastering ou l’encodage ré-encode tout
en quelques minutes sans relancer la synthèse.

Après une modification d’une histoire (`src/data/dodo`), réenregistrer l’histoire : le test
`src/lib/dodo/voice.test.ts` échoue tant que le texte du minutage diffère du texte affiché.

Outils de mesure (comment la recette a été choisie, voir plus bas) :

```bash
$B lab "<phonèmes>" --set methods|pitch|blend|voices|probe|drift --out /tmp/lab   # wav + mesures
$B measure fichier.mp3 …                                    # hauteur, artefacts, LUFS (--json)
$B g2p --locale fr [--story d01]                            # phonèmes de chaque phrase
$B words --locale fr Yuki Nuna                              # phonèmes de mots isolés (lexique)
$B explain --locale fr d01:s2                               # par mot : mélodie du modèle, cible, envoyé
$B pitch fichier.mp3                                        # courbe de hauteur (Harvest, 5 ms) en JSON
$B check-prosody [--dir …] [--locale fr] [--story d01] [--json]   # la lecture est-elle entendue ?
```

## Comment ça marche

1. **Histoires** — `dump-stories.mjs` (esbuild déjà installé par vitest) imprime le texte exact
   de chaque segment (titre, scènes, `outroText()`).
2. **Front-end texte** (`text.rs`, `numbers.rs`) — jetons identiques à
   `text.trim().split(/\s+/)` côté site ; phrases (un `.!?…` suivi d’une majuscule ; « Oh ! »
   chuchota Lili reste une phrase) ; typographie (« » ’ … espaces insécables) ; nombres en
   toutes lettres FR/EN (cardinaux, ordinaux 1er/2e/21st, décimaux, années anglaises, %) pour
   le phonétiseur seulement — l’écran garde les chiffres.
3. **Phonèmes**, comme Kokoro a été entraîné :
   - **fr** : espeak-ng `fr-fr` appelé en FFI (`libloading`), avec le traitement exact de
     phonemizer + misaki `EspeakG2P` porté en Rust (`g2p_espeak.rs` : ponctuation préservée,
     liaisons sur des groupes de mots, tie `^`) ;
   - **en** : portage Rust du G2P anglais de misaki (`g2p_en.rs` : dictionnaires gold/silver,
     règles d’accent, -s/-ed/-ing, contexte « the/to » selon la voyelle suivante) avec un
     tokenizer façon spaCy, un petit étiqueteur (close/live…) et espeak-ng `en-us` en dernier
     recours ;
   - `lexicon.json` corrige noms et sons (Léopold, Ziggy, Pousse, Yuki, Yuna, Nuna,
     onomatopées…).

   Vérification : sur les 31 histoires, les phonèmes Rust sont **identiques** à ceux de
   l’ancien générateur Python pour les 1 483 phrases françaises et les 1 486 anglaises.
4. **Plan de narration** (`prosody.rs`, `recipe.rs`) — chaque segment est découpé en
   morceaux : narration, **dialogues** (« … », “ … ”, "…", y compris les citations sur
   plusieurs phrases) et **incises**, après la réplique (« chuchota Lili », “she said”) ou à
   l’intérieur des guillemets à la française (« Elle ne change pas, dit Lumi. Le soleil… »).
   Qui parle, dans l’ordre : l’incise (« proposa Lili », « dit-elle », « Grand-mère disait : »,
   “Lili whispered.”) ; le personnage qui se présente (« Je m’appelle Lumi », “My name is
   Lumi”) ; le personnage nommé dans la narration juste avant (« Les yeux de Lili brillèrent. »)
   ; dans un échange, la personne interpellée répond à une vraie question (« Lumi, pourquoi… ? »
   demanda Sacha. « Leur lumière… » → Lumi), sinon le même personnage continue (après « …, »
   ou un “Me?” laughed Lumi.) sauf s’il est lui-même interpellé ; sinon le dernier qui a parlé.
   « je » dans la narration, c’est Ziggy (« Puis je lui dis : ») : il garde sa voix de conteur.
   Les mots cités dans une phrase narrée (« un mot qui disait « Merci » ») restent au
   narrateur.
5. **Lecture** (`intonation.rs`, `contour.rs`) — chaque morceau est analysé (type de phrase,
   groupes, listes, mots mis en valeur, sentiment), puis rendu en durées, hauteur et énergie :
   voir « La lecture (v3) » ci-dessous.
6. **Synthèse en deux passes** (`kokoro.rs`, `render.rs`) — Kokoro-82M fp32 dans ONNX Runtime
   1.31 (`ort` 2.0-rc.15, `load-dynamic`), un appel par morceau. Le vecteur de style est
   **mélangé** : moitié « timbre » (décodeur, colonnes 0–127) et moitié « prosodie » (prédicteur,
   128–255). En v3, la moitié timbre vient **toujours de la même ligne** (`TIMBRE_ROW` = 40, la
   longueur médiane du corpus) ; la moitié prosodie reste choisie par le nombre de phonèmes, comme
   le fait Kokoro. Passe 1 : le graphe prédicteur, avec les allongements planifiés (`dur_scale`),
   donne durées, F0 et énergie du modèle. Le planificateur en tire les courbes. Passe 2 : le
   graphe complet reçoit les durées exactes, la courbe de hauteur et l’énergie. Les durées
   rendues sont vérifiées égales au plan ; elles donnent le début exact de chaque phonème.
7. **Voix d’enfant** (`world.rs`) — voir la recette ci-dessous.
8. **Assemblage** (`render.rs`) — le gain d’appui des mots mis en valeur (+1,5 dB, rampes
   cosinus de 30 ms) est appliqué sur l’audio. Chaque morceau est ensuite rogné à son son
   (−38 dB, marges 20/60 ms, fondus de 5 ms : pas de clic aux jointures), puis suivi de sa pause
   planifiée.
9. **Mots et visèmes** — un mot s’allume 0,10 s avant sa case de phonème (le son de Kokoro
   commence ≈ 3 trames plus tôt, comme `join_timestamps` de Kokoro) ; les jetons sans lettre
   (« — ») prennent l’heure du mot suivant. Les **visèmes** viennent des phonèmes réellement dits
   (avancés de 75 ms) : `smile` (repos, pauses, ponctuation), `small` (m b p f v), `open`
   (a ɑ æ ʌ aɪ aʊ), `o` (o ɔ u w ʊ y ø œ oʊ), `grin` (i e ɛ j s z et les autres consonnes) ;
   les blancs entre mots < 120 ms ne ferment pas la bouche, les indices < 50 ms sont fusionnés.
10. **Mastering** (`master.rs`, `dsp.rs`) puis **MP3** (`output.rs`) et `timing.json` v2.

## La lecture (v3) : intonation, mise en valeur, rythme

Objectif : lire comme un bon conteur pour enfants. Les phrases qui continuent remontent, celles
qui finissent se posent, les questions montent vraiment. Les listes se comptent, les mots
importants ressortent sans exagération, et la fin de l’histoire s’endort doucement. Ziggy n’est
jamais triste ni effrayant.

### 1. Analyse (`intonation.rs`)

- **Type de phrase** : déclarative ; question fermée (« ? » sans mot interrogatif, ou
  « est-ce que » dans les 5 premiers mots, une apostrophe en tête « Lumi, … ? » mise à part) ;
  question ouverte (qui, quoi, où, comment, pourquoi… / who, what, where…) ; exclamation ;
  impératif (Regarde, Viens, Écoute… / Look, Come…) ; suspension (« … ») ; onomatopée (Grrrrr,
  Ploc, Hoo…).
- **Groupes intonatifs** : coupés à la ponctuation (, ; : — …, y compris le « : » isolé de la
  typographie française) ; avant un mot de liaison ou un relatif (et, mais, quand, qui, que… /
  and, but, when, who…) s’il reste au moins 4 mots de chaque côté ; avant une préposition dans
  un très long groupe (au moins 10 mots).
- **Listes** : « A, B, et C » (au moins deux groupes à virgule puis et/ou/and/or), ou « A, B et
  C » quand B et C se ressemblent (même sorte de déterminant, ou deux mots courts) : « des
  coquelicots, des marguerites et des boutons d’or ». Ne sont **pas** des listes : une ouverture
  (« D’habitude, Tilou était gentil et tranquille »), une paire figée (« safe and sound »,
  « nice and warm ») ou une répétition (« encore et encore »).
- **Mots mis en valeur** (au plus un par groupe et deux par morceau) : intensifs (très, si,
  tellement, trop, tout / so, very, too), contraste en tête (Mais, pourtant / But), nombres,
  **première apparition** d’un personnage dans l’histoire, **mots-clés** de l’histoire (pris
  dans le titre, les scènes et la morale ; une fois par scène), onomatopées. Les majuscules d’un
  titre en Title Case et le premier mot d’une phrase ou d’une citation ne comptent pas comme noms.
- **Sentiment** (lexiques, négation comprise : « pas triste » ne compte pas) : joie,
  émerveillement, tendresse, léger souci, calme, sommeil. Le souci resserre la mélodie, il ne
  l’assombrit pas.
- **Place** : la phrase qui ferme une scène, la morale et les deux dernières phrases de
  l’histoire sont un **atterrissage** (plus lent, plus bas, plus doux) ; les incises
  (« murmure une petite marguerite ») et les chuchotements sont repérés par le plan v2.

`ziggy-voice plan` montre la lecture prévue : `/` continuation, `↗` élément de liste, `↘` fin,
`↗?` question fermée, `→` suspension, `*mot*` mis en valeur, avec le type et le sentiment.

### 2. Rendu (`contour.rs`) : garder la mélodie du modèle, corriger ce qui manque

Un premier essai remplaçait la mélodie de Kokoro par des contours de règles. Le résultat était
plus plat que la v2, car la mélodie du modèle est vivante et naturelle. La v3 la **garde**,
l’élargit, et ne la **corrige** que là où elle manque la cible :

- mélodie du modèle (passe 1) en demi-tons autour de sa médiane, séparée en contour lissé
  (σ 75 ms) et détail fin (gardé jusqu’à ±2,5 dt) ;
- élargissement de conteur ×1,15 (× ampleur du rôle : personnages ×1,2, anciens ×1,05, Ziggy
  ×1,15 ; × sentiment). Il est linéaire jusqu’à ±4,5 dt, puis sature doucement vers ±9 dt : les
  grands mouvements restent musicaux, et une chute « grinçante » du modèle n’est jamais creusée ;
- niveau fixé par la référence du rôle (même hauteur pour tous les morceaux d’un personnage),
  plancher −7 dt, plafond +9 dt, pente limitée à 1 dt par 12,5 ms (anti-accroc) ;
- **ton de frontière** sur la dernière syllabe de chaque groupe, par rapport à la moyenne du
  groupe :

| Fin de groupe | Cible |
|---|---|
| continuation (fr) | au moins +2,5 dt (la montée française) |
| continuation (en) | au moins +1,5 dt |
| élément de liste | au moins +2,5 dt : chaque élément monte, le dernier tombe |
| question fermée | au moins +4 dt **et** 2 dt au-dessus de son premier mot, puis +1,5 dt sur la dernière voyelle |
| suspension « … » | pas sous −0,5 dt : la voix reste en l’air |
| déclarative | au plus −3 dt |
| atterrissage | au plus −4 dt |

  Le glissement part de la syllabe précédente (chutes, questions) ou de l’attaque de la dernière
  syllabe (continuations). Il atteint la cible au milieu de la dernière voyelle (dès son début
  pour une question), pour qu’on l’entende sur du son voisé. Partout où la mélodie du modèle
  satisfait déjà la cible, elle n’est pas touchée. Sur une montée, le détail fin est limité à
  ±0,8 dt, pour qu’une fin grinçante ne tire plus la question vers le bas ;
- **têtes** : le premier mot de contenu d’une question ouverte monte d’au moins +2 dt, celui
  d’une exclamation d’au moins +3 dt et celui d’un impératif d’au moins +1,5 dt ;
- **mise en valeur** : le mot dépasse son voisin le plus haut de 1,5 dt (× ampleur). Il est
  levé de +2,5 dt au moins (contraste ×0,6) et de 4 dt au plus ; au-delà, c’est le voisin qui
  s’efface (jusqu’à −2 dt). En français, tout le mot est porté, de sa première syllabe (accent
  initial) à sa dernière voyelle, pour que « SEcrets » ne repose pas sur un e muet. En anglais,
  c’est sa syllabe accentuée. S’y ajoutent +1,5 dB sur le mot (gain sur l’audio), un peu
  d’énergie (N +0,8 ; dans Kokoro, N ne bouge le niveau que de ≈ 0,33 dB par unité) et une
  voyelle allongée ×1,15 (attaque ×1,1, onomatopée ×1,2) ;
- **sentiments** :

| Sentiment | Niveau | Ampleur | Énergie N | Tempo |
|---|---|---|---|---|
| joie | +0,6 dt | ×1,15 | +0,3 | ×1,03 |
| émerveillement | +0,8 dt | ×1,25 | +0,2 | ×0,97 |
| tendresse | −0,3 dt | ×0,9 | −0,3 | ×0,96 |
| léger souci | 0 | ×0,85 | −0,3 | ×0,96 |
| calme | −0,2 dt | ×0,85 | −0,2 | ×0,97 |
| sommeil | −0,8 dt | ×0,7 | −0,6 | ×0,93 |

- chuchotement : ampleur ×0,6, énergie −2 ; incise : −1,5 dt, ampleur ×0,6, énergie −0,4 ;
  atterrissage : −1 dt, ampleur ×0,85, énergie −0,6 ; exclamation et onomatopée : ampleur ×1,2.

### 3. Rythme

- **Allongement final** (voyelle et coda de la dernière syllabe du groupe) : déclarative ×1,3,
  atterrissage ×1,4, suspension ×1,45, question ou exclamation ×1,2, continuation et élément de
  liste ×1,25 (×1,2 quand la phrase continue dans le morceau suivant). Un élément de liste est
  aussi lu ×1,05 en entier : on ne bâcle pas une énumération.
- **Pauses hiérarchisées** à l’intérieur des phrases (durée de la ponctuation dans Kokoro) :
  « … » ×1,5 ; « : ; — » ×1,3 ; virgule avant une proposition ×1,25 ; virgule de liste ×1,15.
- Un petit temps après un « Mais » en tête de phrase (« Mais… toutes les fleurs baissent la
  tête ») ; une respiration de +0,12 s avant une phrase de 18 mots ou plus.
- Le tempo du sentiment s’ajoute aux règles de vitesse v2 (voir « Plan de narration »).

### 4. Couleur constante

Kokoro choisit la ligne de style selon la longueur de l’énoncé. Or la moitié « timbre » de ces
lignes dérive avec la longueur (lignes 20 et 250 de `ff_siwis` : 55 % de la norme d’écart) : une
courte réplique et une longue phrase ne sonnaient pas tout à fait comme le même Ziggy. La v3
prend la moitié timbre d’une seule ligne (`TIMBRE_ROW` = 40). Mesuré avec `lab --set drift` sur
la même phrase, pour des longueurs de style de 17 à 69 phonèmes : écart d’enveloppe spectrale
FR 0,47 → 0,20 dB et EN 0,36 → 0,17 dB ; écart de hauteur moyenne 0,71 → 0,00 dt (FR) et
0,81 → 0,00 dt (EN), puisque le niveau suit maintenant la référence du rôle.

### 5. Prononciation

- `lexicon.json` : Yuki /juki/, Yuna /juna/, Nuna /nuna/ en français (espeak disait « Yu-ki »
  avec un u français), « but » (verbe buter) ; en anglais, les mots à trait d’union ne font plus
  de pause (« Polka-Dot », « hide-and-seek » : le trait d’union entre deux mots est étiqueté
  comme dans spaCy).
- Revue des 31 histoires (noms propres et mots rares, `g2p`/`words`) : Lumi /lymi/ et Hana /ana/
  restent à la française ; « tous », « cerf », « net », « ours », « gentil », « fier » sont justes ;
  en anglais, les noms (Noisette, Pompon, Plume, Tao…) sont corrects ; seuls « Hoo » et « hoo »
  passent encore par espeak.
- Les incises plus longues à l’intérieur des guillemets (« …, et tu verras, dit-elle avec un
  clin d’œil. ») sont dites par la narratrice, plus par le personnage.

### 6. La lecture est-elle entendue ? (mesures v2 → v3)

`ziggy-voice check-prosody` replanifie chaque histoire à partir du texte, décode le MP3 publié,
suit sa hauteur (WORLD Harvest, 5 ms) et la place sur les mots grâce à `timing.json`. Seules les
trames de vraie voix comptent : on écarte les trames à plus de 25 dB sous le niveau fort, ainsi
que les bouts voisés de moins de 40 ms, où le suiveur « entend » une hauteur dans un souffle.
Toutes les histoires, fr + en, mêmes règles pour v2 et v3 :

| Mesure (31 histoires × fr + en) | v2 | v3 |
|---|---|---|
| question fermée : finit au moins 1 dt plus haut que son premier mot | 0 / 36 (moyenne −8,8 dt) | **29 / 36** (+2,9 dt) |
| élément de liste : finit au moins 0,5 dt plus haut qu’il ne commence | 61 / 160 = 38 % (−1,4 dt) | **116 / 162 = 72 %** (+1,6 dt) |
| continuation : la fin du groupe ne retombe pas (≥ −0,5 dt) | 891 / 1755 = 51 % (−0,9 dt) | **1153 / 1756 = 66 %** (+0,5 dt) |
| mot mis en valeur : 0,5 dt au-dessus de ses voisins | 545 / 1006 = 54 % (+1,1 dt) | **682 / 1008 = 68 %** (+2,1 dt) |
| déclarative : finit au moins 1 dt plus bas que son premier mot | 2436 / 2450 = 99,4 % (8,3 dt) | 2399 / 2455 = 97,7 % (6,4 dt) |
| question ouverte : commence plus haut qu’elle ne finit | 34 / 34 (8,4 dt) | 34 / 34 (7,7 dt) |
| lissé : pente p99 / max (dt par 5 ms) | 2,24 / 11,0 | 2,12 / 10,0 |
| sauts de plus de 1 dt par minute voisée | 793 | 685 |

La colonne v2 mesure ce que Kokoro faisait de lui-même avec les mêmes textes : il ne montait sur
aucune question fermée (il finissait même 9 dt plus bas), et la plupart des listes retombaient à
chaque élément. Les déclaratives de la v3 tombent un peu moins profond (6,4 contre 8,3 dt) parce
que la chute « grinçante » de la v2 (fry vocal jusqu’à −8 dt) a disparu ; 98 % tombent toujours
nettement.

Le timbre n’a pas bougé (`ziggy-voice measure`, moyennes sur les 248 segments de chaque langue) :

| | FR v2 | FR v3 | EN v2 | EN v3 |
|---|---|---|---|---|
| F0 médiane | 246 Hz | 237 Hz | 234 Hz | 221 Hz |
| Étendue mélodique (p5–p95) | 13,2 dt | 12,1 dt | 15,0 dt | 14,0 dt |
| Jitter | 0,50 % | 0,48 % | 0,57 % | 0,54 % |
| HNR 0–4 kHz | 16,3 dB | 16,2 dB | 15,2 dB | 14,9 dB |
| HNR 4–8 kHz | 9,4 dB | 9,3 dB | 9,2 dB | 9,0 dB |
| Planéité 1–5 kHz | 0,153 | 0,155 | 0,150 | 0,150 |
| Rugosité AM 30–120 Hz | −10,0 dB | −9,9 dB | −8,4 dB | −8,4 dB |
| Ondulation cepstrale | 14,2 dB | 14,2 dB | 14,3 dB | 14,2 dB |
| Loudness (min…max) | −18,15…−17,90 | −18,22…−17,95 | −18,42…−17,91 | −18,15…−17,96 |
| Crête vraie max (MP3 décodé) | −1,54 dBTP | −1,50 dBTP | −1,50 dBTP | −1,50 dBTP |
| Durée totale | 86,3 min | 91,0 min | 76,8 min | 81,8 min |

Lecture : HNR, planéité, rugosité et peigne restent à ±0,3 dB près, et le jitter baisse un peu.
La médiane descend de 0,6 dt (fr) et 1 dt (en) : les fins de scène, la tendresse, le sommeil et
les incises sont dits plus bas, à dessein. L’étendue p5–p95 perd 1 dt **par le bas** : c’est le
grave grinçant des fins de phrase de la v2 qui a disparu (plancher −7 dt). La lecture dure 6 %
de plus (fins de groupe allongées, pauses hiérarchisées).

**Minutage des mots** (après une pause, écart entre l’instant où le mot s’allume et le début de
son son, mesuré sur lili et d01–d05, 300 mots fr et 380 en) : médiane 5 ms (fr) et 20 ms (en),
90 % sous 65 ms, comme en v2. Les durées étant imposées et vérifiées égales au plan, les visèmes
restent alignés par construction.

Paires A/B d’écoute (avec des notes « quoi écouter ») : `fr/lili/s1`, `fr/d01/s2`, `fr/d19/s2`
(le « Grrrrr »), `fr/lili/outro`, `en/d05/s1` et `fr/d05/s1` (Yuki).

## La recette de la voix (v2, `recipe.rs`)

| | Français | Anglais |
|---|---|---|
| Timbre (décodeur) | `ff_siwis` 70 % + `af_heart` 30 % | `af_heart` 80 % + `ff_siwis` 20 % |
| Prosodie (prédicteur) | `ff_siwis` | `af_heart` |
| Vitesse Kokoro du narrateur | 0,80 | 0,84 |
| Hauteur dans le réseau | ×1,22, mélodie élargie γ 1,15 (pivot 200 Hz) | ×1,22, γ 1,12 (pivot 190 Hz) |
| Conduit vocal (enveloppe CheapTrick) | ×1,09 | ×1,09 |

**Pourquoi ainsi** (mesures `ziggy-voice lab` sur la même phrase française, `ff_siwis`,
vitesse 0,80 ; HNR = pics harmoniques / creux, plat. = planéité spectrale 1–5 kHz, formants =
facteur d’échelle de l’enveloppe moyenne mesuré par rapport à la prise brute) :

| Recette | F0 méd. | Étendue | Jitter | HNR 0–4k | HNR 4–8k | Plat. | Formants | Centroïde |
|---|---|---|---|---|---|---|---|---|
| Kokoro brut | 200 Hz | 8,8 dt | 0,45 % | 16,1 dB | 7,4 dB | 0,173 | ×1,00 | 1198 Hz |
| v1 (rubberband ×1,30, formants, peigne, anneau) | 261 Hz | 9,0 dt | 0,33 % | 19,1 dB | 9,8 dB | 0,150 | **×1,285** | 563 Hz |
| WORLD complet (F0 ×1,18 γ1,1, enveloppe ×1,09) | 233 Hz | 12,0 dt | 0,37 % | 21,8 dB | 8,7 dB | 0,137 | ×1,095 | 665 Hz |
| Hauteur dans le réseau seule | 232 Hz | 12,2 dt | 0,43 % | 17,3 dB | 7,7 dB | 0,171 | ×1,00 | 1152 Hz |
| **Réseau + filtre d’enveloppe ×1,09 (v2)** | 233 Hz | 12,1 dt | 0,46 % | 17,3 dB | 7,7 dB | 0,172 | **×1,09** | 1238 Hz |

- **La hauteur est changée dans Kokoro lui-même** : le graphe patché transforme la courbe F0 du
  prédicteur, `f0 = ref·(f0/ref)^γ·scale` sur les trames voisées, avant que le décodeur (vocodeur
  neuronal à source harmonique) ne la chante. Pas de vocodeur de transposition, donc pas
  d’artefact : jitter, planéité, ondulation cepstrale restent ceux de la voix brute. Un balayage
  ×0,9 → ×1,5 ne montre aucune dégradation mesurable jusqu’à ×1,4 (les voix de personnages
  restent sous ×1,36).
- **Le conduit vocal plus petit vient de WORLD** (`rsworld`) : l’enveloppe spectrale CheapTrick
  (analysée avec la F0 exacte rendue par Kokoro, affinée par StoneMask) est dilatée ×1,09 (le
  haut du spectre revient doucement vers ×1 au-dessus de 9 kHz) et appliquée comme **gain lisse
  dans le domaine STFT** sur l’audio neuronal. L’excitation, le souffle, les phases et
  l’apériodicité restent intacts. La resynthèse WORLD complète a été mesurée : +4 à +5 dB de HNR
  (voix plus « bourdonnante »), −15 % de planéité, timbre assombri — rejetée.
- **Le mélange de timbre** : la moitié décodeur ne déplace pas les formants (≤ 0,5 %) mais
  colore la voix. 30 % d’`af_heart` réchauffe `ff_siwis` (centroïde −9 %) avec la plus faible
  distorsion par classe de phonèmes (≈ 2 dB partout, voyelles nasales et ʁ comprises, durées
  identiques donc comparaison trame à trame). `af_nicole` (soufflée) a été écartée : elle déforme
  spécifiquement y/ø/œ (4,2 dB).
- **La touche « robot »** de v1 (peigne 4 ms + modulation en anneau) est retirée : c’était
  l’essentiel de l’effet synthétique. Ziggy reste un robot par son image, sa voix est celle d’un
  enfant doux.

### Avant / après (v1 → v2, mesuré sur les MP3 livrés)

Moyennes sur les 248 segments de chaque langue (`ziggy-voice measure`) ; entre parenthèses, la
voix Kokoro brute (`ff_siwis` / `af_heart` sans traitement) quand elle sert de référence de
naturel.

| | FR v1 | FR v2 | EN v1 | EN v2 |
|---|---|---|---|---|
| F0 médiane | 265 Hz | 246 Hz | 259 Hz | 234 Hz |
| Étendue mélodique (p5–p95) | 10,4 dt | **13,2 dt** | 11,3 dt | **15,0 dt** |
| Jitter (brut ≈ 0,45 / 0,52 %) | 0,40 % | 0,50 % | 0,54 % | 0,57 % |
| HNR 0–4 kHz (brut 16,1 / 14,6 dB) | 18,5 dB | 16,3 dB | 16,2 dB | 15,2 dB |
| HNR 4–8 kHz (aigus « métalliques ») | 12,7 dB | **9,4 dB** | 12,3 dB | **9,2 dB** |
| Planéité 1–5 kHz | 0,140 | 0,153 | 0,137 | 0,150 |
| Rugosité AM 30–120 Hz (brut −10,2 / −7,7 dB) | −11,1 dB | −10,0 dB | −9,8 dB | −8,4 dB |
| Ondulation cepstrale (peigne) | 14,8 dB | 14,2 dB | 14,5 dB | 14,3 dB |
| Loudness (min…max, moyenne) | −18,9…−17,9 (−18,4) | **−18,2…−17,9 (−18,0)** | −18,7…−18,1 (−18,4) | **−18,4…−17,9 (−18,0)** |
| Crête vraie max (MP3 décodé) | −1,8 dBTP | ≤ −1,5 dBTP | −1,5 dBTP | ≤ −1,5 dBTP |

Lecture : v2 garde la micro-variation, le souffle et la rugosité de la voix neuronale d’origine
(v1 la lissait et la rendait plus « bourdonnante » : HNR +2,4 dB en français), supprime le reflet
métallique des aigus (−3 dB de HNR au-dessus de 4 kHz, plus d’ondulation de peigne), raconte
avec ≈ 30 % de mélodie en plus et un volume plus régulier d’un segment à l’autre. Les formants
passent de ×1,285 (v1, effet « voix accélérée ») à ×1,09.

Paires A/B (fichiers d’écoute) : `fr/lili/s1` et `en/d05/s1`, avant/après, mêmes mesures :
F0 260 → 240 / 260 → 235 Hz ; étendue 10,0 → 13,8 / 10,3 → 14,9 dt ; HNR 4–8 kHz 12,7 → 9,4 /
12,4 → 9,1 dB ; −18,3 → −18,1 LUFS.

### Plan de narration (règles)

- **Vitesse** : titre ×0,94 ; première phrase de l’histoire ×0,96 (« Il était une fois… ») ;
  phrases d’action (« soudain », « courut », un `!` en narration) ×1,04 ; dernière phrase de
  chaque scène ×0,95 et −1 dB ; dernière scène ×0,97 puis ×0,93 et −1,5 dB pour les deux
  dernières phrases ; outro ×0,92, −1 dB, mélodie apaisée (γ ≤ 1,05).
- **Pauses** : 0,10 s avant le segment ; après `.` 0,42 s, `!` 0,45 s, `?` 0,55 s, `…` 0,75 s,
  `:` 0,30 s ; +0,15 s avant la phrase de clôture d’une scène ; +0,12 s avant une courte phrase
  « révélation » (≤ 4 mots après une longue) ; entre une réplique et son incise 0,14 s (0,22 s
  après `! ? …`) ; 0,40 s en fin de segment, 0,80 s après l’outro ; v3 : +0,12 s avant une
  phrase de 18 mots ou plus.
- **v3** : la vitesse est encore multipliée par le tempo du sentiment de la phrase (hors titre et
  atterrissage, déjà ralentis) ; la mélodie ne vient plus de γ (le réglage `f0_gamma` de v2) mais
  du rendu de la lecture ci-dessus.
- **Voix des personnages** (douces, reconnaissables, cohérentes dans toute l’histoire) :
  premier personnage nommé = *ChildA* (timbre + 15 % `af_sky`, hauteur ×1,07, conduit ×1,12),
  deuxième = *ChildB* (+ 15 % `bf_lily`, ×1,11, ×1,13), adultes et anciens (grand-mère, Papi,
  le vieux chêne, la bibliothécaire…) = *Warm* (+ 20 % `af_bella`, ×0,88, conduit ×1,03, un peu
  plus lent), locuteur inconnu = *Generic* (×1,04). Répliques plus mélodieuses (γ 1,22–1,25).
  Verbes chuchotés (chuchota, murmura, souffla, whispered…) : −3 dB, ×0,95, mélodie plate.
  Les incises (« chuchota Lili ») sont dites un peu plus vite (×1,05), plus bas (×0,97) et plus
  doucement (−1,5 dB), comme un conteur. Les questions gardent leur montée (γ +0,05).

### Mastering (Rust, `master.rs`)

Passe-haut 70 Hz (Butterworth 4ᵉ ordre) → chaleur +1,5 dB à 220 Hz → aigus doux (plateau
−2 dB dès 6,5 kHz, passe-bas 10 kHz 4ᵉ ordre) → **de-esser** (EQ dynamique STFT 4,5–12 kHz,
seulement sur les sifflantes qui approchent à 10 dB du niveau fort de la voix ; actif > 2 dB sur
≈ 1,5 % des trames) → **compresseur 2:1** à genou doux (−24 dBFS, 10/140 ms) → **petite pièce
douillette** (réponse impulsionnelle synthétique déterministe : premières réflexions 9–31 ms et
queue sombre RT60 0,22 s, 4,5 % de mélange, 95 % de l’énergie en 150 ms : pas d’écho) →
**EBU R128 −18 LUFS** (`ebur128`) → **limiteur true-peak** −1,5 dBTP (anticipation 3 ms,
relâchement 60 ms, plafond ajusté jusqu’à ce que la mesure 4× suréchantillonnée d’`ebur128`
passe) → fondus de 20 ms.

**MP3** : `ffmpeg` + libmp3lame, mono 24 kHz (la fréquence de Kokoro), **VBR qualité 5**
(≈ 47 kbit/s). Mesuré contre le WAV masterisé : SNR 22,2 dB contre 19,8 (ABR 44), 20,1
(CBR 48) et 18,5 dB (CBR 40 de v1), meilleur dans toutes les bandes.

## Qualité du moteur

```bash
cargo build --release && cargo test --release && cargo clippy --all-targets -- -D warnings && cargo fmt --check
```

(`cargo clippy` dans le profil de développement : `cargo clippy --release` remplace l’artefact
du binaire release par une compilation « check » et `target/release/ziggy-voice` disparaît.)

Les tests couvrent : jetons/phrases/citations, nombres FR/EN, port de phonemizer (ponctuation),
alignement, accentuation et tokenizer anglais, plan de narration (locuteurs, incises,
chuchotements, pauses, rythme des fins), visèmes (correspondance, fusion, tri), WORLD (aller-
retour : longueur, niveau, F0 ; transposition ; déformation d’enveloppe ; taille FFT), filtres RBJ
(réponses en fréquence), compresseur, de-esser, limiteur (jamais au-dessus du plafond), pièce,
**cible de loudness et true-peak**, patch ONNX (graphe jouet : patch v3 et élagage du
prédicteur), cache des prises, JSON v2, échange atomique d’une histoire et reprise. Lecture v3 :
types de phrase, groupes et listes (et les fausses listes), mots mis en valeur, sentiments,
mots-clés ; syllabes et accents ; les déclaratives tombent, les questions montent (même quand le
modèle part haut et finit en grinçant), les éléments de liste montent, le mot mis en valeur
dépasse ses voisins (même un voisin plus haut), courbes lisses et seulement sur le voisé,
allongements et pauses hiérarchisées.
`tests/engine.rs` vérifie de bout en bout avec le vrai modèle (sauté sans cache) : phonèmes
FR/EN de référence, sorties du graphe patché, hauteur ×1,2 exacte dans le réseau sans changer les
durées, passe prédicteur identique au graphe complet, durées et courbe de hauteur imposées
suivies exactement, un segment complet (mots, visèmes, −18 LUFS, ≤ −1,5 dBTP). Le générateur
vérifie aussi chaque MP3 décodé (loudness, crête vraie) et re-masterise plus bas si l’encodeur a
dépassé.

Deux pièges rencontrés dans `rsworld` 0.1 (contournés et documentés dans `world.rs`) :
`GetFFTSizeForCheapTrick` y est déclaré `void` (la taille renvoyée par le C est perdue) et le
Harvest embarqué lit deux lignes non initialisées aux bords (corrigé en amont depuis) : sa sortie
est filtrée. La chaîne de production n’utilise pas Harvest (F0 du modèle + StoneMask).

## Ce qui reste imparfait

- L’analyse est faite de règles et de lexiques, sans analyseur syntaxique : une liste peut
  encore être manquée (« two brown braids, a red raincoat and yellow boots » n’est pas lue comme
  une liste) ou vue à tort ; le sentiment vient de mots-clés (une phrase sans mot repère reste
  neutre) ; un nom en tête de phrase n’est pas mis en valeur à sa première apparition (la
  majuscule ne dit rien à cet endroit).
- La mise en valeur est relative aux mots voisins : un mot appuyé n’est pas toujours le plus
  haut de sa phrase. `check-prosody` le trouve au-dessus de ses voisins dans 68 % des cas.
- 7 questions fermées sur 36 ne passent pas encore la mesure, souvent parce qu’elles commencent
  déjà très haut (« Et si… ») ou finissent sur un mot très court.
- Les fins de continuation montent dans 66 % des cas mesurés : la mesure est grossière (moyenne
  du dernier mot contre l’avant-dernier) et une montée sur une seule syllabe finale ne déplace pas
  toujours cette moyenne.
- Prononciation : espeak-ng (fr) et les dictionnaires de misaki (en) font quelques erreurs ;
  `generate --check` et la liste « English words read by espeak » indiquent quoi ajouter à
  `lexicon.json`. Noms propres non listés : prononcés « à la française » par espeak.
- L’attribution des répliques est heuristique : ≈ 100 morceaux de réplique par langue restent
  à la voix *Generic* faute d’indice, et un échange sans incise peut être attribué au mauvais
  personnage (« Et moi aussi, je te pardonne » après deux « Pardon »). Une incise avec un pronom
  (« dit-elle ») ne désigne pas encore le personnage : la réplique prend la voix *Generic*.
- Chaque morceau est synthétisé à part ; la couleur est maintenant fixe (ligne de timbre
  unique), mais l’enchaînement mélodique entre deux morceaux (réplique puis incise) dépend
  encore de la pause qui les sépare.

## Licences

Livré avec le site : uniquement l’audio produit (MP3 + `timing.json`).

- **Kokoro-82M** (hexgrad) — Apache-2.0, modèle et voix ; export ONNX onnx-community
  (Apache-2.0) redistribué sur npm (`kokoro-fp32a/b/c-shards`, Apache-2.0) ; voix de
  `kokoro-js` 1.2.1 (Apache-2.0). Dictionnaires anglais de **misaki** 0.9.4 (Apache-2.0).
- Outils de fabrication (non distribués) : ONNX Runtime 1.31.1 (MIT) ; crates Rust `ort`/`ort-sys`
  (MIT/Apache-2.0), `rsworld`/`rsworld-sys` (MIT) qui embarquent **WORLD** (M. Morise, BSD
  modifiée), `rustfft` (MIT/Apache-2.0), `realfft` (MIT), `ebur128` (MIT), `hound` (Apache-2.0),
  `serde`, `serde_json`, `clap`, `anyhow`, `regex`, `rayon`, `sha2`, `flate2`, `tar`,
  `unicode-normalization` (MIT/Apache-2.0), `zip` (MIT), `libloading` (ISC) ;
  **espeak-ng 1.52 (GPL-3.0)** via la wheel `espeakng-loader` (MIT), chargé dynamiquement sur la
  machine de fabrication uniquement ; **FFmpeg** + libmp3lame (LGPL/GPL), outil système.
  Aucun de ces codes n’est lié au site ni livré avec lui.
