from __future__ import annotations

import os
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from auth import require_admin
from config import settings
from kb_sqlite import (
    validate_schema,
    search_procedures,
    get_procedure,
    search_law,
    get_law_article,
)
from schemas_kb_v3 import (
    ProcedureSearchItem,
    ProcedureDetail,
    LawSearchItem,
    LawArticleDetail,
    KBV3Diagnostics,
)

router = APIRouter(prefix="/api", tags=["KBv3"])
KB_PATH_ERROR = "KB_SQLITE_PATH not configured"


@router.get("/procedures/search", response_model=List[ProcedureSearchItem])
async def procedures_search(
    q: str = Query(..., min_length=2),
    lang: str = Query("ar", pattern="^(ar|en)$"),
    limit: int = Query(10, ge=1, le=50),
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)
    review_statuses = None if settings.public_show_pending else ["approved"]
    results = search_procedures(
        settings.kb_sqlite_path,
        q=q,
        limit=limit,
        lang=lang,
        review_statuses=review_statuses,
    )
    return [ProcedureSearchItem(**r.__dict__) for r in results]


@router.get("/procedures/{tx_no}", response_model=ProcedureDetail)
async def procedures_get(
    tx_no: str,
    lang: str = Query("ar", pattern="^(ar|en)$"),
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)
    review_statuses = None if settings.public_show_pending else ["approved"]
    data = get_procedure(
        settings.kb_sqlite_path,
        tx_no=tx_no,
        lang=lang,
        review_statuses=review_statuses,
    )
    if not data:
        raise HTTPException(status_code=404, detail="Procedure not found")

    def pick(field: str) -> Optional[str]:
        return data.get(f"{field}_{lang}") or data.get(field)

    return ProcedureDetail(
        tx_no=str(data.get("tx_no", "")),
        title=pick("title") or "",
        summary=pick("summary") or "",
        body=pick("body"),
        required_docs=pick("required_docs"),
        submit_location=pick("submit_location"),
        steps=pick("steps"),
        notes=pick("notes"),
        duration=pick("duration"),
        fees=pick("fees"),
        related=data.get("related", []),
        legal_basis=data.get("legal_basis", []),
    )


@router.get("/law/search", response_model=List[LawSearchItem])
async def law_search(
    q: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)
    results = search_law(settings.kb_sqlite_path, q=q, limit=limit)
    return [LawSearchItem(**r.__dict__) for r in results]


@router.get("/law/{article_no}", response_model=LawArticleDetail)
async def law_get(article_no: str):
    if not settings.kb_sqlite_path:
        raise HTTPException(status_code=500, detail=KB_PATH_ERROR)
    data = get_law_article(settings.kb_sqlite_path, article_no=article_no)
    if not data:
        raise HTTPException(status_code=404, detail="Article not found")
    return LawArticleDetail(
        article_no=str(data.get("article_no", "")),
        title=data.get("title"),
        body=data.get("body"),
        source=data.get("source"),
    )


@router.get("/admin/kb/diagnostics", response_model=KBV3Diagnostics)
async def kb_diagnostics(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    checks: List[Dict[str, str]] = []
    counts: Dict[str, int] = {}

    if not settings.kb_sqlite_path:
        checks.append({"check": "kb_path", "status": "error", "message": KB_PATH_ERROR})
        return KBV3Diagnostics(overall_status="error", checks=checks, counts=counts)

    if not os.path.exists(settings.kb_sqlite_path):
        checks.append({"check": "kb_file", "status": "error", "message": "KB SQLite file not found"})
        return KBV3Diagnostics(overall_status="error", checks=checks, counts=counts)

    schema = validate_schema(settings.kb_sqlite_path)
    if schema["missing_tables"]:
        checks.append({
            "check": "schema",
            "status": "error",
            "message": f"Missing tables: {', '.join(schema['missing_tables'])}",
        })
    else:
        checks.append({"check": "schema", "status": "ok", "message": "All required tables present"})

    if schema["fts_ok"]:
        checks.append({"check": "fts", "status": "ok", "message": "FTS MATCH ok"})
    else:
        checks.append({"check": "fts", "status": "warning", "message": "FTS MATCH failed", "details": schema["fts_errors"]})

    # Counts (best-effort)
    try:
        from kb_sqlite import _connect
        conn = _connect(settings.kb_sqlite_path)
        cursor = conn.cursor()
        for table in ["transactions", "law_articles", "tx_law_map"]:
            cursor.execute(f"SELECT COUNT(*) as c FROM {table}")
            counts[table] = int(cursor.fetchone()[0])
        conn.close()
    except Exception as exc:
        checks.append({"check": "counts", "status": "warning", "message": f"Failed to count rows: {exc}"})

    statuses = [c["status"] for c in checks]
    if "error" in statuses:
        overall_status = "error"
    elif "warning" in statuses:
        overall_status = "warning"
    else:
        overall_status = "ok"

    return KBV3Diagnostics(overall_status=overall_status, checks=checks, counts=counts)
