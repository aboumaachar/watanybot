"""
KB v2 Service — loads JSONL data from apps/api-backend/data/kb_v2/
and provides search, intent routing, salary computation, ticket management,
and feedback/learning pipeline.

All KB v2 tools (watany_intent_router_lb, salary_compute_engine,
ticket_manager, learning_proposer) are imported from watany_kb/tools/
via sys.path injection.
"""
from __future__ import annotations

import json
import re
import sys
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import structlog

from .intent_classifier import classify as classify_smalltalk

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_API_DIR = Path(__file__).resolve().parents[1]           # apps/api/
_BACKEND_DIR = _API_DIR.parents[1]                       # apps/api-backend/
_KB_V2_DIR = _BACKEND_DIR / "data" / "kb_v2"
_REPO_ROOT = _BACKEND_DIR.parents[1]                     # watanybot/
_TOOLS_DIR = _REPO_ROOT / "watany_kb" / "tools"

# Inject watany_kb/tools into sys.path so we can import the engines
_tools_str = str(_TOOLS_DIR)
if _tools_str not in sys.path:
    sys.path.insert(0, _tools_str)

# ---------------------------------------------------------------------------
# Lazy imports from watany_kb/tools (they carry their own KB_ROOT resolution)
# ---------------------------------------------------------------------------
_intent_router = None
_salary_engine = None
_ticket_manager = None
_learning_proposer = None
_import_lock = threading.Lock()


def _ensure_tools():
    global _intent_router, _salary_engine, _ticket_manager, _learning_proposer
    if _intent_router is not None:
        return
    with _import_lock:
        if _intent_router is not None:
            return
        try:
            import watany_intent_router_lb as _ir
            _intent_router = _ir
            logger.info("kb_v2_loaded_intent_router")
        except Exception as exc:
            logger.warning("kb_v2_intent_router_failed", error=str(exc))

        try:
            import salary_compute_engine as _se
            _salary_engine = _se
            logger.info("kb_v2_loaded_salary_engine")
        except Exception as exc:
            logger.warning("kb_v2_salary_engine_failed", error=str(exc))

        try:
            import ticket_manager as _tm
            _ticket_manager = _tm
            logger.info("kb_v2_loaded_ticket_manager")
        except Exception as exc:
            logger.warning("kb_v2_ticket_manager_failed", error=str(exc))

        try:
            import learning_proposer as _lp
            _learning_proposer = _lp
            logger.info("kb_v2_loaded_learning_proposer")
        except Exception as exc:
            logger.warning("kb_v2_learning_proposer_failed", error=str(exc))


# ---------------------------------------------------------------------------
# JSONL data cache
# ---------------------------------------------------------------------------
_law_nodes: List[Dict] = []
_procedures: List[Dict] = []
_chunks: List[Dict] = []
_response_templates: List[Dict] = []
_router_json: Dict = {}
_topcards: List[Dict] = []
_faq_v3: List[Dict] = []
_directory_phonebook: List[Dict] = []
_escalation_rules: Dict = {}
_prepared_answers: List[Dict] = []
_data_loaded = False
_data_lock = threading.Lock()


def _load_jsonl(path: Path) -> List[Dict]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text("utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
    return rows


def _load_json(path: Path) -> Dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text("utf-8"))


def _ensure_data():
    global _law_nodes, _procedures, _chunks, _response_templates, _router_json
    global _topcards, _faq_v3, _directory_phonebook, _escalation_rules, _prepared_answers
    global _data_loaded
    if _data_loaded:
        return
    with _data_lock:
        if _data_loaded:
            return
        _law_nodes = _load_jsonl(_KB_V2_DIR / "law" / "law_nodes.jsonl")
        _procedures = _load_jsonl(_KB_V2_DIR / "cards" / "procedures.jsonl")
        _chunks = _load_jsonl(_KB_V2_DIR / "rag" / "chunks.jsonl")
        _response_templates = _load_jsonl(_KB_V2_DIR / "response_templates_lb.jsonl")
        _router_json = _load_json(_KB_V2_DIR / "router.json")

        # v3 overlay data
        tc_raw = _load_json(_KB_V2_DIR / "topcards_v3.json")
        _topcards = tc_raw.get("cards", tc_raw.get("topcards", [])) if isinstance(tc_raw, dict) else (tc_raw if isinstance(tc_raw, list) else [])
        faq_raw = _load_json(_KB_V2_DIR / "faq_v3.json")
        _faq_v3 = faq_raw.get("items", faq_raw.get("faq", [])) if isinstance(faq_raw, dict) else (faq_raw if isinstance(faq_raw, list) else [])
        _directory_phonebook = _load_json(_KB_V2_DIR / "admin" / "directory_phonebook_lb.json")
        _escalation_rules = _load_json(_KB_V2_DIR / "admin" / "escalation_rules_lb.json")
        _prepared_answers = []
        pa_raw = _load_json(_KB_V2_DIR / "admin" / "prepared_answers_lb.json")
        if isinstance(pa_raw, dict):
            _prepared_answers = pa_raw.get("answers", pa_raw.get("items", []))
        elif isinstance(pa_raw, list):
            _prepared_answers = pa_raw

        logger.info(
            "kb_v2_data_loaded",
            law_nodes=len(_law_nodes),
            procedures=len(_procedures),
            chunks=len(_chunks),
            templates=len(_response_templates),
            topcards=len(_topcards),
            faq=len(_faq_v3),
        )
        _data_loaded = True


def reload_data():
    """Force-reload all KB v2 data from disk."""
    global _data_loaded
    _data_loaded = False
    _ensure_data()
    return {
        "law_nodes": len(_law_nodes),
        "procedures": len(_procedures),
        "chunks": len(_chunks),
        "templates": len(_response_templates),
        "topcards": len(_topcards),
        "faq": len(_faq_v3),
    }


# ---------------------------------------------------------------------------
# v3 overlay accessors
# ---------------------------------------------------------------------------
def get_topcards() -> List[Dict]:
    """Return top cards for the home screen / quick-access."""
    _ensure_data()
    return _topcards


def get_faq() -> List[Dict]:
    """Return FAQ items."""
    _ensure_data()
    return _faq_v3


def get_directory_phonebook() -> Any:
    """Return directory/phonebook data."""
    _ensure_data()
    return _directory_phonebook


def get_escalation_rules() -> Dict:
    """Return escalation rules."""
    _ensure_data()
    return _escalation_rules


def get_prepared_answers() -> List[Dict]:
    """Return prepared answers for common queries."""
    _ensure_data()
    return _prepared_answers


# ---------------------------------------------------------------------------
# Arabic text helpers
# ---------------------------------------------------------------------------
_AR_DIACRITICS = re.compile(
    r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]"
)


def _normalize_ar(text: str) -> str:
    t = _AR_DIACRITICS.sub("", text or "")
    t = re.sub(r"[إأآٱ]", "ا", t)
    t = t.replace("ة", "ه")
    return t.lower().strip()


def _tokenize(text: str) -> List[str]:
    cleaned = re.sub(r"[^\w\u0600-\u06FF]", " ", text or "")
    return [w for w in cleaned.lower().split() if len(w) > 1]


# ---------------------------------------------------------------------------
# Search: hybrid across law_nodes + procedures + RAG chunks
# ---------------------------------------------------------------------------
def search_kb_v2(
    query: str,
    limit: int = 10,
    domain_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Full-text keyword search across KB v2 data.
    Returns unified results with source type, score, and content.
    """
    _ensure_data()
    terms = _tokenize(_normalize_ar(query))
    raw_terms = _tokenize(query)
    all_terms = list(set(terms + raw_terms))

    if not all_terms:
        return []

    results: List[Dict[str, Any]] = []

    # Search law nodes
    for node in _law_nodes:
        searchable = " ".join([
            node.get("law_name", ""),
            node.get("text", ""),
            node.get("title", ""),
            node.get("body", ""),
            " ".join(node.get("topic_tags", [])),
        ])
        score = _score_match(all_terms, searchable)
        if score > 0 and (not domain_filter or node.get("domain") == domain_filter):
            title_display = node.get("law_name", node.get("title", ""))
            art = node.get("article_number")
            if art:
                title_display = f"{title_display} — المادة {art}"
            body_display = (node.get("text", "") or node.get("body", "") or "")[:300]
            results.append({
                "source": "law_node",
                "id": node.get("id", ""),
                "title": title_display,
                "body": body_display,
                "domain": node.get("domain", ""),
                "score": score,
            })

    # Search procedure cards
    for card in _procedures:
        searchable = " ".join([
            card.get("title_lb", ""),
            card.get("title_formal", ""),
            card.get("summary_lb", ""),
            " ".join(card.get("topic_tags", [])),
            " ".join(card.get("use_when_lb", [])),
        ])
        score = _score_match(all_terms, searchable)
        if score > 0 and (not domain_filter or card.get("domain") == domain_filter):
            results.append({
                "source": "procedure",
                "id": card.get("id", ""),
                "title": card.get("title_lb", card.get("title_formal", "")),
                "body": card.get("summary_lb", "")[:300],
                "domain": card.get("domain", ""),
                "score": score,
            })

    # Search RAG chunks
    for chunk in _chunks:
        searchable = chunk.get("text", "")
        score = _score_match(all_terms, searchable)
        if score > 0:
            results.append({
                "source": "rag_chunk",
                "id": chunk.get("id", ""),
                "title": chunk.get("source_file", ""),
                "body": (chunk.get("text", "") or "")[:300],
                "domain": chunk.get("domain", "general"),
                "score": score,
            })

    # Sort by score desc, take top N
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]


def _score_match(terms: List[str], text: str) -> float:
    """Score how well terms match the text (simple BM25-like scoring)."""
    if not terms or not text:
        return 0.0
    normalized = _normalize_ar(text)
    hits = 0
    total_weight = 0
    for term in terms:
        weight = 2.0 if len(term) >= 5 else 1.0
        if term in normalized:
            hits += weight
        total_weight += weight
    return round(hits / max(total_weight, 1.0), 4) if hits > 0 else 0.0


# ---------------------------------------------------------------------------
# Get specific items
# ---------------------------------------------------------------------------
def get_law_node(node_id: str) -> Optional[Dict]:
    _ensure_data()
    for node in _law_nodes:
        if node.get("id") == node_id:
            return node
    return None


def get_procedure_card(card_id: str) -> Optional[Dict]:
    _ensure_data()
    for card in _procedures:
        if card.get("id") == card_id:
            return card
    return None


def get_chunk(chunk_id: str) -> Optional[Dict]:
    _ensure_data()
    for chunk in _chunks:
        if chunk.get("id") == chunk_id:
            return chunk
    return None


# ---------------------------------------------------------------------------
# Intent routing
# ---------------------------------------------------------------------------
def resolve_intent(user_message: str, context: Optional[Dict] = None) -> Dict[str, Any]:
    """Resolve intent using the Lebanese intent router."""
    _ensure_tools()
    if _intent_router is None:
        return {
            "intent": "other",
            "domain": "general",
            "request_type": "info",
            "urgency": "normal",
            "slots_filled": {},
            "slots_missing": [],
            "next_question_lb": "عذراً، نظام التوجيه غير متوفر حالياً.",
            "confidence": 0.0,
            "menu": [],
        }
    return _intent_router.resolve_intent(user_message, context)


# ---------------------------------------------------------------------------
# Build answer from KB v2 search results + intent
# ---------------------------------------------------------------------------
def build_answer(
    intent_result: Dict[str, Any],
    search_results: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Given intent routing result + KB search hits, build a structured answer.
    Returns {answer_lb, answer_formal, confidence, kb_hits, clarifying, ticket}.
    """
    _ensure_data()
    _ensure_tools()

    intent = intent_result.get("intent", "other")
    domain = intent_result.get("domain", "general")
    slots_missing = intent_result.get("slots_missing", [])
    next_q = intent_result.get("next_question_lb", "")
    confidence = intent_result.get("confidence", 0.0)

    # If slots are missing, ask for them first
    if slots_missing and next_q:
        return {
            "answer_lb": next_q,
            "answer_formal": "",
            "confidence": confidence,
            "kb_hits": [],
            "clarifying": next_q,
            "ticket": None,
            "intent": intent,
            "domain": domain,
        }

    # Try to find a matching response template
    template_resp = _find_template(intent, domain)

    # Build answer from top search results
    if search_results:
        top = search_results[0]
        answer_parts = []

        if template_resp:
            answer_parts.append(template_resp)

        if top["source"] == "procedure":
            card = get_procedure_card(top["id"])
            if card:
                answer_parts.append(_format_procedure_answer(card))
        elif top["source"] == "law_node":
            node = get_law_node(top["id"])
            if node:
                answer_parts.append(_format_law_answer(node))
        else:
            answer_parts.append(top.get("body", ""))

        answer_lb = "\n\n".join(filter(None, answer_parts))
        hit_confidence = max(confidence, top["score"])
    else:
        answer_lb = template_resp or "عذراً، ما لقيت معلومات عن هيدا الموضوع بقاعدة البيانات."
        hit_confidence = confidence

    # Auto-escalation check
    ticket = None
    if _ticket_manager and hit_confidence < 0.3:
        ticket = _ticket_manager.auto_escalate(
            intent_result,
            conversation_id="",
            user_id=""
        )

    return {
        "answer_lb": answer_lb,
        "answer_formal": "",
        "confidence": round(hit_confidence, 3),
        "kb_hits": [{"id": r["id"], "source": r["source"], "score": r["score"]} for r in search_results[:5]],
        "clarifying": None,
        "ticket": {"id": ticket["id"]} if ticket else None,
        "intent": intent,
        "domain": domain,
    }


def _find_template(intent: str, domain: str) -> Optional[str]:
    """Find a response template matching intent/domain."""
    for tpl in _response_templates:
        if tpl.get("intent") == intent or tpl.get("domain") == domain:
            return tpl.get("intro_lb", "")
    return None


def _format_formal_ref(ref: Any) -> str:
    """Render a legal reference into a user-facing label."""
    def _clean(value: Any) -> str:
        return re.sub(r"\s+", " ", str(value or "")).strip()

    if isinstance(ref, str):
        return _clean(ref)

    if not isinstance(ref, dict):
        return ""

    source = ref.get("source") or {}
    law_name = _clean(
        str(
            ref.get("law_name")
            or ref.get("title")
            or source.get("title")
            or source.get("file")
            or ""
        )
    )
    article = _clean(ref.get("article_number") or source.get("article") or "")

    if law_name.lower().endswith(".txt"):
        law_name = law_name[:-4]

    if not law_name:
        return ""

    if article:
        return f"{law_name} — المادة {article}"
    return law_name


def _format_procedure_answer(card: Dict) -> str:
    """Format a procedure card into a Lebanese-dialect answer."""
    parts = []
    title = card.get("title_lb") or card.get("title_formal", "")
    if title:
        parts.append(f"📋 {title}")

    summary = card.get("summary_lb", "")
    if summary:
        parts.append(summary)

    pack = card.get("answer_pack_lb", {})
    if pack.get("where"):
        parts.append("📍 وين تتقدّم: " + " / ".join(pack["where"]))
    if pack.get("docs"):
        parts.append("📄 الأوراق المطلوبة: " + " / ".join(pack["docs"]))
    if pack.get("do_now"):
        parts.append("✅ الخطوات: " + " → ".join(pack["do_now"]))
    if pack.get("deadline"):
        parts.append(f"⏰ المهلة: {pack['deadline']}")

    refs = card.get("formal_refs", {})
    if refs.get("laws"):
        formatted_refs = []
        seen_refs = set()
        for ref in refs["laws"]:
            label = _format_formal_ref(ref)
            if not label or label in seen_refs:
                continue
            seen_refs.add(label)
            formatted_refs.append(label)
        if formatted_refs:
            parts.append("⚖️ الأساس القانوني: " + " ، ".join(formatted_refs))

    return "\n".join(parts)


def _format_law_answer(node: Dict) -> str:
    """Format a law node into an answer."""
    parts = []
    law_name = node.get("law_name", node.get("title", ""))
    art = node.get("article_number")
    if law_name:
        title = f"⚖️ {law_name}"
        if art:
            title += f" — المادة {art}"
        parts.append(title)

    body = node.get("text", node.get("body", ""))
    if body:
        parts.append(body[:500])

    source = node.get("source", "")
    if source:
        source_label = _format_formal_ref(source)
        parts.append(f"📖 المصدر: {source_label or source}")

    return "\n".join(parts)


def _check_prepared_answer(user_message: str, intent: str, domain: str) -> Optional[str]:
    """Check if there's a prepared answer matching the query."""
    _ensure_data()
    if not _prepared_answers:
        return None
    msg_lower = _normalize_ar(user_message)
    for pa in _prepared_answers:
        triggers = pa.get("triggers", pa.get("keywords", []))
        for trigger in triggers:
            if _normalize_ar(trigger) in msg_lower:
                return pa.get("answer_lb", pa.get("answer", ""))
    return None


def _check_faq(user_message: str) -> Optional[Dict]:
    """Check if the user's question matches an FAQ item."""
    _ensure_data()
    if not _faq_v3:
        return None
    msg_lower = _normalize_ar(user_message)
    best_match = None
    best_score = 0.0
    for item in _faq_v3:
        q = item.get("question", item.get("q", ""))
        keywords = item.get("keywords", [])
        searchable = _normalize_ar(q + " " + " ".join(keywords))
        terms = _tokenize(msg_lower)
        score = _score_match(terms, searchable)
        if score > best_score and score >= 0.3:
            best_score = score
            best_match = item
    return best_match


# ---------------------------------------------------------------------------
# Full chat pipeline (intent → search → answer)
# ---------------------------------------------------------------------------
def chat_v2(
    user_message: str,
    context: Optional[Dict] = None,
    conversation_id: str = "",
    user_id: str = "",
) -> Dict[str, Any]:
    """
    Full KB v2 chat pipeline:
    1. Resolve intent (Lebanese dialect-first)
    2. If salary_compute → run salary engine
    3. Search KB v2 by domain
    4. Build structured answer
    5. Auto-escalate if needed
    """
    smalltalk = classify_smalltalk(user_message)
    if smalltalk:
        intent_name = smalltalk.get("name", "smalltalk")
        return {
            "answer_lb": smalltalk.get("response", ""),
            "answer_formal": "",
            "confidence": 0.99,
            "kb_hits": [],
            "clarifying": None,
            "ticket": None,
            "intent": intent_name,
            "domain": "chitchat",
            "intent_result": {
                "intent": intent_name,
                "domain": "chitchat",
                "request_type": "chat",
                "urgency": "normal",
                "slots_filled": {},
                "slots_missing": [],
                "confidence": 0.99,
            },
            "menu": [],
        }

    intent_result = resolve_intent(user_message, context)
    intent = intent_result.get("intent", "other")
    domain = intent_result.get("domain", "general")

    # Special handling for salary compute
    if intent == "salary_compute":
        return _handle_salary(intent_result, user_message)

    # Check prepared answers first (fast path)
    prepared = _check_prepared_answer(user_message, intent, domain)
    if prepared:
        return {
            "answer_lb": prepared,
            "answer_formal": "",
            "confidence": 0.92,
            "kb_hits": [],
            "clarifying": None,
            "ticket": None,
            "intent": intent,
            "domain": domain,
            "intent_result": {
                "intent": intent, "domain": domain,
                "request_type": intent_result.get("request_type"),
                "urgency": intent_result.get("urgency", "normal"),
                "slots_filled": intent_result.get("slots_filled", {}),
                "slots_missing": [], "confidence": 0.92,
            },
            "menu": intent_result.get("menu", []),
        }

    # Check FAQ
    faq_match = _check_faq(user_message)
    if faq_match:
        faq_answer = faq_match.get("answer_lb", faq_match.get("answer", faq_match.get("a", "")))
        if faq_answer:
            return {
                "answer_lb": faq_answer,
                "answer_formal": "",
                "confidence": 0.88,
                "kb_hits": [],
                "clarifying": None,
                "ticket": None,
                "intent": intent,
                "domain": domain,
                "intent_result": {
                    "intent": intent, "domain": domain,
                    "request_type": intent_result.get("request_type"),
                    "urgency": intent_result.get("urgency", "normal"),
                    "slots_filled": intent_result.get("slots_filled", {}),
                    "slots_missing": [], "confidence": 0.88,
                },
                "menu": intent_result.get("menu", []),
            }

    # Search KB v2
    search_results = search_kb_v2(
        query=user_message,
        limit=10,
        domain_filter=domain if domain != "general" else None,
    )

    # Build answer
    answer = build_answer(intent_result, search_results)

    # If confidence too low, also try without domain filter
    if answer["confidence"] < 0.2 and domain != "general":
        broader_results = search_kb_v2(query=user_message, limit=10)
        if broader_results and broader_results[0]["score"] > (search_results[0]["score"] if search_results else 0):
            answer = build_answer(intent_result, broader_results)

    return {
        **answer,
        "intent_result": {
            "intent": intent_result.get("intent"),
            "domain": intent_result.get("domain"),
            "request_type": intent_result.get("request_type"),
            "urgency": intent_result.get("urgency"),
            "slots_filled": intent_result.get("slots_filled", {}),
            "slots_missing": intent_result.get("slots_missing", []),
            "confidence": intent_result.get("confidence", 0.0),
        },
        "menu": intent_result.get("menu", []),
    }


def _handle_salary(intent_result: Dict, user_message: str) -> Dict[str, Any]:
    """Handle salary_compute intent — check slots, compute if ready."""
    _ensure_tools()
    slots = intent_result.get("slots_filled", {})
    missing = intent_result.get("slots_missing", [])

    if missing:
        return {
            "answer_lb": intent_result.get("next_question_lb", "خبرني شو رتبتك وقديش سنين خدمتك؟"),
            "answer_formal": "",
            "confidence": intent_result.get("confidence", 0.5),
            "kb_hits": [],
            "clarifying": intent_result.get("next_question_lb"),
            "ticket": None,
            "intent": "salary_compute",
            "domain": "salary",
            "intent_result": {
                "intent": "salary_compute",
                "domain": "salary",
                "request_type": "salary",
                "urgency": intent_result.get("urgency", "normal"),
                "slots_filled": slots,
                "slots_missing": missing,
                "confidence": intent_result.get("confidence", 0.5),
            },
            "menu": intent_result.get("menu", []),
        }

    # All slots filled → compute
    if _salary_engine:
        result = _salary_engine.compute_pension(
            rank=slots.get("rank", ""),
            degree=slots.get("degree", "1"),
            category=slots.get("category", "ضابط"),
            service_years=int(slots.get("service_years", 0)),
            spouse=slots.get("spouse", False),
            children=int(slots.get("children", 0)),
            parent_dependent=int(slots.get("parent_dependent", 0)),
            medals=slots.get("medals"),
        )
        answer_lb = result.get("summary_lb", result.get("message_lb", ""))
        return {
            "answer_lb": answer_lb,
            "answer_formal": result.get("summary_formal", ""),
            "confidence": 0.95,
            "kb_hits": [],
            "clarifying": None,
            "ticket": None,
            "intent": "salary_compute",
            "domain": "salary",
            "salary_breakdown": result.get("breakdown"),
            "intent_result": {
                "intent": "salary_compute",
                "domain": "salary",
                "request_type": "salary",
                "urgency": intent_result.get("urgency", "normal"),
                "slots_filled": slots,
                "slots_missing": [],
                "confidence": 0.95,
            },
            "menu": intent_result.get("menu", []),
        }

    return {
        "answer_lb": "حاسبة الراتب غير متوفرة حالياً.",
        "answer_formal": "",
        "confidence": 0.1,
        "kb_hits": [],
        "clarifying": None,
        "ticket": None,
        "intent": "salary_compute",
        "domain": "salary",
        "intent_result": {
            "intent": "salary_compute",
            "domain": "salary",
            "request_type": "salary",
            "urgency": "normal",
            "slots_filled": slots,
            "slots_missing": missing,
            "confidence": 0.1,
        },
        "menu": intent_result.get("menu", []),
    }


# ---------------------------------------------------------------------------
# Salary compute (direct)
# ---------------------------------------------------------------------------
def compute_salary(
    rank: str,
    degree: str,
    category: str,
    service_years: int,
    spouse: bool = False,
    children: int = 0,
    parent_dependent: int = 0,
    medals: Optional[List[str]] = None,
) -> Dict[str, Any]:
    _ensure_tools()
    if _salary_engine is None:
        return {"error": True, "message_lb": "حاسبة الراتب غير متوفرة."}
    return _salary_engine.compute_pension(
        rank=rank,
        degree=degree,
        category=category,
        service_years=service_years,
        spouse=spouse,
        children=children,
        parent_dependent=parent_dependent,
        medals=medals,
    )


# ---------------------------------------------------------------------------
# Ticket management
# ---------------------------------------------------------------------------
def create_ticket(
    title_lb: str,
    description: str = "",
    category: str = "other",
    intent: str = "",
    domain: str = "",
    priority: str = "normal",
    escalation_reason: str = "unresolved",
    conversation_id: str = "",
    user_id: str = "",
) -> Optional[Dict]:
    _ensure_tools()
    if _ticket_manager is None:
        return None
    return _ticket_manager.create_ticket(
        title_lb=title_lb,
        description=description,
        category=category,
        intent=intent,
        domain=domain,
        priority=priority,
        escalation_reason=escalation_reason,
        conversation_id=conversation_id,
        user_id=user_id,
    )


def update_ticket(
    ticket_id: str,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    note: str = "",
    by: str = "admin",
) -> Optional[Dict]:
    _ensure_tools()
    if _ticket_manager is None:
        return None
    return _ticket_manager.update_ticket(ticket_id, status, assigned_to, note, by)


def list_tickets(
    status_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
) -> List[Dict]:
    _ensure_tools()
    if _ticket_manager is None:
        return []
    return _ticket_manager.list_tickets(status_filter, category_filter)


def get_ticket(ticket_id: str) -> Optional[Dict]:
    _ensure_tools()
    if _ticket_manager is None:
        return None
    all_tickets = _ticket_manager.load_tickets()
    for t in all_tickets:
        if t.get("id") == ticket_id:
            return t
    return None


# ---------------------------------------------------------------------------
# Feedback / Learning
# ---------------------------------------------------------------------------
def submit_feedback(
    user_message: str,
    bot_response: str,
    user_rating: str = "wrong",
    user_correction: str = "",
    intent_detected: str = "",
    domain_detected: str = "",
    session_id: str = "",
) -> Dict[str, Any]:
    """Submit feedback for the learning pipeline."""
    _ensure_tools()

    feedback_entry = {
        "id": f"fb_{hash(user_message + bot_response) & 0xFFFFFFFF:08x}",
        "user_message": user_message,
        "bot_response": bot_response,
        "user_rating": user_rating,
        "user_correction": user_correction,
        "intent_detected": intent_detected,
        "domain_detected": domain_detected,
        "session_id": session_id,
    }

    if _learning_proposer:
        # Classify immediately
        category = _learning_proposer.classify_feedback(feedback_entry)
        feedback_entry["failure_category"] = category

        # Save to raw feedback file
        fb_path = str(_REPO_ROOT / "watany_kb" / "learning" / "feedback_raw.jsonl")
        _learning_proposer.append_jsonl(fb_path, [feedback_entry])

    return {
        "success": True,
        "feedback_id": feedback_entry["id"],
        "failure_category": feedback_entry.get("failure_category", "unknown"),
    }


# ---------------------------------------------------------------------------
# Diagnostics
# ---------------------------------------------------------------------------
def diagnostics() -> Dict[str, Any]:
    """Return KB v2 diagnostic info."""
    _ensure_data()
    _ensure_tools()
    return {
        "kb_v2_dir": str(_KB_V2_DIR),
        "kb_v2_exists": _KB_V2_DIR.exists(),
        "law_nodes": len(_law_nodes),
        "procedures": len(_procedures),
        "chunks": len(_chunks),
        "response_templates": len(_response_templates),
        "topcards": len(_topcards),
        "faq": len(_faq_v3),
        "prepared_answers": len(_prepared_answers),
        "intent_router_loaded": _intent_router is not None,
        "salary_engine_loaded": _salary_engine is not None,
        "ticket_manager_loaded": _ticket_manager is not None,
        "learning_proposer_loaded": _learning_proposer is not None,
        "domains": list(_router_json.get("domains", {}).keys()),
    }
