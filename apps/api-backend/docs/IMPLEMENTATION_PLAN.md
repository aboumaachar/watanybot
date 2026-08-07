# WatanBot — Implementation Plan (Delta to Target Spec)

Date: 2026-02-04

## Recommended architecture choice
**Option 2 Hybrid**
- **SQLite v3** for KB canonical read/search (procedures + law).
- **Postgres** (existing) for auth/users/audit/chat logs/feedback.
- Do **not** migrate KB to Postgres; preserve SQLite v3 semantics.

## Prioritized checklist (implementation delta)

1) **Introduce SQLite v3 KB access layer (read-only first)**
   - Create a dedicated SQLite repository module to query:
     - `transactions`, `tx_fts`, `tx_links`
     - `law_sources`, `law_articles`, `law_fts`
     - `tx_law_map`
   - Ensure FTS `MATCH` queries are parameterized and safe.

2) **Add public retrieval endpoints for v3 KB**
   - Procedure search via `tx_fts MATCH`
   - Procedure detail endpoint returning:
     - required docs, submission location, steps/notes
     - related procedures (via `tx_links`)
     - legal basis (via `tx_law_map` → `law_articles`)
   - Law article search via `law_fts MATCH`
   - Next-step suggestions via `tx_links`

3) **Update chat endpoint to be KB-first + deterministic**
   - Use SQLite v3 only for procedural/legal answers
   - Never invent details
   - Always cite `tx_no` and/or `article_no`
   - Return safe fallback + 1 clarifying question when no match

4) **Admin tooling for mapping + CSV**
   - Add admin endpoints for:
     - mapping review/edit
     - CSV import/export
     - KB diagnostics (SQLite integrity + FTS checks)
   - Extend admin UI pages to surface mapping and CSV tooling

5) **Controlled learning policy**
   - Ensure feedback capture remains in Postgres
   - No autonomous edits to SQLite KB
   - Admin-only mapping update flows

6) **Ops enhancements (SQLite KB)**
   - Doctor checks for KB file presence and schema integrity
   - FTS sanity checks for `tx_fts` and `law_fts`
   - Backup/restore guidance for SQLite KB

7) **Testing**
   - Add tests for SQLite v3 schema validation
   - Add retrieval endpoint tests with fixture DB
   - Add chat deterministic behavior tests

## Exact files to create/modify (planned)

### New
- apps/api/kb_sqlite.py (SQLite v3 access layer)
- apps/api/routers/kb_v3.py (v3 endpoints)
- apps/api/schemas_kb_v3.py (v3 response models)
- apps/admin-console/src/pages/KBMappings.jsx
- apps/admin-console/src/pages/KBImportExport.jsx
- scripts/kb_import_csv.py (CSV import for v3)
- docs/KB_V3.md (schema + ops)

### Modify
- apps/api/main.py (mount v3 router)
- apps/api/routers/public.py (chat: KB-first deterministic v3)
- apps/api/routers/admin.py (mapping + CSV endpoints)
- apps/admin-console/src/App.jsx (add mapping/import pages)
- infra/docker/docker-compose.yml (mount SQLite KB file)

## Migration / compatibility plan
1. Keep Postgres schema intact for auth/audit/chat/feedback.
2. Introduce SQLite v3 reader with explicit file path config (env: `KB_SQLITE_PATH`).
3. Add read-only endpoints first; then admin mapping and CSV tooling.
4. Update chat logic to prioritize v3 KB; keep Postgres KB cards as legacy fallback only if required (flag-controlled).
5. Add operational docs for KB file placement and backups.

## Risks / mitigation
- **Missing KB file** → fail fast with clear diagnostics + fallback message.
- **FTS mismatch** → add health checks and test queries.
- **Schema drift** → enforce schema validation in doctor scripts + tests.
