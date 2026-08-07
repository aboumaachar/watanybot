from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from ..core.db import fetchall, fetchone
import re

router = APIRouter(prefix="/v1/faq", tags=["faq"])

ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
def normalize_digits(s: str) -> str:
    for i, d in enumerate(ARABIC_DIGITS):
        s = s.replace(d, str(i))
    return s

def norm_ar(s: str) -> str:
    s = (s or "").strip().lower()
    s = normalize_digits(s)
    s = re.sub(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]", "", s)
    s = s.replace("أ","ا").replace("إ","ا").replace("آ","ا")
    s = s.replace("ى","ي").replace("ة","ه")
    s = re.sub(r"[^\w\u0600-\u06FF\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

class FAQItem(BaseModel):
    faq_id: int
    question_ar: str
    answer_ar: str
    topic_code: Optional[str] = None
    hits_total: int
    last_asked_at: Optional[str] = None

class AskReq(BaseModel):
    text: str

class AskRes(BaseModel):
    route: str                 # faq / case / kb_law (future)
    matched: bool
    faq_id: Optional[int] = None
    question_ar: Optional[str] = None
    answer_ar: Optional[str] = None
    score: float = 0.0

@router.get("/popular", response_model=List[FAQItem])
def popular(limit: int = 20):
    rows = fetchall("""
      SELECT faq_id, question_ar, answer_ar, topic_code, hits_total, COALESCE(last_asked_at::text,'')
      FROM kb_faq ORDER BY hits_total DESC NULLS LAST LIMIT %s
    """, (limit,))
    return [
      {"faq_id": r[0], "question_ar": r[1], "answer_ar": r[2], "topic_code": r[3], "hits_total": r[4], "last_asked_at": r[5] or None}
      for r in rows
    ]

@router.get("/recent", response_model=List[FAQItem])
def recent(limit: int = 20):
    rows = fetchall("""
      SELECT faq_id, question_ar, answer_ar, topic_code, hits_total, COALESCE(last_asked_at::text,'')
      FROM kb_faq ORDER BY last_asked_at DESC NULLS LAST LIMIT %s
    """, (limit,))
    return [
      {"faq_id": r[0], "question_ar": r[1], "answer_ar": r[2], "topic_code": r[3], "hits_total": r[4], "last_asked_at": r[5] or None}
      for r in rows
    ]

@router.post("/ask", response_model=AskRes)
def ask(req: AskReq):
    q = (req.text or "").strip()
    if len(q) < 3:
        return {"route":"faq","matched":False,"score":0.0}

    qn = norm_ar(q)

    # مطابقة بسيطة: LIKE + تطابق كامل على question_norm
    exact = fetchone("SELECT faq_id, question_ar, answer_ar FROM kb_faq WHERE question_norm=%s", (qn,))
    if exact:
        faq_id = exact[0]
        fetchone("UPDATE kb_faq SET hits_total=hits_total+1, last_asked_at=now() WHERE faq_id=%s RETURNING faq_id", (faq_id,))
        fetchone("""
          INSERT INTO kb_query_log(user_text, user_text_norm, matched_faq_id, matched_score, route)
          VALUES (%s,%s,%s,%s,'faq')
          RETURNING id
        """, (q, qn, faq_id, 1.0))
        return {"route":"faq","matched":True,"faq_id":faq_id,"question_ar":exact[1],"answer_ar":exact[2],"score":1.0}

    # partial match: contains
    row = fetchone("""
      SELECT faq_id, question_ar, answer_ar
      FROM kb_faq
      WHERE question_norm ILIKE %s
      ORDER BY hits_total DESC NULLS LAST
      LIMIT 1
    """, (f"%{qn}%",))
    if row:
        faq_id = row[0]
        fetchone("UPDATE kb_faq SET hits_total=hits_total+1, last_asked_at=now() WHERE faq_id=%s RETURNING faq_id", (faq_id,))
        fetchone("""
          INSERT INTO kb_query_log(user_text, user_text_norm, matched_faq_id, matched_score, route)
          VALUES (%s,%s,%s,%s,'faq')
          RETURNING id
        """, (q, qn, faq_id, 0.7))
        return {"route":"faq","matched":True,"faq_id":faq_id,"question_ar":row[1],"answer_ar":row[2],"score":0.7}

    # no match -> log as case route (the UI will create case)
    fetchone("""
      INSERT INTO kb_query_log(user_text, user_text_norm, matched_faq_id, matched_score, route)
      VALUES (%s,%s,NULL,0.0,'case')
      RETURNING id
    """, (q, qn))
    return {"route":"case","matched":False,"score":0.0}


# ========================================
# Suggested: أكثر الأسئلة اللي ما لقيت match
# ========================================
class SuggestedItem(BaseModel):
    question_norm: str
    count: int
    last_asked_at: str
    examples: List[str]

@router.get("/suggested", response_model=List[SuggestedItem])
def suggested(limit: int = 25, examples_per_item: int = 3):
    """
    أكثر الأسئلة اللي ما لقيت match (route='case')
    نجمعها حسب normalized text ونرجّع عدد التكرار + آخر تاريخ + أمثلة.
    """
    rows = fetchall("""
      SELECT user_text_norm,
             COUNT(*)::int AS cnt,
             MAX(asked_at)::text AS last_asked_at
      FROM kb_query_log
      WHERE route='case'
      GROUP BY user_text_norm
      ORDER BY cnt DESC, MAX(asked_at) DESC
      LIMIT %s
    """, (limit,))

    out = []
    for (qn, cnt, last_at) in rows:
        ex = fetchall("""
          SELECT user_text
          FROM kb_query_log
          WHERE route='case' AND user_text_norm=%s
          ORDER BY asked_at DESC
          LIMIT %s
        """, (qn, examples_per_item))
        out.append({
          "question_norm": qn,
          "count": cnt,
          "last_asked_at": last_at or "",
          "examples": [e[0] for e in ex]
        })
    return out


# ========================================
# Promote: تحويل اقتراح إلى FAQ
# ========================================
class PromoteReq(BaseModel):
    question_ar: str
    answer_ar: str
    topic_code: Optional[str] = None
    tags_json: Optional[list] = None
    refs_json: Optional[list] = None

@router.post("/promote")
def promote(req: PromoteReq):
    import json
    q = (req.question_ar or "").strip()
    a = (req.answer_ar or "").strip()
    if len(q) < 3 or len(a) < 5:
        return {"ok": False, "error": "question/answer too short"}

    qn = norm_ar(q)
    tags = req.tags_json or []
    refs = req.refs_json or []

    r = fetchone("""
      INSERT INTO kb_faq(question_ar, question_norm, answer_ar, topic_code, tags_json, refs_json)
      VALUES (%s,%s,%s,%s,%s,%s)
      ON CONFLICT (question_norm) DO UPDATE
      SET question_ar=EXCLUDED.question_ar,
          answer_ar=EXCLUDED.answer_ar,
          topic_code=EXCLUDED.topic_code,
          tags_json=EXCLUDED.tags_json,
          refs_json=EXCLUDED.refs_json
      RETURNING faq_id
    """, (q, qn, a, req.topic_code, json.dumps(tags), json.dumps(refs)))

    return {"ok": True, "faq_id": r[0]}


# ========================================
# Drafts: عرض وتعديل ونشر المسودات
# ========================================
class DraftItem(BaseModel):
    faq_id: int
    question_ar: str
    question_norm: str
    answer_ar: str
    answer_official_ar: Optional[str] = None
    refs_json: list = []
    topic_code: Optional[str] = None
    tags_json: list = []
    hits_total: int
    last_asked_at: Optional[str] = None
    needs_review: bool = True

@router.get("/drafts", response_model=List[DraftItem])
def drafts(limit: int = 50):
    rows = fetchall("""
      SELECT faq_id, question_ar, question_norm,
             answer_ar, answer_official_ar,
             COALESCE(refs_json,'[]'::jsonb),
             topic_code,
             COALESCE(tags_json,'[]'::jsonb),
             hits_total,
             COALESCE(last_asked_at::text,''),
             needs_review
      FROM kb_faq
      WHERE status='draft'
      ORDER BY hits_total DESC, last_asked_at DESC NULLS LAST
      LIMIT %s
    """, (limit,))
    return [
      {
        "faq_id": r[0],
        "question_ar": r[1],
        "question_norm": r[2],
        "answer_ar": r[3],
        "answer_official_ar": r[4],
        "refs_json": r[5] or [],
        "topic_code": r[6],
        "tags_json": r[7] or [],
        "hits_total": r[8],
        "last_asked_at": r[9] or None,
        "needs_review": r[10] if r[10] is not None else True
      } for r in rows
    ]

class UpdateFAQReq(BaseModel):
    answer_ar: str
    answer_official_ar: Optional[str] = None
    topic_code: Optional[str] = None
    tags_json: Optional[list] = None
    refs_json: Optional[list] = None

@router.post("/drafts/{faq_id}/update")
def update_draft(faq_id: int, req: UpdateFAQReq):
    import json
    tags = req.tags_json or []
    refs = req.refs_json or []
    r = fetchone("""
      UPDATE kb_faq
      SET answer_ar=%s,
          answer_official_ar=%s,
          topic_code=%s,
          tags_json=%s::jsonb,
          refs_json=%s::jsonb,
          needs_review=TRUE
      WHERE faq_id=%s
      RETURNING faq_id
    """, (req.answer_ar, req.answer_official_ar, req.topic_code, json.dumps(tags), json.dumps(refs), faq_id))
    return {"ok": True, "faq_id": r[0] if r else faq_id}

@router.post("/drafts/{faq_id}/publish")
def publish_draft(faq_id: int):
    r = fetchone("""
      UPDATE kb_faq
      SET status='published', needs_review=FALSE
      WHERE faq_id=%s
      RETURNING faq_id
    """, (faq_id,))
    return {"ok": True, "faq_id": r[0] if r else faq_id}


# ========================================
# Resuggest: إعادة اقتراح الإحالات لمسودة
# ========================================
def infer_tags_from_text(text: str) -> list:
    t = norm_ar(text)
    rules = [
        ("pensions",   ["معاش","تقاعد","تسريح","راتب تقاعدي","صرف"]),
        ("salary",     ["اساس الراتب","راتب","سلسله الرتب","درجه","رتبه"]),
        ("rights",     ["حق","حقوق","تعويض","مساعده","منحه","مستحقات"]),
        ("medical",    ["طبابه","استشفاء","مستشفى","دواء","ضمان","تقديمات صحيه"]),
        ("education",  ["منح","مدرسه","جامعه","تعليم","طلاب"]),
        ("procedures", ["معامله","افاده","طلب","مستندات","اوراق","اجراءات","تصحيح"]),
        ("allowances", ["بدل","متممات","حوافز","ملحق","زياده"]),
    ]
    out = []
    for tag, keys in rules:
        for k in keys:
            if norm_ar(k) in t:
                out.append(tag)
                break
    return sorted(list(dict.fromkeys(out)))

def topic_from_tags_fn(tags: list) -> Optional[str]:
    if "pensions" in tags or "salary" in tags:
        return "PENSIONS"
    if "medical" in tags:
        return "HEALTH"
    if "education" in tags:
        return "EDU"
    if "procedures" in tags:
        return "PROCEDURES"
    if "rights" in tags or "allowances" in tags:
        return "RIGHTS"
    return None

def short_excerpt(txt: str, max_chars: int = 420) -> str:
    txt = (txt or "").strip()
    txt = re.sub(r"\s+", " ", txt)
    return txt if len(txt) <= max_chars else (txt[:max_chars].rstrip() + "…")

def search_law_refs(cur, question_text: str, tags: list, limit: int = 5):
    q = (question_text or "").strip()
    if not q:
        return []

    if tags:
        cur.execute("""
          SELECT law_code, article_no, title_ar, text_ar
          FROM kb_laws
          WHERE (tags_json ?| %s)
             OR (to_tsvector('simple', COALESCE(title_ar,'') || ' ' || COALESCE(text_ar,'')) @@ plainto_tsquery('simple', %s))
          ORDER BY
            CASE WHEN (tags_json ?| %s) THEN 0 ELSE 1 END,
            law_code, article_no
          LIMIT %s
        """, (tags, q, tags, limit))
    else:
        cur.execute("""
          SELECT law_code, article_no, title_ar, text_ar
          FROM kb_laws
          WHERE to_tsvector('simple', COALESCE(title_ar,'') || ' ' || COALESCE(text_ar,'')) @@ plainto_tsquery('simple', %s)
          ORDER BY law_code, article_no
          LIMIT %s
        """, (q, limit))

    rows = cur.fetchall()
    refs = []
    for (law_code, article_no, title_ar, text_ar) in rows:
        refs.append({
            "law_code": law_code,
            "article_no": article_no,
            "note": (title_ar or "").strip()[:120] if title_ar else None,
            "excerpt": short_excerpt(text_ar)
        })
    return refs

@router.post("/drafts/{faq_id}/resuggest")
def resuggest_draft(faq_id: int, max_refs: int = 5, update_topic_and_tags: bool = True):
    import json
    from ..core.db import get_conn

    row = fetchone("""
      SELECT question_ar, COALESCE(tags_json,'[]'::jsonb), topic_code
      FROM kb_faq
      WHERE faq_id=%s AND status='draft'
    """, (faq_id,))
    if not row:
        return {"ok": False, "error": "draft not found"}

    question_ar = row[0]
    existing_tags = row[1] or []
    existing_topic = row[2]

    inferred_tags = infer_tags_from_text(question_ar)
    tags = sorted(list(dict.fromkeys((existing_tags if isinstance(existing_tags, list) else []) + inferred_tags)))
    topic = topic_from_tags_fn(tags) or existing_topic

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            refs = search_law_refs(cur, question_ar, tags if update_topic_and_tags else (existing_tags if isinstance(existing_tags, list) else []), limit=max_refs)

        refs_json = [{"law_code": r["law_code"], "article_no": r["article_no"], "note": r.get("note")} for r in refs]

        official_parts = []
        for r in refs[:3]:
            if r.get("excerpt"):
                official_parts.append(f"{r['law_code']} المادة {r['article_no']}: {r['excerpt']}")
        answer_official = "\n\n".join(official_parts).strip() if official_parts else None

        if update_topic_and_tags:
            fetchone("""
              UPDATE kb_faq
              SET refs_json=%s::jsonb,
                  answer_official_ar=%s,
                  tags_json=%s::jsonb,
                  topic_code=%s,
                  needs_review=TRUE
              WHERE faq_id=%s
              RETURNING faq_id
            """, (json.dumps(refs_json), answer_official, json.dumps(tags), topic, faq_id))
        else:
            fetchone("""
              UPDATE kb_faq
              SET refs_json=%s::jsonb,
                  answer_official_ar=%s,
                  needs_review=TRUE
              WHERE faq_id=%s
              RETURNING faq_id
            """, (json.dumps(refs_json), answer_official, faq_id))

        return {"ok": True, "faq_id": faq_id, "refs_count": len(refs_json), "topic_code": topic, "tags_json": tags}
    finally:
        conn.close()


# ========================================
# Compose: توليد جواب مبسّط من الإحالات
# ========================================
def compose_simple_answer(question_ar: str, topic: Optional[str], tags: list, refs_json: list, answer_official_ar: Optional[str]) -> str:
    """أسلوب: عسكري مهذّب، بسيط لكبار السن"""
    q = (question_ar or "").strip()
    lines = []
    lines.append("أكيد، حاضر. خلّيني ساعدك بطريقة بسيطة وواضحة 👇")
    lines.append("")

    if topic == "PENSIONS":
        lines.append("📌 بخصوص المعاش/التقاعد:")
        lines.append("1) قلّي **الرتبة** و**الدرجة** و**الوضع العائلي** (أعزب/متأهل + عدد الأولاد).")
        lines.append("2) إذا عندك أي قرار/رقم معاش أو إفادة قديمة، خبرني عنها (إن وجدت).")
        lines.append("3) منحسب لك الأساس والاقتطاعات والإضافات حسب الجداول المعتمدة.")
    elif topic == "PROCEDURES":
        lines.append("📌 بخصوص المعاملة:")
        lines.append("1) قلّي **اسم المعاملة** اللي بدّك ياها (مثلاً: إفادة معاش / تصحيح بيانات / طلب مساعدة…).")
        lines.append("2) بقولك **الأوراق المطلوبة** وخطوات التقديم خطوة خطوة.")
        lines.append('3) إذا بتحب، منعمل "طلب متابعة" ونرجعلك بالجواب النهائي.')
    elif topic == "HEALTH":
        lines.append("📌 بخصوص الطبابة/الاستشفاء:")
        lines.append("1) قلّي إذا الاستفادة إلك أو لأحد أفراد العيلة.")
        lines.append("2) بحدّد لك الشروط والمستندات وخطوات التقديم.")
    elif topic == "RIGHTS":
        lines.append("📌 بخصوص الحقوق/المساعدات:")
        lines.append("1) حدّد نوع الحق: **مساعدة اجتماعية / تعويض / منحة…**")
        lines.append("2) منطلع الشروط والأوراق المطلوبة وكيف تقدّم.")
    else:
        lines.append("📌 لتساعدني أعطيك جواب دقيق:")
        lines.append("قلّي إذا سؤالك عن **معاش**، أو **حق/مساعدة**، أو **طبابة**، أو **معاملة**.")

    # إحالات مبسطة (بدون إسهاب)
    if refs_json and len(refs_json) > 0:
        lines.append("")
        lines.append("⚖️ للمرجعية القانونية (للمراجعة):")
        for r in refs_json[:3]:
            lc = r.get("law_code")
            an = r.get("article_no")
            note = r.get("note")
            if lc and an:
                lines.append(f"- {lc} — المادة {an}" + (f" ({note})" if note else ""))

    lines.append("")
    lines.append("إذا بتكتبلي التفاصيل هلّق، منكمّل سوا خطوة بخطوة. 🙏")
    return "\n".join(lines).strip()


@router.post("/drafts/{faq_id}/compose")
def compose_draft_answer(faq_id: int):
    row = fetchone("""
      SELECT question_ar, topic_code, COALESCE(tags_json,'[]'::jsonb),
             COALESCE(refs_json,'[]'::jsonb), answer_official_ar
      FROM kb_faq
      WHERE faq_id=%s AND status='draft'
    """, (faq_id,))
    if not row:
        return {"ok": False, "error": "draft not found"}

    question_ar, topic_code, tags_json, refs_json, answer_official_ar = row

    # إذا ما في refs، من الأفضل تعمل resuggest أولاً، بس منركّب جواب عام
    tags = tags_json or []
    refs = refs_json or []

    composed = compose_simple_answer(question_ar, topic_code, tags, refs, answer_official_ar)

    fetchone("""
      UPDATE kb_faq
      SET answer_ar=%s, needs_review=TRUE
      WHERE faq_id=%s
      RETURNING faq_id
    """, (composed, faq_id))

    return {"ok": True, "faq_id": faq_id}


# ========================================
# Create Draft from Suggested
# ========================================
class CreateDraftReq(BaseModel):
    question_norm: str
    question_ar: Optional[str] = None
    count: Optional[int] = None
    last_asked_at: Optional[str] = None

@router.post("/drafts/create_from_suggested")
def create_draft_from_suggested(req: CreateDraftReq):
    qn = (req.question_norm or "").strip()
    if not qn:
        return {"ok": False, "error": "question_norm required"}

    # خذ أحدث مثال من log إذا ما انبعت question_ar
    q_ar = (req.question_ar or "").strip()
    if not q_ar:
        r = fetchone("""
          SELECT user_text
          FROM kb_query_log
          WHERE route='case' AND user_text_norm=%s
          ORDER BY asked_at DESC
          LIMIT 1
        """, (qn,))
        q_ar = r[0] if r else qn

    # احصائيات
    cnt = req.count
    if cnt is None:
        c = fetchone("""
          SELECT COUNT(*)::int
          FROM kb_query_log
          WHERE route='case' AND user_text_norm=%s
        """, (qn,))
        cnt = c[0] if c else 0

    last_at = req.last_asked_at
    if not last_at:
        m = fetchone("""
          SELECT MAX(asked_at)::text
          FROM kb_query_log
          WHERE route='case' AND user_text_norm=%s
        """, (qn,))
        last_at = m[0] if m else None

    # أنشئ Draft
    r = fetchone("""
      INSERT INTO kb_faq(
        question_ar, question_norm,
        answer_ar, answer_official_ar,
        topic_code, tags_json, refs_json,
        hits_total, last_asked_at,
        status, created_from_norm, needs_review
      )
      VALUES (
        %s, %s,
        %s, NULL,
        NULL, '[]'::jsonb, '[]'::jsonb,
        %s, %s,
        'draft', %s, TRUE
      )
      ON CONFLICT (question_norm) DO UPDATE
      SET status='draft', needs_review=TRUE
      RETURNING faq_id
    """, (
      q_ar, qn,
      "⚠️ مسودة: اضغط «اعثر على إحالات» ثم «اقترح جواب مبسّط»، وبعدها راجع وانشر.",
      cnt, last_at, qn
    ))

    return {"ok": True, "faq_id": r[0]}


# ========================================
# Priority Dashboard (Top unanswered)
# ========================================
class PriorityItem(BaseModel):
    question_norm: str
    count: int
    last_asked_at: str
    examples: List[str]

@router.get("/priority", response_model=List[PriorityItem])
def priority(window_days: int = 7, limit: int = 25, examples_per_item: int = 2, tag_filter: Optional[str] = None):
    rows = fetchall("""
      SELECT user_text_norm,
             COUNT(*)::int AS cnt,
             MAX(asked_at)::text AS last_asked_at
      FROM kb_query_log
      WHERE route='case' AND asked_at >= now() - (%s || ' days')::interval
      GROUP BY user_text_norm
      ORDER BY cnt DESC, MAX(asked_at) DESC
      LIMIT %s
    """, (window_days, limit * 3))  # ناخد أكثر شوي لأننا رح نفلتر بالبايثون

    out = []
    for (qn, cnt, last_at) in rows:
        ex = fetchall("""
          SELECT user_text
          FROM kb_query_log
          WHERE route='case' AND user_text_norm=%s
          ORDER BY asked_at DESC
          LIMIT %s
        """, (qn, examples_per_item))
        examples = [e[0] for e in ex]

        # فلترة حسب tag inferred من النص
        if tag_filter:
            # استنتاج tags من أحدث مثال
            inferred = infer_tags_from_text(examples[0] if examples else qn)
            if tag_filter not in inferred:
                continue

        out.append({
          "question_norm": qn,
          "count": cnt,
          "last_asked_at": last_at or "",
          "examples": examples
        })

        if len(out) >= limit:
            break

    return out


# ========================================
# Assign Draft to Reviewer
# ========================================
class AssignReq(BaseModel):
    reviewer_name: str

@router.post("/drafts/{faq_id}/assign")
def assign_draft(faq_id: int, req: AssignReq):
    name = (req.reviewer_name or "").strip()
    if not name:
        return {"ok": False, "error": "reviewer_name required"}

    r = fetchone("""
      UPDATE kb_faq
      SET reviewer_name=%s, review_status='assigned', needs_review=TRUE
      WHERE faq_id=%s AND status='draft'
      RETURNING faq_id
    """, (name, faq_id))
    return {"ok": True, "faq_id": r[0] if r else faq_id}


# ========================================
# Review Workload Dashboard
# ========================================
class ReviewerWorkloadItem(BaseModel):
    reviewer_name: Optional[str] = None
    review_status: str
    drafts_count: int
    max_hits: int
    last_activity: Optional[str] = None

@router.get("/review/workload", response_model=List[ReviewerWorkloadItem])
def review_workload():
    rows = fetchall("""
      SELECT COALESCE(reviewer_name,'(غير معيّن)') AS reviewer,
             review_status,
             COUNT(*)::int AS drafts_count,
             COALESCE(MAX(hits_total),0)::int AS max_hits,
             COALESCE(MAX(last_asked_at)::text,'') AS last_activity
      FROM kb_faq
      WHERE status='draft'
      GROUP BY COALESCE(reviewer_name,'(غير معيّن)'), review_status
      ORDER BY reviewer ASC, review_status ASC
    """)
    return [{
      "reviewer_name": r[0],
      "review_status": r[1],
      "drafts_count": r[2],
      "max_hits": r[3],
      "last_activity": r[4] or None
    } for r in rows]


# ========================================
# Review Queue (Priority + Overdue)
# ========================================
class DraftQueueItem(BaseModel):
    faq_id: int
    question_ar: str
    topic_code: Optional[str] = None
    reviewer_name: Optional[str] = None
    review_status: str
    hits_total: int
    last_asked_at: Optional[str] = None
    has_refs: bool
    has_official: bool
    priority: str  # normal | urgent

@router.get("/review/queue", response_model=List[DraftQueueItem])
def review_queue(limit: int = 50, urgent_hits: int = 50, overdue_days: int = 14):
    rows = fetchall("""
      SELECT faq_id, question_ar, topic_code, reviewer_name, review_status,
             hits_total, COALESCE(last_asked_at::text,'') AS last_asked_at,
             (COALESCE(jsonb_array_length(refs_json),0) > 0) AS has_refs,
             (COALESCE(length(COALESCE(answer_official_ar,'')),0) > 0) AS has_official
      FROM kb_faq
      WHERE status='draft'
      ORDER BY hits_total DESC, last_asked_at DESC NULLS LAST
      LIMIT %s
    """, (limit * 3,))

    out = []
    for r in rows:
        faq_id, q_ar, topic, reviewer, st, hits, last_at, has_refs, has_official = r

        # تحديد priority
        priority = "urgent" if hits >= urgent_hits else "normal"

        out.append({
            "faq_id": faq_id,
            "question_ar": q_ar,
            "topic_code": topic,
            "reviewer_name": reviewer,
            "review_status": st,
            "hits_total": hits,
            "last_asked_at": last_at or None,
            "has_refs": bool(has_refs),
            "has_official": bool(has_official),
            "priority": priority
        })

        if len(out) >= limit:
            break

    return out