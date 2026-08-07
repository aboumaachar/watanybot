"""
Small-talk / chitchat intent classifier + emotional scoring.

Intercepts greetings, thanks, farewells, and other conversational
messages BEFORE they hit the expensive KB search pipeline.

Also computes an emotional_score (0.0–1.0) for every message so
downstream layers can adapt tone and density.

Small-talk intent data is loaded from the backend data directory when present.
"""

from __future__ import annotations

import json
import random
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, cast

import structlog

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Load intents data
# ---------------------------------------------------------------------------

_BACKEND_DATA_DIR = Path(__file__).resolve().parents[3] / "data"
_SHARED_APPS_DATA_DIR = Path(__file__).resolve().parents[4] / "data"
_INTENTS_CANDIDATES = (
    _BACKEND_DATA_DIR / "intents.json",
    _BACKEND_DATA_DIR / "small_talk_intents.json",
    _SHARED_APPS_DATA_DIR / "intents.json",
)

_intents: List[Dict[str, Any]] = []


def _resolve_intents_file() -> Optional[Path]:
    for candidate in _INTENTS_CANDIDATES:
        if candidate.exists():
            return candidate
    return None


def _is_smalltalk_intent(intent: Dict[str, Any]) -> bool:
    patterns = intent.get("patterns")
    responses = intent.get("responses")
    return isinstance(patterns, list) and isinstance(responses, list)


def _load_intents() -> List[Dict[str, Any]]:
    """Read intents.json once and cache in module-level list."""
    global _intents
    if _intents:
        return _intents
    intents_file = _resolve_intents_file()
    if intents_file is None:
        logger.info(
            "intent_classifier_data_missing",
            candidates=[str(path) for path in _INTENTS_CANDIDATES],
        )
        _intents = []
        return _intents
    try:
        data = json.loads(intents_file.read_text(encoding="utf-8"))
        payload = cast(Dict[str, Any], data) if isinstance(data, dict) else {}
        raw_intents = payload.get("intents", [])
        intents_list: List[Dict[str, Any]] = []
        if isinstance(raw_intents, list):
            for intent in cast(List[Any], raw_intents):
                if isinstance(intent, dict):
                    typed_intent = cast(Dict[str, Any], intent)
                    intents_list.append(typed_intent)
        _intents = [intent for intent in intents_list if _is_smalltalk_intent(intent)]
        logger.info(
            "intent_classifier_loaded",
            path=str(intents_file),
            count=len(_intents),
            skipped=max(len(intents_list) - len(_intents), 0),
        )
    except Exception as exc:
        logger.warning("intent_classifier_load_failed", path=str(intents_file), error=str(exc))
        _intents = []
    return _intents


# Pre-load at import time
_load_intents()

# ---------------------------------------------------------------------------
# Emotional scoring
# ---------------------------------------------------------------------------

# Each keyword carries a weight.  We cap at 1.0 after summing.
_EMOTION_KEYWORDS: List[Tuple[str, float]] = [
    # ── Distress / frustration (high weight) ──
    ("تعبت", 0.45),
    ("مش قادر", 0.50),
    ("مش عم اقدر", 0.50),
    ("الوضع صعب", 0.45),
    ("ما عم بكفي", 0.45),
    ("ظلم", 0.55),
    ("مش عارف شو اعمل", 0.50),
    ("ضايع", 0.45),
    ("قلقان", 0.40),
    ("مقهور", 0.55),
    ("مستحيل", 0.40),
    ("يائس", 0.55),
    ("خايف", 0.40),
    ("محبط", 0.50),
    ("زهقت", 0.35),
    ("مش طايق", 0.45),
    ("بدي حدا يساعدني", 0.50),
    # ── Mild frustration / concern (lower weight) ──
    ("مش مبسوط", 0.30),
    ("صعب", 0.20),
    ("مشكلة", 0.20),
    ("حزين", 0.35),
    ("وجعني", 0.30),
    ("كرمال الله", 0.35),
    ("ما حدا بيسمعني", 0.50),
    ("حرام", 0.25),
]

# Pre-compiled for fast scanning
_EMOTION_PATTERNS = [(re.compile(re.escape(kw)), w) for kw, w in _EMOTION_KEYWORDS]


def emotional_score(text: str) -> float:
    """
    Return a 0.0–1.0 emotional intensity score for *text*.

    Strategy: scan for known emotional keywords/phrases, sum their
    weights, and clamp to [0, 1].  Exclamation marks and repetition
    add a small boost.
    """
    normalized = _normalize(text)
    score = 0.0

    for pat, weight in _EMOTION_PATTERNS:
        if pat.search(normalized):
            score += weight

    # Boost for exclamation / question marks (frustration signals)
    bangs = text.count("!") + text.count("؟")
    score += min(bangs * 0.05, 0.15)

    # Boost for repeated chars  (e.g. "تعبببت") — sign of venting
    if re.search(r"(.)\1{2,}", text):
        score += 0.10

    return round(min(score, 1.0), 2)


# ---------------------------------------------------------------------------
# Matching helpers
# ---------------------------------------------------------------------------

_STRIP_RE = re.compile(r"[؟?!.,،؛\s]+")


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation and diacritics for fuzzy matching."""
    text = text.strip()
    # Remove Arabic diacritics (tashkeel)
    text = re.sub(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]", "", text)
    # Normalize alef variants → ا
    text = re.sub(r"[إأآٱ]", "ا", text)
    # Normalize taa marbuta → ه
    text = text.replace("ة", "ه")
    # Strip common punctuation
    text = _STRIP_RE.sub(" ", text).strip()
    return text


def classify(text: str) -> Optional[Dict[str, Any]]:
    """
    Try to match *text* against loaded small-talk intents.

    Returns a dict ``{"name": ..., "response": ...}`` if matched,
    or ``None`` if no small-talk intent matches.

    Matching strategy:
    1. Exact normalized match against any pattern.
    2. The entire user message is contained within a pattern (or vice-versa)
       **and** the message is short (≤ 6 words) — avoids hijacking real questions
       that happen to start with "مرحبا".
    """
    intents = _load_intents()
    if not intents:
        return None

    normalized = _normalize(text)
    words = normalized.split()
    word_count = len(words)

    # Skip classification for long messages — likely real questions
    if word_count > 8:
        return None

    for intent in intents:
        patterns: List[str] = intent.get("patterns", [])
        responses: List[str] = intent.get("responses", [])
        name: str = intent.get("name", "unknown")

        for pattern in patterns:
            norm_pat = _normalize(pattern)

            # Exact match
            if normalized == norm_pat:
                return {"name": name, "response": random.choice(responses) if responses else ""}

            # User message is a substring of pattern or vice-versa (short messages only)
            if word_count <= 6:
                if norm_pat in normalized or normalized in norm_pat:
                    return {"name": name, "response": random.choice(responses) if responses else ""}

    return None


def reload() -> int:
    """Force-reload intents from disk. Returns count of loaded intents."""
    global _intents
    _intents = []
    loaded = _load_intents()
    return len(loaded)
