"""Optional QA: faster-whisper WER and median F0 per clip."""

from __future__ import annotations

import logging
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pyworld as pw

from .recipe import RECIPE

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Word normalisation
# ---------------------------------------------------------------------------


def normalise_words(text: str) -> List[str]:
    text = text.lower()
    # Strip accents
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    # Remove punctuation
    text = re.sub(r"[^\w\s]", " ", text)
    words = [w for w in text.split() if w]
    # Remove excluded words (e.g. "ho")
    words = [w for w in words if w not in RECIPE.qa_exclude_words]
    return words


def word_error_rate(reference: str, hypothesis: str) -> float:
    ref = normalise_words(reference)
    hyp = normalise_words(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    # Levenshtein distance at word level
    d = np.zeros((len(ref) + 1, len(hyp) + 1), dtype=np.int32)
    d[:, 0] = np.arange(len(ref) + 1)
    d[0, :] = np.arange(len(hyp) + 1)
    for i in range(1, len(ref) + 1):
        for j in range(1, len(hyp) + 1):
            cost = 0 if ref[i - 1] == hyp[j - 1] else 1
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + cost)
    return float(d[len(ref), len(hyp)]) / len(ref)


# ---------------------------------------------------------------------------
# Median F0
# ---------------------------------------------------------------------------


def clip_median_f0(audio: np.ndarray, sr: int) -> float:
    f0, _ = pw.harvest(audio.astype(np.float64), sr, f0_floor=80.0, f0_ceil=400.0, frame_period=5.0)
    v = f0[f0 > 0]
    return float(np.median(v)) if v.size else 0.0


# ---------------------------------------------------------------------------
# Whisper transcription
# ---------------------------------------------------------------------------


class WhisperQA:
    def __init__(self, model_name: str = RECIPE.qa_model, compute_type: str = RECIPE.qa_compute_type):
        from faster_whisper import WhisperModel

        self.model = WhisperModel(model_name, device="cpu", compute_type=compute_type)

    def transcribe(self, audio: np.ndarray, sr: int, language: str) -> str:
        # faster-whisper expects float32 mono at 16 kHz; resample simply
        if sr != 16000:
            import scipy.signal as signal

            audio16 = signal.resample_poly(audio, 16000, sr).astype(np.float32)
        else:
            audio16 = audio.astype(np.float32)
        segments, _ = self.model.transcribe(
            audio16,
            language=language,
            beam_size=RECIPE.qa_beam_size,
            vad_filter=False,
        )
        return " ".join(seg.text.strip() for seg in segments).strip()
