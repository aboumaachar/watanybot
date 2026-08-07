# Gateway Decomposition Map

> Date: 2026-05-12  
> Status: Phase 1 COMPLETE — Phase 2 COMPLETE — Phase 3 PLANNING  
> Source: `apps/gateway-api/src/server.ts`  
> Phase 3 spec: `docs/HYBRID_ARCHITECTURE_PHASE_3.md`

---

## Target Directory Structure

```
apps/gateway-api/src/
  bootstrap/              ← Phase 1 COMPLETE
    helpers.ts            ✅ loadJson, loadLocalSalariesKB, loadRuntimeKbJson, shouldRunPgMigrations
    security.ts           ✅ registerSecurityHeaders (onSend hook)
    ai-state.ts           ✅ mutable AI singletons, getters/setters, initAiState()
    plugins.ts            ✅ cookie, cors, compress, rate-limit, websocket, debugPlugin
    kb-bootstrap.ts       ✅ salaries KB, SQLite store, vNext FTS5, RAG chunks, pluginDb
    circuit-breakers.ts   ✅ kb / python-api / ai-provider circuit breakers
    services.ts           ✅ versioning, intents, voice-e2e, chat service
    error-handler.ts      ✅ registerErrorHandler()
    routes.ts             ✅ all ~50 app.register() calls
  routes/
    public/               ← PLANNED (Phase 3 grouping)
    user/                 ← PLANNED (Phase 3 grouping)
    admin/                ← PLANNED (Phase 3 grouping)
    diagnostics/          ← PLANNED (Phase 3 grouping)
    kb-attachments.ts     ✅ GET /kb/attachments/*
    admin-python-probe.ts ✅ POST /api/admin/python/probe
    kb-vnext.ts           ✅ already extracted
    kb-v2-proxy.ts        ✅ already extracted
    salary-inline.ts      ✅ already extracted
    ... (all other routes already extracted)
  services/               ← PLANNED Phase 3
  ws/                     ✅ already separated
  auth/                   ✅ already separated
  lib/                    ✅ existing
  db/                     ✅ existing
  ai/                     ✅ existing
  kb/                     ✅ existing
```

---

## server.ts Line Count Progress

| Date | Lines | Change | Notes |
|------|-------|--------|-------|
| 2026-03-08 (baseline) | 4,726 | — | Original monolith |
| 2026-05-10 (pre-session) | 642 | −4,084 | Previously extracted routes |
| 2026-05-10 (session 1) | 540 | −102 | bootstrap/ extraction, 2 inline routes |
| 2026-05-10 (session 2) | **93** | **−447** | All bootstrap modules extracted ✅ |
| **Target** | **<250** | | ✅ ACHIEVED (93 lines) |
| **Stretch** | **<100** | | ✅ ACHIEVED |

---

## Phase 2 — Node/Python Ownership (COMPLETE 2026-05-10)

See `docs/architecture/ADR-002-node-python-ownership.md` for the full matrix.

Key findings:
- **12 Node routes duplicate Python NLP** — must be retired in Phase 3
- **~35 route families are Node-only** (CRUD, auth, admin, WS) — no Python equivalent
- Node gateway is the single external entry point; Python is an internal service

---

## Phase 3 — Retire Duplicate Routes (NEXT)

| Step | Action | Prerequisite |
|------|--------|--------------|
| 3a | Delete `routes/forms.ts` (dead code) | None |
| 3b | Verify frontend does not call `GET /api/salary` directly | Frontend audit |
| 3c | Retire `salary-inline.ts` salary routes; proxy to Python | Frontend audit |
| 3d | Retire `kb-vnext.ts` search; redirect to `/api/v2/search` | Schema compat check |
| 3e | Delete `routes/salary.ts` (pre-existing duplicate) | None |
| 3f | Audit `advanced.ts` stubs vs real Python endpoints | Compare responses |
| 3g | Add integration tests for proxied routes | Before any retirement |

---

## Decomposition Rules (frozen)

1. No new business logic in `server.ts` — only bootstrap wiring.
2. Every extracted module exports a named function; no default exports for bootstrap modules.
3. Route registration order must be preserved (auth hook before route modules).
4. Typecheck must pass after every extraction commit.
5. (Phase 2+) Node must not reimplement Python NLP — proxy only.
