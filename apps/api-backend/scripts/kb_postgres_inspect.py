#!/usr/bin/env python3
"""Postgres KB inspection (read-only)."""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, Dict

import psycopg2


def inspect_postgres() -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "connected": False,
        "kb_cards_exists": False,
        "counts": {},
        "fts": {},
    }

    host = os.getenv("POSTGRES_HOST", "localhost")
    port = int(os.getenv("POSTGRES_PORT", "5432"))
    db = os.getenv("POSTGRES_DB", "watanbot")
    user = os.getenv("POSTGRES_USER", "watanbot")
    password = os.getenv("POSTGRES_PASSWORD", "")

    try:
        conn = psycopg2.connect(host=host, port=port, dbname=db, user=user, password=password)
        result["connected"] = True
    except Exception as exc:
        result["error"] = str(exc)
        return result

    try:
        cur = conn.cursor()
        cur.execute("SELECT to_regclass('public.kb_cards')")
        result["kb_cards_exists"] = cur.fetchone()[0] is not None
        if result["kb_cards_exists"]:
            cur.execute("SELECT status, COUNT(*) FROM kb_cards GROUP BY status")
            result["counts"]["kb_cards_by_status"] = {row[0]: row[1] for row in cur.fetchall()}

            cur.execute("SELECT attname, format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'kb_cards'::regclass AND attname = 'fts'")
            row = cur.fetchone()
            result["fts"]["fts_column"] = row[1] if row else None

            cur.execute("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'kb_cards'")
            indexes = cur.fetchall()
            result["fts"]["indexes"] = [i[1] for i in indexes if i[0].startswith("ix_kb_cards")]
    finally:
        conn.close()

    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", dest="out", default=None)
    args = parser.parse_args()

    data = inspect_postgres()
    output = json.dumps(data, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(output)
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
