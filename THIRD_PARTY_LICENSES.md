# Third-party licenses

Dependencies added during the Ziggy evolution work. (The full list of existing dependencies and
their licenses is audited in `docs/evolution/INVENTORY.md`.)

| Name | URL | License | Copyright | Version |
|---|---|---|---|---|
| three.js | https://github.com/mrdoob/three.js | MIT | © 2010–2026 three.js authors | 0.186.1 |
| @types/three (dev only) | https://github.com/DefinitelyTyped/DefinitelyTyped | MIT | © Microsoft Corporation | 0.186.0 |

Content:
- "Jingle Bells" melody (James Lord Pierpont, 1857) — public domain; arranged as a music box in `src/games3d/kit/music.ts`.
- Ziggy's recorded bedtime voice (`public/dodo/voice/**`, MP3 + word timings + visemes) is generated offline by
  the Rust voice engine `voice-engine/` (ziggy-voice v2) with **Kokoro-82M** — model weights and voice styles
  (`ff_siwis`, `af_heart`, `af_sky`, `bf_lily`, `af_bella`, blended) — © hexgrad, **Apache-2.0**
  (https://huggingface.co/hexgrad/Kokoro-82M). Used through its ONNX export `onnx-community/Kokoro-82M-v1.0-ONNX`
  (Apache-2.0) as redistributed on npm by `kokoro-fp32a-shards`, `kokoro-fp32b-shards`, `kokoro-fp32c-shards` 1.0.0
  (Apache-2.0), and the voice files of `kokoro-js` 1.2.1 (https://github.com/hexgrad/kokoro, Apache-2.0, © hexgrad,
  Xenova). English pronunciations come from the dictionaries of **misaki** 0.9.4 (https://github.com/hexgrad/misaki,
  Apache-2.0). Neither the model nor any of the tools below is shipped with the site: only the audio they produced.

Build-time tools of `voice-engine/` (run locally, not distributed, not dependencies of the app):

| Name | URL | License | Version |
|---|---|---|---|
| ONNX Runtime (shared library from the PyPI wheel) | https://github.com/microsoft/onnxruntime | MIT | 1.31.1 |
| ort, ort-sys (Rust bindings) | https://github.com/pykeio/ort | MIT OR Apache-2.0 | 2.0.0-rc.15 |
| WORLD vocoder (bundled by rsworld-sys) | https://github.com/mmorise/World | BSD-3-Clause (modified BSD), © M. Morise | as bundled |
| rsworld, rsworld-sys | https://github.com/BiggieBoo18/Rust-WORLD | MIT | 0.1.0 |
| rustfft | https://github.com/ejmahler/RustFFT | MIT OR Apache-2.0 | 6.4.1 |
| realfft | https://github.com/HEnquist/realfft | MIT | 3.5.1 |
| ebur128 (EBU R128 loudness, true peak) | https://github.com/sdroege/ebur128 | MIT | 0.1.11 |
| hound (WAV) | https://github.com/ruuda/hound | Apache-2.0 | 3.5.1 |
| serde, serde_json, clap, anyhow, regex, rayon, sha2, flate2, tar, unicode-normalization | crates.io | MIT OR Apache-2.0 (unicode-normalization also Unicode-3.0) | see `voice-engine/Cargo.lock` |
| zip | https://github.com/zip-rs/zip2 | MIT | 2.6.1 |
| libloading (loads espeak-ng) | https://github.com/nagisa/rust_libloading | ISC | 0.8.9 |
| espeak-ng (French phonemes, English fallback), from the espeakng-loader wheel | https://github.com/espeak-ng/espeak-ng | GPL-3.0 (espeakng-loader MIT) | 1.52 / 0.2.4 |
| Node.js + esbuild (reads the TypeScript stories) | https://esbuild.github.io | MIT | repo's |
| FFmpeg with libmp3lame (MP3 encoding) | https://ffmpeg.org | LGPL-2.1+ / GPL-2.0+ | system |

espeak-ng and FFmpeg are only used on the build machine to *produce* the audio; their code is not linked into
nor distributed with the site, so the site's license is unaffected.
- All 3D models, textures and sounds of the 3D games are made in code in this repository (no third-party asset).
