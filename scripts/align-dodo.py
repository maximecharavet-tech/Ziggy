#!/usr/bin/env python3
"""
Mode dodo: time the KNOWN lyrics of a sung story against its audio (teleprompter).

Pipeline (all local, CPU, free):
  0. Demucs (MIT, https://github.com/adefossez/demucs) isolates the voice from the
     music (--separate). Without it Whisper only hallucinates on Suno songs.
  1. faster-whisper (MIT, https://github.com/SYSTRAN/faster-whisper) transcribes the
     track with word timestamps (French model, default "medium", int8).
  2. The known lyrics (Suno prompt, [section tags] removed) are tokenised into words
     and aligned to the ASR words with a sequence alignment on normalised text
     (difflib, stdlib). Matched lyric words take the ASR times; unmatched runs are
     interpolated between their matched neighbours. So the text shown is always the
     exact lyrics, never the ASR guess.
  3. Lyrics are split into teleprompter lines (sentences; chorus lines kept as is)
     and written as compact JSON next to the audio.

Usage:
  python3 scripts/align-dodo.py AUDIO.mp3 --lyrics dodo-suno.json --entry 0 \
      --story lili --version 1 --out public/dodo/lili/lili-v1.timing.json
  (--lyrics can also be a plain .txt file with the lyrics.)
  pip install faster-whisper demucs soundfile   # once, in a venv (torch CPU wheel)
  add --separate to isolate the voice first (strongly recommended for songs).
Output format (v1):
  { "v":1, "story":..., "version":..., "duration":s, "match":0..1,
    "lines":[ {"s":start, "e":end, "k":"chorus"|"verse", "w":[[t, e, "mot"], ...]} ] }
  Line text = the "mot" tokens joined by spaces.
"""
import argparse, difflib, json, re, sys, unicodedata

import numpy as np

PUNCT_BEFORE = {"«", "“", "(", "‹"}


def norm(w: str) -> str:
    w = unicodedata.normalize("NFKD", w.lower().replace("’", "'"))
    w = "".join(c for c in w if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9']", "", w)


def tokens(text: str):
    raw = text.split()
    out = []
    pending = ""
    for t in raw:
        if not norm(t):  # pure punctuation
            if t in PUNCT_BEFORE:
                pending += t + "\u00a0"
            elif out:
                out[-1] += ("\u00a0" + t) if t[0] in ":?!;»”›" else t
            continue
        out.append(pending + t)
        pending = ""
    return out


def parse_lyrics(lyrics: str):
    """-> list of (kind, line_text). Section tags drive the kind; long paragraphs are split in sentences."""
    lines, kind = [], "verse"
    for block in re.split(r"\n\s*\n", lyrics):
        for raw in block.split("\n"):
            raw = raw.strip()
            if not raw:
                continue
            m = re.fullmatch(r"\[(.*?)\]", raw)
            if m:
                tag = m.group(1).lower()
                kind = "chorus" if "chorus" in tag or "refrain" in tag else "verse"
                continue
            if kind == "chorus":
                lines.append((kind, raw))
                continue
            # sentences: split after . ! ? … (optionally followed by a closing quote)
            parts = re.split(r"(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ«“])|(?<=[.!?…]\s»)\s+(?=[A-ZÀ-ÖØ-Þ«“])", raw)
            buf = ""
            for p in parts:
                buf = (buf + " " + p).strip()
                if len(buf) >= 28:  # avoid tiny lines like « Oh ! »
                    lines.append((kind, buf))
                    buf = ""
            if buf:
                if lines and lines[-1][0] == kind:
                    lines[-1] = (kind, lines[-1][1] + " " + buf)
                else:
                    lines.append((kind, buf))
    return lines


def load_audio(path, sr=16000):
    """Decode with the ffmpeg CLI to 16 kHz mono float32 (avoids PyAV version issues)."""
    import subprocess
    import numpy as np

    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(sr), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def separate(audio):
    """Demucs htdemucs, two stems: returns the path of vocals.wav (in a temp dir)."""
    import os, subprocess, tempfile

    out = tempfile.mkdtemp(prefix="dodo-sep-")
    wav = os.path.join(out, "in.wav")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", audio, "-ar", "44100", wav], check=True)
    subprocess.run([sys.executable, "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs", "-d", "cpu", "-o", out, wav], check=True)
    return os.path.join(out, "htdemucs", "in", "vocals.wav")


MAX_WORDS = 16


def split_long(text: str):
    """A teleprompter line stays short: long sentences are cut at a , : ; near the middle."""
    words = text.split()
    if len(words) <= MAX_WORDS:
        return [text]
    cuts = [i + 1 for i, w in enumerate(words[:-1]) if w.endswith((",", ";")) or words[i + 1] in {":", ";"} or w == ":"]
    cuts = [c for c in cuts if 5 <= c <= len(words) - 5]
    if not cuts:
        return [text]
    mid = len(words) / 2
    c = min(cuts, key=lambda x: abs(x - mid))
    if words[c - 1] != ":" and c < len(words) and words[c] == ":":
        c += 1
    return split_long(" ".join(words[:c])) + split_long(" ".join(words[c:]))


_MODELS = {}


def transcribe(audio, model_name, prompt, offset=0.0):
    """audio: a file path or a 16 kHz mono float32 array (then offset = its start in the song)."""
    from faster_whisper import WhisperModel

    if model_name not in _MODELS:
        _MODELS[model_name] = WhisperModel(model_name, device="cpu", compute_type="int8")
    segs, info = _MODELS[model_name].transcribe(
        load_audio(audio) if isinstance(audio, str) else audio, language="fr", word_timestamps=True,
        beam_size=5, initial_prompt=prompt, condition_on_previous_text=False, vad_filter=False,
    )
    words = []
    for s in segs:
        for w in s.words or []:
            words.append((w.start + offset, w.end + offset, w.word.strip(), w.probability))
        print(f"  [{s.start + offset:7.2f} → {s.end + offset:7.2f}] {s.text.strip()[:90]}", file=sys.stderr)
    return words, info.duration


def phrases(clip, sr=16000, gap=0.35, min_len=1.5):
    """Split a vocals clip at its silences into sung phrases (sample ranges), merged up to ~min_len s."""
    env = np.sqrt(np.convolve(clip ** 2, np.ones(800) / 800, "same"))
    on = env > max(0.01, 0.12 * float(np.percentile(env, 95)))
    out, start, quiet = [], None, 0
    for k in range(0, len(on), 160):
        if on[k]:
            if start is None:
                start = k
            quiet = 0
        elif start is not None:
            quiet += 160
            if quiet >= gap * sr:
                out.append([start, k - quiet])
                start, quiet = None, 0
    if start is not None:
        out.append([start, len(clip)])
    merged = []
    for a, b in out:
        if merged and (merged[-1][1] - merged[-1][0] < min_len * sr):
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [(max(0, a - sr // 4), min(len(clip), b + sr // 4)) for a, b in merged]


def retry_gaps(flat, asr, duration, src, model_name, min_run=2, passes=3):
    """Run _retry_gaps until it stops helping (each pass narrows the remaining gaps)."""
    audio = load_audio(src)
    for _ in range(passes):
        before = align(flat, asr)[1]
        asr = _retry_gaps(flat, asr, duration, audio, model_name, min_run)
        if align(flat, asr)[1] <= before:
            break
    return asr


def _retry_gaps(flat, asr, duration, audio, model_name, min_run):
    """
    Whisper sometimes loses a whole passage (often the first verse after a long intro).
    For each run of >= min_run unmatched lyric words, transcribe again only the audio
    between its matched neighbours, hinting Whisper with the expected words, and keep
    the new words if they match better.
    """
    times, ratio = align(flat, asr)
    i = 0
    while i < len(flat):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(flat) and times[j] is None:
            j += 1
        if j - i >= min_run:
            t0 = times[i - 1][1] if i > 0 else 0.0
            t1 = times[j][0] if j < len(flat) else duration
            if t1 - t0 > 1.0:
                sr = 16000
                g0, g1 = int(max(0.0, t0 - 0.3) * sr), int(min(duration, t1 + 0.3) * sr)
                # Whisper often returns nothing (or garbage) for a clip that starts with long silence or
                # right on the voice: try a few starts just before the voice, plain, hinted and phrase by phrase.
                env = np.sqrt(np.convolve(audio[g0:g1] ** 2, np.ones(800) / 800, "same"))
                loud = np.nonzero(env > max(0.01, 0.15 * float(np.percentile(env, 95))))[0]
                v0 = g0 + (int(loud[0]) if len(loud) else 0)
                a1 = g0 + (min(g1 - g0, int(loud[-1]) + sr) if len(loud) else g1 - g0)
                print(f"retry {t0:.2f}-{t1:.2f} for {j - i} words: {' '.join(flat[i:i + 8])}…", file=sys.stderr)
                tries = [(max(g0, v0 - k * sr), "plain") for k in (1, 2, 3)] + [(max(g0, v0 - sr), "hint"), (g0, "phrases")]
                for a0, how in tries:
                    off = a0 / sr
                    if how == "phrases":
                        new = []
                        for p0, p1 in phrases(audio[a0:a1]):
                            new += transcribe(audio[max(g0, a0 + p0 - sr): a0 + p1], model_name, None, offset=max(g0, a0 + p0 - sr) / sr)[0]
                    else:
                        hint = " ".join(flat[i:i + 12]) if how == "hint" else None
                        new, _ = transcribe(audio[a0:a1], model_name, hint, offset=off)
                    new = [w for w in new if t0 - 0.3 <= w[0] <= t1 + 0.3]
                    cand = sorted([w for w in asr if not (t0 < w[0] < t1)] + new, key=lambda w: w[0])
                    t2, r2 = align(flat, cand)
                    if r2 > ratio:
                        asr, times, ratio = cand, t2, r2
                        print(f"  -> matched {ratio:.1%}", file=sys.stderr)
        i = j
    return asr


def merge_elisions(asr):
    """Whisper often splits « d'autres » into « d' » + « autres »: glue them back."""
    out = []
    for w in asr:
        if out and (out[-1][2].endswith(("'", "’")) or w[2].lstrip().startswith(("'", "’"))):
            p = out.pop()
            w = (p[0], w[1], p[2] + w[2].lstrip(), min(p[3], w[3]) if len(p) > 3 and len(w) > 3 else 1.0)
        out.append(tuple(w))
    return out


def align(lyric_words, asr):
    asr = merge_elisions(asr)
    a = [norm(w) for w in lyric_words]
    b = [norm(w[2]) for w in asr]
    times = [None] * len(a)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (asr[j1 + k][0], asr[j1 + k][1])
        elif tag == "replace" and (i2 - i1) == (j2 - j1):
            # same count, different spelling (e.g. "Lily"/"Lili"): accept if close enough
            for k in range(i2 - i1):
                if difflib.SequenceMatcher(None, a[i1 + k], b[j1 + k]).ratio() >= 0.6:
                    times[i1 + k] = (asr[j1 + k][0], asr[j1 + k][1])
    matched = sum(t is not None for t in times)
    return times, matched / max(1, len(a))


def fill(times, total):
    """Interpolate unmatched words between known neighbours, weighted by word length."""
    n = len(times)
    out = list(times)
    i = 0
    while i < n:
        if out[i] is not None:
            i += 1
            continue
        j = i
        while j < n and out[j] is None:
            j += 1
        start = out[i - 1][1] if i > 0 else max(0.0, (out[j][0] - 2.0 * (j - i) * 0.35) if j < n else 0.0)
        end = out[j][0] if j < n else min(total, start + (j - i) * 0.4)
        step = max(0.0, end - start) / (j - i)
        for k in range(i, j):
            out[k] = (start + step * (k - i), start + step * (k - i + 1))
        i = j
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--lyrics", required=True)
    ap.add_argument("--entry", type=int, default=0)
    ap.add_argument("--story", required=True)
    ap.add_argument("--version", default="1")
    ap.add_argument("--model", default="medium")
    ap.add_argument("--out", required=True)
    ap.add_argument("--asr-cache", help="reuse/save the raw ASR words (json)")
    ap.add_argument("--separate", action="store_true", help="isolate vocals with Demucs before ASR")
    ap.add_argument("--vocals", help="already separated vocals file to transcribe")
    ap.add_argument("--prompt", action="store_true", help="bias Whisper with the first lyrics (can hallucinate)")
    ap.add_argument("--no-retry", action="store_true", help="do not transcribe again the passages Whisper missed")
    a = ap.parse_args()

    if a.lyrics.endswith(".json"):
        d = json.load(open(a.lyrics, encoding="utf-8"))
        lyrics = (d[a.entry] if isinstance(d, list) else d)["lyrics"]
    else:
        lyrics = open(a.lyrics, encoding="utf-8").read()

    lines = [(k, part) for k, t in parse_lyrics(lyrics) for part in (split_long(t) if k == "verse" else [t])]
    line_words = [tokens(t) for _, t in lines]
    flat = [w for ws in line_words for w in ws]

    asr, duration = None, None
    if a.asr_cache:
        try:
            c = json.load(open(a.asr_cache))
            asr, duration = [tuple(x) for x in c["words"]], c["duration"]
            print(f"ASR cache: {len(asr)} words", file=sys.stderr)
        except FileNotFoundError:
            pass
    src = None
    if asr is None:
        prompt = " ".join(flat[:60]) if a.prompt else None
        src = a.vocals or (separate(a.audio) if a.separate else a.audio)
        asr, duration = transcribe(src, a.model, prompt)
    if not a.no_retry and (src or a.vocals or not a.separate):
        asr = retry_gaps(flat, asr, duration, src or a.vocals or a.audio, a.model)
    if a.asr_cache:
        json.dump({"duration": duration, "words": asr}, open(a.asr_cache, "w"), ensure_ascii=False)

    times, ratio = align(flat, asr)
    times = fill(times, duration)

    out_lines, k = [], 0
    for (kind, _), ws in zip(lines, line_words):
        w = []
        for tok in ws:
            s, e = times[k]
            w.append([round(s, 2), round(max(e, s + 0.05), 2), tok])
            k += 1
        out_lines.append({"s": w[0][0], "e": w[-1][1], "k": kind, "w": w})
    # monotonic safety
    last = 0.0
    for L in out_lines:
        for w in L["w"]:
            w[0] = max(w[0], last)
            w[1] = max(w[1], w[0])
            last = w[0]
        L["s"], L["e"] = L["w"][0][0], L["w"][-1][1]

    res = {"v": 1, "story": a.story, "version": str(a.version), "duration": round(duration, 2),
           "match": round(ratio, 3), "lines": out_lines}
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(flat)} lyric words, {len(asr)} ASR words, matched {ratio:.1%} -> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
