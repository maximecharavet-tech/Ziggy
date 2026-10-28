//! Where does each word start in an utterance's phoneme string?
//!
//! The words are phonemized alone, the utterance as a whole (with liaisons,
//! merged clitics…): a monotonic alignment of word phonemes to the
//! space-separated chunks of the utterance (1:1, 1:n, n:1) by edit distance.

pub const STRESS: &[char] = &['ˈ', 'ˌ'];
pub const PUNCT_PS: &[char] = &[';', ':', ',', '.', '!', '?', '—', '…', '"', '(', ')', '“', '”'];

/// The phonemes that make sound (no stress, punctuation or spaces).
pub fn letters(ps: &str) -> Vec<char> {
    ps.chars().filter(|c| !STRESS.contains(c) && !PUNCT_PS.contains(c) && *c != ' ').collect()
}

pub fn lev(a: &[char], b: &[char]) -> usize {
    if a == b {
        return 0;
    }
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    for (i, ca) in a.iter().enumerate() {
        let mut cur = vec![i + 1];
        for (j, cb) in b.iter().enumerate() {
            let v = (prev[j + 1] + 1).min(cur[j] + 1).min(prev[j] + usize::from(ca != cb));
            cur.push(v);
        }
        prev = cur;
    }
    prev[b.len()]
}

/// For each word (its phonemes said alone), the char offset where it starts
/// in `ps`, or `None` when it vanished (it then takes the next word's time).
pub fn align(words: &[String], ps: &str) -> Vec<Option<usize>> {
    // chunks: (char offset of the first non-punctuation char, letters, the chunk's chars)
    let mut chunks: Vec<(usize, Vec<char>, Vec<char>)> = Vec::new();
    let mut pos = 0;
    for part in ps.split(' ') {
        let pc: Vec<char> = part.chars().collect();
        let l = letters(part);
        if !l.is_empty() {
            let first = pc.iter().position(|c| !PUNCT_PS.contains(c)).unwrap_or(0);
            chunks.push((pos + first, l, pc.clone()));
        }
        pos += pc.len() + 1;
    }
    let w: Vec<Vec<char>> = words.iter().map(|x| letters(x)).collect();
    let n = w.len();
    let m = chunks.len();
    const INF: f64 = 1e9;
    let mut cost = vec![vec![INF; m + 1]; n + 1];
    let mut back = vec![vec![(0usize, 0usize); m + 1]; n + 1];
    cost[0][0] = 0.0;
    let shapes = [(1, 1), (1, 2), (2, 1), (1, 3), (3, 1), (1, 0), (0, 1)];
    for i in 0..=n {
        for j in 0..=m {
            if cost[i][j] >= INF {
                continue;
            }
            for (a, b) in shapes {
                if i + a > n || j + b > m {
                    continue;
                }
                let c = if b == 0 {
                    w[i].len() as f64 + 1.5
                } else if a == 0 {
                    chunks[j].1.len() as f64 + 1.5
                } else {
                    let x: Vec<char> = w[i..i + a].concat();
                    let y: Vec<char> = chunks[j..j + b].iter().flat_map(|c| c.1.iter().copied()).collect();
                    lev(&x, &y) as f64 + if (a, b) == (1, 1) { 0.0 } else { 1.0 }
                };
                if cost[i][j] + c < cost[i + a][j + b] {
                    cost[i + a][j + b] = cost[i][j] + c;
                    back[i + a][j + b] = (a, b);
                }
            }
        }
    }
    let mut starts = vec![None; n];
    let (mut i, mut j) = (n, m);
    while i > 0 || j > 0 {
        let (a, b) = back[i][j];
        if a == 0 && b == 0 {
            break; // unreachable cell (should not happen)
        }
        i -= a;
        j -= b;
        if a == 0 || b == 0 {
            continue;
        }
        let (off, _, part) = &chunks[j];
        if a == 1 {
            starts[i] = Some(*off);
        } else {
            // several words merged into one chunk: share it by their lengths
            let total: usize = (i..i + a).map(|k| w[k].len()).sum::<usize>().max(1);
            let body: Vec<usize> =
                part.iter().enumerate().filter(|(_, c)| !PUNCT_PS.contains(c)).map(|(k, _)| k).collect();
            let mut acc = 0usize;
            for k in i..i + a {
                let idx = ((acc as f64 / total as f64) * body.len() as f64).round_ties_even() as usize;
                let at = body[idx.min(body.len() - 1)];
                starts[k] = Some(off - body[0] + at);
                acc += w[k].len();
            }
        }
    }
    starts
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aligns_liaison_and_merges() {
        // "les amis" said as "lez‿ami": two words, two chunks
        let s = align(&["le".into(), "ami".into()], "lez ami.");
        assert_eq!(s, [Some(0), Some(4)]);
        // "qu'est-ce que" merged in one chunk
        let s = align(&["kɛ".into(), "sə".into(), "kə".into(), "fˈɛ".into()], "kɛskə fˈɛ");
        assert_eq!(s[0], Some(0));
        assert!(s[1].unwrap() > 0 && s[2].unwrap() > s[1].unwrap());
        assert_eq!(s[3], Some(6));
        assert_eq!(lev(&['a', 'b'], &['a', 'c', 'b']), 1);
    }
}
