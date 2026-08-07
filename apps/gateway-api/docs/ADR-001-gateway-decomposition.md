# ADR-001: Gateway Decomposition — Extract modules from server.ts

| Field       | Value                                          |
|-------------|------------------------------------------------|
| Status      | Accepted                                       |
| Date        | 2026-03-10                                     |
| Driver      | server.ts grew to ~4,139 lines — unmaintainable|
| Deciders    | Architecture Team                              |

## Context

`apps/gateway-api/src/server.ts` is the single entry-point for the Fastify gateway API.
Over successive sprints it accumulated:

- 50+ inline route handlers
- 10 in-memory / plugin-DB tables
- 3 chat pipelines (legacy, AI, streaming SSE)
- Voice E2E background jobs with alerting
- Salary calculator endpoints with KB lookup
- KB v2 Python-proxy layer (8 endpoints)
- KB vNext FTS5 search (3 endpoints)
- Small-talk classifier, emotional scoring, content moderation
- Seed / mock data and type definitions

At ~4,139 lines the file exceeded every reasonable threshold for a single module.

## Decision

Extract server.ts into ≤500-line modules following the Fastify `FastifyPluginAsync` pattern.

### Extraction Map

| New module                    | Lines removed | Responsibility                            |
|-------------------------------|---------------|-------------------------------------------|
| `types/domain.ts`             | ~170          | Domain types shared across modules        |
| `lib/helpers.ts`              | ~100          | makeId, normalizeText, requireAuth, mappers|
| `lib/intent-classifier.ts`   | ~60           | Small-talk fast-path classifier           |
| `lib/emotional.ts`           | ~40           | Emotional score + empathy injection       |
| `lib/versioning.ts`          | ~60           | KB file versioning (copy-on-write)        |
| `lib/unrecognized.ts`        | ~30           | Unrecognized input logging                |
| `lib/config.ts`              | ~100          | All env-var parsing centralized           |
| `lib/chat-service.ts`        | ~350          | Chat pipeline (legacy/AI/RAG)             |
| `lib/voice-e2e.ts`           | ~280          | Voice E2E background job + alerting       |
| `data/seed-data.ts`          | ~120          | Mock/seed data                            |
| `db/plugin-db.ts`            | ~200          | Plugin DB (better-sqlite3 + in-memory)    |
| `routes/profile.ts`          | ~80           | Profile CRUD                              |
| `routes/history.ts`          | ~80           | Chat history endpoints                    |
| `routes/chat-sessions.ts`    | ~100          | Hybrid human/AI chat sessions             |
| `routes/notifications.ts`    | ~70           | Notification CRUD with auth               |
| `routes/saved-chats.ts`      | ~60           | Saved chats list/create/delete            |
| `routes/plugins.ts`          | ~160          | Jobs, marketplace, emergency              |
| `routes/kb-v2-proxy.ts`      | ~160          | 8 KB v2 Python-proxy endpoints            |
| `routes/kb-vnext.ts`         | ~55           | 3 KB vNext FTS5 routes                    |
| `routes/ticker.ts`           | ~100          | Ticker / suggestions                      |
| `routes/tx.ts`               | ~35           | Transaction search/detail (demo)          |
| `routes/forms-inline.ts`     | ~45           | Forms catalog routes                      |
| `routes/admin-overview.ts`   | ~120          | Admin health dashboard                    |
| `routes/salary-inline.ts`    | ~160          | v4 pension calculator (3 endpoints)       |
| `routes/chat.ts`             | ~320          | POST /api/chat + /api/chat/stream (SSE)   |

**Total extracted: ~3,100 lines across 25 modules.**

## Consequences

- server.ts can be reduced to a ~200-line bootstrap file
- Each module is independently testable via `app.register()`
- Team members have clear ownership boundaries
- Dependency injection via Fastify options pattern keeps modules decoupled

## Risks

- Circular dependency possible if modules import each other → mitigated by injecting deps through options
- Runtime behavior must be verified via integration tests before removing inline code from server.ts
