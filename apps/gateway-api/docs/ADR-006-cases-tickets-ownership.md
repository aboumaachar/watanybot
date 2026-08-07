# ADR-006: Cases & Tickets Ownership

## Status
Accepted — 2026-03-08

## Context
Both services implement cases/tickets:

- **Node gateway**: `/api/cases` CRUD (4 routes) — uses in-memory pluginDb (better-sqlite3/in-memory). Full lifecycle: create, list, update status/checklist, delete.
- **Python backend**: `/api/v1/cases/*` (3 routes) — placeholder implementation (create, status, recent). Also `/api/v2/tickets` CRUD (4 routes) — support tickets with assignment and status tracking.

The Node implementation is more mature for user-facing cases. Python tickets serve a different purpose (support/escalation workflow tied to KB feedback).

## Decision
**Split by purpose:**

| Feature | Owner | Reason |
|---------|-------|--------|
| User case files | **Node** | In-memory → planned PostgreSQL migration; user-facing CRUD |
| Support tickets (v2) | **Python** | Tied to KB feedback resolution workflow |
| Cases placeholder (v1) | **Deprecated** | Python's `/api/v1/cases/*` routes are removed |

- Node's `/api/cases` is authoritative for user case management.
- Python's `/api/v2/tickets` is authoritative for internal support/escalation tickets.
- Python's `/api/v1/cases/*` placeholder is deprecated and will be removed.

## Consequences
- Clear separation: "cases" = user's personal files (Node), "tickets" = support workflow (Python).
- No overlapping CRUD operations.
- Future: Node cases migrate from in-memory to PostgreSQL.
