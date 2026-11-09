# R&D report — game technologies for Lutin Chaos and Lutin Factory (2026-11-09)

Five research cells worked in parallel (GitHub & skills, NVIDIA, Hugging Face, Chinese ecosystem, game
design & architecture). Every technology was scored /100 with one shared grid
(`research/technology-registry/FORMAT.md`) and merged into `docs/TECHNOLOGY_REGISTRY.md`
(`node scripts/tech-registry.mjs`): **249 technologies — 5 adopt, 86 test, 158 reject.** Licences were read
from LICENSE files and model cards on 2026-11-09; what could not be read (huggingface.co, modelscope.cn
and some NVIDIA pages were blocked from this sandbox) is marked *unverified* in the cell registries.

Owner decisions (2026-11-09): both games approved as designed (`docs/GAME_DESIGN_LUTINS.md`), routes under
`/lutins/jeux`, December 2026 release with Christmas content, seasonal packs in 2027.

## 1. Best repositories found
- **three.js r187** (MIT, 95) — stays our engine; `AnimationMixer` with code-built clips (91), `BatchedMesh`
  / `InstancedMesh`, WebGPU renderer as a later spike. `research/github/REPORT.md`.
- **ink / inkjs** (MIT, 90/88) — authored branching dialogue, compiled offline.
- **three-mesh-bvh** (MIT, 89), **troika-three-text** (MIT, 85, Arabic-ready 3D text), **three.quarks**
  (MIT, 77, particles), **nipplejs** / **@use-gesture** (MIT) — to test.
- **Phaser 4.2** (MIT, 87) — one 2D prototype only, not a migration. **Rapier** (Apache-2.0, 87) — only for a
  game needing rigid bodies.
- **Tencent Game-Creation-Agents** (Apache-2.0) — rejected as a tool (paid per-use APIs, one China-region),
  but its *process* was adopted in our skills (mechanics contract, play checks, blind critic, failure
  catalogue).

## 2. Skills installed / written
- 24 official **Phaser 4 skills** (MIT, commit 02d8931) vendored with LICENSE + SOURCE.md:
  `.claude/skills/game-development/vendor/phaser-*`. 4 rejected as redundant.
- 9 Ziggy skills written: `game-development` (entry) and `ziggy-game-architect`, `ziggy-game-design`,
  `ziggy-level-design`, `ziggy-character-animation`, `ziggy-ai-characters`, `ziggy-game-testing`,
  `ziggy-performance`, `ziggy-phaser-expert` in `.claude/skills/game-development/`.
- Rejected: Tencent's pipeline skill/agents (need its MCP server and paid APIs), Anthropic webapp-testing
  (duplicates `/smoke`), skill-creator (already available). Details: `research/skills/REPORT.md`.

## 3. Hugging Face models retained (offline bake or in-browser; `research/huggingface/REPORT.md`)
Images: FLUX.2 [klein] 4B (Apache), Z-Image-Turbo (Apache), Qwen-Image-Edit (Apache) for identical elves
from one felt reference. Video: Wan2.2 TI2V-5B / I2V-A14B (Apache). Voices: Kokoro (kept) + Qwen3-TTS
VoiceDesign (Apache) for invented elf voices. STT: Chrome on-device (kept), sherpa-onnx keyword spotting
(Apache). Sound: MOSS-SoundEffect (Apache); music: ACE-Step 1.5 (MIT). Tools: BiRefNet (MIT) background
removal, Real-ESRGAN (BSD-3) upscaling, RF-DETR (Apache) on-device surface detection.

## 4. NVIDIA technologies retained (`research/nvidia/REPORT.md`)
**Audio2Face-3D** only as an offline bake (SDK MIT, models under the NVIDIA Open Model License: commercial
use allowed, NVIDIA claims no ownership of outputs) — to test on Santa's 118 fixed lines
(`research/nvidia/offline-bake.md`). Rejected: Audio2Emotion (gated licence; emotion recognition on
children is a red line), ACE / Riva / Maxine NIMs (paid AI Enterprise or GPU servers, child voice to a
third party), Omniverse (terms unverified, workstation dependency). Parakeet-TDT (CC-BY-4.0 weights) to
consider for on-device STT, with the owner's OK.

## 5. Chinese technologies retained (`research/china/REPORT.md`)
Qwen3-TTS and VoxCPM2 (Apache; all 12 locales) for designed elf voices, Step-Audio-EditX for giggles,
TripoSG / Step1X-3D for props (with our own matting), UniRig / Puppeteer auto-rigging, HoloPart for
openable furniture parts, Wan2.2 for offline story clips, Qwen-Image via DiffSynth-Studio, small Qwen3 /
GLM-4.5-Air / MiniCPM4 for offline level drafting checked by our solver. Ideas from Game-Creation-Agents.
**All Tencent Hunyuan models rejected: their licences exclude the EU, UK and South Korea, including use of
outputs.**

## 6. Components actually integrated (in the repo now)
- `src/lib/face/` — `FaceAnimator` interface, `WebFallbackAnimator` (live from audio, free, no sad
  emotion), `PrecomputedTrackAnimator`, `ziggy-face-track` v1 format + validator, per-character mappings
  (NVIDIA cell; tested).
- `src/lib/assets/` + `src/data/assets/manifest.json` — Asset Manager (registry, validator: unique ids,
  allowed licences, files present, no remote paths, no cycles) with 43 existing assets (design cell; tested).
- `scripts/tech-registry.mjs` (merged registry) and `scripts/licence-audit.mjs` (shipped npm licences;
  fails on forbidden/unknown) — `docs/LICENCE_AUDIT.md`.
- **Engine fix:** the deprecated `THREE.Clock` (13 games) replaced by `FrameClock` in the kit, and the
  removed `PCFSoftShadowMap` (5 files) by `PCFShadowMap` — same rendering, no more console warnings, ready
  for three r187.
- The two games are designed and architected but **not coded yet** (next phase).

## 7. Rejected components and why (main ones)
Hunyuan family (EU-excluded), FLUX dev / FLUX.2 dev / klein 9B and their derivatives (non-commercial),
MusicGen / AudioGen / MMAudio / AudioLDM2 (NC), Spark-TTS / ChatTTS (NC; ChatTTS AGPL), Seed-VC (GPL),
FireRedTTS v1 (MPL), bitECS (MPL), Cocos (editor EULA + LGPL natives), Spine (paid seats), GSAP
(proprietary), RMBG-1.4/2.0 and InsightFace (NC), SMPL/AMASS motion models (NC data), OmniHuman / Kling /
Wan 2.5+ (no weights, API only), Godot / Babylon (second engine without benefit). Full list:
`docs/TECHNOLOGY_REGISTRY.md` (decision "reject" with justification).

## 8. Licences and restrictions
`docs/LICENCE_AUDIT.md`: 116 shipped npm packages, 99 under the default allowed licences, 0 forbidden.
To decide (pre-existing): `lucide-react` and `picocolors` (ISC), Fredoka font (OFL-1.1), `sharp`'s libvips
(LGPL-3.0, server-only on Vercel). Rust crates all permissive (+ Unicode-3.0, owner OK). Shipped models:
MediaPipe (Apache-2.0) only.

## 9. Development savings
- Architecture reuses the kit, the three code-built elf rigs, Ziggy and Santa (the same models that render
  the `/lutins` reference sheets): no art pipeline to build, no engine migration.
- No physics engine, no ECS dependency, no animation editor licence (scripted slapstick, own components,
  code-built clips).
- 24 accurate Phaser 4 references instead of model memory (Phaser 3-era) if the 2D prototype goes ahead.
- Licence traps caught before any code: 30+ models/repos that would have been unusable in France or for a
  commercial product.
- Reusable test patterns (state injection, oracles, blind critic) written once in `ziggy-game-testing`.

## 10. Improvements for the two games
- Faces that talk and react on every device (`FaceAnimator`), with an optional offline Audio2Face upgrade.
- Elf voices designed from text in all 12 locales (offline bake, never cloned), giggles bank.
- Openable furniture and props pipeline (TripoSG / Step1X-3D → HoloPart → UniRig, offline) for Chaos
  pranks; offline-drafted Factory levels proved by our solver.
- Accessibility by design: invisible DOM buttons over 3D objects (TV remote, screen readers, switch access).
- Budgets and tests defined up front (≤ 120 draw calls, ≤ 150k triangles, deterministic replays).

## Next steps (proposed)
1. Owner decisions in `docs/LICENCE_AUDIT.md` (ISC, OFL, sharp) and the open design questions 3 and 5 in
   `docs/GAME_DESIGN_LUTINS.md` (planner prank id on device; share codes).
2. Build the shared engine (`src/games3d/engine/`) and Lutin Factory's simulator + first hall, then Lutin
   Chaos's first rooms — test-first, with the skills above.
3. Optional one-day GPU bake (owner approval): elf voices (Qwen3-TTS / VoxCPM2), 10 props, Audio2Face on
   Santa's lines.
