# Runtime Truth Report

## Primary Entrypoint (Best Guess)
- apps/api/main.py:app

## FastAPI Entrypoints Found
- apps/api/main.py:app (line 42)
- apps/worker/main.py:app (line 34)
- public-salaries-app/update_api.py:app (line 9)
- public-salaries-app/apps/api/app/main.py:app (line 5)

## Uvicorn.run Calls
- apps/api/main.py:78 uvicorn.run(
- apps/worker/main.py:192 uvicorn.run(

## Launch Commands (uvicorn)
- infra/docker/docker-compose.yml:54 uvicorn main:app --host 0.0.0.0 --port ${API_PORT:-8000}
- public-salaries-app/bootstrap-public-salaries.ps1:305 CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
- scripts/docker-startup.ps1:25 uvicorn main:app --host 0.0.0.0 --port 8000
- scripts/docker-startup.sh:17 exec uvicorn main:app --host 0.0.0.0 --port 8000

## Router Mounts
- apps/api/main.py
  - include_router(public.router) tags=['Public'] (line 69)
  - include_router(admin.router) tags=['Admin'] (line 70)
  - include_router(superadmin.router) tags=['Superadmin'] (line 71)
  - include_router(kb_v3.router) tags=['KBv3'] (line 72)
  - include_router(whatsapp.router) (line 73)
- apps/worker/main.py
- public-salaries-app/update_api.py
- public-salaries-app/apps/api/app/main.py
  - include_router(military_router) (line 6)
  - include_router(tables_router) (line 7)

## Endpoint Matrix
- Source: openapi
- POST /api/chat: present
- GET /whatsapp/webhook: present
- POST /whatsapp/webhook: present
- GET /api/procedures/search: present
- GET /api/procedures/{tx_no}: present
- GET /api/law/search: present
- GET /api/law/{article_no}: present

## KB/DB Configuration Truth
- .env present: yes
- KB_SQLITE_PATH present: yes
- KB_SQLITE_PATH resolved: C:\xampp\htdocs\projectx\watanbot\data\kb.sqlite
- KB_SQLITE_PATH exists: yes
- Postgres keys present:
  - POSTGRES_HOST: yes
  - POSTGRES_PORT: yes
  - POSTGRES_DB: yes
  - POSTGRES_USER: yes

## Other KB Path References
- docs/.kb_sqlite.json: "kb_path": ".\\data\\kb.sqlite",
- docs/ENV.md: ### `KB_SQLITE_PATH`
- docs/ENV.md: - **Default**: `/data/kb.sqlite`
- docs/ENV.md: ### `KB_SQLITE_PATH_HOST`
- docs/ENV.md: - **Default**: `./data/kb.sqlite`
- docs/ENV_INSPECTION.md: - Place the KB at `./data/kb.sqlite` and set `KB_SQLITE_PATH=./data/kb.sqlite`.
- docs/ENV_INSPECTION_REPORT.md: - PASS: KB_SQLITE_PATH - present
- docs/ENV_INSPECTION_REPORT.md: - PASS: KB_SQLITE_PATH dir - present
- docs/GAP_REPORT.md: - No SQLite KB v3 file present (expected `retired_military_chatbot_kb_v3_with_ndlaw.sqlite` or `/data/kb.sqlite`)
- docs/IMPLEMENTATION_PLAN.md: 2. Introduce SQLite v3 reader with explicit file path config (env: `KB_SQLITE_PATH`).
- docs/KB_AUDIT_REPORT.md: - C:\data\kb.sqlite
- docs/KB_AUDIT_REPORT.md: - KB_SQLITE_PATH: missing (<missing>)
- docs/KB_AUDIT_REPORT.md: - Place KB SQLite v3 file and set KB_SQLITE_PATH
- docs/KB_STEP3_READINESS.md: - Place KB SQLite v3 file and set KB_SQLITE_PATH
- docs/KB_V3.md: - Default path (container): `/data/kb.sqlite`
- docs/KB_V3.md: - Host path configured via `KB_SQLITE_PATH_HOST` in docker-compose.
- docs/KB_V3.md: - App config uses `KB_SQLITE_PATH`.
- docs/KB_V3.md: - **Missing KB file** → configure `KB_SQLITE_PATH_HOST` and mount file.
- infra/docker/docker-compose.yml: KB_SQLITE_PATH: ${KB_SQLITE_PATH:-/data/kb.sqlite}
- infra/docker/docker-compose.yml: - ${KB_SQLITE_PATH_HOST:-../../data/kb.sqlite}:/data/kb.sqlite
- scripts/backup.sh: KB_SQLITE_PATH=${KB_SQLITE_PATH:-/data/kb.sqlite}
- scripts/backup.sh: if [ -f "$KB_SQLITE_PATH" ]; then
- scripts/backup.sh: cp "$KB_SQLITE_PATH" "${TMP_DIR}/kb.sqlite"
- scripts/doctor.sh: KB_SQLITE_PATH=${KB_SQLITE_PATH:-/data/kb.sqlite}
- scripts/doctor.sh: if [ -f "$KB_SQLITE_PATH" ]; then
- scripts/doctor.sh: echo -e "${GREEN}✓ OK${NC} (${KB_SQLITE_PATH})"
- scripts/doctor.sh: echo "  SQLite KB file not found at ${KB_SQLITE_PATH}"
- scripts/doctor.sh: if [ -f "$KB_SQLITE_PATH" ]; then
- scripts/doctor.sh: TABLE_CHECK=$(sqlite3 "$KB_SQLITE_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('transactions','tx_fts','tx_links','law_sources','law_articles','law_fts','tx_law_map');" 2>/dev/null || echo 0)
- scripts/doctor.sh: FTS_TX=$(sqlite3 "$KB_SQLITE_PATH" "SELECT rowid FROM tx_fts WHERE tx_fts MATCH 'test' LIMIT 1;" 2>/dev/null)
- scripts/doctor.sh: FTS_LAW=$(sqlite3 "$KB_SQLITE_PATH" "SELECT rowid FROM law_fts WHERE law_fts MATCH 'test' LIMIT 1;" 2>/dev/null)
- scripts/kb_audit.sh: python scripts/kb_sqlite_inspect.py --kb-path "${KB_SQLITE_PATH:-./data/kb.sqlite}" --out "$SQLITE_JSON" || true
- scripts/restore.sh: KB_SQLITE_PATH=${KB_SQLITE_PATH:-/data/kb.sqlite}
- scripts/restore.sh: if [ -f "${TMP_DIR}/kb.sqlite" ]; then
- scripts/restore.sh: mkdir -p "$(dirname "$KB_SQLITE_PATH")"
- scripts/restore.sh: cp "${TMP_DIR}/kb.sqlite" "$KB_SQLITE_PATH"
- apps/api/config.py: kb_sqlite_path: str = "/data/kb.sqlite"
- apps/api/routers/admin.py: KB_PATH_ERROR = "KB_SQLITE_PATH not configured"
- apps/api/routers/admin.py: if not settings.kb_sqlite_path:
- apps/api/routers/admin.py: items = list_mapping(settings.kb_sqlite_path, tx_no=tx_no, article_no=article_no, limit=limit)
- apps/api/routers/admin.py: if not settings.kb_sqlite_path:
- apps/api/routers/admin.py: upsert_mapping(settings.kb_sqlite_path, tx_no=tx_no, article_no=article_no, relevance=relevance, rationale=rationale)
- apps/api/routers/admin.py: if not settings.kb_sqlite_path:
- apps/api/routers/admin.py: upsert_mapping(settings.kb_sqlite_path, tx_no=tx_no, article_no=article_no, relevance=relevance, rationale=rationale)
- apps/api/routers/admin.py: if not settings.kb_sqlite_path:
- apps/api/routers/admin.py: items = list_mapping(settings.kb_sqlite_path, limit=100000)
- apps/api/routers/admin.py: if not settings.kb_sqlite_path:
- apps/api/routers/admin.py: items = list_review_queue(settings.kb_sqlite_path, status=status, limit=limit, q=q)
- apps/api/routers/admin.py: if not settings.kb_sqlite_path:
- apps/api/routers/admin.py: data = get_review_detail(settings.kb_sqlite_path, tx_no=tx_no)
- ... 59 more

## Build Duplication Checks
- apps/api directories: 2
  - apps/api
  - public-salaries-app/apps/api
- nested watanbot roots: 0

## Likely Causes
- wrong entrypoint
- wrong folder

## Fix Steps
- Run uvicorn against apps/api/main.py:app (ex: uvicorn main:app from apps/api).
- Ensure you run from the intended workspace root and remove duplicate app folders.

## Startup Guidance

### Correct Entrypoint & Working Directory
The primary API entrypoint is **apps/api/main.py:app**.

**Option 1: From workspace root (recommended)**
```powershell
cd C:\xampp\htdocs\projectx\watanbot
C:/xampp/htdocs/projectx/watanbot/.venv/Scripts/python.exe -m uvicorn apps.api.main:app --host 0.0.0.0 --port 8010
```

**Option 2: From apps/api directory**
```powershell
cd C:\xampp\htdocs\projectx\watanbot\apps\api
C:/xampp/htdocs/projectx/watanbot/.venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8010
```

**Option 3: Docker Compose (production)**
```powershell
docker compose -f infra/docker/docker-compose.yml up -d
```

### Root Selection & Duplicate Folders
- **Primary workspace root**: `C:\xampp\htdocs\projectx\watanbot`
- **KB SQLite file**: `C:\xampp\htdocs\projectx\watanbot\data\kb.sqlite`
- **Duplicate apps/api folder detected**: `public-salaries-app/apps/api` is a separate unrelated project. Do not run uvicorn from this folder for WatanBot.

### Environment Configuration
- **.env file**: present at workspace root
- **KB_SQLITE_PATH**: `./data/kb.sqlite` (resolved to `C:\xampp\htdocs\projectx\watanbot\data\kb.sqlite`, exists: yes)
- **POSTGRES_HOST**: `localhost` (for local development; use `postgres` for Docker)
- All required Postgres keys are present in .env

### Endpoint Summary
All expected v3 endpoints are **present** and **mounted**:
- `POST /api/chat` ✓ (legacy alias for /chat/ask)
- `POST /chat/ask` ✓
- `GET /whatsapp/webhook` ✓
- `POST /whatsapp/webhook` ✓
- `GET /api/procedures/search` ✓
- `GET /api/procedures/{tx_no}` ✓
- `GET /api/law/search` ✓
- `GET /api/law/{article_no}` ✓

### Why "v3 upgrades not showing" (Root Cause)
If the running build does not reflect v3 upgrades, the most likely causes are:
1. **Wrong entrypoint**: Running `public-salaries-app/apps/api/app/main.py` instead of `apps/api/main.py`.
2. **Stale server**: The API process is still running with old code. Restart it.
3. **Wrong working directory**: Running uvicorn from `public-salaries-app/apps/api` instead of the workspace root or `apps/api`.

**Verification Steps**:
1. Stop all running API processes (check Task Manager or `Get-Process python`).
2. Ensure `.env` points to the correct KB file (`KB_SQLITE_PATH=./data/kb.sqlite`).
3. Launch from workspace root using the commands above.
4. Test `/api/chat` or `/chat/ask` and confirm v3 SQLite KB is queried.

