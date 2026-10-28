//! French phonemes, as Kokoro was trained (espeak-ng `fr-fr` through misaki),
//! plus Ziggy's pronunciation fixes (`lexicon.json` and a few systematic rules).

use crate::align::align;
use crate::espeak::Espeak;
use crate::g2p_espeak::misaki_espeak;
use crate::text::{normalize, speakable, split_core};
use anyhow::Result;
use std::collections::HashMap;
use std::sync::Mutex;

pub const VOICE: &str = "roa/fr";

pub struct FrenchG2P<'a> {
    es: &'a Espeak,
    fixes: HashMap<String, String>,
    cache: Mutex<HashMap<String, String>>,
}

/// Phonemes of an utterance + where each of its tokens starts (char offset).
#[derive(Clone, Debug)]
pub struct Phonemized {
    pub ps: String,
    pub starts: Vec<Option<usize>>,
}

impl<'a> FrenchG2P<'a> {
    pub fn new(es: &'a Espeak, fixes: HashMap<String, String>) -> Self {
        Self { es, fixes, cache: Mutex::new(HashMap::new()) }
    }

    pub fn fix(&self, core: &str) -> Option<String> {
        let core = core.replace('’', "'");
        self.fixes.get(&core).or_else(|| self.fixes.get(&core.to_lowercase())).cloned()
    }

    /// espeak (through misaki) on a text chunk, cached.
    pub fn raw(&self, text: &str) -> Result<String> {
        let text = normalize(text);
        if text.is_empty() {
            return Ok(String::new());
        }
        if let Some(p) = self.cache.lock().unwrap().get(&text) {
            return Ok(p.clone());
        }
        let p = misaki_espeak(self.es, VOICE, &text)?;
        self.cache.lock().unwrap().insert(text, p.clone());
        Ok(p)
    }

    /// One word said alone.
    pub fn word(&self, tok: &str) -> Result<String> {
        let (_, core, _) = split_core(tok);
        if let Some(f) = self.fix(core) {
            return Ok(f);
        }
        self.raw(core)
    }

    fn punct_ps(p: &str) -> String {
        p.replace('«', "“").replace('»', "”").chars().filter(|c| crate::align::PUNCT_PS.contains(c)).collect()
    }

    /// Phonemes of an utterance (its whitespace tokens). Liaisons are made by
    /// espeak on runs of words (« trouvèrent‿un »); words of the lexicon are
    /// inserted as written there.
    pub fn utterance(&self, toks: &[String]) -> Result<Phonemized> {
        let mut parts: Vec<String> = Vec::new();
        let mut starts: Vec<Option<usize>> = vec![None; toks.len()];
        let mut buf: Vec<usize> = Vec::new();
        let mut length = 0usize; // chars

        let emit = |ps: String,
                    idx: &[usize],
                    parts: &mut Vec<String>,
                    starts: &mut Vec<Option<usize>>,
                    length: &mut usize|
         -> Result<()> {
            if ps.is_empty() {
                return Ok(());
            }
            let base = *length + usize::from(!parts.is_empty());
            let sp: Vec<usize> = idx.iter().copied().filter(|&i| speakable(&toks[i])).collect();
            if !sp.is_empty() {
                let words: Vec<String> = sp.iter().map(|&i| self.word(&toks[i])).collect::<Result<_>>()?;
                for (&i, s) in sp.iter().zip(align(&words, &ps)) {
                    starts[i] = s.map(|s| base + s);
                }
            }
            *length = base + ps.chars().count();
            parts.push(ps);
            Ok(())
        };

        for (i, t) in toks.iter().enumerate() {
            let (pre, core, post) = split_core(t);
            let fx = if core.is_empty() { None } else { self.fix(core) };
            if let Some(fx) = fx {
                if !buf.is_empty() {
                    let text = buf.iter().map(|&k| toks[k].as_str()).collect::<Vec<_>>().join(" ");
                    let ps = self.raw(&text)?;
                    emit(ps, &buf.clone(), &mut parts, &mut starts, &mut length)?;
                    buf.clear();
                }
                let pp = Self::punct_ps(pre);
                let tail = Self::punct_ps(post);
                emit(format!("{pp}{fx}{tail}"), &[], &mut parts, &mut starts, &mut length)?;
                starts[i] = Some(length - fx.chars().count() - tail.chars().count());
            } else {
                buf.push(i);
            }
        }
        if !buf.is_empty() {
            let text = buf.iter().map(|&k| toks[k].as_str()).collect::<Vec<_>>().join(" ");
            let ps = self.raw(&text)?;
            emit(ps, &buf.clone(), &mut parts, &mut starts, &mut length)?;
        }
        Ok(Phonemized { ps: parts.join(" "), starts })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn punctuation_phonemes() {
        assert_eq!(FrenchG2P::punct_ps("«"), "“");
        assert_eq!(FrenchG2P::punct_ps(" !»"), "!”");
    }
}
