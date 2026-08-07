#!/usr/bin/env python3
"""
audit_watanybot.py
- Run SeaRC CLI if installed, else fallback to lightweight audit.
- Query KB v3/4 SQLite `tx_fts` using MATCH for procedure searches.
- Extract procedure details for "Naion Defense Law".
- Build a memory-mapped (MFS) index for fast mapping of KB chunks.
- Output: reports/audit_report.json, reports/kb_mapping.json
"""

import json
import os
import shutil
import sqlite3
import mmap
import argparse
from subprocess import run, PIPE

DEFAULT_KB_PATH = "watany_kb_tables_v4/Watany_KB_v4.sqlite"
OUTPUT_DIR = "reports"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def run_searc(path, out):
    searc = shutil.which("searc") or shutil.which("SeaRC")
    if not searc:
        return None
    cmd = [searc, "audit", path, "--output", out]
    r = run(cmd, stdout=PIPE, stderr=PIPE, text=True)
    return {"returncode": r.returncode, "stdout": r.stdout, "stderr": r.stderr, "output": out}


def lightweight_repo_audit(path):
    findings = {"files": [], "patterns": []}
    for root, dirs, files in os.walk(path):
        for f in files:
            if f.endswith((".py", ".ts", ".tsx", ".js", ".json", ".sql", ".md")):
                p = os.path.join(root, f)
                try:
                    size = os.path.getsize(p)
                    findings["files"].append({"path": p, "size": size})
                except Exception:
                    pass
    patterns = ["tx_fts", "Watany", "KB", "sqlite", "FTS", "mmap"]
    findings["patterns"] = patterns
    return findings


def query_tx_fts(kb_path, q, limit=25):
    if not os.path.exists(kb_path):
        raise FileNotFoundError(kb_path)
    conn = sqlite3.connect(kb_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    # try common FTS table names
    tried = []
    for table in ("tx_fts", "chunks", "tx_chunks", "texts"):
        try:
            cur.execute(f"SELECT rowid, * FROM {table} WHERE {table} MATCH ? LIMIT ?", (q, limit))
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return rows
        except sqlite3.OperationalError as e:
            tried.append((table, str(e)))
            continue
    conn.close()
    raise RuntimeError({"error": "no suitable FTS table found", "tried": tried})


def extract_procedure_details(rows, name_hint):
    matches = []
    for r in rows:
        for v in r.values():
            if isinstance(v, str) and name_hint.lower() in v.lower():
                matches.append(r)
                break
    return matches


def build_mfs_index(kb_path, out_index="reports/kb_mapping.json"):
    mapping = {"kb_path": kb_path, "mappings": []}
    try:
        with open(kb_path, "rb") as f:
            mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
            sample = mm.read(65536).decode("utf8", errors="ignore")
            mapping["file_size"] = mm.size()
            mapping["sample_start"] = sample[:200]
            mm.close()
    except Exception:
        try:
            conn = sqlite3.connect(kb_path)
            cur = conn.cursor()
            cur.execute("SELECT rowid, id FROM tx_chunks LIMIT 1000")
            for row in cur.fetchall():
                mapping["mappings"].append({"rowid": row[0], "id": row[1] if len(row) > 1 else None})
            conn.close()
        except Exception:
            mapping["error"] = "unable to memory-map or read sqlite table tx_chunks"
    with open(out_index, "w", encoding="utf8") as o:
        json.dump(mapping, o, ensure_ascii=False, indent=2)
    return out_index


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo", default=".", help="repo root")
    p.add_argument("--kb", default=DEFAULT_KB_PATH, help="KB sqlite path")
    p.add_argument("--query", default="procedures", help="FTS query")
    p.add_argument("--name", default="Naion Defense Law", help="procedure name hint")
    args = p.parse_args()

    report = {"repo": args.repo, "kb": args.kb, "steps": []}

    searc_result = run_searc(args.repo, os.path.join(OUTPUT_DIR, "searc_audit.json"))
    if searc_result:
        report["steps"].append({"searc": searc_result})
    else:
        report["steps"].append({"searc": "not-found, ran lightweight audit"})
        report["lightweight_audit"] = lightweight_repo_audit(args.repo)

    try:
        fts_rows = query_tx_fts(args.kb, args.query)
        report["fts_sample_count"] = len(fts_rows)
        report["fts_samples"] = fts_rows[:10]
    except Exception as e:
        report["fts_error"] = str(e)
        fts_rows = []

    proc_matches = extract_procedure_details(fts_rows, args.name)
    report["procedure_matches"] = proc_matches

    mapping_path = build_mfs_index(args.kb, out_index=os.path.join(OUTPUT_DIR, "kb_mapping.json"))
    report["mapping_path"] = mapping_path

    report["suggestions"] = [
        "Verify tx_fts schema and row content; ensure FTS tokenizer is correct for Arabic.",
        "Add canonical procedure IDs and cross-reference to `kb_mapping.json` (MFS).",
        "Create QA tests for Naion Defense Law procedure retrieval and rank-matching.",
        "If SeaRC available, run full searc findings and triage high-severity issues."
    ]

    out = os.path.join(OUTPUT_DIR, "audit_report.json")
    with open(out, "w", encoding="utf8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    print("Wrote", out)


if __name__ == "__main__":
    main()
