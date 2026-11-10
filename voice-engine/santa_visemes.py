#!/usr/bin/env python3
"""Mouth cues for every recorded Santa clip, with Rhubarb Lip Sync (MIT).

    python voice-engine/santa_visemes.py --rhubarb /path/to/rhubarb

Reads public/santa/voice/<locale>/*.mp3 and writes public/santa/visemes/<locale>.json:
{"voice": "santa-v2", "clips": {"line-open.hohoho": "X0 C6 B13 …"}} where each
cue is a Rhubarb mouth shape (A–H, X) and its start in centiseconds. Rhubarb
runs locally (phonetic recognizer, language-independent); only the JSON ships.
Resumable: clips already in the JSON with the same MP3 size are skipped.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


def cues(rhubarb: str, mp3: Path) -> str:
    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / "a.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-ac", "1", "-ar", "16000", str(wav)], check=True)
        out = subprocess.run([rhubarb, "-q", "-r", "phonetic", "-f", "json", str(wav)], check=True, capture_output=True, text=True).stdout
    data = json.loads(out)
    parts, last = [], None
    for c in data["mouthCues"]:
        if c["value"] == last:
            continue
        last = c["value"]
        parts.append(f'{c["value"]}{round(c["start"] * 100)}')
    return " ".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rhubarb", required=True)
    ap.add_argument("--voice-dir", default="public/santa/voice")
    ap.add_argument("--out", default="public/santa/visemes")
    ap.add_argument("--manifest", default="src/data/santa/voice-manifest.json")
    ap.add_argument("--jobs", type=int, default=2)
    a = ap.parse_args()
    voice = json.load(open(a.manifest, encoding="utf-8"))["voice"]
    Path(a.out).mkdir(parents=True, exist_ok=True)
    for loc in ("fr", "en"):
        path = Path(a.out) / f"{loc}.json"
        old = json.load(open(path, encoding="utf-8")) if path.exists() else {}
        done = old.get("clips", {}) if old.get("voice") == voice else {}
        sizes = old.get("sizes", {}) if old.get("voice") == voice else {}
        files = sorted((Path(a.voice_dir) / loc).glob("*.mp3"))
        todo = [f for f in files if not (f.stem in done and sizes.get(f.stem) == f.stat().st_size)]
        with ThreadPoolExecutor(a.jobs) as ex:
            for f, c in zip(todo, ex.map(lambda f: cues(a.rhubarb, f), todo)):
                done[f.stem] = c
                sizes[f.stem] = f.stat().st_size
        keep = {f.stem for f in files}
        out = {"voice": voice, "clips": {k: done[k] for k in sorted(done) if k in keep}, "sizes": {k: sizes[k] for k in sorted(sizes) if k in keep}}
        tmp = str(path) + ".partial"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(out, fh, separators=(",", ":"))
        os.replace(tmp, path)
        print(loc, len(out["clips"]), "clips", len(todo), "new", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
