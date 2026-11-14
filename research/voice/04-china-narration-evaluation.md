# Voice app research 04: the Chinese ecosystem, advanced narration, evaluation and safety

Research cell 4 of 4, written 2026-11-14 for the Ziggy voice app (Hyper Engine). This report adds to
`research/china/REPORT.md` (2026-11-09, which covered elf voices for the Lutin games). It does not
repeat that report. Here the focus is **long-form narration and dialogue**, **duration control**
(our engine imposes durations), **evaluation**, **fine-tuning** and **safety**.

Today's baseline is `voice-engine/` (Rust, offline). It runs Kokoro-82M (Apache-2.0), and a patched
ONNX graph lets the planner impose **per-phoneme durations, an F0 curve and energy** inside the
network (`voice-engine/README.md`, "Installation" table and "Comment ça marche" §6). Its rule-based
storyteller prosody lives in `intonation.rs` and `contour.rs` (`docs/DODO_VOICE.md`).

## How this was checked

- **Weights licences** come from the Hugging Face model cards, read through the Hugging Face MCP tool
  on 2026-11-14. That covers the card's `license:` field and, where needed, the README. The earlier
  china report could not reach Hugging Face. Direct `curl` to huggingface.co, arxiv.org and
  pmc.ncbi.nlm.nih.gov is still blocked by this sandbox's proxy, so papers were read through
  `hf://papers/<id>/paper.md`, or cited from search results. Where a source is secondary, I say so.
- **Code licences**: I read the `LICENSE` file at `raw.githubusercontent.com/<repo>/HEAD/LICENSE`
  myself for every repo named below.
- **Code reading**: I shallow-cloned Qwen3-TTS, CosyVoice, MOSS-TTS, index-tts, VoxCPM,
  Ming-3.0-tts, OmniVoice, FireRedTTS2 and SoulX-Podcast (code only, blobs under 3 MB, no weights)
  into the scratchpad. I read the duration and speed code paths and the model cards, then deleted
  the clones.
- I ran no models. This is a desk and code review. Vendor benchmark numbers are vendor-reported.

---

## Part 1: the Chinese voice ecosystem, 2025–2026

### 1.1 Licence and capability table

Legend: ✅ = fits our rules (MIT / Apache-2.0 / BSD for code **and** weights) · ⚠️ = permissive but
something must be checked first · ❌ = cannot ship or run for production (inspiration only).
"FR" means French is officially listed.

| Model (org) | Released | Code licence | Weights licence (HF card) | FR | What it does well | Duration control | Verdict |
|---|---|---|---|---|---|---|---|
| **Qwen3-TTS** 1.7B/0.6B: Base, CustomVoice, VoiceDesign (Alibaba Qwen) | 2026-01 | Apache-2.0 | **Apache-2.0** ([card](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign)) | ✅ (10 langs) | Voice design from text; "design then clone" to reuse a voice; instruct control; single-speaker SFT ([README](https://github.com/QwenLM/Qwen3-TTS), [finetuning](https://github.com/QwenLM/Qwen3-TTS/tree/main/finetuning)) | None explicit (speed via instruct) | ✅ teacher and character voices |
| **VoxCPM2** 2B (OpenBMB / ModelBest) | 2026-04 | Apache-2.0 | **Apache-2.0** ([card](https://huggingface.co/openbmb/VoxCPM2)) | ✅ (30 langs) | Voice design "(description)text"; controllable cloning; 48 kHz; LoRA with 5–10 min of audio; optional word timestamps (stable-ts, MIT) ([README](https://github.com/OpenBMB/VoxCPM)) | None explicit | ✅ teacher, second engine |
| **MOSS-TTS** 8B v1.5 / 1.7B (OpenMOSS / MOSI.AI) | 2026-02/03 | Apache-2.0 | **Apache-2.0** ([card](https://huggingface.co/OpenMOSS-Team/MOSS-TTS)) | ✅ (31 langs in v1.5) | Long-form stability, IPA/pinyin inline, `[pause 3.2s]` markers ([model card](https://github.com/OpenMOSS/MOSS-TTS/blob/main/docs/moss_tts_model_card.md)) | **Yes**: `tokens=` expected audio tokens, 1 s ≈ 12.5 tokens (utterance level) | ✅ test first |
| **MOSS-TTSD** v1.0 8B (OpenMOSS) | 2026-02 | Apache-2.0 | **Apache-2.0** ([card](https://huggingface.co/OpenMOSS-Team/MOSS-TTSD-v1.0)) | ✅ (20 langs) | 1–5 speakers, turn-taking, up to 60 min in one session ([card](https://github.com/OpenMOSS/MOSS-TTS/blob/main/docs/moss_ttsd_model_card.md), [arXiv 2603.19739](https://huggingface.co/papers/2603.19739)) | Via continuation only | ✅ dialogue scenes |
| **MOSS-VoiceGenerator** 1.7B (OpenMOSS) | 2026-02 | Apache-2.0 | **Apache-2.0** ([card](https://huggingface.co/OpenMOSS-Team/MOSS-VoiceGenerator)) | ❌ zh/en only | Voice design from free text; trained on "cinematic content" ([paper](https://huggingface.co/papers/2603.28086)) | No | ⚠️ EN only; training-data provenance (films) |
| **Fun-CosyVoice3** 0.5B-2512 (Alibaba Tongyi) | 2025-12 | Apache-2.0 | **Apache-2.0** ([card](https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512)) | ✅ (9 langs) | Instruct (emotion, speed, volume, dialect); `[breath]`, `[laughter]`, `<strong>` tags; bi-streaming ([README](https://github.com/FunAudioLLM/CosyVoice), [arXiv 2505.17589](https://arxiv.org/abs/2505.17589)) | "speed" is a mel time-stretch (see 1.3) | ✅ test |
| **FireRedTTS-2** (Xiaohongshu FireRed) | 2025-09 | Apache-2.0 | **Apache-2.0** ([card](https://huggingface.co/FireRedTeam/FireRedTTS2)) | ✅ (7 langs) | Multi-speaker dialogue (3 min, 4 speakers); fine-tune code ([README](https://github.com/FireRedTeam/FireRedTTS2), [arXiv 2509.02020](https://huggingface.co/papers/2509.02020)) | No | ✅ test (dialogue) |
| **Ming-3.0-tts** 0.5B (Ant Group inclusionAI) | 2026-09 | MIT | **MIT** ([card](https://huggingface.co/inclusionAI/Ming-3.0-tts-0.5B)) | ✅ (7 langs) | Voice design, free-form style; coarse speed/pitch/volume; 14 nonverbal tags (zh/en); 44.1 kHz ([README](https://github.com/inclusionAI/Ming-3.0-tts)) | Coarse (slow/medium/fast) | ✅ test |
| **OmniVoice** 0.6B (Xiaomi / k2-fsa) | 2026-03 | Apache-2.0 | **Not stated on card** ([card](https://huggingface.co/k2-fsa/OmniVoice)) | ✅ (600+ langs) | Attribute voice design, including *whisper*; trained on 581k h from 50 open datasets ([arXiv 2604.00688](https://huggingface.co/papers/2604.00688)) | **Yes**: `duration=` seconds fixes output length ([README](https://github.com/k2-fsa/OmniVoice)) | ⚠️ confirm weights licence and data list |
| **AuK** 1.5B + AuK-Flash (Tencent Hunyuan) | 2026-09 | MIT | **MIT** (LICENSE covers "parameters and weights"; card `mit`) ([repo](https://github.com/Tencent-Hunyuan/AuK), [card](https://huggingface.co/tencent/AuK)) | ? (EN and ZH demos; FR unverified) | One model for instruct TTS **and editing**: speed, pitch, volume, emotion, timbre, nonverbal add/remove, whisper ([arXiv 2609.08936](https://arxiv.org/abs/2609.08936)) | Speed editing (length scales) | ⚠️ test as a post-editor; check FR. Unlike other Hunyuan licences, no EU exclusion clause |
| **Step-Audio-EditX** 3B (StepFun) | 2025-11 | Apache-2.0 | **No licence field on card** ([card](https://huggingface.co/stepfun-ai/Step-Audio-EditX)) | ❌ (zh/en/ja/ko; FR "planned") | Iterative emotion and style editing (Whisper, Child…), paralinguistic tags ([arXiv 2511.03601](https://arxiv.org/abs/2511.03601)) | No | ⚠️ inspiration until FR and a weights licence exist |
| **GLM-TTS** (Zhipu / Z.ai) | 2025-12 | Apache-2.0 | MIT ([card](https://huggingface.co/zai-org/GLM-TTS)) | ❌ zh/en | RL-tuned expressiveness ([arXiv 2512.14291](https://arxiv.org/abs/2512.14291)) | No | ❌ no FR |
| **SoulX-Podcast** 1.7B (Soul AI Lab) | 2025-10 | Apache-2.0 | Apache-2.0 ([card](https://huggingface.co/Soul-AILab/SoulX-Podcast-1.7B)) | ❌ zh/en + dialects | Podcast dialogue, `<\|laughter\|>`, `<\|sigh\|>`, `<\|breathing\|>` tags ([readme](https://github.com/Soul-AILab/SoulX-Podcast), [arXiv 2510.23541](https://huggingface.co/papers/2510.23541)) | No | ❌ no FR (inspiration) |
| **IndexTTS-2 / 2.5** (Bilibili) | 2025-09 / 2026-08 | bilibili Model Use Licence | Same ([2.5 card](https://huggingface.co/IndexTeam/IndexTTS-2.5)) | ❌ (2.5: zh/en/ja/es/ar) | Emotion disentangled from timbre (8-float vector) | 2.5: `duration_factor` 0.5–2.0 (see 1.3) | ❌ licence (PRC law, ban on improving other models); inspiration |
| **MegaTTS3** (ByteDance) | 2025-03 | Apache-2.0 | Apache-2.0 ([card](https://huggingface.co/ByteDance/MegaTTS3)) | ❌ zh/en | — | — | ❌ (WaveVAE encoder withheld, per the china report) |
| **Spark-TTS** 0.5B | 2025-03 | Apache-2.0 | **CC BY-NC-SA 4.0** ([card](https://huggingface.co/SparkAudio/Spark-TTS-0.5B)) | ❌ | — | — | ❌ NC (now verified on the card) |
| **Llasa-1B-Multilingual**, **X-codec2** (HKUST) | 2025-02 | — | **CC BY-NC 4.0** ([Llasa](https://huggingface.co/HKUSTAudio/Llasa-1B-Multilingual), [xcodec2](https://huggingface.co/HKUSTAudio/xcodec2)) | Llasa lists FR | — | — | ❌ NC |
| **OpenAudio S1-mini**, **Fish S2 Pro**, **Fish Drama 3** (35B MoE, 16 speakers) (Fish Audio) | 2025–2026-10 | Fish Audio Community Licence ([LICENSE](https://github.com/fishaudio/fish-speech/blob/main/LICENSE)) | S1-mini CC BY-NC-SA; S2 Pro and Drama 3 "fish-audio-research-license", gated "non-commercial use ONLY" ([s2-pro](https://huggingface.co/fishaudio/s2-pro), [drama-3](https://huggingface.co/fishaudio/drama-3)) | ✅ | Drama 3: `<\|speaker:0..15\|>` multi-character scenes, point tags `[sighs]`, edit-by-continuation | — | ❌ NC; **the best design reference for multi-character drama** |
| **Kimi-Audio** (Moonshot), **MiMo-Audio** (Xiaomi), **Step-Audio 2 mini** (StepFun), **Fun-Audio-Chat** (Alibaba) | 2025 | MIT / Apache | MIT ([Kimi](https://huggingface.co/moonshotai/Kimi-Audio-7B-Instruct)), MIT ([MiMo](https://huggingface.co/XiaomiMiMo/MiMo-Audio-7B-Instruct)), Apache ([Step-2-mini](https://huggingface.co/stepfun-ai/Step-Audio-2-mini)), Apache ([Fun-Audio-Chat](https://huggingface.co/FunAudioLLM/Fun-Audio-Chat-8B)) | ❌ zh/en | Audio LLMs (chat, understanding) | — | Not needed (we do not want live voice chat for children) |
| **Qwen3-Omni** 30B-A3B / **Qwen3.5-Omni** (Alibaba) | 2025-09 / 2026-03 | — | Qwen3-Omni card: `license: other` ([card](https://huggingface.co/Qwen/Qwen3-Omni-30B-A3B-Instruct)); 3.5-Omni weights reported as API-only ([the-decoder](https://the-decoder.com/?p=33841), secondary; [report](https://arxiv.org/abs/2604.15804)) | 3.5: 36 output langs (secondary) | Omni voices | — | ❌ for shipping; Captioner could serve as an offline judge only after a licence check |
| **Fun-CineForge** (Alibaba Tongyi) | 2026-05 | — | Apache-2.0 ([card](https://huggingface.co/FunAudioLLM/Fun-CineForge)) | ❌ zh/en | Time-aligned dubbing with an MLLM | Scene timing | Inspiration for duration-aligned synthesis |
| **Doubao Seed-TTS 2.0** / BytePlus **Seed Speech 2.0** (ByteDance) | 2025-10 / 2026-03 | closed | API only ([BytePlus](https://www.byteplus.com/en/blog/seed-speech-2-0), [PingWest](https://www.pingwest.com/w/308310)) | multilingual presets | Context-aware emotion; bracketed instructions; novel voice-over use case | — | ❌ running cost and third party (inspiration) |
| **MiniMax Speech 2.6 / 2.8** + Voice Design API | 2025-10 → 2026 | closed | API only ([MiniMax](https://www.minimax.io/news/minimax-speech-26), [invideo summary](https://invideo.io/blog/minimax-ai-voice-models/), secondary) | ✅ (40 langs per docs) | Voice design returns a reusable `voice_id` | — | ❌ (inspiration: the "design once, reuse id" pattern) |
| **Baidu, iFlytek** | — | — | No open TTS release found in 2025–2026 ([search](https://www.siliconflow.com/articles/best-open-source-text-to-speech-models), negative result) | — | — | — | Closed only |

Newer finds outside the requested list, all unverified beyond their cards:
- **Audio8-TTS-Realistic-Air** (Edge0, 0.6B): Apache-2.0 card, 23 languages including FR, created
  2026-10. Its GitHub repo has no LICENSE and its provenance is unclear
  ([card](https://huggingface.co/Edge0/Audio8-TTS-Realistic-Air)). Watch, do not use.
- **SwanTale** (2026-08): multi-speaker speech and audio generation with reusable designed voices.
  The paper only; the weights licence is unknown ([paper](https://huggingface.co/papers/2608.02023)).
- **VoiceSculptor** (ASLP, 2026-01): instruction voice design built on LLaSA-3B and CosyVoice2, so
  the Llasa NC weights likely propagate ([arXiv 2601.10629](https://arxiv.org/pdf/2601.10629)).
  Inspiration only.

Corrections to `research/china/registry.md` (2026-11-09), now that the cards could be read:
CosyVoice 3, FireRedTTS-2, SoulX-Podcast and Qwen3-TTS weights are **verified Apache-2.0**. Spark-TTS
is **verified CC BY-NC-SA**. Kimi-Audio weights are **MIT** on the card. Step-Audio-EditX has **no
licence field** on its card (it is not "unverified Apache"). IndexTTS-2.5 now adds ja/es/ar, but
still no French.

### 1.2 What changed since the earlier china survey

1. **Permissive, French-capable, long-form models now exist.** The **MOSS-TTS family** (Apache code
   and weights) covers narration (MOSS-TTS), dialogue up to 60 minutes with 1–5 speakers
   (MOSS-TTSD) and sound effects (MOSS-SoundEffect), with French in the first two
   ([family card](https://huggingface.co/OpenMOSS-Team/MOSS-TTSD-v1.0)). In 2025 nothing permissive
   did long-form French dialogue.
2. **Voice design is now a standard feature** in Apache or MIT models: Qwen3-TTS VoiceDesign,
   VoxCPM2, Ming-3.0-tts, OmniVoice (attributes) and MOSS-VoiceGenerator (zh/en). This is how we get
   Santa, elf and animal voices **without cloning anyone**.
3. **Editing models arrived**: AuK (MIT, Tencent) and Step-Audio-EditX. They can turn a neutral take
   into a whisper, slow it, or add a breath or a giggle, without regenerating it.
4. **Licence traps got worse at the top end.** The most expressive multi-character model (Fish
   Drama 3) and Fish S2 Pro are research-only. IndexTTS stays under a custom licence.

### 1.3 Duration control: what each model can really impose (read in the code)

Our engine imposes **exact per-phoneme durations** (25 ms frames), an **F0 curve** and **energy**
inside Kokoro. That is how `timing.json` word timings and visemes are exact. No LLM-style TTS
below matches it:

| Model | Granularity | How it is implemented (code read) | Usable for our timing contract? |
|---|---|---|---|
| Kokoro + our patch | **phoneme**, 25 ms | `dur_frames`/`dur_mix`, `f0_override`, `n_override` inputs inserted in the graph (`voice-engine/README.md`) | Yes, exact |
| **IndexTTS-2** | utterance (as designed) | README: precise duration control "*is not yet enabled in this release*" ([README](https://github.com/index-tts/index-tts)). In `indextts/gpt/model_v2.py` the `speed_emb` table is created with `std=0.0` and always indexed with zeros or ones, so the uncontrolled mode is always used | No |
| **IndexTTS-2.5** | utterance, 0.5–2.0× | `infer_v2_5.py`: `target_lengths = S_infer.shape[1] * 1.72 * duration_factor`. It rescales the **semantic-to-mel length regulator** after the GPT has chosen the tokens, so it is a smooth global stretch, not a duration target | Global stretch only (and the licence is excluded) |
| **CosyVoice 3** | utterance | `cosyvoice/cli/model.py`: `speed` is `F.interpolate(tts_mel, size=int(T/speed))`, a linear **mel time-stretch** after flow matching, non-streaming only. The LLM stops between `min_token_text_ratio=2` and `max_token_text_ratio=20` × text length (`cosyvoice/llm/llm.py`). Forcing `min_len == max_len` would force an exact 25 Hz token count, but that is an unsupported hack | Approximate only |
| **MOSS-TTS** | utterance, 80 ms (12.5 tokens/s) | `build_user_message(text=…, tokens=325)` is the expected token count; also inline `[pause 3.2s]` ([model card](https://github.com/OpenMOSS/MOSS-TTS/blob/main/docs/moss_tts_model_card.md)) | Segment length and pauses: yes. Words: forced alignment |
| **OmniVoice** | utterance, exact | Non-autoregressive masked diffusion: `duration=10.0` fixes output length and overrides `speed` ([README](https://github.com/k2-fsa/OmniVoice)) | Segment length: yes. Words: forced alignment |
| Qwen3-TTS, VoxCPM2, FireRedTTS-2, MOSS-TTSD, Ming | none / coarse | Instruction ("slowly") or coarse labels | Forced alignment needed |

**Consequence.** If a new engine renders a line, word timings and visemes must come from **forced
alignment** of the finished audio: Montreal Forced Aligner (MIT-style licence,
[repo](https://github.com/MontrealCorpusTools/Montreal-Forced-Aligner)) or stable-ts (MIT,
[repo](https://github.com/jianfch/stable-ts), already wired into VoxCPM's `timestamps` module).
Check each aligner's pretrained acoustic-model licence separately. The cleanest design keeps Kokoro as
the *renderer* and uses big models as *teachers* (see the Recommendations).

---

## Part 2: "lecture hyper avancée": long-form narration and dialogue

### 2.1 State of the art in long-form and multi-speaker generation

| Approach | Examples | What to take | Usable? |
|---|---|---|---|
| One model generates a whole multi-speaker dialogue with speaker tags | MOSS-TTSD (`[S1]…[S5]`, 60 min), FireRedTTS-2 (4 speakers, 3 min), SoulX-Podcast, Fish Drama 3 (16 speakers), MoonCast ([2503.14345](https://huggingface.co/papers/2503.14345)) | Natural turn-taking and context-aware prosody across turns | MOSS-TTSD and FireRedTTS-2 ✅. Others ❌ (licence or language) |
| Per-line synthesis with a fixed voice prompt per character | Qwen3-TTS "voice design then clone" ([README §Voice Design then Clone](https://github.com/QwenLM/Qwen3-TTS)) | **Character consistency**: design the voice once, freeze the reference clip, reuse it for every line of every story | ✅ |
| LLM writes a script with performance notes, the TTS follows them | **MultiActor-Audiobook**: LLM-based Script Instruction generation plus persona ([arXiv 2505.13082](https://arxiv.org/pdf/2505.13082)); **PodAgent** ([2503.00455](https://huggingface.co/papers/2503.00455)); **WavJourney** audio scripts ([2307.14335](https://huggingface.co/papers/2307.14335)); **MM-StoryAgent** narrated storybooks ([2503.05242](https://huggingface.co/papers/2503.05242)) | The "director" pattern: the LLM decides *who* speaks, *how* (emotion, pace, volume, whisper) and *where* the pauses go, as structured JSON | ✅ pattern (fits Hyper Engine) |
| Instruction-following benchmarks | **InstructTTSEval** ([2506.16381](https://huggingface.co/papers/2506.16381)); **DRAMA-Eval** multi-turn, multi-speaker benchmark with LLM judging ([2610.31796](https://huggingface.co/papers/2610.31796)) | How to test that notes such as "whispered, sleepy" are really rendered | ✅ methods |
| Long-form failure repair | **LACI** (Argmax, 2026-09): Qwen3-TTS and VoxCPM2 "significantly deteriorate" on long prompts; detecting skips and hallucinations via alignment heads, rolling back and regenerating cut worst-of-10 WER from 35.2 % to 3.4 % on prompts over 1,500 words; proposes **wSIM**, a sliding-window speaker similarity ([2609.16989](https://huggingface.co/papers/2609.16989)) | **Never generate a 10-minute story in one call without guards.** Render per paragraph and check each one | ✅ method |
| Expressive character-quote data | **LibriQuote**: character utterances from audiobooks ([2509.04072](https://huggingface.co/papers/2509.04072)) | Data idea; check its licence | ⚠️ |
| Style-caption datasets | CapSpeech is **CC BY-NC 4.0** ([card](https://huggingface.co/datasets/OpenSound/CapSpeech-PT)); ParaSpeechCaps licence not found ([arXiv 2503.04713](https://arxiv.org/abs/2503.04713v1)) | — | ❌ for training a shipped model |

### 2.2 Voice design from a text description (no cloning)

The models that fit (Apache or MIT, FR): **Qwen3-TTS-VoiceDesign**, **VoxCPM2**,
**Ming-3.0-tts**, **OmniVoice** (attributes such as gender, age, pitch and whisper; its design mode
was trained on zh/en data only, per its README). Known behaviour: "Voice Design and Style Control
results may vary between runs; generating 1–3 times is recommended" ([VoxCPM2
card](https://huggingface.co/openbmb/VoxCPM2)). The workflow is therefore: **design → generate N
candidates → the owner picks by ear → freeze the winner as a reference clip and a "voice card" →
reuse it by cloning that synthetic clip** (Qwen3-TTS "design then clone"). Ming-3.0-tts ships named
child-voice presets (for example `灵梦瑶`, listed as Child,
[cookbook](https://github.com/inclusionAI/Ming-3.0-tts/blob/main/cookbooks/instruction_en.md)). Their
recording provenance is undocumented, so **do not use presets**; design our own voices.

### 2.3 How a good storyteller reads to children (evidence)

| Finding | Source | Engine implication |
|---|---|---|
| In 38 caregivers reading to 4–5-year-olds, **f0 range (semitones)** and **appropriate pause duration** (pauses at grammatical boundaries) both predicted children's cued recall, after controlling for age, listening skills, attention and caregiver education | Davison et al., JSLHR 68(12), 2025 ([PubMed 41237785](https://pubmed.ncbi.nlm.nih.gov/41237785/), [DOI](https://pubs.asha.org/doi/10.1044/2025_JSLHR-25-00313)) | Keep a wide pitch range (v3 already widens it) and put pauses **only at grammatical boundaries**. Measure both (Part 3) |
| **Ungrammatical pausing** related negatively to children's core language skills | Same group ([PMC13649322](https://pmc.ncbi.nlm.nih.gov/articles/PMC13649322)) | A checker should flag pauses inside phrases, for example after an LLM inserts `[pause]` wrongly |
| Expressive vs inexpressive recordings: an experiment with 92 pre-K children (M = 57 months). Search summaries report that prosodic readings improved listening comprehension. I could not read the full text | Mira & Schwanenflugel 2013 ([ResearchGate](https://www.researchgate.net/publication/236600266_The_Impact_of_Reading_Expressiveness_on_the_Listening_Comprehension_of_Storybooks_by_Prekindergarten_Children); related thesis [UGA](https://openscholar.uga.edu/record/17747/files/mira_william_a_201112_ma.pdf)) | Expressiveness is not decoration: it serves comprehension |
| Children processed speech more slowly at **6.1 syll/s** than at **4.5 syll/s** | JSLHR 2025 ([DOI](https://pubs.asha.org/doi/10.1044/2025_JSLHR-24-00108)) | Cap narration at **≤ 4.5 syll/s**, slower for 4–6-year-olds and at bedtime |
| Caregivers who adjust their rate more between known and new words had children who learned new words better | Shi et al., CogSci 2020 ([PDF](https://discovery-pp.ucl.ac.uk/10108809/1/Shi_et_al_CogSci2020.pdf)) | Slow down locally on **new words or names** (we already emphasise first mentions; add lengthening) |
| Prosodic boundary prediction for children's texts is a research topic | EMNLP 2025 ([PDF](https://aclanthology.org/2025.emnlp-main.1623.pdf)) | A data-driven option for `intonation.rs` grouping |
| Sleep music is described as slow, with little rhythmic or dynamic variation. But subjective ratings outweighed acoustic features in predicting sleepiness | [PMC12370070](https://pmc.ncbi.nlm.nih.gov/articles/PMC12370070/) | Bedtime "landing": slower, softer, narrower dynamics at the end. **Test with parents' ratings**, not only acoustics. No solid study gives Hz or wpm targets for bedtime narration (web figures are unsourced) |

Tension to manage: child-directed speech means *higher pitch and more variation* (good for
attention and comprehension), while sleep means *slow, low variation*. The v3 engine already resolves
this by **position**: lively in the body of the story, a soft "landing" at the scene end and in the
outro (`voice-engine/README.md` §1 "Place"). Keep that design and measure it.

### 2.4 Whispering and sleepy delivery

- Native whisper: OmniVoice (whisper attribute), Ming-3.0-tts (an ASMR-whisper design example), AuK
  (whisper conversion editing), Step-Audio-EditX ("Whisper" style, no FR). Sources: the READMEs above.
- Today's engine whispers by rule (−3 dB, ×0.95, flat melody for "chuchota/murmura", per
  `voice-engine/README.md` "Plan de narration"). A model whisper (true unvoiced excitation) would
  sound more real. Use it **sparingly**: a whisper lowers intelligibility, so check its WER.

---

## Part 3: quality evaluation and safety

### 3.1 Objective metrics and tools (offline only, never shipped)

| Axis | Tool (licence) | Notes for FR/EN child narration |
|---|---|---|
| Intelligibility (WER/CER) | **Whisper large-v3 / v3-turbo** (MIT, [card](https://huggingface.co/openai/whisper-large-v3-turbo)); **Parakeet-TDT-0.6B-v3** (CC-BY-4.0, FR, [card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)); **Voxtral Mini 3B** (Apache, FR, [card](https://huggingface.co/mistralai/Voxtral-Mini-3B-2507)) | Use **two ASRs** and keep the worse score, so the TTS is not tuned to one recogniser's quirks. Normalise numbers and punctuation. **Baseline**: Kokoro `ff_siwis` scores **6.8 % WER** (Whisper large-v3) vs about 3 % for English voices ([Paradee card](https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.3)). Vendor French WER for Qwen3-TTS-1.7B-Base is 2.86 % vs MiniMax 4.10 % and ElevenLabs 5.22 % ([Qwen3-TTS README](https://github.com/QwenLM/Qwen3-TTS)) |
| Naturalness (MOS predictors) | **UTMOSv2** (MIT, [repo](https://github.com/sarulab-speech/UTMOSv2)); **NISQA** (MIT code, [repo](https://github.com/gabrielmittag/NISQA)); **DNSMOS** (MIT code, [repo](https://github.com/microsoft/DNS-Challenge)); **Audiobox Aesthetics** PQ/PC/CE/CU (CC-BY-4.0, [card](https://huggingface.co/facebook/audiobox-aesthetics)); **SHEET / MOS-Bench** (MIT, [repo](https://github.com/unilight/sheet)) | UTMOS and NISQA were trained mostly on English ratings: for French, "scores only mean something next to Kokoro's" ([Paradee card](https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.3)). Use them as **relative** A/B signals |
| Distributional "human-likeness" | **TTSDS2**: the only one of 16 metrics with Spearman > 0.5 in every domain tested, including a **Kids** domain, where all metrics struggle most ([arXiv 2506.19441](https://arxiv.org/pdf/2506.19441)) | The best automatic proxy found for our domain. Still, keep humans in the loop |
| Many metrics in one run | **VERSA** (Apache-2.0, [repo](https://github.com/wavlab-speech/versa)) | Harness backbone (Python, offline) |
| Speaker consistency | **ECAPA-TDNN** (SpeechBrain, Apache, [card](https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb)); WavLM-SV ([card](https://huggingface.co/microsoft/wavlm-base-plus-sv)); **wSIM** sliding window ([LACI](https://huggingface.co/papers/2609.16989)) | SIM against the frozen "voice card" clip, per paragraph. wSIM over a whole story catches **drift** |
| Prosody | Our `ziggy-voice check-prosody` (questions rise, list items, continuations, emphasis) plus new measures: **f0 range in semitones**, **share of pauses at grammatical boundaries**, **syllables/s**, **landing slope** (F0 and rate falling over the last sentences) | The first three come straight from the evidence in 2.3 |
| Instruction following | DRAMA-Eval / InstructTTSEval protocols; an emotion classifier such as emotion2vec (card `license: other`, [card](https://huggingface.co/emotion2vec/emotion2vec_plus_large)) | Offline judge only, and check the licence. Ziggy's allowed emotions are a whitelist (joy, wonder, tenderness, light worry, calm, sleepy) |
| Public reference boards | **Open TTS Leaderboard** (WER, RTFx, SIM; [space](https://huggingface.co/spaces/hf-audio/open_tts_leaderboard)); **TTS-Spaces-Arena** blind pairwise ([space](https://huggingface.co/spaces/Pendrokar/TTS-Spaces-Arena)); CV3-Eval (Apache, [repo](https://github.com/FunAudioLLM/CV3-Eval)) | For choosing candidates. **Not** for judging our children's domain |

### 3.2 Our own automatic listening test (design)

A `voice-eval` step after every bake. It is offline and deterministic, and it writes a JSON report
per segment plus a summary next to the MP3s, in the spirit of `check-prosody --json`.

1. **Text gate**: the ASR transcript of each segment goes through ChildShield (a hallucinated word is
   new text). Then WER against the displayed text: FR ≤ 5 %, EN ≤ 3 %. Proper nouns are handled
   through `lexicon.json` aliases. On failure, regenerate (best-of-N, seeded) or fall back to
   Kokoro.
2. **Voice gate**: ECAPA SIM ≥ threshold against the character's voice card, and wSIM over the
   story with no window below the floor (catches drift and identity swaps between characters).
3. **Prosody gate**: f0 range (st) at or above the v3 baseline; **0 pauses ≥ 150 ms inside a
   phrase**; narration ≤ 4.5 syll/s (≤ 4.0 for "4–6" content); landing slope negative; the existing
   `check-prosody` ratios must not regress.
4. **Sound gate**: −18 LUFS ±0.5, ≤ −1.5 dBTP (existing); UTMOSv2 and Audiobox-PQ **relative** to
   the current release (no regression beyond δ); no clipping; no long silences.
5. **Mood gate (child-safety)**: no "sad/angry/fear" style for Ziggy and companions. An emotion
   classifier flag means a human review.
6. **Human gate**: a blind A/B or MUSHRA-style page for **adult** listeners (owner, parents,
   teachers), FR and EN, 10–20 raters, pairwise preference aggregated with Bradley–Terry/Elo as in
   TTS Arena. Questions: "Which would you rather your child fell asleep to?", "Which voice is the
   same character?", "Which is clearer?" **Never record or rate children's voices.**
7. Store the reports in git next to `timing.json`, so a regression is visible in review.

### 3.3 Safety: consent, watermarking, detection, law

- **No cloning of real people** without a written, specific, revocable release. Ziggy's voice must
  be **designed** (synthetic) or come from a **consenting adult actor**, never a child. Vendors'
  own demos show the risk: MOSS-TTSD's README clones public figures from short clips
  ([card](https://github.com/OpenMOSS/MOSS-TTS/blob/main/docs/moss_ttsd_model_card.md)), and
  FireRedTTS-2 warns that its podcast-host voices must not be used without authorisation
  ([README](https://github.com/FireRedTeam/FireRedTTS2)). IndexTTS-2.5's card says the model "does
  not verify that the speaker in a reference clip consented"
  ([card](https://huggingface.co/IndexTeam/IndexTTS-2.5)).
- **The voice app must not expose an upload-a-voice feature** to children or parents. Cloning is an
  internal, owner-only step with a provenance record (who, what, consent document, licence of the
  model and data).
- **Watermarking**: **AudioSeal** (MIT code **and** weights, [repo](https://github.com/facebookresearch/audioseal),
  [card](https://huggingface.co/facebook/audioseal)), WavMark (MIT, [repo](https://github.com/wavmark/wavmark)),
  SilentCipher (MIT code, [repo](https://github.com/sony/silentcipher)). Robustness is limited.
  **AudioMarkBench**: WavMark is removed by Gaussian noise and **MP3 compression**, AudioSeal is more
  robust, and there are robustness gaps across sex and language groups
  ([arXiv 2406.06979](https://arxiv.org/html/2406.06979v2)). Neural codecs defeat most schemes
  ([arXiv 2503.19176](https://export.arxiv.org/pdf/2503.19176); VoxWatermark reports near-chance
  AUROC under generic perturbations, [summary](https://www.emergentmind.com/papers/2606.15187),
  secondary). **Test survival through our exact chain (master → 47 kbps MP3)** before relying on it.
  Layer it: watermark, plus a signed JSON manifest (hash of each MP3, model, voice card, date), plus
  visible disclosure.
- **EU AI Act Article 50** (marking synthetic audio in a machine-readable, detectable way) applies
  from **2 August 2026**. The final **Code of Practice on marking and labelling** (voluntary) was
  published in June 2026. It recommends layered marking: signed metadata, imperceptible watermarks,
  fingerprinting or logging ([EC page](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content),
  [Kennedys](https://kennedyslaw.com/en/thought-leadership/article/2026/the-eu-ai-act-s-draft-code-of-practice-on-marking-and-labelling-of-ai-generated-content-what-providers-and-deployers-need-to-know/)).
  Secondary sources report that the Digital Omnibus gives systems **already on the market** before
  2 August 2026 until **2 December 2026**, and that new systems comply at placement
  ([compliancehub](https://compliancehub.wiki/eu-ai-act-december-2-2026-legacy-systems-watermarking-grace-period-expiry/),
  [Simmons & Simmons](https://www.simmons-simmons.com/en/publications/cmoveo6ke00icuxskpgueb0od/ai-omnibus-update)).
  If Hyper Engine's voice app serves other products, Ziggy may count as a *provider*. Get a legal
  check (this report is not legal advice), but watermarking plus a manifest is cheap insurance.
- **Detection** (to spot misuse of our voices elsewhere): AASIST (MIT-style, [repo](https://github.com/clovaai/aasist))
  as an internal anti-spoofing check. Watermark detection is the primary tool.
- **Training-data provenance**: the weights of Qwen3-TTS, CosyVoice 3, VoxCPM2 and MOSS are
  permissive, but their training corpora are large, partly in-the-wild and undisclosed
  (MOSS-VoiceGenerator says "cinematic content"; OmniVoice lists 50 open datasets). This is a
  residual risk the owner should accept knowingly. The fine-tuning path below keeps our own data
  clean.

### 3.4 Data with permissive licences (FR first)

| Dataset | Licence | Content | Use |
|---|---|---|---|
| **SIWIS French** (Idiap / Edinburgh) | CC BY 4.0 per mirrors and the Piper card ([HF mirror](https://huggingface.co/datasets/Aviv-anthonnyolime/SIWIS_French_Speech_Synthesis_Database), [Idiap report](https://publications.idiap.ch/publications/show/3580)). Re-check the [DataShare record](http://datashare.is.ed.ac.uk/handle/10283/2353). A *different* 2015 multi-speaker SIWIS needs an EULA ([UNIGE](https://www.unige.ch/lettres/linguistique/en/research/projets-clos/siwis/database)) | About 10 h, one French female voice talent, includes emphasised words | Already Kokoro's `ff_siwis`. Fine-tuning base |
| **MLS French** | CC BY 4.0 ([card](https://huggingface.co/datasets/facebook/multilingual_librispeech)) | LibriVox read audiobooks | Multi-speaker FR pre-training |
| **LibriVox** recordings | Public domain (the source of MLS) | Audiobooks, including children's classics | Prosody reference, ASR test texts |
| **Common Voice** FR/EN | CC0, but since Oct 2025 downloads go via **Mozilla Data Collective** with ToS (no speaker identification, no re-hosting on some bundles) ([Mozilla](https://discourse.mozilla.org/t/exciting-news-mozilla-data-collective/145191), [MDC listing](https://datacollective.mozillafoundation.org/datasets/cmfzu8u8wa555eq8onrk334h4)) | Short read prompts, noisy | ASR and WER tests; **not** for cloning a contributor |
| **LibriTTS-R** (EN) | CC BY 4.0 ([card](https://huggingface.co/datasets/mythicinfinity/libritts_r)) | 585 h, 24 kHz | EN fine-tuning, prompts for distillation |
| **Emilia-YODAS** part of Emilia-Large | CC BY 4.0. **The original 101k h Emilia is CC BY-NC 4.0** ([card](https://huggingface.co/datasets/amphion/Emilia-Dataset)) | In-the-wild, includes FR | Only the YODAS part, with care |
| **YODAS2** | CC BY 3.0 ([card](https://huggingface.co/datasets/espnet/yodas2)) | YouTube long-form | Avoid (provenance) |
| Thorsten-Voice (DE) | CC0 ([Kokoro fine-tune card](https://huggingface.co/Thorsten-Voice/Kokoro)) | — | Proof that the Kokoro fine-tune recipe works |
| ❌ Expresso | CC BY-NC 4.0 ([card](https://huggingface.co/datasets/ylacombe/expresso)) | Expressive EN | Not for training |
| ❌ CapSpeech | CC BY-NC 4.0 | Style captions | Not for training |

### 3.5 Fine-tuning a permissive model on a custom "Ziggy" voice

**Path A (recommended): stay on Kokoro / StyleTTS2 (Apache / MIT) and fine-tune.**
- Recipes: **kikiri-tts** (Apache-2.0, ex "kokoro-deutsch"): dataset prep → Stage 1 → Stage 2 →
  voicepack extraction, with a patched StyleTTS2 ([repo](https://github.com/semidark/kikiri-tts)).
  A German voice was trained this way ([Thorsten-Voice/Kokoro](https://huggingface.co/Thorsten-Voice/Kokoro)).
  StyleTTS2 is MIT ([repo](https://github.com/yl4579/StyleTTS2)).
- **Teacher distillation**: Paradee distilled Kokoro by saving the teacher's audio, durations, pitch,
  energy and features, then training the halves separately ([arXiv 2610.06817](https://huggingface.co/papers/2610.06817),
  Apache code at [github.com/sahilmahendrakar/paradee](https://github.com/sahilmahendrakar/paradee)).
  **Ming-Kokoro-82M** retrained a Kokoro-architecture student on a 24-hour corpus synthesised by a
  teacher, "for ~$35 of GPU" ([card](https://huggingface.co/akhaliq/Ming-Kokoro-82M)). For us: design
  the Ziggy voice once with an **Apache or MIT teacher** (Qwen3-TTS VoiceDesign or VoxCPM2, never
  IndexTTS, whose licence bans improving other models). Synthesise 5–20 h of **our own children's
  texts** in FR and EN, filtered by the eval harness. Then fine-tune Kokoro on it.
- Why this path: the result is still an 82M Kokoro, so **our Rust engine, ONNX patch (durations, F0,
  energy), word timings and visemes keep working**. Re-verify that the patched node names, such as
  `/encoder/Gather_output_0`, exist in the re-exported graph. It stays CPU-friendly and needs no
  running cost (one rented-GPU day).
- Needs: 3–20 h of clean single-speaker audio per language at 24 kHz with exact transcripts
  (synthetic from the teacher, or from an adult actor with a release), the French G2P that Kokoro
  already uses (espeak-ng runs on the build machine only, as today), and Stage 1 + Stage 2 training
  on one GPU.

**Path B: LoRA on a large model** (VoxCPM2: "5–10 minutes of audio",
[card](https://huggingface.co/openbmb/VoxCPM2); Qwen3-TTS single-speaker SFT,
[finetuning](https://github.com/QwenLM/Qwen3-TTS/tree/main/finetuning)). Higher expressiveness, but
needs a GPU to bake, and gives no per-phoneme control (forced alignment instead). Good for character
voices (Santa, elves) baked as static clips.

**Path C: an adult voice actor**: 1–3 h per language reading our stories in the "Ziggy" style, under
a contract covering synthetic use, the GDPR (voice is biometric personal data), revocation and pay.
This gives the most natural result and the clearest rights. Combine it with A.

---

## Recommendations for the Ziggy voice app

### R1. Narration pipeline ("director → renderer → checker"), all offline

```
story text (src/data) ──► [Director: LLM in Hyper Engine, offline]
      PerformanceScript JSON (Zod): per sentence → speaker, emotion ∈ whitelist,
      pace (syll/s), loudness, whisper?, emphasis words, pause after (ms, only at boundaries),
      "landing" flag; per character → voiceCardId
            │  verify.ts-style deterministic checks + ChildShield on any added text
            ▼
[Renderer]  narration + Ziggy  → Kokoro engine (Rust): the script is mapped to dur_scale /
                                 f0 / energy targets that intonation.rs + contour.rs already use
            character lines    → (a) Kokoro-derived voices (today), or
                                 (b) baked with Qwen3-TTS / VoxCPM2 (voice card clone) or
                                     MOSS-TTSD for multi-turn scenes, then forced-aligned (MFA)
            ▼
[Checker]   voice-eval gates (3.2) → regenerate / fall back → master −18 LUFS → AudioSeal →
            MP3 + timing.json + visemes + signed manifest → public/… (bump sw.js VERSION)
```

- The LLM **never** produces audio and never talks to a child. It only writes performance notes,
  which a deterministic validator checks (pauses only at punctuation or syntactic boundaries, pace
  caps, allowed emotions only, never sad for Ziggy). That is the Hyper Engine pattern
  (`orchestrator.ts`: provider → strict JSON → Zod → verify → ChildShield).
- **Prosody transfer** (new, cheap, keeps exact timings): render a sentence with an expressive teacher
  (VoxCPM2 or Qwen3-TTS), extract its F0 contour and phone durations by forced alignment, then feed
  them as `f0_override` / `dur_frames` targets into Kokoro (the inputs exist already). The result is
  the expressive phrasing of a big model, with our timbre, our timings and our visemes.
- Use MOSS-TTS `tokens=` or OmniVoice `duration=` only where a fixed segment length matters (a game
  line that must fit an animation). Word timings still come from alignment.
- Long stories: render **per paragraph** with seeds, run the LACI-style guards (WER per paragraph,
  wSIM), and never generate a whole story in one call.

### R2. Evaluation harness

- Add a `voice-eval` tool (Python, offline, VERSA-based) beside `ziggy-voice check-prosody`, using
  the gates in 3.2. Make it **block publishing**: no MP3 goes into `public/` without a passing
  report.
- Metrics: two-ASR WER (Whisper large-v3 + Parakeet-v3 or Voxtral), ECAPA SIM + wSIM, UTMOSv2 and
  Audiobox-PQ as relative measures, TTSDS2 where possible, and child-specific prosody (f0 range in
  semitones, grammatical-pause share, syll/s ≤ 4.5, landing slope).
- First benchmark: today's `ziggy-v3` against Qwen3-TTS, VoxCPM2, MOSS-TTS and CosyVoice 3 on 30
  dodo segments in FR and EN, plus a blind adult A/B page. Ship nothing until a challenger beats
  ziggy-v3 on both the automatic gates and the human preference.

### R3. Fine-tuning path

1. Design 3–5 Ziggy candidates (Qwen3-TTS VoiceDesign, VoxCPM2) from a text card such as "young,
  gentle, warm child-like plush robot, never sad, French and English". The owner picks one.
2. Synthesise a 10–20 h FR+EN corpus of **our own** texts with the chosen voice; filter it with
  `voice-eval`.
3. Fine-tune Kokoro-82M with kikiri-tts (Stage 1 + 2), or distil Paradee-style; export to ONNX;
  re-run `ziggy-voice prepare`'s patch; regenerate; A/B against v3.
4. Optional upgrade: replace the synthetic corpus with an adult actor (Path C) under contract.
5. Record every model, dataset and licence in `THIRD_PARTY_LICENSES.md` and run
  `node scripts/licence-audit.mjs`. The teachers run only on the build machine, but list them anyway.

### R4. Safety

- **Shortlist only** (code and weights verified permissive): Qwen3-TTS, VoxCPM2, MOSS-TTS /
  MOSS-TTSD, CosyVoice 3, FireRedTTS-2, Ming-3.0-tts, Kokoro. **Check first**: OmniVoice (weights
  licence), AuK (French), Step-Audio-EditX (weights licence). **Inspiration only**: IndexTTS-2/2.5,
  Fish Drama 3 / S2 Pro / S1-mini, Spark-TTS, Llasa / X-codec2, Seed-TTS / Doubao, MiniMax,
  Qwen3.5-Omni, SoulX-Podcast and GLM-TTS (no FR).
- No real-person cloning without a signed release. Never a child's voice. No voice upload in any
  product. Keep a voice-provenance registry in the repo.
- Watermark every generated file with AudioSeal **after** mastering and verify detection **after
  MP3 encoding**. Add a signed JSON manifest. State on the site (FR/EN) that the voices are
  synthesised. Plan Article 50 compliance before 2 December 2026 (legal check).
- Emotions are whitelisted at the schema level: models offering sad, angry or fear tags (IndexTTS,
  Step-Audio-EditX, AuK) must have those disabled.
- All generation stays offline with zero running cost: rented-GPU bakes approved by the owner, then
  static files, as for the dodo audio today.

---

## Sources (main)

Models: [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) · [VoxCPM](https://github.com/OpenBMB/VoxCPM) ·
[MOSS-TTS](https://github.com/OpenMOSS/MOSS-TTS) · [CosyVoice](https://github.com/FunAudioLLM/CosyVoice) ·
[FireRedTTS2](https://github.com/FireRedTeam/FireRedTTS2) · [Ming-3.0-tts](https://github.com/inclusionAI/Ming-3.0-tts) ·
[OmniVoice](https://github.com/k2-fsa/OmniVoice) · [AuK](https://github.com/Tencent-Hunyuan/AuK) ·
[index-tts](https://github.com/index-tts/index-tts) · [Step-Audio-EditX](https://github.com/stepfun-ai/Step-Audio-EditX) ·
[SoulX-Podcast](https://github.com/Soul-AILab/SoulX-Podcast) · [GLM-TTS](https://github.com/zai-org/GLM-TTS) ·
[fish-speech](https://github.com/fishaudio/fish-speech) · [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M).
Papers: [LACI 2609.16989](https://huggingface.co/papers/2609.16989) · [DRAMA-Eval 2610.31796](https://huggingface.co/papers/2610.31796) ·
[MOSS-TTSD 2603.19739](https://huggingface.co/papers/2603.19739) · [OmniVoice 2604.00688](https://huggingface.co/papers/2604.00688) ·
[Paradee 2610.06817](https://huggingface.co/papers/2610.06817) · [TTSDS2 2506.19441](https://arxiv.org/pdf/2506.19441) ·
[AudioMarkBench 2406.06979](https://arxiv.org/html/2406.06979v2) · [MultiActor-Audiobook 2505.13082](https://arxiv.org/pdf/2505.13082) ·
[InstructTTSEval 2506.16381](https://huggingface.co/papers/2506.16381) · [Davison et al. 2025](https://pubmed.ncbi.nlm.nih.gov/41237785/).
Every other claim links its own source inline above.
