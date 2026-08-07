# INFRA_AND_DEPLOYMENT_AUDIT.md
## Phase 7 of 8 — P0 Audit Cycle

**Date:** 2026-05-12  
**Status:** COMPLETE — gaps identified, no code changes required at this stage

---

## 1. Service Map

| Service | Runtime | Port | Start Command | Status |
|---------|---------|------|---------------|--------|
| Gateway API | Node.js / Fastify | 4000 | `node --env-file=.env --import tsx src/server.ts` | ✅ Running |
| Web User SPA | Vite dev / Nginx (prod) | 5174 (dev) | `pnpm dev` / build + serve | ✅ Running (dev) |
| Web Admin SPA | Vite dev / Nginx (prod) | 5175 (dev) | `pnpm dev` | ✅ Running (dev) |
| Python Backend | FastAPI / uvicorn | 8012 | `python -m uvicorn apps.api.main:app --port 8012` | ⚠️ Optional |
| PostgreSQL | PostgreSQL | 5433 | OS service | ⚠️ Used for user accounts |
| Ollama (AI) | Ollama daemon | 11434 | `ollama serve` | 🔲 Production only |

---

## 2. Startup Sequence

The gateway `bootstrapKb()` → `createCircuitBreakers()` → `bootstrapServices()` → `createChatService()` → register routes → listen.

**Critical ordering:**
1. `.env` must be loaded before any service reads env vars (`--env-file=.env` flag)
2. `KB_SQLITE_PATH` must be resolvable before gateway starts (`bootstrapKb()` will throw if missing)
3. PostgreSQL must be reachable if `RUN_PG_MIGRATIONS=true` (causes startup failure otherwise)
4. Python backend is optional — circuit breaker handles its absence gracefully
5. AI provider (Ollama/OpenAI) is optional — deterministic fallback kicks in via circuit breaker

**Risk:** `RUN_PG_MIGRATIONS=true` in `.env.example` but `false` in local `.env`. If production `.env` has it `true` and PostgreSQL is down, the gateway will crash on startup. The `bootstrapHelpers.ts` guard (`shouldRunMigrations()`) handles this correctly — but only if PG is actually unreachable; a slow PG can still cause a timeout cascade.

---

## 3. Environment Variables

### Required (gateway will not start without these)

| Variable | Dev default | Production value | Notes |
|----------|------------|-----------------|-------|
| `PORT` | 4000 | 4000 | Fastify listen port |
| `KB_SQLITE_PATH` | `../../watany_kb_tables_v4/Watany_KB_v4.sqlite` | `./data/kb.sqlite` | Must exist at startup |
| `JWT_SECRET` | `watany-dev-secret-68081` | **MUST ROTATE** | Dev secret is committed — P0 security gap |

### Required for AI mode

| Variable | Dev default | Production value |
|----------|------------|-----------------|
| `USE_AI_PROVIDER` | false | true |
| `AI_PROVIDER` | — | `ollama` or `openai` |
| `AI_BASE_URL` | — | `http://localhost:11434/v1` |
| `AI_API_KEY` | — | `ollama` or real OpenAI key |
| `AI_MODEL` | — | `deepseek-r1:8b` or `gpt-4o-mini` |
| `AI_RAG_CHUNKS_PATH` | derived from KB_SQLITE_PATH | `./data/kb/runtime_kb.json` |

### Optional but operationally important

| Variable | Purpose | Default |
|----------|---------|---------|
| `USE_PYTHON_API` | Enable Python KB backend | true |
| `PYTHON_API_URL` | Python backend URL | http://localhost:8012 |
| `RUN_PG_MIGRATIONS` | Auto-migrate PostgreSQL on startup | false (local) / true (prod) |
| `DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME` | PostgreSQL connection | localhost/5433/postgres/postgres/watany |
| `AI_TIMEOUT_MS` | Hard AI call timeout | 45000 |
| `KB_CB_THRESHOLD` | KB circuit breaker failure threshold | 5 |
| `AI_CB_THRESHOLD` | AI circuit breaker failure threshold | 3 |
| `NODE_ENV` | Controls CORS, logging, error detail | development |
| `VOICERSS_API_KEY` | TTS API key | empty (Google TTS fallback) |

### Security gaps in env vars

| Issue | Severity |
|-------|---------|
| `JWT_SECRET=watany-dev-secret-68081` is committed in `.env` | **P0** — must be rotated before any public deployment |
| `AI_API_KEY` has no validation at startup — gateway starts without error even if key is wrong | P1 |
| No secrets manager — all secrets are plaintext in `.env` files | P2 |

---

## 4. Build Pipeline

### Gateway API

```bash
# Development (tsx watch, hot reload)
pnpm --dir apps/gateway-api dev

# Production (no build step — tsx interprets TypeScript at runtime)
node --env-file=.env --import tsx src/server.ts

# Type check only
pnpm --dir apps/gateway-api exec tsc --noEmit
```

**Gap:** There is no compiled production build (`dist/`). The `dist/` folder exists but is not populated by any build script. Production runs TypeScript via `tsx` — this works but adds ~200ms cold start and means type errors are not caught until runtime.

**Recommendation (P1):** Add `tsc --build` to the release process so a compiled `dist/` exists and production runs `node dist/server.js` without tsx overhead.

### Web User SPA

```bash
pnpm --dir apps/web-user dev        # Vite dev server (port 5174)
pnpm --dir apps/web-user build      # Vite production build → dist/
pnpm --dir apps/web-user preview    # Preview production build
pnpm --dir apps/web-user exec tsc --noEmit  # Type check
```

**Status:** Production build has not been smoke-tested in this audit cycle. The `dist/` output is assumed correct based on clean `tsc --noEmit`. **P0 gap: production build must be verified before RC.**

### Web Admin SPA

Same as web-user, port 5175. Not audited in detail — assumed to mirror web-user build process.

---

## 5. PM2 Configuration

File: `apps/gateway-api/ecosystem.config.cjs`

```
app name:       watany-gateway
script:         ./start.sh
exec_mode:      fork (single instance)
max_restarts:   10 (restart_delay: 4s, min_uptime: 10s)
max_memory:     512 MB — restart if exceeded
log files:      ./logs/output.log, ./logs/error.log
autorestart:    true
```

`start.sh` loads `.env` line by line then runs `node --env-file=.env --import tsx src/server.ts`.

Verified live path on 2026-06-15: `/opt/watany/current/apps/gateway-api`

**Gaps:**

| Gap | Severity |
|-----|---------|
| `exec_mode: fork` — no cluster mode | P2: single-threaded; acceptable for current load |
| `max_memory_restart: 512M` — may OOM on Ollama inference if model is loaded in process | P1: verify with actual model load |
| `watch: false` — correct for production | ✅ |
| No PM2 startup script (`pm2 startup`) documented | P1: process does not survive server reboot |
| PM2 `save` command not run post-deploy | P1: PM2 process list not persisted |

---

## 6. Health Checks

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `GET /health` | GET | None | Gateway alive (returns `{ status: "ok" }`) |
| `GET /ready` | GET | None | Gateway ready (dependencies checked) |
| `GET /metrics` | GET | admin | Runtime metrics |
| `POST /api/admin/python/probe` | POST | None | Python backend reachability probe |

**Confirmed working:** `GET /health` returned HTTP 200 in this session.

**Gap:** `/ready` is defined but its dependency checks were not inspected in this audit. Confirm it checks PostgreSQL and KB file availability — not just process liveness.

**Gap:** `/api/admin/python/probe` has no `requireRole` — any caller can probe the Python backend. Low risk (read-only) but should be guarded (P2).

---

## 7. Nginx / Reverse Proxy

No Nginx configuration is present in this repository. The production deployment references `koudama.com` in `.env.production.example` comments but no Nginx config files exist in the workspace.

**Required before production:**

```nginx
# Example minimum config
server {
    listen 443 ssl;
    server_name koudama.com;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 90s;  # Must exceed AI_TIMEOUT_MS (45s)
    }

    location / {
        root /var/www/watanybot/web-user/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

**Gaps:**

| Gap | Severity |
|-----|---------|
| No Nginx config in repo | P0: cannot deploy without this |
| No SSL certificate configuration documented | P0 |
| No `proxy_read_timeout` tuned for 45s AI timeout | P1 |
| No rate limiting at Nginx layer | P1 |
| No gzip/brotli compression for static assets | P2 |

---

## 8. Deployment Process (Current)

There is no single authoritative deployment script. Multiple scripts exist (`deploy.sh`, `DEPLOY.ps1`, `deploy_remote.sh`, `deploy-to-mcp.ps1`) with varying levels of completeness. The effective deployment steps based on artifacts are:

1. `rsync` source to server (via `deploy_remote.sh` or PowerShell rsync wrapper)
2. `ssh` to server
3. `pnpm install --frozen-lockfile`
4. Copy production `.env`
5. `pm2 start ecosystem.config.cjs --env production`
6. `pm2 save`

**What is missing from every documented script:**

| Missing step | Severity |
|-------------|---------|
| TypeScript type check before deploy (`pnpm -r typecheck`) | P0 |
| Run test suite before deploy (`pnpm --dir apps/gateway-api test --run`) | P0 |
| Web SPA production build (`pnpm --dir apps/web-user build`) | P0 |
| Smoke test against production after deploy | P1 |
| Rollback command documented | P1 |
| Zero-downtime restart (PM2 reload vs restart) | P2 |

---

## 9. Staging vs Production Parity

| Aspect | Dev/Local | Production | Parity |
|--------|-----------|-----------|--------|
| AI provider | none / OpenAI | Ollama + DeepSeek | ❌ Different model |
| Port | 4000 | 4000 | ✅ |
| PostgreSQL | localhost:5433 | server:5433 | ✅ Same schema |
| KB SQLite path | relative (../../) | ./data/kb.sqlite | ❌ Different path |
| NODE_ENV | development | production | ✅ Env var correct |
| JWT_SECRET | dev secret (committed) | should be rotated | ❌ Not rotated |
| CORS origin | localhost:5174 (post-fix) | koudama.com | ⚠️ CORS must be updated for prod domain |
| Python backend | optional | running | ⚠️ Dev can run without it |

---

## 10. Known Infrastructure Gaps Summary

| Gap | Priority | Action |
|-----|---------|--------|
| JWT_SECRET committed as dev value — must rotate before any public URL | P0 | Generate new secret, set in server `.env` |
| No Nginx config in repo | P0 | Create `nginx/watanybot.conf` |
| Production build not smoke-tested | P0 | `pnpm --dir apps/web-user build` + verify |
| PM2 startup persistence not documented | P1 | Run `pm2 startup` + `pm2 save` post-deploy |
| No compiled gateway build (tsx at runtime) | P1 | Add `tsc --build` to deploy process |
| CORS origin must be updated for prod domain | P1 | Update `CORS_ALLOWED_ORIGINS` in prod `.env` |
| Nginx proxy_read_timeout must exceed AI timeout | P1 | Set `proxy_read_timeout 90s` |
| Unified deploy script does not run tests or typecheck | P0 | Add to deploy gate |
| `/ready` endpoint dependency checks not verified | P1 | Read `diagnostics.ts` ready handler |
