# SERVER_DEPLOYMENT_GATE.md

## Purpose

This checklist converts the local **RC CONDITIONAL** freeze into a fully **RC APPROVED** release
ready for staging or production deployment.

Local RC tag: `watany-rc-20260512-174322`
Local freeze timestamp: `2026-05-12T17:50:12`

All local phases passed. The two remaining blockers are server-environment-specific and must be
resolved on the Linux staging/production host before the tag is promoted.

---

## Blocker 1 — Gateway Production Build Validation

**Current status:** BLOCKED (no `build` script in `apps/gateway-api/package.json`)

**Accepted resolution (choose one):**

### Option A — Accept tsc as the build gate (recommended)

Add the following to `apps/gateway-api/package.json` under `"scripts"`:

```json
"build": "tsc --noEmit"
```

Then confirm:

```bash
pnpm --dir apps/gateway-api build
```

exits 0. This makes the RC ops `gateway_build` step non-blocked on future runs.

### Option B — Document tsc as the accepted validation path

If no transpile output is shipped (gateway runs via `tsx` directly), add a comment in
`apps/gateway-api/package.json`:

```json
"build:note": "gateway ships via tsx; tsc --noEmit is used for type validation only"
```

and mark this item ACCEPTED in the tracking table below.

**Sign-off required:** [ ] Engineering lead

---

## Blocker 2 — Nginx Config Validation

**Current status:** BLOCKED (nginx not installed on Windows host)

**Required steps on Linux staging/production server:**

```bash
# Copy generated config
sudo cp ops/nginx/watany.nginx.conf /etc/nginx/sites-available/watany

# Enable site
sudo ln -sf /etc/nginx/sites-available/watany /etc/nginx/sites-enabled/watany

# Validate config syntax
sudo nginx -t

# Reload if valid
sudo systemctl reload nginx
```

Expected output from `nginx -t`:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**Sign-off required:** [ ] Ops/DevOps

---

## Smoke Test Suite — Server Deployment

Run each item after the gateway is started on the server via PM2:

```bash
pm2 startOrReload ecosystem.watany.config.cjs --env production
pm2 status
```

### Health & Readiness

| # | Test | Expected | Result |
|---|------|----------|--------|
| 1 | `GET /health` | 200, `{ "status": "ok" \| "degraded", "uptime": <number> }` | [ ] |
| 2 | `GET /ready` | 200 or 503, `{ "ready": boolean }` | [ ] |
| 3 | `GET /metrics` (admin auth) | 200, `text/plain`, contains `process_uptime_seconds` | [ ] |

### Web UI

| # | Route | Expected | Result |
|---|-------|----------|--------|
| 4 | `/` home | Loads without JS errors | [ ] |
| 5 | `/login` | Login form renders, credentials accepted | [ ] |
| 6 | `/salary` | Salary calculator loads, at least one rank lookup returns result | [ ] |
| 7 | `/chat` | Chat box renders, message sends without error | [ ] |
| 8 | `/documents` | Document list renders | [ ] |
| 9 | `/services` | Services page renders | [ ] |

### Admin Protected Routes

| # | Test | Expected | Result |
|---|------|----------|--------|
| 10 | Login as admin user | Returns JWT, `role: "admin"` in profile | [ ] |
| 11 | `GET /api/admin/ai-config` | 200 (not 401/403) | [ ] |
| 12 | `GET /api/admin/kb/chunks` | 200 (not 401/403) | [ ] |
| 13 | `GET /api/admin/kb/versions` | 200, `{ versions: [...] }` | [ ] |

### Document Preview / Download / Share

| # | Test | Expected | Result |
|---|------|----------|--------|
| 14 | `GET /api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0006/preview` | 200 or 302 | [ ] |
| 15 | `GET /api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0006/download` | 200 or 302 | [ ] |
| 16 | `GET /api/v2/procedures/docs/DOES-NOT-EXIST/preview` | 404, HTML fallback with Arabic error message | [ ] |
| 17 | `GET /api/v2/procedures/reference/mof` | 200, HTML containing `DOC-WATANY_MOF_HTML-0006` | [ ] |

### Backup Restore (Production Verification)

| # | Test | Expected | Result |
|---|------|----------|--------|
| 18 | Confirm `rc_backups/watany_rc_backup_*.zip` exists on server | Archive present, > 0 bytes | [ ] |
| 19 | Extract archive to temp dir and verify directory structure | `apps/`, `packages/`, `watany_kb_tables_v4/` present | [ ] |

### KB & Search

| # | Test | Expected | Result |
|---|------|----------|--------|
| 20 | `GET /api/kb-nodes/stats` | 200, `{ ready: true }` | [ ] |
| 21 | `GET /api/v2/directory/search?q=تقاعد` | 200, results array with دائرة التقاعد entry | [ ] |

---

## JWT Secret Rotation (Production Only)

The local `.env` JWT_SECRET is a dev-grade value. Before production deployment:

1. Generate a strong secret:
   ```bash
   openssl rand -hex 32
   ```
2. Set the value in the server's environment manager (not in any committed file).
3. Verify the secret is not the string `watany_gateway_local_2026_h9Q4pL2xM7tV8kN3dR6sJ1fZ` or any value
   matching the documented weak-placeholder denylist maintained by the release scanner.

**Sign-off required:** [ ] Security lead

---

## Final Approval Tracking

| Item | Assigned | Status | Date |
|------|----------|--------|------|
| Blocker 1 — Gateway build script / accepted path | Engineering | [ ] OPEN | |
| Blocker 2 — Nginx config test on Linux server | Ops | [ ] OPEN | |
| Smoke tests 1–21 all pass | QA / deployer | [ ] OPEN | |
| JWT secret rotated to production value | Security | [ ] OPEN | |

When all four rows are marked **DONE**, update the final status below and commit this file.

---

## Final Status

```
RC CONDITIONAL â†’ RC APPROVED FOR STAGING/PRODUCTION
Approved by:
Approved date:
Git tag confirmed:  watany-rc-20260512-174322
```

