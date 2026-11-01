//! Text front-end: tokens exactly as the site counts them, sentences, quotes,
//! and the typography clean-up done before phonemization.

/// JavaScript's `\s` (and what `String.prototype.trim()` removes).
pub fn is_js_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}'
    )
}

/// `text.trim().split(/\s+/)` — the teleprompter's tokens.
pub fn tokenize(text: &str) -> Vec<String> {
    let t = text.trim_matches(is_js_space);
    if t.is_empty() {
        return vec![String::new()];
    }
    t.split(is_js_space).filter(|s| !s.is_empty()).map(str::to_string).collect()
}

/// A letter or a digit.
pub fn is_word_char(c: char) -> bool {
    c.is_alphanumeric()
}

pub fn speakable(tok: &str) -> bool {
    tok.chars().any(is_word_char)
}

/// `"«Bonjour,"` → `("«", "Bonjour", ",")`. Inner apostrophes and hyphens stay
/// in the core (`qu’il`, `secrets-là`).
pub fn split_core(tok: &str) -> (&str, &str, &str) {
    let start = tok.char_indices().find(|(_, c)| is_word_char(*c)).map(|(i, _)| i).unwrap_or(tok.len());
    let end = tok.char_indices().rev().find(|(_, c)| is_word_char(*c)).map(|(i, c)| i + c.len_utf8()).unwrap_or(start);
    (&tok[..start], &tok[start..end.max(start)], &tok[end.max(start)..])
}

pub const CLOSERS: &[char] = &['»', '”', '"', '’', '\'', ')', ']'];
pub const ENDERS: &[char] = &['.', '!', '?', '…'];

/// The final mark if this token ends a sentence (before closing quotes).
pub fn sentence_end(tok: &str) -> Option<char> {
    let core = tok.trim_end_matches(CLOSERS);
    core.chars().last().filter(|c| ENDERS.contains(c))
}

#[derive(Clone, Debug, PartialEq)]
pub struct SentenceSpan {
    pub start: usize,
    pub end: usize,
    pub mark: Option<char>,
}

/// Token ranges of the sentences of a segment. A mark followed by a
/// lower-case word (`« Oh ! » chuchota Lili`) does not cut the sentence;
/// closing quotes stay with the sentence they close.
pub fn sentences(tokens: &[String]) -> Vec<SentenceSpan> {
    let n = tokens.len();
    let mut out = Vec::new();
    let mut start = 0;
    let mut i = 0;
    while i < n {
        if let Some(mark) = sentence_end(&tokens[i]) {
            let mut j = i + 1;
            while j < n && !speakable(&tokens[j]) && tokens[j].trim_matches(CLOSERS).is_empty() {
                j += 1;
            }
            let Some(next) = tokens[j..].iter().find(|t| speakable(t)) else { break };
            let first = next.trim_start_matches(|c: char| !is_word_char(c)).chars().next();
            if first.is_some_and(|c| !c.is_lowercase()) {
                out.push(SentenceSpan { start, end: j, mark: Some(mark) });
                start = j;
                i = j;
                continue;
            }
        }
        i += 1;
    }
    out.push(SentenceSpan { start, end: n, mark: tokens.last().and_then(|t| sentence_end(t)) });
    out
}

/// Typography for the phonemizer: curly apostrophes, all spaces to one plain
/// space, `...` to `…`.
pub fn normalize(text: &str) -> String {
    let mut s = String::with_capacity(text.len());
    let mut space = false;
    for c in text.chars() {
        let c = match c {
            '’' | '‘' | 'ʼ' | '′' => '\'',
            c if is_js_space(c) => ' ',
            c => c,
        };
        if c == ' ' {
            if !space && !s.is_empty() {
                s.push(' ');
            }
            space = true;
        } else {
            s.push(c);
            space = false;
        }
    }
    let s = s.trim_end().replace("...", "…");
    s
}

/// For each token: is it inside a quotation (dialogue)? Quotes may span
/// several sentences (`« Mille secrets ? Allons les chercher ! »`).
pub fn quote_flags(tokens: &[String]) -> Vec<bool> {
    let mut inside = false;
    let mut out = Vec::with_capacity(tokens.len());
    for t in tokens {
        let opens = t.starts_with(['«', '“']) || (t.starts_with('"') && !inside);
        let mut closes = t.trim_end_matches(|c: char| ",.;:!?…".contains(c)).ends_with(['»', '”']);
        if t.ends_with('"') && (inside || opens) && t.chars().count() > 1 {
            closes = true;
        }
        if t == "\"" && inside {
            closes = true;
        }
        if opens {
            inside = true;
        }
        out.push(inside);
        if closes {
            inside = false;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn toks(s: &str) -> Vec<String> {
        tokenize(s)
    }

    #[test]
    fn tokenize_like_js() {
        assert_eq!(toks("  a\u{a0}b\u{202f}c  d "), ["a", "b", "c", "d"]);
        assert_eq!(toks(""), [""]);
    }

    #[test]
    fn core_split() {
        assert_eq!(split_core("«Bonjour,"), ("«", "Bonjour", ","));
        assert_eq!(split_core("qu’il"), ("", "qu’il", ""));
        assert_eq!(split_core("secrets-là,"), ("", "secrets-là", ","));
        assert_eq!(split_core("»"), ("»", "", ""));
    }

    #[test]
    fn sentences_keep_attribution_and_quotes() {
        let t = toks("« Oh ! » chuchota Lili. « Ces secrets-là ! » Fin.");
        let s = sentences(&t);
        let words: Vec<String> = s.iter().map(|x| t[x.start..x.end].join(" ")).collect();
        assert_eq!(words, ["« Oh ! » chuchota Lili.", "« Ces secrets-là ! »", "Fin."]);
        assert_eq!(s[1].mark, Some('!'));
    }

    #[test]
    fn quotes_span_sentences() {
        let t = toks("Il dit : « Mille secrets ? Allons-y ! » Mauve rit.");
        let q = quote_flags(&t);
        assert_eq!(q, [false, false, false, true, true, true, true, true, true, true, false, false]);
        let t = toks("“Oh!” whispered Lili. “These are kind.”");
        assert_eq!(quote_flags(&t), [true, false, false, true, true, true]);
    }

    #[test]
    fn normalize_typography() {
        assert_eq!(normalize("l’histoire\u{a0}!  Oui..."), "l'histoire ! Oui…");
    }
}
