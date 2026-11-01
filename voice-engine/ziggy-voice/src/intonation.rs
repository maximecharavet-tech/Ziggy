//! Prosody v3, part 1: what a good storyteller hears in a sentence.
//!
//! For one piece of a sentence (narration, a quote, a tag) this finds the
//! sentence type, the intonation phrases and how each one ends (continuation,
//! list item, final), the words to bring out (onomatopoeia, a character named
//! for the first time, intensifiers, numbers, the story's key words, contrast)
//! and the feeling of the sentence (joy, wonder, tenderness, gentle worry,
//! calm, sleepy — Ziggy is never sad or scary). Text only, deterministic.

use crate::text::{is_word_char, speakable, split_core};
use std::collections::HashSet;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Declarative,
    /// « Est-ce que… ? », “Do we…?”: rises at the end.
    YesNo,
    /// « Pourquoi… ? », “Why…?”: high start, falls.
    Wh,
    Exclamation,
    Imperative,
    /// « Plic, ploc ! », « Grrrrr ! »
    Onomatopoeia,
    /// Ends on « … »: left hanging.
    Suspension,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Boundary {
    /// More to come in the sentence: a rise (French H%).
    Continuation,
    /// An item of a list (rises; the last item falls).
    ListItem,
    /// The end of the sentence: shaped by its kind.
    Final,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Focus {
    Onomatopoeia,
    Name,
    Intensifier,
    Number,
    KeyWord,
    Contrast,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Emotion {
    Neutral,
    Joy,
    Wonder,
    Tenderness,
    /// Gentle concern — never sad, never scary.
    Worry,
    Calm,
    Sleepy,
}

/// Token range (inside the piece) of an intonation phrase and how it ends.
#[derive(Clone, Debug, PartialEq)]
pub struct Phrase {
    pub start: usize,
    pub end: usize,
    pub boundary: Boundary,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Intonation {
    pub kind: Kind,
    pub phrases: Vec<Phrase>,
    /// Token index (inside the piece) and why it is brought out.
    pub focus: Vec<(usize, Focus)>,
    pub emotion: Emotion,
    /// The sentence goes on after this piece (a quote before its tag…).
    pub continues: bool,
    /// Last sentence of a scene, or the outro: slower, lower, softer.
    pub landing: bool,
    /// "chuchota Lili": said low and flat.
    pub tag: bool,
    pub whisper: bool,
    /// Index (in the piece) of a sentence-initial contrast word followed by
    /// a little breath (« Mais… »).
    pub breath_after: Option<usize>,
}

impl Intonation {
    /// The part of a piece's reading for tokens [a, b) (a piece too long for
    /// the model is cut in utterances); `last`: the piece's last part.
    pub fn slice(&self, a: usize, b: usize, last: bool) -> Intonation {
        let mut phrases: Vec<Phrase> = self
            .phrases
            .iter()
            .filter(|p| p.end > a && p.start < b)
            .map(|p| Phrase { start: p.start.max(a) - a, end: p.end.min(b) - a, boundary: p.boundary })
            .collect();
        if !last {
            if let Some(p) = phrases.last_mut() {
                p.boundary = Boundary::Continuation;
            }
        }
        Intonation {
            kind: if last { self.kind } else { Kind::Declarative },
            phrases,
            focus: self.focus.iter().filter(|f| (a..b).contains(&f.0)).map(|f| (f.0 - a, f.1)).collect(),
            continues: !last || self.continues,
            breath_after: self.breath_after.filter(|&k| (a..b).contains(&k)).map(|k| k - a),
            ..self.clone()
        }
    }
}

/// What a story teaches its reader once: names already introduced, key words.
#[derive(Clone, Debug, Default)]
pub struct StoryContext {
    pub names_seen: HashSet<String>,
    pub key_words: HashSet<String>,
    /// Key words already brought out in the current scene (once per scene).
    pub key_used: HashSet<String>,
}

fn low(tok: &str) -> String {
    let (_, core, _) = split_core(tok);
    core.replace('’', "'").to_lowercase()
}

/// The punctuation after a token's word (a lone « : » counts as its own).
fn post(tok: &str) -> &str {
    if speakable(tok) {
        split_core(tok).2
    } else {
        tok
    }
}

const WH_FR: &[&str] = &[
    "qui",
    "que",
    "quoi",
    "où",
    "quand",
    "comment",
    "pourquoi",
    "combien",
    "quel",
    "quelle",
    "quels",
    "quelles",
    "lequel",
    "laquelle",
    "qu'est-ce",
    "d'où",
];
const WH_EN: &[&str] = &["who", "what", "where", "when", "why", "how", "which", "whose", "whom", "what's", "where's"];
const IMPERATIVE: &[&str] = &[
    "regarde",
    "regardez",
    "viens",
    "venez",
    "écoute",
    "écoutez",
    "dors",
    "ferme",
    "fermez",
    "respire",
    "respirez",
    "attends",
    "attendez",
    "allons",
    "fais",
    "faites",
    "dis",
    "dites",
    "prends",
    "prenez",
    "va",
    "allez",
    "pense",
    "pensez",
    "imagine",
    "souviens-toi",
    "tiens",
    "tiens-toi",
    "approche",
    "chut",
    "plante-la",
    "regardez-moi",
    "asseyez-vous",
    "look",
    "come",
    "listen",
    "sleep",
    "close",
    "breathe",
    "wait",
    "let's",
    "go",
    "take",
    "think",
    "imagine",
    "hold",
    "sit",
    "remember",
    "shh",
    "plant",
    "watch",
    "see",
];
const ONOMATOPOEIA: &[&str] = &[
    "plic", "ploc", "plouf", "boing", "cling", "clink", "ding", "dong", "splash", "boum", "boom", "toc", "tic", "tac",
    "pop", "hop", "bip", "blop", "atchoum", "achoo", "miaou", "ouaf", "cocorico", "crac", "crack", "vroum", "flap",
    "zzz", "chut", "chhh", "shh", "shhh", "bzzz", "brrr", "grrrrr", "hmm", "fff", "hou", "hoo", "waouh", "wow", "oh",
    "ah", "oups", "oops", "ouf", "youpi", "hourra", "hooray", "tweet", "cui", "pitter", "patter", "plip", "pschitt",
    "gri", "glouglou", "tchou", "toot", "whoosh", "swoosh", "ploup", "pouf", "paf", "pif",
];
const INTENSIFIERS: &[&str] = &[
    "très",
    "tellement",
    "trop",
    "vraiment",
    "super",
    "si",
    "tout",
    "toute",
    "toutes",
    "tant",
    "plein",
    "so",
    "very",
    "really",
    "too",
    "such",
    "super",
    "all",
];
const NOT_AFTER_SI: &[&str] = &[
    "je", "j'", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "le", "la", "les", "l'", "un", "une", "c'est",
];
const NUMBERS: &[&str] = &[
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "douze",
    "vingt",
    "cent",
    "cents",
    "mille",
    "million",
    "millions",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "twelve",
    "twenty",
    "hundred",
    "thousand",
    "million",
    "millions",
    "premier",
    "première",
    "first",
];
const CONTRAST: &[&str] = &["mais", "pourtant", "cependant", "but", "however", "yet"];
/// Words before which a long phrase splits (clauses).
const CLAUSE_START: &[&str] = &[
    "et", "mais", "car", "puis", "alors", "donc", "ou", "quand", "lorsque", "parce", "pendant", "tandis", "comme",
    "jusqu'à", "avant", "après", "and", "but", "so", "because", "when", "while", "then", "until", "after", "before",
    "or", "as",
];
const RELATIVES: &[&str] = &["qui", "que", "qu'", "dont", "où", "who", "which", "that", "where", "whose"];
const LIST_LAST: &[&str] = &["et", "ou", "ni", "and", "or", "nor"];
/// Words that open a noun phrase: list items look alike.
const DETERMINERS: &[&str] = &[
    "le", "la", "les", "un", "une", "des", "du", "de", "ses", "sa", "son", "mes", "ma", "mon", "tes", "ta", "ton",
    "leur", "leurs", "nos", "vos", "notre", "votre", "ce", "cet", "cette", "ces", "deux", "trois", "quelques", "a",
    "an", "the", "his", "her", "their", "my", "your", "our", "its", "some", "two", "three", "this", "that", "these",
    "those",
];
/// Fixed pairs that are not lists ("safe and sound").
const PAIRS: &[(&str, &str)] =
    &[("nice", "warm"), ("safe", "sound"), ("sain", "sauf"), ("peu", "peu"), ("little", "little"), ("bien", "bien")];
const PREPOSITIONS: &[&str] = &[
    "dans",
    "sur",
    "sous",
    "avec",
    "pour",
    "vers",
    "chez",
    "contre",
    "derrière",
    "devant",
    "entre",
    "par",
    "près",
    "in",
    "on",
    "under",
    "with",
    "for",
    "towards",
    "behind",
    "between",
    "into",
    "over",
    "through",
    "across",
    "near",
];
/// Frequent words that are never a story's key word.
const NOT_KEY: &[&str] = &[
    "quand",
    "comme",
    "alors",
    "aussi",
    "encore",
    "toujours",
    "jamais",
    "chaque",
    "quelque",
    "parce",
    "pendant",
    "était",
    "avait",
    "étaient",
    "avaient",
    "sommes",
    "êtes",
    "peut",
    "faire",
    "fait",
    "faites",
    "petit",
    "petite",
    "petits",
    "petites",
    "grand",
    "grande",
    "beaux",
    "belles",
    "belle",
    "plus",
    "moins",
    "tellement",
    "every",
    "always",
    "never",
    "there",
    "their",
    "about",
    "would",
    "could",
    "should",
    "because",
    "while",
    "little",
    "great",
    "really",
    "after",
    "before",
    "where",
    "which",
    "these",
    "those",
    "other",
    "things",
];

pub const FUNCTION_WORDS: &[&str] = &[
    "le", "la", "les", "l'", "un", "une", "des", "du", "de", "d'", "au", "aux", "à", "et", "ou", "mais", "ce", "cet",
    "cette", "ces", "son", "sa", "ses", "mon", "ma", "mes", "ton", "ta", "tes", "leur", "leurs", "notre", "votre",
    "je", "j'", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "me", "m'", "te", "t'", "se", "s'", "lui",
    "y", "en", "ne", "n'", "pas", "que", "qu'", "qui", "dont", "où", "si", "est", "sont", "a", "ont", "c'est", "dans",
    "sur", "sous", "avec", "pour", "par", "the", "a", "an", "of", "to", "in", "on", "at", "and", "or", "but", "is",
    "are", "was", "were", "be", "it", "its", "he", "she", "they", "we", "you", "i", "his", "her", "their", "my",
    "your", "our", "this", "that", "with", "for", "from", "by", "as", "not", "do", "did", "does", "has", "had", "have",
    "him", "them", "me", "us", "so", "very", "too",
];

const JOY: &[&str] = &[
    "rit",
    "riait",
    "rire",
    "rires",
    "joie",
    "joyeux",
    "joyeuse",
    "content",
    "contente",
    "contents",
    "heureux",
    "heureuse",
    "sourire",
    "sourit",
    "souriait",
    "bravo",
    "youpi",
    "hourra",
    "fête",
    "dansa",
    "dansaient",
    "danse",
    "chanta",
    "chantait",
    "jouer",
    "jouaient",
    "amusant",
    "génial",
    "laughed",
    "laugh",
    "laughing",
    "giggled",
    "joy",
    "happy",
    "glad",
    "smiled",
    "smile",
    "smiling",
    "hooray",
    "party",
    "danced",
    "sang",
    "played",
    "fun",
    "great",
];
const WONDER: &[&str] = &[
    "waouh",
    "oh",
    "magnifique",
    "merveilleux",
    "merveilleuse",
    "magique",
    "brillait",
    "brillaient",
    "brille",
    "scintillait",
    "scintillaient",
    "étoiles",
    "étoile",
    "incroyable",
    "extraordinaire",
    "mystère",
    "mystères",
    "secret",
    "secrets",
    "émerveillé",
    "émerveillée",
    "lumière",
    "arc-en-ciel",
    "wow",
    "wonderful",
    "amazing",
    "magic",
    "magical",
    "sparkled",
    "sparkling",
    "shone",
    "shining",
    "glowed",
    "stars",
    "star",
    "beautiful",
    "mystery",
    "mysteries",
    "secret",
    "secrets",
    "rainbow",
    "marvel",
    "incredible",
];
const TENDER: &[&str] = &[
    "doux",
    "douce",
    "doucement",
    "câlin",
    "câlins",
    "tendre",
    "tendrement",
    "bisou",
    "bisous",
    "gentil",
    "gentille",
    "gentillesse",
    "gentillesses",
    "cœur",
    "aime",
    "aimait",
    "amour",
    "amis",
    "ami",
    "amie",
    "serra",
    "blottit",
    "caresse",
    "consoler",
    "merci",
    "soft",
    "softly",
    "gently",
    "gentle",
    "hug",
    "hugged",
    "kind",
    "kindness",
    "kindnesses",
    "love",
    "loved",
    "heart",
    "friend",
    "friends",
    "cuddled",
    "snuggled",
    "thank",
    "thanks",
];
const WORRY: &[&str] = &[
    "peur",
    "inquiet",
    "inquiète",
    "seul",
    "seule",
    "perdu",
    "perdue",
    "pleurait",
    "pleure",
    "larme",
    "larmes",
    "cassé",
    "cassée",
    "fatigué",
    "fatiguée",
    "soif",
    "fâché",
    "fâchée",
    "fâchait",
    "colère",
    "triste",
    "tremblait",
    "afraid",
    "scared",
    "worried",
    "alone",
    "lost",
    "cried",
    "crying",
    "tear",
    "tears",
    "broken",
    "tired",
    "thirsty",
    "angry",
    "cross",
    "sad",
    "trembled",
    "shaking",
    "sighed",
];
const CALM: &[&str] = &[
    "calme",
    "paisible",
    "silence",
    "tranquille",
    "lentement",
    "respira",
    "respire",
    "respirer",
    "souffle",
    "vagues",
    "calm",
    "peaceful",
    "quiet",
    "quietly",
    "slowly",
    "breathed",
    "breathe",
    "breath",
    "waves",
    "still",
];
const SLEEPY: &[&str] = &[
    "dormir",
    "dort",
    "dormait",
    "endormit",
    "endormi",
    "endormie",
    "sommeil",
    "bâilla",
    "bâillant",
    "bâiller",
    "rêves",
    "rêve",
    "rêver",
    "couette",
    "dodo",
    "sleep",
    "sleeping",
    "asleep",
    "slept",
    "yawn",
    "yawned",
    "yawning",
    "dream",
    "dreams",
    "duvet",
];
/// Bedtime words that only make a sentence sleepy at the end of a scene.
const SLEEPY_SOFT: &[&str] =
    &["nuit", "lit", "yeux", "ferme", "fermer", "doucement", "night", "bed", "eyes", "close", "gently"];

/// A token said for its sound (« Plic », « Grrrrr », « Hou-lou-lou »).
pub fn is_onomatopoeia(tok: &str) -> bool {
    let w = low(tok);
    if w.is_empty() {
        return false;
    }
    if ONOMATOPOEIA.contains(&w.as_str()) {
        return true;
    }
    // a letter repeated three times (« Brrr », « Zzz »)
    let cs: Vec<char> = w.chars().collect();
    if cs.windows(3).any(|t| t[0] == t[1] && t[1] == t[2] && t[0].is_alphabetic()) {
        return true;
    }
    // a hyphenated echo (« toc-toc », « Hou-lou-lou »)
    let parts: Vec<&str> = w.split('-').collect();
    parts.len() >= 2
        && parts.iter().all(|p| ONOMATOPOEIA.contains(p) || p.len() <= 4)
        && parts.windows(2).any(|p| p[0].ends_with(&p[1][p[1].len().saturating_sub(2)..]))
}

fn is_function(w: &str) -> bool {
    FUNCTION_WORDS.contains(&w)
}

/// Sentence type from its words and final mark.
pub fn sentence_kind(locale: &str, toks: &[String]) -> Kind {
    let words: Vec<String> = toks.iter().filter(|t| speakable(t)).map(|t| low(t)).collect();
    let last_mark = toks
        .iter()
        .rev()
        .find_map(|t| t.trim_end_matches(['»', '”', '"', '’']).chars().last().filter(|c| ".!?…".contains(*c)));
    if !words.is_empty()
        && words.iter().filter(|w| ONOMATOPOEIA.contains(&w.as_str()) || is_onomatopoeia(w)).count() * 2 >= words.len()
    {
        return Kind::Onomatopoeia;
    }
    match last_mark {
        Some('?') => {
            // skip a vocative ("Lumi, pourquoi…") and fillers ("Et toi, …")
            let toks_sp: Vec<&String> = toks.iter().filter(|t| speakable(t)).collect();
            let mut head: Vec<String> = Vec::new();
            for t in &toks_sp {
                let w = low(t);
                let comma = post(t).contains(',');
                if !(comma && head.len() < 3 && !WH_FR.contains(&w.as_str()) && !WH_EN.contains(&w.as_str())) {
                    head.push(w);
                } else {
                    head.clear();
                }
                if head.len() >= 2 {
                    break;
                }
            }
            // « Est-ce que… » asks yes or no; « Qu’est-ce que… » asks what;
            // « que » alone only as the first word
            if words.iter().take(5).any(|w| w == "est-ce") {
                return Kind::YesNo;
            }
            let wh = |(n, w): (usize, &String)| {
                if locale == "fr" {
                    WH_FR.contains(&w.as_str()) && (w != "que" || n == 0)
                } else {
                    WH_EN.contains(&w.as_str())
                }
            };
            if head.iter().enumerate().any(wh) {
                Kind::Wh
            } else {
                Kind::YesNo
            }
        }
        Some('!') => {
            if words.first().is_some_and(|w| IMPERATIVE.contains(&w.as_str())) {
                Kind::Imperative
            } else {
                Kind::Exclamation
            }
        }
        Some('…') => Kind::Suspension,
        _ => {
            if words.first().is_some_and(|w| IMPERATIVE.contains(&w.as_str())) {
                Kind::Imperative
            } else {
                Kind::Declarative
            }
        }
    }
}

/// The feeling of a sentence from its words (and where it sits).
pub fn emotion(toks: &[String], landing: bool) -> Emotion {
    let words: Vec<String> = toks.iter().filter(|t| speakable(t)).map(|t| low(t)).collect();
    // « pas triste », "not sad": a negated word does not count
    let negated = |k: usize| {
        words[k.saturating_sub(2)..k]
            .iter()
            .any(|w| ["pas", "plus", "jamais", "not", "never", "no"].contains(&w.as_str()) || w.ends_with("n't"))
    };
    let count =
        |lex: &[&str]| words.iter().enumerate().filter(|(k, w)| lex.contains(&w.as_str()) && !negated(*k)).count();
    let sleepy = count(SLEEPY) + if landing { count(SLEEPY_SOFT) } else { 0 };
    // first wins on a tie: the feelings a bedtime story leans on
    let scores = [
        (Emotion::Sleepy, sleepy),
        (Emotion::Wonder, count(WONDER)),
        (Emotion::Joy, count(JOY)),
        (Emotion::Tenderness, count(TENDER)),
        (Emotion::Worry, count(WORRY)),
        (Emotion::Calm, count(CALM)),
    ];
    let mut best = (Emotion::Neutral, 0);
    for (e, n) in scores {
        if n > best.1 {
            best = (e, n);
        }
    }
    if best.1 == 0 && landing {
        return Emotion::Calm;
    }
    best.0
}

/// Intonation phrases of a piece: split at punctuation, before clause
/// words and relatives in long stretches; lists rise item by item.
pub fn phrases(toks: &[String]) -> Vec<Phrase> {
    let n = toks.len();
    let mut cuts: Vec<usize> = Vec::new(); // phrase ends (exclusive)
    let words_between = |a: usize, b: usize| (a..b).filter(|&k| speakable(&toks[k])).count();
    let mut start = 0;
    for k in 0..n {
        let p = post(&toks[k]);
        let punct = p.contains([',', ';', ':', '—', '–']) || (p.contains('…') && k + 1 < n);
        let next_is_dash = toks.get(k + 1).is_some_and(|t| t == "—" || t == "–");
        if (punct || next_is_dash) && k + 1 < n && words_between(k + 1, n) > 0 {
            cuts.push(k + 1);
            start = k + 1;
            continue;
        }
        // before a clause word / relative in a long stretch
        if k > start && k + 1 < n {
            let w = low(&toks[k]);
            let clause = CLAUSE_START.contains(&w.as_str())
                || (RELATIVES.contains(&w.as_str()) && !is_function(&low(&toks[k - 1])));
            if clause && words_between(start, k) >= 4 && words_between(k, n) >= 4 {
                cuts.push(k);
                start = k;
                continue;
            }
            // a very long stretch: cut before a preposition near the middle
            if words_between(start, k) >= 6 && words_between(k, n) >= 4 && PREPOSITIONS.contains(&w.as_str()) {
                let next_punct = (k..n).find(|&j| post(&toks[j]).contains([',', ';', ':'])).unwrap_or(n);
                if words_between(start, next_punct) >= 10 {
                    cuts.push(k);
                    start = k;
                }
            }
        }
    }
    cuts.push(n);
    cuts.dedup();
    let mut out = Vec::new();
    let mut a = 0;
    for &b in &cuts {
        if b > a {
            out.push(Phrase { start: a, end: b, boundary: Boundary::Continuation });
            a = b;
        }
    }
    if let Some(last) = out.last_mut() {
        last.boundary = Boundary::Final;
    }
    // lists: ≥ 2 short comma groups then a group opened by et/ou/and/or
    let first_word =
        |p: &Phrase| (p.start..p.end).find(|&k| speakable(&toks[k])).map(|k| low(&toks[k])).unwrap_or_default();
    let short = |p: &Phrase| words_between(p.start, p.end) <= 6;
    let mut i = 0;
    while i < out.len() {
        let mut j = i;
        while j < out.len() && short(&out[j]) && post(&toks[out[j].end - 1]).contains(',') {
            j += 1;
        }
        // out[i..j] end with commas; out[j] opens with et/ou → a list
        // (at least two items before it: "A, B, et C")
        let opens_last = j < out.len() && j > i && LIST_LAST.contains(&first_word(&out[j]).as_str()) && short(&out[j]);
        // also "A, B et C" where "et C" was not cut: the last group holds "B et C"
        if opens_last && j - i >= 2 {
            // the items before: the groups i..j; the item "B" may be in out[j-1]
            for p in out.iter_mut().take(j).skip(i) {
                p.boundary = Boundary::ListItem;
            }
            i = j + 1;
            continue;
        }
        // "des coquelicots, des marguerites et des boutons d’or": cut "B et C"
        // (with a single group before, B and C must look like list items:
        // « D’habitude, Tilou était gentil et tranquille » is no list)
        if j > i && j < out.len() && short(&out[j]) {
            let inner = (out[j].start + 1..out[j].end).find(|&k| LIST_LAST.contains(&low(&toks[k]).as_str()));
            if let Some(k) = inner {
                let (b, c) = (spoken(&toks[out[j].start..k]), spoken(&toks[k + 1..out[j].end]));
                let det = |w: &str| {
                    DETERMINERS.contains(&w) || w.starts_with("l’") || w.starts_with("l'") || w.starts_with("d’")
                };
                let alike = match (b.first(), c.first()) {
                    (Some(x), Some(y)) => {
                        let fixed =
                            b.len() == 1 && c.len() == 1 && (x == y || PAIRS.contains(&(x.as_str(), y.as_str())));
                        !fixed
                            && ((b.len() <= 2 && c.len() <= 2 && !det(x) && !det(y))
                                || (b.len() <= 3 && c.len() <= 3 && det(x) && det(y)))
                    }
                    _ => false,
                };
                if words_between(k, out[j].end) >= 2 && (j - i >= 2 || alike) {
                    let end = out[j].end;
                    let b = out[j].boundary;
                    out[j].end = k;
                    out[j].boundary = Boundary::ListItem;
                    out.insert(j + 1, Phrase { start: k, end, boundary: b });
                    for p in out.iter_mut().take(j).skip(i) {
                        p.boundary = Boundary::ListItem;
                    }
                    i = j + 2;
                    continue;
                }
            }
        }
        i += 1;
    }
    out
}

/// The spoken words of a stretch, lowercased.
fn spoken(toks: &[String]) -> Vec<String> {
    toks.iter().filter(|t| speakable(t)).map(|t| low(t)).collect()
}

/// Words to bring out, at most one per phrase and two per piece.
pub fn focus(
    locale: &str,
    toks: &[String],
    phrases: &[Phrase],
    ctx: &mut StoryContext,
    kind: Kind,
) -> Vec<(usize, Focus)> {
    let _ = locale;
    let mut cands: Vec<(usize, Focus)> = Vec::new();
    // Title Case ("The Little Cloud Who…"): capitals say nothing about names
    let spoken: Vec<&String> = toks.iter().filter(|t| speakable(t)).collect();
    let capitals = spoken.iter().filter(|t| split_core(t).1.chars().next().is_some_and(char::is_uppercase)).count();
    let title_case = spoken.len() >= 3 && capitals * 10 >= spoken.len() * 6;
    for (k, t) in toks.iter().enumerate() {
        if !speakable(t) {
            continue;
        }
        let w = low(t);
        let next = toks.get(k + 1).map(|x| low(x)).unwrap_or_default();
        if is_onomatopoeia(t) && !matches!(w.as_str(), "oh" | "ah") {
            cands.push((k, Focus::Onomatopoeia));
            continue;
        }
        let (pre, core, _) = split_core(t);
        let first_word = toks[..k].iter().all(|x| !speakable(x));
        let after_end = k > 0 && toks[k - 1].trim_end_matches(['»', '”', '"']).ends_with(['.', '!', '?', '…']);
        let capital = core.chars().next().is_some_and(char::is_uppercase)
            && !first_word
            && !after_end
            && !pre.contains(['«', '“', '"'])
            && !title_case
            && !is_function(&w);
        if capital && core.chars().filter(|c| c.is_alphabetic()).count() > 2 {
            let name = w.trim_end_matches("'s").to_string();
            if !ctx.names_seen.contains(&name) {
                ctx.names_seen.insert(name);
                cands.push((k, Focus::Name));
                continue;
            }
        }
        if INTENSIFIERS.contains(&w.as_str()) && !next.is_empty() && speakable(&toks[k + 1]) {
            let ok = match w.as_str() {
                "si" => !NOT_AFTER_SI.contains(&next.as_str()),
                "tout" | "toute" | "toutes" => !is_function(&next) && !["le", "la", "les"].contains(&next.as_str()),
                "all" => !is_function(&next),
                "plein" => next == "de",
                _ => true,
            };
            if ok {
                cands.push((k, Focus::Intensifier));
                continue;
            }
        }
        if NUMBERS.contains(&w.as_str()) || w.chars().all(|c| c.is_ascii_digit()) {
            cands.push((k, Focus::Number));
            continue;
        }
        if ctx.key_words.contains(&w) && !ctx.key_used.contains(&w) {
            ctx.key_used.insert(w);
            cands.push((k, Focus::KeyWord));
            continue;
        }
        if CONTRAST.contains(&w.as_str()) && k == toks.iter().position(|x| speakable(x)).unwrap_or(0) {
            cands.push((k, Focus::Contrast));
        }
    }
    // onomatopoeia sentences: every sound is the point
    let mut out: Vec<(usize, Focus)> = Vec::new();
    for p in phrases {
        let mut best: Option<(usize, Focus)> = None;
        for &(k, f) in cands.iter().filter(|(k, _)| (p.start..p.end).contains(k)) {
            if best.is_none_or(|b| f < b.1) {
                best = Some((k, f));
            }
        }
        if let Some(b) = best {
            out.push(b);
        }
    }
    let cap = if kind == Kind::Onomatopoeia { 4 } else { 2 };
    out.sort_by_key(|x| x.1);
    out.truncate(cap);
    out.sort_by_key(|x| x.0);
    out
}

/// The story's key words: content words of the moral (the outro's first
/// sentence) that also appear in the title or at least twice in the scenes.
pub fn key_words(title: &str, scenes: &[&str], moral: &str) -> HashSet<String> {
    let words = |s: &str| -> Vec<String> {
        s.split_whitespace()
            .map(low)
            .filter(|w| w.chars().count() >= 5 && !is_function(w) && !NOT_KEY.contains(&w.as_str()))
            .collect()
    };
    let first_sentence = moral.split(['.', '!', '?']).next().unwrap_or(moral);
    let title_words: HashSet<String> = words(title).into_iter().collect();
    let mut out = HashSet::new();
    for w in words(first_sentence) {
        let stem: String = w.chars().take(w.chars().count().saturating_sub(1).max(4)).collect();
        let in_scenes = scenes.iter().map(|s| words(s).iter().filter(|x| x.starts_with(&stem)).count()).sum::<usize>();
        if title_words.iter().any(|t| t.starts_with(&stem)) || in_scenes >= 2 {
            out.insert(w);
        }
    }
    out
}

pub struct PieceInfo<'a> {
    pub locale: &'a str,
    /// The piece's tokens.
    pub toks: &'a [String],
    /// The whole sentence's tokens (type and feeling are the sentence's).
    pub sentence: &'a [String],
    /// The sentence goes on after this piece.
    pub continues: bool,
    pub landing: bool,
    pub tag: bool,
    pub whisper: bool,
}

pub fn analyse(p: &PieceInfo, ctx: &mut StoryContext) -> Intonation {
    // a piece is typed by its own words and final mark (« Oh ! » before
    // « chuchota Lili. » is an exclamation, the tag a statement)
    let kind = if p.tag { Kind::Declarative } else { sentence_kind(p.locale, p.toks) };
    let mut ph = phrases(p.toks);
    if p.continues {
        if let Some(last) = ph.last_mut() {
            if !matches!(kind, Kind::YesNo | Kind::Wh | Kind::Exclamation) {
                last.boundary = Boundary::Continuation;
            }
        }
    }
    let fo = if p.tag { Vec::new() } else { focus(p.locale, p.toks, &ph, ctx, kind) };
    let emo = emotion(p.sentence, p.landing);
    let breath_after = (!p.tag).then(|| p.toks.iter().position(|t| speakable(t))).flatten().filter(|&k| {
        CONTRAST.contains(&low(&p.toks[k]).as_str()) && post(&p.toks[k]).is_empty() && k + 1 < p.toks.len()
    });
    Intonation {
        kind,
        phrases: ph,
        focus: fo,
        emotion: emo,
        continues: p.continues,
        landing: p.landing,
        tag: p.tag,
        whisper: p.whisper,
        breath_after,
    }
}

/// Is the token a content word (for accents)?
pub fn content_word(tok: &str) -> bool {
    let w = low(tok);
    !w.is_empty() && !is_function(&w) && w.chars().any(is_word_char)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::text::tokenize;

    fn kind(loc: &str, s: &str) -> Kind {
        sentence_kind(loc, &tokenize(s))
    }

    #[test]
    fn sentence_types() {
        assert_eq!(kind("fr", "Le chat dort."), Kind::Declarative);
        assert_eq!(kind("fr", "Est-ce qu’on connaît tout du ciel ?"), Kind::YesNo);
        assert_eq!(kind("fr", "« Mille secrets ?"), Kind::YesNo);
        assert_eq!(kind("fr", "Lumi, pourquoi les étoiles clignotent ?"), Kind::Wh);
        assert_eq!(kind("fr", "Et toi, Lumi, qu’est-ce que tu es ?"), Kind::Wh);
        assert_eq!(kind("fr", "Allons les chercher ! »"), Kind::Imperative);
        assert_eq!(kind("fr", "Ces secrets-là, ce sont des gentillesses !"), Kind::Exclamation);
        assert_eq!(kind("fr", "« Grrrrr ! »"), Kind::Onomatopoeia);
        assert_eq!(kind("fr", "Plic, ploc, plic !"), Kind::Onomatopoeia);
        assert_eq!(kind("fr", "Il attendit…"), Kind::Suspension);
        assert_eq!(kind("en", "Why does the moon change shape?"), Kind::Wh);
        assert_eq!(kind("en", "Do we know everything about the sky?"), Kind::YesNo);
        assert_eq!(kind("en", "Look, here is the Big Dipper."), Kind::Imperative);
        assert_eq!(kind("fr", "« Moi aussi, est-ce que je peux aider quelqu’un ? »"), Kind::YesNo);
        assert_eq!(kind("fr", "Tu crois que la lune dort ?"), Kind::YesNo);
        assert_eq!(kind("fr", "Que fais-tu ?"), Kind::Wh);
    }

    fn bounds(s: &str) -> Vec<(String, Boundary)> {
        let t = tokenize(s);
        phrases(&t).into_iter().map(|p| (t[p.start..p.end].join(" "), p.boundary)).collect()
    }

    #[test]
    fn phrases_and_lists() {
        let b = bounds("Un soir, la vieille bibliothécaire du château murmura une histoire.");
        assert_eq!(b[0], ("Un soir,".to_string(), Boundary::Continuation));
        assert_eq!(b.last().unwrap().1, Boundary::Final);
        let b = bounds("Il y a des coquelicots, des marguerites et des boutons d’or.");
        let kinds: Vec<Boundary> = b.iter().map(|x| x.1).collect();
        assert_eq!(kinds, [Boundary::ListItem, Boundary::ListItem, Boundary::Final], "{b:?}");
        assert_eq!(b[2].0, "et des boutons d’or.");
        let b = bounds("Il avait abrité des écureuils, des hiboux, des enfants et des chats.");
        assert_eq!(b.iter().filter(|x| x.1 == Boundary::ListItem).count(), 3, "{b:?}");
        let b = bounds("Tout était grand, bleu et salé !");
        assert_eq!(b.iter().filter(|x| x.1 == Boundary::ListItem).count(), 2, "{b:?}");
        // an opening adverbial, a pair or a fixed phrase is no list
        for s in [
            "D’habitude, Tilou était gentil et tranquille.",
            "Là-haut, l’air était frais et doux.",
            "One day, Amina and Malik came running up.",
            "All the boats were home, safe and sound.",
            "The sun rose and set, again and again.",
        ] {
            let b = bounds(s);
            assert!(b.iter().all(|x| x.1 != Boundary::ListItem), "{b:?}");
        }
        // a clause word cuts a long stretch
        // French spacing: a lone « : » ends a phrase too
        let b = bounds("Ses amis ne la quittaient jamais : Mauve, un bébé dragon, et Pousse, un robot.");
        assert_eq!(b[0].0, "Ses amis ne la quittaient jamais :", "{b:?}");
        let b = bounds("Mauve battit de ses petites ailes et Pousse fit clignoter son sourire bleu.");
        assert_eq!(b.len(), 2, "{b:?}");
        assert!(b[1].0.starts_with("et Pousse"));
    }

    #[test]
    fn focus_words() {
        let mut ctx = StoryContext::default();
        let t = tokenize("Il n’a pas plu depuis très longtemps.");
        let p = phrases(&t);
        let f = focus("fr", &t, &p, &mut ctx, Kind::Declarative);
        assert_eq!(f, vec![(5, Focus::Intensifier)]); // "très"
        let t = tokenize("« Nous avons si soif », murmure une petite marguerite.");
        let f = focus("fr", &t, &phrases(&t), &mut ctx, Kind::Declarative);
        assert!(f.contains(&(3, Focus::Intensifier)), "{f:?}");
        // "si" as "if" is not an intensifier
        let t = tokenize("Et si nous ajoutions un secret ?");
        assert!(focus("fr", &t, &phrases(&t), &mut ctx, Kind::YesNo).iter().all(|x| x.1 != Focus::Intensifier));
        // a character's first mention only
        let t = tokenize("Un jour, Plume arriva.");
        assert!(focus("fr", &t, &phrases(&t), &mut ctx, Kind::Declarative).contains(&(2, Focus::Name)));
        assert!(!focus("fr", &t, &phrases(&t), &mut ctx, Kind::Declarative).iter().any(|x| x.1 == Focus::Name));
        // a capital at the start of a quote is not a name
        let t = tokenize("« Merci, petit nuage ! »");
        assert!(!focus("fr", &t, &phrases(&t), &mut ctx, Kind::Exclamation).iter().any(|x| x.1 == Focus::Name));
        let t = tokenize("Alors il grondait : « Grrrrr ! »");
        assert!(focus("fr", &t, &phrases(&t), &mut ctx, Kind::Declarative).iter().any(|x| x.1 == Focus::Onomatopoeia));
        assert!(is_onomatopoeia("Hou-lou-lou…"));
        assert!(is_onomatopoeia("Bzzz"));
        assert!(!is_onomatopoeia("arbre"));
    }

    #[test]
    fn feelings() {
        assert_eq!(emotion(&tokenize("Le cœur de Plume se serre tout doucement."), false), Emotion::Tenderness);
        assert_eq!(emotion(&tokenize("Waouh ! Les étoiles brillaient."), false), Emotion::Wonder);
        assert_eq!(emotion(&tokenize("Bonne nuit, fais de beaux rêves."), true), Emotion::Sleepy);
        assert_eq!(emotion(&tokenize("Il avait peur du noir."), false), Emotion::Worry);
        assert_eq!(emotion(&tokenize("Le train passe."), false), Emotion::Neutral);
        assert_eq!(emotion(&tokenize("Le train passe."), true), Emotion::Calm);
        assert_ne!(emotion(&tokenize("Mais il n’est pas triste du tout."), false), Emotion::Worry);
    }

    #[test]
    fn key_words_of_a_story() {
        let k = key_words(
            "Princesse Lili et le royaume des mille secrets",
            &["Les gentillesses cachées.", "Des gentillesses partout."],
            "Les plus beaux secrets sont les gentillesses que l’on fait sans bruit.",
        );
        assert!(k.contains("secrets") && k.contains("gentillesses"), "{k:?}");
    }
}
