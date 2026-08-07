"""
KB v2 Router — all KB v2 endpoints.

Prefix: /api/v2
Endpoints:
  POST /api/v2/chat           — Full chat pipeline (intent → search → answer)
  GET  /api/v2/search         — Direct KB v2 search
  POST /api/v2/intent         — Intent classification only
  POST /api/v2/salary/compute — Salary/pension computation
  POST /api/v2/tickets        — Create ticket
  GET  /api/v2/tickets        — List tickets
  GET  /api/v2/tickets/{id}   — Get ticket
  PATCH /api/v2/tickets/{id}  — Update ticket
  POST /api/v2/feedback       — Submit feedback
  GET  /api/v2/diagnostics    — KB v2 health diagnostics
  POST /api/v2/reload         — Reload KB v2 data from disk
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from schemas_kb_v2 import (
    ChatV2Request,
    ChatV2Response,
    IntentInfo,
    KBHit,
    SearchV2Response,
    SearchHit,
    IntentV2Request,
    IntentV2Response,
    SalaryComputeRequest,
    SalaryComputeResponse,
    SalaryBreakdown,
    TicketCreateRequest,
    TicketUpdateRequest,
    TicketResponse,
    TicketListResponse,
    FeedbackV2Request,
    FeedbackV2Response,
    DiagnosticsV2Response,
)
from services import kb_v2_service as svc

router = APIRouter(prefix="/api/v2", tags=["KBv2"])


# ──────────────────────────────────────────────────────────────
# Chat
# ──────────────────────────────────────────────────────────────
@router.post("/chat", response_model=ChatV2Response)
async def chat_v2(request: ChatV2Request):
    """
    Full KB v2 chat pipeline:
    intent routing → KB search → answer building → auto-escalation.
    """
    result = svc.chat_v2(
        user_message=request.question,
        context=request.context,
    )
    return ChatV2Response(
        answer_lb=result.get("answer_lb", ""),
        answer_formal=result.get("answer_formal", ""),
        confidence=result.get("confidence", 0.0),
        kb_hits=[KBHit(**h) for h in result.get("kb_hits", [])],
        clarifying=result.get("clarifying"),
        intent=result.get("intent", "other"),
        domain=result.get("domain", "general"),
        intent_result=IntentInfo(**result.get("intent_result", {})),
        menu=result.get("menu", []),
        ticket=result.get("ticket"),
        salary_breakdown=result.get("salary_breakdown"),
    )


# ──────────────────────────────────────────────────────────────
# Search
# ──────────────────────────────────────────────────────────────
@router.get("/search", response_model=SearchV2Response)
async def search_v2(
    q: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
    domain: Optional[str] = Query(None),
):
    """Direct KB v2 search across law nodes, procedure cards, and RAG chunks."""
    results = svc.search_kb_v2(query=q, limit=limit, domain_filter=domain)
    return SearchV2Response(
        items=[SearchHit(**r) for r in results],
        total=len(results),
        query=q,
    )


# ──────────────────────────────────────────────────────────────
# Intent classification
# ──────────────────────────────────────────────────────────────
@router.post("/intent", response_model=IntentV2Response)
async def resolve_intent(request: IntentV2Request):
    """Resolve intent using the Lebanese dialect-first classifier."""
    result = svc.resolve_intent(request.text, request.context)
    return IntentV2Response(
        intent=result.get("intent", "other"),
        domain=result.get("domain", "general"),
        request_type=result.get("request_type", "info"),
        urgency=result.get("urgency", "normal"),
        slots_filled=result.get("slots_filled", {}),
        slots_missing=result.get("slots_missing", []),
        next_question_lb=result.get("next_question_lb", ""),
        confidence=result.get("confidence", 0.0),
        menu=result.get("menu", []),
    )


# ──────────────────────────────────────────────────────────────
# Salary
# ──────────────────────────────────────────────────────────────
@router.post("/salary/compute", response_model=SalaryComputeResponse)
async def salary_compute(request: SalaryComputeRequest):
    """Compute pension or severance based on rank, degree, service years, etc."""
    result = svc.compute_salary(
        rank=request.rank,
        degree=request.degree,
        category=request.category,
        service_years=request.service_years,
        spouse=request.spouse,
        children=request.children,
        parent_dependent=request.parent_dependent,
        medals=request.medals,
    )
    breakdown = result.get("breakdown")
    return SalaryComputeResponse(
        error=result.get("error", False),
        type=result.get("type"),
        summary_lb=result.get("summary_lb", ""),
        summary_formal=result.get("summary_formal", ""),
        breakdown=SalaryBreakdown(**breakdown) if breakdown else None,
        message_lb=result.get("message_lb"),
        note_lb=result.get("note_lb"),
    )


# ──────────────────────────────────────────────────────────────
# Tickets
# ──────────────────────────────────────────────────────────────
@router.post("/tickets", response_model=TicketResponse, status_code=201)
async def create_ticket(request: TicketCreateRequest):
    """Create a new support ticket."""
    ticket = svc.create_ticket(
        title_lb=request.title_lb,
        description=request.description,
        category=request.category,
        intent=request.intent,
        domain=request.domain,
        priority=request.priority,
        escalation_reason=request.escalation_reason,
        conversation_id=request.conversation_id,
        user_id=request.user_id,
    )
    if not ticket:
        raise HTTPException(status_code=503, detail="Ticket system unavailable")
    return TicketResponse(**ticket)


@router.get("/tickets", response_model=TicketListResponse)
async def list_tickets(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
):
    """List tickets with optional filters."""
    tickets = svc.list_tickets(status_filter=status, category_filter=category)
    return TicketListResponse(
        tickets=[TicketResponse(**t) for t in tickets],
        total=len(tickets),
    )


@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: str):
    """Get a single ticket by ID."""
    ticket = svc.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return TicketResponse(**ticket)


@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(ticket_id: str, request: TicketUpdateRequest):
    """Update ticket status/assignment."""
    ticket = svc.update_ticket(
        ticket_id=ticket_id,
        status=request.status,
        assigned_to=request.assigned_to,
        note=request.note,
        by=request.by,
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return TicketResponse(**ticket)


# ──────────────────────────────────────────────────────────────
# Feedback
# ──────────────────────────────────────────────────────────────
@router.post("/feedback", response_model=FeedbackV2Response)
async def submit_feedback(request: FeedbackV2Request):
    """Submit feedback for the KB learning pipeline."""
    result = svc.submit_feedback(
        user_message=request.user_message,
        bot_response=request.bot_response,
        user_rating=request.user_rating,
        user_correction=request.user_correction,
        intent_detected=request.intent_detected,
        domain_detected=request.domain_detected,
        session_id=request.session_id,
    )
    return FeedbackV2Response(**result)


# ──────────────────────────────────────────────────────────────
# Diagnostics
# ──────────────────────────────────────────────────────────────
@router.get("/diagnostics", response_model=DiagnosticsV2Response)
async def diagnostics():
    """KB v2 health diagnostics."""
    return DiagnosticsV2Response(**svc.diagnostics())


@router.post("/reload")
async def reload_kb():
    """Reload KB v2 data from disk."""
    counts = svc.reload_data()
    return {"status": "ok", "reloaded": counts}


# ──────────────────────────────────────────────────────────────
# v3 overlay data
# ──────────────────────────────────────────────────────────────
@router.get("/topcards")
async def get_topcards():
    """Return top cards for home screen / quick-access."""
    return {"topcards": svc.get_topcards()}


@router.get("/faq")
async def get_faq():
    """Return FAQ items."""
    return {"faq": svc.get_faq()}


@router.get("/directory")
async def get_directory():
    """Return directory/phonebook data."""
    return {"directory": svc.get_directory_phonebook()}


@router.get("/escalation-rules")
async def get_escalation_rules():
    """Return escalation rules (admin)."""
    return {"rules": svc.get_escalation_rules()}


@router.get("/prepared-answers")
async def get_prepared_answers():
    """Return prepared answers for common queries."""
    return {"answers": svc.get_prepared_answers()}
