# Ziggy Voice Engine v2 (Rust)

Le narrateur hors-ligne des histoires du **mode dodo**. Il enregistre une fois pour toutes
chaque histoire avec la voix de Ziggy (un petit robot-peluche enfant : jeune, doux, gentil) et
écrit des fichiers statiques que le site sert tels quels — aucune IA, aucun appel d’API quand un
enfant écoute.

```
public/dodo/voice/{fr|en}/{storyId}/title.mp3, s1.mp3 … s6.mp3, outro.mp3
public/dodo/voice/{fr|en}/{storyId}/timing.json     (DodoVoiceTiming v2, src/lib/dodo/voice.ts)
```

Tout le moteur est en Rust (`ziggy-voice/`) : préparation du modèle (npm/PyPI → jointure →
sha256 → patch du graphe ONNX), front-end texte (normalisation, nombres, phrases, dialogues,
G2P), plan de narration, synthèse Kokoro (ONNX Runtime via `ort`), voix d’enfant (WORLD +
filtre STFT), mastering, minutage des mots, visèmes. Seuls outils externes : `node` (lire les
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
entre le prédicteur de hauteur et le décodeur, les contrôles de mélodie de Ziggy (entrées
`f0_scale`, `f0_gamma`, `f0_ref`, sorties `f0` et `f0_pred`). Aucun poids n’est modifié. Le mode
« durées seules » du patch (`ziggy-voice patch --mode duration`) produit un fichier **identique
octet pour octet** à celui de l’ancien `prepare_model.py` (bibliothèque `onnx` en Python) : c’est
ainsi que l’écrivain protobuf a été validé ; le portage Python n’a donc plus de raison d’être.

Le cache (`voice-engine/.cache`, ignoré par git, ≈ 0,9 Go + les prises brutes) peut être déplacé
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
$B generate                                  # tout : 31 histoires, fr puis en
$B generate --locale fr --story d07          # une histoire
$B generate --skip-existing                  # seulement les histoires dont un texte a changé
$B generate --sample lili:s2 --out /tmp/try  # un segment : wav brut, wav masterisé, mp3, json
$B generate --check                          # rapport phonèmes, sans audio
$B plan --locale en --story d12              # le plan de narration (voix, vitesses, pauses)
```

Pour aller deux fois plus vite sur 4 cœurs, lancer les deux langues en parallèle :
`$B generate --locale fr --threads 2 --jobs 2 & $B generate --locale en --threads 2 --jobs 2`.
Débit mesuré : ≈ 1,2 × le temps réel par processus, soit les 2 h 43 de voix en ≈ 75 min sur
4 cœurs (deux processus).
Les prises brutes de Kokoro sont en cache (`.cache/raw`, clé = phonèmes + style + vitesse +
mélodie) : changer le filtre de voix, le mastering ou l’encodage ré-encode tout en quelques
minutes sans relancer la synthèse.

Après une modification d’une histoire (`src/data/dodo`), réenregistrer l’histoire : le test
`src/lib/dodo/voice.test.ts` échoue tant que le texte du minutage diffère du texte affiché.

Outils de mesure (comment la recette a été choisie, voir plus bas) :

```bash
$B lab "<phonèmes>" --set methods|pitch|blend|voices --out /tmp/lab   # wav + tableau de mesures
$B measure fichier.mp3 …                                              # hauteur, artefacts, LUFS
$B g2p --locale fr [--story d01]                                      # phonèmes de chaque phrase
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
   - `lexicon.json` corrige noms et sons (Léopold, Ziggy, Pousse, onomatopées…).

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
5. **Synthèse** (`kokoro.rs`) — Kokoro-82M fp32 dans ONNX Runtime 1.31 (`ort` 2.0-rc.15,
   `load-dynamic`), un appel par morceau ; le vecteur de style est choisi par le nombre de
   phonèmes comme le fait Kokoro, puis **mélangé** : moitié « timbre » (décodeur, colonnes
   0–127) et moitié « prosodie » (prédicteur, 128–255) séparément. Les durées prédites donnent
   le début exact de chaque phonème.
6. **Voix d’enfant** (`world.rs`) — voir la recette ci-dessous.
7. **Assemblage** (`render.rs`) — chaque morceau est rogné à son son (−38 dB, marges 20/60 ms,
   fondus de 5 ms : pas de clic aux jointures), suivi de sa pause planifiée.
8. **Mots et visèmes** — un mot s’allume 0,10 s avant sa case de phonème (le son de Kokoro
   commence ≈ 3 trames plus tôt, comme `join_timestamps` de Kokoro) ; les jetons sans lettre
   (« — ») prennent l’heure du mot suivant. Les **visèmes** viennent des phonèmes réellement dits
   (avancés de 75 ms) : `smile` (repos, pauses, ponctuation), `small` (m b p f v), `open`
   (a ɑ æ ʌ aɪ aʊ), `o` (o ɔ u w ʊ y ø œ oʊ), `grin` (i e ɛ j s z et les autres consonnes) ;
   les blancs entre mots < 120 ms ne ferment pas la bouche, les indices < 50 ms sont fusionnés.
9. **Mastering** (`master.rs`, `dsp.rs`) puis **MP3** (`output.rs`) et `timing.json` v2.

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
  après `! ? …`) ; 0,40 s en fin de segment, 0,80 s après l’outro.
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
**cible de loudness et true-peak**, patch ONNX (graphe jouet), cache des prises, JSON v2.
`tests/engine.rs` vérifie de bout en bout avec le vrai modèle (sauté sans cache) : phonèmes
FR/EN de référence, sorties du graphe patché, hauteur ×1,2 exacte dans le réseau sans changer les
durées, un segment complet (mots, visèmes, −18 LUFS, ≤ −1,5 dBTP). Le générateur vérifie aussi
chaque MP3 décodé (loudness, crête vraie) et re-masterise plus bas si l’encodeur a dépassé.

Deux pièges rencontrés dans `rsworld` 0.1 (contournés et documentés dans `world.rs`) :
`GetFFTSizeForCheapTrick` y est déclaré `void` (la taille renvoyée par le C est perdue) et le
Harvest embarqué lit deux lignes non initialisées aux bords (corrigé en amont depuis) : sa sortie
est filtrée. La chaîne de production n’utilise pas Harvest (F0 du modèle + StoneMask).

## Ce qui reste imparfait

- Prononciation : espeak-ng (fr) et les dictionnaires de misaki (en) font quelques erreurs ;
  `generate --check` et la liste « English words read by espeak » indiquent quoi ajouter à
  `lexicon.json`. Noms propres non listés : prononcés « à la française » par espeak.
- L’attribution des répliques est heuristique : ≈ 100 morceaux de réplique par langue restent
  à la voix *Generic* faute d’indice, et un échange sans incise peut être attribué au mauvais
  personnage (« Et moi aussi, je te pardonne » après deux « Pardon »).
- Chaque morceau est synthétisé à part : la ligne de style de Kokoro dépend du nombre de
  phonèmes, d’où de petites variations de couleur d’un morceau à l’autre (comme en v1).

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
