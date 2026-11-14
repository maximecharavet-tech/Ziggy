//! Behaviour tests ported from the TypeScript sandbox (src/games2d/sandbox/sim.test.ts), plus the new engine's
//! guarantees: calm scenes in every world and orientation, determinism, save/load, chunks that sleep, fuzzing.

use sandbox_core::gen::*;
use sandbox_core::render::{Renderer, REDUCED_MOTION};
use sandbox_core::sim::*;
use sandbox_core::table::*;

fn boxed(w: usize, h: usize, seed: u32) -> World {
    let mut s = World::new(w, h, seed, GARDEN);
    for x in 0..w as i32 {
        s.set(x, h as i32 - 1, STONE);
    }
    s
}

fn steps(s: &mut World, n: u32) {
    for _ in 0..n {
        s.step();
    }
}

/// Steps until `kind` is reported (or `max` steps); the number of steps, or None.
fn until(s: &mut World, kind: u8, max: u32) -> Option<u32> {
    for k in 1..=max {
        s.step();
        let hit = s.events.iter().any(|&e| (e & 127) as u8 == kind);
        s.take_events();
        if hit {
            return Some(k);
        }
    }
    None
}

#[test]
fn sand_falls_and_piles_up_never_through_stone() {
    let mut s = boxed(40, 30, 7);
    s.set(20, 2, SAND);
    steps(&mut s, 60);
    assert_eq!(s.get(20, 28), SAND);
    assert_eq!(s.count(SAND), 1);
    for y in 0..15 {
        s.set(10, y, SAND);
    }
    steps(&mut s, 300);
    let wide = (0..40).filter(|&x| s.get(x, 28) == SAND).count();
    assert!(wide > 4, "the column did not spread into a heap ({wide})");
    assert_eq!(s.count(SAND), 16);
}

#[test]
fn water_spreads_flat_along_the_floor() {
    let mut s = boxed(60, 20, 7);
    for y in 0..10 {
        for x in 28..32 {
            s.set(x, y, WATER);
        }
    }
    steps(&mut s, 600);
    assert_eq!(s.count(WATER), 40);
    for x in 0..60 {
        assert_ne!(s.get(x, 17), WATER, "water piled up at x={x}");
    }
    assert_eq!((0..60).filter(|&x| s.get(x, 18) == WATER).count(), 40);
}

#[test]
fn sand_sinks_through_water_and_says_so() {
    let mut s = boxed(40, 30, 7);
    for y in 20..29 {
        s.set(14, y, STONE);
        s.set(25, y, STONE);
        for x in 15..25 {
            s.set(x, y, WATER);
        }
    }
    s.set(20, 5, SAND);
    assert!(until(&mut s, R_SINK, 400).is_some());
    steps(&mut s, 400);
    assert!((15..25).any(|x| s.get(x, 28) == SAND));
}

#[test]
fn steam_rises_and_becomes_a_cloud() {
    let mut s = boxed(40, 30, 7);
    s.set(20, 25, STEAM);
    assert!(until(&mut s, R_CONDENSE, 2000).is_some());
    assert!(s.count(CLOUD) > 0);
}

#[test]
fn a_cloud_rains_then_fades_away() {
    let mut s = boxed(40, 30, 7);
    s.set(20, 3, CLOUD);
    s.set_state(20, 3, 3, 0, false);
    assert!(until(&mut s, R_RAIN, 2000).is_some());
    steps(&mut s, 12000);
    assert_eq!(s.count(CLOUD), 0);
    assert!(s.count(WATER) >= 3);
}

#[test]
fn bubbles_rise_through_water_and_pop_in_the_air() {
    let mut s = boxed(40, 30, 7);
    for y in 15..29 {
        s.set(14, y, STONE);
        s.set(26, y, STONE);
        for x in 15..26 {
            s.set(x, y, WATER);
        }
    }
    s.set(20, 28, BUBBLE);
    assert!(until(&mut s, R_BUBBLE, 50).is_some());
    steps(&mut s, 600);
    assert_eq!(s.count(BUBBLE), 0);
}

#[test]
fn snow_falls_slowly_and_piles_up() {
    let mut s = boxed(40, 30, 7);
    s.set(20, 2, SNOW);
    steps(&mut s, 20);
    assert_ne!(s.get(20, 28), SNOW, "snow fell as fast as sand");
    steps(&mut s, 400);
    assert_eq!(s.count(SNOW), 1);
    assert!((0..40).any(|x| s.get(x, 28) == SNOW));
}

#[test]
fn the_wind_blows_sand_sideways() {
    let mut s = boxed(60, 30, 7);
    for y in 24..29 {
        for x in 20..26 {
            s.set(x, y, SAND);
        }
    }
    for _ in 0..80 {
        s.wind(23.0, 26.0, 6.0, 1);
        s.step();
    }
    assert!(s.counts[R_WIND as usize] > 0);
    assert!((30..60).any(|x| (0..29).any(|y| s.get(x, y) == SAND)), "nothing was blown right");
    assert_eq!(s.count(SAND), 30);
}

#[test]
fn painting_fills_only_empty_cells_and_the_eraser_clears() {
    let mut s = boxed(40, 30, 7);
    for x in 10..20 {
        s.set(x, 20, STONE);
    }
    s.paint(15.0, 20.0, 4.0, SAND, 0);
    for x in 10..20 {
        assert_eq!(s.get(x, 20), STONE, "painting destroyed the wall");
    }
    s.paint(15.0, 20.0, 4.0, STONE, 0);
    assert!(s.count(STONE) > 50);
    s.paint(15.0, 20.0, 6.0, EMPTY, 0);
    assert_eq!(s.get(15, 20), EMPTY);
    // A wall painted into water is solid (no porous walls under water).
    let mut s = boxed(40, 30, 7);
    for y in 10..29 {
        for x in 0..40 {
            s.set(x, y, WATER);
        }
    }
    s.paint(20.0, 20.0, 3.0, STONE, 0);
    s.paint(20.0, 20.0, 3.0, STONE, 0);
    s.paint(20.0, 20.0, 3.0, STONE, 0);
    s.paint(20.0, 20.0, 3.0, STONE, 0);
    assert!((18..=22).all(|x| s.get(x, 20) == STONE));
}

#[test]
fn seed_and_water_make_a_plant_which_grows() {
    let mut s = boxed(40, 30, 7);
    for x in 15..26 {
        s.set(x, 28, WATER);
    }
    s.set(14, 28, STONE);
    s.set(26, 28, STONE);
    s.set(20, 20, SEED);
    assert!(until(&mut s, R_SPROUT, 400).is_some());
    steps(&mut s, 2000);
    assert!(s.count(PLANT) >= 5, "the plant did not grow ({})", s.count(PLANT));
}

#[test]
fn plant_light_and_water_make_a_flower_but_not_in_the_dark() {
    let mk = |roof: bool| {
        let mut s = boxed(40, 40, 7);
        for y in 35..39 {
            s.set(13, y, STONE);
            s.set(27, y, STONE);
        }
        for y in 36..39 {
            for x in 14..27 {
                s.set(x, y, WATER);
            }
        }
        if roof {
            for x in 0..40 {
                s.set(x, 4, STONE);
            }
        }
        s.set(20, 30, SEED);
        s
    };
    let mut lit = mk(false);
    assert!(until(&mut lit, R_BLOOM, 9000).is_some());
    let mut dark = mk(true);
    assert!(until(&mut dark, R_BLOOM, 6000).is_none(), "a flower opened in the dark");
    // A sun lamp brings the light.
    for y in 5..30 {
        for x in 0..40 {
            if dark.get(x, y) == PLANT && (x == 0 || dark.get(x - 1, y) == EMPTY) {
                let i = y as usize * dark.w + x as usize;
                if cb(dark.cells[i]) & TIP != 0 {
                    dark.set(x - 2, y, HEAT);
                }
            }
        }
    }
    assert!(until(&mut dark, R_BLOOM, 6000).is_some());
}

#[test]
fn ice_snow_and_water_change_with_warmth() {
    let mut s = boxed(40, 30, 7);
    for x in 10..14 {
        s.set(x, 28, ICE);
    }
    s.set(15, 27, HEAT);
    assert!(until(&mut s, R_MELT_ICE, 2000).is_some());
    let mut s = boxed(40, 30, 7);
    for x in 10..14 {
        s.set(x, 28, SNOW);
    }
    s.set(15, 27, HEAT);
    assert!(until(&mut s, R_MELT_SNOW, 2000).is_some());
    // The whole water cycle: evaporate, condense, rain.
    let mut s = boxed(40, 30, 7);
    for y in 25..29 {
        s.set(9, y, STONE);
        s.set(31, y, STONE);
        for x in 10..31 {
            s.set(x, y, WATER);
        }
    }
    for x in 18..22 {
        s.set(x, 24, HEAT);
    }
    assert!(until(&mut s, R_EVAPORATE, 2000).is_some());
    assert!(until(&mut s, R_CONDENSE, 4000).is_some());
    assert!(until(&mut s, R_RAIN, 12000).is_some());
}

#[test]
fn events_are_reported_once_per_kind_per_tick_but_all_are_counted() {
    let mut s = boxed(60, 30, 7);
    for x in 5..55 {
        s.set(x, 28, ICE);
        if x % 2 == 0 {
            s.set(x, 27, HEAT);
        }
    }
    let mut reported = 0;
    for _ in 0..300 {
        s.step();
        let n = s.events.iter().filter(|&&e| (e & 127) as u8 == R_MELT_ICE).count();
        assert!(n <= 1);
        reported += n as u32;
        s.take_events();
    }
    assert!(s.counts[R_MELT_ICE as usize] > reported, "counts must be exact, not deduplicated");
}

#[test]
fn the_same_seed_and_gestures_give_the_same_world() {
    let run = || {
        let mut s = World::new(200, 120, 42, VOLCANO);
        s.load_scene();
        for k in 0..400 {
            if k % 7 == 0 {
                s.paint_line(
                    20.0 + (k % 60) as f32,
                    10.0,
                    40.0,
                    30.0,
                    3.0,
                    [SAND, WATER, LAVA, SEED][(k / 7 % 4) as usize],
                    0,
                );
            }
            if k % 50 == 0 {
                s.wind(100.0, 60.0, 8.0, 1);
            }
            s.step();
        }
        s.hash()
    };
    assert_eq!(run(), run());
    let mut a = World::new(100, 60, 1, GARDEN);
    let mut b = World::new(100, 60, 2, GARDEN);
    a.load_scene();
    b.load_scene();
    assert_ne!(a.hash(), b.hash(), "the hash must see the random state");
}

#[test]
fn every_world_has_a_calm_starting_scene_in_both_orientations() {
    for world in 0..WORLD_COUNT {
        for (w, h) in [(320, 192), (192, 320)] {
            let mut s = World::new(w, h, 11, world);
            s.load_scene();
            let filled = s.cells.iter().filter(|&&c| c != 0).count();
            assert!(
                filled > w * h / if world == SPACE { 120 } else { 30 },
                "world {world} {w}x{h}: scene almost empty ({filled})"
            );
            assert_eq!(s.critters.len(), 1, "world {world}: one resident");
            let before = s.counts;
            steps(&mut s, 600);
            let reacted: Vec<usize> = (0..REACTION_COUNT).filter(|&k| s.counts[k] != before[k]).collect();
            // The space planet gathers nothing by itself either; the critter is no cause of discoveries.
            assert!(reacted.is_empty(), "world {world} {w}x{h}: reacted by itself: {reacted:?}");
            let c = s.critters[0];
            assert!(s.inside(c.x >> 4, c.y >> 4), "world {world}: the critter left the world");
        }
    }
}

#[test]
fn calm_scenes_fall_asleep() {
    for world in [GARDEN, MOUNTAIN, MOON, MARS] {
        let mut s = World::new(320, 192, 3, world);
        s.load_scene();
        steps(&mut s, 400);
        // Only the chunk of the critter (and its neighbours) may stay busy.
        assert!(s.awake_chunks() <= 12, "world {world}: {} chunks awake out of {}", s.awake_chunks(), s.cw * s.ch);
    }
}

#[test]
fn critters_are_never_buried_or_lost() {
    for world in 0..WORLD_COUNT {
        let mut s = World::new(200, 120, 9, world);
        s.load_scene();
        for k in 0..600 {
            let c = s.critters[0];
            if k % 3 == 0 {
                s.paint(
                    (c.x >> 4) as f32,
                    ((c.y >> 4) - 6) as f32,
                    4.0,
                    [SAND, STONE, LAVA, WATER][(k / 3 % 4) as usize],
                    0,
                );
            }
            s.step();
        }
        assert_eq!(s.critters.len(), 1);
        let c = s.critters[0];
        assert!(s.inside(c.x >> 4, c.y >> 4), "world {world}");
    }
}

#[test]
fn a_creation_saves_and_restores_exactly() {
    for world in 0..WORLD_COUNT {
        let mut s = World::new(192, 320, 5, world);
        s.load_scene();
        s.paint_line(30.0, 30.0, 150.0, 60.0, 4.0, SAND, 0);
        s.stamp_critter(60, 60);
        s.drop_parcel(90, 40);
        steps(&mut s, 120);
        let mut bytes = Vec::new();
        s.save(&mut bytes);
        assert!(bytes.len() < 60_000, "world {world}: save of {} bytes", bytes.len());
        let mut t = World::new(192, 320, 999, world);
        assert!(t.load(&bytes), "world {world}: load refused");
        assert_eq!(t.cells, s.cells);
        assert_eq!(t.aux, s.aux);
        assert_eq!(t.critters.len(), s.critters.len());
        // A save of another world or size is refused and changes nothing.
        let mut other = World::new(192, 320, 1, (world + 1) % WORLD_COUNT);
        other.load_scene();
        let h = other.hash();
        assert!(!other.load(&bytes));
        assert_eq!(other.hash(), h);
        let mut small = World::new(100, 100, 1, world);
        assert!(!small.load(&bytes));
    }
}

#[test]
fn garbage_saves_and_wild_gestures_never_break_anything() {
    let mut s = World::new(160, 96, 1, SPACE);
    s.load_scene();
    let mut rng = 12345u32;
    let mut next = || {
        rng ^= rng << 13;
        rng ^= rng >> 17;
        rng ^= rng << 5;
        rng
    };
    for _ in 0..300 {
        let n = (next() % 300) as usize;
        let mut junk: Vec<u8> = (0..n).map(|_| next() as u8).collect();
        if next() & 1 == 0 && junk.len() > 4 {
            junk[..4].copy_from_slice(b"ZSB2");
        }
        assert!(!s.load(&junk));
    }
    let mut good = Vec::new();
    s.save(&mut good);
    for k in 0..good.len().min(400) {
        let mut bad = good.clone();
        bad[k] ^= 0x5a;
        assert!(!s.load(&bad), "a corrupted save was accepted (byte {k})");
    }
    let mut r = Renderer::new(s.w, s.h);
    for k in 0..400 {
        let f = |v: u32| (v % 900) as f32 - 300.0;
        let vals = [f32::NAN, f32::INFINITY, -1e9, 1e9];
        let x = if k % 37 == 0 { vals[(k / 37) % 4] } else { f(next()) };
        s.paint_line(x, f(next()), f(next()), f(next()), (next() % 40) as f32 - 5.0, (next() % 80) as u8, next() as u8);
        s.wind(f(next()), f(next()), (next() % 30) as f32, (next() % 3) as i32 - 1);
        s.beam(f(next()), f(next()), f(next()), f(next()), (next() % 30) as f32);
        s.stamp_critter(next() as i32 % 400, next() as i32 % 400);
        s.place_gift(next() % 12, next() as i32 % 400, next() as i32 % 400);
        s.set_gravity(next() % 400);
        s.set_temp_offset(next() as i32 % 200);
        s.step();
        if k % 50 == 0 {
            r.set_quality(1 + (k / 50) % 3, k % 100 == 0);
            r.render(&mut s, k as f64 * 16.0, (k % 2) as u32 * REDUCED_MOTION);
        }
    }
    assert!(s.critters.len() <= sandbox_core::critters::MAX_CRITTERS);
}

#[test]
fn every_world_renders_at_every_tier() {
    for world in 0..WORLD_COUNT {
        let mut s = World::new(320, 192, 4, world);
        s.load_scene();
        for night in [false, true] {
            s.set_night(night);
            for scale in 1..=3 {
                let mut r = Renderer::new(s.w, s.h);
                r.set_quality(scale, scale == 3);
                r.render(&mut s, 1000.0, 0);
                let n = r.fw * r.fh;
                assert_eq!(n, 320 * 192 * scale * scale);
                let px = &r.frame[..n];
                assert!(px.iter().all(|&p| p >> 24 == 0xff), "opaque frame");
                // Not a flat picture, and not blown out to white (the white-veil lesson).
                let white = px.iter().filter(|&&p| p & 0xffffff == 0xffffff).count();
                assert!(white < n / 8, "world {world} night {night} scale {scale}: {white} white pixels");
                let first = px[0];
                assert!(px.iter().filter(|&&p| p != first).count() > n / 4);
            }
        }
    }
}

#[test]
fn reduced_motion_freezes_the_picture() {
    let mut s = World::new(200, 120, 4, UNDERSEA);
    s.load_scene();
    let mut r = Renderer::new(s.w, s.h);
    r.render(&mut s, 1000.0, REDUCED_MOTION);
    let a = r.frame[..r.fw * r.fh].to_vec();
    r.render(&mut s, 5000.0, REDUCED_MOTION);
    assert_eq!(a, r.frame[..r.fw * r.fh].to_vec(), "something shimmered under reduced motion");
}

#[test]
fn ids_match_the_page() {
    // The page reads the same generated list (src/games2d/sandbox/wasm/ids.ts); the 10 historical ids keep their place.
    let ts = include_str!("../../../src/games2d/sandbox/wasm/ids.ts");
    for (k, id) in
        ["sprout", "melt_ice", "melt_snow", "evaporate", "condense", "rain", "bloom", "sink", "bubble", "wind"]
            .iter()
            .enumerate()
    {
        assert!(ts.contains(&format!("'{id}'")));
        let pos: Vec<&str> = ts
            .split("REACTIONS = [")
            .nth(1)
            .unwrap()
            .split(']')
            .next()
            .unwrap()
            .split(',')
            .map(|s| s.trim().trim_matches('\''))
            .collect();
        assert_eq!(pos[k], *id);
    }
    const { assert!(ELEMENT_COUNT >= 35) };
    const { assert!(REACTION_COUNT >= 60) };
}

/// The same scripted run as `src/games2d/sandbox/engine.test.ts`: the WebAssembly build must reach this exact hash.
pub fn scripted_hash() -> u32 {
    let mut s = World::new(200, 120, 42, VOLCANO);
    s.load_scene();
    for k in 0..300u32 {
        if k % 7 == 0 {
            s.paint_line(20.0 + (k % 60) as f32, 10.0, 40.0, 30.0, 3.0, [SAND, WATER, LAVA, SEED][(k / 7 % 4) as usize], 0);
        }
        if k % 50 == 0 {
            s.wind(100.0, 60.0, 8.0, 1);
        }
        s.step();
    }
    s.hash()
}

#[test]
fn native_hash_of_the_scripted_run() {
    // Printed so the wasm test can be checked against it: cargo test native_hash -- --nocapture
    let h = scripted_hash();
    println!("scripted hash: {h}");
    assert_eq!(h, scripted_hash());
    assert_eq!(h, 539_179_940, "the simulation changed: update the constant here and in engine.test.ts");
}
