# Chinese open source for LUTIN CHAOS and LUTIN FACTORY (research cell "china", 2026-11-09)

This report adds to `docs/lutins-research.md`, which covered image and video consistency for the
`/lutins` photo pipeline: StoryDiffusion, PhotoMaker, the OmniGen2 prompting patterns, Wan prompt
rules and the Rust crates. That material is not repeated here. This round looks at what Chinese
labs publish for **3D game production**: characters, props, rigging, animation, voices, sound,
scene and level generation, and agent pipelines that build games. It covers both planned games:

- **LUTIN CHAOS**: an action game in a 3D house (three.js). The elves pull pranks, and the child
  and Ziggy catch them and fix things, laughing.
- **LUTIN FACTORY**: a building and logic game in the elves' toy workshop.

The scores are in `research/china/registry.md`, using the shared format in
`research/technology-registry/FORMAT.md`.

## How this was checked (and what was not)
- **Code licences**: for about 90 repositories I read the `LICENSE*` file myself from
  `raw.githubusercontent.com/<repo>/HEAD/…` on 2026-11-09, along with the licence section of each
  README.
- **Weight licences**: **huggingface.co was blocked from this session.** curl and WebFetch both
  failed, and the Hugging Face MCP tool needed an approval that was not given. Weight licences
  therefore come from (a) the GitHub README or LICENSE file when it covers the weights, which I
  verified, or (b) web-search snippets of model cards, which are marked *unverified* in the
  registry. Before anyone downloads weights, the model card must be re-read on Hugging Face.
- I did not try modelscope.cn. I ran no models: this is a desk review.
- Where a repo has no LICENSE file, I say so. Without a licence, all rights are reserved.

## The big licence and region traps (read first)
1. **Every Tencent Hunyuan model is excluded in France.** I read each of these licences: Hunyuan3D-2,
   3D-2.1, 3D-Omni, 3D-Part, HunyuanVideo, Video-I2V, Video-1.5, Video-Avatar, Video-Foley,
   HunyuanCustom, HunyuanWorld-1.0, World-Voyager, World-Mirror, Hunyuan-GameCraft-1.0, HY-Motion-1.0,
   HunyuanImage-2.1 and 3.0, and Hunyuan-A13B and 1.8B. Each one opens with *"THIS LICENSE AGREEMENT
   DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA"*. The Hunyuan3D-2.1 licence
   also says, in §5(c), *"You must not use … the Works, **Output** or results … outside the
   Territory"*. So **baking assets on a GPU box in the US and shipping them to France is still
   unlicensed.** Other terms: a 1M MAU threshold, and an acceptable-use clause on minors. Decision:
   reject them all. We may only read the papers for ideas.
2. **Two Tencent licences are non-commercial and not EU-limited.** InstantCharacter says *"only for
   academic, research and education purposes"*, and it also runs on FLUX.1-dev, whose weights are
   non-commercial. HunyuanPortrait has the same clause. Reject both.
3. **Tencent licences that are clean: Game-Creation-Agents (Apache-2.0, released 2026-10-14) and
   MimicMotion (Apache-2.0).** MimicMotion's weights build on SVD, so check their licence before use.
4. **The weights are often less free than the code.**
   - Spark-TTS: the code is Apache, but the weights are **CC BY-NC-SA 4.0** (the card changed from
     Apache "because of training-data terms"; unverified snippet).
   - ChatTTS: the code is **AGPL-3.0**, and the README says the weights are **CC BY-NC 4.0**.
   - CogVideoX-5B: the code is Apache, but the weights are under the *CogVideoX License*. Only the
     2B model is Apache.
   - SpatialGen: MIT code, but the weights come from SD2.1 (OpenRAIL++-M), and its wireframe LoRA
     uses the **FLUX.1-dev non-commercial** licence.
   - SpatialLM: the weights use the **Llama 3.2** community licence.
   - ThinkSound: the README says "Apache 2.0", then *"Commercial use is NOT permitted"*, and it
     includes a Stable Audio VAE.
   - UniAnimate and UniAnimate-DiT: no LICENSE file, and the README says "RESEARCH/NON-COMMERCIAL
     USE ONLY".
5. **Hidden non-commercial components inside clean repos.**
   - **LivePortrait**: the code and weights are MIT, but its default face detector, **InsightFace
     buffalo_l, is non-commercial**. Swap it for MediaPipe. Its Animals mode needs X-Pose (licence
     not checked).
   - **TripoSG** uses **briaai RMBG-1.4** to remove backgrounds. The BRIA licence is
     non-commercial, so use our own matting or a permissive one.
   - **LatentSync** aligns faces with InsightFace.
6. **Copyleft code.** FireRedTTS (v1) is **MPL-2.0**, Seed-VC is **GPL-3.0**, and ChatTTS is
   **AGPL-3.0**. None of them may ship. Running them offline as tools is legally possible, but the
   weight licences block them anyway (or are unverified).
7. **Commercial terms with thresholds.** These can be used, but they come with conditions:
   - **IndexTTS2** (bilibili Model Use Licence): free commercial use below **100M MAU or RMB 1bn
     revenue**. It is governed by **PRC law**, requires a disclaimer on derivatives, and bans
     using it to improve other models.
   - **Fish Speech** (Fish Audio Community Licence v1.0, 2026-10-13): commercial use only below
     **USD 500k annual revenue**, a hosted service needs a separate licence, and a NOTICE file is
     required.
   - **Kimi-K2** (Modified MIT): products with more than 100M MAU or $20M a month must display
     "Kimi K2".
   - **DeepSeek Model Licence** (Janus-Pro): use-based restrictions, including one against harming
     minors. These are compatible with our rules.
8. **No open weights (API only).** This applies to OmniHuman (1 and 2.0 via BytePlus), Kling, and
   Wan 2.5, 2.6 and 3.0. Several blogs claim Wan 3.0 weights exist; careful sources say the open
   Wan line stops at 2.2. MiniMax **H3 (Hailuo 3)** reportedly has open weights under a
   jurisdiction-restricted community licence. One source says the EU and US are blocked
   (unverified). Treat it as excluded until someone reads the licence.
9. **Training-data traps in animation.** Most text-to-motion models (MotionGPT, T2M-GPT, MotionLCM,
   HY-Motion) are trained on HumanML3D or AMASS and output SMPL bodies. **SMPL and AMASS are
   non-commercial**, so the code licence does not help. Our elves and Ziggy are plush characters
   with procedural animation in code, which is the safer path anyway.
10. **Paid APIs inside "open" agent repos.** Game-Creation-Agents needs an OpenAI key for images
    and a Volcengine ARK key for Seedance video and the Doubao VLM. We can take the architecture,
    but the providers must be swapped out (and no child data may ever be involved).

## What fits our rules
Our rules: no running cost, no GPU in production, nothing generated live in the child's loop, and
the house style is "PS2 look, built in code" (`docs/GAMES_3D.md`). The useful pattern is therefore
**one offline bake on a rented GPU box → static files under `public/` → served like our dodo
audio.** Every bake needs the owner's approval and a human review. Text goes through ChildShield.
No child's voice or image is ever involved. Voices are *designed from text descriptions*, never
cloned from a real person, unless a consenting adult actor signs a release.

## Top 10, each with a concrete use
| # | Tech (licence) | LUTIN CHAOS | LUTIN FACTORY | How, within our rules |
|---|---|---|---|---|
| 1 | **Qwen3-TTS** VoiceDesign / CustomVoice (Apache-2.0 code; weights Apache-2.0 per release notes, card unverified). Supports **FR, EN** + 8 other languages | Three distinct elf voices (Pépin, Grelotte, Noisette) designed from text ("small mischievous elf, high, giggly, friendly"). Reactions such as "Oups !", "Attrape-moi !", "On répare ?" | Workshop chatter, step-by-step hints read aloud (`SayButton`) | Bake a fixed line catalogue, FR+EN, to MP3 + `timing.json` like `public/dodo/voice`. Reuse the mastering and visemes from `voice-engine`. Bump `sw.js` VERSION. No cloning of real voices |
| 2 | **VoxCPM2** (Apache-2.0 code and weights, per README). **30 languages**, voice design, 48 kHz | Covers the locales Qwen3-TTS lacks, such as **ar** and **nl**, so all 12 locales get elf voices | Same | Second engine for the locale gaps. A/B against Qwen3-TTS on the same lines. ~2B parameters, so an offline bake is cheap |
| 3 | **Step-Audio-EditX** (Apache-2.0 code; weights unverified). Edits emotion and style, plus paralinguistic tags `giggle`, `chuckle`, `inhale`… | Turns a neutral line into a happy, surprised or giggling one. A **laugh bank** for when an elf is caught (always happy, never sad) | "Ta-da!" success flourishes | Post-processing pass on the baked lines. A human listens to every line, then the listen-proxy checks from `voice-engine/README.md` run (loudness, pitch) |
| 4 | **TripoSG** (MIT code; weights MIT per card, unverified) and **Step1X-3D** (Apache-2.0 code and weights, per README) | Props for the house: toys, a lamp, a sock basket, a cake. They get knocked over or swapped in pranks | Toy parts and finished toys (train, robot, teddy) | Image → mesh offline. **Swap RMBG-1.4** for our own matting. Then decimate (≤2–5k triangles), bake vertex colours, export glTF and restyle to the PS2 palette. Or use the mesh as a **reference** to rebuild in code (`src/games3d/kit`). Nothing runs in the browser except the GLB |
| 5 | **UniRig** (MIT) and **Puppeteer** / **MagicArticulate** (Apache-2.0; weights unverified, trained on Objaverse-XL) | Auto-rig generated elf meshes and floppy props (a scarf, a jack-in-the-box) | Rig articulated toys (arms of a robot toy, a train coupling) | Offline rigging to glTF skins. Animation stays **procedural in three.js** (springs, squash and stretch, transform only), avoiding the SMPL data trap. Puppeteer's video-guided animation can bake a few clips, which we review by hand |
| 6 | **HoloPart** (MIT) | Splits a generated cupboard or fridge into parts, so doors and drawers open in pranks (elf hiding in a drawer) | Splits a toy into assembly parts for building puzzles | Offline part completion → separate glTF nodes → hinge logic in code |
| 7 | **Wan2.2** TI2V-5B / I2V-A14B / **Animate-14B** (Apache-2.0 code and weights, per README). The 5B model runs on a 24 GB card | 5 s intro and "the elves escaped!" story loops. Reward clips ("everything fixed!"). Animate-14B moves a drawn elf with a reference motion for 2D flipbook sprites in menus | Menu loop of the workshop. Toy "comes alive" reward clip | Offline bake, human review, MP4/WebM in `public/`. Prompt rules are already in `docs/lutins-research.md` §2.3. Never generated live |
| 8 | **Qwen-Image / Qwen-Image-Edit** (Apache-2.0) through **DiffSynth-Studio** (Apache-2.0, low-VRAM runner + LoRA training) | Concept sheets, felt textures, decals (stripes, patches), elf turnaround sheets as input for item 4 | Toy blueprints, workshop posters, icons | Offline. DiffSynth also runs Wan, so one tool covers items 7 and 8. A small style LoRA trained on *our own* felt renders keeps the look consistent |
| 9 | **Tencent Game-Creation-Agents** (Apache-2.0, 2026-10-14) | Pipeline to borrow: a brief → design → parallel builders → **Playwright verification gates** → release, with evidence stored in `verify/` | Same: generate puzzle levels with a verify gate | **Ideas and an internal tool only.** Replace the paid OpenAI/Seedance/Doubao steps with offline models from this list. Port its gates to our `/smoke` and `/verify`. It targets Phaser 4, so we keep three.js. Never put it in a child's loop |
| 10 | **Qwen3** small models (Apache-2.0) or **GLM-4.5-Air** (MIT) or **MiniCPM4** (Apache-2.0) | Offline drafting of a **prank catalogue** (what an elf does, what the child fixes, the funny line) in FR+EN | Offline drafting of factory **puzzle levels** (conveyor and gear logic) | The LLM only drafts. Our own deterministic **solver checks each level** (solvable, single-solution, difficulty) and ChildShield plus a human check each text. The output is static JSON. This is the Hyper Engine pattern (`src/lib/hyper-engine/verify.ts`). No live LLM, no chat |

Runners-up worth a prototype:
- **CosyVoice 3** (Apache code; 9 languages including FR; instruct emotions).
- **FireRedTTS-2** (Apache; multi-speaker dialogue, including FR): two-elf banter scenes.
- **InternVL** (MIT): an offline visual judge that checks that baked renders and GLBs "look like a
  felt elf, no extra limbs" before a human looks.
- **MIDI-3D** (Apache): one image → a multi-object room layout, as a blockout for the house.
- **InspireMusic** (Apache code): workshop music loops. Today's music is code-built, so this is
  low priority.
- **LivePortrait** (MIT, with MediaPipe in place of InsightFace): small expression clips of the 2D
  `MascotCutout` Ziggy. It works on cartoon faces only partly; test it.

## Rejected and why (short)
- **Tencent Hunyuan family:** excluded in the EU/UK/KR, including use of outputs.
- **InstantCharacter, HunyuanPortrait:** non-commercial.
- **ByteDance UNO, DreamO, InfiniteYou:** they run on FLUX.1-dev weights (non-commercial).
- **OmniHuman, Kling, Wan 2.5 to 3.0:** no weights, API only (running cost, and child data would
  reach a third party).
- **MiniMax H3:** region-restricted licence (unverified).
- **Spark-TTS, ChatTTS:** non-commercial weights; ChatTTS code is also AGPL.
- **FireRedTTS v1:** MPL code.
- **Seed-VC:** GPL code, and voice conversion of real voices is not something we want.
- **GPT-SoVITS:** MIT code, but it needs a reference voice (cloning), has no French, and the weight
  licence is unverified.
- **MegaTTS3:** Apache, but the WaveVAE encoder is withheld "for security", so you cannot pick a
  new voice, and it only does zh/en.
- **IndexTTS2:** acceptable licence, but zh/en only and PRC law. Keep it as a fallback.
- **Fish Speech:** the USD 500k revenue cap is a future trap.
- **UniAnimate(-DiT):** no licence, non-commercial.
- **AnimateAnyone:** no weights.
- **MotionGPT, T2M-GPT, MotionLCM:** SMPL/AMASS data is non-commercial.
- **ThinkSound:** non-commercial. Sound effects stay code-built.
- **SpatialLM, SpatialGen:** Llama or FLUX non-commercial weights.
- **Kimi-K2, MiniMax-M2, Step-Video-T2V (30B):** far too big for what we need.
- **Janus-Pro:** 384 px images, too weak.
- **Cocos engine:** MIT now (LICENSE.md read), but switching engines away from three.js brings no
  benefit for us. The Cocos Creator editor's terms were not checked.
- **LAM, LHM:** human head and body avatars; no fit for plush characters.
- **FunASR, SenseVoice:** speech recognition is not needed in these games. A child's voice must
  never leave the device.

## Runtimes for later (native app only)
**MNN** (Alibaba, Apache-2.0) and **ncnn** (Tencent, BSD-3) are on-device inference engines. If one
day a small model must run *on the device* inside `apps/ziggy-app` (Tauri), these are the
permissive options. Today nothing in either game needs live inference.

## Suggested first prototypes (a one-day GPU rental, no running cost)
1. Bake 20 elf lines in FR+EN with Qwen3-TTS VoiceDesign and VoxCPM2. Add giggles with
   Step-Audio-EditX. Have the owner pick the voices by ear.
2. Generate 10 house props with TripoSG and Step1X-3D (with our own matting) → decimate → glTF.
   Compare them on screen with code-built props at 1280×800 and 390×844.
3. Auto-rig one elf mesh with UniRig and drive it procedurally in three.js. Check the frame rate on
   a ≤4-core device (`prefersLowPower()`).
4. Run Game-Creation-Agents' verification idea on a FACTORY puzzle generator: LLM draft → our
   solver → Playwright screenshot gate.

## Sources
- LICENSE files and READMEs at `github.com/<repo>` (raw.githubusercontent.com, read 2026-11-09).
  The repo list is in `registry.md`.
- Spark-TTS weight licence: [HKUSTAudio/Spark-TTS-0.5B card](https://huggingface.co/HKUSTAudio/Spark-TTS-0.5B/raw/main/README.md)
  (search snippet; HF blocked).
- LivePortrait / InsightFace: [ComfyUI-LivePortraitKJ](https://github.com/kijai/ComfyUI-LivePortraitKJ),
  [InsightFace licensing](https://www.insightface.ai/solutions/face-recognition-licensing).
- OmniHuman availability: [HF paper page](https://huggingface.co/papers/2502.01061),
  [llmreference OmniHuman 2.0](https://www.llmreference.com/model/omnihuman-2.0) (secondary).
- Wan open-weights status: [howaiworks: open Wan stopped at 2.2](https://howaiworks.ai/blog/alibaba-wan-open-weights-stopped-at-2-2),
  [nemovideo Wan 3.0](https://www.nemovideo.com/blog/ai-video-models/wan-3-0-open-source) (secondary).
- MiniMax H3: [mer.vin: H3 blocked US/EU/UK](https://mer.vin/news/minimax-h3-open-weight-video-model-blocked-us-eu-uk/),
  [segmind](https://blog.segmind.com/minimax-h3-release-date-open-weights-and-api-pricing-explained/) (secondary, unverified).
- Qwen3-TTS release: [Simon Willison 2026-01-22](https://simonwillison.net/2026/Jan/22/qwen3-tts),
  [arXiv 2601.15621](https://arxiv.org/pdf/2601.15621v1).
