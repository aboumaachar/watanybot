from __future__ import annotations

import re
from typing import Dict, List, Tuple

ARABIC_RANGE = re.compile(r"[\u0600-\u06FF]")
LATIN_RANGE = re.compile(r"[A-Za-z]")

ARABIZI_DIGITS = {
    "2": "ء",
    "3": "ع",
    "4": "غ",
    "5": "خ",
    "6": "ط",
    "7": "ح",
    "8": "ق",
    "9": "ص",
}

DIGRAPHS = {
    "kh": "خ",
    "gh": "غ",
    "sh": "ش",
    "ch": "تش",
    "th": "ث",
    "dh": "ذ",
}

EN_TO_AR = {
    "q": "ض", "w": "ص", "e": "ث", "r": "ق", "t": "ف", "y": "غ", "u": "ع", "i": "ه", "o": "خ", "p": "ح", "[": "ج", "]": "د",
    "a": "ش", "s": "س", "d": "ي", "f": "ب", "g": "ل", "h": "ا", "j": "ت", "k": "ن", "l": "م", ";": "ك", "'": "ط",
    "z": "ئ", "x": "ء", "c": "ؤ", "v": "ر", "b": "لا", "n": "ى", "m": "ة", ",": "و", ".": "ز", "/": "ظ",
}
AR_TO_EN = {v: k for k, v in EN_TO_AR.items()}


def _script_ratios(text: str) -> Tuple[float, float]:
    if not text:
        return 0.0, 0.0
    arabic = len(ARABIC_RANGE.findall(text))
    latin = len(LATIN_RANGE.findall(text))
    total = max(1, len(text))
    return arabic / total, latin / total


def _arabizi_to_ar(text: str) -> str:
    lowered = text.lower()
    for digraph, repl in DIGRAPHS.items():
        lowered = lowered.replace(digraph, repl)
    for digit, repl in ARABIZI_DIGITS.items():
        lowered = lowered.replace(digit, repl)
    return lowered


def _garble_to_ar(text: str) -> str:
    return "".join(EN_TO_AR.get(ch, ch) for ch in text)


def _garble_to_en(text: str) -> str:
    return "".join(AR_TO_EN.get(ch, ch) for ch in text)


def normalize_input(
    text: str,
    arabizi_enabled: bool = True,
    keyboard_fix_enabled: bool = True,
) -> Dict[str, object]:
    text = (text or "").strip()
    arabic_ratio, latin_ratio = _script_ratios(text)

    candidates: List[str] = []
    normalized = text
    confidence = 0.6 if text else 0.0

    if arabic_ratio > 0.2:
        confidence = 0.85
        candidates.append(text)
    else:
        if arabizi_enabled:
            arabizi = _arabizi_to_ar(text)
            if arabizi != text:
                candidates.append(arabizi)
        if keyboard_fix_enabled and latin_ratio > 0.2:
            candidates.append(_garble_to_ar(text))
        if not candidates:
            candidates.append(text)
        normalized = candidates[0]
        confidence = 0.45 if len(candidates) > 1 else 0.55

    if latin_ratio > 0.2 and arabic_ratio > 0.2:
        confidence = 0.5

    unique = []
    for cand in candidates:
        if cand and cand not in unique:
            unique.append(cand)

    if confidence < 0.5 and len(unique) < 2:
        unique.append(text)

    clarify_needed = confidence < 0.5 and len(unique) >= 2

    return {
        "normalized": normalized,
        "candidates": unique[:2],
        "confidence": confidence,
        "clarify_needed": clarify_needed,
    }
