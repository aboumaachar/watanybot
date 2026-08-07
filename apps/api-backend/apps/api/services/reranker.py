from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable, List, Tuple

TRIGGER_KEYWORDS = [
    "وفاة",
    "ورثة",
    "على العاتق",
    "طبابة",
    "مدرسة",
    "معاش",
]


def _tokenize(text: str) -> List[str]:
    cleaned = re.sub(r"[^\w\s\u0600-\u06FF]", " ", text or "", flags=re.UNICODE)
    return [t for t in cleaned.lower().split() if len(t) > 1]


def _parse_tags(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(v).strip().lower() for v in value if str(v).strip()]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(v).strip().lower() for v in parsed if str(v).strip()]
        except json.JSONDecodeError:
            return [t.strip().lower() for t in re.split(r"[,;]", value) if t.strip()]
    return []


def _term_overlap_score(terms: List[str], text: str) -> float:
    if not terms or not text:
        return 0.0
    lowered = text.lower()
    hits = sum(1 for t in terms if t in lowered)
    return hits / max(1, len(terms))


def rerank(candidates: Iterable[Dict[str, Any]], query: str, top_n: int = 10) -> List[Dict[str, Any]]:
    terms = _tokenize(query)
    scored: List[Tuple[float, Dict[str, Any]]] = []

    for item in candidates:
        base = float(item.get("score") or 0.0)
        title = item.get("title") or item.get("title_ar") or ""
        summary = item.get("summary") or ""
        tags = _parse_tags(item.get("tags_json"))
        section = str(item.get("section") or "")

        text_score = max(_term_overlap_score(terms, title), _term_overlap_score(terms, summary))
        tag_score = _term_overlap_score(terms, " ".join(tags))
        section_score = _term_overlap_score(terms, section)
        starred_boost = 0.05 if item.get("starred") else 0.0

        combined = min(1.0, (base * 0.6) + (text_score * 0.25) + (tag_score * 0.1) + (section_score * 0.05) + starred_boost)
        updated = dict(item)
        updated["rerank_score"] = combined
        scored.append((combined, updated))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in scored[:top_n]]


def estimate_confidence(reranked: List[Dict[str, Any]]) -> Tuple[float, float]:
    if not reranked:
        return 0.0, 0.0
    best = float(reranked[0].get("rerank_score") or 0.0)
    second = float(reranked[1].get("rerank_score") or 0.0) if len(reranked) > 1 else 0.0
    return best, second


def should_iterate(best: float, second: float, threshold: float, ambiguity_delta: float) -> bool:
    if best < threshold:
        return True
    if best and (best - second) <= ambiguity_delta:
        return True
    return False


def build_expanded_query(query: str, top_candidate: Dict[str, Any]) -> str:
    terms = _tokenize(query)
    title_terms = _tokenize(top_candidate.get("title") or top_candidate.get("title_ar") or "")
    tags_terms = _parse_tags(top_candidate.get("tags_json"))
    extras = [t for t in title_terms if t not in terms][:3]
    extras.extend([t for t in tags_terms if t not in terms][:3])
    extras.extend([t for t in TRIGGER_KEYWORDS if t not in terms][:2])
    merged = terms + [t for t in extras if t]
    return " ".join(dict.fromkeys(merged))
