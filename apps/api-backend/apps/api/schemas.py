from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


# Auth schemas
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


# KB Card schemas
class LocaleContent(BaseModel):
    title: str
    summary: str
    body: str
    tags: List[str] = []


class KBCardCreate(BaseModel):
    slug: str
    locales: Dict[str, LocaleContent]  # {ar: {...}, en: {...}}
    sources: Optional[Dict[str, Any]] = None


class KBCardUpdate(BaseModel):
    slug: Optional[str] = None
    locales: Optional[Dict[str, LocaleContent]] = None
    sources: Optional[Dict[str, Any]] = None


class KBCardResponse(BaseModel):
    id: UUID
    slug: str
    status: str
    locales: Dict[str, Any]
    sources: Optional[Dict[str, Any]] = None
    version: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class KBSearchResult(BaseModel):
    id: UUID
    slug: str
    title: str
    summary: str
    score: float


class KBSearchResponse(BaseModel):
    items: List[KBSearchResult]
    total: int
    took_ms: int


# Chat schemas
class ChatRequest(BaseModel):
    question: str
    session_id: Optional[UUID] = None
    lang: Optional[str] = None  # ar|en, auto-detect if not provided
    channel: Optional[str] = None  # e.g. whatsapp
    phone_number: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    lang: str
    session_id: UUID
    kb_hits: List[Dict[str, Any]] = []
    confidence: float
    clarifying_question: Optional[str] = None
    action_intents: List[Dict[str, Any]] = []
    whatsapp_payloads: Optional[List[Dict[str, Any]]] = None


class ChatSessionItem(BaseModel):
    id: UUID
    created_at: datetime
    last_message_at: Optional[datetime] = None
    message_count: int = 0
    meta: Optional[Dict[str, Any]] = None


# Feedback schemas
class FeedbackQueueItem(BaseModel):
    id: UUID
    session_id: Optional[UUID]
    question: str
    lang: str
    suggested_kb_ids: Optional[List[UUID]] = None
    status: str
    resolution: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class FeedbackResolveRequest(BaseModel):
    action: str  # link_existing|create_new|reject
    notes: str
    linked_card_id: Optional[UUID] = None
    new_card: Optional[KBCardCreate] = None


class FeedbackCreateRequest(BaseModel):
    message: str
    lang: Optional[str] = None
    session_id: Optional[UUID] = None
    tx_no: Optional[str] = None
    article_no: Optional[str] = None
    rating: Optional[int] = Field(default=None, ge=0, le=5)
    correction_text: Optional[str] = None
    suggested_mapping: Optional[Dict[str, Any]] = None


# Superadmin schemas
class DoctorCheckResult(BaseModel):
    check: str
    status: str  # ok|warning|error
    message: str
    details: Optional[Dict[str, Any]] = None


class DoctorResponse(BaseModel):
    overall_status: str
    checks: List[DoctorCheckResult]
    timestamp: datetime


class BackupResponse(BaseModel):
    success: bool
    backup_file: str
    size_bytes: int
    timestamp: datetime


class MetricsResponse(BaseModel):
    total_kb_cards: int
    published_kb_cards: int
    total_chat_sessions: int
    total_feedback_items: int
    open_feedback_items: int
    timestamp: datetime


class AuditLogItem(BaseModel):
    id: UUID
    actor_user_id: Optional[UUID]
    action: str
    target_type: Optional[str]
    target_id: Optional[UUID]
    details: Optional[Dict[str, Any]]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
