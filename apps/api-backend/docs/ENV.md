# Environment Variables Reference

Complete reference for all environment variables used in WatanBot.

## Database Configuration

### `POSTGRES_HOST`
- **Description**: PostgreSQL server hostname
- **Default**: `postgres`
- **Production**: Use managed database hostname (e.g., RDS endpoint)

### `POSTGRES_PORT`
- **Description**: PostgreSQL port
- **Default**: `5433`

### `POSTGRES_DB`
- **Description**: Database name
- **Default**: `watanbot`

### `POSTGRES_USER`
- **Description**: Database username
- **Default**: `watanbot`
- **Security**: Change in production

### `POSTGRES_PASSWORD`
- **Description**: Database password
- **Default**: `changeme`
- **Security**: **MUST** change in production. Use strong password (32+ chars)

## API Configuration

### `API_HOST`
- **Description**: Host to bind API server
- **Default**: `0.0.0.0`
- **Production**: Keep as `0.0.0.0` for container access

### `API_PORT`
- **Description**: Port for API server
- **Default**: `8000`

### `API_BASE_URL`
- **Description**: Public URL for the API
- **Default**: `http://localhost:8000`
- **Production**: Set to your public domain (e.g., `https://api.municipality.gov`)

### `ENVIRONMENT`
- **Description**: Runtime environment
- **Default**: `development`
- **Options**: `development`, `production`

## Authentication & Security

### `JWT_SECRET`
- **Description**: Secret key for JWT token signing
- **Default**: `changeme`
- **Security**: **REQUIRED** - Generate a secure random string (32+ characters)
- **Generate**: `openssl rand -hex 32`

### `JWT_ALGORITHM`
- **Description**: JWT signing algorithm
- **Default**: `HS256`
- **Options**: `HS256`, `HS384`, `HS512`

### `JWT_EXPIRES_MINUTES`
- **Description**: Token expiration time in minutes
- **Default**: `120` (2 hours)
- **Production**: Consider shorter for higher security

### `CORS_ORIGINS`
- **Description**: Comma-separated list of allowed CORS origins
- **Default**: `http://localhost:3000,http://localhost:5173,http://localhost:8000`
- **Production**: Restrict to your domains only
- **Example**: `https://admin.municipality.gov,https://api.municipality.gov`

## Superadmin Seed User

### `SUPERADMIN_EMAIL`
- **Description**: Email for initial superadmin account
- **Default**: `admin@watanbot.local`
- **Production**: Use real email address

### `SUPERADMIN_PASSWORD`
- **Description**: Password for initial superadmin account
- **Default**: `changeme`
- **Security**: **MUST** change immediately in production

## Operations

### `AUTO_APPROVE`
- **Description**: Skip confirmation prompts in scripts
- **Default**: `false`
- **Options**: `true`, `false`
- **Usage**: Set to `true` for automated deployments only

### `RETENTION_DAYS_CHAT`
- **Description**: Number of days to retain chat logs
- **Default**: `180` (6 months)
- **Compliance**: Adjust based on data retention policies

### `BACKUP_DIR`
- **Description**: Directory for database backups
- **Default**: `./backups`
- **Production**: Use mounted volume or external storage

### `MAX_BACKUPS`
- **Description**: Maximum number of backups to retain
- **Default**: `30`

## KB v3 (SQLite)

### `KB_SQLITE_PATH`
- **Description**: SQLite KB file path inside container
- **Default**: `/data/kb.sqlite`

### `KB_SQLITE_PATH_HOST`
- **Description**: Host path to SQLite KB file (docker bind mount)
- **Default**: `./data/kb.sqlite`

### `USE_SQLITE_V3_KB`
- **Description**: Use SQLite v3 KB as primary source
- **Default**: `true`

### `LEGACY_POSTGRES_KB_FALLBACK`
- **Description**: Allow legacy Postgres KB fallback
- **Default**: `false`

### `SQLITE_CONFIDENCE_THRESHOLD`
- **Description**: Minimum score to accept a match
- **Default**: `0.25`

### `SQLITE_AMBIGUITY_DELTA`
- **Description**: Ambiguity threshold between top two scores
- **Default**: `0.05`

## Worker Configuration

### `WORKER_SCHEDULE_MAINTENANCE`
- **Description**: Cron schedule for database maintenance
- **Default**: `0 2 * * *` (2 AM daily)
- **Format**: Standard cron format

### `WORKER_SCHEDULE_METRICS`
- **Description**: Cron schedule for metrics collection
- **Default**: `0 * * * *` (every hour)

## Rate Limiting

### `RATE_LIMIT_PER_MINUTE`
- **Description**: Maximum API requests per minute per IP
- **Default**: `60`
- **Production**: Adjust based on expected traffic

### `RATE_LIMIT_BACKEND`
- **Description**: Rate limiting backend (pluggable)
- **Default**: `memory`
- **Options**: `memory`, `redis`

### `RATE_LIMIT_REDIS_URL`
- **Description**: Redis connection URL for distributed rate limiting
- **Default**: *(empty)*
- **Required**: When `RATE_LIMIT_BACKEND=redis`
- **Example**: `redis://localhost:6379/0`

## Logging

### `LOG_LEVEL`
- **Description**: Logging verbosity
- **Default**: `INFO`
- **Options**: `DEBUG`, `INFO`, `WARNING`, `ERROR`
- **Production**: Use `INFO` or `WARNING`

### `LOG_JSON`
- **Description**: Output logs in JSON format
- **Default**: `true`
- **Options**: `true`, `false`
- **Production**: Keep `true` for log aggregation

## Production Environment Example

```bash
# Database (Managed PostgreSQL)
POSTGRES_HOST=db.example.rds.amazonaws.com
POSTGRES_PORT=5432
POSTGRES_DB=watanbot_prod
POSTGRES_USER=watanbot_prod
POSTGRES_PASSWORD=<strong-random-password>

# API
API_HOST=0.0.0.0
API_PORT=8000
API_BASE_URL=https://api.municipality.gov

# Security
JWT_SECRET=<generate-with-openssl-rand-hex-32>
JWT_EXPIRES_MINUTES=60
CORS_ORIGINS=https://admin.municipality.gov,https://municipality.gov

# Admin
SUPERADMIN_EMAIL=admin@municipality.gov
SUPERADMIN_PASSWORD=<strong-password-change-after-first-login>

# Operations
AUTO_APPROVE=false
RETENTION_DAYS_CHAT=180
BACKUP_DIR=/mnt/backups
MAX_BACKUPS=90

# Performance
RATE_LIMIT_PER_MINUTE=120
RATE_LIMIT_BACKEND=redis
RATE_LIMIT_REDIS_URL=redis://redis:6379/0

# Logging
LOG_LEVEL=INFO
LOG_JSON=true
```

## Security Best Practices

1. **Never commit `.env` to version control**
2. **Rotate JWT_SECRET regularly** (every 90 days)
3. **Use environment-specific values** (dev/staging/prod)
4. **Store secrets in secret management** (AWS Secrets Manager, Azure Key Vault, etc.)
5. **Limit CORS_ORIGINS** to only necessary domains
6. **Use strong passwords** for database and admin accounts
7. **Enable SSL/TLS** in production (terminate at load balancer or reverse proxy)
8. **Monitor for suspicious activity** via audit logs

## Validation Checklist

Before production deployment:

- [ ] Changed `POSTGRES_PASSWORD` from default
- [ ] Generated new `JWT_SECRET`
- [ ] Changed `SUPERADMIN_PASSWORD` from default
- [ ] Updated `CORS_ORIGINS` to production domains
- [ ] Set `API_BASE_URL` to production URL
- [ ] Configured `BACKUP_DIR` to persistent storage
- [ ] Adjusted `RATE_LIMIT_PER_MINUTE` for traffic
- [ ] Set `LOG_LEVEL` to `INFO` or `WARNING`
- [ ] Verified all endpoints use HTTPS
