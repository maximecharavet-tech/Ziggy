//! Santa's voice for L'appli du Père Noël: every fixed clip of the guided and
//! scheduled calls, the voice message, gifts, proud moments, ages and Advent
//! doors, rendered once (offline, free) into `public/santa/voice/<locale>/`.
//!
//! Input: the JSON of `voice-engine/dump-santa.mjs`. Each text goes through
//! the same reading as the bedtime stories (phrases, melody, pauses: the
//! storyteller planner of `prosody.rs`), with `recipe::santa` as the voice,
//! then the Santa colour (`fx`, FunDSP), mastering and MP3. The site's
//! manifest (`src/data/santa/voice-manifest.json`) maps each key to the hash
//! of the words it was recorded with, so a changed text falls back to the
//! live voice until it is re-recorded.

use crate::espeak::Espeak;
use crate::g2p_en::EnglishG2P;
use crate::g2p_fr::FrenchG2P;
use crate::intonation::StoryContext;
use crate::kokoro::{Blend, Kokoro, SR};
use crate::master::master_to;
use crate::output::write_mp3;
use crate::paths::Cache;
use crate::prosody::{plan_segment, Cast};
use crate::recipe::{santa, Delivery, Master, SANTA_RECIPE_ID};
use crate::render::{G2p, Renderer};
use crate::stories::lexicon;
use anyhow::{Context, Result};
use fundsp::prelude64::{bell_hz, db_amp, highshelf_hz, lowshelf_hz, AudioUnit};
use rayon::prelude::*;
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Deserialize, Clone, Debug)]
pub struct Clip {
    pub locale: String,
    pub key: String,
    pub file: String,
    pub text: String,
    pub hash: String,
}

pub struct Options {
    pub clips: PathBuf,
    pub out: PathBuf,
    pub manifest: PathBuf,
    pub locales: Vec<String>,
    /// Only these keys (empty = all).
    pub only: Vec<String>,
    pub force: bool,
    pub threads: usize,
    pub jobs: usize,
    /// Tuning overrides (lab): timbre / prosody mixes, pitch, formant, speed.
    pub timbre: Option<String>,
    pub prosody: Option<String>,
    pub pitch: Option<f32>,
    pub formant: Option<f32>,
    pub speed: Option<f32>,
    /// Also write the mastered WAV next to each MP3 (for listening tests).
    pub wav: bool,
}

/// Santa's colour, after the formant filter and before mastering: a little
/// chest (bell 150 Hz), warmth (low shelf 300 Hz), a softer top (high shelf
/// 5.5 kHz) and gentle tube-like harmonics (tanh, 25 % parallel).
pub fn fx(x: &[f32], sr: u32) -> Vec<f32> {
    let mut eq = bell_hz(150.0, 0.9, db_amp(2.5)) >> lowshelf_hz(300.0, 0.7, db_amp(1.5)) >> bell_hz(3000.0, 1.0, db_amp(-1.5)) >> highshelf_hz(5500.0, 0.7, db_amp(-2.5));
    eq.set_sample_rate(sr as f64);
    eq.allocate();
    let drive = 1.8f32;
    let norm = drive.tanh();
    x.iter()
        .map(|&v| {
            let y = eq.filter_mono(v);
            let sat = (y * drive).tanh() / norm;
            0.75 * y + 0.25 * sat
        })
        .collect()
}

fn delivery(locale: &str, o: &Options) -> Result<Delivery> {
    let mut d = santa(locale);
    if let Some(t) = &o.timbre {
        d.blend.timbre = Blend::parse_mix(t)?;
    }
    if let Some(p) = &o.prosody {
        d.blend.prosody = Blend::parse_mix(p)?;
    }
    if let Some(p) = o.pitch {
        d.pitch.scale = p;
    }
    if let Some(f) = o.formant {
        d.formant = f;
    }
    if let Some(s) = o.speed {
        d.speed = s;
    }
    Ok(d)
}

type Manifest = BTreeMap<String, serde_json::Value>;

fn read_manifest(path: &PathBuf) -> Manifest {
    std::fs::read_to_string(path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
}

pub fn run(o: Options) -> Result<()> {
    let clips: Vec<Clip> = serde_json::from_str(&std::fs::read_to_string(&o.clips).context("clips json (dump-santa.mjs)")?)?;
    let cache = Cache::new();
    let es = Espeak::load(&cache.espeak_lib(), &cache.espeak_data()).context("espeak-ng (run `ziggy-voice prepare`)")?;
    let lex = lexicon()?;
    let kokoro = Kokoro::new(&cache, o.threads)?;
    let pool = rayon::ThreadPoolBuilder::new().num_threads(o.jobs.max(1)).build()?;
    let mut manifest = read_manifest(&o.manifest);
    manifest.insert("voice".into(), serde_json::json!(SANTA_RECIPE_ID));
    let t_all = Instant::now();
    for locale in &o.locales {
        let g2p = if locale == "fr" {
            G2p::Fr(FrenchG2P::new(&es, lex["fr"].clone()))
        } else {
            G2p::En(EnglishG2P::new(&es, &cache.misaki(), lex["en"].clone())?)
        };
        let renderer = Renderer { kokoro: &kokoro, g2p: &g2p, take_cache: Some(cache.raw()) };
        let d = delivery(locale, &o)?;
        let known: BTreeMap<String, String> = manifest
            .get(locale)
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();
        let todo: Vec<&Clip> = clips
            .iter()
            .filter(|c| &c.locale == locale)
            .filter(|c| o.only.is_empty() || o.only.iter().any(|k| k == &c.key))
            .filter(|c| {
                o.force
                    || known.get(&c.key) != Some(&c.hash)
                    || !o.out.join(locale).join(format!("{}.mp3", c.file)).exists()
            })
            .collect();
        println!("{locale}: {} clips to record", todo.len());
        let done: Vec<Result<(String, String, f64)>> = pool.install(|| {
            todo.par_iter()
                .map(|c| {
                    let mut plan = plan_segment(locale, &c.key, &c.text, &mut Cast::default(), &mut StoryContext::default());
                    for p in &mut plan.pieces {
                        // One voice for the whole clip: Santa (quotes and asides included).
                        let range = f32::max(p.delivery.range, 1.0);
                        p.delivery = d.clone();
                        p.delivery.range *= f32::min(range, 1.1);
                    }
                    plan.lead = 0.05;
                    let seg = renderer.render_segment(&plan).with_context(|| c.key.clone())?;
                    let coloured = fx(&seg.audio, SR);
                    let (mastered, _) = master_to(&coloured, SR, Master::TRUE_PEAK_DB - 0.5);
                    let mp3 = o.out.join(locale).join(format!("{}.mp3", c.file));
                    write_mp3(&mp3, &mastered)?;
                    if o.wav {
                        crate::lab::write_wav(&mp3.with_extension("wav"), &mastered, SR)?;
                    }
                    let dur = mastered.len() as f64 / SR as f64;
                    println!("  {locale} {} {:.1}s", c.key, dur);
                    Ok((c.key.clone(), c.hash.clone(), dur))
                })
                .collect()
        });
        let mut map = known;
        let mut failed = 0;
        for r in done {
            match r {
                Ok((k, h, _)) => {
                    map.insert(k, h);
                }
                Err(e) => {
                    failed += 1;
                    eprintln!("  ! {e:#}");
                }
            }
        }
        // Forget clips that no longer exist on the site.
        map.retain(|k, _| clips.iter().any(|c| &c.locale == locale && &c.key == k));
        manifest.insert(locale.clone(), serde_json::to_value(&map)?);
        if let Some(dir) = o.manifest.parent() {
            std::fs::create_dir_all(dir)?;
        }
        std::fs::write(&o.manifest, serde_json::to_string_pretty(&manifest)? + "\n")?;
        if failed > 0 {
            anyhow::bail!("{failed} clips failed ({locale})");
        }
    }
    println!("santa voice done in {:.0}s", t_all.elapsed().as_secs_f64());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fx_is_bounded_and_keeps_the_level() {
        let sr = 24_000;
        let x: Vec<f32> = (0..sr).map(|i| 0.3 * ((i as f32) * 2.0 * std::f32::consts::PI * 220.0 / sr as f32).sin()).collect();
        let y = fx(&x, sr as u32);
        assert_eq!(y.len(), x.len());
        let rms = |v: &[f32]| (v.iter().map(|s| s * s).sum::<f32>() / v.len() as f32).sqrt();
        let ratio = rms(&y[4800..]) / rms(&x[4800..]);
        assert!(ratio > 0.7 && ratio < 2.0, "{ratio}");
        assert!(y.iter().all(|v| v.is_finite() && v.abs() < 1.0));
    }
}
