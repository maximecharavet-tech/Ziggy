"""Kokoro synthesis with separate timbre / prosody style blending.

The 256-dim Kokoro style vector is split: ``[..., :128]`` drives the decoder
(timbre) and ``[..., 128:]`` the prosody predictor.  We therefore blend the two
halves independently, which allows a French female voice to contribute prosody
while the timbre is male.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Dict, Iterable, Tuple

import numpy as np

from .recipe import RECIPE

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Voice blend parsing
# ---------------------------------------------------------------------------


def parse_blend(spec: str) -> Dict[str, float]:
    """Parse ``"am_santa:0.35+em_santa:0.15+ff_siwis:0.5"``."""
    out: Dict[str, float] = {}
    for part in spec.split("+"):
        part = part.strip()
        if not part:
            continue
        name, _, weight_s = part.partition(":")
        w = float(weight_s) if weight_s else 1.0
        out[name.strip()] = out.get(name.strip(), 0.0) + w
    # Normalise
    total = sum(out.values())
    if total <= 0:
        raise ValueError(f"Blend weights sum to zero: {spec!r}")
    return {k: v / total for k, v in out.items()}


# ---------------------------------------------------------------------------
# Style row selection and blending
# ---------------------------------------------------------------------------


def blend_voice(
    kokoro,
    timbre_weights: Dict[str, float],
    prosody_weights: Dict[str, float],
) -> np.ndarray:
    """Return a full (510, 1, 256) blended voice table.

    kokoro-onnx picks the style row from the *phoneme* count itself
    (``voice[min(n, 510) - 1]``), so the whole table is blended once: the first
    128 dims (decoder, timbre) from ``timbre_weights``, the last 128 (prosody
    predictor) from ``prosody_weights``.
    """
    first = kokoro.get_voice_style(next(iter(timbre_weights)))
    out = np.zeros_like(first, dtype=np.float32)
    for name, weight in timbre_weights.items():
        out[..., :128] += weight * kokoro.get_voice_style(name)[..., :128]
    for name, weight in prosody_weights.items():
        out[..., 128:] += weight * kokoro.get_voice_style(name)[..., 128:]
    return out


# ---------------------------------------------------------------------------
# Kokoro wrapper
# ---------------------------------------------------------------------------


_LANG_FLAG_RE = re.compile(r"\([a-z]{2,3}(?:-[a-z0-9]+)?\)")


# French respellings for names espeak would read as English.
_FR_RESPELL = {"Ziggy": "Zigui"}


class KokoroSynth:
    """Thin wrapper around ``kokoro_onnx.Kokoro`` with thread limiting."""

    def __init__(self, model_path: str, voices_path: str):
        # One session per worker, 2 intra-op threads as requested.
        os.environ.setdefault("OMP_NUM_THREADS", "2")
        os.environ.setdefault("ORT_INTRA_OP_NUM_THREADS", "2")

        import onnxruntime as rt
        from kokoro_onnx import Kokoro  # imported here so tests need no model

        opts = rt.SessionOptions()
        opts.intra_op_num_threads = int(os.environ.get("SANTA_ORT_THREADS", "2"))
        opts.inter_op_num_threads = 1
        sess = rt.InferenceSession(model_path, sess_options=opts, providers=["CPUExecutionProvider"])
        self.kokoro = Kokoro.from_session(sess, voices_path)

    def synthesize(
        self,
        text: str,
        style: np.ndarray,
        speed: float,
        lang: str,
    ) -> Tuple[np.ndarray, int]:
        # espeak marks language switches as "(en)…(fr)"; those letters would be
        # read as phonemes ("Ziggy" -> "Hénzé Gifle"), so drop them.
        if lang.startswith("fr"):
            for word, respelt in _FR_RESPELL.items():
                text = re.sub(rf"\b{word}\b", respelt, text)
        phonemes = self.kokoro.tokenizer.phonemize(text, lang)
        phonemes = _LANG_FLAG_RE.sub("", phonemes)
        return self.synthesize_phonemes(phonemes, style, speed)

    def synthesize_phonemes(self, phonemes: str, style: np.ndarray, speed: float) -> Tuple[np.ndarray, int]:
        audio, sr = self.kokoro.create(
            phonemes,
            voice=style,
            speed=speed,
            is_phonemes=True,
            trim=True,
        )
        return np.asarray(audio, dtype=np.float32), int(sr)
