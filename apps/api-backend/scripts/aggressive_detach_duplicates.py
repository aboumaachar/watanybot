from __future__ import annotations

import argparse
import json
import os
import shutil
import stat
import sys
import time
from pathlib import Path
from typing import Dict, Iterable, List, Optional


def _timestamp() -> str:
    return time.strftime("%Y%m%d_%H%M%S")


def _find_root(start: Path) -> Optional[Path]:
    for parent in [start, *start.parents]:
        apps_main = parent / "apps" / "api" / "main.py"
        if apps_main.exists():
            return parent
    return None


def _is_inside(path: Path, target: Path) -> bool:
    try:
        path.resolve().relative_to(target.resolve())
        return True
    except ValueError:
        return False


def _set_read_only(path: Path) -> None:
    if path.is_dir():
        mode = 0o555
    else:
        mode = 0o444
    try:
        os.chmod(path, mode)
    except Exception:
        return


def _apply_read_only(root: Path) -> None:
    for entry in root.rglob("*"):
        _set_read_only(entry)
    _set_read_only(root)


def _discover_duplicates(root: Path, target: Path, quarantine: Path) -> List[Path]:
    matches: List[Path] = []
    for path in root.rglob("apps/api/main.py"):
        if path.resolve() == (root / "apps" / "api" / "main.py").resolve():
            continue
        if _is_inside(path, target):
            continue
        if _is_inside(path, quarantine):
            continue
        matches.append(path.parent)
    return matches


def _write_rollback_scripts(quarantine_dir: Path, moves: List[Dict[str, str]]) -> None:
    ps1_lines = ["# Rollback detached folders", "param()"]
    sh_lines = ["#!/bin/bash", "set -e"]
    for item in moves:
        src = item["to"]
        dst = item["from"]
        ps1_lines.append(f"Write-Host 'Restoring {dst}'")
        ps1_lines.append(f"Move-Item -Force '{src}' '{dst}'")
        sh_lines.append(f"echo 'Restoring {dst}'")
        sh_lines.append(f"mv -f '{src}' '{dst}'")

    (quarantine_dir / "rollback.ps1").write_text("\n".join(ps1_lines) + "\n", encoding="utf-8")
    (quarantine_dir / "rollback.sh").write_text("\n".join(sh_lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Aggressively detach duplicate subprojects safely.")
    parser.add_argument("--root", default=None)
    parser.add_argument("--target", default="public-salaries-app")
    parser.add_argument("--read-only", dest="read_only", default="true")
    parser.add_argument("--yes", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--extra", action="append", default=[])
    args = parser.parse_args()

    cwd = Path.cwd()
    root = Path(args.root).resolve() if args.root else _find_root(cwd)
    if not root:
        print("STOP: Repo root not found (expected apps/api/main.py).")
        return 4

    apps_main = root / "apps" / "api" / "main.py"
    if not apps_main.exists():
        print("STOP: Invalid root. apps/api/main.py missing.")
        return 4

    target = root / args.target
    quarantine_root = root / "_quarantine"

    if _is_inside(cwd, target):
        print("STOP: Refusing to run inside target subtree.")
        return 4

    if _is_inside(cwd, quarantine_root):
        print("STOP: Refusing to run inside _quarantine.")
        return 4

    if not target.exists():
        print(f"No target found at {target}")
        return 0

    duplicates = _discover_duplicates(root, target, quarantine_root)
    extra_allowed = {str(Path(p).resolve()) for p in args.extra}
    extra_required = [str(p.resolve()) for p in duplicates if str(p.resolve()) not in extra_allowed]

    if extra_required:
        print("Found additional apps/api trees outside root/apps/api:")
        for item in extra_required:
            print(f"- {item}")
        print("Provide --extra <path> to explicitly quarantine them.")
        return 4

    read_only = str(args.read_only).lower() in {"true", "1", "yes"}
    timestamp = _timestamp()
    quarantine_dir = quarantine_root / timestamp
    dest = quarantine_dir / f"DETACHED__{target.name}"

    moves = [{"from": str(target), "to": str(dest)}]
    for extra in args.extra:
        extra_path = Path(extra).resolve()
        moves.append({"from": str(extra_path), "to": str(quarantine_dir / f"DETACHED__{extra_path.name}")})

    if not args.yes:
        print("DRY RUN: No changes made.")
        print(f"Would create: {quarantine_dir}")
        for item in moves:
            print(f"Would move: {item['from']} -> {item['to']}")
        print(f"Would write manifest and rollback in: {quarantine_dir}")
        print("To execute:")
        print("  python scripts/aggressive_detach_duplicates.py --yes")
        return 0

    quarantine_dir.mkdir(parents=True, exist_ok=True)

    for item in moves:
        src = Path(item["from"]).resolve()
        dst = Path(item["to"]).resolve()
        if dst.exists() and not args.force:
            print(f"STOP: Destination exists: {dst}")
            return 4
        shutil.move(str(src), str(dst))
        if read_only:
            _apply_read_only(dst)

    manifest = {
        "timestamp": timestamp,
        "moves": moves,
        "read_only": read_only,
        "root": str(root),
    }
    (quarantine_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    _write_rollback_scripts(quarantine_dir, moves)

    marker = {
        "timestamp": timestamp,
        "moved": moves,
    }
    (root / "DETACHED_DUPLICATES.json").write_text(json.dumps(marker, indent=2), encoding="utf-8")

    print("Detached duplicates successfully.")
    print(f"Manifest: {quarantine_dir / 'manifest.json'}")
    print(f"Rollback: {quarantine_dir / 'rollback.ps1'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
