# ADR-007: Admin & Auth Ownership

## Status
Accepted — 2026-03-08

## Context
Admin and auth are split across both services:

### Auth
- **Node gateway**: Full JWT auth (`/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`) — user registration, PBKDF2 hashing, JWT access+refresh tokens, RBAC roles.
- **Python backend**: `/auth/login` — admin-only login for KB management dashboard.

### Admin
- **Node gateway**: 82 admin routes spanning KB management, AI training, user management, dashboard, analytics, voice, ticker, rules, experiments, KPIs.
- **Python backend**: 18 admin routes for KB cards, feedback queue, mapping, review workflow.

## Decision
**Node gateway** is the authoritative auth provider. Admin is **split by domain:**

| Admin Domain | Owner | Reason |
|-------------|-------|--------|
| User auth (JWT, sessions, RBAC) | **Node** | Gateway controls all auth |
| User management | **Node** | Role/status changes, audit log |
| AI training & feedback | **Node** | AI modules live in Node |
| KB salary/RAG management | **Node** | Node owns salary KB + RAG |
| Dashboard, analytics, KPIs | **Node** | Aggregates from all sources |
| Voice admin | **Node** | Voice E2E lives in Node |
| KB card lifecycle (draft→published) | **Python** | Card workflow with versioning |
| Feedback → KB auto-edit | **Python** | Feedback resolution tied to cards |
| Procedure review workflow | **Python** | Cross-references law articles |
| Mapping (tx_no↔article) | **Python** | Structured legal data |
| Backup/restore (pg_dump) | **Python** | Direct PostgreSQL access |

- Python's `/auth/login` is kept for admin-only access to Python dashboard, but must validate against the same user store (or accept Node-issued JWTs).

## Consequences
- Node is the single auth issuer for the entire system.
- Python admin routes remain for KB card and legal/review workflows.
- No duplicate user management.
