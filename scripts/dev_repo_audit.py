#!/usr/bin/env python3
# scripts/dev_repo_audit.py
"""
Watany/WatanBot Dev Repo Audit (read-only)
- Finds likely API entrypoints (FastAPI/Fastify), router mounts, endpoints
- Checks .env + KB paths + duplicates + requirements/package deps
- Produces Markdown + JSON report

Usage:
  python scripts/dev_repo_audit.py --out docs/DEV_REPO_AUDIT
"""

from __future__ import annotations
import argparse, json, os, re, sys
from pathlib import Path
from datetime import datetime

TEXT_EXT = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".yml", ".yaml", ".md", ".env", ".txt", ".htaccess", ".php", ".sh", ".ps1"}

FASTAPI_HINTS = [
    r"FastAPI\(",
    r"APIRouter\(",
    r"include_router\(",
    r"uvicorn\.run\(",
]
FASTIFY_HINTS = [
    r"fastify\.",
    r"FastifyInstance",
    r"fastify\.route\(",
    r"fastify\.(get|post|put|delete)\(",
]
ROUTER_MOUNT_RE = re.compile(r"include_router\((?P<router>[^,\)]+)(?P<rest>.*)\)", re.MULTILINE)
FASTAPI_APP_RE = re.compile(r"(?m)^\s*(?P<name>[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*FastAPI\(")
UVICORN_RUN_RE = re.compile(r"uvicorn\.run\((?P<args>[^)]+)\)")
PATH_KV_RE = re.compile(r"^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$")

def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""

def safe_rel(root: Path, p: Path) -> str:
    try:
        return str(p.relative_to(root))
    except Exception:
        return str(p)

def scan_files(root: Path):
    files = []
    for p in root.rglob("*"):
        if p.is_file():
            # skip huge dirs
            if any(part.lower() in {"node_modules", ".git", ".venv", "venv", "__pycache__", ".pytest_cache"} for part in p.parts):
                continue
            files.append(p)
    return files

def parse_env(env_path: Path):
    env = {}
    if not env_path.exists():
        return env
    for line in read_text(env_path).splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = PATH_KV_RE.match(line)
        if not m:
            continue
        k, v = m.group(1), m.group(2).strip().strip('"').strip("'")
        env[k] = v
    return env

def detect_duplicates(root: Path):
    # crude duplicate-project detector
    candidates = []
    for p in root.rglob("apps"):
        if p.is_dir() and any((p / "api").exists() for _ in [0]):
            candidates.append(p)
    return sorted(set(str(c) for c in candidates))

def find_entrypoints(root: Path, files: list[Path]):
    fastapi_apps = []
    uvicorn_calls = []
    fastify_modules = []

    for f in files:
        if f.suffix not in TEXT_EXT:
            continue
        txt = read_text(f)
        if any(re.search(h, txt) for h in FASTAPI_HINTS):
            for m in FASTAPI_APP_RE.finditer(txt):
                fastapi_apps.append({"file": safe_rel(root, f), "var": m.group("name")})
            for m in UVICORN_RUN_RE.finditer(txt):
                uvicorn_calls.append({"file": safe_rel(root, f), "args": m.group("args")[:200]})
        if any(re.search(h, txt) for h in FASTIFY_HINTS):
            # don’t add everything; only likely route files
            if "routes" in f.parts or "router" in f.name.lower():
                fastify_modules.append(safe_rel(root, f))

    return fastapi_apps, uvicorn_calls, sorted(set(fastify_modules))

def find_router_mounts(root: Path, files: list[Path]):
    mounts = []
    for f in files:
        if f.suffix != ".py":
            continue
        txt = read_text(f)
        if "include_router(" not in txt:
            continue
        for m in ROUTER_MOUNT_RE.finditer(txt):
            mounts.append({
                "file": safe_rel(root, f),
                "router_expr": m.group("router").strip(),
                "rest": m.group("rest").strip()[:200]
            })
    return mounts

def find_openapi_routes_hint(root: Path):
    # if openapi.json exists in repo, note it
    hits = []
    for p in root.rglob("openapi.json"):
        if any(part.lower() in {"node_modules", ".git", ".venv"} for part in p.parts):
            continue
        hits.append(safe_rel(root, p))
    return hits

def summarize_deps(root: Path):
    req = root / "requirements.txt"
    pkg = root / "package.json"
    out = {"requirements_txt": None, "package_json": None}
    if req.exists():
        out["requirements_txt"] = [ln.strip() for ln in read_text(req).splitlines() if ln.strip() and not ln.strip().startswith("#")][:200]
    if pkg.exists():
        try:
            j = json.loads(read_text(pkg))
            out["package_json"] = {
                "name": j.get("name"),
                "dependencies": j.get("dependencies", {}),
                "devDependencies": j.get("devDependencies", {}),
                "scripts": j.get("scripts", {}),
            }
        except Exception:
            out["package_json"] = {"error": "failed to parse"}
    return out

def check_kb_paths(root: Path, env: dict):
    kb_var = env.get("KB_SQLITE_PATH") or env.get("KB_PATH") or ""
    resolved = None
    exists = None
    if kb_var:
        p = Path(kb_var)
        if not p.is_absolute():
            p = (root / p).resolve()
        resolved = str(p)
        exists = p.exists()
    # common defaults
    defaults = []
    for cand in ["data/kb.sqlite", "data/kb_v3.sqlite", "data/retired_military_chatbot_kb.sqlite"]:
        p = (root / cand)
        defaults.append({"path": cand, "exists": p.exists()})
    return {"KB_SQLITE_PATH": kb_var, "resolved": resolved, "exists": exists, "defaults": defaults}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="Repo root")
    ap.add_argument("--out", default="docs/DEV_REPO_AUDIT", help="Output prefix (without extension)")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    files = scan_files(root)

    env_path = root / ".env"
    env = parse_env(env_path)

    fastapi_apps, uvicorn_calls, fastify_modules = find_entrypoints(root, files)
    mounts = find_router_mounts(root, files)
    openapi_hits = find_openapi_routes_hint(root)
    deps = summarize_deps(root)
    kb = check_kb_paths(root, env)
    dups = detect_duplicates(root)

    report = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "root": str(root),
        "counts": {
            "files_scanned": len(files),
            "fastapi_apps_found": len(fastapi_apps),
            "uvicorn_calls_found": len(uvicorn_calls),
            "router_mounts_found": len(mounts),
            "fastify_route_files_found": len(fastify_modules),
        },
        "env": {
            "has_env_file": env_path.exists(),
            "keys_present": sorted(list(env.keys()))[:200],
            "missing_recommended": [k for k in [
                "APP_ENV", "JWT_SECRET", "KB_SQLITE_PATH",
                "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN",
                "OPENAI_API_KEY"
            ] if k not in env],
        },
        "kb": kb,
        "entrypoints": {
            "fastapi_apps": fastapi_apps[:50],
            "uvicorn_calls": uvicorn_calls[:50],
            "fastify_route_files": fastify_modules[:80],
        },
        "router_mounts": mounts[:200],
        "openapi_files": openapi_hits,
        "deps": deps,
        "duplicate_candidates": dups,
        "notes": [
            "This audit is read-only. It reports what exists; it does not change code.",
            "If multiple FastAPI apps exist, ensure production runs the intended one.",
        ],
    }

    out_prefix = Path(args.out)
    out_prefix.parent.mkdir(parents=True, exist_ok=True)
    json_path = out_prefix.with_suffix(".json")
    md_path = out_prefix.with_suffix(".md")

    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    md = []
    md.append(f"# Dev Repo Audit\n\nGenerated: `{report['generated_at']}`\n\nRoot: `{report['root']}`\n")
    md.append("## Summary\n")
    for k, v in report["counts"].items():
        md.append(f"- **{k}**: {v}\n")
    md.append("\n## Env\n")
    md.append(f"- `.env` present: **{report['env']['has_env_file']}**\n")
    md.append(f"- Missing recommended keys: `{', '.join(report['env']['missing_recommended']) or 'none'}`\n")
    md.append("\n## KB\n")
    md.append(f"- KB_SQLITE_PATH: `{report['kb']['KB_SQLITE_PATH']}`\n")
    md.append(f"- Resolved: `{report['kb']['resolved']}`\n")
    md.append(f"- Exists: **{report['kb']['exists']}**\n")
    md.append("\n## Entrypoints (FastAPI)\n")
    for it in report["entrypoints"]["fastapi_apps"]:
        md.append(f"- {it['file']} :: `{it['var']}`\n")
    md.append("\n## Router mounts\n")
    for it in report["router_mounts"][:40]:
        md.append(f"- {it['file']} :: include_router({it['router_expr']})\n")
    md.append("\n## Duplicate candidates\n")
    for d in report["duplicate_candidates"]:
        md.append(f"- {d}\n")
    md.append("\n## Dependencies\n")
    if report["deps"]["requirements_txt"] is not None:
        md.append("- requirements.txt present\n")
    if report["deps"]["package_json"] is not None:
        md.append("- package.json present\n")

    md_path.write_text("".join(md), encoding="utf-8")

    print(f"[OK] Wrote:\n- {json_path}\n- {md_path}")

if __name__ == "__main__":
    main()
