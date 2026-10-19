import base64
import binascii
import re
import time
import uuid
from pathlib import Path
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from database import get_db
from models import KBCard, ChatSession, ChatMessage, FeedbackQueue
from config import settings
from kb_sqlite import search_procedures, get_procedure, search_law, get_law_article, get_procedure_enrichment_batch
from services import reranker
from services import input_normalizer
from services import intent_classifier
from services import ux_policy
from services import whatsapp_ui
from schemas import (
    KBSearchResponse, KBSearchResult, KBCardResponse,
    ChatRequest, ChatResponse, FeedbackCreateRequest
)
import structlog

logger = structlog.get_logger()
router = APIRouter()
CLARIFY_APOLOGY = "حتى أعطيك جواباً دقيقاً، أحتاج منك تحديد المعاملة المقصودة."
UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "data" / "uploads"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
PNG_DATA_URL = re.compile(r"^data:image/png;base64,(?P<data>[A-Za-z0-9+/=]+)$", re.IGNORECASE)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


class UploadRequest(BaseModel):
    dataUrl: str


@router.post("/api/files/upload")
async def upload_file(request: UploadRequest):
    match = PNG_DATA_URL.fullmatch(request.dataUrl.strip())
    if not match:
        raise HTTPException(status_code=415, detail="UNSUPPORTED_IMAGE_TYPE")

    try:
        content = base64.b64decode(match.group("data"), validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="INVALID_BASE64") from None

    if not content or not content.startswith(PNG_SIGNATURE):
        raise HTTPException(status_code=400, detail="INVALID_PNG")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="UPLOAD_TOO_LARGE")

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.png"
    target = UPLOAD_ROOT / filename
    target.write_bytes(content)

    return {
        "ok": True,
        "url": f"/runtime/uploads/{filename}",
        "filename": filename,
        "mimeType": "image/png",
        "size": len(content),
    }


@router.get("/runtime/uploads/{filename}")
async def read_uploaded_file(filename: str):
    if not re.fullmatch(r"[0-9a-f]{32}\.png", filename):
        raise HTTPException(status_code=404, detail="NOT_FOUND")

    target = UPLOAD_ROOT / filename
    if not target.is_file():
        raise HTTPException(status_code=404, detail="NOT_FOUND")

    return FileResponse(target, media_type="image/png")


def build_procedure_answer(data: dict, lang: str) -> str:
    def pick(field: str) -> str:
        return data.get(f"{field}_{lang}") or data.get(field) or ""

    def format_value(value: str) -> str:
        return value if value else "غير مذكور في الدليل"

    sections = []
    for label, field in [
        ("أين تُقدَّم المعاملة", "submit_location"),
        ("المستندات المطلوبة", "required_docs"),
        ("مهلة/ملاحظات زمنية", "duration"),
        ("رسوم/مبالغ", "fees"),
        ("خطوات/إجراءات", "steps"),
        ("ملاحظات إضافية", "notes"),
    ]:
        sections.append(f"{label}: {format_value(pick(field))}")

    sections.append(f"مراجع داخلية: tx_no={data.get('tx_no', '')}")
    return "\n".join(sections)


def build_law_answer(data: dict) -> str:
    sections = []
    title = data.get("title") or ""
    body = data.get("body") or ""
    if title or body:
        summary = title if title else body[:200]
        sections.append(f"خلاصة سريعة: {summary}")
    if body:
        sections.append(f"نص المادة: {body}")
    sections.append(f"مراجع داخلية: article_no={data.get('article_no', '')}")
    return "\n".join([s for s in sections if s])


def is_ambiguous(top_score: float, second_score: float) -> bool:
    return (top_score - second_score) <= settings.sqlite_ambiguity_delta


def _enrich_procedure_candidates(lang: str, results: list) -> list:
    items = results[:10]
    tx_nos = [item.tx_no for item in items]
    try:
        batch = get_procedure_enrichment_batch(settings.kb_sqlite_path, tx_nos, lang)
    except Exception:
        batch = {}
    enriched = []
    for item in items:
        candidate = {
            "tx_no": item.tx_no,
            "title": item.title,
            "summary": item.summary,
            "score": item.score,
        }
        data = batch.get(item.tx_no, {})
        if data:
            candidate["tags_json"] = data.get("tags_json")
            candidate["section"] = data.get("section")
            candidate["starred"] = data.get("starred")
        enriched.append(candidate)
    return enriched


def _build_procedure_clarifying(top: dict, second: dict) -> str:
    return (
        f"هل تقصد إحدى هاتين المعاملتين؟ "
        f"1) {top.get('tx_no', '')} — {top.get('title', '')} "
        f"2) {second.get('tx_no', '')} — {second.get('title', '')}"
    )


def _resolve_procedure_results(
    lang: str,
    question: str,
    results: list,
) -> tuple[str, float, list, str | None, dict | None, bool, list]:
    if not results:
        return "", 0.0, [], None, None, False, []

    candidates = _enrich_procedure_candidates(lang, results)
    reranked = reranker.rerank(candidates, question, top_n=10)
    best, second = reranker.estimate_confidence(reranked)
    kb_hits = [{"tx_no": r.get("tx_no"), "score": r.get("rerank_score", 0.0)} for r in reranked]

    if not reranked:
        return "", 0.0, [], None, None, False, []

    if reranker.should_iterate(best, second, settings.sqlite_confidence_threshold, settings.sqlite_ambiguity_delta):
        return "", best, kb_hits, None, reranked[0], True, reranked

    if len(reranked) > 1 and is_ambiguous(best, second):
        clarifying = _build_procedure_clarifying(reranked[0], reranked[1])
        return CLARIFY_APOLOGY, best, kb_hits, clarifying, reranked[0], False, reranked

    procedure = get_procedure(settings.kb_sqlite_path, tx_no=reranked[0]["tx_no"], lang=lang)
    answer = build_procedure_answer(procedure, lang)
    return answer, best, kb_hits, None, reranked[0], False, reranked


def _resolve_law_results(question: str, results: list) -> tuple[str, float, list, str | None]:
    if not results:
        return "", 0.0, [], None
    candidates = [
        {"article_no": r.article_no, "preview": r.preview, "score": r.score}
        for r in results
    ]
    reranked = reranker.rerank(candidates, question, top_n=5)
    best, second = reranker.estimate_confidence(reranked)
    if not reranked or best < settings.sqlite_confidence_threshold:
        return "", 0.0, [], None

    if len(reranked) > 1 and is_ambiguous(best, second):
        clarifying = (
            f"هل تقصد إحدى هاتين المادتين؟ "
            f"1) {reranked[0].get('article_no', '')} — {reranked[0].get('preview', '')} "
            f"2) {reranked[1].get('article_no', '')} — {reranked[1].get('preview', '')}"
        )
        kb_hits = [{"article_no": r.get("article_no"), "score": r.get("rerank_score", 0.0)} for r in reranked]
        return CLARIFY_APOLOGY, best, kb_hits, clarifying

    article = get_law_article(settings.kb_sqlite_path, article_no=reranked[0]["article_no"])
    answer = build_law_answer(article)
    kb_hits = [{"article_no": r.get("article_no"), "score": r.get("rerank_score", 0.0)} for r in reranked]
    return answer, best, kb_hits, None


def resolve_sqlite_answer(lang: str, question: str) -> tuple[str, float, list, str | None, Optional[str]]:
    if not settings.use_sqlite_v3_kb or not settings.kb_sqlite_path:
        logger.warning("sqlite_kb_disabled", use_sqlite_v3_kb=settings.use_sqlite_v3_kb, kb_path=settings.kb_sqlite_path)
        return "", 0.0, [], None, None

    def _search() -> tuple[list, list]:
        sqlite_results = search_procedures(
            settings.kb_sqlite_path,
            q=question,
            limit=10,
            lang=lang,
            review_statuses=["approved"],
        )
        law_results = search_law(settings.kb_sqlite_path, q=question, limit=5)
        return sqlite_results, law_results

    def _iterative(sqlite_results: list, top_candidate: dict) -> tuple[str, float, list, str | None]:
        expanded = reranker.build_expanded_query(question, top_candidate)
        try:
            extra_results = search_procedures(
                settings.kb_sqlite_path,
                q=expanded,
                limit=10,
                lang=lang,
                review_statuses=["approved"],
            )
        except Exception:
            extra_results = []
        merged: dict[str, Any] = {r.tx_no: r for r in sqlite_results}
        for r in extra_results:
            merged.setdefault(r.tx_no, r)
        answer, confidence, kb_hits, clarifying, _, should_iterate, reranked = _resolve_procedure_results(
            lang,
            expanded,
            list(merged.values()),
        )
        if answer or clarifying:
            return answer, confidence, kb_hits, clarifying
        if should_iterate and len(reranked) > 1:
            clarifying = _build_procedure_clarifying(reranked[0], reranked[1])
            return CLARIFY_APOLOGY, confidence, kb_hits, clarifying
        return "", 0.0, [], None

    def _pending() -> tuple[str, float, list, str | None, Optional[str]]:
        if not settings.public_show_pending:
            return "", 0.0, [], None, None
        try:
            pending_results = search_procedures(
                settings.kb_sqlite_path,
                q=question,
                limit=2,
                lang=lang,
                review_statuses=["pending"],
                include_null_as_approved=False,
            )
        except Exception:
            pending_results = []
        if not pending_results:
            return "", 0.0, [], None, None
        pending_results.sort(key=lambda r: r.score, reverse=True)
        top_pending = pending_results[0]
        if top_pending.score >= settings.sqlite_confidence_threshold:
            clarifying = "عذراً، لا يمكنني تأكيد الإجابة قبل مراجعة بشرية. هل يمكنك توضيح المعاملة المطلوبة؟"
            kb_hits = [{"tx_no": top_pending.tx_no, "score": top_pending.score, "status": "pending"}]
            return "", top_pending.score, kb_hits, clarifying, top_pending.tx_no
        return "", 0.0, [], None, None

    try:
        sqlite_results, law_results = _search()
    except Exception as exc:
        logger.error("sqlite_kb_search_failed", error=str(exc), kb_path=settings.kb_sqlite_path)
        return "", 0.0, [], None, None

    logger.info("sqlite_kb_search_results", procedure_count=len(sqlite_results), law_count=len(law_results))

    answer, confidence, kb_hits, clarifying, top_candidate, should_iterate, _ = _resolve_procedure_results(
        lang,
        question,
        sqlite_results,
    )
    if answer or clarifying:
        return answer, confidence, kb_hits, clarifying, None

    if should_iterate and top_candidate:
        answer, confidence, kb_hits, clarifying = _iterative(sqlite_results, top_candidate)
        if answer or clarifying:
            return answer, confidence, kb_hits, clarifying, None

    pending_answer, pending_conf, pending_hits, pending_clarify, pending_tx = _pending()
    if pending_answer or pending_clarify or pending_tx:
        return pending_answer, pending_conf, pending_hits, pending_clarify, pending_tx

    answer, confidence, kb_hits, clarifying = _resolve_law_results(question, law_results)
    return answer, confidence, kb_hits, clarifying, None


def resolve_postgres_fallback(lang: str, question: str, db: Session) -> tuple[str, float, list]:
    if not settings.legacy_postgres_kb_fallback:
        return "", 0.0, []

    search_results = db.query(
        KBCard.id,
        KBCard.slug,
        KBCard.locales,
        func.ts_rank_cd(KBCard.fts, func.plainto_tsquery('simple', question)).label('rank')
    ).filter(
        KBCard.status == 'published',
        KBCard.fts.op('@@')(func.plainto_tsquery('simple', question))
    ).order_by(
        text('rank DESC')
    ).limit(3).all()

    if not search_results:
        return "", 0.0, []

    top_card = search_results[0]
    locale_data = top_card.locales.get(lang, top_card.locales.get('en', {}))
    answer = f"{locale_data.get('summary', '')}\n\n"
    answer += f"مراجع داخلية: card_id={top_card.id}"
    confidence = float(top_card.rank)
    kb_hits = [{"id": str(row.id), "slug": row.slug, "score": float(row.rank)} for row in search_results]
    return answer, confidence, kb_hits


def detect_language(text: str) -> str:
    """Detect if text is primarily Arabic or English based on character ranges."""
    arabic_chars = len(re.findall(r'[\u0600-\u06FF]', text))
    english_chars = len(re.findall(r'[a-zA-Z]', text))
    
    if arabic_chars > english_chars:
        return "ar"
    return "en"


def build_action_intents(question: str, answer: str) -> List[dict]:
    intents: List[dict] = []
    combined = f"{question} {answer}".lower()

    if re.search(r"\bhttps?://", answer):
        intents.append({"type": "open_url"})
    if re.search(r"اتصل|هاتف|رقم|phone|call", combined):
        intents.append({"type": "call_phone"})
    if re.search(r"اين|وين|عنوان|location|address", question.lower()):
        intents.append({"type": "request_location"})
    if re.search(r"صورة|وثيقة|مستند|document|photo", question.lower()):
        intents.append({"type": "request_photo"})
    if re.search(r"صوت|voice", question.lower()):
        intents.append({"type": "request_voice"})

    return intents


def _get_or_create_session(
    db: Session,
    request: ChatRequest,
    lang: str,
    client_ip: str,
    channel: str,
) -> ChatSession:
    if request.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if not session.meta:
            session.meta = {}
        session.meta.setdefault("client_ip", client_ip)
        session.meta.setdefault("channel", channel)
        if request.phone_number:
            session.meta.setdefault("phone_number", request.phone_number)
        return session

    session = ChatSession(meta={
        "lang": lang,
        "client_ip": client_ip,
        "channel": channel,
        "phone_number": request.phone_number,
    })
    db.add(session)
    db.flush()
    return session


def _capture_feedback(
    db: Session,
    session_id: uuid.UUID,
    question: str,
    lang: str,
    source: str,
    kb_hits: list,
    pending_tx_no: Optional[str],
    channel: str,
    phone_number: Optional[str],
) -> None:
    feedback_item = FeedbackQueue(
        session_id=session_id,
        question=question,
        lang=lang,
        suggested_kb_ids=None,
        status="open",
        resolution={
            "capture": {
                "message": question,
                "tx_no": pending_tx_no,
                "article_no": None,
                "rating": None,
                "correction_text": None,
                "suggested_mapping": None,
                "source": source,
                "best_candidates": kb_hits,
                "channel": channel,
                "phone_number": phone_number,
            }
        },
    )
    db.add(feedback_item)


def _resolve_channel(request: ChatRequest, channel_header: Optional[str]) -> str:
    channel = (request.channel or channel_header or "web").strip().lower()
    return channel if channel in {"web", "whatsapp"} else "web"


def _build_whatsapp_payloads(
    answer: str,
    clarifying_question: Optional[str],
    action_intents: List[dict],
) -> List[dict]:
    payloads: List[dict] = []
    interactive_enabled = bool(settings.whatsapp_interactive_enabled)

    if clarifying_question:
        payloads.append(whatsapp_ui.build_text(clarifying_question))

    if answer:
        for chunk in whatsapp_ui.split_text(answer):
            payloads.append(whatsapp_ui.build_text(chunk))

    payloads.extend(whatsapp_ui.render_action_intents(action_intents, interactive_enabled))
    return payloads


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "watanbot-api",
        "timestamp": time.time()
    }


@router.get("/kb/search", response_model=KBSearchResponse)
async def search_kb(
    q: str = Query(..., min_length=2),
    lang: Optional[str] = Query(None, pattern="^(ar|en)$"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Search knowledge base using PostgreSQL full-text search."""
    start_time = time.time()
    
    # Detect language if not provided
    if not lang:
        lang = detect_language(q)
    
    # Use plainto_tsquery for safe query parsing
    query = db.query(
        KBCard.id,
        KBCard.slug,
        KBCard.locales,
        func.ts_rank_cd(KBCard.fts, func.plainto_tsquery('simple', q)).label('rank')
    ).filter(
        KBCard.status == 'published',
        KBCard.fts.op('@@')(func.plainto_tsquery('simple', q))
    ).order_by(
        text('rank DESC')
    ).limit(limit)
    
    results = query.all()
    
    # Format results
    items = []
    for row in results:
        locale_data = row.locales.get(lang, row.locales.get('en', row.locales.get('ar', {})))
        items.append(KBSearchResult(
            id=row.id,
            slug=row.slug,
            title=locale_data.get('title', ''),
            summary=locale_data.get('summary', ''),
            score=float(row.rank)
        ))
    
    took_ms = int((time.time() - start_time) * 1000)
    
    return KBSearchResponse(
        items=items,
        total=len(items),
        took_ms=took_ms
    )


@router.get("/kb/card/{card_id}", response_model=KBCardResponse)
async def get_kb_card(
    card_id: uuid.UUID,
    lang: Optional[str] = Query(None, pattern="^(ar|en)$"),
    db: Session = Depends(get_db)
):
    """Get a single KB card by ID."""
    card = db.query(KBCard).filter(
        KBCard.id == card_id,
        KBCard.status == 'published'
    ).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    return card


@router.post("/chat/ask", response_model=ChatResponse)
async def chat_ask(
    request: ChatRequest,
    http_request: Request,
    channel_header: Optional[str] = Header(default=None, alias="X-Channel"),
    db: Session = Depends(get_db)
):
    """
    Chat endpoint with KB-backed responses.
    
    Flow:
    1. Detect language
    2. Search SQLite v3 KB for relevant procedures/law
    3. If good match: respond with top procedure/article
    4. If ambiguous: ask one clarifying question with two options
    5. If low/no match: ask one clarifying question and create feedback
    """
    channel = _resolve_channel(request, channel_header)
    lang = request.lang or detect_language(request.question)
    client_ip = http_request.client.host if http_request.client else "unknown"

    t0 = time.perf_counter()
    session = _get_or_create_session(db, request, lang, client_ip, channel)
    t_session = time.perf_counter()

    normalized = input_normalizer.normalize_input(
        request.question,
        arabizi_enabled=settings.arabizi_enabled,
        keyboard_fix_enabled=settings.keyboard_garble_fix_enabled,
    )
    if normalized["clarify_needed"]:
        clarifying_question = (
            f"هل تقصد (1) {normalized['candidates'][0]} أم (2) {normalized['candidates'][1]}؟"
        )
        action_intents = build_action_intents(request.question, "")
        whatsapp_payloads = None
        if channel == "whatsapp":
            whatsapp_payloads = _build_whatsapp_payloads("", clarifying_question, action_intents)
        return ChatResponse(
            answer="",
            lang=lang,
            session_id=session.id,
            kb_hits=[],
            confidence=0.0,
            clarifying_question=clarifying_question,
            action_intents=action_intents,
            whatsapp_payloads=whatsapp_payloads,
        )

    question = normalized["normalized"]
    t_norm = time.perf_counter()

    # ── Small-talk fast path ──────────────────────────────────
    chitchat = intent_classifier.classify(question)
    if chitchat:
        logger.info("chat_ask_chitchat", intent=chitchat["name"])
        whatsapp_payloads = None
        if channel == "whatsapp":
            whatsapp_payloads = _build_whatsapp_payloads(chitchat["response"], None, [])
        return ChatResponse(
            answer=chitchat["response"],
            lang=lang,
            session_id=session.id,
            kb_hits=[],
            confidence=1.0,
            clarifying_question=None,
            action_intents=[],
            whatsapp_payloads=whatsapp_payloads,
        )
    # ─────────────────────────────────────────────────────────

    answer, confidence, kb_hits, clarifying_question, pending_tx_no = resolve_sqlite_answer(lang, question)
    t_kb = time.perf_counter()

    logger.info(
        "chat_ask_timing",
        session_ms=round((t_session - t0) * 1000, 1),
        normalize_ms=round((t_norm - t_session) * 1000, 1),
        kb_ms=round((t_kb - t_norm) * 1000, 1),
        total_ms=round((t_kb - t0) * 1000, 1),
        confidence=confidence,
    )

    feedback_created = False
    if not answer:
        if pending_tx_no:
            confidence = 0.1
            answer = "عذراً، المعاملة المقترحة قيد المراجعة البشرية حالياً."
            clarifying_question = clarifying_question or "حدّد اسم المعاملة أو اذكر تفصيلاً إضافياً، وأنا أكمل معك مباشرة."
            _capture_feedback(
                db,
                session.id,
                question,
                lang,
                "chat_pending_match",
                kb_hits,
                pending_tx_no,
                channel,
                request.phone_number,
            )
            feedback_created = True
        else:
            confidence = 0.05
            answer = "عذراً، لم أتمكن من إيجاد إجابة دقيقة من قاعدة المعرفة الحالية."
            clarifying_question = "حدّد اسم المعاملة أو اذكر تفصيلاً إضافياً، وأنا أكمل معك مباشرة."
            _capture_feedback(
                db,
                session.id,
                question,
                lang,
                "chat_no_match",
                kb_hits,
                None,
                channel,
                request.phone_number,
            )
            feedback_created = True

    if (not answer or confidence < settings.sqlite_confidence_threshold) and not feedback_created:
        _capture_feedback(
            db,
            session.id,
            question,
            lang,
            "chat_low_confidence",
            kb_hits,
            pending_tx_no,
            channel,
            request.phone_number,
        )

    policy = ux_policy.enforce_policy(answer, emotional_score=intent_classifier.emotional_score(question))
    answer = policy["message"]

    # Log user message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        lang=lang,
        content=question,
        confidence=None
    )
    db.add(user_msg)
    
    # Log assistant response
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        lang=lang,
        content=answer,
        kb_hit_ids=None,
        confidence=confidence
    )
    db.add(assistant_msg)
    
    db.commit()
    
    action_intents = build_action_intents(request.question, answer)
    if confidence < settings.sqlite_confidence_threshold:
        action_intents.append({"type": "create_followup_ticket"})

    whatsapp_payloads = None
    if channel == "whatsapp":
        whatsapp_payloads = _build_whatsapp_payloads(answer, clarifying_question, action_intents)

    return ChatResponse(
        answer=answer,
        lang=lang,
        session_id=session.id,
        kb_hits=kb_hits,
        confidence=confidence,
        clarifying_question=clarifying_question,
        action_intents=action_intents,
        whatsapp_payloads=whatsapp_payloads,
    )


@router.post("/api/chat", response_model=ChatResponse)
async def chat_ask_legacy(
    request: ChatRequest,
    http_request: Request,
    channel_header: Optional[str] = Header(default=None, alias="X-Channel"),
    db: Session = Depends(get_db)
):
    """Legacy alias for /chat/ask."""
    return await chat_ask(
        request=request,
        http_request=http_request,
        channel_header=channel_header,
        db=db,
    )


@router.post("/api/feedback")
async def capture_feedback(
    request: FeedbackCreateRequest,
    db: Session = Depends(get_db)
):
    """Capture feedback without auto-editing KB."""
    lang = request.lang or detect_language(request.message)

    session = None
    if request.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

    feedback_item = FeedbackQueue(
        session_id=session.id if session else None,
        question=request.message,
        lang=lang,
        suggested_kb_ids=None,
        status="open",
        resolution={
            "capture": {
                "message": request.message,
                "tx_no": request.tx_no,
                "article_no": request.article_no,
                "rating": request.rating,
                "correction_text": request.correction_text,
                "suggested_mapping": request.suggested_mapping,
                "source": "api_feedback",
            }
        },
    )
    db.add(feedback_item)
    db.commit()
    db.refresh(feedback_item)

    return {"success": True, "feedback_id": str(feedback_item.id)}
