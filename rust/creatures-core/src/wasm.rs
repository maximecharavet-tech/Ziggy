//! The WebAssembly surface: JSON in, JSON out (strings), one call per action.
//! An empty string means "invalid input".

use crate::{album, challenge, creature, pose, rng};
use serde::Serialize;
use wasm_bindgen::prelude::*;

fn json<T: Serialize>(v: &T) -> String {
    serde_json::to_string(v).unwrap_or_default()
}

fn creature_of(s: &str) -> Option<creature::Creature> {
    creature::sanitize(&serde_json::from_str(s).ok()?)
}

#[wasm_bindgen]
pub fn random_creature(seed: f64) -> String {
    json(&creature::random_creature(seed))
}

#[wasm_bindgen]
pub fn make_name(seed: f64) -> String {
    creature::make_name(seed)
}

#[wasm_bindgen]
pub fn sanitize(creature_json: &str) -> String {
    creature_of(creature_json).map(|c| json(&c)).unwrap_or_default()
}

#[wasm_bindgen]
pub fn cross(a_json: &str, b_json: &str, seed: f64) -> String {
    match (creature_of(a_json), creature_of(b_json)) {
        (Some(a), Some(b)) => json(&creature::cross(&a, &b, seed)),
        _ => String::new(),
    }
}

#[wasm_bindgen]
pub fn powers_of(creature_json: &str) -> String {
    creature_of(creature_json).map(|c| json(&creature::powers_of(&c))).unwrap_or_default()
}

#[wasm_bindgen]
pub fn moves_of(creature_json: &str) -> String {
    creature_of(creature_json).map(|c| json(&creature::moves_of(&c))).unwrap_or_default()
}

#[wasm_bindgen]
pub fn voice_of(creature_json: &str) -> String {
    creature_of(creature_json).map(|c| json(&creature::voice_of(&c))).unwrap_or_default()
}

#[wasm_bindgen]
pub fn silly_event(seed: f64) -> String {
    creature::silly_event(seed)
}

#[wasm_bindgen]
pub fn combo_count() -> f64 {
    creature::combo_count()
}

#[wasm_bindgen]
pub fn generate_challenge(band: &str, seed: f64) -> String {
    json(&challenge::generate(band, seed))
}

/// `[true, false, …]`, one per requirement.
#[wasm_bindgen]
pub fn check_requirements(reqs_json: &str, creature_json: &str) -> String {
    let (Ok(reqs), Some(c)) = (serde_json::from_str::<Vec<challenge::Req>>(reqs_json), creature_of(creature_json)) else { return String::new() };
    json(&challenge::check(&reqs, &c))
}

#[wasm_bindgen]
pub fn solve_requirements(reqs_json: &str) -> String {
    let Ok(reqs) = serde_json::from_str::<Vec<challenge::Req>>(reqs_json) else { return String::new() };
    challenge::solve(&reqs).map(|c| json(&c)).unwrap_or_default()
}

#[wasm_bindgen]
pub fn parse_album(raw: &str) -> String {
    json(&album::parse_album(raw))
}

#[wasm_bindgen]
pub fn encode_code(creature_json: &str) -> String {
    creature_of(creature_json).map(|c| album::encode_code(&c)).unwrap_or_default()
}

#[wasm_bindgen]
pub fn decode_code(code: &str) -> String {
    album::decode_code(code).map(|c| json(&c)).unwrap_or_default()
}

/// `[lift, squash, roll, yaw, pitch]`
#[wasm_bindgen]
pub fn pose(kind: &str, p: f64) -> Vec<f64> {
    pose::pose(kind, p).to_vec()
}

/// First numbers of a seeded stream (used by the parity tests).
#[wasm_bindgen]
pub fn rng_probe(seed: f64, n: u32) -> Vec<f64> {
    let mut r = rng::Rng::new(seed);
    (0..n).map(|_| r.next()).collect()
}
