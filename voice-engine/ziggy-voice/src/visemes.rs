//! Ziggy's mouth timeline from the phonemes Kokoro actually said.
//!
//! Shapes (`src/lib/dodo/voice.ts`, `VisemeShape`): `smile` (rest, pauses),
//! `small` (lips together: m b p f v), `open` (a/ɑ), `o` (rounded: o ɔ u w ʊ
//! y ø œ), `grin` (i e ɛ j s z and the other consonants).

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Shape {
    Smile,
    Small,
    Open,
    O,
    Grin,
}

/// `None` = no mouth of its own (stress marks, the nasal tilde, length
/// marks): it keeps the shape of the phoneme it belongs to.
pub fn shape_of(c: char) -> Option<Shape> {
    Some(match c {
        'ˈ' | 'ˌ' | 'ː' | '\u{303}' | 'ʲ' | 'ʰ' | 'ᵊ' => return None,
        ' ' | ',' | '.' | '!' | '?' | ';' | ':' | '—' | '…' | '"' | '“' | '”' | '(' | ')' => Shape::Smile,
        'm' | 'b' | 'p' | 'f' | 'v' | 'ɱ' | 'β' | 'ɸ' => Shape::Small,
        'a' | 'ɑ' | 'æ' | 'ɐ' | 'ʌ' | 'I' | 'W' | 'ɒ' => Shape::Open,
        'o' | 'ɔ' | 'u' | 'w' | 'ʊ' | 'y' | 'ø' | 'œ' | 'O' | 'Q' | 'Y' | 'ɥ' | 'ɵ' => Shape::O,
        _ => Shape::Grin,
    })
}

/// Cues from timed phonemes `(start s, end s, char)`; consecutive equal
/// shapes merge, cues shorter than `min_dur` are absorbed by a neighbour,
/// and the timeline starts and ends on `smile`.
pub fn cues(phones: &[(f64, f64, char)], dur: f64, min_dur: f64) -> Vec<(f64, Shape)> {
    let mut v: Vec<(f64, Shape)> = vec![(0.0, Shape::Smile)];
    let mut last_end: f64 = 0.0;
    for &(s, e, c) in phones {
        // a word boundary inside connected speech does not close the mouth;
        // a long one (a real pause) does
        if c == ' ' && e - s < 0.12 {
            last_end = last_end.max(e);
            continue;
        }
        let Some(sh) = shape_of(c) else { continue };
        let s = s.clamp(0.0, dur);
        if s > last_end + 0.06 {
            v.push((last_end, Shape::Smile)); // a pause between pieces
        }
        v.push((s, sh));
        last_end = e.max(s);
    }
    v.push((last_end.min(dur), Shape::Smile));
    // sort (times are already monotonic per piece) and merge
    v.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    let mut out: Vec<(f64, Shape)> = Vec::with_capacity(v.len());
    for (t, sh) in v {
        match out.last_mut() {
            Some(l) if (l.0 - t).abs() < 1e-9 => l.1 = sh, // same instant: the later wins
            Some(l) if l.1 == sh => {}
            _ => out.push((t, sh)),
        }
    }
    // absorb short cues (never the first rest)
    loop {
        let mut changed = false;
        let mut i = 1;
        while i < out.len() {
            let end = out.get(i + 1).map(|x| x.0).unwrap_or(dur);
            if end - out[i].0 < min_dur && i + 1 < out.len() {
                // a short cue takes the shape of the longer neighbour
                let prev_len = out[i].0 - out[i - 1].0;
                let next_len = out.get(i + 2).map(|x| x.0).unwrap_or(dur) - out[i + 1].0;
                if prev_len >= next_len {
                    out.remove(i);
                } else {
                    out[i + 1].0 = out[i].0;
                    out.remove(i);
                }
                changed = true;
                // re-merge equal neighbours
                let mut k = 1;
                while k < out.len() {
                    if out[k].1 == out[k - 1].1 {
                        out.remove(k);
                    } else {
                        k += 1;
                    }
                }
            } else {
                i += 1;
            }
        }
        if !changed {
            break;
        }
    }
    out.retain(|c| c.0 < dur);
    out.iter().map(|&(t, s)| ((t * 1000.0).round() / 1000.0, s)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mapping() {
        assert_eq!(shape_of('m'), Some(Shape::Small));
        assert_eq!(shape_of('a'), Some(Shape::Open));
        assert_eq!(shape_of('y'), Some(Shape::O));
        assert_eq!(shape_of('ø'), Some(Shape::O));
        assert_eq!(shape_of('i'), Some(Shape::Grin));
        assert_eq!(shape_of('ʁ'), Some(Shape::Grin));
        assert_eq!(shape_of('ˈ'), None);
        assert_eq!(shape_of(','), Some(Shape::Smile));
    }

    #[test]
    fn cues_merge_and_stay_sorted() {
        // "bonjour" with a short ʒ that must be absorbed
        let p = [
            (0.10, 0.18, 'b'),
            (0.18, 0.30, 'ɔ'),
            (0.30, 0.31, '\u{303}'),
            (0.31, 0.33, 'ʒ'),
            (0.33, 0.45, 'u'),
            (0.45, 0.55, 'ʁ'),
        ];
        let c = cues(&p, 1.0, 0.05);
        assert_eq!(c[0], (0.0, Shape::Smile));
        for w in c.windows(2) {
            assert!(w[0].0 < w[1].0);
            assert_ne!(w[0].1, w[1].1);
        }
        for w in c.windows(2) {
            assert!(w[1].0 - w[0].0 >= 0.05 - 1e-9, "{c:?}");
        }
        assert_eq!(c.last().unwrap().1, Shape::Smile);
        assert!(c.iter().all(|x| x.0 < 1.0));
        assert!(c.iter().any(|x| x.1 == Shape::O));
    }

    #[test]
    fn short_word_gaps_keep_the_mouth_moving() {
        let p = [(0.1, 0.3, 'a'), (0.3, 0.33, ' '), (0.33, 0.5, 'i'), (0.5, 0.8, ' '), (0.8, 1.0, 'o')];
        let c = cues(&p, 1.2, 0.05);
        assert_eq!(
            c,
            vec![
                (0.0, Shape::Smile),
                (0.1, Shape::Open),
                (0.33, Shape::Grin),
                (0.5, Shape::Smile),
                (0.8, Shape::O),
                (1.0, Shape::Smile)
            ]
        );
    }

    #[test]
    fn pause_between_pieces_is_a_smile() {
        let p = [(0.1, 0.3, 'a'), (0.8, 1.0, 'i')];
        let c = cues(&p, 1.5, 0.05);
        assert_eq!(
            c,
            vec![(0.0, Shape::Smile), (0.1, Shape::Open), (0.3, Shape::Smile), (0.8, Shape::Grin), (1.0, Shape::Smile)]
        );
    }
}
