//! Gentle-prank helpers: is a prank idea gentle enough, and which catalogue prank
//! to suggest tonight (never one done recently). Deterministic, no clock, no network.
//!
//! The list of forbidden words lives in `src/data/lutins/gentle.json`, read by this
//! crate and by `src/lib/lutins/gentle.ts`, so the two can never drift apart.

use crate::rng::{fnv1a64, Rng};
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Deserialize)]
struct Gentle {
    words: Vec<String>,
}

fn words() -> &'static [String] {
    static G: OnceLock<Gentle> = OnceLock::new();
    &G.get_or_init(|| serde_json::from_str(include_str!("../../../src/data/lutins/gentle.json")).expect("gentle.json")).words
}

/// Lower case, accents removed (the French of a parent typing quickly), letters and digits only.
pub fn fold(c: char) -> Option<char> {
    let c = c.to_lowercase().next().unwrap_or(c);
    let f = match c {
        'à' | 'á' | 'â' | 'ä' | 'ã' | 'å' => 'a',
        'ç' => 'c',
        'è' | 'é' | 'ê' | 'ë' => 'e',
        'ì' | 'í' | 'î' | 'ï' => 'i',
        'ñ' => 'n',
        'ò' | 'ó' | 'ô' | 'ö' | 'õ' => 'o',
        'ù' | 'ú' | 'û' | 'ü' => 'u',
        'ÿ' | 'ý' => 'y',
        'œ' => 'o',
        c if c.is_alphanumeric() => c,
        _ => return None,
    };
    Some(f)
}

/// The words of a text, folded (`"Il a CASSÉ le vase !"` → `["il", "a", "casse", "le", "vase"]`).
pub fn tokens(text: &str) -> Vec<String> {
    let mut out = vec![];
    let mut cur = String::new();
    for ch in text.chars() {
        match fold(ch) {
            Some(c) => cur.push(c),
            None => {
                if !cur.is_empty() {
                    out.push(std::mem::take(&mut cur));
                }
            }
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

/// The forbidden words found in a text (each once, in order). Empty = gentle.
pub fn gentle_check(text: &str) -> Vec<String> {
    let list = words();
    let mut found: Vec<String> = vec![];
    for t in tokens(text) {
        if list.iter().any(|w| *w == t) && !found.contains(&t) {
            found.push(t);
        }
    }
    found
}

/// Tonight's suggestion: a seeded pick among the ids not done recently (all of them if every one was).
pub fn pick_prank(ids: &[String], recent: &[String], seed: u32) -> Option<String> {
    if ids.is_empty() {
        return None;
    }
    let fresh: Vec<&String> = ids.iter().filter(|i| !recent.contains(i)).collect();
    let pool: Vec<&String> = if fresh.is_empty() { ids.iter().collect() } else { fresh };
    let mut r = Rng::new(fnv1a64(&seed.to_le_bytes()));
    Some(pool[(r.next_u64() % pool.len() as u64) as usize].clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_dangerous_ideas_in_both_languages() {
        assert_eq!(gentle_check("ils font du ski sur la rampe d’escalier"), vec!["rampe", "escalier"]);
        assert_eq!(gentle_check("they climb the stairs with a knife"), vec!["climb", "stairs", "knife"]);
        assert_eq!(gentle_check("Ils ont CASSÉ le vase"), vec!["casse"]);
    }

    #[test]
    fn lets_gentle_ideas_through() {
        for t in ["ils jouent à cache-cache", "they build a pillow fort with fairy lights", "des lutins dans un bol de céréales", "fireflies and felt pens", "un feutre et une plume"] {
            assert!(gentle_check(t).is_empty(), "{t}");
        }
    }

    #[test]
    fn every_forbidden_word_is_unaccented_lower_case() {
        for w in words() {
            assert_eq!(tokens(w), vec![w.clone()], "{w}");
        }
    }

    #[test]
    fn pick_avoids_recent_and_is_deterministic() {
        let ids: Vec<String> = ["a", "b", "c", "d"].iter().map(|s| s.to_string()).collect();
        let recent: Vec<String> = ["a", "b", "c"].iter().map(|s| s.to_string()).collect();
        for seed in 0..50 {
            assert_eq!(pick_prank(&ids, &recent, seed).as_deref(), Some("d"));
        }
        assert_eq!(pick_prank(&ids, &ids, 7), pick_prank(&ids, &ids, 7));
        assert!(pick_prank(&[], &[], 1).is_none());
        let seen: std::collections::BTreeSet<_> = (0..200).filter_map(|s| pick_prank(&ids, &[], s)).collect();
        assert_eq!(seen.len(), 4);
    }
}
