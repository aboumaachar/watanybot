# BACKUP_AND_RESTORE_PLAN.md
## Phase 8 of 8 — P0 Audit Cycle

**Date:** 2026-05-12  
**Status:** PLAN DEFINED — no automated backup currently exists; manual procedure documented

---

## 1. What Must Be Backed Up

### Tier 1 — Irreplaceable (loss = data loss incident)

| Asset | Location | Size estimate | Change frequency |
|-------|---------|---------------|-----------------|
| PostgreSQL database (`watany`) | localhost:5433 | < 100 MB | Every user session |
| Gateway config / runtime data | `apps/gateway-api/data/` | < 5 MB | Admin operations |
| Gateway environment secrets | `apps/gateway-api/.env` | < 2 KB | Rare |
| KB procedure HTML files | `apps/gateway-api/data/kb/` | ~3 MB | KB rebuild only |
| Runtime KB JSON | `apps/gateway-api/data/kb/runtime_kb.json` | ~2 MB | KB rebuild only |
| KB SQLite (production) | `./data/kb.sqlite` (prod) | ~50 MB | KB rebuild only |

### Tier 2 — Rebuildable but slow to recover

| Asset | Location | Notes |
|-------|---------|-------|
| RAG JSONL chunks | `watany_kb_tables_v4/watany_rag_chunks_v4.jsonl` | Rebuilt by KB Studio pipeline (~1 hr) |
| KB SQLite v4 | `watany_kb_tables_v4/Watany_KB_v4.sqlite` | Rebuilt by KB Studio |
| vNext KB nodes | `apps/gateway-api/kb_nodes.db` | Rebuilt by indexer script |
| Source procedure PDFs / HTML | `apps/api-backend/` raw sources | Rebuilt from original documents |

### Tier 3 — Code (version controlled, do not back up separately)

| Asset | Notes |
|-------|-------|
| All TypeScript source | In Git — `git push` to remote is the backup |
| React SPA source | In Git |
| Python backend source | In Git |

---

## 2. Backup Targets & Storage

| Backup type | Target location | Retention |
|------------|----------------|-----------|
| PostgreSQL daily dump | `/backups/postgres/` on server | 7 daily, 4 weekly |
| Gateway data snapshot | `/backups/gateway-data/` on server | 7 daily |
| Off-server copy | Object storage (S3 / Backblaze / Cloudflare R2) | 30 days |

**Current status:** No automated backup exists. All of the above is a plan that must be implemented.

---

## 3. Backup Procedures

### 3.1 PostgreSQL Backup

```bash
# Daily full dump
PGPASSWORD=postgres pg_dump \
  -h localhost -p 5433 -U postgres watany \
  -Fc -f /backups/postgres/watany_$(date +%Y%m%d_%H%M%S).dump

# Verify dump is non-empty
ls -lh /backups/postgres/watany_*.dump | tail -1

# Prune dumps older than 7 days
find /backups/postgres/ -name "*.dump" -mtime +7 -delete
```

### 3.2 Gateway Data Backup

```bash
# Snapshot gateway runtime data folder
tar -czf /backups/gateway-data/data_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /var/www/watanybot/apps/gateway-api data/

# Snapshot .env (secrets)
cp /var/www/watanybot/apps/gateway-api/.env \
  /backups/gateway-data/env_$(date +%Y%m%d_%H%M%S).bak
chmod 600 /backups/gateway-data/env_*.bak
```

### 3.3 Off-Server Upload (example: rclone to S3-compatible)

```bash
rclone copy /backups/ remote:watanybot-backups/ \
  --max-age 30d \
  --transfers 2 \
  --log-level INFO
```

### 3.4 Automation via Cron

```cron
# /etc/cron.d/watanybot-backup
# Run at 02:00 daily
0 2 * * * root /opt/watanybot/scripts/backup.sh >> /var/log/watanybot-backup.log 2>&1
```

---

## 4. Restore Procedures

### 4.1 Restore PostgreSQL

```bash
# Step 1: Stop the gateway (prevent writes during restore)
pm2 stop watany-gateway

# Step 2: Drop + recreate database
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -c "DROP DATABASE IF EXISTS watany;"
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -c "CREATE DATABASE watany;"

# Step 3: Restore from dump
PGPASSWORD=postgres pg_restore \
  -h localhost -p 5433 -U postgres \
  -d watany \
  /backups/postgres/watany_YYYYMMDD_HHMMSS.dump

# Step 4: Verify row counts
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres watany \
  -c "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"

# Step 5: Restart gateway
cd /opt/watany/current/apps/gateway-api
pm2 delete watany-gateway || true
pm2 start ecosystem.config.cjs --only watany-gateway --env production
```

### 4.2 Restore Gateway Data

```bash
# Stop gateway
pm2 stop watany-gateway

# Restore data folder
tar -xzf /backups/gateway-data/data_YYYYMMDD_HHMMSS.tar.gz \
  -C /opt/watany/current/apps/gateway-api/

# Restore .env if needed
cp /backups/gateway-data/env_YYYYMMDD_HHMMSS.bak \
  /opt/watany/current/apps/gateway-api/.env

# Restart gateway
cd /opt/watany/current/apps/gateway-api
pm2 delete watany-gateway || true
pm2 start ecosystem.config.cjs --only watany-gateway --env production

# Verify health
curl -s http://127.0.0.1:8015/health
```

### 4.3 Restore Knowledge Base (Tier 2)

If `kb.sqlite`, `runtime_kb.json`, or `kb_nodes.db` are corrupted:

```bash
# Option A: Restore from backup tarball
tar -xzf /backups/gateway-data/data_YYYYMMDD.tar.gz -C /opt/watany/current/apps/gateway-api/ data/kb/

# Option B: Rebuild from JSONL (slower, ~30 min)
cd /opt/watany/current
pnpm --dir apps/gateway-api exec tsx scripts/rebuild_runtime_kb.ts
# Then reload via admin endpoint:
curl -X POST http://127.0.0.1:8015/api/admin/kb/runtime-reload
```

---

## 5. Rollback Plan

### Code Rollback

```bash
# List recent tags / commits
git log --oneline -10

# Roll back to last known-good commit
git checkout <commit-sha>
cd /opt/watany/current/apps/gateway-api
pm2 restart watany-gateway --update-env

# Or roll back to a tagged release
git checkout tags/v1.0.0
cd /opt/watany/current/apps/gateway-api
pm2 restart watany-gateway --update-env
```

**Gap:** No release tags exist yet. First RC candidate should be tagged `v1.0.0-rc1`.

### Database Rollback

PostgreSQL supports no in-place rollback once rows are committed. The restore procedure (Section 4.1) is the rollback procedure. If a migration caused data corruption, restore from the dump taken immediately before the deploy.

**Recommendation:** Always take a fresh `pg_dump` immediately before running `RUN_PG_MIGRATIONS=true`. Add this to the deploy script.

### KB Rollback

The gateway stores KB versions in `apps/gateway-api/data/kb_versions/versions.json`. The admin endpoint `POST /api/admin/kb/versions/rollback` restores a prior version. This is the KB rollback path.

```bash
# Trigger KB rollback via API (admin auth required)
curl -X POST http://localhost:4000/api/admin/kb/versions/rollback \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"version": "2026-05-01T12:00:00.000Z"}'
```

---

## 6. Restore Test Procedure

**Must be run before RC shipment.**

```bash
# 1. Take a backup
/opt/watanybot/scripts/backup.sh

# 2. Record current state
curl -s http://localhost:4000/health
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres watany \
  -c "SELECT count(*) FROM users;"

# 3. Simulate data loss (on staging only — NOT production)
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres \
  -c "DROP DATABASE watany;"

# 4. Execute restore
# Follow Section 4.1 above

# 5. Verify restored state matches step 2
curl -s http://localhost:4000/health
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres watany \
  -c "SELECT count(*) FROM users;"
# Row count must match

# 6. Run gateway smoke test
curl -s http://localhost:4000/ready
curl -s http://localhost:4000/api/v2/faq?q=test
```

**Status:** This test has NOT been run. Must be run before RC.

---

## 7. Disaster Recovery Checklist

For complete server failure / data center incident:

```
[ ] 1. Provision new server (same OS, Node.js version, PostgreSQL version)
[ ] 2. Install system dependencies (node, pnpm, pm2, python3)
[ ] 3. Clone repository: git clone <repo-url> /var/www/watanybot
[ ] 4. Download latest backup from off-server storage (rclone / S3)
[ ] 5. Restore PostgreSQL (Section 4.1)
[ ] 6. Restore gateway data folder (Section 4.2)
[ ] 7. Copy .env with correct production secrets
[ ] 8. pnpm install --frozen-lockfile
[ ] 9. pm2 start ecosystem.config.cjs --env production
[ ] 10. pm2 startup && pm2 save
[ ] 11. Verify GET /health returns 200
[ ] 12. Verify GET /ready returns 200
[ ] 13. Run browser smoke: login → chat → salary → documents
[ ] 14. Update DNS / Nginx upstream if server IP changed
[ ] 15. Verify SSL certificate is valid
```

**Target RTO (Recovery Time Objective):** < 2 hours from detection to service restored  
**Target RPO (Recovery Point Objective):** < 24 hours (daily backup cadence)

---

## 8. Gaps & Required Actions Before RC

| Gap | Priority | Action |
|-----|---------|--------|
| No automated backup script exists | P0 | Create `scripts/backup.sh` and cron job |
| Restore procedure not tested on staging | P0 | Run restore drill (Section 6) |
| No release tags in Git | P1 | Tag RC candidate as `v1.0.0-rc1` before ship |
| Pre-deploy pg_dump not in deploy script | P1 | Add to deploy gate |
| No off-server backup configured | P1 | Set up rclone to object storage |
| `/backups/` directory not created on server | P1 | Provisioning step |
| RTO/RPO not formally agreed | P2 | Agree with stakeholders |
