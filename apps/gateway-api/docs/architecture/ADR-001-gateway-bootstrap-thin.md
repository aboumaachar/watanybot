# ADR-001: Gateway Bootstrap — Thin Server Entry Point

**Date:** 2026-05-10  
**Status:** Accepted  
**Deciders:** Architecture review (watanybot project)  
**Replaces:** Implicit monolith pattern in `server.ts`

---

## Context

`apps/gateway-api/src/server.ts` accumulated all gateway responsibilities over time:
route handlers, inline business logic, AI provider state, KB init, helper functions,
security hooks, and process lifecycle — all in one file.

At peak this file was **4,726 lines**. This made it:
- Hard to review (any change touched the same file)
- Hard to test (no isolation between concerns)
- Dangerous to modify (risk of side-effects across unrelated features)

---

## Decision

`server.ts` must only contain:

1. **Fastify instance creation** — one call to `Fastify()`
2. **Bootstrap module calls** — importing and calling functions from `bootstrap/`
3. **Route registration** — `app.register()` calls only, no route handler bodies
4. **Process lifecycle** — `app.listen()`, uncaughtException, unhandledRejection

All other concerns belong in dedicated modules.

---

## Bootstrap Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `bootstrap/helpers.ts` | Pure file-system utilities (loadJson, loadLocalSalariesKB, etc.) |
| `bootstrap/security.ts` | Security headers `onSend` hook |
| `bootstrap/ai-state.ts` | Mutable AI singleton state, getters/setters, `initAiState()` |
| `bootstrap/plugins.ts` | *(planned)* Fastify plugin registration (cookie, cors, compress, rate-limit) |
| `bootstrap/kb-bootstrap.ts` | *(planned)* KB store, vNext nodes, RAG chunks init |
| `bootstrap/circuit-breakers.ts` | *(planned)* Circuit breaker factory calls |
| `bootstrap/chat-bootstrap.ts` | *(planned)* `createChatService()` wiring |
| `bootstrap/routes.ts` | *(planned)* All `app.register()` calls in one place |
| `bootstrap/error-handler.ts` | *(planned)* `app.setErrorHandler()` |

---

## Route File Rules

- Every route group lives in `src/routes/<name>.ts` or a subdomain folder.
- Route files export a named async function: `export async function xyzRoutes(app: FastifyInstance): Promise<void>`
- No inline route bodies in `server.ts`.
- Two previously-inline routes extracted this session:
  - `routes/kb-attachments.ts` — `GET /kb/attachments/*`
  - `routes/admin-python-probe.ts` — `POST /api/admin/python/probe`

---

## Consequences

**Positive:**
- `server.ts` is readable in one screen
- Each concern is independently testable
- New features don't require touching the bootstrap entry point
- Easier code review (PRs touch focused files)

**Negative / Trade-offs:**
- More files to navigate (mitigated by clear naming)
- Import graph grows (acceptable — TypeScript resolves this)
- AI state is now module-level singleton (was local variable) — functionally equivalent but slightly more global

---

## Compliance Check

Run after every extraction:

```bash
pnpm --filter gateway-api typecheck
```

Target: `server.ts` under 250 lines (stretch: under 200).  
Current: **540 lines** (down from 642 at session start, 4,726 at baseline).
