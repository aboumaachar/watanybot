# ADMIN_CONTROL_SURFACE_AUDIT.md
## Admin Control Surface Audit
## Date: 2026-05-12
## Auditor: Copilot Agent
## Status: EXECUTED — No critical fixes required; gaps documented

---

# 1. SCOPE

This audit covers every admin-facing control route in the gateway:
- Payment intelligence admin (questions, answers, announcements)
- Recruitment admin (announcements)
- User management (roles, status, ban/unban)
- Audit log
- KB management (salary data, rules, chunks, versions, rollback)
- Admin dashboard and analytics
- Document admin (verify/reject)
- AI training and feedback admin
- Feature flags and web-user settings
- Privilege escalation controls

---

# 2. ADMIN SURFACE MAP

---

## 2.1 Payment Intelligence Admin

**Module:** `admin-payments/routes.ts`, `admin-payments/service.ts`, `admin-payments/store.ts`

**Storage:** `data/admin-payments.json` (JSON file on disk, loaded per-request)

### Routes

| Route | Method | Role | Status |
|-------|--------|------|--------|
| `/api/admin/payments/questions` | GET | superadmin | WORKING |
| `/api/admin/payments/questions` | POST | superadmin | WORKING |
| `/api/admin/payments/questions/:id` | PATCH | superadmin | WORKING |
| `/api/admin/payments/questions/:id` | DELETE | superadmin | WORKING |
| `/api/admin/payments/answers` | GET | superadmin | WORKING |
| `/api/admin/payments/answers` | POST | superadmin | WORKING |
| `/api/admin/payments/answers/:id` | PATCH | superadmin | WORKING |
| `/api/admin/payments/answers/:id` | DELETE | superadmin | WORKING |
| `/api/admin/payments/announcements` | GET | superadmin | WORKING |
| `/api/admin/payments/announcements` | POST | superadmin | WORKING |
| `/api/admin/payments/announcements/:id` | PATCH | superadmin | WORKING |
| `/api/admin/payments/announcements/:id` | DELETE | superadmin | WORKING |
| `/api/admin/payments/dashboard` | GET | superadmin | WORKING |

**Auth:** All routes use explicit `{ preHandler: [requireRole("superadmin")] }` — correctly stricter than `/api/admin` default.

**Validation:** All inputs validated via Zod schemas with structured error responses.

**Rollback:** No rollback — the JSON store is overwritten on write. No versioning system. **TECH DEBT.**

**Audit log:** No audit log for payment admin actions. **TECH DEBT.**

**Data integrity:** `createAnswer` validates schedule windows (activateAt/expiresAt), prevents invalid windows. **WORKING.**

---

## 2.2 Recruitment Admin

**Module:** `recruitment/routes.ts`, `recruitment/service.ts`, `recruitment/store.ts`

**Storage:** JSON file (same pattern as admin-payments)

### Routes

| Route | Method | Role | Enforcement | Status |
|-------|--------|------|-------------|--------|
| `/api/recruitment/announcements` | GET | public | none | WORKING (public list) |
| `/api/admin/recruitment/announcements` | GET | superadmin | explicit preHandler | WORKING |
| `/api/admin/recruitment/announcements` | POST | superadmin | explicit preHandler | WORKING |
| `/api/admin/recruitment/announcements/:id` | PATCH | superadmin | explicit preHandler | WORKING |
| `/api/admin/recruitment/announcements/:id` | DELETE | superadmin | explicit preHandler | WORKING |

**Auth:** All admin routes use explicit `requireRole("superadmin")`. **WORKING.**

**Validation:** Zod schemas on all bodies. **WORKING.**

**Rollback:** No rollback. **TECH DEBT.**

**Audit log:** No audit log. **TECH DEBT.**

---

## 2.3 User Management

**Module:** `routes/admin-users.ts`

**Storage:** PostgreSQL `users`, `sessions`, `audit_log` tables

### Routes

| Route | Method | Role | Enforcement | Status |
|-------|--------|------|-------------|--------|
| `/api/admin/users` | GET | admin | explicit `requireRole("admin")` | WORKING |
| `/api/admin/users/:id/role` | PUT | admin | explicit `requireRole("admin")` | WORKING |
| `/api/admin/users/:id/status` | PUT | admin | explicit `requireRole("admin")` | WORKING |
| `/api/admin/audit` | GET | admin | explicit `requireRole("admin")` | WORKING |
| `/api/admin/chat-sessions` | GET | admin | explicit `requireRole("admin")` | WORKING |
| `/api/admin/chat-sessions/:id/messages` | GET | admin | explicit `requireRole("admin")` | WORKING |
| `/api/admin/chat-messages/:id/flag` | POST | moderator | explicit `requireRole("moderator")` | WORKING |
| `/api/admin/kpis` | GET | admin | explicit `requireRole("admin")` | WORKING |

**Privilege escalation guard:** Role promotion to `admin` or `superadmin` is blocked if the calling user is not `superadmin` — checked in handler body at line 153:
```typescript
if ((role === "admin" || role === "superadmin") && adminUser?.role !== "superadmin") {
  return reply.code(403).send({ error: "فقط المشرف العام يمكنه ترقية المستخدمين إلى مشرف" });
}
```
**WORKING.** This is an important defense-in-depth check beyond the `requireRole("admin")` preHandler.

**Audit log:** Role changes and status changes write to `audit_log` table with `user_id`, `action`, `resource`, `details`. **WORKING.**

**Broadcast:** WebSocket broadcast to admin clients on user changes. **WORKING.**

**Gap:** Admin can change their own role. No self-role-change prevention. Low severity — the user must already be admin to reach this endpoint.

---

## 2.4 Audit Log

**Module:** `routes/admin-users.ts` — `GET /api/admin/audit`

**Storage:** PostgreSQL `audit_log` table

### Actions Currently Logged

| Action | Trigger |
|--------|---------|
| `auth.register` | User registration |
| `auth.login` | Successful login |
| `auth.logout` | Logout |
| `user.role_change` | Admin changes user role |
| `user.status_change` | Admin bans/unbans user |

### Actions NOT Logged (gaps)

| Missing Action | Source | Severity |
|---------------|--------|----------|
| KB save/reload | `admin-kb.ts` writes | MEDIUM |
| Runtime KB save | `admin-kb.ts` | MEDIUM |
| Payment admin mutations | `admin-payments/routes.ts` | LOW |
| Recruitment admin mutations | `recruitment/routes.ts` | LOW |
| AI training approve/reject | `admin-ai.ts` | LOW |
| Feature flag changes | `admin-features.ts` | LOW |
| Document verify/reject | `documents.ts` PATCH | MEDIUM |

**Root cause:** KB, payments, and recruitment modules store data in JSON files and SQLite pluginDb — they don't write to the PostgreSQL `audit_log` table. This is an architectural gap that requires connecting these modules to the PostgreSQL audit trail.

---

## 2.5 KB Management and Rollback

**Module:** `routes/admin-kb.ts`

**Storage:** JSON files (salariesIndex.json, rankMeta.json, runtime_kb.json, ragChunks), plus a versioning system.

### Routes

| Route | Method | Role | Enforcement | Status |
|-------|--------|------|-------------|--------|
| `/api/admin/kb` | GET | admin+ | explicit check in handler + auto-hook | WORKING |
| `/api/admin/kb/rules` | GET | admin | auto-hook (`/api/admin/*`) | WORKING |
| `/api/admin/kb/rules` | PATCH | admin | auto-hook | WORKING |
| `/api/admin/kb/salary-entries` | GET | admin | auto-hook | WORKING |
| `/api/admin/kb/salary-entry/:key` | GET | admin | auto-hook | WORKING |
| `/api/admin/kb/salary-entry/:key` | PATCH | admin | auto-hook | WORKING |
| `/api/admin/kb/save` | POST | admin | auto-hook | WORKING |
| `/api/admin/kb/reload` | POST | admin | auto-hook | WORKING |
| `/api/admin/kb/runtime` | GET | admin | auto-hook | WORKING |
| `/api/admin/kb/runtime-reload` | POST | admin | auto-hook | WORKING |
| `/api/admin/kb/runtime-save` | POST | admin | auto-hook | WORKING |
| `/api/admin/kb/recalculate` | POST | admin | auto-hook | WORKING |
| `/api/admin/kb/versions` | GET | admin | auto-hook | WORKING |
| `/api/admin/kb/versions/rollback` | POST | admin | auto-hook | WORKING |
| `/api/admin/kb/chunks` | GET | admin | auto-hook | WORKING |
| `/api/admin/kb/chunk/:id` | GET | admin | auto-hook | WORKING |
| `/api/admin/kb/chunk/:id` | PATCH | admin | auto-hook | WORKING |
| `/api/admin/kb/chunks/save` | POST | admin | auto-hook | WORKING |
| `/api/admin/kb/chunks/reload` | POST | admin | auto-hook | WORKING |

**Rollback mechanism:** EXISTS — `addVersionEntry` is called before `save` and `runtime-save` operations. `POST /api/admin/kb/versions/rollback` restores from a version snapshot. **WORKING.**

**Gap — PATCH operations not versioned before write:**
- `PATCH /api/admin/kb/rules` modifies `rankMeta` in memory and writes to disk — no `addVersionEntry` call before the write.
- `PATCH /api/admin/kb/salary-entry/:key` modifies in-memory only — no version captured.
- `PATCH /api/admin/kb/chunk/:id` — no version captured.

This means an admin can corrupt salary rules or chunk data without a rollback point, until they call `POST /api/admin/kb/save` (which does version before writing).

**Recommended fix:** Add `addVersionEntry` at the start of every PATCH handler before mutating state. Tracked — not applied in this session to avoid breaking a running gateway.

---

## 2.6 Document Admin (Verify/Reject)

**Module:** `routes/documents.ts`

**Mechanism:** Documents status is changed via `PATCH /api/documents/:id` with `{ status: "verified" | "rejected" }`.

### Current State

| Action | Route | Role | Audit Log | Status |
|--------|-------|------|-----------|--------|
| Verify document | `PATCH /api/documents/:id` | moderator | ✗ MISSING | PARTIAL |
| Reject document | `PATCH /api/documents/:id` | moderator | ✗ MISSING | PARTIAL |

**Gap 1:** No dedicated `/api/admin/documents/:id/verify` endpoint — status is mutated via a generic PATCH. This means any field can be changed by a moderator, not just status. Status enum should be validated on PATCH.

**Gap 2:** No audit log for document status changes.

**Gap 3:** Documents have no `user_id` — cannot filter to "my documents" vs "all documents". The `pluginDb` schema has no ownership column.

---

## 2.7 Admin Dashboard and Analytics

**Module:** `routes/admin-dashboard.ts`

**Auth:** All routes under `/api/admin/dashboard` and `/api/admin/analytics` — auto-protected by `onRoute` hook with `requireRole("admin")`.

### Routes

| Route | Method | Data Source | Status |
|-------|--------|-------------|--------|
| `/api/admin/dashboard` | GET | feedbackLoop, sessionStore, AB engine | WORKING |
| `/api/admin/analytics/sessions` | GET | sessionStore (in-memory) | PARTIAL (in-memory, resets on restart) |
| `/api/admin/analytics/sessions/:id` | GET | sessionStore | PARTIAL |
| `/api/admin/experiments` | GET | AB engine | WORKING |
| `/api/admin/experiments` | POST | AB engine | WORKING |
| `/api/admin/experiments/:id` | GET | AB engine | WORKING |
| `/api/admin/experiments/:id/start` | POST | AB engine | WORKING |
| `/api/admin/experiments/:id/pause` | POST | AB engine | WORKING |
| `/api/admin/experiments/:id/complete` | POST | AB engine | WORKING |
| `/api/admin/kb/health` | GET | feedbackLoop, KB | WORKING |
| `/api/admin/kb/gaps` | GET | feedbackLoop | WORKING |
| `/api/admin/kb/auto-faqs` | GET | feedbackLoop | WORKING |
| `/api/admin/feedback/stats` | GET | feedbackLoop | WORKING |
| `/api/admin/system/status` | GET | system metrics | WORKING |
| `/api/admin/system/cleanup` | POST | sessionStore | WORKING |

**Key gap:** Session data is in-memory only. Every gateway restart wipes session analytics. **TECH DEBT** — needs PostgreSQL persistence for production.

---

## 2.8 AI Training and Feedback Admin

**Module:** `routes/admin-ai.ts`

**Auth:** All under `/api/admin/ai` — auto-protected by `onRoute` hook.

**State:** In-memory training queue and unrecognized input log.

### Key Routes

| Route | Purpose | Concern |
|-------|---------|---------|
| `POST /api/admin/ai/training/:id/approve` | Approve training sample | No audit log |
| `POST /api/admin/ai/training/:id/reject` | Reject training sample | No audit log |
| `POST /api/admin/ai/training/publish` | Publish training to AI | No rollback, no audit |
| `POST /api/admin/ai/fine-tune` | Trigger AI fine-tune | No confirmation step |
| `DELETE /api/admin/ai/unrecognized` | Clear unrecognized log | Destructive, no audit |

**Gap:** `POST /api/admin/ai/training/publish` triggers real AI model updates with no rollback mechanism and no audit log. This is the most dangerous destructive admin action.

---

## 2.9 Feature Flags

**Module:** `routes/admin-features.ts`

**Auth:**
- `GET /api/admin/features` — auto-protected (admin)
- `PUT /api/admin/features` — explicit `requireRole("superadmin")`

**Status:** WORKING. Feature flags can only be changed by superadmin.

**Gap:** No audit log for feature flag changes. A superadmin could enable/disable features without a trace.

---

## 2.10 Web-User Published Settings

**Module:** `routes/admin-web-user-settings.ts`

**Auth:**
- `GET /api/web-user/settings` — public (anyone can read published settings)
- `GET /api/admin/web-user/settings` — explicit `requireRole("superadmin")`
- `PUT /api/admin/web-user/settings` — explicit `requireRole("superadmin")`

**Status:** WORKING.

---

# 3. PRIVILEGE ESCALATION AUDIT

| Scenario | Protected? | Mechanism |
|----------|-----------|-----------|
| Admin promotes user to admin | ✓ Blocked | Handler checks `adminUser.role !== "superadmin"` |
| Admin promotes user to superadmin | ✓ Blocked | Same check |
| Admin bans themselves | ✗ Not blocked | Could self-lock — low real risk |
| Moderator changes document to any status | PARTIAL | `requireRole("moderator")` but no status enum validation in PATCH |
| Accredited user reads others' documents | ✗ NOT blocked | No user_id scoping |

---

# 4. ADMIN SURFACE STATUS SUMMARY

| Module | Auth | Validation | Audit Log | Rollback | Status |
|--------|------|-----------|-----------|---------|--------|
| Payment admin | ✓ superadmin | ✓ Zod | ✗ Missing | ✗ Missing | PARTIAL |
| Recruitment admin | ✓ superadmin | ✓ Zod | ✗ Missing | ✗ Missing | PARTIAL |
| User management | ✓ admin | ✓ enum check | ✓ DB audit_log | n/a | WORKING |
| Audit log read | ✓ admin | ✓ | n/a | n/a | WORKING |
| KB management | ✓ admin (auto) | ✗ Partial | ✗ Missing | ✓ versioning (partial) | PARTIAL |
| Document verify/reject | ✓ moderator | ✗ No status enum | ✗ Missing | n/a | PARTIAL |
| Admin dashboard | ✓ admin (auto) | n/a | n/a | n/a | WORKING |
| Analytics (sessions) | ✓ admin (auto) | n/a | n/a | n/a | PARTIAL (in-memory) |
| AI training admin | ✓ admin (auto) | ✗ Partial | ✗ Missing | ✗ Missing | PARTIAL |
| Feature flags | ✓ superadmin | n/a | ✗ Missing | n/a | PARTIAL |
| Web-user settings | ✓ superadmin | n/a | ✗ Missing | n/a | PARTIAL |

---

# 5. P0/P1/P2 GAPS

## P0 — Blocking for Production

| Gap | Module | Action |
|-----|--------|--------|
| Documents have no `user_id` — any accredited user reads all | `documents.ts`, `pluginDb` schema | Schema migration required |
| Document PATCH has no status enum validation — moderator can set any value | `documents.ts` | Add status whitelist |

## P1 — Required Before RC

| Gap | Module | Action |
|-----|--------|--------|
| KB PATCH operations not versioned before write | `admin-kb.ts` | Add `addVersionEntry` before each PATCH write |
| Payment/recruitment admin have no audit log | `admin-payments/`, `recruitment/` | Write to `audit_log` or equivalent |
| AI training publish has no rollback or confirmation | `admin-ai.ts` | Add confirmation token or dry-run |
| Session analytics lost on restart | `admin-dashboard.ts` | Persist sessionStore to PostgreSQL |
| Feature flag changes not audited | `admin-features.ts` | Write to audit_log |
| Document verify/reject not audited | `documents.ts` | Write to audit_log on status change |

## P2 — Nice to Have

| Gap | Module | Action |
|-----|--------|--------|
| Admin cannot see own actions in audit log in real-time | `admin-users.ts` | WebSocket push for audit log |
| Payment/recruitment JSON stores have no backup | `store.ts` | Auto-backup before write |
| Admin self-ban is not blocked | `admin-users.ts` | Add self-action guard |

---

# 6. FIXES APPLIED IN THIS SESSION

### FIX-1: `routes/documents.ts` — Correct status and kind enums (P0)

**Problem:** `DocumentItem` in the gateway used stale enums (`"pending" | "ready" | "archived"` for status, `"file" | "image" | "link"` for kind). These did not match the shared types package (`"pending" | "verified" | "rejected"` / `"image" | "pdf" | "doc" | "file"`). A moderator could send any arbitrary string as `status` and it would be persisted to the DB.

**Fix:**
- Updated `DocumentItem` interface to match `packages/types/src/index.ts`
- Added `VALID_DOC_STATUSES` and `VALID_DOC_KINDS` Set guards
- PATCH handler now validates `status` and `kind` before writing
- POST handler always creates documents with `status: "pending"` — client-supplied status is ignored
- TypeScript: `pnpm --dir apps/gateway-api exec tsc --noEmit` → clean

---

# 7. NEXT AUDIT

Per `WATANY_PLATFORM_AUDIT.md` execution order:

```
Next: AI_LATENCY_AND_FAILOVER_AUDIT.md
  — Streaming TTFB measurement
  — Timeout handling
  — Circuit breaker behavior
  — AI provider fallback
  — Response quality under degradation
```
