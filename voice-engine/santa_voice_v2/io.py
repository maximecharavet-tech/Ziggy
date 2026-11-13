"""Filesystem I/O: clip JSON, manifest, MP3 writing, atomic operations."""

from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import soundfile as sf

log = logging.getLogger(__name__)

VOICE_ID = "santa-v2"


# ---------------------------------------------------------------------------
# Clip JSON
# ---------------------------------------------------------------------------


def load_clips(path: str | Path) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("Clips JSON must be a list")
    return data


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------


def empty_manifest() -> Dict[str, Any]:
    return {"voice": VOICE_ID, "fr": {}, "en": {}}


def load_manifest(path: str | Path) -> Dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return empty_manifest()
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    if "voice" not in data:
        data["voice"] = VOICE_ID
    data.setdefault("fr", {})
    data.setdefault("en", {})
    return data


def save_manifest_atomic(manifest: Dict[str, Any], path: str | Path) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    # Sorted keys, 2-space indent, trailing newline
    text = json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    fd, tmp = tempfile.mkstemp(dir=p.parent, prefix=p.name, suffix=".partial")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, p)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def is_already_done(
    manifest: Dict[str, Any],
    locale: str,
    key: str,
    hash_: str,
    mp3_path: str | Path,
    force: bool = False,
) -> bool:
    if force:
        return False
    if manifest.get("voice") != VOICE_ID:
        return False
    if manifest.get(locale, {}).get(key) != hash_:
        return False
    return Path(mp3_path).exists()


# ---------------------------------------------------------------------------
# MP3 via ffmpeg
# ---------------------------------------------------------------------------


def write_mp3_ffmpeg(audio: np.ndarray, sr: int, path: str | Path, quality: int = 5) -> None:
    """Write a temporary WAV, encode with ffmpeg/libmp3lame, atomic rename."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)

    fd, wav_tmp = tempfile.mkstemp(dir=p.parent, prefix=p.stem, suffix=".wav")
    os.close(fd)
    mp3_tmp = p.with_suffix(".mp3.partial")
    try:
        sf.write(wav_tmp, audio.astype(np.float32), sr, subtype="FLOAT")
        cmd = [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            wav_tmp,
            "-ac",
            "1",
            "-ar",
            "24000",
            "-codec:a",
            "libmp3lame",
            "-q:a",
            str(quality),
            "-write_xing",
            "1",
            "-map_metadata",
            "-1",
            "-f",
            "mp3",  # the .partial extension hides the format from ffmpeg
            str(mp3_tmp),
        ]
        r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        if r.returncode != 0:
            raise RuntimeError(f"ffmpeg failed ({r.returncode}): {r.stderr.strip()[-400:]}")
        os.replace(mp3_tmp, p)
    finally:
        if os.path.exists(wav_tmp):
            os.unlink(wav_tmp)
        if mp3_tmp.exists():
            mp3_tmp.unlink()


def clip_file_stem(key: str) -> str:
    return key.replace(":", "-")


def clip_output_path(out_root: str | Path, locale: str, key: str, file: Optional[str] = None) -> Path:
    """Prefer the ``file`` stem from dump-santa.mjs (same as the client's clipFile)."""
    return Path(out_root) / locale / f"{file or clip_file_stem(key)}.mp3"
