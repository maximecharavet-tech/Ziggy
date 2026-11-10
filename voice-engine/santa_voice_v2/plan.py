"""Text -> prosody plan.

Pure, side-effect-free functions so that the planning stage is unit-testable
without any model weights.  The plan follows the santa-v2 specification:
phrases are split at ``. ! ? … : ;`` and clauses at ``,``; each unit carries a
kind, a speed, a pause and optional breath/emphasis metadata.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import List, Optional, Sequence, Tuple

from .recipe import RECIPE, base_speed

# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class EmphasisSpan:
    """Approximate character span of an emphasised word inside the phrase."""

    start: float  # 0..1
    end: float    # 0..1


@dataclass
class PhrasePlan:
    text: str
    kind: str  # declarative | exclamation | question | continuation | ellipsis
    speed: float
    pause_after_ms: int
    breath_before: bool
    emphasis_spans: List[EmphasisSpan] = field(default_factory=list)
    # Ho-ho-ho metadata
    is_hohoho: bool = False
    hohoho_rest: str = ""


@dataclass
class ClipPlan:
    locale: str
    key: str
    phrases: List[PhrasePlan]


# ---------------------------------------------------------------------------
# Typography normalisation
# ---------------------------------------------------------------------------

_NBSP_RE = re.compile(r"[\u00A0\u202F\u2007]")
_ELLIPSIS_RE = re.compile(r"…")
_APOSTROPHE_RE = re.compile(r"[’‘]")
_MULTI_SPACE_RE = re.compile(r"[ \t]+")


def normalise_text(text: str) -> str:
    """French typography -> a form the phonemizer and planner understand."""
    text = _NBSP_RE.sub(" ", text)
    text = _ELLIPSIS_RE.sub("...", text)
    text = _APOSTROPHE_RE.sub("'", text)
    text = _MULTI_SPACE_RE.sub(" ", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Ho-ho-ho detection
# ---------------------------------------------------------------------------

# Whole words only ("Ho hors…" is not a laugh): Ho ho ho / Oh oh oh / Hohoho.
_HOHOHO_RE = re.compile(r"^(?:ho\b[\s,!.]*){2,}|^(?:ho){2,}\b[\s,!.]*", re.IGNORECASE)
_OHOHOH_RE = re.compile(r"^(?:oh\b[\s,!.]*){2,}", re.IGNORECASE)


def detect_hohoho(text: str) -> Optional[Tuple[str, str]]:
    """Return ``(hohoho_part, rest)`` if the text starts with Ho/Oh ho ho."""
    m = _HOHOHO_RE.match(text) or _OHOHOH_RE.match(text)
    if not m:
        return None
    prefix = m.group(0).strip()
    rest = text[m.end() :].strip()
    # Count actual "ho"/"oh" syllables
    syllables = re.findall(r"(?:ho|oh)", prefix, re.IGNORECASE)
    if len(syllables) < 2:
        return None
    return prefix, rest


# ---------------------------------------------------------------------------
# Emphasis extraction
# ---------------------------------------------------------------------------

_ALL_CAPS_WORD_RE = re.compile(r"\b[A-ZÀ-ÖØ-Þ]{2,}\b")
_STAR_RE = re.compile(r"\*([^*]+)\*")


def extract_emphasis(text: str) -> Tuple[str, List[EmphasisSpan]]:
    """Strip ``*…*`` markers and return cleaned text + emphasis spans.

    ALL-CAPS words are kept (only the star markers are stripped) but recorded
    as emphasised spans.
    """
    spans: List[EmphasisSpan] = []
    cleaned_parts: List[str] = []
    cursor = 0
    n = len(text)

    # First handle *…* spans (they are removed from the cleaned text)
    star_matches = list(_STAR_RE.finditer(text))
    if star_matches:
        for m in star_matches:
            cleaned_parts.append(text[cursor : m.start()])
            inner = m.group(1)
            start = sum(len(p) for p in cleaned_parts) / max(n, 1)
            end = (start * n + len(inner)) / max(n, 1)
            spans.append(EmphasisSpan(start=min(start, 1.0), end=min(end, 1.0)))
            cleaned_parts.append(inner)
            cursor = m.end()
        cleaned_parts.append(text[cursor:])
        cleaned = "".join(cleaned_parts)
    else:
        cleaned = text

    # Now ALL-CAPS words in the cleaned text
    for m in _ALL_CAPS_WORD_RE.finditer(cleaned):
        start = m.start() / max(len(cleaned), 1)
        end = m.end() / max(len(cleaned), 1)
        spans.append(EmphasisSpan(start=start, end=end))

    # Merge overlapping spans and sort
    spans.sort(key=lambda s: s.start)
    merged: List[EmphasisSpan] = []
    for s in spans:
        if merged and s.start <= merged[-1].end + 1e-6:
            merged[-1].end = max(merged[-1].end, s.end)
        else:
            merged.append(s)
    return cleaned, merged


# ---------------------------------------------------------------------------
# Phrase splitting
# ---------------------------------------------------------------------------

# Split after punctuation followed by whitespace.  French typography puts a
# space *before* ! ? : ; so the punctuation stays attached to the previous word
# and the split happens after it.
_SPLIT_RE = re.compile(r"(?<=[.!?…:;])\s+|(?<=,)\s+")
# Sentence ends only: commas/colons stay inside one Kokoro call, which phrases
# them naturally. Splitting every clause gave choppy joins that listeners (and
# Whisper) heard as an extra "et" at each clause start.
_SENTENCE_RE = re.compile(r"(?<=[.!?…])\s+")


def split_units(text: str, clauses: bool | None = None) -> List[str]:
    """Split a clip into prosodic units (sentences; clauses if ``clauses``)."""
    text = normalise_text(text)
    if not text:
        return []
    if clauses is None:
        clauses = RECIPE.split_on_clauses
    parts = (_SPLIT_RE if clauses else _SENTENCE_RE).split(text)
    units: List[str] = []
    for p in parts:
        p = p.strip()
        if p:
            units.append(p)
    return units


def classify_kind(unit: str) -> str:
    u = unit.rstrip()
    if u.endswith("?"):
        return "question"
    if u.endswith("!"):
        return "exclamation"
    if u.endswith("..."):
        return "ellipsis"
    if u.endswith(":") or u.endswith(";") or u.endswith(","):
        return "continuation"
    return "declarative"


def pause_for_kind(kind: str, unit: str = "") -> int:
    """Pause after a unit; colon/semicolon pause longer than a comma."""
    u = unit.rstrip()
    if kind == "continuation" and (u.endswith(":") or u.endswith(";")):
        return RECIPE.pause_colon_ms
    return {
        "continuation": RECIPE.pause_comma_ms,
        "declarative": RECIPE.pause_period_ms,
        "exclamation": RECIPE.pause_exclamation_ms,
        "question": RECIPE.pause_question_ms,
        "ellipsis": RECIPE.pause_ellipsis_ms,
    }[kind]


def speed_for_kind(kind: str, base: float) -> float:
    if kind == "exclamation":
        return RECIPE.exclamation_speed
    if kind == "ellipsis":
        return RECIPE.ellipsis_speed
    return base


# ---------------------------------------------------------------------------
# Main planner
# ---------------------------------------------------------------------------


def plan_clip(text: str, locale: str, key: str = "") -> ClipPlan:
    """Turn a raw clip text into a fully specified prosody plan."""
    text = normalise_text(text)
    phrases: List[PhrasePlan] = []

    hohoho = detect_hohoho(text)
    if hohoho:
        hohoho_part, rest = hohoho
        # The Ho ho ho itself is a special phrase
        cleaned_hohoho, spans = extract_emphasis(hohoho_part)
        phrases.append(
            PhrasePlan(
                text=cleaned_hohoho,
                kind="exclamation",
                speed=RECIPE.exclamation_speed,
                pause_after_ms=RECIPE.hohoho_pause_after_ms,
                breath_before=False,
                emphasis_spans=spans,
                is_hohoho=True,
                hohoho_rest=rest,
            )
        )
        # Plan the rest normally
        rest_units = split_units(rest) if rest else []
        base = base_speed(locale)
        for i, unit in enumerate(rest_units):
            cleaned, spans = extract_emphasis(unit)
            kind = classify_kind(unit)
            speed = speed_for_kind(kind, base)
            pause = pause_for_kind(kind, cleaned)
            breath = len(cleaned) > RECIPE.breath_phrase_chars and bool(phrases)
            phrases.append(
                PhrasePlan(
                    text=cleaned,
                    kind=kind,
                    speed=speed,
                    pause_after_ms=pause,
                    breath_before=breath,
                    emphasis_spans=spans,
                )
            )
    else:
        units = split_units(text)
        base = base_speed(locale)
        for i, unit in enumerate(units):
            cleaned, spans = extract_emphasis(unit)
            kind = classify_kind(unit)
            speed = speed_for_kind(kind, base)
            pause = pause_for_kind(kind, cleaned)
            breath = len(cleaned) > RECIPE.breath_phrase_chars and bool(phrases)
            phrases.append(
                PhrasePlan(
                    text=cleaned,
                    kind=kind,
                    speed=speed,
                    pause_after_ms=pause,
                    breath_before=breath,
                    emphasis_spans=spans,
                )
            )

    # Last phrase adjustments
    if phrases:
        phrases[-1].speed += RECIPE.last_phrase_speed_delta
        phrases[-1].pause_after_ms = 0

    return ClipPlan(locale=locale, key=key, phrases=phrases)
