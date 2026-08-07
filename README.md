# WatanyBot — Lebanese Army Knowledge Assistant

A monorepo with a **Vite + React** frontend, **Fastify** gateway API, and **FastAPI** Python backend.

## Architecture

| Service | Port | Stack | Description |
|---------|------|-------|-------------|
| `apps/web-user` | 5174 | React 18, TypeScript, Vite 5 | User-facing SPA with 14 pages |
| `apps/gateway-api` | 4000 | Fastify (Node.js) | BFF — 30+ REST endpoints |
| `apps/api-backend` | 8012 | FastAPI (Python) | KB search, WhatsApp simulation |
| `apps/web-admin` | 5175 | React | Ops dashboard |

## Quick Start

The canonical user-facing UI source is the top-level `apps/web-user` app. The nested `watan/apps/web-user` tree is a legacy mirror and should not be used as the default dev or deployment target.

Use the repo-pinned Node version before running gateway or KB tooling:

```bash
nvm use
```

This repo currently pins `20.11.1` in `.nvmrc`. On Windows, `apps/gateway-api` depends on `better-sqlite3` for local `kb_nodes.db` access, and that module failed under Node 25 during validation. If you switch Node versions or hit a native ABI mismatch, rebuild it from `apps/gateway-api`:

```bash
cd apps/gateway-api && npm rebuild better-sqlite3
```

```bash
# 1. Python backend
cd apps/api-backend && python -m uvicorn apps.api.main:app --port 8012

# 2. Gateway
cd apps/gateway-api && node --env-file=.env --import tsx src/server.ts

# 3. Web frontend
cd apps/web-user && pnpm dev
```

## Gateway Validation

Critical gateway verification commands:

```bash
# Typecheck the workspace
pnpm -r typecheck

# Family pension chat regression
pnpm --dir apps/gateway-api test --run src/tests/chat-relevance-regression.test.ts

# Validate smoke suite configs
pnpm --dir apps/gateway-api smoke:validate-configs

# Public edge smoke preset
pnpm --dir apps/gateway-api smoke:family-pension:public

# Death benefits and heirs smoke preset
pnpm --dir apps/gateway-api smoke:death-benefits:public

# Short financial queries smoke preset
pnpm --dir apps/gateway-api smoke:financial-short-queries:public

# Short medical queries smoke preset
pnpm --dir apps/gateway-api smoke:medical-short-queries:public

# Short administrative queries smoke preset
pnpm --dir apps/gateway-api smoke:admin-short-queries:public
```

Production runtime and deployment checks are documented in:

- [apps/gateway-api/docs/DEPLOYMENT_CHECKLIST.md](apps/gateway-api/docs/DEPLOYMENT_CHECKLIST.md)
- [apps/gateway-api/docs/PRODUCTION_RUNTIME.md](apps/gateway-api/docs/PRODUCTION_RUNTIME.md)

## Features

- **Chat** — SSE streaming with fallback POST, file upload, dictation, emoji, citations
- **Salary Calculator** — Lookup by rank + degree, full pension calculation
- **Transaction Search** — KB search with required docs, steps, legal basis
- **Cases** — Create/update personal military cases with checklists
- **Documents** — Upload and track personal documents and verification status
- **Notifications** — Notification center with read/unread management
- **Jobs** — Search and apply for military/civilian vacancies
- **Marketplace** — Buy/sell within the military community
- **Emergency Alerts** — Travel warnings and emergency situations
- **Profile** — Personal info management with login/logout
- **Settings** — Channel (web/WhatsApp), language, dictation, API config
- **Saved Chats** — Save important notes and conversations
- **Admin Dashboard** — System health, KPI cards, service probes, debug errors
- **Super Admin** — User management, audit logs, system controls

## Tech Stack

- React 18, TypeScript, Vite 5
- Fastify (Node.js gateway)
- FastAPI (Python backend)
- PostgreSQL (port 5433)
- SQLite v4 knowledge base (743 chunks)
- pnpm monorepo
- Arabic RTL interface with WhatsApp mode toggle

