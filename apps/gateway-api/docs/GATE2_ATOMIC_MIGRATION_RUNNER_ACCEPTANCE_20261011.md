APEX_PS1_SKILL_UPDATE_NOT_REQUIRED

# WatanyBot Gate 2 — Local migration-runner atomicity (11 October 2026)

## Scope and preservation
- Approved: local development and **synthetic test databases only**, without enabling BitLocker.
- Not approved or not exercised: production data export, production vs local schema-signature retry, protected-data synchronization, canonical local migration, or production deployment.
- Canonical workspace: `C:\xampp\htdocs\projectx\watanybot`.
- Protected canonical local database: `watany` — **not used as the migration target**.
- Existing Git changes outside the named files were preserved.

## Source-level implementation
- `src/db/migrate.ts` now pins every batch to one PostgreSQL client and transaction.
- A transaction-scoped PostgreSQL advisory lock serializes collaborating new runner invocations.
- Each DDL statement and its corresponding `_migrations` insert is committed in the same transaction; any statement error triggers rollback of the pending batch.
- Audited outer `BEGIN;`/`COMMIT;` wrappers are removed before executing inside the runner transaction. Mismatched/embedded transaction-control statements and known nontransactional SQL patterns fail closed.
- Unknown applied-ledger entries whose source file is unavailable are rejected with `MIGRATION_LEDGER_SOURCE_MISSING`; **no source filenames are silently inferred or inserted into the ledger**.
- On any migration error, the runner destroys the failed PostgreSQL pool connection rather than returning it to the pool. If rollback also fails, the original SQL and rollback errors remain attached to `MIGRATION_FAILED_AND_ROLLBACK_UNVERIFIED`.
- The direct CLI exits with an error code and closes its pool on failures.

## Historical source reconciliation
Historical local migration SQL restored from existing Git commit `8d40246`, with bytes checked against exact restored source:
- `054_article_analytics_events.sql` SHA-256 `cefee70a82fbbd20b8d450be92aeba1aee04a1e9703e96176899e777511427b4`.
- `055_job_applicant_accounts_and_readiness.sql` SHA-256 `807c599f3a54f1cd57dabe899e69ff82acd43aeb2306afa84fa81afd858a8f3f`.
- `056_article_comments.sql` had already been restored and checked against the production SQL source in the preceding development stage.
- `056_job_template_builder.sql` remains **UNRESOLVED**: its historical source retrieval was denied by platform safety policy; no alternate retrieval was attempted.
- Current local source-file inventory: **61** SQL files. The 56-entry local applied ledger was **not** rewritten.

## Live local-only acceptance — PostgreSQL 15 Docker
- Isolated synthetic target `gate2_runner_acceptance_20261011` first test: exit `0`, token `GATE2_MIGRATION_RUNNER_ACCEPTANCE_PASS`.
- Independently repeated on fresh database `gate2_runner_acceptance_v2_20261011` after connection-safety hardening: exit `0`, same token.
- Explicit `BEGIN;`/`COMMIT;` wrapper normalized; first execution committed one fixture ledger entry and rerun committed zero.
- Injected later statement failure: both earlier pending DDL and ledger inserts from the same batch rolled back; previous committed fixture remained.
- Corrected fixture: both pending migrations committed atomically.
- Synthetic unknown ledger name: migration was blocked and the prospective DDL was absent; then synthetic-only cleanup and recovery succeeded.
- Mismatched `BEGIN;` wrapper rejected before the DB query.
- Simulated SQL-failure plus rollback-failure produced both original error objects.
- Negative invocation without explicit `GATE2_SYNTHETIC_MIGRATION_ACCEPTANCE=YES`: expected exit `1` and `GATE2_EXPLICIT_LOCAL_SYNTHETIC_ACCEPTANCE_REQUIRED`, without connecting to a database.
- Local source-only runner preflight: `GATE2_SOURCE_PREFLIGHT_PASS fileCount=61`, exit `0`, DB query deliberately disabled.
- TypeScript compiler: `pnpm exec tsc -p tsconfig.json --noEmit` exit `0`; final success token verification recorded separately.

## Retained failure evidence
- Original transaction/ledger split in old migrate.ts.
- Historical SQL files containing outer transaction wrappers.
- A Git restoration command using `cmd.exe if exist` combined with `&&` returned misleading exit 0 with no files: registered as fail-closed command-chain regression before native-API corrective action.
- First typecheck after replacement found `AggregateError` unavailable in the project TS lib. Registered and fixed, then complete typecheck rerun.
- Connection-disposal path reviewed and hardened, with new failure class registered.
- Third historical source retrieval denied by platform safety policy. **Not rerouted**.

## Gate decision
`LOCAL_MIGRATION_RUNNER_ATOMICITY=PASS`
`LOCAL_SYNTHETIC_MIGRATION_ACCEPTANCE=PASS`
`HISTORICAL_LEDGER_RECONCILIATION=PARTIAL_BLOCKED_056_SOURCE`
`CANONICAL_LOCAL_MIGRATIONS=NOT_EXECUTED`
`PRODUCTION_PERSONAL_DATA_SYNC=NOT_EXECUTED`
`R025_PRODUCTION_RELEASE=NO_GO`

The local-only development milestone can be accepted for the transactional runner and synthetic tests; this does not make the overall Gate 2 sync/release green.
