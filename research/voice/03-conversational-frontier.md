# 03 — The conversational and expressive voice frontier (November 2026)

Research report for the Ziggy / Hyper Engine voice app. Scope: what the best commercial
voice systems do (used as a **quality benchmark and inspiration only**), open
speech-to-speech and full-duplex models, on-device ASR and turn-taking for children, and open
voice-agent orchestration. It ends with **What this means for Ziggy**.

Written 2026-11-14. Every claim has a source URL. Where a vendor page could not be opened from
this sandbox (elevenlabs.io, ai.google.dev and developers.openai.com are not reachable here), the
claim comes from search-result extracts of that page, or from open-source code that implements the
vendor's interface (Pipecat 1.16.0, read locally). Those claims are marked *(snippet)* or *(code)*.
Model licences, sizes and languages were read from the Hugging Face Hub API on the same day.

---

## 0. Ten-line summary

1. **The leaders sound real for the same four reasons**: (a) an LLM writes *performance* along with the
   words (inline audio tags such as `[laughs]`, `[whispers]`, a free-text "director's note");
   (b) the TTS reads the **conversation context**, not one sentence alone; (c) **non-verbal sounds**
   (breath, chuckle, "mhm") and controlled pauses; (d) **turn-taking** driven by models, not by a fixed
   silence timer. ElevenLabs v4 (Sept 2026), Gemini 3.8 Flash TTS, OpenAI GPT-Realtime-2 / GPT-Live
   and Sesame lead.
2. **Pipecat 1.16 (11 Nov 2026, BSD-2) now ships a vendor-neutral expression protocol**
   (`<<warm>>`, `[[laugh]]`, `^^stress^^`, `[[pause 300]]`), with adapters mapping it to ElevenLabs,
   Gemini 3.8, Cartesia, MiniMax, Fish, Inworld, Azure HD and Mistral Voxtral 3 TTS. It is the best
   available template for Ziggy's own control language (section 7.1).
3. **No open speech-to-speech / full-duplex model is usable for children today.** They all take the
   child's raw audio, so they would have to run on the device; the smallest serious ones are 7–11 B
   parameters, most are English/Chinese only, and several have non-permissive weights. Study them,
   don't ship them.
4. **The compliant architecture is a cascade**: on-device VAD + turn detector + ASR → text → server LLM
   → ChildShield per sentence → TTS. This is what Ziggy already does; the gains are in each stage.
5. **Turn-taking**: Smart Turn v3.2 (Pipecat, **BSD-2**, 8 MB int8 ONNX, Whisper-tiny encoder, 23
   languages incl. French) is the one open, permissively licensed, audio-native end-of-turn model that
   fits in a browser. LiveKit's turn detector is **framework-locked** (licence), TEN VAD carries a
   **non-compete clause**: avoid both.
6. **ASR for children is still hard**: 2025–2026 studies put WER at ~15 % on older-child read speech
   and 32–46 % for 4–6-year-olds, for Whisper and Parakeet alike. Pick the model for French and
   browser feasibility, and design the dialogue to survive errors.
7. **ASR choice**: keep Chrome on-device recognition first; upgrade the sherpa-onnx fallback from
   Whisper tiny to **Whisper base/small (MIT)**; Parakeet-TDT-0.6B-v3 is more accurate for French but
   its weights are **CC-BY-4.0** (owner decision) and it is heavy for phones.
8. **Zero-cost Santa voice** is within reach on the device: Kokoro (Apache-2.0, already in the repo)
   now, or Kyutai **Pocket TTS** (MIT code, **CC-BY-4.0** weights, French, 100 M params, community
   WASM ports) if the owner accepts CC-BY.
9. **Hume shut its TTS and EVI APIs on 13 Nov 2026**: don't depend on it, even as a benchmark.
10. **Transparency**: the EU AI Act Art. 50(1) chatbot disclosure applies from 2 Aug 2026; machine-
    readable marking of synthetic audio (Art. 50(2)) applies to new systems from the same date
    (2 Dec 2026 for systems already on the market). OpenAI now watermarks GPT-Live audio. Ziggy's
    "never claims to be human" rule should become an audible disclosure plus a marking plan.

---

## 1. Constraints recalled, and how this report applies them

| Rule (CLAUDE.md / brief) | Consequence for this scope |
|---|---|
| Code **and** weights MIT / Apache-2.0 / BSD only; flag ISC; never GPL/AGPL/LGPL/MPL/NC | Each model below has its weights licence from the HF API. **CC-BY-4.0** (Kyutai, NVIDIA Parakeet/Canary) is permissive but **not on the list**: flagged as "owner decision". "Other"/custom licences are excluded. |
| No child voice/data to third parties; on-device ASR mandatory for children | Any model that consumes the child's **audio** must run on the child's device. That alone rules out every speech-to-speech model for children. |
| No free LLM chat for children, except the owner-approved Santa call | Conversational systems are studied for the Santa call only. |
| Every AI text through ChildShield; AI never claims to be human | Expression tags must be validated and stripped before ChildShield and before the TTS; disclosure design in 7.4. |
| Zero new running cost preferred | On-device or offline pre-generation preferred; paid APIs listed as benchmarks. |

### What Ziggy does today (read from the repo)

- Live Santa call (`src/lib/santa/santa-ai.ts`, `src/app/api/santa/chat/route.ts`): on-device ASR
  (Chrome `processLocally`, else sherpa-onnx WASM + Silero VAD + Whisper tiny int8,
  `public/santa/asr/stt-worker.js`) → text to `/api/santa/chat` → DeepSeek → NVIDIA → Mistral,
  streamed → each sentence cleaned and checked by ChildShield → voiced with **Gemini 2.5 Flash TTS**
  (`src/lib/tts-gemini.ts`, voice "Algenib", a free-text Santa style prompt) → NDJSON to the client.
  Barge-in by loudness (`src/lib/santa/listen.ts`).
- Ziggy narration: offline Kokoro-82M with a rule-based storyteller prosody planner that imposes
  durations, F0 and energy inside the network (`voice-engine/`, `docs/DODO_VOICE.md`).

So Ziggy already has the right *shape*. This report looks for what makes each stage
"frontier-grade", and for an expressive control layer that can drive both Kokoro (offline) and a
live TTS.

---

## 2. Commercial state of the art (benchmark and inspiration only)

### 2.1 Who leads, November 2026

| System | Type | Latest (date) | Expressive control interface | Notes | Sources |
|---|---|---|---|---|---|
| **ElevenLabs Eleven v4 / v4 Turbo** | TTS | 28 Sep 2026 | Inline **audio tags** `[excited]`, `[whispers]`, `[laughs]`, free text; capitals for emphasis; punctuation (ellipses) for pacing | v4 "takes the context of the text into account"; Turbo ~100–150 ms to first speech; 90+ languages; claims #1 on Artificial Analysis arena (vendor claim) | [blog](https://elevenlabs.io/blog/eleven-v4), [unite.ai](https://unite.ai/elevenlabs-launches-eleven-v4-with-low-latency-turbo-variant), [tags list](https://elevenlabs.io/fr/blog/elevenlabs-audio-tags-list) *(snippet)* |
| **ElevenLabs Eleven v3 (+ v3 Conversational in Agents)** | TTS / agent | v3 2025; v3 Conversational in Agents Feb 2026 | Same audio tags; **stability** setting Creative / Natural / Robust (Creative = most expressive, more hallucination) | Agents "Expressive mode": the LLM emits tags; turn-taking uses Scribe v2 Realtime cues; "speculative turn-taking" starts the LLM during silence; "patient" vs "eager" turn modes | [help](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-alpha), [prompting](https://elevenlabs.io/docs/best-practices/prompting), [expressive mode](https://elevenlabs.io/docs/agents-platform/customization/voice/expressive-mode), [blog](https://elevenlabs.io/blog/introducing-expressive-mode) *(snippet)* |
| **OpenAI GPT-Realtime-2 (+2.1)** | speech-to-speech API | May 2026 (2.1 July 2026) | Natural-language instructions in the session prompt (role, personality & tone, pacing, language, variety, unclear-audio rules) | "GPT-5-class reasoning", adjustable reasoning effort; voices Cedar, Marin; audio $32 / $64 per M tokens in/out | [OpenAI](https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/), [TNW](https://thenextweb.com/news/openai-gpt-realtime-2-voice-models), [pricing](https://tokencost.app/blog/openai-gpt-realtime-2-voice-pricing) |
| **OpenAI GPT-Live-1 / mini** | full-duplex (ChatGPT Voice) | 8 Jul 2026 | — (consumer) | Listens and speaks at once; delegates hard questions to GPT-5.5 in the background; SynthID audio watermark reported from 31 Jul 2026 | [OpenAI](https://openai.com/index/introducing-gpt-live), [SiliconANGLE](https://siliconangle.com/2026/07/08/openai-launches-gpt-live-voice-model-series-ahead-broad-gpt-5-6-release/), [buildfastwithai](https://buildfastwithai.com/blogs/gpt-live-review-openai-voice-model-july-2026) |
| **OpenAI gpt-4o-mini-tts (2025-12-15)** | TTS | Dec 2025 | `instructions` free text, commonly structured as *Voice Affect / Tone / Pacing / Emotion / Pronunciation / Pauses* | Forum reports that newer snapshots follow instructions less well | [OpenAI](https://developers.openai.com/blog/updates-audio-models), [Willison](https://simonwillison.net/2025/Mar/20/new-openai-audio-models/), [forum](https://community.openai.com/t/tts-no-longer-follows-instructions-parameter/1371743) |
| **Google Gemini 3.8 Flash / Flash-Lite TTS** | TTS | 2026 (after 3.1 of 15 Apr 2026) | **Per-turn `speech_metadata` style** (free text) + inline **angle-bracket sound tags** (`<laugh>`, `<sigh>`, `<short pause>`); text read strictly as a transcript | Google claims #1/#2 on Hume's quality index (vendor claim); **returns WAV with a header by default** (3.1 returned raw PCM) | [model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts), [JP blog](https://blog.google/intl/ja-jp/company-news/technology/gemini-3-8-text-to-speech/) *(snippet)*, [Pipecat adapter](https://github.com/pipecat-ai/pipecat/blob/main/src/pipecat/adapters/tts/services/gemini_adapter.py) *(code)* |
| **Gemini 3.1 Flash TTS** | TTS | 15 Apr 2026 | Prompt = **Audio profile + Scene + Director's notes**, then the transcript; inline audio tags | Community tests: the literal header "DIRECTOR'S NOTES" is sometimes spoken; use short labels and say "direction only, do not speak" | [Google blog](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts), [LiveKit guide](https://livekit.com/blog/gemini-3.1-flash-tts-prompting-guide), [Crawford](https://josephcrawford.com/posts/gemini-3-1-flash-tts-practical-guide/), [dev.to](https://dev.to/googleai/how-to-prompt-gemini-31s-new-text-to-speech-model-24bb) |
| **Cartesia Sonic-3 (3.5?)** | TTS | 2025–2026 | SSML-like tags: `<emotion value="excited"/>`, `<speed>`, `<volume>`, `<break>`, `<spell>`; `[laughter]` inline; emotion is **beta** | Emotion changes reliably only between generations (Pipecat models it as sentence scope) | [docs](https://docs.cartesia.ai/build-with-cartesia/sonic-3/volume-speed-emotion), [SSML](https://docs.cartesia.ai/build-with-cartesia/sonic-3/ssml-tags), [Pipecat adapter](https://github.com/pipecat-ai/pipecat/blob/main/src/pipecat/adapters/tts/services/cartesia_adapter.py) |
| **Hume Octave 2 / EVI 4 mini** | TTS / S2S | Oct 2025 | **Acting instructions** (free-text "description", speed, trailing silence); voice design from a text prompt | **APIs sunset 13 Nov 2026**, account data deleted | [Octave 2](https://hume.ai/blog/octave-2-launch), [acting](https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions), [shutdown](https://fish.audio/hume-tts-alternative), [news](https://www.voiceaispace.com/news/voice-ai-news-2026-10-04-w40) |
| **Microsoft MAI-Voice-1** | TTS (Azure) | Aug 2025 / Apr 2026 GA | SSML style | Proprietary; MAI-Realtime full-duplex in private preview | [Azure Labs](https://labs.ai.azure.com/innovations/mai-voice-1/), [MAI-Realtime](https://pasqualepillitteri.it/en/news/9446/mai-realtime-microsoft-full-duplex-voice) |
| **Microsoft VibeVoice-Realtime-0.5B** | open TTS | Dec 2025 | — | **MIT**, ~1 B params actually (Qwen2.5-0.5B based), English + experimental FR voice; ~300 ms first audio | [GitHub](https://github.com/microsoft/VibeVoice), [HF](https://huggingface.co/microsoft/VibeVoice-Realtime-0.5B) |
| **Amazon Nova 2 Sonic** | S2S (Bedrock) | 2 Dec 2025 | system prompt | 7 languages incl. **French**, polyglot voices | [AWS blog](https://aws.amazon.com/blogs/aws/introducing-amazon-nova-2-sonic-next-generation-speech-to-speech-model-for-conversational-ai), [languages](https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-language-support.html) |
| **Sesame (Maya/Miles; CSM-1B)** | conversational speech | CSM-1B open Mar 2025; TurnBench Aug 2026 | Context = previous audio + text turns | "Voice presence": emotional intelligence, timing, pauses, interruptions, consistent personality; CSM is a single-stage model over interleaved text+audio | [research](https://sesame.com/research), [CSM-1B](https://huggingface.co/sesame/csm-1b), [TurnBench](https://www.sesame.com/blog/turnbench) |
| **MiniMax Speech 2.8 (HD/Turbo)** | TTS | 2026 | Interjections in parentheses `(laughs)`, `(sighs)`, `(breath)`…; pauses `<#0.5#>`; emotion per request | Fixed vocabulary: an unknown interjection is **read aloud** | [fal](https://fal.ai/models/fal-ai/minimax/speech-2.8-hd/llms.txt), [guide](https://minimax-ai.chat/models/minimax-speech-2-8/), [Pipecat](https://github.com/pipecat-ai/pipecat/blob/main/src/pipecat/adapters/tts/services/minimax_adapter.py) |
| **ByteDance Seed-TTS 2.0 / SeedRealtime** | TTS / native full-duplex | Oct 2025 / 5 Aug 2026 | instruction-driven tone | SeedRealtime moves turn-taking *inside* the model (no external VAD); no weights, no API | [Seed realtime](https://seed.bytedance.com/en/realtime_voice), [full-duplex blog](https://seed.bytedance.com/blog/introducing-seed-full-duplex-speech-llm-attentive-listening-robust-interference-suppression-enabling-more-natural-interaction), [KOCPC](https://en.kocpc.com.tw/archives/24145), [Seed-TTS paper](https://arxiv.org/abs/2406.02430) |
| **Fish Audio S2 Pro** | TTS (weights published) | Mar 2026 | Free-text bracket tags `[laughing]`, `[speaking slowly]`, `[emphasis]` | Weights licence "other" → excluded | [HF](https://huggingface.co/fishaudio/s2-pro), [Pipecat](https://github.com/pipecat-ai/pipecat/blob/main/src/pipecat/adapters/tts/services/fish_adapter.py) |

### 2.2 What makes them sound real (the techniques worth copying)

1. **The LLM directs, the TTS performs.** ElevenLabs Expressive mode has the agent's LLM write
   `[laughs]`, `[whispers]`, `[sighs]` in its reply
   ([docs](https://elevenlabs.io/docs/agents-platform/customization/voice/expressive-mode)). Gemini
   separates *what* is said (verbatim transcript) from *how* (per-turn `speech_metadata` style)
   ([model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts)). Pipecat's new
   expressive module generalises this (section 2.4).
2. **Context-aware prosody.** v4 "takes the context of the text into account"
   ([unite.ai](https://unite.ai/elevenlabs-launches-eleven-v4-with-low-latency-turbo-variant));
   Sesame's CSM conditions on the conversation history to choose tone
   ([Sesame](https://sesame.com/research)). Ziggy's own storyteller planner (questions, lists, focus
   words, scene endings) is a rule-based version of this, measured in `docs/DODO_VOICE.md`.
3. **Non-verbal sounds and imperfections, in moderation.** Breaths, chuckles, sighs, "mhm"
   backchannels (Gemini 3.8 lists "mhm", "yeah" as tags,
   [JP blog](https://blog.google/intl/ja-jp/company-news/technology/gemini-3-8-text-to-speech/)).
   Pipecat's preset advice is telling: "at most one breath a reply… never by habit at the start of
   every reply", and "most sentences need no tag" (`src/pipecat/expressive/policy.py`, *(code)*).
4. **Punctuation before tags.** ElevenLabs' guidance: an ellipsis or a period often does what a tag
   would; tags guide, they are not deterministic; at most two compatible tags
   ([prompting](https://elevenlabs.io/docs/best-practices/prompting),
   [Runware guide](https://runware.ai/docs/models/elevenlabs-v3/guides/directing-with-audio-tags.md)).
5. **Persona as a structured brief.** OpenAI's realtime prompting guide uses sections Role &
   Objective, Personality & Tone, Pacing, Language, Variety (avoid repeating the same phrases),
   Unclear audio (ask to repeat rather than guess)
   ([cookbook](https://developers.openai.com/cookbook/examples/realtime_prompting_guide),
   [Kore.ai summary](https://docs.kore.ai/agent-platform/v1/prompts/gpt-realtime-1_5-quick-ref.md));
   Gemini 3.1 uses Audio profile / Scene / Director's notes
   ([LiveKit](https://livekit.com/blog/gemini-3.1-flash-tts-prompting-guide)). Note OpenAI's remark
   that the `speed` parameter only changes playback rate: real pacing must be *instructed*.
6. **Turn-taking by model, not by timer.** ElevenLabs uses ASR-side cues and speculative LLM starts;
   Kyutai's STT predicts a pause probability; SeedRealtime and GPT-Live do it inside a full-duplex
   model. Yet Sesame's TurnBench (Aug 2026, 14 systems incl. Gemini Live and OpenAI Realtime) finds
   **no system handles turn timing well**; humans start their turn a median 151 ms *before* the other
   ends ([TurnBench](https://www.sesame.com/blog/turnbench),
   [paper](https://huggingface.co/papers/2608.25218),
   [AlphaSignal](https://alphasignal.ai/news/sesame-s-turnbench-exposes-how-gemini-live-and-openai-realtime-fumble)).
7. **Long-form stability** is now a selling point (Gemini 3.8 multi-turn stability; VibeVoice
   long-form; MiniCPM-o "> 1 min stable speech"), relevant to bedtime narration.

### 2.3 The control interfaces side by side (design inspiration)

| Vendor | Delivery (mood) | One-off sounds | Pause | Emphasis | Scope of a delivery change |
|---|---|---|---|---|---|
| ElevenLabs v3/v4 | `[warmly]`, `[excited]`, `[whispers]`, `[mischievously]`… free text | `[laughs]`, `[chuckles]`, `[sighs]`, `[inhales deeply]`, `[clears throat]`, sound effects `[applause]` | `[short pause]` / `[long pause]` (no SSML break in v3) | CAPITALS | anywhere in the text |
| Gemini 3.8 | free-text style per request (`speech_metadata`) | `<laugh>`, `<chuckle>`, `<giggle>`, `<sigh>`, `<breath>`, `<gasp>`, `<yawn>`… | `<short pause>` / `<long pause>` | CAPITALS | between sentences |
| Cartesia Sonic-3 | `<emotion value="calm"/>` (fixed list, beta) | `[laughter]` | `<break time="…"/>` | — | between generations |
| MiniMax 2.8 | emotion per request (fixed list) | `(laughs)`, `(sighs)`, `(breath)`, `(humming)`… fixed list | `<#0.5#>` (0.01–99.99 s) | — | per request |
| Inworld TTS-2 | `[calm and slow]` free text; `[reset]` to baseline | `[laugh]`… | `<break>` | CAPITALS | persists past the sentence |
| Fish S2 | `[speaking slowly]`, `[excited]` free text; `[normal pace]` | `[laughing]`, `[sighing]`, `[yawning]` | break / long break | `[emphasis]` | within one input |
| Azure HD | `[excited]` fixed list, `[Neutral]` resets | `[laughter]` | SSML | — | until next marker |
| Mistral Voxtral 3 TTS | `[emotion=warm]`, `[pace=slow]` | `[laugh]` | — | — | until next tag |
| OpenAI mini-tts / realtime | free-text `instructions` (Affect, Tone, Pacing, Emotion, Pauses) | — (described in words) | described | CAPITALS (common practice) | whole request |
| Hume Octave | free-text acting description (Octave 1), speed, trailing silence | — | trailing_silence | — | per utterance |

Sources: the per-vendor adapters in Pipecat 1.16
([`src/pipecat/adapters/tts/services/`](https://github.com/pipecat-ai/pipecat/tree/main/src/pipecat/adapters/tts/services)) *(code)*,
plus the vendor pages in 2.1.

**Takeaway:** every vendor converged on *two kinds* of markup — a **delivery** that lasts
(mood/pace/whisper) and a **sound** at one point (laugh/breath) — plus pause and emphasis. They
differ in syntax and in *where* a delivery may change (anywhere vs. per sentence). A portable
language must model exactly these four things and the scope rule.

### 2.4 Pipecat's universal expression protocol (Nov 2026) — read in code

Pipecat 1.16.0 (released 2026-11-11, BSD-2-Clause) added an **alpha "expressive conversation"**
module (`src/pipecat/expressive/`, ~1,800 lines, plus `adapters/tts/`). What it does
([repo](https://github.com/pipecat-ai/pipecat), [CHANGELOG](https://github.com/pipecat-ai/pipecat/blob/main/CHANGELOG.md)) *(code)*:

- **Syntax the LLM writes**: `[[name]]` a sound or silence at one point, `<<name>>` the delivery of
  the words after it (until the next delivery tag), `<<name: words>>` the delivery of just those words,
  `^^word^^` stress, `<<neutral>>` back to baseline, `[[pause 300]]` milliseconds. Example from the
  source: `<<warm>> It's [[laugh]] ^^back^^ up. [[pause 300]] Your code is <<slow: A B 7>>.`
- **Universal vocabulary**: ~110 deliveries (`ExpressionDelivery`: warm, playful, curious, amazed,
  calm, whispering, slow…) and ~45 sounds (`ExpressionSound`: laugh, chuckle, giggle, breath,
  light breath, yawn, hum, "um"…). A small **core set** is taught by default: calm, sympathetic,
  apologetic, warm, excited, surprised, sad, grateful, curious, confident, slow, fast + laugh,
  chuckle, sigh, breath.
- **Capabilities negotiation**: each TTS adapter declares what it can perform
  (`ExpressionCapabilities`: sounds, deliveries, free-text allowed, pause range in ms, emphasis,
  `delivery_scope` ANYWHERE vs SENTENCE, and a `service_vocabulary` mapping universal names to the
  vendor's words, e.g. WARM → ElevenLabs `warmly`, LAUGH → Cartesia `laughter`). The LLM is only
  taught tags the active TTS can perform; **tags outside them are dropped from speech** (not read
  aloud).
- **Policy**: `ExpressionPolicy` picks which tags are offered and adds guidance presets (match the
  user's mood; say details slowly; breathe at most once a reply).
- **Tagger instead of LLM**: `PipecatToneTagger` — a 17 M-parameter ONNX classifier
  (`pipecat-ai/tone-models`, **BSD-2**, English, base `ettin-encoder-17m`) labels each streamed
  sentence with a delivery/sound in ~15 ms on CPU, so a plain LLM reply can still be performed
  ([HF](https://huggingface.co/pipecat-ai/tone-models)).
- **Perception**: a parallel `PerceptionReader` reads *how the user said it* (tone, sarcasm,
  speech rate) and passes it to the LLM. **For children this is a line not to cross** (see 7.4).

---

## 3. Open speech-to-speech and full-duplex models (2025–2026)

All need the user's raw audio. For Ziggy they could only be used on the child's device, which none
of these can do on a phone at acceptable quality; they are listed for inspiration and as a watch list.

| Model | Org (date) | Size | Code / **weights** licence | French | Latency / notes | Verdict for Ziggy | Source |
|---|---|---|---|---|---|---|---|
| **Moshi** (moshiko/moshika) | Kyutai (2024) | 7.7 B | MIT/Apache / **CC-BY-4.0** | no (EN) | full-duplex, ~200 ms theoretical | inspiration (architecture: inner monologue, dual streams) | [HF](https://huggingface.co/kyutai/moshiko-pytorch-bf16) |
| **Unmute** (cascade: Kyutai STT + any LLM + Kyutai TTS) | Kyutai (Jul 2025) | STT 1 B + TTS 1.6 B | **MIT** code / **CC-BY-4.0** weights | **yes (EN/FR)** | 16 GB GPU; semantic VAD in STT | best *architecture* reference (read, see 5.4) | [GitHub](https://github.com/kyutai-labs/unmute), [DSM paper](https://arxiv.org/abs/2509.08753) |
| **Hibiki-Zero** | Kyutai (Feb 2026) | 3 B | weights licence not stated on card | yes (FR/ES/PT/DE→EN) | simultaneous speech translation | not our use case | [HF](https://huggingface.co/kyutai/hibiki-zero-3b-pytorch-bf16), [MarkTechPost](https://www.marktechpost.com/2026/02/13/kyutai-releases-hibiki-zero-a3b-parameter-simultaneous-speech-to-speech-translation-model-using-grpo-reinforcement-learning-without-any-word-level-aligned-data/) |
| **PersonaPlex-7B** | NVIDIA (early 2026) | 8.4 B | **"other" (NVIDIA)**, gated | no (EN) | Moshi fine-tune with role/voice prompts | excluded (licence) | [HF](https://huggingface.co/nvidia/personaplex-7b-v1) |
| **NemotronLabs VoiceChat-11B** | NVIDIA (Sep 2026) | 11 B | **OpenMDW-1.1** | no (EN) | full-duplex + tool calling; ~450 ms turn-taking | inspiration (tool calls in full-duplex) | [HF](https://huggingface.co/nvidia/NVIDIA-NemotronLabs-VoiceChat-11B), [arXiv 2609.21967](https://arxiv.org/abs/2609.21967) |
| **Qwen3-Omni-30B-A3B** | Alibaba (Sep 2025) | 35 B MoE (3 B active) | **Apache-2.0** | **yes** (19 speech-in, 10 speech-out languages incl. FR) | Thinker–Talker, low-latency streaming | server-only → would receive child audio → excluded for children; inspiration | [HF](https://huggingface.co/Qwen/Qwen3-Omni-30B-A3B-Instruct) |
| **Qwen2.5-Omni-3B** | Alibaba (2025) | 5.5 B | licence "other" (Qwen research) | partial | — | excluded (licence) | [HF](https://huggingface.co/Qwen/Qwen2.5-Omni-3B) |
| **MiniCPM-o 4.5** | OpenBMB (2026) | 9 B (Qwen3-8B + Whisper-medium + CosyVoice2) | **Apache-2.0** | speech **EN/ZH only** | full-duplex, 1 Hz "speak or not" decision, voice cloning by reference audio; runs on a MacBook | inspiration (proactive turn decision) | [HF](https://huggingface.co/openbmb/MiniCPM-o-4_5) |
| **Step-Audio 2 mini** | StepFun (2025) | 8.3 B | **Apache-2.0** | EN/ZH | paralinguistic understanding | inspiration | [HF](https://huggingface.co/stepfun-ai/Step-Audio-2-mini), [report](https://arxiv.org/abs/2507.16632) |
| **Kimi-Audio-7B** | Moonshot (2025) | 9.8 B | **MIT** | EN/ZH | audio foundation model | inspiration | [HF](https://huggingface.co/moonshotai/Kimi-Audio-7B-Instruct) |
| **Fun-Audio-Chat-8B** | Alibaba FunAudioLLM (Dec 2025) | 9.5 B | **Apache-2.0** | EN/ZH | S2S | inspiration | [HF](https://huggingface.co/FunAudioLLM/Fun-Audio-Chat-8B) |
| **LLaMA-Omni 2** | ICT/CAS (2025) | 0.5–32 B | no licence on card; Qwen2.5 base | EN (some sizes EN/ZH) | streaming AR speech decoder; uses CosyVoice 2 decoder | excluded (licence unclear) | [HF](https://huggingface.co/ICTNLP/LLaMA-Omni2-7B), [arXiv](https://arxiv.org/abs/2505.02625) |
| **Freeze-Omni** | VITA (2024) | 7 B LLM frozen | **Apache-2.0** | ZH/EN | keeps the text LLM frozen (safety behaviour preserved) | inspiration: the idea of a *frozen, already-aligned* LLM | [HF](https://huggingface.co/VITA-MLLM/Freeze-Omni) |
| **VITA-Audio** | VITA (2025) | 8 B | **Apache-2.0** | ZH/EN | audio on first forward pass | inspiration | [HF](https://huggingface.co/VITA-MLLM/VITA-Audio-Plus-Vanilla), [arXiv](https://arxiv.org/abs/2505.03739) |
| **GLM-4-Voice-9B** | Zhipu (2024) | 9.5 B | custom GLM-4 licence | ZH/EN | — | excluded | [HF](https://huggingface.co/zai-org/glm-4-voice-9b) |
| **Sesame CSM-1B** | Sesame (Mar 2025) | 1.55 B | **Apache-2.0**, gated | EN | conversational TTS conditioned on dialogue audio | inspiration (context-conditioned TTS); EN only | [HF](https://huggingface.co/sesame/csm-1b) |
| **MOSS-Live** | OpenMOSS (11 Nov 2026) | ? | not verified | ? | full-duplex + background tools | watch list | [CASRAI](https://casrai.org/news/openmoss-moss-live-full-duplex-interaction-system-2026) |

Curated list of full-duplex models and benchmarks: [Awesome-Full-Duplex-SDM](https://github.com/Ruiqi-Yan/Awesome-Full-Duplex-SDM).

**Why the cascade wins for Ziggy (not just "for now"):**

- *Child audio stays on the device* only if everything that touches it runs there. A 7–11 B
  full-duplex model does not run in a phone browser or the Tauri app at acceptable quality.
- *ChildShield on every reply* is natural on text; a model that emits audio tokens directly needs a
  text side channel and a way to stop audio already generated. Freeze-Omni's "frozen LLM" idea
  shows the research community worries about this too.
- *French*: the only French-capable open S2S candidates are Qwen3-Omni (server) and the Kyutai
  cascade.
- *Turn timing*, the main selling point of full-duplex, is not solved even by the leaders
  (TurnBench). A cascade with a good turn detector and masking tricks closes most of the gap.

---

## 4. On-device ASR for children

### 4.1 Candidates

| Model | Params | Code / **weights** licence | French | Streaming | Browser / WebView feasibility | Source |
|---|---|---|---|---|---|---|
| **Chrome on-device Web Speech** (`processLocally`) | — (Google on-device pack) | browser feature | fr-FR listed | yes | Chrome 139+ desktop/Android; not Safari; was disabled on ChromeOS | [MDN](https://developer.mozilla.org/docs/Web/API/SpeechRecognition/processLocally), [intent to ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/VNOok2dbmHM), [MDN install()](https://developer.mozilla.org/docs/Web/API/SpeechRecognition/install_static) |
| **Whisper tiny / base / small** (in use: tiny int8 via sherpa-onnx) | 39 M / 74 M / 244 M | **MIT** | yes (weaker in tiny) | chunked (after VAD) | proven in repo (sherpa-onnx WASM) | [whisper](https://github.com/openai/whisper) |
| **Whisper large-v3-turbo** | 809 M | **MIT** | yes | chunked | too heavy for phones; desktop WebGPU possible | [HF](https://huggingface.co/openai/whisper-large-v3-turbo) |
| **distil-large-v3.5** | 756 M | **MIT** | **no (EN)** | chunked | — | [HF](https://huggingface.co/distil-whisper/distil-large-v3.5) |
| **Parakeet-TDT-0.6B-v3** | 627 M | **CC-BY-4.0** | yes (25 EU languages) | offline TDT (fast) | community int8 ONNX for ONNX Runtime Web WASM; WebGPU int8 reportedly wrong → fp16 | [HF](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3), [int8 WASM](https://huggingface.co/CoderViking/parakeet-tdt-0.6b-v3-onnx), [WebGPU note](https://huggingface.co/striimit/parakeet-tdt-0.6b-v3-webgpu) |
| **Canary-1B-v2** | 979 M | **CC-BY-4.0** | yes | offline | heavy | [HF](https://huggingface.co/nvidia/canary-1b-v2) |
| **Nemotron speech streaming EN 0.6B** | 618 M | "other" | no | yes (cache-aware) | — | [HF](https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b) |
| **Moonshine v2 streaming** (tiny/small/medium) | 44 M / ~123 M / 266 M | **MIT** | **no French model** (EN, ES, DE, JA, ZH, AR, VI, TL…) | yes, latency-critical design | very light; great for EN | [HF org](https://huggingface.co/moonshine-ai), [paper](https://arxiv.org/abs/2602.12241) |
| **Voxtral Mini 4B Realtime (2602)** | 4.4 B | **Apache-2.0** | yes (13 languages) | yes (480 ms ≈ Whisper; configurable < 200 ms) | official WebGPU demo, but ~4 B params is desktop-class | [HF](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602), [Mistral](https://mistral.ai/news/voxtral-transcribe-2), [arXiv](https://arxiv.org/abs/2602.11298), [WebGPU space](https://huggingface.co/spaces/mistralai/Voxtral-Mini-4B-Realtime-WebGPU) |
| **Kyutai STT 1B en_fr** | 989 M | MIT/Apache code / **CC-BY-4.0** | **yes** | yes, 500 ms delay, **built-in pause prediction (semantic VAD)** | official Rust server/MLX; community WASM demo space | [HF](https://huggingface.co/kyutai/stt-1b-en_fr), [Kyutai](https://kyutai.org/next/stt), [WASM demo](https://huggingface.co/spaces/efficient-nlp/wasm-streaming-speech) |

### 4.2 What we know about child speech (2025–2026)

- **ChildVox** (2026 preprint): on MyST child speech, Whisper-Large ≈ 14.8 % WER vs Parakeet-TDT ≈
  15.8 %; on clinical ADOS recordings ≈ 40 % vs 46 %
  ([arXiv 2605.29257](https://arxiv.org/pdf/2605.29257), [project](https://tiantiaf0627.github.io/childvox/)).
- **Pediatric Talkbank** (medRxiv, Oct 2025, Parakeet-TDT-0.6B-v2 and Whisper-small): mean WER
  ≈ **46.5 % for ages 4–6** vs ≈ 32 % for older children
  ([medRxiv](https://www.medrxiv.org/content/10.1101/2025.10.13.25337901.full.pdf)).
- **Benchmarking children's ASR** (2024): Canary/Parakeet beat Whisper zero-shot on child speech
  ([summary](https://www.themoonlight.io/review/benchmarking-childrens-asr-with-supervised-and-self-supervised-speech-foundation-models)).
- **Dutch child speech under noise** (2026): 5 % to 50 % WER depending on noise
  ([arXiv 2605.28833](https://arxiv.org/pdf/2605.28833)).
- **French children**: no public 2025–2026 benchmark of Whisper/Parakeet on French child speech was
  found; French child corpora are scarce. Ziggy must assume **English-like or worse** error rates.

Design consequences: (1) the youngest users will be misheard often, whatever the model; (2) Santa's
LLM prompt must tolerate transcription errors (Unmute's prompt does exactly this, 5.4); (3) the
guided call (keyword/loudness-driven) stays the default for little ones; (4) a bigger model helps
older children more than younger ones.

### 4.3 Voice activity and end-of-turn detection

| Component | Kind | Licence | French | Size / speed | Browser | Verdict | Source |
|---|---|---|---|---|---|---|---|
| **Silero VAD** (in use) | frame VAD | **MIT** | language-agnostic | ~2 MB | yes (in repo) | keep | [HF](https://huggingface.co/onnx-community/silero-vad) |
| **TEN VAD** | frame VAD | Apache-2.0 **+ non-compete conditions** (may not compete with Agora; derivatives stay under it) | agnostic | smaller/faster than Silero (vendor claim) | WASM build | **avoid** (not plain Apache) | [GitHub LICENSE](https://github.com/TEN-framework/ten-vad) |
| **Smart Turn v3.2** | **audio-native end-of-turn** classifier | **BSD-2** (code, data, weights) | **yes** (23 languages) | 8 M params; 8 MB int8 ONNX; ~10 ms on some CPUs, ~65 ms on a cloud instance | ONNX Runtime Web feasible (16 kHz, last 8 s, Whisper log-mel features) | **adopt** | [GitHub](https://github.com/pipecat-ai/smart-turn), [HF](https://huggingface.co/pipecat-ai/smart-turn-v3), [blog](https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/) |
| **LiveKit turn detector** (multilingual) | text end-of-turn (Qwen2.5-0.5B distilled) | **LiveKit Model License: only usable with LiveKit Agents**, no standalone use | yes | ~400 MB RAM, ~25 ms | — | **excluded** (framework lock) | [HF](https://huggingface.co/livekit/turn-detector), [LICENSE](https://huggingface.co/livekit/turn-detector/blob/main/LICENSE) |
| **TEN Turn Detection** | text end-of-turn | Apache-2.0 | ? | 7.6 B | no | too big | [HF](https://huggingface.co/TEN-framework/TEN_Turn_Detection) |
| **Parakeet realtime EOU 120M** | ASR + end-of-utterance token | "other" (NVIDIA) | EN | 120 M | — | excluded | [HF](https://huggingface.co/nvidia/parakeet_realtime_eou_120m-v1) |
| **Kyutai STT pause prediction** | semantic VAD inside streaming ASR | CC-BY-4.0 weights | yes | part of the 1 B STT | Rust server only (official) | inspiration / owner decision | [Kyutai](https://kyutai.org/next/stt) |

Children and turn-taking: a 2026 IWSDS study finds silence alone cannot explain children's turn
timing while acoustic predictive models do well, and children leave longer gaps than adults
(adult median gap < 200 ms) ([ACL Anthology](https://aclanthology.org/2026.iwsds-1.34.pdf)).
Industry endpointers use a fixed 500–1000 ms silence
([Uniphore](https://www.uniphore.com/blog/part-2-knowing-when-to-speak/)), which **cuts children
off**. An audio-native model such as Smart Turn, which hears intonation ("et puis… euh…"), is the
right tool; it was not trained on children, so its threshold must be tuned on child-like test audio.

---

## 5. Open orchestration frameworks — architecture ideas

### 5.1 Pipecat (Daily) — BSD-2-Clause, v1.16.0, 11 Nov 2026 *(code read locally)*

- Frame pipeline (transport → VAD → STT → user aggregator → LLM → TTS → transport) with typed
  frames and **interruptions** as system frames.
- `src/pipecat/turns/`: pluggable **user-turn start/stop strategies** (speech timeout, turn
  analyzer such as Smart Turn, classifier, LLM turn completion, external), **eager end of turn**
  plus a **SpeculationGate** (start the LLM on a provisional end of turn, *hold* its output until
  the turn is confirmed, discard it if the user continues), **user-mute strategies** (e.g. mute the
  mic until the bot's first message is complete, or during a function call), a **user-idle
  controller**.
- `src/pipecat/utils/text/`: markdown filter, skip-tags aggregator, pattern-pair aggregator,
  tagged-LLM-text parser — the plumbing to strip or route markup before TTS.
- `src/pipecat/expressive/` + `adapters/tts/`: the expression protocol of section 2.4.
- Ziggy is TypeScript/Rust and runs ASR in the browser, so Pipecat itself (Python server) is not a
  fit, but its **turn strategies, speculation gate and expression protocol are directly portable
  ideas**, and its licence allows copying code with attribution.
  [Repo](https://github.com/pipecat-ai/pipecat)

### 5.2 LiveKit Agents — framework Apache-2.0, turn model restricted

Plugin code is Apache-2.0 but the end-of-turn model is under the LiveKit Model License, usable only
inside LiveKit Agents ([PyPI](https://pypi.org/project/livekit-plugins-turn-detector/1.4.6/),
[licence](https://huggingface.co/livekit/turn-detector/blob/main/LICENSE)). WebRTC-room
architecture, server-side audio: the child's audio would reach a server. Not a fit.

### 5.3 TEN framework (Agora) — Apache-2.0 with additional conditions

The framework and TEN VAD add conditions restricting deployment that competes with Agora
([framework LICENSE](https://raw.githubusercontent.com/TEN-framework/ten-framework/main/LICENSE),
[ten-vad](https://github.com/TEN-framework/ten-vad)). Not on the allowed list. Avoid. (Note: the
sherpa-onnx config in `public/santa/asr/stt-worker.js` has an unused `tenVad` block; keep it unused.)

### 5.4 Kyutai Unmute — MIT *(code read locally)*

Cascade with a websocket backend. Lessons from `unmute/unmute_handler.py` and
`unmute/llm/system_prompt.py`:

- End of turn when the STT's **pause prediction > 0.6**; barge-in when the bot speaks and pause
  prediction **< 0.4**; then a **"flush trick"**: feed silence for the STT delay (0.5 s) so the last
  words are transcribed before the LLM starts.
- **First 3 s uninterruptible by VAD** (echo cancellation warms up; the bot's own voice can
  otherwise trigger barge-in), while a recognised *word* can still interrupt.
- User silence timeout 7 s; first reply temperature 0.7, later 0.3.
- System prompt section **"TRANSCRIPTION ERRORS"**: transcripts may be wrong; prefer guessing the
  similar-sounding intended word over asking; if the message ends abruptly, answer very briefly to
  prompt them to continue. And: "Everything is pronounced literally, so things like (chuckles) won't
  work" — the reason a validated tag layer is needed.
- Production LLM is any OpenAI-compatible endpoint — like Ziggy's DeepSeek/NVIDIA/Mistral chain.
  [Repo](https://github.com/kyutai-labs/unmute)

### 5.5 Latency masking used by the leaders

Speculative LLM start during silence (ElevenLabs, Pipecat SpeculationGate), sentence-level
streaming to TTS (Ziggy already does), short pre-rendered acknowledgements or backchannels while the
model thinks (Gemini's "mhm" tags, ElevenLabs filler), and hiding latency in non-verbal sound
(a breath or chuckle before the first word).

---

## 6. Also relevant: small open TTS that can run on the device

(The TTS landscape is covered by another report; listed here only for the live Santa call.)

| Model | Size | Licence | French | Device | Notes | Source |
|---|---|---|---|---|---|---|
| **Kokoro-82M** (already used offline) | 82 M | **Apache-2.0** | yes (`ff_siwis`) | browser via kokoro-js | the voice-engine controls (durations, F0, energy) exist in Rust | `docs/DODO_VOICE.md` |
| **Kyutai Pocket TTS** | 100 M (EN small variants 1.9–18 M, Oct 2026) | code **MIT**, weights **CC-BY-4.0** (gated) | **yes** (+DE, PT, IT, ES, NL) | CPU real-time on 2 cores, ~200 ms first chunk; community WASM / ONNX Runtime Web ports | voice cloning from a wav; per-voice licences in `kyutai/tts-voices`; "prohibited use" list forbids cloning without consent | [GitHub](https://github.com/kyutai-labs/pocket-tts), [HF](https://huggingface.co/kyutai/pocket-tts), [blog](https://kyutai.org/blog/2026-01-13-pocket-tts) |
| **VibeVoice-Realtime-0.5B** | ~1 B | **MIT** | experimental FR voice | GPU-class | streaming text input | [HF](https://huggingface.co/microsoft/VibeVoice-Realtime-0.5B) |
| **Qwen3-TTS-12Hz-1.7B** | 1.9 B | **Apache-2.0** | multilingual | server | instruction-controllable | [HF](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice) |

---

## 7. What this means for Ziggy

### 7.1 A Ziggy expressive control language ("Ziggy Voice Direction", ZVD)

Goal: one way to write *how* a line is performed, used by (a) human-written scripts (bedtime
stories, game lines, guided Santa calls), (b) the Santa LLM, (c) any TTS back-end — first Ziggy's
Rust/Kokoro engine (offline, zero cost), then Gemini or a future open TTS. Inspired by Pipecat's
protocol (BSD-2, so syntax and ideas can be reused freely), ElevenLabs' tags and Gemini's
director/transcript split.

**Layer 1 — the character card (who speaks, fixed per voice; never written by the LLM).**
Like Gemini's *audio profile + scene* and OpenAI's *personality & tone*, versioned in the repo:

```jsonc
// src/data/voices/santa.json (proposal)
{
  "id": "santa", "version": 1,
  "profile": { "fr": "Père Noël : grand-père jovial, voix grave et chaleureuse, un peu rocailleuse",
               "en": "Santa: jolly grandfather, deep warm slightly gravelly voice" },
  "baseline": { "pace": 0.92, "pitch": "low", "energy": "warm" },
  "allowedDelivery": ["warm", "jolly", "amazed", "curious", "gentle", "whisper", "proud", "slow"],
  "allowedSounds": ["hoho", "chuckle", "breath", "hmm", "mhm"],
  "maxSoundsPerReply": 1,
  "neverDelivery": ["sad", "angry", "scared", "stern", "sarcastic", "crying"]
}
```

Ziggy's card would allow `warm, playful, amazed, curious, calm, sleepy, proud, gentle, whisper` and
sounds `giggle, breath, yawn (bedtime only), hum, mhm`; elves `excited, mischievous, giggle`.
The `neverDelivery` list encodes the CLAUDE.md red line "Ziggy and companions are never sad".

**Layer 2 — inline markup in the text (what the script or the LLM writes).**
Four constructs only, the ones every vendor converged on (2.3):

| Construct | Syntax | Meaning | Example |
|---|---|---|---|
| Delivery (lasts) | `<<warm>>` … / `<<whisper: words>>` / `<<neutral>>` | mood, pace or manner until the next delivery (or just the span) | `<<amazed>> Un dragon ? <<whisper: Il dort encore.>>` |
| Sound (one point) | `[[hoho]]`, `[[giggle]]`, `[[breath]]`, `[[mhm]]` | non-verbal sound from the card's list | `[[hoho]] Bonjour Léa !` |
| Pause | `[[pause 400]]` (ms, clamped 100–2000) | silence | `Et alors… [[pause 600]] la porte s'ouvrit.` |
| Stress | `^^mot^^` | focus word | `C'est ^^toi^^ qui as trouvé !` |

Rules (taken from what works for the leaders):

- **Whitelist, not free text.** Unknown or disallowed tags are *removed*, never spoken (MiniMax
  reads unknown interjections aloud; Unmute warns "(chuckles) won't work"). Parser in
  `src/lib/voice/zvd.ts`, shared by server and client, with Vitest cases in FR and EN.
- **Sparse by default.** "Most sentences need no tag"; max one sound per reply; no sound at the
  start of every reply (Pipecat presets). Punctuation first (ElevenLabs).
- **Scope = sentence for live speech.** Many back-ends only change delivery between sentences
  (Gemini, Cartesia, MiniMax); Ziggy already streams sentence by sentence, so define a delivery change
  inside a sentence as best-effort.
- **Safety order:** LLM output → ZVD parse/validate → *plain text* (tags stripped) to ChildShield →
  if OK, the validated tags go back on for the TTS. Tags can never smuggle words past ChildShield.
  The `cleanReply()` stage in `santa-ai.ts` currently deletes `*…*` and `(…)`; it would keep the
  validated ZVD tags instead.
- **Read-aloud and karaoke stay exact.** The displayed text is the tag-free text; word timings and
  visemes are computed on it (keeps `src/lib/dodo/voice.test.ts` semantics).

**Compilation targets (one adapter per back-end, like Pipecat's `ExpressionCapabilities`):**

| ZVD | Ziggy Rust engine (Kokoro, offline) | Gemini TTS (live, today) | Kokoro in browser (live, zero cost) |
|---|---|---|---|
| `<<warm>>`, `<<amazed>>`… | contour preset in `contour.rs` (F0 range, energy `n_override`, tempo `dur_scale`) — extends the existing sentiment presets | appended to the style prompt / `speech_metadata` for that sentence | voice-style mix + speed per sentence |
| `<<whisper>>` | existing whisper path (already used for "chuchota") | "whispering" in style | breathy filter preset |
| `[[hoho]]`, `[[giggle]]`, `[[breath]]` | **pre-rendered, code-built or recorded sound bank** clips mixed in (zero cost, consistent voice) | `<laugh>`, `<breath>` tags (3.x) or the clip | sound-bank clip |
| `[[pause n]]` | silence of n ms | `<short pause>` / `<long pause>` | silence |
| `^^mot^^` | focus-word F0 bump (the planner already has "mots mis en valeur") | CAPITALS | speed/energy bump |

**Prompting the Santa LLM with ZVD** (added to `santaSystemPrompt`, FR/EN): "You may use at most
one of these sounds: `[[hoho]]`, `[[chuckle]]`; and these voices: `<<amazed>>`, `<<whisper: …>>`,
`<<gentle>>`. Most sentences need none. Never any other tag." Today the prompt says "Never use
… stage directions"; ZVD replaces that with a tiny, validated vocabulary.

**Optional, zero-LLM tagger.** For scripted lines and for LLM replies written without tags, a
small rules-based tagger (the voice-engine already classifies question/list/suspense/feeling) can
add deliveries. Pipecat's 17 M BSD-2 tone tagger is English-only; a French equivalent would have to
be trained — not worth it before the rules are exhausted.

### 7.2 The best open path for the live Santa call

Keep the cascade (section 3). Upgrade each stage; all items below respect the licence list unless
marked.

```
CHILD DEVICE (nothing audio leaves it)                         SERVER (text only)
mic → AEC (browser) → Silero VAD (MIT)                       
     → Smart Turn v3.2 (BSD-2, 8 MB) decides end of turn   ──text──▶ santaReplyStream (DeepSeek→NVIDIA→Mistral)
     → ASR: Chrome on-device | sherpa-onnx Whisper base/small (MIT)     → ZVD validate → ChildShield per sentence
◀── audio: (A) Gemini TTS per sentence (today)            ◀──text+tags── (B) or text only, voiced on device
     or (B) on-device Santa voice: Kokoro (Apache-2.0) / Pocket TTS (CC-BY, owner OK)
     + pre-cached "thinking" clips and sound bank
```

1. **Turn detection (biggest perceived-quality win).** Run Smart Turn v3.2 in the existing Web
   Worker (ONNX Runtime Web, or a sherpa-onnx custom model) when Silero reports ≥ 200–300 ms of
   silence; respond when probability > threshold, otherwise keep listening up to a child-friendly
   cap (e.g. 2.5–3 s), then answer briefly to invite them to continue (Unmute's "abrupt ending"
   rule). Tune threshold and caps on child-like audio. Licence: BSD-2 — add to
   `THIRD_PARTY_LICENSES.md`. Feature extraction = Whisper log-mel (same front-end family as the
   Whisper model already shipped).
2. **Barge-in.** Keep loudness-based barge-in but add Unmute's rules: no VAD barge-in during the
   first ~3 s of Santa's first reply (echo), and require ≥ 300 ms of speech; a recognised word
   always interrupts.
3. **Latency masking.** (a) On end of turn, immediately play a short **pre-cached Santa clip**
   chosen by context ("Hmm, laisse-moi réfléchir…", "Ho ho ! Oh, ça c'est une bonne question !"), from
   the guided-call voice lines already cached; (b) optional speculative start: send the text to the
   LLM when Smart Turn is at, say, 0.5, hold the reply until the turn is confirmed, discard if the
   child continues (Pipecat SpeculationGate); costs at most one wasted LLM call per false start.
4. **LLM prompt upgrades** (text, zero cost): a "transcription errors" section (guess the
   similar-sounding word, don't make a small child repeat), "variety" (don't repeat the same opener),
   persona as structured brief (role, tone, pacing words), ZVD vocabulary. All replies still pass
   ChildShield sentence by sentence.
5. **Santa's voice — two options.**
   - **(A) Keep Gemini TTS** (only Santa's text is sent, which respects the child-data rule) but
     upgrade from `gemini-2.5-flash-preview-tts` to the 3.x line for inline sound tags and per-turn
     style. **Gotcha:** Gemini 3.8 TTS returns **WAV with a header by default**, so
     `pcmToWav()` in `src/lib/tts-gemini.ts` would wrap a header twice
     ([model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts)). Running cost
     stays (not zero).
   - **(B) Zero running cost: voice Santa on the device.** Kokoro-82M via kokoro-js in a worker
     (Apache-2.0, already licensed in the repo) with a Santa voice derived the way Ziggy's was
     (style mix + pitch down + larger formants), ZVD deliveries mapped to speed/style per sentence,
     and the **sound bank** for "Ho ho ho", chuckles and breaths (recorded once or rendered offline,
     so they sound richer than live synthesis). Upgrade path: Kyutai Pocket TTS (French, CPU
     real-time, ~200 ms first chunk) **only if the owner accepts CC-BY-4.0 weights**, and with a
     Santa voice whose donor licence is checked in `kyutai/tts-voices` (the model's prohibited-use
     list forbids cloning without consent). Measure on a mid-range Android WebView before deciding.
6. **Latency budget to measure** (estimates to validate, not measurements): end-of-turn decision
   0.3–0.8 s after the child stops; on-device ASR finalisation 0.2–0.8 s (Whisper base/small after
   VAD); LLM first sentence 0.5–1.5 s; ChildShield per sentence; TTS first audio 0.3–1.5 s. The
   pre-cached acknowledgement covers the first ~1.5 s, which is what makes the leaders feel instant.
7. **Not now:** full-duplex (GPT-Live style) Santa. Revisit when an Apache/MIT/BSD full-duplex model
   ≤ 1 B with French runs on-device; watch MiniCPM-o, Kyutai and Moonshine's on-device work.

### 7.3 ASR choice

| Tier | Where | Model | Why | Licence |
|---|---|---|---|---|
| 1 (keep) | Chrome 139+ desktop/Android | on-device Web Speech (`processLocally = true`, never the cloud mode) | free, fast, French pack | browser |
| 2 (upgrade) | Safari/iOS, Firefox, the Tauri app | **Whisper base int8** (≈ 74 M params) by default, **Whisper small int8** (≈ 244 M) on capable devices (same sherpa-onnx WASM pipeline, same worker) | tiny is weak in French; base/small keep the MIT licence and the proven runtime; download size grows (roughly params × 1 byte at int8), so offer it after parent consent as today | **MIT** |
| 3 (owner decision) | capable devices / native app | **Parakeet-TDT-0.6B-v3** int8 | best French accuracy among small open models; fast TDT decoding; but **CC-BY-4.0** and ~0.6 GB int8, too heavy for most phones' browsers | CC-BY-4.0 |
| — | desktop only, later | Voxtral Mini 4B Realtime (WebGPU) | true streaming, Apache-2.0, French; 4 B params | **Apache-2.0** |
| — | rejected | Moonshine (no French), distil-whisper (EN only), Nemotron streaming / Parakeet EOU (licence "other") | | |

Evaluation before switching: build a small French/English test set from **adult** and
**child-like** (pitch-shifted) speech plus the `public/dodo` audio, and measure WER and time to
transcript per tier on a mid-range Android WebView and an iPhone. Real children's recordings need
explicit parental consent, a DPIA and on-device-only processing; do not collect them by default.

### 7.4 Safety and transparency notes specific to this frontier

- **No acoustic emotion reading of children.** Pipecat-style "perception" (tone/sarcasm from the
  user's audio), Hume-style prosody analysis, or any voice biomarker must not run on children's
  voices: it is profiling of minors, and the EU AI Act bans emotion recognition in workplaces and
  education institutions (Art. 5(1)(f)); Ziggy is not an institution, but the same reasoning applies. Santa's existing text rule ("if the child is sad or unsafe → tell a grown-up")
  is enough.
- **Disclosure.** Art. 50(1) (chatbots must disclose they are AI) applies from 2 Aug 2026; Art. 50(2)
  machine-readable marking of synthetic audio applies to systems placed on the market from 2 Aug
  2026 (2 Dec 2026 for systems already on the market) per law-firm summaries of the Digital Omnibus
  ([Usercentrics](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/),
  [CSA note](https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-article-50-transparency-20260729/)).
  OpenAI already watermarks GPT-Live audio. Suggest: Santa's live call opens with a short spoken
  line ("Je suis la voix magique du Père Noël, créée par Ziggy pour cet appel") in addition to the
  parent screen, and the owner asks counsel how to mark the generated audio.
- **Vendor risk.** Hume's API shutdown (13 Nov 2026) shows why a paid voice API should never be the
  only path: ZVD + an on-device back-end keeps Ziggy independent.
- **Licences to avoid, summarised:** LiveKit turn detector (framework-only), TEN VAD/framework
  (non-compete), Fish S2 Pro and PersonaPlex ("other"), GLM-4-Voice (custom), Qwen2.5-Omni ("other").
  **CC-BY-4.0** items (Kyutai STT/TTS/Pocket TTS/Moshi weights, Parakeet, Canary) need the owner's
  explicit OK before any use, like the ISC/OFL decisions recorded in CLAUDE.md.

### 7.5 Suggested next steps (in order, each small)

1. `src/lib/voice/zvd.ts`: ZVD parser/validator + character cards (FR/EN tests), wired into
   `santaReplyStream` between `cleanReply` and ChildShield.
2. Smart Turn v3.2 in `public/santa/asr/stt-worker.js` behind a flag; tune on child-like audio.
3. Pre-cached "thinking" clips + sound bank for Santa (rendered offline with the voice engine).
4. Whisper base/small option in the sherpa-onnx fallback; WER/latency comparison.
5. ZVD → Rust voice-engine adapter (deliveries → contour presets, sounds → sound bank), so bedtime
   stories and game lines can be *directed* in the same language.
6. Decide (owner): Gemini 3.x TTS upgrade vs on-device Kokoro Santa; CC-BY-4.0 policy.

---

## 8. Sources

Commercial
- ElevenLabs: https://elevenlabs.io/blog/eleven-v4 · https://unite.ai/elevenlabs-launches-eleven-v4-with-low-latency-turbo-variant · https://elevenlabs.io/fr/blog/elevenlabs-audio-tags-list · https://elevenlabs.io/blog/v3-audiotags · https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-alpha · https://elevenlabs.io/docs/best-practices/prompting · https://runware.ai/docs/models/elevenlabs-v3/guides/directing-with-audio-tags.md · https://elevenlabs.io/docs/agents-platform/customization/voice/expressive-mode · https://elevenlabs.io/blog/introducing-expressive-mode
- OpenAI: https://openai.com/index/introducing-gpt-realtime · https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/ · https://thenextweb.com/news/openai-gpt-realtime-2-voice-models · https://tokencost.app/blog/openai-gpt-realtime-2-voice-pricing · https://openai.com/index/introducing-gpt-live · https://siliconangle.com/2026/07/08/openai-launches-gpt-live-voice-model-series-ahead-broad-gpt-5-6-release/ · https://buildfastwithai.com/blogs/gpt-live-review-openai-voice-model-july-2026 · https://developers.openai.com/blog/updates-audio-models · https://developers.openai.com/cookbook/examples/realtime_prompting_guide · https://developers.openai.com/api/docs/guides/realtime-models-prompting · https://docs.kore.ai/agent-platform/v1/prompts/gpt-realtime-1_5-quick-ref.md · https://simonwillison.net/2025/Mar/20/new-openai-audio-models/ · https://community.openai.com/t/tts-no-longer-follows-instructions-parameter/1371743
- Google: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts · https://blog.google/intl/ja-jp/company-news/technology/gemini-3-8-text-to-speech/ · https://ai.google.dev/gemini-api/docs/speech-generation · https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts · https://livekit.com/blog/gemini-3.1-flash-tts-prompting-guide · https://dev.to/googleai/how-to-prompt-gemini-31s-new-text-to-speech-model-24bb · https://josephcrawford.com/posts/gemini-3-1-flash-tts-practical-guide/
- Cartesia: https://docs.cartesia.ai/build-with-cartesia/sonic-3/volume-speed-emotion · https://docs.cartesia.ai/build-with-cartesia/sonic-3/ssml-tags
- Hume: https://hume.ai/blog/octave-2-launch · https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions · https://fish.audio/hume-tts-alternative · https://www.voiceaispace.com/news/voice-ai-news-2026-10-04-w40 · https://releasebot.io/updates/hume/hume
- Microsoft: https://labs.ai.azure.com/innovations/mai-voice-1/ · https://pasqualepillitteri.it/en/news/9446/mai-realtime-microsoft-full-duplex-voice · https://github.com/microsoft/VibeVoice · https://huggingface.co/microsoft/VibeVoice-Realtime-0.5B
- Amazon: https://aws.amazon.com/blogs/aws/introducing-amazon-nova-2-sonic-next-generation-speech-to-speech-model-for-conversational-ai · https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-language-support.html
- Sesame: https://sesame.com/research · https://huggingface.co/sesame/csm-1b · https://www.sesame.com/blog/turnbench · https://huggingface.co/papers/2608.25218 · https://alphasignal.ai/news/sesame-s-turnbench-exposes-how-gemini-live-and-openai-realtime-fumble
- MiniMax: https://fal.ai/models/fal-ai/minimax/speech-2.8-hd/llms.txt · https://minimax-ai.chat/models/minimax-speech-2-8/
- ByteDance: https://seed.bytedance.com/en/realtime_voice · https://seed.bytedance.com/blog/introducing-seed-full-duplex-speech-llm-attentive-listening-robust-interference-suppression-enabling-more-natural-interaction · https://en.kocpc.com.tw/archives/24145 · https://arxiv.org/abs/2406.02430 · https://invideo.io/blog/seed-tts-ai-voice/
- Fish Audio: https://huggingface.co/fishaudio/s2-pro

Open models (Hugging Face model cards, read via the Hub API on 2026-11-14)
- https://huggingface.co/kyutai/moshiko-pytorch-bf16 · https://huggingface.co/kyutai/stt-1b-en_fr · https://huggingface.co/kyutai/tts-1.6b-en_fr · https://huggingface.co/kyutai/pocket-tts · https://huggingface.co/kyutai/hibiki-zero-3b-pytorch-bf16 · https://huggingface.co/nvidia/personaplex-7b-v1 · https://huggingface.co/nvidia/NVIDIA-NemotronLabs-VoiceChat-11B · https://arxiv.org/abs/2609.21967 · https://huggingface.co/Qwen/Qwen3-Omni-30B-A3B-Instruct · https://huggingface.co/Qwen/Qwen2.5-Omni-3B · https://huggingface.co/openbmb/MiniCPM-o-4_5 · https://huggingface.co/stepfun-ai/Step-Audio-2-mini · https://arxiv.org/abs/2507.16632 · https://huggingface.co/moonshotai/Kimi-Audio-7B-Instruct · https://huggingface.co/FunAudioLLM/Fun-Audio-Chat-8B · https://huggingface.co/ICTNLP/LLaMA-Omni2-7B · https://arxiv.org/abs/2505.02625 · https://huggingface.co/VITA-MLLM/Freeze-Omni · https://huggingface.co/VITA-MLLM/VITA-Audio-Plus-Vanilla · https://arxiv.org/abs/2505.03739 · https://huggingface.co/zai-org/glm-4-voice-9b · https://casrai.org/news/openmoss-moss-live-full-duplex-interaction-system-2026 · https://github.com/Ruiqi-Yan/Awesome-Full-Duplex-SDM · https://www.marktechpost.com/2026/02/13/kyutai-releases-hibiki-zero-a3b-parameter-simultaneous-speech-to-speech-translation-model-using-grpo-reinforcement-learning-without-any-word-level-aligned-data/ · https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice

ASR, VAD, turn-taking
- https://developer.mozilla.org/docs/Web/API/SpeechRecognition/processLocally · https://developer.mozilla.org/docs/Web/API/SpeechRecognition/install_static · https://groups.google.com/a/chromium.org/g/blink-dev/c/VNOok2dbmHM
- https://github.com/openai/whisper · https://huggingface.co/openai/whisper-large-v3-turbo · https://huggingface.co/distil-whisper/distil-large-v3.5 · https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3 · https://huggingface.co/CoderViking/parakeet-tdt-0.6b-v3-onnx · https://huggingface.co/striimit/parakeet-tdt-0.6b-v3-webgpu · https://huggingface.co/nvidia/canary-1b-v2 · https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b · https://huggingface.co/moonshine-ai · https://arxiv.org/abs/2602.12241 · https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602 · https://mistral.ai/news/voxtral-transcribe-2 · https://arxiv.org/abs/2602.11298 · https://huggingface.co/spaces/mistralai/Voxtral-Mini-4B-Realtime-WebGPU · https://kyutai.org/next/stt · https://huggingface.co/spaces/efficient-nlp/wasm-streaming-speech
- Child speech: https://arxiv.org/pdf/2605.29257 · https://tiantiaf0627.github.io/childvox/ · https://www.medrxiv.org/content/10.1101/2025.10.13.25337901.full.pdf · https://www.themoonlight.io/review/benchmarking-childrens-asr-with-supervised-and-self-supervised-speech-foundation-models · https://arxiv.org/pdf/2605.28833 · https://aclanthology.org/2026.iwsds-1.34.pdf · https://www.uniphore.com/blog/part-2-knowing-when-to-speak/
- VAD/turn: https://huggingface.co/onnx-community/silero-vad · https://github.com/TEN-framework/ten-vad · https://github.com/pipecat-ai/smart-turn · https://huggingface.co/pipecat-ai/smart-turn-v3 · https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/ · https://huggingface.co/livekit/turn-detector · https://huggingface.co/livekit/turn-detector/blob/main/LICENSE · https://huggingface.co/TEN-framework/TEN_Turn_Detection · https://huggingface.co/nvidia/parakeet_realtime_eou_120m-v1

Frameworks (code read from shallow clones on 2026-11-14)
- Pipecat 1.16.0: https://github.com/pipecat-ai/pipecat (files `CHANGELOG.md`, `src/pipecat/expressive/*.py`, `src/pipecat/adapters/tts/services/*.py`, `src/pipecat/turns/*.py`) · https://huggingface.co/pipecat-ai/tone-models
- LiveKit: https://pypi.org/project/livekit-plugins-turn-detector/1.4.6/
- TEN: https://raw.githubusercontent.com/TEN-framework/ten-framework/main/LICENSE
- Kyutai Unmute: https://github.com/kyutai-labs/unmute (files `unmute/unmute_handler.py`, `unmute/llm/system_prompt.py`) · https://arxiv.org/abs/2509.08753
- Kyutai Pocket TTS: https://github.com/kyutai-labs/pocket-tts · https://kyutai.org/blog/2026-01-13-pocket-tts

Regulation
- https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/ · https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-article-50-transparency-20260729/

Ziggy files referenced: `src/lib/santa/santa-ai.ts`, `src/app/api/santa/chat/route.ts`,
`src/lib/santa/transcribe.ts`, `src/lib/santa/listen.ts`, `public/santa/asr/stt-worker.js`,
`src/lib/tts-gemini.ts`, `docs/PERE_NOEL.md`, `docs/DODO_VOICE.md`, `voice-engine/README.md`.
