# Mode dodo — la voix de Ziggy (lecteur automatique, sans IA à l’écoute)

Chaque histoire du mode dodo est **lue par Ziggy**, avec une voix de petit conteur enfant —
douce, chaleureuse, expressive — pré-enregistrée une fois pour toutes. Pendant l’écoute, le site
ne fait **aucun appel d’IA ni d’API** : il lit des fichiers statiques (MP3 + minutage des mots +
mouvements de bouche), la page allume chaque mot au moment où Ziggy le prononce, comme un
prompteur, et la bouche de Ziggy suit les sons qu’il dit.

## Ce qui est livré

```
public/dodo/voice/fr/{histoire}/title.mp3, s1.mp3 … s6.mp3, outro.mp3, timing.json
public/dodo/voice/en/{histoire}/…            (les 31 histoires, en français et en anglais)
```

- `title` = le titre, `s1`…`s6` = les 6 scènes, `outro` = la morale puis « Bonne nuit, mon petit
  cœur. Fais de beaux rêves. »
- `timing.json` (`DodoVoiceTiming` **v2**, `voice: "ziggy-v2"`, `src/lib/dodo/voice.ts`) : pour
  chaque segment, le texte exact affiché, l’instant où commence chaque mot, et `visemes`, la
  ligne de temps de la bouche (`smile`, `small`, `open`, `o`, `grin`) tirée des phonèmes
  réellement prononcés. Tout vient des durées de phonèmes calculées par le modèle lui-même : pas
  d’estimation, pas de dérive.
- MP3 mono 24 kHz VBR (≈ 47 kbit/s), volume homogène (−18 LUFS, crête ≤ −1,5 dBTP), fondus de
  20 ms.
- Total : 2 h 43, 58 Mo (voir « Chiffres » ci-dessous).

## La voix de Ziggy (v2)

Moteur : **Kokoro-82M** (Apache-2.0), exécuté hors-ligne par le moteur Rust
`voice-engine/` (mode d’emploi complet dans `voice-engine/README.md`).

- **Timbre** : un mélange de styles de voix — `ff_siwis` (la voix française de Kokoro) réchauffée
  par 30 % du timbre d’`af_heart`, la prosodie restant française ; en anglais, `af_heart` avec
  20 % du timbre de `ff_siwis`, pour que Ziggy ait la même couleur dans les deux langues.
- **Une voix d’enfant naturelle** : la hauteur est montée (×1,22) et la mélodie un peu élargie
  **à l’intérieur du réseau neuronal**, avant que son décodeur ne « chante » la phrase — pas de
  transposition après coup, donc pas d’effet « voix trafiquée ». Le conduit vocal est rendu plus
  petit (formants ×1,09) avec l’enveloppe spectrale du vocodeur WORLD appliquée en douceur sur le
  son neuronal (souffle et naturel conservés).
- **Un conteur** : lecture plus calme au début (« Il était une fois… »), un peu plus vive dans
  l’action, plus lente et plus douce à la fin de chaque scène et dans la conclusion ; pauses
  pensées (plus longues après une question, avant une révélation, avant la phrase de fin) ; les
  questions gardent leur intonation montante.
- **Des personnages reconnaissables** : les répliques entre guillemets sont dites avec une voix
  dérivée de celle de Ziggy — un peu plus aiguë pour les enfants et les petits animaux (deux
  couleurs différentes pour les deux premiers personnages), plus grave et posée pour les
  grands-parents et les anciens ; chuchotées quand le texte dit « chuchota », « murmura »,
  « souffla ». Les incises (« proposa Lili ») sont dites plus bas, comme le ferait un conteur.
- **Produit comme un livre audio** : passe-haut, chaleur, aigus adoucis, de-esser, légère
  compression 2:1, une toute petite ambiance de chambre douillette (sans écho), normalisation
  EBU R128, limiteur true-peak.
- **Plus de « robot »** : le peigne métallique et la modulation en anneau de la v1 (qui donnaient
  l’effet synthétique) sont supprimés. Ziggy est un robot-peluche par son image ; sa voix est celle
  d’un enfant doux.

Comparaison mesurée avant/après, détails de la recette et des choix : `voice-engine/README.md`.

## Chiffres (génération du 28/10/2026)

- **2 h 43 de lecture** : français 86,3 min, anglais 76,8 min (v1 : 2 h 34 ; le rythme de conteur
  ajoute des respirations et ralentit les fins de scène).
- **58 Mo** pour les deux langues : 56,9 Mo de MP3 (≈ 46,5 kbit/s en moyenne) + 1,1 Mo de
  `timing.json` (31 histoires × 8 segments × 2 langues = 496 MP3).
- Chaque segment : −18,0 à −18,1 LUFS, crête vraie ≤ −1,5 dBTP.

## Modifier une histoire ou la voix

```bash
cd voice-engine
cargo build --release
./target/release/ziggy-voice prepare                     # une fois : modèle et bibliothèques
./target/release/ziggy-voice generate --story d07        # réenregistrer une histoire
./target/release/ziggy-voice generate --skip-existing    # seulement les textes modifiés
./target/release/ziggy-voice generate --sample d07:s2 --out /tmp/essai   # écouter un segment
```

- Si un texte de `src/data/dodo` change, le test `src/lib/dodo/voice.test.ts` échoue tant que
  l’histoire n’a pas été réenregistrée (le texte du minutage doit être identique à l’écran).
- Un nom mal prononcé ? Ajoutez-le dans `voice-engine/lexicon.json` (phonèmes), puis
  réenregistrez l’histoire. `ziggy-voice generate --check` signale les mots douteux.
- Changer la couleur de la voix, les vitesses, les pauses ou le mastering : `recipe.rs`. Les
  prises brutes du modèle sont en cache : changer le filtre de voix ou le mastering ré-encode tout
  en quelques minutes ; changer la hauteur, la vitesse ou le mélange relance la synthèse.

## Licences

Kokoro-82M (hexgrad, Apache-2.0) — modèle et voix ; export ONNX onnx-community redistribué sur
npm (`kokoro-fp32a/b/c-shards`, Apache-2.0) ; voix issues de `kokoro-js` (Apache-2.0) ;
dictionnaires anglais de misaki (Apache-2.0). Voir `THIRD_PARTY_LICENSES.md`. Les outils de
fabrication (ONNX Runtime, WORLD, crates Rust, espeak-ng GPL-3.0, FFmpeg) tournent uniquement sur
la machine qui génère l’audio : ils ne sont ni inclus ni distribués avec le site.
