#!/usr/bin/env python3
"""Export/import KB v3 review queue as CSV."""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(ROOT / "apps" / "api"))

from kb_sqlite import list_review_queue, update_review_transaction, rebuild_tx_fts  # noqa: E402

REVIEW_STATUS_VALUES = {"pending", "approved", "rejected"}
JSON_REVIEW_FIELDS = {"required_docs_json", "contacts_json", "steps_json", "tags_json"}


def _validate_json_fields(payload: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    for field in JSON_REVIEW_FIELDS:
        if field not in payload:
            continue
        value = payload.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        try:
            json.loads(value)
        except Exception:
            errors.append(f"{field}: invalid JSON")
    return errors


def export_review_queue(db_path: str, status: str, out_path: str) -> None:
    items = list_review_queue(db_path, status=status, limit=100000)
    fieldnames = [
        "tx_no",
        "section",
        "title_ar",
        "summary_ar",
        "where_to_submit",
        "required_docs_json",
        "time_limits",
        "amounts_lbp",
        "contacts_json",
        "steps_json",
        "tags_json",
        "review_status",
        "review_notes",
        "validator_hint",
    ]

    out_file = Path(out_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    with out_file.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            writer.writerow({field: item.get(field, "") for field in fieldnames})


def import_review_csv(db_path: str, csv_path: str, reviewer: str) -> Dict[str, Any]:
    updated_count = 0
    approved_count = 0
    rejected_count = 0
    errors: List[str] = []

    with open(csv_path, "r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            tx_no = (row.get("tx_no") or "").strip()
            if not tx_no:
                errors.append("Missing tx_no in row")
                continue

            updates: Dict[str, Any] = {}
            for key, value in row.items():
                if key in {"tx_no", "validator_hint"}:
                    continue
                if value is None:
                    continue
                if isinstance(value, str) and not value.strip():
                    continue
                updates[key] = value

            if not updates:
                continue

            json_errors = _validate_json_fields(updates)
            if json_errors:
                errors.append(f"{tx_no}: {', '.join(json_errors)}")
                continue

            status = updates.get("review_status")
            if status and status not in REVIEW_STATUS_VALUES:
                errors.append(f"{tx_no}: invalid review_status")
                continue

            if status == "rejected" and not (updates.get("review_notes") or "").strip():
                errors.append(f"{tx_no}: review_notes required for rejection")
                continue

            result = update_review_transaction(
                db_path,
                tx_no=tx_no,
                updates=updates,
                reviewer=reviewer,
            )

            if not result.get("updated"):
                continue

            updated_count += 1
            if status == "approved":
                approved_count += 1
            if status == "rejected":
                rejected_count += 1

    rebuild_tx_fts(db_path)

    report = {
        "updated_count": updated_count,
        "approved_count": approved_count,
        "rejected_count": rejected_count,
        "errors": errors,
    }
    return report


def write_report(report_path: str, report: Dict[str, Any]) -> None:
    lines = [
        "# Daleel Review Import Report",
        "",
        f"- updated_count: {report['updated_count']}",
        f"- approved_count: {report['approved_count']}",
        f"- rejected_count: {report['rejected_count']}",
        "",
        "## Errors",
    ]
    if report["errors"]:
        lines.extend([f"- {err}" for err in report["errors"]])
    else:
        lines.append("- None")

    Path(report_path).write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kb-path", dest="kb_path", default=None)
    parser.add_argument("--export", action="store_true")
    parser.add_argument("--import", dest="import_path", default=None)
    parser.add_argument("--status", dest="status", default="pending")
    parser.add_argument("--out", dest="out", default=None)
    parser.add_argument("--reviewer", dest="reviewer", default=None)
    args = parser.parse_args()

    kb_path = args.kb_path or os.environ.get("KB_SQLITE_PATH") or "./data/kb.sqlite"

    if args.export:
        out_path = args.out or "sources/derived/review_queue.csv"
        export_review_queue(kb_path, status=args.status, out_path=out_path)
        print(f"Exported review queue to {out_path}")
        return 0

    if args.import_path:
        reviewer = args.reviewer or "unknown"
        report = import_review_csv(kb_path, args.import_path, reviewer=reviewer)
        report_path = ROOT / "docs" / "DALEEL_REVIEW_IMPORT_REPORT.md"
        write_report(str(report_path), report)
        print(f"Import complete. Report written to {report_path}")
        return 0

    print("Specify --export or --import")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
