//! A port of the way Kokoro's own front-end (misaki `EspeakG2P`, through
//! phonemizer with `preserve_punctuation=True, with_stress=True, tie='^'`)
//! turns a text into phonemes with espeak-ng. Kokoro was trained on exactly
//! this output, so the port keeps its quirks (punctuation spacing, ties).

use crate::espeak::Espeak;
use anyhow::Result;

/// phonemizer's default punctuation marks.
const MARKS: &str = ";:,.!?¡¿—…\"«»“”(){}[]";

fn is_mark(c: char) -> bool {
    MARKS.contains(c)
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Pos {
    Begin,
    Inner,
    End,
    Alone,
}

/// `(\s*[marks]+\s*)+` matches (byte ranges). Digits never reach this point
/// (numbers are spelled out first), so phonemizer's decimal look-arounds are
/// not needed.
fn mark_runs(line: &str) -> Vec<(usize, usize)> {
    let cs: Vec<(usize, char)> = line.char_indices().collect();
    let n = cs.len();
    let end_of = |k: usize| if k < n { cs[k].0 } else { line.len() };
    let mut out = Vec::new();
    let mut i = 0;
    while i < n {
        // try a match starting at i: \s* then at least one mark ...
        let mut j = i;
        let mut matched_end = None;
        loop {
            let mut k = j;
            while k < n && cs[k].1.is_whitespace() {
                k += 1;
            }
            let m0 = k;
            while k < n && is_mark(cs[k].1) {
                k += 1;
            }
            if k == m0 {
                break;
            }
            while k < n && cs[k].1.is_whitespace() {
                k += 1;
            }
            matched_end = Some(k);
            j = k;
        }
        if let Some(e) = matched_end {
            out.push((end_of(i), end_of(e)));
            i = e;
        } else {
            i += 1;
        }
    }
    out
}

/// phonemizer `Punctuation._preserve_line`.
fn preserve(line: &str) -> (Vec<String>, Vec<(String, Pos)>) {
    let ms = mark_runs(line);
    if ms.is_empty() {
        return (vec![line.to_string()], vec![]);
    }
    if ms.len() == 1 && ms[0] == (0, line.len()) {
        return (vec![], vec![(line.to_string(), Pos::Alone)]);
    }
    let mut marks = Vec::new();
    for (k, &(a, b)) in ms.iter().enumerate() {
        let m = &line[a..b];
        let pos = if k == 0 && line.starts_with(m) {
            Pos::Begin
        } else if k == ms.len() - 1 && line.ends_with(m) {
            Pos::End
        } else {
            Pos::Inner
        };
        marks.push((m.to_string(), pos));
    }
    let mut chunks = Vec::new();
    let mut rest = line.to_string();
    for (m, _) in &marks {
        match rest.find(m.as_str()) {
            Some(at) => {
                chunks.push(rest[..at].to_string());
                rest = rest[at + m.len()..].to_string();
            }
            None => {
                chunks.push(rest.clone());
                rest.clear();
            }
        }
    }
    chunks.push(rest);
    (chunks.into_iter().filter(|c| !c.is_empty()).collect(), marks)
}

/// phonemizer `Punctuation.restore` for one line, separator word = " ".
fn restore(mut text: Vec<String>, mut marks: Vec<(String, Pos)>) -> Vec<String> {
    let mut out = Vec::new();
    let mut pos = 0usize;
    // every mark of a single line has index 0
    while !text.is_empty() || !marks.is_empty() {
        if marks.is_empty() {
            for mut line in text.drain(..) {
                if !line.ends_with(' ') {
                    line.push(' ');
                }
                out.push(line);
            }
        } else if text.is_empty() {
            out.push(marks.iter().map(|(m, _)| m.as_str()).collect::<String>());
            marks.clear();
        } else if pos == 0 {
            let (mark, p) = marks.remove(0);
            if text[0].ends_with(' ') {
                text[0].pop();
            }
            match p {
                Pos::Begin => text[0] = format!("{mark}{}", text[0]),
                Pos::End => {
                    let sep = if mark.ends_with(' ') { "" } else { " " };
                    out.push(format!("{}{mark}{sep}", text.remove(0)));
                    pos += 1;
                }
                Pos::Alone => {
                    let sep = if mark.ends_with(' ') { "" } else { " " };
                    out.push(format!("{mark}{sep}"));
                    pos += 1;
                }
                Pos::Inner => {
                    if text.len() == 1 {
                        text[0].push_str(&mark);
                    } else {
                        let first = text.remove(0);
                        text[0] = format!("{first}{mark}{}", text[0]);
                    }
                }
            }
        } else {
            out.push(text.remove(0));
            pos += 1;
        }
    }
    out
}

/// phonemizer `EspeakBackend._postprocess_line` (stress kept, tie → `^`).
fn postprocess(line: &str, remove_flags: bool) -> String {
    let mut line = line.trim().replace('\n', " ").replace("  ", " ");
    // _+ → _, then "_ " → " "
    let mut collapsed = String::with_capacity(line.len());
    for c in line.chars() {
        if c == '_' && collapsed.ends_with('_') {
            continue;
        }
        collapsed.push(c);
    }
    line = collapsed.replace("_ ", " ");
    if remove_flags {
        // language switch flags like "(en)" … "(fr)"
        let mut s = String::new();
        let mut rest = line.as_str();
        while let Some(a) = rest.find('(') {
            match rest[a + 1..].find(')') {
                Some(b) if b > 0 => {
                    s.push_str(&rest[..a]);
                    rest = &rest[a + 1 + b + 1..];
                }
                _ => break,
            }
        }
        s.push_str(rest);
        line = s;
    }
    if line.is_empty() {
        return String::new();
    }
    let mut out = String::new();
    for w in line.split(' ') {
        out.push_str(&w.trim().replace('\u{361}', "^"));
        out.push(' ');
    }
    out
}

/// phonemizer's `phonemize([text])[0]` (or "" when nothing is left).
pub fn phonemizer_line(es: &Espeak, voice: &str, text: &str, remove_flags: bool) -> Result<Option<String>> {
    let (chunks, marks) = preserve(text);
    let mut ph = Vec::with_capacity(chunks.len());
    for c in &chunks {
        ph.push(postprocess(&es.phonemize(voice, c)?, remove_flags));
    }
    let out = restore(ph, marks);
    Ok(out.into_iter().next())
}

/// misaki `EspeakG2P.__call__` for French (`fr-fr`, version 1.0).
pub fn misaki_espeak(es: &Espeak, voice: &str, text: &str) -> Result<String> {
    let text = text.replace('«', "\u{201c}").replace('»', "\u{201d}").replace('(', "«").replace(')', "»");
    let Some(ps) = phonemizer_line(es, voice, &text, true)? else { return Ok(String::new()) };
    let mut ps = ps.trim().to_string();
    for (old, new) in [
        ("a^ɪ", "I"),
        ("a^ʊ", "W"),
        ("d^z", "ʣ"),
        ("d^ʒ", "ʤ"),
        ("e^ɪ", "A"),
        ("o^ʊ", "O"),
        ("s^s", "S"),
        ("t^s", "ʦ"),
        ("t^ʃ", "ʧ"),
        ("ɔ^ɪ", "Y"),
        ("ə^ʊ", "Q"),
    ] {
        ps = ps.replace(old, new);
    }
    Ok(ps.replace(['^', '-'], "").replace('«', "(").replace('»', ")"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserve_and_restore_like_phonemizer() {
        let (c, m) = preserve("bonjour, mon ami !");
        assert_eq!(c, ["bonjour", "mon ami"]);
        assert_eq!(m, [(", ".to_string(), Pos::Inner), (" !".to_string(), Pos::End)]);
        let r = restore(vec!["bɔ̃ʒuʁ ".into(), "mɔ̃n ami ".into()], m);
        assert_eq!(r, ["bɔ̃ʒuʁ, mɔ̃n ami ! "]);
        let (c, m) = preserve("“ oh ! ”");
        assert_eq!(c, ["oh"]);
        assert_eq!(m[0].1, Pos::Begin);
        assert_eq!(restore(vec!["o ".into()], m), ["“ o ! ” "]);
        let (c, m) = preserve("…");
        assert!(c.is_empty());
        assert_eq!(restore(vec![], m), ["…"]); // phonemizer adds no space here
    }

    #[test]
    fn postprocess_line() {
        assert_eq!(postprocess(" a\u{361}ɪ_ bˈe ", false), "a^ɪ bˈe ");
        assert_eq!(postprocess("(en)hˈɛloʊ(fr) ami", true), "hˈɛloʊ ami ");
    }
}
