#!/usr/bin/env python3
"""santa-v2 CLI: regenerate all Santa voice clips offline on CPU.

Example
-------
python voice-engine/santa_voice_v2.py \
    --clips /tmp/santa-clips.json \
    --models ~/.cache/kokoro \
    --jobs 4 \
    --age 0.7
"""

from __future__ import annotations

import argparse
import json
import logging
import multiprocessing as mp
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from santa_voice_v2 import colour, io, plan, qa, synth, world_fx
from santa_voice_v2.recipe import RECIPE, target_median_f0

log = logging.getLogger("santa_voice_v2")

# ---------------------------------------------------------------------------
# Globals for worker processes
# ---------------------------------------------------------------------------

_WORKER: Optional["_Worker"] = None


class _Worker:
    def __init__(self, model_path: str, voices_path: str, age: float, timbre: Dict[str, float], prosody: Dict[str, float]):
        self.synth = synth.KokoroSynth(model_path, voices_path)
        self.age = age
        # One full (510, 1, 256) table per worker: kokoro-onnx picks the row.
        self.voice = synth.blend_voice(self.synth.kokoro, timbre, prosody)

    def process(self, clip: Dict[str, Any]) -> Dict[str, Any]:
        locale = clip["locale"]
        key = clip["key"]
        text = clip["text"]
        target = target_median_f0(locale)

        clip_plan = plan.plan_clip(text, locale, key)

        pieces: List[np.ndarray] = []
        sr = 24000

        for phrase in clip_plan.phrases:
            if phrase.is_hohoho:
                pieces.append(self._render_hohoho(phrase, locale, key, target))
            else:
                k_speed = max(phrase.speed, RECIPE.kokoro_min_speed)
                audio, sr = self.synth.synthesize(phrase.text, self.voice, k_speed, lang=_lang(locale))
                if phrase.breath_before:
                    pieces.append(_inhale(sr))
                processed = world_fx.process_phrase(
                    audio, sr, phrase, locale, key, self.age, target, stretch=k_speed / phrase.speed
                )
                pieces.append(processed)

            if phrase.pause_after_ms > 0:
                pieces.append(np.zeros(int(sr * phrase.pause_after_ms / 1000.0), dtype=np.float32))

        audio = _assemble(pieces, sr)
        audio = colour.master(audio, sr)
        return {"locale": locale, "key": key, "file": clip.get("file"), "hash": clip["hash"], "audio": audio, "sr": sr}

    def _render_hohoho(self, phrase: plan.PhrasePlan, locale: str, key: str, target: float) -> np.ndarray:
        """Render Ho ! x3: same old-man WORLD chain (target pitch, formants,
        ageing) in ONE analysis/resynthesis per syllable, decreasing pitch,
        extra breath and a belly envelope."""
        sr = 24000
        k_speed = max(RECIPE.exclamation_speed, RECIPE.kokoro_min_speed)
        base, sr = self.synth.synthesize_phonemes(RECIPE.hohoho_phonemes_fr if locale == "fr" else RECIPE.hohoho_phonemes_en, self.voice, k_speed)
        pieces: List[np.ndarray] = []
        for i, pitch in enumerate(RECIPE.hohoho_pitches):
            audio = world_fx.process_phrase(
                base, sr, phrase, locale, f"{key}#ho{i}", self.age, target,
                pitch_factor=pitch, extra_breath=RECIPE.hohoho_breath_boost,
            )
            # Belly envelope: short attack, exponential decay
            n = len(audio)
            env = np.ones(n, dtype=np.float32)
            attack = max(1, min(int(sr * RECIPE.hohoho_attack_ms / 1000.0), n))
            env[:attack] = np.linspace(0.0, 1.0, attack)
            decay = np.exp(-np.arange(n - attack) / (sr * RECIPE.hohoho_decay_tau_ms / 1000.0))
            env[attack:] = decay.astype(np.float32)
            pieces.append(_fade(audio * env, sr))
            if i < len(RECIPE.hohoho_pitches) - 1:
                pieces.append(np.zeros(int(sr * RECIPE.hohoho_gap_ms / 1000.0), dtype=np.float32))
        return np.concatenate(pieces).astype(np.float32)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _lang(locale: str) -> str:
    return "fr-fr" if locale == "fr" else "en-us"


def _inhale(sr: int) -> np.ndarray:
    """120 ms pink-ish noise band-passed 500–3000 Hz at −42 dBFS."""
    n = int(sr * RECIPE.breath_gap_ms / 1000.0)
    rng = np.random.default_rng(12345)
    noise = rng.standard_normal(n).astype(np.float32)
    from scipy import signal

    sos = signal.butter(4, [RECIPE.breath_noise_lo_hz, RECIPE.breath_noise_hi_hz], btype="bandpass", fs=sr, output="sos")
    noise = signal.sosfilt(sos, noise)
    # Raised-cosine envelope
    env = np.ones(n, dtype=np.float32)
    ramp = min(n // 4, int(sr * 0.02))
    env[:ramp] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, ramp))
    env[-ramp:] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, ramp))
    noise *= env
    # Scale to −42 dBFS RMS (approximately)
    rms = np.sqrt(np.mean(noise ** 2))
    if rms > 1e-12:
        target = 10.0 ** (RECIPE.breath_noise_dbfs / 20.0)
        noise *= target / rms
    return noise.astype(np.float32)


def _fade(x: np.ndarray, sr: int, ms: float = RECIPE.join_fade_ms) -> np.ndarray:
    n = max(1, int(sr * ms / 1000.0))
    n = min(n, len(x) // 2 if len(x) > 1 else 1)
    if n <= 0:
        return x
    y = x.copy()
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
    y[:n] *= ramp
    y[-n:] *= ramp[::-1]
    return y


def _assemble(pieces: List[np.ndarray], sr: int) -> np.ndarray:
    if not pieces:
        return np.zeros(int(sr * (RECIPE.lead_silence_ms + RECIPE.tail_silence_ms) / 1000.0), dtype=np.float32)
    out: List[np.ndarray] = [np.zeros(int(sr * RECIPE.lead_silence_ms / 1000.0), dtype=np.float32)]
    for i, p in enumerate(pieces):
        if p.size == 0:
            continue
        out.append(_fade(p, sr))
    out.append(np.zeros(int(sr * RECIPE.tail_silence_ms / 1000.0), dtype=np.float32))
    return np.concatenate(out).astype(np.float32)


# ---------------------------------------------------------------------------
# Worker initialisation
# ---------------------------------------------------------------------------


def _worker_init(model_path: str, voices_path: str, age: float, timbre: Dict[str, float], prosody: Dict[str, float]) -> None:
    global _WORKER
    _WORKER = _Worker(model_path, voices_path, age, timbre, prosody)


def _worker_run(clip: Dict[str, Any]) -> Dict[str, Any]:
    assert _WORKER is not None
    try:
        return _WORKER.process(clip)
    except Exception as e:  # one bad clip must not kill the whole run
        logging.getLogger("santa_voice_v2").exception("synthesis failed %s/%s", clip.get("locale"), clip.get("key"))
        return {"locale": clip.get("locale"), "key": clip.get("key"), "error": repr(e)}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Regenerate santa-v2 voice clips offline.")
    p.add_argument("--clips", required=True)
    p.add_argument("--models", required=True)
    p.add_argument("--out", default="public/santa/voice")
    p.add_argument("--manifest", default="src/data/santa/voice-manifest.json")
    p.add_argument("--locale", default="fr,en")
    p.add_argument("--only", default="")
    p.add_argument("--force", action="store_true")
    p.add_argument("--jobs", type=int, default=4)
    p.add_argument("--age", type=float, default=0.7)
    p.add_argument("--timbre", default="")
    p.add_argument("--prosody", default="")
    p.add_argument("--ab", default="", help="A/B output directory")
    p.add_argument("--ab-variant", default="v2", help="Variant subdirectory name for --ab")
    p.add_argument("--mp3-q", type=int, default=5, help="LAME VBR quality (5 phrases, 6 first names)")
    p.add_argument("--qa", action="store_true")
    p.add_argument("--qa-dir", default="/tmp/santa-voice-qa", help="where report.json goes without --ab")
    p.add_argument("--log-level", default="INFO")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=getattr(logging, args.log_level.upper(), logging.INFO), format="%(levelname)s %(message)s")

    clips = io.load_clips(args.clips)
    locales = [l.strip() for l in args.locale.split(",") if l.strip()]
    only = {k.strip() for k in args.only.split(",") if k.strip()} if args.only else None

    clips = [c for c in clips if c["locale"] in locales and (not only or c["key"] in only)]
    if not clips:
        log.error("No clips selected")
        return 1

    manifest = io.load_manifest(args.manifest) if not args.ab else None
    if manifest is not None and manifest.get("voice") != io.VOICE_ID:
        # New voice: start a fresh manifest so an interrupted run never mixes
        # old-voice hashes with new-voice files (resumable from here on).
        log.info("voice %s -> %s: regenerating everything", manifest.get("voice"), io.VOICE_ID)
        manifest = io.empty_manifest()

    # Resolve style overrides
    timbre_override = args.timbre or None
    prosody_override = args.prosody or None

    # Build per-locale weights
    timbre_by_locale: Dict[str, Dict[str, float]] = {}
    prosody_by_locale: Dict[str, Dict[str, float]] = {}
    for loc in ("fr", "en"):
        timbre_by_locale[loc] = (
            synth.parse_blend(timbre_override)
            if timbre_override
            else (RECIPE.timbre_fr if loc == "fr" else RECIPE.timbre_en)
        )
        prosody_by_locale[loc] = (
            synth.parse_blend(prosody_override)
            if prosody_override
            else (RECIPE.prosody_fr if loc == "fr" else RECIPE.prosody_en)
        )

    model_path = str(Path(args.models) / "kokoro-v1.0.onnx")
    voices_path = str(Path(args.models) / "voices-v1.0.bin")

    # Determine work items and skip finished ones
    work: List[Dict[str, Any]] = []
    for clip in clips:
        if args.ab:
            work.append(clip)
            continue
        mp3_path = io.clip_output_path(args.out, clip["locale"], clip["key"], clip.get("file"))
        if io.is_already_done(manifest, clip["locale"], clip["key"], clip["hash"], mp3_path, args.force):
            log.info("skip %s/%s", clip["locale"], clip["key"])
            continue
        work.append(clip)

    if not work:
        log.info("Nothing to do")
        return 0

    # For multiprocessing each worker needs one locale's weights; we therefore
    # initialise per locale.  Simplest robust approach: one pool per locale.
    results: List[Dict[str, Any]] = []
    failed = 0

    for loc in locales:
        loc_clips = [c for c in work if c["locale"] == loc]
        if not loc_clips:
            continue

        init_args = (model_path, voices_path, args.age, timbre_by_locale[loc], prosody_by_locale[loc])
        jobs = max(1, min(args.jobs, len(loc_clips)))
        with mp.Pool(processes=jobs, initializer=_worker_init, initargs=init_args) as pool:
            for res in pool.imap_unordered(_worker_run, loc_clips):
                if "error" in res:
                    failed += 1
                    continue
                if args.qa:
                    results.append(res)
                # Persist immediately
                if args.ab:
                    out_dir = Path(args.ab) / args.ab_variant / res["locale"]
                    out_dir.mkdir(parents=True, exist_ok=True)
                    out_path = out_dir / f"{res.get('file') or io.clip_file_stem(res['key'])}.mp3"
                else:
                    out_path = io.clip_output_path(args.out, res["locale"], res["key"], res.get("file"))
                try:
                    io.write_mp3_ffmpeg(res["audio"], res["sr"], out_path, args.mp3_q)
                    if not args.ab:
                        manifest[res["locale"]][res["key"]] = res["hash"]
                        io.save_manifest_atomic(manifest, args.manifest)
                    log.info("wrote %s", out_path)
                except Exception:
                    failed += 1
                    log.exception("failed to write %s", out_path)

    # QA
    if args.qa:
        _run_qa(args, results, clips)

    return 0 if failed == 0 else 2


# ---------------------------------------------------------------------------
# QA
# ---------------------------------------------------------------------------


def _run_qa(args: argparse.Namespace, results: List[Dict[str, Any]], all_clips: List[Dict[str, Any]]) -> None:
    report: Dict[str, Any] = {}
    try:
        qa_engine = qa.WhisperQA()
    except Exception as e:
        log.error("QA disabled: %s", e)
        return

    ref_by_key = {(c["locale"], c["key"]): c["text"] for c in all_clips}

    for res in results:
        loc, key = res["locale"], res["key"]
        audio, sr = res["audio"], res["sr"]
        f0 = qa.clip_median_f0(audio, sr)
        hyp = qa_engine.transcribe(audio, sr, language=loc)
        ref = ref_by_key.get((loc, key), "")
        wer = qa.word_error_rate(ref, hyp)
        report[f"{loc}/{key}"] = {
            "duration_s": round(len(audio) / sr, 3),
            "median_f0_hz": round(f0, 1),
            "wer": round(wer, 4),
            "reference": ref,
            "hypothesis": hyp,
        }

    out_dir = Path(args.ab) if args.ab else Path(args.qa_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False, sort_keys=True)
        f.write("\n")

    # Print table
    print(f"{'clip':40s} {'dur':>6s} {'F0':>6s} {'WER':>6s}")
    for k, v in sorted(report.items()):
        print(f"{k:40s} {v['duration_s']:6.2f} {v['median_f0_hz']:6.1f} {v['wer']:6.3f}")
    high = {k: v for k, v in report.items() if v["wer"] > RECIPE.qa_wer_threshold}
    if high:
        print("\nWER > 0.25:")
        for k, v in high.items():
            print(f"  {k}: {v['wer']:.3f}  ref={v['reference']!r}  hyp={v['hypothesis']!r}")


if __name__ == "__main__":
    sys.exit(main())
