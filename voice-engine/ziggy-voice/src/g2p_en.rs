//! English phonemes as Kokoro was trained: a Rust port of misaki's English
//! G2P (`misaki/en.py`, Apache-2.0) with its gold/silver US dictionaries, a
//! spaCy-like tokenizer, a small rule tagger for the homographs of the stories
//! and espeak-ng (`en-us`) as the last resort for unknown words.

use crate::espeak::Espeak;
use crate::g2p_espeak::phonemizer_line;
use crate::g2p_fr::Phonemized;
use crate::text::split_core;
use anyhow::{Context, Result};
use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use std::sync::Mutex;
use unicode_normalization::UnicodeNormalization;

pub const VOICE: &str = "gmw/en-US";

const PRIMARY: char = 'ˈ';
const SECONDARY: char = 'ˌ';
const VOWELS: &str = "AIOQWYaiuæɑɒɔəɛɜɪʊʌᵻ";
const CONSONANTS: &str = "bdfhjklmnpstvwzðŋɡɹɾʃʒʤʧθ";
const DIPHTHONGS: &str = "AIOQWYʤʧ";
const US_TAUS: &str = "AIOWYiuæɑəɛɪɹʊʌ";
const PUNCTS: &str = ";:,.!?—…\"“”";
const NON_QUOTE_PUNCTS: &str = ";:,.!?—…";
const SUBTOKEN_JUNKS: &str = "',-._‘’/";

fn is_vowel(c: char) -> bool {
    VOWELS.contains(c)
}

#[derive(Clone, Debug)]
pub enum Entry {
    Word(String),
    ByTag(BTreeMap<String, Option<String>>),
}

// ── stress ────────────────────────────────────────────────────────────────

fn restress(ps: &str) -> String {
    let chars: Vec<char> = ps.chars().collect();
    let mut keyed: Vec<(f64, char)> = chars.iter().enumerate().map(|(i, &c)| (i as f64, c)).collect();
    for (i, &c) in chars.iter().enumerate() {
        if c == PRIMARY || c == SECONDARY {
            if let Some(j) = chars[i..].iter().position(|&v| is_vowel(v)) {
                keyed[i] = ((i + j) as f64 - 0.5, c);
            }
        }
    }
    keyed.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap().then(a.1.cmp(&b.1)));
    keyed.into_iter().map(|(_, c)| c).collect()
}

/// misaki `apply_stress`.
pub fn apply_stress(ps: &str, stress: Option<f64>) -> String {
    let Some(stress) = stress else { return ps.to_string() };
    let has_p = ps.contains(PRIMARY);
    let has_s = ps.contains(SECONDARY);
    if stress < -1.0 {
        return ps.replace([PRIMARY, SECONDARY], "");
    }
    if stress == -1.0 || ((stress == 0.0 || stress == -0.5) && has_p) {
        return ps.replace(SECONDARY, "").replace(PRIMARY, &SECONDARY.to_string());
    }
    if (stress == 0.0 || stress == 0.5 || stress == 1.0) && !has_p && !has_s {
        if !ps.chars().any(is_vowel) {
            return ps.to_string();
        }
        return restress(&format!("{SECONDARY}{ps}"));
    }
    if stress >= 1.0 && !has_p && has_s {
        return ps.replace(SECONDARY, &PRIMARY.to_string());
    }
    if stress > 1.0 && !has_p && !has_s {
        if !ps.chars().any(is_vowel) {
            return ps.to_string();
        }
        return restress(&format!("{PRIMARY}{ps}"));
    }
    ps.to_string()
}

fn stress_weight(ps: &str) -> usize {
    ps.chars().map(|c| if DIPHTHONGS.contains(c) { 2 } else { 1 }).sum()
}

// ── Python string helpers ─────────────────────────────────────────────────

fn py_lower(s: &str) -> String {
    s.to_lowercase()
}
fn py_upper(s: &str) -> String {
    s.to_uppercase()
}
fn py_capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(f) => f.to_uppercase().chain(c.as_str().to_lowercase().chars()).collect(),
        None => String::new(),
    }
}
fn py_isalpha(s: &str) -> bool {
    !s.is_empty() && s.chars().all(char::is_alphabetic)
}
fn lexicon_ord(c: char) -> bool {
    c == '\'' || c == '-' || c.is_ascii_alphabetic()
}

#[derive(Clone, Copy, Debug, Default)]
pub struct Ctx {
    pub future_vowel: Option<bool>,
    pub future_to: bool,
}

pub struct Lexicon {
    golds: HashMap<String, Entry>,
    silvers: HashMap<String, Entry>,
}

fn grow(d: HashMap<String, Entry>) -> HashMap<String, Entry> {
    let mut e: HashMap<String, Entry> = HashMap::new();
    for (k, v) in &d {
        if k.chars().count() < 2 {
            continue;
        }
        if *k == py_lower(k) {
            if *k != py_capitalize(k) {
                e.insert(py_capitalize(k), v.clone());
            }
        } else if *k == py_capitalize(&py_lower(k)) {
            e.insert(py_lower(k), v.clone());
        }
    }
    e.extend(d);
    e
}

fn load_dict(path: &Path) -> Result<HashMap<String, Entry>> {
    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?)?;
    let o = v.as_object().context("dictionary")?;
    let mut d = HashMap::with_capacity(o.len());
    for (k, v) in o {
        let e = match v {
            serde_json::Value::String(s) => Entry::Word(s.clone()),
            serde_json::Value::Object(m) => {
                Entry::ByTag(m.iter().map(|(t, p)| (t.clone(), p.as_str().map(str::to_string))).collect())
            }
            _ => continue,
        };
        d.insert(k.clone(), e);
    }
    Ok(grow(d))
}

fn parent_tag(tag: &str) -> String {
    if tag.starts_with("VB") {
        "VERB".into()
    } else if tag.starts_with("NN") {
        "NOUN".into()
    } else if tag.starts_with("ADV") || tag.starts_with("RB") {
        "ADV".into()
    } else if tag.starts_with("ADJ") || tag.starts_with("JJ") {
        "ADJ".into()
    } else {
        tag.into()
    }
}

type Got = Option<(String, i32)>;

impl Lexicon {
    pub fn load(dir: &Path) -> Result<Self> {
        Ok(Self { golds: load_dict(&dir.join("us_gold.json"))?, silvers: load_dict(&dir.join("us_silver.json"))? })
    }

    fn gold_word(&self, w: &str) -> Option<String> {
        match self.golds.get(w) {
            Some(Entry::Word(s)) => Some(s.clone()),
            _ => None,
        }
    }

    fn get_nnp(&self, word: &str) -> Got {
        let mut ps = String::new();
        for c in word.chars().filter(|c| c.is_alphabetic()) {
            ps.push_str(&self.gold_word(&c.to_uppercase().to_string())?);
        }
        let ps = apply_stress(&ps, Some(0.0));
        let ps = match ps.rfind(SECONDARY) {
            Some(i) => format!("{}{PRIMARY}{}", &ps[..i], &ps[i + SECONDARY.len_utf8()..]),
            None => ps,
        };
        Some((ps, 3))
    }

    fn special_case(&self, word: &str, tag: &str, stress: Option<f64>, ctx: Ctx) -> Got {
        let symbol = match word {
            "%" => Some("percent"),
            "&" => Some("and"),
            "+" => Some("plus"),
            "@" => Some("at"),
            _ => None,
        };
        if let Some(w) = symbol {
            return self.lookup(w, "", None, Some(ctx));
        }
        match word {
            "a" | "A" => return Some((if tag == "DT" { "ɐ".into() } else { "ˈA".into() }, 4)),
            "am" | "Am" | "AM" => {
                if tag.starts_with("NN") {
                    return self.get_nnp(word);
                }
                if ctx.future_vowel.is_none() || word != "am" || stress.is_some_and(|s| s > 0.0) {
                    return Some((self.gold_word("am")?, 4));
                }
                return Some(("ɐm".into(), 4));
            }
            "an" | "An" | "AN" => {
                if word == "AN" && tag.starts_with("NN") {
                    return self.get_nnp(word);
                }
                return Some(("ɐn".into(), 4));
            }
            "I" if tag == "PRP" => return Some((format!("{SECONDARY}I"), 4)),
            "by" | "By" | "BY" if parent_tag(tag) == "ADV" => return Some(("bˈI".into(), 4)),
            _ => {}
        }
        if word == "to" || word == "To" || (word == "TO" && (tag == "TO" || tag == "IN")) {
            return Some((
                match ctx.future_vowel {
                    None => self.gold_word("to")?,
                    Some(false) => "tə".into(),
                    Some(true) => "tʊ".into(),
                },
                4,
            ));
        }
        if word == "in" || word == "In" || (word == "IN" && tag != "NNP") {
            let s = if ctx.future_vowel.is_none() || tag != "IN" { "ˈ" } else { "" };
            return Some((format!("{s}ɪn"), 4));
        }
        if word == "the" || word == "The" || (word == "THE" && tag == "DT") {
            return Some((if ctx.future_vowel == Some(true) { "ði" } else { "ðə" }.into(), 4));
        }
        if word == "used" || word == "Used" || word == "USED" {
            if let Some(Entry::ByTag(m)) = self.golds.get("used") {
                let k = if (tag == "VBD" || tag == "JJ") && ctx.future_to { "VBD" } else { "DEFAULT" };
                return Some((m.get(k).cloned().flatten()?, 4));
            }
        }
        None
    }

    fn is_known(&self, word: &str) -> bool {
        if self.golds.contains_key(word) || self.silvers.contains_key(word) {
            return true;
        }
        if !py_isalpha(word) || !word.chars().all(lexicon_ord) {
            return false;
        }
        if word.chars().count() == 1 {
            return true;
        }
        if word == py_upper(word) && self.golds.contains_key(&py_lower(word)) {
            return true;
        }
        let rest: String = word.chars().skip(1).collect();
        rest == py_upper(&rest)
    }

    fn lookup(&self, word: &str, tag: &str, stress: Option<f64>, ctx: Option<Ctx>) -> Got {
        let mut word = word.to_string();
        let mut is_nnp = false;
        if word == py_upper(&word) && !self.golds.contains_key(&word) {
            word = py_lower(&word);
            is_nnp = tag == "NNP";
        }
        let mut entry = self.golds.get(&word).cloned();
        let mut rating = 4;
        if entry.is_none() && !is_nnp {
            entry = self.silvers.get(&word).cloned();
            rating = 3;
        }
        let ps: Option<String> = match entry {
            None => None,
            Some(Entry::Word(s)) => Some(s),
            Some(Entry::ByTag(m)) => {
                let t = if ctx.is_some_and(|c| c.future_vowel.is_none()) && m.contains_key("None") {
                    "None".to_string()
                } else if !m.contains_key(tag) {
                    parent_tag(tag)
                } else {
                    tag.to_string()
                };
                match m.get(&t) {
                    Some(v) => v.clone(),
                    None => m.get("DEFAULT").cloned().flatten(),
                }
            }
        };
        if ps.is_none() || (is_nnp && !ps.as_ref().unwrap().contains(PRIMARY)) {
            if let Some(r) = self.get_nnp(&word) {
                return Some(r);
            }
        }
        Some((apply_stress(&ps?, stress), rating))
    }

    fn s(stem: &str) -> Option<String> {
        let last = stem.chars().last()?;
        Some(if "ptkfθ".contains(last) {
            format!("{stem}s")
        } else if "szʃʒʧʤ".contains(last) {
            format!("{stem}ᵻz")
        } else {
            format!("{stem}z")
        })
    }

    fn stem_s(&self, word: &str, tag: &str, stress: Option<f64>, ctx: Option<Ctx>) -> Got {
        let n = word.chars().count();
        if n < 3 || !word.ends_with('s') {
            return None;
        }
        let stem = if !word.ends_with("ss") && self.is_known(&word[..word.len() - 1]) {
            word[..word.len() - 1].to_string()
        } else if (word.ends_with("'s") || (n > 4 && word.ends_with("es") && !word.ends_with("ies")))
            && self.is_known(&word[..word.len() - 2])
        {
            word[..word.len() - 2].to_string()
        } else if n > 4 && word.ends_with("ies") && self.is_known(&format!("{}y", &word[..word.len() - 3])) {
            format!("{}y", &word[..word.len() - 3])
        } else {
            return None;
        };
        let (ps, r) = self.lookup(&stem, tag, stress, ctx)?;
        Some((Self::s(&ps)?, r))
    }

    fn ed(stem: &str) -> Option<String> {
        let cs: Vec<char> = stem.chars().collect();
        let last = *cs.last()?;
        Some(if "pkfθʃsʧ".contains(last) {
            format!("{stem}t")
        } else if last == 'd' {
            format!("{stem}ᵻd")
        } else if last != 't' {
            format!("{stem}d")
        } else if cs.len() < 2 {
            format!("{stem}ɪd")
        } else if US_TAUS.contains(cs[cs.len() - 2]) {
            format!("{}ɾᵻd", cs[..cs.len() - 1].iter().collect::<String>())
        } else {
            format!("{stem}ᵻd")
        })
    }

    fn stem_ed(&self, word: &str, tag: &str, stress: Option<f64>, ctx: Option<Ctx>) -> Got {
        let n = word.chars().count();
        if n < 4 || !word.ends_with('d') {
            return None;
        }
        let stem = if !word.ends_with("dd") && self.is_known(&word[..word.len() - 1]) {
            word[..word.len() - 1].to_string()
        } else if n > 4 && word.ends_with("ed") && !word.ends_with("eed") && self.is_known(&word[..word.len() - 2]) {
            word[..word.len() - 2].to_string()
        } else {
            return None;
        };
        let (ps, r) = self.lookup(&stem, tag, stress, ctx)?;
        Some((Self::ed(&ps)?, r))
    }

    fn ing(stem: &str) -> Option<String> {
        let cs: Vec<char> = stem.chars().collect();
        if cs.is_empty() {
            return None;
        }
        if cs.len() > 1 && cs[cs.len() - 1] == 't' && US_TAUS.contains(cs[cs.len() - 2]) {
            return Some(format!("{}ɾɪŋ", cs[..cs.len() - 1].iter().collect::<String>()));
        }
        Some(format!("{stem}ɪŋ"))
    }

    fn stem_ing(&self, word: &str, tag: &str, stress: Option<f64>, ctx: Option<Ctx>) -> Got {
        let n = word.chars().count();
        if n < 5 || !word.ends_with("ing") {
            return None;
        }
        let base = &word[..word.len() - 3];
        let doubled = {
            let cs: Vec<char> = word.chars().collect();
            (n > 5 && cs.len() >= 5 && cs[n - 4] == cs[n - 5] && "bcdgklmnprstvxz".contains(cs[n - 4]))
                || word.ends_with("cking")
        };
        let stem = if n > 5 && self.is_known(base) {
            base.to_string()
        } else if self.is_known(&format!("{base}e")) {
            format!("{base}e")
        } else if n > 5 && doubled && self.is_known(&word[..word.len() - 4]) {
            word[..word.len() - 4].to_string()
        } else {
            return None;
        };
        let (ps, r) = self.lookup(&stem, tag, stress, ctx)?;
        Some((Self::ing(&ps)?, r))
    }

    fn get_word(&self, word: &str, tag: &str, stress: Option<f64>, ctx: Ctx) -> Got {
        if let Some(r) = self.special_case(word, tag, stress, ctx) {
            return Some(r);
        }
        let mut word = word.to_string();
        let wl = py_lower(&word);
        let rest: String = word.chars().skip(1).collect();
        if word.chars().count() > 1
            && py_isalpha(&word.replace('\'', ""))
            && word != wl
            && (tag != "NNP" || word.chars().count() > 7)
            && !self.golds.contains_key(&word)
            && !self.silvers.contains_key(&word)
            && (word == py_upper(&word) || rest == py_lower(&rest))
            && (self.golds.contains_key(&wl)
                || self.silvers.contains_key(&wl)
                || self.stem_s(&wl, tag, stress, Some(ctx)).is_some()
                || self.stem_ed(&wl, tag, stress, Some(ctx)).is_some()
                || self.stem_ing(&wl, tag, stress, Some(ctx)).is_some())
        {
            word = wl;
        }
        if self.is_known(&word) {
            return self.lookup(&word, tag, stress, Some(ctx));
        }
        if word.ends_with("s'") && self.is_known(&format!("{}'s", &word[..word.len() - 2])) {
            return self.lookup(&format!("{}'s", &word[..word.len() - 2]), tag, stress, Some(ctx));
        }
        if word.ends_with('\'') && self.is_known(&word[..word.len() - 1]) {
            return self.lookup(&word[..word.len() - 1], tag, stress, Some(ctx));
        }
        if let Some(r) = self.stem_s(&word, tag, stress, Some(ctx)) {
            return Some(r);
        }
        if let Some(r) = self.stem_ed(&word, tag, stress, Some(ctx)) {
            return Some(r);
        }
        self.stem_ing(&word, tag, Some(stress.unwrap_or(0.5)), Some(ctx))
    }

    /// misaki `Lexicon.__call__` (numbers are spelled out before G2P).
    pub fn call(&self, text: &str, tag: &str, tk_stress: Option<f64>, ctx: Ctx) -> Got {
        let word: String = text.replace(['‘', '’'], "'").nfkc().collect();
        let stress = if word == py_lower(&word) {
            None
        } else if word == py_upper(&word) {
            Some(2.0)
        } else {
            Some(0.5)
        };
        let (ps, r) = self.get_word(&word, tag, stress, ctx)?;
        Some((apply_stress(&ps, tk_stress), r))
    }
}

// ── tokens ────────────────────────────────────────────────────────────────

#[derive(Clone, Debug, Default)]
pub struct MTok {
    pub text: String,
    pub tag: String,
    pub ws: String,
    pub phonemes: Option<String>,
    pub is_head: bool,
    pub prespace: bool,
    pub rating: Option<i32>,
}

fn merge(tokens: &[MTok], unk: Option<&str>) -> MTok {
    let mut phonemes = None;
    if let Some(unk) = unk {
        let mut p = String::new();
        for tk in tokens {
            if tk.prespace
                && !p.is_empty()
                && !p.ends_with(char::is_whitespace)
                && tk.phonemes.as_deref().is_some_and(|x| !x.is_empty())
            {
                p.push(' ');
            }
            p.push_str(tk.phonemes.as_deref().unwrap_or(unk));
        }
        phonemes = Some(p);
    }
    let mut text = String::new();
    for (k, tk) in tokens.iter().enumerate() {
        text.push_str(&tk.text);
        if k + 1 < tokens.len() {
            text.push_str(&tk.ws);
        }
    }
    // the tag of the most "upper-case" token (the first one on ties)
    let weight =
        |tk: &MTok| tk.text.chars().map(|c| if c.to_lowercase().eq(std::iter::once(c)) { 1 } else { 2 }).sum::<usize>();
    let mut best: Option<&MTok> = None;
    for tk in tokens {
        if best.is_none_or(|b| weight(tk) > weight(b)) {
            best = Some(tk);
        }
    }
    let tag = best.map(|t| t.tag.clone()).unwrap_or_default();
    let ratings: Vec<Option<i32>> = tokens.iter().map(|t| t.rating).collect();
    MTok {
        text,
        tag,
        ws: tokens.last().map(|t| t.ws.clone()).unwrap_or_default(),
        phonemes,
        is_head: tokens.first().is_some_and(|t| t.is_head),
        prespace: tokens.first().is_some_and(|t| t.prespace),
        rating: if ratings.contains(&None) { None } else { ratings.into_iter().flatten().min() },
    }
}

/// misaki's `subtokenize` regex, by hand (no look-arounds in Rust's regex).
pub fn subtokenize(word: &str) -> Vec<String> {
    let cs: Vec<char> = word.chars().collect();
    let n = cs.len();
    let apos = |c: char| matches!(c, '\'' | '‘' | '’');
    let mut out = Vec::new();
    let mut i = 0;
    while i < n {
        let c = cs[i];
        // 1. leading apostrophes
        if i == 0 && apos(c) {
            let mut j = i;
            while j < n && apos(cs[j]) {
                j += 1;
            }
            out.push(cs[i..j].iter().collect());
            i = j;
            continue;
        }
        // 2. an upper-case letter before Upper+lower
        if c.is_uppercase() && i + 2 < n && cs[i + 1].is_uppercase() && cs[i + 2].is_lowercase() {
            out.push(c.to_string());
            i += 1;
            continue;
        }
        // 3. numbers
        if c.is_ascii_digit() || (c == '-' && i == 0 && i + 1 < n && cs[i + 1].is_ascii_digit()) {
            let mut j = i + 1;
            while j < n
                && (cs[j].is_ascii_digit()
                    || ((cs[j] == ',' || cs[j] == '.') && j + 1 < n && cs[j + 1].is_ascii_digit()))
            {
                j += 1;
            }
            out.push(cs[i..j].iter().collect());
            i = j;
            continue;
        }
        // 4. hyphens / underscores
        if c == '-' || c == '_' {
            let mut j = i;
            while j < n && (cs[j] == '-' || cs[j] == '_') {
                j += 1;
            }
            out.push(cs[i..j].iter().collect());
            i = j;
            continue;
        }
        // 5. two or more apostrophes
        if apos(c) && i + 1 < n && apos(cs[i + 1]) {
            let mut j = i;
            while j < n && apos(cs[j]) {
                j += 1;
            }
            out.push(cs[i..j].iter().collect());
            i = j;
            continue;
        }
        if c.is_alphabetic() {
            // the word span: letters, with inner apostrophe+letter pairs
            let mut j = i;
            while j < n {
                if cs[j].is_alphabetic() {
                    j += 1;
                } else if apos(cs[j]) && j + 1 < n && cs[j + 1].is_alphabetic() {
                    j += 2;
                } else {
                    break;
                }
            }
            // 6. camelCase: cut after a lower-case letter followed by an upper-case one
            let cut = (i..j.saturating_sub(1)).find(|&k| cs[k].is_lowercase() && cs[k + 1].is_uppercase());
            let e = cut.map(|k| k + 1).unwrap_or(j);
            out.push(cs[i..e].iter().collect());
            i = e;
            continue;
        }
        // 8. any other single character
        if !apos(c) {
            out.push(c.to_string());
            i += 1;
            continue;
        }
        // 9. trailing apostrophes
        if cs[i..].iter().all(|&x| apos(x)) {
            out.push(cs[i..].iter().collect());
            break;
        }
        i += 1; // a lone inner apostrophe is dropped, like the regex does
    }
    out
}

/// A spaCy-like English tokenizer (blank `en`): prefixes, suffixes (`'s`),
/// infixes (hyphens), contractions. Returns `(text, whitespace)`.
pub fn spacy_like(text: &str) -> Vec<(String, String)> {
    const PREFIX: &str = "“\"'([{«‘*<¡¿";
    const SUFFIX: &str = ",.!?;:”\"')]}»’…%";
    let mut out: Vec<(String, String)> = Vec::new();
    let chunks: Vec<&str> = text.split(' ').collect();
    for (ci, chunk) in chunks.iter().enumerate() {
        if chunk.is_empty() {
            continue;
        }
        let ws = if ci + 1 < chunks.len() { " " } else { "" };
        let mut pre: Vec<String> = Vec::new();
        let mut suf: Vec<String> = Vec::new();
        let mut s: &str = chunk;
        loop {
            if let Some(sp) = special(s) {
                // contraction: split it and stop
                let mut mid: Vec<String> = sp;
                let mut all = std::mem::take(&mut pre);
                all.append(&mut mid);
                suf.reverse();
                all.append(&mut suf);
                push_all(&mut out, all, ws);
                s = "";
                break;
            }
            let changed;
            if s.starts_with("...") && s.len() > 3 {
                pre.push("...".into());
                s = &s[3..];
                changed = true;
            } else if let Some(c) = s.chars().next().filter(|c| PREFIX.contains(*c) && s.chars().count() > 1) {
                pre.push(c.to_string());
                s = &s[c.len_utf8()..];
                changed = true;
            } else if s.ends_with("...") && s.len() > 3 {
                suf.push("...".into());
                s = &s[..s.len() - 3];
                changed = true;
            } else if (s.ends_with("'s") || s.ends_with("'S") || s.ends_with("’s") || s.ends_with("’S"))
                && s.chars().count() > 2
            {
                let k = s.char_indices().rev().nth(1).unwrap().0;
                suf.push(s[k..].to_string());
                s = &s[..k];
                changed = true;
            } else if let Some(c) = s.chars().last().filter(|c| SUFFIX.contains(*c) && s.chars().count() > 1) {
                suf.push(c.to_string());
                s = &s[..s.len() - c.len_utf8()];
                changed = true;
            } else {
                changed = false;
            }
            if !changed {
                break;
            }
        }
        if s.is_empty() && pre.is_empty() && suf.is_empty() {
            continue;
        }
        if !s.is_empty() || !pre.is_empty() || !suf.is_empty() {
            let mut all = pre;
            if !s.is_empty() {
                all.extend(infix(s));
            }
            suf.reverse();
            all.extend(suf);
            if !all.is_empty() {
                push_all(&mut out, all, ws);
            }
        }
    }
    out
}

fn push_all(out: &mut Vec<(String, String)>, all: Vec<String>, ws: &str) {
    let n = all.len();
    for (k, t) in all.into_iter().enumerate() {
        out.push((t, if k + 1 == n { ws.to_string() } else { String::new() }));
    }
}

/// Hyphens and dashes between letters, ellipses inside a word.
fn infix(s: &str) -> Vec<String> {
    let cs: Vec<char> = s.chars().collect();
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut i = 0;
    while i < cs.len() {
        let c = cs[i];
        let between = i > 0 && i + 1 < cs.len() && cs[i - 1].is_alphanumeric() && cs[i + 1].is_alphabetic();
        if (matches!(c, '-' | '–' | '—') && between) || c == '…' {
            if !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
            out.push(c.to_string());
        } else {
            cur.push(c);
        }
        i += 1;
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

/// spaCy's English contraction exceptions (the forms of these stories).
fn special(s: &str) -> Option<Vec<String>> {
    let low = s.to_lowercase().replace('’', "'");
    if !low.chars().all(|c| c.is_alphabetic() || c == '\'') {
        return None;
    }
    let split_at = |k: usize| -> Vec<String> {
        let cut = s.char_indices().nth(k).map(|(i, _)| i).unwrap_or(s.len());
        vec![s[..cut].to_string(), s[cut..].to_string()]
    };
    let n = low.chars().count();
    match low.as_str() {
        "can't" => return Some(split_at(2)),
        "won't" => return Some(split_at(2)),
        "let's" => return Some(split_at(3)),
        _ => {}
    }
    for suf in ["n't"] {
        if low.ends_with(suf) && n > 3 {
            return Some(split_at(n - 3));
        }
    }
    for suf in ["'m", "'re", "'ve", "'ll", "'d"] {
        if low.ends_with(suf) && n > suf.chars().count() {
            let base = &low[..low.len() - suf.len()];
            if ["i", "you", "we", "they", "he", "she", "it", "that", "there", "who", "what"].contains(&base) {
                return Some(split_at(n - suf.chars().count()));
            }
        }
    }
    None
}

/// The small rule tagger of the stories (no spaCy model can be downloaded).
pub fn tag(toks: &[(String, String)]) -> Vec<String> {
    const DT: [&str; 12] =
        ["a", "an", "the", "this", "these", "those", "every", "each", "some", "any", "no", "another"];
    const IN: [&str; 11] = ["in", "by", "of", "on", "at", "with", "from", "under", "over", "into", "for"];
    const POSS: [&str; 10] = ["a", "an", "the", "his", "her", "their", "my", "your", "our", "its"];
    const BE: [&str; 12] = ["is", "was", "are", "were", "be", "so", "very", "too", "come", "came", "comes", "get"];
    let punct = |x: &str| -> Option<&'static str> {
        Some(match x {
            "," => ",",
            "." | "!" | "?" => ".",
            ":" | ";" | "—" | "–" | "-" | "…" | "..." => ":",
            "“" => "``",
            "”" => "''",
            "(" => "-LRB-",
            ")" => "-RRB-",
            _ => return None,
        })
    };
    let mut out = Vec::with_capacity(toks.len());
    for (k, (x, _)) in toks.iter().enumerate() {
        let low = x.to_lowercase();
        let prev = if k > 0 { toks[k - 1].0.to_lowercase() } else { String::new() };
        let nxt = toks.get(k + 1).map(|t| t.0.to_lowercase()).unwrap_or_default();
        let t = if let Some(p) = punct(x) {
            p.to_string()
        } else if x == "\"" {
            if k == 0 || !toks[k - 1].1.is_empty() {
                "``".into()
            } else {
                "''".into()
            }
        } else if !x.is_empty() && x.chars().all(|c| c.is_ascii_digit() || c == '.' || c == ',') {
            "CD".into()
        } else if DT.contains(&low.as_str()) || (x == "That" && nxt.chars().next().is_some_and(char::is_alphabetic)) {
            "DT".into()
        } else if x == "I" {
            "PRP".into()
        } else if low == "to" {
            "TO".into()
        } else if IN.contains(&low.as_str()) {
            "IN".into()
        } else if (low == "live" || low == "lives") && !POSS.contains(&prev.as_str()) {
            if low == "lives" {
                "VBZ".into()
            } else {
                "VBP".into()
            }
        } else if low == "close"
            && !BE.contains(&prev.as_str())
            && prev != "got"
            && !POSS.contains(&prev.as_str())
            && !["to", "by", ",", ".", "!", "?"].contains(&nxt.as_str())
        {
            "VB".into() // "close your eyes"
        } else if x.chars().next().is_some_and(char::is_uppercase) && k > 0 {
            "NN".into()
        } else {
            String::new()
        };
        out.push(t);
    }
    out
}

enum Word {
    One(MTok),
    Many(Vec<MTok>),
}

const PUNCT_TAGS: [&str; 11] = [".", ",", "-LRB-", "-RRB-", "``", "\"\"", "''", ":", "$", "#", "NFP"];

fn retokenize(tokens: Vec<MTok>) -> Vec<Word> {
    let mut words: Vec<Word> = Vec::new();
    for token in tokens {
        let mut tks: Vec<MTok> = if token.phonemes.is_none() {
            subtokenize(&token.text)
                .into_iter()
                .map(|t| MTok {
                    text: t,
                    tag: token.tag.clone(),
                    ws: String::new(),
                    is_head: true,
                    ..Default::default()
                })
                .collect()
        } else {
            vec![token.clone()]
        };
        if tks.is_empty() {
            continue;
        }
        tks.last_mut().unwrap().ws = token.ws.clone();
        for mut tk in tks {
            if tk.phonemes.is_none() {
                if tk.tag == ":" && (tk.text == "-" || tk.text == "–") {
                    tk.phonemes = Some("—".into());
                    tk.rating = Some(3);
                } else if PUNCT_TAGS.contains(&tk.tag.as_str())
                    && !tk.text.chars().all(|c| c.to_ascii_lowercase().is_ascii_lowercase())
                {
                    tk.phonemes = Some(match tk.tag.as_str() {
                        "-LRB-" => "(".into(),
                        "-RRB-" => ")".into(),
                        "``" => "“".into(),
                        "\"\"" | "''" => "”".into(),
                        _ => tk.text.chars().filter(|c| PUNCTS.contains(*c)).collect(),
                    });
                    tk.rating = Some(4);
                }
            }
            if tk.phonemes.is_some() {
                words.push(Word::One(tk));
            } else if let Some(Word::Many(last)) =
                words.last_mut().filter(|w| matches!(w, Word::Many(v) if v.last().is_some_and(|t| t.ws.is_empty())))
            {
                tk.is_head = false;
                last.push(tk);
            } else if !tk.ws.is_empty() {
                words.push(Word::One(tk));
            } else {
                words.push(Word::Many(vec![tk]));
            }
        }
    }
    words
        .into_iter()
        .map(|w| match w {
            Word::Many(mut v) if v.len() == 1 => Word::One(v.pop().unwrap()),
            w => w,
        })
        .collect()
}

fn token_context(ctx: Ctx, ps: Option<&str>, token_text: &str, token_tag: &str) -> Ctx {
    let mut vowel = ctx.future_vowel;
    if let Some(ps) = ps.filter(|p| !p.is_empty()) {
        if let Some(c) =
            ps.chars().find(|&c| VOWELS.contains(c) || CONSONANTS.contains(c) || NON_QUOTE_PUNCTS.contains(c))
        {
            vowel = if NON_QUOTE_PUNCTS.contains(c) { None } else { Some(VOWELS.contains(c)) };
        }
    }
    let future_to =
        token_text == "to" || token_text == "To" || (token_text == "TO" && (token_tag == "TO" || token_tag == "IN"));
    Ctx { future_vowel: vowel, future_to }
}

fn resolve_tokens(tokens: &mut [MTok]) {
    let mut text = String::new();
    for (k, tk) in tokens.iter().enumerate() {
        text.push_str(&tk.text);
        if k + 1 < tokens.len() {
            text.push_str(&tk.ws);
        }
    }
    let kinds: std::collections::BTreeSet<u8> = text
        .chars()
        .filter(|c| !SUBTOKEN_JUNKS.contains(*c))
        .map(|c| {
            if c.is_alphabetic() {
                0
            } else if c.is_ascii_digit() {
                1
            } else {
                2
            }
        })
        .collect();
    let prespace = text.contains(' ') || text.contains('/') || kinds.len() > 1;
    let n = tokens.len();
    for (i, tk) in tokens.iter_mut().enumerate() {
        if tk.phonemes.is_none() {
            if i == n - 1 && tk.text.chars().count() == 1 && NON_QUOTE_PUNCTS.contains(tk.text.as_str()) {
                tk.phonemes = Some(tk.text.clone());
                tk.rating = Some(3);
            } else if tk.text.chars().all(|c| SUBTOKEN_JUNKS.contains(c)) {
                tk.phonemes = Some(String::new());
                tk.rating = Some(3);
            }
        } else if i > 0 {
            tk.prespace = prespace;
        }
    }
    if prespace {
        return;
    }
    let mut idx: Vec<(bool, usize, usize)> = tokens
        .iter()
        .enumerate()
        .filter(|(_, t)| t.phonemes.as_deref().is_some_and(|p| !p.is_empty()))
        .map(|(i, t)| {
            (t.phonemes.as_deref().unwrap().contains(PRIMARY), stress_weight(t.phonemes.as_deref().unwrap()), i)
        })
        .collect();
    if idx.len() == 2 && tokens[idx[0].2].text.chars().count() == 1 {
        let i = idx[1].2;
        tokens[i].phonemes = Some(apply_stress(tokens[i].phonemes.as_deref().unwrap(), Some(-0.5)));
        return;
    }
    let primaries = idx.iter().filter(|x| x.0).count();
    if idx.len() < 2 || primaries <= idx.len().div_ceil(2) {
        return;
    }
    idx.sort();
    for &(_, _, i) in idx.iter().take(idx.len() / 2) {
        tokens[i].phonemes = Some(apply_stress(tokens[i].phonemes.as_deref().unwrap(), Some(-0.5)));
    }
}

/// E2M table of misaki's `EspeakFallback` (longest keys first, stable).
const E2M: [(&str, &str); 20] = [
    ("ʔˌn\u{329}", "ʔn"),
    ("ʔn\u{329}", "ʔn"),
    ("a^ɪ", "I"),
    ("a^ʊ", "W"),
    ("d^ʒ", "ʤ"),
    ("e^ɪ", "A"),
    ("t^ʃ", "ʧ"),
    ("ɔ^ɪ", "Y"),
    ("ə^l", "ᵊl"),
    ("ʲo", "jo"),
    ("ʲə", "jə"),
    ("ʲ", ""),
    ("e", "A"),
    ("ɚ", "əɹ"),
    ("r", "ɹ"),
    ("x", "k"),
    ("ç", "k"),
    ("ɐ", "ə"),
    ("ɬ", "l"),
    ("\u{303}", ""),
];

pub struct EnglishG2P<'a> {
    es: &'a Espeak,
    lex: Lexicon,
    fixes: HashMap<String, String>,
    /// words read by espeak (unknown to the dictionaries) → count
    pub oov: Mutex<BTreeMap<String, usize>>,
}

impl<'a> EnglishG2P<'a> {
    pub fn new(es: &'a Espeak, misaki_dir: &Path, fixes: HashMap<String, String>) -> Result<Self> {
        Ok(Self { es, lex: Lexicon::load(misaki_dir)?, fixes, oov: Mutex::new(BTreeMap::new()) })
    }

    fn fallback(&self, text: &str) -> Result<Option<String>> {
        let Some(ps) = phonemizer_line(self.es, VOICE, text, false)? else { return Ok(None) };
        let mut ps = ps.trim().to_string();
        for (o, n) in E2M {
            ps = ps.replace(o, n);
        }
        // (\S)̩ → ᵊ\1
        let cs: Vec<char> = ps.chars().collect();
        let mut s = String::new();
        let mut k = 0;
        while k < cs.len() {
            if k + 1 < cs.len() && cs[k + 1] == '\u{329}' && !cs[k].is_whitespace() {
                s.push('ᵊ');
                s.push(cs[k]);
                k += 2;
            } else {
                s.push(cs[k]);
                k += 1;
            }
        }
        ps = s.replace('\u{329}', "");
        ps = ps.replace("o^ʊ", "O").replace("ɜːɹ", "ɜɹ").replace("ɜː", "ɜɹ").replace("ɪə", "iə").replace('ː', "");
        ps = ps.replace('o', "ɔ").replace('ɾ', "T").replace('ʔ', "t");
        Ok(Some(ps.replace('^', "")))
    }

    pub fn fix(&self, core: &str) -> Option<String> {
        let core = core.replace('’', "'");
        if let Some(h) = self.fixes.get(&core).or_else(|| self.fixes.get(&core.to_lowercase())) {
            return Some(h.clone());
        }
        let base = core.strip_suffix("'s")?;
        let b = self.fixes.get(base).or_else(|| self.fixes.get(&base.to_lowercase()))?;
        let tail = crate::align::letters(b).last().copied().unwrap_or(' ');
        Some(format!(
            "{b}{}",
            if "szʃʒʧʤ".contains(tail) {
                "ᵻz"
            } else if "ptkfθ".contains(tail) {
                "s"
            } else {
                "z"
            }
        ))
    }

    /// misaki `G2P.__call__` on `text` whose tokens `fixed[k]` carry forced phonemes.
    fn g2p(&self, plain_toks: &[String], fixed: &[Option<String>]) -> Result<(String, Vec<MTok>)> {
        // spaCy tokens of each whitespace token, tagged on the whole sentence
        let text = plain_toks.join(" ");
        let sp = spacy_like(&text);
        let tags = tag(&sp);
        // map spaCy tokens to whitespace tokens by char offset (a spoken
        // number can hold spaces: "one hundred twenty")
        let mut ends = Vec::with_capacity(plain_toks.len());
        let mut pos = 0usize;
        for t in plain_toks {
            pos += t.len();
            ends.push(pos);
            pos += 1;
        }
        let mut owner = Vec::with_capacity(sp.len());
        let mut cursor = 0usize;
        for (t, _) in &sp {
            let at = text[cursor..].find(t.as_str()).map(|i| cursor + i).unwrap_or(cursor);
            owner.push(ends.iter().position(|&e| at < e).unwrap_or(plain_toks.len().saturating_sub(1)));
            cursor = at + t.len();
        }
        let mut tokens: Vec<MTok> = Vec::with_capacity(sp.len());
        let mut first_of: HashMap<usize, bool> = HashMap::new();
        for (k, ((t, ws), tg)) in sp.iter().zip(&tags).enumerate() {
            let w = owner[k];
            let mut tk = MTok { text: t.clone(), tag: tg.clone(), ws: ws.clone(), is_head: true, ..Default::default() };
            if let Some(Some(ps)) = fixed.get(w) {
                // the core word: punctuation around it keeps its own tokens
                let (_, core, _) = split_core(&plain_toks[w]);
                if t.chars().any(char::is_alphanumeric) && core.contains(t.as_str()) {
                    let first = !first_of.contains_key(&w);
                    first_of.insert(w, true);
                    tk.is_head = first;
                    tk.phonemes = Some(if first { ps.clone() } else { String::new() });
                    tk.rating = Some(5);
                }
            }
            tokens.push(tk);
        }
        // fold_left
        let mut folded: Vec<MTok> = Vec::new();
        for tk in tokens {
            if !tk.is_head && !folded.is_empty() {
                let prev = folded.pop().unwrap();
                folded.push(merge(&[prev, tk], Some("❓")));
            } else {
                folded.push(tk);
            }
        }
        let mut words = retokenize(folded);
        let mut ctx = Ctx::default();
        for w in words.iter_mut().rev() {
            match w {
                Word::One(tk) => {
                    if tk.phonemes.is_none() {
                        if let Some((p, r)) = self.lex.call(&tk.text, &tk.tag, None, ctx) {
                            tk.phonemes = Some(p);
                            tk.rating = Some(r);
                        }
                    }
                    if tk.phonemes.is_none() {
                        tk.phonemes = self.fallback(&tk.text)?;
                        tk.rating = Some(2);
                        *self.oov.lock().unwrap().entry(tk.text.clone()).or_default() += 1;
                    }
                    ctx = token_context(ctx, tk.phonemes.as_deref(), &tk.text, &tk.tag);
                }
                Word::Many(v) => {
                    let (mut left, mut right) = (0usize, v.len());
                    let mut should_fallback = false;
                    while left < right {
                        let got = if v[left..right].iter().any(|t| t.phonemes.is_some()) {
                            None
                        } else {
                            let m = merge(&v[left..right], None);
                            self.lex.call(&m.text, &m.tag, None, ctx).map(|g| (g, m))
                        };
                        if let Some(((ps, r), m)) = got {
                            v[left].phonemes = Some(ps.clone());
                            v[left].rating = Some(r);
                            for x in v[left + 1..right].iter_mut() {
                                x.phonemes = Some(String::new());
                            }
                            ctx = token_context(ctx, Some(&ps), &m.text, &m.tag);
                            right = left;
                            left = 0;
                        } else if left + 1 < right {
                            left += 1;
                        } else {
                            right -= 1;
                            let tk = &mut v[right];
                            if tk.phonemes.is_none() {
                                if tk.text.chars().all(|c| SUBTOKEN_JUNKS.contains(c)) {
                                    tk.phonemes = Some(String::new());
                                    tk.rating = Some(3);
                                } else {
                                    should_fallback = true;
                                    break;
                                }
                            }
                            left = 0;
                        }
                    }
                    if should_fallback {
                        let m = merge(v, None);
                        let ps = self.fallback(&m.text)?;
                        *self.oov.lock().unwrap().entry(m.text.clone()).or_default() += 1;
                        v[0].phonemes = ps;
                        v[0].rating = Some(2);
                        for x in v[1..].iter_mut() {
                            x.phonemes = Some(String::new());
                            x.rating = Some(2);
                        }
                    } else {
                        resolve_tokens(v);
                    }
                }
            }
        }
        let mut toks: Vec<MTok> = words
            .into_iter()
            .map(|w| match w {
                Word::One(t) => t,
                Word::Many(v) => merge(&v, Some("❓")),
            })
            .collect();
        for tk in &mut toks {
            if let Some(p) = &tk.phonemes {
                tk.phonemes = Some(p.replace('ɾ', "T").replace('ʔ', "t"));
            }
        }
        let mut result = String::new();
        for tk in &toks {
            result.push_str(tk.phonemes.as_deref().unwrap_or("❓"));
            result.push_str(&tk.ws);
        }
        Ok((result, toks))
    }

    /// One word said alone.
    pub fn word(&self, tok: &str) -> Result<String> {
        let (_, core, _) = split_core(tok);
        if let Some(f) = self.fix(core) {
            return Ok(f);
        }
        let n = core.replace(['’', '‘'], "'");
        Ok(self.g2p(&[n], &[None])?.0)
    }

    /// Phonemes of an utterance + where each of its tokens starts.
    pub fn utterance(&self, toks: &[String]) -> Result<Phonemized> {
        let plain: Vec<String> = toks.iter().map(|t| t.replace(['’', '‘'], "'")).collect();
        let fixed: Vec<Option<String>> = plain
            .iter()
            .map(|t| {
                let (_, core, _) = split_core(t);
                if core.is_empty() {
                    None
                } else {
                    self.fix(core)
                }
            })
            .collect();
        let (ps, mtoks) = self.g2p(&plain, &fixed)?;
        let plain_text = plain.join(" ");
        let mut ranges = Vec::new();
        let mut pos = 0usize;
        for t in &plain {
            let n = t.chars().count();
            ranges.push((pos, pos + n));
            pos += n + 1;
        }
        let pchars: Vec<char> = plain_text.chars().collect();
        let pschars: Vec<char> = ps.chars().collect();
        let mut starts: Vec<Option<usize>> = vec![None; toks.len()];
        let (mut cpos, mut ppos) = (0usize, 0usize);
        let mut ok = true;
        for mt in &mtoks {
            let tchars: Vec<char> = mt.text.chars().collect();
            let at = if tchars.is_empty() {
                Some(cpos)
            } else {
                (cpos..=pchars.len().saturating_sub(tchars.len())).find(|&k| pchars[k..k + tchars.len()] == tchars[..])
            };
            let Some(at) = at else {
                ok = false;
                break;
            };
            let ph: Vec<char> = mt.phonemes.as_deref().unwrap_or("").chars().collect();
            if pschars.get(ppos..ppos + ph.len()) != Some(&ph[..]) {
                ok = false;
                break;
            }
            let body = ph.iter().position(|c| !crate::align::PUNCT_PS.contains(c));
            if let Some(b) = body {
                if !crate::align::letters(&ph.iter().collect::<String>()).is_empty() {
                    if let Some(w) = ranges.iter().position(|&(a, e)| a <= at && at < e) {
                        if starts[w].is_none() {
                            starts[w] = Some(ppos + b);
                        }
                    }
                }
            }
            cpos = at + tchars.len();
            ppos += ph.len() + mt.ws.chars().count();
        }
        if !ok {
            let sp: Vec<usize> = (0..toks.len()).filter(|&k| crate::text::speakable(&toks[k])).collect();
            let words: Vec<String> = sp.iter().map(|&k| self.word(&toks[k])).collect::<Result<_>>()?;
            let local = crate::align::align(&words, &ps);
            starts = vec![None; toks.len()];
            for (k, s) in sp.into_iter().zip(local) {
                starts[k] = s;
            }
        }
        Ok(Phonemized { ps, starts })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stress_rules() {
        assert_eq!(apply_stress("ðə", Some(-2.0)), "ðə");
        assert_eq!(apply_stress("kˈæsᵊl", Some(-1.0)), "kˌæsᵊl");
        assert_eq!(apply_stress("kæt", Some(0.5)), "kˌæt");
        assert_eq!(apply_stress("bˌʊk", Some(2.0)), "bˈʊk");
        assert_eq!(apply_stress("stɹit", Some(2.0)), "stɹˈit");
    }

    #[test]
    fn subtokens() {
        assert_eq!(subtokenize("'s"), ["'", "s"]);
        assert_eq!(subtokenize("don't"), ["don't"]);
        assert_eq!(subtokenize("tip-toe"), ["tip", "-", "toe"]);
        assert_eq!(subtokenize("iPhone"), ["i", "Phone"]);
        assert_eq!(subtokenize("dogs'"), ["dogs", "'"]);
        assert_eq!(subtokenize("“Oh!”"), ["“", "Oh", "!", "”"]);
    }

    #[test]
    fn spacy_like_tokens() {
        let t: Vec<String> = spacy_like("“Lili's eyes!” Don't.").into_iter().map(|x| x.0).collect();
        assert_eq!(t, ["“", "Lili", "'s", "eyes", "!", "”", "Do", "n't", "."]);
        let t: Vec<String> = spacy_like("see-through, hoo-loo…").into_iter().map(|x| x.0).collect();
        assert_eq!(t, ["see", "-", "through", ",", "hoo", "-", "loo", "…"]);
    }

    #[test]
    fn tagger_homographs() {
        let toks: Vec<(String, String)> =
            ["please", "close", "your", "eyes"].iter().map(|s| (s.to_string(), " ".into())).collect();
        assert_eq!(tag(&toks)[1], "VB");
        let toks: Vec<(String, String)> = ["very", "close"].iter().map(|s| (s.to_string(), " ".into())).collect();
        assert_eq!(tag(&toks)[1], "");
    }
}
