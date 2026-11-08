//! The elves' visual bible (`src/data/lutins/bible.json`, the single source of
//! truth shared with the 3D models and the UI), embedded at compile time and
//! parsed once, plus what the engine adds per elf: the signature colours the
//! verifier looks for and a short visual tag used to name an elf without a
//! pronoun ("the elf in the long red-and-white striped hat").
//!
//! Changing `bible.json` requires `npm run lutins:wasm` (the `--check` mode and
//! the `bible_hash()` export catch a stale build).

use serde::Deserialize;
use std::sync::OnceLock;

use crate::color::parse_hex;

/// The bible text, byte for byte.
pub const BIBLE_JSON: &str = include_str!("../../../src/data/lutins/bible.json");

#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct Names {
    pub fr: String,
    pub en: String,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct Elf {
    pub id: String,
    pub name: Names,
    pub color: String,
    pub accent: String,
    pub look: String,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct Bible {
    pub version: u32,
    pub style: String,
    pub negative: String,
    pub elves: Vec<Elf>,
}

impl Bible {
    pub fn elf(&self, id: &str) -> Option<&Elf> {
        self.elves.iter().find(|e| e.id == id)
    }

    pub fn index(&self, id: &str) -> Option<usize> {
        self.elves.iter().position(|e| e.id == id)
    }
}

/// The parsed bible (panics at first use if the embedded JSON is invalid,
/// which the unit tests rule out).
pub fn bible() -> &'static Bible {
    static B: OnceLock<Bible> = OnceLock::new();
    B.get_or_init(|| serde_json::from_str(BIBLE_JSON).expect("bible.json is valid"))
}

/// FNV-1a (32-bit) of the embedded bible text: the TypeScript test hashes the
/// file on disk the same way to prove the committed WebAssembly is up to date.
pub fn bible_hash() -> u32 {
    crate::rng::fnv1a32(BIBLE_JSON.as_bytes())
}

/// What the verifier looks for on one elf.
#[derive(Clone, Debug, PartialEq)]
pub struct Signature {
    /// The main garment colour family (required): bible `color` + variants.
    pub primary: Vec<[u8; 3]>,
    /// The accent family (hat, scarf…): bible `accent` + variants.
    pub accent: Vec<[u8; 3]>,
    /// Whether an accent patch is required next to the primary one (false
    /// for Noisette: her green leaf is tiny and her cream tunic ambiguous).
    pub needs_accent: bool,
    /// Whether this elf's colours are distinctive enough to count instances
    /// (unexpected elf, several copies). False for Noisette: hazelnut brown is
    /// everywhere in homes and in food pranks.
    pub detect_unexpected: bool,
}

/// Extra colours per known id, from the `look` descriptions (felt under room
/// light spans a range of shades).
fn extras(id: &str) -> (&'static [&'static str], &'static [&'static str], bool, bool) {
    match id {
        // Moss-green tunic and boots; red-and-white striped hat.
        "pepin" => (&["#2f8a43", "#4f9a3a", "#5aab5e"], &["#c92a2a", "#f03e3e"], true, true),
        // Lavender-purple dress; mustard scarf and pompom hat.
        "grelotte" => (&["#9775fa", "#6741d9", "#b197fc"], &["#e8a317", "#fab005", "#c4900f"], true, true),
        // Hazelnut cape and acorn hat; small green leaf.
        "noisette" => (&["#8b5a2b", "#b07a45", "#7a4a1f"], &[], false, false),
        _ => (&[], &[], true, true),
    }
}

/// The signature of an elf of the bible.
pub fn signature(elf: &Elf) -> Signature {
    let (p, a, needs_accent, detect_unexpected) = extras(&elf.id);
    let parse = |v: &[&str]| v.iter().filter_map(|h| parse_hex(h)).collect::<Vec<_>>();
    let mut primary = vec![parse_hex(&elf.color).unwrap_or([128, 128, 128])];
    primary.extend(parse(p));
    let mut accent = vec![parse_hex(&elf.accent).unwrap_or([128, 128, 128])];
    accent.extend(parse(a));
    Signature { primary, accent, needs_accent, detect_unexpected }
}

/// A short visual tag naming the elf without a pronoun (image models confuse
/// "he/she" between several characters; descriptors work).
pub fn visual_tag(id: &str) -> &'static str {
    match id {
        "pepin" => "the round elf in the moss-green tunic and the long red-and-white striped hat with a bell",
        "grelotte" => "the slender elf in the lavender dress with the mustard-yellow scarf and round golden glasses",
        "noisette" => "the tiny elf in the hazelnut-brown hooded cape with the acorn-cap hat",
        _ => "the elf",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bible_parses_and_has_the_three_elves() {
        let b = bible();
        assert_eq!(b.version, 1);
        let ids: Vec<&str> = b.elves.iter().map(|e| e.id.as_str()).collect();
        assert_eq!(ids, ["pepin", "grelotte", "noisette"]);
        assert!(!b.style.is_empty() && !b.negative.is_empty());
    }

    #[test]
    fn every_elf_has_valid_colours_a_signature_and_a_tag() {
        for e in &bible().elves {
            assert!(parse_hex(&e.color).is_some(), "{}", e.id);
            assert!(parse_hex(&e.accent).is_some(), "{}", e.id);
            let s = signature(e);
            assert!(s.primary.len() >= 2 && !s.accent.is_empty(), "{}", e.id);
            assert_ne!(visual_tag(&e.id), "the elf", "{}", e.id);
            assert!(e.look.starts_with(&e.name.fr), "{}", e.id);
        }
    }

    #[test]
    fn hash_is_stable() {
        assert_eq!(bible_hash(), crate::rng::fnv1a32(BIBLE_JSON.as_bytes()));
        assert_ne!(bible_hash(), 0);
    }
}
