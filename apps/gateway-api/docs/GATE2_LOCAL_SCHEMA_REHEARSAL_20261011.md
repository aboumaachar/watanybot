APEX_PS1_SKILL_UPDATE_NOT_REQUIRED

# Gate 2 — Local-only schema rehearsal (2026-10-11)

## Authorized scope
Local development and synthetic fixtures **without enabling BitLocker**. No production private-data export, sync, release deployment, destructive migration, or attempt to circumvent blocked platform verification.

## Grounded baseline
- Local canonical PostgreSQL: `watany` in Docker `watanybot-postgres`. Before continuation: 95 tables; 56 applied migration records; 1 local user; 1 job application template; 2 template versions.
- Production aggregate census previously authorized read-only: `watany_gateway_prod`, 102 public tables, 59 ledger records, 2,662 users, 192 published articles. No production rows were imported.
- Local preimage custom-format archive: `/tmp/apex_gate2_local_preimage_20261011.dump` inside `watanybot-postgres`; archive read via `pg_restore -l`, then restored independently as `gate2_rehearsal_20261011` (exit 0). This is NOT an encrypted off-container disaster-recovery backup.
- Six migration files applied to **the isolated rehearsal database only** with native exit 0: `049_community_message_stars_runtime_contract.sql`, `056_job_posting_management_controls.sql`, `057_job_posting_universal_locator_and_form_creator.sql`, `058_universal_forms_platform.sql`, `059_universal_forms_v3a_workflow.sql`, and `056_article_comments.sql`. Rehearsal table count subsequently observed: 102.
- Existing local users and template/template-version records were retained in the restored rehearsal database.

## Current source changes
1. Added `src/db/migrations/056_article_comments.sql`, exactly matching the authorized production release SQL source by SHA-256 `69436aec7efb1da9c71cb7e04f440b2a617b667d209a8e0a2bcadf6f00fcdb59`.
2. Added `scripts/gate2_synthetic_form_contract_smoke.sql`, a temporary-data-only test that requires the exact disposable database `gate2_rehearsal_20261011` and ends with `ROLLBACK`. It checks version relationships, workflow event linkage, upload reference linkage, article comments, and rejection of an invalid article-comment status. No real identities or file blobs are used.

## Fresh runtime evidence
- Synthetic contract smoke on `gate2_rehearsal_20261011`: native exit **0**, stdout token `GATE2_SYNTHETIC_FORMS_CONTRACT_PASS`, no error output. Synthetic inserts were inside a transaction followed by `ROLLBACK`.
- Wrong-database negative acceptance on local `postgres`: native exit **3** and expected `GATE2_DISPOSABLE_DATABASE_GUARD_FAILED`. No success token. This confirms the test refuses execution outside the named clone.

## Remaining discrepancies and limitations
- Canonical local `watany` has **not** been migrated by this continuation; the tested DDL lives in the isolated clone.
- Applied ledger names and available SQL source files remain divergent: local source baseline had five unapplied migration files and three ledger-only historical names. Adding the article-comments source does not alter ledger state.
- `migrate.ts` currently runs SQL and migration-ledger INSERT as independent statements and does not guarantee transactional coupling. It was NOT executed against the canonical local database.
- Source/target detailed schema-signature comparison was previously denied by a platform safety restriction and was NOT rerun or routed around.
- No production users, job applications, published article rows, personal data, attachments, or authentication secrets were copied.
- Production deployment, full record reconciliation, encrypted transfer, recovery-key custody, and final production acceptance remain NO-GO/UNVERIFIED.

## Stage decision
`LOCAL_SYNTHETIC_SCHEMA_REHEARSAL=PASS`
`CANONICAL_LOCAL_MIGRATION=NOT_PERFORMED`
`PRODUCTION_TO_LOCAL_PERSONAL_DATA_SYNC=NOT_PERFORMED`
`PRODUCTION_RELEASE=NO_GO`
