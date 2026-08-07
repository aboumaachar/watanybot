# WatanyBot Reconstruction Automation

## Overview

Automated parallel execution of all 8 reconstruction phases from the Complete Reconstruction Plan. Each phase runs as an independent PowerShell job, producing structured JSON reports that feed into a unified dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              reconstruct.ps1 (Orchestrator)          │
│                                                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Phase 0  │ │ Phase 1  │ │ Phase 2  │ │ Phase 3  │  │
│  │  Audit   │ │ Found.   │ │ Backend  │ │Frontend  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │            │            │            │         │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐  │
│  │ Phase 4  │ │ Phase 5  │ │ Phase 6  │ │ Phase 7  │  │
│  │ Integr.  │ │ Testing  │ │ Deploy   │ │ Monitor  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       └────────┬───┘───────┬────┘────────┬───┘         │
│                ▼                         ▼              │
│     reconstruction-reports/       dashboard.html        │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

```powershell
# Run all 8 phases in parallel (default)
.\scripts\reconstruction\reconstruct.ps1

# Run with auto-fix enabled
.\scripts\reconstruction\reconstruct.ps1 -Fix

# Quick mode (phases 0-3 only)
.\scripts\reconstruction\reconstruct.ps1 -Mode quick

# Full deep scan with live tests
.\scripts\reconstruction\reconstruct.ps1 -LiveTest -RunTests -SecurityScan

# Generate HTML dashboard from reports
.\scripts\reconstruction\generate-dashboard.ps1
```

## Modes

| Mode         | Phases | Description                              |
|------------- |--------|------------------------------------------|
| `parallel`   | 0–7    | All phases run simultaneously (default)  |
| `sequential` | 0–7    | Phases execute one-by-one in order        |
| `audit-only` | 0      | Only run the comprehensive audit          |
| `quick`      | 0–3    | Fast scan: audit + foundation + code      |

## Flags

| Flag            | Effect                                        |
|-----------------|-----------------------------------------------|
| `-Fix`          | Auto-install deps, create missing directories  |
| `-LiveTest`     | Start gateway and test live endpoints          |
| `-RunTests`     | Execute vitest unit test suites                |
| `-RunE2E`       | Execute Playwright E2E tests                   |
| `-SecurityScan` | Run npm audit + secrets scan                   |

## Phase Details

### Phase 0: Comprehensive Audit
- Infrastructure (Node, pnpm, Python, Git, Docker)
- Codebase stats (file counts, LOC, app inventory)
- Database & KB (SQLite, RAG chunks, migrations)
- API route analysis
- Dependency audit
- Frontend component inventory
- Test infrastructure
- Deployment readiness

### Phase 1: Foundation
- Node.js >= 18 verification
- pnpm installation check
- Python environment
- node_modules for all workspaces
- Config file validation (8 config files)
- Directory structure (21 required dirs)
- TypeScript compilation check

### Phase 2: Backend
- Core server structure (CORS, compression, rate limiting)
- Authentication (middleware, routes, RBAC, passwords)
- Knowledge Base (KB modules, search, @watany/kb)
- AI integration (providers, RAG, multi-provider)
- Route modules (salary, admin, search, etc.)
- Content filters & moderation
- WebSocket & admin interventions
- Database layer (migrations, persistence, seed)
- Python backend (api-backend, FastAPI)

### Phase 3: Frontend
- Setup (package.json, vite, tsconfig)
- Design system (CSS vars, Cairo font, RTL)
- Pages (14 required pages)
- Components (10+ required components)
- State management (React Context)
- API client wiring
- Type definitions
- TypeScript compilation

### Phase 4: Integration
- API client ↔ gateway path alignment
- Environment configuration
- CORS setup
- Shared types consistency
- Auth flow (login, token, logout)
- WebSocket integration
- Live endpoint tests (optional)

### Phase 5: Testing
- Test infrastructure (vitest, playwright, supertest)
- Test file inventory
- Coverage area analysis (10 areas)
- Security checks (secrets scan, .gitignore)
- Performance baseline
- Optional: npm audit, test execution

### Phase 6: Deployment
- Docker (compose, Dockerfile, multi-stage, healthchecks)
- PM2 (ecosystem config, memory limits, logs)
- Nginx (proxy, SSL, gzip, security headers)
- Environment templates
- Build scripts
- Monitoring (Prometheus, Grafana)
- Documentation

### Phase 7: Monitoring
- Health endpoints (health, readiness, liveness)
- Logging (Fastify logger, PM2 logs)
- Prometheus metrics
- Grafana dashboards
- Error tracking (handlers, circuit breaker, ErrorBoundary)
- Admin monitoring console (WebSocket, interventions)
- Backup & recovery

## Output

Reports are saved to `reconstruction-reports/`:

```
reconstruction-reports/
├── MASTER_REPORT.json        # Unified summary
├── phase0-audit.json
├── phase1-foundation.json
├── phase2-backend.json
├── phase3-frontend.json
├── phase4-integration.json
├── phase5-testing.json
├── phase6-deployment.json
├── phase7-monitoring.json
└── dashboard.html            # Interactive HTML dashboard
```

## Scoring

Each phase produces a pass rate (0-100%). The overall readiness score is the average across all phases.

| Score Range | Status | Meaning                          |
|-------------|--------|----------------------------------|
| 80-100%     | PASS   | Production-ready                 |
| 50-79%      | WARN   | Needs attention                  |
| 0-49%       | FAIL   | Significant work required        |
