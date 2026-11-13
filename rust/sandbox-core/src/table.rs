//! The shapes of the generated tables (`gen.rs`) and the eight worlds.

/// "No element" / "no reaction" in the tables.
pub const NONE: u8 = 255;

/// One row of the element table (see `data/sandbox.json` for the meaning of each column).
pub struct Element {
    pub kind: u8,
    pub density: u8,
    pub rate: u8,
    pub slide: u8,
    pub spread: u8,
    pub paint: u8,
    pub life: u8,
    pub flags: u8,
    pub style: u8,
    pub rgb: u32,
    pub rgb2: u32,
    pub glow: u32,
    pub alpha: u8,
    pub hot_at: u8,
    pub hot_to: u8,
    pub hot_ev: u8,
    pub cold_at: u8,
    pub cold_to: u8,
    pub cold_ev: u8,
    pub heat: u8,
}

/// A pair reaction: `a` next to `b` becomes `out_a` next to `out_b`, `chance` times out of 1000 per tick.
pub struct Rule {
    pub a: u8,
    pub b: u8,
    pub chance: u16,
    pub out_a: u8,
    pub out_b: u8,
    pub event: u8,
    /// The products keep the colour of the ink.
    pub hue: bool,
}

pub const WORLD_COUNT: u8 = 8;
pub const GARDEN: u8 = 0;
pub const MOUNTAIN: u8 = 1;
pub const ISLANDS: u8 = 2;
pub const VOLCANO: u8 = 3;
pub const UNDERSEA: u8 = 4;
pub const SPACE: u8 = 5;
pub const MOON: u8 = 6;
pub const MARS: u8 = 7;

pub const AIR: u8 = 0;
/// Empty cells are water (the undersea world).
pub const SEA: u8 = 1;
pub const VACUUM: u8 = 2;

/// The physics of a world.
pub struct Params {
    /// How strongly things fall, out of 255 (the Moon is slow).
    pub gravity: u8,
    pub medium: u8,
    /// Everyday temperature, 0-255 (128 is a mild day).
    pub ambient: u8,
    /// Gravity points at the gravity balls instead of down.
    pub radial: bool,
}

pub static WORLDS: [Params; WORLD_COUNT as usize] = [
    Params { gravity: 255, medium: AIR, ambient: 128, radial: false },
    Params { gravity: 255, medium: AIR, ambient: 108, radial: false },
    Params { gravity: 255, medium: AIR, ambient: 132, radial: false },
    Params { gravity: 255, medium: AIR, ambient: 134, radial: false },
    Params { gravity: 150, medium: SEA, ambient: 120, radial: false },
    Params { gravity: 200, medium: VACUUM, ambient: 90, radial: true },
    Params { gravity: 84, medium: VACUUM, ambient: 100, radial: false },
    Params { gravity: 150, medium: AIR, ambient: 78, radial: false },
];
