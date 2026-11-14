# Bac à sable magique — rebuild status

Brief: `docs/SANDBOX_REBUILD.md` (with Addenda 2 "no GPU" and 3 "saucer + parcel"). Refresh this file after every stage.

## Done
- Data file `rust/sandbox-core/data/sandbox.json` (49 elements, 81 reaction ids) + generator in
  `scripts/sandbox-wasm.mjs` (`--gen`, `--check`) → `rust/sandbox-core/src/gen.rs`, `src/games2d/sandbox/wasm/ids.ts`.
- Rust engine written (not yet compiled clean / tested): `sim.rs` (cells, chunks, 4-phase scan, temperature,
  radial gravity), `species.rs` (all special elements), `tools.rs` (paint, wind, save/load), `scenes.rs`
  (8 worlds), `critters.rs`, `parcel.rs` (parcel, beam, gifts), `render.rs` + `backdrop.rs` (software renderer),
  `wasm.rs` (API).

## In progress
- Getting the crate to compile, then `tests/` (behaviour, one per reaction, determinism, fuzz, calm scenes).

## Next
1. `npm run sandbox:wasm`, loader `src/games2d/sandbox/engine.ts`, `scripts/sandbox-bench.mjs`.
2. React side: `content.ts` (worlds, tools, 81 discoveries FR+EN), `SandCanvas`, `Toolbar`, `Notebook`,
   storage v2 + migration test, album (IndexedDB), sounds, saucer + parcel UI. Imports from `motion/react`.
3. Delete the old TS sim (`sim.ts`, `render.ts`, `scenes.ts`, `sim.test.ts`, `components/sandbox/shading.ts`).
4. Verify: cargo test/clippy/fmt, `sandbox:wasm --check`, `npm run check`, build on 3510, Playwright all worlds.

## How to resume
`cd rust/sandbox-core && cargo build` and fix what it says; the game page still runs on the old TS sim until step 2.
