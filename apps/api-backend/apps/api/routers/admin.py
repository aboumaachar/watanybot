import uuid
import json
from typing import List, Optional, Dict, Any
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
import csv
import io
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, KBCard, FeedbackQueue, AuditLog, ChatSession, ChatMessage
from schemas import (
    LoginRequest, TokenResponse, KBCardCreate, KBCardUpdate, KBCardResponse,
    FeedbackQueueItem, FeedbackResolveRequest, ChatSessionItem
)
from auth import (
    verify_password, create_access_token, require_admin, hash_password
)
from config import settings
from kb_sqlite import (
    list_mapping,
    upsert_mapping,
    list_review_queue,
    get_review_detail,
    update_review_transaction,
    rebuild_tx_fts,
)
from schemas_kb_v3 import ReviewQueueItem, ReviewDetail, ReviewUpdateRequest, ReviewImportResponse
import structlog

logger = structlog.get_logger()
router = APIRouter()
CARD_NOT_FOUND = "Card not found"
KB_PATH_ERROR = "KB_SQLITE_PATH not configured"
REVIEW_STATUS_VALUES = {"pending", "approved", "rejected"}
JSON_REVIEW_FIELDS = {"required_docs_json", "contacts_json", "steps_json", "tags_json"}


@router.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate admin/superadmin user."""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role},
        expires_delta=timedelta(minutes=settings.jwt_expires_minutes)
    )
    
    # Log audit
    audit = AuditLog(
        actor_user_id=user.id,
        action="login",
        target_type="user",
        target_id=user.id,
        details={"email": user.email}
    )
    db.add(audit)
    db.commit()
    
    return TokenResponse(
        access_token=access_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "role": user.role
        }
    )


@router.get("/admin/kb/cards", response_model=List[KBCardResponse])
async def list_kb_cards(
    status: Optional[str] = Query(None, pattern="^(draft|published|archived)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List KB cards (admin can see all statuses)."""
    query = db.query(KBCard)
    
    if status:
        query = query.filter(KBCard.status == status)
    
    cards = query.order_by(KBCard.updated_at.desc()).offset(offset).limit(limit).all()
    return cards


@router.post("/admin/kb/cards", response_model=KBCardResponse, status_code=201)
async def create_kb_card(
    card: KBCardCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new KB card (draft status)."""
    # Check slug uniqueness
    existing = db.query(KBCard).filter(KBCard.slug == card.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")
    
    # Convert Pydantic models to dict
    locales_dict = {
        lang: content.model_dump() for lang, content in card.locales.items()
    }
    
    new_card = KBCard(
        id=uuid.uuid4(),
        slug=card.slug,
        status="draft",
        locales=locales_dict,
        sources=card.sources,
        version=1
    )
    db.add(new_card)
    
    # Audit log
    audit = AuditLog(
        actor_user_id=current_user.id,
        action="kb_card_create",
        target_type="kb_card",
        target_id=new_card.id,
        details={"slug": card.slug}
    )
    db.add(audit)
    
    db.commit()
    db.refresh(new_card)
    
    return new_card


@router.get("/admin/chat/sessions", response_model=List[ChatSessionItem])
async def list_chat_sessions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List chat sessions with message counts and last message time."""
    stats_subq = (
        db.query(
            ChatMessage.session_id.label("session_id"),
            func.count(ChatMessage.id).label("message_count"),
            func.max(ChatMessage.created_at).label("last_message_at")
        )
        .group_by(ChatMessage.session_id)
        .subquery()
    )

    rows = (
        db.query(
            ChatSession,
            stats_subq.c.message_count,
            stats_subq.c.last_message_at
        )
        .outerjoin(stats_subq, ChatSession.id == stats_subq.c.session_id)
        .order_by((stats_subq.c.last_message_at.desc()).nullslast(), ChatSession.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        ChatSessionItem(
            id=session.id,
            created_at=session.created_at,
            last_message_at=last_message_at,
            message_count=message_count or 0,
            meta=session.meta
        )
        for session, message_count, last_message_at in rows
    ]


@router.put("/admin/kb/cards/{card_id}", response_model=KBCardResponse)
async def update_kb_card(
    card_id: uuid.UUID,
    card: KBCardUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a KB card."""
    existing = db.query(KBCard).filter(KBCard.id == card_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail=CARD_NOT_FOUND)
    
    # Update fields
    if card.slug and card.slug != existing.slug:
        # Check new slug uniqueness
        slug_check = db.query(KBCard).filter(KBCard.slug == card.slug, KBCard.id != card_id).first()
        if slug_check:
            raise HTTPException(status_code=400, detail="Slug already exists")
        existing.slug = card.slug
    
    if card.locales:
        existing.locales = {lang: content.model_dump() for lang, content in card.locales.items()}
    
    if card.sources is not None:
        existing.sources = card.sources
    
    # Audit log
    audit = AuditLog(
        actor_user_id=current_user.id,
        action="kb_card_update",
        target_type="kb_card",
        target_id=existing.id,
        details={"slug": existing.slug}
    )
    db.add(audit)
    
    db.commit()
    db.refresh(existing)
    
    return existing


@router.post("/admin/kb/cards/{card_id}/publish", response_model=KBCardResponse)
async def publish_kb_card(
    card_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Publish a KB card (increment version)."""
    card = db.query(KBCard).filter(KBCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail=CARD_NOT_FOUND)
    
    if card.status == "published":
        raise HTTPException(status_code=400, detail="Card already published")
    
    card.status = "published"
    card.version += 1
    
    # Audit log
    audit = AuditLog(
        actor_user_id=current_user.id,
        action="kb_card_publish",
        target_type="kb_card",
        target_id=card.id,
        details={"slug": card.slug, "version": card.version}
    )
    db.add(audit)
    
    db.commit()
    db.refresh(card)
    
    return card


@router.post("/admin/kb/cards/{card_id}/archive", response_model=KBCardResponse)
async def archive_kb_card(
    card_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Archive a KB card."""
    card = db.query(KBCard).filter(KBCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail=CARD_NOT_FOUND)
    
    card.status = "archived"
    
    # Audit log
    audit = AuditLog(
        actor_user_id=current_user.id,
        action="kb_card_archive",
        target_type="kb_card",
        target_id=card.id,
        details={"slug": card.slug}
    )
    db.add(audit)
    
    db.commit()
    db.refresh(card)
    
    return card


@router.get("/admin/feedback/queue", response_model=List[FeedbackQueueItem])
async def get_feedback_queue(
    status: Optional[str] = Query("open", pattern="^(open|in_review|resolved|rejected)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get feedback queue items."""
    query = db.query(FeedbackQueue)
    
    if status:
        query = query.filter(FeedbackQueue.status == status)
    
    items = query.order_by(FeedbackQueue.created_at.desc()).offset(offset).limit(limit).all()
    return items


@router.post("/admin/feedback/{feedback_id}/resolve")
async def resolve_feedback(
    feedback_id: uuid.UUID,
    request: FeedbackResolveRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Resolve a feedback item."""
    feedback = db.query(FeedbackQueue).filter(FeedbackQueue.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback item not found")
    
    resolution = {
        "action": request.action,
        "notes": request.notes,
        "resolved_by": str(current_user.id)
    }
    
    if request.action == "link_existing":
        if not request.linked_card_id:
            raise HTTPException(status_code=400, detail="linked_card_id required for link_existing action")
        
        # Verify card exists
        card = db.query(KBCard).filter(KBCard.id == request.linked_card_id).first()
        if not card:
            raise HTTPException(status_code=404, detail="Linked card not found")
        
        resolution["linked_card_id"] = str(request.linked_card_id)
        feedback.status = "resolved"
    
    elif request.action == "create_new":
        if not request.new_card:
            raise HTTPException(status_code=400, detail="new_card required for create_new action")
        
        # Create draft card
        locales_dict = {
            lang: content.model_dump() for lang, content in request.new_card.locales.items()
        }
        
        new_card = KBCard(
            id=uuid.uuid4(),
            slug=request.new_card.slug,
            status="draft",
            locales=locales_dict,
            sources=request.new_card.sources,
            version=1
        )
        db.add(new_card)
        db.flush()
        
        resolution["created_card_id"] = str(new_card.id)
        feedback.status = "resolved"
    
    elif request.action == "reject":
        feedback.status = "rejected"
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    feedback.resolution = resolution
    
    # Audit log
    audit = AuditLog(
        actor_user_id=current_user.id,
        action="feedback_resolve",
        target_type="feedback",
        target_id=feedback.id,
        details=resolution
    )
    db.add(audit)
    
    db.commit()
    
    return {"success": True, "feedback_id": str(feedback.id), "resolution": resolution}


@router.get("/api/admin/mapping")
async def get_mapping(
    tx_no: Optional[str] = Query(None),
    article_no: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(require_admin),
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)
    items = list_mapping(settings.kb_sqlite_path, tx_no=tx_no, article_no=article_no, limit=limit)
    return {"items": items}


@router.put("/api/admin/mapping/{tx_no}/{article_no}")
async def update_mapping(
    tx_no: str,
    article_no: str,
    relevance: float,
    rationale: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)
    upsert_mapping(settings.kb_sqlite_path, tx_no=tx_no, article_no=article_no, relevance=relevance, rationale=rationale)

    audit = AuditLog(
        actor_user_id=current_user.id,
        action="kb_v3_mapping_update",
        target_type="tx_law_map",
        target_id=None,
        details={
            "tx_no": tx_no,
            "article_no": article_no,
            "relevance": relevance,
            "rationale": rationale,
        },
    )
    db.add(audit)
    db.commit()
    return {"success": True}


@router.post("/api/admin/mapping/import")
async def import_mapping(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)

    content = await file.read()
    text_content = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text_content))
    updated = 0
    for row in reader:
        tx_no = row.get("tx_no")
        article_no = row.get("article_no")
        relevance = float(row.get("relevance") or 0)
        rationale = row.get("rationale") or ""
        if not tx_no or not article_no:
            continue
        upsert_mapping(settings.kb_sqlite_path, tx_no=tx_no, article_no=article_no, relevance=relevance, rationale=rationale)
        updated += 1

    audit = AuditLog(
        actor_user_id=current_user.id,
        action="kb_v3_mapping_import",
        target_type="tx_law_map",
        target_id=None,
        details={"updated": updated},
    )
    db.add(audit)
    db.commit()

    return {"success": True, "updated": updated}


@router.get("/api/admin/mapping/export")
async def export_mapping(
    current_user: User = Depends(require_admin),
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)

    items = list_mapping(settings.kb_sqlite_path, limit=100000)

    def stream():
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["tx_no", "article_no", "relevance", "rationale"])
        writer.writeheader()
        for item in items:
            writer.writerow(item)
        return output.getvalue()

    csv_content = stream()
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tx_law_map.csv"},
    )


def _validate_review_json_fields(payload: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    for field in JSON_REVIEW_FIELDS:
        if field not in payload:
            continue
        value = payload.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        try:
            json.loads(value)
        except Exception:
            errors.append(f"{field}: invalid JSON")
    return errors


@router.get("/api/admin/review/queue", response_model=List[ReviewQueueItem])
async def review_queue(
    status: str = Query("pending", pattern="^(pending|approved|rejected)$"),
    limit: int = Query(50, ge=1, le=200),
    q: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)
    try:
        items = list_review_queue(settings.kb_sqlite_path, status=status, limit=limit, q=q)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return [ReviewQueueItem(**item) for item in items]


@router.get("/api/admin/review/{tx_no}", response_model=ReviewDetail)
async def review_detail(
    tx_no: str,
    current_user: User = Depends(require_admin),
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)
    try:
        data = get_review_detail(settings.kb_sqlite_path, tx_no=tx_no)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    if not data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return ReviewDetail(**data)


@router.put("/api/admin/review/{tx_no}", response_model=ReviewDetail)
async def review_update(
    tx_no: str,
    payload: ReviewUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)
    updates = payload.model_dump(exclude_unset=True)
    status = updates.get("review_status")
    if status and status not in REVIEW_STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid review_status")
    if status == "rejected" and not (updates.get("review_notes") or "").strip():
        raise HTTPException(status_code=400, detail="review_notes required for rejection")

    json_errors = _validate_review_json_fields(updates)
    if json_errors:
        raise HTTPException(status_code=400, detail={"errors": json_errors})

    try:
        result = update_review_transaction(
            settings.kb_sqlite_path,
            tx_no=tx_no,
            updates=updates,
            reviewer=current_user.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if result.get("updated"):
        rebuild_tx_fts(settings.kb_sqlite_path)

        audit = AuditLog(
            actor_user_id=current_user.id,
            action="kb_review_update",
            target_type="transaction",
            target_id=None,
            details={
                "tx_no": tx_no,
                "reviewer": current_user.email,
                "changes": result.get("changes", {}),
            },
        )
        db.add(audit)
        db.commit()

    data = get_review_detail(settings.kb_sqlite_path, tx_no=tx_no)
    if not data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return ReviewDetail(**data)


@router.get("/api/admin/review/export")
async def review_export(
    status: str = Query("pending", pattern="^(pending|approved|rejected)$"),
    current_user: User = Depends(require_admin),
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)

    try:
        items = list_review_queue(settings.kb_sqlite_path, status=status, limit=100000)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    fieldnames = [
        "tx_no",
        "section",
        "title_ar",
        "summary_ar",
        "where_to_submit",
        "required_docs_json",
        "time_limits",
        "amounts_lbp",
        "contacts_json",
        "steps_json",
        "tags_json",
        "review_status",
        "review_notes",
        "validator_hint",
    ]

    def stream():
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            writer.writerow({field: item.get(field, "") for field in fieldnames})
        return output.getvalue()

    csv_content = stream()
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=review_queue.csv"},
    )


@router.post("/api/admin/review/import", response_model=ReviewImportResponse)
async def review_import(
    file: UploadFile = File(...),
    reviewer: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)

    reviewer_value = reviewer or current_user.email
    content = await file.read()
    text_content = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text_content))

    updated_count = 0
    approved_count = 0
    rejected_count = 0
    errors: List[str] = []

    for row in reader:
        tx_no = (row.get("tx_no") or "").strip()
        if not tx_no:
            errors.append("Missing tx_no in row")
            continue

        updates: Dict[str, Any] = {}
        for key, value in row.items():
            if key in {"tx_no", "validator_hint"}:
                continue
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            updates[key] = value

        if not updates:
            continue

        json_errors = _validate_review_json_fields(updates)
        if json_errors:
            errors.append(f"{tx_no}: {', '.join(json_errors)}")
            continue

        status = updates.get("review_status")
        if status and status not in REVIEW_STATUS_VALUES:
            errors.append(f"{tx_no}: invalid review_status")
            continue

        if status == "rejected" and not (updates.get("review_notes") or "").strip():
            errors.append(f"{tx_no}: review_notes required for rejection")
            continue

        try:
            result = update_review_transaction(
                settings.kb_sqlite_path,
                tx_no=tx_no,
                updates=updates,
                reviewer=reviewer_value,
            )
        except ValueError as exc:
            errors.append(f"{tx_no}: {exc}")
            continue

        if not result.get("updated"):
            continue

        updated_count += 1
        if status == "approved":
            approved_count += 1
        if status == "rejected":
            rejected_count += 1

        audit = AuditLog(
            actor_user_id=current_user.id,
            action="kb_review_update",
            target_type="transaction",
            target_id=None,
            details={
                "tx_no": tx_no,
                "reviewer": reviewer_value,
                "changes": result.get("changes", {}),
                "source": "csv_import",
            },
        )
        db.add(audit)

    rebuild_tx_fts(settings.kb_sqlite_path)
    db.commit()

    return ReviewImportResponse(
        updated_count=updated_count,
        approved_count=approved_count,
        rejected_count=rejected_count,
        errors=errors,
    )
