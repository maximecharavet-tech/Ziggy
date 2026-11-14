//! One scenario per reaction: a tiny arena where the child's gesture is replayed, and the reaction must be reported.

use sandbox_core::gen::*;
use sandbox_core::parcel::*;
use sandbox_core::sim::*;
use sandbox_core::table::*;

type Act = Box<dyn FnMut(&mut World, u32)>;

fn arena(world: u8, w: usize, h: usize) -> World {
    let mut s = World::new(w, h, 7, world);
    for x in 0..w as i32 {
        s.set(x, h as i32 - 1, STONE);
    }
    s
}

fn rect(s: &mut World, x0: i32, y0: i32, x1: i32, y1: i32, t: u8) {
    for y in y0..=y1 {
        for x in x0..=x1 {
            s.set(x, y, t);
        }
    }
}

/// A stone basin between x0 and x1, `depth` cells deep, standing on the floor.
fn basin(s: &mut World, x0: i32, x1: i32, depth: i32) {
    let f = s.h as i32 - 2;
    rect(s, x0 - 1, f - depth, x0 - 1, f, STONE);
    rect(s, x1 + 1, f - depth, x1 + 1, f, STONE);
}

fn none() -> Act {
    Box::new(|_, _| {})
}

fn scenario(r: u8) -> (World, Act, u32) {
    let mut ticks = 3000;
    let mut act: Act = none();
    let mut s;
    let f = 28; // the row just above the floor of a 40×30 arena
    match r {
        R_SPROUT => {
            s = arena(GARDEN, 40, 30);
            basin(&mut s, 18, 22, 2);
            rect(&mut s, 18, f, 22, f, WATER);
            s.set(20, 20, SEED);
        }
        R_MELT_ICE => {
            s = arena(GARDEN, 40, 30);
            rect(&mut s, 10, 24, 16, f, ICE);
            rect(&mut s, 17, 26, 18, 27, HEAT);
        }
        R_MELT_SNOW => {
            s = arena(GARDEN, 40, 30);
            rect(&mut s, 10, 26, 16, f, SNOW);
            s.set(17, 27, HEAT);
        }
        R_EVAPORATE | R_CONDENSE => {
            s = arena(GARDEN, 40, 30);
            basin(&mut s, 10, 20, 3);
            rect(&mut s, 10, 26, 20, f, WATER);
            rect(&mut s, 14, 24, 16, 25, HEAT);
        }
        R_RAIN | R_RAINBOW => {
            s = arena(GARDEN, 40, 30);
            rect(&mut s, 8, 3, 30, 6, CLOUD);
            ticks = 6000;
        }
        R_BLOOM => {
            s = arena(GARDEN, 40, 40);
            basin(&mut s, 14, 26, 3);
            rect(&mut s, 14, 36, 26, 38, WATER);
            s.set(20, 30, SEED);
            ticks = 9000;
        }
        R_SINK => {
            s = arena(GARDEN, 40, 30);
            basin(&mut s, 14, 26, 6);
            rect(&mut s, 14, 23, 26, f, WATER);
            s.set(20, 5, SAND);
        }
        R_BUBBLE => {
            s = arena(GARDEN, 40, 30);
            basin(&mut s, 14, 26, 8);
            rect(&mut s, 14, 21, 26, f, WATER);
            s.set(20, f, BUBBLE);
        }
        R_WIND | R_DRIFT | R_DUST_DEVIL | R_WAVES | R_SHELL_SAND => {
            let (world, t) = match r {
                R_WIND => (GARDEN, SAND),
                R_DRIFT => (MOUNTAIN, SNOW),
                R_DUST_DEVIL => (MARS, REDDUST),
                R_WAVES => (ISLANDS, WATER),
                _ => (ISLANDS, SHELL),
            };
            s = arena(world, 40, 30);
            if r == R_WAVES {
                basin(&mut s, 5, 34, 4);
            }
            rect(&mut s, 12, 25, 22, f, t);
            act = Box::new(|s, _| s.wind(17.0, 26.0, 6.0, 1));
        }
        R_MUD => {
            s = arena(GARDEN, 40, 30);
            basin(&mut s, 10, 20, 4);
            rect(&mut s, 10, 27, 20, f, SOIL);
            rect(&mut s, 12, 26, 18, 26, WATER);
        }
        R_POLLINATE => {
            s = arena(GARDEN, 40, 30);
            s.grown_plant(20, 29, 8, 1, V_PLAIN);
            s.set(22, 20, POLLEN);
            s.set_state(22, 20, 30, 0, false);
            act = Box::new(|s, t| {
                if t < 200 && s.get(21, 18) == EMPTY {
                    s.set(21, 18, POLLEN);
                    s.set_state(21, 18, 30, 0, false);
                }
            });
        }
        R_CACTUS => {
            s = arena(GARDEN, 40, 30);
            rect(&mut s, 5, 26, 34, f, SAND);
            rect(&mut s, 19, 25, 21, 25, STONE);
            s.set(20, 25, WATER);
            s.set(20, 24, SEED);
        }
        R_REED => {
            s = arena(GARDEN, 40, 30);
            rect(&mut s, 5, 27, 34, f, MUD);
            s.set(20, 20, SEED);
        }
        R_TINT => {
            s = arena(GARDEN, 40, 30);
            basin(&mut s, 10, 20, 4);
            rect(&mut s, 10, 26, 20, f, WATER);
            s.set(15, 20, INK);
        }
        R_RECOLOR => {
            s = arena(GARDEN, 40, 30);
            s.grown_plant(20, 29, 8, 1, V_PLAIN);
            basin(&mut s, 16, 24, 2);
            rect(&mut s, 16, f, 19, f, DYED);
            rect(&mut s, 21, f, 24, f, DYED);
        }
        R_SHIMMER => {
            s = arena(GARDEN, 40, 30);
            rect(&mut s, 18, 14, 20, 16, HEAT);
            act = Box::new(|s, t| s.set(16 + (t % 7) as i32, 12 + (t % 3) as i32, BUBBLE));
        }
        R_AVALANCHE => {
            s = arena(MOUNTAIN, 40, 30);
            rect(&mut s, 20, 12, 20, f, SNOW);
        }
        R_ICICLE => {
            s = arena(MOUNTAIN, 40, 30);
            rect(&mut s, 15, 14, 24, 16, ICE);
            act = Box::new(|s, t| {
                if t < 400 {
                    s.set(15 + (t % 10) as i32, 8, WATER);
                }
            });
        }
        R_CRACK => {
            s = arena(MOUNTAIN, 40, 30);
            basin(&mut s, 15, 22, 5);
            rect(&mut s, 15, 26, 22, f, ICE);
            rect(&mut s, 15, 25, 22, 25, WATER);
        }
        R_GRIND => {
            s = arena(MOUNTAIN, 60, 30);
            rect(&mut s, 30, f, 34, f, PEBBLE);
            act = Box::new(|s, _| s.set(28, 20, WATER));
            ticks = 6000;
        }
        R_PRISM => {
            s = arena(MOUNTAIN, 40, 30);
            rect(&mut s, 20, 26, 21, f, CRYSTAL);
            s.set(18, 27, HEAT);
        }
        R_FROST => {
            s = arena(MOUNTAIN, 40, 30);
            s.grown_plant(20, 29, 8, 1, V_PLAIN);
            rect(&mut s, 16, 22, 24, 27, FOG);
        }
        R_ERODE => {
            s = arena(MOUNTAIN, 60, 30);
            rect(&mut s, 0, 27, 59, f, SAND);
            act = Box::new(|s, _| s.set(30, 20, WATER));
        }
        R_CRYSTAL_GROW => {
            s = arena(MOUNTAIN, 40, 30);
            basin(&mut s, 15, 22, 3);
            rect(&mut s, 15, 27, 22, f, WATER);
            s.set(18, f, CRYSTAL);
        }
        R_CASTLE => {
            s = arena(ISLANDS, 40, 30);
            rect(&mut s, 10, 26, 18, f, SAND);
            rect(&mut s, 19, f, 24, f, WATER);
            rect(&mut s, 25, 26, 25, f, STONE);
        }
        R_DISSOLVE => {
            s = arena(ISLANDS, 40, 30);
            basin(&mut s, 10, 20, 4);
            rect(&mut s, 10, 26, 20, f, WATER);
            s.set(15, 20, SALT);
        }
        R_SALT_CRUST => {
            s = arena(ISLANDS, 40, 30);
            basin(&mut s, 10, 20, 4);
            rect(&mut s, 10, 27, 20, f, SALTWATER);
            rect(&mut s, 14, 25, 16, 26, HEAT);
        }
        R_SALT_MELT => {
            s = arena(ISLANDS, 40, 30);
            rect(&mut s, 10, 26, 20, f, ICE);
            rect(&mut s, 12, 25, 18, 25, SALT);
        }
        R_PALM => {
            s = arena(ISLANDS, 40, 30);
            rect(&mut s, 5, 26, 34, f, SAND);
            s.set(20, 25, COCONUT);
            s.set_state(20, 25, 0, 1, false);
        }
        R_FLOAT => {
            s = arena(ISLANDS, 40, 30);
            basin(&mut s, 10, 20, 8);
            rect(&mut s, 10, 22, 20, f, WATER);
            s.set(15, f, COCONUT);
        }
        R_MELT_ROCK => {
            s = arena(VOLCANO, 40, 30);
            rect(&mut s, 10, 20, 15, f, STONE);
            rect(&mut s, 16, 20, 23, f, HEAT);
            ticks = 4000;
        }
        R_NEW_ROCK | R_GLASS | R_PLUME => {
            s = arena(VOLCANO, 40, 30);
            basin(&mut s, 10, 20, 4);
            rect(&mut s, 10, 27, 14, f, LAVA);
            rect(&mut s, 15, 27, 20, f, if r == R_NEW_ROCK { WATER } else if r == R_GLASS { SAND } else { SNOW });
        }
        R_PUMICE => {
            s = arena(VOLCANO, 40, 30);
            basin(&mut s, 10, 20, 4);
            rect(&mut s, 10, 27, 20, f, LAVA);
            act = Box::new(|s, t| s.set(10 + (t % 11) as i32, 26, BUBBLE));
        }
        R_COOL_ROCK => {
            s = arena(VOLCANO, 40, 30);
            rect(&mut s, 18, 27, 22, f, LAVA);
            ticks = 6000;
        }
        R_GIANT => {
            s = arena(VOLCANO, 40, 30);
            basin(&mut s, 18, 22, 2);
            rect(&mut s, 18, f, 22, f, ASH);
            s.set(20, 27, WATER);
            s.set(20, 26, SEED);
            rect(&mut s, 19, 27, 19, 27, STONE);
            rect(&mut s, 21, 27, 21, 27, STONE);
        }
        R_GEYSER => {
            s = arena(VOLCANO, 40, 60);
            rect(&mut s, 16, 57, 24, 58, GEYSER);
            rect(&mut s, 15, 50, 15, 58, STONE);
            rect(&mut s, 25, 50, 25, 58, STONE);
            rect(&mut s, 16, 52, 24, 56, WATER);
        }
        R_ASH_RAIN => {
            s = arena(VOLCANO, 40, 30);
            rect(&mut s, 10, 5, 30, 7, CLOUD);
            for x in 10..=30 {
                for y in 5..=7 {
                    s.set_state(x, y, 0, 0, true);
                }
            }
            act = Box::new(|s, t| {
                if t < 300 {
                    s.set(10 + (t % 20) as i32, 2, ASH);
                }
            });
            ticks = 6000;
        }
        R_CORAL_GROW => {
            s = arena(UNDERSEA, 40, 30);
            s.set(20, 20, CORAL);
            s.set_state(20, 20, 12, 1, false);
        }
        R_GLOW => {
            s = arena(UNDERSEA, 40, 30);
            rect(&mut s, 18, 14, 22, 16, PLANKTON);
            act = Box::new(|s, t| {
                if t == 20 {
                    s.paint(20.0, 12.0, 2.0, SAND, 0);
                }
            });
        }
        R_PEARL => {
            s = arena(UNDERSEA, 40, 30);
            s.set(20, f, SHELL);
            act = Box::new(|s, t| {
                if t == 30 || t == 200 {
                    s.set(20, 10, SAND);
                }
            });
        }
        R_KELP_BUBBLES => {
            s = arena(UNDERSEA, 40, 30);
            for x in [12, 16, 20, 24, 28] {
                s.set(x, 20, KELP);
                s.set_state(x, 20, 4, 0, false);
            }
            ticks = 12000;
        }
        R_VENT => {
            s = arena(UNDERSEA, 40, 30);
            rect(&mut s, 12, 27, 28, f, LAVA);
        }
        R_CONVECTION => {
            s = arena(UNDERSEA, 40, 40);
            rect(&mut s, 16, 36, 24, 38, HEAT);
            act = Box::new(|s, t| {
                if t == 150 {
                    s.paint(20.0, 33.0, 2.0, INK, 1);
                }
            });
        }
        R_BUBBLE_GROW => {
            s = arena(UNDERSEA, 40, 60);
            s.set(20, 56, BUBBLE);
        }
        R_PLANET => {
            s = arena(SPACE, 80, 80);
            rect(&mut s, 39, 39, 41, 41, GRAVITY);
            rect(&mut s, 36, 20, 44, 24, STARDUST);
        }
        R_STAR => {
            s = World::new(60, 60, 7, SPACE);
            rect(&mut s, 26, 26, 32, 32, GAS);
        }
        R_ORBIT => {
            s = World::new(100, 100, 7, SPACE);
            rect(&mut s, 49, 49, 51, 51, GRAVITY);
            s.set(40, 30, STARDUST);
            let i = 30 * s.w + 40;
            s.aux[i] = 3;
            act = Box::new(|s, t| {
                if t == 3 {
                    let i = 30 * s.w + 50;
                    s.set(50, 30, STARDUST);
                    s.aux[i] = 3;
                }
            });
        }
        R_COMET_TAIL => {
            s = World::new(100, 60, 7, SPACE);
            rect(&mut s, 60, 30, 61, 31, STAR);
            act = Box::new(|s, t| {
                if t == 5 {
                    s.paint(20.0, 12.0, 1.0, COMET, 3);
                    s.set(20, 12, COMET);
                }
            });
        }
        R_WATER_BALL => {
            s = World::new(60, 60, 7, SPACE);
            rect(&mut s, 26, 26, 31, 31, WATER);
        }
        R_MOON_BIRTH => {
            s = World::new(100, 60, 7, SPACE);
            rect(&mut s, 56, 26, 64, 34, STONE);
            rect(&mut s, 59, 29, 61, 31, GRAVITY);
            act = Box::new(|s, t| {
                if t == 12 {
                    s.set(20, 30, COMET);
                    let i = 30 * s.w + 20;
                    s.aux[i] = 3;
                }
            });
        }
        R_HABITABLE => {
            s = World::new(60, 60, 7, SPACE);
            rect(&mut s, 28, 28, 31, 31, STAR);
            rect(&mut s, 33, 28, 35, 31, ICE);
        }
        R_CRATER => {
            s = arena(MOON, 40, 40);
            rect(&mut s, 0, 32, 39, 38, MOONDUST);
            s.set(20, 8, METEORITE);
        }
        R_SLOW_FALL => {
            s = arena(MOON, 40, 40);
            s.set(20, 5, MOONDUST);
        }
        R_MOON_ICE => {
            s = arena(MOON, 40, 30);
            rect(&mut s, 14, 22, 26, 23, STONE);
            basin(&mut s, 16, 24, 3);
            rect(&mut s, 16, f, 24, f, WATER);
        }
        R_SILENT_POP => {
            s = arena(MOON, 40, 30);
            s.set(20, 20, BUBBLE);
        }
        R_SUBLIMATE => {
            s = arena(MARS, 40, 30);
            rect(&mut s, 14, 26, 20, f, DRYICE);
            rect(&mut s, 21, 26, 22, 27, HEAT);
        }
        R_HOVER => {
            s = arena(MARS, 40, 30);
            basin(&mut s, 14, 26, 6);
            rect(&mut s, 14, 24, 26, f, FOG);
            s.set(20, 18, PEBBLE);
        }
        R_MARS_GARDEN => {
            s = arena(MARS, 40, 30);
            rect(&mut s, 10, 10, 30, 10, DOME);
            basin(&mut s, 18, 22, 2);
            rect(&mut s, 18, f, 22, f, WATER);
            s.set(20, 20, SEED);
        }
        _ => panic!("no scenario for reaction {r}"),
    }
    (s, act, ticks)
}

#[test]
fn every_reaction_can_be_caused_and_is_reported() {
    let mut missing = Vec::new();
    for r in 0..R_GIFT_WATER {
        let (mut s, mut act, ticks) = scenario(r);
        let mut seen = false;
        for t in 0..ticks {
            act(&mut s, t);
            s.step();
            if s.events.iter().any(|&e| (e & 127) as u8 == r) {
                seen = true;
                break;
            }
            s.take_events();
        }
        if !seen {
            missing.push(r);
        } else {
            assert!(s.counts[r as usize] > 0);
        }
    }
    assert!(missing.is_empty(), "reactions never reported: {missing:?}");
}

#[test]
fn mars_seed_sleeps_without_a_dome() {
    let mut s = arena(MARS, 40, 30);
    basin(&mut s, 18, 22, 2);
    rect(&mut s, 18, 28, 22, 28, WATER);
    s.set(20, 20, SEED);
    for _ in 0..1500 {
        s.step();
    }
    assert_eq!(s.counts[R_SPROUT as usize], 0);
}

#[test]
fn a_single_lamp_never_melts_rock() {
    let mut s = arena(GARDEN, 40, 30);
    rect(&mut s, 10, 20, 15, 28, STONE);
    s.set(16, 24, HEAT);
    for _ in 0..3000 {
        s.step();
    }
    assert_eq!(s.count(LAVA), 0);
}

/* ── Ziggy's parcel ── */

fn open_by(world: u8, mut act: impl FnMut(&mut World, u32)) -> (u8, World) {
    let mut s = arena(world, 60, 60);
    if world == SPACE {
        s.clear();
    }
    assert!(s.drop_parcel(30, 20));
    for t in 0..4000 {
        act(&mut s, t);
        s.step();
        if s.parcel.state == P_OPEN {
            return (s.parcel.opened, s);
        }
        assert_ne!(s.parcel.state, P_NONE, "the parcel vanished");
    }
    (0, s)
}

#[test]
fn the_parcel_opens_according_to_what_the_child_does() {
    let px = |s: &World| (s.parcel.x >> 4, s.parcel.y >> 4);
    // Watered.
    let (k, s) = open_by(GARDEN, |s, t| {
        if t > 200 && t % 2 == 0 {
            let (x, y) = px(s);
            s.paint(x as f32, y as f32 - 5.0, 2.0, WATER, 0);
        }
    });
    assert_eq!(k as usize, X_WATER + 1);
    assert!(s.counts[R_GIFT_WATER as usize] == 1);
    // Warmed.
    let (k, _) = open_by(GARDEN, |s, t| {
        if t == 200 {
            let (x, y) = px(s);
            s.paint(x as f32 + 4.0, y as f32 - 3.0, 1.0, HEAT, 0);
        }
    });
    assert_eq!(k as usize, X_WARM + 1);
    // Snowed on.
    let (k, _) = open_by(MOUNTAIN, |s, t| {
        if t > 200 && t % 3 == 0 {
            let (x, y) = px(s);
            s.paint(x as f32, y as f32 - 6.0, 2.0, SNOW, 0);
        }
    });
    assert_eq!(k as usize, X_COLD + 1);
    // Buried in sand.
    let (k, _) = open_by(GARDEN, |s, t| {
        if t > 200 {
            let (x, y) = px(s);
            s.paint(x as f32, y as f32 - 8.0, 3.0, SAND, 0);
        }
    });
    assert_eq!(k as usize, X_BURIED + 1);
    // Tickled by bubbles under the sea.
    let (k, _) = open_by(UNDERSEA, |s, t| {
        if t > 100 && t % 4 == 0 {
            let (x, y) = px(s);
            s.set(x, y + 2, BUBBLE);
        }
    });
    assert_eq!(k as usize, X_BUBBLE + 1);
    // Left in the wind.
    let (k, _) = open_by(GARDEN, |s, t| {
        if t > 200 {
            let (x, y) = px(s);
            s.wind(x as f32, y as f32 - 2.0, 5.0, if (t / 40) % 2 == 0 { 1 } else { -1 });
        }
    });
    assert_eq!(k as usize, X_WIND + 1);
    // Floating where there is no gravity.
    let (k, _) = open_by(SPACE, |_, _| {});
    assert_eq!(k as usize, X_LOWG + 1);
}

#[test]
fn the_parcel_waits_quietly_and_is_never_lost() {
    // Nothing done to it: it lands and stays, closed, in every world with a ground.
    for world in [GARDEN, MOUNTAIN, ISLANDS, VOLCANO, MARS] {
        let mut s = World::new(320, 192, 5, world);
        s.load_scene();
        assert!(s.drop_parcel(160, 20));
        for _ in 0..3000 {
            s.step();
        }
        assert!(s.parcel.state == P_LANDED || s.parcel.state == P_FALLING, "world {world}: state {}", s.parcel.state);
        assert!(s.inside(s.parcel.x >> 4, s.parcel.y >> 4));
        assert!(!s.drop_parcel(10, 10), "one parcel at a time");
    }
    // Walled in with stone, it pops out on top; thrown outside, it comes back.
    let mut s = arena(GARDEN, 60, 60);
    s.drop_parcel(30, 50);
    rect(&mut s, 24, 40, 36, 58, STONE);
    for _ in 0..200 {
        s.step();
    }
    assert!((s.parcel.y >> 4) < 40, "still inside the stone at y={}", s.parcel.y >> 4);
    s.parcel.x = -5000;
    s.parcel.y = 90000;
    s.step();
    assert!(s.inside(s.parcel.x >> 4, s.parcel.y >> 4));
}

#[test]
fn the_tractor_beam_carries_sand_and_critters() {
    let mut s = arena(GARDEN, 80, 60);
    rect(&mut s, 18, 54, 26, 58, SAND);
    s.stamp_critter(22, 53);
    let before = s.count(SAND);
    let (mut bx, by) = (22.0f32, 54.0f32);
    for _ in 0..40 {
        s.beam(bx, by, bx + 1.0, by, 6.0);
        bx += 1.0;
        s.step();
    }
    for _ in 0..200 {
        s.step();
    }
    assert_eq!(s.count(SAND), before, "the beam never loses a grain");
    let moved = (40..80).map(|x| (0..60).filter(|&y| s.get(x, y) == SAND).count()).sum::<usize>();
    assert!(moved > 10, "only {moved} grains were carried");
    assert_eq!(s.critters.len(), 1);
    assert!((s.critters[0].x >> 4) > 40);
}
