//! Kokoro-82M through ONNX Runtime (`ort`, loaded dynamically).
//!
//! One call = one utterance: phoneme ids, a 256-d style vector and a speed.
//! The patched graph (see `onnx_patch`) also takes Ziggy's pitch controls and
//! returns the predicted duration of every input token and the pitch curve it
//! rendered.

use crate::paths::Cache;
use anyhow::{bail, Context, Result};
use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use ort::value::Tensor;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

pub const SR: u32 = 24_000;
/// One predicted duration step = 600 samples at 24 kHz (25 ms).
pub const FRAME: usize = 600;
/// The pitch curve has two values per duration step (12.5 ms each).
pub const F0_HOP: usize = 300;
pub const MAX_TOKENS: usize = 510;
pub const STYLE_DIM: usize = 256;
/// Style rows `[0..128)` drive the decoder (timbre), `[128..256)` the
/// predictor (durations, melody, energy).
pub const TIMBRE: std::ops::Range<usize> = 0..128;
pub const PROSODY: std::ops::Range<usize> = 128..256;

/// Kokoro v1.0's phoneme vocabulary (its `config.json`), symbol → id.
pub const VOCAB: [(char, i64); 114] = [
    (';', 1),
    (':', 2),
    (',', 3),
    ('.', 4),
    ('!', 5),
    ('?', 6),
    ('—', 9),
    ('…', 10),
    ('"', 11),
    ('(', 12),
    (')', 13),
    ('“', 14),
    ('”', 15),
    (' ', 16),
    ('\u{303}', 17),
    ('ʣ', 18),
    ('ʥ', 19),
    ('ʦ', 20),
    ('ʨ', 21),
    ('ᵝ', 22),
    ('ꭧ', 23),
    ('A', 24),
    ('I', 25),
    ('O', 31),
    ('Q', 33),
    ('S', 35),
    ('T', 36),
    ('W', 39),
    ('Y', 41),
    ('ᵊ', 42),
    ('a', 43),
    ('b', 44),
    ('c', 45),
    ('d', 46),
    ('e', 47),
    ('f', 48),
    ('h', 50),
    ('i', 51),
    ('j', 52),
    ('k', 53),
    ('l', 54),
    ('m', 55),
    ('n', 56),
    ('o', 57),
    ('p', 58),
    ('q', 59),
    ('r', 60),
    ('s', 61),
    ('t', 62),
    ('u', 63),
    ('v', 64),
    ('w', 65),
    ('x', 66),
    ('y', 67),
    ('z', 68),
    ('ɑ', 69),
    ('ɐ', 70),
    ('ɒ', 71),
    ('æ', 72),
    ('β', 75),
    ('ɔ', 76),
    ('ɕ', 77),
    ('ç', 78),
    ('ɖ', 80),
    ('ð', 81),
    ('ʤ', 82),
    ('ə', 83),
    ('ɚ', 85),
    ('ɛ', 86),
    ('ɜ', 87),
    ('ɟ', 90),
    ('ɡ', 92),
    ('ɥ', 99),
    ('ɨ', 101),
    ('ɪ', 102),
    ('ʝ', 103),
    ('ɯ', 110),
    ('ɰ', 111),
    ('ŋ', 112),
    ('ɳ', 113),
    ('ɲ', 114),
    ('ɴ', 115),
    ('ø', 116),
    ('ɸ', 118),
    ('θ', 119),
    ('œ', 120),
    ('ɹ', 123),
    ('ɾ', 125),
    ('ɻ', 126),
    ('ʁ', 128),
    ('ɽ', 129),
    ('ʂ', 130),
    ('ʃ', 131),
    ('ʈ', 132),
    ('ʧ', 133),
    ('ʊ', 135),
    ('ʋ', 136),
    ('ʌ', 138),
    ('ɣ', 139),
    ('ɤ', 140),
    ('χ', 142),
    ('ʎ', 143),
    ('ʒ', 147),
    ('ʔ', 148),
    ('ˈ', 156),
    ('ˌ', 157),
    ('ː', 158),
    ('ʰ', 162),
    ('ʲ', 164),
    ('↓', 169),
    ('→', 171),
    ('↗', 172),
    ('↘', 173),
    ('ᵻ', 177),
];

pub fn vocab_id(c: char) -> Option<i64> {
    VOCAB.iter().find(|(v, _)| *v == c).map(|(_, id)| *id)
}

/// Model ids for a phoneme string + for each char of it the index of the
/// first id at/after it (chars outside the vocabulary are dropped).
pub fn encode(ps: &str) -> (Vec<i64>, Vec<usize>, Vec<char>) {
    let mut ids = Vec::new();
    let mut at = Vec::new();
    let mut kept = Vec::new();
    for c in ps.chars() {
        at.push(ids.len());
        if let Some(id) = vocab_id(c) {
            ids.push(id);
            kept.push(c);
        }
    }
    (ids, at, kept)
}

/// A voice style pack: 510 rows (one per phoneme count) × 256.
#[derive(Clone)]
pub struct Pack {
    pub rows: Vec<[f32; STYLE_DIM]>,
}

impl Pack {
    pub fn load(path: &Path) -> Result<Self> {
        let bytes = std::fs::read(path).with_context(|| format!("voice {}", path.display()))?;
        if bytes.len() % (STYLE_DIM * 4) != 0 {
            bail!("bad voice file {}", path.display());
        }
        let floats: Vec<f32> = bytes.chunks_exact(4).map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]])).collect();
        let rows = floats
            .chunks_exact(STYLE_DIM)
            .map(|r| {
                let mut a = [0f32; STYLE_DIM];
                a.copy_from_slice(r);
                a
            })
            .collect();
        Ok(Self { rows })
    }
    /// Kokoro's rule: the style row is chosen by the number of phonemes.
    pub fn row(&self, n_tokens: usize) -> [f32; STYLE_DIM] {
        self.rows[n_tokens.clamp(1, self.rows.len()) - 1]
    }
}

/// A style recipe: timbre (decoder half) and prosody (predictor half) are
/// each a weighted mix of voices, e.g. `ff_siwis:0.8+af_sky:0.2`.
#[derive(Clone, Debug, PartialEq)]
pub struct Blend {
    pub timbre: Vec<(String, f32)>,
    pub prosody: Vec<(String, f32)>,
}

impl Blend {
    pub fn single(voice: &str) -> Self {
        Self { timbre: vec![(voice.into(), 1.0)], prosody: vec![(voice.into(), 1.0)] }
    }
    /// `"ff_siwis:0.7+af_sky:0.3"` → weights normalized to 1.
    pub fn parse_mix(s: &str) -> Result<Vec<(String, f32)>> {
        let mut v = Vec::new();
        for part in s.split('+') {
            let (name, w) = match part.split_once(':') {
                Some((n, w)) => (n.trim(), w.trim().parse::<f32>().context("blend weight")?),
                None => (part.trim(), 1.0),
            };
            if name.is_empty() || w < 0.0 {
                bail!("bad blend {s}");
            }
            v.push((name.to_string(), w));
        }
        let total: f32 = v.iter().map(|(_, w)| w).sum();
        if total <= 0.0 {
            bail!("bad blend {s}");
        }
        for (_, w) in &mut v {
            *w /= total;
        }
        Ok(v)
    }
    pub fn key(&self) -> String {
        let f = |m: &[(String, f32)]| m.iter().map(|(n, w)| format!("{n}:{w:.3}")).collect::<Vec<_>>().join("+");
        format!("t={}|p={}", f(&self.timbre), f(&self.prosody))
    }
}

/// Pitch controls applied inside the network (see `onnx_patch`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PitchCtl {
    /// Overall pitch factor (1 = the voice's own).
    pub scale: f32,
    /// Melody widening around `reference` (1 = unchanged, >1 = livelier).
    pub gamma: f32,
    /// Pivot of the widening (Hz).
    pub reference: f32,
}

impl Default for PitchCtl {
    fn default() -> Self {
        Self { scale: 1.0, gamma: 1.0, reference: 200.0 }
    }
}

pub struct Take {
    pub audio: Vec<f32>,
    /// Sample where each phoneme `ids[k]` starts (`edges[k]`); `edges[ids.len()]`
    /// is where the last one ends. Durations are whole frames (`FRAME`
    /// samples) scaled onto the real audio length.
    pub edges: Vec<f64>,
    /// Pitch the decoder rendered (Hz, one value per `F0_HOP` samples).
    pub f0: Vec<f32>,
    /// Pitch the predictor produced, before Ziggy's controls.
    pub f0_pred: Vec<f32>,
    /// Frames per input token (boundaries included).
    pub durations: Vec<i64>,
}

pub struct Kokoro {
    _env: ort::environment::Environment,
    session: Mutex<Session>,
    /// The same graph cut before the decoder: durations, pitch and energy
    /// for the planning pass (≈ 4× cheaper than a full synthesis).
    predictor: Mutex<Session>,
    packs: Mutex<HashMap<String, Pack>>,
    voices_dir: std::path::PathBuf,
}

impl Kokoro {
    pub fn new(cache: &Cache, threads: usize) -> Result<Self> {
        let lib =
            std::env::var_os("ORT_DYLIB_PATH").map(std::path::PathBuf::from).unwrap_or_else(|| cache.onnxruntime());
        if !lib.exists() {
            bail!("{} missing — run `ziggy-voice prepare`", lib.display());
        }
        // ONNX Runtime ≥ 1.2x for Linux ships Microsoft "1DS" telemetry that
        // uploads usage events; the API switch below is not enough, the
        // library reads this variable. Nothing must leave the build machine.
        std::env::set_var("ORT_DISABLE_TELEMETRY", "1");
        let env = ort::init_from(&lib)
            .map_err(|e| anyhow::anyhow!("load {}: {e}", lib.display()))?
            .with_name("ziggy-voice")
            .with_telemetry(false) // nothing leaves the build machine
            .build()
            .map_err(|e| anyhow::anyhow!("ort env: {e}"))?;
        let open = |path: &Path| -> Result<Session> {
            if !path.exists() {
                bail!("{} missing — run `ziggy-voice prepare`", path.display());
            }
            Session::builder(&env)
                .map_err(|e| anyhow::anyhow!("{e}"))?
                .with_optimization_level(GraphOptimizationLevel::Level3)
                .map_err(|e| anyhow::anyhow!("{e}"))?
                .with_intra_threads(threads.max(1))
                .map_err(|e| anyhow::anyhow!("{e}"))?
                .with_inter_threads(1)
                .map_err(|e| anyhow::anyhow!("{e}"))?
                .with_intra_op_spinning(false)
                .map_err(|e| anyhow::anyhow!("{e}"))?
                .commit_from_file(path)
                .map_err(|e| anyhow::anyhow!("load {}: {e}", path.display()))
        };
        let session = open(&cache.model())?;
        let predictor = open(&cache.predictor())?;
        Ok(Self {
            _env: env,
            session: Mutex::new(session),
            predictor: Mutex::new(predictor),
            packs: Mutex::new(HashMap::new()),
            voices_dir: cache.voices(),
        })
    }

    pub fn pack(&self, name: &str) -> Result<Pack> {
        let mut packs = self.packs.lock().unwrap();
        if let Some(p) = packs.get(name) {
            return Ok(p.clone());
        }
        let p = Pack::load(&self.voices_dir.join(format!("{name}.bin")))?;
        packs.insert(name.to_string(), p.clone());
        Ok(p)
    }

    /// v3: the timbre half from one fixed row (the same colour for every
    /// utterance of a role), the prosody half by length as Kokoro does.
    pub fn style_fixed_timbre(&self, blend: &Blend, n_tokens: usize, timbre_row: usize) -> Result<[f32; STYLE_DIM]> {
        let mut s = [0f32; STYLE_DIM];
        for (half, mix, n) in [(TIMBRE, &blend.timbre, timbre_row), (PROSODY, &blend.prosody, n_tokens)] {
            for (name, w) in mix {
                let row = self.pack(name)?.row(n);
                for k in half.clone() {
                    s[k] += w * row[k];
                }
            }
        }
        Ok(s)
    }

    /// The style vector of a blend for an utterance of `n_tokens` phonemes.
    pub fn style(&self, blend: &Blend, n_tokens: usize) -> Result<[f32; STYLE_DIM]> {
        let mut s = [0f32; STYLE_DIM];
        for (half, mix) in [(TIMBRE, &blend.timbre), (PROSODY, &blend.prosody)] {
            for (name, w) in mix {
                let row = self.pack(name)?.row(n_tokens);
                for k in half.clone() {
                    s[k] += w * row[k];
                }
            }
        }
        Ok(s)
    }

    /// Synthesize one utterance (ids without the boundary 0s), v2 style: the
    /// model's own durations, pitch transformed by `pitch`.
    pub fn synth(&self, ids: &[i64], style: &[f32; STYLE_DIM], speed: f32, pitch: PitchCtl) -> Result<Take> {
        self.synth_with(ids, style, speed, pitch, &Controls::default())
    }

    /// The planning pass: what the model would do with these duration scales
    /// (per input token, boundaries included; empty = ×1).
    pub fn predict(&self, ids: &[i64], style: &[f32; STYLE_DIM], speed: f32, dur_scale: &[f32]) -> Result<Prediction> {
        let ctl = Controls { dur_scale: dur_scale.to_vec(), ..Default::default() };
        let inputs = feeds(ids, style, speed, PitchCtl::default(), &ctl, false)?;
        let err = |e: ort::Error| anyhow::anyhow!("{e}");
        let mut session = self.predictor.lock().unwrap();
        let out = session.run(inputs).map_err(err)?;
        let (_, dur) = out["duration"].try_extract_tensor::<i64>().map_err(err)?;
        let (_, f0) = out["f0_pred"].try_extract_tensor::<f32>().map_err(err)?;
        let (_, n) = out["n_pred"].try_extract_tensor::<f32>().map_err(err)?;
        Ok(Prediction { durations: dur.to_vec(), f0: f0.to_vec(), n: n.to_vec() })
    }

    /// Synthesize with explicit controls (v3): exact durations, pitch and
    /// energy curves given to the decoder.
    pub fn synth_with(
        &self,
        ids: &[i64],
        style: &[f32; STYLE_DIM],
        speed: f32,
        pitch: PitchCtl,
        ctl: &Controls,
    ) -> Result<Take> {
        let inputs = feeds(ids, style, speed, pitch, ctl, true)?;
        let err = |e: ort::Error| anyhow::anyhow!("{e}");
        let mut session = self.session.lock().unwrap();
        let out = session.run(inputs).map_err(err)?;
        let (_, wav) = out["waveform"].try_extract_tensor::<f32>().map_err(err)?;
        let (_, dur) = out["duration"].try_extract_tensor::<i64>().map_err(err)?;
        let (_, f0) = out["f0"].try_extract_tensor::<f32>().map_err(err)?;
        let (_, f0p) = out["f0_pred"].try_extract_tensor::<f32>().map_err(err)?;
        let audio = wav.to_vec();
        let total: f64 = dur.iter().map(|&d| d as f64).sum();
        // Durations are in frames; spread them over the real audio length.
        let scale = audio.len() as f64 / total.max(1e-9);
        let mut edges = Vec::with_capacity(dur.len() + 1);
        let mut acc = 0.0;
        edges.push(0.0);
        for &d in dur.iter() {
            acc += d as f64;
            edges.push(acc * scale);
        }
        // edges[k] = start of input token k (token 0 = the leading boundary);
        // drop the boundary so edges[k] = start of ids[k].
        let edges = edges[1..].to_vec();
        Ok(Take { audio, edges, f0: f0.to_vec(), f0_pred: f0p.to_vec(), durations: dur.to_vec() })
    }
}

/// Explicit prosody for one utterance (all optional: empty = the model's own).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Controls {
    /// Per input token (boundaries included): multiply the predicted duration.
    pub dur_scale: Vec<f32>,
    /// Per input token: exact frame counts (overrides `dur_scale`).
    pub dur_frames: Vec<f32>,
    /// Pitch curve for the decoder (Hz, `F0_HOP` samples per value; ≤ 10 = unvoiced).
    pub f0: Vec<f32>,
    /// Energy curve for the decoder (same grid as `f0`).
    pub n: Vec<f32>,
}

/// What the predictor plans for an utterance.
#[derive(Clone, Debug)]
pub struct Prediction {
    /// Frames per input token, boundaries included.
    pub durations: Vec<i64>,
    pub f0: Vec<f32>,
    pub n: Vec<f32>,
}

type Feeds = Vec<(std::borrow::Cow<'static, str>, ort::session::SessionInputValue<'static>)>;

fn feeds(ids: &[i64], style: &[f32; STYLE_DIM], speed: f32, pitch: PitchCtl, ctl: &Controls, full: bool) -> Result<Feeds> {
    if ids.is_empty() || ids.len() > MAX_TOKENS - 2 {
        bail!("utterance of {} tokens", ids.len());
    }
    let mut input = Vec::with_capacity(ids.len() + 2);
    input.push(0);
    input.extend_from_slice(ids);
    input.push(0);
    let n = input.len();
    let err = |e: ort::Error| anyhow::anyhow!("{e}");
    let row = |v: &[f32], len: usize, fill: f32| -> Result<Tensor<f32>> {
        if v.is_empty() {
            return Tensor::from_array((vec![1i64, 1], vec![fill])).map_err(err);
        }
        if len > 0 && v.len() != len {
            bail!("control of length {} for {} tokens", v.len(), len);
        }
        Tensor::from_array((vec![1i64, v.len() as i64], v.to_vec())).map_err(err)
    };
    let one = |v: f32| Tensor::from_array((vec![1i64], vec![v])).map_err(err);
    let mix = |v: &[f32]| one(if v.is_empty() { 0.0 } else { 1.0 });
    let mut f: Feeds = vec![
        ("input_ids".into(), Tensor::from_array((vec![1i64, n as i64], input)).map_err(err)?.into()),
        ("style".into(), Tensor::from_array((vec![1i64, STYLE_DIM as i64], style.to_vec())).map_err(err)?.into()),
        ("speed".into(), one(speed)?.into()),
        ("dur_scale".into(), row(&ctl.dur_scale, n, 1.0)?.into()),
        ("dur_frames".into(), row(&ctl.dur_frames, n, 0.0)?.into()),
        ("dur_mix".into(), mix(&ctl.dur_frames)?.into()),
    ];
    if full {
        f.extend([
            ("f0_scale".into(), one(pitch.scale)?.into()),
            ("f0_gamma".into(), one(pitch.gamma)?.into()),
            ("f0_ref".into(), one(pitch.reference)?.into()),
            ("f0_override".into(), row(&ctl.f0, 0, 0.0)?.into()),
            ("f0_mix".into(), mix(&ctl.f0)?.into()),
            ("n_override".into(), row(&ctl.n, 0, 0.0)?.into()),
            ("n_mix".into(), mix(&ctl.n)?.into()),
        ]);
    }
    Ok(f)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_maps_and_tracks_positions() {
        let (ids, at, kept) = encode("bɔ̃ʒuʁ!");
        assert_eq!(ids.len(), 7);
        assert_eq!(at.len(), "bɔ̃ʒuʁ!".chars().count());
        assert_eq!(kept.last(), Some(&'!'));
        let (ids2, _, _) = encode("a\u{2019}b"); // ’ is not in the vocabulary
        assert_eq!(ids2.len(), 2);
    }

    #[test]
    fn blend_parse_normalizes() {
        let b = Blend::parse_mix("ff_siwis:3+af_sky:1").unwrap();
        assert_eq!(b[0].0, "ff_siwis");
        assert!((b[0].1 - 0.75).abs() < 1e-6 && (b[1].1 - 0.25).abs() < 1e-6);
        assert!(Blend::parse_mix("x:-1").is_err());
    }
}
