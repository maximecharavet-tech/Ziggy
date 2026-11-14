# Hugging Face research cell: open models for LUTIN CHAOS and LUTIN FACTORY (2026-11-09)

Scope: what the Hugging Face Hub offers (2026-11) for 15 needs of Ziggy's two new games. Ziggy rules
apply throughout: zero new running cost, no GPU in production, offline pre-generation or in-browser
only, shipped code MIT/Apache/BSD, and the child-safety red lines. This extends
`docs/lutins-research.md` (prompting, consistency, I2V tips, Rust crates). That work is not repeated
here. Scored rows are in `registry.md` (shared format).

## 0. How this was checked (read this before trusting a cell)

- **Weights licence:** I read the model card's `license` field myself on 2026-11-09 through the
  Hugging Face MCP. For every `license: other` I opened the card front matter or the LICENSE file
  (CogVideoX, HunyuanVideo-I2V, LTX-Video, LTX-2, XTTS-v2, SenseVoice, emotion2vec, Qwen2.5-Omni-3B/7B,
  Qwen3-Omni, RMBG-1.4, HunyuanVideo-Foley, LFM2, TangoFlux, Kyutai voices).
- **Gated cards I could not open:** FLUX.1-dev, SD3.5, Stable Audio Open, RMBG-2.0. FLUX.1-dev was read
  from BFL's GitHub licence file instead. The others are marked **unverified** and rest on secondary
  sources.
- **Code licence:** read from each repo's `LICENSE` on raw.githubusercontent.com the same day.
- **npm packages:** `@huggingface/transformers`, `onnxruntime-web`, `kokoro-js` and `phonemizer` were read
  from the npm registry. I downloaded and inspected the `phonemizer` tarball itself.
- **Quality:** comes from the authors' README/leaderboard claims (quoted as claims) plus my own estimate.
  **I ran no model in this session** (no GPU; huggingface.co is blocked for direct HTTP). The speed and
  VRAM figures marked "README" are the authors'. Figures marked ≈ are derived from parameter count
  (bf16 ≈ 2 B/param, int8 ≈ 1, Q4 ≈ 0.6).
- **"Offline bake":** runs once at build time on a CPU or a one-off GPU (the owner's machine or a short
  rental), and the output files are committed and served statically. That one-off GPU cost is the only
  cost, and it needs the owner's OK. Nothing in this report adds a runtime API call.

## 1. The licence traps (the most useful page of this report)

| Trap | Where | Why it matters |
|---|---|---|
| **MIT/Apache code, non-commercial weights** | FLUX.1 [dev] / Kontext [dev], FLUX.2 [dev] + **klein 9B** (klein **4B** is Apache), MMAudio (MIT code, CC-BY-NC weights), F5-TTS (MIT code, CC-BY-NC weights), MusicGen / AudioGen (CC-BY-NC), AudioLDM2 (CC-BY-NC-SA), MMS (CC-BY-NC), Fish S1-mini (CC-BY-NC-SA, and the code is now the "Fish Audio Community License"), TangoFlux ("non-commercial research use only"), RMBG-1.4 and RMBG-2.0 (Bria, NC) | You cannot judge a model by its GitHub badge. Every FLUX-dev derivative (UNO, DreamO, USO, InfiniteYou, ACE++, ICEdit) inherits the NC licence |
| **Same family, different licence by size** | Qwen2.5-Omni-**3B** = *Qwen RESEARCH (non-commercial)* vs Qwen2.5-Omni-**7B** = Apache-2.0. FLUX.2 klein 4B Apache vs 9B NC. Moonshine: English and streaming models MIT, legacy non-English models "Moonshine Community License" (NC) | Pin the exact repo id in every script |
| **EU / UK / South Korea excluded** | Tencent Hunyuan Community: HunyuanVideo-I2V ("DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA"), HunyuanVideo-Foley, and everything built on Hunyuan (FramePack, HunyuanCustom) | Unusable in France |
| **Conditional "community" licences** (allowed, but they need a revenue check or registration, and the obligations flow down) | Stability AI Community (SD3.5, Stable Audio Open: free below $1M revenue, registration), LTXV Open Weights / LTX-2 Community (paid at ≥$10M revenue), CogVideoX License (registration, ≤1M visits/month, PRC law), OpenRAIL++ (LatentSync), Gemma Terms, LFM Open License | Usable only with the owner's sign-off. We prefer Apache/MIT whenever one exists, and one exists for every need |
| **Undeclared licence = unknown = no** | OmniVoice (no licence on the card; only `audio_tokenizer/LICENSE`), DiffRhythm-1_2 (no README), j-hartmann emotion model, ai-forever/Real-ESRGAN, Swin2SR ONNX repo | Use the original publisher's weights instead (xinntao Real-ESRGAN = BSD-3) |
| **Pipeline dependencies** | HiDream-I1 (MIT) needs **Llama-3.1-8B** (Llama Community Licence) as its text encoder. LivePortrait (MIT) uses **InsightFace** detectors ("non-commercial research purposes only"). MuseTalk (MIT) pulls sd-vae / dwpose / S3FD with their own licences. Kyutai TTS (CC-BY) ships voice embeddings from **Expresso and EARS = CC-BY-NC** next to CC0/CC-BY ones | Audit the whole pipeline, not just the headline model |
| **Browser packages** | `@huggingface/transformers@4.3.2` still hard-depends on `sharp` (prebuilt libvips = LGPL) and `onnxruntime-node`, which is why `src/lib/santa/transcribe.ts` rejected it. `kokoro-js` → `phonemizer@1.2.1` **declares Apache-2.0 but bundles a 1.3 MB eSpeak NG build (GPL-3.0) plus `espeak-ng-data`** | In-browser ML = `onnxruntime-web` (MIT) + our own pre/post-processing. Never ship kokoro-js or phonemizer |
| **XTTS-v2** | Coqui Public Model License (non-commercial), and Coqui has shut down, so no commercial licence can be bought. Its code is MPL-2.0 | Dead end |
| **SenseVoice / emotion2vec / FunASR models** | FunASR MODEL_LICENSE says "for reference and learning purposes only" and has no commercial clause (the FunASR code itself is MIT) | Treat as non-commercial |

## 2. Matrix per need

Columns: **Quality** (evidence + my estimate) · **Speed** · **VRAM** · **Size** · **Code lic.** · **Weights
lic.** · **Commercial** · **API/local** · **Browser** · **Infra fit** (Offline bake CPU / Offline bake GPU /
Browser / Not usable). "HF providers" = paid inference (fal, Replicate…) exists. That is acceptable only
for a one-off bake, never at runtime.

### 2.1 Elf illustrations (felt elves Pépin, Grelotte, Noisette; Ziggy plush)
| Model | Use | Quality | Speed | VRAM | Size | Code | Weights | Commercial | API/local | Browser | Infra fit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **FLUX.2 [klein] 4B** | T2I + multi-ref edit | Good. BFL: "sub-second generation on consumer GPUs" (flux2 README) | very fast (distilled) | ≈13 GB+ | ≈8 GB bf16 (3.9B) + text encoder | Apache-2.0 | Apache-2.0 | yes | local, HF providers | no | Offline bake GPU |
| **Z-Image-Turbo** | T2I | "#1 open-source, 8th overall" on Artificial Analysis T2I (README, 2025-12) | 8 steps | ≈16 GB (README "fits… 16G") | ≈12 GB (6.2B) + Qwen3-4B encoder | Apache-2.0 | Apache-2.0 | yes | local, HF providers | no | Offline bake GPU (LoRA base) |
| **Qwen-Image-2512** | T2I, text in images | Top open quality, best text rendering (signs, labels) | slow (Lightning LoRA helps) | 24–48 GB (fp8 + offload) | ≈41 GB bf16 (20.4B) | Apache-2.0 | Apache-2.0 | yes | local, HF providers | no | Offline bake GPU |
| FLUX.1 [schnell] | T2I | Good, dated | fast | ≈24 GB | ≈24 GB (11.9B) | Apache-2.0 | Apache-2.0 | yes | local | no | Superseded |
| SD3.5 Large | T2I | Medium | medium | ≈18 GB | ≈16 GB (8.1B) | Apache (diffusers) | Stability Community (unverified, gated) | <$1M revenue + registration | local | no | Not recommended |
| FLUX.1 [dev] | T2I | Very good | medium | ≈24 GB | 11.9B | Apache-2.0 | **NC** | **no** | local | no | Not usable |
| HiDream-I1-Full | T2I | Very good | slow | 40 GB+ | 17.1B + Llama-3.1-8B | MIT | MIT + **Llama 3.1 licence** | conditions | local | no | Not recommended |

### 2.2 Consistent characters (same elves every time)
| Model | Use | Quality | Speed | VRAM | Size | Code | Weights | Commercial | API/local | Browser | Infra fit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Qwen-Image-Edit-2511** | 1–3 refs + instruction | Best open identity keeping. 2511 improved consistency over 2509 (Qwen blog). Best with 1–3 inputs (lutins-research) | slow | 24–48 GB | ≈41 GB (20.4B) | Apache-2.0 | Apache-2.0 | yes | local, HF providers | no | Offline bake GPU |
| **LoRA on Z-Image / klein-4B (ai-toolkit)** | Train an identity LoRA on owner-approved felt renders | Strongest lock once trained (my estimate, standard practice) | 1–3 h train once | 24 GB | LoRA ≈ 50–300 MB | MIT (toolkit) | inherits the Apache base | yes | local | no | Offline bake GPU |
| OmniGen2 | In-context multi-image | Medium-good. Its template = our Lutins prompt skeleton | medium | ≈17 GB | ≈8 GB (4B) | Apache-2.0 | Apache-2.0 | yes | local | no | Offline bake GPU |
| FLUX.2 [klein] 4B | Multi-reference edit | Good | fast | ≈13 GB | 3.9B | Apache-2.0 | Apache-2.0 | yes | local | no | Offline bake GPU |
| FLUX.1 Kontext [dev], UNO/DreamO/USO | In-context | Very good | — | — | — | Apache-2.0 | **FLUX NC** | **no** | — | — | Not usable |

*Fit note:* our characters already exist as 3D models (`makeZiggy()`, the elf models). The cheapest
consistency is still **render a reference in three.js → edit / LoRA from that**. For the 3D games
themselves, image models only make 2D assets (icons, posters, loading art, textures). The in-game
characters stay code-built.

### 2.3 Image → video (cutscenes, trailer, Lutins clips)
| Model | Use | Quality | Speed | VRAM | Size | Code | Weights | Commercial | API/local | Browser | Infra fit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Wan2.2-TI2V-5B** | I2V 720p 24 fps, ~5 s | Good. Aimed at one consumer GPU (README) | minutes per clip on a 4090-class GPU | ≈24 GB | ≈10 GB (5B) | Apache-2.0 | Apache-2.0 | yes | local, HF providers | no | Offline bake GPU |
| **Wan2.2-I2V-A14B** | I2V 480/720p | Best open I2V (my estimate, community consensus) | slow | 80 GB (or offload) | ≈57 GB (2×14B experts) | Apache-2.0 | Apache-2.0 | yes | local, HF providers | no | Offline bake GPU (rental) |
| LTX-Video 0.9.8 | Fast I2V | Medium-good, fastest | real-time class | 2B: ≈12 GB | 2B 6.3 GB, 13B 28.6 GB (file listing) | Apache-2.0 | LTXV Open Weights (<$10M revenue) | conditions | local | no | Fallback |
| LTX-2 | Audio + video | Good | medium | large | 18.9B | Apache-2.0 | LTX-2 Community (≥$10M paid) | conditions | local, HF providers | no | Watch |
| CogVideoX1.5-5B-I2V | I2V | Medium | slow | ≈24 GB | 5.6B | Apache-2.0 | CogVideoX Lic. (registration, ≤1M visits/month) | conditions | local | no | Not recommended |
| HunyuanVideo-I2V / FramePack | I2V | Good | — | — | — | Hunyuan | **EU-excluded** | **no (France)** | — | — | Not usable |

### 2.4 Character animation
| Model | Use | Quality | Speed | VRAM | Size | Code | Weights | Commercial | API/local | Browser | Infra fit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **three.js keyframes / procedural (existing)** | All in-game animation | Fully under our control, deterministic | real time | — | KB | ours | — | yes | browser | yes | **Browser (keep)** |
| **Wan2.2-Animate-14B** | Re-animate an elf still from a driving video (an adult mimes) | Good (my estimate) | slow | 40–80 GB | ≈35 GB (17.3B) | Apache-2.0 | Apache-2.0 | yes | local | no | Offline bake GPU (trailer only) |
| LivePortrait | Face retargeting | Good on humans; felt faces unproven | fast | ≈6 GB | small ONNX | MIT | MIT + **InsightFace NC** detector | only with a MediaPipe swap | local | partial | Not recommended |
| AnimateDiff | SD1.5 motion | Dated | medium | ≈10 GB | — | Apache-2.0 | Apache + OpenRAIL-M base | conditions | local | no | Not recommended |

### 2.5 TTS (French + English, child-appropriate voices)
| Model | Use | Quality | Speed | VRAM | Size | Code | Weights | Commercial | API/local | Browser | Infra fit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Kokoro-82M** (in production) | Narrator, Ziggy's voice | High for its size (top of the TTS Spaces Arena in 2025). **Only one French voice** | very fast on CPU | none | 325 MB fp32 (verified in voice-engine) | Apache-2.0 | Apache-2.0 | yes | local | yes via ONNX, **but kokoro-js = GPL eSpeak** | **Offline bake CPU (adopted)** |
| **Qwen3-TTS-12Hz 1.7B VoiceDesign / CustomVoice / Base** | **Design new elf voices from a text description**, emotion by instruction, 3 s cloning | High. 10 languages incl. French. "97 ms" streaming latency (README) | GPU recommended; CPU slow | ≈6–8 GB | ≈3.8 GB (1.9B); 0.6B variants exist | Apache-2.0 | Apache-2.0 | yes | local, HF provider | no | Offline bake GPU (CPU possible) |
| **Chatterbox Multilingual V3** | Cloning from an authorised/designed voice, emotion-exaggeration knob, **Perth watermark** | High. 23+ languages incl. French. V3 "reduced hallucinations" (README) | medium | ≈4 GB | ≈2 GB (0.5B) | MIT | MIT | yes | local, HF providers | no | Offline bake GPU/CPU |
| Fun-CosyVoice3-0.5B | Cloning + instruct (emotion, speed), 9 languages incl. French | High (paper metrics vs CosyVoice2) | medium | ≈4 GB | ≈2 GB + flow/vocoder | Apache-2.0 | Apache-2.0 | yes | local | no | Offline bake GPU |
| Kyutai TTS 1.6B en_fr | Native French streaming TTS | Good French | fast on GPU | ≈6 GB | ≈3.2 GB | MIT + Apache | CC-BY-4.0. **Avoid the `expresso/` and `ears/` voices (NC)** | yes, with attribution | local | no | Offline bake GPU |
| MeloTTS-French | Fast CPU VITS | Medium | real time on CPU | none | small | MIT | MIT | yes | local | possible | Not needed |
| F5-TTS · Fish S1-mini · XTTS-v2 · OmniVoice | Cloning TTS | High | — | — | — | MIT / Fish Community / MPL / Apache | **NC · NC-SA · Coqui NC · undeclared** | **no** | — | — | Not usable |
| Supertonic · Kitten TTS | Tiny browser TTS | Medium/low | very fast | none | tiny | — / Apache | OpenRAIL / Apache | yes | local | yes | Not usable (English only) |

Child-appropriate voices, our position: **never clone a child**. The elves get *designed* voices
(Qwen3-TTS VoiceDesign: "a small cheerful elf, bright and bouncy, gentle"), and then our existing
WORLD + STFT child-voice filter and prosody engine shape them, as already done for Ziggy.

### 2.6 STT (on device)
| Model | Use | Quality | Speed | VRAM | Size | Code | Weights | Commercial | API/local | Browser | Infra fit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Chrome on-device recognition (existing)** | Live use (Santa call) | Good | real time | — | language pack | browser | — | yes | device | Chrome only | **Keep** |
| **sherpa-onnx WASM keyword spotting** | Few-word voice commands for pre-readers ("vite !", elf names) | Robust on small vocabularies (my estimate) | real time on a phone | — | a few MB | Apache-2.0 | depends on the model (check each) | yes | device | **yes** | Browser |
| **Whisper base/small ONNX** (onnxruntime-web) | Fallback for Safari/Firefox | Medium in French. Child speech degrades every ASR (known) | near real time (WebGPU) | — | base ≈80 MB q8, small ≈250 MB q8 (≈) | MIT | MIT / Apache (ONNX) | yes | device | **yes** | Browser |
| **whisper-large-v3-turbo** | Offline QA: transcribe our baked lines, compare to the script | High | fast on GPU, OK on CPU | ≈4 GB | ≈1.6 GB fp16 (809M) | MIT | MIT | yes | local | (WebGPU demo exists, too big) | Offline bake CPU/GPU |
| Parakeet-TDT-0.6B-v3 | Offline QA judge, 25 EU languages | Very high (Open ASR leaderboard tier) | very fast on GPU | ≈3 GB | ≈1.2 GB fp16 / ≈650 MB int8 (≈) | Apache-2.0 | CC-BY-4.0 | yes, with attribution | local | heavy | Offline bake |
| Kyutai STT 1B en_fr | Streaming FR/EN | Good | — | — | ≈2 GB | MIT + Apache | CC-BY-4.0 | yes | local | WASM demo, heavy | Not needed now |
| Moonshine | Tiny on-device STT | Good in English | very fast | — | ≈60 MB | MIT | MIT (non-English legacy = NC) | yes | device | yes | Not usable (no French) |
| SenseVoice · Fun-ASR-Nano · MMS | STT | — | — | — | — | MIT / Apache / — | FunASR "learning only" · Apache (no French) · **NC** | no / — / no | — | — | Not usable |

### 2.7 Authorised voice cloning
Only from (a) a consenting **adult** (owner or a contracted voice actor, written release covering AI
synthesis), or (b) a **synthetic designed voice**. Never a child's voice. Never a celebrity "sound-alike".
| Model | Use | Quality | Code | Weights | Commercial | Infra fit |
|---|---|---|---|---|---|---|
| **Qwen3-TTS Base (3 s clone) + VoiceDesign** | Design once, then clone the design for stable identity across thousands of lines | High | Apache-2.0 | Apache-2.0 | yes | Offline bake GPU |
| **Chatterbox Multilingual V3** | Cloning with a built-in imperceptible watermark (Perth) | High | MIT | MIT | yes | Offline bake GPU/CPU |
| Fun-CosyVoice3-0.5B | Cloning + instruct | High | Apache-2.0 | Apache-2.0 | yes | Offline bake GPU |
| OpenVoice V2 | Tone-colour conversion | Medium | MIT | MIT | yes | Superseded |
| XTTS-v2 · F5 · Fish | — | — | — | NC | **no** | Not usable |

### 2.8 Lip sync
| Model | Use | Quality | Speed | VRAM | Code | Weights | Commercial | Infra fit |
|---|---|---|---|---|---|---|---|---|
| **Visemes from `voice-engine` → morph targets / 2D mouth sprites** | All in-game talking (3D elves, Ziggy) | Exact, deterministic. The engine already writes visemes | real time | — | ours | — | yes | **Browser (no ML)** |
| Wan2.2-S2V-14B | Audio-driven video of a felt character (it renders the whole shot, so no face detector) | Good (my estimate) | slow | 40–80 GB | Apache-2.0 | Apache-2.0 | yes | Offline bake GPU (trailer) |
| EchoMimicV3 (1.3B) | Light audio-driven animation | Medium | medium | ≈12 GB (≈) | Apache-2.0 | Apache-2.0 | yes | Offline bake GPU |
| LatentSync 1.5 | Redub the mouth of an existing (Agnes) clip | Good on humans; felt unproven | — | 8 GB (README) | Apache-2.0 | OpenRAIL++ | yes, use restrictions | Offline bake GPU (low priority) |
| MuseTalk 1.5 | Real-time redub | Medium-good on humans | 30 fps on V100. 4 GB laptop GPU: ~5 min per 8 s (README) | 4 GB+ | MIT | MIT + third-party parts | yes | Offline (low priority) |
| Wav2Lip · LivePortrait-InsightFace | — | — | — | — | — | NC parts | **no** | Not usable |

### 2.9 Sound effects
| Model | Use | Quality | Speed | VRAM | Size | Code | Weights | Commercial | Infra fit |
|---|---|---|---|---|---|---|---|---|---|
| **Code-built Web Audio SFX (existing approach)** | Taps, pops, UI | Unlimited variation, 0 bytes | real time | — | — | ours | — | yes | **Browser (keep)** |
| **MOSS-SoundEffect** | Text→SFX (splash, flour poof, conveyor clank) | Unmeasured (new, Mar 2026) | slow | ≈20 GB | ≈17 GB (8.4B) | Apache-2.0 | Apache-2.0 | yes | Offline bake GPU |
| Stable Audio Open Small | Text→SFX on CPU/phone class | Medium | fast on CPU (Arm-optimised) | none | ≈1 GB | MIT | Stability Community (unverified) | <$1M revenue + registration | Offline bake CPU (owner sign-off) |
| Stable Audio Open 1.0 | Text→SFX/ambience ≤47 s | Good | medium | ≈8 GB | ≈2.4 GB | MIT | Stability Community (unverified) | same | Offline bake GPU (owner sign-off) |
| MMAudio · TangoFlux · AudioGen · AudioLDM2 | — | Good | — | — | — | MIT / — | **NC** | **no** | Not usable |
| HunyuanVideo-Foley | Video→Foley | Good | — | — | — | — | **EU-excluded** | **no** | Not usable |

### 2.10 Music
| Model | Use | Quality | Speed | VRAM | Code | Weights | Commercial | Infra fit |
|---|---|---|---|---|---|---|---|---|
| **ACE-Step 1.5** | Loops, stems, sung FR/EN jingles | "Between Suno v4.5 and v5" (authors' claim). 50+ languages | "under 10 s per song on RTX 3090" (README) | consumer GPU | MIT | MIT | yes | Offline bake GPU |
| ACE-Step v1 3.5B | Same | Good | slower | ≈12 GB+ | Apache-2.0 | Apache-2.0 | yes | Superseded |
| YuE s1 7B | Songs with vocals | Good | very slow | 24 GB+ | Apache-2.0 | Apache-2.0 | yes | Not needed |
| DiffRhythm 1.2 | Full songs | Medium | fast | — | Apache-2.0 | **undeclared** | unknown | Not usable |
| MusicGen | Text→music | Medium | — | — | MIT | **CC-BY-NC** | **no** | Not usable |

### 2.11 Emotion understanding
**Red line:** no model infers a child's emotion from face, voice or text. Beyond our own rule, EU AI
Act Art. 5(1)(f) prohibits emotion-inference systems in education institutions and workplaces. Ziggy is
not a school, but a learning product for 4–12-year-olds is close enough that we treat it as banned, and
GDPR for minors points the same way. Emotion models are therefore used **only on our own baked content**.
| Model | Use (our content only) | Quality | Code | Weights | Commercial | Infra fit |
|---|---|---|---|---|---|---|
| **LLM emotion tags (Qwen3-4B / Ministral-3-3B)** | Tag each script line `{mischievous, surprised, proud, giggly, calm}` (never sad) to drive TTS instruct + elf animation | Good (my estimate) | Apache-2.0 | Apache-2.0 | yes | Offline bake CPU |
| **Qwen2.5-Omni-7B** | Audio judge: does the baked take match its tag? | Good | Apache-2.0 | **Apache-2.0** (the 3B is NC!) | yes | Offline bake GPU |
| Qwen3-Omni-30B-A3B | Stronger judge | Very good | Apache-2.0 | Apache-2.0 | yes | Offline bake GPU (rental) |
| emotion2vec+ · SenseVoice emotion | Speech emotion | Good | MIT | FunASR "learning only" | **no** | Not usable |
| vit-face-expression | Child face emotion | — | Apache-2.0 | Apache-2.0 | — | **Red line: never** |
| j-hartmann distilroberta | Text emotion | Good (English) | — | **undeclared** | unknown | Not usable |

### 2.12 Dialogue generation (scripted and offline only; no free chat for children)
| Model | Use | Quality (FR) | Speed | Size | Code | Weights | Commercial | Infra fit |
|---|---|---|---|---|---|---|---|---|
| **Qwen3-4B-Instruct-2507** via llama.cpp | Draft elf barks, hint trees, variants → human review → ChildShield → JSON schema | Good (my estimate) | CPU tokens/s, fine for a batch | Q4 ≈2.5 GB | Apache-2.0 / llama.cpp MIT | Apache-2.0 | yes | **Offline bake CPU** |
| **Ministral 3 3B Instruct** | Same; French register | Good (French lab) | CPU OK | Q4 ≈2.4 GB | Apache-2.0 | Apache-2.0 | yes | Offline bake CPU |
| SmolLM3-3B | Same, fully open recipe | Medium-good | CPU OK | Q4 ≈1.9 GB | Apache-2.0 | Apache-2.0 | yes | Offline bake CPU |
| Qwen3-0.6B / 1.7B | Classification / tagging only | Low for creative work | very fast | 0.5–1.2 GB | Apache-2.0 | Apache-2.0 | yes | Offline bake CPU |
| Phi-4-mini · Gemma 3 · LFM2 | — | — | — | — | MIT / Apache / — | MIT / **Gemma terms** / **LFM custom** | yes / conditions / conditions | Not preferred |

A browser LLM (e.g. Qwen3-0.6B WebGPU) is **rejected**: it would amount to free generation in front of
a child. DeepSeek (already wired in) stays the higher-quality drafting option, but it is per-call. The
local models make bulk drafts free.

### 2.13 Object recognition
| Model | Use | Quality | Speed | Size | Code | Weights | Commercial | Browser | Infra fit |
|---|---|---|---|---|---|---|---|---|---|
| **Florence-2 base/large** | Offline QA of generated art (caption, count, OCR); auto alt-text | Good | fast | base ≈0.46 GB, large ≈1.5 GB fp16 | MIT | MIT | yes | base-ft ONNX | Offline bake CPU / Browser |
| **OWLv2 base** | Count elves by description ("striped hat", "acorn hood") in Lutins outputs | Good (open-vocab) | medium | ≈620 MB fp32 | Apache-2.0 | Apache-2.0 | yes | possible | Offline / server-free check |
| **RF-DETR base (ONNX)** | On the parent's photo, on device: find table / couch / bed / shelf for the Lutins stage finder | Good (COCO) | real time | ≈30M params (≈) | Apache-2.0 | Apache-2.0 | yes | **yes** | Browser |
| SAM 2.1 tiny | Masks for refs / stage boxes | Good | fast | 39M | Apache-2.0 | Apache-2.0 | yes | yes | Browser / offline |
| Grounding DINO tiny | Open vocabulary | Good | medium | 172M | Apache-2.0 | Apache-2.0 | yes | ONNX exists | Duplicate |
| Ultralytics YOLO | Detection | Very good | real time | — | **AGPL** | **AGPL** | **no** | — | Not usable |

### 2.14 Background removal
| Model | Use | Quality | Speed | Size | Code | Weights | Commercial | Browser | Infra fit |
|---|---|---|---|---|---|---|---|---|---|
| **BiRefNet** | Cut out refs, sprites, icons at high resolution | Best permissive (RMBG-2.0 is BiRefNet retrained, and NC) | seconds on CPU | ≈0.9 GB fp32 (221M) | MIT | MIT | yes | heavy | **Offline bake CPU** |
| **BiRefNet_lite ONNX** | On-device cut-out | Good | ~1 s WebGPU (≈) | ≈0.2 GB (≈) | MIT | MIT | yes | **yes** | Browser |
| BEN2 base | Second opinion (felt/hair edges) | Good | fast | ≈0.4 GB | MIT | MIT | yes | ONNX | Offline |
| MediaPipe selfie (existing) / MODNet | People only | Good for portraits | real time | small | Apache-2.0 | Apache-2.0 | yes | yes | Keep (Santa) |
| RMBG-2.0 / RMBG-1.4 | — | Very good / good | — | — | Bria | **NC** | **no** | — | Not usable |

### 2.15 Upscaling
| Model | Use | Quality | Speed | Size | Code | Weights | Commercial | Infra fit |
|---|---|---|---|---|---|---|---|---|
| **Real-ESRGAN (xinntao)** x4plus / anime-6B | 1024 → 4096 for hi-DPI posters, textures, print | Good on generated art | CPU slow, ncnn-Vulkan fast | ≈64 MB | BSD-3 | BSD-3 (GitHub releases) | yes | **Offline bake CPU** |
| SwinIR | Upscaling | Good, slower | slow | small | Apache-2.0 | Apache-2.0 | yes | Not needed |
| Swin2SR ONNX | In-browser 2× | Medium | slow on phones | small | Apache-2.0 | Apache (base); the ONNX repo is undeclared | yes | Not needed (upscale at bake time) |
| ai-forever/Real-ESRGAN | — | — | — | — | — | undeclared | unknown | Not usable |

## 3. Top pick per need

| # | Need | Top pick | Runner-up | Where it runs |
|---|---|---|---|---|
| 1 | Elf illustrations | **FLUX.2 [klein] 4B** (Apache, fast, edits) | Z-Image-Turbo; Qwen-Image-2512 for text | Offline GPU bake |
| 2 | Consistent characters | **Qwen-Image-Edit-2511** from the fixed felt line-up ref | Identity LoRA on Z-Image/klein-4B (ai-toolkit) | Offline GPU bake |
| 3 | Image→video | **Wan2.2-TI2V-5B** | Wan2.2-I2V-A14B (rental) | Offline GPU bake |
| 4 | Character animation | **three.js code animation** (in game); Wan2.2-Animate for trailers | — | Browser / offline |
| 5 | TTS FR+EN | **Kokoro (keep) + Qwen3-TTS VoiceDesign for the elves** | Chatterbox Multilingual V3 | Offline bake |
| 6 | STT | **Chrome local (keep) + sherpa-onnx keyword spotting** | Whisper-base ONNX via onnxruntime-web | Device |
| 7 | Authorised cloning | **Qwen3-TTS Base cloning a *designed* voice** | Chatterbox (watermarked) | Offline bake |
| 8 | Lip sync | **Engine visemes → morph targets** | Wan2.2-S2V for trailer shots | Browser / offline |
| 9 | Sound effects | **MOSS-SoundEffect** (Apache) + code-built SFX | Stable Audio Open Small (owner registers) | Offline bake |
| 10 | Music | **ACE-Step 1.5** (MIT) | — | Offline GPU bake |
| 11 | Emotion understanding | **LLM tags on our scripts + Qwen2.5-Omni-7B judge on our audio**; nothing on children | Qwen3-Omni | Offline |
| 12 | Dialogue (scripted) | **Qwen3-4B-Instruct-2507 via llama.cpp** | Ministral 3 3B (A/B in French) | Offline CPU |
| 13 | Object recognition | **Florence-2** (QA) + **RF-DETR** (on-device stage finder) | OWLv2 (count elves) | Offline / browser |
| 14 | Background removal | **BiRefNet** | BiRefNet_lite ONNX in the browser | Offline CPU / browser |
| 15 | Upscaling | **Real-ESRGAN (xinntao, BSD-3)** | — | Offline CPU |

## 4. What this changes for the two games

### LUTIN CHAOS (3D house; the elves pull pranks)
1. **A voice for every prank, in both languages.** Each elf gets ~150 short barks (giggles, "Oups !",
   "À moi la confiture !"). They are drafted offline (Qwen3-4B / Ministral, A/B), human-reviewed, checked
   by ChildShield and stored as JSON. They are voiced with **designed** voices (Qwen3-TTS VoiceDesign →
   Pépin bouncy, Grelotte bell-like, Noisette tiny and soft), then passed through our child-voice filter
   and prosody engine. Emotion tags (mischievous / surprised / proud, never sad) drive both the TTS
   instruction and the elf's animation clip. Little ones get audio on everything, which is already the
   `SayButton` / `useAutoSay` rule.
2. **Talking elves in 3D at zero cost.** The voice engine's visemes drive mouth morph targets on the
   elves and Ziggy. No lip-sync model is needed in game.
3. **Prank sounds with character.** The bake produces 3–5 variants per prank (splash, flour poof, sock
   boing, bell jingle) with MOSS-SoundEffect, loudness-normalised with the same tooling as the dodo
   audio. Runtime picks one at random and nudges its pitch in Web Audio. Generic UI sounds stay code-built.
4. **Adaptive music.** ACE-Step 1.5 makes calm / chase / "prank caught!" stems in one key and tempo. The
   game cross-fades layers by action intensity. Victory jingles celebrate; there are no failure stings
   (red line).
5. **The house looks lived-in.** Wall posters, framed pictures, rugs and wallpaper are made with
   klein-4B / Z-Image (an elf LoRA keeps them on-model), cut out with BiRefNet, upscaled with
   Real-ESRGAN, and baked into the texture atlas. Florence-2 / OWLv2 auto-reject any image with wrong
   elf counts, text artefacts or people.
6. **Intro cutscene and trailer.** A klein/Qwen-Edit still of the elves sneaking in → Wan2.2-TI2V-5B
   5 s clip (Lutins video template) → optional Wan2.2-S2V shot of Pépin announcing the game. All baked
   once.
7. **Optional voice play for pre-readers.** sherpa-onnx keyword spotting ("Attrape !", "Stop Pépin !")
   on the device, off by default, with no audio ever leaving the phone.

### LUTIN FACTORY (toy-factory building / logic)
1. **A coherent icon set for hundreds of parts** (gears, wheels, paint pots, ribbons, springs), all in
   the same felt style. A style LoRA on klein-4B / Z-Image + BiRefNet cut-outs + a sprite atlas give
   consistency a hand-drawn set would take weeks to reach. Qwen-Image-2512 handles in-world text
   (machine labels, signs in FR/EN).
2. **Spoken hint trees.** A scripted, deterministic progression of hints per level (drafted offline,
   reviewed). Grelotte "explains", Ziggy narrates with Kokoro, and every hint is read aloud. There is no
   free AI help at runtime.
3. **The factory sounds like a factory:** conveyor hum, stamping, bell on completion. These are baked
   SFX, with machine loops tempo-locked to ACE-Step background music so the rhythm "clicks" when a chain
   works (positive feedback, no failure sound).
4. **"Draw your toy" (optional, on device).** A child draws on the canvas, BiRefNet_lite cuts it out in
   the browser via onnxruntime-web, and it becomes the texture of the toy riding the belt. Nothing is
   uploaded and nothing is stored server-side.
5. **Celebration clips:** a few Wan2.2 clips of the elves unwrapping the finished toy, baked once and
   played as rewards.

### Shared pipeline benefits (also for `/lutins`)
- **Better refs:** BiRefNet + SAM 2.1 produce the segmented, shadow-free line-up ref that
  lutins-research recommends (#1–2).
- **A better verifier:** OWLv2 / Florence-2 "exactly three elves, each with its signature item" on top
  of the colour blobs (rec #7), offline or in a nightly job with no paid call.
- **Open fallback for Agnes:** if Agnes pricing or availability changes, Qwen-Image-Edit-2511 +
  Wan2.2-TI2V-5B cover the same image→video flow with Apache weights (on a rented GPU; this would be a
  running cost only if used nightly, so it stays a fallback unless the owner decides otherwise).
- **Audio QA loop:** whisper-large-v3-turbo / Parakeet round-trip WER plus the Qwen2.5-Omni-7B tone
  check before any baked line ships (complements the listen-proxy checks in `voice-engine/README.md`).

## 5. Recommended next steps (each one needs an owner OK first)
1. **CPU-only, now:** BiRefNet, Real-ESRGAN, Florence-2, Qwen3-4B / Ministral (llama.cpp) and
   whisper-turbo QA. These need no GPU and no new cost.
2. **One GPU session (one-off):** Qwen3-TTS VoiceDesign elf voices (owner approves each voice), a
   klein-4B / Z-Image elf LoRA, ACE-Step stem packs, MOSS-SoundEffect variants, 3–5 Wan2.2-TI2V clips.
   Commit only the outputs.
3. **Browser:** add `onnxruntime-web` (MIT) behind a lazy import for BiRefNet_lite / RF-DETR /
   Whisper-base, with our own pre/post-processing and no transformers.js. List each model's licence in
   `THIRD_PARTY_LICENSES.md` (CC-BY models such as Parakeet and Kyutai need attribution).
4. **Transparency:** synthetic voices and videos should be marked. AI Act Art. 50 transparency duties
   apply from Aug 2026 (my reading; legal check advised). Chatterbox's watermark and a visible "voix
   créées par IA" credit in the parent area cover it cheaply.
5. **Verify before shipping:** run every pick once and keep the evidence (screenshots, spectrograms,
   WER). Nothing here has been run yet.

## 6. Not verified in this session
- The gated cards (FLUX.1-dev on the HF side, SD3.5, Stable Audio Open 1.0/Small, RMBG-2.0). Their
  licences come from BFL's GitHub file, stability.ai/license, the TangoFlux card and Bria's GitHub.
- The ACE-Step 1.5 **XL** (4B) licence. The LTX-2 and LFM2 licence bodies (only their names and
  revenue clauses were read). The ThinkSound and Supertonic code licences (no LICENSE found).
- All speed, VRAM and quality figures (authors' claims or my estimates; no run). The Hugging Face MCP
  began asking for approval partway through the session, so file-size listings were not re-checked. Sizes
  marked ≈ are derived from parameter counts.

## Sources
- Hugging Face model cards (licence fields read 2026-11-09): every `hf.co/<id>` linked in `registry.md`,
  plus `LICENSE` files of zai-org/CogVideoX-5b-I2V, tencent/HunyuanVideo-I2V,
  Lightricks/LTX-Video (`LTX-Video-Open-Weights-License-0.X.txt`), Qwen/Qwen2.5-Omni-3B, and the READMEs of
  coqui/XTTS-v2, FunAudioLLM/SenseVoiceSmall, declare-lab/TangoFlux, kyutai/tts-voices, briaai/RMBG-1.4,
  Lightricks/LTX-2, tencent/HunyuanVideo-Foley, LiquidAI/LFM2-1.2B.
- GitHub (raw): black-forest-labs/flux `model_licenses/LICENSE-FLUX1-dev`; black-forest-labs/flux2 README
  (klein licence table); modelscope/FunASR `MODEL_LICENSE` + `LICENSE`; LICENSE files of Wan2.2, LatentSync,
  Real-ESRGAN, SwinIR, LivePortrait, BiRefNet, OmniVoice, chatterbox, CosyVoice, MMAudio, ACE-Step-1.5,
  F5-TTS, coqui-ai/TTS, fish-speech, Qwen3-TTS, NeMo, whisper, stable-audio-tools, MOSS-TTS, LTX-2,
  LTX-Video, OmniGen2, Qwen-Image, Z-Image, CogVideo, echomimic_v3, InfiniteTalk, GroundingDINO, rf-detr,
  sam2, BEN2, MeloTTS, OpenVoice, moonshine, YuE, DiffRhythm, ACE-Step, AnimateDiff, ai-toolkit,
  sherpa-onnx, llama.cpp, KittenTTS, diffusers, mistral-inference; READMEs of Wan2.2, chatterbox,
  CosyVoice, Z-Image, ACE-Step-1.5, Qwen-Image, Qwen3-TTS, MuseTalk, LatentSync, kyutai delayed-streams-modeling,
  deepinsight/insightface (model licence statement).
- npm registry: `@huggingface/transformers@4.3.2` (dependencies), `onnxruntime-web@1.31.1`,
  `kokoro-js@1.2.1`, `phonemizer@1.2.1` (tarball inspected: bundled eSpeak NG data).
- Stability AI licence page: https://stability.ai/license ; Bria RMBG-2.0: https://github.com/Bria-AI/RMBG-2.0
- In-repo: `CLAUDE.md`, `docs/lutins-research.md`, `docs/AI_PROVIDERS.md`, `voice-engine/README.md`,
  `src/lib/santa/transcribe.ts`, `THIRD_PARTY_LICENSES.md`.
