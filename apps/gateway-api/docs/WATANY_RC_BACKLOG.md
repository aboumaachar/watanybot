# WATANY_RC_BACKLOG.md
## Track 2 — Release Candidate Issue Register

**Date:** 2026-05-12  
**Source:** Consolidated from all 8 P0 audit documents  
**Purpose:** Every issue that must be tracked, triaged, and closed before or after RC ship

---

## P0 — Must Fix Before RC Ship

These are blocking issues. RC cannot be declared until all P0 items are closed.

### P0-001 · JWT_SECRET is a committed dev value
- **Source:** INFRA_AND_DEPLOYMENT_AUDIT.md §3
- **Risk:** Any attacker with access to the repo can forge valid JWTs for any role
- **Fix:** Generate new 256-bit random secret, set in production `.env`, rotate all active tokens
- **Verification:** Confirm `JWT_SECRET` in prod `.env` is not `watany-dev-secret-68081`

### P0-002 · Admin dashboard / analytics routes have no `requireRole` guard
- **Source:** ADMIN_CONTROL_SURFACE_AUDIT.md, TEST_COVERAGE_MATRIX.md §4
- **Affected routes:** `/api/admin/dashboard`, `/api/admin/analytics/sessions`, `/api/admin/experiments*`, `/api/admin/kb/health`, `/api/admin/system/status`, `/api/admin/system/cleanup`, `/api/admin/feedback/stats`
- **Risk:** Any unauthenticated caller can read session analytics and run system cleanup
- **Fix:** Add `{ preHandler: [requireRole("admin")] }` to each route in `admin-dashboard.ts`
- **Verification:** Unauthenticated GET /api/admin/dashboard returns 401

### P0-003 · KB Studio routes have no `requireRole` guard
- **Source:** ADMIN_CONTROL_SURFACE_AUDIT.md
- **Affected routes:** All routes in `admin-kb-studio.ts` (scan, ingest, export, rebuild)
- **Risk:** Unauthenticated caller can trigger a full KB rebuild
- **Fix:** Add `{ preHandler: [requireRole("admin")] }` to all KB Studio routes
- **Verification:** Unauthenticated POST /api/admin/kb-studio/rebuild returns 401

### P0-004 · No automated backup exists
- **Source:** BACKUP_AND_RESTORE_PLAN.md §8
- **Risk:** Any server failure or accidental data deletion causes permanent data loss
- **Fix:** Create `scripts/backup.sh`, set up daily cron, configure off-server upload
- **Verification:** Backup file present in `/backups/postgres/` after cron run

### P0-005 · Restore procedure never tested
- **Source:** BACKUP_AND_RESTORE_PLAN.md §6
- **Risk:** Backup exists but restore fails — discovered only during an actual incident
- **Fix:** Run full restore drill on staging: drop DB, restore, verify row counts, smoke test
- **Verification:** Restore drill checklist completed and signed off

### P0-006 · Production web SPA build not smoke-tested
- **Source:** INFRA_AND_DEPLOYMENT_AUDIT.md §4
- **Risk:** `pnpm --dir apps/web-user build` may fail or produce a broken SPA
- **Fix:** Run `pnpm --dir apps/web-user build` and serve `dist/` via Nginx or `vite preview`, then run browser smoke
- **Verification:** All pages load from `dist/`, no 404 on refresh (history fallback configured)

### P0-007 · No Nginx configuration in repository
- **Source:** INFRA_AND_DEPLOYMENT_AUDIT.md §7
- **Risk:** Cannot deploy without reverse proxy config — ad-hoc config has no version control
- **Fix:** Create `nginx/watanybot.conf` in repo with SSL, proxy_pass, history fallback, timeout settings
- **Verification:** Config passes `nginx -t`, site loads over HTTPS

### P0-008 · Deploy script does not run tests or typecheck
- **Source:** INFRA_AND_DEPLOYMENT_AUDIT.md §8
- **Risk:** Broken code is deployed; type errors discovered post-deploy
- **Fix:** Add to deploy gate: `pnpm -r typecheck` → `pnpm --dir apps/gateway-api test --run` → if both pass, proceed
- **Verification:** Intentionally introduce a type error — deploy gate rejects it

### P0-009 · Admin AI / KB admin routes lack `requireRole` in `admin-ai.ts`, `admin-kb.ts`, `admin-ai-runtime.ts`
- **Source:** TEST_COVERAGE_MATRIX.md §4, ADMIN_CONTROL_SURFACE_AUDIT.md
- **Affected:** All routes in those files without explicit `preHandler`
- **Risk:** Unauthenticated callers can approve AI training items, rollback KB versions, modify AI config
- **Fix:** Audit each handler, add `requireRole("admin")` where missing
- **Verification:** Automated test confirms 401 on unauthenticated calls

---

## P1 — Must Fix Before Pilot (First Real Users)

### P1-001 · PM2 startup not persistent across server reboots
- **Source:** INFRA_AND_DEPLOYMENT_AUDIT.md §5
- **Fix:** Run `pm2 startup`, then `pm2 save` after first deploy
- **Verification:** Reboot server, confirm `pm2 list` shows `watanybot-api` running

### P1-002 · CORS origin must be updated for production domain
- **Source:** INFRA_AND_DEPLOYMENT_AUDIT.md §9
- **Fix:** Set `CORS_ALLOWED_ORIGINS=https://koudama.com` in production `.env`
- **Verification:** Browser console shows no CORS error on production domain

### P1-003 · No pre-deploy `pg_dump` in deploy script
- **Source:** BACKUP_AND_RESTORE_PLAN.md §5
- **Fix:** Add `pg_dump` step before `RUN_PG_MIGRATIONS` in deploy script
- **Verification:** Dump file exists in `/backups/postgres/pre-deploy/` after each deploy

### P1-004 · No Git release tags
- **Source:** BACKUP_AND_RESTORE_PLAN.md §5
- **Fix:** Tag RC as `v1.0.0-rc1` before first pilot deploy
- **Verification:** `git tag -l` shows `v1.0.0-rc1`

### P1-005 · AI provider circuit breaker — no regression test
- **Source:** TEST_COVERAGE_MATRIX.md §2
- **Fix:** Add Vitest test that injects a failing AI provider, confirms CB opens after 3 failures, confirms deterministic fallback response is returned
- **Verification:** Test passes in CI

### P1-006 · Veteran-first scoreChunk boosting — no regression test
- **Source:** TEST_COVERAGE_MATRIX.md §2, VETERAN_FIRST_CONTENT_RANKING_AUDIT.md
- **Fix:** Add test that scores a `family_benefits` chunk and an `administrative` chunk with equal keyword matches; assert family_benefits scores higher
- **Verification:** Test passes in CI

### P1-007 · OpenAI 45s timeout — no test
- **Source:** TEST_COVERAGE_MATRIX.md §2
- **Fix:** Add test with a mock AI provider that sleeps 50s; confirm timeout triggers and fallback reply is returned within 50s
- **Verification:** Test passes, response time < 50s

### P1-008 · Document create/update validation — no test
- **Source:** TEST_COVERAGE_MATRIX.md §5
- **Fix:** Add tests: POST /api/documents with invalid status → 400; PATCH /api/documents/:id with invalid kind → 400
- **Verification:** Tests pass in CI

### P1-009 · Health module (elite.ts) — not tested
- **Source:** TEST_COVERAGE_MATRIX.md
- **Affected:** `/api/v2/elite/health-resources`, `/api/v2/elite/crisis-report`
- **Fix:** Add smoke test for health resources endpoint; crisis-report should require auth
- **Verification:** Test passes

### P1-010 · Community moderation — not tested
- **Source:** TEST_COVERAGE_MATRIX.md §7
- **Fix:** Add test that non-moderator cannot ban/kick; moderator can
- **Verification:** Test passes

### P1-011 · Cases module — no test
- **Source:** TEST_COVERAGE_MATRIX.md §6
- **Fix:** Add test for case create (POST /api/cases) with `accredited` role; assert 403 for `public`
- **Verification:** Test passes

### P1-012 · Nginx proxy_read_timeout must exceed AI_TIMEOUT_MS
- **Source:** INFRA_AND_DEPLOYMENT_AUDIT.md §7
- **Fix:** Set `proxy_read_timeout 90s` in Nginx config (AI timeout = 45s, Nginx default = 60s is marginal)
- **Verification:** Nginx config review

### P1-013 · `/ready` endpoint dependency checks not verified
- **Source:** INFRA_AND_DEPLOYMENT_AUDIT.md §6
- **Fix:** Read `diagnostics.ts` ready handler; ensure it checks KB file available + PostgreSQL reachable
- **Verification:** Kill PostgreSQL, confirm `/ready` returns non-200

---

## P2 — Improve Later (Post-Pilot)

### P2-001 · No compiled production gateway build
- **Source:** INFRA_AND_DEPLOYMENT_AUDIT.md §4
- **Recommendation:** Add `tsc --build` to release process for faster cold start
- **Impact:** ~200ms cold start reduction, eliminates tsx overhead in production

### P2-002 · `firstTokenMs` (streaming TTFB) never measured
- **Source:** AI_LATENCY_AND_FAILOVER_AUDIT.md
- **Recommendation:** Instrument `onFirstToken` callback to populate `ChatTimings.firstTokenMs`
- **Impact:** Enables TTFB alerting, streaming latency observability

### P2-003 · No rate limiting on `/api/auth/login`
- **Source:** TEST_COVERAGE_MATRIX.md §1
- **Recommendation:** Add Fastify rate limit plugin to login route (max 10 req/min per IP)
- **Impact:** Prevents credential stuffing attacks

### P2-004 · vNext KB nodes have no veteran-audience weighting
- **Source:** VETERAN_FIRST_CONTENT_RANKING_AUDIT.md §4.3
- **Recommendation:** Add `audience_scope` field to node schema when non-veteran content is added
- **Impact:** Low until vNext becomes primary retrieval path

### P2-005 · `/api/admin/python/probe` has no `requireRole`
- **Source:** INFRA_AND_DEPLOYMENT_AUDIT.md §6
- **Recommendation:** Add `requireRole("admin")` — low risk (read-only probe) but consistent with principle
- **Impact:** Minimal

### P2-006 · No secrets manager — all secrets in plaintext `.env`
- **Source:** INFRA_AND_DEPLOYMENT_AUDIT.md §3
- **Recommendation:** Use environment-specific secret injection (Vault, AWS SSM, or at minimum `chmod 600 .env`)
- **Impact:** Defence-in-depth; not blocking for pilot

### P2-007 · Voice TTS — no automated test
- **Source:** TEST_COVERAGE_MATRIX.md §10
- **Recommendation:** Add test that TTS endpoint returns audio content-type on valid input
- **Impact:** Low regression risk currently

### P2-008 · Mobile browser QA not performed
- **Source:** TEST_COVERAGE_MATRIX.md §8
- **Recommendation:** Manual QA on Safari/iOS and Chrome/Android before pilot
- **Impact:** Arabic RTL layout, virtual keyboard, PWA behaviour

### P2-009 · Jobs / Marketplace / Alerts pages use stubs only
- **Source:** TEST_COVERAGE_MATRIX.md §8
- **Recommendation:** Either complete implementation or mark as "coming soon" in UI before pilot
- **Impact:** User confusion if stubs appear broken

### P2-010 · Analytics / personalised shortcuts not built
- **Source:** Original feature roadmap
- **Recommendation:** Defer to v1.1

---

## Summary Table

| Priority | Count | Status |
|---------|-------|--------|
| P0 | 9 | All open |
| P1 | 13 | All open |
| P2 | 10 | Deferred |
| **Total** | **32** | |

P0 items 002, 003, 009 (RBAC gaps) can be fixed in a single pass through the route files. P0 items 004–008 require infrastructure and ops work outside the codebase.
