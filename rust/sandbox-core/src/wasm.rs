//! The WebAssembly interface: one `Sandbox` handle with coarse, numeric-only
//! calls. The picture, the events and the save bytes are read straight from
//! the wasm memory (pointer + length), never copied through JSON.

use crate::gen::REACTION_COUNT;
use crate::render::Renderer;
use crate::sim::World;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Sandbox {
    world: World,
    renderer: Renderer,
    io: Vec<u8>,
}

#[wasm_bindgen]
impl Sandbox {
    /// A world of `w` × `h` cells (at most 320 each way). `world_id`: 0 garden, 1 mountain, 2 islands, 3 volcano, 4 undersea, 5 space, 6 moon, 7 mars.
    #[wasm_bindgen(constructor)]
    pub fn new(w: u32, h: u32, seed: u32, world_id: u32) -> Sandbox {
        let world = World::new(w as usize, h as usize, seed, world_id.min(255) as u8);
        let renderer = Renderer::new(world.w, world.h);
        Sandbox { world, renderer, io: Vec::with_capacity(1 << 19) }
    }

    pub fn width(&self) -> u32 {
        self.world.w as u32
    }
    pub fn height(&self) -> u32 {
        self.world.h as u32
    }
    pub fn world_id(&self) -> u32 {
        self.world.world as u32
    }

    pub fn load_scene(&mut self) {
        self.world.load_scene();
    }
    pub fn clear(&mut self) {
        self.world.clear();
    }

    /// Advances the world by `n` ticks (at most 8 per call).
    pub fn step(&mut self, n: u32) {
        for _ in 0..n.min(8) {
            self.world.step();
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn paint_line(&mut self, x0: f32, y0: f32, x1: f32, y1: f32, r: f32, element: u32, variant: u32) {
        self.world.paint_line(x0, y0, x1, y1, r, element.min(255) as u8, variant.min(255) as u8);
    }
    pub fn wind(&mut self, x: f32, y: f32, r: f32, dir: i32) {
        self.world.wind(x, y, r, dir);
    }
    pub fn beam(&mut self, x0: f32, y0: f32, x1: f32, y1: f32, r: f32) {
        self.world.beam(x0, y0, x1, y1, r);
    }
    pub fn stamp_critter(&mut self, x: i32, y: i32) -> u32 {
        self.world.stamp_critter(x, y)
    }
    pub fn hatch_baby(&mut self, x: i32, y: i32) {
        self.world.hatch_baby(x, y);
    }
    pub fn drop_parcel(&mut self, x: i32, y: i32) -> bool {
        self.world.drop_parcel(x, y)
    }
    pub fn place_gift(&mut self, kind: u32, x: i32, y: i32) {
        self.world.place_gift(kind, x, y);
    }
    /// 0 no parcel, 1 falling, 2 landed, 3 opening.
    pub fn parcel_state(&self) -> u32 {
        self.world.parcel.state as u32
    }
    pub fn parcel_x(&self) -> f32 {
        self.world.parcel.x as f32 / 16.0
    }
    pub fn parcel_y(&self) -> f32 {
        self.world.parcel.y as f32 / 16.0
    }
    /// Where the finger is, in cells (negative: away). Faces look at it, babies follow it, the backdrop leans.
    pub fn set_pointer(&mut self, x: f32, y: f32) {
        let ok = x.is_finite() && y.is_finite() && x >= 0.0 && y >= 0.0;
        self.renderer.pointer = if ok { (x.min(400.0), y.min(400.0)) } else { (-1.0, -1.0) };
        self.world.pointer = if ok { (x.min(400.0) as i32, y.min(400.0) as i32) } else { (-1, -1) };
    }

    pub fn set_night(&mut self, night: bool) {
        self.world.set_night(night);
    }
    pub fn set_gravity(&mut self, percent: u32) {
        self.world.set_gravity(percent);
    }
    pub fn set_temperature(&mut self, offset: i32) {
        self.world.set_temp_offset(offset);
    }

    /// Frame pixels per cell (1 rescue, 2 low tier, 3 high tier) and the extra effects of the high tier.
    pub fn set_quality(&mut self, scale: u32, high: bool) {
        self.renderer.set_quality(scale as usize, high);
    }
    /// Draws the world. `flags` bit 0: reduced motion.
    pub fn render(&mut self, t_ms: f64, flags: u32) {
        self.renderer.render(&mut self.world, t_ms, flags);
    }
    pub fn frame_ptr(&self) -> *const u32 {
        self.renderer.frame.as_ptr()
    }
    pub fn frame_width(&self) -> u32 {
        (self.world.w * self.renderer.scale) as u32
    }
    pub fn frame_height(&self) -> u32 {
        (self.world.h * self.renderer.scale) as u32
    }
    /// A burst of sparkles at a cell.
    pub fn burst(&mut self, x: f32, y: f32, rgb: u32, n: u32) {
        if x.is_finite() && y.is_finite() {
            self.renderer.burst(x, y, rgb, n.min(60));
        }
    }

    /// Reactions since the last `take_events`: one `u32` each, kind | x << 7 | y << 16.
    pub fn events_ptr(&self) -> *const u32 {
        self.world.events.as_ptr()
    }
    pub fn events_len(&self) -> u32 {
        self.world.events.len() as u32
    }
    pub fn take_events(&mut self) {
        self.world.take_events();
    }
    /// Exact number of times each reaction happened in this world (one `u32` per reaction).
    pub fn counts_ptr(&self) -> *const u32 {
        self.world.counts.as_ptr()
    }
    pub fn counts_len(&self) -> u32 {
        REACTION_COUNT as u32
    }

    /// Serialises the world; read `io_len` bytes at `io_ptr`.
    pub fn save(&mut self) -> u32 {
        let mut io = std::mem::take(&mut self.io);
        self.world.save(&mut io);
        self.io = io;
        self.io.len() as u32
    }
    /// Makes room for `len` bytes at `io_ptr` (write a save there, then call `load`).
    pub fn io_reserve(&mut self, len: u32) -> *mut u8 {
        self.io.clear();
        self.io.resize((len as usize).min(1 << 21), 0);
        self.io.as_mut_ptr()
    }
    pub fn io_ptr(&self) -> *const u8 {
        self.io.as_ptr()
    }
    /// Restores the world from the bytes at `io_ptr`. False (and nothing changed) if they are not a save of this world.
    pub fn load(&mut self) -> bool {
        let io = std::mem::take(&mut self.io);
        let ok = self.world.load(&io);
        self.io = io;
        ok
    }

    pub fn hash(&self) -> u32 {
        self.world.hash()
    }
    pub fn tick(&self) -> u32 {
        self.world.tick
    }
    pub fn count(&self, element: u32) -> u32 {
        self.world.count(element.min(255) as u8)
    }
    pub fn get(&self, x: i32, y: i32) -> u32 {
        self.world.get(x, y) as u32
    }
    pub fn set(&mut self, x: i32, y: i32, element: u32) {
        self.world.set(x, y, element.min(255) as u8);
    }
    pub fn awake_chunks(&self) -> u32 {
        self.world.awake_chunks()
    }
    pub fn critter_count(&self) -> u32 {
        self.world.critters.len() as u32
    }
    pub fn critter_x(&self, k: u32) -> f32 {
        self.world.critters.get(k as usize).map_or(-1.0, |c| c.x as f32 / 16.0)
    }
    pub fn critter_y(&self, k: u32) -> f32 {
        self.world.critters.get(k as usize).map_or(-1.0, |c| c.y as f32 / 16.0)
    }
}
