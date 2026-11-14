# Skills cell — report (2026-11-09)

Scored rows: `research/skills/registry.md`. Installed copies: `.claude/skills/game-development/vendor/`.

## 1. Claude Code skill format (from https://code.claude.com/docs/en/skills, read 2026-11-09)
- A skill = a folder with `SKILL.md`: YAML front matter (first line `---`), then Markdown instructions.
  No field is strictly required; `description` is the key one (Claude decides when to load from it;
  description + `when_to_use` truncated at 1,536 chars). `name` defaults to the folder name. Other fields:
  `when_to_use`, `allowed-tools`, `disable-model-invocation`, `user-invocable`, `paths`, `context: fork`,
  `agent`, `model`, `effort`, `license`, `metadata`, etc.
- Discovery: `~/.claude/skills/<name>/SKILL.md`, project `.claude/skills/<name>/SKILL.md`, nested
  `<subdir>/.claude/skills/<name>/SKILL.md` (loaded when Claude touches files there), plugins
  (`<plugin>/skills/<name>/`). Deeper nesting like `.claude/skills/a/b/SKILL.md` is not documented.
- Guidance: SKILL.md < 500 lines, move reference material to supporting files linked from SKILL.md; listings
  cost context every turn; after compaction each invoked skill keeps its first 5,000 tokens (25,000 total);
  use `paths` to restrict auto-loading; `disable-model-invocation: true` for side-effect workflows; evaluate
  against a baseline (skill-creator).

## 2. What exists

### phaserjs/phaser `skills/` (MIT, repo LICENSE.md "Copyright (c) 2026 Richard Davey, Phaser Studio Inc.",
commit 02d8931b626d9764c133cbb3fbf99966c03c757c, 2026-08-21, Phaser 4.2.1)
28 skills, 36 files, 788 KB, Markdown only (no scripts, no network calls; scanned for injected instructions).
Each has front matter `name` + `description` ("Use this skill when… Triggers on: …"), key source paths in
the Phaser repo, quick start, core concepts, API tables, gotchas; 8 have `references/REFERENCE.md`.
List: actions-and-utilities, animations, audio-and-sound, cameras, curves-and-paths, data-manager,
events-system, filters-and-postfx, game-object-components, game-setup-and-config, geometry-and-math,
graphics-and-shapes, groups-and-containers, input-keyboard-mouse-touch, loading-assets, particles,
physics-arcade, physics-matter, render-textures, scale-and-responsive, scenes, sprites-and-images,
text-and-bitmaptext, tilemaps, time-and-timers, tweens, v3-to-v4-migration, v4-new-features.

### Tencent/Game-Creation-Agents (Apache-2.0, © 2026 Tencent, commit ac0f18b, 2026-10-17)
- `.claude/skills/game-pipeline/` (SKILL.md 37 KB orchestrator + dispatch-contract.md + ~90 reference files:
  design/GDD template, mechanics contract, asset plan, level DSL schemas, genre implementation guides,
  verify: common-failures, test-patterns, playwright-recipes, play-agent, rubric).
- `.claude/agents/`: design, level-design, scaffold, implement, assets, asset-integration, verify, critic.
- `.claude/hooks/` (pipeline enforcement, agent boundary guards), `.claude/rules/`.
- Bundles a copy of the Phaser skills under `references/phaser/` (MIT).
- Depends on its `gca` MCP server and paid APIs: OpenAI Images, Volcengine ARK (Seedance video, pinned
  Doubao VLM, cn-beijing). Optional RMBG-2.0 = CC BY-NC 4.0.

### anthropics/skills (commit 2c5958e, 2026-11-06; each skill has an Apache-2.0 LICENSE.txt)
webapp-testing, skill-creator, frontend-design, algorithmic-art, canvas-design, web-artifacts-builder,
mcp-builder, document skills, etc. No game skill.

### OpenGame (CUHK MMLab, Apache-2.0): "Template Skill" + "Debug Skill" described in the paper; not
packaged as Claude Code SKILL.md files.

## 3. Installed (24) — why
`.claude/skills/game-development/vendor/phaser-<name>/` for: game-setup-and-config, scenes,
scale-and-responsive, input-keyboard-mouse-touch, loading-assets, sprites-and-images, animations, tweens,
graphics-and-shapes, render-textures, text-and-bitmaptext, particles, filters-and-postfx, cameras,
groups-and-containers, time-and-timers, events-system, audio-and-sound, physics-arcade, tilemaps,
curves-and-paths, actions-and-utilities, v4-new-features, game-object-components.
- Why: accurate Phaser 4 API reference (v4 changed renderer, filters, cameras, tints: model memory is
  mostly Phaser 3), needed by ziggy-phaser-expert and the planned Phaser prototype. MIT, compatible.
- Each folder: upstream files unmodified + `LICENSE.md` (Phaser MIT text) + `SOURCE.md` (URL, commit,
  licence, date, notes).
- Folders prefixed `phaser-` so generic names (`scenes`, `tweens`, `audio-and-sound`) are never confused
  with three.js work. Front-matter `name` left as upstream. Upstream "related skills" links use
  `../<skill>/SKILL.md`: read as `../phaser-<skill>/SKILL.md` (noted in SOURCE.md).
- Location is one level deeper than documented discovery, so they should NOT auto-load (no per-turn
  context cost). The lead's `ziggy-phaser-expert` SKILL.md should link to them as supporting files
  (e.g. `../game-development/vendor/phaser-scenes/SKILL.md`). If the lead wants them auto-discovered, move
  them to `.claude/skills/phaser-*/` and add `paths:` restrictions.

## 4. Rejected — why
- Phaser v3-to-v4-migration (no v3 code), physics-matter (Arcade suffices; Rapier for rigid bodies),
  data-manager (we keep state in pure tested logic modules), geometry-and-math (low value per token).
- GCA game-pipeline skill + 8 agents + hooks: bound to `mcp__gca__*` tools and paid external APIs (one
  China-region), adult genres, generated bitmap art; would not run and contradicts zero running cost.
  Ideas mined below.
- GCA bundled Phaser references: older duplicate of the vendored upstream.
- GCA verify references: written for its MCP runner (`run_verify_dag`, `gate_check`); rules distilled below.
- Anthropic webapp-testing: redundant with `/smoke`, `/verify`, `verify-app` (Node Playwright + SwiftShader).
- Anthropic skill-creator: already available in this environment (`anthropic-skills:skill-creator`).
- Anthropic algorithmic-art / canvas-design: not game-related.
- Nothing with unknown or incompatible licence was installed.

## 5. Inputs for the custom skills

### ziggy-game-architect
1. One orchestrator, specialised producers, single-writer artefacts: the orchestrator never writes game
   code or rewrites a producer's output (GCA `game-pipeline/SKILL.md` §0, §11).
2. A design doc is the single source of truth; every downstream step reads it, only the design role writes
   it (GCA CLAUDE.md "Sources of Truth").
3. Pure, unit-tested game logic separated from the scene/renderer (Ziggy docs/GAMES_3D.md; GCA scaffold →
   implement split).
4. Engine loaded on demand, client-only (`dynamic(..., { ssr:false })`), never at module top level in
   server components (Ziggy pattern; Phaser touches `window` at import).
5. Contracts as JSON (objectives, interaction, layout, asset manifest) that tests consume (GCA
   `references/scaffold/schemas/*.schema.json`).
6. Persist pipeline state so work resumes from the first incomplete phase, "smallest safe redo unit"
   (GCA SKILL.md §10).
7. Choice of engine: three.js for 3D/2.5D, React DOM for quiz/drag, Phaser 4 only for 2D physics/tilemap
   after the prototype passes (GitHub cell REPORT §4).
8. Zero network during play; all assets code-built or pre-generated offline (Ziggy CLAUDE.md).

### ziggy-character-animation
1. The real Ziggy = felt plush: 3D via `<Ziggy3D>` (max one per page) / `makeZiggy()`; 2D via
   `MascotCutout`/`ZiggyAvatar` (Ziggy CLAUDE.md).
2. Prefer three.js `AnimationMixer` with `AnimationClip`s built in code (Number/Quaternion/Vector
   KeyframeTracks) for state crossfades; keep procedural rig motion for secondary motion (GitHub cell).
3. Spine, Rive editor, Cocos are off-limits (licence/cost); DragonBones dormant (GitHub cell registry).
4. Phaser 2D: animations from atlases via AnimationManager, `chain()` for sequences, listen to
   `ANIMATION_COMPLETE` rather than timers (Phaser skill `animations`).
5. Animate transform/opacity only; respect `useReducedMotion` from `@/lib/use-reduced-motion` (Ziggy CLAUDE.md).
6. Characters are never sad; errors trigger a hint pose, not a failure animation (Ziggy red lines).
7. Use `THREE.Timer` (not deprecated `Clock`) for animation delta (three r183 deprecation).

### ziggy-phaser-expert
1. Phaser 4 only; never copy Phaser 3 signatures (pipelines → render nodes, FX/masks → Filters, new tint
   modes) (GCA SKILL.md §13; Phaser skill `v4-new-features`).
2. Read the vendored skill for the subsystem before coding (`vendor/phaser-*`).
3. Scale: `scale.mode: FIT` (or `EXPAND`) + `autoCenter: CENTER_BOTH`, parent with defined size
   (Phaser `scale-and-responsive`); test 1280×800 and 390×844.
4. Scenes: `start()` shuts down, `switch()` sleeps; clean listeners on `'shutdown'` (Phaser `scenes` gotchas).
5. Create colliders, cursor keys, input handlers in `create()`, never in `update()` (GCA `common-failures.md`).
6. Code-built assets: `Graphics` → `generateTexture`, `RenderTexture` (Phaser `graphics-and-shapes`,
   `render-textures`).
7. Text: `resolution: devicePixelRatio` for crisp text, `setRTL()` for Arabic; all strings from `tr()`
   FR+EN, read-aloud overlay in React (Phaser `text-and-bitmaptext`; Ziggy CLAUDE.md).
8. Audio unlocks only after a user gesture (`UNLOCKED` event); default quiet, honour site mute (Phaser
   `audio-and-sound`; `kit/music.ts`).
9. Expose `window.__phaserGame` in test builds only, for state injection (GCA `test-patterns.md`).
10. `game.destroy(true)` on React unmount (async, next frame) to avoid leaks/double canvases (Phaser
    `game-setup-and-config`).

### ziggy-game-design
1. Mechanics contract: controls table (literal input), objectives with "reachable by" + observable success
   signal, core rules, win conditions, juice intent; rows tagged MUST/MUST_NOT/SHOULD with source (GCA
   `mechanics-contract-guide.md`).
2. Precedence: owner brief MUST > other brief prose > concept addition > genre default; record tempting
   wrong defaults as MUST_NOT (GCA same file).
3. Zero failure: a mistake yields a hint, nothing lost, no failure screen, no guilt streaks (Ziggy red lines).
4. Starting state must be actionable (the first objective reachable from the start) (GCA `common-failures.md`).
5. Instructions read aloud; answers readable lane by lane for little ones (docs/GAMES_3D.md).
6. Difficulty decided by the engine and capped by age; results to World Memory (docs/GAMES_3D.md).
7. Narrative: authored branching (ink/inkjs) — never free LLM chat for children (Ziggy red lines; GitHub cell).

### ziggy-level-design
1. Levels as schema-valid data (JSON), one file per stage, separate from code (GCA `level-design-agent.md`,
   `level_schema.json`).
2. A revise pass touches only levels named in the issue list (GCA level-design-agent "MODE=revise").
3. Terrain prefabs / reusable chunks rather than hand-placing every object (GCA `terrain-prefabs.md`).
4. Phaser tilemaps: Tiled JSON or code-generated, collision by tile property, camera culling (Phaser `tilemaps`).
5. Every placed objective must be reachable — test it automatically (GCA play-agent objectives).
6. Many repeated props → `InstancedMesh`/`BatchedMesh` in three.js (three r186–r187).
7. Deterministic seeds for procedural levels (`kit/rng.ts`) so tests replay identically (GCA determinism invariant).

### ziggy-ai-characters
1. Every AI text through ChildShield; AI never claims to be human; no free LLM chat for children; only the
   owner-approved Père Noël exception (Ziggy CLAUDE.md).
2. Prefer authored, pre-generated lines (ink, offline Hyper Engine + `verify.ts`) over runtime generation
   (zero running cost).
3. NPC behaviour: small FSMs + steering (seek/arrive/wander) ported into the kit rather than a dependency
   (yuka is dormant) (GitHub cell).
4. Navmesh (recast-navigation-js, MIT) only if worlds become complex (GitHub cell).
5. Companions are never sad, never guilt the child (Ziggy red lines).
6. No child voice/image/data to third parties — rules out GCA-style cloud VLM/asset APIs at runtime.

### ziggy-game-testing
1. Feedback loop mandatory: `npm run check`, production build, Playwright at 1280×800 and 390×844, with and
   without `reducedMotion: 'reduce'`; 3D with SwiftShader and `hardwareConcurrency` forced to 8 (Ziggy
   CLAUDE.md, verify-app).
2. State injection: jump to the scene/state under test via a test-only global, wait for an observable
   condition — never fixed sleeps (GCA `test-patterns.md`, `playwright-recipes.md`).
3. Canvas clicks by fractions of the canvas bounding box (GCA `playwright-recipes.md`).
4. Oracles: `frozen_state` (6 identical state signatures) vs `inert_scene` (low visual diversity) — diagnose
   separately (GCA `common-failures.md`).
5. Objectives judged YES/NO/PARTIAL with evidence; each must be reachable (GCA `play-agent.md`).
6. Blind critic pass: reviewer sees only screenshots/video + design doc, default "not ready" (GCA
   `critic-agent.md`); for Ziggy add the child-safety-reviewer agent.
7. Living failure catalogue: append signature → root cause → verified fix only after a verified re-run
   (GCA `common-failures.md`; OpenGame Debug Skill; Ziggy "Lessons learned").
8. Determinism invariant: same input → same end state for fixed-step games (GCA `test-patterns.md` §7.1).
9. Treat console warnings as failures (e.g. three's Clock and PCFSoftShadowMap warnings) (GitHub cell).

### ziggy-performance
1. Lazy-load engines/physics per game route; Phaser ≈352 KB gzip, Rapier wasm ≈1.2 MB gzip (GitHub cell
   measurements).
2. Low-power path (`prefersLowPower()`, ≤ 4 cores): lower pixel ratio, no bloom; still test the capable path
   (Ziggy CLAUDE.md, `kit/look.ts`).
3. Draw calls: `InstancedMesh` for repeats, `BatchedMesh` for varied static props (three r185–r187).
4. Raycasting on dense meshes: three-mesh-bvh (GitHub cell).
5. Shadows: PCFSoftShadowMap is gone (r186) — use PCFShadowMap/VSM, small shadow maps, few casters.
6. Phaser: object pools via Groups (`getFirstDead`), `SpriteGPULayer` for many sprites, avoid creating
   objects in `update()` (Phaser `groups-and-containers`, `v4-new-features`).
7. Don't invent FPS thresholds in generic tests; one explicit SLA per game, measured on the low-power path
   (GCA `test-patterns.md` §7).
8. Cache static game files with `public/sw.js` and bump `VERSION` when regenerated (Ziggy CLAUDE.md).
