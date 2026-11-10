"""WORLD-vocoder based pitch, formant and ageing effects.

Techniques
----------
* F0 scaling and log-F0 range expansion around the median (jovial melody).
* Additive intonation contour on voiced frames (declination, final fall/rise).
* Formant warping by resampling the CheapTrick spectral envelope along
  frequency (bigger vocal tract).
* Ageing: jitter, tremolo, shimmer, breathiness, vocal fry and a slight
  slow-down implemented by resampling the frame sequence.

All random processes are seeded from the clip key so output is deterministic.
"""

from __future__ import annotations

import hashlib
import logging
from typing import List, Optional, Tuple

import numpy as np
import pyworld as pw
from scipy.ndimage import uniform_filter1d

from .plan import EmphasisSpan, PhrasePlan
from .recipe import RECIPE

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# WORLD analysis / synthesis
# ---------------------------------------------------------------------------


def analyse(audio: np.ndarray, sr: int, frame_period_ms: float = 5.0) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Run Harvest + CheapTrick + D4C on a mono float32 signal."""
    f0, t = pw.harvest(
        audio.astype(np.float64),
        sr,
        f0_floor=80.0,
        f0_ceil=400.0,
        frame_period=frame_period_ms,
    )
    f0 = pw.stonemask(audio.astype(np.float64), f0, t, sr)
    sp = pw.cheaptrick(audio.astype(np.float64), f0, t, sr)
    ap = pw.d4c(audio.astype(np.float64), f0, t, sr)
    return f0, sp, ap, t


def synthesise(f0: np.ndarray, sp: np.ndarray, ap: np.ndarray, sr: int) -> np.ndarray:
    y = pw.synthesize(f0, sp, ap, sr)
    return np.asarray(y, dtype=np.float32)


# ---------------------------------------------------------------------------
# Deterministic RNG
# ---------------------------------------------------------------------------


def seed_from_key(key: str) -> int:
    h = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return int(h[:16], 16) % (2**32)


def rng_for(key: str, tag: str = "") -> np.random.Generator:
    return np.random.default_rng(seed_from_key(key + "::" + tag))


# ---------------------------------------------------------------------------
# F0 helpers
# ---------------------------------------------------------------------------


def voiced_mask(f0: np.ndarray) -> np.ndarray:
    return f0 > 0.0


def median_f0(f0: np.ndarray) -> float:
    v = f0[voiced_mask(f0)]
    if v.size == 0:
        return 0.0
    return float(np.median(v))


def scale_f0_to_target(
    f0: np.ndarray,
    target_hz: float,
    clamp: Tuple[float, float] = RECIPE.f0_scale_clamp,
) -> Tuple[np.ndarray, float]:
    med = median_f0(f0)
    if med <= 0:
        return f0.copy(), 1.0
    scale = float(np.clip(target_hz / med, clamp[0], clamp[1]))
    out = f0.copy()
    out[voiced_mask(f0)] *= scale
    return out, scale


def expand_melody(f0: np.ndarray, factor: float) -> np.ndarray:
    """Multiply the log-F0 deviation from the median by *factor*."""
    mask = voiced_mask(f0)
    if not mask.any():
        return f0.copy()
    med = float(np.median(f0[mask]))
    out = f0.copy()
    log_dev = np.log(f0[mask] / med)
    out[mask] = med * np.exp(log_dev * factor)
    return out


# ---------------------------------------------------------------------------
# Intonation
# ---------------------------------------------------------------------------


def intonation_contour(
    f0: np.ndarray,
    kind: str,
    duration_ms: float,
    declination_pct: float = RECIPE.declination_pct,
) -> np.ndarray:
    """Apply a smooth multiplicative intonation contour to voiced frames."""
    n = len(f0)
    if n == 0:
        return f0.copy()
    out = f0.copy()
    mask = voiced_mask(f0)
    if not mask.any():
        return out

    t = np.linspace(0.0, 1.0, n)

    # Global declination
    contour = 1.0 + (declination_pct / 100.0) * t

    # Final contour in the last 300 ms (never longer than the phrase)
    frame_ms = duration_ms / max(n, 1)
    last_frames = min(n, max(1, int(300.0 / max(frame_ms, 1e-6))))
    final_t = np.linspace(0.0, 1.0, last_frames)
    if kind == "declarative":
        final = 1.0 + (RECIPE.final_fall_pct / 100.0) * final_t
    elif kind == "question":
        final = 1.0 + (RECIPE.final_rise_pct / 100.0) * final_t
    elif kind == "continuation":
        final = 1.0 + (RECIPE.continuation_rise_pct / 100.0) * final_t
    elif kind == "exclamation":
        # Rise to the peak over the first third, then fall below the start.
        peak_v = 1.0 + RECIPE.exclamation_peak_pct / 100.0
        end_v = 1.0 + RECIPE.exclamation_fall_pct / 100.0  # fall_pct is negative
        k = max(1, int(round(0.33 * last_frames)))
        final = np.concatenate([np.linspace(1.0, peak_v, k), np.linspace(peak_v, end_v, last_frames - k)])[:last_frames]
    elif kind == "ellipsis":
        final = 1.0 + (RECIPE.ellipsis_fall_pct / 100.0) * final_t
    else:
        final = np.ones(last_frames)

    # Place the final contour at the end
    contour[-len(final):] *= final
    out[mask] *= contour[mask]
    return out


# ---------------------------------------------------------------------------
# Emphasis
# ---------------------------------------------------------------------------


def apply_emphasis(
    f0: np.ndarray,
    sp: np.ndarray,
    spans: List[EmphasisSpan],
    f0_boost: float = RECIPE.emphasis_f0_boost,
    db_boost: float = RECIPE.emphasis_db_boost,
) -> Tuple[np.ndarray, np.ndarray]:
    """Boost F0 and spectral magnitude over approximate character spans."""
    if not spans:
        return f0, sp
    n = len(f0)
    out_f0 = f0.copy()
    out_sp = sp.copy()
    gain = 10.0 ** (db_boost / 10.0)  # sp is a power spectrum

    for span in spans:
        i0 = int(np.floor(span.start * n))
        i1 = int(np.ceil(span.end * n))
        i0 = max(0, min(i0, n - 1))
        i1 = max(i0 + 1, min(i1, n))
        mask = voiced_mask(out_f0[i0:i1])
        out_f0[i0:i1][mask] *= (1.0 + f0_boost)
        out_sp[i0:i1, :] *= gain
    return out_f0, out_sp


# ---------------------------------------------------------------------------
# Formant warping
# ---------------------------------------------------------------------------


def warp_formants(
    sp: np.ndarray,
    sr: int,
    warp: float = RECIPE.formant_warp,
    fade_start_hz: float = RECIPE.formant_fade_start_hz,
    fade_end_hz: float = RECIPE.formant_fade_end_hz,
) -> np.ndarray:
    """Warp the spectral envelope along frequency by *warp* below the fade."""
    n_frames, n_bins = sp.shape
    freqs = np.linspace(0.0, sr / 2.0, n_bins)

    # Warp factor as a function of frequency
    w = np.ones(n_bins)
    lo = freqs < fade_start_hz
    w[lo] = warp
    fade = (freqs >= fade_start_hz) & (freqs <= fade_end_hz)
    alpha = (freqs[fade] - fade_start_hz) / max(fade_end_hz - fade_start_hz, 1.0)
    w[fade] = warp + (1.0 - warp) * alpha
    # above fade_end stays 1.0

    warped_freqs = freqs * w
    out = np.empty_like(sp)
    for i in range(n_frames):
        out[i, :] = np.interp(freqs, warped_freqs, sp[i, :], left=sp[i, 0], right=sp[i, -1])
    return out


# ---------------------------------------------------------------------------
# Ageing
# ---------------------------------------------------------------------------


def _smooth_noise(rng: np.random.Generator, n: int, tau: float) -> np.ndarray:
    """One-pole smoothed noise with time constant *tau* frames."""
    raw = rng.standard_normal(n)
    alpha = 1.0 / max(tau, 1e-6)
    out = np.empty(n)
    acc = 0.0
    for i in range(n):
        acc += alpha * (raw[i] - acc)
        out[i] = acc
    # Normalise to roughly unit std
    std = out.std()
    if std > 1e-9:
        out /= std
    return out


def apply_ageing(
    f0: np.ndarray,
    sp: np.ndarray,
    ap: np.ndarray,
    sr: int,
    age: float,
    key: str,
    duration_ms: float,
    extra_stretch: float = 1.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Apply jitter, tremolo, shimmer, breathiness, vocal fry and slow-down."""
    if age <= 0.0:
        return f0, sp, ap

    rng = rng_for(key, "ageing")
    n = len(f0)

    # ---- F0 drop ---------------------------------------------------------
    out_f0 = f0.copy()
    mask = voiced_mask(out_f0)
    out_f0[mask] *= (1.0 - RECIPE.age_f0_drop * age)

    # ---- Jitter ----------------------------------------------------------
    jitter_noise = _smooth_noise(rng, n, RECIPE.jitter_tau_frames)
    out_f0[mask] *= (1.0 + RECIPE.jitter_pct * age * jitter_noise[mask])

    # ---- Tremolo ---------------------------------------------------------
    t = np.arange(n) / max(n, 1) * (duration_ms / 1000.0)
    trem = 1.0 + RECIPE.tremolo_pct * age * np.sin(2 * np.pi * RECIPE.tremolo_hz * t)
    out_f0[mask] *= trem[mask]

    # ---- Shimmer ---------------------------------------------------------
    shimmer_db = RECIPE.shimmer_db * age * _smooth_noise(rng, n, 2.0)
    shimmer_gain = 10.0 ** (shimmer_db / 10.0)  # power spectrum
    out_sp = sp * shimmer_gain[:, None]

    # ---- Breathiness -----------------------------------------------------
    freqs = np.linspace(0.0, sr / 2.0, sp.shape[1])
    r_freq = RECIPE.breath_r_base * age * np.clip(
        (freqs - RECIPE.breath_f_lo) / (RECIPE.breath_f_hi - RECIPE.breath_f_lo),
        0.0,
        1.0,
    )
    r_frame = np.ones((n, 1))
    out_ap = 1.0 - (1.0 - ap) * (1.0 - r_freq[None, :] * r_frame)

    # ---- Vocal fry -------------------------------------------------------
    frame_ms = duration_ms / max(n, 1)
    fry_frames = int(RECIPE.fry_last_ms / max(frame_ms, 1e-6))
    min_run = int(RECIPE.fry_min_run_ms / max(frame_ms, 1e-6))
    # Find voiced runs
    runs: List[Tuple[int, int]] = []
    start: Optional[int] = None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, n))

    for s, e in runs:
        if e - s < min_run:
            continue
        f0_start = max(s, e - fry_frames)
        ramp = np.linspace(0.0, 1.0, e - f0_start)
        drop = 1.0 - RECIPE.fry_f0_drop * age * (ramp ** 0.7)
        out_f0[f0_start:e][mask[f0_start:e]] *= drop
        # Increase aperiodicity below 1.5 kHz
        below = freqs < RECIPE.fry_below_hz
        out_ap[f0_start:e, below] = np.clip(
            out_ap[f0_start:e, below] + RECIPE.fry_r_boost * age,
            0.0,
            1.0,
        )

    # ---- Slow-down (resample frame sequence) ----------------------------
    factor = (1.0 + RECIPE.slowdown_per_age * age) * extra_stretch
    new_n = max(1, int(round(n * factor)))
    idx = np.linspace(0, n - 1, new_n)

    # f0: nearest neighbour to preserve voiced/unvoiced boundaries
    new_f0 = out_f0[np.round(idx).astype(int)]

    # sp / ap: linear interpolation along time
    new_sp = np.empty((new_n, sp.shape[1]), dtype=sp.dtype)
    new_ap = np.empty((new_n, ap.shape[1]), dtype=ap.dtype)
    for j in range(sp.shape[1]):
        new_sp[:, j] = np.interp(idx, np.arange(n), out_sp[:, j])
        new_ap[:, j] = np.interp(idx, np.arange(n), out_ap[:, j])

    return new_f0, new_sp, new_ap


# ---------------------------------------------------------------------------
# Per-phrase processing
# ---------------------------------------------------------------------------


def process_phrase(
    audio: np.ndarray,
    sr: int,
    phrase: PhrasePlan,
    locale: str,
    clip_key: str,
    age: float,
    target_hz: float,
    pitch_factor: float = 1.0,
    extra_breath: float = 0.0,
    stretch: float = 1.0,
) -> np.ndarray:
    """Full WORLD pipeline for one phrase (one analysis, one resynthesis)."""
    f0, sp, ap, t = analyse(audio, sr)
    if len(f0) == 0:
        return audio

    duration_ms = 1000.0 * len(audio) / sr

    # 1. Target pitch level
    f0, _ = scale_f0_to_target(f0, target_hz, RECIPE.f0_scale_clamp)
    if pitch_factor != 1.0:
        f0 = f0 * pitch_factor
    if extra_breath > 0.0:
        freqs = np.linspace(0.0, sr / 2.0, sp.shape[1])
        r = extra_breath * np.clip((freqs - 500.0) / 2500.0, 0.0, 1.0)
        ap = 1.0 - (1.0 - ap) * (1.0 - r[None, :])

    # 2. Melody expansion
    factor = RECIPE.melody_expansion_exclamation if phrase.kind == "exclamation" else RECIPE.melody_expansion
    f0 = expand_melody(f0, factor)

    # 3. Intonation
    f0 = intonation_contour(f0, phrase.kind, duration_ms)

    # 4. Emphasis
    f0, sp = apply_emphasis(f0, sp, phrase.emphasis_spans)

    # 5. Formant warp
    sp = warp_formants(sp, sr)

    # 6. Ageing
    f0, sp, ap = apply_ageing(
        f0, sp, ap, sr, age, clip_key + "::" + phrase.text, duration_ms, extra_stretch=stretch
    )

    # 7. Synthesise
    return synthesise(f0, sp, ap, sr)
