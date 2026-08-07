# RC_RELEASE_GATE.md
## Track 3 — Release Candidate Gate

**Date:** 2026-05-12  
**Purpose:** Definitive checklist that must pass before Watany v1.0.0-rc1 is tagged and deployed

Run every step in order. A single failure is a hard stop — fix and restart from Step 1.

---

## Gate 1 — Code Quality (5 min)

```bash
# From repo root
pnpm -r typecheck
```

**Pass:** Zero output (no errors)  
**Fail:** Any TypeScript error — fix before continuing

```bash
pnpm --dir apps/gateway-api exec tsc --noEmit
pnpm --dir apps/web-user exec tsc --noEmit
```

**Pass:** Zero output for both  
**Fail:** Any error — fix before continuing

---

## Gate 2 — Automated Tests (10 min)

```bash
pnpm --dir apps/gateway-api test --run
```

**Pass:** All tests pass (0 failures, 0 errors)  
**Fail:** Any failing test — fix before continuing

Specific regression suites (run individually if triage needed):

```bash
# Chat relevance
pnpm --dir apps/gateway-api test --run src/tests/chat-relevance-regression.test.ts

# Procedure diagnostics
pnpm --dir apps/gateway-api test --run src/tests/procedure-diagnostics-regression.test.ts

# Auth + RBAC
pnpm --dir apps/gateway-api test --run src/tests/auth-rbac.test.ts
pnpm --dir apps/gateway-api test --run src/tests/admin-auth-hardening.test.ts

# Salary
pnpm --dir apps/gateway-api test --run src/tests/salary.test.ts

# Saved chats auth
pnpm --dir apps/gateway-api test --run src/tests/saved-chats-auth-regression.test.ts
```

---

## Gate 3 — Production Build (5 min)

```bash
pnpm --dir apps/web-user build
```

**Pass:** Build completes with no errors, `apps/web-user/dist/` is populated  
**Fail:** Any build error — fix before continuing

```bash
# Quick smoke of build output
pnpm --dir apps/web-user preview &
# Open http://localhost:4173/ in browser
# Verify: home page loads, no blank screen, no console errors
```

---

## Gate 4 — Security Checklist (manual, 10 min)

```
[ ] JWT_SECRET in production .env is NOT "watany-dev-secret-68081"
[ ] JWT_SECRET in production .env is >= 32 random characters
[ ] AI_API_KEY is set correctly for the production AI provider
[ ] .env file on server has chmod 600
[ ] CORS_ALLOWED_ORIGINS in production .env matches the production domain only
[ ] NODE_ENV=production in production .env
[ ] No test credentials or debug flags are set in production .env
```

**All boxes must be checked. Any unchecked = hard stop.**

---

## Gate 5 — RBAC Smoke (5 min)

Start the gateway locally:

```bash
pnpm --dir apps/gateway-api dev
```

Run these curl checks. All must return 401 (not 200, not 403, not 500):

```bash
# Admin dashboard — unauthenticated
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8010/api/admin/dashboard
# Expected: 401

# Admin analytics — unauthenticated
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8010/api/admin/analytics/sessions
# Expected: 401

# Admin system status — unauthenticated
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8010/api/admin/system/status
# Expected: 401

# KB Studio rebuild — unauthenticated
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8010/api/admin/kb-studio/rebuild
# Expected: 401

# Metrics — unauthenticated
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8010/metrics
# Expected: 401
```

**Pass:** All return 401  
**Fail:** Any 200 response — apply `requireRole("admin")` fix before continuing (see WATANY_RC_BACKLOG.md P0-002, P0-003, P0-009)

---

## Gate 6 — Health Checks (2 min)

```bash
# Gateway liveness
curl -s http://127.0.0.1:8010/health
# Expected: {"status":"ok"} or similar

# Gateway readiness
curl -s http://127.0.0.1:8010/ready
# Expected: 200 with dependency status

# Python backend (if running)
curl -s http://localhost:8012/health
# Expected: {"status":"ok"} or similar
```

**Pass:** `/health` returns 200, `/ready` returns 200  
**Fail:** Either non-200 — investigate and fix

---

## Gate 7 — Browser Smoke (15 min)

Start full stack:

```bash
# Terminal 1: Gateway
pnpm --dir apps/gateway-api dev

# Terminal 2: Web user
pnpm --dir apps/web-user dev
```

Open http://localhost:5174 and complete each check:

### Public pages (no login required)
```
[ ] Home/Chat page loads with no blank screen
[ ] Chat: type "معاش الزوجة" → response returns (deterministic or AI)
[ ] Services page loads
[ ] Procedures page loads and search returns results
```

### Authenticated pages (login first)
```
[ ] Login: use test credentials → redirected to home
[ ] Salary calculator: select rank + years → result appears
[ ] Documents page loads, list is shown
[ ] Saved Chats page loads
[ ] Notifications page loads
[ ] Profile page loads with user data
```

### Admin (use admin credentials)
```
[ ] Navigate to /admin (port 5175 or admin route)
[ ] Admin dashboard loads with data
[ ] KB Health panel shows status
[ ] User management list loads
```

### Critical functional checks
```
[ ] Send a voice message (if microphone available) → transcription works
[ ] Document preview opens for a valid proc-XXXX document
[ ] Salary result is non-zero for Colonel / 30 years
[ ] Arabic text renders RTL correctly throughout
[ ] No JavaScript console errors on any page
```

**Pass:** All boxes checked  
**Fail:** Any unchecked item with functional impact → fix before tagging RC

---

## Gate 8 — AI Fallback Smoke (5 min)

With `USE_AI_PROVIDER=false` in `.env` (or AI provider deliberately unavailable):

```bash
curl -s -X POST http://127.0.0.1:8010/api/v2/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "ما هي معاشات الزوجة", "sessionId": "test-smoke-001"}'
```

**Pass:** Response contains Arabic text about pension entitlements (deterministic RAG fallback)  
**Fail:** Error response or empty reply — investigate `chat-service.ts` fallback path

---

## Gate 9 — Backup Drill (30 min, staging only)

```bash
# Take backup
/opt/watanybot/scripts/backup.sh

# Verify PostgreSQL dump exists and is non-zero
ls -lh /backups/postgres/watany_*.dump | tail -1

# Simulate restore (staging only — do NOT run on production)
# Follow BACKUP_AND_RESTORE_PLAN.md §6 full procedure

# Confirm: row counts match before/after
# Confirm: GET /health returns 200 after restore
```

**Pass:** Restore completes, row counts match, health check passes  
**Fail:** Any restore error — fix `backup.sh` and retry

---

## Gate 10 — Git Tag

All gates passed? Tag the release:

```bash
git tag -a v1.0.0-rc1 -m "Release Candidate 1 — all P0 gates passed $(date +%Y-%m-%d)"
git push origin v1.0.0-rc1
```

**This tag = the deployment artifact. Deploy exactly this commit.**

---

## Gate 11 — Production Deploy

```bash
# On deployment machine
./deploy_remote.sh  # or equivalent

# On server — verify immediately after deploy
curl -s https://koudama.com/health
# Expected: 200

curl -s https://koudama.com/ready
# Expected: 200

# Check PM2 is persisted
pm2 save
pm2 list
```

**Pass:** Health and ready return 200 from the production domain  
**Fail:** Roll back immediately — `pm2 stop watany-gateway; git checkout <previous-sha>; pm2 start ecosystem.config.cjs --only watany-gateway --env production`

---

## Gate 12 — Post-Deploy Browser Smoke

Repeat Gate 7 against production URL (https://koudama.com).

Minimum checks on production:

```
[ ] Home page loads over HTTPS
[ ] No mixed-content warnings
[ ] Login works
[ ] Chat returns a response
[ ] Salary calculator returns a result
[ ] No console errors
```

**Pass:** All pass on production URL  
**Status after this gate: v1.0.0-rc1 SHIPPED**

---

## Quick Reference — Gate Summary

| Gate | Duration | Automated? | Blocking? |
|------|---------|------------|---------|
| 1 — TypeScript | 5 min | Yes | Yes |
| 2 — Tests | 10 min | Yes | Yes |
| 3 — Production build | 5 min | Yes | Yes |
| 4 — Security checklist | 10 min | Manual | Yes |
| 5 — RBAC smoke | 5 min | Semi (curl) | Yes |
| 6 — Health checks | 2 min | Semi (curl) | Yes |
| 7 — Browser smoke | 15 min | Manual | Yes |
| 8 — AI fallback | 5 min | Semi (curl) | Yes |
| 9 — Backup drill | 30 min | Manual | Yes |
| 10 — Git tag | 1 min | Manual | Yes |
| 11 — Deploy | 10 min | Semi | Yes |
| 12 — Post-deploy smoke | 10 min | Manual | Yes |
| **Total** | **~1.5 hrs** | | |

---

## Automated Gate Script (target state)

When all P0 items are closed, this script should run Gates 1–3 and 5–6 automatically:

```bash
#!/bin/bash
set -euo pipefail

echo "=== WATANY RC GATE ==="

echo "[Gate 1] TypeScript..."
pnpm -r typecheck

echo "[Gate 2] Tests..."
pnpm --dir apps/gateway-api test --run

echo "[Gate 3] Production build..."
pnpm --dir apps/web-user build

echo "[Gate 5] RBAC smoke..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8010/api/admin/dashboard)
if [ "$STATUS" != "401" ]; then
  echo "FAIL: /api/admin/dashboard returned $STATUS (expected 401)"
  exit 1
fi

echo "[Gate 6] Health..."
curl -sf http://127.0.0.1:8010/health > /dev/null
curl -sf http://127.0.0.1:8010/ready > /dev/null

echo ""
echo "=== GATES 1-3, 5-6 PASSED ==="
echo "Complete Gates 4, 7-12 manually before tagging RC."
```

Save as `scripts/rc-gate.sh`. Run before every deploy attempt.
