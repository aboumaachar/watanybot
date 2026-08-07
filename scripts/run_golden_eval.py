#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Golden Eval Runner (KB correctness gate)

Modes:
1) HTTP mode (best): set CHAT_API_URL to an endpoint that accepts:
   POST { "question": "...", "session_id": "...", "meta": {...} }
   and returns JSON:
   { "ok": true, "intent": "law|service|salary|chat|other",
     "answer": "...",
     "citations": [ { "doc_no": "...", "doc_date": "...", "article": "...", "page": 42 } ],
     "needs_clarification": false,
     "confidence": 0.0-1.0
   }

2) Dry mode: no CHAT_API_URL -> validates golden questions file/schema + DB tables/rowcounts (if DATABASE_URL set).
   Outputs pass/fail for dataset completeness and DB readiness.

Inputs:
- Default golden set file: data/golden_questions.json
  You can also pass --golden path.json

Outputs:
- reports/golden_eval.json
- reports/golden_eval.md

Run:
  python scripts/run_golden_eval.py --golden data/golden_questions.json --out reports
  export CHAT_API_URL="https://koudama.com/api/v1/chat/ask"   # later
  python scripts/run_golden_eval.py --out reports

Optional DB check:
  export DATABASE_URL="postgresql://..."
"""

from __future__ import annotations
import os, json, argparse, uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

EXPECTED_INTENTS = {"law","service","salary","chat","other"}

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))

def save(path: Path, obj: Any):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")

def md_escape(s: str) -> str:
    return s.replace("\n", " ").strip()

# ---------- DB optional ----------
def db_counts(database_url: str, tables: List[str]) -> Dict[str,int]:
    try:
        import psycopg2  # type: ignore
    except Exception:
        return {t: -999 for t in tables}

    conn = psycopg2.connect(database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema='public';
    """)
    existing = {r[0] for r in cur.fetchall()}
    out: Dict[str,int] = {}
    for t in tables:
        if t not in existing:
            out[t] = -1
        else:
            cur.execute(f"SELECT COUNT(*) FROM {t};")
            out[t] = int(cur.fetchone()[0])
    cur.close()
    conn.close()
    return out

# ---------- HTTP adapter ----------
def http_ask(chat_api_url: str, question: str, session_id: str, meta: Dict[str,Any]) -> Dict[str,Any]:
    import requests  # type: ignore
    r = requests.post(chat_api_url, json={"question": question, "session_id": session_id, "meta": meta}, timeout=60)
    try:
        return r.json()
    except Exception:
        return {"ok": False, "error": f"non-json response status={r.status_code}", "raw": r.text[:800]}

# ---------- Scoring ----------
def check_case(case: Dict[str,Any], resp: Optional[Dict[str,Any]]) -> Tuple[bool, List[str]]:
    """
    Returns (pass, reasons[])
    """
    reasons: List[str] = []
    exp_intent = case.get("expected_intent")
    exp_citations = bool(case.get("expect_citations", False))
    exp_clarif = bool(case.get("expected_needs_clarification", False))

    if exp_intent not in EXPECTED_INTENTS:
        reasons.append(f"invalid expected_intent={exp_intent}")

    if resp is None:
        # dry mode: only dataset validation
        if reasons:
            return False, reasons
        return True, []

    if not resp.get("ok", False):
        return False, [f"response not ok: {resp.get('error','unknown')}"]

    got_intent = resp.get("intent")
    if exp_intent and got_intent != exp_intent:
        reasons.append(f"intent mismatch expected={exp_intent} got={got_intent}")

    got_clarif = bool(resp.get("needs_clarification", False))
    if got_clarif != exp_clarif:
        reasons.append(f"clarification mismatch expected={exp_clarif} got={got_clarif}")

    if exp_citations:
        cits = resp.get("citations") or []
        if not isinstance(cits, list) or len(cits) == 0:
            reasons.append("missing citations (expected citations)")

    # optional keyword expectations (lightweight)
    exp_keywords = case.get("expected_keywords") or []
    if exp_keywords and isinstance(exp_keywords, list):
        ans = (resp.get("answer") or "").lower()
        for kw in exp_keywords:
            if isinstance(kw, str) and kw.strip():
                if kw.strip().lower() not in ans:
                    reasons.append(f"missing expected keyword: {kw}")

    return (len(reasons) == 0), reasons

def render_md(result: Dict[str,Any]) -> str:
    lines = []
    lines.append("# Golden Eval Report")
    lines.append(f"- Generated (UTC): **{result['generated_at_utc']}**")
    lines.append(f"- Mode: **{result['mode']}**")
    lines.append(f"- Total cases: **{result['total']}**")
    lines.append(f"- Pass: **{result['pass']}** | Fail: **{result['fail']}**")
    lines.append(f"- Pass rate: **{result['pass_rate_percent']}%**")
    if result.get("db_counts"):
        lines.append("")
        lines.append("## DB Readiness")
        for t, c in result["db_counts"].items():
            lines.append(f"- `{t}`: {c}")
    if result["fail"] > 0:
        lines.append("")
        lines.append("## Failures (top 30)")
        for f in result["failures"][:30]:
            lines.append(f"- **{md_escape(f['id'])}**: {md_escape(f['question'])}")
            for r in f["reasons"]:
                lines.append(f"  - {md_escape(r)}")
    return "\n".join(lines)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--golden", default="data/golden_questions.json", help="Golden questions JSON path")
    ap.add_argument("--out", default="reports", help="Output folder")
    ap.add_argument("--limit", type=int, default=0, help="Limit number of cases (0=all)")
    args = ap.parse_args()

    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    golden_path = Path(args.golden).resolve()
    if not golden_path.exists():
        raise SystemExit(f"Missing golden file: {golden_path}")

    data = load_json(golden_path)
    if not isinstance(data, list):
        raise SystemExit("Golden file must be a JSON array of cases")

    cases = data[: args.limit] if args.limit and args.limit > 0 else data

    chat_api_url = os.environ.get("CHAT_API_URL", "").strip()
    mode = "http" if chat_api_url else "dry"

    # Optional DB readiness check
    db_url = os.environ.get("DATABASE_URL", "").strip()
    kb_tables = [
        "kb_documents","kb_law_articles","kb_services","kb_dialog_intents","kb_golden_questions"
    ]
    db_ready = None
    if db_url:
        db_ready = db_counts(db_url, kb_tables)

    failures = []
    passed = 0

    session_id = str(uuid.uuid4())
    for case in cases:
        cid = case.get("id") or str(uuid.uuid4())
        q = case.get("question")
        if not q or not isinstance(q, str):
            failures.append({"id": cid, "question": str(q), "reasons": ["missing question string"]})
            continue

        resp = None
        if mode == "http":
            resp = http_ask(chat_api_url, q, session_id, meta={"case_id": cid})

        ok, reasons = check_case(case, resp)
        if ok:
            passed += 1
        else:
            failures.append({"id": cid, "question": q, "reasons": reasons, "response": resp})

    total = len(cases)
    fail = total - passed
    pass_rate = round((passed / max(total, 1)) * 100.0, 1)

    result = {
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "golden_file": str(golden_path),
        "total": total,
        "pass": passed,
        "fail": fail,
        "pass_rate_percent": pass_rate,
        "db_counts": db_ready,
        "failures": failures,
    }

    save(out_dir / "golden_eval.json", result)
    (out_dir / "golden_eval.md").write_text(render_md(result), encoding="utf-8")

    print("[OK] reports/golden_eval.md")
    print("[OK] reports/golden_eval.json")
    print(f"[INFO] Mode={mode} PassRate={pass_rate}%")

if __name__ == "__main__":
    main()