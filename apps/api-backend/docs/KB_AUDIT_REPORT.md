# KB Audit Report

Summary: ERROR

## Detected KB files
- None found

## Active KB path
- C:\data\kb.sqlite

## Env readiness
- APP_ENV: missing (<missing>)
- ENVIRONMENT: missing (<missing>)
- KB_SQLITE_PATH: missing (<missing>)
- USE_SQLITE_V3_KB: missing (<missing>)
- LEGACY_POSTGRES_KB_FALLBACK: missing (<missing>)
- POSTGRES_HOST: ok (localhost)
- POSTGRES_PORT: ok (5432)
- POSTGRES_DB: ok (watanbot)
- POSTGRES_USER: ok (watanbot)
- POSTGRES_PASSWORD: ok (<redacted>)
- JWT_SECRET: ok (<redacted>)
- AUTO_APPROVE: ok (false)
- AUTO_INGEST: missing (<missing>)

## SQLite schema detection
- SQLite version: None
- page_count: None
- page_size: None
- FTS: {}

### Required tables

### Counts

### Mapping coverage
- mapping_coverage: None

### KB age
- kb_age_mtime: None

### FTS sanity

## Postgres KB detection
- connected: False
- kb_cards_exists: False
- counts: {}
- fts: {}

## What Step 3 must do next
- Place KB SQLite v3 file and set KB_SQLITE_PATH
