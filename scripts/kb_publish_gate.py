#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os, json, subprocess, sys
from pathlib import Path

THRESHOLD = float(os.environ.get("GOLDEN_PASS_THRESHOLD", "90"))

def main():
    out_dir = Path("reports")
    out_dir.mkdir(parents=True, exist_ok=True)

    cmd = [sys.executable, "scripts/run_golden_eval.py", "--out", "reports"]
    print("[RUN]", " ".join(cmd))
    r = subprocess.run(cmd)
    if r.returncode != 0:
        print("[FAIL] golden eval runner failed")
        sys.exit(2)

    jpath = out_dir / "golden_eval.json"
    if not jpath.exists():
        print("[FAIL] missing reports/golden_eval.json")
        sys.exit(3)

    data = json.loads(jpath.read_text(encoding="utf-8"))
    rate = float(data.get("pass_rate_percent", 0.0))
    mode = data.get("mode")
    if mode == "dry":
        print("[WARN] Golden eval is DRY mode (no real answers tested). Set CHAT_API_URL for HTTP mode.")
        # still enforce threshold? default: allow dry during dev
        print("[OK] Allowing dry mode during dev.")
        sys.exit(0)

    if rate < THRESHOLD:
        print(f"[BLOCK] Golden pass rate {rate}% < threshold {THRESHOLD}%")
        sys.exit(10)

    print(f"[OK] Golden gate passed: {rate}%")
    sys.exit(0)

if __name__ == "__main__":
    main()
