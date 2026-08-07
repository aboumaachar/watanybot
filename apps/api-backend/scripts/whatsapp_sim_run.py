from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

import guard_root_strict

ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "apps" / "api"))

from config import settings  # noqa: E402
from services import whatsapp_simulator, whatsapp_ui  # noqa: E402


def _pretty(data: Dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def _run(label: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    result = whatsapp_simulator.simulate_inbound(None, payload)
    print(f"\n=== {label} ===")
    print(_pretty(result))
    return result


def main() -> int:
    guard_root_strict.guard_or_exit()
    settings.whatsapp_outbound_mode = "simulate"

    issues: List[str] = []

    phone = "96100000000"
    results = []

    long_prefix = "please answer in text mode: "
    results.append(_run(
        "text: marhaba",
        whatsapp_simulator.build_sample_payload_text(phone, long_prefix + "marhaba" * 8),
    ))
    results.append(_run(
        "arabizi",
        whatsapp_simulator.build_sample_payload_text(phone, long_prefix + "ma3ash ta2o3od " * 6),
    ))
    results.append(_run(
        "garbled",
        whatsapp_simulator.build_sample_payload_text(phone, long_prefix + "hgs v'hfhg " * 6),
    ))
    results.append(_run("location", whatsapp_simulator.build_sample_payload_location(phone, 33.8938, 35.5018)))
    results.append(_run("image", whatsapp_simulator.build_sample_payload_image(phone)))

    guided_hits = [r for r in results if (r.get("debug") or {}).get("guided")]
    if not guided_hits:
        issues.append("guided_menu_missing")

    arabizi_debug = (results[1].get("debug") or {}).get("normalized") or {}
    if not arabizi_debug.get("candidates"):
        issues.append("arabizi_normalization_missing")

    garble_debug = (results[2].get("debug") or {}).get("normalized") or {}
    if not garble_debug.get("candidates"):
        issues.append("garble_normalization_missing")

    long_text = "\n".join(["long line for paging"] * 200)
    chunks = whatsapp_ui.split_text(long_text)
    if len(chunks) < 2:
        issues.append("paging_not_working")

    if issues:
        print(f"\nFAIL: {issues}")
        return 4

    print("\nPASS: WhatsApp simulation checks OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
