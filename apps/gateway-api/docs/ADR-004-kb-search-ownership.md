# ADR-004: KB Search Ownership

## Status
Accepted — 2026-03-08

## Context
Knowledge base search is implemented in both services:

- **Node gateway**: FTS5 search via `kb-nodes` module (`/api/kb-nodes/search`), RAG chunk retrieval (1,504 chunks in `ai/rag.ts`), unified search (`/api/search/unified`), and KB v2 proxy to Python.
- **Python backend**: SQLite FTS5 via `kb_v3.py` (`/api/procedures/search`, `/api/law/search`), KB v2 multi-domain search (`/api/v2/search`), and public card search (`/kb/search`).

Each service has its own SQLite databases and search indexes.

## Decision
**Split ownership by KB domain:**

| KB Domain | Owner | Reason |
|-----------|-------|--------|
| RAG chunks (JSONL, 1,504 items) | **Node** | Used for AI chat context, loaded in-memory |
| Salary KB (303 entries) | **Node** | Pre-computed tables, in-memory lookup |
| KB vNext nodes (FTS5) | **Node** | `kb_nodes.db`, served directly |
| KB v2 multi-domain (cards) | **Python** | SQLite v3 with FTS5, admin workflows |
| Procedures & Law articles | **Python** | `kb_v3.py`, structured data with cross-references |
| Public KB cards | **Python** | Published card lifecycle (draft→published→archived) |

- Node proxies to Python for v2 search via existing `/api/v2/search` endpoint.
- Node does NOT duplicate Python's procedure/law search.
- Python does NOT duplicate Node's RAG chunk retrieval.

## Consequences
- Clear ownership per KB type — no overlapping search implementations.
- Unified search (`/api/search/unified`) in Node federates across both by calling Python proxy internally.
- Each service manages its own SQLite files independently.
