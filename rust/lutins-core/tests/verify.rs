//! The verifier on synthetic "generations".

mod common;

use common::*;
use lutins_core::{verify, Verification, VerifyRequest};

const W: usize = 512;
const H: usize = 340;

fn req(ids: &[&str]) -> VerifyRequest {
    VerifyRequest::from_json(&serde_json::to_string(ids).unwrap()).unwrap()
}

fn run(gen: &lutins_core::RgbaImage, orig: &lutins_core::RgbaImage, ids: &[&str]) -> Verification {
    verify(gen.view(), orig.view(), &req(ids)).unwrap()
}

fn photo() -> lutins_core::RgbaImage {
    let mut p = room(W, H);
    noise(&mut p, 3.0, 11);
    p
}

#[test]
fn identical_image_keeps_the_room_but_misses_the_elves() {
    let p = photo();
    let v = run(&p, &p, &["pepin", "grelotte"]);
    assert!(v.room.ok, "{v:#?}");
    assert!(v.room.structure > 0.99 && v.room.gmsd < 0.01 && v.room.drift < 0.5, "{:?}", v.room);
    assert!(!v.ok);
    assert_eq!(v.reasons, ["elf_missing:pepin", "elf_missing:grelotte"]);
    assert!(v.elves.iter().all(|e| !e.present && e.primary == 0.0));
    assert!(v.align.dx.abs() < 0.002 && v.align.dy.abs() < 0.002 && v.align.scale == 1.0);
}

#[test]
fn pasted_elves_pass() {
    let p = photo();
    let mut g = room_with_elves(W, H, &["pepin", "grelotte", "noisette"]);
    noise(&mut g, 3.0, 11);
    let v = run(&g, &p, &["pepin", "grelotte", "noisette"]);
    assert!(v.ok, "{v:#?}");
    assert!(v.elves.iter().all(|e| e.present), "{:?}", v.elves);
    assert_eq!(v.elves.iter().map(|e| e.id.as_str()).collect::<Vec<_>>(), ["pepin", "grelotte", "noisette"]);
    assert!(!v.extra_elves);
    assert!(v.score > 0.8, "{}", v.score);
}

#[test]
fn rerendered_generation_still_passes() {
    // What an edit model does: re-exposes, softens, re-noises and shifts a
    // little — the room is still the room.
    let p = photo();
    let mut g = room_with_elves(W, H, &["pepin", "noisette"]);
    reexpose(&mut g, 1.05, 0.92);
    g = blur3(&g);
    noise(&mut g, 4.0, 99);
    let g = shift(&g, 6, -3); // ~1.2 % of the width
    let v = run(&g, &p, &["noisette", "pepin"]);
    assert!(v.ok, "{v:#?}");
    assert!((v.align.dx * W as f32 - 6.0).abs() < 1.5, "{:?}", v.align);
    assert!((v.align.dy * H as f32 + 3.0).abs() < 1.5, "{:?}", v.align);
    assert_eq!(v.elves[0].id, "noisette");
}

#[test]
fn totally_different_image_is_room_changed() {
    let p = photo();
    let mut g = other_scene(W, H);
    paint_elf(&mut g, 100.0, 300.0, 80.0, PEPIN.0, PEPIN.1);
    let v = run(&g, &p, &["pepin"]);
    assert!(!v.ok && !v.room.ok);
    assert!(v.reasons.contains(&"room_changed".to_string()), "{v:#?}");
    assert!(v.room.structure < 0.65 || v.room.gmsd > 0.15, "{:?}", v.room);
}

#[test]
fn reframed_generation_is_flagged() {
    let p = photo();
    let g = shift(&room_with_elves(W, H, &["pepin"]), 30, 0); // 6 % of the width
    let v = run(&g, &p, &["pepin"]);
    assert!(v.reasons.contains(&"framing_changed".to_string()), "{v:#?}");
    // Aspect change too.
    let wide = room_with_elves(W * 3 / 2, H, &["pepin"]);
    let v = run(&wide, &p, &["pepin"]);
    assert!(v.reasons.contains(&"framing_changed".to_string()), "{v:#?}");
}

#[test]
fn recoloured_room_is_flagged() {
    let p = photo();
    let mut g = room_with_elves(W, H, &["pepin"]);
    cast(&mut g, [0.55, 0.9, 1.4]); // the model repainted the whole room blue
    let v = run(&g, &p, &["pepin"]);
    assert!(v.reasons.contains(&"room_recolored".to_string()), "{v:#?}");
}

#[test]
fn elves_are_found_under_warm_lamp_light() {
    // A warm-lit room; the generated elves are lit by the same warm light,
    // so their colours are shifted (the Bradford adaptation compensates).
    let mut p = photo();
    cast(&mut p, [1.0, 0.7, 0.42]);
    let mut g = room_with_elves(W, H, &["pepin", "grelotte", "noisette"]);
    noise(&mut g, 3.0, 11);
    cast(&mut g, [1.0, 0.7, 0.42]);
    let v = run(&g, &p, &["pepin", "grelotte", "noisette"]);
    assert!(v.elves.iter().all(|e| e.present), "{:#?}", v.elves);
    assert!(v.ok, "{v:#?}");
}

#[test]
fn unrequested_elf_is_extra() {
    let p = photo();
    let mut g = room_with_elves(W, H, &["pepin", "grelotte"]);
    noise(&mut g, 3.0, 11);
    let v = run(&g, &p, &["pepin"]);
    assert!(v.extra_elves && v.reasons.contains(&"extra_elves".to_string()), "{v:#?}");
    assert!(v.elves[0].present);
}

#[test]
fn three_pepins_are_extra() {
    let p = photo();
    let mut g = room(W, H);
    for i in 0..3 {
        paint_elf(&mut g, 80.0 + 110.0 * i as f32, 270.0, 75.0, PEPIN.0, PEPIN.1);
    }
    noise(&mut g, 3.0, 11);
    let v = run(&g, &p, &["pepin"]);
    assert!(v.elves[0].clusters >= 3, "{:?}", v.elves);
    assert!(v.reasons.contains(&"extra_elves".to_string()), "{v:#?}");
}

#[test]
fn room_colours_are_not_elves() {
    // The room itself has a green plant, a red box and a violet cushion; an
    // unchanged generation must not "find" elves in them.
    let mut p = photo();
    fill_rect(&mut p, 30, 200, 90, 300, [58, 157, 79]);
    fill_rect(&mut p, 100, 220, 140, 260, [224, 49, 49]);
    fill_rect(&mut p, 300, 230, 360, 280, [121, 80, 242]);
    fill_rect(&mut p, 370, 230, 400, 260, [252, 196, 25]);
    let mut g = p.clone();
    reexpose(&mut g, 1.03, 0.95);
    let v = run(&g, &p, &["pepin", "grelotte"]);
    assert!(v.elves.iter().all(|e| !e.present), "{:#?}", v.elves);
    assert!(!v.extra_elves);
}

#[test]
fn dark_and_blank_generations() {
    let p = photo();
    let mut g = room_with_elves(W, H, &["pepin"]);
    reexpose(&mut g, 0.12, 1.6);
    let v = run(&g, &p, &["pepin"]);
    assert!(v.reasons.contains(&"too_dark".to_string()), "{v:#?}");
    let blank = solid(W, H, [128, 128, 128]);
    let v = run(&blank, &p, &["pepin"]);
    assert!(v.reasons.contains(&"blank".to_string()) && v.reasons.contains(&"room_changed".to_string()), "{v:#?}");
}

#[test]
fn caller_mask_and_sizes() {
    let p = photo();
    let g = room_with_elves(W, H, &["pepin"]);
    let r = VerifyRequest::from_json(r#"{"elves":["pepin"],"mask":[{"x":0.05,"y":0.5,"w":0.3,"h":0.35}]}"#).unwrap();
    let v = verify(g.view(), p.view(), &r).unwrap();
    assert!(v.ok, "{v:#?}");
    assert!(v.room.masked > 0.2);
    // A large generated picture against a smaller photo (same aspect).
    let big = room_with_elves(W * 2, H * 2, &["pepin"]);
    let v = run(&big, &p, &["pepin"]);
    assert!(v.ok, "{v:#?}");
}

#[test]
fn json_shape() {
    let p = photo();
    let v = run(&p, &p, &["pepin"]);
    let j = serde_json::to_value(&v).unwrap();
    for k in [
        "ok",
        "score",
        "reasons",
        "room",
        "align",
        "elves",
        "extra_elves",
        "brightness_generated",
        "brightness_original",
    ] {
        assert!(j.get(k).is_some(), "{k}");
    }
    for k in ["ok", "structure", "ssim", "gmsd", "drift", "changed", "edge_corr", "masked"] {
        assert!(j["room"].get(k).is_some(), "room.{k}");
    }
}

#[test]
fn missing_noisette_is_not_found_in_grelottes_scarf() {
    let mut p = photo();
    cast(&mut p, [1.0, 0.7, 0.42]);
    let mut g = room_with_elves(W, H, &["grelotte"]);
    noise(&mut g, 3.0, 11);
    cast(&mut g, [1.0, 0.7, 0.42]);
    let v = run(&g, &p, &["grelotte", "noisette"]);
    assert_eq!(v.reasons, ["elf_missing:noisette"], "{v:#?}");
}

#[test]
fn a_prank_prop_does_not_fail_the_room() {
    // A white paper garland drooping across the wall, plus the elves.
    let p = photo();
    let mut g = room_with_elves(W, H, &["pepin", "grelotte"]);
    for x in 0..W {
        let y = (60.0 + 25.0 * ((x as f32 / W as f32) * std::f32::consts::TAU * 2.0).sin().abs()) as usize;
        fill_rect(&mut g, x, y, x + 1, y + 4, [245, 245, 240]);
    }
    noise(&mut g, 3.0, 11);
    let v = run(&g, &p, &["pepin", "grelotte"]);
    assert!(v.ok, "{v:#?}");
}

#[test]
fn tiny_and_fully_masked_pictures() {
    for (w, h) in [(16, 16), (20, 9), (3, 3)] {
        let p = room(w, h);
        let v = run(&p, &p, &["pepin"]);
        assert!(v.room.ok, "{w}×{h}: {v:#?}");
        assert_eq!(v.reasons, ["elf_missing:pepin"]);
    }
    let p = photo();
    let r = VerifyRequest::from_json(r#"{"elves":["pepin"],"mask":[{"x":0,"y":0,"w":1,"h":1}]}"#).unwrap();
    let v = verify(p.view(), p.view(), &r).unwrap();
    assert!(v.room.ok && v.room.structure > 0.99, "{v:#?}");
}
