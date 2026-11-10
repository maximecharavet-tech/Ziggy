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

## Engines used to write this code (free)
- Codex CLI (landing, Advent calendar, certificate, pricing flag), Hyper Code via local Ollama `qwen-coder-7b` (first draft of `santa-voice-utils.test.ts`, corrected by hand).
