//! The shared vocabulary (`src/data/creatures/parts.json`), embedded at build time.
//! The TypeScript side reads the very same file, so the two can never drift apart.

use serde::Deserialize;
use std::collections::BTreeMap;
use std::sync::OnceLock;

#[derive(Deserialize)]
pub struct PowerRule {
    pub id: String,
    pub any: Vec<(String, serde_json::Value)>,
}

#[derive(Deserialize)]
pub struct Names {
    pub n1: Vec<String>,
    pub n2: Vec<String>,
    pub m1: Vec<String>,
    pub m2: Vec<String>,
    pub m3: Vec<String>,
}

#[derive(Deserialize)]
pub struct Event {
    pub id: String,
    pub w: u32,
}

#[derive(Deserialize)]
pub struct Surprise {
    pub order: Vec<String>,
    pub pools: BTreeMap<String, Vec<serde_json::Value>>,
}

#[derive(serde::Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Phrase {
    pub fr: String,
    pub en: String,
}

#[derive(Deserialize)]
pub struct Data {
    pub parts: BTreeMap<String, Vec<String>>,
    #[serde(rename = "legCounts")]
    pub leg_counts: Vec<u32>,
    #[serde(rename = "armCounts")]
    pub arm_counts: Vec<u32>,
    #[serde(rename = "eyeCounts")]
    pub eye_counts: Vec<u32>,
    pub sizes: Vec<u32>,
    pub powers: Vec<PowerRule>,
    pub names: Names,
    pub blocklist: Vec<String>,
    pub events: Vec<Event>,
    pub surprise: Surprise,
    pub phrases: BTreeMap<String, BTreeMap<String, Phrase>>,
}

pub fn data() -> &'static Data {
    static D: OnceLock<Data> = OnceLock::new();
    D.get_or_init(|| serde_json::from_str(include_str!("../../../src/data/creatures/parts.json")).expect("parts.json"))
}

pub fn list(field: &str) -> &'static [String] {
    data().parts.get(field).map(|v| v.as_slice()).unwrap_or(&[])
}

pub fn has(field: &str, v: &str) -> bool {
    list(field).iter().any(|x| x == v)
}
