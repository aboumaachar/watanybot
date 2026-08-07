# ADR-002 — Node / Python Route Ownership Matrix

**Date:** 2026-05-10  
**Status:** Accepted (amended 2026-05-10 — salary routes reclassified)  
**Deciders:** Engineering (WatanyBot)  
**Related:** ADR-001 (thin bootstrap), gateway-route-inventory.md

---

## Context

The WatanyBot backend has two running processes:

| Process | Runtime | Port | Entrypoint |
|---------|---------|------|------------|
| **gateway-api** | Node 20 / Fastify | 3000 | `apps/gateway-api/src/server.ts` |
| **api-backend** | Python 3.13 / FastAPI | 8012 | `apps/api-backend/apps/api/main.py` |

Both processes currently serve **overlapping concerns**:

- Chat answering exists in both (`POST /chat/ask` in Python, `POST /api/chat` in Node)
- KB search exists in both (`GET /kb/search` in Python, `GET /api/kb-nodes/search` in Node)
- Salary computation exists in both (`POST /api/v2/salary/compute` in Python, `POST /api/salary/calc` in Node) — **NOTE: these are different domain models (see amendment below)**
- The Node gateway proxies many requests to Python via `kb-v2-proxy.ts`

Without a clear ownership rule, both sides evolve independently and diverge, causing:
- Double maintenance burden
- Inconsistent response shapes
- Unclear routing logic for the frontend

---

## Decision

We adopt the following ownership rules:

### Rule 1 — Python owns KB search, chat pipeline, and generic pension computation

Python (`api-backend`) owns all **stateful Arabic NLP** work:
- SQLite v3 KB search (procedures + law articles)
- KB v2 RAG pipeline (intent → search → rerank → answer)
- Generic pension/severance computation (`salary_parser.py`) — fields: `gross_pension`, `after_tax`, `net_pension`
- Feedback capture tied to chat sessions
- WhatsApp channel integration

**Rationale:** Python has the KB SQLite files, the reranker, the intent classifier, and the Arabic NLP tooling. Duplicating this in Node produces two out-of-sync answer engines.

### Rule 2 — Node owns the user-facing API surface, auth, and admin UI backend

Node (`gateway-api`) owns:
- All JWT authentication and session middleware
- Admin panel backend routes (`/api/admin/*`)
- User profile, history, chat sessions, saved chats, notifications
- Plugin DB (SQLite via `plugin-db`)
- WebSocket connections (admin, features, media)
- MCP protocol handling
- Voice E2E service orchestration
- Static KB attachment serving

**Rationale:** These are pure CRUD/orchestration concerns with no Arabic NLP dependency. Node's async I/O and Fastify plugin system are well-suited.

### Rule 3 — Node gateway proxies to Python for NLP; never reimplements NLP

The Node gateway is the **single entry point** for the web frontend. Routes that require Python NLP are proxied via `kb-v2-proxy.ts`. The proxy layer is intentionally thin (no business logic).

**Rationale:** Keeps the frontend oblivious to the internal split. Allows Python to evolve its NLP independently.

### Rule 4 — Duplicate implementations must be retired on a schedule

Several Node routes currently duplicate Python functionality. They must be retired in the order below.

---

## Ownership Matrix

### Python-owned (authoritative, must not be reimplemented in Node)

| Route | Python file | Node status |
|-------|-------------|-------------|
| `POST /chat/ask` | `routers/public.py` | Proxied via `kb-v2-proxy.ts → POST /api/v2/chat` |
| `GET  /kb/search` | `routers/public.py` | **Duplicate** in `kb-vnext.ts` — retire Node version (Phase 3) |
| `POST /api/v2/chat` | `routers/kb_v2.py` | Proxied correctly ✅ |
| `GET  /api/v2/search` | `routers/kb_v2.py` | Proxied correctly ✅ |
| `POST /api/v2/intent` | `routers/kb_v2.py` | Proxied correctly ✅ |
| `POST /api/v2/salary/compute` | `routers/kb_v2.py` | Proxied correctly ✅ |
| `POST /api/v2/tickets` | `routers/kb_v2.py` | Proxied correctly ✅ |
| `GET  /api/v2/tickets` | `routers/kb_v2.py` | Proxied correctly ✅ |
| `GET  /api/v2/diagnostics` | `routers/kb_v2.py` | Proxied correctly ✅ |
| `POST /api/v2/feedback` | `routers/kb_v2.py` | Proxied correctly ✅ |

### Node-owned (authoritative, Python has no equivalent)

| Route family | Node file | Notes |
|---|---|---|
| Auth (login/logout/refresh) | `auth/auth-routes.ts` | JWT, cookies |
| Profile | `routes/profile.ts` | pluginDb |
| History | `routes/history.ts` | pluginDb |
| Chat sessions | `routes/chat-sessions.ts` | pluginDb |
| Saved chats | `routes/saved-chats.ts` | pluginDb |
| Notifications | `routes/notifications.ts` | pluginDb |
| Plugins | `routes/plugins.ts` | pluginDb |
| Admin: KB | `routes/admin-kb.ts` | Node-side KB JSON editor |
| Admin: KB Studio | `routes/admin-kb-studio.ts` | Source scan + ingest |
| Admin: AI | `routes/admin-ai.ts` | Training data CRUD |
| Admin: AI Runtime | `routes/admin-ai-runtime.ts` | Live AI config swap |
| Admin: Users | `routes/admin-users.ts` | Role/status management |
| Admin: Rules | `routes/admin-rules.ts` | Rule CRUD |
| Admin: Dashboard | `routes/admin-dashboard.ts` | Analytics, experiments |
| Admin: Features | `routes/admin-features.ts` | Feature flags |
| Admin: Ticker | `routes/admin-ticker.ts` | Announcements |
| Admin: Payments | `admin-payments/index.ts` | Payments CRUD |
| Admin: Overview | `routes/admin-overview.ts` | Aggregate stats |
| Admin: Web-User Settings | `routes/admin-web-user-settings.ts` | UI config |
| MCP | `routes/mcp.ts` | MCP protocol |
| Voice E2E | `lib/voice-e2e.ts` | TTS orchestration |
| Voice Advanced | `integrations/voice-advanced.ts` | WebRTC/WS voice |
| WebSocket (admin/features/media) | `ws/*.ts` | Real-time push |
| KB Attachments | `routes/kb-attachments.ts` | Static file serve |
| Diagnostics / Health | `routes/diagnostics.ts` | Gateway health |
| Elite | `routes/elite.ts` | Elite tier features |
| Cases | `routes/cases.ts` | Legal cases CRUD |
| Documents | `routes/documents.ts` | Document CRUD |
| Groups | `routes/groups.ts` | Group CRUD |
| Jobs | `jobs/index.ts` | Background jobs |
| Disaster | `disaster/index.ts` | Disaster response |
| Procedures | `procedures/index.ts` | Procedure KB viewer |
| Forms | `routes/forms-inline.ts` | Forms catalog |
| FAQ | `routes/faq.ts` | FAQ listing |
| Ticker | `routes/ticker.ts` | Public ticker |
| TX | `routes/tx.ts` | TX mock (retire after real impl) |
| Salary (Lebanon-specific) | `routes/salary-inline.ts` | **Node-permanent** — Lebanon 2026 pension calculator; unique schema not replicated in Python (see amendment) |
| Files | `routes/files.ts` | File listing |
| Unified Search | `routes/unified-search.ts` | Cross-resource search |

---

## Migration Plan for Duplicate Routes

### Phase 3 — Retire Node duplicate NLP routes

Priority order (lowest risk first):

| Step | Action | Risk |
|------|--------|------|
| 3a | Remove `GET /api/kb-nodes/search` from `kb-vnext.ts`; redirect to `/api/v2/search` proxy | Medium |
| 3b | Add `Deprecation` response header to remaining `kb-vnext.ts` routes | Low |
| 3c | Audit `GET /api/v2/kb/gaps`, `/improvements`, `/analytics/summary`, `/system/info` in `advanced.ts` — stub or proxy | Low |
| 3d | ~~Remove `GET /api/salary/meta` from `salary-inline.ts`~~ — **CANCELLED** (see amendment) | — |
| 3e | ~~Remove `POST /api/salary/calc` from `salary-inline.ts`~~ — **CANCELLED** (see amendment) | — |

---

## Amendment — 2026-05-10: Salary Routes Are Node-Permanent

**Finding:** After schema comparison, the Node salary routes (`/api/salary`, `/api/salary/meta`, `/api/salary/calc`) are **not duplicates** of Python's `POST /api/v2/salary/compute`.

| Dimension | Node (`salary-inline.ts`) | Python (`schemas_kb_v2.py`) |
|-----------|--------------------------|------------------------------|
| Domain | Lebanon 2026 military pension calculator | Generic pension/severance engine |
| Key fields | `pension2026`, `raise.pensionAfterSixRaise`, `fiftyPctRaise.*`, `aids.*`, `ok` flag | `gross_pension`, `after_tax`, `net_pension`, `severance_factor` |
| Data source | Local KB `salariesIndex` (JSON, Lebanon-specific) | Python `salary_parser.py` (rule engine) |
| Unique to Node | `sixSalary`, `val2019`, `fiftyPctTargetUsd`, `additionalRaise` | — |
| Unique to Python | — | `service_factor`, `pension_rate`, `total_severance` |

**Decision:** Node salary routes remain permanently in Node. Python's salary endpoint proxied via `/api/v2/salary/compute` serves a separate purpose (chat-embedded computation). Steps 3d/3e from the migration plan are cancelled.

### Phase 4 — Consolidate chat paths

| Step | Action |
|------|--------|
| 4a | Ensure `POST /api/chat` (Node) always delegates to `chatService.fetchChatResponse` which calls Python |
| 4b | Add integration test asserting Node chat route returns Python-originated answer |
| 4c | Remove any remaining Node-side LLM call paths that bypass Python |

---

## Consequences

**Positive:**
- Clear ownership eliminates "which side handles X?" ambiguity
- Python NLP can evolve (model swap, reranker tuning) without Node changes
- Node admin/CRUD layer can evolve without touching NLP
- Proxy pattern keeps frontend routing simple

**Negative:**
- Proxy adds one HTTP hop for chat/search (acceptable; internal loopback)
- Retiring duplicate salary routes requires frontend URL verification
- Phase 3 retirements carry regression risk — integration tests needed first (Phase 3 prerequisite)

**Risks / Mitigations:**
- `salary-inline.ts` may be called by the frontend directly → verify frontend API calls before retiring
- `kb-vnext.ts` FTS5 search is Node-native SQLite; Python equivalent uses different SQLite schema → ensure response shape compatibility before cutover
