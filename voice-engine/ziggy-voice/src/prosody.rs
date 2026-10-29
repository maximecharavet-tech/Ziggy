//! The storytelling plan: how each piece of a segment is told.
//!
//! A segment (title, scene, outro) is cut into sentences, and sentences into
//! pieces where the voice changes: narration, dialogue (« … », “ … ”) and the
//! little attribution tags (« chuchota Lili »). Each piece gets a delivery
//! (voice blend, speed, melody, vocal-tract size, level) and the pause that
//! follows it. Everything here is text-only, deterministic and unit-tested.

use crate::contour::feeling_tempo;
use crate::intonation::{analyse, key_words, Intonation, PieceInfo, StoryContext};
use crate::recipe::{character, narrator, Delivery, Pauses, Variant};
use crate::text::{quote_flags, sentences, speakable, split_core, tokenize, SentenceSpan, CLOSERS};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Role {
    Narration,
    /// "chuchota Lili", "she said": said a little quicker and lower.
    Tag,
    Dialogue,
}

#[derive(Clone, Debug)]
pub struct Piece {
    /// Token range in the segment.
    pub start: usize,
    pub end: usize,
    pub sentence: usize,
    pub role: Role,
    pub speaker: Option<String>,
    pub variant: Option<Variant>,
    pub whisper: bool,
    pub delivery: Delivery,
    /// Silence after this piece (s).
    pub pause_after: f32,
    /// Add a full stop when the piece has no final punctuation (titles).
    pub closing_period: bool,
    /// How a storyteller reads it (v3): type, phrases, emphasis, feeling.
    pub intonation: Intonation,
}

#[derive(Clone, Debug)]
pub struct SegmentPlan {
    pub id: String,
    pub text: String,
    pub tokens: Vec<String>,
    pub pieces: Vec<Piece>,
    pub lead: f32,
}

fn core_lower(tok: &str) -> String {
    let (_, core, _) = split_core(tok);
    core.replace('’', "'").to_lowercase()
}

const FR_SPEECH: &[&str] = &[
    "dit",
    "dis",
    "disait",
    "dirent",
    "demanda",
    "demande",
    "demandait",
    "chuchota",
    "chuchote",
    "chuchotait",
    "chuchotèrent",
    "murmura",
    "murmure",
    "murmurait",
    "murmurèrent",
    "souffla",
    "souffle",
    "soufflait",
    "proposa",
    "propose",
    "répondit",
    "répond",
    "répondait",
    "s'écria",
    "s'exclama",
    "cria",
    "crie",
    "rit",
    "sourit",
    "soupira",
    "soupire",
    "pensa",
    "pense",
    "pensait",
    "ajouta",
    "ajoute",
    "expliqua",
    "explique",
    "appela",
    "appelle",
    "lança",
    "continua",
    "reprit",
    "annonça",
    "déclara",
    "fit",
    "raconta",
    "chanta",
    "chantonna",
    "gloussa",
    "bâilla",
    "insista",
    "s'étonna",
    "encouragea",
    "rassura",
    "conseilla",
    "promit",
    "supplia",
    "répéta",
    "répétait",
    "avoua",
    "remercia",
    "ronronna",
    "rigola",
    "s'émerveilla",
    "admit",
    "constata",
    "hurla",
    "osa",
];
const EN_SPEECH: &[&str] = &[
    "said",
    "says",
    "say",
    "asked",
    "asks",
    "whispered",
    "whispers",
    "murmured",
    "murmurs",
    "breathed",
    "sighed",
    "laughed",
    "giggled",
    "answered",
    "answers",
    "replied",
    "called",
    "cried",
    "shouted",
    "added",
    "explained",
    "thought",
    "thinks",
    "smiled",
    "yawned",
    "sang",
    "hummed",
    "announced",
    "suggested",
    "exclaimed",
    "continued",
    "promised",
    "begged",
    "wondered",
    "admitted",
    "purred",
    "chirped",
    "squeaked",
    "told",
    "repeated",
    "agreed",
];
/// Verbs that make a following sentence an attribution ("Lili whispered.").
const STRICT_SPEECH: &[&str] = &[
    "said",
    "says",
    "asked",
    "asks",
    "whispered",
    "whispers",
    "murmured",
    "replied",
    "answered",
    "called",
    "cried",
    "shouted",
    "exclaimed",
    "dit",
    "demanda",
    "chuchota",
    "murmura",
    "répondit",
];
const WHISPER: &[&str] = &[
    "chuchota",
    "chuchote",
    "chuchotait",
    "chuchotèrent",
    "murmura",
    "murmure",
    "murmurait",
    "murmurèrent",
    "souffla",
    "souffle",
    "soufflait",
    "soupira",
    "soupire",
    "whispered",
    "whispers",
    "murmured",
    "murmurs",
    "breathed",
    "sighed",
];
const ELDERS: &[&str] = &[
    "grand-mère",
    "grand-père",
    "mamie",
    "papi",
    "papy",
    "maman",
    "papa",
    "mère",
    "père",
    "vieux",
    "vieille",
    "vieil",
    "roi",
    "reine",
    "maîtresse",
    "maître",
    "bibliothécaire",
    "jardinier",
    "boulanger",
    "marchand",
    "capitaine",
    "docteur",
    "oncle",
    "tante",
    "grandma",
    "grandpa",
    "granny",
    "grandmother",
    "grandfather",
    "mum",
    "mom",
    "mummy",
    "mommy",
    "dad",
    "daddy",
    "mother",
    "father",
    "old",
    "king",
    "queen",
    "teacher",
    "librarian",
    "gardener",
    "baker",
    "merchant",
    "captain",
    "doctor",
    "uncle",
    "aunt",
];
const PRONOUNS: &[&str] = &["il", "elle", "ils", "elles", "on", "he", "she", "they", "it", "we"];
/// The stories are told by Ziggy: "je", "I" in the narration is Ziggy.
const FIRST_PERSON: &[&str] = &["je", "j'", "i"];
pub const ZIGGY: &str = "ziggy";
/// "Je m’appelle Lumi", "Moi, c’est Ziggy", "I’m Lumi": the speaker names themself.
const SELF_INTRO: &[&str] = &["m'appelle", "c'est", "suis", "i'm", "am", "name's", "is"];
/// Tags that ask a real question: the one asked answers next.
const ASK: &[&str] = &["demanda", "demande", "demandait", "asked", "asks", "questionna"];
const FUNCTION_WORDS: &[&str] = &[
    // fr
    "le",
    "la",
    "les",
    "l'",
    "un",
    "une",
    "des",
    "il",
    "elle",
    "ils",
    "elles",
    "on",
    "et",
    "mais",
    "alors",
    "puis",
    "quand",
    "dans",
    "sur",
    "sous",
    "ce",
    "cette",
    "ces",
    "c'",
    "tout",
    "toute",
    "toutes",
    "tous",
    "plus",
    "chaque",
    "au",
    "aux",
    "du",
    "de",
    "d'",
    "en",
    "à",
    "partout",
    "dehors",
    "ensuite",
    "enfin",
    "soudain",
    "bientôt",
    "pendant",
    "après",
    "avant",
    "ici",
    "là",
    "oh",
    "ah",
    "personne",
    "toi",
    "moi",
    "nous",
    "vous",
    "son",
    "sa",
    "ses",
    "leur",
    "leurs",
    "mon",
    "ma",
    "mes",
    "ton",
    "ta",
    "tes",
    "bonne",
    "bon",
    "fais",
    "si",
    "comme",
    "lorsque",
    "pourtant",
    "doucement",
    "peut-être",
    "que",
    "qui",
    "très",
    "car",
    "donc",
    "ou",
    "où",
    "non",
    "oui",
    "merci",
    "bonjour",
    "bonsoir",
    "regarde",
    "voici",
    "voilà",
    "ensemble",
    "chut",
    "ainsi",
    "parfois",
    "souvent",
    "jamais",
    "toujours",
    "demain",
    "hier",
    "c'est",
    "c'était",
    "qu'est-ce",
    "aujourd'hui",
    "quel",
    "quelle",
    "petit",
    "petite",
    "je",
    "j'",
    "tu",
    "rien",
    "chacun",
    "chacune",
    "quelqu'un",
    "aucun",
    "aucune",
    "ça",
    "cela",
    "ceci",
    "celui",
    "celle",
    "pourquoi",
    "comment",
    "combien",
    "écoute",
    "attends",
    "viens",
    "allons",
    "nothing",
    "something",
    "someone",
    "anyone",
    "everything",
    "listen",
    "wait",
    "me",
    "him",
    "us",
    "them",
    "wow",
    "waouh",
    "ouah",
    "bravo",
    "hi",
    "bye",
    "please",
    "sorry",
    "pardon",
    "salut",
    "coucou",
    "shh",
    "hmm",
    "hourra",
    "hooray",
    "yay",
    "ouf",
    "zut",
    "oups",
    "oops",
    "ok",
    "okay",
    "d'accord",
    "allez",
    "attention",
    "stop",
    "go",
    "ready",
    // en
    "the",
    "a",
    "an",
    "he",
    "she",
    "it",
    "they",
    "we",
    "you",
    "i",
    "and",
    "but",
    "so",
    "then",
    "when",
    "in",
    "on",
    "under",
    "this",
    "that",
    "these",
    "those",
    "every",
    "all",
    "each",
    "his",
    "her",
    "their",
    "my",
    "your",
    "our",
    "its",
    "one",
    "once",
    "outside",
    "inside",
    "back",
    "now",
    "soon",
    "suddenly",
    "further",
    "nobody",
    "somebody",
    "everyone",
    "everybody",
    "good",
    "sweet",
    "maybe",
    "together",
    "there",
    "here",
    "what",
    "why",
    "how",
    "who",
    "little",
    "big",
    "after",
    "before",
    "while",
    "as",
    "if",
    "at",
    "by",
    "for",
    "from",
    "with",
    "into",
    "over",
    "very",
    "no",
    "yes",
    "thank",
    "thanks",
    "hello",
    "look",
    "come",
    "let",
    "let's",
    "it's",
    "every",
    "later",
    "finally",
];
const ACTION: &[&str] = &[
    "soudain",
    "soudainement",
    "vite",
    "hop",
    "courut",
    "coururent",
    "sauta",
    "sautèrent",
    "bondit",
    "s'élança",
    "fila",
    "plongea",
    "boum",
    "plouf",
    "crac",
    "galopa",
    "rebondit",
    "fonça",
    "suddenly",
    "quickly",
    "quick",
    "ran",
    "jumped",
    "leapt",
    "dashed",
    "hopped",
    "zoomed",
    "splash",
    "boom",
    "whoosh",
    "bounced",
    "raced",
    "rushed",
];

/// "dit-il", "pensa-t-elle", "murmure-t-elle" → the verb.
fn verb_of(word: &str) -> String {
    for suf in ["-t-il", "-t-elle", "-t-ils", "-t-elles", "-t-on", "-il", "-elle", "-ils", "-elles", "-on", "-je"] {
        if let Some(v) = word.strip_suffix(suf) {
            return v.to_string();
        }
    }
    word.to_string()
}

fn is_speech_verb(word: &str) -> bool {
    let v = verb_of(word);
    FR_SPEECH.contains(&v.as_str()) || EN_SPEECH.contains(&v.as_str())
}

fn pronoun_suffix(word: &str) -> bool {
    verb_of(word) != word
}

fn is_name(tok: &str) -> bool {
    let (_, core, _) = split_core(tok);
    let first = core.chars().next();
    first.is_some_and(char::is_uppercase)
        && !FUNCTION_WORDS.contains(&core_lower(tok).as_str())
        && core.chars().filter(|c| c.is_alphabetic()).count() > 1
}

/// The name starting at token `i` (consecutive capitalized words: "Papi Samir").
fn name_at(tokens: &[String], i: usize, end: usize) -> Option<String> {
    if i >= end || !is_name(&tokens[i]) {
        return None;
    }
    let mut j = i;
    let mut parts = Vec::new();
    while j < end && is_name(&tokens[j]) {
        let (_, core, post) = split_core(&tokens[j]);
        let core = core.trim_end_matches("’s").trim_end_matches("'s");
        parts.push(core.to_lowercase());
        j += 1;
        if !post.is_empty() {
            break; // "Lili," ends the name
        }
    }
    Some(parts.join(" "))
}

#[derive(Clone, Debug, Default)]
pub struct Speaker {
    pub key: Option<String>,
    pub elder: bool,
    pub whisper: bool,
    pub tag_piece: Option<usize>,
}

/// Look for "verb Name", "Name verb", "verb-il", "the old owl said" in a
/// narration span placed right after a quote.
fn attribution_after(tokens: &[String], s: usize, e: usize) -> Option<Speaker> {
    let words: Vec<usize> = (s..e).filter(|&k| speakable(&tokens[k])).take(6).collect();
    let low = |k: usize| core_lower(&tokens[k]);
    let mut sp = Speaker::default();
    let (vi, verb) = words.iter().take(3).enumerate().find(|(_, &k)| is_speech_verb(&low(k)))?;
    let verb_word = low(*verb);
    sp.whisper = WHISPER.contains(&verb_of(&verb_word).as_str());
    if pronoun_suffix(&verb_word) {
        if verb_word.ends_with("-je") {
            sp.key = Some(ZIGGY.into()); // "dis-je": Ziggy tells the story
        }
        return Some(sp); // dit-il
    }
    // subject before the verb ("Lili whispered", "she said", "Grandma often said")
    let before: Vec<usize> = words[..vi].to_vec();
    let after: Vec<usize> = words[vi + 1..].to_vec();
    for group in [&before, &after] {
        for (n, &k) in group.iter().enumerate() {
            let w = low(k);
            if ELDERS.contains(&w.as_str()) {
                sp.elder = true;
                sp.key = Some(group[n..].iter().take(3).map(|&x| low(x)).collect::<Vec<_>>().join(" "));
                return Some(sp);
            }
            if let Some(name) = name_at(tokens, k, e) {
                sp.elder = name.split(' ').any(|p| ELDERS.contains(&p));
                sp.key = Some(name);
                return Some(sp);
            }
            if FIRST_PERSON.contains(&w.as_str()) {
                sp.key = Some(ZIGGY.into());
                return Some(sp);
            }
            if PRONOUNS.contains(&w.as_str()) {
                return Some(sp);
            }
        }
    }
    Some(sp)
}

/// "Grand-mère disait :", "Pompon answered:" right before a quote.
fn attribution_before(tokens: &[String], s: usize, e: usize) -> Option<Speaker> {
    let last = tokens[e - 1].trim_end_matches(CLOSERS);
    if !(last.ends_with(':') || last.ends_with(',')) {
        return None;
    }
    let words: Vec<usize> = (s..e).filter(|&k| speakable(&tokens[k])).collect();
    let tail: Vec<usize> = words.iter().rev().take(6).rev().copied().collect();
    let low = |k: usize| core_lower(&tokens[k]);
    let vi = tail.iter().position(|&k| is_speech_verb(&low(k)))?;
    let mut sp = Speaker { whisper: WHISPER.contains(&verb_of(&low(tail[vi])).as_str()), ..Default::default() };
    for &k in words.iter() {
        let w = low(k);
        if FIRST_PERSON.contains(&w.as_str()) && sp.key.is_none() {
            sp.key = Some(ZIGGY.into()); // "Puis je lui dis :"
        }
        if ELDERS.contains(&w.as_str()) {
            sp.elder = true;
            sp.key.get_or_insert(w);
        }
        if sp.key.is_none() {
            if let Some(name) = name_at(tokens, k, e) {
                sp.elder |= name.split(' ').any(|p| ELDERS.contains(&p));
                sp.key = Some(name);
            }
        }
    }
    Some(sp)
}

/// The quotation before: (speaker, who it spoke to, its last piece, its
/// final mark, whether its tag asked a question).
type PrevQuote = (Option<String>, Option<String>, usize, Option<char>, bool);

/// A quotation for the backward pass: (its pieces, speaker unknown, final
/// mark, its tag).
type QuoteInfo = (Vec<usize>, bool, Option<char>, Option<usize>);

/// Per-story memory: which character got which voice.
#[derive(Default)]
pub struct Cast {
    named: Vec<(String, Variant)>,
    /// named speakers, most recent last
    recent: Vec<String>,
}

impl Cast {
    /// The character who spoke most recently, other than `not`.
    pub fn recent_other(&self, not: &str) -> Option<String> {
        self.recent.iter().rev().find(|k| k.as_str() != not && k.as_str() != ZIGGY).cloned()
    }

    /// `key` just spoke.
    pub fn touch(&mut self, key: &str) {
        self.recent.retain(|x| x != key);
        self.recent.push(key.to_string());
    }

    pub fn variant(&mut self, sp: &Speaker) -> Variant {
        if let Some(k) = &sp.key {
            self.touch(k);
        }
        match &sp.key {
            Some(k) if k == ZIGGY => Variant::Generic,
            _ if sp.elder => Variant::Warm,
            Some(k) => {
                if let Some((_, v)) = self.named.iter().find(|(n, _)| n == k) {
                    return *v;
                }
                let v = if self.named.iter().filter(|(_, v)| *v != Variant::Warm).count() % 2 == 0 {
                    Variant::ChildA
                } else {
                    Variant::ChildB
                };
                self.named.push((k.clone(), v));
                v
            }
            None => Variant::Generic,
        }
    }
}

/// An incise starting at token `k` inside a quotation ("…, dit Lumi.",
/// "Moi ? rit Lumi.", "…, dit-elle."): the end of the incise, if any.
fn inner_incise(tokens: &[String], k: usize, e: usize) -> Option<usize> {
    let prev = tokens[k - 1].as_str();
    if !(prev.ends_with([',', '?', '!', '…']) || prev == "?" || prev == "!") {
        return None;
    }
    let (_, core, _) = split_core(&tokens[k]);
    if !core.chars().next().is_some_and(char::is_lowercase) || !is_speech_verb(&core_lower(&tokens[k])) {
        return None;
    }
    if !FR_SPEECH.contains(&verb_of(&core_lower(&tokens[k])).as_str()) {
        return None; // English closes the quotation before its tag
    }
    tokens[k..(k + 4).min(e)]
        .iter()
        .position(|t| t.trim_end_matches(['»', '”', '"']).ends_with([',', '.', ';', '!', '?']))
        .map(|j| k + j + 1)
}

fn closes_quote(tok: &str) -> bool {
    tok.trim_end_matches(|c: char| ",.;:!?…".contains(c)).ends_with(['»', '”', '"'])
}

/// The punctuation that ends a piece ("Oh ! »" → '!').
fn piece_mark(tokens: &[String], s: usize, e: usize) -> Option<char> {
    for k in (s..e).rev() {
        let t = tokens[k].trim_end_matches(CLOSERS).trim_end_matches(['»', '”', '"']);
        if t.is_empty() {
            continue;
        }
        return final_mark(t);
    }
    None
}

fn final_mark(tok: &str) -> Option<char> {
    let t = tok.trim_end_matches(CLOSERS);
    t.chars().last().filter(|c| ".!?…:;,".contains(*c))
}

fn pause_for(mark: Option<char>) -> f32 {
    match mark {
        Some('.') => Pauses::SENTENCE,
        Some('!') => Pauses::EXCLAMATION,
        Some('?') => Pauses::QUESTION,
        Some('…') => Pauses::ELLIPSIS,
        Some(':') | Some(';') => Pauses::COLON,
        _ => Pauses::OTHER,
    }
}

/// Plan one segment. `index`/`count` locate a scene among the scenes.
pub fn plan_segment(locale: &str, id: &str, text: &str, cast: &mut Cast, ctx: &mut StoryContext) -> SegmentPlan {
    let tokens = tokenize(text);
    let sents: Vec<SentenceSpan> = sentences(&tokens);
    let qf = quote_flags(&tokens);
    ctx.key_used.clear(); // key words: once per scene
    let is_title = id == "title";
    let is_outro = id == "outro";
    let scene: Option<u32> = id.strip_prefix('s').and_then(|n| n.parse().ok());
    let last_scene = scene.is_some_and(|n| n >= 6);

    // 1. pieces: runs of equal quote flag inside each sentence
    let mut raw: Vec<(usize, usize, usize, bool)> = Vec::new(); // start, end, sentence, quoted
    for (si, s) in sents.iter().enumerate() {
        let mut a = s.start;
        for k in s.start + 1..=s.end {
            if k == s.end || qf[k] != qf[a] {
                raw.push((a, k, si, qf[a]));
                a = k;
            }
        }
    }
    // a piece without any word joins its neighbour
    let mut merged: Vec<(usize, usize, usize, bool)> = Vec::new();
    for p in raw {
        let has_word = (p.0..p.1).any(|k| speakable(&tokens[k]));
        match merged.last_mut() {
            Some(last) if !has_word && last.2 == p.2 => last.1 = p.1,
            _ => {
                if let Some(last) = merged.last_mut() {
                    if !(last.0..last.1).any(|k| speakable(&tokens[k])) && last.2 == p.2 {
                        last.1 = p.1;
                        last.3 = p.3;
                        continue;
                    }
                }
                merged.push(p)
            }
        }
    }

    // 2a. incises inside the guillemets (French): « Elle ne change pas, dit
    //     Lumi. Le soleil… » — the narrator says "dit Lumi."
    let mut split: Vec<(usize, usize, usize, bool)> = Vec::new();
    let mut incise: Vec<bool> = Vec::new();
    for p in merged {
        let (s, e, si, quoted) = p;
        if !quoted {
            split.push(p);
            incise.push(false);
            continue;
        }
        let mut a = s;
        let mut k = s + 1;
        while k < e {
            if let Some(j) = inner_incise(&tokens, k, e) {
                if (a..k).any(|x| speakable(&tokens[x])) {
                    split.push((a, k, si, true));
                    incise.push(false);
                }
                split.push((k, j, si, false));
                incise.push(true);
                a = j;
                k = j + 1;
                continue;
            }
            k += 1;
        }
        if a < e {
            if (a..e).any(|x| speakable(&tokens[x])) || split.is_empty() {
                split.push((a, e, si, true));
                incise.push(false);
            } else {
                split.last_mut().unwrap().1 = e; // a lone "»" joins the piece before
            }
        }
    }
    let merged = split;

    // 2b. speakers, per quotation (a quotation may span several sentences
    //     and hold an incise)
    let n = merged.len();
    let mut groups: Vec<Vec<usize>> = Vec::new();
    for i in 0..n {
        if !merged[i].3 {
            continue;
        }
        let open = |j: usize| merged[j].3 && qf[merged[j].1 - 1] && !closes_quote(&tokens[merged[j].1 - 1]);
        let continues = i > 0 && open(i - 1) && merged[i - 1].1 == merged[i].0 && qf[merged[i].0];
        let across_incise = i > 1
            && incise[i - 1]
            && merged[i - 2].3
            && merged[i - 2].1 == merged[i - 1].0
            && merged[i - 1].1 == merged[i].0;
        match groups.last_mut() {
            Some(g) if continues && *g.last().unwrap() == i - 1 => g.push(i),
            Some(g) if across_incise && *g.last().unwrap() == i - 2 => g.push(i),
            _ => groups.push(vec![i]),
        }
    }
    let words = |a: usize, b: usize| (a..b).filter(|&k| speakable(&tokens[k])).count();
    let mut speakers: Vec<Option<Speaker>> = vec![None; n];
    let mut tags: Vec<Option<usize>> = vec![None; n]; // per piece: the tag of its quotation
    let mut last_named: Option<Speaker> = None;
    // (speaker, addressee) of the previous quotation, and the speaker before it
    let mut prev_quote: Option<PrevQuote> = None;
    // (pieces, speaker unknown, end mark, tag) of each quotation, for the backward pass
    let mut group_info: Vec<QuoteInfo> = Vec::new();
    let mut before_prev: Option<Speaker> = None;
    let mut prev_speaker: Option<Speaker> = None;
    for g in &groups {
        let (first, last) = (g[0], *g.last().unwrap());
        let mut sp: Option<Speaker> = None;
        // inner incise
        if let Some(t) = (first..=last).find(|&i| incise[i]) {
            if let Some(mut x) = attribution_after(&tokens, merged[t].0, merged[t].1) {
                x.tag_piece = Some(t);
                sp = Some(x);
            }
        }
        // after: the tag in the same sentence, or (English) "Lili whispered." just after
        if sp.is_none() && last + 1 < n && !merged[last + 1].3 {
            let (ts, te, tsi, _) = merged[last + 1];
            let same = tsi == merged[last].2;
            let next_sentence_tag = !same && words(ts, te) <= 4 && sents[tsi].start == ts;
            let strict = |k: usize| STRICT_SPEECH.contains(&verb_of(&core_lower(&tokens[k])).as_str());
            let has_strict = (ts..te).filter(|&k| speakable(&tokens[k])).take(3).any(strict);
            if same || (next_sentence_tag && has_strict) {
                if let Some(mut x) = attribution_after(&tokens, ts, te) {
                    if words(ts, te) <= 5 {
                        x.tag_piece = Some(last + 1);
                    }
                    if same || x.key.is_some() || x.tag_piece.is_some() {
                        sp = Some(x);
                    }
                }
            }
        }
        // before: "Grand-mère disait :"
        if sp.is_none() && first > 0 && !merged[first - 1].3 && merged[first - 1].2 == merged[first].2 {
            let (ps, pe, _, _) = merged[first - 1];
            sp = attribution_before(&tokens, ps, pe).map(|mut x| {
                if words(ps, pe) <= 5 {
                    x.tag_piece = Some(first - 1);
                }
                x
            });
        }
        // the quotation names its speaker: "Je m’appelle Lumi", "Moi, c’est Ziggy"
        let quote_tokens: Vec<usize> = g.iter().flat_map(|&i| merged[i].0..merged[i].1).collect();
        let named_self = quote_tokens.windows(2).enumerate().find_map(|(n, w)| {
            let v = core_lower(&tokens[w[0]]);
            // "is" only in "my name is …"
            let ok = SELF_INTRO.contains(&v.as_str())
                && (v != "is" || (n > 0 && core_lower(&tokens[quote_tokens[n - 1]]) == "name"));
            ok.then(|| name_at(&tokens, w[1], w[1] + 1)).flatten()
        });
        match (&mut sp, &named_self) {
            (Some(x), Some(nm)) if x.key.is_none() => x.key = Some(nm.clone()),
            (None, Some(nm)) => sp = Some(Speaker { key: Some(nm.clone()), ..Default::default() }),
            _ => {}
        }
        // "Lumi sourit. « Oh non… »", "Les yeux de Lili brillèrent. « … »":
        // the first character named in the narration just before
        let after_quote = first > 0 && prev_quote.as_ref().is_some_and(|q| q.2 + 1 >= first);
        if sp.is_none() && first > 0 && !merged[first - 1].3 && !after_quote {
            let (ps, pe, _, _) = merged[first - 1];
            for k in ps..pe {
                let w = core_lower(&tokens[k]);
                if let Some(name) = name_at(&tokens, k, pe) {
                    sp = Some(Speaker {
                        elder: name.split(' ').any(|p| ELDERS.contains(&p)),
                        key: Some(name),
                        ..Default::default()
                    });
                    break;
                }
                if ELDERS.contains(&w.as_str())
                    && k > ps
                    && ["le", "la", "l'", "the", "his", "her", "son", "sa"]
                        .contains(&core_lower(&tokens[k - 1]).as_str())
                {
                    sp = Some(Speaker { elder: true, key: Some(w), ..Default::default() });
                    break;
                }
            }
        }
        // a few words quoted inside a narrated sentence ("un mot qui disait
        // « Merci »"): the narrator reads them
        let embedded = sp.is_none()
            && g.len() == 1
            && first > 0
            && !merged[first - 1].3
            && merged[first - 1].2 == merged[first].2
            && piece_mark(&tokens, merged[first - 1].0, merged[first - 1].1) != Some(':')
            && words(merged[first].0, merged[first].1) <= 3;
        if embedded {
            for &i in g {
                speakers[i] = None;
            }
            continue;
        }
        // who is spoken to in this quotation: a name set off by commas or a
        // final ?/! ("Lumi,", ", Nuna ?") — never the one who introduces themself
        let addressee = |who: Option<&String>| {
            quote_tokens.iter().enumerate().find_map(|(n, &k)| {
                let name = name_at(&tokens, k, k + 1)?;
                let (_, _, post) = split_core(&tokens[k]);
                let after_comma = n > 0 && tokens[quote_tokens[n - 1]].ends_with(',');
                let set_off = post.contains([',', '?', '!', '.']) || after_comma;
                let intro = n > 0 && SELF_INTRO.contains(&core_lower(&tokens[quote_tokens[n - 1]]).as_str());
                (set_off && !intro && Some(&name) != who).then_some(name)
            })
        };
        // a reply right after another quotation (and its tag)
        if sp.as_ref().is_none_or(|x| x.key.is_none() && !x.elder) && after_quote {
            let (pk, prev_addressee, _, prev_mark, prev_asked) = prev_quote.clone().unwrap();
            let me = addressee(None);
            let other = || {
                prev_addressee
                    .clone()
                    .filter(|a| Some(a) != pk.as_ref())
                    .or_else(|| before_prev.as_ref().and_then(|b| b.key.clone()).filter(|b| Some(b) != pk.as_ref()))
            };
            // after "…," + tag the same voice goes on; a question gets its answer
            // from the one asked; otherwise the same voice goes on unless it is
            // the one being spoken to now
            let pick = match prev_mark {
                Some(',') => pk.clone(),
                Some('?') if prev_asked || prev_addressee.is_some() => other().or(pk.clone()),
                _ if me.is_some() && me == pk => other(),
                _ if pk.is_none() => prev_addressee.clone(),
                _ => pk.clone(),
            }
            .filter(|k| Some(k) != me.as_ref());
            if let Some(k) = pick {
                let whisper = sp.as_ref().is_some_and(|x| x.whisper);
                let tag = sp.as_ref().and_then(|x| x.tag_piece);
                let elder = k.split(' ').any(|p| ELDERS.contains(&p))
                    || last_named.as_ref().is_some_and(|l| l.key.as_ref() == Some(&k) && l.elder)
                    || before_prev.as_ref().is_some_and(|l| l.key.as_ref() == Some(&k) && l.elder)
                    || prev_speaker.as_ref().is_some_and(|l| l.key.as_ref() == Some(&k) && l.elder);
                sp = Some(Speaker { key: Some(k), elder, whisper, tag_piece: tag });
            }
        }
        // "« Pardon, Nuna. … »" with nobody named: the last other character of the story
        if sp.as_ref().is_none_or(|x| x.key.is_none() && !x.elder) {
            if let Some(me) = addressee(None) {
                if let Some(k) = cast.recent_other(&me) {
                    let whisper = sp.as_ref().is_some_and(|x| x.whisper);
                    let tag = sp.as_ref().and_then(|x| x.tag_piece);
                    sp = Some(Speaker { key: Some(k), elder: false, whisper, tag_piece: tag });
                }
            }
        }
        // otherwise: the last character who spoke in this scene
        let sp = match sp {
            Some(x) if x.key.is_some() || x.elder => x,
            Some(x) => match &last_named {
                Some(prev) if x.tag_piece.is_none() => Speaker { whisper: x.whisper, tag_piece: None, ..prev.clone() },
                _ => x,
            },
            None => last_named.clone().map(|p| Speaker { whisper: false, tag_piece: None, ..p }).unwrap_or_default(),
        };
        if let Some(k) = &sp.key {
            last_named = Some(Speaker { whisper: false, tag_piece: None, ..sp.clone() });
            cast.touch(k);
        }
        let spoken_to = addressee(sp.key.as_ref());
        let end_piece = sp.tag_piece.map_or(last, |t| t.max(last));
        if prev_speaker.as_ref().map(|p| &p.key) != Some(&sp.key) {
            before_prev = prev_speaker.clone();
        }
        prev_speaker = Some(Speaker { whisper: false, tag_piece: None, ..sp.clone() });
        let mark = piece_mark(&tokens, merged[last].0, merged[last].1);
        let asked = sp.tag_piece.is_some_and(|t| {
            (merged[t].0..merged[t].1).any(|k| ASK.contains(&verb_of(&core_lower(&tokens[k])).as_str()))
        });
        prev_quote = Some((sp.key.clone(), spoken_to, end_piece, mark, asked));
        group_info.push((g.clone(), sp.key.is_none(), mark, sp.tag_piece));
        for &i in g {
            speakers[i] = Some(sp.clone());
            tags[i] = sp.tag_piece;
        }
    }

    // 2c. "“Good evening, Sacha,” she said. “My name is Lumi…”": a quotation
    //     cut by a pronoun tag takes the speaker of the part that follows
    for w in (0..group_info.len().saturating_sub(1)).rev() {
        let (ref g1, unknown, mark, tag) = group_info[w];
        let next_first = group_info[w + 1].0[0];
        let adjacent = tag.map_or(*g1.last().unwrap() + 1, |t| t + 1) == next_first;
        if unknown && mark == Some(',') && adjacent {
            if let Some(sp2) = speakers[next_first].clone().filter(|x| x.key.is_some()) {
                for &i in g1 {
                    let mut x = sp2.clone();
                    x.tag_piece = tag;
                    x.whisper = speakers[i].as_ref().is_some_and(|y| y.whisper);
                    speakers[i] = Some(x);
                }
            }
        }
    }

    // 3. deliveries
    let n_sent = sents.len();
    let words_in = |si: usize| (sents[si].start..sents[si].end).filter(|&k| speakable(&tokens[k])).count();
    let mut pieces: Vec<Piece> = Vec::with_capacity(n);
    let tag_of: Vec<Option<usize>> = tags;
    for i in 0..n {
        let (s, e, si, quoted) = merged[i];
        let sentence_words: Vec<String> = (sents[si].start..sents[si].end).map(|k| core_lower(&tokens[k])).collect();
        let is_tag = tag_of.contains(&Some(i));
        let (role, mut d, speaker, variant, whisper) = if quoted && speakers[i].is_some() {
            let sp = speakers[i].clone().unwrap_or_default();
            let v = cast.variant(&sp);
            let mut d = character(locale, v);
            if sp.key.as_deref() == Some(ZIGGY) {
                d = narrator(locale);
                d.pitch.gamma = 1.2;
                d.range = 1.15;
            }
            (Role::Dialogue, d, sp.key.clone(), Some(v), sp.whisper)
        } else if is_tag {
            let mut d = narrator(locale);
            d.speed *= 1.05;
            d.gain_db -= 1.5;
            d.pitch.scale *= 0.97;
            d.pitch.gamma = 1.0;
            (Role::Tag, d, None, None, false)
        } else {
            (Role::Narration, narrator(locale), None, None, false)
        };
        if whisper {
            d.gain_db -= 3.0;
            d.speed *= 0.95;
            d.pitch.gamma = 1.0;
            d.pitch.scale *= 0.98;
        }
        // where we are in the story
        if is_title {
            d.speed *= 0.94;
        }
        if scene == Some(1) && si == 0 {
            d.speed *= 0.96; // "Il était une fois…": a calm opening
        }
        let action = role == Role::Narration
            && (sentence_words.iter().any(|w| ACTION.contains(&w.as_str()))
                || piece_mark(&tokens, sents[si].start, sents[si].end) == Some('!'));
        if action && !last_scene && !is_outro {
            d.speed *= 1.04;
        }
        let closing = n_sent >= 2 && si == n_sent - 1;
        let landing = (scene.is_some() && closing) || is_outro || (last_scene && n_sent >= 3 && si + 2 >= n_sent);
        let continues = i + 1 < n && merged[i + 1].2 == si;
        let info = PieceInfo {
            locale,
            toks: &tokens[s..e],
            sentence: &tokens[sents[si].start..sents[si].end],
            continues,
            landing,
            tag: role == Role::Tag,
            whisper,
        };
        let intonation = analyse(&info, ctx);
        // the feeling sets the pace (the landing is already slower)
        if !landing && !is_title {
            d.speed *= feeling_tempo(intonation.emotion);
        }
        if scene.is_some() && !last_scene && closing {
            d.speed *= 0.95;
            d.gain_db -= 1.0;
        }
        if last_scene {
            d.speed *= if n_sent >= 3 && si + 2 >= n_sent { 0.93 } else { 0.97 };
            if si + 2 >= n_sent {
                d.gain_db -= 1.5;
            }
        }
        if is_outro {
            d.speed *= 0.92;
            d.gain_db -= 1.0;
            d.pitch.scale *= 0.98;
            d.pitch.gamma = d.pitch.gamma.min(1.05);
        }
        let mark = piece_mark(&tokens, s, e);
        if mark == Some('?') {
            d.pitch.gamma += 0.05; // keep the rising question audible
        }

        // pause after this piece
        let next_is_my_tag = i + 1 < n && tag_of.get(i).copied().flatten() == Some(i + 1);
        let pause = if i + 1 < n && (merged[i + 1].2 == si || next_is_my_tag) {
            match mark {
                Some('!') | Some('?') | Some('…') => Pauses::TAG_AFTER_MARK,
                Some(':') => Pauses::COLON,
                _ if quoted || merged[i + 1].3 => Pauses::TAG,
                _ => 0.10,
            }
        } else if i + 1 == n {
            if is_outro {
                Pauses::OUTRO_TAIL
            } else {
                Pauses::TAIL
            }
        } else {
            let mut p = pause_for(mark);
            let next = merged[i + 1].2;
            // a little breath before a long sentence
            if words_in(next) >= 18 {
                p += Pauses::BEFORE_LONG;
            }
            if scene.is_some() && n_sent >= 3 && next == n_sent - 1 {
                p += Pauses::BEFORE_LAST;
            } else if words_in(next) <= 4 && words_in(si) >= 8 && !merged[i + 1].3 {
                p += Pauses::BEFORE_REVEAL;
            }
            p
        };
        let has_end = mark.is_some();
        pieces.push(Piece {
            start: s,
            end: e,
            sentence: si,
            role,
            speaker,
            variant,
            whisper,
            delivery: d,
            pause_after: pause,
            closing_period: is_title || !has_end && i + 1 == n,
            intonation,
        });
    }
    SegmentPlan { id: id.to_string(), text: text.to_string(), tokens, pieces, lead: Pauses::LEAD }
}

/// Plan every segment of a story (characters keep their voice across scenes).
pub fn plan_story(locale: &str, story: &crate::stories::Story) -> Vec<SegmentPlan> {
    let mut cast = Cast::default();
    let ids = story.segment_ids(locale);
    let text = |id: &str| story.text(locale, id).unwrap_or("");
    let scenes: Vec<&str> = ids.iter().filter(|i| i.starts_with('s')).map(|i| text(i)).collect();
    let mut ctx = StoryContext { key_words: key_words(text("title"), &scenes, text("outro")), ..Default::default() };
    ids.iter()
        .filter_map(|id| story.text(locale, id).map(|t| plan_segment(locale, id, t, &mut cast, &mut ctx)))
        .collect()
}

/// The piece's words with its phrasing: `/` continuation, `↗` list item,
/// `↘`/`↗?` the final tone, `*word*` emphasis.
fn reading(p: &SegmentPlan, x: &Piece) -> String {
    let toks = &p.tokens[x.start..x.end];
    let mut out = Vec::new();
    for ph in &x.intonation.phrases {
        let mut words: Vec<String> =
            (ph.start..ph.end)
                .map(|k| {
                    if x.intonation.focus.iter().any(|f| f.0 == k) {
                        format!("*{}*", toks[k])
                    } else {
                        toks[k].clone()
                    }
                })
                .collect();
        let tone = match ph.boundary {
            crate::intonation::Boundary::Continuation => "/",
            crate::intonation::Boundary::ListItem => "↗",
            crate::intonation::Boundary::Final => match x.intonation.kind {
                crate::intonation::Kind::YesNo => "↗?",
                crate::intonation::Kind::Suspension => "→",
                _ => "↘",
            },
        };
        words.push(tone.into());
        out.push(words.join(" "));
    }
    out.join(" ")
}

/// One line per piece, for `ziggy-voice plan`.
pub fn describe(p: &SegmentPlan) -> String {
    let mut out = String::new();
    for x in &p.pieces {
        let who = match (&x.role, &x.variant) {
            (Role::Dialogue, Some(v)) => format!(
                "{:?}{}{}",
                v,
                x.speaker.as_deref().map(|s| format!("({s})")).unwrap_or_default(),
                if x.whisper { " whisper" } else { "" }
            ),
            (r, _) => format!("{r:?}"),
        };
        out.push_str(&format!(
            "  {:<4} {:<28} spd {:.3} f0×{:.3} fmt {:.2} {:+.1}dB {:?}/{:?} | {} | +{:.2}s\n",
            p.id,
            who,
            x.delivery.speed,
            x.delivery.pitch.scale,
            x.delivery.formant,
            x.delivery.gain_db,
            x.intonation.kind,
            x.intonation.emotion,
            reading(p, x),
            x.pause_after
        ));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn plan(text: &str, id: &str) -> SegmentPlan {
        plan_segment("fr", id, text, &mut Cast::default(), &mut StoryContext::default())
    }

    fn words(p: &SegmentPlan, x: &Piece) -> String {
        p.tokens[x.start..x.end].join(" ")
    }

    #[test]
    fn quote_and_tag_are_split() {
        let p = plan("Plus loin, rien. « Oh ! » chuchota Lili. « Ces secrets-là, ce sont des gentillesses ! »", "s3");
        let ws: Vec<String> = p.pieces.iter().map(|x| words(&p, x)).collect();
        assert_eq!(
            ws,
            ["Plus loin, rien.", "« Oh ! »", "chuchota Lili.", "« Ces secrets-là, ce sont des gentillesses ! »"]
        );
        assert_eq!(p.pieces[1].role, Role::Dialogue);
        assert_eq!(p.pieces[1].speaker.as_deref(), Some("lili"));
        assert!(p.pieces[1].whisper);
        assert_eq!(p.pieces[2].role, Role::Tag);
        // the next quote has no tag: it is still Lili
        assert_eq!(p.pieces[3].speaker.as_deref(), Some("lili"));
        assert_eq!(p.pieces[1].pause_after, Pauses::TAG_AFTER_MARK);
        assert!(p.pieces[1].delivery.gain_db < -2.0, "whisper is softer");
    }

    #[test]
    fn speaker_before_and_elders() {
        let mut cast = Cast::default();
        let p = plan_segment("fr", "s2", "Un soir, la vieille bibliothécaire murmura : « On dit que notre royaume cache mille secrets. » Les yeux de Lili brillèrent. « Mille secrets ? Allons-y ! » proposa Lili.", &mut cast, &mut StoryContext::default());
        let q: Vec<&Piece> = p.pieces.iter().filter(|x| x.role == Role::Dialogue).collect();
        assert_eq!(q[0].variant, Some(Variant::Warm));
        assert!(q[0].whisper);
        assert_eq!(q[1].speaker.as_deref(), Some("lili"));
        assert_eq!(q[1].variant, Some(Variant::ChildA));
        let p2 =
            plan_segment("en", "s3", "“Hello!” said Pico. “Hi!” said Lili.", &mut cast, &mut StoryContext::default());
        let v: Vec<Option<Variant>> =
            p2.pieces.iter().filter(|x| x.role == Role::Dialogue).map(|x| x.variant).collect();
        assert_eq!(v, [Some(Variant::ChildB), Some(Variant::ChildA)], "Lili keeps her voice across segments");
    }

    #[test]
    fn subject_of_previous_sentence_speaks() {
        let p = plan("Lumi sourit. « Oh non. Il reste plein de mystères. »", "s5");
        let q: Vec<&Piece> = p.pieces.iter().filter(|x| x.role == Role::Dialogue).collect();
        assert_eq!(q.len(), 2);
        assert!(q.iter().all(|x| x.speaker.as_deref() == Some("lumi")));
    }

    #[test]
    fn pronoun_tags_and_english_order() {
        let p = plan("« Pas de ballon dans la maison », disait souvent grand-mère. « Chut », dit-il.", "s2");
        let q: Vec<&Piece> = p.pieces.iter().filter(|x| x.role == Role::Dialogue).collect();
        assert_eq!(q[0].variant, Some(Variant::Warm));
        let p = plan_segment(
            "en",
            "s1",
            "“Look!” Lili whispered. “Shh,” she said.",
            &mut Cast::default(),
            &mut StoryContext::default(),
        );
        let q: Vec<&Piece> = p.pieces.iter().filter(|x| x.role == Role::Dialogue).collect();
        assert_eq!(q[0].speaker.as_deref(), Some("lili"));
        assert!(q[0].whisper);
    }

    #[test]
    fn notes_and_cross_sentence_tags() {
        let p = plan("Il y avait un mot qui disait « Merci ». Fin du mot.", "s3");
        assert!(p.pieces.iter().all(|x| x.role == Role::Narration));
        let p = plan_segment("en", "s2", "Amina ran to see Grandpa Samir. “Grandpa, the bee is tired!” Grandpa Samir smiled gently. “She is looking for flowers.” “Exactly,” said Grandpa. “They are friends.”", &mut Cast::default(), &mut StoryContext::default());
        let q: Vec<(Option<String>, Option<Variant>)> =
            p.pieces.iter().filter(|x| x.role == Role::Dialogue).map(|x| (x.speaker.clone(), x.variant)).collect();
        assert_eq!(q[0].0.as_deref(), Some("amina"));
        assert_eq!(q[1].1, Some(Variant::Warm));
        assert_eq!(q[2].1, Some(Variant::Warm));
        assert_eq!(q[3].1, Some(Variant::Warm), "a quote right after “said Grandpa.” is still Grandpa");
        assert!(p.pieces.iter().any(|x| x.role == Role::Narration && p.tokens[x.start].starts_with("Grandpa")));
    }

    #[test]
    fn incise_inside_the_guillemets() {
        let p = plan("Lumi brillait. « Moi ? rit Lumi. Je suis un caillou. » « Elle ne change pas, dit Lumi. Le soleil l’éclaire. »", "s4");
        let ws: Vec<(String, Role)> = p.pieces.iter().map(|x| (words(&p, x), x.role.clone())).collect();
        assert!(ws.contains(&("rit Lumi.".to_string(), Role::Tag)), "{ws:?}");
        assert!(ws.contains(&("dit Lumi.".to_string(), Role::Tag)), "{ws:?}");
        assert!(p.pieces.iter().filter(|x| x.role == Role::Dialogue).all(|x| x.speaker.as_deref() == Some("lumi")));
        let q = plan("« Bonsoir, Sacha, dit-elle. Je m’appelle Lumi. »", "s2");
        assert_eq!(q.pieces[1].role, Role::Tag);
        assert!(q.pieces.iter().filter(|x| x.role == Role::Dialogue).all(|x| x.speaker.as_deref() == Some("lumi")));
    }

    #[test]
    fn replies_alternate_and_ziggy_is_the_narrator() {
        let p = plan("« Lumi, pourquoi les étoiles brillent ? » demanda Sacha. « Leur lumière danse. » « Waouh ! Et toi, Lumi ? »", "s3");
        let q: Vec<Option<String>> =
            p.pieces.iter().filter(|x| x.role == Role::Dialogue).map(|x| x.speaker.clone()).collect();
        assert_eq!(q[0].as_deref(), Some("sacha"));
        assert_eq!(q[1].as_deref(), Some("lumi"), "the one who was asked answers");
        assert_eq!(q[2].as_deref(), Some("sacha"), "then the other one again");
        let z = plan("Puis je lui dis : « Tu étais déjà très bien. »", "s4");
        let d = z.pieces.iter().find(|x| x.role == Role::Dialogue).unwrap();
        assert_eq!(d.speaker.as_deref(), Some(ZIGGY));
        assert!((d.delivery.pitch.scale - narrator("fr").pitch.scale).abs() < 1e-6, "Ziggy speaks with his own voice");
        let z = plan("« Bonjour, Gribouille. Moi, c’est Ziggy. »", "s3");
        assert!(z.pieces.iter().all(|x| x.speaker.as_deref() == Some(ZIGGY)));
    }

    #[test]
    fn dialogue_turns() {
        // a rhetorical "Me?" is followed by the same speaker; a real question by the other
        let p = plan_segment(
            "en",
            "s4",
            "“Wow! And you, Lumi, what are you?” asked Sacha. “Me?” laughed Lumi. “I’m a tiny pebble.” “Why?” asked Sacha. “Because.”",
            &mut Cast::default(),
            &mut StoryContext::default(),
        );
        let q: Vec<Option<String>> =
            p.pieces.iter().filter(|x| x.role == Role::Dialogue).map(|x| x.speaker.clone()).collect();
        let q: Vec<&str> = q.iter().map(|x| x.as_deref().unwrap_or("?")).collect();
        assert_eq!(q, ["sacha", "sacha", "lumi", "lumi", "sacha", "lumi"]); // "Wow!" + "And you…" = 2 pieces
                                                                            // a pronoun tag in the middle: the rest of the quotation names the speaker
        let p = plan_segment(
            "en",
            "s2",
            "“Good evening, Sacha,” she said. “My name is Lumi.”",
            &mut Cast::default(),
            &mut StoryContext::default(),
        );
        assert!(p.pieces.iter().filter(|x| x.role == Role::Dialogue).all(|x| x.speaker.as_deref() == Some("lumi")));
        // "Pardon, Nuna." with nobody named: the other character of the story
        let mut cast = Cast::default();
        plan_segment(
            "fr",
            "s2",
            "« Ici ! » dit Kiko. « Non, là ! » dit Nuna.",
            &mut cast,
            &mut StoryContext::default(),
        );
        let p = plan_segment(
            "fr",
            "s5",
            "« Pardon, Nuna. Je me suis fâché. » « Pardon, Kiko. Moi aussi. »",
            &mut cast,
            &mut StoryContext::default(),
        );
        let q: Vec<Option<String>> =
            p.pieces.iter().filter(|x| x.role == Role::Dialogue).map(|x| x.speaker.clone()).collect();
        assert_eq!(q.first().unwrap().as_deref(), Some("kiko"));
        assert_eq!(q.last().unwrap().as_deref(), Some("nuna"));
    }

    #[test]
    fn pauses_and_pacing() {
        let p = plan(
            "Il était une fois un château. Là vivait une princesse avec ses deux amis fidèles et doux. Fin. Elle dort.",
            "s1",
        );
        let x = &p.pieces;
        assert!(x[0].delivery.speed < narrator("fr").speed, "calm opening");
        assert!((x[1].pause_after - (Pauses::SENTENCE + Pauses::BEFORE_REVEAL)).abs() < 1e-6);
        assert!((x[2].pause_after - (Pauses::SENTENCE + Pauses::BEFORE_LAST)).abs() < 1e-6);
        assert!(
            x[3].delivery.speed < narrator("fr").speed && x[3].delivery.gain_db < 0.0,
            "closing line slower and softer"
        );
        assert_eq!(x[3].pause_after, Pauses::TAIL);
        let q = plan("Est-ce qu'il dort ? Oui.", "s2");
        assert_eq!(q.pieces[0].pause_after, Pauses::QUESTION);
        assert!(q.pieces[0].delivery.pitch.gamma > narrator("fr").pitch.gamma);
    }

    #[test]
    fn title_and_outro() {
        let t = plan("Le petit nuage qui voulait aider", "title");
        assert!(t.pieces[0].closing_period);
        assert!(t.pieces[0].delivery.speed < narrator("fr").speed);
        let o = plan("Bonne nuit, mon petit cœur. Fais de beaux rêves.", "outro");
        assert!(o.pieces.iter().all(|p| p.delivery.speed < narrator("fr").speed * 0.95));
        assert_eq!(o.pieces.last().unwrap().pause_after, Pauses::OUTRO_TAIL);
    }

    #[test]
    fn last_scene_winds_down() {
        let p =
            plan("Dehors, la lune souriait. Toi aussi, pense à une gentillesse. Et ferme doucement les yeux.", "s6");
        let sp: Vec<f32> = p.pieces.iter().map(|x| x.delivery.speed).collect();
        assert!(sp[0] < narrator("fr").speed);
        assert!(sp[2] < sp[0]);
    }
}
