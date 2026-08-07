# WatanBot - Quick Start Guide

## Overview

WatanBot is a production-ready bilingual (Arabic/English) chatbot system designed for municipalities. It features self-learning capabilities, an admin console for knowledge base management, and robust production operations.

## System Requirements

- **Docker** 20.10+ and Docker Compose 2.0+
- **Git**
- **Node.js** 18+ (for admin console)
- **Windows 11**, macOS, or Linux
- Minimum 4GB RAM, 10GB disk space

## Quick Installation

### Option 1: Automated Setup (Recommended)

**Linux/Mac/WSL:**
```bash
git clone <repository-url> watanbot
cd watanbot
./scripts/make_all.sh
```

**Windows PowerShell:**
```powershell
git clone <repository-url> watanbot
cd watanbot
.\scripts\make_all.ps1
```

This script will:
- ✅ Check prerequisites
- ✅ Create `.env` from template
- ✅ Start all services
- ✅ Run database migrations
- ✅ Seed superadmin user
- ✅ Perform health checks

### Option 2: Manual Setup

1. **Clone and Configure**
   ```bash
   git clone <repository-url> watanbot
   cd watanbot
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Start Services**
   ```bash
   docker compose -f infra/docker/docker-compose.yml up -d
   ```

3. **Run Migrations**
   ```bash
   docker compose -f infra/docker/docker-compose.yml exec api alembic upgrade head
   ```

4. **Seed Superadmin**
   ```bash
   docker compose -f infra/docker/docker-compose.yml exec api python seed.py
   ```

## Accessing Services

After setup completes:

- **API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Worker**: http://localhost:8001
- **PostgreSQL**: localhost:5432

### Admin Console

```bash
cd apps/admin-console
npm install
npm start
```

Then login with credentials from `.env`:
- Email: Value of `SUPERADMIN_EMAIL`
- Password: Value of `SUPERADMIN_PASSWORD`

## First Steps

### 1. Create Your First KB Card

Using the Admin Console:
1. Navigate to **KB Manager**
2. Click **+ New Card**
3. Fill in bilingual content (Arabic + English)
4. Save as draft
5. Review and click **Publish**

### 2. Test the Chat API

```bash
curl -X POST http://localhost:8000/chat/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Tell me about electricity billing",
    "lang": "en"
  }'
```

### 3. Search the Knowledge Base

```bash
curl "http://localhost:8000/kb/search?q=electricity&lang=en&limit=5"
```

## Common Operations

### View Logs
```bash
docker compose -f infra/docker/docker-compose.yml logs -f
# Or specific service:
docker compose -f infra/docker/docker-compose.yml logs -f api
```

### Stop Services
```bash
docker compose -f infra/docker/docker-compose.yml down
```

### Restart Services
```bash
docker compose -f infra/docker/docker-compose.yml restart
```

### Run Health Checks
```bash
./scripts/doctor.sh
```

### Create Backup
```bash
./scripts/backup.sh
```

## Troubleshooting

### API Not Starting
```bash
# Check logs
docker compose -f infra/docker/docker-compose.yml logs api

# Restart
docker compose -f infra/docker/docker-compose.yml restart api
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker compose -f infra/docker/docker-compose.yml ps postgres

# Check connection
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U watanbot -d watanbot -c "SELECT 1"
```

### Full-Text Search Not Working
```bash
# Verify FTS index exists
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U watanbot -d watanbot -c \
  "SELECT indexname FROM pg_indexes WHERE tablename = 'kb_cards'"
```

### Reset Everything
```bash
docker compose -f infra/docker/docker-compose.yml down -v
./scripts/make_all.sh
```

## Next Steps

- Read [Environment Variables](ENV.md) for configuration options
- Review [Operations Guide](OPERATIONS.md) for backup/restore procedures
- Check [KB Authoring Guide](KB_AUTHORING.md) for content best practices
- See [Security Guide](SECURITY.md) for production deployment

## Support

For issues:
1. Check logs: `docker compose logs -f`
2. Run doctor: `./scripts/doctor.sh`
3. Review documentation in `/docs`
4. Contact platform team

## Architecture Overview

```
┌─────────────────┐
│  Admin Console  │ (Electron + React)
│  (Windows/Mac)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│          FastAPI Backend            │
│  ┌──────────┬──────────┬─────────┐ │
│  │  Public  │  Admin   │SuperAdmn│ │
│  │  API     │  API     │  API    │ │
│  └──────────┴──────────┴─────────┘ │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────┐
│   PostgreSQL    │◄────►│  Worker  │
│  (FTS Enabled)  │      │  (Jobs)  │
└─────────────────┘      └──────────┘
```

## License

Proprietary - Municipality Internal Use
