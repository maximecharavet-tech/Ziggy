# Bac à sable magique — rebuild brief (2026-11-13)

Synthesis of three reports (read them): `research/sandbox/AUDIT.md` (current game, defects,
measurements), `research/sandbox/CREATIVE.md` (8 worlds, elements, 50 reactions, creation features,
what to avoid), `research/sandbox/ENGINE.md` (Rust architecture, renderer, budgets, stages).
Owner's goal: maximum graphics quality from the Rust code, funny and pretty, worlds volcano / undersea /
space / Moon / Mars, more creation and many more interactions.

## Decisions (where the reports disagreed, this wins)
1. **Renderer: Rust software renderer is the primary and complete path** (owner asked for Rust), at
   2× (low tier) / 3× (high tier) the grid, zero-copy frame to one canvas. The audit's WebGL2 idea is an
   optional last-stage post-pass only if measurements demand it; never required.
2. **Grid 320×192 (portrait 192×320), same on all tiers**; packed `u32` cells + coarse temperature plane;
   4-phase scans with clock stamp; dirty chunks that sleep; integer-only, seeded, deterministic.
   Cargo profile tuned for speed (`opt-level=3`), not size.
3. **Data-driven**: element table + reaction table authored as data and code-generated into Rust;
   reaction and discovery ids are stable strings shared with `content.ts`. The 10 existing reaction ids
   and 4 challenge ids stay byte-identical; save key `ziggy:sandbox` gets a tolerant v2 reader with a
   migration test from a v1 fixture. Never lose a child's notebook.
4. **Gentle rules** (CREATIVE §6 + CLAUDE.md): no flames/explosions/burning — lava is warm sleepy jam;
   things "change", never "destroyed"; critters can't be hurt (bubble shield + hop); no timers, no score,
   no completion bar; invitations ("Et si… ?") not goals; painting never destroys the child's build.
5. **World Memory balance**: award a round only for the first discovery of each *world* plus every 5th
   discovery, not one per discovery (50+ would inflate stars).
6. **Age staging**: 6 big tools per world for 4–6 (≥ 64 px), full palette in a second drawer, sliders
   (gravity/temperature) only for 10–12.
7. **Fix the audit's bugs in the new build**: no per-frame React state (throttle events, exact counts),
   per-pointer strokes (multi-touch), full reduced-motion, rebuild on rotation, world snapshot/restore
   (IndexedDB), TV/D-pad focus, tool picker by category instead of a long scrolling strip.
8. **Ship order**: (1) Rust port at parity → (2) engine v2 (chunks, tables, temperature) →
   (3) renderer v2 → (4) worlds: volcano + undersea first, then Moon + space, then Mars, with critters →
   (5) polish (particles, music from elements, album). Each stage leaves the game working.
9. **Budgets** (to measure, not assume): ≤ 7 ms/frame low tier (step + render + blit) on this 4-core
   sandbox, wasm ≤ ~150 KB raw target (soft), no per-frame allocation, fixed wasm memory.
10. **Tests**: port the 23 behaviour tests; one unit test per reaction; determinism hash native == wasm;
    golden frames with tolerance; fuzz commands and `load` bytes; FR+EN + banned-word tests; no
    wall-clock speed assertions (ratio to a calibration loop).

## Addendum (owner, 2026-11-13): performant 3D presentation with game motion
The owner wants "a performant 3D engine, with game motion animation". Decision 1 is amended:
- **Stage 3b (required, after the Rust renderer works): a GPU 3D-relief presentation** on capable
  devices. The Rust engine exports compact per-cell planes (species/shade, height/depth, emissive,
  temperature, liquid mask) zero-copy; a WebGL2 layer (three.js is already a dependency; raw WebGL2 is
  fine too) draws the world as a lit relief: height-mapped cells with normals from the planes, a moving
  world light with soft shadows, liquids as a separate translucent surface with refraction, fresnel
  highlights and gentle waves, lava/stars/plankton with real bloom, depth-layered 3D backdrops with
  parallax, a subtle camera (tilt/parallax on pointer or device tilt, gentle push-in on discoveries).
- **The Rust software renderer stays complete** and is the path on low-power devices, when WebGL2 is
  missing or the context is lost, and for photos/thumbnails. Both paths are tested (4 cores and
  `hardwareConcurrency` 8; the white-veil lesson: keep bloom subtle, verify exposure).
- **Game motion ("juice")**, on both paths where possible: squash & stretch on splashes and impacts,
  elastic pops when elements are placed, anticipation/overshoot on critters (rigged with simple bones
  or sprite sheets rendered in code), particle bursts and ribbons on reactions, camera micro-shake only
  as a soft bump (off under reduced motion), animated world-picker transitions (zoom into the world),
  eased UI motion. Reduced motion: no camera movement, no shake, calmer particles.
- Budgets: GPU path ≤ 4 ms CPU + one draw pass set per frame at device resolution (DPR capped at 2);
  measure frame time in the page on both paths.

## Addendum 2 (owner, 2026-11-13): no GPU
The owner does not want a GPU path. **The previous addendum's WebGL2 presentation is cancelled.**
Everything is drawn by the Rust software renderer, on every device:
- The 3D-relief look is computed in Rust: a per-cell height field (piles, liquid surfaces, rocks) →
  normals → directional world light with soft shadows (short height-field shadow march or
  horizon trick), specular/fresnel highlights on liquids, refraction by offsetting the background
  sample, ambient occlusion from neighbour heights, emissive glow via the downsampled blur buffer,
  depth-layered backdrops with parallax (the "camera" is a software offset/scale of layers), fog/depth
  tint. Keep it within the frame budget with LUTs, integer maths, dirty-region rendering and the
  2×/3× tiers; consider an optional wasm-SIMD binary for blur/blend/upscale if benchmarks justify it.
- Game motion stays as specified (squash & stretch, elastic pops, animated critters, particle bursts,
  world-picker zoom), drawn in the software renderer or as DOM/CSS transform-opacity animations for UI.
- No WebGL/WebGPU anywhere in the sandbox; canvas 2D `putImageData`/`drawImage` only for the blit.
