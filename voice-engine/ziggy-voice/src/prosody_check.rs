//! `ziggy-voice check-prosody`: did the voice really say it that way?
//!
//! For every piece of every story the reading is re-derived from the text
//! (`prosody::plan_story`), the published MP3 is decoded, its pitch tracked
//! (WORLD Harvest, 5 ms) and placed on the words with `timing.json`. Then, per
//! sentence type: statements end low, yes/no questions end high, wh-questions
//! start high, list items rise, emphasised words peak; and the contour must
//! stay smooth. Works on any voice folder, so v2 and v3 are measured alike.

use crate::intonation::{Boundary, Kind};
use crate::kokoro::SR;
use crate::prosody::plan_story;
use crate::recipe::ONSET_SHIFT;
use crate::stories::Story;
use anyhow::{Context, Result};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Default, Clone, Debug, serde::Serialize)]
pub struct Tally {
    pub n: usize,
    pub pass: usize,
    /// Mean measured value (semitones) of the check.
    pub mean: f64,
}

impl Tally {
    fn add(&mut self, ok: bool, v: f64) {
        self.mean = (self.mean * self.n as f64 + v) / (self.n + 1) as f64;
        self.n += 1;
        self.pass += usize::from(ok);
    }
}

#[derive(Default, Debug, serde::Serialize)]
pub struct Report {
    pub checks: BTreeMap<String, Tally>,
    /// Pitch movement between consecutive voiced 5 ms frames (st): p99, max,
    /// share of jumps over 1 st (glitches).
    pub slope_p99: f64,
    pub slope_max: f64,
    pub jumps_per_minute: f64,
    pub voiced_minutes: f64,
}

struct Seg {
    st: Vec<f64>, // per 5 ms frame, NaN unvoiced, semitones re. the segment median
}

impl Seg {
    /// Voiced values between t0 and t1, in order, without stray blips: only
    /// runs of at least 40 ms count (a word's span runs into the pause after
    /// it, where the tracker may catch breath or noise).
    fn frames(&self, t0: f64, t1: f64) -> Vec<f64> {
        let (a, b) = ((t0 / 0.005).max(0.0) as usize, ((t1 / 0.005) as usize).min(self.st.len()));
        if a >= b {
            return vec![];
        }
        let mut out = Vec::new();
        let mut run: Vec<f64> = Vec::new();
        for &v in &self.st[a..b] {
            if v.is_finite() {
                run.push(v);
            } else {
                if run.len() >= 8 {
                    out.append(&mut run);
                }
                run.clear();
            }
        }
        if run.len() >= 8 {
            out.append(&mut run);
        }
        out
    }
}

fn mean(v: &[f64]) -> Option<f64> {
    (!v.is_empty()).then(|| v.iter().sum::<f64>() / v.len() as f64)
}

fn max(v: &[f64]) -> Option<f64> {
    v.iter().copied().fold(None, |m, x| Some(m.map_or(x, |m: f64| m.max(x))))
}

pub fn check(dir: &Path, stories: &[Story], locales: &[String]) -> Result<Report> {
    let mut rep = Report::default();
    let mut slopes: Vec<f64> = Vec::new();
    let mut jumps = 0usize;
    let mut voiced_frames = 0usize;
    for locale in locales {
        for story in stories {
            let tdir = dir.join(locale).join(&story.id);
            let Ok(raw) = std::fs::read_to_string(tdir.join("timing.json")) else { continue };
            let timing: serde_json::Value = serde_json::from_str(&raw)?;
            let plans = plan_story(locale, story);
            let segs: Vec<(String, Seg, Vec<f64>, f64)> = {
                use rayon::prelude::*;
                plans
                    .par_iter()
                    .map(|p| -> Result<(String, Seg, Vec<f64>, f64)> {
                        let s = &timing["segments"][&p.id];
                        let words: Vec<f64> =
                            s["words"].as_array().context("words")?.iter().filter_map(|v| v.as_f64()).collect();
                        let dur = s["dur"].as_f64().unwrap_or(0.0);
                        let y = crate::lab::decode(&tdir.join(format!("{}.mp3", p.id)), SR)?;
                        let yd: Vec<f64> = y.iter().map(|&v| v as f64).collect();
                        let mut f0 = crate::world::harvest(&yd, SR);
                        // the tracker also "hears" a pitch in breath and in the
                        // quiet tails of words: only frames with real voice count
                        let hop = (SR as f64 * 0.005) as usize;
                        let db: Vec<f64> = (0..f0.len())
                            .map(|j| {
                                let a = (j * hop).saturating_sub(hop);
                                let b = ((j + 1) * hop + hop).min(yd.len());
                                let e =
                                    yd[a.min(b)..b].iter().map(|x| x * x).sum::<f64>() / (b - a.min(b)).max(1) as f64;
                                10.0 * (e + 1e-12).log10()
                            })
                            .collect();
                        let loud = {
                            let mut d = db.clone();
                            d.sort_by(|a, b| a.partial_cmp(b).unwrap());
                            d[d.len() * 95 / 100]
                        };
                        for (f, d) in f0.iter_mut().zip(&db) {
                            if *d < loud - 25.0 {
                                *f = 0.0;
                            }
                        }
                        let mut v: Vec<f64> = f0.iter().copied().filter(|&f| f > 0.0).collect();
                        v.sort_by(|a, b| a.partial_cmp(b).unwrap());
                        let med = v.get(v.len() / 2).copied().unwrap_or(200.0);
                        let st = f0.iter().map(|&f| if f > 0.0 { 12.0 * (f / med).log2() } else { f64::NAN }).collect();
                        Ok((p.id.clone(), Seg { st }, words, dur))
                    })
                    .collect::<Result<_>>()?
            };
            for (plan, (_, seg, words, dur)) in plans.iter().zip(&segs) {
                // smoothness
                for w in seg.st.windows(2) {
                    if w[0].is_finite() && w[1].is_finite() {
                        let d = (w[1] - w[0]).abs();
                        slopes.push(d);
                        if d > 1.0 {
                            jumps += 1;
                        }
                        voiced_frames += 1;
                    }
                }
                if words.len() != plan.tokens.len() {
                    continue;
                }
                // word spans: from its (un-shifted) start to the next later word
                let span = |k: usize| -> (f64, f64) {
                    let t0 = words[k] + ONSET_SHIFT * 0.5;
                    let t1 = words[k + 1..].iter().copied().find(|&t| t > words[k] + 0.02).unwrap_or(*dur);
                    (t0, t1.max(t0 + 0.05))
                };
                let spoken = |k: usize| crate::text::speakable(&plan.tokens[k]);
                for piece in &plan.pieces {
                    let r = &piece.intonation;
                    let toks: Vec<usize> = (piece.start..piece.end).filter(|&k| spoken(k)).collect();
                    if toks.len() < 2 {
                        continue;
                    }
                    let first = toks[0];
                    let last = *toks.last().unwrap();
                    let wmean = |k: usize| mean(&seg.frames(span(k).0, span(k).1));
                    // the last syllable ≈ the last 40 % of the word's voiced sound
                    let tail = |k: usize| {
                        let (a, b) = span(k);
                        let v = seg.frames(a, b);
                        let n = (v.len() * 2 / 5).max(4).min(v.len());
                        mean(&v[v.len() - n..])
                    };
                    let mut add =
                        |name: &str, ok: bool, v: f64| rep.checks.entry(name.to_string()).or_default().add(ok, v);
                    if !r.tag {
                        if let (Some(a), Some(b)) = (wmean(first), tail(last)) {
                            match r.kind {
                                Kind::Declarative | Kind::Imperative if !r.continues => {
                                    add("statement ends lower than it starts", b < a - 1.0, a - b)
                                }
                                Kind::YesNo => add("yes/no question ends higher than it starts", b > a + 1.0, b - a),
                                Kind::Wh => add("wh-question starts higher than it ends", a > b + 1.0, a - b),
                                _ => {}
                            }
                        }
                    }
                    // list items rise
                    for ph in &r.phrases {
                        let ws: Vec<usize> =
                            (piece.start + ph.start..piece.start + ph.end).filter(|&k| spoken(k)).collect();
                        if ws.is_empty() {
                            continue;
                        }
                        if ph.boundary == Boundary::ListItem {
                            if let (Some(a), Some(b)) = (wmean(ws[0]), tail(*ws.last().unwrap())) {
                                add("list item ends higher than it starts", b > a + 0.5, b - a);
                            }
                        }
                        if ph.boundary == Boundary::Continuation
                            && !r.tag
                            && ws.len() >= 2
                            && piece.start + ph.end < piece.end
                        {
                            if let (Some(a), Some(b)) = (wmean(*ws.last().unwrap()), wmean(ws[ws.len() - 2])) {
                                add("continuation: phrase end not lower than before", a > b - 0.5, a - b);
                            }
                        }
                    }
                    // emphasis peaks over its neighbours
                    for &(k, _) in &r.focus {
                        let k = piece.start + k;
                        let peak = max(&seg.frames(span(k).0, span(k).1));
                        let nb: Vec<f64> = [k.checked_sub(1), Some(k + 1)]
                            .iter()
                            .flatten()
                            .filter(|&&j| j < plan.tokens.len() && spoken(j) && (piece.start..piece.end).contains(&j))
                            .filter_map(|&j| max(&seg.frames(span(j).0, span(j).1)))
                            .collect();
                        if let (Some(p), Some(n)) = (peak, mean(&nb)) {
                            add("emphasised word peaks above its neighbours", p > n + 0.5, p - n);
                        }
                    }
                }
            }
        }
    }
    slopes.sort_by(|a, b| a.partial_cmp(b).unwrap());
    rep.slope_p99 = slopes.get(slopes.len() * 99 / 100).copied().unwrap_or(0.0);
    rep.slope_max = slopes.last().copied().unwrap_or(0.0);
    rep.voiced_minutes = voiced_frames as f64 * 0.005 / 60.0;
    rep.jumps_per_minute = jumps as f64 / rep.voiced_minutes.max(1e-9);
    Ok(rep)
}

pub fn print(rep: &Report) {
    for (k, t) in &rep.checks {
        println!(
            "{:<52} {:>4}/{:<4} ({:>5.1} %)  mean {:+.2} st",
            k,
            t.pass,
            t.n,
            100.0 * t.pass as f64 / t.n.max(1) as f64,
            t.mean
        );
    }
    println!(
        "pitch smoothness: p99 {:.2} st / 5 ms, max {:.1} st, jumps > 1 st: {:.1} per voiced minute ({:.1} voiced min)",
        rep.slope_p99, rep.slope_max, rep.jumps_per_minute, rep.voiced_minutes
    );
}
