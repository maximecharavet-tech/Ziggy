# NVIDIA research cell: report (2026-11-09)

**Scope:** whether NVIDIA's character technologies (Audio2Face-3D, Audio2Emotion, ACE/NIMs/Riva, Omniverse, and
GPU tooling) can make Ziggy, Santa and the elves talk better on ziggy-ai.fr. The constraints are no running cost,
licences that allow commercial use, child safety, and a web game that never depends on NVIDIA.

## 0. Verdict in five lines

1. **Audio2Face-3D could be useful, but only offline, as a one-off bake on a GPU machine.** The SDK is MIT and the
   models are under the *NVIDIA Open Model License* (commercial use OK, NVIDIA claims no ownership of outputs).
   We would ship only the outputs (tiny blendshape tracks), never the model. Decision: **test**, on Santa's fixed
   lines first.
2. **It cannot run in the browser.** v3.0 is a 725 MB ONNX network (180 M parameters, HuBERT and diffusion), and the
   SDK needs CUDA 12.8+, TensorRT 10.13+ and an NVIDIA GPU. There is no realistic web runtime.
3. **Audio2Emotion is rejected.** It uses a custom, gated licence ("use only with Audio2Face"). Running emotion
   recognition on children's voices would cross our red lines in any case, and EU AI Act art. 5(1)(f) bans emotion
   recognition in education.
4. **ACE NIMs and Riva are rejected.** They need an NVIDIA AI Enterprise licence or a GPU server, which means paid
   per GPU or per use. They exist to build live conversational characters, which is a red line for children
   (outside the approved Père Noël exception). Sending a child's voice to NVIDIA's cloud is forbidden.
5. **We built the NVIDIA-free path anyway.** `src/lib/face/` has a `FaceAnimator` interface with a live
   `WebFallbackAnimator` (in the browser, zero cost) and a `PrecomputedTrackAnimator` that plays baked tracks.
   It also has a validated track format and helpers that map to Santa, Ziggy and the three elves. There are
   37 tests and tsc/eslint are clean.

## 1. Method and what could not be verified

| Source | Access | Used for |
|---|---|---|
| raw.githubusercontent.com (NVIDIA/Audio2Face-3D, -SDK, -training-framework, ACE) | OK | READMEs and the LICENSE files, read in full |
| Hugging Face Hub (through the HF MCP tool) | OK | model cards and file lists for A2F v3.0 and v2.3, Magpie TTS; config JSONs (emotions, 52 poses, fps) |
| huggingface.co directly (curl/WebFetch) | **blocked** | (the MCP tool was used instead) |
| www.nvidia.com (license pages, NIM terms, Riva and Omniverse terms) | **blocked** | NVIDIA Open Model License read from the ScanCode LicenseDB copy (`aboutcode-org/scancode-toolkit`, "Version Release Date: October 24, 2025"). Other NVIDIA terms come from search snippets only. |
| api.github.com | blocked for these repos | (raw files were used instead) |
| Audio2Emotion model cards | **gated**: access denied | licence known only from search snippets: **unverified** |

**Unverified items** (marked as such in `registry.md`):
- The full Audio2Emotion licence text.
- The current NIM / NVIDIA AI Enterprise terms.
- The current Riva free tier. Old 2.x docs said "free up to a daily limit"; NVIDIA now points to a 90-day NVAIE
  trial and to sales.
- The Omniverse product-specific terms (dated 2025-11-01) and whether rendered outputs can be used commercially.
- The LICENSE files of Maya-ACE and the UE plugin (the hub README says MIT).
- Nemotron Nano's licence ("other" on HF).
- The full card for Parakeet. The licence comes only from the HF tag `cc-by-4.0`.

## 2. Audio2Face-3D (A2F-3D)

### 2.1 Components and licences

| Component | What it is | Licence | Verified |
|---|---|---|---|
| Audio2Face-3D SDK ("Audio2X SDK", C++ and Python) | inference library: regression and diffusion executors, blendshape solver, A2E | **MIT** ("Copyright (c) 2025, NVIDIA CORPORATION") | LICENSE.txt read, 2026-11-09 |
| A2F-3D models on HF: v3.0 (diffusion, identities Claire/James/Mark), v2.3-Mark, v2.3.1-Claire, v2.3.1-James | ONNX weights, converted to TensorRT locally | **NVIDIA Open Model License** ("This model is ready for commercial/non-commercial use") | model cards read, 2026-11-09; licence text read from the ScanCode copy |
| Training framework v1.0 | Python + Docker, train your own A2F model | **Apache-2.0** | LICENSE read, 2026-11-09 |
| Claire training dataset | sample data | "Custom (evaluation only)" per the hub README | text not read |
| Maya-ACE (MACE) 2.0, UE 5.4–5.6 plugin | DCC / engine integrations | MIT per the hub README | LICENSE not read |
| A2F-3D NIM (build.nvidia.com, NGC) | gRPC microservice container | NVIDIA Software License Agreement + Product-Specific Terms for AI Products (NVAIE) | not readable (nvidia.com blocked) |

### 2.2 NVIDIA Open Model License: the clauses that matter to us

From the text dated 2025-10-24:
- "Models are commercially usable." "NVIDIA does not claim ownership to any outputs generated using the Models."
  "An output is not a Derivative Model." "You are responsible for outputs and their subsequent uses."
- The licence is perpetual, worldwide, no-charge and royalty-free, and **revocable**. Rights end automatically if
  we sue over patents/copyright, or if we "bypass, disable, reduce the efficacy of, or circumvent any … Guardrail"
  without an equivalent. **We will not modify the model.**
- If we *distribute the model*, we must include the licence and a Notice file saying "Licensed by NVIDIA Corporation
  under the NVIDIA Open Model License". **We do not distribute the model**, only generated tracks, so this does not
  apply. As a courtesy, we still record the model and licence in each track (`source.model`, `source.modelLicense`)
  and in `THIRD_PARTY_LICENSES.md` once tracks ship.
- NVIDIA Trustworthy AI terms apply. NVIDIA "may update this Agreement … You agree to either comply … or cease".
  Delaware law, Santa Clara courts.
- **Fit with CLAUDE.md:** the model never ships, so the MIT/Apache/BSD rule for shipped code is respected. The
  outputs are ours. NVIDIA's ability to update the licence is the main residual risk. Tracks we have already baked
  stay ours under "NVIDIA claims no ownership rights in outputs", but re-baking would need the then-current terms.

### 2.3 What it outputs

From the HF configs, read on 2026-11-09:
- The output is skin geometry (v3.0: 72,006 floats; v2.3 Mark: 61,520), tongue geometry, a jaw transform
  (15 floats) and eye rotations (4 floats). The SDK's `IBlendshapeSolver` turns geometry into **52 blendshape
  weights** (`"numPoses": 52`). The symmetry pairs in `bs_skin_config` (blink 0/7, eyeWide 6/13, smile 23/24,
  frown 25/26, … tongueOut 51) match the **ARKit 52 order**. Our `ARKIT_52` constant uses that order.
- v2.3: regression model at **30 fps** (`a2f_ms_config.json`). v3.0: diffusion (2 steps), 30-frame windows,
  audio at 16 kHz.
- The emotion input vector is `amazement, anger, cheekiness, disgust, fear, grief, joy, outofbreath, pain,
  sadness`. **Red line:** the bake sets every negative entry to 0 and uses only joy, amazement and cheekiness.
  Our importer (`weightsFromA2fEmotions`) drops the others, and the track validator rejects frown, brow-down and
  sneer channels.
- The identities are realistic human faces (Claire/James/Mark). Our characters are a felt robot, a bearded Santa
  and felt elves, so we **retarget through the ARKit weights** (or our six visemes) and not through geometry.
  Lip-sync is driven by audio, so French should work, but **French quality is unverified**: the training data is
  described only as "less than 10,000 hours" of speech.

### 2.4 Hardware and runtime

- SDK: Windows 10/11 or Ubuntu 20.04+, **NVIDIA GPU with CUDA ≥ 12.8 (< 13), TensorRT ≥ 10.13 (< 11)**,
  8 GB RAM and 4 GB+ VRAM, Python 3.8–3.10, git-lfs. It is faster than real time (">60 FPS"), with multi-track
  batch executors.
- Tested hardware (card): T4, A10, L4, L40S, A100, RTX 3080–5090, RTX 6000 Ada. Supported architectures go back
  to Pascal.
- The hub README mentions a "CPU fallback". The SDK README requires CUDA/TensorRT, and TensorRT engines are GPU
  only. **Running the ONNX file on CPU with onnxruntime would also need the C++ post-processing (PCA
  reconstruction, skin/tongue animators, blendshape solve) to be re-implemented. Not attempted, unverified.**
- **Web runtime: not feasible.** The ONNX files are 725 MB (v3.0) or 76 MB plus a 204 MB `model_data.npz`
  (v2.3), the HuBERT encoder is heavy, and the post-processing is GPU-oriented. This rules out a page for children
  on low-end tablets.
- **Offline batch: yes.** It needs a GPU machine once: the owner's PC if it has an RTX card, or a one-off rented
  GPU instance for about an hour (a few euros). That is a one-off cost and not a running cost, but the owner should
  approve it. The only data sent to such a machine is our own synthetic TTS audio (adult synthetic voices),
  never child data. **Clips that contain a child's first name are never baked.** They use the web fallback.

### 2.5 Value for our characters (honest assessment)

| Character | Today | Gain from A2F tracks |
|---|---|---|
| Santa (call, 59 fixed lines × FR/EN, Gemini TTS cached clips) | jaw follows loudness (`setTalk(level)`) | **Medium.** The beard hides most of the lips. Better jaw timing, closures (m/b/p) and a natural blink/brow track are visible. This is the best candidate. |
| Ziggy (dodo stories) | the Rust voice engine already emits **phoneme-accurate visemes** (`timing.json` v2) | **Low.** Phoneme timing from the engine is already better suited to 5 mouth textures than retargeted ARKit weights. Keep the engine. |
| Elves (Pépin/Grelotte/Noisette, single `setMouth(open)` decal) | scalar mouth | **Low to medium.** One scalar loses most of A2F's detail; the web fallback gets about 80% of the result. |

Hence the decision is **test, not adopt**: bake Santa's lines once, compare with the web fallback side by side
(Playwright video, 1280×800 and 390×844), and keep A2F only if the owner sees a difference.

### 2.6 Training framework

Apache-2.0. It needs a GPU with 6 GB+ VRAM, Docker and the NVIDIA Container Toolkit (a 30–40 min run on the sample
data). A plush-specific model would need captured or animated plush facial data that we do not have, and the sample
dataset is evaluation-only. **Reject** for now.

## 3. Audio2Emotion (A2E)

- Production v2.2 and experimental v3.0, both **gated** on HF (our access was denied). The licence
  (`nvidia-audio2emotion-license`, per search snippets) allows use **"only with the NVIDIA Audio2Face Project"**,
  and the snippets say it **prohibits use "for emotion recognition"**. Full text **unverified**.
- **Ziggy fit: none.**
  1. Running it on a child's voice would be emotion recognition on minors. That conflicts with our red lines and
     GDPR for minors, and the EU AI Act bans emotion recognition in education settings (art. 5(1)(f)).
  2. On our own TTS clips, it would only guess an emotion that **we already author per line** (the script knows
     when Santa laughs).
  3. Its output space includes sadness, grief, anger and fear.
- **Reject.** In the bake, emotions come from our manifest (joy, amazement, cheekiness only).

## 4. ACE, NIMs, Riva, Nemotron

- **ACE GitHub repo:** samples under Apache-2.0 (LICENSE read). "ACE NIMs and NGC Microservices" fall under the
  NVIDIA AI Product License / NVAIE. The README lists Riva ASR/TTS/NMT, A2F, AnimGraph, the Omniverse renderer,
  ACE Agent, Maxine Live Portrait (early access) and Nemotron-3 4.5B SLM (early access). Deployment is cloud or
  Windows PC.
- **Riva** (unverified, snippets only): it was free for development and production "up to a daily usage limit"
  since 2.0 (old docs; a forum quote gives 1,000 ASR hours or 25 M TTS characters per day). Current NVIDIA pages
  steer to a 90-day NVAIE trial and to sales for production. It needs an NVIDIA GPU server.
- **Constraints for us:**
  1. A live interactive character (ASR → LLM → TTS) is "free LLM chat for children", a red line. The one
     owner-approved exception (Père Noël, `docs/PERE_NOEL.md`) already has its own pipeline with on-device
     transcription.
  2. Calling build.nvidia.com APIs would send a child's voice to a third party, which is forbidden. NIM hosting is
     US-centric; EU hosting would be on us.
  3. Self-hosting needs GPU servers, which is a running cost.

  **Reject** all ACE NIMs and Riva.
- **Open NVIDIA models worth noting (outside ACE):**
  - **Parakeet-TDT-0.6B-v3.** ASR for 25 European languages including French. Weights CC-BY-4.0 (HF tag), code in
    NeMo (Apache-2.0, LICENSE not read). Community ONNX exports exist (`istupakov/onnx-asr`). It is a possible
    *on-device* transcription candidate for the Père Noël app (no third party), but 627 M parameters is heavy for
    a browser/WASM, and CC-BY weights need attribution and the owner's OK. **Test**, low priority, owned by the
    Père Noël team.
  - Canary-1B-v2 (CC-BY-4.0, 979 M) is too heavy: reject in favour of Parakeet.
  - **Magpie TTS Multilingual 357M** (NVIDIA Open Model License, card read). French is included. It could be an
    offline voice generator, but it has fixed speaker voices, we already have Kokoro (voice engine) and Gemini
    clips, and its training data lists third-party datasets with mixed licences. **Reject** for now.
  - **Nemotron Nano 9B v2** (licence "other", unverified): an LLM, never for child chat. Reject for runtime.

## 5. Omniverse and RTX tools

- The Omniverse Kit SDK is NVIDIA-licensed and not open source. Only some apps, such as Isaac Sim, are Apache-2.0,
  and they depend on Kit. Per the Isaac Sim licence FAQ, internal development use is free, but redistributing Kit
  inside an app, or offering it as a service, needs NVAIE. The 2021–22 individual licence allowed commercial use
  but has been superseded. The current product-specific terms (dated 2025-11-01) could not be read, so **commercial
  use of rendered outputs is unverified**.
- Ziggy's policy is "code-built assets" (three.js, felt textures generated in code). Omniverse would add a
  Windows/RTX workstation dependency for little gain. The old standalone "Audio2Face app" in Omniverse is superseded
  by the SDK/MACE path above. **Reject.**
- NVlabs research repositories (3D generation, NeRF and similar) are commonly under NVIDIA Source Code License-NC
  (non-commercial). This is from memory and unverified per repo; treat as **reject** unless a LICENSE file proves
  otherwise.

## 6. GPU and inference notes (we run no GPU in production)

- For the one-off bake:
  - TensorRT engines are tied to the GPU model and the TensorRT version. Generate them on the bake machine
    (`gen_testdata.sh`) and never commit them.
  - The multi-track executor batches several clips. At ">60 fps" per track, all of Santa's lines (about 59 × 2
    locales × ~5 s ≈ 10 min of audio) bake in minutes.
  - Use the **blendshape executor** (geometry + solver) and export 52 weights per frame at 30 fps.
- Browser side:
  - The fallback costs one 1024-point FFT per frame, or **zero extra** if we pass the `AnalyserNode` spectrum
    Santa's audio player already has (`dbToMagnitudes`).
  - Tracks are 8-bit at 30 fps, about 2 KB per 5 s clip with 10 channels, and cacheable by `public/sw.js` (bump
    `VERSION`).
  - No morph targets are required: Ziggy uses textures, the elves a scaled decal, Santa a jaw. `toArkitWeights`
    exists for a future glTF face.
- CLAUDE.md lesson: `prefersLowPower()` is true at ≤ 4 cores. The face module adds no post-processing and no GPU
  work, so it behaves the same on low-power devices.

## 7. What we built (no NVIDIA dependency)

All files are in `src/lib/face/`. They are pure TypeScript with no DOM, no three.js and no new npm dependency.

| File | Content |
|---|---|
| `types.ts` | `FaceAnimator`, `FaceFrame`, `FaceInput`, `Viseme` (rest/AA/EE/OO/MM/FF), `Emotion` (neutral/smile/laugh/surprise/listen/wink, **no sad**), `ARKIT_52`, `FORBIDDEN_ARKIT` (frowns, brow-down, sneers) |
| `features.ts` | radix-2 FFT, Hann window, 5 formant bands, rms/zcr, `dbToMagnitudes` / `bytesToMagnitudes` for AnalyserNode data |
| `web-fallback.ts` | `WebFallbackAnimator`: band scores → softmax visemes → attack/release smoothing (30/80 ms) → jaw with automatic gain; inputs are spectrum, samples or level |
| `emotion.ts` | presets, `EmotionMixer` (hold, cue, laugh bounce, natural blinks), `sanitizeEmotion` (sad/anger/… → smile), `weightsFromA2fEmotions` (keeps joy/amazement/cheekiness only) |
| `track.ts` | `ziggy-face-track` v1 JSON schema, `validateTrack` (strict, safe: id pattern, limits, forbidden channels, emotion whitelist, audio hash), `encodeTrack`, `sampleTrack`, base64 that works without atob/Buffer |
| `precomputed.ts` | `PrecomputedTrackAnimator` (plays tracks by playback time, follows emotion keys, lets blinks and brows through but never below the happy face), `visemesFromArkit` |
| `mapping.ts` | `toSantaTalk`, `toSantaExpression`, `toZiggyMouth`, `toElfMouth`, `toArkitWeights`, `CHARACTER_PROFILES` |
| `index.ts` | public API and `createFaceAnimator(track?)`, which returns the precomputed animator when a track is valid and the web fallback otherwise |
| `README.md` | how to wire each character, and the optional hooks the character owners could add |
| `face.test.ts`, `track.test.ts` | 37 tests (see below) |

What the tests cover:
- Viseme classification on synthetic vowels (formant-shaped harmonics) at 110, 150 and 220 Hz, and on a
  fricative, both per frame and through the animator.
- Jaw ordering (AA > OO > MM).
- Rest on silence.
- Attack/release maths, no snapping open, monotone close.
- No NaN with NaN/Infinity samples, negative or huge dt, and empty input.
- Emotion blending and cues, with "sad" mapped to smile and A2F negative emotions dropped.
- Type compatibility with `MouthShape` (Ziggy) and `SantaSceneHandle` (Santa).
- Track encode/validate/sample, 17 rejection cases, ARKit→viseme mapping, and the factory fallback.

Results: `npx vitest run src/lib/face` passes 37/37. `npx tsc --noEmit` is clean. `npx eslint src/lib/face` is
clean.

**Not done (out of scope or owned by others):**
- Wiring into `SantaCall.tsx`, the Ziggy stage and the elves. The character files are owned by other people. The
  README lists the hooks needed.
- The bake itself. It needs a GPU and is planned in `offline-bake.md`.

## 8. Recommendations

1. Wire `WebFallbackAnimator` into Santa's call. It is a drop-in improvement over the current loudness-only jaw
   (closures on m/b/p, rounder "oh") and costs nothing.
2. If the owner wants it: a one-off A2F bake of Santa's 118 fixed clips on a GPU machine (`offline-bake.md`), then
   a side-by-side review. Ship the tracks only if they are clearly better.
3. Keep the Rust engine's phoneme visemes for Ziggy. Do not route Ziggy through A2F.
4. No NIM, Riva, Audio2Emotion or Omniverse, now or later, unless the licences and red lines change.

## Sources

- https://github.com/NVIDIA/Audio2Face-3D (README: component and licence table)
- https://github.com/NVIDIA/Audio2Face-3D-SDK (README, LICENSE.txt MIT, docs/README.md, samples README)
- https://github.com/NVIDIA/Audio2Face-3D-training-framework (README, LICENSE Apache-2.0)
- https://github.com/NVIDIA/ACE (README, LICENSE Apache-2.0)
- https://huggingface.co/nvidia/Audio2Face-3D-v3.0 (card, `network_info.json`, `bs_skin_config_*.json`, `model.json`)
- https://huggingface.co/nvidia/Audio2Face-3D-v2.3-Mark (card, `a2f_ms_config.json`)
- https://huggingface.co/nvidia/Audio2Emotion-v2.2 and -v3.0 (gated; metadata only)
- NVIDIA Open Model License text (2025-10-24) through https://github.com/aboutcode-org/scancode-toolkit (`nvidia-open-model-2025.LICENSE`); official page https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/ was blocked
- Riva: https://docs.nvidia.com/deeplearning/riva/archives/2-2-0/user-guide/docs/enterprise.html, https://forums.developer.nvidia.com/t/riva-can-be-deployed-free-of-charge-up-to-a-certain-usage-limit-clarifications/209902, https://www.nvidia.com/en-us/ai-data-science/products/riva/faq (snippets)
- Omniverse: https://docs.isaacsim.omniverse.nvidia.com/latest/common/license-faq.html, https://www.nvidia.com/en-us/agreements/enterprise-software/product-specific-terms-for-omniverse/ (snippets)
- https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3, https://huggingface.co/nvidia/canary-1b-v2, https://huggingface.co/nvidia/magpie_tts_multilingual_357m, https://huggingface.co/nvidia/NVIDIA-Nemotron-Nano-9B-v2 (HF metadata)
- arXiv 2508.16401 (Audio2Face-3D paper)
`
