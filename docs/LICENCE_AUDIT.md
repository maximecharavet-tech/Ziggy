# Licence audit (2026-11-09)

Rules (CLAUDE.md): shipped code MIT / Apache-2.0 / BSD only; ISC needs the owner's OK; Unicode-3.0
accepted (2026-11-08, `unicode-ident`); never GPL / AGPL / LGPL / MPL / NC in what ships. Code licence and
model-weights licence are checked separately. Re-run the checks below before any new dependency.

## 1. npm packages that ship (production tree)
`node scripts/licence-audit.mjs` reads every non-dev package of `package-lock.json` and its
`package.json` licence. It exits 1 on a forbidden or unknown licence. Result today:

| Package | Version | Licence | Status |
|---|---|---|---|
| @fontsource-variable/fredoka | 5.3.0 | OFL-1.1 | review (standard open font licence (Fredoka); owner OK required) |
| @img/sharp-libvips-darwin-arm64 | 1.2.4 | LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-libvips-darwin-x64 | 1.2.4 | LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-libvips-linux-arm | 1.2.4 | LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-libvips-linux-arm64 | 1.2.4 | LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-libvips-linux-ppc64 | 1.2.4 | LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-libvips-linux-riscv64 | 1.2.4 | LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-libvips-linux-s390x | 1.2.4 | LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-libvips-linux-x64 | 1.2.4 | LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-libvips-linuxmusl-arm64 | 1.2.4 | LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-libvips-linuxmusl-x64 | 1.2.4 | LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-wasm32 | 0.34.5 | Apache-2.0 AND LGPL-3.0-or-later AND MIT | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-win32-arm64 | 0.34.5 | Apache-2.0 AND LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-win32-ia32 | 0.34.5 | Apache-2.0 AND LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| @img/sharp-win32-x64 | 0.34.5 | Apache-2.0 AND LGPL-3.0-or-later | server-only (next/image on Vercel, not shipped to browsers; owner decision) (optional) |
| lucide-react | 0.503.0 | ISC | review (permissive; owner OK required per CLAUDE.md (listed for review)) |
| picocolors | 1.1.1 | ISC | review (permissive; owner OK required per CLAUDE.md (listed for review)) |

116 production packages; 99 under the default allowed licences, 17 to review, 0 forbidden/unknown.

Decisions needed from the owner (all pre-existing, not introduced by the R&D work):
1. **`lucide-react` (ISC)** — the site's icons, used since the start — and **`picocolors` (ISC)**, a tiny
   dependency of Next/PostCSS. ISC is functionally equivalent to MIT; CLAUDE.md asks for the owner's OK.
2. **`@fontsource-variable/fredoka` (OFL-1.1)** — the site's rounded font. OFL is the standard open font
   licence (free commercial use, the font itself can't be sold alone).
3. **`@img/sharp-*` (libvips, LGPL-3.0)** — optional native binaries of `sharp`, used by Next.js's image
   optimiser on the Vercel server only. They are never sent to visitors' browsers (not "shipped code" in
   the distribution sense), and LGPL allows dynamic linking. Options: accept as server-only, or disable
   Next image optimisation (`images.unoptimized`) to drop them.

## 2. Rust crates compiled into the site's WebAssembly
`rust/lutins-core` (Lutins engine) and `src/lib/tv/wasm`: every crate MIT / Apache-2.0 / BSD, plus
`unicode-ident` data tables under Unicode-3.0 (owner OK). Checked with `cargo tree`; listed in
`THIRD_PARTY_LICENSES.md`. No GPL / LGPL / MPL crate in the tree.

## 3. Models and binary assets that ship
`src/data/assets/manifest.json` + `npx vitest run src/lib/assets` (validator: allowed licences only,
files present, no remote paths, no dependency cycles). Shipped models:
- MediaPipe selfie segmenter and multiclass segmenter (Apache-2.0) — Santa photo booth, on device.
- MediaPipe EfficientDet-Lite0 int8 (Apache-2.0) — person check before a Lutins photo is sent, on device.
- `@mediapipe/tasks-vision` wasm runtime (Apache-2.0), copied at install.
- Everything else (3D characters, sheets, sounds, music) is code-built by us.

## 4. Third-party services (not shipped code, data-processing terms)
Agnes AI (images / video for Lutins, owner's account), Google Gemini TTS (voices), Anthropic and NVIDIA
NIM (Père Noël live call, text only), Stripe (payments). Pending from the owner: Agnes's processing
location and data-processing agreement; a paid Gemini plan (the free tier can't serve EU users).

## 5. Licence traps found by the R&D cells (do not use)
Details and sources in `research/*/REPORT.md` and `docs/TECHNOLOGY_REGISTRY.md`.
- **Region-excluded:** all Tencent Hunyuan models (3D, Video, World, GameCraft, Motion, Image, LLMs):
  licences exclude the EU / UK / South Korea, including use of their outputs. FramePack (Hunyuan-based).
- **Non-commercial weights:** FLUX.1-dev / FLUX.2 dev / FLUX.2 klein 9B (and everything built on them:
  UNO, DreamO, InfiniteYou, InstantCharacter), MusicGen / AudioGen, MMAudio, TangoFlux, AudioLDM2,
  Spark-TTS, ChatTTS, UniAnimate, ThinkSound, RMBG-1.4 / RMBG-2.0, InsightFace models (inside
  LivePortrait / LatentSync), SMPL / AMASS-based text-to-motion models, Qwen2.5-Omni-3B (research only).
- **Copyleft code:** ChatTTS (AGPL), Seed-VC (GPL), FireRedTTS v1 (MPL), bitECS (now MPL-2.0),
  Cocos native libraries (LGPL) + Cocos Creator editor EULA (no forks).
- **Paid or conditional:** Spine (editor seat per user), Rive editor (export on paid plans), GSAP
  (proprietary), Fish Speech (< USD 500k revenue), IndexTTS2 (thresholds, PRC law), Stable Audio Open
  (registration), CogVideoX-5B and LTX (conditional), NVIDIA ACE / Riva NIMs (AI Enterprise), Audio2Emotion
  (gated, Audio2Face-only).
- **Approval needed before use:** Parakeet / Whisper-turbo checks with CC-BY-4.0 weights (attribution),
  postprocessing (Zlib), koota (ISC), Tone.js `tslib` (0BSD).
