# TEST_COVERAGE_MATRIX.md
## Phase 6 of 8 — P0 Audit Cycle

**Date:** 2026-05-12  
**Status:** COMPLETE — release-gate map established

---

## Coverage Legend

| Label | Meaning |
|-------|---------|
| `AUTOMATED` | Vitest test file exists and runs in CI |
| `SMOKE TESTED` | Script-driven gateway smoke suite exists |
| `BROWSER SMOKE` | Browser-level manual or Playwright smoke confirmed |
| `MANUAL ONLY` | Tested only by hand during development |
| `PARTIAL` | Some paths covered, critical paths missing |
| `NOT TESTED` | No automated or documented test coverage |
| `NOT BUILT` | Feature scaffolded but implementation is stub/mock |
| `UNKNOWN` | No audit evidence — assume not tested |

---

## 1. Authentication & Authorization

| Module / Endpoint | File | Status | Notes |
|---|---|---|---|
| Login (POST /api/auth/login) | `auth-password.test.ts` | `AUTOMATED` | Password hash, lockout, bad-credential checks |
| JWT verification middleware | `auth-rbac.test.ts` | `AUTOMATED` | Token presence, expiry, role parsing |
| RBAC role enforcement | `auth-rbac.test.ts`, `admin-auth-hardening.test.ts` | `AUTOMATED` | public/accredited/moderator/admin/superadmin |
| Admin route hardening | `admin-auth-hardening.test.ts` | `AUTOMATED` | Verifies unauthenticated requests are rejected |
| Email + password validation at register | — | `NOT TESTED` | Schema exists, no test for min 8-char / regex |
| CORS allowlist | — | `NOT TESTED` | Changed from `origin: true` in AUTH audit — no regression |
| Rate limiting on /api/auth/login | — | `NOT TESTED` | No limiter currently implemented |

---

## 2. Chat & AI

| Module / Endpoint | File | Status | Notes |
|---|---|---|---|
| Chat RAG retrieval + relevance | `chat-relevance-regression.test.ts` | `AUTOMATED` | Family pension, death benefits, financial queries |
| Hybrid route engine (intent routing) | `hybrid-route-engine.test.ts` | `AUTOMATED` | Deterministic vs AI branch selection |
| RAG chunk loading + scoring | `rag-chunks.test.ts` | `AUTOMATED` | Chunk parse, score functions |
| Veteran-first category boosting in scoreChunk | — | `NOT TESTED` | Fix applied in Phase 5, no test added |
| AI provider circuit breaker integration | — | `NOT TESTED` | Fix applied in Phase 4, no test added |
| kbPrefetchCache eviction (500-entry cap) | — | `NOT TESTED` | Fix applied in Phase 4, no regression |
| AI fallback to deterministic when CB open | — | `PARTIAL` | chat-relevance tests cover deterministic path but not CB-triggered fallback |
| Voice chat transcribe + respond | `voice-chat.test.ts` | `AUTOMATED` | STT → reply pipeline |
| Content filter (harmful input blocking) | `content-filter.test.ts` | `AUTOMATED` | Keyword-based filter |
| Saved chats auth | `saved-chats-auth-regression.test.ts` | `AUTOMATED` | Auth regression on save/load |
| Chat history | `history-routes.test.ts` | `AUTOMATED` | Pagination, session isolation |
| Proxy routes (Python backend) | `proxy-routes.test.ts` | `AUTOMATED` | /api/v2/chat, /api/v2/search, intent proxy |
| AI fine-tune pipeline | — | `MANUAL ONLY` | Admin UI tested manually |
| OpenAI timeout (45s hard limit) | — | `NOT TESTED` | No timeout injection test |
| Stream retry on partial response | — | `NOT TESTED` | AI_STREAM_RETRY_COUNT not exercised |

---

## 3. Knowledge Base & Search

| Module / Endpoint | File | Status | Notes |
|---|---|---|---|
| Procedure search (FTS) | `procedures-search.test.ts` | `AUTOMATED` | Arabic keyword search, ranking |
| Procedure diagnostics regression | `procedure-diagnostics-regression.test.ts` | `AUTOMATED` | Regression suite for known broken queries |
| Procedure attachments | `procedures-attachments-regression.test.ts` | `AUTOMATED` | HTML proc file serving |
| KB vNext node search | `node-owned-routes.test.ts` | `AUTOMATED` | /api/kb-nodes/search |
| KB runtime reload | `runtime-kb.test.ts` | `AUTOMATED` | POST /api/admin/kb/runtime-reload |
| KB versions / rollback | `admin-kb-versions.test.ts` | `AUTOMATED` | Version list + rollback endpoint |
| Directory search | `directory-route.test.ts` | `AUTOMATED` | /api/v2/directory/search |
| FAQ route | `faq-route.test.ts` | `AUTOMATED` | /api/v2/faq |
| KB Studio (scan/ingest/export/rebuild) | — | `NOT TESTED` | Admin KB Studio routes unguarded and untested |
| KB gaps + improvements | — | `NOT TESTED` | /api/v2/kb/gaps, /api/v2/kb/improvements |
| Salary computation | `salary.test.ts`, `salary-shape-comparison.test.ts` | `AUTOMATED` | Rank-based pension calculation |

---

## 4. Admin Dashboard & Control Surface

| Module / Endpoint | File | Status | Notes |
|---|---|---|---|
| Admin AI training CRUD | `admin-ai-training.test.ts`, `admin-ai-training-approve.test.ts` | `AUTOMATED` | Training item lifecycle |
| Admin AI + Python probe | `admin-ai-python.test.ts` | `AUTOMATED` | Probe endpoint + AI config |
| Admin users (list/role/status) | — | `NOT TESTED` | Routes exist with requireRole("admin"), no test |
| Admin audit log | — | `NOT TESTED` | /api/admin/audit — no test |
| Admin dashboard (KPIs, sessions, analytics) | — | `NOT TESTED` | Routes unguarded (no requireRole), no test |
| Admin system status + cleanup | — | `NOT TESTED` | Routes unguarded, no test |
| Admin experiments (A/B) | — | `NOT TESTED` | Routes unguarded, no test |
| Admin KB health | — | `NOT TESTED` | /api/admin/kb/health unguarded, no test |
| Payment admin override | — | `NOT TESTED` | /api/admin/plugins or custom — needs investigation |
| Recruitment admin | — | `NOT TESTED` | Plugins-backed, no test |
| Admin rules CRUD | — | `PARTIAL` | requireRole("admin") present, no dedicated test |
| Admin ticker | — | `PARTIAL` | requireRole("admin") present, no dedicated test |
| Feature flags (superadmin) | — | `PARTIAL` | requireRole("superadmin") present, no test |
| Web user settings (superadmin) | — | `PARTIAL` | requireRole("superadmin") present, no test |

---

## 5. Documents

| Module / Endpoint | File | Status | Notes |
|---|---|---|---|
| Document list (GET /api/documents) | `auth-rbac.test.ts` | `PARTIAL` | RBAC checked, content not asserted |
| Document create (POST /api/documents) | — | `NOT TESTED` | Status/kind enum validation added, not tested |
| Document status update (PATCH) | — | `NOT TESTED` | requireRole("moderator") present, no test |
| Document preview (HTML render) | — | `BROWSER SMOKE` | Manually verified via browser open |
| Document download / share | — | `NOT TESTED` | Share link generation not exercised |

---

## 6. Cases

| Module / Endpoint | File | Status | Notes |
|---|---|---|---|
| Case list / create / update | — | `NOT TESTED` | requireRole("accredited") present, no test file |

---

## 7. Community & Groups

| Module / Endpoint | File | Status | Notes |
|---|---|---|---|
| Groups list | `community-routes.test.ts` | `AUTOMATED` | GET /api/groups |
| Group messages | `community-routes.test.ts` | `AUTOMATED` | Message send/receive |
| Community moderation (ban/kick) | — | `NOT TESTED` | Moderation features not tested |
| Recruitment room | — | `MANUAL ONLY` | Browser smoke only |
| Live sessions inside groups | — | `NOT BUILT` | Scaffolded, no backend |

---

## 8. User-Facing Pages (Browser Smoke)

| Page | Route | Status | Notes |
|---|---|---|---|
| Home / Chat | /chat | `BROWSER SMOKE` | Manual smoke confirmed working |
| Services | /services | `BROWSER SMOKE` | Manual smoke |
| Procedures | /procedures | `BROWSER SMOKE` | Manual smoke |
| Salary Calculator | /salary | `BROWSER SMOKE` | Manual smoke |
| Documents | /documents | `BROWSER SMOKE` | Manual smoke |
| Community / Groups | /groups | `BROWSER SMOKE` | Manual smoke |
| Search | /search | `MANUAL ONLY` | Not dedicated smoke |
| Notifications | /notifications | `MANUAL ONLY` | In-memory store, no test |
| Profile | /profile | `MANUAL ONLY` | GET /api/profile not tested |
| Settings | /settings | `MANUAL ONLY` | |
| Saved Chats | /saved | `MANUAL ONLY` | |
| Jobs / Marketplace / Alerts | /jobs, /marketplace, /alerts | `NOT TESTED` | Plugin-backed, stubs only |
| Admin Dashboard | /admin | `MANUAL ONLY` | Watany Admin app at :5175 |
| Login | /login | `BROWSER SMOKE` | Manual smoke |
| WhatsApp mode | wa-mode CSS class | `MANUAL ONLY` | |

---

## 9. Infrastructure / Health

| Surface | Status | Notes |
|---|---|---|
| GET /health | `MANUAL ONLY` | Confirmed returning 200 in this session |
| GET /ready | `NOT TESTED` | Endpoint exists (`diagnostics.ts` line 40), not exercised |
| GET /metrics | `NOT TESTED` | requireRole("admin") added in RBAC audit, no test |
| Python backend /health probe | `MANUAL ONLY` | Via admin python probe UI |
| PostgreSQL connectivity | `NOT TESTED` | No db connection test in CI |
| Circuit breaker open/close cycle | `NOT TESTED` | No fault injection test |

---

## 10. Voice & TTS

| Module | File | Status | Notes |
|---|---|---|---|
| Voice transcription (STT) | `voice-chat.test.ts` | `AUTOMATED` | |
| TTS synthesis (VoiceRSS / Google) | — | `NOT TESTED` | No TTS response test |
| OpenAI TTS | — | `NOT TESTED` | Optional premium path |

---

## 11. Summary Counts

| Status | Count |
|--------|-------|
| AUTOMATED | 32 |
| SMOKE TESTED / BROWSER SMOKE | 11 |
| PARTIAL | 8 |
| MANUAL ONLY | 12 |
| NOT TESTED | 28 |
| NOT BUILT | 2 |

**Total coverage surface:** ~93 items  
**Automated coverage rate:** ~34%  
**Critical untested gaps (P0 for RC):** admin RBAC on dashboard/analytics routes, AI circuit breaker, OpenAI timeout, document operations, payment admin, backup/restore.

---

## 12. P0 Test Gaps (Must Close Before RC)

| Gap | Risk |
|-----|------|
| Admin dashboard/analytics routes have no `requireRole` and no test | Any user can read session analytics |
| AI provider circuit breaker — no test that CB prevents infinite retry | Reliability regression risk |
| OpenAI 45s timeout — no timeout injection test | Latency spike undetected |
| Document create/update status validation — no test | Enum fix may regress silently |
| Veteran-first scoreChunk boosting — no regression test | Performance fix can regress |
| CORS allowlist — no test | Security regression undetectable |
| Saved chats auth regression — exists but isolated to save/load, not delete | Incomplete |
