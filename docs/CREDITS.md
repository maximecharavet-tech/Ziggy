# Credits

## Dependencies and creative references

- [Motion](https://motion.dev/) — MIT License. UI animation library, imported from `motion/react`.
- [three.js](https://threejs.org/) — MIT License. Existing Santa village rendering.
- [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) — Apache-2.0. Existing on-device photo segmentation.

- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (k2-fsa) — Apache-2.0. WebAssembly speech recognition for the live Santa call on Safari / iPhone / Firefox (`public/santa/asr/`), bundling [ONNX Runtime](https://github.com/microsoft/onnxruntime) (MIT).
- [Silero VAD](https://github.com/snakers4/silero-vad) — MIT. Voice activity detection (`public/santa/asr/silero_vad.onnx`).
- [Whisper](https://github.com/openai/whisper) tiny (OpenAI) — MIT. Downloaded once on the device from the sherpa-onnx export on Hugging Face.
- [TalkingHead](https://github.com/met4citizen/TalkingHead) — MIT. Reference for the viseme approach (planned).

Motion (`motion/react`) replaces every former `framer-motion` import; `framer-motion` is no longer a direct dependency.

## Voix enregistrée du Père Noël (public/santa/voice)

336 clips (fr + en: appels guidés et programmés, message vocal, cadeaux, fiertés, âges, 24 cases de l'Avent), générés hors ligne, sur CPU et gratuitement avec `voice-engine/santa_voice_v2` (recette `santa-v2` : voix de vieil homme, intonation guidée par la ponctuation, « Ho ho ho » séparé). Seuls les MP3 sont livrés ; aucun de ces outils n'est embarqué dans le site, et aucune voix réelle n'est clonée.

- [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (hexgrad) — Apache-2.0, modèle et voix `am_santa`, `em_santa`, `ff_siwis`, `am_onyx` (mélangées : timbre et prosodie séparés) ; graphe ONNX [onnx-community/Kokoro-82M-v1.0-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) — Apache-2.0.
- [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) — MIT. Inférence ONNX de Kokoro.
- [WORLD](https://github.com/mmorise/World) (M. Morise) — BSD modifiée, via [pyworld](https://github.com/JeremyCCHsu/Python-Wrapper-for-World-Vocoder) — MIT. Hauteur, intonation, formants et vieillissement (jitter, shimmer, souffle, voix craquée, ralenti).
- [NumPy](https://numpy.org/), [SciPy](https://scipy.org/), [soundfile](https://github.com/bastibe/python-soundfile) — BSD-3-Clause ; [pyloudnorm](https://github.com/csteinmetz1/pyloudnorm) — MIT (−18 LUFS, BS.1770).
- [ONNX Runtime](https://github.com/microsoft/onnxruntime) — MIT.
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — MIT, contrôle qualité (WER) seulement.
- [eSpeak NG](https://github.com/espeak-ng/espeak-ng) et [phonemizer](https://github.com/bootphon/phonemizer) — GPL-3.0, utilisés seulement comme outils locaux de phonémisation au moment de la génération ; rien d'eSpeak n'est livré sur le site. FFmpeg/LAME : outil système d'encodage MP3, non livré.
- Recette `santa-v1` (FunDSP — MIT OR Apache-2.0, `voice-engine/ziggy-voice santa`) conservée dans le moteur Rust.
- Prénoms de l'enfant : dans la même voix santa-v2, enregistrés hors ligne (`public/santa/names`, « Bonjour … ! » et « Joyeux Noël, … ! ») pour les 2 000 prénoms français les plus donnés de 2010 à 2022 ([Fichier des prénoms de l'Insee](https://www.insee.fr/fr/statistiques/7633685), Licence Ouverte 2.0) et 800 prénoms anglais (US Social Security Administration, 1998–2008, domaine public, via [hadley/data-baby-names](https://github.com/hadley/data-baby-names)). Un prénom absent de la liste : « Bonjour à toi ! » dans la même voix, et le prénom en sous-titre. Plus de Gemini ni de voix de l'appareil dans l'appel guidé.
- Synchronisation des lèvres : [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) (Daniel S. Wolf) — MIT, exécuté hors ligne (reconnaissance phonétique) ; seules les formes de bouche (`public/santa/visemes/*.json`) sont livrées. Formes Preston Blair (A–H, X) traduites en ouverture et largeur de la bouche du Père Noël 3D ; volume de la voix pour les prénoms.

## Engines used to write this code (free)
- DeepSeek (chat gratuit) : premier jet de `voice-engine/santa_voice_v2` (santa-v2), relu, corrigé et testé à la main.
- Codex CLI (landing, Advent calendar, certificate, pricing flag), Hyper Code via local Ollama `qwen-coder-7b` (first draft of `santa-voice-utils.test.ts`, corrected by hand).

## Appel : image et Ziggy lutin

- [three.js](https://threejs.org/) — MIT : post-traitement de ses exemples (`EffectComposer`, `UnrealBloomPass`, `BokehPass` pour la profondeur de champ sur les appareils puissants, `ShaderPass` pour l'étalonnage chaud, le vignettage et le grain), poussières dorées et flammes qui vacillent ; qualité réduite automatiquement si les images ralentissent (protection Android de #25 conservée).
- Ziggy en lutin (`public/santa/art/ziggy-lutin/`, 4 poses) : images ChatGPT faites pour Ziggy, détourées par `scripts/santa-ziggy-lutin.py` (NumPy, SciPy — BSD-3-Clause ; Pillow — MIT-CMU) ; animations [Motion](https://motion.dev/) — MIT.

## Visuels du Père Noël (public/santa/art)

- Images : générées avec ChatGPT pour Ziggy (prompts : PLAN.md §7), encodées en AVIF/WebP.
- Vidéos : générées avec Grok Imagine pour Ziggy (prompts : PLAN.md §8), encodées en MP4 H.264 + WebM VP9 (ffmpeg), sans audio, avec poster WebP.
