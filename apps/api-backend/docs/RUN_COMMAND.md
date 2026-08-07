# WatanBot API - Correct Run Commands

## ⚠️ CRITICAL: Workspace Root Selection

**Primary workspace root**: `C:\xampp\htdocs\projectx\watanbot`

**DO NOT run from**: `C:\xampp\htdocs\projectx\watanbot\public-salaries-app\apps\api`
- This is a separate unrelated project with a different FastAPI app.
- Running from the wrong folder will cause v3 upgrades to not show.

---

## 🚀 Option 1: From `apps/api` Directory (Recommended for Development)

```powershell
cd C:\xampp\htdocs\projectx\watanbot\apps\api
C:/xampp/htdocs/projectx/watanbot/.venv/Scripts/python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

**Verify startup banner:**
```
======================================================================
🚀 WATANBOT API ENTRYPOINT: apps/api/main.py
======================================================================
📂 Working directory: C:\xampp\htdocs\projectx\watanbot\apps\api
📦 KB_SQLITE_PATH: C:\xampp\htdocs\projectx\watanbot\data\kb.sqlite
   ✅ exists
🔌 Mounted routers: Public, Admin, Superadmin, KBv3, WhatsApp
🌐 API listening on: 0.0.0.0:8010
======================================================================
```

---

## 🚀 Option 2: From Workspace Root

```powershell
cd C:\xampp\htdocs\projectx\watanbot
C:/xampp/htdocs/projectx/watanbot/.venv/Scripts/python.exe -m uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8010
```

---

## 🐳 Option 3: Docker Compose (Production)

```powershell
cd C:\xampp\htdocs\projectx\watanbot
docker compose -f infra/docker/docker-compose.yml up -d
```

**View logs:**
```powershell
docker compose -f infra/docker/docker-compose.yml logs -f api
```

---

## 🧪 Verify Endpoints

After starting the API, run the smoke test:

```powershell
cd C:\xampp\htdocs\projectx\watanbot
C:/xampp/htdocs/projectx/watanbot/.venv/Scripts/python.exe scripts/smoke_endpoints.py
```

Expected output:
```
🧪 Running endpoint smoke test...
======================================================================
✅ POST   /api/chat
✅ POST   /chat/ask
✅ GET    /whatsapp/webhook
✅ POST   /whatsapp/webhook
✅ GET    /api/procedures/search
✅ GET    /api/procedures/{tx_no}
✅ GET    /api/law/search
✅ GET    /api/law/{article_no}
======================================================================
📊 Results: 8/8 endpoints present

✅ PASS: All required endpoints present
```

---

## 🔍 Troubleshooting

### Issue: "v3 upgrades not showing"

**Root Causes**:
1. **Wrong entrypoint**: Running `public-salaries-app/apps/api/app/main.py` instead of `apps/api/main.py`
2. **Stale server**: Old process still running with cached code
3. **Wrong working directory**: Running from `public-salaries-app/apps/api`

**Fix**:
1. Stop all running Python processes:
   ```powershell
   Get-Process python | Stop-Process -Force
   ```
2. Verify `.env` has correct KB path:
   ```ini
   KB_SQLITE_PATH=./data/kb.sqlite
   ```
3. Start API using Option 1 command above
4. Check startup banner confirms:
   - Entrypoint: `apps/api/main.py` ✅
   - KB path exists ✅
   - All routers mounted ✅

### Issue: KB_SQLITE_PATH not found

**Dev fallback** (automatic):
- If `KB_SQLITE_PATH` points to a missing file
- AND `APP_ENV=dev`
- AND `./data/kb.sqlite` exists
- → The API will auto-fallback to `./data/kb.sqlite` and print a warning

**Production**: No fallback. Ensure the configured path exists.

---

## 📚 Additional Resources

- [Runtime Truth Report](RUNTIME_TRUTH_REPORT.md) - Full audit of entrypoints, routers, and endpoints
- [KB v3 Documentation](KB_V3.md) - SQLite KB configuration
- [Environment Variables](ENV.md) - All config options
