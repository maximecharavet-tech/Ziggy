//! Ziggy's voice recipe v2 — every tunable number in one place.
//!
//! How it was chosen (see `ziggy-voice lab` and the README): the pitch is
//! raised **inside Kokoro** (its decoder renders the new melody, so there is
//! no pitch-shifting artefact), the vocal tract is made smaller with WORLD's
//! CheapTrick envelope applied as a gentle STFT filter (the neural excitation,
//! breath and phases are kept: WORLD's full resynthesis measured +4–5 dB
//! harmonic-to-noise, i.e. buzzier), and the timbre is a blend of style
//! vectors chosen for a warm colour with clean French phonemes.

use crate::kokoro::{Blend, PitchCtl};

pub const RECIPE_ID: &str = "ziggy-v2";

/// One delivery of the voice (narrator, a character, a whisper…).
#[derive(Clone, Debug, PartialEq)]
pub struct Delivery {
    pub blend: Blend,
    /// Kokoro speed (< 1 = slower, with natural prosody).
    pub speed: f32,
    pub pitch: PitchCtl,
    /// Vocal-tract scale applied with the CheapTrick envelope filter.
    pub formant: f32,
    pub gain_db: f32,
}

fn mix(v: &[(&str, f32)]) -> Vec<(String, f32)> {
    let total: f32 = v.iter().map(|x| x.1).sum();
    v.iter().map(|(n, w)| (n.to_string(), w / total)).collect()
}

/// Ziggy narrating, per locale.
pub fn narrator(locale: &str) -> Delivery {
    if locale == "fr" {
        Delivery {
            // ff_siwis is Kokoro's only French voice; 30 % of af_heart's
            // decoder style warms the timbre (spectral centroid −9 %) with the
            // lowest phoneme distortion of all candidates (≈2 dB on every
            // class, nasal vowels and ʁ included). Prosody stays French.
            blend: Blend { timbre: mix(&[("ff_siwis", 0.7), ("af_heart", 0.3)]), prosody: mix(&[("ff_siwis", 1.0)]) },
            speed: 0.80,
            pitch: PitchCtl { scale: 1.22, gamma: 1.15, reference: 200.0 },
            formant: 1.09,
            gain_db: 0.0,
        }
    } else {
        Delivery {
            blend: Blend { timbre: mix(&[("af_heart", 0.8), ("ff_siwis", 0.2)]), prosody: mix(&[("af_heart", 1.0)]) },
            speed: 0.84,
            pitch: PitchCtl { scale: 1.22, gamma: 1.12, reference: 190.0 },
            formant: 1.09,
            gain_db: 0.0,
        }
    }
}

/// Character voices: distinct but gentle variations of Ziggy's voice.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Variant {
    /// Unknown speaker (or "il"/"she"…).
    Generic,
    /// First named child/animal character of a story.
    ChildA,
    /// Second named character.
    ChildB,
    /// Grown-ups and elders (grand-mère, Papi, the old oak, the king…).
    Warm,
}

pub fn character(locale: &str, v: Variant) -> Delivery {
    let mut d = narrator(locale);
    let base_timbre = d.blend.timbre.clone();
    let add = |extra: &str, amount: f32| -> Vec<(String, f32)> {
        let mut t: Vec<(String, f32)> = base_timbre.iter().map(|(n, w)| (n.clone(), w * (1.0 - amount))).collect();
        t.push((extra.to_string(), amount));
        t
    };
    match v {
        Variant::Generic => {
            d.pitch.scale *= 1.04;
            d.pitch.gamma = 1.22;
            d.formant = 1.10;
            d.speed *= 1.02;
        }
        Variant::ChildA => {
            d.blend.timbre = add("af_sky", 0.15);
            d.pitch.scale *= 1.07;
            d.pitch.gamma = 1.25;
            d.formant = 1.12;
            d.speed *= 1.03;
        }
        Variant::ChildB => {
            d.blend.timbre = add("bf_lily", 0.15);
            d.pitch.scale *= 1.11;
            d.pitch.gamma = 1.22;
            d.formant = 1.13;
            d.speed *= 1.02;
        }
        Variant::Warm => {
            d.blend.timbre = add("af_bella", 0.2);
            d.pitch.scale *= 0.88;
            d.pitch.gamma = 1.12;
            d.formant = 1.03;
            d.speed *= 0.96;
        }
    }
    d
}

/// Pauses (seconds).
pub struct Pauses;
impl Pauses {
    pub const LEAD: f32 = 0.10;
    pub const TAIL: f32 = 0.40;
    pub const OUTRO_TAIL: f32 = 0.80;
    pub const SENTENCE: f32 = 0.42;
    pub const EXCLAMATION: f32 = 0.45;
    pub const QUESTION: f32 = 0.55;
    pub const ELLIPSIS: f32 = 0.75;
    pub const COLON: f32 = 0.30;
    pub const OTHER: f32 = 0.35;
    /// Between a quote and its attribution inside one sentence.
    pub const TAG: f32 = 0.14;
    /// After a quote that ends on ! ? … before its attribution.
    pub const TAG_AFTER_MARK: f32 = 0.22;
    /// Extra breath before the closing sentence of a scene.
    pub const BEFORE_LAST: f32 = 0.15;
    /// Extra breath before a short "reveal" sentence.
    pub const BEFORE_REVEAL: f32 = 0.12;
}

/// The words a child would hear lit 0.10 s before the phoneme slot: Kokoro's
/// sound for a phoneme starts ~3 frames early (75 ms), plus a little lead.
pub const ONSET_SHIFT: f64 = 0.10;
/// Mouth shapes lead the sound by the acoustic offset only.
pub const VISEME_SHIFT: f64 = 0.075;

pub struct Master;
impl Master {
    pub const LUFS: f64 = -18.0;
    pub const TRUE_PEAK_DB: f64 = -1.5;
    pub const HIGHPASS_HZ: f64 = 70.0;
    pub const WARMTH_HZ: f64 = 220.0;
    pub const WARMTH_DB: f64 = 1.5;
    pub const SOFT_HIGHS_HZ: f64 = 6500.0;
    pub const SOFT_HIGHS_DB: f64 = -2.0;
    /// 4th order: nothing above is needed at bedtime, and the MP3 spends its
    /// bits on the speech band instead (fewer "swirly" artefacts up high).
    pub const LOWPASS_HZ: f64 = 10000.0;
    pub const DEESS_LO_HZ: f64 = 5000.0;
    pub const DEESS_HI_HZ: f64 = 10000.0;
    /// A sibilant band coming within this of the loud speech level (p90 of
    /// the frame levels) is reduced (0.6 dB per dB above).
    pub const DEESS_THRESHOLD_DB: f64 = -10.0;
    pub const DEESS_MAX_DB: f64 = 6.0;
    pub const COMP_RATIO: f64 = 2.0;
    pub const COMP_THRESHOLD_DB: f64 = -24.0;
    pub const COMP_KNEE_DB: f64 = 6.0;
    pub const COMP_ATTACK_MS: f64 = 10.0;
    pub const COMP_RELEASE_MS: f64 = 140.0;
    pub const ROOM_WET: f64 = 0.045;
    pub const ROOM_RT60: f64 = 0.22;
    pub const ROOM_PREDELAY_MS: f64 = 7.0;
    pub const FADE_MS: f64 = 20.0;
}

/// MP3 encoding (libmp3lame through ffmpeg): mono, 24 kHz (Kokoro's rate),
/// VBR quality 5 (≈ 47 kbit/s on this voice). Measured against the mastered
/// WAV it beats CBR 40/48 and ABR 44/48 in every band (SNR 22.2 dB vs 18.5 dB
/// for v1's CBR 40) and keeps all 31 stories × 2 languages under ≈ 60 MB.
pub const MP3_VBR_QUALITY: &str = "5";
