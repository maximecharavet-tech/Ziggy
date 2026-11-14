# 02 — Runtime and pipeline: running a realistic voice fast, on-device and in real time

Research report for the Ziggy voice app inside Hyper Engine (`src/lib/hyper-engine`).
Scope: the engineering stack *around* the TTS model — inference runtimes, codecs and
vocoders, the text front-end (normalisation and G2P without GPL espeak), streaming, word
timings and visemes, audio post-processing, and the architecture that ties them together.
Model choice (which voice model sounds best) is covered by reports 01, 03 and 04.

Date: 2026-11-14. Every claim has a source. **"Inspiration only"** marks things whose licence
rules them out of anything we ship or run, but which are worth studying.

**Method.** Repositories were read through raw GitHub (READMEs, licence files, and two
shallow clones: `k2-fsa/sherpa-onnx` (sparse) and `software-mansion-labs/phonemis` +
`Verbalis`). Model cards were read through the Hugging Face Hub API. Two benchmarks ran on
this sandbox (4 vCPU Intel Xeon, AVX-512 VNNI + AMX, shared). The WebFetch tool could not
reach `k2-fsa.github.io`, `developers.google.com`, `cdn.jsdelivr.net` or `huggingface.co` web
pages from this session, so a few facts come from search-result summaries; these are marked
"(search summary)". All clones and model files were deleted afterwards.

---

## 0. Top findings

1. **sherpa-onnx 2.0 (released 2026-10-23) dropped espeak-ng entirely.** Its Kokoro, Kitten,
   Pocket TTS and Supertonic front-ends now take a lexicon file or caller-supplied phoneme
   code points (`GenerationConfig.phoneme_codepoints`); unknown words are *skipped*, not
   guessed. That makes sherpa-onnx (Apache-2.0, Android/iOS/HarmonyOS/WASM/desktop, Rust and
   12 other bindings) the first full cross-platform runtime with no GPL in it. It also means
   **we must bring our own G2P**, especially for French
   ([config source](https://github.com/k2-fsa/sherpa-onnx/blob/master/sherpa-onnx/csrc/offline-tts-kokoro-model-config.cc),
   [PyPI release dates](https://pypi.org/project/sherpa-onnx/#history)).
2. **The real bottleneck is a permissive French G2P, not the runtime.** misaki has no
   French (it falls back to espeak) ([misaki](https://github.com/hexgrad/misaki)). The only new
   MIT option, **Phonemis** (Software Mansion, 2026), phonemizes French word by word with a
   7 MB neural model *distilled from espeak-ng output* and has no liaison handling
   ([Phonemis notices](https://github.com/software-mansion-labs/phonemis/blob/main/THIRD_PARTY_NOTICES.md)).
   Piper went the other way: it became **GPL-3.0** (`piper1-gpl`) to embed espeak-ng
   ([piper1-gpl releases](https://github.com/OHF-Voice/piper1-gpl/releases)).
3. **Measured here: Kokoro-82M is only about real time on this 4-core CPU.** Via sherpa-onnx
   2.0.1 with the int8 model, the real-time factor (RTF = compute time ÷ audio time) was 0.72–0.95
   on 4 threads and about 1.0 on 2 threads. The first chunk took 1.0–2.7 s. Pocket TTS int8 ran at
   RTF 0.50–0.56 on 2 threads. A third-party Android benchmark also puts Kokoro above real time
   on phones (RTF 1.1–2.4) ([voiceping eval](https://voiceping-landingpage-prod.pages.dev/en/blog/research-offline-tts-eval/), search summary).
   **Live on-device narration of long stories is not dependable on children's devices.
   Offline pre-generation stays the main path.**
4. **Browser inference is now viable but heavy.** onnxruntime-web 1.31.1 (MIT) has WebGPU.
   Safari 26 ships WebGPU, and Android WebView got WebGPU compatibility mode in Chrome 146.
   Kokoro fp32 is still about 325 MB to download, and int8 hurts its iSTFTNet vocoder
   ([web.dev](https://web.dev/blog/webgpu-supported-major-browsers),
   [blink intent](https://groups.google.com/a/chromium.org/g/blink-dev/c/N3RlLGCOTJ4/m/loneRTlPBwAJ),
   [kokoro-onnx releases](https://github.com/thewh1teagle/kokoro-onnx/releases)).
   `kokoro-js` bundles GPL espeak through `phonemizer`, and `@huggingface/transformers` 4.3.2
   still hard-depends on `sharp` (LGPL libvips) and `onnxruntime-node`, so neither can ship
   ([prior audit](../huggingface/REPORT.md), npm registry).
5. **Lip-sync and karaoke need no new model.** The engine already gets exact phoneme durations
   from the patched Kokoro graph. For audio without phonemes there are MIT options:
   **HeadAudio** (an audio-worklet viseme detector in the browser) and **Rhubarb** (offline,
   already used for Santa). For forced alignment, **Qwen3-ForcedAligner-0.6B** (Apache-2.0)
   covers French. NVIDIA Audio2Face-3D has an MIT SDK, but its models use the NVIDIA Open Model
   License and need a GPU
   ([HeadAudio](https://github.com/met4citizen/HeadAudio),
   [Rhubarb licence](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/master/LICENSE.md),
   [Qwen3-ForcedAligner](https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B),
   [Audio2Face-3D card](https://huggingface.co/nvidia/Audio2Face-3D-v3.0)).

Also notable: the site's live voice today is **Gemini TTS via `/api/tts`**
(`src/lib/tts-gemini.ts`). That sends the text Ziggy speaks to Google; the browser's
`speechSynthesis` is the fallback (`src/lib/voice.ts`). No child voice is sent, but the lines
can carry a child's first name or answers. Replacing this path is the clearest privacy win the
voice app can deliver (section 10).

---

## 1. What exists today (baseline)

| Piece | Today | Where |
|---|---|---|
| Offline narrator | Rust engine around Kokoro-82M fp32 (ONNX Runtime 1.31 via `ort` 2.0-rc.15). Graph patched to expose durations and to inject durations, F0 and energy. Two passes (pruned predictor graph ≈0.2 s, full graph ≈3.3 s per call). WORLD formant filter, Rust mastering (EBU R128 −18 LUFS, true-peak limiter), word timings and visemes from the real phoneme durations | `voice-engine/README.md` |
| G2P | fr: espeak-ng via FFI (GPL-3.0, **build machine only**) with a Rust port of phonemizer + misaki post-processing. en: Rust port of misaki (Apache) with espeak fallback. `lexicon.json` for fixes | `voice-engine/README.md` §3 |
| Throughput | "≈1.3× real time per process", 2 h 53 min of audio in ≈70 min on 4 cores (two processes) | `voice-engine/README.md` |
| Output | MP3 mono 24 kHz VBR q5 (≈47 kbit/s), `timing.json` v2 (words + visemes) | `docs/DODO_VOICE.md` |
| Santa | Kokoro + Python WORLD ageing chain; first names pre-recorded (2,000 FR + 800 EN); Rhubarb visemes | `voice-engine/README.md` (Santa) |
| Live voice on the site | `/api/tts` → Gemini 2.5 TTS (`Puck`, `Algenib`); fallback `speechSynthesis` with pitch 1.35 | `src/lib/voice.ts`, `src/lib/tts-gemini.ts` |
| Native app | Tauri 2.12 (Rust); no audio inference yet | `apps/ziggy-app/src-tauri/Cargo.toml` |
| Static audio already shipped | `public/dodo` 297 MB, `public/santa` 138 MB; service worker `ziggy-v7` caches it | `public/sw.js` |

The current engine is already ahead of most open-source stacks on control: no public runtime
exposes Kokoro's durations, F0 and energy as inputs, as `onnx_patch.rs` does. The ExecuTorch
port is the one similar case: it splits Kokoro into `predict` and `vocode` for the same reason,
because the duration output sets the shape of the vocoder input
([Kokoro-82M-ExecuTorch card](https://huggingface.co/mlboydaisuke/Kokoro-82M-ExecuTorch)).
Whatever runtime we choose for on-device use should keep this two-stage split, so the v3
storyteller prosody (`intonation.rs` / `contour.rs`) can run live too.

---

## 2. Inference runtimes (2025–2026)

### 2.1 Comparison

| Runtime | Platforms | TTS models it runs today | Speed evidence | Licence | Verdict for Ziggy |
|---|---|---|---|---|---|
| **ONNX Runtime** native 1.32 (PyPI) / 1.31 (in repo) | Linux, macOS, Windows, Android, iOS | Anything exported to ONNX (Kokoro, Kitten, Supertonic, Pocket, NeuCodec decoder…) | Our engine: ≈1.3× real time per process, fp32, 2 passes | MIT | **Keep** for the build machine. Ship inside the Tauri app via `ort` (load-dynamic). Telemetry must be disabled (`ORT_DISABLE_TELEMETRY=1`, see repo lesson) |
| **onnxruntime-web** 1.31.1 (2026-10-26) | Browsers: WASM SIMD+threads, WebGPU, WebNN | Same ONNX graphs | Vendor blog: Kokoro WebGPU ≈1.5–2× real time on M4; WASM ≈0.8–1× ([offlinetts](https://offlinetts.com/blog/browser-tts-showdown-kokoro-piper-kitten/), search summary) | MIT ([npm](https://www.npmjs.com/package/onnxruntime-web)) | **Best browser path.** Use it directly with our own pre/post code (already the repo rule) |
| **Transformers.js** v4 (4.3.2, 2026-10-27) | Browser, Node, Deno | Kokoro (via kokoro-js), Supertonic, Kitten… | v4 rewrote the WebGPU runtime in C++ with the ORT team; WebGPU for Safari 26+ in 4.3 ([HF blog](https://huggingface.co/blog/transformersjs-v4), [4.3.0 notes](https://newreleases.io/project/github/huggingface/transformers.js/release/4.3.0)) | Apache-2.0, **but** depends on `sharp` (LGPL libvips) + `onnxruntime-node` (npm metadata) | Study only; do not add as a dependency |
| **kokoro-js** 1.2.1 | Browser | Kokoro | — | Apache-2.0 **but** `phonemizer@1.2.1` bundles GPL espeak-ng WASM ([prior audit](../huggingface/REPORT.md)) | **No** |
| **sherpa-onnx** 2.0.1 (2026-10-27) | Android, iOS, HarmonyOS, Linux/macOS/Windows, RPi/RK3588, **WASM** (npm `sherpa-onnx` 2.0.1); C, C++, Python, JS, Java, Kotlin, Swift, Go, Dart, C#, **Rust**, Pascal | Kokoro, Kitten, Pocket TTS, Supertonic, Matcha, VITS/Piper, ZipVoice | **Measured here** (2.2): Kokoro int8 RTF 0.72–0.95 (4 threads); Pocket int8 RTF 0.50 (2 threads). Third-party Android: Kokoro RTF 1.13 (en v0.19) / 2.42 (int8 multi-lang v1.1); iOS RTF 0.62 (search summary, [voiceping](https://voiceping-landingpage-prod.pages.dev/en/blog/research-offline-tts-eval/)) | Apache-2.0; **espeak-free since 2.0.0** ([source](https://github.com/k2-fsa/sherpa-onnx/blob/master/sherpa-onnx/csrc/offline-tts-kokoro-model-config.cc)) | **Strong candidate** for a turnkey on-device runtime (app and web). Loses our graph patch (stock Kokoro graph only) |
| **ort** (Rust) 2.0-rc.13+ | Native; `ort-web` (WASM/WebNN EPs); alternative backends `ort-tract`, `ort-candle` | Any ONNX | — | MIT/Apache-2.0 ([rc.10 notes](https://newreleases.io/project/github/pykeio/ort/release/v2.0.0-rc.10), [rc.11 notes](https://newreleases.io/project/github/pykeio/ort/release/v2.0.0-rc.11)) | **Already used.** The same Rust engine could compile into the Tauri app. `ort-tract` (pure Rust) is an option where shipping libonnxruntime is awkward |
| **Kokoros** (Rust) | Native; WASM is "a goal" | Kokoro | Streaming HTTP with "1–2 s time-to-first-audio" (README, 2025-07) | Apache-2.0 **but** its phonemizer is espeak-ng based (README changelog 2025-01) ([README](https://github.com/lucasjinreal/Kokoros)) | Inspiration (chunking, style mixing) |
| **candle** (HF, Rust) | Native, WASM, Metal/CUDA | Pocket TTS port (`babybirdprd/pocket-tts`), `any-tts` (Kokoro on candle, pure-Rust phonemizer, "parity tuning ongoing") | — | MIT/Apache-2.0 ([any-tts](https://github.com/TM9657/any-tts)) | Watch. A NobodyWho post (Aug 2026) says candle's accelerator coverage "isn't yet where they need it" ([post](https://nobodywho.ooo/posts/announcing-stt-tts/)) |
| **xn / xn-ptts** (Kyutai/Gradium, Rust) | Native, **WASM** (`ptts-wasm`) | Pocket TTS (official Rust binary) | Pocket TTS: "~6× real time on a MacBook Air M4", 2 cores, ~200 ms first chunk ([README](https://github.com/kyutai-labs/pocket-tts)) | MIT (code) | Inspiration for streaming design; model licence is the blocker (section 3) |
| **burn** (Rust) | Native, WASM, WebGPU | Voxtral TTS port with Q4 GGUF in WASM (search summary) | — | MIT/Apache-2.0 | Watch |
| **ggml / llama.cpp** family | CPU, Metal, Vulkan | llama.cpp `tools/tts` (OuteTTS + WavTokenizer); **TTS.cpp** (Kokoro, Parler, Dia, Orpheus); NeuTTS GGUF; Kitten-TTS-2 llama.cpp fork | TTS.cpp: best RTF 1.11 on M1 Max (Parler, Q5_0); "only currently supported on OS X"; optional espeak-ng phonemization ([TTS.cpp](https://github.com/mmwillet/TTS.cpp)) | MIT | Fits LLM-style TTS (codec-token models); not needed for Kokoro |
| **MLX / mlx-audio** | Apple Silicon only | Kokoro, Pocket (`pocket-tts-mlx`) and others | Core ML port claims 30 s of speech in 379 ms on a Mac Studio, "2× faster than MLX" (vendor claim) ([kokoro-coreml](https://huggingface.co/mattmireles/kokoro-coreml)) | MIT | Only useful if we bake on a Mac |
| **ExecuTorch** (Meta) | Android, iOS (XNNPACK, Core ML, Vulkan…) | Kokoro `.pte` (325 MB fp32, `predict` + `vocode`); react-native-executorch Kokoro (9 languages incl. fr, with its own C++ phonemizer = Phonemis) | — | Apache-2.0 weights (ExecuTorch runtime licence not checked here) ([card](https://huggingface.co/software-mansion/Kokoro-82M-ExecuTorch), [docs](https://docs.swmansion.com/react-native-executorch/docs/extensions/text-to-speech)) | Not for Tauri (React Native oriented); the two-method split is the useful idea |
| **LiteRT / MediaPipe TTS task** (Google AI Edge) | Android, iOS, web, Python | Kokoro-82M packaged as `kokoro_int8_gpu.litertlm` | Pocket-TTS-LiteRT: "~1× real time on a Pixel 8a" GPU ([README](https://github.com/kyutai-labs/pocket-tts)) | Runtime licence not verified (page unreachable; [MediaPipe TTS](https://developers.google.com/edge/mediapipe/solutions/audio/text_to_speech), search summary) | Interesting for Android GPU. Phonemizer inside the bundle unknown (could not verify) |
| **Web Speech API** (`speechSynthesis`) | Every browser and WebView | OS voices | Instant | OS-provided | Keep as the last fallback only: quality and voices vary by device |

### 2.2 Benchmark on this sandbox (4 vCPU Xeon, AVX-512 VNNI/AMX, shared VM)

sherpa-onnx 2.0.1 (PyPI), onnxruntime 1.32.0, `kokoro-int8-multi-lang-v1_0` (114 MB int8
model, 54 voices), best of 3 runs after warm-up. French was fed as hand-written espeak-style
IPA through `phoneme_codepoints`, as our own G2P would. English went through the bundled
lexicon. Scripts `bench_kokoro.py` / `bench_pocket.py` are kept in the session scratchpad; models and wavs were deleted.

| Model | Threads | Text | Audio | Compute | RTF | First chunk* |
|---|---|---|---|---|---|---|
| Kokoro int8 (`af_heart`) | 1 | EN short (1 sentence) | 2.60 s | 3.93 s | 1.51 | 1.61 s |
| | 1 | EN paragraph | 16.04 s | 20.84 s | 1.30 | 4.19 s |
| | 1 | FR 2 sentences (`ff_siwis`) | 8.45 s | 10.13 s | 1.20 | 3.73 s |
| | 2 | EN short | 2.60 s | 2.77 s | 1.07 | 1.14 s |
| | 2 | EN paragraph | 16.04 s | 16.01 s | 1.00 | 3.15 s |
| | 2 | FR 2 sentences | 8.45 s | 7.43 s | 0.88 | 2.60 s |
| | 4 | EN short | 2.60 s | 2.47 s | 0.95 | 1.04 s |
| | 4 | EN paragraph | 16.05 s | 13.54 s | 0.84 | 2.73 s |
| | 4 | FR 2 sentences | 8.45 s | 6.10 s | 0.72 | 2.17 s |
| Pocket TTS int8 (voice cloned from `bria.wav`) | 2 | EN short | 2.86 s | 1.60 s | 0.56 | 1.44 s |
| | 2 | EN paragraph | 11.57 s | 5.82 s | 0.50 | 2.36 s |
| | 4 | EN short | 2.58 s | 2.01 s | 0.78 | 1.90 s |
| | 4 | EN paragraph | 11.90 s | 8.48 s | 0.71 | 3.67 s |

\*First chunk = time to the first sentence callback (sherpa-onnx synthesises sentence by
sentence). For Pocket TTS it includes encoding the reference voice.

What this shows:
- **Kokoro on a shared 4-vCPU server is only about real time.** A phone's big cores are
  comparable or slower, which matches the third-party Android RTF of 1.1–2.4. A one-sentence
  game line costs about 1–1.6 s before the first sound. That works if we start it before the
  line is needed (pre-fetch), not as an instant reply.
- **The int8 model gave no clear speed-up on this CPU.** The repo's own fp32 two-pass engine
  reports a similar ≈1.3× real time. Dynamic int8 quantises only `Linear` layers, and Kokoro is
  66.9 % Conv1d by weights, so most of the graph stays fp32 anyway
  ([ExecuTorch card notes](https://huggingface.co/mlboydaisuke/Kokoro-82M-ExecuTorch), search summary).
  Quality loss shows in the spectrum: int8 has spectral correlation 0.916 against fp32, fp16 has
  0.999 ([kokoro-onnx releases](https://github.com/thewh1teagle/kokoro-onnx/releases), search summary).
  A 2026 PTQ study finds int8 on MatMuls with fp32 convolutions keeps quality
  ([arXiv 2609.28974](https://arxiv.org/pdf/2609.28974), search summary). **For on-device use,
  ship fp16 weights, or int8 MatMul with fp32 vocoder convolutions, and A/B test by ear.**
- **sherpa-onnx's English lexicon has no morphology.** "lived" and "Ziggy" were *skipped*
  (OOV warnings in the log). sherpa-onnx is a model runner, not a front-end: our Rust G2P
  (misaki port) must produce the phonemes.
- **Pocket TTS is about 2× faster than Kokoro** on the same box (2 threads beat 4: a small,
  latency-bound model). Its licence is the blocker, not its speed (section 3).

---

## 3. Small on-device-class TTS models (runtime view only)

| Model | Size | FR / EN / AR | Runtime fit | Code / weights licence | Status for Ziggy |
|---|---|---|---|---|---|
| **Kokoro-82M v1.0** | 82M; fp32 ≈325 MB | 1 FR voice (`ff_siwis`), many EN, no AR | ONNX everywhere, ExecuTorch, LiteRT, Core ML, MLX | Apache-2.0 / Apache-2.0 ([card](https://huggingface.co/hexgrad/Kokoro-82M)) | **In production** (offline). Live use needs our G2P |
| **Kitten TTS 2 nano / pico / mini** (released 2026-11-13) | 17M (17.4 MB int8 per language) / 7.2M (8 MB) / 82M | nano/pico: en de es it pt ru hi **fr**; mini: 16 languages incl. **fr** (no ar) | int8 ONNX on CPU | Apache-2.0 / **Apache-2.0** (HF tags, [nano](https://huggingface.co/KittenML/kitten-tts-2-nano), [mini](https://huggingface.co/KittenML/kitten-tts-2-mini)) | **Test candidate** for tiny on-device FR. Its French G2P is espeak-ng at runtime ([docs](https://github.com/KittenML/KittenTTS/blob/main/docs/kitten-tts-2-tiny.md)), so we would feed our own phonemes. Too new to judge quality |
| Kitten TTS 2 (1.7B, 1-bit) | 492–954 MB | 20 languages incl. fr, ar | llama.cpp fork | Apache-2.0 / **Stellon Labs Community License** ([README](https://github.com/KittenML/KittenTTS)) | Inspiration only |
| **Pocket TTS** (Kyutai, Jan 2026; updates to Oct 2026) | 100M; English variants down to 1.9M | en fr de pt it es nl | Rust/WASM (xn), ONNX (sherpa-onnx, ORT-web), candle, MLX, LiteRT, C++ | MIT / **CC-BY-4.0, gated** ([card](https://huggingface.co/kyutai/pocket-tts)). sherpa's ONNX export README says "for non-commercial" (conflicting). Voices have per-voice licences (some come from NC sets like Expresso/EARS, [prior audit](../huggingface/REPORT.md)) | Inspiration / owner decision. Voice comes from **cloning a reference clip**, which needs a cleared voice. CC-BY is not on the allowed list |
| Supertonic 3 (Apr 2026) | ~99M ONNX | 31 languages incl. fr, **ar** | ORT native/web, WebGPU | MIT? (code) / **OpenRAIL** ([card](https://huggingface.co/supertone-oss-archive/supertonic-3)); repo **archived** 2026 ([README](https://github.com/supertone-oss-archive/supertonic)) | Inspiration only (the speed recipe, expression tags) |
| NeuTTS Air / Nano | 748M / 229M (GGUF Q4/Q8) | Air: en; Nano: en, **fr**, de, es | llama.cpp + NeuCodec ONNX decoder | Air: Apache-2.0; Nano family: **NeuTTS Open License 1.0** ([README](https://github.com/neuphonic/neutts-air)) | Air: English only. Nano-French: not allowed |
| Chatterbox Nano / Turbo / Multilingual V3 | 110M / 350M / 500M | Nano, Turbo: en; ML V3: 23+ incl. **fr, ar** | PyTorch; Nano "3× real time on 8 CPU cores" | MIT / MIT ([README](https://github.com/resemble-ai/chatterbox), [card](https://huggingface.co/ResembleAI/chatterbox)); repo now an unsupported archive | Offline-bake candidate (zero-shot from our *own synthetic* Ziggy reference). Output carries the Perth watermark |
| Piper (VITS) | 15–60 MB | many | ONNX, sherpa-onnx, WASM | `piper1-gpl` is **GPL-3.0** since v1.3.0; old `rhasspy/piper` (MIT) archived 2025-10-06 ([releases](https://github.com/OHF-Voice/piper1-gpl/releases), search summary) | No (GPL runtime; voices vary) |
| Qwen3-TTS 0.6B/1.7B, VoxCPM2 2.3B, CosyVoice2 0.5B | 0.9–2.3B | fr (Qwen, Cosy), fr+ar (VoxCPM2) | GPU-class, offline bake | Apache-2.0 ([Qwen3-TTS](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base), [VoxCPM2](https://huggingface.co/openbmb/VoxCPM2), [CosyVoice2](https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B)) | Offline-bake engines (see reports 01/04). Not on-device |

---

## 4. Neural audio codecs and vocoders

Modern "LLM-style" TTS (Qwen3-TTS, OuteTTS, NeuTTS, Orpheus, Llasa, Kyutai) predicts codec
tokens, then a codec decoder makes the waveform. Kokoro/StyleTTS2 instead uses an
**iSTFTNet** decoder ([nvidia Kokoro card](https://huggingface.co/nvidia/kokoro-82M-onnx-opt)).
The codec decoder's licence matters as much as the LM's.

| Codec / vocoder | Params | Used by | Licence (weights) | OK to ship? |
|---|---|---|---|---|
| iSTFTNet (inside Kokoro) | part of 82M | Kokoro, StyleTTS2 | Kokoro Apache-2.0; StyleTTS2 code MIT ([LICENSE](https://github.com/yl4579/StyleTTS2/blob/main/LICENSE)); reference iSTFTNet impl. Apache-2.0 ([LICENSE](https://github.com/rishikksh20/iSTFTNet-pytorch/blob/master/LICENSE)) | Yes |
| HiFi-GAN | — | VITS/Piper, many | MIT ([LICENSE](https://github.com/jik876/hifi-gan/blob/master/LICENSE)) | Yes |
| Vocos (mel 24 kHz) | — | F5-TTS and others | MIT ([card](https://huggingface.co/charactr/vocos-mel-24khz), [repo](https://github.com/gemelo-ai/vocos)) | Yes |
| BigVGAN v2 (24 kHz, 100 band) | — | F5-TTS, DMOSpeech2… | MIT ([card](https://huggingface.co/nvidia/bigvgan_v2_24khz_100band_256x), [LICENSE](https://github.com/NVIDIA/BigVGAN/blob/main/LICENSE)) | Yes (heavier, GPU-friendly) |
| SNAC 24 kHz | — | Orpheus, maya1 | MIT ([card](https://huggingface.co/hubertsiuzdak/snac_24khz), [LICENSE](https://github.com/hubertsiuzdak/snac/blob/main/LICENSE)) | Yes |
| DAC 24 kHz | 74.7M | Parler-TTS (DAC decoder in TTS.cpp) | MIT incl. weights ([README](https://github.com/descriptinc/descript-audio-codec)) | Yes |
| EnCodec 24 kHz | 23.3M | MusicGen, MetaVoice | Code MIT ([README](https://github.com/facebookresearch/encodec)); HF card has no licence tag | Verify the weights before use |
| WavTokenizer | — | OuteTTS (llama.cpp tts) | MIT ([card](https://huggingface.co/novateur/WavTokenizer-large-speech-75token)) | Yes |
| NeuCodec | 630M (enc+dec); ONNX decoder, int8 version | NeuTTS | Apache-2.0, gated ([card](https://huggingface.co/neuphonic/neucodec)) | Yes |
| Qwen3-TTS-Tokenizer-12Hz | 170.6M | Qwen3-TTS | Apache-2.0 ([card](https://huggingface.co/Qwen/Qwen3-TTS-Tokenizer-12Hz)) | Yes |
| MiMo-Audio-Tokenizer | 1.3B | MiMo-Audio | MIT ([card](https://huggingface.co/XiaomiMiMo/MiMo-Audio-Tokenizer)) | Yes (large) |
| FocalCodec 50 Hz | 142M (WavLM-based) | research | Apache-2.0 ([card](https://huggingface.co/lucadellalib/focalcodec_50hz)) | Yes |
| Mimi (Kyutai) | 96.2M, 12.5 Hz | Moshi, Kyutai TTS, Sesame CSM, Dia2 | **CC-BY-4.0** ([card](https://huggingface.co/kyutai/mimi)) | Owner decision (attribution licence, not on the list) |
| X-codec2 | 822.7M | Llasa | **CC-BY-NC-4.0** ([card](https://huggingface.co/HKUSTAudio/xcodec2)) | No (inspiration only) |
| BiCodec | part of Spark-TTS | Spark-TTS | **CC-BY-NC-SA-4.0** ([card](https://huggingface.co/SparkAudio/Spark-TTS-0.5B)) | No |

**Takeaway.** For the Ziggy app the vocoder question is already answered: Kokoro's iSTFTNet
(Apache) runs fast. Pitch is changed inside the network, before the decoder sings, so there are
no transposition artefacts (`voice-engine/README.md`). A codec only matters if an LLM-style
model is used for offline expressive bakes, and then SNAC, DAC, NeuCodec and the Qwen tokenizer
are the clean choices.

---

## 5. Text front-end: normalisation and G2P without GPL espeak

### 5.1 Why it matters

Kokoro's French voice was trained on espeak-ng `fr-fr` phonemes passed through phonemizer +
misaki (`voice-engine/README.md` §3). Any replacement must produce the **same phone inventory
and conventions**: nasal vowels with the combining tilde, `ʁ`, the tie `^`, punctuation kept,
liaisons across word groups. Otherwise the voice degrades. Today espeak runs only on the build
machine, which is allowed. A *live* path (browser or app) cannot ship it.

### 5.2 Options

| Tool | What it does | Languages | Licence | Fit |
|---|---|---|---|---|
| **misaki** (hexgrad) | Kokoro's own G2P; gold/silver dictionaries + rules; espeak fallback for OOV words and non-English | en (+ja, zh, ko, vi, he) | Apache-2.0 ([README](https://github.com/hexgrad/misaki)) | **en: already ported to Rust** (`g2p_en.rs`). No French |
| **Phonemis** (Software Mansion, 2026-11) | C++ G2P: Verbalis normalisation → tokenizer → (tagger) → lexicon → neural CTC fallback ("Protophone", ~7 MB per language) | en-us, en-gb, de, **fr**, es, it, pl, pt, hi, zh | MIT. **Caveats:** the fr model is trained on misaki's espeak-ng backend output; English POS tagger is NC (Brown corpus) and must be left out ([notices](https://github.com/software-mansion-labs/phonemis/blob/main/THIRD_PARTY_NOTICES.md)) | Read in the clone: the French pipeline is tokenizer + per-word neural model with **no lexicon, no liaison, no postprocessing** (`src/phonemis/lang/fr/pipeline.h`). Usable as an OOV fallback; not enough alone for storyteller French |
| **Verbalis** (Software Mansion, 2026) | Text normalisation: numbers, dates, times, money, units, abbreviations, URLs → words; **offsets back to the input** | de, en-us/gb, es, **fr**, hi, it, pl, pt, zh; C++, Python, **TypeScript** (no deps, browser/Hermes) | MIT ([README](https://github.com/software-mansion-labs/Verbalis)) | **Good fit** for the live path. The offset mapping is exactly what karaoke highlighting needs. Its French readings are not yet human-checked (README says only Polish and English were) |
| **gruut** | Tokenizer, normaliser, IPA phonemizer **with SSML** (`<say-as>`, `<lexicon>`, `<lookup>`) | incl. **fr** | MIT ([LICENSE](https://github.com/rhasspy/gruut/blob/master/LICENSE), [README](https://github.com/rhasspy/gruut)); depends on a `num2words` fork (LGPL-2.1, flag) | Inspiration for SSML handling; Python only |
| **CharsiuG2P** | ByT5 multilingual G2P, 100 languages | incl. fr | Code MIT ([LICENSE](https://github.com/lingjzhu/CharsiuG2P/blob/main/LICENSE)); training dictionaries have mixed or unspecified licences ([README](https://github.com/lingjzhu/CharsiuG2P)) | Offline lexicon builder at most; data provenance needs checking |
| **DeepPhonemizer** | Transformer G2P trainer (forward/autoregressive) | train-your-own | MIT ([README](https://github.com/as-ideas/DeepPhonemizer)) | **Trainer** for our own fr fallback model |
| **OpenPhonemizer** | DeepPhonemizer model imitating espeak (en) | en | Permissive; **unmaintained**, successor "NextPhonemizer" announced ([README](https://github.com/NeuralVox/OpenPhonemizer)) | Inspiration |
| Phonetisaurus | WFST joint-n-gram G2P trainer | train-your-own | BSD ([paper page](https://www.semanticscholar.org/paper/Phonetisaurus:-Exploring-grapheme-to-phoneme-with-Novak-Minematsu/575444e48907b2eec44c3f1b1921ea2e55677ea2)) | Alternative trainer; tiny models |
| **MFA French dictionary v3** | Large French pronunciation lexicon (used to train MFA's French acoustic model) | fr | **CC-BY-4.0** ([dictionary page](https://mfa-models.readthedocs.io/en/latest/dictionary/French/French%20MFA%20dictionary%20v3_0_0.html), [model card](https://huggingface.co/MontrealCorpusTools/french_mfa)); the card says "Apache 2.0" for the dictionary in one place (conflict) | **Best clean source** for a French lexicon *not* derived from espeak. Needs the owner's OK for CC-BY (attribution) |
| NeMo text processing | WFST normalisation (and ITN) | incl. fr | Apache-2.0 ([README](https://github.com/NVIDIA/NeMo-text-processing)) | Offline reference; heavy (pynini) |
| espeak-ng | Rules + dictionaries | 100+ | **GPL-3.0** | **Build machine only** (as today), and as a *test oracle* |

### 5.3 French specifics the front-end must handle (all in Rust today, keep them)

- **Liaisons and elision.** espeak decides most liaisons today. A permissive replacement needs
  explicit rules: obligatory liaisons (determiner + noun, pronoun + verb, after *très*, *en*),
  forbidden ones (after *et*, before aspirated *h*), and optional ones (keep them for a
  storyteller register). Phonemis has none, so this is the main work item.
- **Homographs.** *les poules du couvent couvent*, *est* (verb) / *est* (east), *fils*,
  *plus* ([s] or not), *tous*, *os*. The engine already reviews several of these
  (`voice-engine/README.md` §5). A small POS-aware exception table plus `lexicon.json` covers
  children's texts.
- **Numbers, dates, ordinals** are already in `numbers.rs`. Verbalis can cover the live path in
  TypeScript with the same behaviour (to be checked with parity tests).
- **Names.** Keep `lexicon.json` as the single source of truth for both paths.

### 5.4 SSML and prosody markup across engines

No open TTS engine examined implements W3C SSML end to end. gruut parses an SSML subset
([README](https://github.com/rhasspy/gruut)). Supertonic 3 has 10 "expression tags"
([README](https://github.com/supertone-oss-archive/supertonic)). Chatterbox Turbo/Nano take
paralinguistic tags such as `[laugh]` ([README](https://github.com/resemble-ai/chatterbox)).
Pocket TTS cannot insert silences yet ([README](https://github.com/kyutai-labs/pocket-tts)).
sherpa-onnx takes plain text or phonemes. **Recommendation:** keep a small Ziggy-internal
markup that compiles to the controls the patched Kokoro already exposes (`dur_scale`,
`f0_override`, `n_override`, pauses). It needs only a few elements: `<pause ms>`,
`<emph>`, `<whisper>`, `<role name>`, `<phoneme ipa>`. Hyper Engine's AI writers would emit
it, and ChildShield / `verify.ts` would validate it.

---

## 6. Streaming and latency

- **Non-autoregressive models (Kokoro, Kitten, Supertonic) do not stream inside a sentence.**
  The unit is the sentence or clause. First-audio latency = G2P + one sentence synthesis:
  measured here at 1.0–2.7 s (section 2.2). Kokoros reports 1–2 s time-to-first-audio
  for its streaming server ([README](https://github.com/lucasjinreal/Kokoros)). Kitten's tiny
  models split at sentence ends into ≤350-phoneme chunks joined with 0.15 s of silence
  ([docs](https://github.com/KittenML/KittenTTS/blob/main/docs/kitten-tts-2-tiny.md)).
- **Autoregressive codec models (Pocket TTS, NeuTTS GGUF) stream frames.** Pocket TTS reaches
  about 200 ms to the first chunk on an M4 ([README](https://github.com/kyutai-labs/pocket-tts)).
- **Practical recipe for Ziggy live lines:**
  1. Split sentences with the existing Rust rules (`text.rs`, which handles quotes and « Oh ! »).
  2. Synthesise sentence 1 immediately. Start the next sentence while sentence 1 plays
     (double-buffer through an AudioWorklet or `AudioBufferSourceNode` queue on the
     `AudioContext` clock, like the Santa visemes already do).
  3. **Short first clause trick:** if the first sentence is long, cut at the first comma so
     sound starts sooner, as the v3 prosody planner already models continuation rises.
  4. Pre-fetch: in games the next line is known before it is needed, so synthesise it during
     the current animation.
  5. Cache by hash (text + voice + recipe), like the Santa manifest, in IndexedDB/Cache
     Storage. Replays and common lines are then instant.

---

## 7. Word timings, forced alignment, visemes and lip-sync

| Need | Best option | Licence | Notes |
|---|---|---|---|
| Karaoke word timing for **our own Kokoro output** | Durations from the patched graph (already shipped, median error 5 ms fr / 20 ms en) | ours | Keep. Same for live on-device if we run the predictor graph (section 10) |
| Timestamps from stock Kokoro in the browser | `onnx-community/Kokoro-82M-v1.0-ONNX-timestamped` (outputs durations), as used by HeadTTS | Apache-2.0 ([card](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped), [HeadTTS](https://github.com/met4citizen/HeadTTS)) | HeadTTS is MIT, "doesn't use eSpeak", English only, CMUdict-based (BSD) |
| Alignment of audio from **other** models (Chatterbox, Qwen3-TTS bakes) | **Qwen3-ForcedAligner-0.6B**: arbitrary units, up to 5 min, 11 languages incl. fr/en | Apache-2.0 ([card](https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B)) | Offline on the build machine |
| Lighter CTC alignment | `jonatasgrosman/wav2vec2-large-xlsr-53-french` + CTC forced alignment | Apache-2.0 ([card](https://huggingface.co/jonatasgrosman/wav2vec2-large-xlsr-53-french)) | Avoid MMS-based aligners: MMS weights are **CC-BY-NC** ([mms-300m](https://huggingface.co/facebook/mms-300m)) |
| Montreal Forced Aligner | Kaldi-style aligner + French model | MFA code MIT; french_mfa model and dictionary CC-BY-4.0 ([card](https://huggingface.co/MontrealCorpusTools/french_mfa)) | Owner decision (CC-BY) |
| Visemes from **phonemes** (fr/en) | Our 5-shape map (`smile/small/open/o/grin`), or the 15 Oculus visemes | ours | TalkingHead has MIT rule-based lip-sync modules incl. **French** ([README](https://github.com/met4citizen/TalkingHead)) for richer mouths |
| Visemes from **audio only** (live, or any clip) | **HeadAudio**: AudioWorklet, Gaussian-prototype model trained on HeadTTS/Kokoro output, Oculus visemes, 50–100 ms latency to compensate | MIT ([README](https://github.com/met4citizen/HeadAudio)) | Model is English-trained ("model-en-mixed"); retrain on our own fr bakes (training scripts provided) |
| Offline audio → mouth cues | **Rhubarb Lip Sync** (PocketSphinx for English, "phonetic" recognizer for other languages) | MIT; all deps permissive ([licence](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/master/LICENSE.md)) | Already used for Santa |
| Audio → full-face blendshapes | NVIDIA **Audio2Face-3D v3.0** (180M, HuBERT + diffusion; skin, tongue, jaw, eyes) | SDK MIT ([LICENSE](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/main/LICENSE.txt)); models **NVIDIA Open Model License** ([card](https://huggingface.co/nvidia/Audio2Face-3D-v3.0)); TensorRT, NVIDIA GPUs | Inspiration / offline only, with owner approval. Overkill for a felt plush with 5 mouths |
| Oculus OVRLipSync | — | Proprietary Oculus SDK licence | No; the viseme *set* is a convention we can reuse |

---

## 8. Audio post-processing

| Need | Option | Licence | Notes |
|---|---|---|---|
| Loudness EBU R128 + true peak | `ebur128` crate (already used), −18 LUFS / ≤ −1.5 dBTP | MIT | Keep. For live audio, run the same `master.rs` chain in the app (Rust) or a WASM build of it in the browser |
| Pitch / formant (child voice) | **WORLD** (already used: CheapTrick envelope ×1.09 applied as a STFT gain) | BSD (modified) | Keep. Pitch stays inside Kokoro |
| Real-time pitch/formant in browser | **Signalsmith Stretch** (C++, `setFormantFactor`, web demo) | MIT ([README](https://github.com/Signalsmith-Audio/signalsmith-stretch)) | Good for live character voices (elves) from a base voice |
| — avoid | Rubber Band | **GPL-2.0+** or paid commercial licence ([licence page](https://breakfastquay.com/rubberband/license.html)) | No |
| Voice conversion (character voices) | **OpenVoice v2** tone converter | MIT, code and weights since April 2024 ([README](https://github.com/myshell-ai/OpenVoice)) | Offline only |
| | **kNN-VC** (WavLM features + matching) | MIT ([LICENSE](https://github.com/bshall/knn-vc/blob/master/LICENSE)); WavLM-Large HF card has no licence tag ([card](https://huggingface.co/microsoft/wavlm-large)) | Verify WavLM weights |
| | RVC | Code MIT ([README](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI)); ContentVec MIT ([card](https://huggingface.co/lengyue233/content-vec-best)) | Base checkpoints need checking. Cloning real people is off-limits anyway |
| | Seed-VC | **GPL-3.0** ([card](https://huggingface.co/Plachta/Seed-VC)) | No (inspiration only) |
| | Vevo (Amphion) | **CC-BY-NC-4.0** ([card](https://huggingface.co/amphion/Vevo)) | No |
| Denoise (mic input, e.g. Santa call) | RNNoise | BSD-3 ([COPYING](https://github.com/xiph/rnnoise/blob/main/COPYING)) | Tiny, real time |
| | DeepFilterNet | MIT / Apache-2.0, code and weights ([README](https://github.com/Rikorose/DeepFilterNet)) | Better, heavier |
| AI-audio watermark | **AudioSeal** (16-bit message, localized detection, streaming since 0.2) | MIT incl. weights ([README](https://github.com/facebookresearch/audioseal)) | Optional provenance mark on baked audio (offline) |
| | Perth (Resemble) | MIT ([README](https://github.com/resemble-ai/perth)) | Built into Chatterbox output |

**Character voices: recommendation.** Ziggy, elves and other *non-human* characters are best
made the way the engine already makes them: style-vector blends, in-network F0 changes, WORLD
envelope changes. Neural VC adds a model, a licence check and artefacts. It also raises a
cloning question, because no real child's voice may ever be used. Keep VC as a lab tool for
offline experiments only.

---

## 9. Licence red flags found in this scope

| Item | Problem | Source |
|---|---|---|
| `kokoro-js` → `phonemizer` | Bundles GPL-3.0 eSpeak NG WASM despite "Apache-2.0" metadata | [prior audit](../huggingface/REPORT.md) |
| `@huggingface/transformers` 4.3.2 | Hard deps `sharp` (LGPL libvips) + `onnxruntime-node` | npm registry metadata |
| Piper (`piper1-gpl`) | Relicensed GPL-3.0 (embeds espeak-ng) | [releases](https://github.com/OHF-Voice/piper1-gpl/releases) |
| Kokoros, TTS.cpp, Kitten FR, sherpa-onnx < 2.0 | espeak-ng at runtime for non-English | READMEs above |
| Phonemis fr/de/es/… models | Distilled from espeak-ng output (MIT claimed). Legal grey area: owner decision | [notices](https://github.com/software-mansion-labs/phonemis/blob/main/THIRD_PARTY_NOTICES.md) |
| Phonemis English tagger | Brown corpus, non-commercial | same |
| Pocket TTS weights, Mimi, MFA, Parakeet | CC-BY-4.0 (attribution; not on the allowed list) | cards above |
| Supertonic 3 | OpenRAIL weights, archived | [card](https://huggingface.co/supertone-oss-archive/supertonic-3) |
| NeuTTS Nano (incl. French) | NeuTTS Open License 1.0 | [README](https://github.com/neuphonic/neutts-air) |
| Kitten TTS 2 (1.7B) | Stellon Labs Community License | [README](https://github.com/KittenML/KittenTTS) |
| X-codec2, BiCodec/Spark-TTS, MMS, Vevo | NC / NC-SA | cards above |
| Seed-VC | GPL-3.0 | [card](https://huggingface.co/Plachta/Seed-VC) |
| Rubber Band | GPL or paid | [licence](https://breakfastquay.com/rubberband/license.html) |
| gruut | `num2words` fork is LGPL-2.1 | [README](https://github.com/rhasspy/gruut) |
| Audio2Face-3D models | NVIDIA Open Model License; GPU only | [card](https://huggingface.co/nvidia/Audio2Face-3D-v3.0) |
| ONNX Runtime | MIT, but the Linux build phones home unless `ORT_DISABLE_TELEMETRY=1` | `voice-engine/README.md` |

---

## 10. Recommended architecture for the Ziggy voice app

### 10.1 Principles

1. **One voice core, written once, in Rust**: the existing `voice-engine` crate split into a
   library. It holds the text front-end, narration plan, v3 prosody, Kokoro two-pass runner,
   WORLD filter, mastering, timings and visemes. It is compiled three ways: build-machine CLI
   (today), **Tauri app plugin** (native), and **WASM** (browser, front-end and DSP only; the
   network runs in onnxruntime-web).
2. **Pre-generate everything that is known in advance.** Live synthesis is only for text that
   cannot be known before (child's first name, AI-written stories after ChildShield, parent
   messages).
3. **Never send child text or voice to a third party.** This retires Gemini TTS for
   child-facing lines.
4. **Same output contract everywhere**: MP3/Opus (or PCM when live) + `timing.json` v2 (words,
   visemes), keyed by `hash(text, voice, recipe)`. The site player, karaoke, 3D mouths and the
   service worker never need to know which path made the audio.

### 10.2 Path A — offline pre-generation (primary; zero running cost)

```
Hyper Engine job "voice.bake" (build machine / owner's computer, never Vercel)
  text sources (stories, game lines, Santa clips, UI read-aloud strings)
    → ChildShield + verify.ts (AI-written text only)
    → Ziggy markup (<pause>, <emph>, <whisper>, <role>, <phoneme>)
    → Rust front-end: normalise (numbers.rs) → sentences/quotes → G2P
         fr: espeak-ng (build machine, as today)   en: misaki port (+ espeak OOV)
    → plan + v3 prosody → Kokoro fp32 two-pass (ORT, telemetry off)
    → WORLD envelope → mastering (−18 LUFS, ≤ −1.5 dBTP) → [optional AudioSeal mark]
    → MP3 + timing.json v2 (+ Rhubarb only when phonemes are unavailable)
    → manifest (key → hash), bump public/sw.js VERSION
```

- This is today's pipeline, generalised from `dodo`/`santa` to any product (a `voice.bake`
  job type in Hyper Engine with a manifest per product).
- Optional expressive bakes from larger Apache models (Qwen3-TTS, VoxCPM2, Chatterbox ML V3;
  see reports 01/04) can use the same tail: forced-align with Qwen3-ForcedAligner → visemes from
  the aligned phonemes → same mastering.
- **Phrase-bank splicing** for personalised lines, already proven by the Santa first names:
  record `{name}` greetings and fixed carrier phrases with matched prosody, and join them at
  pauses on the client. This covers most "dynamic" needs with zero inference on the device.

### 10.3 Path B — on-device live (secondary, for truly free text)

**B1. Native app (Tauri, Rust): recommended first live target.**
- Link the shared Rust voice core plus `ort` (load-dynamic `libonnxruntime`, MIT;
  telemetry off) **or** sherpa-onnx's Rust binding with our phonemes passed as
  `phoneme_codepoints`. Prefer our own `ort` runner. It keeps the patched graph (durations,
  F0 and energy control), so live lines get the same storyteller prosody and exact
  timings/visemes as baked ones.
- Model: Kokoro fp16 (about half the 325 MB fp32 file) or int8-MatMul/fp32-conv. Downloaded once after install with a
  parent's consent, not bundled. Only the two voice tables needed (Ziggy's blends), not 54.
- Expect RTF around 0.7–1.5 on mid-range phones (section 2.2). So use sentence streaming,
  pre-fetch, and the cache. Fall back to phrase-bank or OS TTS if the device is too slow (measure
  RTF on first run and remember it).
- G2P on device (no espeak): see 10.5.

**B2. Website (browser / Android WebView).**
- onnxruntime-web 1.31 (MIT) with WebGPU where available (Safari 26, Chrome; WebView 146+
  compatibility mode), WASM-SIMD threads otherwise. A Web Worker runs the graph, an
  AudioWorklet plays and times it. The Rust front-end and DSP are compiled to WASM.
  Alternative turnkey runtime: the npm `sherpa-onnx` 2.0.1 WASM build (Apache, espeak-free),
  at the cost of losing the graph patch.
- Load the model lazily, only in features that need free text (e.g. "read my story"). Cache it
  in Cache Storage. Never load it on the landing page (an 80–325 MB download).
- Do **not** use kokoro-js, `phonemizer` or Transformers.js (licences, section 9).

**B3. Last-resort fallback**: Web Speech API, as today, with the `SayButton`/`useAutoSay`
contract unchanged.

### 10.4 Path C — server (none needed; optional self-host only)

- **Retire `/api/tts` (Gemini) for child-facing speech.** Replace each call site with:
  pre-generated clip (Path A) → on-device live (Path B) → Web Speech. This removes a running
  cost and a third-party data flow.
- If a server path is ever needed (e.g. the Père Noël live call, already an owner-approved
  exception), self-host the same Rust core plus ORT on the owner's own machine or a fixed-cost
  box, never a per-call TTS API. Kokoro is CPU-only and ≈ real time per 2 cores (section 2.2),
  so one small server can voice a few concurrent calls. No text is stored.

### 10.5 G2P plan without espeak on devices (the critical path)

1. **English:** the Rust misaki port already exists. Replace its espeak OOV fallback with a
   small neural fallback trained **only** on misaki's Apache dictionaries (DeepPhonemizer, MIT,
   or Phonemis' Protophone format; Phonemis' en model was trained exactly that way and is clean).
2. **French:** build a Ziggy French lexicon from a non-espeak source (**MFA French dictionary,
   CC-BY-4.0**, needs owner OK) mapped to Kokoro's espeak-style phone set. Add `lexicon.json`
   and a story-word list. Train a small seq2seq/CTC fallback on that lexicon (MIT trainer). Write
   **liaison/elision rules in Rust**. Use espeak-ng only on the build machine as a **test
   oracle**: diff our French phonemes against espeak on the 1,483 story sentences (the same
   check the engine already uses), and listen to any differences.
3. Shortcut, if the owner accepts the grey area: use Phonemis' MIT `fr` model as the OOV
   fallback. It was distilled from espeak, has no liaisons, and needs our rules on top.
4. **Normalisation for the live path:** reuse `numbers.rs` (Rust/WASM) or Verbalis (MIT,
   TypeScript/C++, with offsets for karaoke) after a French parity check.

### 10.6 Hyper Engine integration sketch

```
src/lib/hyper-engine/voice/          (proposal, not implemented)
  contract.ts     VoiceRequest {text, locale, voice, style, markup}, VoiceClip {url|pcm, timing}
  manifest.ts     hash(text, voice, recipe) → clip; per-product manifests
  router.ts       pregenerated → device (app/web) → phrase-bank → webspeech
  markup.ts       Ziggy markup schema + validation (verify.ts / ChildShield on AI text)
voice-engine/ (Rust workspace)
  ziggy-voice-core   (lib: front-end, prosody, kokoro runner, DSP, timings)
  ziggy-voice        (CLI: bake jobs)          apps/ziggy-app: tauri plugin "voice"
  ziggy-voice-wasm   (front-end + DSP for the browser; ORT-web runs the graph)
```

### 10.7 Next steps, in order

1. Split `voice-engine` into `core` + CLI with no behaviour change (the outputs must stay
   byte-identical; the existing `tests/engine.rs` checks this).
2. French G2P without espeak (10.5). It gates every live path. Track it with a phoneme-diff
   score on the 31 stories.
3. Tauri voice plugin (Path B1) on one Android phone + one iPhone. Measure RTF and first-audio
   latency; fp16 vs int8 by ear.
4. Replace `/api/tts` callers with pre-generated clips plus the router; keep Web Speech as the
   fallback.
5. Browser Path B2 behind a feature flag (WebGPU first).
6. Optional: retrain HeadAudio's viseme model on our French bakes for audio-only lip-sync.

---

## Sources

Repository files: `voice-engine/README.md`, `docs/DODO_VOICE.md`, `src/lib/voice.ts`,
`src/lib/tts-gemini.ts`, `src/app/api/tts/route.ts`, `src/lib/dodo/voice.ts`,
`apps/ziggy-app/src-tauri/Cargo.toml`, `public/sw.js`, `research/huggingface/REPORT.md`.

Runtimes: https://github.com/k2-fsa/sherpa-onnx ·
https://github.com/k2-fsa/sherpa-onnx/blob/master/sherpa-onnx/csrc/offline-tts-kokoro-model-config.cc ·
https://pypi.org/project/sherpa-onnx/ · https://www.npmjs.com/package/sherpa-onnx ·
https://www.npmjs.com/package/onnxruntime-web · https://huggingface.co/blog/transformersjs-v4 ·
https://newreleases.io/project/github/huggingface/transformers.js/release/4.3.0 ·
https://newreleases.io/project/github/microsoft/onnxruntime/release/v1.30.0 ·
https://newreleases.io/project/github/pykeio/ort/release/v2.0.0-rc.10 ·
https://newreleases.io/project/github/pykeio/ort/release/v2.0.0-rc.11 ·
https://github.com/lucasjinreal/Kokoros · https://github.com/mmwillet/TTS.cpp ·
https://github.com/TM9657/any-tts · https://nobodywho.ooo/posts/announcing-stt-tts/ ·
https://github.com/gradium-ai/xn-ptts · https://huggingface.co/mattmireles/kokoro-coreml ·
https://huggingface.co/mlboydaisuke/Kokoro-82M-ExecuTorch ·
https://huggingface.co/software-mansion/Kokoro-82M-ExecuTorch ·
https://docs.swmansion.com/react-native-executorch/docs/extensions/text-to-speech ·
https://developers.google.com/edge/mediapipe/solutions/audio/text_to_speech ·
https://web.dev/blog/webgpu-supported-major-browsers ·
https://groups.google.com/a/chromium.org/g/blink-dev/c/N3RlLGCOTJ4/m/loneRTlPBwAJ ·
https://bugs.webkit.org/show_bug.cgi?id=301627 ·
https://voiceping-landingpage-prod.pages.dev/en/blog/research-offline-tts-eval/ ·
https://offlinetts.com/blog/browser-tts-showdown-kokoro-piper-kitten/ ·
https://github.com/thewh1teagle/kokoro-onnx/releases · https://arxiv.org/pdf/2609.28974

Models: https://huggingface.co/hexgrad/Kokoro-82M ·
https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX ·
https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped ·
https://huggingface.co/nvidia/kokoro-82M-onnx-opt · https://github.com/kyutai-labs/pocket-tts ·
https://huggingface.co/kyutai/pocket-tts · https://github.com/KittenML/KittenTTS ·
https://github.com/KittenML/KittenTTS/blob/main/docs/kitten-tts-2-tiny.md ·
https://huggingface.co/KittenML/kitten-tts-2-nano · https://huggingface.co/KittenML/kitten-tts-2-mini ·
https://github.com/supertone-oss-archive/supertonic ·
https://huggingface.co/supertone-oss-archive/supertonic-3 · https://github.com/neuphonic/neutts-air ·
https://github.com/resemble-ai/chatterbox · https://huggingface.co/ResembleAI/chatterbox ·
https://github.com/OHF-Voice/piper1-gpl/releases ·
https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base · https://huggingface.co/openbmb/VoxCPM2 ·
https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B

Codecs/vocoders: https://huggingface.co/kyutai/mimi · https://huggingface.co/hubertsiuzdak/snac_24khz ·
https://github.com/descriptinc/descript-audio-codec · https://github.com/facebookresearch/encodec ·
https://huggingface.co/HKUSTAudio/xcodec2 · https://huggingface.co/novateur/WavTokenizer-large-speech-75token ·
https://huggingface.co/SparkAudio/Spark-TTS-0.5B · https://github.com/gemelo-ai/vocos ·
https://huggingface.co/nvidia/bigvgan_v2_24khz_100band_256x · https://github.com/jik876/hifi-gan ·
https://github.com/rishikksh20/iSTFTNet-pytorch · https://github.com/yl4579/StyleTTS2 ·
https://huggingface.co/neuphonic/neucodec · https://huggingface.co/Qwen/Qwen3-TTS-Tokenizer-12Hz ·
https://huggingface.co/XiaomiMiMo/MiMo-Audio-Tokenizer · https://huggingface.co/lucadellalib/focalcodec_50hz

Front-end: https://github.com/hexgrad/misaki · https://github.com/software-mansion-labs/phonemis ·
https://github.com/software-mansion-labs/phonemis/blob/main/THIRD_PARTY_NOTICES.md ·
https://github.com/software-mansion-labs/Verbalis · https://github.com/rhasspy/gruut ·
https://github.com/lingjzhu/CharsiuG2P · https://github.com/as-ideas/DeepPhonemizer ·
https://github.com/NeuralVox/OpenPhonemizer · https://github.com/NVIDIA/NeMo-text-processing ·
https://mfa-models.readthedocs.io/en/latest/dictionary/French/French%20MFA%20dictionary%20v3_0_0.html ·
https://huggingface.co/MontrealCorpusTools/french_mfa

Timing, lip-sync: https://github.com/met4citizen/HeadTTS · https://github.com/met4citizen/HeadAudio ·
https://github.com/met4citizen/TalkingHead ·
https://github.com/DanielSWolf/rhubarb-lip-sync/blob/master/LICENSE.md ·
https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B ·
https://huggingface.co/jonatasgrosman/wav2vec2-large-xlsr-53-french ·
https://huggingface.co/facebook/mms-300m · https://huggingface.co/nvidia/Audio2Face-3D-v3.0 ·
https://github.com/NVIDIA/Audio2Face-3D-SDK

Audio post: https://github.com/facebookresearch/audioseal · https://github.com/resemble-ai/perth ·
https://github.com/Signalsmith-Audio/signalsmith-stretch ·
https://breakfastquay.com/rubberband/license.html · https://github.com/myshell-ai/OpenVoice ·
https://github.com/bshall/knn-vc · https://huggingface.co/microsoft/wavlm-large ·
https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI ·
https://huggingface.co/lengyue233/content-vec-best · https://huggingface.co/Plachta/Seed-VC ·
https://huggingface.co/amphion/Vevo · https://github.com/xiph/rnnoise ·
https://github.com/Rikorose/DeepFilterNet
