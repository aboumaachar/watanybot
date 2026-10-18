APEX_PS1_SKILL_UPDATE_NOT_REQUIRED

# WatanyBot Gate 2 — Local web development runtime acceptance
Date: 2026-10-11
Workspace: `C:\xampp\htdocs\projectx\watanybot`
Status: `LOCAL_WEB_RUNTIME_PASS / FULL_LOCAL_ENVIRONMENT_PARTIAL`

## Authoritative scope
Local, loopback-only development and synthetic tests. No BitLocker configuration change, no production data transfer, no canonical local database migration, no source retrieval through the existing platform-restricted path, and no auth bypass.

## Runtime acceptance
- Gateway launched with `RUN_PG_MIGRATIONS=false`, `HOST=127.0.0.1`. `GET http://127.0.0.1:4000/health` => HTTP 200.
- `web-user` at `http://127.0.0.1:5174/` => HTTP 200.
- `web-admin` at `http://127.0.0.1:5175/ops/` => HTTP 200.
- Both frontend `/api/health` proxy routes => HTTP 200 through the local gateway.
- Anonymous `GET /api/admin/dashboard` => HTTP 401; `GET /api/admin/users` => HTTP 401 (expected auth denial).
- Headless Chromium checked user and admin pages: both HTTP 200; React root present; `/api/health` HTTP 200; zero JavaScript page errors; process exit 0, `LOCAL_BROWSER_RUNTIME_PASS`.
- After intentionally blocked duplicate launcher run, gateway and both frontend pages still returned HTTP 200.

## Focused regression tests
- `documents-cms-boundary.test.ts`, `universal-job-applications.test.ts`, `jobs-v2-management.test.ts`: 3 suites, **11 tests PASS**, exit 0.
- `admin-auth-hardening.test.ts`, `payload-cms-boundary.test.ts`, `news-cms-runtime.test.ts`: 3 suites, **24 tests PASS**, exit 0.
- Web-user `tsc --noEmit`: exit 0.
- Web-admin `tsc --noEmit`: exit 0.
- Gateway TypeScript typecheck was independently accepted in the earlier Gate 2 migration-runner stage; not rerun in this pass.

## Local launcher repair (scripts/dev-startup.js)
- Gateway health / startup port corrected from 8010 to 4000.
- When available, Python backend remains 127.0.0.1:8012 and gateway Python target is set accordingly.
- Both Vite apps explicitly receive `VITE_DEV_PROXY_TARGET=http://127.0.0.1:4000`.
- Gateway startup sets `RUN_PG_MIGRATIONS=false` to prevent accidental canonical database schema changes.
- Python candidate selection probes whether the interpreter and uvicorn actually work rather than trusting file existence or the `python` WindowsApps alias.
- If Python is unavailable, only the three web services are configured, with `LOCAL_DEV_WEB_SERVICES_HEALTHY_PYTHON_DEGRADED`, never full-service PASS.
- Port-bound preflight refuses duplicate service start instead of counting existing listeners as newly started children.
- `node --check scripts/dev-startup.js` exit 0; `git diff --check` exit 0.
- `WATANY_DEV_SKIP_PYTHON=1 node scripts/dev-startup.js --check` exit 0, token `LOCAL_DEV_LAUNCH_PREFLIGHT_PASS`, reports Python unavailable and automatic DB migrations disabled.
- Default `node scripts/dev-startup.js --check` exit 0, same preflight token and Python unavailable.
- Negative test when gateway already running: launcher rejected `LOCAL_DEV_PORT_ALREADY_BOUND=4000`, exit **1** as expected; existing three HTTP services remained available.
- Full all-in-one launcher start on free ports **not tested** because services were already running. A preflight PASS is not full runtime acceptance.

## Open blockers
- Python backend: old local virtual environment launcher references a missing CPython 3.14 install. Windows `python` returns alias/error 9009; a distinct uv-managed CPython 3.14 interpreter exists but lacks the `uvicorn` package. Python-dependent workflows are **NOT AVAILABLE**.
- Historical migration `056_job_template_builder.sql` remains unresolved under previous platform restriction. Existing canonical local `watany` ledger count = 56; repository SQL source files = 61; six sources pending application. No ledger entries were forged, and no canonical database migrations were performed.
- Complete login, full authenticated workflow, end-to-end CMS publishing, uploads, browser mobile checks, and Python-backed chat features not proven by these focused tests.
- At-rest encryption for identifiable production-data replication unverified; no production-to-local applicant transfer attempted.
- APEX post-hoc summary does not replace the complete mandatory pre-execution evidence lifecycle for other future runs.

## Acceptance classification
`LOCAL_GATEWAY_HTTP=PASS`
`LOCAL_WEB_USER_HTTP_AND_BROWSER=PASS`
`LOCAL_WEB_ADMIN_HTTP_AND_BROWSER=PASS`
`LOCAL_API_PROXY=PASS`
`FOCUSED_TESTS_35_OF_35=PASS`
`FRONTEND_TYPECHECKS=PASS`
`LOCAL_LAUNCHER_SOURCE_PREFLIGHT=PASS`
`LOCAL_LAUNCHER_FULL_FRESH_START=UNVERIFIED`
`LOCAL_PYTHON_SERVICE=BLOCKED_MISSING_RUNTIME`
`CANONICAL_DB_MIGRATION=NOT_EXECUTED`
`PRODUCTION_DATA_SYNC=NO_GO`
`FULL_LOCAL_ENVIRONMENT=PARTIAL_NOT_GREEN`
