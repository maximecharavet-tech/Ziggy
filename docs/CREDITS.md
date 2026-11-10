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
- Prénoms de l'enfant : toujours dits en direct (`/api/santa/voice`, Gemini) puis par la voix de l'appareil en dernier recours.

## Engines used to write this code (free)
- DeepSeek (chat gratuit) : premier jet de `voice-engine/santa_voice_v2` (santa-v2), relu, corrigé et testé à la main.
- Codex CLI (landing, Advent calendar, certificate, pricing flag), Hyper Code via local Ollama `qwen-coder-7b` (first draft of `santa-voice-utils.test.ts`, corrected by hand).

## Visuels du Père Noël (public/santa/art)

- Images : générées avec ChatGPT pour Ziggy (prompts : PLAN.md §7), encodées en AVIF/WebP.
- Vidéos : générées avec Grok Imagine pour Ziggy (prompts : PLAN.md §8), encodées en MP4 H.264 + WebM VP9 (ffmpeg), sans audio, avec poster WebP.
