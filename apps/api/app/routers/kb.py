from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from ..core.db import fetchall, fetchone

router = APIRouter(prefix="/v1/kb", tags=["kb"])

class Topic(BaseModel):
    topic_code: str
    title_ar: str
    priority: int

class Procedure(BaseModel):
    procedure_code: str
    topic_code: str
    title_ar: str
    who_eligible_ar: Optional[str] = None
    estimated_time_ar: Optional[str] = None
    requirements_checklist_json: list
    steps_json: list
    common_mistakes_json: list
    legal_refs_json: list

class Right(BaseModel):
    right_code: str
    topic_code: str
    title_ar: str
    summary_simple_ar: str
    conditions_json: list
    documents_json: list
    how_to_apply_json: list
    legal_refs_json: list

class LawItem(BaseModel):
    law_code: str
    article_no: str
    title_ar: Optional[str] = None
    text_ar: str
    tags_json: list

@router.get("/topics", response_model=List[Topic])
def topics():
    rows = fetchall("SELECT topic_code, title_ar, priority FROM kb_topics ORDER BY priority ASC", ())
    return [{"topic_code": r[0], "title_ar": r[1], "priority": r[2]} for r in rows]

@router.get("/procedures", response_model=List[Procedure])
def procedures(topic: Optional[str] = None):
    if topic:
        rows = fetchall("""
          SELECT procedure_code, topic_code, title_ar, who_eligible_ar, estimated_time_ar,
                 requirements_checklist_json, steps_json, common_mistakes_json, legal_refs_json
          FROM kb_procedures WHERE topic_code=%s ORDER BY title_ar ASC
        """, (topic,))
    else:
        rows = fetchall("""
          SELECT procedure_code, topic_code, title_ar, who_eligible_ar, estimated_time_ar,
                 requirements_checklist_json, steps_json, common_mistakes_json, legal_refs_json
          FROM kb_procedures ORDER BY title_ar ASC
        """, ())
    return [
      {
        "procedure_code": r[0], "topic_code": r[1], "title_ar": r[2],
        "who_eligible_ar": r[3], "estimated_time_ar": r[4],
        "requirements_checklist_json": r[5] or [],
        "steps_json": r[6] or [],
        "common_mistakes_json": r[7] or [],
        "legal_refs_json": r[8] or [],
      } for r in rows
    ]

@router.get("/procedure/{procedure_code}", response_model=Procedure)
def procedure(procedure_code: str):
    r = fetchone("""
      SELECT procedure_code, topic_code, title_ar, who_eligible_ar, estimated_time_ar,
             requirements_checklist_json, steps_json, common_mistakes_json, legal_refs_json
      FROM kb_procedures WHERE procedure_code=%s
    """, (procedure_code,))
    return {
      "procedure_code": r[0], "topic_code": r[1], "title_ar": r[2],
      "who_eligible_ar": r[3], "estimated_time_ar": r[4],
      "requirements_checklist_json": r[5] or [],
      "steps_json": r[6] or [],
      "common_mistakes_json": r[7] or [],
      "legal_refs_json": r[8] or [],
    }

@router.get("/rights", response_model=List[Right])
def rights(topic: Optional[str] = None):
    if topic:
        rows = fetchall("""
          SELECT right_code, topic_code, title_ar, summary_simple_ar,
                 conditions_json, documents_json, how_to_apply_json, legal_refs_json
          FROM kb_rights WHERE topic_code=%s ORDER BY title_ar ASC
        """, (topic,))
    else:
        rows = fetchall("""
          SELECT right_code, topic_code, title_ar, summary_simple_ar,
                 conditions_json, documents_json, how_to_apply_json, legal_refs_json
          FROM kb_rights ORDER BY title_ar ASC
        """, ())
    return [
      {
        "right_code": r[0], "topic_code": r[1], "title_ar": r[2],
        "summary_simple_ar": r[3],
        "conditions_json": r[4] or [],
        "documents_json": r[5] or [],
        "how_to_apply_json": r[6] or [],
        "legal_refs_json": r[7] or [],
      } for r in rows
    ]

@router.get("/right/{right_code}", response_model=Right)
def right(right_code: str):
    r = fetchone("""
      SELECT right_code, topic_code, title_ar, summary_simple_ar,
             conditions_json, documents_json, how_to_apply_json, legal_refs_json
      FROM kb_rights WHERE right_code=%s
    """, (right_code,))
    return {
      "right_code": r[0], "topic_code": r[1], "title_ar": r[2],
      "summary_simple_ar": r[3],
      "conditions_json": r[4] or [],
      "documents_json": r[5] or [],
      "how_to_apply_json": r[6] or [],
      "legal_refs_json": r[7] or [],
    }

@router.get("/laws/search", response_model=List[LawItem])
def laws_search(q: str):
    # بسيط: بحث نصي + تاغز
    rows = fetchall("""
      SELECT law_code, article_no, title_ar, text_ar, tags_json
      FROM kb_laws
      WHERE text_ar ILIKE %s OR title_ar ILIKE %s
      ORDER BY law_code, article_no
      LIMIT 30
    """, (f"%{q}%", f"%{q}%"))
    return [{"law_code": r[0], "article_no": r[1], "title_ar": r[2], "text_ar": r[3], "tags_json": r[4] or []} for r in rows]