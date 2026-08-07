# WatanBot Audit — Gap Report

Date: 2026-02-04

## What exists

### Backend framework and entrypoints
- FastAPI backend with routers mounted in [apps/api/main.py](apps/api/main.py)
- Public endpoints in [apps/api/routers/public.py](apps/api/routers/public.py)
- Admin endpoints in [apps/api/routers/admin.py](apps/api/routers/admin.py)
- Superadmin endpoints in [apps/api/routers/superadmin.py](apps/api/routers/superadmin.py)
- Background worker with scheduled jobs in [apps/worker/main.py](apps/worker/main.py)

### Database usage
- PostgreSQL via SQLAlchemy; DB settings in [apps/api/config.py](apps/api/config.py)
- Alembic migration scaffold in [apps/api/alembic](apps/api/alembic)
- KB is stored as `kb_cards` with PostgreSQL FTS (TSVECTOR) in [apps/api/models.py](apps/api/models.py)

### Existing endpoints (high level)
- Health: `GET /health`
- KB search: `GET /kb/search`
- KB card fetch: `GET /kb/card/{card_id}`
- Chat: `POST /chat/ask`
- Admin KB CRUD + feedback queue
- Superadmin doctor/backup/restore/metrics/audit

### Admin UI tooling
- React + Electron admin console in [apps/admin-console](apps/admin-console)
- Pages for KB management, editor, feedback queue, and superadmin panel

### Ops / scripts / compose
- Docker compose in [infra/docker/docker-compose.yml](infra/docker/docker-compose.yml)
- Doctor/backup/restore shell scripts in [scripts](scripts)

### Existing KB files or migrations
- No SQLite KB file found in repo
- No SQLite v3 schema or loader exists

## What is missing (against target spec)

### Core KB v3 (SQLite file-based)
- No SQLite KB v3 file present (expected `retired_military_chatbot_kb_v3_with_ndlaw.sqlite` or `/data/kb.sqlite`)
- Required tables are absent: `transactions`, `tx_fts`, `tx_links`, `law_sources`, `law_articles`, `law_fts`, `tx_law_map`
- No SQLite FTS query support (`MATCH`) wired for procedures or law articles

### Retrieval capabilities
- No procedure search via `tx_fts MATCH`
- No procedure details endpoint fields (required docs, submission location, steps/notes, related procedures)
- No law article search via `law_fts MATCH`
- No next-step suggestions from `tx_links`
- No law basis resolution (`tx_law_map` → `law_articles`)

### Chat behavior
- Chat is Postgres KB-only; does not use SQLite KB v3
- Chat replies do not cite `tx_no` or `article_no`
- Deterministic KB-first behavior not enforced for law/procedure content

### Admin tooling
- No mapping review/edit UI for procedure ↔ law
- No CSV import/export for KB v3
- No KB diagnostics for SQLite v3

### Controlled learning
- Feedback queue exists, but no governance layer for KB v3 mapping edits
- No explicit “no autonomous KB edits” guardrails for v3 (only Postgres cards)

### Ops
- Ops scripts target Postgres only; no SQLite KB integrity checks
- No repeatable v3 KB validation tooling

## Bugs & broken flows
- Duplicate route definition for `GET /admin/chat/sessions` in [apps/api/routers/admin.py](apps/api/routers/admin.py) (the second definition overrides the first)
- Default credentials/secrets are hardcoded in config and env templates (see [apps/api/config.py](apps/api/config.py))

## Data model gaps
- Current KB schema is `kb_cards` (Postgres JSONB) rather than required v3 SQLite schema
- Missing law/procedure entities and mapping tables required by spec

## Endpoint gaps
- Missing endpoints for:
  - Procedure search via SQLite FTS
  - Procedure detail with docs/steps/notes/links
  - Law article search via SQLite FTS
  - Suggested next steps via `tx_links`
  - Procedure ↔ law mapping retrieval

## Admin gaps
- No admin tools to review/edit tx-law mappings
- No CSV import/export for v3 schema
- No diagnostics view for v3 KB health

## Ops gaps
- No repo-level audit/doctor for SQLite v3 KB
- Existing doctor checks only validate Postgres FTS and `kb_cards`

## Testing gaps
- Tests assume Postgres and `kb_cards` only
- No tests for SQLite v3 schema, FTS MATCH, or mapping resolution

## Security risks / findings
- Default secrets present in repo and config defaults (`JWT_SECRET`, `SUPERADMIN_PASSWORD`, `POSTGRES_PASSWORD`)
- In-memory rate limiting only (non-distributed)
- No explicit audit checks for least-privilege tokens or scoped API keys
