from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Optional


def _is_detached(path: Path) -> bool:
    parts = {part.lower() for part in path.resolve().parts}
    return "public-salaries-app" in parts or "_quarantine" in parts


def _find_root(start: Path) -> Optional[Path]:
    for parent in [start, *start.parents]:
        apps_main = parent / "apps" / "api" / "main.py"
        marker_doc = parent / "docs" / "PROJECT_ROOT_RULES.md"
        marker_env = parent / ".env"
        if apps_main.exists() and (marker_doc.exists() or marker_env.exists()):
            return parent
    return None


def _fail(message: str) -> None:
    print(message)
    raise SystemExit(13)


def guard_or_exit(expected_entrypoint: Optional[str] = None, root: Optional[Path] = None) -> Path:
    cwd = Path.cwd()
    if _is_detached(cwd):
        _fail("STOP: You are in a detached folder. Run from the repo root.")

    root_path = root or _find_root(cwd)
    if not root_path:
        _fail("STOP: Repo root not found. Expected apps/api/main.py and docs/PROJECT_ROOT_RULES.md (or .env).")

    if expected_entrypoint:
        expected = expected_entrypoint.strip()
        root_api = root_path / "apps" / "api"
        if cwd.resolve() == root_path.resolve():
            if expected != "apps.api.main:app":
                _fail("STOP: Wrong uvicorn target for repo root. Use apps.api.main:app.")
        elif cwd.resolve() == root_api.resolve():
            if expected != "main:app":
                _fail("STOP: Wrong uvicorn target for apps/api. Use main:app.")
        else:
            _fail("STOP: Wrong working directory. Run from repo root or apps/api.")

    return root_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Strict guard for repo root and detached folders.")
    parser.add_argument("--expect-entrypoint", dest="expected", default=None)
    parser.add_argument("--root", dest="root", default=None)
    args = parser.parse_args()

    root_path = Path(args.root).resolve() if args.root else None
    guard_or_exit(expected_entrypoint=args.expected, root=root_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
