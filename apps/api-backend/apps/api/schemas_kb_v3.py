from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class ProcedureSearchItem(BaseModel):
    tx_no: str
    title: str
    summary: str
    score: float


class LawSearchItem(BaseModel):
    article_no: str
    preview: str
    score: float


class ProcedureDetail(BaseModel):
    tx_no: str
    title: str
    summary: str
    body: Optional[str] = None
    required_docs: Optional[str] = None
    submit_location: Optional[str] = None
    steps: Optional[str] = None
    notes: Optional[str] = None
    duration: Optional[str] = None
    fees: Optional[str] = None
    related: List[Dict[str, Any]] = []
    legal_basis: List[Dict[str, Any]] = []


class LawArticleDetail(BaseModel):
    article_no: str
    title: Optional[str] = None
    body: Optional[str] = None
    source: Optional[str] = None


class KBV3Diagnostics(BaseModel):
    overall_status: str
    checks: List[Dict[str, Any]]
    counts: Dict[str, int]


class ReviewQueueItem(BaseModel):
    tx_no: str
    section: Optional[str] = None
    title_ar: Optional[str] = None
    summary_ar: Optional[str] = None
    review_status: str
    review_notes: Optional[str] = None
    missing_fields: List[str] = []
    validator_hint: Optional[str] = None


class ReviewDetail(BaseModel):
    tx_no: str
    section: Optional[str] = None
    title_ar: Optional[str] = None
    summary_ar: Optional[str] = None
    where_to_submit: Optional[str] = None
    required_docs_json: Optional[str] = None
    time_limits: Optional[str] = None
    amounts_lbp: Optional[str] = None
    contacts_json: Optional[str] = None
    steps_json: Optional[str] = None
    tags_json: Optional[str] = None
    review_status: Optional[str] = None
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    missing_fields: List[str] = []


class ReviewUpdateRequest(BaseModel):
    title_ar: Optional[str] = None
    summary_ar: Optional[str] = None
    where_to_submit: Optional[str] = None
    required_docs_json: Optional[str] = None
    time_limits: Optional[str] = None
    amounts_lbp: Optional[str] = None
    contacts_json: Optional[str] = None
    steps_json: Optional[str] = None
    tags_json: Optional[str] = None
    review_status: Optional[str] = None
    review_notes: Optional[str] = None


class ReviewImportResponse(BaseModel):
    updated_count: int
    approved_count: int
    rejected_count: int
    errors: List[str] = []
