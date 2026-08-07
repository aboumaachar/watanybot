# Service Ownership Matrix

> Generated 2026-03-08 — Phase 2 of Architecture Improvement Plan

## Endpoint Inventory

| Service | Total Routes | Direct | Proxy | WebSocket |
|---------|-------------|--------|-------|-----------|
| **Node Gateway** (port 4000) | 218 | 193 | 22 | 2 |
| **Python Backend** (port 8012) | 59 | 59 | 0 | 0 |

## Ownership by Domain

| Domain | Owner | Node Routes | Python Routes | Overlap Status |
|--------|-------|-------------|---------------|----------------|
| **Auth (user)** | Node | 5 | 0 | Clean |
| **Auth (admin)** | Python | 0 | 1 | Clean (different scope) |
| **Chat (user-facing)** | Node | 2+SSE | 0 | Resolved (ADR-003) |
| **Chat (v2 KB cards)** | Python | proxy | 1 | Proxy — correct |
| **Chat (WhatsApp)** | Python | 0 | 2 | Clean |
| **KB: RAG chunks** | Node | inline | 0 | Clean |
| **KB: Salary tables** | Node | 3 | 0 | Resolved (ADR-005) |
| **KB: vNext FTS5** | Node | 3 | 0 | Clean |
| **KB: v2 multi-domain** | Python | proxy | 8 | Proxy — correct |
| **KB: v3 procedures/law** | Python | 0 | 5 | Clean |
| **KB: public cards** | Python | 0 | 2 | Clean |
| **KB: admin cards** | Python | 0 | 6 | Clean |
| **KB: admin RAG/salary** | Node | 20 | 0 | Clean |
| **KB: admin studio** | Node | 11 | 0 | Clean |
| **Salary calculator** | Node | 3 | deprecated | Resolved (ADR-005) |
| **Intent classification** | Node | inline | deprecated | Resolved (ADR-003) |
| **Cases (user files)** | Node | 4 | deprecated | Resolved (ADR-006) |
| **Tickets (support)** | Python | proxy | 4 | Proxy — correct |
| **Feedback** | Split | 8 (admin) | 3 (capture) | Clean (different scope) |
| **Jobs** | Node | 8+8 | 0 | Clean |
| **Marketplace** | Node | 1 | 0 | Clean |
| **Emergency/Disaster** | Node | 10+1 | 0 | Clean |
| **Procedures** | Node | 8 | 0 | Clean |
| **Forms** | Node | 8 | 0 | Clean |
| **Documents** | Node | 3 | 0 | Clean |
| **Notifications** | Node | 3 | 0 | Clean |
| **Saved chats** | Node | 3 | 0 | Clean |
| **Profile** | Node | 3 | 0 | Clean |
| **Ticker** | Node | 5 | 0 | Clean |
| **Voice (TTS/STT)** | Node | 6 | 0 | Clean |
| **WhatsApp** | Python | 0 | 5 | Clean (ADR-008) |
| **Admin: AI training** | Node | 20 | 0 | Clean |
| **Admin: dashboard** | Node | 15 | 0 | Clean |
| **Admin: users** | Node | 8 | 0 | Clean |
| **Admin: mapping/review** | Python | 0 | 10 | Clean |
| **Admin: overview/health** | Node | 1+1 | 0 | Clean |
| **Superadmin** | Python | 0 | 5 | Clean |
| **Diagnostics** | Both | 4 | 1 | Expected (each service has own /health) |
| **Debug** | Node | 10 | 0 | Clean |
| **WebSocket** | Node | 2 | 0 | Clean |
| **MCP** | Node | 3 | 0 | Clean |
| **Elite features** | Node | 8 | 0 | Clean |
| **Analytics** | Node | 5 | 0 | Clean |
| **Search (unified)** | Node | 3 | 0 | Clean (federates internally) |

## Node → Python Proxy Routes (22 total)

All proxies go through [kb-v2-proxy.ts](../src/routes/kb-v2-proxy.ts):

| Node Route | Python Target | Domain |
|-----------|---------------|--------|
| `POST /api/v2/chat` | `POST /api/v2/chat` | KB v2 chat |
| `GET /api/v2/search` | `GET /api/v2/search` | KB v2 search |
| `POST /api/v2/intent` | `POST /api/v2/intent` | Intent classification |
| `POST /api/v2/salary/compute` | `POST /api/v2/salary/compute` | Salary (deprecated) |
| `POST /api/v2/tickets` | `POST /api/v2/tickets` | Create ticket |
| `GET /api/v2/tickets` | `GET /api/v2/tickets` | List tickets |
| `GET /api/v2/diagnostics` | `GET /api/v2/diagnostics` | Python health |

## Deprecation Schedule

| Endpoint | Service | Action | Timeline |
|----------|---------|--------|----------|
| `POST /api/v2/salary/compute` | Python | Add deprecation header | Immediate |
| `POST /api/v2/intent` | Python | Add deprecation header | 3 months |
| `/api/v1/cases/*` | Python | Remove placeholder | Immediate |
| `POST /chat/ask` | Python | Keep only for WhatsApp | n/a |
| `POST /api/chat` (Python alias) | Python | Keep only for WhatsApp | n/a |

## ADR Index

| ADR | Title | Key Decision |
|-----|-------|-------------|
| [ADR-001](ADR-001-gateway-decomposition.md) | Gateway Decomposition | Monolith → 25 modules |
| [ADR-002](ADR-002-module-ownership.md) | Module Ownership | Module boundary rules |
| [ADR-003](ADR-003-chat-ownership.md) | Chat Ownership | Node owns user-facing chat |
| [ADR-004](ADR-004-kb-search-ownership.md) | KB Search Ownership | Split by KB domain |
| [ADR-005](ADR-005-salary-ownership.md) | Salary Ownership | Node owns salary calc |
| [ADR-006](ADR-006-cases-tickets-ownership.md) | Cases & Tickets | Node=cases, Python=tickets |
| [ADR-007](ADR-007-admin-auth-ownership.md) | Admin & Auth | Node=auth+most admin |
| [ADR-008](ADR-008-whatsapp-voice-ownership.md) | WhatsApp & Voice | Python=WhatsApp, Node=voice |
