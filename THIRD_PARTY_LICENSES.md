# Third-party licenses

Dependencies added during the Ziggy evolution work. (The full list of existing dependencies and
their licenses is audited in `docs/evolution/INVENTORY.md`.)

| Name | URL | License | Copyright | Version |
|---|---|---|---|---|
| three.js | https://github.com/mrdoob/three.js | MIT | © 2010–2026 three.js authors | 0.186.1 |
| @types/three (dev only) | https://github.com/DefinitelyTyped/DefinitelyTyped | MIT | © Microsoft Corporation | 0.186.0 |

Content:
- "Jingle Bells" melody (James Lord Pierpont, 1857) — public domain; arranged as a music box in `src/games3d/kit/music.ts`.
- Ziggy's recorded bedtime voice (`public/dodo/voice/**`, MP3 + word timings) is generated offline by
  `scripts/dodo-voice` with **Kokoro-82M** — model weights and voice styles (`ff_siwis`, `af_heart`) —
  © hexgrad, **Apache-2.0** (https://huggingface.co/hexgrad/Kokoro-82M). Used through its ONNX export
  `onnx-community/Kokoro-82M-v1.0-ONNX` (Apache-2.0) as redistributed on npm by `kokoro-fp32a-shards`,
  `kokoro-fp32b-shards`, `kokoro-fp32c-shards` 1.0.0 (Apache-2.0), and the voice files of `kokoro-js` 1.2.1
  (https://github.com/hexgrad/kokoro, Apache-2.0, © hexgrad, Xenova). Neither the model nor any of the
  tools below is shipped with the site: only the audio they produced.

Build-time tools of `scripts/dodo-voice` (run locally, not distributed, not dependencies of the app):

| Name | URL | License | Version |
|---|---|---|---|
| misaki (Kokoro's G2P) | https://github.com/hexgrad/misaki | Apache-2.0 | 0.9.4 |
| kokoro-onnx (Kokoro v1.0 vocabulary) | https://github.com/thewh1teagle/kokoro-onnx | MIT | 0.6.1 |
| onnxruntime | https://github.com/microsoft/onnxruntime | MIT | 1.31.1 |
| onnx | https://github.com/onnx/onnx | Apache-2.0 | 1.23.2 |
| spaCy (blank English tokenizer) | https://github.com/explosion/spaCy | MIT | 3.8.18 |
| num2words | https://github.com/savoirfairelinux/num2words | LGPL-2.1 | 0.5.14 |
| numpy, soundfile | https://numpy.org, https://github.com/bastibe/python-soundfile | BSD-3-Clause | 2.4.6, 0.14.0 |
| espeak-ng (phonemes), via phonemizer and espeakng-loader | https://github.com/espeak-ng/espeak-ng | GPL-3.0 (phonemizer GPL-3.0, espeakng-loader MIT) | 1.52 / 3.4.0 / 0.2.4 |
| FFmpeg with librubberband, libmp3lame | https://ffmpeg.org | GPL-2.0+ / LGPL | system |

espeak-ng and the other GPL tools are only used on the build machine to *produce* the audio; their code is
not linked into nor distributed with the site, so the site's license is unaffected.
- All 3D models, textures and sounds of the 3D games are made in code in this repository (no third-party asset).
