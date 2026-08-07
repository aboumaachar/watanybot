#!/usr/bin/env python3
"""Smoke test to verify expected v3 endpoints exist in OpenAPI schema."""
import sys
from pathlib import Path

import guard_root_strict

# Add apps/api to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from main import app

REQUIRED_ENDPOINTS = [
    ("POST", "/api/chat"),
    ("POST", "/chat/ask"),
    ("GET", "/whatsapp/webhook"),
    ("POST", "/whatsapp/webhook"),
    ("GET", "/api/procedures/search"),
    ("GET", "/api/procedures/{tx_no}"),
    ("GET", "/api/law/search"),
    ("GET", "/api/law/{article_no}"),
]


def main() -> int:
    """Verify all required endpoints exist in OpenAPI schema."""
    guard_root_strict.guard_or_exit()
    print("🧪 Running endpoint smoke test...")
    print("=" * 70)
    
    openapi = app.openapi()
    paths = openapi.get("paths", {})
    
    missing = []
    found = []
    
    for method, path in REQUIRED_ENDPOINTS:
        methods_for_path = paths.get(path, {})
        if method.lower() in methods_for_path:
            found.append((method, path))
            print(f"✅ {method:6} {path}")
        else:
            missing.append((method, path))
            print(f"❌ {method:6} {path} - MISSING")
    
    print("=" * 70)
    print(f"📊 Results: {len(found)}/{len(REQUIRED_ENDPOINTS)} endpoints present")
    
    if missing:
        print(f"\n❌ FAIL: {len(missing)} endpoint(s) missing:")
        for method, path in missing:
            print(f"   - {method} {path}")
        return 4
    
    print("\n✅ PASS: All required endpoints present")
    return 0


if __name__ == "__main__":
    sys.exit(main())
