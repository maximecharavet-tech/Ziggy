//! Prosody v3, part 2: from the storyteller's reading to the network's
//! controls — per-phoneme duration scales (planning pass), then the pitch
//! contour, the energy curve and a gentle emphasis gain (rendering pass).
//!
//! The pitch contour is built in semitones around the voice's reference:
//!
//! * a **baseline** per intonation phrase with declination, reset at each new
//!   sentence and stepping down phrase after phrase;
//! * **accents** as raised-cosine bumps: French accentual-phrase finals and
//!   the initial accent of emphasis, English pitch accents on stressed
//!   syllables with downstep and a nuclear accent on the last content word;
//! * **boundary tones** over the last syllable(s): French continuation rise
//!   (H%), list items rising, final fall on statements, rise on yes/no
//!   questions, high start then fall on wh-questions, a hanging end on « … »;
//! * the model's own **micro-prosody** (and a share of its macro movement)
//!   is kept on top, so the voice stays alive.
//!
//! Everything is smooth (raised cosines, smoothsteps, a slope limit) and only
//! voiced frames change. Durations: phrase-final lengthening, longer emphasis,
//! a pause hierarchy on the punctuation tokens.

use crate::align::PUNCT_PS;
use crate::intonation::{content_word, Boundary, Emotion, Focus, Intonation, Kind};
use crate::kokoro::Prediction;

/// Pitch frames per duration frame (Kokoro: 2 × 12.5 ms per 25 ms).
const F0_PER_FRAME: usize = 2;

pub fn is_vowel(c: char) -> bool {
    "aeiouyøœɛɔəɑæɐɒɪʊʌɜɨʉᵻAIOQWYɚ".contains(c)
}

/// One model token (phoneme, stress mark, space, punctuation…).
#[derive(Clone, Debug)]
pub struct Unit {
    pub c: char,
    pub vowel: bool,
    pub punct: bool,
    /// Token of the piece it belongs to.
    pub word: Option<usize>,
}

/// The phoneme string of an utterance, organised in words and syllables.
#[derive(Clone, Debug)]
pub struct Layout {
    pub units: Vec<Unit>,
    /// Per token of the piece: its unit range (`None`: no sound).
    pub words: Vec<Option<(usize, usize)>>,
}

impl Layout {
    /// `kept`: the model's characters (one per id), `at`: char → id index,
    /// `starts`: per token, its first char in the phoneme string.
    pub fn new(kept: &[char], at: &[usize], starts: &[Option<usize>]) -> Self {
        let n = kept.len();
        let first: Vec<Option<usize>> =
            starts.iter().map(|s| s.map(|c| at.get(c).copied().unwrap_or(n).min(n))).collect();
        let mut words = vec![None; starts.len()];
        for (k, f) in first.iter().enumerate() {
            let Some(a) = *f else { continue };
            let b = first[k + 1..].iter().flatten().copied().find(|&x| x > a).unwrap_or(n);
            // the word stops before a following space or punctuation
            let mut e = a;
            while e < b && kept[e] != ' ' {
                e += 1;
            }
            let mut e2 = e;
            while e2 > a && PUNCT_PS.contains(&kept[e2 - 1]) {
                e2 -= 1;
            }
            if e2 > a {
                words[k] = Some((a, e2));
            }
        }
        let mut units: Vec<Unit> =
            kept.iter().map(|&c| Unit { c, vowel: is_vowel(c), punct: PUNCT_PS.contains(&c), word: None }).collect();
        for (k, w) in words.iter().enumerate() {
            if let Some((a, b)) = w {
                for u in &mut units[*a..*b] {
                    u.word = Some(k);
                }
            }
        }
        Layout { units, words }
    }

    fn nuclei(&self, a: usize, b: usize) -> Vec<usize> {
        (a..b).filter(|&i| self.units[i].vowel).collect()
    }

    /// The syllable holding nucleus `v` inside [a, b): (onset start, nucleus, end).
    fn syllable(&self, a: usize, b: usize, v: usize) -> (usize, usize, usize) {
        let nuc = self.nuclei(a, b);
        let k = nuc.iter().position(|&x| x == v).unwrap_or(0);
        let prev = if k == 0 { a } else { nuc[k - 1] + 1 };
        let next = nuc.get(k + 1).copied().unwrap_or(b);
        // onset: the consonants just before the vowel (at most two)
        let mut onset = v;
        while onset > prev && v - onset < 2 && !self.units[onset - 1].vowel && self.units[onset - 1].c != ' ' {
            onset -= 1;
        }
        // coda up to the next onset
        let mut end = v + 1;
        while end < next && (self.units[end].c == '\u{303}' || self.units[end].c == 'ː') {
            end += 1;
        }
        let end = if k + 1 == nuc.len() { b } else { end.max(next.saturating_sub(1).max(v + 1)) };
        (onset, v, end)
    }

    /// The stressed syllable's nucleus of word `k` (French: the last one;
    /// English: after the primary stress mark).
    pub fn stressed(&self, k: usize, french: bool) -> Option<usize> {
        let (a, b) = self.words.get(k).copied().flatten()?;
        let nuc = self.nuclei(a, b);
        if french {
            return nuc.last().copied();
        }
        (a..b)
            .find(|&i| self.units[i].c == 'ˈ')
            .and_then(|s| nuc.iter().copied().find(|&v| v > s))
            .or(nuc.first().copied())
    }

    /// Nucleus that carries emphasis (French: initial accent, the first one).
    pub fn emphasis_nucleus(&self, k: usize, french: bool) -> Option<usize> {
        let (a, b) = self.words.get(k).copied().flatten()?;
        if french {
            self.nuclei(a, b).first().copied()
        } else {
            self.stressed(k, false)
        }
    }

    /// The last syllable of a token range: (onset start, nucleus, end).
    pub fn last_syllable(&self, toks: std::ops::Range<usize>) -> Option<(usize, usize, usize)> {
        let k = toks
            .clone()
            .rev()
            .find(|&k| self.words.get(k).copied().flatten().is_some_and(|(a, b)| !self.nuclei(a, b).is_empty()))?;
        let (a, b) = self.words[k]?;
        let v = *self.nuclei(a, b).last()?;
        Some(self.syllable(a, b, v))
    }

    /// Units of a token range.
    pub fn span(&self, toks: std::ops::Range<usize>) -> Option<(usize, usize)> {
        let ws: Vec<(usize, usize)> = toks.filter_map(|k| self.words.get(k).copied().flatten()).collect();
        Some((ws.first()?.0, ws.last()?.1))
    }
}

/// How a piece is voiced (from the delivery and the analysis).
#[derive(Clone, Copy, Debug)]
pub struct Voice {
    pub french: bool,
    /// Reference pitch of the role (Hz): the contour is drawn around it.
    pub reference_hz: f32,
    /// Excursions scale (narrator 1, characters livelier, tags flatter).
    pub range: f32,
}

/// Prosodic colour of a feeling: (level st, range ×, energy N offset).
pub fn feeling(e: Emotion) -> (f64, f64, f32) {
    match e {
        Emotion::Neutral => (0.0, 1.0, 0.0),
        Emotion::Joy => (0.6, 1.15, 0.3),
        Emotion::Wonder => (0.8, 1.25, 0.2),
        Emotion::Tenderness => (-0.3, 0.9, -0.3),
        Emotion::Worry => (0.0, 0.85, -0.3),
        Emotion::Calm => (-0.2, 0.85, -0.2),
        Emotion::Sleepy => (-0.8, 0.7, -0.6),
    }
}

/// Tempo of a feeling (multiplies Kokoro's speed).
pub fn feeling_tempo(e: Emotion) -> f32 {
    match e {
        Emotion::Joy => 1.03,
        Emotion::Wonder => 0.97,
        Emotion::Tenderness | Emotion::Worry => 0.96,
        Emotion::Calm => 0.97,
        Emotion::Sleepy => 0.93,
        Emotion::Neutral => 1.0,
    }
}

fn clause_word(tok: &str) -> bool {
    let w = crate::text::split_core(tok).1.to_lowercase();
    [
        "et", "mais", "car", "puis", "alors", "donc", "qui", "que", "qu’", "dont", "où", "quand", "parce", "and",
        "but", "so", "because", "when", "while", "who", "which", "that", "then",
    ]
    .contains(&w.as_str())
}

/// Planning pass: duration scale per model input (boundary tokens included).
pub fn dur_scale(l: &Layout, i: &Intonation, toks: &[String], french: bool) -> Vec<f32> {
    let n = l.units.len();
    let mut s = vec![1.0f32; n + 2];
    let mut set = |u: usize, v: f32| s[u + 1] = (s[u + 1] * v).clamp(0.5, 2.5);
    // phrase-final lengthening (nucleus and coda of the last syllable)
    for (pi, p) in i.phrases.iter().enumerate() {
        let last = pi + 1 == i.phrases.len();
        let f = match (p.boundary, i.kind) {
            _ if i.tag => 1.0,
            (Boundary::Final, Kind::Suspension) => 1.45,
            (Boundary::Final, _) if i.landing => 1.4,
            (Boundary::Final, Kind::YesNo) | (Boundary::Final, Kind::Exclamation) => 1.2,
            (Boundary::Final, _) => 1.3,
            (Boundary::ListItem, _) => 1.25,
            (Boundary::Continuation, _) if last && i.continues => 1.2,
            (Boundary::Continuation, _) => 1.25,
        };
        if let Some((_, v, e)) = l.last_syllable(p.start..p.end) {
            for u in v..e {
                set(u, f);
            }
        }
        // list items are never rushed
        if p.boundary == Boundary::ListItem {
            if let Some((a, b)) = l.span(p.start..p.end) {
                for u in a..b {
                    set(u, 1.05);
                }
            }
        }
        // pause hierarchy on the punctuation that closes the phrase
        if !last {
            let next_clause = toks.get(p.end).is_some_and(|t| clause_word(t));
            // the phrase's last word (a lone « : » after it is part of its punctuation)
            let Some(k) = (p.start..p.end).rev().find(|&k| l.words.get(k).copied().flatten().is_some()) else {
                continue;
            };
            let post: String =
                toks[k + 1..p.end].iter().fold(crate::text::split_core(&toks[k]).2.to_string(), |a, t| a + t);
            let pf = if post.contains(['…']) {
                1.5
            } else if post.contains([':', ';', '—']) {
                1.3
            } else if p.boundary == Boundary::ListItem {
                1.15
            } else if next_clause {
                1.25
            } else {
                1.0
            };
            if let Some((_, b)) = l.words.get(k).copied().flatten() {
                let mut u = b;
                while u < n && l.units[u].c != ' ' {
                    if l.units[u].punct {
                        set(u, pf);
                    }
                    u += 1;
                }
            }
        }
    }
    // emphasis: the accented syllable a little longer
    for &(k, f) in &i.focus {
        if let Some(v) = l.emphasis_nucleus(k, french) {
            let lengthen = if f == Focus::Onomatopoeia { 1.2 } else { 1.15 };
            set(v, lengthen);
            if v > 0 && !l.units[v - 1].vowel && l.units[v - 1].c != ' ' {
                set(v - 1, 1.1);
            }
        }
    }
    // « Mais… »: a little breath after the contrast word
    if let Some(k) = i.breath_after {
        if let Some((_, b)) = l.words.get(k).copied().flatten() {
            if b < n && l.units[b].c == ' ' {
                s[b + 1] = 4.0;
            }
        }
    }
    s
}

/// Raised-cosine bump.
fn bump(x: f64, centre: f64, half: f64) -> f64 {
    let d = (x - centre).abs();
    if d >= half {
        0.0
    } else {
        0.5 + 0.5 * (std::f64::consts::PI * d / half).cos()
    }
}

fn smoothstep(u: f64) -> f64 {
    let u = u.clamp(0.0, 1.0);
    u * u * (3.0 - 2.0 * u)
}

/// The rendered controls of an utterance.
#[derive(Clone, Debug, Default)]
pub struct Curves {
    pub f0: Vec<f32>,
    pub n: Vec<f32>,
    /// Emphasis loudness, applied on the audio.
    pub gains: Gains,
    /// The rule contour in semitones (for checks), per pitch value.
    pub target_st: Vec<f64>,
}

/// (first unit, end unit, dB) spans of extra loudness.
pub type Gains = Vec<(usize, usize, f32)>;

pub struct Params {
    /// Model melody smoothing for the "macro" contour (pitch values, σ).
    pub macro_sigma: f64,
    /// Max pitch slope (semitones per 12.5 ms): only catches glitches.
    pub max_slope: f64,
    /// Storyteller widening of the model's own excursions (narration).
    pub widen: f64,
    /// Excursions stay linear up to `knee` st, then saturate softly at `limit`.
    pub knee: f64,
    pub limit: f64,
    /// The model's fast pitch detail (around the macro contour) is kept up to this (st).
    pub micro: f64,
    pub emphasis: f64,
    pub emphasis_db: f32,
    pub emphasis_n: f32,
    /// Minimum continuation rise at a non-final phrase end (st above the
    /// phrase's mean), French / English.
    pub continuation_fr: f64,
    pub continuation_en: f64,
    pub list_rise: f64,
    /// Statements end at least this far below the phrase mean.
    pub final_fall: f64,
    pub landing_fall: f64,
    /// Yes/no questions end at least this far above it, and this far above
    /// their first word; the end of the vowel climbs a little more.
    pub yes_no_rise: f64,
    pub yes_no_over_head: f64,
    pub question_lift: f64,
    /// Emphasis: the syllable peaks this far above the words around it
    /// (never more than `emphasis_max` added).
    pub emphasis_over: f64,
    pub emphasis_max: f64,
    /// …beyond that, the higher neighbour is lowered by up to this.
    pub deaccent_max: f64,
    /// Fast pitch detail allowed on a rising boundary syllable (st).
    pub micro_rise: f64,
    /// Wh-questions and exclamations: the first word at least this high.
    pub wh_head: f64,
    pub exclaim_head: f64,
    /// « … » does not fall below this.
    pub suspension_floor: f64,
    /// Never below / above the role's reference by more than this (st).
    pub floor: f64,
    pub ceiling: f64,
}

pub const PARAMS: Params = Params {
    macro_sigma: 6.0,
    max_slope: 1.0,
    widen: 1.15,
    knee: 4.5,
    limit: 9.0,
    micro: 2.5,
    emphasis: 2.5,
    emphasis_db: 1.5,
    emphasis_n: 0.8,
    continuation_fr: 2.5,
    continuation_en: 1.5,
    list_rise: 2.5,
    final_fall: 3.0,
    landing_fall: 4.0,
    yes_no_rise: 4.0,
    yes_no_over_head: 2.0,
    question_lift: 1.5,
    emphasis_over: 1.5,
    emphasis_max: 4.0,
    deaccent_max: 2.0,
    micro_rise: 0.8,
    wh_head: 2.0,
    exclaim_head: 3.0,
    suspension_floor: -0.5,
    floor: -7.0,
    ceiling: 9.0,
};

/// Rendering pass: pitch, energy and gain from the analysis and the
/// planning pass. The model's own melody is kept and widened; rules only
/// correct what it misses (a list item that does not rise, a question that
/// does not climb, a statement that does not land…) and add emphasis.
pub fn curves(l: &Layout, i: &Intonation, toks: &[String], pred: &Prediction, v: Voice) -> Curves {
    let p = &PARAMS;
    let n_f0 = pred.f0.len();
    // pitch-value index where each unit starts / ends
    let mut starts = Vec::with_capacity(l.units.len() + 1);
    let mut acc = pred.durations.first().copied().unwrap_or(0) as usize; // leading boundary
    for u in 0..l.units.len() {
        starts.push(acc * F0_PER_FRAME);
        acc += pred.durations.get(u + 1).copied().unwrap_or(1) as usize;
    }
    starts.push(acc * F0_PER_FRAME);
    let at = |u: usize| starts[u.min(starts.len() - 1)] as f64;
    let mid = |u: usize| 0.5 * (at(u) + at(u + 1));

    let voiced: Vec<bool> = pred.f0.iter().map(|&f| f > 10.0).collect();
    // the model's melody, in semitones around its own median
    let median = {
        let mut v: Vec<f64> = pred.f0.iter().filter(|&&f| f > 10.0).map(|&f| f as f64).collect();
        v.sort_by(|a, b| a.partial_cmp(b).unwrap());
        v.get(v.len() / 2).copied().unwrap_or(v.first().copied().unwrap_or(200.0))
    };
    let m: Vec<f64> =
        pred.f0.iter().map(|&f| if f > 10.0 { 12.0 * (f as f64 / median).log2() } else { f64::NAN }).collect();
    let macro_ = smooth_voiced(&m, &voiced, p.macro_sigma);
    let mean_m = {
        let v: Vec<f64> = macro_.iter().zip(&voiced).filter(|(_, &b)| b).map(|(x, _)| *x).collect();
        if v.is_empty() {
            0.0
        } else {
            v.iter().sum::<f64>() / v.len() as f64
        }
    };

    let (level, emo_range, emo_n) = feeling(i.emotion);
    let mut range = v.range as f64 * emo_range * p.widen;
    if i.landing {
        range *= 0.85;
    }
    if i.whisper {
        range *= 0.6;
    }
    if i.tag {
        range *= 0.6;
    }
    if matches!(i.kind, Kind::Exclamation | Kind::Onomatopoeia) {
        range *= 1.2;
    }
    let level = level + if i.landing { -1.0 } else { 0.0 } + if i.tag { -1.5 } else { 0.0 };
    // the widened model melody (the "expressive" contour), unvoiced filled;
    // linear up to a knee, then soft: a creaky final fall of the model is
    // never deepened, and big excursions stay musical
    let expressive: Vec<f64> = macro_.iter().map(|x| mean_m + knee(range * (x - mean_m), p.knee, p.limit)).collect();
    let mut corr = vec![0.0f64; n_f0];
    let mean_over = |a: f64, b: f64, src: &[f64]| -> Option<f64> {
        let (a, b) = (a.max(0.0) as usize, (b as usize).min(n_f0));
        let v: Vec<f64> = (a..b).filter(|&j| voiced[j]).map(|j| src[j]).collect();
        (!v.is_empty()).then(|| v.iter().sum::<f64>() / v.len() as f64)
    };

    let mut micro_lim = vec![p.micro; n_f0];
    // where the piece begins (a question must end above it)
    let head = i
        .phrases
        .first()
        .and_then(|ph| (ph.start..ph.end).find_map(|k| l.words[k]))
        .and_then(|(a, b)| mean_over(at(a), at(b), &expressive))
        .unwrap_or(0.0);
    let nph = i.phrases.len();
    for (pi, ph) in i.phrases.iter().enumerate() {
        let Some((ua, ub)) = l.span(ph.start..ph.end) else { continue };
        let (fa, fb) = (at(ua), at(ub).max(at(ua) + 1.0));
        let Some(reference) = mean_over(fa, fb, &expressive) else { continue };
        let next_start = if pi + 1 < nph { i.phrases[pi + 1].start } else { usize::MAX };
        let fend = if next_start == usize::MAX {
            n_f0 as f64
        } else {
            l.span(next_start..next_start + 1).map(|x| at(x.0)).unwrap_or(fb)
        };
        let words: Vec<usize> =
            (ph.start..ph.end).filter(|&k| l.words[k].is_some() && content_word(&toks[k])).collect();

        // heads: wh-questions and exclamations start high
        if pi == 0 && !i.tag {
            let need = match i.kind {
                Kind::Wh => Some(p.wh_head),
                Kind::Exclamation => Some(p.exclaim_head),
                Kind::Imperative => Some(p.wh_head * 0.75),
                _ => None,
            };
            if let (Some(need), Some(&k)) = (need, words.first()) {
                if let Some((a, b)) = l.words[k] {
                    if let Some(e) = mean_over(at(a), at(b), &expressive) {
                        let lift = reference + need - e;
                        if lift > 0.0 {
                            add_bump(&mut corr, 0.5 * (at(a) + at(b)), (at(b) - at(a)).max(12.0), lift);
                        }
                    }
                }
            }
        }

        // the boundary tone: the last syllable is brought to its target. The
        // model's own melody is kept wherever it already does the job; where
        // it misses (a creaky fall at a question's end…), the contour follows
        // a smooth glide from the syllable before to the target.
        let Some((o, nuc, end)) = l.last_syllable(ph.start..ph.end) else { continue };
        let question = ph.boundary == Boundary::Final && i.kind == Kind::YesNo;
        let (goal, falling) = match ph.boundary {
            Boundary::Continuation if i.tag => continue,
            Boundary::Continuation => (reference + if v.french { p.continuation_fr } else { p.continuation_en }, false),
            Boundary::ListItem => (reference + p.list_rise, false),
            Boundary::Final => match i.kind {
                // a yes/no question ends above where it began
                Kind::YesNo => ((reference + p.yes_no_rise).max(head + p.yes_no_over_head), false),
                Kind::Suspension => (reference + p.suspension_floor, false),
                _ if i.landing => (reference - p.landing_fall, true),
                _ => (reference - p.final_fall, true),
            },
        };
        // the glide starts on the syllable before (questions, falls) or at the
        // last syllable's onset (continuations), and reaches its target in
        // the middle of the last vowel, so it is heard on voiced sound
        let span_start = l.span(ph.start..ph.end).map_or(0, |x| x.0);
        let prev = l.nuclei(span_start, nuc).last().map(|&pv| mid(pv));
        let r0 = if falling || question { prev.unwrap_or(at(o)) } else { at(o) }.max(fa).min(n_f0 as f64 - 1.0);
        // (a question is up there as its last vowel begins, and climbs on)
        let s1 = if question { at(nuc) + 2.0 } else { mid(nuc) }.max(r0 + 4.0);
        let hold_end = at(end).max(s1);
        let j0 = r0.max(0.0) as usize;
        let from = expressive[j0] + corr[j0];
        let mut reached: Option<f64> = None; // the level at the target point
        for j in j0..(fend as usize).min(n_f0) {
            let x = j as f64;
            let mut g = from + (goal - from) * smoothstep((x - r0) / (s1 - r0));
            // questions keep climbing to the end of the vowel
            if question && x > s1 {
                let extra = p.question_lift * ((x - s1) / (hold_end - s1).max(1.0)).min(1.0);
                g = g.max(reached.unwrap_or(g)) + extra;
            }
            let now = expressive[j] + corr[j];
            let d = if falling { (g - now).min(0.0) } else { (g - now).max(0.0) };
            let hold = if x > hold_end && ph.boundary != Boundary::Final {
                1.0 - smoothstep((x - hold_end) / 4.0)
            } else {
                1.0
            };
            corr[j] += d * hold;
            if x >= s1 && reached.is_none() {
                reached = Some(expressive[j] + corr[j]);
            }
            // the model's fast detail (a creaky end) must not drag a rise down
            if !falling && x >= s1 - 2.0 && (x <= hold_end || ph.boundary == Boundary::Final) {
                micro_lim[j] = p.micro_rise;
            }
        }
    }
    // emphasis (initial accent in French, stressed syllable in English): the
    // syllable peaks clearly above the words around it
    let mut gains = Vec::new();
    // (highest value, where) over voiced values a..b
    let peak_over = |a: f64, b: f64, corr: &[f64]| -> Option<(f64, usize)> {
        let (a, b) = (a.max(0.0) as usize, (b as usize).min(n_f0));
        (a..b).filter(|&j| voiced[j]).map(|j| (expressive[j] + corr[j], j)).reduce(|x, y| if y.0 > x.0 { y } else { x })
    };
    for &(k, f) in &i.focus {
        let Some(s) = l.emphasis_nucleus(k, v.french) else { continue };
        let scale = (range / p.widen).clamp(0.6, 1.3);
        let base = if f == Focus::Contrast { p.emphasis * 0.6 } else { p.emphasis } * scale;
        // French lifts the word from its first syllable (initial accent) to
        // its last vowel, so « SEcrets » does not hang on a weak schwa;
        // English lifts its stressed syllable
        let (fa, fb) = if v.french {
            let last = l.words[k].and_then(|(a, b)| l.nuclei(a, b).last().copied()).unwrap_or(s);
            (at(s) - 2.0, mid(last).max(at(s + 1)))
        } else {
            (at(s), at(s + 1))
        };
        let here = peak_over(fa, fb, &corr);
        // the higher of the two neighbouring words: (peak, its unit span)
        let around = [k.checked_sub(1), Some(k + 1)]
            .into_iter()
            .flatten()
            .filter_map(|j| l.words.get(j).copied().flatten())
            .filter_map(|(a, b)| peak_over(at(a), at(b), &corr).map(|x| (x.0, a, b)))
            .reduce(|x, y| if y.0 > x.0 { y } else { x });
        let need = match (here, around) {
            (Some(h), Some(n)) => n.0 + p.emphasis_over * scale - h.0,
            _ => 0.0,
        };
        let amp = base.max(need).min(p.emphasis_max);
        if v.french {
            add_plateau(&mut corr, fa, fb, amp, 6.0);
        } else {
            add_bump(&mut corr, mid(s), 14.0, amp);
        }
        // what the lift cannot give, a quieter neighbour does (de-accenting)
        if let Some((_, a, b)) = around.filter(|_| need > p.emphasis_max) {
            add_plateau(&mut corr, at(a), at(b), -(need - p.emphasis_max).min(p.deaccent_max), 4.0);
        }
        if let Some((a, b)) = l.words[k] {
            gains.push((a, b, p.emphasis_db));
        }
    }

    let target_st: Vec<f64> = (0..n_f0).map(|j| (level + expressive[j] + corr[j]).clamp(p.floor, p.ceiling)).collect();
    let mut out_st: Vec<f64> = (0..n_f0)
        .map(|j| {
            if voiced[j] {
                (target_st[j] + (m[j] - macro_[j]).clamp(-micro_lim[j], micro_lim[j])).clamp(p.floor, p.ceiling)
            } else {
                f64::NAN
            }
        })
        .collect();
    limit_slope(&mut out_st, p.max_slope);
    let f0: Vec<f32> = (0..n_f0)
        .map(|j| if voiced[j] { (v.reference_hz as f64 * 2f64.powf(out_st[j] / 12.0)) as f32 } else { pred.f0[j] })
        .collect();

    // energy: breath and effort
    let mut n_off = vec![
        emo_n
            + if i.whisper { -2.0 } else { 0.0 }
            + if i.landing { -0.6 } else { 0.0 }
            + if i.tag { -0.4 } else { 0.0 };
        n_f0
    ];
    for &(a, b, _) in &gains {
        let (fa, fb) = (at(a), at(b));
        for (j, x) in n_off.iter_mut().enumerate() {
            let jf = j as f64;
            let w = if jf < fa {
                smoothstep(1.0 - (fa - jf) / 4.0)
            } else if jf > fb {
                smoothstep(1.0 - (jf - fb) / 4.0)
            } else {
                1.0
            };
            *x += p.emphasis_n * w as f32;
        }
    }
    let n: Vec<f32> = pred.n.iter().zip(&n_off).map(|(a, b)| a + b).collect();
    Curves { f0, n, gains, target_st }
}

/// Linear up to ±`k`, then a soft approach to ±`lim`.
fn knee(d: f64, k: f64, lim: f64) -> f64 {
    if d.abs() <= k {
        d
    } else {
        d.signum() * (k + (lim - k) * ((d.abs() - k) / (lim - k)).tanh())
    }
}

/// `amp` from `a` to `b` (pitch values), with smooth ramps of `ramp` outside.
fn add_plateau(exc: &mut [f64], a: f64, b: f64, amp: f64, ramp: f64) {
    for (j, e) in exc.iter_mut().enumerate() {
        let x = j as f64;
        let w = if x < a {
            smoothstep(1.0 - (a - x) / ramp)
        } else if x > b {
            smoothstep(1.0 - (x - b) / ramp)
        } else {
            1.0
        };
        *e += amp * w;
    }
}

fn add_bump(exc: &mut [f64], centre: f64, half: f64, amp: f64) {
    let lo = (centre - half).floor().max(0.0) as usize;
    let hi = ((centre + half).ceil() as usize).min(exc.len());
    for (j, e) in exc.iter_mut().enumerate().take(hi).skip(lo) {
        *e += amp * bump(j as f64, centre, half);
    }
}

/// Gaussian-like smoothing over voiced frames (gaps interpolated).
fn smooth_voiced(x: &[f64], voiced: &[bool], sigma: f64) -> Vec<f64> {
    let n = x.len();
    // fill gaps linearly so the smoothing does not see holes
    let mut filled = x.to_vec();
    let idx: Vec<usize> = (0..n).filter(|&j| voiced[j]).collect();
    if idx.is_empty() {
        return vec![0.0; n];
    }
    for j in 0..n {
        if !voiced[j] {
            let next = idx.iter().find(|&&k| k > j).copied();
            let prev = idx.iter().rev().find(|&&k| k < j).copied();
            filled[j] = match (prev, next) {
                (Some(a), Some(b)) => x[a] + (x[b] - x[a]) * (j - a) as f64 / (b - a) as f64,
                (Some(a), None) => x[a],
                (None, Some(b)) => x[b],
                _ => 0.0,
            };
        }
    }
    let r = (3.0 * sigma) as isize;
    let w: Vec<f64> = (-r..=r).map(|d| (-(d * d) as f64 / (2.0 * sigma * sigma)).exp()).collect();
    (0..n)
        .map(|j| {
            let (mut s, mut ws) = (0.0, 0.0);
            for (k, wk) in w.iter().enumerate() {
                let t = j as isize + k as isize - r;
                if t >= 0 && (t as usize) < n {
                    s += wk * filled[t as usize];
                    ws += wk;
                }
            }
            s / ws
        })
        .collect()
}

/// Limit the pitch slope inside voiced runs (forward then backward).
pub fn limit_slope(st: &mut [f64], max: f64) {
    for j in 1..st.len() {
        if st[j].is_finite() && st[j - 1].is_finite() {
            st[j] = st[j].clamp(st[j - 1] - max, st[j - 1] + max);
        }
    }
    for j in (0..st.len().saturating_sub(1)).rev() {
        if st[j].is_finite() && st[j + 1].is_finite() {
            st[j] = st[j].clamp(st[j + 1] - max, st[j + 1] + max);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intonation::{analyse, PieceInfo, StoryContext};
    use crate::kokoro::encode;
    use crate::text::tokenize;

    /// A fake utterance: the phonemes of each token ("" = no sound, like a
    /// lone « ? »), every unit three duration frames, voiced at 200 Hz.
    fn fake(words: &[&str], toks: &[String]) -> (Layout, Prediction) {
        assert_eq!(words.len(), toks.len());
        let spoken: Vec<&str> = words.iter().copied().filter(|w| !w.is_empty()).collect();
        let ps = spoken.join(" ");
        let (ids, at, kept) = encode(&ps);
        let mut starts = Vec::new();
        let mut pos = 0;
        for w in words {
            if w.is_empty() {
                starts.push(None);
            } else {
                starts.push(Some(pos));
                pos += w.chars().count() + 1;
            }
        }
        let l = Layout::new(&kept, &at, &starts);
        let durations: Vec<i64> = std::iter::once(2).chain(ids.iter().map(|_| 3)).chain(std::iter::once(2)).collect();
        let frames: i64 = durations.iter().sum();
        // pauses (punctuation) are silent, as in Kokoro's output
        let mut f0 = vec![200.0; frames as usize * 2];
        let mut acc = durations[0] as usize;
        for (u, unit) in l.units.iter().enumerate() {
            let len = durations[u + 1] as usize;
            if unit.punct {
                for x in &mut f0[acc * 2..(acc + len) * 2] {
                    *x = 0.5;
                }
            }
            acc += len;
        }
        let pred = Prediction { durations, f0, n: vec![0.0; frames as usize * 2] };
        (l, pred)
    }

    fn info<'a>(toks: &'a [String]) -> PieceInfo<'a> {
        PieceInfo { locale: "fr", toks, sentence: toks, continues: false, landing: false, tag: false, whisper: false }
    }

    /// Highest pitch (st) inside token k.
    fn st_peak(l: &Layout, pred: &Prediction, c: &Curves, k: usize) -> f64 {
        let (a, b) = l.words[k].unwrap();
        let mut acc = pred.durations[0] as usize;
        let mut best = f64::MIN;
        for u in 0..l.units.len() {
            let len = pred.durations[u + 1] as usize;
            if u >= a && u < b {
                for j in acc * 2..(acc + len) * 2 {
                    best = best.max(12.0 * (c.f0[j] as f64 / 244.0).log2());
                }
            }
            acc += len;
        }
        best
    }

    /// Pitch (st) at the first / last frame of token k.
    fn st_edge(l: &Layout, pred: &Prediction, c: &Curves, k: usize, last: bool) -> f64 {
        let (a, b) = l.words[k].unwrap();
        let mut acc = pred.durations[0] as usize;
        let mut first = None;
        let mut end = 0;
        for u in 0..l.units.len() {
            let len = pred.durations[u + 1] as usize;
            if u == a {
                first = Some(acc * 2);
            }
            if u + 1 == b {
                end = (acc + len) * 2 - 1;
            }
            acc += len;
        }
        let j = if last { end } else { first.unwrap() };
        12.0 * (c.f0[j] as f64 / 244.0).log2()
    }

    const V: Voice = Voice { french: true, reference_hz: 244.0, range: 1.0 };

    #[test]
    fn layout_words_and_syllables() {
        let toks = tokenize("Le petit chat.");
        let (l, _) = fake(&["lə", "pətˈi", "ʃˈa."], &toks);
        assert_eq!(l.words[1], Some((3, 8)));
        assert_eq!(l.words[2], Some((9, 12)), "the final dot is not part of the word");
        let v = l.stressed(1, true).unwrap();
        assert_eq!(l.units[v].c, 'i');
        assert_eq!(l.units[l.emphasis_nucleus(1, true).unwrap()].c, 'ə');
        let (o, nuc, e) = l.last_syllable(0..3).unwrap();
        assert_eq!((l.units[o].c, l.units[nuc].c, e), ('ʃ', 'a', 12));
    }

    #[test]
    fn statements_fall_questions_rise() {
        let toks = tokenize("Le petit chat dort.");
        let (l, pred) = fake(&["lə", "pətˈi", "ʃˈa", "dˈɔʁ."], &toks);
        let i = analyse(&info(&toks), &mut StoryContext::default());
        let c = curves(&l, &i, &toks, &pred, V);
        assert!(st_edge(&l, &pred, &c, 3, true) < st_edge(&l, &pred, &c, 0, false) - 2.5, "a statement ends low");
        let toks = tokenize("Le petit chat dort ?");
        let (l, pred) = fake(&["lə", "pətˈi", "ʃˈa", "dˈɔʁ", "?"], &toks);
        let i = analyse(&info(&toks), &mut StoryContext::default());
        assert_eq!(i.kind, Kind::YesNo);
        let c = curves(&l, &i, &toks, &pred, V);
        let end = *c.target_st.iter().rev().find(|x| x.is_finite()).unwrap();
        assert!(end > c.target_st[10] + 2.0, "a yes/no question ends high: {end}");

        // the model starts high and ends in a creaky fall: the question still
        // ends above its first word, and its last vowel climbs
        let toks = tokenize("Et si nous ajoutions un secret ?");
        let (l, mut pred) = fake(&["e", "si", "nu", "aʒutjˈɔ̃", "œ̃", "səkʁˈɛ", "?"], &toks);
        let n = pred.f0.len();
        for (j, f) in pred.f0.iter_mut().enumerate() {
            if *f > 10.0 {
                let x = j as f32 / n as f32;
                *f = if x < 0.2 { 260.0 } else { 260.0 * (1.0 - 0.6 * (x - 0.2)) };
            }
        }
        let i = analyse(&info(&toks), &mut StoryContext::default());
        assert_eq!(i.kind, Kind::YesNo);
        let c = curves(&l, &i, &toks, &pred, V);
        let first = st_edge(&l, &pred, &c, 0, false);
        let last = st_edge(&l, &pred, &c, 5, true);
        assert!(last > first + 1.5, "ends above its start: {first:.1} → {last:.1}");
        // the values of the last word (its vowel ends it)
        let (a, b) = l.words[5].unwrap();
        let first_val: usize = pred.durations[..=a].iter().sum::<i64>() as usize * 2;
        let end_val: usize = pred.durations[..=b].iter().sum::<i64>() as usize * 2;
        let word: Vec<f64> = (first_val..end_val).map(|j| 12.0 * (c.f0[j] as f64 / 244.0).log2()).collect();
        let tail = &word[word.len() - 6..];
        assert!(tail.windows(2).all(|w| w[1] >= w[0] - 0.05), "the last vowel climbs: {tail:?}");
    }

    #[test]
    fn lists_rise_item_by_item_and_emphasis_peaks() {
        let toks = tokenize("Il voit des chats, des chiens et des oiseaux.");
        let words = ["il", "vwˈa", "de", "ʃˈa,", "de", "ʃjˈɛ̃", "e", "de", "wazˈo."];
        let (l, pred) = fake(&words, &toks);
        let i = analyse(&info(&toks), &mut StoryContext::default());
        let kinds: Vec<Boundary> = i.phrases.iter().map(|p| p.boundary).collect();
        assert_eq!(kinds, [Boundary::ListItem, Boundary::ListItem, Boundary::Final]);
        let c = curves(&l, &i, &toks, &pred, V);
        // each item ends higher than it starts; the last one falls
        assert!(st_edge(&l, &pred, &c, 3, true) > st_edge(&l, &pred, &c, 2, false) + 1.5);
        assert!(st_edge(&l, &pred, &c, 5, true) > st_edge(&l, &pred, &c, 4, false) + 1.5);
        assert!(st_edge(&l, &pred, &c, 8, true) < st_edge(&l, &pred, &c, 6, false) - 1.5);
        // "très" peaks (a neutral sentence: "dort" would make it sleepy, softer)
        let toks = tokenize("Il marche très longtemps.");
        let (l, pred) = fake(&["il", "maʁʃ", "tʁˈɛ", "lɔ̃tˈɑ̃."], &toks);
        let i = analyse(&info(&toks), &mut StoryContext::default());
        assert_eq!(i.focus.len(), 1);
        let c = curves(&l, &i, &toks, &pred, V);
        assert!(st_peak(&l, &pred, &c, 2) > st_peak(&l, &pred, &c, 1) + 2.0, "the emphasised word peaks");
        assert!(!c.gains.is_empty());
        // even where the model sat higher on the word before
        let (l, mut pred) = fake(&["il", "maʁʃ", "tʁˈɛ", "lɔ̃tˈɑ̃."], &toks);
        let (a, b) = l.words[1].unwrap();
        let mut acc = pred.durations[0] as usize;
        for u in 0..l.units.len() {
            let len = pred.durations[u + 1] as usize;
            if u >= a && u < b {
                for f in &mut pred.f0[acc * 2..(acc + len) * 2] {
                    *f = 250.0; // +3.9 st
                }
            }
            acc += len;
        }
        let c = curves(&l, &i, &toks, &pred, V);
        assert!(st_peak(&l, &pred, &c, 2) > st_peak(&l, &pred, &c, 1) + 0.5, "it still stands out");
    }

    #[test]
    fn smooth_and_voiced_only() {
        let toks = tokenize("Est-ce que tu dors ?");
        let (l, mut pred) = fake(&["ɛskə", "kə", "ty", "dˈɔʁ", "?"], &toks);
        for j in 20..30 {
            pred.f0[j] = 0.5; // unvoiced
        }
        let i = analyse(&info(&toks), &mut StoryContext::default());
        let c = curves(&l, &i, &toks, &pred, V);
        for j in 20..30 {
            assert_eq!(c.f0[j], 0.5, "unvoiced frames untouched");
        }
        let st: Vec<f64> = c.f0.iter().map(|&f| 12.0 * (f as f64 / 244.0).log2()).collect();
        for j in 1..st.len() {
            if c.f0[j] > 10.0 && c.f0[j - 1] > 10.0 {
                assert!((st[j] - st[j - 1]).abs() <= PARAMS.max_slope + 1e-4, "jump at {j}");
                // f32 round trip
            }
        }
    }

    #[test]
    fn durations_lengthen_phrase_ends_and_pause_on_clauses() {
        let toks = tokenize("Il marche longtemps, et il chante doucement.");
        let words = ["il", "maʁʃ", "lɔ̃tˈɑ̃,", "e", "il", "ʃɑ̃t", "dusmˈɑ̃."];
        let (l, _) = fake(&words, &toks);
        let i = analyse(&info(&toks), &mut StoryContext::default());
        let s = dur_scale(&l, &i, &toks, true);
        assert_eq!(s.len(), l.units.len() + 2);
        let comma = l.units.iter().position(|u| u.c == ',').unwrap();
        assert!(s[comma + 1] > 1.2, "a clause pause: {}", s[comma + 1]);
        let last_vowel = l.units.iter().rposition(|u| u.vowel).unwrap();
        assert!(s[last_vowel + 1] >= 1.3);
        assert_eq!(s[0], 1.0);
    }
}
