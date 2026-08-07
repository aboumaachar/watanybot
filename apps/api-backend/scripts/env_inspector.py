#!/usr/bin/env python
"""Environment inspector for repo health checks (read-only)."""
from __future__ import annotations

import os
import sys
import socket
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple


REDACT_SUBSTRINGS = ("TOKEN", "SECRET", "PASSWORD", "KEY")


@dataclass
class CheckResult:
    status: str  # PASS, WARN, FAIL, INFO
    label: str
    detail: str


def is_sensitive_key(key: str) -> bool:
    upper = key.upper()
    return any(token in upper for token in REDACT_SUBSTRINGS)


def redact_value(key: str, value: Optional[str]) -> str:
    if value is None:
        return "missing"
    if is_sensitive_key(key):
        return "present"
    return value


def find_repo_root(start: Path) -> Path:
    markers = {".git", "README.md", "pyproject.toml", "package.json"}
    current = start.resolve()
    for _ in range(10):
        if any((current / m).exists() for m in markers):
            return current
        if current.parent == current:
            break
        current = current.parent
    return start.resolve()


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
        key = key.strip()
        value = value.strip().strip("'\"")
        env[key] = value
    return env


def get_env(repo_root: Path) -> Tuple[Dict[str, str], bool]:
    env_file = repo_root / ".env"
    file_env = parse_env_file(env_file)
    merged = dict(file_env)
    merged.update(os.environ)
    return merged, env_file.exists()


def check_bool(value: Optional[str]) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on", "y"}


def check_port_available(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
            return True
        except OSError:
            return False


def try_tcp_connect(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def safe_run_version(cmd: List[str]) -> Optional[str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=2)
    except (OSError, subprocess.TimeoutExpired):
        return None
    output = (result.stdout or result.stderr or "").strip()
    return output.splitlines()[0] if output else None


def add_result(results: List[CheckResult], status: str, label: str, detail: str) -> None:
    results.append(CheckResult(status=status, label=label, detail=detail))


def main() -> int:
    script_dir = Path(__file__).parent
    repo_root = find_repo_root(script_dir)

    env, env_file_present = get_env(repo_root)

    results: List[CheckResult] = []

    add_result(results, "INFO", "Repo root", str(repo_root))
    add_result(results, "INFO", ".env file", "present" if env_file_present else "missing")

    # Env var checks
    app_env = env.get("APP_ENV")
    if app_env is None:
        add_result(results, "FAIL", "APP_ENV", "missing")
    elif app_env not in {"dev", "staging", "prod"}:
        add_result(results, "FAIL", "APP_ENV", f"invalid ({app_env})")
    else:
        add_result(results, "PASS", "APP_ENV", app_env)

    kb_path = env.get("KB_SQLITE_PATH")
    if kb_path:
        kb_file = (repo_root / kb_path).resolve() if not Path(kb_path).is_absolute() else Path(kb_path)
        if kb_file.exists():
            add_result(results, "PASS", "KB_SQLITE_PATH", "present")
        else:
            add_result(results, "WARN", "KB_SQLITE_PATH", "file missing")
    else:
        add_result(results, "WARN", "KB_SQLITE_PATH", "missing")

    auto_create_kb = env.get("AUTO_CREATE_KB")
    if auto_create_kb is None:
        add_result(results, "WARN", "AUTO_CREATE_KB", "missing")
    elif check_bool(auto_create_kb) or auto_create_kb.strip().lower() in {"0", "false", "no", "off", "n"}:
        add_result(results, "PASS", "AUTO_CREATE_KB", "valid")
    else:
        add_result(results, "WARN", "AUTO_CREATE_KB", "invalid boolean")

    pg_keys = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"]
    pg_present = [k for k in pg_keys if env.get(k)]
    if not pg_present:
        add_result(results, "WARN", "POSTGRES_*", "not set")
    else:
        missing = [k for k in pg_keys if not env.get(k)]
        if missing:
            add_result(results, "FAIL", "POSTGRES_*", f"missing: {', '.join(missing)}")
        else:
            add_result(results, "PASS", "POSTGRES_*", "present")

    jwt = env.get("JWT_SECRET")
    if not jwt:
        add_result(results, "FAIL", "JWT_SECRET", "missing")
    elif len(jwt) < 32:
        add_result(results, "FAIL", "JWT_SECRET", "length < 32")
    else:
        add_result(results, "PASS", "JWT_SECRET", "length ok")

    wa_keys = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN"]
    wa_present = [k for k in wa_keys if env.get(k)]
    if not wa_present:
        add_result(results, "WARN", "WHATSAPP_*", "not set")
    else:
        missing = [k for k in wa_keys if not env.get(k)]
        if missing:
            add_result(results, "WARN", "WHATSAPP_*", f"missing: {', '.join(missing)}")
        else:
            add_result(results, "PASS", "WHATSAPP_*", "present")

    # Filesystem checks
    data_dir = repo_root / "data"
    if data_dir.exists():
        add_result(results, "PASS", "data/", "present")
    else:
        add_result(results, "WARN", "data/", "missing")

    if kb_path:
        kb_dir = (repo_root / kb_path).resolve().parent if not Path(kb_path).is_absolute() else Path(kb_path).parent
        if kb_dir.exists():
            add_result(results, "PASS", "KB_SQLITE_PATH dir", "present")
        else:
            add_result(results, "WARN", "KB_SQLITE_PATH dir", "missing")

    scripts_dir = repo_root / "scripts"
    if scripts_dir.exists():
        add_result(results, "PASS", "scripts/", "present")
    else:
        add_result(results, "FAIL", "scripts/", "missing")

    sources_primary = repo_root / "sources" / "primary"
    if sources_primary.exists():
        add_result(results, "PASS", "sources/primary", "present")
    else:
        add_result(results, "WARN", "sources/primary", "missing")

    # Runtime stack detection
    has_api = (repo_root / "apps" / "api").exists()
    has_pkg = (repo_root / "package.json").exists()
    has_composer = (repo_root / "composer.json").exists()
    stack = []
    if has_api:
        stack.append("FastAPI")
    if has_pkg:
        stack.append("Node/React/Electron")
    if has_composer:
        stack.append("PHP/Laravel")
    add_result(results, "INFO", "Runtime stack", ", ".join(stack) if stack else "unknown")

    # Dependency checks
    py_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    add_result(results, "INFO", "Python", f"{py_version}")
    pip_available = shutil.which("pip") is not None
    add_result(results, "INFO", "pip", "available" if pip_available else "missing")
    req_exists = (repo_root / "requirements.txt").exists() or (repo_root / "api" / "requirements.txt").exists()
    add_result(results, "INFO", "requirements.txt", "present" if req_exists else "missing")

    if has_pkg:
        node_version = safe_run_version(["node", "--version"])
        npm_version = safe_run_version(["npm", "--version"])
        add_result(results, "INFO", "node", node_version or "missing")
        add_result(results, "INFO", "npm", npm_version or "missing")

    # Port checks
    for port in (8000, 5432, 3000):
        free = check_port_available(port)
        status = "PASS" if free else "WARN"
        detail = "free" if free else "in use"
        add_result(results, status, f"Port {port}", detail)

    # Optional Postgres TCP check
    if env.get("POSTGRES_HOST") and env.get("POSTGRES_PORT"):
        host = env.get("POSTGRES_HOST", "")
        try:
            port = int(env.get("POSTGRES_PORT", "5432"))
        except ValueError:
            add_result(results, "FAIL", "Postgres TCP", "invalid port")
        else:
            reachable = try_tcp_connect(host, port)
            add_result(results, "PASS" if reachable else "WARN", "Postgres TCP", "reachable" if reachable else "unreachable")

    # Report
    report_lines: List[str] = []
    report_lines.append("# Environment Inspection Report")
    report_lines.append("")
    report_lines.append(f"Generated: {datetime.now(timezone.utc).isoformat()}")
    report_lines.append("")
    report_lines.append("## Results")
    report_lines.append("")

    for item in results:
        report_lines.append(f"- {item.status}: {item.label} - {item.detail}")

    report_path = repo_root / "docs" / "ENV_INSPECTION_REPORT.md"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(report_lines), encoding="utf-8")

    # Terminal summary
    statuses = [r.status for r in results]
    exit_code = 0
    if "FAIL" in statuses:
        exit_code = 4
    elif "WARN" in statuses:
        exit_code = 2

    print("ENV INSPECTION SUMMARY")
    print(f"PASS: {statuses.count('PASS')}")
    print(f"WARN: {statuses.count('WARN')}")
    print(f"FAIL: {statuses.count('FAIL')}")
    print(f"Report: {report_path}")

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
