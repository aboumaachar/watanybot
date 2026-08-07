# Operations Guide

Comprehensive guide for operating and maintaining WatanBot in production.

## Table of Contents

1. [Health Monitoring](#health-monitoring)
2. [Backup & Restore](#backup--restore)
3. [Maintenance Tasks](#maintenance-tasks)
4. [Troubleshooting](#troubleshooting)
5. [Scaling](#scaling)
6. [Security Operations](#security-operations)

## Health Monitoring

### Running Doctor Checks

The doctor script performs comprehensive system health checks:

```bash
./scripts/doctor.sh
```

### KB Audit (Step 3 Readiness)

Run the KB audit wrapper:

```bash
./scripts/kb_audit.sh
```

Exit codes:
- 0: Ready
- 2: Warnings (usable but needs attention)
- 4: Errors (not ready for Step 3)

Outputs:
- docs/KB_AUDIT_REPORT.md
- docs/KB_STEP3_READINESS.md

Checks performed:
- ✅ API health
- ✅ Database connection
- ✅ Full-text search index
- ✅ Published KB cards
- ✅ Worker service
- ✅ Disk space

### Automated Monitoring

Use the superadmin API for monitoring integrations:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/superadmin/doctor
```

Response includes:
```json
{
  "overall_status": "ok|warning|error",
  "checks": [
    {
      "check": "database_connection",
      "status": "ok",
      "message": "Database connection successful"
    }
  ],
  "timestamp": "2026-02-01T12:00:00Z"
}
```

### Setting Up Alerts

**Prometheus/Grafana:**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'watanbot'
    metrics_path: '/superadmin/metrics'
    static_configs:
      - targets: ['api:8000']
```

**Uptime Monitoring:**
- Monitor `/health` endpoint (should return 200)
- Alert on 3+ consecutive failures
- Check every 60 seconds

## Backup & Restore

### Creating Backups

**Manual Backup:**
```bash
./scripts/backup.sh
```

Backups include PostgreSQL dump and the SQLite KB file (if present).

Output:
```
Creating database backup...
Target: ./backups/watanbot_20260201_120000.tar.gz
✓ Backup created successfully
  File: ./backups/watanbot_20260201_120000.tar.gz
  Size: 45M
```

**Automated Backups (Cron):**
```bash
# Daily backup at 3 AM
0 3 * * * cd /path/to/watanbot && ./scripts/backup.sh >> /var/log/watanbot-backup.log 2>&1
```

**Using Superadmin API:**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/superadmin/backup
```

### Restoring from Backup

**Latest Backup:**
```bash
./scripts/restore.sh
```

**Specific Backup:**
```bash
./scripts/restore.sh backups/watanbot_20260201_120000.tar.gz
```

**Non-Interactive (for automation):**
```bash
AUTO_APPROVE=true ./scripts/restore.sh backups/watanbot_20260201_120000.tar.gz
```

⚠️ **Warning**: Restore will replace the current database. Always backup first!

### Backup Retention

Backups are automatically cleaned based on `MAX_BACKUPS` (default: 30).

To manually clean old backups:
```bash
# Keep only last 10 backups
ls -t backups/watanbot_*.tar.gz | tail -n +11 | xargs rm -f
```

### Off-Site Backup

**AWS S3:**
```bash
# After creating backup
aws s3 cp backups/watanbot_$(date +%Y%m%d_%H%M%S).tar.gz \
  s3://your-bucket/watanbot-backups/
```

**Azure Blob Storage:**
```bash
az storage blob upload \
  --account-name youraccount \
  --container-name watanbot-backups \
  --file backups/watanbot_20260201_120000.tar.gz \
  --name watanbot_20260201_120000.tar.gz
```

## Maintenance Tasks

### Database Maintenance

The worker service automatically runs maintenance tasks:

1. **VACUUM ANALYZE** - Daily at 2 AM (configurable via `WORKER_SCHEDULE_MAINTENANCE`)
2. **Prune old chat logs** - Daily at 3 AM (based on `RETENTION_DAYS_CHAT`)
3. **Collect metrics** - Hourly (configurable via `WORKER_SCHEDULE_METRICS`)

**Manual Maintenance:**
```bash
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U watanbot -d watanbot -c "VACUUM ANALYZE kb_cards;"
```

### Updating the System

**Pull Latest Changes:**
```bash
git pull origin main
```

**Rebuild and Deploy:**
```bash
docker compose -f infra/docker/docker-compose.yml down
docker compose -f infra/docker/docker-compose.yml up -d --build
```

**Run New Migrations:**
```bash
docker compose -f infra/docker/docker-compose.yml exec api alembic upgrade head
```

### Log Rotation

**Docker Logs:**
```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

**Application Logs:**
Logs are output to stdout/stderr and captured by Docker. Use log aggregation service (ELK, Splunk, CloudWatch) for production.

## Troubleshooting

### Common Issues

#### 1. API Not Responding

**Symptoms**: `/health` endpoint returns 500 or timeout

**Steps**:
```bash
# Check if container is running
docker ps | grep watanbot-api

# Check logs
docker compose -f infra/docker/docker-compose.yml logs api --tail=100

# Check database connection
docker compose -f infra/docker/docker-compose.yml exec api \
  python -c "from database import engine; engine.connect()"

# Restart API
docker compose -f infra/docker/docker-compose.yml restart api
```

#### 2. Full-Text Search Not Working

**Symptoms**: KB search returns no results

**Steps**:
```bash
# Verify FTS index exists
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U watanbot -d watanbot -c \
  "SELECT indexname FROM pg_indexes WHERE tablename = 'kb_cards'"

# Rebuild FTS index
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U watanbot -d watanbot -c \
  "REINDEX INDEX ix_kb_cards_fts;"

# Update FTS vectors
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U watanbot -d watanbot -c \
  "UPDATE kb_cards SET updated_at = NOW();"
```

#### 3. Out of Disk Space

**Steps**:
```bash
# Check disk usage
df -h

# Clean old backups
ls -lh backups/

# Clean Docker volumes
docker system prune -a --volumes

# Adjust retention policy
# Edit .env: RETENTION_DAYS_CHAT=90
```

#### 4. High Memory Usage

**Steps**:
```bash
# Check memory usage
docker stats

# Increase PostgreSQL connection limits
# Edit docker-compose.yml: command: ["-c", "max_connections=200"]

# Reduce worker frequency
# Edit .env: WORKER_SCHEDULE_METRICS=0 */3 * * *
```

### Emergency Procedures

#### Complete System Reset

```bash
# 1. Create backup
./scripts/backup.sh

# 2. Stop all services
docker compose -f infra/docker/docker-compose.yml down -v

# 3. Clean everything
docker system prune -a --volumes -f

# 4. Restart from scratch
./scripts/make_all.sh

# 5. Restore data if needed
./scripts/restore.sh backups/watanbot_YYYYMMDD_HHMMSS.tar.gz
```

#### Database Corruption Recovery

```bash
# 1. Stop services
docker compose -f infra/docker/docker-compose.yml down

# 2. Start only PostgreSQL
docker compose -f infra/docker/docker-compose.yml up -d postgres

# 3. Check integrity
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U watanbot -d watanbot -c "VACUUM FULL ANALYZE;"

# 4. If corruption found, restore from backup
./scripts/restore.sh

# 5. Restart all services
docker compose -f infra/docker/docker-compose.yml up -d
```

## Scaling

### Horizontal Scaling

**API Scaling:**
```yaml
# docker-compose.yml
services:
  api:
    deploy:
      replicas: 3
```

Add load balancer (Nginx, HAProxy, AWS ALB) in front.

**Database Scaling:**
- Use read replicas for search queries
- Consider managed PostgreSQL (RDS, Azure Database)

### Vertical Scaling

**Increase Container Resources:**
```yaml
# docker-compose.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

### Performance Tuning

**PostgreSQL:**
```ini
# postgresql.conf
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
max_connections = 200
```

**API Rate Limiting:**
```bash
# .env
RATE_LIMIT_PER_MINUTE=200
```

## Security Operations

### Rotating JWT Secret

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. Update .env
echo "JWT_SECRET=$NEW_SECRET" >> .env

# 3. Restart API (invalidates existing tokens)
docker compose -f infra/docker/docker-compose.yml restart api

# 4. Notify users to re-login
```

### Reviewing Audit Logs

```bash
# Recent admin actions
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/superadmin/audit?limit=100"

# Specific action type
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/superadmin/audit?action=kb_card_publish"
```

### Access Control Review

```bash
# List all users
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U watanbot -d watanbot -c \
  "SELECT email, role, is_active, created_at FROM users ORDER BY created_at DESC;"
```

### Security Patching

```bash
# Update base images
docker compose -f infra/docker/docker-compose.yml pull

# Rebuild with latest security patches
docker compose -f infra/docker/docker-compose.yml up -d --build
```

## Monitoring Dashboard

Create a simple monitoring dashboard using the metrics endpoint:

```bash
#!/bin/bash
# monitor.sh
while true; do
  clear
  echo "=== WatanBot Status ==="
  echo "Time: $(date)"
  echo ""
  
  # Health check
  if curl -sf http://localhost:8000/health > /dev/null; then
    echo "✓ API: Healthy"
  else
    echo "✗ API: Down"
  fi
  
  # Metrics (requires auth)
  echo ""
  echo "Metrics: (run with TOKEN=<jwt> ./monitor.sh)"
  if [ -n "$TOKEN" ]; then
    curl -sf -H "Authorization: Bearer $TOKEN" \
      http://localhost:8000/superadmin/metrics | jq .
  fi
  
  sleep 30
done
```

Run with: `TOKEN=<your-jwt-token> ./monitor.sh`
