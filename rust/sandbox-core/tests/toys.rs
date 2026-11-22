//! The parcel's living surprises: the music snow-globe (frozen), the treasure map (buried) and the aurora
//! kite (wind). Each opening deterministically gives its toy; the toys work, are never lost, and are saved.

use sandbox_core::gen::*;
use sandbox_core::parcel::*;
use sandbox_core::render::{Renderer, REDUCED_MOTION};
use sandbox_core::sim::*;
use sandbox_core::table::*;
use sandbox_core::toys::*;

fn arena(world: u8, w: usize, h: usize) -> World {
    let mut s = World::new(w, h, 7, world);
    for x in 0..w as i32 {
        s.set(x, h as i32 - 1, STONE);
    }
    s
}

fn px(s: &World) -> (i32, i32) {
    (s.parcel.x >> 4, s.parcel.y >> 4)
}

/// Drops the parcel and replays the child's gesture until it opens; returns how it opened.
fn open_by(s: &mut World, at: (i32, i32), mut act: impl FnMut(&mut World, u32)) -> u8 {
    assert!(s.drop_parcel(at.0, at.1));
    for t in 0..5000 {
        act(s, t);
        s.step();
        if s.parcel.state == P_OPEN {
            return s.parcel.opened;
        }
    }
    0
}

fn snow_on_it(s: &mut World, t: u32) {
    if t > 150 && t % 3 == 0 {
        let (x, y) = px(s);
        s.paint(x as f32, y as f32 - 6.0, 2.0, SNOW, 0);
    }
}

fn notes(s: &World) -> Vec<(u8, u8)> {
    s.toys.notes.iter().map(|&n| ((n & 63) as u8, ((n >> 6) & 7) as u8)).collect()
}

#[test]
fn the_frozen_parcel_becomes_a_music_snow_globe() {
    let mut s = arena(MOUNTAIN, 120, 80);
    assert_eq!(open_by(&mut s, (60, 20), snow_on_it) as usize, X_COLD + 1);
    let g = s.toys.globe.expect("a snow-globe came out of the frozen parcel");
    assert!((g.x - (s.parcel.x >> 4)).abs() <= 2, "the globe sits where the parcel opened");
    assert!(s.toys.kite.is_none() && s.toys.treasure.is_none());
    // Let the snow settle: once nothing falls, the globe is silent.
    for _ in 0..600 {
        s.step();
    }
    s.take_notes();
    for _ in 0..120 {
        s.step();
    }
    assert!(s.toys.notes.is_empty(), "a quiet world plays no notes ({:?})", notes(&s));
    // Sand poured on its left plays low sand notes, on a gentle beat.
    let g = s.toys.globe.unwrap();
    let mut heard = Vec::new();
    for t in 0..240u32 {
        if t < 160 {
            s.paint((g.x - 18) as f32, (g.y - 30) as f32, 2.0, SAND, 0);
        }
        s.step();
        heard.extend(notes(&s));
        s.take_notes();
    }
    assert!(heard.len() >= 10, "only {} notes", heard.len());
    assert!(heard.len() as u32 <= 240 / NOTE_EVERY + 1, "never more than one note per beat");
    assert!(heard.iter().all(|&(e, _)| e == SAND), "sand plays sand: {heard:?}");
    let low = heard.iter().filter(|&&(_, d)| d <= 3).count();
    assert!(low * 4 >= heard.len() * 3, "the left side is mostly low: {heard:?}");
    // Water poured on its right plays high water notes.
    let mut high = Vec::new();
    for t in 0..200u32 {
        if t < 120 {
            s.paint((g.x + 18) as f32, (g.y - 30) as f32, 2.0, WATER, 0);
        }
        s.step();
        high.extend(notes(&s));
        s.take_notes();
    }
    assert!(high.iter().any(|&(e, d)| e == WATER && d >= 4), "water on the right is high: {high:?}");
}

#[test]
fn the_snow_globe_is_never_lost() {
    let mut s = arena(GARDEN, 80, 60);
    for x in 0..80 {
        for y in 40..59 {
            s.set(x, y, STONE);
        }
    }
    s.place_globe(40, 10);
    let g = s.toys.globe.unwrap();
    assert_eq!(g.y, 39, "it is put down on the ground");
    // The ground under it goes: it settles down gently.
    for y in 40..50 {
        for x in 36..45 {
            s.set(x, y, EMPTY);
        }
    }
    for _ in 0..200 {
        s.step();
    }
    assert_eq!(s.toys.globe.unwrap().y, 49);
    // Walled in with stone: it climbs out on top.
    for y in 30..50 {
        for x in 30..50 {
            s.set(x, y, STONE);
        }
    }
    for _ in 0..400 {
        s.step();
    }
    let g = s.toys.globe.unwrap();
    assert!(g.y <= 31, "still inside the stone at y={}", g.y);
    // "Start again" keeps it.
    s.load_scene();
    assert!(s.toys.globe.is_some());
}

#[test]
fn the_buried_parcel_hides_a_treasure_to_dig_up() {
    let run = || {
        let mut s = World::new(320, 192, 21, GARDEN);
        s.load_scene();
        let opened = open_by(&mut s, (100, 20), |s, t| {
            if t > 150 {
                let (x, y) = px(s);
                s.paint(x as f32, y as f32 - 8.0, 3.0, SAND, 0);
            }
        });
        (opened, s)
    };
    let (opened, mut s) = run();
    assert_eq!(opened as usize, X_BURIED + 1);
    let t = s.toys.treasure.expect("a treasure map came out of the buried parcel");
    assert!(!t.found);
    assert_eq!(t.kind, T_FOSSIL);
    assert!((t.x - (s.parcel.x >> 4)).abs() >= 320 / 5, "the X is somewhere else in the world");
    assert_ne!(s.get(t.x, t.y), EMPTY, "the treasure is under the ground");
    assert_ne!(s.get(t.x, t.y - 2), EMPTY, "really buried");
    // Same seed, same gestures: the same spot.
    let (_, again) = run();
    let u = again.toys.treasure.unwrap();
    assert_eq!((u.x, u.y), (t.x, t.y));
    // Nothing happens while nobody digs.
    s.take_events();
    for _ in 0..600 {
        s.step();
    }
    assert_eq!(s.counts[R_GIFT_TREASURE as usize], 0);
    // "Start again" and a save keep the map.
    s.load_scene();
    assert_eq!(s.toys.treasure.map(|x| (x.x, x.y, x.found)), Some((t.x, t.y, false)));
    let mut bytes = Vec::new();
    s.save(&mut bytes);
    let mut other = World::new(320, 192, 99, GARDEN);
    assert!(other.load(&bytes));
    assert_eq!(other.toys.treasure.map(|x| (x.x, x.y, x.found)), Some((t.x, t.y, false)));
    // The eraser digs down from the surface: the treasure comes out, once, and stays as a glowing keepsake.
    let mut top = 0;
    while s.get(t.x, top) == EMPTY {
        top += 1;
    }
    let mut found_at = None;
    for k in 0..40 {
        let y = (top + k / 2).min(t.y) as f32;
        s.paint_line(t.x as f32, top as f32, t.x as f32, y, 1.5, EMPTY, 0);
        s.step();
        if s.counts[R_GIFT_TREASURE as usize] > 0 {
            found_at = Some(k);
            break;
        }
    }
    assert!(found_at.is_some(), "digging found nothing");
    assert_eq!(s.counts[R_GIFT_TREASURE as usize], 1, "found once");
    assert!(s.toys.treasure.unwrap().found);
    for _ in 0..300 {
        s.step();
    }
    assert!(s.toys.treasure.is_none(), "the reveal ends");
    assert!(s.count(CRYSTAL) > 0, "the fossil glows on as a keepsake");
    assert_eq!(s.counts[R_GIFT_TREASURE as usize], 1);
}

#[test]
fn each_world_has_its_own_treasure_and_a_river_can_dig_it_up() {
    assert_eq!(treasure_kind(ISLANDS), T_SHELL);
    assert_eq!(treasure_kind(UNDERSEA), T_SHELL);
    assert_eq!(treasure_kind(MOON), T_METEORITE);
    assert_eq!(treasure_kind(MARS), T_METEORITE);
    assert_eq!(treasure_kind(VOLCANO), T_FOSSIL);
    // Every world (both orientations) finds a buried spot in its own scene.
    for world in 0..WORLD_COUNT {
        for (w, h) in [(320, 192), (192, 320)] {
            let mut s = World::new(w, h, 5, world);
            s.load_scene();
            s.bury_treasure(-1, 0, w as i32 / 2);
            let t = s.toys.treasure.unwrap();
            assert!(s.inside(t.x, t.y), "world {world}: outside");
            assert_ne!(s.get(t.x, t.y), EMPTY, "world {world} {w}x{h}: the treasure at {},{} is not buried", t.x, t.y);
        }
    }
    // The spot laid open by anything (here: the cells taken away) reveals it.
    let mut s = arena(ISLANDS, 60, 40);
    for x in 0..60 {
        for y in 25..39 {
            s.set(x, y, SAND);
        }
    }
    s.bury_treasure(30, 30, -1);
    for y in 20..34 {
        for x in 29..32 {
            s.set(x, y, EMPTY);
        }
    }
    s.step();
    assert_eq!(s.counts[R_GIFT_TREASURE as usize], 1);
}

#[test]
fn the_windy_parcel_becomes_an_aurora_kite_the_finger_steers() {
    let mut s = arena(GARDEN, 160, 96);
    let opened = open_by(&mut s, (80, 30), |s, t| {
        if t > 150 {
            let (x, y) = px(s);
            s.wind(x as f32, y as f32 - 2.0, 5.0, if (t / 40) % 2 == 0 { 1 } else { -1 });
        }
    });
    assert_eq!(opened as usize, X_WIND + 1);
    let k = s.toys.kite.expect("a kite came out of the parcel left in the wind");
    let (ax, ay) = (k.ax, k.ay);
    assert!((ax - (s.parcel.x >> 4)).abs() <= 1, "its string is tied where the parcel opened");
    // Steered by the finger, it goes there.
    for _ in 0..300 {
        s.steer_kite(30.0, 12.0);
        s.step();
    }
    let k = s.toys.kite.unwrap();
    assert!(((k.x >> 4) - 30).abs() <= 5 && ((k.y >> 4) - 12).abs() <= 5, "kite at {},{}", k.x >> 4, k.y >> 4);
    assert_eq!(k.len, TRAIL, "it paints a full aurora ribbon");
    // Pulled into the ground, it stays in the sky.
    for _ in 0..200 {
        s.steer_kite(100.0, 95.0);
        s.step();
    }
    let k = s.toys.kite.unwrap();
    assert!((k.y >> 4) <= 96 * 55 / 100, "the kite went down to {}", k.y >> 4);
    // Let go, it floats back above its string.
    for _ in 0..900 {
        s.step();
    }
    let k = s.toys.kite.unwrap();
    assert!(((k.x >> 4) - ax).abs() <= 20, "drifted far from its string: {} vs {ax}", k.x >> 4);
    assert!((k.y >> 4) < ay, "it flies above its peg");
    // The wind tool pushes it.
    let x0 = s.toys.kite.unwrap().x;
    for _ in 0..30 {
        let k = s.toys.kite.unwrap();
        s.wind((k.x >> 4) as f32, (k.y >> 4) as f32, 6.0, 1);
        s.step();
    }
    assert!(s.toys.kite.unwrap().x > x0 + 16, "the wind did not push the kite");
}

#[test]
fn toys_are_saved_and_older_saves_still_load() {
    let mut s = arena(MOON, 100, 70);
    s.place_globe(20, 30);
    s.place_kite(70, 60);
    for x in 40..60 {
        for y in 60..69 {
            s.set(x, y, STONE);
        }
    }
    s.bury_treasure(50, 68, -1);
    for _ in 0..50 {
        s.step();
    }
    let mut bytes = Vec::new();
    s.save(&mut bytes);
    let mut b = World::new(100, 70, 3, MOON);
    assert!(b.load(&bytes));
    assert_eq!(b.toys.globe.map(|g| g.x), Some(20));
    assert!(b.toys.kite.is_some());
    assert_eq!(b.toys.treasure.map(|t| (t.x, t.y, t.kind)), Some((50, 68, T_METEORITE)));
    // A save made before the toys existed (version 1: no toy byte) is still read.
    let mut plain = World::new(100, 70, 3, MOON);
    plain.load_scene();
    let mut v2 = Vec::new();
    plain.save(&mut v2);
    assert_eq!(v2[4], 2);
    let at = 4 + 1 + 1 + 2 + 2 + 4 * 3 + 3 + 1 + plain.critters.len() * 11 + 1 + 8 + 14;
    assert_eq!(v2[at], 0, "no toys: an empty toy byte");
    let mut v1 = v2[..v2.len() - 4].to_vec();
    v1.remove(at);
    v1[4] = 1;
    let sum = fnv(&v1);
    v1.extend_from_slice(&sum.to_le_bytes());
    let mut c = World::new(100, 70, 9, MOON);
    assert!(c.load(&v1), "a version 1 save was refused");
    assert_eq!(c.hash(), {
        let mut d = World::new(100, 70, 9, MOON);
        assert!(d.load(&v2));
        d.hash()
    });
}

fn fnv(data: &[u8]) -> u32 {
    let mut h: u32 = 2_166_136_261;
    for &b in data {
        h ^= b as u32;
        h = h.wrapping_mul(16_777_619);
    }
    h
}

#[test]
fn wild_toy_gestures_never_break_anything_and_toys_stay_inside() {
    let mut rng = 777u32;
    let mut next = || {
        rng ^= rng << 13;
        rng ^= rng >> 17;
        rng ^= rng << 5;
        rng
    };
    for world in [GARDEN, SPACE, UNDERSEA, MOON] {
        let mut s = World::new(160, 96, 2, world);
        s.load_scene();
        let mut r = Renderer::new(160, 96);
        for k in 0..1500u32 {
            let f = |v: u32| (v % 900) as i32 - 300;
            match next() % 12 {
                0 => s.place_globe(f(next()), f(next())),
                1 => s.place_kite(f(next()), f(next())),
                2 => s.bury_treasure(f(next()), f(next()), f(next())),
                3 => s.steer_kite(f32::NAN, 3.0),
                _ => s.steer_kite(f(next()) as f32, f(next()) as f32),
            }
            if k % 7 == 0 {
                s.paint_line(f(next()) as f32, f(next()) as f32, f(next()) as f32, f(next()) as f32, 4.0, EMPTY, 0);
            }
            s.step();
            s.take_notes();
            if let Some(g) = s.toys.globe {
                assert!(s.inside(g.x, g.y), "world {world}: globe outside at {},{}", g.x, g.y);
            }
            if let Some(kt) = s.toys.kite {
                assert!(s.inside(kt.x >> 4, kt.y >> 4), "world {world}: kite outside");
            }
            if let Some(t) = s.toys.treasure {
                assert!(s.inside(t.x, t.y), "world {world}: treasure outside");
            }
            if k % 100 == 0 {
                r.set_quality(1 + (k / 100) as usize % 3, k % 200 == 0);
                r.render(&mut s, k as f64 * 16.0, (k % 3 == 0) as u32 * REDUCED_MOTION);
            }
        }
    }
}

#[test]
fn the_saucer_can_see_clouds_and_geyser_mist() {
    let mut s = arena(VOLCANO, 60, 40);
    assert_eq!(s.probe_sky(0, 0, 60, 20), 0);
    for x in 10..16 {
        s.set(x, 5, CLOUD);
    }
    assert_eq!(s.probe_sky(8, 2, 20, 10) & 1, 1);
    for x in 40..43 {
        s.set(x, 8, STEAM);
    }
    assert_eq!(s.probe_sky(36, 4, 46, 12), 2);
    assert_eq!(s.probe_sky(-50, -50, 500, 500), 3);
}
