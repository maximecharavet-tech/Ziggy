//! Le Bac à sable magique (Ziggy): a falling-sand world for children, with
//! eight worlds, gentle reactions to discover and a software renderer.
//! Compiled to WebAssembly for the page; the same code runs natively in tests.

pub mod backdrop;
pub mod critters;
#[rustfmt::skip]
pub mod gen;
pub mod parcel;
pub mod render;
pub mod scenes;
pub mod sim;
pub mod species;
pub mod table;
pub mod tools;
pub mod wasm;

pub use sim::World;
