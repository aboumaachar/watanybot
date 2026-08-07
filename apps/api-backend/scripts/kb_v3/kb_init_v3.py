#!/usr/bin/env python3
"""Ensure KB v3 review columns exist (idempotent)."""

from __future__ import annotations

import argparse
import os
import sqlite3
from typing import List

REVIEW_COLUMNS = {
    "review_status": "TEXT DEFAULT 'pending'",
    "review_notes": "TEXT",
    "reviewed_by": "TEXT",
    "reviewed_at": "TEXT",
}


def _table_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return [row[1] for row in rows]


def ensure_review_columns(db_path: str) -> List[str]:
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"KB SQLite file not found: {db_path}")

    conn = sqlite3.connect(db_path)
    try:
        cols = _table_columns(conn, "transactions")
        if not cols:
            raise RuntimeError("transactions table not found or empty")

        added = []
        for col, decl in REVIEW_COLUMNS.items():
            if col in cols:
                continue
            conn.execute(f"ALTER TABLE transactions ADD COLUMN {col} {decl}")
            added.append(col)

        conn.commit()
        return added
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kb-path", dest="kb_path", default=None)
    args = parser.parse_args()

    kb_path = args.kb_path or os.environ.get("KB_SQLITE_PATH") or "./data/kb.sqlite"
    added = ensure_review_columns(kb_path)
    if added:
        print(f"Added columns: {', '.join(added)}")
    else:
        print("Review columns already present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
