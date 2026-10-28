//! `ziggy-voice generate`: every story, one story, or one segment sample.

use crate::espeak::Espeak;
use crate::g2p_en::EnglishG2P;
use crate::g2p_fr::FrenchG2P;
use crate::kokoro::{Kokoro, SR};
use crate::master::{master_to, Report};
use crate::output::{ms, write_mp3, SegmentJson, TimingJson};
use crate::paths::Cache;
use crate::prosody::{describe, plan_story, SegmentPlan};
use crate::recipe::Master;
use crate::render::{G2p, Renderer};
use crate::stories::{lexicon, load, Story};
use crate::text::tokenize;
use anyhow::{bail, Context, Result};
use rayon::prelude::*;
use std::path::PathBuf;
use std::time::Instant;

pub struct Options {
    pub locales: Vec<String>,
    pub stories: Vec<String>,
    pub out: PathBuf,
    pub threads: usize,
    pub jobs: usize,
    pub skip_existing: bool,
    pub stories_json: Option<PathBuf>,
    /// `story:segment` → render only that into `sample_out`.
    pub sample: Option<String>,
    pub sample_out: Option<PathBuf>,
    pub check: bool,
}

pub struct Done {
    pub id: String,
    pub text: String,
    pub dur: f64,
    pub words: Vec<f64>,
    pub visemes: Vec<(f64, crate::visemes::Shape)>,
    pub report: Report,
    pub phonemes: Vec<String>,
}

fn render_one(r: &Renderer, plan: &SegmentPlan, mp3: &std::path::Path) -> Result<(Done, Vec<f32>, Vec<f32>)> {
    let seg = r.render_segment(plan)?;
    // master, encode, then check the decoded MP3 itself: the encoder can add
    // a few tenths of a dB of peak, so lower the ceiling until it fits
    let mut target = Master::TRUE_PEAK_DB;
    let (mut mastered, mut report);
    let mut tries = 0;
    loop {
        (mastered, report) = master_to(&seg.audio, SR, target);
        write_mp3(mp3, &mastered)?;
        let decoded = crate::lab::decode(mp3, SR)?;
        let (lufs, tp) = crate::analysis::loudness(&decoded, SR);
        report.lufs = lufs;
        report.true_peak_db = tp;
        tries += 1;
        if tp <= Master::TRUE_PEAK_DB || tries == 4 {
            break;
        }
        target -= tp - Master::TRUE_PEAK_DB + 0.05;
    }
    let dur = mastered.len() as f64 / SR as f64;
    let done = Done {
        id: plan.id.clone(),
        text: plan.text.clone(),
        dur: ms(dur),
        words: seg.words.clone(),
        visemes: seg.visemes.clone(),
        report,
        phonemes: seg.phonemes.clone(),
    };
    Ok((done, seg.audio, mastered))
}

fn up_to_date(dir: &std::path::Path, locale: &str, story: &Story) -> bool {
    let Ok(raw) = std::fs::read_to_string(dir.join("timing.json")) else { return false };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else { return false };
    if v["v"] != 2 || v["voice"] != crate::recipe::RECIPE_ID {
        return false;
    }
    story.segment_ids(locale).iter().all(|id| {
        v["segments"][id]["text"].as_str() == story.text(locale, id) && dir.join(format!("{id}.mp3")).exists()
    })
}

pub fn run(opts: Options) -> Result<()> {
    let cache = Cache::new();
    let es =
        Espeak::load(&cache.espeak_lib(), &cache.espeak_data()).context("espeak-ng (run `ziggy-voice prepare`)")?;
    let lex = lexicon()?;
    let stories = load(opts.stories_json.as_deref())?;
    let (sample_story, sample_seg) = match &opts.sample {
        Some(s) => {
            let (a, b) = s.split_once(':').context("--sample story:segment")?;
            (Some(a.to_string()), Some(b.to_string()))
        }
        None => (None, None),
    };
    let wanted = |id: &str| match &sample_story {
        Some(s) => s == id,
        None => opts.stories.is_empty() || opts.stories.iter().any(|x| x == id),
    };
    let kokoro = if opts.check { None } else { Some(Kokoro::new(&cache, opts.threads)?) };
    let pool = rayon::ThreadPoolBuilder::new().num_threads(opts.jobs.max(1)).build()?;
    let t_all = Instant::now();
    let mut total = 0.0;
    for locale in &opts.locales {
        let g2p = if locale == "fr" {
            G2p::Fr(FrenchG2P::new(&es, lex["fr"].clone()))
        } else {
            G2p::En(EnglishG2P::new(&es, &cache.misaki(), lex["en"].clone())?)
        };
        for story in stories.iter().filter(|s| wanted(&s.id)) {
            let plans = plan_story(locale, story);
            if opts.check {
                check_story(&g2p, locale, story, &plans)?;
                continue;
            }
            let kokoro = kokoro.as_ref().unwrap();
            let renderer = Renderer { kokoro, g2p: &g2p, take_cache: Some(cache.raw()) };
            if let (Some(seg), Some(out)) = (&sample_seg, &opts.sample_out) {
                let plan = plans.iter().find(|p| &p.id == seg).with_context(|| format!("no segment {seg}"))?;
                std::fs::create_dir_all(out)?;
                let name = format!("{locale}-{}-{seg}", story.id);
                print!("{}", describe(plan));
                let (done, raw, mastered) = render_one(&renderer, plan, &out.join(format!("{name}.mp3")))?;
                crate::lab::write_wav(&out.join(format!("{name}-raw.wav")), &raw, SR)?;
                crate::lab::write_wav(&out.join(format!("{name}.wav")), &mastered, SR)?;
                let js = serde_json::json!({"text": done.text, "dur": done.dur, "words": done.words, "visemes": done.visemes, "phonemes": done.phonemes, "master": done.report});
                std::fs::write(out.join(format!("{name}.json")), serde_json::to_string_pretty(&js)?)?;
                println!(
                    "sample: {} ({:.1}s, {:.1} LUFS, {:.1} dBTP)",
                    out.join(format!("{name}.mp3")).display(),
                    done.dur,
                    done.report.lufs,
                    done.report.true_peak_db
                );
                continue;
            }
            let dir = opts.out.join(locale).join(&story.id);
            if opts.skip_existing && up_to_date(&dir, locale, story) {
                println!("= {locale}/{} up to date", story.id);
                continue;
            }
            let t0 = Instant::now();
            let results: Vec<Result<Done>> = pool.install(|| {
                plans
                    .par_iter()
                    .map(|p| render_one(&renderer, p, &dir.join(format!("{}.mp3", p.id))).map(|r| r.0))
                    .collect()
            });
            let mut timing = TimingJson::new(locale, &story.id);
            let mut secs = 0.0;
            let mut lufs = (f64::MAX, f64::MIN);
            let mut tp = f64::MIN;
            for r in results {
                let d = r?;
                if d.words.len() != tokenize(&d.text).len() {
                    bail!(
                        "{locale}/{}/{}: {} word times for {} tokens",
                        story.id,
                        d.id,
                        d.words.len(),
                        tokenize(&d.text).len()
                    );
                }
                secs += d.dur;
                lufs = (lufs.0.min(d.report.lufs), lufs.1.max(d.report.lufs));
                tp = tp.max(d.report.true_peak_db);
                timing.push(
                    &d.id,
                    SegmentJson {
                        file: format!("{}.mp3", d.id),
                        dur: d.dur,
                        text: d.text,
                        words: d.words,
                        visemes: d.visemes,
                    },
                )?;
            }
            timing.write(&dir.join("timing.json"))?;
            total += secs;
            println!(
                "✓ {locale}/{}: {:.0}s of voice in {:.0}s (LUFS {:.1}…{:.1}, peak ≤ {:.1} dBTP)",
                story.id,
                secs,
                t0.elapsed().as_secs_f64(),
                lufs.0,
                lufs.1,
                tp
            );
        }
        if let G2p::En(g) = &g2p {
            let oov = g.oov.lock().unwrap();
            if !oov.is_empty() {
                println!("English words read by espeak (consider lexicon.json): {:?}", *oov);
            }
        }
    }
    if total > 0.0 {
        println!("done: {:.1} min of voice in {:.1} min", total / 60.0, t_all.elapsed().as_secs_f64() / 60.0);
    }
    Ok(())
}

/// Phoneme report: words without sound, characters outside the model's
/// vocabulary, suspicious phoneme counts. No audio.
fn check_story(g2p: &G2p, locale: &str, story: &Story, plans: &[SegmentPlan]) -> Result<()> {
    for p in plans {
        for piece in &p.pieces {
            let toks = &p.tokens[piece.start..piece.end];
            let spoken: Vec<String> = toks.iter().map(|t| crate::numbers::spoken(t, locale)).collect();
            let ph = g2p.utterance(&spoken)?;
            let bad: std::collections::BTreeSet<char> =
                ph.ps.chars().filter(|&c| crate::kokoro::vocab_id(c).is_none()).collect();
            if !bad.is_empty() {
                println!("  {locale}/{}/{}: chars outside the vocabulary {:?}", story.id, p.id, bad);
            }
            let miss: Vec<&String> = toks
                .iter()
                .zip(&ph.starts)
                .filter(|(t, s)| s.is_none() && crate::text::speakable(t))
                .map(|(t, _)| t)
                .collect();
            if !miss.is_empty() {
                println!("  {locale}/{}/{}: no phonemes for {:?}", story.id, p.id, miss);
            }
            let letters = crate::align::letters(&ph.ps).len();
            let chars: usize = toks.iter().map(|t| t.chars().filter(|c| c.is_alphanumeric()).count()).sum();
            let ratio = letters as f64 / chars.max(1) as f64;
            if !(0.5..=1.45).contains(&ratio) {
                println!("  {locale}/{}/{}: phonemes/letters {ratio:.2} in {:?}", story.id, p.id, toks.join(" "));
            }
        }
    }
    Ok(())
}
