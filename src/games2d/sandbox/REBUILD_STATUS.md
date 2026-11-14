# Bac à sable magique — rebuild status

Brief: `docs/SANDBOX_REBUILD.md` (with Addenda 2 "no GPU" and 3 "saucer + parcel"). Refresh this file after every stage.

## Done
- Stages 1–4 (engine side): `rust/sandbox-core` compiles, clippy/fmt clean, **28 Rust tests green**
  (`tests/behaviour.rs`: ported behaviour tests, calm scenes ×8 worlds ×2 orientations, determinism, save/load,
  fuzz, renderer tiers, reduced motion, ids; `tests/reactions.rs`: one scenario per reaction (66), Mars dome,
  parcel opening by each of the 7 exposures, parcel never lost, tractor beam).
- Data file `data/sandbox.json`: 49 elements, 81 reaction ids (66 world reactions + 15 parcel surprises).
- Software renderer (no GPU): 2×/3× tiers, burial shade + ground blotches, slope light, soft shadows, grass,
  rounded liquids with surface line/glints/refraction, glow buffer, painted backdrops per world, faces on blobs,
  big flower heads, particles, critters with squash & stretch.
- `npm run sandbox:wasm` builds `src/games2d/sandbox/wasm/` (~265 kB raw, ~94 kB gzip, no wasm-opt here).
- Loader `src/games2d/sandbox/engine.ts`; benchmark `scripts/sandbox-bench.mjs` (low tier worst case ≈ 5.3 ms).

- Stage 5 (React side, written, typechecks/lints): the page now runs on the wasm engine.
  `content.ts` (8 worlds, 47 tools, 81 discoveries FR+EN), `SandCanvas.tsx` (zero-copy frame, per-pointer strokes,
  tiers + rescue, frame time in `data-frame-ms`, throttled exact counts), `Toolbar.tsx` (6 big tools + categorised
  drawer, time dial, night, photo, album), `Notebook.tsx` (tabs per world + stickers), `WorldPicker.tsx` (zoom),
  `Saucer.tsx` (Ziggy, tap = parcel, hold = beam), `AlbumPanel.tsx` + `album.ts` (IndexedDB), `sounds.ts`,
  `storage.ts` v2 (+ v1 fixture test, World Memory balance). Old TS sim deleted.
- TS tests: `content.test.ts`, `storage.test.ts`, `engine.test.ts` (wasm hash == native 539179940).

## In progress
- Verification: `npm run check`, production build on 3510, Playwright on all worlds, screenshots.

## Next
1. Verify: `sandbox:wasm --check`, `npm run check`, build on 3510, Playwright all worlds.

## How to resume
`cd rust/sandbox-core && cargo test --release` (all green), then continue the React step above.
Node renders of every world: `node <scratchpad>/sandbox/tools/shots.mjs` (writes PNGs).
