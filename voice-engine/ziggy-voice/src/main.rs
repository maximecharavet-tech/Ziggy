use anyhow::Result;
use clap::{Parser, Subcommand};
use ziggy_voice::{kokoro, paths::Cache, prepare};

#[derive(Parser)]
#[command(name = "ziggy-voice", about = "Ziggy Voice Engine v2")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Download Kokoro + libraries into the cache and patch the graph.
    Prepare,
    /// Patch an ONNX graph (`full` = Ziggy v2, `duration` = the old Python patch).
    Patch {
        input: String,
        out: String,
        #[arg(long, default_value = "full")]
        mode: String,
    },
    /// Print the phonemes of every sentence (debug / comparison).
    G2p {
        #[arg(long, default_value = "fr")]
        locale: String,
        #[arg(long)]
        story: Option<String>,
    },
    /// Compare voice recipes on one utterance (writes WAVs, prints measurements).
    Lab {
        ps: String,
        #[arg(long, default_value = "methods")]
        set: String,
        #[arg(long, default_value = "ff_siwis")]
        voice: String,
        #[arg(long, default_value_t = 0.8)]
        speed: f32,
        #[arg(long, default_value = "")]
        others: String,
        #[arg(long, default_value_t = 0.25)]
        amount: f32,
        #[arg(long)]
        out: String,
    },
    /// WORLD transform of a WAV file (debug).
    World {
        input: String,
        out: String,
        #[arg(long, default_value_t = 1.0)]
        f0: f64,
        #[arg(long, default_value_t = 1.0)]
        gamma: f64,
        #[arg(long, default_value_t = 1.0)]
        formant: f64,
    },
    /// Measure audio files (wav/mp3), in parallel.
    Measure {
        files: Vec<String>,
        /// Print JSON instead of a table.
        #[arg(long)]
        json: bool,
    },
    /// Print the storytelling plan (voices, speeds, pauses) of stories.
    Plan {
        #[arg(long, default_value = "fr")]
        locale: String,
        #[arg(long)]
        story: Option<String>,
    },
    /// Narrate the stories into public/dodo/voice (all, some, or one sample).
    Generate {
        /// Locales, in order (French first).
        #[arg(long, default_value = "fr,en")]
        locale: String,
        /// Story ids, comma-separated (default: all).
        #[arg(long, default_value = "")]
        story: String,
        /// Keep stories whose timing.json (v2, same texts) is complete.
        #[arg(long)]
        skip_existing: bool,
        /// ONNX Runtime threads.
        #[arg(long, default_value_t = 3)]
        threads: usize,
        /// Segments post-processed in parallel.
        #[arg(long, default_value_t = 3)]
        jobs: usize,
        /// Saved output of dump-stories.mjs (default: run it).
        #[arg(long)]
        stories_json: Option<String>,
        /// `story:segment`: render only that segment into --out (wav, mp3, json).
        #[arg(long)]
        sample: Option<String>,
        /// Output folder (default: public/dodo/voice; for --sample: required).
        #[arg(long)]
        out: Option<String>,
        /// Phoneme report only (no audio).
        #[arg(long)]
        check: bool,
    },
    /// Synthesize a phoneme string to a WAV (voice or blend, e.g. `ff_siwis:0.7+af_heart:0.3`).
    Phonemes {
        ps: String,
        #[arg(long, default_value = "ff_siwis")]
        voice: String,
        #[arg(long, default_value_t = 0.8)]
        speed: f32,
        #[arg(long)]
        out: String,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Prepare => prepare::prepare(&Cache::new()),
        Cmd::Generate { locale, story, skip_existing, threads, jobs, stories_json, sample, out, check } => {
            let sample_out = if sample.is_some() {
                Some(std::path::PathBuf::from(out.clone().ok_or_else(|| anyhow::anyhow!("--sample needs --out"))?))
            } else {
                None
            };
            ziggy_voice::generate::run(ziggy_voice::generate::Options {
                locales: locale.split(',').filter(|s| !s.is_empty()).map(str::to_string).collect(),
                stories: story.split(',').filter(|s| !s.is_empty()).map(str::to_string).collect(),
                out: out.map(std::path::PathBuf::from).unwrap_or_else(ziggy_voice::paths::voice_out),
                threads,
                jobs,
                skip_existing,
                stories_json: stories_json.map(std::path::PathBuf::from),
                sample,
                sample_out,
                check,
            })
        }
        Cmd::Patch { input, out, mode } => {
            let m = std::fs::read(&input)?;
            let p = ziggy_voice::onnx_patch::patch_model(
                &m,
                if mode == "duration" {
                    ziggy_voice::onnx_patch::Patch::DurationOnly
                } else {
                    ziggy_voice::onnx_patch::Patch::Full
                },
            )?;
            std::fs::write(&out, p)?;
            Ok(())
        }
        Cmd::G2p { locale, story } => {
            let cache = Cache::new();
            let es = ziggy_voice::espeak::Espeak::load(&cache.espeak_lib(), &cache.espeak_data())?;
            let lex = ziggy_voice::stories::lexicon()?;
            let fr = ziggy_voice::g2p_fr::FrenchG2P::new(&es, lex["fr"].clone());
            let en = ziggy_voice::g2p_en::EnglishG2P::new(&es, &cache.misaki(), lex["en"].clone())?;
            for st in ziggy_voice::stories::load(None)? {
                if story.as_ref().is_some_and(|s| s != &st.id) {
                    continue;
                }
                for seg in st.segment_ids(&locale) {
                    let toks = ziggy_voice::text::tokenize(st.text(&locale, &seg).unwrap());
                    let mut out = Vec::new();
                    for s in ziggy_voice::text::sentences(&toks) {
                        let p = if locale == "fr" {
                            fr.utterance(&toks[s.start..s.end])?
                        } else {
                            en.utterance(&toks[s.start..s.end])?
                        };
                        out.push(p.ps);
                    }
                    println!("{}\t{}\t{}", st.id, seg, serde_json::to_string(&out)?);
                }
            }
            if locale == "en" {
                eprintln!("espeak fallback: {:?}", en.oov.lock().unwrap());
            }
            Ok(())
        }
        Cmd::Lab { ps, set, voice, speed, others, amount, out } => {
            let out = std::path::PathBuf::from(out);
            std::fs::create_dir_all(&out)?;
            let k = kokoro::Kokoro::new(&Cache::new(), 4)?;
            let cands = if set == "pitch" {
                ziggy_voice::lab::pitch_set(&voice, speed)
            } else if set == "voices" {
                let o: Vec<&str> = others.split(',').filter(|x| !x.is_empty()).collect();
                ziggy_voice::lab::voice_set(&o, speed)?
            } else if set == "blend" {
                let o: Vec<&str> = others.split(',').filter(|x| !x.is_empty()).collect();
                ziggy_voice::lab::blend_set(&voice, &o, amount, speed)
            } else {
                ziggy_voice::lab::method_set(&voice, speed)
            };
            let res = ziggy_voice::lab::render(&k, &ps, &cands, &out)?;
            ziggy_voice::lab::report(&res, 0);
            Ok(())
        }
        Cmd::World { input, out, f0, gamma, formant } => {
            let (x, sr) = ziggy_voice::lab::read_wav(std::path::Path::new(&input))?;
            let t = std::time::Instant::now();
            let y = ziggy_voice::world::transform(
                &x,
                sr,
                &ziggy_voice::world::WorldCfg { f0_scale: f0, f0_gamma: gamma, formant, ..Default::default() },
                None,
            );
            eprintln!("{:.2}s of audio in {:?}", x.len() as f64 / sr as f64, t.elapsed());
            ziggy_voice::lab::write_wav(std::path::Path::new(&out), &y, sr)
        }
        Cmd::Measure { files, json } => {
            use rayon::prelude::*;
            let rows: Vec<(String, ziggy_voice::analysis::Metrics)> = files
                .par_iter()
                .map(|f| {
                    let y = ziggy_voice::lab::decode(std::path::Path::new(f), kokoro::SR)?;
                    Ok((f.clone(), ziggy_voice::analysis::measure(&y, kokoro::SR)))
                })
                .collect::<Result<_>>()?;
            if json {
                println!("{}", serde_json::to_string(&rows)?);
                return Ok(());
            }
            println!("{}", ziggy_voice::lab::header());
            for (f, m) in rows {
                println!(
                    "{}   lufs {:.1} tp {:.1} clip {} {:.1}s",
                    ziggy_voice::lab::row(&f, &m, 0.0),
                    m.lufs,
                    m.true_peak_db,
                    m.clipped,
                    m.seconds
                );
            }
            Ok(())
        }
        Cmd::Plan { locale, story } => {
            for st in ziggy_voice::stories::load(None)? {
                if story.as_ref().is_some_and(|s| s != &st.id) {
                    continue;
                }
                println!("{}", st.id);
                for p in ziggy_voice::prosody::plan_story(&locale, &st) {
                    print!("{}", ziggy_voice::prosody::describe(&p));
                }
            }
            Ok(())
        }
        Cmd::Phonemes { ps, voice, speed, out } => {
            let k = kokoro::Kokoro::new(&Cache::new(), 4)?;
            let (ids, _, _) = kokoro::encode(&ps);
            let blend =
                kokoro::Blend { timbre: kokoro::Blend::parse_mix(&voice)?, prosody: kokoro::Blend::parse_mix(&voice)? };
            let style = k.style(&blend, ids.len())?;
            let take = k.synth(&ids, &style, speed, kokoro::PitchCtl::default())?;
            eprintln!("{:.2}s of audio, {} phoneme tokens", take.audio.len() as f64 / kokoro::SR as f64, ids.len());
            ziggy_voice::lab::write_wav(std::path::Path::new(&out), &take.audio, kokoro::SR)
        }
    }
}
