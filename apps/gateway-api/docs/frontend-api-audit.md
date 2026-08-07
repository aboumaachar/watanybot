# Frontend API Audit — web-user → gateway-api route usage

**Date:** 2026-05-10  
**Source:** `apps/web-user/src/api.ts`, `VoiceMode.tsx`, `procedures-api.ts`, `TickerPage.tsx`, `formsManager.ts`  
**Purpose:** Map every frontend API call to its current Node owner and migration status.

---

## Summary

| Status | Count |
|--------|-------|
| ✅ Node-owned, keep as-is | 22 |
| ⚠️ Node-owned, but duplicates Python NLP — retire after proxy verified | 4 |
| ✅ Already proxied to Python (Node is thin proxy) | 5 |
| 🔴 Dead / mock (retire) | 1 |

---

## Full Route Map

| Frontend call (api.ts line) | Current Node handler | Owner | Action |
|-----------------------------|---------------------|-------|--------|
| `POST /api/v2/chat` (L150) | `kb-v2-proxy.ts` | Python ✅ | Keep — proxy correct |
| `GET /api/v2/search` (L975) | `kb-v2-proxy.ts` | Python ✅ | Keep — proxy correct |
| `POST /api/v2/salary/compute` (L992) | `kb-v2-proxy.ts` | Python ✅ | Keep — proxy correct |
| `POST /api/v2/feedback` (L1012) | `kb-v2-proxy.ts` | Python ✅ | Keep — proxy correct |
| `POST /api/v2/tickets` (L1032) | `kb-v2-proxy.ts` | Python ✅ | Keep — proxy correct |
| `GET /api/v2/tickets` (L1042) | `kb-v2-proxy.ts` | Python ✅ | Keep — proxy correct |
| `GET /api/chat/stream` (L329) | `chat.ts` (Node SSE) | Node ✅ | Keep — Node SSE layer |
| `POST /api/chat` (L950) | `chat.ts` | Node → Python | Keep — delegates to chatService |
| `GET /api/salary` (L602) | `salary-inline.ts` | **DUPLICATE** ⚠️ | Phase 3: retire, proxy to Python |
| `GET /api/salary/meta` (L609) | `salary-inline.ts` | **DUPLICATE** ⚠️ | Phase 3: retire, proxy to Python |
| `POST /api/salary/calc` (L618) | `salary-inline.ts` | **DUPLICATE** ⚠️ | Phase 3: retire → use `/api/v2/salary/compute` |
| `GET /api/tx/search` (L588) | `tx.ts` (mock) | Node 🔴 mock | Phase 4: replace with real data or remove |
| `GET /api/tx/:tx_no` (L595) | `tx.ts` (mock) | Node 🔴 mock | Phase 4: replace with real data or remove |
| `GET /api/forms` (L1051) | `forms-inline.ts` | Node ✅ | Keep — Node forms catalog |
| `GET /api/forms/:id` (L1063) | `forms-inline.ts` | Node ✅ | Keep |
| `POST /api/forms/detect` (L1073) | `forms-inline.ts` | Node ✅ | Keep |
| `GET /api/v2/files` (L1252) | `files.ts` | Node ✅ | Keep |
| `GET /api/ticker` (L1274) | `ticker.ts` | Node ✅ | Keep |
| `GET /api/cases` (L669) | `cases.ts` | Node ✅ | Keep |
| `POST /api/cases` (L679) | `cases.ts` | Node ✅ | Keep |
| `PATCH /api/cases/:id` (L689) | `cases.ts` | Node ✅ | Keep |
| `POST /api/chat-sessions` (L703) | `chat-sessions.ts` | Node ✅ | Keep |
| `GET /api/chat-sessions` (L713) | `chat-sessions.ts` | Node ✅ | Keep |
| `GET /api/chat-sessions/:id` (L720) | `chat-sessions.ts` | Node ✅ | Keep |
| `PATCH /api/chat-sessions/:id` (L730) | `chat-sessions.ts` | Node ✅ | Keep |
| `GET /api/documents` (L746) | `documents.ts` | Node ✅ | Keep |
| `POST /api/documents` (L758) | `documents.ts` | Node ✅ | Keep |
| `PATCH /api/documents/:id` (L776) | `documents.ts` | Node ✅ | Keep |
| `GET /api/groups` + sub-routes (L1488+) | `groups.ts` | Node ✅ | Keep |

### VoiceMode.tsx calls
| Call | Handler | Status |
|------|---------|--------|
| `GET /api/chat/stream` | `chat.ts` SSE | Node ✅ Keep |
| `POST /api/chat` (fallback) | `chat.ts` | Node ✅ Keep |

### procedures-api.ts calls
| Call | Handler | Status |
|------|---------|--------|
| `GET /api/v2/files?procedureId=…` | `files.ts` | Node ✅ Keep |

---

## Duplicate Salary Routes — Migration Detail

The frontend calls `GET /api/salary`, `GET /api/salary/meta`, `POST /api/salary/calc`.  
These are served by Node `salary-inline.ts` which reimplements Python's salary engine.

**Safe migration path:**

1. Verify Python `/api/v2/salary/compute` returns equivalent fields to Node `/api/salary/calc`  
   → Python returns `SalaryComputeResponse` (see `schemas_kb_v2.py`)  
   → Node returns ad-hoc JSON from `salary-inline.ts`  
   → **Response shapes differ** — frontend migration requires adapter or schema alignment first

2. For `GET /api/salary` and `GET /api/salary/meta` (read-only lookup):  
   → Python does not expose these exact endpoints  
   → Must either: (a) add them to Python, or (b) keep in Node with data sourced from Python  
   → **Recommendation: keep in Node for now, source data from Python KB via internal call**

**Conclusion:** Salary route retirement is blocked on schema alignment. Defer to Phase 4.

---

## Routes with No Frontend Usage (safe to audit for removal)

These Node routes were NOT found in the frontend audit. They may be called by:
- Admin panel (separate app not audited here)  
- WhatsApp bot  
- Internal services  
- No one (dead)

| Route | Node handler | Risk of removal |
|-------|-------------|-----------------|
| `GET /api/kb-nodes/search` | `kb-vnext.ts` | Unknown — not in web-user |
| `GET /api/kb-nodes/stats` | `kb-vnext.ts` | Unknown |
| `GET /api/kb-nodes/list` | `kb-vnext.ts` | Unknown |
| `GET /api/salary/meta` | `salary-inline.ts` | **Used by frontend** (L609) |
| `GET /api/unified/search` | `unified-search.ts` | Unknown — not in web-user |
| `GET /api/faq` | `faq.ts` | Unknown — not in web-user |
| `GET /api/groups` sub-routes | `groups.ts` | Used by frontend (L1488+) |

---

## Recommended Phase 3 Actions (updated after audit)

| Step | Action | Risk | Prerequisite |
|------|--------|------|--------------|
| 3a | ✅ Delete `routes/forms.ts` | Done | — |
| 3b | ✅ Remove dead `salary.ts` import | Done | — |
| 3c | Audit admin-panel app for `kb-nodes` usage | Low | — |
| 3d | Align salary response shapes (Node vs Python) | Medium | Schema comparison |
| 3e | Retire `tx.ts` mock routes (replace with real or 404) | Low | Product decision |
| 3f | Audit `advanced.ts` stubs — verify if frontend uses them | Low | — |
| 3g | Add integration tests for all proxied `/api/v2/*` routes | High | Before any proxy changes |
