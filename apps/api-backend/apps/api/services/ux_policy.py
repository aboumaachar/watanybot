from __future__ import annotations

import re

from typing import Dict, List


def _limit_steps(lines: List[str], max_steps: int = 3) -> List[str]:
    return [line for line in lines if line][:max_steps]


def _should_add_procedural_prefix(text: str) -> bool:
    if not text:
        return False
    return not re.match(r"^(عذراً|حتى أعطيك|هل تقصد|هل يمكنك|أي عنوان|سؤالك قد يشير)", text.strip())


def enforce_policy(message: str, emotional_score: float = 0.0) -> Dict[str, object]:
    """Apply UX policy to a bot reply.

    When *emotional_score* > 0.6 the reply is shortened (max 2 steps),
    technical numbering is softened, and an empathy lead-in is prepended.
    """
    lines = [line.strip() for line in (message or "").split("\n") if line.strip()]
    if not lines:
        return {"message": "", "lines": [], "emotional_score": emotional_score}

    # ── Emotional mode ────────────────────────────────────────────
    if emotional_score > 0.6:
        # Shorter: max 2 steps instead of 3
        trimmed = _limit_steps(lines, max_steps=2)
        # Softer lead-in instead of the procedural "شو تعمل هلأ:"
        trimmed[0] = f"بفهم عليك — {trimmed[0]}"
        # Strip heavy numbering (١. ٢. 1. 2. etc.)
        trimmed = [_soften_numbering(l) for l in trimmed]
        return {
            "message": "\n".join(trimmed),
            "lines": trimmed,
            "emotional_score": emotional_score,
        }
    # ──────────────────────────────────────────────────────────────

    trimmed = _limit_steps(lines, max_steps=3)
    if trimmed and _should_add_procedural_prefix(trimmed[0]):
        trimmed[0] = f"شو تعمل هلأ: {trimmed[0]}"
    return {"message": "\n".join(trimmed), "lines": trimmed, "emotional_score": emotional_score}


def _soften_numbering(text: str) -> str:
    """Remove leading step-numbers like '1.' '٢-' to reduce technical density."""
    return re.sub(r"^[\d٠-٩]+[\.\-\)\s]+", "", text).strip()


def add_caregiver_summary(message: str, summary: str) -> str:
    if not summary:
        return message
    return f"{message}\n\n{summary}"
