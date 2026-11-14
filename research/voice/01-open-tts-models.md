# 01 — Open-source TTS models (state of the art, November 2026)

Research report for the Ziggy voice app (Hyper Engine). Scope: open TTS models and their code,
2025–2026 releases first. Written 2026-11-14.

**How this was checked.** Model cards and licence metadata were read on the Hugging Face Hub;
code licences were read from each repository's `LICENSE` file on GitHub; ten repositories were
shallow-cloned and read (ZONOS3-Mini, VoxCPM, Qwen3-TTS, CosyVoice, Chatterbox, Pocket TTS,
Kokoro, Supertonic, KittenTTS, OmniVoice, Step-Audio-EditX; clones deleted afterwards; no weights
downloaded). Arena scores come from secondary web sources (the Artificial Analysis and TTS Arena
pages could not be opened from this sandbox), so they are marked as indicative. "Weights licence"
always means the licence on the checkpoint, checked separately from the code licence.

Ziggy's licence rule (CLAUDE.md): MIT / Apache-2.0 / BSD for anything shipped or run; ISC and
anything else (CC-BY-4.0, OpenRAIL, community licences) needs the owner's OK; never GPL / AGPL /
LGPL / MPL, never NC or research-only weights.

---

## 1. What Ziggy has today (the baseline to beat)

From `voice-engine/README.md` and `docs/DODO_VOICE.md` (this repo):

- **Engine**: Kokoro-82M (Apache-2.0, StyleTTS2-family, 82M parameters) run offline from Rust
  through ONNX Runtime (`ort`). The ONNX graph is patched in Rust to expose predicted phoneme
  durations and to inject per-phoneme duration scales/frames, an F0 curve and an energy curve
  between the predictor and the decoder (no weights changed).
- **Prosody**: rule-based "storyteller" analysis (`intonation.rs`, `contour.rs`): questions, lists,
  suspense, emphasis, hierarchical pauses, keyword-based sentiment, then imposed inside the network.
  Measured gains v2 → v3: rising closed questions 0/36 → 29/36, emphasised words above neighbours
  54 % → 68 %.
- **Child voice**: `ff_siwis` (Kokoro's only French voice) blended with 30 % `af_heart` timbre,
  pitch ×1.22 inside the network, formants ×1.09 via the WORLD vocoder envelope.
- **Outputs**: MP3 + `timing.json` (exact word start times and visemes from the model's own phoneme
  durations), −18 LUFS mastering. Santa: Kokoro blend + WORLD ageing (Python `santa_voice_v2`).
- **Documented limits** (README "Ce qui reste imparfait"): sentiment from keywords only, no parser,
  emphasis not always the highest word, ~100 dialogue fragments per language fall back to a
  generic voice, chunks synthesised separately.

What a real step up means for Ziggy, concretely:
1. **Learned expressiveness** (emotion, whisper, laughter, breath, warmth) instead of rules alone.
2. **More than one decent French voice**; Kokoro's French is its weakest language. Paradee's
   evaluation of Kokoro itself gives `ff_siwis` UTMOS 3.65 vs 4.52 for `af_heart` (UTMOS is
   English-trained, so compare only side by side) and WER 6.8 % vs 3.0 %
   ([Paradee-8M card](https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.3)).
3. **Character voices** (Ziggy, Santa, elves, grandparents) designed rather than pitch-shifted.
4. **Keep what Kokoro gives for free**: exact word timings and visemes, determinism, offline,
   zero running cost, all 12 locales eventually (fr, en, es, de, pt, it, nl, tr, ja, ko, zh, ar:
   `src/i18n/config.ts`).

Kokoro itself has no successor from its author: the Hub shows only Kokoro-82M (last changed
April 2025) and v1.1-zh ([hexgrad on HF](https://huggingface.co/hexgrad)); the GitHub repo's last
commit is August 2025 ([hexgrad/kokoro](https://github.com/hexgrad/kokoro)).

---

## 2. The landscape in late 2026 (what changed since 2025)

1. **Codec language models with voice design took over the top.** Almost every 2026 flagship is
   an LLM backbone predicting audio-codec tokens, with *voice design from a text description*
   (no reference audio): Qwen3-TTS (Jan 2026), VoxCPM2 (Apr 2026), Ming-3.0-tts (Sep 2026),
   ZONOS3-Mini (Nov 2026), Fish S2 Pro / Drama-3, Higgs TTS 3, Breeze TTS 2, Voxtral TTS.
2. **The best-scoring open-weight models are mostly not open-licence.** Fish S2 Pro and Drama-3
   (research licence), Higgs TTS 3 (research and non-commercial), Breeze TTS 2 (research and
   non-commercial), Voxtral TTS (CC-BY-NC-4.0) and OmniVoice (CC-BY-NC) are all unusable for Ziggy.
   Secondary reports put Voxtral TTS, Breeze TTS 2, Fish S2 Pro / Drama-3 and Step-Audio-EditX at
   the top of open-weight arenas in Aug–Nov 2026 (indicative only:
   [Artificial Analysis open-weights board](https://artificialanalysis.ai/text-to-speech/leaderboard/provider-voice/open-weights),
   [lukeocodes roundup](https://lukeocodes.dev/open-weights-eating-ai-best-open-tts-models),
   [teamday Nov 2026](https://www.teamday.ai/blog/best-ai-voice-models-2026)).
3. **Hugging Face now runs an Open TTS Leaderboard** (since 8 Sep 2026; WER, RTFx, speaker
   similarity, UTMOS; Seed-TTS, CV3-Eval, MiniMax sets; French included; CPU streaming TTFA)
   ([space](https://huggingface.co/spaces/hf-audio/open_tts_leaderboard),
   [changelog in leaderboard_data.py](https://huggingface.co/spaces/hf-audio/open_tts_leaderboard/blob/main/leaderboard_data.py)).
   Its results dataset is private, so numbers could not be pulled here; it is the right place to
   compare candidates in French before a decision.
4. **Small on-device models multiplied**: Pocket TTS (Kyutai, 100M, CPU), Kitten TTS 2 mini / nano
   / pico (82M / 17M / 7M, int8 ONNX), Supertonic 3 (99M, archived), Phonon (31–40M), Chatterbox
   Nano (110M), Paradee (8M, distilled from Kokoro).
5. **Two big projects were retired**: Chatterbox ("retired research … no longer maintained", Aug
   2026, [README](https://github.com/resemble-ai/chatterbox)) and Supertonic (archived,
   [README](https://github.com/supertone-inc/supertonic)). Microsoft pulled VibeVoice's long-form
   TTS code in Sept 2025 ([VibeVoice repo](https://github.com/microsoft/VibeVoice);
   [write-up](https://www.ai.joaoqueiros.com/blog/vibevoice-local-tts-microsoft-removed-code-safe-setup)).
   Piper's engine moved to GPL-3.0 (`OHF-Voice/piper1-gpl`; original repo archived Oct 2025)
   ([piper1-gpl](https://github.com/OHF-Voice/piper1-gpl),
   [release notes](https://newreleases.io/project/github/OHF-Voice/piper1-gpl/release/v1.5.0)).
6. **Training-data contamination of licences**: many models trained on Emilia, whose original
   101k-hour set is CC-BY-NC-4.0 (Emilia-YODAS additions are CC-BY-4.0)
   ([Emilia dataset card](https://huggingface.co/datasets/amphion/Emilia-Dataset)). OmniVoice says
   its weights are NC *because of* Emilia ([OmniVoice card](https://huggingface.co/k2-fsa/OmniVoice)).
   Several Apache-licensed models also list Emilia (NeuTTS Air, Marvis); the most interesting
   Apache models (Qwen3-TTS, VoxCPM2, CosyVoice3, ZONOS3-Mini) do not disclose their data. The
   licence on the weights is what governs Ziggy, but this is a residual risk to note.

---

## 3. Comparison table

Legend for "Ziggy": **Yes** = licence-clean (MIT/Apache/BSD code *and* weights) and useful;
**Owner OK** = permissive but outside the list (CC-BY-4.0); **Inspiration** = study only;
**No** = licence or capability rules it out. "Locales" = how many of Ziggy's 12 locales the model
lists. FR quality uses published numbers where they exist.

| Model (org) | Released / updated | Params | Code licence | Weights licence | Languages (FR; Ziggy locales) | Expressiveness controls | Streaming | CPU / on-device | Speed published | Ziggy |
|---|---|---|---|---|---|---|---|---|---|---|
| **ZONOS3-Mini** (Zyphra) [card](https://huggingface.co/Zyphra/ZONOS3-Mini), [code](https://github.com/Zyphra/ZONOS3-Mini) | 9–12 Nov 2026 | 886M total, ~100M active (MoE) | MIT | Apache-2.0 | 43 incl. FR (text normaliser + LACI heads for fr_fr); **12/12** | Steering vectors: 7 emotion axes, moods, styles, whisper spans, word emphasis, voice quality, pitch/range, **age/gender**, accents; per-span controls; speaking-rate/loudness buckets; speech editing; IPA overrides | Yes, 80 ms TTFA (H100) | Yes: C++/ggml (CPU/Vulkan/Metal), MLX, **WebGPU in browser**; 0.66 GB Q4/Q8 backbone | 457 s audio/s peak on H100; "real time on phones and laptops" | **Yes — top pick** |
| **VoxCPM2** (OpenBMB) [card](https://huggingface.co/openbmb/VoxCPM2), [code](https://github.com/OpenBMB/VoxCPM) | Apr 2026 | 2.29B | Apache-2.0 | Apache-2.0 | 30 incl. FR, AR; **12/12**; FR WER 9.85 (CV3), 4.53 (MiniMax), FR SIM 73.5 best in table | Voice design from description; style-guided cloning; LoRA fine-tune from 5–10 min | Yes | GGUF via llama.cpp-omni / VoxCPM.cpp; community ONNX | RTF 0.30 (RTX 4090), 0.13 with Nano-vLLM; RTF 1.76 on M4 Pro Metal | **Yes (offline studio)** |
| **Qwen3-TTS** (Alibaba Qwen) [code](https://github.com/QwenLM/Qwen3-TTS), [card](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign) | 22 Jan 2026 | 0.6B / 1.7B | Apache-2.0 | Apache-2.0 | 10 (zh en ja ko de fr ru pt es it); **9/12** (no nl, tr, ar); FR WER 2.86 MiniMax (best in VoxCPM2's table) | Voice design from description; natural-language instructions (emotion, tone, rate); 9 preset voices; "design then clone" workflow | Yes, 97 ms | GPU (vLLM); no official CPU path | — | **Yes (offline studio)** |
| **Fun-CosyVoice3-0.5B-2512** (Alibaba FunAudioLLM) [code](https://github.com/FunAudioLLM/CosyVoice), [card](https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512) | Dec 2025 | 0.5B | Apache-2.0 | Apache-2.0 | 9 incl. FR; **8/12**; CV3 FR WER 11.8 for the 1.5B variant (weak) | Instructions (emotion, speed, volume, dialect); pronunciation inpainting (pinyin / CMU) | Bi-streaming, 150 ms | GPU; ONNX parts; TRT-LLM | — | Yes, but weaker FR |
| **Chatterbox Multilingual V3 / Turbo / Nano** (Resemble AI) [code](https://github.com/resemble-ai/chatterbox), [ML](https://huggingface.co/ResembleAI/chatterbox), [Nano](https://huggingface.co/ResembleAI/chatterbox-nano) | 2025 → V3 2026; **retired Aug 2026** | 500M / 350M / 110M | MIT | MIT | ML: 23 incl. FR, AR; **12/12**. Turbo/Nano: EN only | `exaggeration` scalar (emotion intensity), CFG; paralinguistic tags (`[laugh]`, `[chuckle]`) in Turbo/Nano | — | Nano: 3× real time on 8 CPU cores | — | Yes, but unmaintained; Perth watermark on by default |
| **Audio8-TTS-Realistic-Air** (Edge0) [card](https://huggingface.co/Edge0/Audio8-TTS-Realistic-Air) | 14 Oct 2026 | 601M + codec | (repo not checked) | Apache-2.0 | 23 incl. FR, AR; **12/12** | Zero-shot cloning, generation without reference; DualAR "inspired by Fish S2 Pro" | GPU serving (SGLang) | GPU recommended | — | Candidate (new, unproven; `trust_remote_code`) |
| **Ming-3.0-tts-0.5B** (inclusionAI / Ant) [card](https://huggingface.co/inclusionAI/Ming-3.0-tts-0.5B) | 22 Sep 2026 | 0.5B backbone (1.48B with codec/DiT per Hub) | inclusionAI/Ming repo MIT; Ming-3.0-tts repo not checked | MIT | zh en de es fr ko ja; **7/12** | Voice design, free-form style instructions, emotion/speed/pitch/volume, 14 paralinguistic tags (zh/en) | — | Tested on H800/H20; community WASM demo | — | Candidate |
| **Pocket TTS** (Kyutai) [code](https://github.com/kyutai-labs/pocket-tts), [card](https://huggingface.co/kyutai/pocket-tts), [blog](https://kyutai.org/blog/2026-01-13-pocket-tts) | Jan 2026 (small EN models Oct 2026) | 100M (EN down to 1.9M) | MIT (code + **training code**) | **CC-BY-4.0** (gated) | en fr de pt it es nl; **7/12** | Voice cloning; continuous-latent (CALM) generation | Yes, ~200 ms | **Yes**: 6× real time on 2 cores (M4); Rust, ONNX, WASM, sherpa-onnx ports | 6× RT CPU | **Owner OK** (CC-BY-4.0) |
| **Kyutai TTS 1.6B en_fr** (DSM) [card](https://huggingface.co/kyutai/tts-1.6b-en_fr) | Sep 2025 | 1.6B | (Kyutai DSM repo) | CC-BY-4.0 | EN + **native FR**; 2/12 | Voice conditioning; streaming text-in | Yes | GPU | — | Owner OK; superseded by Pocket TTS for us |
| **Kitten TTS 2 mini / nano / pico** (KittenML) [code](https://github.com/KittenML/KittenTTS), [mini](https://huggingface.co/KittenML/kitten-tts-2-mini), [nano](https://huggingface.co/KittenML/kitten-tts-2-nano) | 13 Nov 2026 | 82M / 17M / 7M | Apache-2.0 | Apache-2.0 | mini 16 incl. FR; **10/12** (no zh, ar) | Preset voices (descriptions), speed | — | **int8 ONNX, CPU** (82 MB / 17 MB / 8 MB per language) | — | Yes (on-device fallback; 1 day old) |
| Kitten TTS 2 (1.7B, 1-bit) [card](https://huggingface.co/KittenML/kitten-tts-2) | 30 Sep 2026 | 1.7B | Apache-2.0 | Stellon Labs Community License | 20 incl. FR, AR | `[emotion]` tags, `<event>` tags, `(((emphasis)))`, cloning | Yes | CPU real time (llama.cpp fork) | — | Inspiration (licence) |
| **Kokoro-82M** (hexgrad) [card](https://huggingface.co/hexgrad/Kokoro-82M) | Dec 2024–Apr 2025 | 82M | Apache-2.0 | Apache-2.0 | 8 langs; FR = one voice, weakest; 7/12 | Style vector; Ziggy's graph patch adds durations/F0/energy | — | Yes (CPU, ONNX, browser) | — | **Yes (current engine)** |
| **Paradee-8M v1.3** [card](https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.3), [code](https://github.com/sahilmahendrakar/paradee) | Nov 2026 | 7.88M | (repo not checked) | Apache-2.0 | en hi fr es (8 Kokoro voices) | Kokoro voices only | — | 8.5 MB int8 ONNX, 62× RT on 1 CPU thread | 62× RT | Yes (**distillation recipe**) |
| Supertonic 3 (Supertone) [card](https://huggingface.co/Supertone/supertonic-3), [code](https://github.com/supertone-inc/supertonic) | May 2026, **archived** | 99M | MIT | OpenRAIL | 31 incl. FR, AR (no zh) | 10 expression tags (`<laugh>`, `<breath>`, `<sigh>`) | — | ONNX everywhere, 44.1 kHz | — | Inspiration (OpenRAIL use restrictions) |
| Phonon-31m-en / 40m (Gradium) [31m](https://huggingface.co/gradium/phonon-31m-en), [40m-ml](https://huggingface.co/gradium/phonon-40m-multilingual) | Oct 2026 | 31M / 40M | — | 31m-en Apache-2.0; 40m CC-BY-NC-4.0 | 31m EN only; 40m en fr de es pt | — | Yes | On-device, GGUF | — | 31m-en: EN only; 40m: No |
| OmniVoice (k2-fsa) [card](https://huggingface.co/k2-fsa/OmniVoice), [code](https://github.com/k2-fsa/OmniVoice) | 30 Mar 2026 | 613M | Apache-2.0 | **CC-BY-NC** (Emilia) | 600+ | Voice design by attributes incl. **age = child**, whisper, accent; non-verbal tags | — | GPU | RTF 0.025 | **Inspiration** |
| Fish S2 Pro / Drama-3 (Fish Audio) [S2](https://huggingface.co/fishaudio/s2-pro), [Drama-3](https://huggingface.co/fishaudio/drama-3) | Mar / Oct 2026 | 4.56B / 35.9B | Fish Audio Community License ([repo](https://github.com/fishaudio/fish-speech)) | Fish Audio Research License (commercial needs a deal) | 80+ incl. FR; CV3 FR WER 6.26 | Instruction following, emotion, multi-speaker, editing | Yes | GPU (GGUF for Drama-3) | — | No / inspiration |
| Higgs TTS 3 (Boson AI) [card](https://huggingface.co/bosonai/higgs-tts-3-4b) | Jun 2026 | 4.65B | Apache-2.0 ([higgs-audio](https://github.com/boson-ai/higgs-audio)) | Research and non-commercial | 100+ incl. FR | Expressive, controllable | — | GPU | — | No |
| Breeze TTS 2 (BreezeBlue) [card](https://huggingface.co/BreezeBlue/Breeze-TTS-2) | Aug 2026 | 3.47B | Apache-2.0 | Research and non-commercial | en, zh | Voice design, "voice direction" | — | CUDA | — | No |
| Voxtral 4B TTS (Mistral) [card](https://huggingface.co/mistralai/Voxtral-4B-TTS-2603), [Slator](https://slator.com/mistral-text-to-speech-model/) | 26 Mar 2026 | ~4B | — | **CC-BY-NC-4.0** | 9 incl. **FR**, AR | Cloning, expressive | Yes (vLLM) | GPU ≥ 16 GB | — | No (French-made, NC) |
| Step-Audio-EditX (StepFun) [code](https://github.com/stepfun-ai/Step-Audio-EditX), [card](https://huggingface.co/stepfun-ai/Step-Audio-EditX) | Nov 2025–Jan 2026 | 3.5B | Apache-2.0 | Not stated on the card | zh, en, Sichuanese, Cantonese, ja, ko (FR "planned") | **Iterative editing** of existing audio: emotions, styles incl. *Child*, *Whisper*, paralinguistics | — | GPU | — | Inspiration (no FR; weights licence unclear) |
| Maya1 (Maya Research) [card](https://huggingface.co/maya-research/maya1) | updated Oct 2026 | 3.3B (llama arch.) | — | Apache-2.0 | EN | Voice design by description, emotion tags | — | GPU | — | EN-only option |
| IndexTTS-2 / 2.5 (bilibili) [code](https://github.com/index-tts/index-tts), [2.5](https://huggingface.co/IndexTeam/IndexTTS-2.5) | 2025 / Aug 2026 | — | bilibili Model Use License | other | zh en ja es ar | Emotion disentangled from timbre, duration control | — | GPU | — | Inspiration |
| F5-TTS / E2 [card](https://huggingface.co/SWivid/F5-TTS), [code](https://github.com/SWivid/F5-TTS) | 2024–Mar 2025 | — | MIT | CC-BY-NC-4.0 (Emilia) | zh en (+ community FR fine-tunes) | Flow-matching cloning | — | GPU | — | Inspiration |
| Spark-TTS [card](https://huggingface.co/SparkAudio/Spark-TTS-0.5B) | Mar 2025 | 0.5B | Apache-2.0 | CC-BY-NC-SA-4.0 | en zh | Gender/pitch/speed attributes | — | — | — | Inspiration |
| MaskGCT (Amphion) [card](https://huggingface.co/amphion/MaskGCT) | 2024–25 | — | MIT ([Amphion](https://github.com/open-mmlab/Amphion)) | CC-BY-NC-4.0 | en zh ko ja fr de | Masked generative cloning | — | GPU | — | Inspiration |
| Llasa-1B [card](https://huggingface.co/HKUSTAudio/Llasa-1B) | Feb 2025 | 1.37B (Llama-3.2 base) | — | CC-BY-NC-4.0 | zh en | — | — | — | — | No |
| Dia2-2B / Dia-1.6B (Nari Labs) [Dia2](https://huggingface.co/nari-labs/Dia2-2B), [Dia](https://huggingface.co/nari-labs/Dia-1.6B-0626) | 2025 | 1.9B / 1.6B | Apache-2.0 | Apache-2.0 | EN | Dialogue, non-verbals | Dia2 yes | GPU | — | EN only |
| Sesame CSM-1B [card](https://huggingface.co/sesame/csm-1b) | Mar 2025 | 1.55B | Apache-2.0 | Apache-2.0 (gated) | EN | Conversational context | — | GPU | — | EN only |
| VibeVoice-Realtime-0.5B (Microsoft) [card](https://huggingface.co/microsoft/VibeVoice-Realtime-0.5B) | Dec 2025 | 0.5B (1.0B on Hub) | MIT | MIT | EN | Long-form; cloning removed | Yes | — | — | No (code pulled once for misuse; EN) |
| MegaTTS3 (ByteDance) [card](https://huggingface.co/ByteDance/MegaTTS3) | Apr 2025 | — | Apache-2.0 | Apache-2.0 | en zh | Accent intensity | — | — | — | No FR |
| FireRedTTS-2 [card](https://huggingface.co/FireRedTeam/FireRedTTS2) | Sep 2025 | — | Apache-2.0 | Apache-2.0 | dialogue (zh/en focus) | Multi-speaker dialogue | Yes | GPU | — | Low value |
| GLM-TTS (Zhipu) [card](https://huggingface.co/zai-org/GLM-TTS) | Dec 2025 | — | Apache-2.0 | MIT | zh en | RL-tuned emotion | — | — | — | No FR |
| Marvis TTS 250M [card](https://huggingface.co/Marvis-AI/marvis-tts-250m-v0.2) | Nov 2025 | 250M | Apache-2.0 | Apache-2.0 (Emilia data) | en fr de | CSM-style, MLX | Yes | Apple/MLX | — | Weak; data caveat |
| NeuTTS Air / Nano (Neuphonic) [Air](https://huggingface.co/neuphonic/neutts-air), [Nano](https://huggingface.co/neuphonic/neutts-nano) | 2025–26 | 748M / 229M | NeuTTS Open License ([repo](https://github.com/neuphonic/neutts-air)) | Air tagged Apache (gated), Nano "other" | EN (+ multilingual nano collection) | Cloning | — | GGUF, CPU | — | Inspiration (licence mix) |
| Kani-TTS-2 [card](https://huggingface.co/nineninesix/kani-tts-2-en) | Feb 2026 | 370M | Apache-2.0 | other | EN | — | — | — | — | No |
| Parler-TTS mini multilingual v1.1 [card](https://huggingface.co/parler-tts/parler-tts-mini-multilingual-v1.1) | Dec 2024 | 938M | Apache-2.0 | Apache-2.0 | en fr es pt pl de nl it | Voice from text description | — | — | — | Older; inspiration |
| Orpheus 3B / FR research release (Canopy) [EN](https://huggingface.co/canopylabs/orpheus-3b-0.1-ft), [FR](https://huggingface.co/canopylabs/3b-fr-ft-research_release) | Mar–Apr 2025 | 3.3–3.8B (llama arch.) | Apache-2.0 | tagged Apache-2.0; Llama-architecture base not declared on the card | EN; FR "research release" | Emotion tags | Yes | GPU | — | No (FR is a research release; base licence unverified) |
| Zonos v0.1 / ZONOS2 (Zyphra) [v0.1](https://huggingface.co/Zyphra/Zonos-v0.1-transformer), [ZONOS2](https://huggingface.co/Zyphra/ZONOS2) | Feb 2025 / Jun 2026 | 1.6B / — | Apache-2.0 | Apache-2.0 | multilingual | Emotion vector, pitch, rate | — | GPU | — | Superseded by ZONOS3-Mini |
| Magpie TTS Multilingual (NVIDIA) [card](https://huggingface.co/nvidia/magpie_tts_multilingual_357m) | Dec 2025 | 357M | (NeMo) | NVIDIA Open Model License | 12 incl. FR, AR | — | — | GGUF | — | No (licence) |
| Echo TTS [card](https://huggingface.co/jordand/echo-tts-base) | Dec 2025 | — | — | CC-BY-NC-SA-4.0 | EN | Diffusion cloning | — | — | — | No |
| AuK (Tencent) [card](https://huggingface.co/tencent/AuK) | Sep 2026 | — | — | MIT | (not listed) | Instruction-guided TTS + editing + enhancement | — | — | — | Study later |
| LFM2.5-Audio (Liquid AI) [card](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B) | 2026 | 1.47B | — | other | EN | Speech-to-speech | — | — | — | No |
| XTTS-v2 (Coqui) [card](https://huggingface.co/coqui/XTTS-v2), idiap fork [code](https://github.com/idiap/coqui-ai-TTS) | 2023 | — | **MPL-2.0** (fork) | Coqui Public Model License | 17 incl. FR | Cloning | — | — | — | No |
| Piper [piper1-gpl](https://github.com/OHF-Voice/piper1-gpl) | engine now GPL | small VITS | **GPL-3.0** | per voice | many incl. FR | — | — | CPU | — | No |
| StyleTTS2 [code](https://github.com/yl4579/StyleTTS2) | 2023 | ~100M | MIT | MIT (LibriTTS/LJ) | EN | Style diffusion | — | CPU | — | Already inside Kokoro's lineage |

---

## 4. Deep dives (code read)

### 4.1 ZONOS3-Mini (Zyphra, 9–12 Nov 2026): the best fit by far

Sources: [model card](https://huggingface.co/Zyphra/ZONOS3-Mini), [repository](https://github.com/Zyphra/ZONOS3-Mini)
(`README.md`, `NOTICE`, `docs/features.md`, `docs/guide.md`, `servers/ggml/README.md`,
`assets/steering/*`), [technical report arXiv 2611.16525](https://arxiv.org/abs/2611.16525),
[MarkTechPost coverage](https://www.marktechpost.com/2026/11/10/zyphra-zonos3-mini-open-source-tts/).

- **Licences**: code MIT (`LICENSE`, Copyright 2026 Zyphra); weights Apache-2.0 (card front
  matter). Third-party code in `NOTICE`: Mini-SGLang (MIT), NVIDIA NeMo text processing ported to
  Rust (Apache-2.0), sacremoses (MIT), Unicode CLDR (**Unicode-3.0**, already accepted by the owner
  on 2026-11-08 for another crate), mlx-lm (MIT), FuseAlign (Apache-2.0), z-speech-alignment (MIT).
  The optional "phonemize" path guesses unknown words with espeak-ng (GPL): same build-machine-only
  situation as today. Training data is not documented in the repo or card (a secondary source
  quotes 112 H100s for 2.5 days of training, not the data); ask Zyphra or read the blog before
  shipping.
- **Architecture**: 11-layer hybrid (9 Gated DeltaNet + 2 global attention), latent MoE (64
  experts, top-2), 886M parameters, ~100M active per token; new codec ZAC-1 at 15 Hz, 10 codebooks
  (1 semantic + 9 acoustic), causal multi-resolution iSTFT head, 44.1 kHz output; SuperBPE text
  tokenizer with NeMo text normalisation (French included).
- **Expressiveness** (the important part for Ziggy): *steering bundles* move the voice along
  measured direction vectors without changing the model: emotion axes (valence, arousal,
  dominance, loudness, tempo, clarity, articulation), moods, styles, whisper, disfluency, word
  emphasis, voice quality (soft, husky, raspy…), pitch and pitch range, regional accents, and
  `speaker_attributes` with **age** and gender axes fitted on 7,652 speakers (LibriTTS-R,
  Common Voice, VoxCeleb) with an age labeller, gap ~41 years
  (`assets/steering/speaker_attributes_mect60k_x10/manifest.json`). Controls can apply to the whole
  request or to character spans (`control_spans`, e.g. whisper only on the quoted words), and a
  "steer then hold" schedule prevents a constant push from drifting toward shouting over long
  lines. Plus speaking-rate buckets (30), loudness buckets, IPA pronunciation groups, pause markers,
  and speech editing (regenerate only some words in an existing clip).
- **Reliability**: LACI (alignment-guarded decoding) rolls back skipped words, stalls and early
  EOS and regenerates; French alignment heads ship (`laci_heads/…_fr.json`). Short one- or
  two-word lines get a special path (97 % exact in English). This matters for children's content
  where a skipped word is a bug.
- **Voices**: clone from a clip (192-d MECT-B2 speaker embedding or raw reference codes); embeddings
  can be blended (slerp between two voices) and moved along the age/pitch/texture axes, which is a
  way to *design* a Ziggy voice without any real child's recording. Only one default French voice
  ships (Gaspard, male).
- **Runtimes**: CUDA (SGLang), Apple MLX, **C++/ggml CLI and server on CPU/Vulkan/Metal with no
  Python at runtime**, and **WebGPU in the browser**. Default quantised backbone 0.66 GB.
- **Word timings**: not native (unlike Kokoro's durations), but the repo ships FuseAlign
  (Apache-2.0) forced alignment returning per-word start/end; enough to keep `timing.json` and
  visemes.
- **Caveats**: five days old; per the guide, the usable steering window is narrow ("a style that
  responds at one dose can run away at twice that"); the age axis was learned on adult corpora, so
  pushing toward "child" is extrapolation and must be listened to, possibly still with Ziggy's
  WORLD formant step.

### 4.2 VoxCPM2 (OpenBMB, Apr 2026): best licence-clean voice designer for many languages

Sources: [card](https://huggingface.co/openbmb/VoxCPM2), [repo README](https://github.com/OpenBMB/VoxCPM).

- Apache-2.0 code and weights; 2B parameters on MiniCPM-4; "tokenizer-free diffusion
  autoregressive" (LocEnc → TSLM → RALM → LocDiT), 6.25 Hz token rate, AudioVAE V2 16 kHz in /
  48 kHz out; 2M+ hours of training data (sources not listed).
- Voice design by putting a description in parentheses before the text; "controllable cloning"
  (reference clip + style text); "ultimate cloning" (clip + transcript); streaming; **LoRA
  fine-tuning from 5–10 minutes of audio** (training scripts and a web UI in the repo).
- French evidence from its README: CV3-Eval FR WER 9.85 (CosyVoice3-1.5B 11.8, Fish S2 6.26);
  MiniMax FR WER 4.53 (Qwen3-TTS 2.86, Fish S2 3.05), FR speaker similarity 73.5 (best in that
  table). Arabic WER on MiniMax 13.0 (weak).
- Cost: ~8 GB VRAM, RTF 0.30 on an RTX 4090; llama.cpp-omni RTF 1.76 on an M4 Pro: an **offline
  generation** model, not an on-device one.

### 4.3 Qwen3-TTS (Qwen, Jan 2026): best French intelligibility among licence-clean models

Sources: [repo](https://github.com/QwenLM/Qwen3-TTS), [VoiceDesign card](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign).

- Apache-2.0 code and weights; 0.6B and 1.7B; 12 Hz multi-codebook tokenizer; "dual-track"
  streaming with 97 ms first packet.
- Three model types: **VoiceDesign** (persona from a description; the README's own example is a
  cutesy high-pitched young voice), **CustomVoice** (9 preset timbres + instructions for emotion
  and tone), **Base** (3-second cloning, fine-tunable).
- The README documents a **"Voice Design then Clone"** workflow: design a reference clip once,
  turn it into a reusable clone prompt, then generate every line with the Base model for a
  consistent character. This is exactly the pattern Ziggy needs for Ziggy, Santa and elves.
- Gaps: no Dutch, Turkish or Arabic; GPU only.

### 4.4 Fun-CosyVoice3-0.5B (Dec 2025)

Sources: [repo](https://github.com/FunAudioLLM/CosyVoice), [card](https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512).
Apache-2.0 both; 9 languages; instruction control (emotion, speed, volume, dialect);
pronunciation inpainting only for Chinese pinyin and English CMU phonemes (not French); text-in
and audio-out streaming (150 ms). French is its weak spot (CV3 FR WER 11.8 for the 1.5B, from
VoxCPM2's table). Chatterbox's README credits CosyVoice and S3Tokenizer, and its S3Gen decoder
follows the same token → flow-matching → HiFT design (`src/chatterbox/models/s3gen/`).

### 4.5 Chatterbox Multilingual V3 / Turbo / Nano (Resemble AI)

Sources: [repo](https://github.com/resemble-ai/chatterbox), cards for
[Multilingual](https://huggingface.co/ResembleAI/chatterbox),
[Turbo](https://huggingface.co/ResembleAI/chatterbox-turbo),
[Nano](https://huggingface.co/ResembleAI/chatterbox-nano).

- MIT code and weights; T3 (Llama-architecture token LM) + S3Gen (flow matching + HiFT vocoder).
- Emotion control is a single scalar: `emotion_adv` ("exaggeration") projected into the
  conditioning (`models/t3/modules/cond_enc.py`). Turbo/Nano add paralinguistic tags and a
  one-step distilled decoder; Nano runs 3× real time on 8 CPU cores (English only).
- Every output passes through the Perth implicit watermarker (`perth.PerthImplicitWatermarker`
  in `tts.py`, `mtl_tts.py`, `tts_turbo.py`); the `resemble-perth` package's licence is not
  declared on PyPI and must be checked before any use.
- Retired in August 2026: usable as an archive, but no fixes will come.

### 4.6 Pocket TTS (Kyutai, Jan 2026): the best small CPU model with French, if CC-BY-4.0 is OK

Sources: [repo](https://github.com/kyutai-labs/pocket-tts) (`README.md`, `training/README.md`),
[card](https://huggingface.co/kyutai/pocket-tts) (gated), [blog](https://kyutai.org/blog/2026-01-13-pocket-tts).

- Code MIT, **including the full training code** (CALM paper recipe; example on HiFiTTS-2, whose
  metadata is CC-BY-4.0 and audio comes from LibriVox:
  [dataset card](https://huggingface.co/datasets/nvidia/hifitts-2)). Weights CC-BY-4.0.
- 100M parameters, 2 CPU cores, ~200 ms to first audio, ~6× real time on a MacBook Air M4;
  English, French, German, Portuguese, Italian, Spanish, Dutch; voice cloning; ports in Rust (XN,
  Candle), ONNX Runtime Web, C++, sherpa-onnx (12 language bindings).
- Voice catalogue licences vary per voice ([kyutai/tts-voices](https://huggingface.co/kyutai/tts-voices)).
- Why it matters: it is a realistic on-device engine for the Tauri app and the browser, and its
  MIT training code is a route to **training Ziggy's own small model** on data Ziggy controls.

### 4.7 Kitten TTS 2 mini / nano / pico + Paradee: tiny Apache ONNX models

Sources: [KittenTTS repo](https://github.com/KittenML/KittenTTS), [mini card](https://huggingface.co/KittenML/kitten-tts-2-mini),
[Paradee card](https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.3).

- Kitten mini/nano/pico: Apache-2.0 code and weights, int8 ONNX for CPU, 16 / 8 / 8 languages
  incl. French; preset adult voices only; quantisation-aware distillation from fp32. The 1.7B
  flagship is under a separate community licence (not usable).
- Paradee: 7.88M parameters **distilled from Kokoro** by training on Kokoro reading 12,000
  Wikipedia sentences per voice; int8 8.5 MB, 62× real time on one CPU thread; French `ff_siwis`
  WER 6.8 % (same as its teacher). This proves the recipe *"big teacher → small student on
  synthetic data"* works with Apache code, which is the key to having an expressive Ziggy voice
  on-device later.

### 4.8 OmniVoice (k2-fsa, Mar 2026): inspiration only

Sources: [card](https://huggingface.co/k2-fsa/OmniVoice), [repo](https://github.com/k2-fsa/OmniVoice)
(`docs/voice-design.md`, `omnivoice/models/omnivoice.py`).
Code Apache-2.0, but weights CC-BY-NC "due to constraints from its training data (e.g., Emilia)".
Worth studying: a diffusion-LM (masked, non-autoregressive) design reaching RTF 0.025, and
**attribute-tag voice design** with an explicit age class `child, teenager, young adult,
middle-aged, elderly` plus pitch, whisper and accent. A Ziggy-trained model could copy this
attribute interface.

---

## 5. Licence traps found (do not miss these)

- "Open weights" ≠ open licence: Voxtral TTS (CC-BY-NC-4.0; early press said Apache, the card says
  NC: [Slator](https://slator.com/mistral-text-to-speech-model/)), Fish S2 Pro and Drama-3, Higgs
  TTS 3, Breeze TTS 2, OmniVoice, F5-TTS, Spark-TTS, MaskGCT, Llasa, Echo TTS, Phonon-40m.
- **Code Apache, weights not**: OmniVoice, F5-TTS (MIT code), Spark-TTS, Breeze TTS 2, Higgs,
  KittenTTS 2 flagship, Supertonic (MIT code, OpenRAIL weights), Phonon multilingual.
- **Llama base models**: Orpheus, Llasa and Maya1 use the Llama architecture on the Hub. Llasa is
  declared as fine-tuned from `meta-llama/Llama-3.2-1B-Instruct`
  ([card](https://huggingface.co/HKUSTAudio/Llasa-1B)), so Llama community terms flow down
  whatever the tag says. Orpheus and Maya1 are tagged Apache-2.0 but their pretrained bases are not
  declared on the cards checked here: verify the base checkpoint before any use.
- **Engines that became copyleft**: Piper (GPL-3.0), Coqui fork (MPL-2.0).
- **Unmaintained**: Chatterbox, Supertonic (archived), VibeVoice TTS (code withdrawn).
- **Undisclosed training data** on the Apache models we like (Qwen3-TTS, VoxCPM2, CosyVoice3,
  ZONOS3-Mini). Acceptable under the licence rule, but worth one written question to each vendor
  before a public launch.
- **Gated weights** (Pocket TTS, CSM, NeuTTS): gating terms must be read when requesting access.

---

## 6. Recommendation for the Ziggy voice app

### Adopt (licence-clean, worth building on)

1. **ZONOS3-Mini as the main engine of a "Ziggy Voice v4" studio** (MIT code, Apache weights, 12/12
   locales, fine-grained emotion/whisper/emphasis/age controls, LACI against skipped words, CPU
   ggml and WebGPU runtimes). Use it **offline** first (pre-generated MP3, as today), driven by
   Ziggy's existing narration plan: map `intonation.rs` decisions to steering controls (bedtime =
   low arousal, slower tempo bucket; "chuchota" = whisper `control_spans`; key word = emphasis
   direction) instead of hand-drawing F0 curves.
2. **Qwen3-TTS (VoiceDesign + Base) and VoxCPM2 as voice-design and second-opinion engines**,
   offline only. Use "design then clone": describe Ziggy (young, gentle, warm, soft robot-plush
   child), Santa (warm, deep, elderly, French), elves (bright, quick), generate candidate reference
   clips, let the owner choose by ear, freeze each choice as a reference clip / embedding, then
   generate every line from the frozen voice. **No real child's voice is ever recorded or cloned**,
   and nothing leaves the build machine.
3. **Keep Kokoro + the Rust engine** as the reference and fallback: it is deterministic, gives exact
   timings, and the new pipeline must beat it in blind A/B before replacing anything.
4. **Word timings and visemes**: replace Kokoro's native durations with forced alignment
   (FuseAlign, Apache-2.0, shipped inside ZONOS3-Mini) and keep the `timing.json` v2 format, so the
   site does not change.
5. **On-device / live (Tauri app, Père Noël live replies)**: shortlist Kitten TTS 2 nano/mini
   (Apache) and ZONOS3-Mini ggml/WebGPU now. Medium term, **distil the frozen Ziggy voice into a
   small student** (Paradee-style recipe, Apache) trained only on Ziggy-voice audio produced by
   the teacher: an 8–80M on-device Ziggy that sounds like the studio Ziggy, at zero running cost.

### Ask the owner

- **Pocket TTS** (MIT code, CC-BY-4.0 weights): best small CPU model with French, plus MIT
  training code. CC-BY-4.0 only requires attribution, but it is outside the MIT/Apache/BSD list.
  Same question for Kyutai TTS 1.6B en_fr.
- **Unicode-3.0** inside ZONOS3-Mini's text normaliser (CLDR tables): already accepted once for
  `unicode-ident`; confirm it covers this use too.

### Study for inspiration only (do not ship)

OmniVoice (attribute voice design with a `child` class; fast diffusion-LM), Step-Audio-EditX
(iterative emotion/style editing incl. *Child* and *Whisper*), Fish S2 Pro / Drama-3 and Voxtral
TTS (current quality ceiling; useful as A/B listening references, never as data sources), IndexTTS-2
(emotion disentangled from timbre, explicit duration control), Supertonic 3 (expression tags in a
99M ONNX model), Chatterbox (exaggeration scalar, watermarking).

### Avoid

Piper (GPL-3.0 engine), XTTS / Coqui fork (CPML, MPL-2.0), any NC / research / community-licence
weights listed above, Llama-based TTS (Llasa; Orpheus until its base is verified), VibeVoice, and **any voice cloning of a
real child**. Also avoid running any of these as a live cloud service: offline pre-generation and
on-device inference keep running costs at zero and keep children's data local.

### Suggested next steps (for the voice app plan)

1. On one GPU machine, generate the same 20 dodo segments (FR + EN) with ZONOS3-Mini, Qwen3-TTS
   (designed voice, then cloned), VoxCPM2 and today's Kokoro v3; score WER (French ASR), speaker
   consistency, `ziggy-voice check-prosody`, UTMOS (EN), and run a blind owner listening test.
2. Check French reading of Ziggy's names and lexicon (`voice-engine/lexicon.json`) with ZONOS3's
   IPA groups, and Arabic quality separately (ZONOS3, VoxCPM2 and Chatterbox list Arabic;
   VoxCPM2's own Arabic WER is high).
3. Submit the chosen models to the HF Open TTS Leaderboard view for French before committing.
4. Only then design the Hyper Engine "voice" provider (offline batch job + manifest, same shape as
   `public/dodo/voice/**` and `src/data/santa/voice-manifest.json`).
