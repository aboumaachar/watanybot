# KB v3 (SQLite) — Procedures + ND Law

This document describes the SQLite v3 knowledge base used for Lebanese veterans procedures and National Defense Law mapping.

## File placement
- Default path (container): `/data/kb.sqlite`
- Host path configured via `KB_SQLITE_PATH_HOST` in docker-compose.
- App config uses `KB_SQLITE_PATH`.

## Required tables
- `transactions`, `tx_fts`, `tx_links`
- `law_sources`, `law_articles`, `law_fts`
- `tx_law_map`

## Diagnostics
Use:
- `GET /api/admin/kb/diagnostics`
- `scripts/doctor.sh` (includes SQLite checks)

Expected checks:
- KB file exists
- Required tables present
- FTS `MATCH` works for `tx_fts` and `law_fts`

## CSV mapping workflow
- Export: `GET /api/admin/mapping/export`
- Import: `POST /api/admin/mapping/import` (CSV with headers: `tx_no,article_no,relevance,rationale`)
- Update single mapping: `PUT /api/admin/mapping/{tx_no}/{article_no}`

All mapping edits are logged to Postgres `audit_logs`.

## Common errors
- **Missing KB file** → configure `KB_SQLITE_PATH_HOST` and mount file.
- **FTS MATCH failed** → verify `tx_fts` and `law_fts` are FTS tables.
- **Missing tables** → verify schema or re-export KB.
