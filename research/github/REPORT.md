# GitHub research cell — report (2026-11-09)

Scope: engines, animation, narration, audio, physics, AI game generation and lesser-known gems for Ziggy's
kids' web games (Next.js 15 / React 19 / three.js r186 kit in `src/games3d/kit`, 2D games as React +
framer-motion mechanics in `src/components/arcade`, one Rust/macroquad wasm platformer).
Scored rows: `research/github/registry.md` (format `research/technology-registry/FORMAT.md`).

Method and evidence
- LICENSE files fetched raw from each repository's default branch on 2026-11-09; npm `license` field cross-checked.
- Versions and release dates: npm registry (`dist-tags.latest` and `time`) and `git ls-remote --tags`;
  last-commit dates from shallow clones.
- Bundle sizes: measured from the npm tarballs with `gzip -9` (not brotli, not tree-shaken).
- The GitHub REST API and jsDelivr were blocked in this sandbox; github.com pages, git clones, raw files
  and registry.npmjs.org worked. Anything not read directly is marked "unverified".

## 1. Headline findings

1. **Stay on three.js for 3D, and fix two deprecations now.** We are on 0.186.1; r187 (2026-10-30) is out.
   - `THREE.Clock` is deprecated since r183 (`Clock: This module has been deprecated. Please use THREE.Timer
     instead.`): used in `src/games3d/{planet/PlanetScene.ts, creatures/CreaturesGame.ts, dino/DinoGame.ts,
     kart/KartGame.ts, ziggy/stage.ts}`.
   - `PCFSoftShadowMap` was removed in r186: three logs `WebGLShadowMap: PCFSoftShadowMap has been removed.
     Using PCFShadowMap instead.` Used in `src/games3d/kit/look.ts`, `ziggy/stage.ts`, `lutins/ar.ts`,
     `santa/index.ts`, `src/coloring/three/popup-scene.ts`. Our "soft shadows" are already plain PCF today;
     switch to `PCFShadowMap` (or VSM) and tune `shadow.radius`.
   (Both found by reading `three@0.187.0/build/*.js`; no project file was changed by this cell.)
2. **Phaser 4 is real and MIT** (4.0.0 "Caladan" 2026-04-10, 4.2.1 "Giedi" 2026-07-09, 4.3 changelog in
   progress). Best 2D framework candidate; ships 28 official Claude Code skills (MIT).
   Recommendation: one Phaser prototype for a genre our DOM mechanics handle badly (2D physics/platform/
   tilemap), not a migration.
3. **Licence traps found**: Cocos (MIT engine + editor EULA forbidding forks + bundled Spine + LGPL natives),
   Spine (proprietary runtime licence, paid editor seats), bitECS (now **MPL-2.0**), pmndrs postprocessing
   (**Zlib**), koota (**ISC**), Tone.js dependency `tslib` (**0BSD**), GSAP (proprietary "standard no-charge"
   licence, not OSS), Rive (MIT runtime but paid editor to export), GCA optional RMBG-2.0 (**CC BY-NC 4.0**).
4. **Skeletal animation**: no permissive option with a free, maintained editor exists. Best path for Ziggy =
   three.js `AnimationMixer` with clips built in code (our "code-built assets" rule), keeping `ZiggyRig` for
   procedural motion. In 2D: framer-motion (already) or Phaser tweens.
5. **Tencent GCA** is an excellent reference *process* (8 Claude Code agents + contracts + play-agent +
   blind critic) but not a usable tool (paid per-use APIs incl. a China-region VLM, generated bitmap art,
   adult genres).

## 2. Measured sizes (npm tarballs, gzip -9)

| Package (version) | File | Raw | Gzip |
|---|---|---|---|
| phaser 4.2.1 | dist/phaser.min.js (everything) | 1,375,976 B | 352,227 B |
| pixi.js 8.22.0 | dist/pixi.min.js | 840,663 B | 236,838 B |
| three 0.187.0 | build/three.core.js + three.module.js (unminified; npm r187 ships no .min) | 2,133,699 B | 419,212 B |
| three 0.187.0 | build/three.webgpu.js (unminified, needs three.core.js) | 1,350,894 B | 264,536 B |
| @dimforge/rapier3d-compat 0.21.0 | dist/rapier.mjs (wasm inlined) | 4,340,292 B | 1,652,936 B |
| @dimforge/rapier3d-compat 0.21.0 | dist/rapier_wasm3d_bg.wasm | 3,082,103 B | 1,168,722 B |
| @rive-app/canvas-lite 2.49.4 | rive.wasm | 849,980 B | 348,743 B |
| tone 15.1.22 | build/Tone.js | 345,500 B | 79,213 B |
| cannon-es 0.20.0 | dist/cannon-es.js | 346,256 B | 74,520 B |
| kaplay 3001.0.19 | dist/kaplay.mjs | 188,534 B | 69,299 B |
| troika-three-text 0.53.1 | dist/troika-three-text.esm.js | 205,391 B | 58,844 B |
| planck 1.5.1 | dist/planck.min.js | 297,211 B | 54,798 B |
| lottie-web 5.13.0 | lottie_light.min.js | 168,394 B | 46,410 B |
| yuka 0.7.8 | build/yuka.min.js | 123,214 B | 32,708 B |
| inkjs 2.4.0 | dist/ink.js | 128,278 B | 31,332 B |
| matter-js 0.20.0 | build/matter.min.js | 83,476 B | 25,784 B |
| wavesurfer.js 8.0.5 | dist/wavesurfer.min.js | 53,371 B | 15,111 B |
| howler 2.2.4 | dist/howler.core.min.js | 26,924 B | 7,951 B |
| nipplejs 1.0.4 | dist/index.mjs | 21,081 B | 6,189 B |

Our three.js bundle is tree-shaken and minified by Next, so the real cost is lower than the table (not
measured). Phaser 4 is not meaningfully tree-shakable: count ≈350 KB gzip per 2D-engine route, loaded on demand.

## 3. Repository notes (what we can reuse)

### Engines / rendering
- **three.js r187** (MIT, "Copyright © 2010-2026 three.js authors"). Useful recent features:
  - `WebGPURenderer` + TSL with WebGL2 fallback: r185–r187 added parallel pipeline compilation in
    `compileAsync()`, render bundles for InstancedMesh, depth-only RTs, compute hooks. Spike only for heavy
    scenes (planets, particles); WebGPU is not on every school tablet.
  - `BatchedMesh` (many different low-poly props, one draw call; sort/draw-range fixes in r186–r187) for
    code-built villages/forests; `InstancedMesh` for repeats (trees, snow).
  - `Timer` (replaces `Clock`), `Inspector` addon (dev only), `examples/jsm/physics/RapierPhysics.js`,
    `SunLight` with cascaded shadows (WebGPU path, r186), new core `HTMLTexture`.
  - Release notes: https://github.com/mrdoob/three.js/releases (r184 2026-04-16, r185 07-01, r186 09-24, r187 10-30).
- **Phaser 4.2.1** (MIT, "Copyright (c) 2026 Richard Davey, Phaser Studio Inc."): render-node WebGL renderer,
  unified Filters (replace FX + masks), rewritten cameras, new tint modes, lighting component,
  `SpriteGPULayer`/`TilemapGPULayer`, Arcade + Matter physics, Scale Manager (FIT/ENVELOP/EXPAND),
  `Text.setRTL()`. One dependency (`eventemitter3`, MIT). `skills/` folder: see research/skills/REPORT.md.
- **Babylon.js 9.35.0** (Apache-2.0, `license.md`): excellent all-in-one, but a second 3D engine.
- **Godot 4.7.2** (MIT): web export single-threaded by default since 4.5; sizes in registry are community
  figures (unverified). Our Rust/macroquad platformer already proves "wasm game in an iframe" much smaller.
- **PixiJS 8.22.0** (MIT): renderer only.
- **Cocos engine** (checked carefully): `LICENSE.md` on branch v3.8.9 is MIT (Chukong 2013-2016, Xiamen Yaji
  2017-2023), **but** the repo also contains `licenses/EDITOR_license_and_terms_en.txt` (Cocos Creator EULA:
  no forks/derivatives/redistribution, no combining with other software, revocable at will, Chinese law,
  account required), `cocos/spine/lib/LICENSE` (Spine Runtimes licence) and LGPL native libraries
  (`LICENSE_openal-soft.txt` LGPL-2, `LICENSE_mpg123.txt`). Reject.

### Animation
- **Spine runtimes 4.3.13** — LICENSE "Spine Runtimes License Agreement, last updated April 5, 2025":
  integration only under Section 2 of the Spine Editor License, or "each user of the Products must obtain
  their own Spine Editor license". Proprietary → reject (also `@pixi/spine-pixi`, which depends on spine-core).
- **DragonBonesJS** — MIT (2012-2025), dormant since 2025-05; editor gone.
- **Rive** — `rive-wasm` and `rive-runtime` MIT (verified); editor proprietary SaaS (export on paid plans
  per third-party sources, unverified).
- **Lottie** — lottie-web MIT (stale since 2024-11), dotlottie-web MIT (active).
- **Recommended permissive path**: three.js `AnimationMixer`/`AnimationClip` built in code (crossfade
  idle→walk→cheer on `makeZiggy()`), `ZiggyRig` for procedural secondary motion, framer-motion in DOM.

### Narration
- **ink 1.2.1** (MIT, inkle 2025) + **inkjs 2.4.0** (MIT): authored branching stories with state,
  conditionals, tags; compile in Node at build time; 31 KB runtime. Fits "no free LLM chat" (every line
  written and reviewed by us). Needs a FR/EN strategy and SayButton on each line.

### Audio
- **howler.js** (MIT): last release 2023-09; not needed.
- **wavesurfer.js 8** (BSD-3-Clause): dev tooling for voice-engine listening checks.
- **Tone.js** (MIT; latest 15.1.22, next 15.5.66): could replace hand-rolled schedulers (`kit/music.ts`,
  `games2d/music/synth.ts`); `tslib` 0BSD dependency to clear with owner.
- **ZzFX** (MIT): tiny code-built SFX.

### Physics
- **Rapier 0.21** (Apache-2.0): deterministic, 2D/3D, official three addon; ≈1.2 MB gzip wasm → lazy-load
  per game, prefer separate `.wasm` cached by `sw.js`.
- **cannon-es** (MIT) unmaintained; **matter-js** (MIT) only via Phaser; **planck.js** (MIT) good, no need yet.

### AI game generation — Tencent/Game-Creation-Agents (Apache-2.0, released 2026-10-14, commit ac0f18b)
A Claude Code project (`.claude/skills/game-pipeline/SKILL.md` orchestrator, 8 agents in `.claude/agents/`,
hooks enforcing the pipeline, a Python `gca` MCP server) that turns a prompt into a Phaser 4 game in
`playground/<slug>/`, then verifies it (Playwright, play-agent, VLM). Roles: design → level-design →
scaffold → (implement ∥ assets) → asset-integration → verify → critic; the main agent only orchestrates.
Ruled out as a tool: OpenAI Images, Volcengine ARK (Seedance + pinned Doubao VLM, cn-beijing keys), per-use
cost; optional RMBG-2.0 CC BY-NC. Ideas worth taking:
- `GAME_DESIGN.md` as single source of truth with a **mechanics contract**: controls table, objectives table
  ("reachable by" + "observable success signal"), interaction matrix (collide/overlap/pick/ignore), win
  conditions, juice intent; each row tagged MUST/MUST_NOT/SHOULD and sourced.
- **Contracts as JSON** (objectives, interaction, layout, asset manifest) consumed by tests.
- **Play-agent with bug oracles**: `frozen_state` (6 identical engine-state signatures) vs `inert_scene`
  (visual diversity ≤ 0.25 over ≥ 4 frames); objectives judged YES/NO/PARTIAL with evidence.
- **State injection**: expose the game on `window` in test builds, jump to a scene/state instead of sleeping.
- **Blind critic**: never sees code, default "NOT READY TO SHIP", evidence priority video > play report >
  screenshots > tests.
- **Living failure catalogue**: signature → root cause → verified fix, appended only after a verified re-run.
- **Single-writer artefacts**: each agent owns its files; the orchestrator never rewrites a producer's output.
Related: OpenGame (CUHK MMLab, Apache-2.0): "Template Skill" + "Debug Skill" (living protocol of verified fixes).

### Lesser-known gems
- **three-mesh-bvh** (MIT): `computeBoundsTree` + `acceleratedRaycast` for tap-to-walk and picking; shape-casts
  for simple character collision.
- **troika-three-text** (MIT): SDF text with bidi (Arabic) for 3D signs/labels.
- **three.quarks** (MIT, Forrest Sun / Alchemist0823): batched particle systems.
- **glTF-Transform** + **meshoptimizer** (MIT): build-time only, if we bake models offline.
- **nipplejs** (MIT): virtual joystick for older kids on tablets. **@use-gesture/vanilla** (MIT): drag/pinch.
- **recast-navigation-js** (MIT), **yuka** (MIT, dormant): navmesh / steering — patterns to port, not deps.
- Chinese ecosystem checked: Galacean engine/effects (Ant Group, MIT), Orillusion (MIT, WebGPU-only), Cocos
  (licence issues), OpenGame (CUHK). None beats three.js for us.
- Rejected on licence: bitECS (MPL-2.0), koota (ISC), postprocessing (Zlib), GSAP (proprietary).

## 4. Phaser 4 vs our three.js kit

| Need (kids 4–12) | three.js kit today | Phaser 4 |
|---|---|---|
| 3D worlds, Ziggy plush 3D | Yes, 15 games, PS2 look, code-built | No (2D only) |
| 2D action: platformer, runner, physics toys | Possible (ortho camera) but all hand-written; DOM mechanics not made for physics | Native: Arcade physics, groups/pools, tilemaps, cameras |
| 2D drag-and-drop, sorting, quiz answers | React DOM mechanics (accessible, read-aloud, i18n, RTL by CSS) | Possible, but canvas has no DOM a11y; React overlay needed anyway |
| Code-built assets | Geometry + vertex colours | `Graphics` + `generateTexture`, `RenderTexture`, particles: very good |
| Text in 12 locales incl. Arabic | DOM overlays, canvas label sprites | `Text` with `setRTL`; BitmapText needs prebuilt fonts |
| Responsive / 390×844 | Own resize code | Scale Manager built-in |
| Tweens / timers / juice | framer-motion (DOM), own loops in 3D | Tweens, chains, timers, camera shake/flash, filters |
| Audio | Web Audio synth | Sound manager with mobile unlock (our synth still usable) |
| Bundle | Shared three chunk (already paid) | ≈352 KB gzip extra per route |
| SSR / hydration | Lazy client import already | Must be `dynamic(..., { ssr: false })`; touches `window` at import |
| AI-assisted dev | CLAUDE.md lessons | 28 official MIT skills (24 vendored) |
| Testing | Playwright + SwiftShader | Same, plus `window.__phaserGame` state injection |

**Recommendation**
1. Keep three.js for all 3D/2.5D games; upgrade to r187 with the Clock→Timer and PCFSoftShadowMap fixes;
   adopt `BatchedMesh`/`InstancedMesh` and code-built `AnimationClip`s; test three-mesh-bvh, three.quarks,
   troika-three-text, nipplejs.
2. Keep React DOM mechanics for answer/quiz/drag games (best for a11y, read-aloud, i18n).
3. Run **one Phaser 4 prototype** for a 2D physics/platform genre, lazy-loaded, judged on: ≤ 400 KB gzip route,
   60 fps on a 4-core tablet, no hydration error, FR+EN with read-aloud overlay, reduced motion respected,
   ≥ 64 px tap targets. Adopt only if it saves real code vs an ortho three.js scene.
4. Physics: Rapier when a game needs real rigid bodies (lazy wasm), never cannon-es.
5. Narration: prototype ink/inkjs for the detective game's dialogue (authored, offline, reviewed).
6. Do not adopt Spine, Cocos, Rive editor, bitECS, GSAP, postprocessing (licence/cost).

## 5. Unverified items
- Godot web export sizes (community posts). Rive editor prices/export limits (third-party pages).
- Phaser 4 Canvas-renderer status and official Next.js template version.
- Licences of troika's transitive deps (bidi-js, webgl-sdf-generator, troika-*).
- Whether troika-three-text fetches a default font from a CDN when no `font` is set.
- Real minified/tree-shaken bundle impact in our Next build (no `npm install` in the project).
