**Basis.** Read: current TS sim (200×120, five `Uint8Array` planes, bottom-up scan, xorshift32, CPU pixels + ¼-res glow) and `lutins-core` (`opt-level="s"`, LTO, `panic=abort`, `frame_ptr/frame_len`). Verified online: Sandspiel is MIT, with a 4-byte `#[repr(C)]` cell `{species, ra, rb, clock}`, scan direction alternating per generation, and a raw cell pointer to JS. Not verified: Powder Toy's licence, Noita details (from memory). All ms figures are estimates to validate; I did not find the 7 ms benchmark in the repo.

## 1. Architecture
- **Grid:** fixed 320×192 (portrait 192×320), about 61k cells, identical on every tier so saves and replays are portable. Tiers change rendering only.
- **Cell:** hot AoS `u32` = species 6 bits + 2 flags, `ra` (life, charge, sub-cell fall accumulator), `rb` (shade 4 bits + variant 4 bits), clock parity + state.
- **Cold planes (SoA):** temperature `i16` at half resolution (160×96) and a per-world gravity-direction `u8` plane.
- **Update:** Sandspiel's clock stamp plus a 4-phase scan cycle (LTR/RTL × along/against gravity), so radial gravity shows no bias.
- **Dirty chunks:** 32×32 (10×6) with Noita-style dirty rects. A chunk sleeps after two idle ticks and wakes on a neighbour write, brush, or temperature change above a threshold.
- **Determinism:** integer-only sim, one seeded PRNG, sine and gravity from LUTs, no hash-map iteration. Fixed 60 Hz tick; inputs applied at tick boundaries.
- **World params (one const struct each):** gravity mode (uniform or radial), strength, ambient temperature and cooling, medium (air, water, vacuum), buoyancy and drag multipliers, wind, palette, background.
  - Moon: the accumulator adds 40 instead of 255, so grains fall about one tick in six, and lateral dispersion is higher.
  - Undersea: empty cells are implicit water; `density − medium` decides sink or rise.
  - Space: the direction plane points at the planetoid, strength falls off by distance band, and beyond a radius cells drift on a stored 3-bit velocity.
- **Liquids:** density swap plus horizontal dispersion of 2–6 cells per tick by viscosity. No pressure solver; "communicating vessels" is faked by letting a blocked liquid cell under a column of at least 3 hop sideways and up with low probability.
- **Gases:** the same rule with inverted gravity, plus a lifetime in `ra`.
- **Temperature:** cells exchange with their coarse cell using per-element conductivity. Diffuse the coarse field with a 5-point integer stencil, half the rows per tick. Phase changes are per-element thresholds (`below → X`, `above → Y`).
- **Critters:** up to 48 agents in a side array (position, state, timer, target). They stamp CRITTER cells so grains collide, run a small state machine (wander, swim, nibble, sleep, flee), and get one grid query per tick. They never die: a hazard triggers a bubble shield and a hop away (child-safety red line).
- **Reactions:** a 64×64 `u16` LUT into `Rule {prob, out_self, out_other, heat, event_id, flags}`, with rule 0 as "none". Author it in JSON and code-generate a Rust const table with a Node script (`--check` in CI, like `lutins-wasm.mjs`). That keeps serde out of the wasm.

## 2. Software renderer
- **Resolution:** internal 2× (640×384) on low, 3× (960×576) on high, upscaled inside wasm so shading is per sub-pixel. Then one `putImageData` to an `alpha:false` canvas scaled by CSS: `pixelated` at integer ratios, smooth otherwise.
- **Pass order:**
  1. Background: procedural, baked once per world into two parallax layers and re-baked on resize. Sky gradients get 4×4 Bayer dithering.
  2. Cells: palette LUT `[species][shade][light]`. Light comes from per-column buried and depth counters (as today) plus top-left bevel bits from a 4-neighbour mask. Powders stay crisp; liquids and gases get corners rounded by a self-written EPX-style rule.
  3. Liquids: alpha over the background, depth tint, a 1-pixel bright surface line, and a sine-LUT refraction offset on the background sample.
  4. Glow: emissive buffer at ¼ resolution, two separable box-blur passes, saturating add. Lava and fire colour comes from a temperature→colour LUT.
  5. Particle overlay: up to 512 sparks, bubbles and sparkles, outside the grid.
- **Quality tiers:** low = 2×, single glow pass, no refraction. High = 3×, everything. Rescue (measured over 12 ms) = 1× with CSS smoothing and a 30 Hz sim. Reduced motion freezes shimmer, sway and parallax.
- **SIMD:** start scalar. `simd128` needs Chrome 91, Firefox 89 or Safari 16.4, so iPads stuck on iPadOS 15 lack it. If benchmarks justify it, add a second binary for blur, blend and upscale only, chosen by `WebAssembly.validate`. The sim is branchy and gains nothing.
- **Threads: no.** `SharedArrayBuffer` needs COOP/COEP isolation (a risk for the Tauri WebViews and embeds), parallel chunks threaten determinism, 4-core phones have two fast cores, and the load is under 8 ms single-threaded.
- **WebGL post-pass:** optional, last stage, high tier only (bilinear + bloom). It is a second path to test (the white-veil lesson), so pure CPU must stay complete.

## 3. Boundary
- **Engine:** one `Engine` with numeric exports only (no strings or JSON). Everything is pre-allocated at init with 16 MB fixed memory, so views never detach; still re-check `buffer` identity.
- **Exports:** `frame_ptr/len`, `cmd_ptr` (a 4 KB buffer JS fills with `[op, element, x0, y0, x1, y1, r]`; Rust rasterises the strokes), `step(n)`, `render(t_ms, tier)`, `events_ptr/len` (packed `u32 kind|x|y`, one per kind per tick as today), `save_ptr/len`, `load`, `hash()`.
- **Loop:** rAF with an accumulator, at most 2 steps per frame, render once, pause when hidden.
- **Memory:** cells 0.25 MB, frame 2.2 MB, backgrounds 4.4 MB, the rest under 1 MB.
- **Wasm size:** target ≤ 150 KB raw, ≤ 60 KB gzip, lazy-loaded on the route.
- **Save:** header (magic, version, world, tick, rng) + RLE cells, about 5–30 KB, in IndexedDB. Species ids are never renumbered.

## 4. Perf budget (estimates)
| Tier | Grid | Internal | Step | Render | Blit | Total |
|---|---|---|---|---|---|---|
| Low (≤4 cores) | 320×192 | 640×384 | ≤2.5 ms | ≤3.5 ms | ≤1 ms | ≤7 ms |
| High | 320×192 | 960×576 | ≤1.5 ms | ≤5 ms | ≤1.5 ms | ≤8 ms |
| Rescue | 320×192 @30 Hz | 320×192 | ≤2.5 ms | ≤1.5 ms | ≤0.5 ms | ≤5 ms |

- **Node:** `scripts/sandbox-bench.mjs` runs five canned scenes (idle, pour, ocean, firestorm, all-active worst case) for 600 ticks and reports p50/p95 for step and render. CI gates on the ratio to a calibration loop, not absolute ms (the overloaded-sandbox lesson).
- **Browser:** a `?bench=1` overlay, driven by Playwright with 4× CDP CPU throttling on the low path and `hardwareConcurrency` forced to 8 on the high path.

## 5. Testing
- **Determinism:** `hash()` after N ticks of scripted input per world, compared between native `cargo test` and wasm in Node.
- **Reactions:** one table-driven unit test per rule on a 3×3 arena.
- **Invariants:** mass conservation for inert elements, critter count never drops.
- **Golden frames:** per world and tier at fixed `t`, with tolerance (mean ΔE plus a cap on differing pixels).
- **Fuzzing:** random commands with out-of-range coordinates and species, and garbage `load` bytes. Tests keep debug assertions and bounds checks on; no `unsafe` indexing in the sim.
- **Port parity:** the existing `sim.test.ts` scenarios are ported as behaviour tests.

## 6. Pitfalls
1. Scan-order bias (piles lean, liquids drift): use the clock stamp and 4-phase scans.
2. Double moves or teleporting across chunk borders: stamp on write and wake neighbours.
3. Sleeping chunks that never wake (floating sand): wake on any adjacent write or temperature change.
4. Liquids that never level, or flicker forever: use dispersion, and settle to sleep when no net move happens.
5. Detached `ArrayBuffer` after `memory.grow`: fixed memory.
6. Float or `HashMap` nondeterminism: integers and LUTs.
7. Per-cell JS↔wasm calls or JSON events: batch through buffers.
8. Gas and fire runaway filling the grid: lifetimes, per-chunk emitter caps, heat clamps.

## 7. Stages (each shippable)
1. Rust port of today's 13 elements behind a flag, zero-copy frame, hashes, benchmark; parity with the TS game.
2. Chunks and sleeping, data-driven table, 25 elements, temperature, liquids and gases v2, save/load.
3. Renderer v2: 2×/3× shading, liquids, glow, backgrounds, tiers.
4. Eight worlds (Moon, undersea, space gravity plane), critters, 40+ elements, 45+ reactions.
5. Polish: particles, optional SIMD binary, optional WebGL pass, fuzz hardening; delete the TS sim.

Sources: [Sandspiel repo](https://github.com/MaxBittker/sandspiel), [Sandspiel `lib.rs`](https://raw.githubusercontent.com/MaxBittker/sandspiel/master/crate/src/lib.rs)
