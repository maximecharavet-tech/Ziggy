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
