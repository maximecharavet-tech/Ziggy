# Mode dodo — la voix de Ziggy (lecteur automatique, sans IA à l’écoute)

Chaque histoire du mode dodo est **lue par Ziggy**, avec une petite voix d’enfant-robot douce,
pré-enregistrée une fois pour toutes. Pendant l’écoute, le site ne fait **aucun appel d’IA ni
d’API** : il lit des fichiers statiques (MP3 + minutage des mots), et la page allume chaque mot au
moment où Ziggy le prononce, comme un prompteur — l’enfant relie le son et le mot écrit.

## Ce qui est livré

```
public/dodo/voice/fr/{histoire}/title.mp3, s1.mp3 … s6.mp3, outro.mp3, timing.json
public/dodo/voice/en/{histoire}/…            (les 31 histoires, en français et en anglais)
```

- `title` = le titre, `s1`…`s6` = les 6 scènes, `outro` = la morale puis « Bonne nuit, mon petit
  cœur. Fais de beaux rêves. »
- `timing.json` (type `DodoVoiceTiming`, `src/lib/dodo/voice.ts`) : pour chaque segment, le texte
  exact affiché et l’instant (en secondes) où commence chaque mot. Les mots viennent des durées de
  phonèmes calculées par le modèle lui-même : pas d’estimation, pas de dérive d’une phrase à l’autre.
- MP3 mono 24 kHz à 40 kbit/s, volume homogène (−18 LUFS), fondus de 20 ms.
- Total : voir le rapport de génération (≈ 3 h de lecture, ~50–60 Mo pour les deux langues).

## La voix de Ziggy

Moteur : **Kokoro-82M** (licence Apache-2.0, poids et voix utilisables commercialement), exécuté
hors-ligne sur un ordinateur. Voix de départ : `ff_siwis` (français) et `af_heart` (anglais).

Recette « petit robot enfant » :
1. lecture un peu plus lente que la normale (vitesse 0,80 en français, 0,84 en anglais), réglée
   dans le modèle pour garder une intonation naturelle ;
2. voix d’enfant : hauteur ×1,30 (environ +4,5 demi-tons, ~270 Hz) et timbre « plus petit »
   (formants ×1,12), sans changer le tempo ;
3. chaleur pour le coucher : aigus adoucis, un peu de rondeur dans les graves ;
4. touche robot très légère : un léger reflet métallique (filtre en peigne de 4 ms) et un
   bourdonnement électronique à peine perceptible (modulation en anneau à −20 dB) — jamais dur.

Pauses calmes entre les phrases (0,38 s, 0,45 s après « ? » / « ! », 0,6 s après « … »).

## Modifier une histoire ou la voix

Le générateur est dans `scripts/dodo-voice/` (mode d’emploi complet dans son `README.md`) :

```bash
cd scripts/dodo-voice
.cache/venv/bin/python ziggy_voice.py --story d07              # réenregistrer une histoire
.cache/venv/bin/python ziggy_voice.py --skip-existing          # seulement les textes modifiés
```

- Si un texte de `src/data/dodo` change, le test `src/lib/dodo/voice.test.ts` échoue tant que
  l’histoire n’a pas été réenregistrée (le texte du minutage doit être identique à l’écran).
- Un nom mal prononcé ? Ajoutez-le dans `scripts/dodo-voice/lexicon.json` (phonèmes), puis
  réenregistrez l’histoire.
- Changer la couleur de la voix (hauteur, robot, volume) : constantes en haut de
  `ziggy_voice.py`. Les prises brutes du modèle sont en cache : tout se ré-encode en quelques
  minutes sans relancer la synthèse.

## Licences

Kokoro-82M (hexgrad, Apache-2.0) — modèle et voix ; export ONNX onnx-community redistribué sur
npm (`kokoro-fp32a/b/c-shards`, Apache-2.0) ; voix issues de `kokoro-js` (Apache-2.0). Voir
`THIRD_PARTY_LICENSES.md`. espeak-ng (GPL-3.0) sert uniquement d’outil local pour transformer le
texte en phonèmes au moment de la génération : il n’est ni inclus ni distribué avec le site.
