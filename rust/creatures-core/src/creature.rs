//! The creature recipe: validation, the Surprise lever, cross-breeding, silly names,
//! powers, moves and voice. Mirrors `src/games3d/creatures/logic.ts` (the fallback).

use crate::data::{data, has, list};
use crate::rng::Rng;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Creature {
    pub id: String,
    pub name: String,
    pub body: String,
    pub head: String,
    pub legs: u32,
    pub leg_style: String,
    pub arms: u32,
    pub arm_style: String,
    pub wings: String,
    pub tail: String,
    pub eyes: u32,
    pub eye_size: String,
    pub mouth: String,
    pub top: String,
    pub hat: String,
    pub pattern: String,
    pub color: String,
    pub accent: String,
    pub size: u32,
    pub nose: String,
    pub aura: String,
    pub pet: String,
}

pub const ALL_FIELDS: [&str; 20] = [
    "body", "head", "legs", "legStyle", "arms", "armStyle", "wings", "tail", "eyes", "eyeSize", "mouth", "top", "hat", "pattern", "color", "accent", "size", "nose", "aura", "pet",
];

pub fn starter() -> Creature {
    Creature {
        id: String::new(),
        name: "Bloupi-Patatou".into(),
        body: "blob".into(),
        head: "none".into(),
        legs: 2,
        leg_style: "stubby".into(),
        arms: 2,
        arm_style: "noodle".into(),
        wings: "none".into(),
        tail: "none".into(),
        eyes: 2,
        eye_size: "big".into(),
        mouth: "smile".into(),
        top: "antennae".into(),
        hat: "none".into(),
        pattern: "plain".into(),
        color: "teal".into(),
        accent: "yellow".into(),
        size: 2,
        nose: "none".into(),
        aura: "none".into(),
        pet: "none".into(),
    }
}

impl Creature {
    /// A field as text ("legs" → "4"), for the power rules and the challenges.
    pub fn get(&self, f: &str) -> String {
        match f {
            "body" => self.body.clone(),
            "head" => self.head.clone(),
            "legs" => self.legs.to_string(),
            "legStyle" => self.leg_style.clone(),
            "arms" => self.arms.to_string(),
            "armStyle" => self.arm_style.clone(),
            "wings" => self.wings.clone(),
            "tail" => self.tail.clone(),
            "eyes" => self.eyes.to_string(),
            "eyeSize" => self.eye_size.clone(),
            "mouth" => self.mouth.clone(),
            "top" => self.top.clone(),
            "hat" => self.hat.clone(),
            "pattern" => self.pattern.clone(),
            "color" => self.color.clone(),
            "accent" => self.accent.clone(),
            "size" => self.size.to_string(),
            "nose" => self.nose.clone(),
            "aura" => self.aura.clone(),
            "pet" => self.pet.clone(),
            _ => String::new(),
        }
    }

    pub fn set(&mut self, f: &str, v: &str) {
        let n = v.parse::<u32>().unwrap_or(0);
        let s = v.to_string();
        match f {
            "body" => self.body = s,
            "head" => self.head = s,
            "legs" => self.legs = n,
            "legStyle" => self.leg_style = s,
            "arms" => self.arms = n,
            "armStyle" => self.arm_style = s,
            "wings" => self.wings = s,
            "tail" => self.tail = s,
            "eyes" => self.eyes = n,
            "eyeSize" => self.eye_size = s,
            "mouth" => self.mouth = s,
            "top" => self.top = s,
            "hat" => self.hat = s,
            "pattern" => self.pattern = s,
            "color" => self.color = s,
            "accent" => self.accent = s,
            "size" => self.size = n,
            "nose" => self.nose = s,
            "aura" => self.aura = s,
            "pet" => self.pet = s,
            _ => {}
        }
    }
}

fn val_text(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

/// The values a field can take in the Surprise lever, as text (counts included).
pub fn pool(field: &str) -> Vec<String> {
    if let Some(p) = data().surprise.pools.get(field) {
        return p.iter().map(val_text).collect();
    }
    full_list(field)
}

pub fn full_list(field: &str) -> Vec<String> {
    let d = data();
    let nums = |v: &Vec<u32>| v.iter().map(|n| n.to_string()).collect();
    match field {
        "legs" => nums(&d.leg_counts),
        "arms" => nums(&d.arm_counts),
        "eyes" => nums(&d.eye_counts),
        "size" => nums(&d.sizes),
        "accent" => list("color").to_vec(),
        f => list(f).to_vec(),
    }
}

/* ───────── Names ───────── */

pub fn make_name(seed: f64) -> String {
    let n = &data().names;
    let mut r = Rng::new(seed * 7.0 + 3.0);
    let a = format!("{}{}", r.pick(&n.n1), r.pick(&n.n2));
    let b = format!("{}{}{}", r.pick(&n.m1), r.pick(&n.m2), r.pick(&n.m3));
    format!("{a}-{b}")
}

/// Letters, digits, spaces, ' ’ -; spaces collapsed; at most 28 UTF-16 units (as JS).
pub fn clean_name(s: &str) -> String {
    let kept: String = s.chars().filter(|c| c.is_alphabetic() || c.is_numeric() || c.is_whitespace() || matches!(c, '\'' | '’' | '-')).collect();
    let collapsed = kept.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut out = String::new();
    let mut units = 0;
    for c in collapsed.chars() {
        units += c.len_utf16();
        if units > 28 {
            break;
        }
        out.push(c);
    }
    out.trim().to_string()
}

/* ───────── Validation ───────── */

fn pick_str(o: &Value, k: &str, field: &str, d: &str) -> String {
    match o.get(k).and_then(Value::as_str) {
        Some(s) if has(field, s) => s.to_string(),
        _ => d.to_string(),
    }
}

fn int(o: &Value, k: &str, min: f64, max: f64, d: u32) -> u32 {
    match o.get(k).and_then(Value::as_f64) {
        Some(x) if x.is_finite() => (x + 0.5).floor().clamp(min, max) as u32,
        _ => d,
    }
}

fn pick_num(o: &Value, k: &str, allowed: &[u32], d: u32) -> u32 {
    match o.get(k).and_then(Value::as_f64) {
        Some(x) if allowed.iter().any(|a| f64::from(*a) == x) => x as u32,
        _ => d,
    }
}

fn truncate_utf16(s: &str, max: usize) -> String {
    let mut out = String::new();
    let mut units = 0;
    for c in s.chars() {
        units += c.len_utf16();
        if units > max {
            break;
        }
        out.push(c);
    }
    out
}

/// A creature read from anywhere: every field checked, bad ones replaced by the starter's.
/// Old saves without nose / aura / pet get "none".
pub fn sanitize(x: &Value) -> Option<Creature> {
    if !x.is_object() {
        return None;
    }
    let s = starter();
    let d = data();
    let name = x.get("name").and_then(Value::as_str).map(clean_name).unwrap_or_default();
    Some(Creature {
        id: x.get("id").and_then(Value::as_str).map(|i| truncate_utf16(i, 40)).unwrap_or_default(),
        name: if name.is_empty() { s.name.clone() } else { name },
        body: pick_str(x, "body", "body", &s.body),
        head: pick_str(x, "head", "head", &s.head),
        legs: int(x, "legs", 0.0, 8.0, s.legs),
        leg_style: pick_str(x, "legStyle", "legStyle", &s.leg_style),
        arms: pick_num(x, "arms", &d.arm_counts, s.arms),
        arm_style: pick_str(x, "armStyle", "armStyle", &s.arm_style),
        wings: pick_str(x, "wings", "wings", &s.wings),
        tail: pick_str(x, "tail", "tail", &s.tail),
        eyes: int(x, "eyes", 1.0, 5.0, s.eyes),
        eye_size: pick_str(x, "eyeSize", "eyeSize", &s.eye_size),
        mouth: pick_str(x, "mouth", "mouth", &s.mouth),
        top: pick_str(x, "top", "top", &s.top),
        hat: pick_str(x, "hat", "hat", &s.hat),
        pattern: pick_str(x, "pattern", "pattern", &s.pattern),
        color: pick_str(x, "color", "color", &s.color),
        accent: pick_str(x, "accent", "color", &s.accent),
        size: pick_num(x, "size", &d.sizes, s.size),
        nose: pick_str(x, "nose", "nose", &s.nose),
        aura: pick_str(x, "aura", "aura", &s.aura),
        pet: pick_str(x, "pet", "pet", &s.pet),
    })
}

/* ───────── Surprise & cross-breeding ───────── */

pub fn random_creature(seed: f64) -> Creature {
    let mut r = Rng::new(seed);
    let colors = list("color");
    let ci = r.below(colors.len());
    let mut ai = r.below(colors.len());
    if ai == ci {
        ai = (ci + 3) % colors.len();
    }
    let mut c = starter();
    c.color = colors[ci].clone();
    c.accent = colors[ai].clone();
    c.name = make_name((r.next() * 1e9).floor());
    for f in &data().surprise.order {
        let p = pool(f);
        let v = r.pick(&p).clone();
        c.set(f, &v);
    }
    c
}

/// Two parents, one child: every part comes from one of them, now and then a surprise.
pub fn cross(a: &Creature, b: &Creature, seed: f64) -> Creature {
    let mut r = Rng::new(seed);
    let mut c = a.clone();
    c.id = String::new();
    for f in ALL_FIELDS {
        let coin = r.next();
        let mutate = r.next();
        let mut v = if coin < 0.5 { a.get(f) } else { b.get(f) };
        if mutate < 0.07 {
            let p = full_list(f);
            v = r.pick(&p).clone();
        }
        c.set(f, &v);
    }
    if c.accent == c.color {
        let colors = list("color");
        let i = colors.iter().position(|x| *x == c.color).unwrap_or(0);
        c.accent = colors[(i + 3) % colors.len()].clone();
    }
    c.name = make_name((r.next() * 1e9).floor());
    c
}

/// How many different creatures can be built (for the "more than…" line).
pub fn combo_count() -> f64 {
    ALL_FIELDS.iter().map(|f| full_list(f).len() as f64).product()
}

/* ───────── Powers, moves, voice ───────── */

pub fn powers_of(c: &Creature) -> Vec<String> {
    let mut out: Vec<String> = data().powers.iter().filter(|rule| rule.any.iter().any(|(f, v)| c.get(f) == val_text(v))).map(|rule| rule.id.clone()).collect();
    if out.is_empty() {
        out.push("dance".into());
    }
    out
}

pub fn moves_of(c: &Creature) -> Vec<&'static str> {
    let ground = if c.legs == 0 {
        "bounce"
    } else if c.legs == 1 {
        "pogo"
    } else {
        "walk"
    };
    let mut moves: Vec<&'static str> = vec![];
    let can_fly = c.wings != "none" && c.wings != "tiny";
    if can_fly {
        moves.push("fly");
    }
    if c.tail == "fish" || (c.leg_style == "paddle" && c.legs > 0) {
        moves.push("swim");
    }
    if !can_fly || c.legs > 1 || moves.len() < 2 {
        moves.insert(0, ground);
    }
    if c.wings == "tiny" {
        moves.push("flutter");
    }
    moves.truncate(3);
    moves
}

#[derive(Serialize)]
pub struct Voice {
    pub kind: &'static str,
    pub pitch: u32,
    pub syllables: u32,
}

pub fn voice_of(c: &Creature) -> Voice {
    let kind = if c.tail == "fish" {
        "blub"
    } else if c.mouth == "beak" {
        "honk"
    } else if c.legs >= 6 || c.wings == "tiny" {
        "buzz"
    } else if c.tail == "dragon" || c.mouth == "fangs" {
        "roar"
    } else if c.body == "box" {
        "boing"
    } else if c.top == "cat" || c.body == "drop" {
        "purr"
    } else {
        "squeak"
    };
    let base = match kind {
        "squeak" => 620.0,
        "honk" => 330.0,
        "boing" => 280.0,
        "blub" => 360.0,
        "buzz" => 240.0,
        "purr" => 150.0,
        _ => 170.0,
    };
    let size = if c.size == 1 {
        1.55
    } else if c.size == 3 {
        0.62
    } else {
        1.0
    };
    let pitch = (base * size * (1.0 + (f64::from(c.eyes) - 3.0) * 0.04) + 0.5).floor() as u32;
    Voice { kind, pitch, syllables: 1 + (c.eyes % 3) + u32::from(c.legs > 4) }
}

/// A silly little event now and then (confetti, a wonky blink…): same seed, same event.
pub fn silly_event(seed: f64) -> String {
    let ev = &data().events;
    let total: u32 = ev.iter().map(|e| e.w).sum();
    let mut x = (Rng::new(seed).next() * f64::from(total)).floor() as u32;
    for e in ev {
        if x < e.w {
            return e.id.clone();
        }
        x -= e.w;
    }
    ev[0].id.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn surprise_is_always_a_valid_creature() {
        for s in 0..400 {
            let c = random_creature(f64::from(s) * 7919.0);
            let v = serde_json::to_value(&c).unwrap();
            assert_eq!(sanitize(&v).unwrap(), c, "seed {s}");
            assert!(!powers_of(&c).is_empty());
            assert!(!moves_of(&c).is_empty());
        }
    }

    #[test]
    fn names_never_hit_the_blocklist() {
        for s in 0..4000 {
            let n = make_name(f64::from(s)).to_lowercase();
            for bad in &data().blocklist {
                assert!(!n.contains(bad.as_str()), "{n} contains {bad}");
            }
        }
    }

    #[test]
    fn same_seed_same_creature() {
        assert_eq!(random_creature(42.0), random_creature(42.0));
        assert_ne!(random_creature(42.0), random_creature(43.0));
    }

    #[test]
    fn cross_takes_parts_from_both_parents() {
        let a = random_creature(1.0);
        let b = random_creature(2.0);
        let mut seen_a = false;
        let mut seen_b = false;
        for s in 0..30 {
            let c = cross(&a, &b, f64::from(s));
            for f in ALL_FIELDS {
                if f == "color" || f == "accent" {
                    continue;
                }
                if a.get(f) != b.get(f) {
                    seen_a |= c.get(f) == a.get(f);
                    seen_b |= c.get(f) == b.get(f);
                }
            }
            assert_ne!(c.accent, c.color);
            assert_eq!(sanitize(&serde_json::to_value(&c).unwrap()).unwrap(), c);
        }
        assert!(seen_a && seen_b);
    }

    #[test]
    fn old_saves_without_new_fields_load() {
        let old = serde_json::json!({"id":"x","name":"Vieux","body":"egg","legs":3,"arms":4,"eyes":9});
        let c = sanitize(&old).unwrap();
        assert_eq!((c.nose.as_str(), c.aura.as_str(), c.pet.as_str()), ("none", "none", "none"));
        assert_eq!((c.body.as_str(), c.legs, c.arms, c.eyes), ("egg", 3, 4, 5));
        assert!(sanitize(&Value::Null).is_none());
    }

    #[test]
    fn powers_follow_the_parts() {
        let mut c = starter();
        c.wings = "angel".into();
        c.aura = "notes".into();
        let p = powers_of(&c);
        assert!(p.contains(&"fly".to_string()) && p.contains(&"music".to_string()));
        assert!(combo_count() > 1e15);
    }

    #[test]
    fn clean_name_is_strict() {
        assert_eq!(clean_name("  Bob<script>  l'Éclair-2 "), "Bobscript l'Éclair-2");
        assert_eq!(clean_name(&"a".repeat(40)).len(), 28);
    }
}
