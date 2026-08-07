#!/usr/bin/env python3
"""Repo-level diagnostics for WatanBot (SQLite KB v3 focused)."""

from __future__ import annotations

import os
import sys
import sqlite3
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Tuple


REQUIRED_DIRS = [
    "apps/api",
    "apps/admin-console",
    "apps/worker",
    "infra/docker",
    "scripts",
    "docs",
]

REQUIRED_SQLITE_TABLES = [
    "transactions",
    "tx_fts",
    "tx_links",
    "law_sources",
    "law_articles",
    "law_fts",
    "tx_law_map",
]


def print_status(level: str, message: str, details: Optional[str] = None) -> None:
    label = {
        "ok": "OK",
        "warn": "WARN",
        "error": "ERROR",
        "info": "INFO",
    }.get(level, level.upper())
    print(f"[{label}] {message}")
    if details:
        print(f"       {details}")


def parse_env_file(env_path: Path) -> Dict[str, str]:
    if not env_path.exists():
        return {}
    values: Dict[str, str] = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        values[key.strip()] = val.strip().strip('"').strip("'")
    return values


def check_repo_structure(repo_root: Path) -> None:
    for rel in REQUIRED_DIRS:
        path = repo_root / rel
        if path.exists():
            print_status("ok", f"Found {rel}")
        else:
            print_status("error", f"Missing {rel}")

    env_path = repo_root / ".env"
    env_example_path = repo_root / ".env.example"
    if env_path.exists():
        print_status("ok", "Found .env")
    else:
        print_status("warn", "Missing .env", "Create from .env.example")

    if env_example_path.exists():
        print_status("ok", "Found .env.example")
    else:
        print_status("warn", "Missing .env.example")


def find_kb_sqlite(repo_root: Path) -> List[Path]:
    candidates = [
        repo_root / "retired_military_chatbot_kb_v3_with_ndlaw.sqlite",
        repo_root / "data" / "kb.sqlite",
        Path("/data/kb.sqlite"),
    ]

    found = [p for p in candidates if p.exists()]
    return found


def check_sqlite_kb(db_path: Path) -> None:
    print_status("info", f"Checking SQLite KB: {db_path}")

    try:
        conn = sqlite3.connect(str(db_path))
    except Exception as exc:
        print_status("error", "Failed to open SQLite KB", str(exc))
        return

    try:
        cursor = conn.cursor()
        for table in REQUIRED_SQLITE_TABLES:
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            )
            row = cursor.fetchone()
            if row:
                print_status("ok", f"Table exists: {table}")
            else:
                print_status("error", f"Missing table: {table}")

        # FTS sanity checks
        for fts_table in ("tx_fts", "law_fts"):
            try:
                cursor.execute(
                    f"SELECT rowid FROM {fts_table} WHERE {fts_table} MATCH ? LIMIT 1",
                    ("test",),
                )
                cursor.fetchone()
                print_status("ok", f"FTS MATCH works: {fts_table}")
            except Exception as exc:
                print_status("error", f"FTS MATCH failed: {fts_table}", str(exc))
    finally:
        conn.close()


def check_api_health(repo_root: Path) -> None:
    api_main = repo_root / "apps" / "api" / "main.py"
    if not api_main.exists():
        print_status("warn", "API entrypoint not found; skipping API health check")
        return

    env = parse_env_file(repo_root / ".env")
    api_port = os.getenv("API_PORT") or env.get("API_PORT") or "8000"
    api_url = f"http://localhost:{api_port}/health"

    try:
        with urllib.request.urlopen(api_url, timeout=2) as resp:
            if resp.status == 200:
                print_status("ok", f"API health OK: {api_url}")
            else:
                print_status("warn", f"API health returned {resp.status}", api_url)
    except Exception as exc:
        print_status("warn", "API health check failed", f"{api_url} ({exc})")


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    print_status("info", f"Repo root: {repo_root}")

    check_repo_structure(repo_root)

    kb_files = find_kb_sqlite(repo_root)
    if not kb_files:
        print_status(
            "error",
            "SQLite KB file not found",
            "Expected retired_military_chatbot_kb_v3_with_ndlaw.sqlite or /data/kb.sqlite",
        )
    else:
        for kb_path in kb_files:
            check_sqlite_kb(kb_path)

    check_api_health(repo_root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
