//! Scene analysis on synthetic photos.

mod common;

use common::*;
use lutins_core::analysis::{ColorTemp, LightDir, StagePos};
use lutins_core::color::parse_hex;
use lutins_core::{analyze_scene, RgbaImage};

/// A flat table scene: the top half is a dark wall, the bottom half a bright
/// table top with a mug on the right. The stage must be on the table.
fn table_scene() -> RgbaImage {
    let (w, h) = (480, 320);
    let mut img = solid(w, h, [40, 36, 34]);
    fill_rect(&mut img, 0, h / 2, w, h, [205, 180, 140]);
    // A mug and a vase on the right of the table, a picture on the wall.
    fill_rect(&mut img, 380, 150, 420, 210, [230, 230, 240]);
    fill_rect(&mut img, 430, 120, 460, 200, [60, 110, 170]);
    fill_rect(&mut img, 100, 40, 200, 110, [120, 100, 90]);
    noise(&mut img, 3.0, 1);
    img
}

#[test]
fn stage_is_on_the_table() {
    let img = table_scene();
    let a = analyze_scene(img.view()).unwrap();
    assert!(!a.stages.is_empty(), "{a:#?}");
    let s = &a.stages[0];
    // Entirely on the table (lower half), left of the mug, right below the wall line.
    assert!(s.y >= 0.49, "{s:?}");
    assert!(s.x + s.w <= 380.0 / 480.0 + 0.02, "{s:?}");
    assert!(s.below_edge, "{s:?}");
    assert!(matches!(s.label, StagePos::BottomLeft | StagePos::Bottom | StagePos::Left | StagePos::Centre), "{s:?}");
    // No stage on the dark wall.
    assert!(a.stages.iter().all(|s| s.y + s.h / 2.0 > 0.5), "{:#?}", a.stages);
    // Sorted, at most 4, normalised.
    assert!(a.stages.len() <= 4);
    assert!(a.stages.windows(2).all(|p| p[0].score >= p[1].score));
    for s in &a.stages {
        assert!(s.x >= 0.0 && s.y >= 0.0 && s.x + s.w <= 1.0001 && s.y + s.h <= 1.0001);
    }
}

#[test]
fn table_scene_palette_and_basics() {
    let a = analyze_scene(table_scene().view()).unwrap();
    assert_eq!((a.width, a.height), (480, 320));
    assert!(a.palette.len() == 5);
    let near = |hex: &str, want: [i32; 3]| {
        let c = parse_hex(hex).unwrap();
        (0..3).all(|i| (c[i] as i32 - want[i]).abs() < 20)
    };
    assert!(near(&a.palette[0].hex, [205, 180, 140]) || near(&a.palette[0].hex, [40, 36, 34]), "{:?}", a.palette);
    assert!(a.palette.iter().any(|p| near(&p.hex, [40, 36, 34])), "{:?}", a.palette);
    let total: f32 = a.palette.iter().map(|p| p.share).sum();
    assert!((total - 1.0).abs() < 0.01);
    assert!(a.contrast > 0.2);
    assert!(!a.is_dark);
}

#[test]
fn room_scene_stages_avoid_the_objects() {
    let img = room(600, 400);
    let a = analyze_scene(img.view()).unwrap();
    assert!(!a.stages.is_empty());
    // Objects: frames, lamp, mug, book (normalised rectangles from common::room).
    let objects = [
        (0.10, 0.10, 0.28, 0.38),
        (0.62, 0.08, 0.86, 0.30),
        (0.40, 0.20, 0.50, 0.34),
        (0.72, 0.48, 0.78, 0.62),
        (0.82, 0.58, 0.96, 0.66),
    ];
    for s in &a.stages {
        for o in objects {
            let ix = (s.x + s.w).min(o.2) - s.x.max(o.0);
            let iy = (s.y + s.h).min(o.3) - s.y.max(o.1);
            assert!(ix <= 0.02 || iy <= 0.02, "stage {s:?} overlaps object {o:?}");
        }
    }
    // The best one is on the table top (between the wall line and the table front).
    let s = &a.stages[0];
    assert!(s.y >= 0.54 && s.y + s.h <= 0.9, "{s:?}");
}

#[test]
fn left_lit_gradient() {
    let (w, h) = (400, 260);
    let mut img = RgbaImage::new(w, h);
    for y in 0..h {
        for x in 0..w {
            let v = (0.9 - 0.65 * x as f32 / w as f32) * 255.0;
            img.set(x, y, [v as u8, (v * 0.95) as u8, (v * 0.9) as u8, 255]);
        }
    }
    // A few objects on the wall must not change the answer.
    fill_rect(&mut img, 60, 60, 110, 120, [40, 40, 40]);
    fill_rect(&mut img, 250, 150, 300, 220, [30, 60, 90]);
    noise(&mut img, 2.0, 2);
    let a = analyze_scene(img.view()).unwrap();
    assert_eq!(a.light_dir, LightDir::Left, "{a:?}");
    assert!(a.light_strength > 0.5);

    // Mirror → right.
    let mut m = img.clone();
    for y in 0..h {
        for x in 0..w {
            let p = img.view().px(w - 1 - x, y);
            m.set(x, y, p);
        }
    }
    assert_eq!(analyze_scene(m.view()).unwrap().light_dir, LightDir::Right);
}

#[test]
fn flat_light_is_diffuse() {
    let img = room(400, 260); // the room's wall gradient is gentle and vertical-ish
    let mut flat = solid(400, 260, [150, 150, 150]);
    noise(&mut flat, 2.0, 3);
    assert_eq!(analyze_scene(flat.view()).unwrap().light_dir, LightDir::Diffuse);
    let a = analyze_scene(img.view()).unwrap();
    assert_ne!(a.light_dir, LightDir::Left);
    assert_ne!(a.light_dir, LightDir::Right);
}

#[test]
fn warm_and_cool_casts() {
    let base = room(400, 260);
    let neutral = analyze_scene(base.view()).unwrap();
    assert_eq!(neutral.color_temp, ColorTemp::Neutral, "{}", neutral.kelvin);

    let mut warm = base.clone();
    cast(&mut warm, [1.0, 0.72, 0.42]);
    let w = analyze_scene(warm.view()).unwrap();
    assert_eq!(w.color_temp, ColorTemp::Warm, "{}", w.kelvin);
    assert!(w.kelvin < 4000.0, "{}", w.kelvin);

    let mut cool = base.clone();
    cast(&mut cool, [0.72, 0.85, 1.0]);
    let c = analyze_scene(cool.view()).unwrap();
    assert!(
        c.kelvin > neutral.kelvin + 1000.0 && neutral.kelvin > w.kelvin + 1000.0,
        "{} {} {}",
        w.kelvin,
        neutral.kelvin,
        c.kelvin
    );
    let mut blue = base.clone();
    cast(&mut blue, [0.5, 0.72, 1.0]);
    let b = analyze_scene(blue.view()).unwrap();
    assert_eq!(b.color_temp, ColorTemp::Cool, "{}", b.kelvin);
}

#[test]
fn dark_room_and_blur() {
    let mut dark = room(400, 260);
    reexpose(&mut dark, 0.3, 1.4);
    let a = analyze_scene(dark.view()).unwrap();
    assert!(a.is_dark && a.brightness < 0.25, "{}", a.brightness);
    // Night photos still get stages (relative lighting).
    assert!(!a.stages.is_empty());

    let mut sharp = room(400, 260);
    noise(&mut sharp, 6.0, 4);
    let mut soft = sharp.clone();
    for _ in 0..6 {
        soft = blur3(&soft);
    }
    let (s, b) = (analyze_scene(sharp.view()).unwrap(), analyze_scene(soft.view()).unwrap());
    assert!(s.sharpness > 3.0 * b.sharpness, "{} vs {}", s.sharpness, b.sharpness);
    assert!(b.blur > s.blur);
    assert!(!s.is_blurry && b.is_blurry, "{} {}", s.sharpness, b.sharpness);
}

#[test]
fn analysis_is_deterministic_and_size_independent() {
    let img = room(900, 600);
    let a = analyze_scene(img.view()).unwrap();
    assert_eq!(a, analyze_scene(img.view()).unwrap());
    // Same scene at another resolution gives the same conclusions.
    let small = room(450, 300);
    let b = analyze_scene(small.view()).unwrap();
    assert_eq!(a.color_temp, b.color_temp);
    assert_eq!(a.light_dir, b.light_dir);
    assert!((a.brightness - b.brightness).abs() < 0.02);
    assert_eq!(a.stages[0].label, b.stages[0].label);
}

#[test]
fn json_shape() {
    let a = analyze_scene(table_scene().view()).unwrap();
    let v: serde_json::Value = serde_json::to_value(&a).unwrap();
    for k in [
        "width",
        "height",
        "brightness",
        "contrast",
        "color_temp",
        "kelvin",
        "light_dir",
        "light_strength",
        "palette",
        "is_dark",
        "sharpness",
        "blur",
        "is_blurry",
        "stages",
    ] {
        assert!(v.get(k).is_some(), "missing {k}");
    }
    assert!(v["stages"][0]["label"].is_string());
    assert!(v["palette"][0]["hex"].as_str().unwrap().starts_with('#'));
}

#[test]
fn tiny_and_extreme_images_do_not_panic() {
    for (w, h) in [(1, 1), (2, 7), (300, 3), (17, 17)] {
        let img = solid(w, h, [10, 200, 30]);
        let a = analyze_scene(img.view()).unwrap();
        assert!(a.brightness > 0.0);
    }
    assert!(lutins_core::RgbaView::new(&[], 0, 0).is_err());
}
