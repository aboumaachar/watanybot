#!/usr/bin/env python3
"""Environment audit for KB readiness (read-only)."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

COMMON_KB_PATHS = [
    "./data/kb.sqlite",
    "./data/retired_military_chatbot_kb_v3_with_ndlaw.sqlite",
    "./retired_military_chatbot_kb_v3_with_ndlaw.sqlite",
    "./kb.sqlite",
]

SECRET_KEYS = {"JWT_SECRET", "POSTGRES_PASSWORD", "SUPERADMIN_PASSWORD"}


def _read_env_file(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    values: Dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        values[key.strip()] = val.strip().strip('"').strip("'")
    return values


def _redact(key: str, value: Optional[str]) -> str:
    if value is None:
        return "<missing>"
    if key in SECRET_KEYS:
        return "<redacted>"
    return value


def _detect_default_kb_path(repo_root: Path) -> str:
    config_path = repo_root / "apps" / "api" / "config.py"
    if config_path.exists():
        text = config_path.read_text(encoding="utf-8")
        for line in text.splitlines():
            if "kb_sqlite_path" in line and "=" in line:
                parts = line.split("=")
                if len(parts) >= 2:
                    default = parts[1].strip().strip("\"'")
                    if default:
                        return default
    return "/data/kb.sqlite"


def _resolve_path(repo_root: Path, path: str) -> str:
    p = Path(path)
    if not p.is_absolute():
        p = (repo_root / p).resolve()
    return str(p)


def _find_kb_files(repo_root: Path) -> List[str]:
    found = []
    for path in COMMON_KB_PATHS:
        resolved = _resolve_path(repo_root, path)
        if Path(resolved).exists():
            found.append(resolved)
    return found


def build_report(
    env_info: Dict[str, Any],
    sqlite_info: Optional[Dict[str, Any]],
    postgres_info: Optional[Dict[str, Any]],
) -> str:
    status = env_info["summary_status"]
    lines = ["# KB Audit Report", "", f"Summary: {status}", ""]

    lines.append("## Detected KB files")
    if env_info["kb_files"]:
        lines.extend([f"- {p}" for p in env_info["kb_files"]])
    else:
        lines.append("- None found")
    lines.append("")

    lines.append("## Active KB path")
    lines.append(f"- {env_info['effective_kb_path']}")
    lines.append("")

    lines.append("## Env readiness")
    for item in env_info["env_checks"]:
        lines.append(f"- {item['key']}: {item['status']} ({item['value']})")
    lines.append("")

    if sqlite_info:
        lines.append("## SQLite schema detection")
        lines.append(f"- SQLite version: {sqlite_info.get('sqlite_version')}")
        lines.append(f"- page_count: {sqlite_info.get('page_count')}")
        lines.append(f"- page_size: {sqlite_info.get('page_size')}")
        lines.append(f"- FTS: {sqlite_info.get('fts', {})}")
        lines.append("")

        lines.append("### Required tables")
        for table, exists in sqlite_info.get("required_tables", {}).items():
            lines.append(f"- {table}: {'ok' if exists else 'missing'}")
        lines.append("")

        lines.append("### Counts")
        for key, value in sqlite_info.get("counts", {}).items():
            lines.append(f"- {key}: {value}")
        lines.append("")

        lines.append("### Mapping coverage")
        lines.append(f"- mapping_coverage: {sqlite_info.get('mapping_coverage')}")
        lines.append("")

        lines.append("### KB age")
        lines.append(f"- kb_age_mtime: {sqlite_info.get('kb_age')}")
        lines.append("")

        lines.append("### FTS sanity")
        for key, value in sqlite_info.get("fts_sanity", {}).items():
            lines.append(f"- {key}: {value}")
        lines.append("")

        if sqlite_info.get("compat_mapping"):
            lines.append("### Schema compatibility mapping")
            for table, details in sqlite_info["compat_mapping"].items():
                lines.append(f"- {table}: missing {details.get('missing')} (existing: {details.get('existing')})")
            lines.append("")

    if postgres_info:
        lines.append("## Postgres KB detection")
        lines.append(f"- connected: {postgres_info.get('connected')}")
        lines.append(f"- kb_cards_exists: {postgres_info.get('kb_cards_exists')}")
        lines.append(f"- counts: {postgres_info.get('counts')}")
        lines.append(f"- fts: {postgres_info.get('fts')}")
        lines.append("")

    lines.append("## What Step 3 must do next")
    for step in env_info["step3_actions"]:
        lines.append(f"- {step}")
    lines.append("")

    return "\n".join(lines)


def build_step3_readiness(report: Dict[str, Any]) -> str:
    lines = ["# Step 3 Readiness", ""]
    for action in report["step3_actions"]:
        lines.append(f"- {action}")
    lines.append("\n## Commands")
    lines.append("- Run: ./scripts/kb_audit.sh")
    lines.append("- If KB missing: place KB file and re-run audit")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sqlite-json", dest="sqlite_json", default=None)
    parser.add_argument("--postgres-json", dest="postgres_json", default=None)
    parser.add_argument("--out", dest="out", default="docs/KB_AUDIT_REPORT.md")
    parser.add_argument("--readiness", dest="readiness", default="docs/KB_STEP3_READINESS.md")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    env_file = _read_env_file(repo_root / ".env")

    env = {**env_file, **os.environ}
    expected = [
        "APP_ENV",
        "ENVIRONMENT",
        "KB_SQLITE_PATH",
        "USE_SQLITE_V3_KB",
        "LEGACY_POSTGRES_KB_FALLBACK",
        "POSTGRES_HOST",
        "POSTGRES_PORT",
        "POSTGRES_DB",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "JWT_SECRET",
        "AUTO_APPROVE",
        "AUTO_INGEST",
    ]

    env_checks = []
    warnings = 0
    errors = 0

    for key in expected:
        value = env.get(key)
        status = "ok" if value else "missing"
        if status == "missing" and key in {"JWT_SECRET", "KB_SQLITE_PATH"}:
            warnings += 1
        env_checks.append({"key": key, "status": status, "value": _redact(key, value)})

    default_kb_path = _detect_default_kb_path(repo_root)
    effective_kb_path = env.get("KB_SQLITE_PATH") or default_kb_path
    effective_kb_path = _resolve_path(repo_root, effective_kb_path)

    kb_files = _find_kb_files(repo_root)

    step3_actions = []
    if not Path(effective_kb_path).exists():
        errors += 1
        step3_actions.append("Place KB SQLite v3 file and set KB_SQLITE_PATH")
    else:
        step3_actions.append("KB file present; validate schema and FTS before ingest")

    if env.get("JWT_SECRET") and len(env.get("JWT_SECRET", "")) < 32:
        warnings += 1
        step3_actions.append("Set JWT_SECRET to 32+ characters")

    sqlite_info = None
    if args.sqlite_json and Path(args.sqlite_json).exists():
        sqlite_info = json.loads(Path(args.sqlite_json).read_text(encoding="utf-8"))
        if sqlite_info.get("required_tables"):
            missing = [k for k, v in sqlite_info["required_tables"].items() if not v]
            if missing:
                errors += 1
                step3_actions.append(f"Fix SQLite schema missing tables: {', '.join(missing)}")

    postgres_info = None
    if args.postgres_json and Path(args.postgres_json).exists():
        postgres_info = json.loads(Path(args.postgres_json).read_text(encoding="utf-8"))

    summary_status = "OK"
    exit_code = 0
    if errors > 0:
        summary_status = "ERROR"
        exit_code = 4
    elif warnings > 0:
        summary_status = "WARNING"
        exit_code = 2

    report = {
        "summary_status": summary_status,
        "effective_kb_path": effective_kb_path,
        "kb_files": kb_files,
        "env_checks": env_checks,
        "step3_actions": step3_actions,
    }

    report_text = build_report(report, sqlite_info, postgres_info)
    Path(args.out).write_text(report_text, encoding="utf-8")
    Path(args.readiness).write_text(build_step3_readiness(report), encoding="utf-8")

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
