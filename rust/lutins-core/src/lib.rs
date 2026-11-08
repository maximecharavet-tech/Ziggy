//! # lutins-core
//!
//! The image engine of *Les Lutins Farceurs* (Ziggy, `docs/LUTINS.md`),
//! compiled to WebAssembly and used from TypeScript in the browser and in the
//! Next.js Node API routes (`src/lib/lutins/engine.ts`).
//!
//! | module | what |
//! |---|---|
//! | [`analysis`] | scene analysis of the room photo: brightness, contrast, colour temperature, light direction, palette, sharpness, stages for the elves |
//! | [`prompt`] | image-model prompt from the bible + scene + prank, seed, child's caption |
//! | [`verify`] | does the generated picture keep the room and show the requested elves? |
//! | [`card`] | on-device animated "magic card" (Ken Burns, snow, sparkles, glow) |
//! | [`prepare`] | photo downscale + mild auto white balance before upload |
//! | [`decode`] | PNG / JPEG / WebP decoding (server side) |
//! | [`align`] | FFT phase correlation (alignment before verification) |
//! | [`resize`], [`filters`], [`color`], [`image`], [`rng`], [`bible`] | building blocks |
//! | `wasm` | the wasm-bindgen exports |
//!
//! Inputs are RGBA8 buffers (`ImageData.data`) with their width and height;
//! structured outputs are JSON strings whose shapes are documented in
//! `src/lib/lutins/types.ts`. Everything is deterministic: same input, same
//! output, on every platform. No network, no clock, no randomness beyond
//! seeded generators.

pub mod align;
pub mod analysis;
pub mod bible;
pub mod card;
pub mod color;
#[cfg(feature = "decode")]
pub mod decode;
pub mod filters;
pub mod image;
pub mod prepare;
pub mod prompt;
pub mod resize;
pub mod rng;
pub mod verify;
mod wasm;

pub use analysis::{analyze_scene, SceneAnalysis};
pub use card::{render_card_frame, CardRenderer, CardStyle};
pub use image::{EngineError, RgbaImage, RgbaView};
pub use prepare::prepare_photo;
pub use prompt::{build_prompt, build_prompt_json, PromptInput, PromptOut};
pub use verify::{verify, Verification, VerifyRequest};
