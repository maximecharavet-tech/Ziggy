"""Central recipe of tunable constants for the santa-v2 voice.

Every magic number from the specification lives here so that variants such as
``--age 0.5`` or ``--age 1.0`` are one flag away.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Tuple


@dataclass(frozen=True)
class Recipe:
    # ------------------------------------------------------------------ style
    timbre_fr: Dict[str, float] = field(
        default_factory=lambda: {
            "am_santa": 0.35,
            "em_santa": 0.15,
            "ff_siwis": 0.5,
        }
    )
    prosody_fr: Dict[str, float] = field(default_factory=lambda: {"ff_siwis": 1.0})
    timbre_en: Dict[str, float] = field(
        default_factory=lambda: {"am_santa": 0.8, "am_onyx": 0.2}
    )
    prosody_en: Dict[str, float] = field(default_factory=lambda: {"am_santa": 1.0})

    # -------------------------------------------------------------- base speed
    base_speed_fr: float = 0.86
    # Kokoro below ~0.9 adds a vowel onset ("Et je…"); slower targets are
    # rendered at this speed and the rest is a WORLD time-stretch.
    kokoro_min_speed: float = 0.92
    base_speed_en: float = 0.88
    exclamation_speed: float = 0.90
    ellipsis_speed: float = 0.80
    last_phrase_speed_delta: float = -0.03

    # ------------------------------------------------------------ pause lengths
    pause_comma_ms: int = 180
    pause_period_ms: int = 380
    pause_exclamation_ms: int = 420
    pause_question_ms: int = 450
    pause_ellipsis_ms: int = 650
    pause_colon_ms: int = 300

    # -------------------------------------------------------------- ho ho ho
    hohoho_pitches: Tuple[float, ...] = (1.15, 1.0, 0.88)
    split_on_clauses: bool = False  # True = one Kokoro call per comma clause
    hohoho_gap_ms: int = 110
    # Aspirated "Ho" given as phonemes (French espeak drops the h: heard "Vo").
    hohoho_phonemes_fr: str = "hˈo!"
    hohoho_phonemes_en: str = "hˈoʊ!"
    hohoho_pause_after_ms: int = 280  # between the laugh and the next words
    hohoho_attack_ms: float = 5.0
    hohoho_decay_tau_ms: float = 180.0
    hohoho_breath_boost: float = 0.30

    # ------------------------------------------------------------- pitch level
    target_median_f0_fr: float = 108.0
    target_median_f0_en: float = 100.0
    f0_scale_clamp: Tuple[float, float] = (0.45, 1.10)
    melody_expansion: float = 1.15
    melody_expansion_exclamation: float = 1.25

    # --------------------------------------------------------------- intonation
    declination_pct: float = -8.0
    final_fall_pct: float = -12.0
    final_rise_pct: float = 18.0
    continuation_rise_pct: float = 6.0
    exclamation_peak_pct: float = 10.0
    exclamation_fall_pct: float = -10.0
    ellipsis_fall_pct: float = -6.0

    # ---------------------------------------------------------------- emphasis
    emphasis_f0_boost: float = 0.12
    emphasis_db_boost: float = 2.0

    # ----------------------------------------------------------------- formant
    formant_warp: float = 0.93
    formant_fade_start_hz: float = 9000.0
    formant_fade_end_hz: float = 12000.0

    # ----------------------------------------------------------------- ageing
    age_f0_drop: float = 0.06          # F0 × (1 − 0.06·age)
    jitter_pct: float = 0.018          # ±1.8 % · age
    jitter_tau_frames: float = 3.0
    tremolo_hz: float = 5.5
    tremolo_pct: float = 0.014         # ±1.4 % · age
    shimmer_db: float = 1.2            # ±1.2 dB · age
    breath_r_base: float = 0.35
    breath_f_lo: float = 1000.0
    breath_f_hi: float = 4000.0
    fry_last_ms: float = 160.0
    fry_min_run_ms: float = 320.0
    fry_f0_drop: float = 0.20
    fry_r_boost: float = 0.30
    fry_below_hz: float = 1500.0
    slowdown_per_age: float = 0.08     # resample factor 1 + 0.08·age

    # ------------------------------------------------------------------ breath
    breath_phrase_chars: int = 9999
    breath_gap_ms: int = 120
    breath_noise_lo_hz: float = 500.0
    breath_noise_hi_hz: float = 3000.0
    breath_noise_dbfs: float = -42.0

    # --------------------------------------------------------------- assembly
    join_fade_ms: float = 20.0
    lead_silence_ms: int = 60
    tail_silence_ms: int = 150

    # ------------------------------------------------------------------ colour
    eq_bell1_hz: float = 150.0
    eq_bell1_q: float = 0.9
    eq_bell1_gain_db: float = 2.5

    eq_lowshelf_hz: float = 300.0
    eq_lowshelf_gain_db: float = 1.5

    eq_bell2_hz: float = 3000.0
    eq_bell2_q: float = 1.0
    eq_bell2_gain_db: float = -1.5

    eq_highshelf_hz: float = 5500.0
    eq_highshelf_gain_db: float = -2.5

    saturation_mix: float = 0.25
    saturation_drive: float = 1.8

    deesser_lo_hz: float = 5000.0
    deesser_hi_hz: float = 9000.0
    deesser_threshold_db: float = 6.0
    deesser_max_reduction_db: float = 4.0

    # -------------------------------------------------------------- loudness
    target_lufs: float = -18.0
    limiter_ceiling_dbtp: float = -2.4  # MP3 encoding adds ~0.3 dB: lands <= -2 dBTP
    limiter_lookahead_ms: float = 5.0
    limiter_oversample: int = 4

    # ------------------------------------------------------------------- QA
    qa_model: str = "small"
    qa_compute_type: str = "float32"
    qa_beam_size: int = 5
    qa_wer_threshold: float = 0.25
    qa_exclude_words: Tuple[str, ...] = ("ho",)


RECIPE = Recipe()

# --------------------------------------------------------------------------
# Locale-dependent helpers
# --------------------------------------------------------------------------

def default_timbre(locale: str) -> Dict[str, float]:
    return RECIPE.timbre_fr if locale == "fr" else RECIPE.timbre_en


def default_prosody(locale: str) -> Dict[str, float]:
    return RECIPE.prosody_fr if locale == "fr" else RECIPE.prosody_en


def target_median_f0(locale: str) -> float:
    return RECIPE.target_median_f0_fr if locale == "fr" else RECIPE.target_median_f0_en


def base_speed(locale: str) -> float:
    return RECIPE.base_speed_fr if locale == "fr" else RECIPE.base_speed_en
