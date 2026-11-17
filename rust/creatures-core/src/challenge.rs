//! Gentle mini-challenges: checking a creature against requirements, and an endless
//! generator of new ones (always solvable, checked by `solve`). No timer, no failure.

use crate::creature::{full_list, powers_of, starter, Creature};
use crate::data::{data, Phrase};
use crate::rng::Rng;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "k")]
pub enum Req {
    #[serde(rename = "legs")]
    Legs { n: u32 },
    #[serde(rename = "arms")]
    Arms { n: u32 },
    #[serde(rename = "eyes")]
    Eyes { n: u32 },
    #[serde(rename = "wings")]
    Wings,
    #[serde(rename = "wingsIs")]
    WingsIs { is: String },
    #[serde(rename = "tail")]
    Tail { is: String },
    #[serde(rename = "top")]
    Top { is: String },
    #[serde(rename = "hat")]
    Hat,
    #[serde(rename = "hatIs")]
    HatIs { is: String },
    #[serde(rename = "mouth")]
    Mouth { is: String },
    #[serde(rename = "pattern")]
    Pattern { is: String },
    #[serde(rename = "color")]
    Color { is: String },
    #[serde(rename = "legStyle")]
    LegStyle { is: String },
    #[serde(rename = "limbs")]
    Limbs { n: u32 },
    #[serde(rename = "sumAll")]
    SumAll { n: u32 },
    #[serde(rename = "eyesEqLegs")]
    EyesEqLegs,
    #[serde(rename = "oddLegs")]
    OddLegs,
    #[serde(rename = "power")]
    Power { is: String },
    #[serde(rename = "nose")]
    Nose { is: String },
    #[serde(rename = "aura")]
    Aura { is: String },
    #[serde(rename = "pet")]
    Pet { is: String },
    #[serde(rename = "body")]
    Body { is: String },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Challenge {
    pub id: String,
    pub band: String,
    pub skill: String,
    pub icon: String,
    pub text: Phrase,
    pub reqs: Vec<Req>,
}

pub fn req_met(r: &Req, c: &Creature) -> bool {
    match r {
        Req::Legs { n } => c.legs == *n,
        Req::Arms { n } => c.arms == *n,
        Req::Eyes { n } => c.eyes == *n,
        Req::Wings => c.wings != "none" && c.wings != "tiny",
        Req::WingsIs { is } => c.wings == *is,
        Req::Tail { is } => c.tail == *is,
        Req::Top { is } => c.top == *is,
        Req::Hat => c.hat != "none",
        Req::HatIs { is } => c.hat == *is,
        Req::Mouth { is } => c.mouth == *is,
        Req::Pattern { is } => c.pattern == *is,
        Req::Color { is } => c.color == *is,
        Req::LegStyle { is } => c.leg_style == *is && c.legs > 0,
        Req::Limbs { n } => c.legs + c.arms == *n,
        Req::SumAll { n } => c.legs + c.arms + c.eyes == *n,
        Req::EyesEqLegs => c.eyes == c.legs,
        Req::OddLegs => c.legs % 2 == 1,
        Req::Power { is } => powers_of(c).contains(is),
        Req::Nose { is } => c.nose == *is,
        Req::Aura { is } => c.aura == *is,
        Req::Pet { is } => c.pet == *is,
        Req::Body { is } => c.body == *is,
    }
}

pub fn check(reqs: &[Req], c: &Creature) -> Vec<bool> {
    reqs.iter().map(|r| req_met(r, c)).collect()
}

/// The field a "named" requirement fixes (None for counts, sums and powers).
fn fixed_field(r: &Req) -> Option<(&'static str, String)> {
    Some(match r {
        Req::WingsIs { is } => ("wings", is.clone()),
        Req::Tail { is } => ("tail", is.clone()),
        Req::Top { is } => ("top", is.clone()),
        Req::HatIs { is } => ("hat", is.clone()),
        Req::Mouth { is } => ("mouth", is.clone()),
        Req::Pattern { is } => ("pattern", is.clone()),
        Req::Color { is } => ("color", is.clone()),
        Req::LegStyle { is } => ("legStyle", is.clone()),
        Req::Nose { is } => ("nose", is.clone()),
        Req::Aura { is } => ("aura", is.clone()),
        Req::Pet { is } => ("pet", is.clone()),
        Req::Body { is } => ("body", is.clone()),
        Req::Wings => ("wings", "bird".into()),
        Req::Hat => ("hat", "top".into()),
        _ => return None,
    })
}

/// Can a creature be built for these requirements? Returns one.
pub fn solve(reqs: &[Req]) -> Option<Creature> {
    let d = data();
    let mut base = starter();
    let mut fixed: Vec<&str> = vec![];
    for r in reqs {
        if let Some((f, v)) = fixed_field(r) {
            base.set(f, &v);
            fixed.push(f);
        }
    }
    // Powers: try each way of getting it that does not touch a fixed field.
    let powers: Vec<&String> = reqs
        .iter()
        .filter_map(|r| match r {
            Req::Power { is } => Some(is),
            _ => None,
        })
        .collect();
    let mut variants: Vec<Creature> = vec![base.clone()];
    for p in powers {
        let rule = d.powers.iter().find(|x| x.id == *p)?;
        let mut next = vec![];
        for v in &variants {
            next.push(v.clone());
            for (f, val) in &rule.any {
                let text = match val {
                    serde_json::Value::String(s) => s.clone(),
                    other => other.to_string(),
                };
                if val.is_string() && !fixed.contains(&f.as_str()) {
                    let mut c = v.clone();
                    c.set(f, &text);
                    next.push(c);
                }
            }
        }
        variants = next;
    }
    for v in variants {
        for legs in &d.leg_counts {
            for arms in &d.arm_counts {
                for eyes in &d.eye_counts {
                    let mut c = v.clone();
                    c.legs = *legs;
                    c.arms = *arms;
                    c.eyes = *eyes;
                    if reqs.iter().all(|r| req_met(r, &c)) {
                        return Some(c);
                    }
                }
            }
        }
    }
    None
}

/* ───────── Generator ───────── */

const COLOR_WORDS: [(&str, &str, &str); 10] = [
    ("red", "rouge", "red"),
    ("orange", "orange", "orange"),
    ("yellow", "jaune", "yellow"),
    ("green", "verte", "green"),
    ("teal", "turquoise", "turquoise"),
    ("blue", "bleue", "blue"),
    ("purple", "violette", "purple"),
    ("pink", "rose", "pink"),
    ("brown", "marron", "brown"),
    ("white", "blanche", "white"),
];

fn phrase(field: &str, id: &str) -> Option<Phrase> {
    data().phrases.get(field)?.get(id).cloned()
}

fn join(items: &[String], and: &str) -> String {
    match items.len() {
        0 => String::new(),
        1 => items[0].clone(),
        n => format!("{} {and} {}", items[..n - 1].join(", "), items[n - 1]),
    }
}

fn shuffle<T>(r: &mut Rng, v: &mut [T]) {
    for i in (1..v.len()).rev() {
        v.swap(i, r.below(i + 1));
    }
}

/// A named value that has a phrase (so the text can name it).
fn named(r: &mut Rng, field: &str, skip: &[&str]) -> Option<String> {
    let ids: Vec<String> = full_list(field).into_iter().filter(|i| i != "none" && !skip.contains(&i.as_str()) && phrase(field, i).is_some()).collect();
    if ids.is_empty() {
        None
    } else {
        Some(r.pick(&ids).clone())
    }
}

fn build(band: &str, r: &mut Rng) -> Option<Challenge> {
    let (min, extra) = match band {
        "little" => (1, 1),
        "middle" => (2, 1),
        _ => (3, 1),
    };
    let k = min + usize::from(r.next() < 0.5) * extra;
    let math = band == "big" && r.next() < 0.4;
    let mut kinds: Vec<&str> = if band == "little" {
        vec!["color", "eyes", "legs", "wings", "tail", "hat", "mouth"]
    } else {
        vec!["color", "wings", "tail", "top", "hat", "mouth", "nose", "aura", "pet", "body", "power", "eyes", "legs", "arms"]
    };
    shuffle(r, &mut kinds);
    let mut reqs: Vec<Req> = vec![];
    if math {
        let n = r.below(4);
        reqs.push(match n {
            0 => Req::Limbs { n: 4 + r.below(7) as u32 },
            1 => Req::SumAll { n: 8 + r.below(7) as u32 },
            2 => Req::EyesEqLegs,
            _ => Req::OddLegs,
        });
    }
    let mut powers = 0;
    for kind in kinds {
        if reqs.len() >= k + usize::from(math) {
            break;
        }
        let counts = matches!(kind, "eyes" | "legs" | "arms");
        if counts && math {
            continue;
        }
        let req = match kind {
            "color" => Req::Color { is: r.pick(&COLOR_WORDS).0.to_string() },
            "eyes" => Req::Eyes { n: if band == "little" { 1 + r.below(3) as u32 } else { 1 + r.below(5) as u32 } },
            "legs" => Req::Legs { n: if band == "little" { 1 + r.below(4) as u32 } else { *r.pick(&[0, 1, 2, 3, 4, 5, 6, 8]) } },
            "arms" => Req::Arms { n: *r.pick(&[0, 2, 4]) },
            "wings" => Req::WingsIs { is: named(r, "wings", &["tiny"])? },
            "tail" => Req::Tail { is: named(r, "tail", &[])? },
            "top" => Req::Top { is: named(r, "top", &[])? },
            "hat" => Req::HatIs { is: named(r, "hat", &[])? },
            "mouth" => Req::Mouth { is: named(r, "mouth", &[])? },
            "nose" => Req::Nose { is: named(r, "nose", &[])? },
            "aura" => Req::Aura { is: named(r, "aura", &[])? },
            "pet" => Req::Pet { is: named(r, "pet", &[])? },
            "body" => Req::Body { is: named(r, "body", &[])? },
            "power" => {
                powers += 1;
                if powers > 1 {
                    continue;
                }
                let ids: Vec<&String> = data().powers.iter().map(|p| &p.id).collect();
                Req::Power { is: (*r.pick(&ids)).clone() }
            }
            _ => continue,
        };
        reqs.push(req);
    }
    if reqs.is_empty() {
        return None;
    }
    solve(&reqs)?;

    // Words.
    let (mut adj_fr, mut adj_en) = (String::new(), String::new());
    let mut with_fr: Vec<String> = vec![];
    let mut with_en: Vec<String> = vec![];
    let (mut pow_fr, mut pow_en) = (String::new(), String::new());
    let (mut math_fr, mut math_en) = (String::new(), String::new());
    let mut icon = "✨";
    let mut skill = "vocabulary";
    let mut counted = false;
    let mut named_n = 0;
    for q in &reqs {
        let mut add = |f: &str, id: &str, ic: &'static str| {
            if let Some(p) = phrase(f, id) {
                with_fr.push(p.fr);
                with_en.push(p.en);
            }
            named_n += 1;
            if icon == "✨" {
                icon = ic;
            }
        };
        match q {
            Req::Color { is } => {
                let w = COLOR_WORDS.iter().find(|c| c.0 == is).unwrap_or(&COLOR_WORDS[0]);
                adj_fr = format!(" {}", w.1);
                adj_en = format!(" {}", w.2);
                if icon == "✨" {
                    icon = "🎨";
                }
            }
            Req::Eyes { n } => {
                counted = true;
                with_fr.push(if *n == 1 { "un seul œil".into() } else { format!("{n} yeux") });
                with_en.push(if *n == 1 { "just one eye".into() } else { format!("{n} eyes") });
                if icon == "✨" {
                    icon = "👀";
                }
            }
            Req::Legs { n } => {
                counted = true;
                with_fr.push(match n {
                    0 => "pas de pattes".into(),
                    1 => "1 seule patte".into(),
                    _ => format!("{n} pattes"),
                });
                with_en.push(match n {
                    0 => "no legs".into(),
                    1 => "just 1 leg".into(),
                    _ => format!("{n} legs"),
                });
                if icon == "✨" {
                    icon = "🦵";
                }
            }
            Req::Arms { n } => {
                counted = true;
                with_fr.push(if *n == 0 { "pas de bras".into() } else { format!("{n} bras") });
                with_en.push(if *n == 0 { "no arms".into() } else { format!("{n} arms") });
                if icon == "✨" {
                    icon = "💪";
                }
            }
            Req::WingsIs { is } => add("wings", is, "🪶"),
            Req::Tail { is } => add("tail", is, "🐟"),
            Req::Top { is } => add("top", is, "🦄"),
            Req::HatIs { is } => add("hat", is, "🎩"),
            Req::Mouth { is } => add("mouth", is, "👄"),
            Req::Nose { is } => add("nose", is, "👃"),
            Req::Aura { is } => add("aura", is, "✨"),
            Req::Pet { is } => add("pet", is, "🐞"),
            Req::Body { is } => add("body", is, "🥚"),
            Req::Power { is } => {
                if let Some(p) = phrase("power", is) {
                    pow_fr = p.fr;
                    pow_en = p.en;
                }
                icon = "⚡";
            }
            Req::Limbs { n } => {
                math_fr = format!("Pattes + bras = {n} en tout !");
                math_en = format!("Legs + arms = {n} in all!");
                icon = "➕";
                skill = "addition";
            }
            Req::SumAll { n } => {
                math_fr = format!("Pattes + bras + yeux = {n} en tout !");
                math_en = format!("Legs + arms + eyes = {n} in all!");
                icon = "🧮";
                skill = "addition";
            }
            Req::EyesEqLegs => {
                math_fr = "Autant d’yeux que de pattes !".into();
                math_en = "As many eyes as legs!".into();
                icon = "⚖️";
                skill = "logic";
            }
            Req::OddLegs => {
                math_fr = "Un nombre impair de pattes !".into();
                math_en = "An odd number of legs!".into();
                icon = "🔢";
                skill = "logic";
            }
            _ => {}
        }
    }
    if skill == "vocabulary" {
        skill = if counted && named_n == 0 { "counting" } else if adj_fr.len() > 0 && named_n <= 1 && !counted { "colors" } else { "vocabulary" };
    }
    let mut fr = String::new();
    let mut en = String::new();
    if reqs.iter().all(|q| matches!(q, Req::Limbs { .. } | Req::SumAll { .. } | Req::EyesEqLegs | Req::OddLegs)) {
        fr.push_str(&math_fr);
        en.push_str(&math_en);
    } else {
        fr = format!("Fabrique une créature{adj_fr}");
        en = format!("Make a{adj_en} creature");
        if !with_fr.is_empty() {
            fr.push_str(&format!(" avec {}", join(&with_fr, "et")));
            en.push_str(&format!(" with {}", join(&with_en, "and")));
        }
        if !pow_fr.is_empty() {
            fr.push_str(&format!("{} {}", if with_fr.is_empty() { "" } else { "," }, pow_fr));
            en.push_str(&format!("{} {}", if with_en.is_empty() { "" } else { "," }, pow_en));
        }
        fr.push_str(" !");
        en.push('!');
        if !math_fr.is_empty() {
            fr.push_str(&format!(" {math_fr}"));
            en.push_str(&format!(" {math_en}"));
        }
    }
    Some(Challenge { id: String::new(), band: band.to_string(), skill: skill.to_string(), icon: icon.to_string(), text: Phrase { fr, en }, reqs })
}

/// A brand new challenge for an age band: same seed, same challenge, always buildable.
pub fn generate(band: &str, seed: f64) -> Challenge {
    let band = match band {
        "middle" | "big" => band,
        _ => "little",
    };
    for attempt in 0..40 {
        let mut r = Rng::new(seed + f64::from(attempt) * 977.0);
        if let Some(mut ch) = build(band, &mut r) {
            ch.id = format!("g{}", seed.abs().floor() as u64);
            return ch;
        }
    }
    Challenge {
        id: format!("g{}", seed.abs().floor() as u64),
        band: band.to_string(),
        skill: "counting".into(),
        icon: "👀".into(),
        text: Phrase { fr: "Fabrique une créature avec 3 yeux !".into(), en: "Make a creature with 3 eyes!".into() },
        reqs: vec![Req::Eyes { n: 3 }],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_generated_challenge_can_be_solved() {
        for band in ["little", "middle", "big"] {
            for s in 0..600 {
                let ch = generate(band, f64::from(s) * 31.0 + 1.0);
                let c = solve(&ch.reqs).unwrap_or_else(|| panic!("{band} {s}: {:?}", ch.reqs));
                assert!(check(&ch.reqs, &c).iter().all(|b| *b), "{band} {s}");
                assert!(ch.text.fr.ends_with('!') && ch.text.en.ends_with('!'), "{}", ch.text.fr);
                assert!(!ch.text.fr.contains("  ") && !ch.text.en.contains("  "));
                let n = ch.reqs.len();
                assert!(n >= 1 && n <= 5, "{n}");
            }
        }
    }

    #[test]
    fn generated_texts_are_varied() {
        let mut seen = std::collections::BTreeSet::new();
        for s in 0..200 {
            seen.insert(generate("middle", f64::from(s)).text.fr);
        }
        assert!(seen.len() > 120, "{}", seen.len());
    }

    #[test]
    fn same_seed_same_challenge() {
        assert_eq!(generate("big", 7.0).text.en, generate("big", 7.0).text.en);
    }

    #[test]
    fn requirements_read_back_from_json() {
        let r: Vec<Req> = serde_json::from_str(r#"[{"k":"eyes","n":3},{"k":"wings"},{"k":"power","is":"fly"}]"#).unwrap();
        let mut c = starter();
        assert_eq!(check(&r, &c), vec![false, false, false]);
        c.eyes = 3;
        c.wings = "angel".into();
        assert_eq!(check(&r, &c), vec![true, true, true]);
    }
}
