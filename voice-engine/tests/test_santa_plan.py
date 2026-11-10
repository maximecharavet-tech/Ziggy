"""Unit tests for the pure planning stage and selected DSP invariants."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import numpy as np
import pytest

from santa_voice_v2 import io, plan
from santa_voice_v2.colour import limiter, true_peak_db
from santa_voice_v2.recipe import RECIPE
from santa_voice_v2.world_fx import rng_for, seed_from_key


# ---------------------------------------------------------------------------
# Typography
# ---------------------------------------------------------------------------


def test_french_typography_normalisation():
    raw = "Ho\u00a0ho\u00a0ho\u00a0! Allô\u202f? Ici\u00a0le Père Noël…"
    out = plan.normalise_text(raw)
    assert "\u00a0" not in out
    assert "\u202f" not in out
    assert "…" not in out
    assert "Ho ho ho ! Allô ? Ici le Père Noël..." == out


def test_apostrophe_normalisation():
    assert plan.normalise_text("l’atelier") == "l'atelier"


# ---------------------------------------------------------------------------
# Ho ho ho
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Ho ho ho ! Allô ?",
        "ho ho ho, joyeux Noël",
        "Oh oh oh ! C'est moi",
        "HO HO HO!",
    ],
)
def test_detect_hohoho(text):
    result = plan.detect_hohoho(text)
    assert result is not None
    _, rest = result
    assert rest == "" or isinstance(rest, str)


def test_hohoho_plan_has_special_phrase():
    cp = plan.plan_clip("Ho ho ho ! Allô ?", "fr")
    assert cp.phrases[0].is_hohoho is True
    assert cp.phrases[0].kind == "exclamation"
    assert len(cp.phrases) >= 2


# ---------------------------------------------------------------------------
# Punctuation -> pauses / kinds
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "unit,kind,pause",
    [
        ("Bonjour.", "declarative", RECIPE.pause_period_ms),
        ("Quelle belle surprise !", "exclamation", RECIPE.pause_exclamation_ms),
        ("Tu viens ?", "question", RECIPE.pause_question_ms),
        ("Attends...", "ellipsis", RECIPE.pause_ellipsis_ms),
        ("Écoute :", "continuation", RECIPE.pause_colon_ms),
        ("Un vélo,", "continuation", RECIPE.pause_comma_ms),
    ],
)
def test_classify_and_pause(unit, kind, pause):
    assert plan.classify_kind(unit) == kind
    assert plan.pause_for_kind(kind, unit) == pause


def test_last_phrase_speed_and_pause():
    cp = plan.plan_clip("Bonjour. Comment vas-tu ?", "fr")
    assert cp.phrases[-1].pause_after_ms == 0
    assert cp.phrases[-1].speed < cp.phrases[0].speed


# ---------------------------------------------------------------------------
# Emphasis
# ---------------------------------------------------------------------------


def test_emphasis_star_stripped():
    cleaned, spans = plan.extract_emphasis("Un *vélo* rouge !")
    assert "*" not in cleaned
    assert "vélo" in cleaned
    assert len(spans) == 1


def test_emphasis_all_caps_detected():
    cleaned, spans = plan.extract_emphasis("Un VÉLO rouge")
    assert cleaned == "Un VÉLO rouge"
    assert len(spans) == 1


# ---------------------------------------------------------------------------
# Deterministic ageing noise
# ---------------------------------------------------------------------------


def test_ageing_noise_deterministic():
    key = "line:open.hohoho"
    a = rng_for(key, "ageing").standard_normal(100)
    b = rng_for(key, "ageing").standard_normal(100)
    np.testing.assert_array_equal(a, b)


def test_seed_from_key_stable():
    assert seed_from_key("abc") == seed_from_key("abc")


# ---------------------------------------------------------------------------
# Limiter true peak
# ---------------------------------------------------------------------------


def test_limiter_true_peak_below_ceiling():
    sr = 24000
    rng = np.random.default_rng(0)
    # Loud signal that would clip without limiting
    x = (rng.standard_normal(sr) * 2.0).astype(np.float32)
    y = limiter(x, sr, ceiling_dbtp=-2.0)
    tp = true_peak_db(y, sr)
    assert tp <= -2.0 + 0.1, f"true peak {tp:.2f} dBTP exceeds −2 dBTP"


# ---------------------------------------------------------------------------
# Manifest resumability
# ---------------------------------------------------------------------------


def test_manifest_roundtrip_and_sorted(tmp_path: Path):
    m = io.empty_manifest()
    m["fr"]["z:key"] = "bbb"
    m["fr"]["a:key"] = "aaa"
    p = tmp_path / "voice-manifest.json"
    io.save_manifest_atomic(m, p)
    text = p.read_text(encoding="utf-8")
    assert text.endswith("\n")
    loaded = json.loads(text)
    assert list(loaded["fr"].keys()) == ["a:key", "z:key"]


def test_is_already_done(tmp_path: Path):
    mp3 = tmp_path / "x.mp3"
    mp3.write_bytes(b"fake")
    m = io.empty_manifest()
    m["fr"]["k"] = "h"
    assert io.is_already_done(m, "fr", "k", "h", mp3)
    assert not io.is_already_done(m, "fr", "k", "other", mp3)
    assert not io.is_already_done(m, "fr", "k", "h", mp3, force=True)


def test_ho_hors_is_not_a_laugh():
    assert not plan._HOHOHO_RE.match("Ho hors de question !")
    assert plan._HOHOHO_RE.match("Ho ho ho ! Allô ?")
    assert plan._HOHOHO_RE.match("Hohoho !")


def test_limiter_holds_ceiling_on_hot_signal():
    sr = 24000
    t = np.arange(sr) / sr
    x = (1.6 * np.sin(2 * np.pi * 997 * t)).astype(np.float32)
    y = limiter(x, sr)
    assert true_peak_db(y, sr) <= RECIPE.limiter_ceiling_dbtp + 0.01


def test_deesser_is_transparent_on_quiet_signal():
    from santa_voice_v2.colour import de_esser
    sr = 24000
    t = np.arange(sr) / sr
    x = (0.01 * np.sin(2 * np.pi * 200 * t)).astype(np.float32)
    y = de_esser(x, sr)
    assert np.allclose(np.sqrt(np.mean(y ** 2)), np.sqrt(np.mean(x ** 2)), rtol=0.02)


def test_ageing_slows_down():
    from santa_voice_v2.world_fx import apply_ageing
    n, bins = 200, 513
    f0 = np.full(n, 110.0)
    sp = np.full((n, bins), 1e-3)
    ap = np.full((n, bins), 0.1)
    nf0, nsp, nap = apply_ageing(f0, sp, ap, 24000, 1.0, "k", 1000.0)
    assert len(nf0) > n and nsp.shape[0] == len(nf0) == nap.shape[0]


def test_exclamation_contour_rises_then_falls():
    from santa_voice_v2.world_fx import intonation_contour
    f0 = np.full(400, 100.0)
    out = intonation_contour(f0, "exclamation", 2000.0)
    tail = out[-60:]
    # rise of ~+10 % then fall below where the final contour started
    assert tail.max() / tail[0] > 1.08 and out[-1] < tail[0]


def test_contour_on_very_short_phrase_keeps_length():
    from santa_voice_v2.world_fx import intonation_contour
    for kind in ("declarative", "question", "exclamation", "continuation", "ellipsis"):
        f0 = np.full(10, 100.0)
        assert len(intonation_contour(f0, kind, 50.0)) == 10
