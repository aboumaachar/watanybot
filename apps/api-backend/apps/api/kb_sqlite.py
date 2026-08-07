from __future__ import annotations

import os
import sqlite3
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

REQUIRED_TABLES = [
    "transactions",
    "tx_fts",
    "tx_links",
    "law_sources",
    "law_articles",
    "law_fts",
    "tx_law_map",
]

# v4 schema tables (alternative)
V4_TABLES = [
    "kb_transactions",
    "kb_rag_fts",
    "kb_rag_chunks",
]

# Cache which schema version a db uses
_schema_version_cache: Dict[str, str] = {}


def _detect_schema_version(conn: sqlite3.Connection, db_path: str) -> str:
    """Detect if db uses v3 (transactions/tx_fts) or v4 (kb_transactions/kb_rag_fts)."""
    cached = _schema_version_cache.get(db_path)
    if cached:
        return cached
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {r[0] for r in cursor.fetchall()}
    if "kb_transactions" in tables and "kb_rag_fts" in tables:
        _schema_version_cache[db_path] = "v4"
        return "v4"
    _schema_version_cache[db_path] = "v3"
    return "v3"

REVIEW_COLUMNS = {
    "review_status": "TEXT",
    "review_notes": "TEXT",
    "reviewed_by": "TEXT",
    "reviewed_at": "TEXT",
}


@dataclass
class ProcedureSearchResult:
    tx_no: str
    title: str
    summary: str
    score: float


@dataclass
class LawSearchResult:
    article_no: str
    preview: str
    score: float


# ---------------------------------------------------------------------------
# Connection & metadata caching for performance
# ---------------------------------------------------------------------------
import threading

_conn_cache: Dict[str, sqlite3.Connection] = {}
_conn_lock = threading.Lock()
_column_cache: Dict[Tuple[str, str], List[str]] = {}
_bm25_cache: Dict[Tuple[str, str], bool] = {}


def _connect(db_path: str) -> sqlite3.Connection:
    """Return a cached read-only connection (thread-safe)."""
    with _conn_lock:
        conn = _conn_cache.get(db_path)
        if conn is not None:
            try:
                conn.execute("SELECT 1")
                return conn
            except Exception:
                # stale connection — recreate
                _conn_cache.pop(db_path, None)
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        # Enable WAL mode for better read concurrency
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA cache_size=-8000")  # 8 MB page cache
        except Exception:
            pass
        _conn_cache[db_path] = conn
        return conn


def invalidate_conn_cache(db_path: Optional[str] = None) -> None:
    """Close and drop cached connection(s). Call when KB file changes."""
    with _conn_lock:
        if db_path:
            conn = _conn_cache.pop(db_path, None)
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass
            keys = [k for k in _column_cache if k[0] == db_path]
            for k in keys:
                _column_cache.pop(k, None)
            keys = [k for k in _bm25_cache if k[0] == db_path]
            for k in keys:
                _bm25_cache.pop(k, None)
        else:
            for c in _conn_cache.values():
                try:
                    c.close()
                except Exception:
                    pass
            _conn_cache.clear()
            _column_cache.clear()
            _bm25_cache.clear()


def _table_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    db_path = conn.execute("PRAGMA database_list").fetchone()[2] or ""
    key = (db_path, table)
    cached = _column_cache.get(key)
    if cached is not None:
        return cached
    try:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
        result = [row[1] for row in rows]
    except Exception:
        result = []
    _column_cache[key] = result
    return result


def _pick_column(columns: List[str], candidates: List[str]) -> Optional[str]:
    for col in candidates:
        if col in columns:
            return col
    return None


# ---------------------------------------------------------------------------
# v4 Schema Implementation (kb_transactions, kb_rag_fts, kb_rag_chunks)
# ---------------------------------------------------------------------------

import json as _json
import re as _re

_ARABIC_DIACRITICS_RE = _re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")
_NON_WORD_RE = _re.compile(r"[^\w\u0600-\u06FF]+", _re.UNICODE)


def _sanitize_fts_query(q: str) -> str:
    """Sanitize a query string for FTS5 MATCH. Wraps each token in quotes."""
    tokens = _re.findall(r'[\w\u0600-\u06FF]+', q, _re.UNICODE)
    normalized_query = _normalize_search_text(q)
    if (
        "بطاقه صحي" in normalized_query
        or "بطاقه طبابه" in normalized_query
        or "الخدمات الصحيه" in normalized_query
    ):
        for synonym in ["طبابة", "صحية", "الخدمات", "الصحية", "العسكرية", "خدمات"]:
            if synonym not in tokens:
                tokens.append(synonym)
    if not tokens:
        return '""'
    # Use OR between tokens for broader matching
    return " OR ".join(f'"{t}"' for t in tokens if len(t) > 1)


def _normalize_search_text(text: str) -> str:
    text = (text or "").lower()
    text = _ARABIC_DIACRITICS_RE.sub("", text)
    text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    text = text.replace("ة", "ه").replace("ى", "ي")
    text = _NON_WORD_RE.sub(" ", text)
    return " ".join(part for part in text.split() if part)


def _tokenize_query(text: str) -> List[str]:
    base_tokens = [token for token in _normalize_search_text(text).split() if token]
    tokens: List[str] = []
    for token in base_tokens:
        if token not in tokens:
            tokens.append(token)
        if token.startswith("ال") and len(token) > 3:
            stripped = token[2:]
            if stripped not in tokens:
                tokens.append(stripped)
    has_card = any(token in {"بطاقه", "تصريح"} for token in tokens)
    has_medical = any(token in {"صحي", "صحيه", "خدمات", "استشفاء", "علاج", "معالجه"} for token in tokens)
    if has_card and has_medical:
        for synonym in ["طبابه", "عسكريه", "الخدمات", "الصحيه"]:
            if synonym not in tokens:
                tokens.append(synonym)
    return tokens


def _has_all_tokens(text: str, tokens: List[str]) -> bool:
    return bool(tokens) and all(token in text for token in tokens)


def _has_any_token(text: str, tokens: List[str]) -> bool:
    return any(token in text for token in tokens)


def _is_medical_card_intent(query: str, tokens: List[str]) -> bool:
    normalized_query = _normalize_search_text(query)
    token_blob = " ".join(tokens)
    has_card = _has_any_token(token_blob, ["بطاقه", "تصريح"])
    has_medical = _has_any_token(token_blob, ["طبابه", "صحي", "صحيه", "استشفاء", "علاج", "معالجه", "خدمات"])
    return (
        "بطاقه صحي" in normalized_query
        or "بطاقه طبابه" in normalized_query
        or "الخدمات الصحيه" in normalized_query
        or (has_card and has_medical)
    )


def _score_phrase_boost(query: str, title: str, summary: str, full_text: str) -> float:
    normalized_query = _normalize_search_text(query)
    title_norm = _normalize_search_text(title)
    summary_norm = _normalize_search_text(summary)
    text_norm = _normalize_search_text(full_text)
    tokens = _tokenize_query(query)
    combined = " ".join(part for part in [summary_norm, text_norm] if part)
    boost = 0.0

    if normalized_query and normalized_query in title_norm:
        boost += 8.0
    elif normalized_query and normalized_query in combined:
        boost += 4.0

    if _has_all_tokens(title_norm, tokens):
        boost += 4.0
    elif _has_all_tokens(combined, tokens):
        boost += 2.0

    if _is_medical_card_intent(query, tokens):
        medical_target = " ".join(part for part in [title_norm, summary_norm, text_norm] if part)
        if "طبابه عسكريه" in medical_target or "خدمات الطبابه العسكريه" in medical_target:
            boost += 8.0
        if "بطاقه خدمات اجتماعيه" in medical_target:
            boost -= 2.0

    return boost


def _search_procedures_v4(
    conn: sqlite3.Connection,
    q: str,
    limit: int = 10,
    lang: str = "ar",
) -> List[ProcedureSearchResult]:
    """Search procedures using v4 schema (kb_rag_fts + kb_transactions)."""
    cursor = conn.cursor()
    use_bm25 = _detect_bm25(conn, "kb_rag_fts")
    fts_q = _sanitize_fts_query(q)

    if use_bm25:
        cursor.execute(
            """
            SELECT f.doc_topic_no, f.text, f.metadata_json, bm25(kb_rag_fts) AS rank
            FROM kb_rag_fts f
            WHERE kb_rag_fts MATCH ?
            ORDER BY rank ASC
            LIMIT ?
            """,
            (fts_q, limit * 3),
        )
    else:
        cursor.execute(
            """
            SELECT doc_topic_no, text, metadata_json
            FROM kb_rag_fts
            WHERE kb_rag_fts MATCH ?
            LIMIT ?
            """,
            (fts_q, limit * 3),
        )
    rows = cursor.fetchall()
    if not rows:
        # Fallback: LIKE search on kb_transactions
        like_q = f"%{q}%"
        cursor.execute(
            """
            SELECT doc_topic_no, title_ar, keywords_ar, section_name_ar
            FROM kb_transactions
            WHERE title_ar LIKE ? OR keywords_ar LIKE ? OR section_name_ar LIKE ?
            LIMIT ?
            """,
            (like_q, like_q, like_q, limit),
        )
        rows = cursor.fetchall()
        terms = _tokenize_query(q)
        results = []
        for row in rows:
            title = row["title_ar"] or ""
            summary = row["section_name_ar"] or ""
            full_text = f"{title} {summary} {row['keywords_ar'] or ''}".strip()
            score = _score_text_match(title, terms) + _score_text_match(row["keywords_ar"] or "", terms) * 0.5
            score += _score_phrase_boost(q, title, summary, full_text)
            results.append(ProcedureSearchResult(
                tx_no=str(row["doc_topic_no"]),
                title=title,
                summary=summary,
                score=score,
            ))
        results.sort(key=lambda r: r.score, reverse=True)
        return results[:limit]

    # Deduplicate by doc_topic_no, keep best score
    seen: Dict[int, Tuple[float, str, str]] = {}
    terms = _tokenize_query(q)
    for row in rows:
        doc_no = int(row["doc_topic_no"])
        if use_bm25:
            score = _score_from_bm25(float(row["rank"]))
        else:
            score = _score_text_match(row["text"] or "", terms)
        meta = row["metadata_json"] or "{}"
        text = row["text"] or ""
        if doc_no not in seen or score > seen[doc_no][0]:
            seen[doc_no] = (score, meta, text)

    # Fetch titles from kb_transactions
    if seen:
        placeholders = ",".join(["?"] * len(seen))
        cursor.execute(
            f"SELECT doc_topic_no, title_ar FROM kb_transactions WHERE doc_topic_no IN ({placeholders})",
            tuple(seen.keys()),
        )
        titles = {int(r["doc_topic_no"]): r["title_ar"] for r in cursor.fetchall()}
    else:
        titles = {}

    results = []
    for doc_no, (score, meta_json, text) in seen.items():
        title = titles.get(doc_no, "")
        try:
            meta = _json.loads(meta_json)
        except Exception:
            meta = {}
        summary = meta.get("section_name_ar", "")
        score += _score_phrase_boost(q, title or meta.get("title_ar", ""), summary, text)
        results.append(ProcedureSearchResult(
            tx_no=str(doc_no),
            title=title or meta.get("title_ar", ""),
            summary=summary,
            score=score,
        ))
    results.sort(key=lambda r: r.score, reverse=True)
    return results[:limit]


def _get_procedure_v4(
    conn: sqlite3.Connection,
    tx_no: str,
    lang: str = "ar",
) -> Dict[str, Any]:
    """Get procedure details using v4 schema."""
    cursor = conn.cursor()
    doc_no = int(tx_no)

    # Main transaction
    cursor.execute("SELECT * FROM kb_transactions WHERE doc_topic_no = ?", (doc_no,))
    row = cursor.fetchone()
    if not row:
        return {}
    data = dict(row)
    data["tx_no"] = str(doc_no)
    data["title"] = data.get("title_ar", "")
    data["summary"] = data.get("section_name_ar", "")

    # Use body_ar as the main content (full transaction text from HTML)
    body = data.get("body_ar", "") or ""
    data["required_docs"] = body if body else None
    data["steps"] = None
    data["submit_location"] = data.get("primary_authority", "") or data.get("source", "")
    data["notes"] = None
    data["duration"] = None
    data["fees"] = None

    # Try to fetch from optional detail tables (may not exist in all builds)
    try:
        cursor.execute(
            "SELECT document_name_ar FROM kb_requirements WHERE doc_topic_no = ? ORDER BY requirement_order",
            (doc_no,),
        )
        docs = [r["document_name_ar"] for r in cursor.fetchall() if r["document_name_ar"]]
        if docs:
            data["required_docs"] = "\n".join(f"- {d}" for d in docs)
    except Exception:
        pass

    try:
        cursor.execute(
            "SELECT step_text_ar FROM kb_steps WHERE doc_topic_no = ? ORDER BY step_order",
            (doc_no,),
        )
        steps = [r["step_text_ar"] for r in cursor.fetchall() if r["step_text_ar"]]
        if steps:
            data["steps"] = "\n".join(f"- {s}" for s in steps)
    except Exception:
        pass

    try:
        cursor.execute(
            "SELECT name_ar FROM kb_authorities WHERE authority_id = ?",
            (data.get("primary_authority_id", ""),),
        )
        auth_row = cursor.fetchone()
        if auth_row:
            data["submit_location"] = auth_row["name_ar"]
    except Exception:
        pass

    try:
        cursor.execute(
            "SELECT kind, value, label_ar FROM kb_links_contacts WHERE doc_topic_no = ?",
            (doc_no,),
        )
        contacts = [f"{r['label_ar'] or r['kind']}: {r['value']}" for r in cursor.fetchall()]
        if contacts:
            data["notes"] = "\n".join(contacts)
    except Exception:
        pass

    try:
        cursor.execute(
            "SELECT rule_text_ar FROM kb_eligibility_rules WHERE doc_topic_no = ?",
            (doc_no,),
        )
        rules = [r["rule_text_ar"] for r in cursor.fetchall() if r["rule_text_ar"]]
        if rules:
            data["duration"] = "\n".join(f"- {r}" for r in rules)
    except Exception:
        pass

    data["related"] = []
    data["legal_basis"] = []
    data["lang"] = lang
    return data


def _get_procedure_enrichment_batch_v4(
    conn: sqlite3.Connection,
    tx_nos: List[str],
) -> Dict[str, Dict[str, Any]]:
    """Batch enrichment for v4 schema."""
    cursor = conn.cursor()
    doc_nos = []
    for t in tx_nos:
        try:
            doc_nos.append(int(t))
        except ValueError:
            pass
    if not doc_nos:
        return {}
    placeholders = ",".join(["?"] * len(doc_nos))
    cursor.execute(
        f"""
        SELECT doc_topic_no, keywords_ar, section_name_ar, category_domain
        FROM kb_transactions
        WHERE doc_topic_no IN ({placeholders})
        """,
        tuple(doc_nos),
    )
    result = {}
    for row in cursor.fetchall():
        result[str(row["doc_topic_no"])] = {
            "tags_json": row["keywords_ar"],
            "section": row["section_name_ar"] or row["category_domain"],
            "starred": False,
        }
    return result


def validate_schema(db_path: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "ok": True,
        "missing_tables": [],
        "fts_ok": True,
        "fts_errors": [],
    }

    if not os.path.exists(db_path):
        result["ok"] = False
        result["missing_tables"] = REQUIRED_TABLES
        return result

    conn = _connect(db_path)
    cursor = conn.cursor()
    for table in REQUIRED_TABLES:
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        )
        if not cursor.fetchone():
            result["missing_tables"].append(table)

    if result["missing_tables"]:
        result["ok"] = False

    for fts_table in ("tx_fts", "law_fts"):
        try:
            cursor.execute(
                f"SELECT rowid FROM {fts_table} WHERE {fts_table} MATCH ? LIMIT 1",
                ("test",),
            )
            cursor.fetchone()
        except Exception as exc:  # pragma: no cover - diagnostic only
            result["fts_ok"] = False
            result["fts_errors"].append(f"{fts_table}: {exc}")

    if not result["fts_ok"]:
        result["ok"] = False

    return result


def _detect_bm25(conn: sqlite3.Connection, fts_table: str) -> bool:
    db_path = conn.execute("PRAGMA database_list").fetchone()[2] or ""
    key = (db_path, fts_table)
    cached = _bm25_cache.get(key)
    if cached is not None:
        return cached
    try:
        conn.execute(f"SELECT bm25({fts_table}) FROM {fts_table} LIMIT 1")
        result = True
    except Exception:
        result = False
    _bm25_cache[key] = result
    return result


def _score_from_bm25(value: float) -> float:
    if value < 0:
        value = 0
    return 1.0 / (1.0 + value)


def _score_text_match(text: str, terms: List[str]) -> float:
    if not text:
        return 0.0
    score = 0.0
    lowered = _normalize_search_text(text)
    for term in terms:
        if term and term in lowered:
            score += 1.0
    return score


def search_procedures(
    db_path: str,
    q: str,
    limit: int = 10,
    lang: str = "ar",
    review_statuses: Optional[List[str]] = None,
    include_null_as_approved: bool = True,
) -> List[ProcedureSearchResult]:
    conn = _connect(db_path)
    version = _detect_schema_version(conn, db_path)
    if version == "v4":
        return _search_procedures_v4(conn, q, limit, lang)
    cursor = conn.cursor()
    tx_cols = _table_columns(conn, "transactions")
    title_col = _pick_column(tx_cols, [f"title_{lang}", "title_ar", "title"])
    summary_col = _pick_column(tx_cols, [f"summary_{lang}", "summary_ar", "summary"])
    if not title_col:
        title_col = "title_ar"
    if not summary_col:
        summary_col = "summary_ar"
    try:
        use_bm25 = _detect_bm25(conn, "tx_fts")
    except Exception:
        use_bm25 = False

    status_clause, status_params = _review_status_clause(
        tx_cols,
        review_statuses,
        alias="t",
        include_null_as_approved=include_null_as_approved,
    )

    if use_bm25:
        query = f"""
            SELECT t.tx_no,
                   t.{title_col} AS title,
                   t.{summary_col} AS summary,
                   bm25(tx_fts) AS rank
            FROM tx_fts
            JOIN transactions t ON t.tx_no = tx_fts.tx_no
            WHERE tx_fts MATCH ?
            {status_clause}
            ORDER BY rank ASC
            LIMIT ?
        """
        cursor.execute(query, tuple([q] + status_params + [limit]))
        rows = cursor.fetchall()
        if not rows:
            use_bm25 = False
        else:
            return [
                ProcedureSearchResult(
                    tx_no=str(row["tx_no"]),
                    title=row["title"] or "",
                    summary=row["summary"] or "",
                    score=_score_from_bm25(float(row["rank"]))
                )
                for row in rows
            ]

    # FTS without bm25
    try:
        query = f"""
            SELECT t.tx_no,
                   t.{title_col} AS title,
                   t.{summary_col} AS summary
            FROM tx_fts
            JOIN transactions t ON t.tx_no = tx_fts.tx_no
            WHERE tx_fts MATCH ?
            {status_clause}
            LIMIT ?
        """
        cursor.execute(query, tuple([q] + status_params + [limit]))
        rows = cursor.fetchall()
    except Exception:
        rows = []

    terms = _tokenize_query(q)
    if rows:
        scored = [
            (
                ProcedureSearchResult(
                    tx_no=str(row["tx_no"]),
                    title=row["title"] or "",
                    summary=row["summary"] or "",
                    score=(_score_text_match(row["title"] or "", terms) * 2.0)
                    + _score_text_match(row["summary"] or "", terms)
                    + _score_phrase_boost(q, row["title"] or "", row["summary"] or "", f"{row['title'] or ''} {row['summary'] or ''}"),
                )
            )
            for row in rows
        ]
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:limit]

    # FTS missing or failed: fallback to LIKE
    like_q = f"%{q}%"
    where_clause = f"({title_col} LIKE ? OR {summary_col} LIKE ?)"
    params: List[Any] = [like_q, like_q]
    if status_clause:
        where_clause = f"{where_clause} {status_clause}"
        params.extend(status_params)
    params.append(limit)
    cursor.execute(
        f"""
        SELECT tx_no, {title_col} AS title, {summary_col} AS summary
        FROM transactions
        WHERE {where_clause}
        LIMIT ?
        """,
        tuple(params),
    )
    rows = cursor.fetchall()
    scored = [
        ProcedureSearchResult(
            tx_no=str(row["tx_no"]),
            title=row["title"] or "",
            summary=row["summary"] or "",
            score=(_score_text_match(row["title"] or "", terms) * 2.0)
            + _score_text_match(row["summary"] or "", terms)
            + _score_phrase_boost(q, row["title"] or "", row["summary"] or "", f"{row['title'] or ''} {row['summary'] or ''}"),
        )
        for row in rows
    ]
    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[:limit]


def get_procedure_enrichment_batch(
    db_path: str,
    tx_nos: List[str],
    lang: str = "ar",
) -> Dict[str, Dict[str, Any]]:
    """Fetch tags_json, section, starred for multiple tx_nos in ONE query."""
    if not tx_nos:
        return {}
    conn = _connect(db_path)
    version = _detect_schema_version(conn, db_path)
    if version == "v4":
        return _get_procedure_enrichment_batch_v4(conn, tx_nos)
    cursor = conn.cursor()
    tx_cols = _table_columns(conn, "transactions")
    tag_col = _pick_column(tx_cols, ["tags_json", "tags"]) or "NULL"
    section_col = _pick_column(tx_cols, ["section", "section_ar", "category"]) or "NULL"
    starred_col = "starred" if "starred" in tx_cols else "NULL"
    placeholders = ",".join(["?"] * len(tx_nos))
    cursor.execute(
        f"""
        SELECT tx_no,
               {tag_col} AS tags_json,
               {section_col} AS section,
               {starred_col} AS starred
        FROM transactions
        WHERE tx_no IN ({placeholders})
        """,
        tuple(tx_nos),
    )
    result = {}
    for row in cursor.fetchall():
        result[str(row["tx_no"])] = {
            "tags_json": row["tags_json"],
            "section": row["section"],
            "starred": row["starred"],
        }
    return result


def get_procedure(
    db_path: str,
    tx_no: str,
    lang: str = "ar",
    review_statuses: Optional[List[str]] = None,
    include_null_as_approved: bool = True,
) -> Dict[str, Any]:
    conn = _connect(db_path)
    version = _detect_schema_version(conn, db_path)
    if version == "v4":
        return _get_procedure_v4(conn, tx_no, lang)
    cursor = conn.cursor()
    tx_cols = _table_columns(conn, "transactions")
    title_col = _pick_column(tx_cols, [f"title_{lang}", "title_ar", "title"])
    summary_col = _pick_column(tx_cols, [f"summary_{lang}", "summary_ar", "summary"])
    body_col = _pick_column(tx_cols, [f"body_{lang}", "body_ar", "body"])
    status_clause, status_params = _review_status_clause(
        tx_cols,
        review_statuses,
        alias="transactions",
        include_null_as_approved=include_null_as_approved,
    )
    cursor.execute(
        f"""
        SELECT *
        FROM transactions
        WHERE tx_no = ?
        {status_clause}
        """,
        tuple([tx_no] + status_params),
    )
    row = cursor.fetchone()
    if not row:
        return {}

    data = dict(row)

    if title_col:
        data["title"] = data.get(title_col)
    if summary_col:
        data["summary"] = data.get(summary_col)
    if body_col:
        data["body"] = data.get(body_col)

    data["required_docs"] = data.get("required_docs_json")
    data["submit_location"] = data.get("where_to_submit")
    data["steps"] = data.get("steps_json")
    data["duration"] = data.get("time_limits")
    data["fees"] = data.get("amounts_lbp")
    data["notes"] = data.get("contacts_json")

    cursor.execute(
        """
        SELECT *
        FROM tx_links
        WHERE tx_no = ?
        ORDER BY weight DESC
        LIMIT 10
        """,
        (tx_no,),
    )
    data["related"] = [dict(r) for r in cursor.fetchall()]

    law_cols = _table_columns(conn, "law_articles")
    law_title_col = _pick_column(law_cols, ["title_ar", "title"])
    law_body_col = _pick_column(law_cols, ["text_ar", "body", "body_ar", "text"])

    title_select = f"a.{law_title_col} AS article_title" if law_title_col else "NULL AS article_title"
    body_select = f"a.{law_body_col} AS article_body" if law_body_col else "NULL AS article_body"

    cursor.execute(
        f"""
        SELECT m.tx_no, m.article_no, m.relevance, m.rationale,
               {title_select}, {body_select}
        FROM tx_law_map m
        JOIN law_articles a ON a.article_no = m.article_no
        WHERE m.tx_no = ?
        ORDER BY m.relevance DESC, m.article_no ASC
        """,
        (tx_no,),
    )
    data["legal_basis"] = [dict(r) for r in cursor.fetchall()]

    data["lang"] = lang
    return data


def search_law(db_path: str, q: str, limit: int = 10) -> List[LawSearchResult]:
    conn = _connect(db_path)
    version = _detect_schema_version(conn, db_path)
    # Check if law_fts table exists (present in rebuilt v4 KB)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='law_fts'")
    if not cursor.fetchone():
        return []
    use_bm25 = _detect_bm25(conn, "law_fts")
    fts_cols = _table_columns(conn, "law_fts")
    preview_col = _pick_column(fts_cols, ["text_ar", "preview", "body", "text"]) or "preview"
    fts_q = _sanitize_fts_query(q)

    if use_bm25:
        query = """
            SELECT article_no, {preview_col} AS preview, bm25(law_fts) AS rank
            FROM law_fts
            WHERE law_fts MATCH ?
            ORDER BY rank ASC
            LIMIT ?
        """
        cursor.execute(query.format(preview_col=preview_col), (fts_q, limit))
        rows = cursor.fetchall()
        return [
            LawSearchResult(
                article_no=str(row["article_no"]),
                preview=row["preview"] or "",
                score=_score_from_bm25(float(row["rank"]))
            )
            for row in rows
        ]

    query = """
        SELECT article_no, {preview_col} AS preview
        FROM law_fts
        WHERE law_fts MATCH ?
        LIMIT ?
    """
    cursor.execute(query.format(preview_col=preview_col), (fts_q, limit))
    rows = cursor.fetchall()
    terms = [term.strip().lower() for term in q.split() if term.strip()]
    scored = [
        LawSearchResult(
            article_no=str(row["article_no"]),
            preview=row["preview"] or "",
            score=_score_text_match(row["preview"] or "", terms),
        )
        for row in rows
    ]
    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[:limit]


def get_law_article(db_path: str, article_no: str) -> Dict[str, Any]:
    conn = _connect(db_path)
    cursor = conn.cursor()
    # Check if law_articles table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='law_articles'")
    if not cursor.fetchone():
        return {}
    law_cols = _table_columns(conn, "law_articles")
    title_col = _pick_column(law_cols, ["title_ar", "title"])
    text_col = _pick_column(law_cols, ["text_ar", "body", "body_ar"])
    source_col = _pick_column(law_cols, ["source_id", "source"])
    cursor.execute(
        """
        SELECT *
        FROM law_articles
        WHERE article_no = ?
        """,
        (article_no,),
    )
    row = cursor.fetchone()
    if not row:
        return {}
    data = dict(row)
    if title_col:
        data["title"] = data.get(title_col)
    if text_col:
        data["body"] = data.get(text_col)
    if source_col:
        data["source"] = data.get(source_col)
    return data


def list_mapping(
    db_path: str,
    tx_no: Optional[str] = None,
    article_no: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    conn = _connect(db_path)
    cursor = conn.cursor()
    query = """
        SELECT tx_no, article_no, relevance, rationale
        FROM tx_law_map
    """
    params: List[Any] = []
    if tx_no or article_no:
        conditions = []
        if tx_no:
            conditions.append("tx_no = ?")
            params.append(tx_no)
        if article_no:
            conditions.append("article_no = ?")
            params.append(article_no)
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY relevance DESC, article_no ASC LIMIT ?"
    params.append(limit)
    cursor.execute(query, tuple(params))
    return [dict(row) for row in cursor.fetchall()]


def upsert_mapping(
    db_path: str,
    tx_no: str,
    article_no: str,
    relevance: float,
    rationale: str,
) -> None:
    conn = _connect(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE tx_law_map
        SET relevance = ?, rationale = ?
        WHERE tx_no = ? AND article_no = ?
        """,
        (relevance, rationale, tx_no, article_no),
    )
    if cursor.rowcount == 0:
        cursor.execute(
            """
            INSERT INTO tx_law_map (tx_no, article_no, relevance, rationale)
            VALUES (?, ?, ?, ?)
            """,
            (tx_no, article_no, relevance, rationale),
        )
    conn.commit()


def _review_status_clause(
    tx_cols: List[str],
    review_statuses: Optional[List[str]],
    alias: str,
    include_null_as_approved: bool = True,
) -> Tuple[str, List[Any]]:
    if "review_status" not in tx_cols:
        return "", []
    if review_statuses is None:
        return "", []
    statuses = [status for status in review_statuses if status]
    if not statuses:
        return "", []
    if include_null_as_approved and statuses == ["approved"]:
        return f"AND ({alias}.review_status IS NULL OR {alias}.review_status = ?)", ["approved"]
    placeholders = ",".join(["?"] * len(statuses))
    return f"AND {alias}.review_status IN ({placeholders})", statuses


def _select_column(tx_cols: List[str], candidates: List[str], alias: str) -> str:
    col = _pick_column(tx_cols, candidates)
    if col:
        return f"{col} AS {alias}"
    return f"NULL AS {alias}"


def _missing_fields(row: Dict[str, Any]) -> List[str]:
    fields = [
        ("title_ar", "title_ar"),
        ("summary_ar", "summary_ar"),
        ("where_to_submit", "where_to_submit"),
        ("required_docs_json", "required_docs_json"),
        ("time_limits", "time_limits"),
        ("amounts_lbp", "amounts_lbp"),
        ("contacts_json", "contacts_json"),
        ("steps_json", "steps_json"),
    ]
    missing = []
    for key, label in fields:
        value = row.get(key)
        if value is None:
            missing.append(label)
            continue
        if isinstance(value, str) and not value.strip():
            missing.append(label)
    return missing


def list_review_queue(
    db_path: str,
    status: str = "pending",
    limit: int = 50,
    q: Optional[str] = None,
) -> List[Dict[str, Any]]:
    conn = _connect(db_path)
    cursor = conn.cursor()
    tx_cols = _table_columns(conn, "transactions")
    if "review_status" not in tx_cols:
        raise ValueError("review_status column missing; run kb_init_v3")

    select_cols = [
        "tx_no",
        _select_column(tx_cols, ["section", "section_ar", "category"], "section"),
        _select_column(tx_cols, ["title_ar", "title"], "title_ar"),
        _select_column(tx_cols, ["summary_ar", "summary"], "summary_ar"),
        _select_column(tx_cols, ["where_to_submit", "submit_location"], "where_to_submit"),
        _select_column(tx_cols, ["required_docs_json", "required_docs"], "required_docs_json"),
        _select_column(tx_cols, ["time_limits", "duration"], "time_limits"),
        _select_column(tx_cols, ["amounts_lbp", "fees"], "amounts_lbp"),
        _select_column(tx_cols, ["contacts_json", "notes"], "contacts_json"),
        _select_column(tx_cols, ["steps_json", "steps"], "steps_json"),
        _select_column(tx_cols, ["tags_json", "tags"], "tags_json"),
        "review_status",
        "review_notes",
    ]

    query = f"""
        SELECT {", ".join(select_cols)}
        FROM transactions
        WHERE review_status = ?
    """
    params: List[Any] = [status]

    if q:
        title_col = _pick_column(tx_cols, ["title_ar", "title"])
        summary_col = _pick_column(tx_cols, ["summary_ar", "summary"])
        conditions = ["tx_no LIKE ?"]
        params.append(f"%{q}%")
        if title_col:
            conditions.append(f"{title_col} LIKE ?")
            params.append(f"%{q}%")
        if summary_col:
            conditions.append(f"{summary_col} LIKE ?")
            params.append(f"%{q}%")
        query += " AND (" + " OR ".join(conditions) + ")"

    query += " ORDER BY tx_no ASC LIMIT ?"
    params.append(limit)

    cursor.execute(query, tuple(params))
    rows = [dict(row) for row in cursor.fetchall()]
    for row in rows:
        missing = _missing_fields(row)
        row["missing_fields"] = missing
        row["validator_hint"] = ", ".join(missing) if missing else ""
    return rows


def get_review_detail(db_path: str, tx_no: str) -> Dict[str, Any]:
    conn = _connect(db_path)
    cursor = conn.cursor()
    tx_cols = _table_columns(conn, "transactions")
    if "review_status" not in tx_cols:
        raise ValueError("review_status column missing; run kb_init_v3")

    cursor.execute("SELECT * FROM transactions WHERE tx_no = ?", (tx_no,))
    row = cursor.fetchone()
    if not row:
        return {}
    data = dict(row)
    data["missing_fields"] = _missing_fields(data)
    return data


def rebuild_tx_fts(db_path: str) -> None:
    conn = _connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO tx_fts(tx_fts) VALUES('rebuild')")
        conn.commit()
        return
    except Exception:
        conn.rollback()


def update_review_transaction(
    db_path: str,
    tx_no: str,
    updates: Dict[str, Any],
    reviewer: Optional[str],
) -> Dict[str, Any]:
    conn = _connect(db_path)
    cursor = conn.cursor()
    tx_cols = _table_columns(conn, "transactions")
    if "review_status" not in tx_cols:
        raise ValueError("review_status column missing; run kb_init_v3")

    allowed_fields = {
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
    }

    changes: Dict[str, Any] = {}
    for key, value in updates.items():
        if key not in allowed_fields:
            continue
        if key not in tx_cols:
            continue
        if value is None:
            continue
        changes[key] = value

    review_status = changes.get("review_status")
    if review_status in {"approved", "rejected"}:
        if "reviewed_by" in tx_cols:
            changes["reviewed_by"] = reviewer
        if "reviewed_at" in tx_cols:
            changes["reviewed_at"] = _utc_now_iso()

    if not changes:
        return {"updated": False, "changes": {}}

    set_clause = ", ".join([f"{key} = ?" for key in changes.keys()])
    params = list(changes.values()) + [tx_no]
    cursor.execute(
        f"""
        UPDATE transactions
        SET {set_clause}
        WHERE tx_no = ?
        """,
        tuple(params),
    )
    conn.commit()
    return {"updated": cursor.rowcount > 0, "changes": changes}


def _utc_now_iso() -> str:
    return __import__("datetime").datetime.utcnow().isoformat() + "Z"
