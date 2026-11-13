# Audit: Bac à sable magique (read-only, nothing modified)

## 1. How it works today, and what to keep

**Simulation** (`src/games2d/sandbox/sim.ts`)
- The grid is about 24,000 cells: 200×120 in landscape, 120×200 in portrait. It is picked once at mount from the box aspect (`SandCanvas.tsx:11,95-100`).
- Data is a structure of arrays: six `Uint8Array`s (`type`, `a`, `b`, `c`, `shade`, `clock`) at `sim.ts:73-83`.
- The step is a single pass, rows bottom to top, with a random left/right direction per row and a per-cell switch (`sim.ts:258-308`). A `clock` generation stamp stops a cell moving twice.
- Randomness is a seeded xorshift32, so the same seed and gestures give the same world.
- Events are capped at one per reaction kind per step (`sim.ts:310-320`).

**Render**
- Three CPU passes per frame: `renderPixels` (one RGBA pixel per cell), `enrich` (edge light, shadow, twinkle) and `renderGlow` (quarter-resolution light map).
- The result is blitted with `putImageData`, then scaled nearest-neighbour onto a canvas capped at DPR 2. The glow is added with `lighter` (`SandCanvas.tsx:174-200`).
- Sky and sun are Canvas2D gradients.

**Loop**: fixed 60 Hz, at most 3 steps per frame, backlog dropped, stopped when the tab is hidden (`SandCanvas.tsx:246-288`).

**Keep**
- Painting never destroys what the child built, and loose elements are sprinkled (`sim.ts:201-221`).
- Scenes are calm: they adapt to both orientations and nothing reacts until the child acts (covered by a test).
- The full water cycle, plants needing water and light, branches, leaves and five flower hues.
- Nothing burns and there is no failure state.
- The notebook: equation cards, hints on locked cards, the card flying into the notebook, and challenges that count across visits.
- The save in localStorage under `ziggy:sandbox` (`storage.ts`).
- World Memory: `finishExtraGame('bac_a_sable','science',…)` on each first discovery, plus `MagicMoments` (`SandboxGame.tsx:116-118`).
- Read-aloud on tool pick, discovery and challenge, gated by `readAloudOn` (`SandboxGame.tsx:86-91`).
- Accessibility: keyboard brush (arrows, Space, 1–9, P), `aria` labels, reduced-motion handling, two-tap clear, safe-area padding.

## 2. Defects and limits

**Bugs**
- **React re-renders every frame.** Any event sets `changed` and calls `setSave` (`SandboxGame.tsx:107-109,129-130`). While it rains or sand sinks, the whole game and the notebook (`motion.li layout`, `Notebook.tsx:42`) re-render at up to 60 Hz.
- **Totals undercount.** Events are deduplicated per step and again per frame (`SandCanvas.tsx:261-264`), so two blooms in one frame count as one for "3 flowers". The exact `sim.counts` is never read.
- **Multi-touch.** There is one shared input state and no `pointerId` check (`SandCanvas.tsx:361-372`). A second finger makes `paintLine` draw a line between the two fingers.
- **Sway drops pixels.** A swaying plant cell that lands on a solid is skipped (`render.ts:150`), and shifted cells detach flowers from stems.
- **Porous walls under water.** Solids painted into water only take 60% of cells per pass (`sim.ts:213`).
- **Reduced motion is partial.** Water shimmer, lamp flicker and glow pulse still animate (`render.ts:81,110,176`).
- **Weak determinism hash.** `hash()` ignores `c`, `shade` and the RNG state (`sim.ts:184-191`).
- **No rebuild on rotation.** After a rotation or resize the grid is only letterboxed.

**Performance**
- Render is the hot spot, not the sim. `enrich` alone costs about 10× a step (`shading.ts:27-59`).
- Typed arrays are allocated every frame (`render.ts:56-59,173-175`), and small arrays per seed, plant and bloom (`sim.ts:375,600,656`).

**Visual**
- One flat colour per cell, shown as 4–6 px blocks.
- No liquid smoothing, no real lighting, no particles beyond sparkles.
- One hard-coded sky (`SandCanvas.tsx:124-132`).

**UX**
- Tool buttons are 52 px and brush buttons 40 px, under the 56 px rule (`Toolbar.tsx:88,129`).
- The 12-tool strip scrolls horizontally on phones, and that will not scale to many elements.
- The world itself is never saved; there is no undo and no snapshot.
- On TV, the D-pad only works once the canvas is focused: there is no autofocus and no integration with `src/lib/tv`.
- Locales other than `fr` get English.

**Tests**
- 23 tests, sim only.
- Nothing covers input, storage or the event-to-save path, and render is only checked for "doesn't throw".
- The speed test is wall-clock based (`sim.test.ts:283-306`), already noted as flaky in CLAUDE.md.
- There are no golden traces.

## 3. Measured (Node, tsx, 4 cores, busy world about 50% filled, median ms)

| Grid | step (p99) | renderPixels | enrich | glow |
|---|---|---|---|---|
| 200×120 | 0.35 (0.93) | 1.9 | 3.5 | 0.76 |
| 400×240 | 1.4 (2.3) | 7.8 | 14.5 | 3.1 |
| 800×480 | 5.1 (8.9) | 29.7 | 58 | 12 |

- `loadScene` with `settle(90)` takes 16 ms.
- Content counts: 13 elements, 10 reactions and discoveries, 12 tools, 4 challenges, 3 scenes.
- The sim already scales in JS; CPU shading does not, so the quality budget must go to the GPU.

## 4. Migration risks and recommendations

**Save format**
- `loadSave` ignores `v` and silently drops unknown keys (`storage.ts:33-47`).
- Keep the 10 reaction ids and 4 challenge ids byte-identical, keep the key, and add a v2 with a tolerant reader.
- Have Rust return stable string ids or a fixed enum table, with a test that checks it against `content.ts`.

**World Memory**
- Each new discovery awards a round, so many more discoveries inflate stars. Decide the balance up front.

**Wasm loading**
- Follow the precedent: pinned wasm-bindgen with `--target web`, artifacts committed (Vercel has no Rust), loaded with `new URL('./wasm/x_bg.wasm', import.meta.url)` inside an effect (`src/lib/lutins/engine.ts:191`), and `initSync` from disk for Vitest (`:182-187`).
- Hashed files under `/_next/static` are already cache-first in `public/sw.js`, so no `VERSION` bump is needed unless assets go under `public/`.
- `--check` is not wired into CI.
- The lutins profile uses `opt-level="s"` and `wasm-opt -Oz`; the sim wants `opt-level=3`.

**Hydration**
- Keep SSR output static (empty save, placeholder canvas) and keep seeding inside the effect.
- Provide a loading state and a failure fallback.

**API boundary**
- Use one `World` handle with coarse calls: `new(w,h,seed,world_id)`, `paint_line(...)`, `wind(...)`, `step(n)`, `load_scene(id)`, `snapshot()` and `restore(bytes)`.
- Read buffers zero-copy through pointer and length, as `frame_ptr` does (`engine.ts:135`). Re-create the views after any memory growth; better, preallocate.
- Return events in a fixed `u32` ring of kind, x, y and exact count. No JSON per frame.

**Data layout**
- Keep the structure of arrays, or pack each cell into a `u32` so it uploads directly as a texture.
- Drive behaviour from an element table (density, phase, flags) and a reaction table, not a switch.
- Add a temperature field for volcano and ice, and per-world gravity and atmosphere for the Moon, Mars and undersea.
- Add dirty chunks so calm scenes cost nothing.

**Rendering**
- Use WebGL2 shaders fed by the cell textures: smooth upscale, lighting, liquid surfaces, bloom, parallax backdrops.
- Keep a Rust CPU path as the fallback for low-power devices; test with `hardwareConcurrency` forced to 8 as well.

**Licences**: MIT, Apache or BSD crates only, run the licence audit, and list them in `THIRD_PARTY_LICENSES.md`.

## 5. Top 10 for the rebuild

1. Never lose a child's notebook: stable ids plus a migration test from a v1 fixture.
2. GPU rendering at device resolution with a CPU fallback and no per-frame allocation.
3. Table-driven elements and reactions, so worlds and interactions are data.
4. Exact event counts, throttled into React, with no per-frame `setSave`.
5. Port the 23 behaviour tests to `cargo test`, with calm scenes for every world in both orientations and a full-state hash.
6. Keep the gentle rules: non-destructive paint, nothing sad, no failure, discoveries caused only by the child.
7. Proper input: per-pointer strokes, 56 px or larger targets, a categorised tool picker, and D-pad focus for TV.
8. Read-aloud and FR+EN text for every new tool, discovery and world, plus complete reduced-motion support.
9. Wasm delivery: lazy load in an effect, committed reproducible build, `--check` in CI, offline through the service worker, graceful fallback.
10. World persistence (snapshot and restore) and rebuild on rotation, with step time budgeted by tests that are not wall-clock flaky.
