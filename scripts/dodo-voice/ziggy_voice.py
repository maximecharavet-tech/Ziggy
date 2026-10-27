#!/usr/bin/env python3
"""
Ziggy's bedtime voice — offline narration generator for the mode dodo.

Reads every story (via dump-stories.mjs), and for each locale/story/segment:

  1. splits the displayed text into sentences (whitespace tokens, exactly like
     `tokenize()` in src/lib/dodo/voice.ts);
  2. turns each sentence into Kokoro phonemes (fr: espeak-ng through misaki's
     EspeakG2P, as Kokoro was trained; en: misaki's lexicon G2P), with the
     fixes of lexicon.json, and remembers where each word starts;
  3. synthesizes the sentence with Kokoro-82M (ONNX, CPU). The graph exposes
     the predicted duration of every phoneme (see prepare_model.py), so each
     word's start time is read from the model itself — no drift, no guessing;
  4. trims each sentence, joins them with calm pauses, turns the voice into
     Ziggy's (child pitch + a soft robot shimmer, see FX below), normalizes
     the loudness and encodes a small mono MP3;
  5. writes public/dodo/voice/{locale}/{story}/{segment}.mp3 + timing.json
     (DodoVoiceTiming).

Nothing here runs when a child listens: the site only plays static files.

  python ziggy_voice.py                       # everything (fr then en)
  python ziggy_voice.py --locale fr --story lili,d01
  python ziggy_voice.py --check               # phonemes report only, no audio
  python ziggy_voice.py --sample lili:s2 --out /tmp/x   # one segment, to try the recipe
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / 'public' / 'dodo' / 'voice'
CACHE = Path(os.environ.get('DODO_VOICE_CACHE', HERE / '.cache'))

SR = 24000
FRAME = 600  # Kokoro: one predicted duration step = 600 samples at 24 kHz (25 ms)
MAX_TOKENS = 510
# Kokoro's sound for a phoneme starts ~3 frames before its predicted duration
# slot (measured here, and the -3 frames of kokoro's own join_timestamps):
# the teleprompter lights a word this much earlier than the raw slot.
ONSET_SHIFT = 0.10
# Sentences are trimmed to their sound (+20 ms margin): the first word starts there.
SENTENCE_ONSET = 0.02

# ── Ziggy's voice recipe ─────────────────────────────────────────────────────
VOICES = {
    # Kokoro voice, model speed (<1 = slower, with natural prosody)
    'fr': {'voice': 'ff_siwis', 'speed': 0.80},
    'en': {'voice': 'af_heart', 'speed': 0.84},
}
# Little robot child: pitch ×1.30 (≈ +4.5 semitones) with the vocal tract
# "shrunk" by ×1.12 (formants), a gentle short comb (soft metallic shimmer),
# a ring modulator mixed very low (the faint electronic buzz of a toy robot),
# warm EQ (no sharp highs at bedtime). Tempo is unchanged by the chain.
PITCH = 1.30
FORMANT = 1.12
COMB_MS = 4.0
COMB_DECAY = 0.20
RING_HZ = 42
RING_MIX = 0.12
LUFS = -18.0
TRUE_PEAK = -1.5
MAX_LIMIT_DB = 4.0  # at most this much peak limiting, else the gain is lowered
MP3_KBPS = 40

# Pauses (seconds)
LEAD = 0.08
TAIL = 0.30
PAUSE_SENTENCE = 0.38
PAUSE_QUESTION = 0.45
PAUSE_ELLIPSIS = 0.60
PAUSE_OTHER = 0.30

# ── Text ─────────────────────────────────────────────────────────────────────
# JavaScript's \s and String.prototype.trim(), so tokens match voice.ts exactly.
JS_WS = '\t\n\v\f\r \u00a0\u1680' + ''.join(chr(c) for c in range(0x2000, 0x200B)) + '\u2028\u2029\u202f\u205f\u3000\ufeff'
JS_SPLIT = re.compile('[' + re.escape(JS_WS) + ']+')


def tokenize(text: str) -> list[str]:
    """`text.trim().split(/\\s+/)`."""
    return JS_SPLIT.split(text.strip(JS_WS))


SPEAKABLE = re.compile(r'[^\W_]')  # a letter or a digit
LEAD_PUNCT = re.compile(r'^[\W_]+')
TRAIL_PUNCT = re.compile(r'[\W_]+$')
CLOSERS = '»”"’\')]'
ENDERS = '.!?…'


def speakable(tok: str) -> bool:
    return bool(SPEAKABLE.search(tok))


def split_core(tok: str) -> tuple[str, str, str]:
    """('«Bonjour,' ) -> ('«', 'Bonjour', ',')."""
    m1 = LEAD_PUNCT.match(tok)
    pre = m1.group(0) if m1 else ''
    rest = tok[len(pre):]
    m2 = TRAIL_PUNCT.search(rest)
    post = m2.group(0) if m2 else ''
    return pre, rest[: len(rest) - len(post)], post


def sentence_end(tok: str) -> str | None:
    """The final mark if this token ends a sentence (before closing quotes)."""
    core = tok.rstrip(CLOSERS)
    if core and core[-1] in ENDERS:
        return core[-1]
    return None


def sentences(tokens: list[str]) -> list[tuple[int, int, str | None]]:
    """[(start, end, final mark)] token ranges. A mark followed by a lower-case
    word ("« Oh ! » chuchota Lili") does not cut the sentence; closing quotes
    stay with the sentence they close."""
    out = []
    start = 0
    i = 0
    n = len(tokens)
    while i < n:
        mark = sentence_end(tokens[i])
        if mark:
            j = i + 1
            while j < n and not speakable(tokens[j]) and tokens[j].strip(CLOSERS) == '':
                j += 1  # closing quotes belong here
            nxt = next((t for t in tokens[j:] if speakable(t)), None)
            if nxt is None:
                break
            first = LEAD_PUNCT.sub('', nxt)[:1]
            if first and not first.islower():
                out.append((start, j, mark))
                start = j
                i = j
                continue
        i += 1
    out.append((start, n, sentence_end(tokens[n - 1]) if n else None))
    return out


def pause_after(mark: str | None) -> float:
    if mark == '…':
        return PAUSE_ELLIPSIS
    if mark in ('?', '!'):
        return PAUSE_QUESTION
    if mark == '.':
        return PAUSE_SENTENCE
    return PAUSE_OTHER


# ── Phonemes ─────────────────────────────────────────────────────────────────
def load_vocab() -> dict[str, int]:
    import kokoro_onnx  # bundles Kokoro v1.0's config.json (vocab)

    with open(Path(kokoro_onnx.__file__).parent / 'config.json', encoding='utf-8') as fp:
        return json.load(fp)['vocab']


VOCAB: dict[str, int] = {}
STRESS = set('ˈˌ')
PUNCT_PS = set(';:,.!?—…"()“”')


def letters(ps: str) -> str:
    return ''.join(c for c in ps if c not in STRESS and c not in PUNCT_PS and c != ' ')


def lev(a: str, b: str) -> int:
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def align(words: list[str], ps: str) -> list[int | None]:
    """Where each word starts in a sentence's phoneme string.

    `words[i]` is the word's phonemes said alone; `ps` the sentence's (with
    liaisons, merged clitics…). Monotonic alignment of words to the space-
    separated chunks of `ps` (1:1, 1:n, n:1), by phoneme edit distance.
    """
    chunks = []  # (offset, letters)
    pos = 0
    for part in ps.split(' '):
        if letters(part):
            off = pos + next(k for k, c in enumerate(part) if c not in PUNCT_PS)
            chunks.append((off, letters(part), part))
        pos += len(part) + 1
    W = [letters(w) for w in words]
    n, m = len(W), len(chunks)
    INF = 1e9
    cost = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    cost[0][0] = 0.0
    # Costs in phoneme edits; grouping costs one edit, dropping costs the length.
    shapes = [(1, 1), (1, 2), (2, 1), (1, 3), (3, 1), (1, 0), (0, 1)]
    for i in range(n + 1):
        for j in range(m + 1):
            if cost[i][j] >= INF:
                continue
            for a, b in shapes:
                if i + a > n or j + b > m:
                    continue
                if b == 0:
                    c = len(W[i]) + 1.5
                elif a == 0:
                    c = len(chunks[j][1]) + 1.5
                else:
                    x = ''.join(W[i:i + a])
                    y = ''.join(ch[1] for ch in chunks[j:j + b])
                    c = lev(x, y) + (0 if (a, b) == (1, 1) else 1)
                if cost[i][j] + c < cost[i + a][j + b]:
                    cost[i + a][j + b] = cost[i][j] + c
                    back[i + a][j + b] = (a, b)
    starts: list[int | None] = [None] * n
    i, j = n, m
    while i > 0 or j > 0:
        a, b = back[i][j]
        i, j = i - a, j - b
        if a == 0:
            continue
        if b == 0:
            continue  # the word vanished: it takes the next word's time
        off, _, part = chunks[j]
        if a == 1:
            starts[i] = off
        else:
            # Several words merged into one chunk: share it by their lengths.
            total = sum(len(W[k]) for k in range(i, i + a)) or 1
            body = [k for k, c in enumerate(part) if c not in PUNCT_PS]
            acc = 0
            for k in range(i, i + a):
                at = body[min(len(body) - 1, round(acc / total * len(body)))]
                starts[k] = off - body[0] + at
                acc += len(W[k])
    return starts


class FrenchG2P:
    def __init__(self, fixes: dict[str, str]):
        from misaki import espeak

        self.g = espeak.EspeakG2P(language='fr-fr')
        self.fixes = fixes
        self.cache: dict[str, str] = {}

    def fix(self, core: str) -> str | None:
        return self.fixes.get(core) or self.fixes.get(core.lower())

    @staticmethod
    def norm(text: str) -> str:
        return JS_SPLIT.sub(' ', text).replace('’', "'").strip()

    def raw(self, text: str) -> str:
        text = self.norm(text)
        if not text:
            return ''
        if text not in self.cache:
            self.cache[text] = self.g(text)[0]
        return self.cache[text]

    def word(self, tok: str) -> str:
        pre, core, post = split_core(tok)
        return self.fix(core) or self.raw(core)

    @staticmethod
    def punct_ps(p: str) -> str:
        p = p.replace('«', '“').replace('»', '”')
        return ''.join(c for c in p if c in PUNCT_PS)

    def sentence(self, toks: list[str]) -> tuple[str, list[int | None]]:
        """Phonemes of the sentence + where each token starts in them."""
        parts: list[str] = []
        starts: list[int | None] = [None] * len(toks)
        buf: list[int] = []
        length = 0

        def emit(ps: str, idx: list[int]):
            nonlocal length
            if not ps:
                return
            base = length + (1 if parts else 0)
            sp = [i for i in idx if speakable(toks[i])]
            if sp:
                local = align([self.word(toks[i]) for i in sp], ps)
                for i, s in zip(sp, local):
                    starts[i] = None if s is None else base + s
            parts.append(ps)
            length = base + len(ps)

        def flush():
            if buf:
                emit(self.raw(' '.join(toks[i] for i in buf)), list(buf))
                buf.clear()

        for i, t in enumerate(toks):
            pre, core, post = split_core(t)
            fx = self.fix(core) if core else None
            if fx:
                flush()
                pp = self.punct_ps(pre)
                emit(pp + fx + self.punct_ps(post), [])
                starts[i] = length - len(fx) - len(self.punct_ps(post))
            else:
                buf.append(i)
        flush()
        return ' '.join(parts), starts


class EnglishG2P:
    PUNCT_TAGS = {',': ',', '.': '.', '!': '.', '?': '.', ':': ':', ';': ':', '—': ':', '–': ':', '-': ':',
                  '…': ':', '...': ':', '“': '``', '”': "''", '(': '-LRB-', ')': '-RRB-'}
    DT = {'a', 'an', 'the', 'this', 'these', 'those', 'every', 'each', 'some', 'any', 'no', 'another'}
    IN = {'in', 'by', 'of', 'on', 'at', 'with', 'from', 'under', 'over', 'into', 'for'}
    POSS = {'a', 'an', 'the', 'his', 'her', 'their', 'my', 'your', 'our', 'its'}
    BE = {'is', 'was', 'are', 'were', 'be', 'so', 'very', 'too', 'come', 'came', 'comes', 'get', 'got'}

    def __init__(self, fixes: dict[str, str]):
        import spacy
        from misaki import en, espeak
        from spacy.language import Language

        cls = type(self)

        # No spaCy model can be downloaded here, so a tiny rule tagger gives
        # misaki the few tags it needs (punctuation, numbers, determiners,
        # and the homographs of these stories: close/live as verbs).
        @Language.component('ziggy_tagger')
        def tagger(doc):
            for k, t in enumerate(doc):
                x, low = t.text, t.text.lower()
                prev = doc[k - 1].text.lower() if k else ''
                nxt = doc[k + 1].text.lower() if k + 1 < len(doc) else ''
                if x in cls.PUNCT_TAGS:
                    t.tag_ = cls.PUNCT_TAGS[x]
                elif x == '"':
                    t.tag_ = '``' if (k == 0 or doc[k - 1].whitespace_) else "''"
                elif re.fullmatch(r'[\d.,]+', x):
                    t.tag_ = 'CD'
                elif low in cls.DT and not (low == 'that'):
                    t.tag_ = 'DT'
                elif x == 'That' and nxt and nxt[0].isalpha():
                    t.tag_ = 'DT'
                elif x == 'I':
                    t.tag_ = 'PRP'
                elif low == 'to':
                    t.tag_ = 'TO'
                elif low in cls.IN:
                    t.tag_ = 'IN'
                elif low in ('live', 'lives') and prev not in cls.POSS:
                    t.tag_ = 'VBZ' if low == 'lives' else 'VBP'
                elif low == 'close' and prev not in cls.BE and prev not in cls.POSS and nxt not in ('to', 'by', ',', '.', '!', '?'):
                    t.tag_ = 'VB'
                else:
                    t.tag_ = 'NN' if x[:1].isupper() and k > 0 else ''
            return doc

        g = en.G2P.__new__(en.G2P)
        g.version = None
        g.british = False
        nlp = spacy.blank('en')
        nlp.add_pipe('ziggy_tagger')
        g.nlp = nlp
        g.lexicon = en.Lexicon(False)
        g.fallback = espeak.EspeakFallback(british=False)
        g.unk = ''
        self.g = g
        self.fixes = fixes
        self.oov: dict[str, int] = {}

    def fix(self, core: str) -> str | None:
        core = core.replace('’', "'")
        hit = self.fixes.get(core) or self.fixes.get(core.lower())
        if hit:
            return hit
        m = re.fullmatch(r"(.+)'s", core)
        if m:
            base = self.fixes.get(m.group(1)) or self.fixes.get(m.group(1).lower())
            if base:
                tail = letters(base)[-1:]
                return base + ('ᵻz' if tail in 'szʃʒʧʤ' else 's' if tail in 'ptkfθ' else 'z')
        return None

    @staticmethod
    def norm(tok: str) -> str:
        return tok.replace('’', "'").replace('‘', "'")

    def word(self, tok: str) -> str:
        pre, core, post = split_core(tok)
        return self.fix(core) or self.g(self.norm(core))[0]

    def sentence(self, toks: list[str]) -> tuple[str, list[int | None]]:
        plain_toks = [self.norm(t) for t in toks]
        marked = []
        for t in plain_toks:
            pre, core, post = split_core(t)
            fx = self.fix(core) if core else None
            marked.append(f'{pre}[{core}](/{fx}/){post}' if fx else t)
        ps, mtoks = self.g(' '.join(marked))
        plain = ' '.join(plain_toks)
        # Char range of each whitespace token in `plain`.
        ranges, pos = [], 0
        for t in plain_toks:
            ranges.append((pos, pos + len(t)))
            pos += len(t) + 1
        # Walk misaki's tokens: char offset in plain + phoneme offset in ps.
        starts: list[int | None] = [None] * len(toks)
        cpos = 0
        ppos = 0
        ok = True
        for mt in mtoks:
            at = plain.find(mt.text, cpos) if mt.text else cpos
            if at < 0:
                ok = False
                break
            ph = mt.phonemes or ''
            if ps[ppos:ppos + len(ph)] != ph:
                ok = False
                break
            body = next((k for k, c in enumerate(ph) if c not in PUNCT_PS), None)
            if body is not None and letters(ph):
                w = next((k for k, (a, b) in enumerate(ranges) if a <= at < b), None)
                if w is not None and starts[w] is None:
                    starts[w] = ppos + body
                if mt._.rating is not None and mt._.rating <= 2 and not self.fix(mt.text):
                    self.oov[mt.text] = self.oov.get(mt.text, 0) + 1
            cpos = at + len(mt.text)
            ppos += len(ph) + len(mt.whitespace or '')
        if not ok:  # fall back to the generic aligner
            sp = [k for k, t in enumerate(toks) if speakable(t)]
            local = align([self.word(toks[k]) for k in sp], ps)
            starts = [None] * len(toks)
            for k, s in zip(sp, local):
                starts[k] = s
        return ps, starts


# ── Model ────────────────────────────────────────────────────────────────────
class Kokoro:
    def __init__(self, model: Path, voices: Path, threads: int):
        import onnxruntime as ort

        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        so.inter_op_num_threads = 1
        so.add_session_config_entry('session.intra_op.allow_spinning', '0')  # plays nice on a busy machine
        self.sess = ort.InferenceSession(str(model), so, providers=['CPUExecutionProvider'])
        self.has_dur = 'duration' in [o.name for o in self.sess.get_outputs()]
        self.tag = f'{Path(model).name}:{self.has_dur}'
        self.voices_dir = voices
        self.packs: dict[str, np.ndarray] = {}

    def pack(self, name: str) -> np.ndarray:
        if name not in self.packs:
            self.packs[name] = np.fromfile(self.voices_dir / f'{name}.bin', dtype=np.float32).reshape(-1, 1, 256)
        return self.packs[name]

    def __call__(self, ids: list[int], voice: str, speed: float) -> tuple[np.ndarray, np.ndarray]:
        """Audio + the sample offset where each input token starts (len(ids)+1 edges)."""
        pack = self.pack(voice)
        style = pack[min(len(ids), len(pack)) - 1]  # Kokoro: style row = phoneme count - 1
        feeds = {
            'input_ids': np.array([[0, *ids, 0]], dtype=np.int64),
            'style': style.astype(np.float32),
            'speed': np.array([speed], dtype=np.float32),
        }
        out = self.sess.run(None, feeds)
        audio = np.asarray(out[0], dtype=np.float32).ravel()
        if self.has_dur:
            dur = np.asarray(out[1]).ravel().astype(np.float64)
        else:  # older graph: spread the audio by a rough weight per phoneme
            w = [0.4] + [0.2 if (VOCAB_INV.get(t, '') in STRESS) else 1.0 for t in ids] + [0.4]
            dur = np.array(w) / sum(w) * (len(audio) / FRAME)
        edges = np.concatenate([[0.0], np.cumsum(dur)]) * (len(audio) / max(dur.sum(), 1e-9))
        return audio, edges[1:]  # edges[k] = start of input token k (token 0 = first phoneme)


VOCAB_INV: dict[int, str] = {}


def encode(ps: str) -> tuple[list[int], list[int]]:
    """Model ids + for each char of ps the index of the first id at/after it."""
    ids, at = [], []
    for c in ps:
        at.append(len(ids))
        if c in VOCAB:
            ids.append(VOCAB[c])
    return ids, at


def trim_bounds(audio: np.ndarray) -> tuple[int, int]:
    win = int(0.01 * SR)
    n = len(audio) // win
    if n == 0:
        return 0, len(audio)
    rms = np.sqrt((audio[: n * win].reshape(n, win) ** 2).mean(axis=1) + 1e-12)
    thr = max(rms.max() * 10 ** (-38 / 20), 1e-4)
    on = np.nonzero(rms > thr)[0]
    if len(on) == 0:
        return 0, len(audio)
    a = max(0, on[0] * win - int(0.02 * SR))
    b = min(len(audio), (on[-1] + 1) * win + int(0.06 * SR))
    return a, b


@dataclass
class Sentence:
    audio: np.ndarray
    times: list[float | None]  # per token of the sentence, seconds from sentence start
    ps: str


def plan_sentence(g2p, toks: list[str]) -> list[tuple[list[str], str, list[int | None]]]:
    """Phonemes of a sentence, cut in parts if it is too long for the model."""
    ps, starts = g2p.sentence(toks)
    if len(encode(ps)[0]) <= MAX_TOKENS - 2:
        return [(toks, ps, starts)]
    # Very long sentence: cut at the comma nearest the middle.
    commas = [k for k, t in enumerate(toks[:-1]) if t.endswith((',', ';', ':'))]
    if not commas:
        raise ValueError(f'sentence too long and no comma: {" ".join(toks)[:80]}')
    cut = min(commas, key=lambda k: abs(k - len(toks) / 2)) + 1
    return plan_sentence(g2p, toks[:cut]) + plan_sentence(g2p, toks[cut:])


def synth_sentence(model: Kokoro, plan: list[tuple[list[str], str, list[int | None]]], voice: str, speed: float) -> Sentence:
    if len(plan) > 1:
        gap = np.zeros(int(0.18 * SR), dtype=np.float32)
        out = synth_sentence(model, plan[:1], voice, speed)
        for part in plan[1:]:
            b = synth_sentence(model, [part], voice, speed)
            off = (len(out.audio) + len(gap)) / SR
            out = Sentence(np.concatenate([out.audio, gap, b.audio]),
                           out.times + [None if t is None else t + off for t in b.times], out.ps + ' ' + b.ps)
        return out
    toks, ps, starts = plan[0]
    if ps and ps[-1] not in PUNCT_PS:
        ps += '.'  # a title has no full stop: give it a calm, falling end
    ids, at = encode(ps)
    audio, edges = model(ids, voice, speed)
    lo, hi = trim_bounds(audio)
    times: list[float | None] = []
    for s in starts:
        if s is None:
            times.append(None)
        else:
            k = at[s] if s < len(at) else len(ids) - 1
            k = min(k, len(ids) - 1)
            times.append(max(0.0, (edges[k] - lo) / SR))
    seg = audio[lo:hi]
    dur = len(seg) / SR
    times = [None if t is None else min(t, max(0.0, dur - 0.05)) for t in times]
    return Sentence(seg.astype(np.float32), times, ps)


def fill_times(times: list[float | None], end: float) -> list[float]:
    """Tokens without sound («, —…) take the next word's time (or the previous one at the end)."""
    out: list[float] = [0.0] * len(times)
    nxt = None
    for k in range(len(times) - 1, -1, -1):
        if times[k] is not None:
            nxt = times[k]
        out[k] = nxt if nxt is not None else -1.0
    last = 0.0
    for k in range(len(out)):
        if out[k] < 0:
            out[k] = last
        out[k] = max(out[k], last)  # never go back in time
        last = out[k]
    return [min(t, end) for t in out]


# ── Ziggy FX ─────────────────────────────────────────────────────────────────
def fx_graph() -> str:
    tempo = 1 / FORMANT
    return (
        # child: formants ×FORMANT (resample trick), then pitch to ×PITCH, tempo restored
        f'aresample={SR},asetrate={SR * FORMANT:.0f},aresample={SR},'
        f'rubberband=pitch={PITCH / FORMANT:.5f}:tempo={tempo:.5f}:formant=preserved:pitchq=quality:transients=smooth:window=standard,'
        # warmth: a little body, softer highs, no hiss
        'highpass=f=90,equalizer=f=220:t=q:w=0.9:g=2,highshelf=f=6000:g=-3,lowpass=f=10000,'
        # soft robot shimmer: a short comb, low feedback
        f'aecho=in_gain=1.0:out_gain=0.86:delays={COMB_MS}:decays={COMB_DECAY},'
        # faint electronic buzz: ring modulation mixed very low
        f'asplit=2[dry][rm];[rm]aeval=exprs=val(0)*sin(2*PI*{RING_HZ}*t):c=same[ring];'
        f'[dry][ring]amix=inputs=2:weights=1 {RING_MIX}:normalize=0'
    )


def ffmpeg(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-loglevel', 'error', *args],
                          check=True, capture_output=True, text=True)


def apply_fx(raw: np.ndarray, tmp: Path) -> np.ndarray:
    src = tmp / 'raw.wav'
    mid = tmp / 'fx.wav'
    sf.write(src, raw, SR, subtype='FLOAT')
    ffmpeg(['-y', '-i', str(src), '-filter_complex', fx_graph(), '-ar', str(SR), '-ac', '1', '-c:a', 'pcm_f32le', str(mid)])
    out, sr = sf.read(mid, dtype='float32')
    assert sr == SR
    # The chain keeps the tempo; fix the last few samples of rounding.
    n = len(raw)
    out = out[:n] if len(out) >= n else np.concatenate([out, np.zeros(n - len(out), dtype=np.float32)])
    return out


def loudness(audio: np.ndarray, tmp: Path) -> dict:
    p = tmp / 'm.wav'
    sf.write(p, audio, SR, subtype='FLOAT')
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-i', str(p), '-af',
                        f'loudnorm=I={LUFS}:TP={TRUE_PEAK}:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True, check=True)
    js = r.stderr[r.stderr.rindex('{'): r.stderr.rindex('}') + 1]
    return json.loads(js)


def finish(audio: np.ndarray, tmp: Path, mp3: Path) -> float:
    """Gain to LUFS (measured with loudnorm, applied as one static gain), a
    transparent peak limiter for the rare plosive above the ceiling, 20 ms fades, MP3."""
    m = loudness(audio, tmp)
    gain_db = LUFS - float(m['input_i'])
    over = float(m['input_tp']) + gain_db - TRUE_PEAK
    if over > MAX_LIMIT_DB:  # very peaky take: lower the gain rather than squash it
        gain_db -= over - MAX_LIMIT_DB
    y = audio * np.float32(10 ** (gain_db / 20))
    f = int(0.02 * SR)
    ramp = np.linspace(0, 1, f, dtype=np.float32)
    y[:f] *= ramp
    y[-f:] *= ramp[::-1]
    src = tmp / 'final.wav'
    sf.write(src, y, SR, subtype='FLOAT')
    mp3.parent.mkdir(parents=True, exist_ok=True)
    ceiling = 10 ** ((TRUE_PEAK - 0.5) / 20)  # sample-peak limit, a little under the true-peak target
    ffmpeg(['-y', '-i', str(src), '-af', f'alimiter=limit={ceiling:.3f}:attack=3:release=60:level=disabled:latency=1',
            '-ac', '1', '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', f'{MP3_KBPS}k',
            '-write_xing', '1', '-id3v2_version', '0', '-map_metadata', '-1', str(mp3)])
    return len(y) / SR


# ── Segments & stories ───────────────────────────────────────────────────────
def render_segment(model: Kokoro, g2p, text: str, locale: str, cache: Path | None = None) -> tuple[np.ndarray, list[float], list[str]]:
    """Raw (pre-FX) narration of one segment + each token's start time.

    Kokoro's output is cached by (voice, speed, phonemes, pauses), so changing
    the FX recipe or the MP3 settings never needs the slow synthesis again."""
    cfg = VOICES[locale]
    toks = tokenize(text)
    sents = sentences(toks)
    plans = [plan_sentence(g2p, toks[a:b]) for a, b, _ in sents]
    phon = [' '.join(p[1] for p in plan) for plan in plans]
    key = hashlib.sha1(json.dumps([cfg, phon, [m for _, _, m in sents], LEAD, TAIL, PAUSE_SENTENCE,
                                   PAUSE_QUESTION, PAUSE_ELLIPSIS, PAUSE_OTHER, model.tag if model else ''],
                                  ensure_ascii=False).encode()).hexdigest()
    if cache is not None:
        meta = cache.with_suffix('.json')
        if meta.exists() and cache.exists():
            m = json.loads(meta.read_text(encoding='utf-8'))
            if m.get('key') == key and m.get('text') == text and 'slots' in m:
                raw, sr = sf.read(cache, dtype='float32')
                if sr == SR:
                    return raw, shift_words(m['slots'], m['sent_t0'], len(raw) / SR), phon
    pieces: list[np.ndarray] = [np.zeros(int(LEAD * SR), dtype=np.float32)]
    t0 = LEAD
    times: list[float | None] = []  # each token's phoneme slot (s), None for punctuation
    sent_t0: list[float] = []  # start of the sentence holding each token
    for k, ((a, b, mark), plan) in enumerate(zip(sents, plans)):
        s = synth_sentence(model, plan, cfg['voice'], cfg['speed'])
        times += [None if t is None else t + t0 for t in s.times]
        sent_t0 += [t0] * (b - a)
        pieces.append(s.audio)
        t0 += len(s.audio) / SR
        gap = TAIL if k == len(sents) - 1 else pause_after(mark)
        pieces.append(np.zeros(int(gap * SR), dtype=np.float32))
        t0 += int(gap * SR) / SR
    raw = np.concatenate(pieces)
    if cache is not None:
        cache.parent.mkdir(parents=True, exist_ok=True)
        sf.write(cache, raw, SR, format='FLAC', subtype='PCM_24')
        cache.with_suffix('.json').write_text(json.dumps({'key': key, 'text': text, 'slots': times, 'sent_t0': sent_t0,
                                                          'phonemes': phon}, ensure_ascii=False), encoding='utf-8')
    return raw, shift_words(times, sent_t0, len(raw) / SR), phon


def shift_words(slots: list[float | None], sent_t0: list[float], dur: float) -> list[float]:
    """Word start times from the phoneme slots: ONSET_SHIFT earlier (never before
    the sentence starts), punctuation-only tokens on the next word."""
    shifted = [None if t is None else max(t0, t - ONSET_SHIFT) for t, t0 in zip(slots, sent_t0)]
    # The first word of a sentence starts with its (trimmed) audio.
    first: set[float] = set()
    for k, (t, t0) in enumerate(zip(shifted, sent_t0)):
        if t is not None and t0 not in first:
            first.add(t0)
            shifted[k] = min(t, t0 + SENTENCE_ONSET)
    return fill_times(shifted, dur)


def check_segment(text: str, phon: list[str], g2p) -> list[str]:
    """Nothing skipped or garbled: compare the phonemes with the words."""
    issues = []
    joined = ' '.join(phon)
    bad = sorted({c for c in joined if c not in VOCAB})
    if bad:
        issues.append(f'chars outside the vocabulary: {bad}')
    words = [t for t in tokenize(text) if speakable(t)]
    expect = sum(len(letters(g2p.word(w))) for w in words)
    got = len(letters(joined))
    if expect and not (0.8 <= got / expect <= 1.25):
        issues.append(f'phoneme count {got} vs {expect} expected')
    ratio = len(letters(joined)) / max(1, len(re.sub(r'[\W_]', '', text)))
    if not 0.55 <= ratio <= 1.4:
        issues.append(f'phonemes/letters ratio {ratio:.2f}')
    return issues


def load_stories(path: Path | None) -> list[dict]:
    if path is None:
        r = subprocess.run(['node', str(HERE / 'dump-stories.mjs')], cwd=ROOT, capture_output=True, text=True, check=True)
        return json.loads(r.stdout)['stories']
    return json.loads(path.read_text(encoding='utf-8'))['stories']


def segment_ids(seg: dict) -> list[str]:
    scenes = sorted((k for k in seg if re.fullmatch(r's\d+', k)), key=lambda k: int(k[1:]))
    return ['title', *scenes, 'outro']


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--locale', default='fr,en')
    ap.add_argument('--story', default='', help='comma-separated ids (default: all)')
    ap.add_argument('--stories-json', type=Path, default=None, help='output of dump-stories.mjs (default: run it)')
    ap.add_argument('--model', type=Path, default=CACHE / 'kokoro-fp32-dur.onnx')
    ap.add_argument('--voices', type=Path, default=CACHE / 'voices')
    ap.add_argument('--out', type=Path, default=OUT)
    ap.add_argument('--raw', type=Path, default=CACHE / 'raw', help='cache of the raw Kokoro takes')
    ap.add_argument('--threads', type=int, default=max(1, (os.cpu_count() or 2)))
    ap.add_argument('--skip-existing', action='store_true', help='keep stories whose timing.json matches the texts')
    ap.add_argument('--claims', type=Path, default=None,
                    help='shared folder: several workers split the stories (each takes the next unclaimed one)')
    ap.add_argument('--check', action='store_true', help='phonemes report only (no audio)')
    ap.add_argument('--sample', default='', help='story:segment, render only that (raw + Ziggy) into --out')
    ap.add_argument('--speed', default='', help='try another model speed, e.g. fr=0.8,en=0.85')
    args = ap.parse_args()
    for item in filter(None, args.speed.split(',')):
        loc, val = item.split('=')
        VOICES[loc]['speed'] = float(val)

    global VOCAB, VOCAB_INV
    VOCAB = load_vocab()
    VOCAB_INV = {v: k for k, v in VOCAB.items()}
    lex = json.loads((HERE / 'lexicon.json').read_text(encoding='utf-8'))
    stories = load_stories(args.stories_json)
    want = {s for s in args.story.split(',') if s}
    if args.sample:
        want = {args.sample.split(':')[0]}
    stories = [s for s in stories if not want or s['id'] in want]
    locales = [loc for loc in args.locale.split(',') if loc]

    model = None if args.check else Kokoro(args.model, args.voices, args.threads)
    if model and not model.has_dur:
        print('! model has no duration output: word times are estimated (run prepare_model.py)', file=sys.stderr)

    pool = ThreadPoolExecutor(max_workers=2)
    total_audio = 0.0
    t_start = time.time()
    for locale in locales:
        g2p = FrenchG2P(lex['fr']) if locale == 'fr' else EnglishG2P(lex['en'])
        for story in stories:
            seg = story['segments'][locale]
            sdir = args.out / locale / story['id']
            if args.sample:
                sid = args.sample.split(':')[1]
                with tempfile.TemporaryDirectory() as td:
                    raw, words, phon = render_segment(model, g2p, seg[sid], locale, args.raw / locale / story['id'] / f'{sid}.flac')
                    args.out.mkdir(parents=True, exist_ok=True)
                    sf.write(args.out / f'{locale}-{story["id"]}-{sid}-raw.wav', raw, SR)
                    fxd = apply_fx(raw, Path(td))
                    finish(fxd, Path(td), args.out / f'{locale}-{story["id"]}-{sid}.mp3')
                    sf.write(args.out / f'{locale}-{story["id"]}-{sid}-ziggy.wav', fxd, SR)
                    (args.out / f'{locale}-{story["id"]}-{sid}.json').write_text(json.dumps(
                        {'text': seg[sid], 'words': [round(w, 3) for w in words], 'phonemes': phon}, ensure_ascii=False, indent=1))
                print('sample written to', args.out)
                continue
            if args.check:
                for sid in segment_ids(seg):
                    toks = tokenize(seg[sid])
                    phon = []
                    for a, b, _ in sentences(toks):
                        ps, starts = g2p.sentence(toks[a:b])
                        phon.append(ps)
                        miss = [toks[a + k] for k, s in enumerate(starts) if s is None and speakable(toks[a + k])]
                        if miss:
                            print(f'  {locale}/{story["id"]}/{sid}: no phonemes for {miss}')
                        if len(encode(ps)[0]) > MAX_TOKENS - 2:
                            print(f'  {locale}/{story["id"]}/{sid}: long sentence ({len(ps)} phonemes)')
                    for issue in check_segment(seg[sid], phon, g2p):
                        print(f'  {locale}/{story["id"]}/{sid}: {issue}')
                continue
            if args.claims is not None:
                try:
                    (args.claims / f'{locale}-{story["id"]}').mkdir(parents=True)
                except FileExistsError:
                    continue  # another worker has it
            if args.skip_existing and (sdir / 'timing.json').exists():
                try:
                    old = json.loads((sdir / 'timing.json').read_text(encoding='utf-8'))
                    if all(old['segments'].get(k, {}).get('text') == seg[k] and (sdir / f'{k}.mp3').exists()
                           for k in segment_ids(seg)):
                        print(f'= {locale}/{story["id"]} up to date')
                        continue
                except (OSError, ValueError, KeyError):
                    pass
            t0 = time.time()
            timing = {'v': 1, 'locale': locale, 'story': story['id'], 'segments': {}}
            jobs = []
            with tempfile.TemporaryDirectory() as td:
                for sid in segment_ids(seg):
                    text = seg[sid]
                    raw, words, phon = render_segment(model, g2p, text, locale, args.raw / locale / story['id'] / f'{sid}.flac')
                    for issue in check_segment(text, phon, g2p):
                        print(f'  ! {locale}/{story["id"]}/{sid}: {issue}', file=sys.stderr)
                    assert len(words) == len(tokenize(text))
                    sub = Path(td) / sid
                    sub.mkdir()

                    def post(raw=raw, sub=sub, sid=sid):
                        return finish(apply_fx(raw, sub), sub, sdir / f'{sid}.mp3')

                    jobs.append((sid, text, words, pool.submit(post)))
                for sid, text, words, fut in jobs:
                    dur = fut.result()
                    words = [round(min(w, dur - 0.01), 3) for w in words]
                    timing['segments'][sid] = {'file': f'{sid}.mp3', 'dur': round(dur, 3), 'text': text, 'words': words}
                    total_audio += dur
            (sdir / 'timing.json').write_text(json.dumps(timing, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
            el = time.time() - t0
            secs = sum(s['dur'] for s in timing['segments'].values())
            print(f'✓ {locale}/{story["id"]}: {secs:.0f}s of voice in {el:.0f}s', flush=True)
        if isinstance(g2p, EnglishG2P) and g2p.oov:
            print('English words read by the espeak fallback (consider lexicon.json):', dict(sorted(g2p.oov.items())))
    if total_audio:
        print(f'done: {total_audio / 60:.1f} min of voice in {(time.time() - t_start) / 60:.1f} min')


if __name__ == '__main__':
    main()
