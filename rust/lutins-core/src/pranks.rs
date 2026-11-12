//! The prank catalogue (`src/data/lutins/pranks.json`, one source of truth
//! shared with the TypeScript UI, like `bible.json`), embedded at compile
//! time, plus what the engine does with it:
//!
//! - [`find`] / [`is_prank_id`]: look a prank up by id (the prompt builder
//!   fills a missing action from here, so a client never has to send one);
//! - [`check_idea`]: cleans and checks the text a parent types as their own
//!   prank idea (same cleaning as `cleanParentText` in `src/lib/lutins/text.ts`,
//!   plus a gentle-words gate, a first filter before ChildShield);
//! - [`plan`]: the "prank of the night": a deterministic draw from a seed,
//!   with a place filter and no repeat over the last N nights.
//!
//! Changing `pranks.json` requires `npm run lutins:wasm` (`bible_hash`-like
//! [`pranks_hash`] and the `--check` mode catch a stale build).

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::OnceLock;

use crate::image::{EngineError, Result};
use crate::rng::{fnv1a32, fnv1a64, mix64};

/// The catalogue text, byte for byte.
pub const PRANKS_JSON: &str = include_str!("../../../src/data/lutins/pranks.json");

/// Longest idea kept, in characters (same as the parent text of the prompt).
pub const MAX_IDEA_CHARS: usize = 240;
/// Shortest idea accepted, in characters.
pub const MIN_IDEA_CHARS: usize = 3;
/// Default number of nights without repeating a prank.
pub const DEFAULT_NO_REPEAT: usize = 14;
/// Most pranks planned in one call.
pub const MAX_PLAN: usize = 31;

#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct Place {
    pub id: String,
    pub emoji: String,
    pub fr: String,
    pub en: String,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct PrankDef {
    pub id: String,
    pub emoji: String,
    pub cat: String,
    pub fr: String,
    pub en: String,
    pub action: String,
    pub motion: String,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct Catalogue {
    pub version: u32,
    pub places: Vec<Place>,
    pub pranks: Vec<PrankDef>,
}

/// The parsed catalogue (panics at first use if the embedded JSON is invalid,
/// which the unit tests rule out).
pub fn catalogue() -> &'static Catalogue {
    static C: OnceLock<Catalogue> = OnceLock::new();
    C.get_or_init(|| serde_json::from_str(PRANKS_JSON).expect("pranks.json is valid"))
}

/// FNV-1a (32-bit) of the embedded catalogue text followed by the gentle-words
/// text (the TypeScript test hashes both files on disk the same way).
pub fn pranks_hash() -> u32 {
    let mut bytes = PRANKS_JSON.as_bytes().to_vec();
    bytes.extend_from_slice(GENTLE_JSON.as_bytes());
    fnv1a32(&bytes)
}

/// A prank by id.
pub fn find(id: &str) -> Option<&'static PrankDef> {
    catalogue().pranks.iter().find(|p| p.id == id)
}

pub fn is_prank_id(id: &str) -> bool {
    find(id).is_some()
}

// ---------------------------------------------------------------------------
// Parent's own idea

/// The ungentle words (`src/data/lutins/gentle.json`, shared with the
/// TypeScript fallback), embedded at compile time.
pub const GENTLE_JSON: &str = include_str!("../../../src/data/lutins/gentle.json");

#[derive(Deserialize)]
struct GentleFile {
    words: Vec<String>,
}

/// Words that never belong in a prank for a child (they are dangerous to
/// imitate, destructive or unkind): English and French, compared whole-word,
/// lowercase. A first gentle gate: ChildShield still judges every text.
fn ungentle() -> &'static HashSet<String> {
    static W: OnceLock<HashSet<String>> = OnceLock::new();
    W.get_or_init(|| serde_json::from_str::<GentleFile>(GENTLE_JSON).expect("gentle.json is valid").words.into_iter().collect())
}

/// Why an idea was refused.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct IdeaCheck {
    /// The cleaned text (what to send).
    pub text: String,
    pub ok: bool,
    /// `too_short`, `unsafe_word:<word>` (each at most once).
    pub reasons: Vec<String>,
}

/// Cleans the parent's idea like the TypeScript `cleanParentText` (markup
/// characters become spaces, links are dropped, spaces collapsed, cut to
/// [`MAX_IDEA_CHARS`] characters). Unicode normalisation (NFC) is the
/// caller's job (`String.prototype.normalize` in the browser).
pub fn clean_idea(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut rest = raw;
    // Drop `http(s)://…` up to the next whitespace, like /https?:\/\/\S+/.
    loop {
        let a = rest.find("http://");
        let b = rest.find("https://");
        let at = match (a, b) {
            (Some(x), Some(y)) => Some(x.min(y)),
            (x, y) => x.or(y),
        };
        match at {
            Some(i) => {
                out.push_str(&rest[..i]);
                out.push(' ');
                let tail = &rest[i..];
                let end = tail.find(char::is_whitespace).unwrap_or(tail.len());
                rest = &tail[end..];
            }
            None => {
                out.push_str(rest);
                break;
            }
        }
    }
    let mapped: String = out
        .chars()
        .map(|c| match c {
            '<' | '>' | '{' | '}' | '[' | ']' | '`' | '*' | '_' | '#' | '|' | '\\' => ' ',
            c => c,
        })
        .collect();
    let collapsed = mapped.split_whitespace().collect::<Vec<_>>().join(" ");
    collapsed.chars().take(MAX_IDEA_CHARS).collect::<String>().trim().to_string()
}

/// Cleans and checks a parent's own idea.
pub fn check_idea(raw: &str) -> IdeaCheck {
    let text = clean_idea(raw);
    let mut reasons = Vec::new();
    if text.chars().count() < MIN_IDEA_CHARS {
        reasons.push("too_short".to_string());
    }
    let lower = text.to_lowercase();
    for word in lower.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()) {
        if ungentle().contains(word) {
            let r = format!("unsafe_word:{word}");
            if !reasons.contains(&r) {
                reasons.push(r);
            }
        }
    }
    IdeaCheck { ok: reasons.is_empty(), text, reasons }
}

/// True when the catalogue text itself contains an ungentle word (used by the
/// tests to keep the catalogue gentle).
pub fn ungentle_word(text: &str) -> Option<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .find(|w| ungentle().contains(*w))
        .map(|w| w.to_string())
}

// ---------------------------------------------------------------------------
// Prank of the night

fn default_no_repeat() -> usize {
    DEFAULT_NO_REPEAT
}
fn default_count() -> usize {
    1
}

/// Input of [`plan`] (JSON).
#[derive(Deserialize, Clone, Debug)]
pub struct PlanRequest {
    /// Any 32-bit number: the same seed gives the same answer (e.g. the hash
    /// of the date, plus one per "another idea").
    pub seed: u32,
    /// Only this place (a catalogue place id); `None` = anywhere in the house.
    #[serde(default)]
    pub place: Option<String>,
    /// Pranks already done, most recent first.
    #[serde(default)]
    pub recent: Vec<String>,
    /// No repeat over this many recent nights (default 14).
    #[serde(default = "default_no_repeat")]
    pub no_repeat: usize,
    /// How many consecutive nights to plan (1..=31, default 1).
    #[serde(default = "default_count")]
    pub count: usize,
}

/// Output of [`plan`].
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Plan {
    /// One prank id per night.
    pub ids: Vec<String>,
    /// True when the catalogue was too small for the constraints and the
    /// no-repeat window was relaxed for at least one night.
    pub relaxed: bool,
}

impl PlanRequest {
    pub fn from_json(json: &str) -> Result<PlanRequest> {
        serde_json::from_str(json).map_err(|e| EngineError::BadInput(format!("plan request: {e}")))
    }
}

fn key(seed: u32, night: usize, id: &str) -> u64 {
    mix64((seed as u64) ^ ((night as u64 + 1) << 40) ^ fnv1a64(id.as_bytes()))
}

/// The pranks of the next `count` nights, deterministic in `seed`:
///
/// 1. only the requested place (if any);
/// 2. never one of the last `no_repeat` pranks (older history first, then the
///    nights already planned here);
/// 3. when no place is requested, never two nights in a row in the same place
///    (variety), unless nothing else is left;
/// 4. among the rest, the smallest hash of (seed, night, id) wins.
///
/// If the constraints leave nothing, the no-repeat window is relaxed to the
/// least recently used pranks (`relaxed = true`); never an empty answer
/// unless the requested place does not exist.
pub fn plan(req: &PlanRequest) -> Result<Plan> {
    let cat = catalogue();
    if let Some(p) = &req.place {
        if !cat.places.iter().any(|x| &x.id == p) {
            return Err(EngineError::BadInput(format!("unknown place {p:?}")));
        }
    }
    let count = req.count.clamp(1, MAX_PLAN);
    // History, most recent first; the nights planned here are prepended.
    let mut history: Vec<String> = req.recent.clone();
    let mut ids = Vec::with_capacity(count);
    let mut relaxed = false;
    for night in 0..count {
        let pool: Vec<&PrankDef> =
            cat.pranks.iter().filter(|p| req.place.as_ref().map_or(true, |pl| &p.cat == pl)).collect();
        let window = req.no_repeat.min(history.len());
        let fresh: Vec<&PrankDef> = pool.iter().copied().filter(|p| !history[..window].contains(&p.id)).collect();
        let last_cat = history.first().and_then(|id| find(id)).map(|p| p.cat.as_str());
        let chosen: Option<&PrankDef> = if !fresh.is_empty() {
            let varied: Vec<&PrankDef> = if req.place.is_none() {
                fresh.iter().copied().filter(|p| Some(p.cat.as_str()) != last_cat).collect()
            } else {
                Vec::new()
            };
            let from = if varied.is_empty() { &fresh } else { &varied };
            from.iter().copied().min_by_key(|p| key(req.seed, night, &p.id))
        } else {
            relaxed = true;
            // Least recently used first: not in history = never used (oldest), else the deepest index.
            pool.iter()
                .copied()
                .max_by_key(|p| {
                    let age = history.iter().position(|h| h == &p.id).map_or(usize::MAX, |i| i);
                    (age, std::cmp::Reverse(key(req.seed, night, &p.id)))
                })
        };
        let Some(p) = chosen else { break };
        ids.push(p.id.clone());
        history.insert(0, p.id.clone());
    }
    Ok(Plan { ids, relaxed })
}

/// [`plan`] from JSON to JSON.
pub fn plan_json(json: &str) -> Result<Plan> {
    plan(&PlanRequest::from_json(json)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(seed: u32) -> PlanRequest {
        PlanRequest { seed, place: None, recent: vec![], no_repeat: DEFAULT_NO_REPEAT, count: 1 }
    }

    #[test]
    fn catalogue_is_big_unique_and_consistent() {
        let c = catalogue();
        assert!(c.pranks.len() >= 100, "{}", c.pranks.len());
        assert!(c.places.len() >= 10 && c.places.len() <= 14);
        let mut seen = std::collections::HashSet::new();
        for p in &c.pranks {
            assert!(seen.insert(p.id.as_str()), "duplicate id {}", p.id);
            assert!(!p.id.is_empty() && p.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'), "{}", p.id);
            assert!(c.places.iter().any(|x| x.id == p.cat), "{} has unknown place {}", p.id, p.cat);
            assert!(!p.fr.is_empty() && !p.en.is_empty() && !p.emoji.is_empty(), "{}", p.id);
            assert!(p.action.chars().count() > 30 && p.action.chars().count() <= crate::prompt::MAX_ACTION_CHARS, "{}", p.id);
            assert!(p.fr.chars().count() <= crate::prompt::MAX_TITLE_CHARS && p.en.chars().count() <= crate::prompt::MAX_TITLE_CHARS, "{}", p.id);
            assert!(!p.motion.is_empty(), "{}", p.id);
            // Elves are named by the prompt builder: the action has no subject.
            assert!(p.action.starts_with("are ") || p.action.starts_with("have ") || p.action.starts_with("is "), "{}: {}", p.id, p.action);
        }
        for pl in &c.places {
            let n = c.pranks.iter().filter(|p| p.cat == pl.id).count();
            assert!(n >= 3, "place {} has only {n}", pl.id);
        }
    }

    #[test]
    fn catalogue_is_gentle() {
        for p in &catalogue().pranks {
            for text in [&p.action, &p.motion, &p.fr, &p.en] {
                assert_eq!(ungentle_word(text), None, "{}: {}", p.id, text);
            }
        }
    }

    #[test]
    fn the_first_37_ids_are_kept() {
        for id in [
            "papier-toilette", "cache-cache", "course-voitures", "tente", "post-it", "bulles", "photo-lutins", "dominos", "peluches",
            "livres", "farine-anges", "guimauves", "cereales", "pancakes", "visages-fruits", "peche-bonbons", "biscuits", "origami",
            "canape-fort", "telecommande", "cinema", "chaussettes", "bonhomme", "coton-neige", "chaussures", "dessin", "cabane-draps",
            "dentifrice", "canard", "mousse", "sapin-decoration", "cadeaux-tour", "guirlande", "boules-jonglage", "lettre-pere-noel",
            "chocolat-chaud", "reveil",
        ] {
            assert!(is_prank_id(id), "{id}");
        }
        assert!(!is_prank_id("nope"));
        assert!(!is_prank_id(""));
    }

    #[test]
    fn hash_is_stable() {
        assert_ne!(pranks_hash(), fnv1a32(PRANKS_JSON.as_bytes()));
        assert_eq!(pranks_hash(), pranks_hash());
    }

    #[test]
    fn idea_cleaning_matches_the_typescript_rules() {
        assert_eq!(clean_idea("  ils font du <b>ski</b> https://evil.example/x  "), "ils font du b ski /b");
        assert_eq!(clean_idea(&"a".repeat(400)).chars().count(), 240);
        assert_eq!(clean_idea("a\n\tb   c"), "a b c");
        assert_eq!(clean_idea("x http://a.b/c y"), "x y");
        assert_eq!(clean_idea("abchttp://a.b d"), "abc d");
        assert_eq!(clean_idea("{[`*_#|\\]}"), "");
        assert_eq!(clean_idea("ça va très bien"), "ça va très bien");
    }

    #[test]
    fn ideas_are_checked_gently() {
        assert!(check_idea("ils font une course de chaussettes").ok);
        assert!(check_idea("they build a pillow castle").ok);
        assert!(check_idea("four elves bake cookies").ok);
        assert_eq!(check_idea("ab").reasons, ["too_short"]);
        let c = check_idea("ils font du ski sur la rampe d'escalier");
        assert!(!c.ok);
        assert_eq!(c.reasons, ["unsafe_word:rampe", "unsafe_word:escalier"]);
        assert!(!check_idea("they play with a KNIFE").ok);
        assert!(!check_idea("they climb the shelves").ok);
        assert!(!check_idea("Ils allument le FEU !").ok);
        // Whole words only: "firefly" and "fiery" are not "fire".
        assert!(check_idea("they chase a toy firefly").ok);
        // A link is dropped before the check.
        let c = check_idea("zut https://fire.example/knife ok");
        assert_eq!(c.text, "zut ok");
        assert!(c.ok);
    }

    #[test]
    fn plan_is_deterministic_and_valid() {
        let a = plan(&req(7)).unwrap();
        assert_eq!(a, plan(&req(7)).unwrap());
        assert_eq!(a.ids.len(), 1);
        assert!(is_prank_id(&a.ids[0]));
        assert!(!a.relaxed);
        // Different seeds spread over the catalogue.
        let distinct: std::collections::HashSet<String> = (0..200).map(|s| plan(&req(s)).unwrap().ids[0].clone()).collect();
        assert!(distinct.len() > 50, "{}", distinct.len());
    }

    #[test]
    fn plan_respects_place_and_history() {
        let mut r = req(3);
        r.place = Some("cuisine".into());
        let p = plan(&r).unwrap();
        assert_eq!(find(&p.ids[0]).unwrap().cat, "cuisine");
        // Excluding the pick makes another one.
        r.recent = p.ids.clone();
        let q = plan(&r).unwrap();
        assert_ne!(q.ids, p.ids);
        assert_eq!(find(&q.ids[0]).unwrap().cat, "cuisine");
        // Unknown place is an error.
        r.place = Some("lune".into());
        assert!(plan(&r).is_err());
    }

    #[test]
    fn plan_a_month_has_no_repeat_and_varies_places() {
        let mut r = req(2026);
        r.count = 31;
        let p = plan(&r).unwrap();
        assert_eq!(p.ids.len(), 31);
        assert!(!p.relaxed);
        let set: std::collections::HashSet<&String> = p.ids.iter().collect();
        assert_eq!(set.len(), 31, "no prank twice in 31 nights");
        for w in p.ids.windows(2) {
            assert_ne!(find(&w[0]).unwrap().cat, find(&w[1]).unwrap().cat, "same place two nights in a row: {w:?}");
        }
        // The first night also avoids the place of the last one done.
        let mut r2 = req(5);
        r2.recent = vec!["livres".into()];
        assert_ne!(find(&plan(&r2).unwrap().ids[0]).unwrap().cat, "partout");
    }

    #[test]
    fn plan_relaxes_when_the_place_is_exhausted() {
        let c = catalogue();
        let mut r = req(1);
        r.place = Some("sapin".into());
        let all: Vec<String> = c.pranks.iter().filter(|p| p.cat == "sapin").map(|p| p.id.clone()).collect();
        r.recent = all.iter().rev().cloned().collect(); // most recent first
        let p = plan(&r).unwrap();
        assert!(p.relaxed);
        // The least recently used one comes back: the last of `recent`.
        assert_eq!(p.ids[0], *r.recent.last().unwrap());
        // no_repeat = 0 never relaxes.
        r.no_repeat = 0;
        assert!(!plan(&r).unwrap().relaxed);
    }

    #[test]
    fn plan_json_roundtrip() {
        let p = plan_json(r#"{"seed": 12, "count": 3, "recent": ["livres", "nope"]}"#).unwrap();
        assert_eq!(p.ids.len(), 3);
        assert!(plan_json("{").is_err());
        assert!(plan_json(r#"{"seed": -1}"#).is_err());
    }
}
