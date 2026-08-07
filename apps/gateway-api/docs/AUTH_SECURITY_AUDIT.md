# AUTH_SECURITY_AUDIT.md
## Authentication & Authorization Security Audit
## Date: 2026-05-12
## Auditor: Copilot Agent
## Status: EXECUTED — Fixes applied in same session

---

# 1. SCOPE

This audit covers:
- JWT issuance, signing, and verification (`auth-middleware.ts`, `auth-routes.ts`)
- Password hashing and validation (`password.ts`)
- Session management and refresh token rotation
- CSRF protection
- RBAC enforcement across all route modules
- Frontend auth state management (`auth.ts`, `app.tsx`)
- Cookie configuration
- CORS configuration
- Rate limiting on auth endpoints

---

# 2. FILES INSPECTED

| File | Role |
|------|------|
| `apps/gateway-api/src/auth/auth-routes.ts` | Register, login, refresh, logout, /me |
| `apps/gateway-api/src/auth/auth-middleware.ts` | JWT hook, onRequest, `registerAuthHook` |
| `apps/gateway-api/src/auth/rbac.ts` | Role hierarchy, `requireRole`, permission matrix |
| `apps/gateway-api/src/auth/password.ts` | bcryptjs hashing |
| `apps/gateway-api/src/bootstrap/plugins.ts` | CORS, cookie, rate-limit registration |
| `apps/gateway-api/src/bootstrap/security.ts` | Security headers hook |
| `apps/gateway-api/src/routes/documents.ts` | Documents CRUD |
| `apps/gateway-api/src/routes/cases.ts` | Cases CRUD |
| `apps/web-user/src/lib/auth.ts` | Frontend token storage, decode, CSRF header |
| `apps/web-user/src/store/app.tsx` | Profile init from JWT, login/logout/hasRole |

---

# 3. FINDINGS

---

## 3.1 JWT Signing and Verification

**Status: WORKING**

| Item | Finding |
|------|---------|
| JWT secret | Loaded from `JWT_SECRET` env var — throws hard if missing |
| Access token TTL | 24h (`JWT_EXPIRES_IN_SEC`, configurable via env) |
| Refresh token TTL | 7d (`JWT_REFRESH_EXPIRES_IN_SEC`, configurable via env) |
| Signing algorithm | Default (HS256) — symmetric, uses same secret |
| Refresh token jti | Added on issue — enables per-token revocation |
| Token rotation | Refresh token replaced on each `/api/auth/refresh` call ✓ |
| Session revocation | `DELETE FROM sessions WHERE token = $1` on logout ✓ |

**No issues found.**

---

## 3.2 Password Hashing

**Status: WORKING**

| Item | Finding |
|------|---------|
| Algorithm | bcryptjs (pure JS) |
| Rounds | 10 (adequate for production) |
| Compare timing | `bcrypt.compare` is constant-time safe ✓ |

**No issues found.**

---

## 3.3 Password Validation at Registration

**Status before fix: BROKEN → FIXED**

**Finding:**
The register route had no minimum password length or email format check. A password of `"a"` or `""` (other than the falsy guard) would be accepted and hashed.

**Fix applied (2026-05-12):**
```
// Email format validation
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
  return reply.code(400).send({ error: "صيغة البريد الإلكتروني غير صحيحة" });
}

// Password strength: minimum 8 characters
if (password.length < 8) {
  return reply.code(400).send({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
}
```

**Remaining gap:** No uppercase/digit/special character complexity enforcement. Acceptable for current threat model; revisit for RC.

---

## 3.4 CSRF Protection

**Status: WORKING**

| Item | Finding |
|------|---------|
| Mechanism | Double-submit cookie pattern |
| CSRF cookie | `watany_csrf` — not httpOnly, SameSite=strict |
| Header required | `X-CSRF-Token` must match cookie value |
| Applied to | `/api/auth/refresh` and `/api/auth/logout` |
| Bypass path | None found — cookie presence triggers check |

**Note:** CSRF protection only covers refresh and logout endpoints. State-mutating API routes (documents, cases, etc.) rely on Bearer token auth, which is not vulnerable to CSRF by design.

---

## 3.5 Cookie Configuration

**Status: WORKING**

| Cookie | httpOnly | SameSite | Secure | Path |
|--------|----------|----------|--------|------|
| `watany_refresh` | ✓ true | strict | conditional on HTTPS | `/api/auth` |
| `watany_csrf` | ✗ false | strict | conditional on HTTPS | `/` |

**Note:** `Secure` flag is only set if `isSecureRequest()` returns true (HTTPS or `x-forwarded-proto: https`). In development over HTTP, cookies are not marked Secure — this is expected.

---

## 3.6 Session Storage

**Status: TECH DEBT**

| Item | Finding |
|------|---------|
| Refresh token stored | As plaintext in `sessions.token` column |
| Risk | If DB is compromised, all active sessions are exposed |
| Mitigation | `sameSite: strict` + `httpOnly` limits real-world exploitability |
| Recommended fix | Hash refresh tokens before DB storage (SHA-256) |

**Action:** Create `DB_REFRESH_TOKEN_HASHING.md` follow-up task.

---

## 3.7 Dev Admin Fallback

**Status: WORKING / ACCEPTABLE RISK**

| Item | Finding |
|------|---------|
| Guard 1 | `ALLOW_DEV_ADMIN_FALLBACK=true` env flag required |
| Guard 2 | `NODE_ENV !== "production"` |
| Guard 3 | `isLocalRequest()` — checks IP + hostname for 127.0.0.1/::1/localhost |
| Credentials | `admin@watany.test` / `admin123` — hardcoded but gated |
| Production exposure | Safe — triple-gated |

**Risk:** If `NODE_ENV !== "production"` in a staging environment that is network-accessible, and `ALLOW_DEV_ADMIN_FALLBACK=true` is set, an attacker who can spoof X-Forwarded-For could bypass the local check.

**Recommendation:** Remove the `x-forwarded-for` trust for the `isLocalRequest()` check OR require `NODE_ENV=development` (not just `!= production`).

---

## 3.8 RBAC Route Guard — Admin Routes

**Status: WORKING**

The `registerAuthHook` hook in `auth-middleware.ts` uses `onRoute` to auto-add `requireRole` to any route matching:
- `/api/admin/*` → requires `admin`
- `/api/superadmin/*` → requires `superadmin`

These routes also receive explicit `preHandler` from their own route modules in most cases.

**Verified routes auto-protected:**
- `/api/admin/users`
- `/api/admin/rules`
- `/api/admin/kb`
- `/api/admin/payments`
- `/api/superadmin/*`

---

## 3.9 RBAC Route Guard — Non-Admin Routes

**Status before fix: BROKEN → FIXED**

**Finding:**
`/api/documents` (GET, POST, PATCH) and `/api/cases` (GET, POST, PATCH) had **zero authentication enforcement**. These routes were registered without any preHandler and did not appear in the public path whitelist — yet `request.user` was never checked in the handlers. Any unauthenticated HTTP call could:
- Read all documents from all users
- Create documents with any `status` (including bypassing the `pending → verified` workflow)
- Modify any document's status without admin privilege

**Fix applied (2026-05-12):**

```typescript
// documents.ts
app.get("/api/documents",    { preHandler: [requireRole("accredited")] }, ...)
app.post("/api/documents",   { preHandler: [requireRole("accredited")] }, ...)
app.patch("/api/documents/:id", { preHandler: [requireRole("moderator")] }, ...)

// cases.ts
app.get("/api/cases",        { preHandler: [requireRole("accredited")] }, ...)
app.post("/api/cases",       { preHandler: [requireRole("accredited")] }, ...)
app.patch("/api/cases/:id",  { preHandler: [requireRole("accredited")] }, ...)
```

**Remaining gap:** Neither route scopes results by `user_id`. A logged-in `accredited` user can read all other users' documents and cases. The pluginDb schema has no `user_id` column. This requires a schema migration — tracked separately.

---

## 3.10 RBAC Permission Matrix

**Status: WORKING / PARTIAL**

The permission matrix in `rbac.ts` defines 12 permissions across 5 roles:

```
chat.send            — all roles
chat.history         — accredited+
cases.create         — accredited+
cases.view_all       — moderator+
documents.upload     — accredited+
documents.verify     — moderator+
forms.download       — accredited+
marketplace.post     — accredited+
admin.dashboard      — admin+
admin.users          — admin+
admin.rules          — admin+
superadmin.all       — superadmin
```

**Gap:** The permission matrix is defined but **not used** as a centralized enforcement mechanism. Route preHandlers use `requireRole(minRole)` directly rather than `hasPermission(role, "cases.create")`. The matrix is documentation, not enforcement.

**Recommendation:** Add a `requirePermission(perm)` preHandler factory that uses the matrix. Makes permission changes auditable in one place.

---

## 3.11 CORS Configuration

**Status before fix: BROKEN → FIXED**

**Finding:**
`cors({ origin: true, credentials: true })` reflects any `Origin` header back to the client. Combined with `credentials: true`, this allows any website to make authenticated requests on behalf of users (CORS misconfiguration — OWASP A05).

**Fix applied (2026-05-12):**
Replaced `origin: true` with an explicit allowlist using a callback:
```typescript
const corsAllowlist = new Set([
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  // Additional origins via CORS_ORIGINS env var (comma-separated)
]);

origin: (origin, cb) => {
  if (!origin || corsAllowlist.has(origin)) { cb(null, true); }
  else { cb(new Error(`CORS: origin '${origin}' not allowed`), false); }
}
```

**Production action required:** Add the production domain to `CORS_ORIGINS` env var before deploy.

---

## 3.12 Rate Limiting on Auth Endpoints

**Status: PARTIAL**

| Item | Finding |
|------|---------|
| Global rate limit | 100 req/min per IP |
| Auth endpoint limit | Same as global — no tighter limit |
| Localhost exemption | `allowList: ["127.0.0.1", "::1"]` — no rate limit for local |

**Risk:** 100 req/min is not strict enough to prevent credential stuffing against the login endpoint. Standard recommendation is 5-10 attempts per 15 minutes per IP.

**Recommendation:** Add per-route rate limit override on `/api/auth/login` and `/api/auth/register`:
```typescript
app.post("/api/auth/login", {
  config: { rateLimit: { max: 10, timeWindow: "15 minutes" } }
}, ...)
```

This is a separate task — not applied in this session to avoid gateway restart.

---

## 3.13 Frontend Auth State

**Status: WORKING / TECH DEBT**

| Item | Finding |
|------|---------|
| Access token storage | `accessTokenMemory` (in-memory) primary, `sessionStorage` fallback |
| Token decode | Client-side decode only — no signature verification |
| Token expiry check | `isTokenExpired()` checks `exp` claim client-side |
| `hasRole()` | Client-side check only — no server enforcement for non-admin routes |
| Profile initialization | From stored JWT on page load — works correctly |

**Risk:** If XSS occurs, `sessionStorage` access token is exposed. In-memory token (`accessTokenMemory`) is lost on page reload — the sessionStorage fallback means the token persists until tab close.

**Risk:** `hasRole()` on the frontend is UI gating only. Server must enforce — which it now does for documents/cases after the fix above.

---

## 3.14 Security Headers

**Status: WORKING**

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | `default-src 'self'; frame-ancestors 'none'` | ✓ |
| X-Content-Type-Options | `nosniff` | ✓ |
| X-Frame-Options | `DENY` (or SAMEORIGIN for embeddable docs) | ✓ |
| Referrer-Policy | `no-referrer` | ✓ |
| Strict-Transport-Security | Set in production only | ✓ |

**Gap:** No `Permissions-Policy` header. Low priority.

---

# 4. AUDIT SUMMARY TABLE

| Item | Status Before | Status After | Severity |
|------|--------------|--------------|----------|
| JWT signing/verification | WORKING | WORKING | — |
| Password hashing (bcrypt) | WORKING | WORKING | — |
| Password validation | BROKEN | FIXED | P0-HIGH |
| Email format validation | BROKEN | FIXED | P0-HIGH |
| CSRF double-submit | WORKING | WORKING | — |
| Cookie config (httpOnly, SameSite) | WORKING | WORKING | — |
| Session revocation on logout | WORKING | WORKING | — |
| Refresh token rotation | WORKING | WORKING | — |
| Refresh token plaintext in DB | TECH DEBT | TECH DEBT | P1 |
| Dev admin fallback | ACCEPTABLE | ACCEPTABLE | P1 |
| Admin routes auto-protected | WORKING | WORKING | — |
| `/api/documents` auth guard | BROKEN | FIXED | **P0-CRITICAL** |
| `/api/cases` auth guard | BROKEN | FIXED | **P0-CRITICAL** |
| Documents/cases user scoping | BROKEN | NOT BUILT | P0-HIGH |
| RBAC permission matrix enforcement | TECH DEBT | TECH DEBT | P1 |
| CORS origin allowlist | BROKEN | FIXED | P0-HIGH |
| Per-endpoint auth rate limiting | PARTIAL | PARTIAL | P1 |
| Frontend XSS/sessionStorage risk | TECH DEBT | TECH DEBT | P1 |
| Security headers | WORKING | WORKING | — |

---

# 5. FIXES APPLIED THIS SESSION

| Fix | File(s) | Description |
|-----|---------|-------------|
| `/api/documents` auth | `routes/documents.ts` | `requireRole("accredited")` on GET/POST, `requireRole("moderator")` on PATCH |
| `/api/cases` auth | `routes/cases.ts` | `requireRole("accredited")` on GET/POST/PATCH |
| Password min length | `auth/auth-routes.ts` | Reject passwords < 8 chars |
| Email format | `auth/auth-routes.ts` | Reject malformed email addresses |
| CORS allowlist | `bootstrap/plugins.ts` | Replace `origin: true` with explicit allowlist + `CORS_ORIGINS` env override |

TypeScript check: **CLEAN** (no errors after all fixes)

---

# 6. REMAINING GAPS (NOT YET FIXED)

| Gap | Priority | Blocking? | Next Action |
|-----|----------|-----------|-------------|
| Documents/cases have no user_id scoping | P0-HIGH | Yes for multi-user | Schema migration — `pluginDb` tables need `user_id` column |
| Auth rate limit (5/15min on login) | P1 | No | Per-route rate limit on login/register |
| Refresh token hashed before DB storage | P1 | No | `DB_REFRESH_TOKEN_HASHING.md` |
| RBAC permission matrix not enforced | P1 | No | `requirePermission()` factory |
| Dev admin: staging exposure risk | P1 | No | Tighten to `NODE_ENV=development` check |
| Frontend sessionStorage XSS exposure | P1 | No | Move to cookie-only or short-lived memory token |
| `Permissions-Policy` header | P2 | No | Add to security.ts |

---

# 7. NEXT AUDIT

Per `WATANY_PLATFORM_AUDIT.md` execution order:

```
Next: RBAC_AUDIT.md
  — API role enforcement per route module
  — Permission boundary completeness
  — Admin control surfaces
```
