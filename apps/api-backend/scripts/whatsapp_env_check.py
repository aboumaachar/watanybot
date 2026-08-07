#!/usr/bin/env python
"""WhatsApp env verification (read-only)."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Dict, List


REQUIRED_KEYS = [
    "WHATSAPP_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_VERIFY_TOKEN",
]


def parse_env_file(env_path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    if not env_path.exists():
        return env
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key.strip()] = value.strip().strip("'\"")
    return env


def get_env() -> Dict[str, str]:
    env_file = Path.cwd() / ".env"
    file_env = parse_env_file(env_file)
    merged = dict(file_env)
    merged.update(os.environ)
    return merged


def main() -> int:
    env = get_env()
    missing: List[str] = []

    print("WHATSAPP ENV CHECK")
    for key in REQUIRED_KEYS:
        if env.get(key):
            print(f"- {key}: present")
        else:
            print(f"- {key}: missing")
            missing.append(key)

    return 0 if not missing else 2


if __name__ == "__main__":
    sys.exit(main())
