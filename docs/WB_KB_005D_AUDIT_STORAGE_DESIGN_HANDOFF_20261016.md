# WB-KB-005D — append-only KB review audit storage: design handoff
Date: 2026-10-16
Classification: READ_ONLY / DOCUMENTATION. NOT AN AUTHORIZATION TO EXECUTE A DB MIGRATION.

## Existing evidence
- Verified from completed Stage read-only SQL: isolated database `koudama_stage`, existing `public.audit_log` with zero rows when observed, RLS disabled and no non-internal triggers.
- A later read-only permission query **failed** (native exit 1, `unknown || "char"` ambiguous operator). Its partial output before failure showed owner `koudstagemig` and ACL `{koudstagemig=arwdDxt/koudstagemig,koudstageapp=arwd/koudstagemig,koudstagero=r/koudstagemig}`. This raises an app-role UPDATE/DELETE risk but is NOT a complete successful privilege assessment. Dependent query replacement is BLOCKED until approved APEX failure registration.
- `packages/db/migrations/013_review_workflow.sql` contains FAQ reviewer name/status only; it does not establish append-only, authenticated KB-source reviewer events.
- `apps/gateway-api/src/services/kb/official-source-approval-workflow.ts` has adapter interfaces and synthetic local tests, not a real reviewer resolver or database store.
- `apps/gateway-api/src/db/migrate.ts` requires transactionally consistent SQL and `_migrations` ledger. Do not create or apply a migration before clearance.

## Proposed independent table
Choose a distinct `kb_review_audit_events` table in a security-controlled schema; do not change the existing `public.audit_log` blindly. Capture source/claim ID, event type, server-resolved reviewer principal, exact source URL, snapshot and candidate SHA256, decision, bounded rationale, server UTC timestamp, unique idempotency key, and hash commitment. This is an **append-only event record**: new decisions create new rows; old rows are never rewritten.

## Roles and controls
- NOLOGIN table owner separate from normal application role, and verify inherited privileges.
- Narrow append writer; independent read-only verifier; no UPDATE, DELETE, TRUNCATE, ALTER, DROP or role inheritance permitting escalation to app.
- No client-provided reviewer role: derive identity server-side from genuine authenticated session, with revoked/expired and unauthorized tests.
- A decision remains pending, not published or source-renewed, until distinct release-authority event.
- Hash alone does not make DB records immutable; consider off-host WORM/digest anchoring and verify real backups/restores.

## Before any DB mutation
1. Resolve canonical APEX failure-register write denial through original supported authority. Do not retry or repackage its denied action.
2. Independently establish real Staging physical identity, least-privilege roles, backup/restore and recovery; keep Production inaccessible.
3. Review proposed migration, role grants and rollback with an independent human if mandated.
4. Use authorized isolated Stage acceptance: committed append and independent fresh-connection readback; deny UPDATE/DELETE/TRUNCATE/schema changes, duplicate events, spoofed identities, and cross-tenant access; verify no residue after failed transactions.
5. Verify actual browser/API reviewer and nonreviewer sessions; maintain separate approval before exposing Staging.

## Status
- Architecture prepared; no SQL migration or DB write performed by this checkpoint.
- Auditable persistence, genuine identity and recovery proof: UNVERIFIED / NOT RUN.
- Historical F-01, denied register, protected route source and Apache actions: BLOCKED.
- Public Staging SUSPENDED, Production HOLD.

The complete design and 22-case acceptance matrix are in the downloadable artifact `WatanyBot_WB_KB_005D_Append_Only_Audit_Design_20261016.md` delivered in this conversation. Do not treat this handoff as the source of executable migrations.
