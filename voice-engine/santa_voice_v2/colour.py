"""Mastering chain: EQ, parallel saturation, de-essing, loudness and limiter.

All filters are RBJ biquads evaluated at 24 kHz with ``scipy.signal.sosfilt``.
The limiter oversamples 4× to enforce a true-peak ceiling.
"""

from __future__ import annotations

import logging
from typing import Tuple

import numpy as np
import pyloudnorm as pyln
from scipy import signal

from .recipe import RECIPE

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# RBJ biquad coefficients
# ---------------------------------------------------------------------------


def _peaking_eq(f0: float, q: float, gain_db: float, sr: int) -> np.ndarray:
    A = 10.0 ** (gain_db / 40.0)
    w0 = 2.0 * np.pi * f0 / sr
    alpha = np.sin(w0) / (2.0 * q)
    b0 = 1.0 + alpha * A
    b1 = -2.0 * np.cos(w0)
    b2 = 1.0 - alpha * A
    a0 = 1.0 + alpha / A
    a1 = -2.0 * np.cos(w0)
    a2 = 1.0 - alpha / A
    return np.array([b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0])


def _low_shelf(f0: float, gain_db: float, sr: int, q: float = 0.707) -> np.ndarray:
    A = 10.0 ** (gain_db / 40.0)
    w0 = 2.0 * np.pi * f0 / sr
    alpha = np.sin(w0) / (2.0 * q)
    cosw = np.cos(w0)
    b0 = A * ((A + 1) - (A - 1) * cosw + 2 * np.sqrt(A) * alpha)
    b1 = 2 * A * ((A - 1) - (A + 1) * cosw)
    b2 = A * ((A + 1) - (A - 1) * cosw - 2 * np.sqrt(A) * alpha)
    a0 = (A + 1) + (A - 1) * cosw + 2 * np.sqrt(A) * alpha
    a1 = -2 * ((A - 1) + (A + 1) * cosw)
    a2 = (A + 1) + (A - 1) * cosw - 2 * np.sqrt(A) * alpha
    return np.array([b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0])


def _high_shelf(f0: float, gain_db: float, sr: int, q: float = 0.707) -> np.ndarray:
    A = 10.0 ** (gain_db / 40.0)
    w0 = 2.0 * np.pi * f0 / sr
    alpha = np.sin(w0) / (2.0 * q)
    cosw = np.cos(w0)
    b0 = A * ((A + 1) + (A - 1) * cosw + 2 * np.sqrt(A) * alpha)
    b1 = -2 * A * ((A - 1) + (A + 1) * cosw)
    b2 = A * ((A + 1) + (A - 1) * cosw - 2 * np.sqrt(A) * alpha)
    a0 = (A + 1) - (A - 1) * cosw + 2 * np.sqrt(A) * alpha
    a1 = 2 * ((A - 1) - (A + 1) * cosw)
    a2 = (A + 1) - (A - 1) * cosw - 2 * np.sqrt(A) * alpha
    return np.array([b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0])


def _apply_biquad(audio: np.ndarray, coeffs: np.ndarray) -> np.ndarray:
    b = coeffs[:3]
    a = coeffs[3:]
    return signal.lfilter(b, a, audio)


# ---------------------------------------------------------------------------
# EQ
# ---------------------------------------------------------------------------


def apply_eq(audio: np.ndarray, sr: int) -> np.ndarray:
    """Warm Santa colour: low-mid lift, presence cut, air roll-off."""
    out = audio.astype(np.float64).copy()
    out = _apply_biquad(out, _peaking_eq(RECIPE.eq_bell1_hz, RECIPE.eq_bell1_q, RECIPE.eq_bell1_gain_db, sr))
    out = _apply_biquad(out, _low_shelf(RECIPE.eq_lowshelf_hz, RECIPE.eq_lowshelf_gain_db, sr))
    out = _apply_biquad(out, _peaking_eq(RECIPE.eq_bell2_hz, RECIPE.eq_bell2_q, RECIPE.eq_bell2_gain_db, sr))
    out = _apply_biquad(out, _high_shelf(RECIPE.eq_highshelf_hz, RECIPE.eq_highshelf_gain_db, sr))
    return out.astype(np.float32)


# ---------------------------------------------------------------------------
# Parallel saturation
# ---------------------------------------------------------------------------


def parallel_saturation(
    audio: np.ndarray,
    drive: float = RECIPE.saturation_drive,
    mix: float = RECIPE.saturation_mix,
) -> np.ndarray:
    """25 % wet tanh saturation, normalised so unity drive is transparent."""
    x = audio.astype(np.float64)
    wet = np.tanh(drive * x) / np.tanh(drive)
    out = (1.0 - mix) * x + mix * wet
    return out.astype(np.float32)


# ---------------------------------------------------------------------------
# De-esser
# ---------------------------------------------------------------------------


def de_esser(
    audio: np.ndarray,
    sr: int,
    lo_hz: float = RECIPE.deesser_lo_hz,
    hi_hz: float = RECIPE.deesser_hi_hz,
    threshold_db: float = RECIPE.deesser_threshold_db,
    max_reduction_db: float = RECIPE.deesser_max_reduction_db,
) -> np.ndarray:
    """Gentle dynamic cut of the 5–9 kHz band when it dominates."""
    sos = signal.butter(4, [lo_hz, hi_hz], btype="bandpass", fs=sr, output="sos")
    band = signal.sosfilt(sos, audio)
    # Envelope of the band
    env = np.abs(signal.hilbert(band))
    env = signal.sosfilt(signal.butter(2, 50.0, btype="lowpass", fs=sr, output="sos"), env)
    rms = np.sqrt(np.mean(band ** 2))
    if rms < 1e-9:
        return audio
    threshold = rms * (10.0 ** (threshold_db / 20.0))
    gain_reduction = np.ones_like(env)  # unity where the band is below threshold
    over = env > threshold
    if over.any():
        ratio = (env[over] / threshold)
        reduction_db = np.minimum(max_reduction_db, 20.0 * np.log10(ratio))
        gain_reduction[over] = 10.0 ** (-reduction_db / 20.0)
    # Smooth gain
    gain = signal.sosfilt(signal.butter(2, 30.0, btype="lowpass", fs=sr, output="sos"), gain_reduction)
    gain = np.clip(gain, 10.0 ** (-max_reduction_db / 20.0), 1.0)
    # Apply reduction only to the band
    out = audio - band + band * gain
    return out.astype(np.float32)


# ---------------------------------------------------------------------------
# Loudness
# ---------------------------------------------------------------------------


def loudness_normalise(audio: np.ndarray, sr: int, target_lufs: float = RECIPE.target_lufs) -> np.ndarray:
    meter = pyln.Meter(sr)
    loudness = meter.integrated_loudness(audio.astype(np.float64))
    if not np.isfinite(loudness):
        return audio
    gain_db = target_lufs - loudness
    gain = 10.0 ** (gain_db / 20.0)
    return (audio * gain).astype(np.float32)


# ---------------------------------------------------------------------------
# True-peak limiter
# ---------------------------------------------------------------------------


def true_peak_db(audio: np.ndarray, sr: int, oversample: int = RECIPE.limiter_oversample) -> float:
    up = signal.resample_poly(audio, oversample, 1)
    peak = float(np.max(np.abs(up))) if up.size else 0.0
    return 20.0 * np.log10(max(peak, 1e-12))


def limiter(
    audio: np.ndarray,
    sr: int,
    ceiling_dbtp: float = RECIPE.limiter_ceiling_dbtp,
    lookahead_ms: float = RECIPE.limiter_lookahead_ms,
    oversample: int = RECIPE.limiter_oversample,
) -> np.ndarray:
    """Look-ahead peak limiter with a guaranteed true-peak ceiling.

    The gain each sample needs (ceiling / |x| on the 4x oversampled signal) is
    spread over the look-ahead window with a running minimum, smoothed, and a
    final safety scale makes sure the ceiling holds.
    """
    from scipy.ndimage import minimum_filter1d

    ceiling = 10.0 ** (ceiling_dbtp / 20.0)
    out = audio.astype(np.float64).copy()
    if out.size == 0:
        return out.astype(np.float32)
    up = signal.resample_poly(out, oversample, 1)
    need = np.minimum(1.0, ceiling / np.maximum(np.abs(up), 1e-12))
    # back to the base rate: the strictest need among each sample's oversampled points
    need = need[: (len(need) // oversample) * oversample].reshape(-1, oversample).min(axis=1)
    if len(need) < len(out):
        need = np.concatenate([need, np.ones(len(out) - len(need))])
    win = max(1, int(sr * lookahead_ms / 1000.0))
    gain = minimum_filter1d(need, size=2 * win + 1, mode="nearest")
    # smooth (moving average keeps it <= the running minimum's neighbourhood)
    k = np.ones(win) / win
    gain = np.minimum(gain, np.convolve(gain, k, mode="same"))
    out *= gain
    for _ in range(3):  # safety: inter-sample peaks after gain changes
        tp = true_peak_db(out, sr, oversample)
        if tp <= ceiling_dbtp:
            break
        out *= 10.0 ** ((ceiling_dbtp - tp - 0.05) / 20.0)
    return out.astype(np.float32)


# ---------------------------------------------------------------------------
# Full chain
# ---------------------------------------------------------------------------


def master(audio: np.ndarray, sr: int) -> np.ndarray:
    out = apply_eq(audio, sr)
    out = parallel_saturation(out)
    out = de_esser(out, sr)
    out = loudness_normalise(out, sr)
    out = limiter(out, sr)
    return out
