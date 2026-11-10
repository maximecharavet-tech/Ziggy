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

336 clips (fr + en: appels guidés et programmés, message vocal, cadeaux, fiertés, âges, 24 cases de l'Avent), générés hors ligne et gratuitement avec le Ziggy Voice Engine (`voice-engine/ziggy-voice`, `ziggy-voice santa`, recette `santa-v1`).

- [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (hexgrad) — Apache-2.0, modèle et voix `am_santa`, `em_santa`, `ff_siwis` ; graphe ONNX [onnx-community/Kokoro-82M-v1.0-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) — Apache-2.0.
- [FunDSP](https://github.com/SamiPerttu/fundsp) — MIT OR Apache-2.0. Couleur « Père Noël » (égaliseurs, saturation douce).
- [ONNX Runtime](https://github.com/microsoft/onnxruntime) — MIT.
- [eSpeak NG](https://github.com/espeak-ng/espeak-ng) — GPL-3.0, utilisé seulement comme outil local de phonémisation au moment de la génération ; rien d'eSpeak n'est livré sur le site.
- Prénoms de l'enfant : toujours dits en direct (`/api/santa/voice`, Gemini) puis par la voix de l'appareil en dernier recours.

## Engines used to write this code (free)
- Codex CLI (landing, Advent calendar, certificate, pricing flag), Hyper Code via local Ollama `qwen-coder-7b` (first draft of `santa-voice-utils.test.ts`, corrected by hand).

## Visuels du Père Noël (public/santa/art)

- Images : générées avec ChatGPT pour Ziggy (prompts : PLAN.md §7), encodées en AVIF/WebP.
- Vidéos : générées avec Grok Imagine pour Ziggy (prompts : PLAN.md §8), encodées en MP4 H.264 + WebM VP9 (ffmpeg), sans audio, avec poster WebP.
