from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import secrets
from ..core.db import fetchone

router = APIRouter(prefix="/v1/cases", tags=["cases"])

class CreateCaseReq(BaseModel):
    requester_name: Optional[str] = None
    requester_phone: Optional[str] = None
    topic_code: Optional[str] = None
    category: str = "other"
    user_message: str

class CreateCaseRes(BaseModel):
    case_code: str
    status: str

class CaseRes(BaseModel):
    case_code: str
    status: str
    user_message: str
    staff_reply: Optional[str] = None
    created_at: str
    updated_at: str

def _new_code():
    return "WAT-" + secrets.token_hex(3).upper()  # مثل WAT-8F3K2Q

@router.post("", response_model=CreateCaseRes)
def create_case(req: CreateCaseReq):
    if not req.user_message or len(req.user_message.strip()) < 5:
        raise HTTPException(status_code=422, detail="Message too short")

    code = _new_code()
    row = fetchone("""
      INSERT INTO user_cases(case_code, requester_name, requester_phone, topic_code, category, user_message)
      VALUES (%s,%s,%s,%s,%s,%s)
      RETURNING case_code, status
    """, (code, req.requester_name, req.requester_phone, req.topic_code, req.category, req.user_message.strip()))
    return {"case_code": row[0], "status": row[1]}

@router.get("/{case_code}", response_model=CaseRes)
def get_case(case_code: str):
    r = fetchone("""
      SELECT case_code, status, user_message, staff_reply, created_at::text, updated_at::text
      FROM user_cases WHERE case_code=%s
    """, (case_code,))
    if not r:
        raise HTTPException(status_code=404, detail="Case not found")
    return {
      "case_code": r[0], "status": r[1], "user_message": r[2],
      "staff_reply": r[3], "created_at": r[4], "updated_at": r[5]
    }