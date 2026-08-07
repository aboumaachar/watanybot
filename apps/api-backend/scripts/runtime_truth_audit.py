from __future__ import annotations

import ast
import json
import os
import re
import sys
import importlib.util
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "docs" / "RUNTIME_TRUTH_REPORT.md"

EXCLUDE_DIRS = {
    ".git",
    "__pycache__",
    ".venv",
    "venv",
    ".mypy_cache",
    ".pytest_cache",
    "node_modules",
    "dist",
    "build",
}

EXCLUDE_FILES_PREFIX = {"repo_introspect"}

REQUIRED_ENDPOINTS: List[Tuple[str, str]] = [
    ("POST", "/api/chat"),
    ("GET", "/whatsapp/webhook"),
    ("POST", "/whatsapp/webhook"),
    ("GET", "/api/procedures/search"),
    ("GET", "/api/procedures/{tx_no}"),
    ("GET", "/api/law/search"),
    ("GET", "/api/law/{article_no}"),
]

TEXT_EXTS = {".md", ".txt", ".bat", ".ps1", ".sh", ".yml", ".yaml", ".json"}


@dataclass
class AppCandidate:
    file_path: Path
    var_name: str
    line_no: int


@dataclass
class RouterMount:
    router_expr: str
    prefix: Optional[str]
    tags: Optional[List[str]]
    line_no: int


@dataclass
class LaunchCommand:
    file_path: Path
    line_no: int
    line_text: str


@dataclass
class EndpointPresence:
    method: str
    path: str
    present: bool
    source: str
    details: Optional[str] = None


def _iter_files(extensions: Optional[Sequence[str]] = None) -> Iterable[Path]:
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for file_name in files:
            if any(file_name.startswith(prefix) for prefix in EXCLUDE_FILES_PREFIX):
                continue
            path = Path(root) / file_name
            if path.resolve() == Path(__file__).resolve():
                continue
            if path.resolve() == REPORT_PATH.resolve():
                continue
            if extensions and path.suffix.lower() not in extensions:
                continue
            yield path


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return path.read_text(encoding="utf-8", errors="ignore")


def find_fastapi_apps(py_files: Iterable[Path]) -> List[AppCandidate]:
    apps: List[AppCandidate] = []
    pattern = re.compile(r"^(?P<var>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*FastAPI\s*\(", re.MULTILINE)
    for path in py_files:
        text = _read_text(path)
        for match in pattern.finditer(text):
            var_name = match.group("var")
            line_no = text[: match.start()].count("\n") + 1
            apps.append(AppCandidate(file_path=path, var_name=var_name, line_no=line_no))
    return apps


def find_uvicorn_runs(py_files: Iterable[Path]) -> List[LaunchCommand]:
    runs: List[LaunchCommand] = []
    for path in py_files:
        text = _read_text(path)
        if "uvicorn.run" not in text:
            continue
        for idx, line in enumerate(text.splitlines(), start=1):
            if "uvicorn.run" in line:
                runs.append(LaunchCommand(file_path=path, line_no=idx, line_text=line.strip()))
    return runs


def find_launch_commands(text_files: Iterable[Path]) -> List[LaunchCommand]:
    commands: List[LaunchCommand] = []
    cmd_pattern = re.compile(r"\buvicorn\b")
    for path in text_files:
        if path.name.lower().startswith("requirements") and path.suffix.lower() == ".txt":
            continue
        text = _read_text(path)
        if "uvicorn" not in text:
            continue
        for idx, line in enumerate(text.splitlines(), start=1):
            line_text = line.strip()
            if not cmd_pattern.search(line_text):
                continue
            is_command = (
                re.search(r"(^|\s)uvicorn\s", line_text) is not None
                or "python -m uvicorn" in line_text
                or "CMD [\"uvicorn\"" in line_text
                or line_text.startswith("exec uvicorn")
            )
            if is_command:
                commands.append(LaunchCommand(file_path=path, line_no=idx, line_text=line_text))
    return commands


def _node_to_str(node: ast.AST) -> str:
    if isinstance(node, ast.Constant):
        return repr(node.value)
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{_node_to_str(node.value)}.{node.attr}"
    if isinstance(node, (ast.List, ast.Tuple)):
        inner = ", ".join(_node_to_str(el) for el in node.elts)
        open_char, close_char = ("[", "]") if isinstance(node, ast.List) else ("(", ")")
        return f"{open_char}{inner}{close_char}"
    if hasattr(ast, "unparse"):
        try:
            return ast.unparse(node)
        except Exception:
            return node.__class__.__name__
    return node.__class__.__name__


def parse_router_mounts(path: Path, app_vars: Sequence[str]) -> List[RouterMount]:
    text = _read_text(path)
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return []

    mounts: List[RouterMount] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not isinstance(func, ast.Attribute):
            continue
        if func.attr != "include_router":
            continue
        base = func.value
        if not isinstance(base, ast.Name) or base.id not in app_vars:
            continue

        router_expr = _node_to_str(node.args[0]) if node.args else ""
        prefix_value = None
        tags_value: Optional[List[str]] = None
        for kw in node.keywords:
            if kw.arg == "prefix":
                if isinstance(kw.value, ast.Constant):
                    prefix_value = str(kw.value.value)
                else:
                    prefix_value = _node_to_str(kw.value)
            if kw.arg == "tags":
                if isinstance(kw.value, (ast.List, ast.Tuple)):
                    tags_value = [str(getattr(el, "value", _node_to_str(el))) for el in kw.value.elts]
                else:
                    tags_value = [_node_to_str(kw.value)]
        line_no = getattr(node, "lineno", 0)
        mounts.append(RouterMount(router_expr=router_expr, prefix=prefix_value, tags=tags_value, line_no=line_no))
    return mounts


def parse_router_prefix(path: Path) -> Optional[str]:
    text = _read_text(path)
    match = re.search(r"APIRouter\([^\)]*prefix\s*=\s*['\"]([^'\"]+)['\"]", text)
    if match:
        return match.group(1)
    return None


def parse_static_endpoints(path: Path) -> List[Tuple[str, str]]:
    text = _read_text(path)
    prefix = parse_router_prefix(path) or ""
    endpoints: List[Tuple[str, str]] = []
    for line in text.splitlines():
        match = re.search(r"@router\.(get|post|put|delete)\(\"([^\"]+)\"", line)
        if not match:
            match = re.search(r"@router\.(get|post|put|delete)\('([^']+)'", line)
        if match:
            method = match.group(1).upper()
            route_path = match.group(2)
            if prefix and route_path.startswith("/"):
                full_path = prefix.rstrip("/") + route_path
            else:
                full_path = route_path
            endpoints.append((method, full_path))
    return endpoints


def openapi_endpoints(module_path: Path, app_var: str) -> Tuple[Optional[Dict[str, List[str]]], Optional[str]]:
    os.environ.setdefault("RUNTIME_TRUTH_AUDIT", "1")
    sys.path.insert(0, str(ROOT))
    sys.path.insert(0, str(module_path.parent))
    try:
        module_name = f"runtime_truth_{module_path.stem}_{abs(hash(str(module_path)))}"
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        if not spec or not spec.loader:
            return None, "spec_failed"
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        app = getattr(module, app_var, None)
        if app is None or not hasattr(app, "openapi"):
            return None, "app_not_found"
        openapi = app.openapi()
        paths = openapi.get("paths", {})
        results: Dict[str, List[str]] = {}
        for path, methods in paths.items():
            results[path] = [m.upper() for m in methods.keys()]
        return results, None
    except Exception as exc:
        return None, f"import_failed: {exc}"
    finally:
        if str(module_path.parent) in sys.path:
            sys.path.remove(str(module_path.parent))
        if str(ROOT) in sys.path:
            sys.path.remove(str(ROOT))


def load_env() -> Tuple[Optional[Path], Dict[str, str]]:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return None, {}
    env_data: Dict[str, str] = {}
    for line in _read_text(env_path).splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env_data[key.strip()] = value.strip().strip("\"\'")
    return env_path, env_data


def find_kb_paths(text_files: Iterable[Path]) -> List[Tuple[Path, str]]:
    hits: List[Tuple[Path, str]] = []
    for path in text_files:
        text = _read_text(path)
        if "kb.sqlite" not in text and "KB_SQLITE_PATH" not in text and "kb_sqlite_path" not in text:
            continue
        for line in text.splitlines():
            if "kb.sqlite" in line or "KB_SQLITE_PATH" in line or "kb_sqlite_path" in line:
                hits.append((path, line.strip()))
    return hits


def find_apps_api_dirs() -> List[Path]:
    results: List[Path] = []
    for root, dirs, _ in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        if "apps" in dirs:
            apps_dir = Path(root) / "apps"
            api_dir = apps_dir / "api"
            if api_dir.exists() and api_dir.is_dir():
                results.append(api_dir)
    return results


def find_nested_watanbot_roots() -> List[Path]:
    roots: List[Path] = []
    for root, dirs, _ in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for d in dirs:
            if d.lower() == "watanbot":
                candidate = Path(root) / d
                if candidate.resolve() != ROOT.resolve():
                    roots.append(candidate)
    return roots


def _format_path(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def _format_launch_commands(commands: List[LaunchCommand]) -> List[str]:
    lines = []
    for cmd in commands:
        lines.append(f"- {_format_path(cmd.file_path)}:{cmd.line_no} {cmd.line_text}")
    return lines


def _collect_endpoints_from_openapi(apps: List[AppCandidate]) -> Dict[str, List[str]]:
    for app in apps:
        endpoints, error = openapi_endpoints(app.file_path, app.var_name)
        if endpoints is not None:
            return endpoints
    return {}


def _collect_endpoints_static(router_files: Iterable[Path]) -> Dict[str, List[str]]:
    results: Dict[str, List[str]] = {}
    for path in router_files:
        for method, route in parse_static_endpoints(path):
            results.setdefault(route, [])
            if method not in results[route]:
                results[route].append(method)
    return results


def _endpoint_presence(endpoints: Dict[str, List[str]]) -> List[EndpointPresence]:
    presence: List[EndpointPresence] = []
    for method, path in REQUIRED_ENDPOINTS:
        methods = endpoints.get(path, [])
        present = method in methods
        presence.append(EndpointPresence(method=method, path=path, present=present, source="openapi_or_static"))
    return presence


def _find_expected_source(path_hints: Sequence[str], py_files: Iterable[Path]) -> Optional[str]:
    for path in py_files:
        text = _read_text(path)
        for hint in path_hints:
            if hint and hint in text:
                return f"{_format_path(path)}"
    return None


def main() -> int:
    py_files = list(_iter_files([".py"]))
    text_files = list(_iter_files(TEXT_EXTS))
    router_files = [p for p in py_files if p.parent.name == "routers"]

    apps = find_fastapi_apps(py_files)
    uvicorn_runs = find_uvicorn_runs(py_files)
    launch_commands = find_launch_commands(text_files)

    router_mounts: Dict[str, List[RouterMount]] = {}
    for app in apps:
        mounts = parse_router_mounts(app.file_path, [app.var_name])
        router_mounts.setdefault(_format_path(app.file_path), []).extend(mounts)

    endpoints = _collect_endpoints_from_openapi(apps)
    endpoints_source = "openapi"
    if not endpoints:
        endpoints = _collect_endpoints_static(router_files)
        endpoints_source = "static"

    endpoint_presence = _endpoint_presence(endpoints)

    env_path, env_data = load_env()
    kb_path = env_data.get("KB_SQLITE_PATH")
    kb_path_exists = None
    kb_path_resolved: Optional[Path] = None
    if kb_path:
        kb_path_resolved = (ROOT / kb_path).resolve() if not os.path.isabs(kb_path) else Path(kb_path)
        kb_path_exists = kb_path_resolved.exists()

    postgres_keys = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER"]
    postgres_present = {key: (key in env_data) for key in postgres_keys}

    kb_path_hits = find_kb_paths(text_files + py_files)

    apps_api_dirs = find_apps_api_dirs()
    nested_watanbot = find_nested_watanbot_roots()

    primary_entrypoint = None
    for cmd in launch_commands:
        if "uvicorn" in cmd.line_text and "main:app" in cmd.line_text:
            primary_entrypoint = "apps/api/main.py:app"
            break
    if not primary_entrypoint and apps:
        primary_entrypoint = f"{_format_path(apps[0].file_path)}:{apps[0].var_name}"

    inconsistencies: List[str] = []
    if len(apps) > 1:
        inconsistencies.append("multiple_fastapi_apps")
    if any(not ep.present for ep in endpoint_presence):
        inconsistencies.append("missing_endpoints")
    if env_path is None:
        inconsistencies.append("missing_env")
    if kb_path and kb_path_exists is False:
        inconsistencies.append("kb_path_missing")
    if len(apps_api_dirs) > 1:
        inconsistencies.append("multiple_apps_api_dirs")
    if nested_watanbot:
        inconsistencies.append("nested_watanbot")

    likely_causes: List[str] = []
    if "multiple_apps_api_dirs" in inconsistencies or "nested_watanbot" in inconsistencies:
        likely_causes.append("wrong folder")
    if "multiple_fastapi_apps" in inconsistencies:
        likely_causes.append("wrong entrypoint")
    primary_mounts = router_mounts.get("apps/api/main.py", [])
    if "missing_endpoints" in inconsistencies and not primary_mounts:
        likely_causes.append("routers not mounted")
    if "missing_env" in inconsistencies or "kb_path_missing" in inconsistencies:
        likely_causes.append("wrong env")
    if not likely_causes:
        likely_causes.append("stale server")

    fixes: List[str] = []
    if "wrong entrypoint" in likely_causes:
        fixes.append("Run uvicorn against apps/api/main.py:app (ex: uvicorn main:app from apps/api).")
    if "routers not mounted" in likely_causes:
        fixes.append("Confirm routers are included in apps/api/main.py and restart the server.")
    if "wrong folder" in likely_causes:
        fixes.append("Ensure you run from the intended workspace root and remove duplicate app folders.")
    if "wrong env" in likely_causes:
        fixes.append("Create .env from .env.example and set KB_SQLITE_PATH and Postgres vars, then restart services.")
    if "stale server" in likely_causes:
        fixes.append("Restart the running API process and verify it points to the current workspace.")

    report_lines: List[str] = []
    report_lines.append("# Runtime Truth Report")
    report_lines.append("")
    report_lines.append("## Primary Entrypoint (Best Guess)")
    report_lines.append(f"- {primary_entrypoint or 'unknown'}")
    report_lines.append("")
    report_lines.append("## FastAPI Entrypoints Found")
    for app in apps:
        report_lines.append(f"- {_format_path(app.file_path)}:{app.var_name} (line {app.line_no})")
    if not apps:
        report_lines.append("- none")
    report_lines.append("")

    report_lines.append("## Uvicorn.run Calls")
    if uvicorn_runs:
        for cmd in uvicorn_runs:
            report_lines.append(f"- {_format_path(cmd.file_path)}:{cmd.line_no} {cmd.line_text}")
    else:
        report_lines.append("- none")
    report_lines.append("")
    report_lines.append("## Launch Commands (uvicorn)")
    if launch_commands:
        report_lines.extend(_format_launch_commands(launch_commands))
    else:
        report_lines.append("- none")

    report_lines.append("")
    report_lines.append("## Router Mounts")
    if router_mounts:
        for file_name, mounts in router_mounts.items():
            report_lines.append(f"- {file_name}")
            for mount in mounts:
                tags = f" tags={mount.tags}" if mount.tags else ""
                prefix = f" prefix={mount.prefix}" if mount.prefix else ""
                report_lines.append(f"  - include_router({mount.router_expr}){prefix}{tags} (line {mount.line_no})")
    else:
        report_lines.append("- none")

    report_lines.append("")
    report_lines.append("## Endpoint Matrix")
    report_lines.append(f"- Source: {endpoints_source}")
    for ep in endpoint_presence:
        status = "present" if ep.present else "missing"
        report_lines.append(f"- {ep.method} {ep.path}: {status}")
        if not ep.present:
            base_hint = ep.path.split("{")[0]
            extra_hints = []
            if ep.path == "/api/chat":
                extra_hints = ["/chat/ask", "chat_ask"]
            hint = _find_expected_source([base_hint] + extra_hints, router_files)
            if hint:
                report_lines.append(f"  - expected in: {hint}")

    report_lines.append("")
    report_lines.append("## KB/DB Configuration Truth")
    report_lines.append(f"- .env present: {'yes' if env_path else 'no'}")
    report_lines.append(f"- KB_SQLITE_PATH present: {'yes' if 'KB_SQLITE_PATH' in env_data else 'no'}")
    if kb_path_resolved:
        report_lines.append(f"- KB_SQLITE_PATH resolved: {kb_path_resolved}")
        report_lines.append(f"- KB_SQLITE_PATH exists: {'yes' if kb_path_exists else 'no'}")
    report_lines.append("- Postgres keys present:")
    for key, present in postgres_present.items():
        report_lines.append(f"  - {key}: {'yes' if present else 'no'}")

    report_lines.append("")
    report_lines.append("## Other KB Path References")
    if kb_path_hits:
        for path, line in kb_path_hits[:50]:
            report_lines.append(f"- {_format_path(path)}: {line}")
        if len(kb_path_hits) > 50:
            report_lines.append(f"- ... {len(kb_path_hits) - 50} more")
    else:
        report_lines.append("- none")

    report_lines.append("")
    report_lines.append("## Build Duplication Checks")
    report_lines.append(f"- apps/api directories: {len(apps_api_dirs)}")
    for path in apps_api_dirs:
        report_lines.append(f"  - {_format_path(path)}")
    report_lines.append(f"- nested watanbot roots: {len(nested_watanbot)}")
    for path in nested_watanbot:
        report_lines.append(f"  - {_format_path(path)}")

    report_lines.append("")
    report_lines.append("## Likely Causes")
    for cause in sorted(set(likely_causes)):
        report_lines.append(f"- {cause}")

    report_lines.append("")
    report_lines.append("## Fix Steps")
    for step in fixes:
        report_lines.append(f"- {step}")

    REPORT_PATH.write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    missing = [ep for ep in endpoint_presence if not ep.present]
    exit_code = 4 if inconsistencies else 0
    print("Runtime truth audit summary")
    print(f"- FastAPI apps found: {len(apps)}")
    print(f"- Launch commands found: {len(launch_commands)}")
    print(f"- Endpoints missing: {len(missing)}")
    print(f"- Report: {REPORT_PATH}")
    print(f"- Exit code: {exit_code}")

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
