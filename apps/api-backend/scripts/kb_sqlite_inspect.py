#!/usr/bin/env python3
"""SQLite KB inspection (read-only)."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

REQUIRED_TABLES = [
    "transactions",
    "tx_fts",
    "tx_links",
    "law_sources",
    "law_articles",
    "law_fts",
    "tx_law_map",
]

REQUIRED_COLUMNS = {
    "transactions": ["tx_no"],
    "tx_links": ["tx_no"],
    "law_articles": ["article_no"],
    "tx_law_map": ["tx_no", "article_no", "relevance", "rationale"],
}

TRANSACTION_TITLE_COLUMNS = ["title", "title_ar", "title_en"]
TRANSACTION_SUMMARY_COLUMNS = ["summary", "summary_ar", "summary_en"]
LAW_TEXT_COLUMNS = ["text_ar", "body", "body_ar"]
TX_LINK_RELATED_COLUMNS = ["related_tx_no", "related_tx", "tx_no_related"]


def _open_readonly(path: str) -> sqlite3.Connection:
    path_obj = Path(path)
    if not path_obj.is_absolute():
        path_obj = (Path.cwd() / path_obj).resolve()
    uri = f"file:{path_obj.as_posix()}?mode=ro"
    return sqlite3.connect(uri, uri=True)


def _table_list(conn: sqlite3.Connection) -> List[str]:
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    return sorted([r[0] for r in rows])


def _table_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    try:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
        return [r[1] for r in rows]
    except Exception:
        return []


def _fts_type(conn: sqlite3.Connection, table: str) -> str:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    if not row or not row[0]:
        return "unknown"
    sql = row[0].lower()
    if "fts5" in sql:
        return "fts5"
    if "fts4" in sql:
        return "fts4"
    return "unknown"


def _safe_match(conn: sqlite3.Connection, table: str, term: str) -> bool:
    try:
        conn.execute(f"SELECT rowid FROM {table} WHERE {table} MATCH ? LIMIT 1", (term,))
        return True
    except Exception:
        return False


def inspect_sqlite(path: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "kb_path": path,
        "exists": os.path.exists(path),
        "readable": False,
        "sqlite_version": None,
        "page_count": None,
        "page_size": None,
        "tables": [],
        "required_tables": {},
        "required_columns": {},
        "fts": {},
        "counts": {},
        "mapping_coverage": None,
        "fts_sanity": {},
        "join_test": None,
        "kb_age": None,
        "compat_mapping": {},
    }

    if not os.path.exists(path):
        return result

    result["kb_age"] = os.path.getmtime(path)

    conn = _open_readonly(path)
    try:
        result["readable"] = True
        result["sqlite_version"] = conn.execute("select sqlite_version()").fetchone()[0]
        result["page_count"] = conn.execute("pragma page_count").fetchone()[0]
        result["page_size"] = conn.execute("pragma page_size").fetchone()[0]

        tables = _table_list(conn)
        result["tables"] = tables

        for table in REQUIRED_TABLES:
            exists = table in tables
            result["required_tables"][table] = exists
            if exists:
                cols = _table_columns(conn, table)
                result["required_columns"][table] = cols

        for table, req_cols in REQUIRED_COLUMNS.items():
            existing = set(result["required_columns"].get(table, []))
            missing = [c for c in req_cols if c not in existing]
            if missing:
                result["compat_mapping"][table] = {
                    "missing": missing,
                    "existing": sorted(existing),
                }

        tx_cols = set(result["required_columns"].get("transactions", []))
        if tx_cols:
            if not any(c in tx_cols for c in TRANSACTION_TITLE_COLUMNS):
                result["compat_mapping"].setdefault("transactions", {})
                result["compat_mapping"]["transactions"]["missing_title"] = TRANSACTION_TITLE_COLUMNS
            if not any(c in tx_cols for c in TRANSACTION_SUMMARY_COLUMNS):
                result["compat_mapping"].setdefault("transactions", {})
                result["compat_mapping"]["transactions"]["missing_summary"] = TRANSACTION_SUMMARY_COLUMNS

        tx_links_cols = set(result["required_columns"].get("tx_links", []))
        if tx_links_cols and not any(c in tx_links_cols for c in TX_LINK_RELATED_COLUMNS):
            result["compat_mapping"].setdefault("tx_links", {})
            result["compat_mapping"]["tx_links"]["missing_related"] = TX_LINK_RELATED_COLUMNS

        law_cols = set(result["required_columns"].get("law_articles", []))
        if law_cols and not any(c in law_cols for c in LAW_TEXT_COLUMNS):
            result["compat_mapping"].setdefault("law_articles", {})
            result["compat_mapping"]["law_articles"]["missing_text"] = LAW_TEXT_COLUMNS

        for fts_table in ("tx_fts", "law_fts"):
            if fts_table in tables:
                result["fts"][fts_table] = _fts_type(conn, fts_table)
                result["fts_sanity"][fts_table] = _safe_match(conn, fts_table, "وفاة" if fts_table == "tx_fts" else "تعويض")

        for table in ("transactions", "tx_links", "law_articles", "tx_law_map"):
            if table in tables:
                result["counts"][table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]

        if "transactions" in tables and "tx_law_map" in tables:
            total_tx = result["counts"].get("transactions") or 0
            mapped = conn.execute("SELECT COUNT(DISTINCT tx_no) FROM tx_law_map").fetchone()[0]
            result["mapping_coverage"] = 0 if total_tx == 0 else mapped / total_tx

        if "tx_law_map" in tables and "law_articles" in tables:
            row = conn.execute("SELECT tx_no, article_no FROM tx_law_map LIMIT 1").fetchone()
            if row:
                tx_no = row[0]
                join_row = conn.execute(
                    """
                    SELECT a.article_no
                    FROM tx_law_map m
                    JOIN law_articles a ON a.article_no = m.article_no
                    WHERE m.tx_no = ?
                    LIMIT 1
                    """,
                    (tx_no,),
                ).fetchone()
                result["join_test"] = bool(join_row)

        # KB age via metadata table if present
        for meta_table in ("kb_meta", "metadata"):
            if meta_table in tables:
                cols = _table_columns(conn, meta_table)
                if "updated_at" in cols:
                    row = conn.execute(f"SELECT updated_at FROM {meta_table} ORDER BY updated_at DESC LIMIT 1").fetchone()
                    if row:
                        result["kb_age"] = row[0]
                break
    finally:
        conn.close()

    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kb-path", dest="kb_path", default=None)
    parser.add_argument("--out", dest="out", default=None)
    args = parser.parse_args()

    kb_path = args.kb_path or "./data/kb.sqlite"
    data = inspect_sqlite(kb_path)

    output = json.dumps(data, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(output, encoding="utf-8")
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
