"""
Pydantic schemas for KB v2 endpoints.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Chat ──────────────────────────────────────────────────────

class ChatV2Request(BaseModel):
    question: str = Field(..., min_length=1, description="User message (Lebanese or formal Arabic)")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Previous turn context (slots, intent)")
    session_id: Optional[str] = None
    lang: Optional[str] = Field(default="ar", pattern="^(ar|en)$")
    channel: Optional[str] = Field(default="web")


class IntentInfo(BaseModel):
    intent: str
    domain: str
    request_type: str
    urgency: str
    slots_filled: Dict[str, Any] = {}
    slots_missing: List[str] = []
    confidence: float = 0.0


class KBHit(BaseModel):
    id: str
    source: str
    score: float


class ChatV2Response(BaseModel):
    answer_lb: str
    answer_formal: str = ""
    confidence: float
    kb_hits: List[KBHit] = []
    clarifying: Optional[str] = None
    intent: str
    domain: str
    intent_result: IntentInfo
    menu: List[Any] = []
    ticket: Optional[Dict[str, Any]] = None
    salary_breakdown: Optional[Dict[str, Any]] = None


# ── Search ────────────────────────────────────────────────────

class SearchV2Request(BaseModel):
    q: str = Field(..., min_length=2, description="Search query")
    limit: int = Field(default=10, ge=1, le=50)
    domain: Optional[str] = None


class SearchHit(BaseModel):
    source: str
    id: str
    title: str
    body: str
    domain: str
    score: float


class SearchV2Response(BaseModel):
    items: List[SearchHit]
    total: int
    query: str


# ── Intent ────────────────────────────────────────────────────

class IntentV2Request(BaseModel):
    text: str = Field(..., min_length=1)
    context: Optional[Dict[str, Any]] = None


class IntentV2Response(BaseModel):
    intent: str
    domain: str
    request_type: str
    urgency: str
    slots_filled: Dict[str, Any] = {}
    slots_missing: List[str] = []
    next_question_lb: str = ""
    confidence: float = 0.0
    menu: List[Any] = []


# ── Salary ────────────────────────────────────────────────────

class SalaryComputeRequest(BaseModel):
    rank: str = Field(..., description="الرتبة (مثلاً عقيد)")
    degree: str = Field(default="1", description="الدرجة")
    category: str = Field(default="ضابط", description="الفئة (ضابط/رتيب/أفراد)")
    service_years: int = Field(..., ge=0, le=50, description="سنوات الخدمة")
    spouse: bool = False
    children: int = Field(default=0, ge=0)
    parent_dependent: int = Field(default=0, ge=0)
    medals: Optional[List[str]] = None


class SalaryBreakdown(BaseModel):
    base_salary_LBP: Optional[int] = None
    pension_rate: Optional[float] = None
    service_factor: Optional[float] = None
    gross_pension: Optional[int] = None
    tax_deduction: Optional[int] = None
    after_tax: Optional[int] = None
    family_allowance: Optional[int] = None
    medals_bonus: Optional[int] = None
    net_pension: Optional[int] = None
    # Severance fields
    severance_factor: Optional[float] = None
    total_severance: Optional[int] = None


class SalaryComputeResponse(BaseModel):
    error: bool = False
    type: Optional[str] = None  # pension | severance
    summary_lb: str = ""
    summary_formal: str = ""
    breakdown: Optional[SalaryBreakdown] = None
    message_lb: Optional[str] = None
    note_lb: Optional[str] = None


# ── Tickets ───────────────────────────────────────────────────

class TicketCreateRequest(BaseModel):
    title_lb: str = Field(..., min_length=3)
    description: str = ""
    category: str = "other"
    intent: str = ""
    domain: str = ""
    priority: str = Field(default="normal", pattern="^(low|normal|high|critical)$")
    escalation_reason: str = "unresolved"
    conversation_id: str = ""
    user_id: str = ""


class TicketUpdateRequest(BaseModel):
    status: Optional[str] = Field(default=None, pattern="^(open|in_progress|resolved|closed)$")
    assigned_to: Optional[str] = None
    note: str = ""
    by: str = "admin"


class TicketResponse(BaseModel):
    id: str
    status: str
    priority: str
    category: str
    title_lb: str
    description: str = ""
    intent: str = ""
    domain: str = ""
    assigned_to: str = ""
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None
    escalation_reason: str = ""
    history: List[Dict[str, Any]] = []
    conversation_id: str = ""
    user_id: str = ""


class TicketListResponse(BaseModel):
    tickets: List[TicketResponse]
    total: int


# ── Feedback ──────────────────────────────────────────────────

class FeedbackV2Request(BaseModel):
    user_message: str
    bot_response: str
    user_rating: str = Field(default="wrong", pattern="^(good|wrong|missing|unclear|other)$")
    user_correction: str = ""
    intent_detected: str = ""
    domain_detected: str = ""
    session_id: str = ""


class FeedbackV2Response(BaseModel):
    success: bool
    feedback_id: str
    failure_category: str


# ── Diagnostics ───────────────────────────────────────────────

class DiagnosticsV2Response(BaseModel):
    kb_v2_dir: str
    kb_v2_exists: bool
    law_nodes: int
    procedures: int
    chunks: int
    response_templates: int
    topcards: int = 0
    faq: int = 0
    prepared_answers: int = 0
    intent_router_loaded: bool
    salary_engine_loaded: bool
    ticket_manager_loaded: bool
    learning_proposer_loaded: bool
    domains: List[str]
