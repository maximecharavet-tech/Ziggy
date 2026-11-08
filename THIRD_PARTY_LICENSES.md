# Third-party licenses

Dependencies added during the Ziggy evolution work. (The full list of existing dependencies and
their licenses is audited in `docs/evolution/INVENTORY.md`.)

| Name | URL | License | Copyright | Version |
|---|---|---|---|---|
| three.js | https://github.com/mrdoob/three.js | MIT | © 2010–2026 three.js authors | 0.186.1 |
| @types/three (dev only) | https://github.com/DefinitelyTyped/DefinitelyTyped | MIT | © Microsoft Corporation | 0.186.0 |
| wasm-bindgen (Rust crate compiled into `src/lib/tv/wasm/`, and its generated JS glue) | https://github.com/rustwasm/wasm-bindgen | MIT OR Apache-2.0 | © The wasm-bindgen Developers | 0.2.129 |
| @mediapipe/tasks-vision (Santa photo booth: on-device person segmentation; its wasm runtime is self-hosted in `public/santa/mediapipe/wasm/` by `scripts/santa-mediapipe.mjs`) | https://github.com/google-ai-edge/mediapipe | Apache-2.0 | © Google LLC | 1.2.2 |
| MediaPipe selfie segmentation models `selfie_segmenter.tflite` (float16) and `selfie_multiclass_256x256.tflite` (float32), self-hosted in `public/santa/mediapipe/` | https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter | Apache-2.0 (per their model cards) | © Google LLC | latest (downloaded 2026-11-08) |

Platformer "Ziggy et les Étoiles Perdues" (`public/jeux/ziggy-plateforme/`, page `/monde/ziggy-plateforme`): an
original Rust game (MIT, © Ziggy) compiled to WebAssembly. All graphics are drawn procedurally in code and the sounds are
synthesised; no third-party art, music or characters. Crates compiled into `ziggy.wasm`, and the macroquad JS loader
`mq_js_bundle.js` shipped next to it:

| Name | URL | License | Version |
|---|---|---|---|
| macroquad (+ macroquad_macro, `mq_js_bundle.js`) | https://github.com/not-fl3/macroquad | MIT OR Apache-2.0 | 0.4.16 |
| miniquad | https://github.com/not-fl3/miniquad | MIT OR Apache-2.0 | 0.4.11 |
| quad-rand | https://github.com/not-fl3/quad-rand | MIT | 0.2.3 |
| glam | https://github.com/bitshifter/glam-rs | MIT OR Apache-2.0 | 0.27.0 |
| fontdue, ttf-parser | https://github.com/mooman219/fontdue, https://github.com/harfbuzz/ttf-parser | MIT OR Apache-2.0 (fontdue also Zlib) | 0.9.5 / 0.25.1 |
| image, png, fdeflate, flate2, miniz_oxide, crc32fast, color_quant, simd-adler32, adler2 | crates.io (image-rs, rust-lang) | MIT and/or Apache-2.0 | see the game's `Cargo.lock` |
| hashbrown, equivalent, allocator-api2, num-traits, libm, core_maths, cfg-if, bitflags, bytemuck, byteorder, autocfg | crates.io | MIT and/or Apache-2.0 (used under MIT) | see the game's `Cargo.lock` |
| foldhash (hasher used by hashbrown, pulled in by macroquad/fontdue) | https://github.com/orlp/foldhash | **Zlib** (permissive; owner's OK needed per the licence rule) | 0.1.5 |

TV spatial navigation (`rust/ziggy-tv-nav/`, compiled to `src/lib/tv/wasm/`, and its TypeScript twin
`src/lib/tv/spatial-nav.ts`): the direction scoring is a port of the ideas of **Norigin Spatial Navigation**
(https://github.com/NoriginMedia/Norigin-Spatial-Navigation, MIT, © 2022 NoriginMedia) — cut-off at the edge
being left, "adjacent slice" preference, `5 × main + other` weighting, container-first navigation and
last-focused-child memory. No Norigin code or package is shipped; the algorithm is re-implemented in Rust.
`wasm-bindgen-cli` 0.2.129 (MIT OR Apache-2.0) builds the glue on the developer's machine (`scripts/build-tv-nav.sh`).

Content:
- "Jingle Bells" melody (James Lord Pierpont, 1857) — public domain; arranged as a music box in `src/games3d/kit/music.ts`. Also synthesized as the photo booth clip's jingle in `src/components/santa/booth/jingle.ts`.
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

## Native apps (`apps/ziggy-app/`, Android, Android TV, iPhone, iPad)

The apps are a Tauri 2 shell in Rust around https://ziggy-ai.fr. Main components (all crates compiled into
the apps, with their licences, are listed in `apps/ziggy-app/THIRD_PARTY_CRATES.md`, generated by
`apps/ziggy-app/scripts/licenses.mjs`):

| Name | URL | License | Copyright | Version |
|---|---|---|---|---|
| Tauri (tauri, tauri-build, tauri-runtime-wry, tauri-utils, tauri-macros, tauri-codegen) | https://github.com/tauri-apps/tauri | MIT OR Apache-2.0 | © Tauri Programme within The Commons Conservancy | 2.12.5 (build 2.7.4) |
| wry (webview) and tao (windowing), with their Kotlin glue | https://github.com/tauri-apps/wry, https://github.com/tauri-apps/tao | MIT OR Apache-2.0 | © Tauri Programme within The Commons Conservancy | 0.57.1 / 0.37.2 |
| tauri-plugin-opener (opens grown-up links outside the app) | https://github.com/tauri-apps/plugins-workspace | MIT OR Apache-2.0 | © Tauri Programme within The Commons Conservancy | 2.7.2 |
| jni, ndk-context (Android: TV detection, haptics, bars) | https://github.com/jni-rs/jni-rs, https://github.com/rust-mobile/ndk-context | MIT OR Apache-2.0 | © jni-rs and rust-mobile contributors | 0.21 / 0.1 |
| objc2, objc2-foundation, objc2-ui-kit, objc2-avf-audio (iOS: audio session, haptics, status bar) | https://github.com/madsmtm/objc2 | MIT (also Zlib OR Apache-2.0) | © Mads Marquart and contributors | 0.6 / 0.3 |
| serde, serde_json | https://github.com/serde-rs | MIT OR Apache-2.0 | © Erick Tryzelaar, David Tolnay | 1.x |
| AndroidX (appcompat, activity, core, webkit, lifecycle, browser), Material Components, Kotlin standard library | https://developer.android.com/jetpack/androidx | Apache-2.0 | © The Android Open Source Project, Google, JetBrains | see `gen/android/app/build.gradle.kts` |
| Gradle wrapper (build tool, not shipped) | https://gradle.org | Apache-2.0 | © Gradle Inc. | 9.6.1 |
| @tauri-apps/cli (build tool, not shipped) | https://github.com/tauri-apps/tauri | MIT OR Apache-2.0 | © Tauri Programme within The Commons Conservancy | 2.12.4 |

Licence notes:
- Two crates of the Tauri tree are MPL-2.0 (`option-ext`, pulled by `dirs`; `cssparser`/`selectors`, pulled
  through `dom_query` by wry on Android). They are **not** shipped: `apps/ziggy-app/src-tauri/patches/` holds
  MIT re-implementations of the small APIs used (`[patch.crates-io]` in `Cargo.toml`), checked by unit tests
  and the CI. The real `cssparser`/`selectors` only run on the build machine (Tauri's build-time HTML step).
- **Needs the owner's OK:** 15 ICU4X crates (`icu_*`, `zerovec`, `yoke`, `tinystr`, `litemap`, `writeable`,
  `zerofrom`, `zerotrie`, `potential_utf`) are under the **Unicode-3.0** licence, a permissive MIT-style licence
  (no copyleft) that is not in the MIT/Apache/BSD list. They come with the `url` crate and with `urlpattern`,
  which Tauri uses to check which pages may call the app (no way to drop them without forking Tauri).
- App pictures (icons, TV banner, splash marks, store graphics) are drawn by `apps/ziggy-app/scripts/assets/`
  from the official plush pictures of `public/mascot/`; the wordmark text of the banners is rendered with the
  site's Fredoka font (SIL OFL-1.1, already used by the site); the font file itself is not in the apps.

## Les Lutins Farceurs engine (`rust/lutins-core/`, Rust → WebAssembly)

The photo analysis, prompt builder, verifier and magic-card renderer of `/lutins` are our own Rust code
(MIT), compiled to `src/lib/lutins/wasm/` (`lutins_core` for the browser, `lutins_core_full` for the Node
API routes, which adds the PNG/JPEG/WebP decoders). Every crate compiled into the WebAssembly
(`cargo metadata --filter-platform wasm32-unknown-unknown`), with the licence we use it under:

| Name | URL | License (used under) | Copyright | Version |
|---|---|---|---|---|
| wasm-bindgen, wasm-bindgen-shared | https://github.com/wasm-bindgen/wasm-bindgen | MIT OR Apache-2.0 (MIT) | © The wasm-bindgen Developers | 0.2.129 |
| serde, serde_core | https://github.com/serde-rs/serde | MIT OR Apache-2.0 (MIT) | © Erick Tryzelaar, David Tolnay | 1.0.229 |
| serde_json | https://github.com/serde-rs/json | MIT OR Apache-2.0 (MIT) | © Erick Tryzelaar, David Tolnay | 1.0.154 |
| itoa, zmij (number formatting for serde_json) | https://github.com/dtolnay/itoa, https://github.com/dtolnay/zmij | MIT OR Apache-2.0 / MIT (MIT) | © David Tolnay | 1.0.18 / 1.0.23 |
| memchr | https://github.com/BurntSushi/memchr | Unlicense OR MIT (MIT) | © Andrew Gallant | 2.8.3 |
| once_cell, cfg-if | https://github.com/matklad/once_cell, https://github.com/rust-lang/cfg-if | MIT OR Apache-2.0 (MIT) | © Aleksey Kladov; Alex Crichton | 1.21.4 / 1.0.5 |
| unicode-ident (via wasm-bindgen-shared) | https://github.com/dtolnay/unicode-ident | (MIT OR Apache-2.0) AND Unicode-3.0 | © David Tolnay; Unicode, Inc. (data tables) | 1.0.27 |
| *Node build only (`decode` feature):* | | | | |
| png | https://github.com/image-rs/image-png | MIT OR Apache-2.0 (MIT) | © The image-rs Developers | 0.18.1 |
| jpeg-decoder | https://github.com/image-rs/jpeg-decoder | MIT OR Apache-2.0 (MIT) | © The image-rs Developers | 0.3.2 |
| image-webp | https://github.com/image-rs/image-webp | MIT OR Apache-2.0 (MIT) | © The image-rs Developers | 0.2.4 |
| fdeflate, byteorder-lite | https://github.com/image-rs/fdeflate, https://github.com/image-rs/byteorder-lite | MIT OR Apache-2.0 / Unlicense OR MIT (MIT) | © The image-rs Developers | 0.3.7 / 0.1.0 |
| flate2 | https://github.com/rust-lang/flate2-rs | MIT OR Apache-2.0 (MIT) | © Alex Crichton, Josh Triplett | 1.1.11 |
| miniz_oxide | https://github.com/Frommi/miniz_oxide | MIT OR Zlib OR Apache-2.0 (MIT) | © Frommi, oyvindln | 0.8.9 / 0.9.1 |
| adler2, simd-adler32, crc32fast | https://github.com/oyvindln/adler2, https://github.com/mcountryman/simd-adler32, https://github.com/srijs/rust-crc32fast | 0BSD OR MIT OR Apache-2.0 / MIT / MIT OR Apache-2.0 (MIT) | © oyvindln; Marvin Countryman; Sam Rijs, Alex Crichton | 2.0.1 / 0.3.10 / 1.5.4 |
| bitflags, quick-error | https://github.com/bitflags/bitflags, https://github.com/tailhook/quick-error | MIT OR Apache-2.0 (MIT) | © The Rust Project Developers; Paul Colomiets | 2.13.2 / 2.0.1 |

Build-time only (procedural macros, not in the WebAssembly): serde_derive, wasm-bindgen-macro(-support),
syn, quote, proc-macro2, bumpalo, rustversion — all MIT OR Apache-2.0. Build tools: rustc/cargo and the
wasm-bindgen CLI 0.2.129 (MIT OR Apache-2.0). No GPL / AGPL / LGPL / MPL crate anywhere in the tree
(checked with `cargo tree`); `zlib-rs` (Zlib) is listed in `Cargo.lock` as an optional backend of flate2 but is
not compiled. **Owner's note:** `unicode-ident` carries Unicode-3.0 for its data tables (permissive, no
copyleft); it comes with wasm-bindgen and is already in the shipped TV navigation WebAssembly
(`src/lib/tv/wasm/`). The algorithms (SSIM, GMSD, CIEDE2000, McCamy CCT, shades of grey, Bradford,
phase correlation, frequency-tuned saliency, Hoiem et al. scale) are implemented from the papers cited in
the code; no code was copied.
