//! L'Usine à Créatures de Ziggy: the pure engine (recipes, Surprise lever, cross-breeding,
//! silly names, powers, moves, voice, gentle challenges, album validation, share codes,
//! reaction poses). Compiled to WebAssembly for the browser; `src/lib/creatures/core.ts`
//! falls back to a tested TypeScript twin when WebAssembly is unavailable.

pub mod album;
pub mod challenge;
pub mod creature;
pub mod data;
pub mod pose;
pub mod rng;
pub mod wasm;
