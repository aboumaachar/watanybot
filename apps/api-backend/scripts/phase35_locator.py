#!/usr/bin/env python
"""Phase 3.5 locator: identify chat handler, KB query modules, and WhatsApp webhook."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List


CHAT_PATTERNS = [
    r"@\w*\.post\(\s*['\"]/?api/chat",
    r"@\w*\.post\(\s*['\"]/?chat/ask",
]
WHATSAPP_PATTERNS = [r"/whatsapp/webhook", r"verify_token", r"WHATSAPP_\w+"]
PROCEDURES_PATTERNS = [r"/api/procedures/search", r"tx_fts", r"procedures/search"]
LAW_PATTERNS = [r"/api/law/search", r"law_fts", r"law/search"]
KB_PATTERNS = [r"sqlite3", r"tx_fts", r"law_fts", r"SELECT .* FROM transactions"]
NOT_FOUND = "- Not found"


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _should_skip(path: Path) -> bool:
    return path.name.startswith("repo_introspect")


def _search_file(path: Path) -> Dict[str, List[str]]:
    data = path.read_text(encoding="utf-8", errors="ignore")
    findings: Dict[str, List[str]] = {"chat": [], "procedures": [], "law": [], "whatsapp": [], "kb": []}

    for pattern in CHAT_PATTERNS:
        if re.search(pattern, data, flags=re.IGNORECASE):
            findings["chat"].append(pattern)
    for pattern in PROCEDURES_PATTERNS:
        if re.search(pattern, data, flags=re.IGNORECASE):
            findings["procedures"].append(pattern)
    for pattern in LAW_PATTERNS:
        if re.search(pattern, data, flags=re.IGNORECASE):
            findings["law"].append(pattern)
    for pattern in WHATSAPP_PATTERNS:
        if re.search(pattern, data, flags=re.IGNORECASE):
            findings["whatsapp"].append(pattern)
    for pattern in KB_PATTERNS:
        if re.search(pattern, data, flags=re.IGNORECASE):
            findings["kb"].append(pattern)

    return findings


def _candidate_files(root: Path) -> List[Path]:
    preferred = ["main.py", "military.py", "tables.py", "update_api.py", "fix_routers.py"]
    candidates: List[Path] = []

    for name in preferred:
        candidates.extend(root.rglob(name))

    for main_path in root.rglob("main.py"):
        for sibling in main_path.parent.glob("*.py"):
            if re.search(r"router|api", sibling.name, flags=re.IGNORECASE):
                candidates.append(sibling)

    unique: List[Path] = []
    seen = set()
    for path in candidates:
        if _should_skip(path):
            continue
        if path in seen:
            continue
        seen.add(path)
        unique.append(path)
    return unique


def _build_results(root: Path, files: List[Path]) -> Dict[str, List[Dict[str, List[str]]]]:
    results: Dict[str, List[Dict[str, List[str]]]] = {
        "repo_root": str(root),
        "chat_handlers": [],
        "procedure_search": [],
        "law_search": [],
        "whatsapp_webhook": [],
        "kb_modules": [],
    }

    for path in files:
        findings = _search_file(path)
        if findings["chat"]:
            results["chat_handlers"].append({"path": str(path), "patterns": findings["chat"]})
        if findings["procedures"]:
            results["procedure_search"].append({"path": str(path), "patterns": findings["procedures"]})
        if findings["law"]:
            results["law_search"].append({"path": str(path), "patterns": findings["law"]})
        if findings["whatsapp"]:
            results["whatsapp_webhook"].append({"path": str(path), "patterns": findings["whatsapp"]})
        if findings["kb"]:
            results["kb_modules"].append({"path": str(path), "patterns": findings["kb"]})
    return results


def _write_json(results: Dict[str, List[Dict[str, List[str]]]], docs_dir: Path) -> None:
    (docs_dir / "PHASE35_TARGETS.json").write_text(json.dumps(results, indent=2), encoding="utf-8")


def _append_paths(md_lines: List[str], items: List[Dict[str, List[str]]]) -> None:
    if items:
        for item in items:
            md_lines.append(f"- {item['path']}")
    else:
        md_lines.append(NOT_FOUND)


def _write_markdown(results: Dict[str, List[Dict[str, List[str]]]], docs_dir: Path) -> None:
    md_lines = ["# Phase 3.5 Targets", "", f"Repo root: {results['repo_root']}", "", "## Chat handler file/function", ""]
    _append_paths(md_lines, results["chat_handlers"])

    md_lines.extend(["", "## KB query modules", ""])
    _append_paths(md_lines, results["kb_modules"])

    md_lines.extend(["", "## WhatsApp webhook handler", ""])
    _append_paths(md_lines, results["whatsapp_webhook"])

    md_lines.extend(["", "## Existing endpoints found", ""])
    for section, key in [("Procedures search", "procedure_search"), ("Law search", "law_search")]:
        md_lines.append(f"- {section}: {'found' if results[key] else 'not found'}")

    md_lines.extend(["", "## Endpoints missing (procedures_detail, law_detail)", ""])
    md_lines.append("- Review target files for details endpoints.")

    (docs_dir / "PHASE35_TARGETS.md").write_text("\n".join(md_lines), encoding="utf-8")


def main() -> int:
    root = repo_root()
    files = _candidate_files(root)
    results = _build_results(root, files)

    docs_dir = root / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    _write_json(results, docs_dir)
    _write_markdown(results, docs_dir)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
