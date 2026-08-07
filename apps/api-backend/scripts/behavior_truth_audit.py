from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import guard_root_strict

ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "docs" / "BEHAVIOR_TRUTH_REPORT.md"

sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "apps" / "api"))

from config import settings  # noqa: E402
from main import app  # noqa: E402
from kb_sqlite import validate_schema  # noqa: E402

REQUIRED_ENDPOINTS = [
    ("POST", "/chat/ask"),
    ("POST", "/api/chat"),
    ("POST", "/whatsapp/webhook"),
]

FTS_TEST_QUERIES = [
    "\u062a\u0642\u0627\u0639\u062f",
    "\u0637\u0628\u0627\u0628\u0629",
    "\u0648\u0641\u0627\u0629",
    "\u0639\u0644\u0649 \u0627\u0644\u0639\u0627\u062a\u0642",
]


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return path.read_text(encoding="utf-8", errors="ignore")


def _find_handler(path: str, method: str) -> Optional[str]:
    for route in app.routes:
        methods = getattr(route, "methods", None)
        route_path = getattr(route, "path", None)
        if not methods or not route_path:
            continue
        if method.upper() in methods and route_path == path:
            endpoint = getattr(route, "endpoint", None)
            if endpoint:
                return f"{endpoint.__module__}.{endpoint.__name__}"
            return "<unknown>"
    return None


def _table_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return [row[1] for row in rows]


def _table_count(conn: sqlite3.Connection, table: str, where: Optional[str] = None, params: Tuple = ()) -> int:
    clause = f" WHERE {where}" if where else ""
    row = conn.execute(f"SELECT COUNT(*) FROM {table}{clause}", params).fetchone()
    return int(row[0]) if row else 0


def _fts_hits(conn: sqlite3.Connection, table: str, query: str) -> int:
    try:
        row = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {table} MATCH ?", (query,)).fetchone()
        return int(row[0]) if row else 0
    except Exception:
        return 0


def _pipeline_checks() -> Dict[str, bool]:
    public_text = _read_text(ROOT / "apps" / "api" / "routers" / "public.py")
    checks = {
        "input_normalizer": "input_normalizer.normalize_input" in public_text,
        "ux_policy": "ux_policy.enforce_policy" in public_text,
        "reranker": "reranker.rerank" in public_text,
        "iterative_retrieval": "build_expanded_query" in public_text,
        "approved_only": "review_statuses=[\"approved\"]" in public_text,
    }
    return checks


def main() -> int:
    guard_root_strict.guard_or_exit()
    issues: List[str] = []

    handlers: Dict[str, Optional[str]] = {}
    for method, path in REQUIRED_ENDPOINTS:
        handler = _find_handler(path, method)
        handlers[f"{method} {path}"] = handler
        if not handler:
            issues.append(f"missing_handler:{method}:{path}")

    flags = {
        "APP_ENV": settings.app_env,
        "WHATSAPP_SIMULATION_ENABLED": settings.whatsapp_simulation_enabled,
        "WHATSAPP_OUTBOUND_MODE": settings.whatsapp_outbound_mode,
        "WHATSAPP_INTERACTIVE_ENABLED": settings.whatsapp_interactive_enabled,
        "STT_ENABLED": settings.stt_enabled,
        "OCR_ENABLED": settings.ocr_enabled,
        "GUIDED_MODE_DEFAULT": settings.guided_mode_default,
        "ARABIZI_ENABLED": settings.arabizi_enabled,
        "KEYBOARD_GARBLE_FIX_ENABLED": settings.keyboard_garble_fix_enabled,
    }

    kb_path = settings.resolve_kb_path()
    kb_exists = Path(kb_path).exists()
    schema = validate_schema(kb_path) if kb_exists else {"ok": False, "missing_tables": []}

    kb_counts: Dict[str, int] = {}
    approved_counts: Dict[str, int] = {}
    fts_hits: Dict[str, Dict[str, int]] = {"tx_fts": {}, "law_fts": {}}

    if not kb_exists:
        issues.append("kb_missing")
    else:
        conn = sqlite3.connect(kb_path)
        try:
            kb_counts["transactions"] = _table_count(conn, "transactions")
            kb_counts["law_articles"] = _table_count(conn, "law_articles")
            kb_counts["tx_links"] = _table_count(conn, "tx_links")
            kb_counts["tx_law_map"] = _table_count(conn, "tx_law_map")

            columns = _table_columns(conn, "transactions")
            if "review_status" in columns:
                approved_counts["transactions_approved"] = _table_count(
                    conn, "transactions", "review_status = ?", ("approved",)
                )
                approved_counts["transactions_pending"] = _table_count(
                    conn, "transactions", "review_status = ?", ("pending",)
                )

            for query in FTS_TEST_QUERIES:
                fts_hits["tx_fts"][query] = _fts_hits(conn, "tx_fts", query)
                fts_hits["law_fts"][query] = _fts_hits(conn, "law_fts", query)
        finally:
            conn.close()

    if not schema.get("ok"):
        issues.append("kb_schema_invalid")

    pipeline = _pipeline_checks()
    for key, value in pipeline.items():
        if not value:
            issues.append(f"pipeline_missing:{key}")

    report_lines: List[str] = []
    report_lines.append("# Behavior Truth Report")
    report_lines.append("")
    report_lines.append("## Handler Mapping")
    for key, handler in handlers.items():
        report_lines.append(f"- {key}: {handler or 'MISSING'}")

    report_lines.append("")
    report_lines.append("## Flags")
    for key, value in flags.items():
        report_lines.append(f"- {key}: {value}")

    report_lines.append("")
    report_lines.append("## KB Schema & Counts")
    report_lines.append(f"- KB path: {kb_path}")
    report_lines.append(f"- KB exists: {kb_exists}")
    report_lines.append(f"- Schema OK: {schema.get('ok')}")
    if schema.get("missing_tables"):
        report_lines.append(f"- Missing tables: {schema.get('missing_tables')}")
    if kb_counts:
        report_lines.append(f"- Counts: {kb_counts}")
    if approved_counts:
        report_lines.append(f"- Approved counts: {approved_counts}")

    report_lines.append("")
    report_lines.append("## FTS Hit Counts")
    for table, hits in fts_hits.items():
        report_lines.append(f"- {table}: {hits}")

    report_lines.append("")
    report_lines.append("## Pipeline Wiring")
    for key, value in pipeline.items():
        report_lines.append(f"- {key}: {value}")

    report_lines.append("")
    report_lines.append("## WhatsApp Outbound Mode")
    report_lines.append(f"- Mode: {settings.whatsapp_outbound_mode}")

    report_lines.append("")
    report_lines.append("## Status")
    if issues:
        report_lines.append(f"- Issues: {issues}")
    else:
        report_lines.append("- OK: No issues detected")

    REPORT_PATH.write_text("\n".join(report_lines), encoding="utf-8")
    return 4 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
